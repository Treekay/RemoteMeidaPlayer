using System.Diagnostics;
using System.Net.Http.Json;
using System.Text;

namespace RemoteMediaPlayer.Desktop;

internal sealed class ServerProcess : IDisposable
{
    private readonly StringBuilder _log = new();
    private Process? _process;

    public bool IsRunning => _process is { HasExited: false };
    public string LastLog => _log.ToString();

    public void Start(int port)
    {
        if (IsRunning) return;
        _log.Clear();

        var node = FindExecutable("node.exe") ?? FindExecutable("node");
        if (node is null)
        {
            throw new InvalidOperationException("Node.js was not found in PATH. Please install Node.js or run from a terminal where node is available.");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = node,
            WorkingDirectory = ProjectPaths.Root,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        startInfo.ArgumentList.Add("server.js");
        startInfo.ArgumentList.Add("--config");
        startInfo.ArgumentList.Add(ProjectPaths.ConfigPath);
        startInfo.ArgumentList.Add("--port");
        startInfo.ArgumentList.Add(port.ToString());
        startInfo.ArgumentList.Add("--host");
        startInfo.ArgumentList.Add("0.0.0.0");

        _process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        _process.OutputDataReceived += (_, eventArgs) => AppendLog(eventArgs.Data);
        _process.ErrorDataReceived += (_, eventArgs) => AppendLog(eventArgs.Data);
        _process.Start();
        _process.BeginOutputReadLine();
        _process.BeginErrorReadLine();
    }

    public async Task<bool> WaitUntilHealthyAsync(int port, TimeSpan timeout)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
        var deadline = DateTimeOffset.Now + timeout;
        while (DateTimeOffset.Now < deadline)
        {
            if (_process is { HasExited: true }) return false;
            try
            {
                var health = await client.GetFromJsonAsync<HealthResponse>($"http://127.0.0.1:{port}/api/health");
                if (health?.Ok == true) return true;
            }
            catch
            {
                await Task.Delay(250);
            }
        }
        return false;
    }

    public void Stop()
    {
        if (!IsRunning) return;
        _process!.Kill(entireProcessTree: true);
        _process.Dispose();
        _process = null;
    }

    public void Dispose() => Stop();

    private void AppendLog(string? line)
    {
        if (string.IsNullOrWhiteSpace(line)) return;
        lock (_log)
        {
            _log.AppendLine(line);
        }
    }

    private static string? FindExecutable(string name)
    {
        var paths = (Environment.GetEnvironmentVariable("PATH") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries);
        foreach (var path in paths)
        {
            var candidate = Path.Combine(path.Trim('"'), name);
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }

    private sealed class HealthResponse
    {
        public bool Ok { get; set; }
    }
}
