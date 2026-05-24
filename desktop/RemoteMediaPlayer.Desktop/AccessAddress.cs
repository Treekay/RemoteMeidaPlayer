using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace RemoteMediaPlayer.Desktop;

internal static class AccessAddress
{
    public static string GetPrimaryUrl(AppConfig config, int port)
    {
        var publicUrl = Normalize(config.PublicUrl);
        if (!string.IsNullOrWhiteSpace(publicUrl)) return publicUrl;
        var lanIp = GetLanIpAddress();
        return $"http://{lanIp}:{port}";
    }

    public static string Normalize(string value) => (value ?? "").Trim().TrimEnd('/');

    private static string GetLanIpAddress()
    {
        var addresses = new List<string>();
        foreach (var network in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (network.OperationalStatus != OperationalStatus.Up) continue;
            if (network.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;

            foreach (var address in network.GetIPProperties().UnicastAddresses)
            {
                if (address.Address.AddressFamily == AddressFamily.InterNetwork)
                {
                    addresses.Add(address.Address.ToString());
                }
            }
        }
        return addresses
            .Where(address => !address.StartsWith("169.254."))
            .OrderBy(AddressPriority)
            .FirstOrDefault() ?? "127.0.0.1";
    }

    private static int AddressPriority(string address)
    {
        if (address.StartsWith("192.168.")) return 0;
        if (address.StartsWith("10.")) return 1;
        var parts = address.Split('.');
        if (parts.Length > 1 && address.StartsWith("172.") && int.TryParse(parts[1], out var second) && second is >= 16 and <= 31)
        {
            return 2;
        }
        return 3;
    }
}
