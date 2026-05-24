using System.Diagnostics;

namespace RemoteMediaPlayer.Desktop;

internal sealed class ServerProcess : IDisposable
{
    private Process? _process;

    public bool IsRunning => _process is { HasExited: false };

    public void Start(int port)
    {
        if (IsRunning) return;
        var npm = OperatingSystem.IsWindows() ? "npm.cmd" : "npm";
        var startInfo = new ProcessStartInfo
        {
            FileName = npm,
            WorkingDirectory = ProjectPaths.Root,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        startInfo.ArgumentList.Add("start");
        startInfo.ArgumentList.Add("--");
        startInfo.ArgumentList.Add("--config");
        startInfo.ArgumentList.Add(ProjectPaths.ConfigPath);
        startInfo.ArgumentList.Add("--port");
        startInfo.ArgumentList.Add(port.ToString());
        startInfo.ArgumentList.Add("--host");
        startInfo.ArgumentList.Add("0.0.0.0");

        _process = Process.Start(startInfo);
    }

    public void Stop()
    {
        if (!IsRunning) return;
        _process!.Kill(entireProcessTree: true);
        _process.Dispose();
        _process = null;
    }

    public void Dispose() => Stop();
}
