using System.Text.Json;
using System.Text.Json.Serialization;

namespace RemoteMediaPlayer.Desktop;

internal sealed class AppConfig
{
    [JsonPropertyName("publicUrl")]
    public string PublicUrl { get; set; } = "";

    [JsonPropertyName("libraries")]
    public List<MediaLibrary> Libraries { get; set; } = [];

    [JsonPropertyName("closeToTray")]
    public bool CloseToTray { get; set; } = true;

    [JsonPropertyName("adminPassword")]
    public string AdminPassword { get; set; } = "";

    public static AppConfig Load(string path)
    {
        if (!File.Exists(path)) return Default();
        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<AppConfig>(json, JsonOptions()) ?? Default();
    }

    public void Save(string path)
    {
        var json = JsonSerializer.Serialize(this, JsonOptions());
        File.WriteAllText(path, json + Environment.NewLine);
    }

    public static AppConfig Default() => new()
    {
        CloseToTray = true,
        Libraries =
        [
            new MediaLibrary
            {
                Id = "main",
                Name = "我的媒体",
                Path = Environment.GetFolderPath(Environment.SpecialFolder.MyMusic)
            }
        ]
    };

    private static JsonSerializerOptions JsonOptions() => new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingDefault
    };
}

internal sealed class MediaLibrary
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("path")]
    public string Path { get; set; } = "";

    [JsonPropertyName("password")]
    public string Password { get; set; } = "";

    [JsonPropertyName("passwordHash")]
    public string PasswordHash { get; set; } = "";
}
