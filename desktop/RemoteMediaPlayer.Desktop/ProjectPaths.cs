namespace RemoteMediaPlayer.Desktop;

internal static class ProjectPaths
{
    public static string Root { get; } = FindRoot();
    public static string ConfigPath => Path.Combine(Root, "media.config.json");
    public static string PackageJsonPath => Path.Combine(Root, "package.json");

    private static string FindRoot()
    {
        foreach (var start in new[] { AppContext.BaseDirectory, Directory.GetCurrentDirectory() })
        {
            var current = new DirectoryInfo(start);
            while (current != null)
            {
                if (File.Exists(Path.Combine(current.FullName, "package.json")) &&
                    File.Exists(Path.Combine(current.FullName, "server.js")))
                {
                    return current.FullName;
                }
                current = current.Parent;
            }
        }
        return Directory.GetCurrentDirectory();
    }
}
