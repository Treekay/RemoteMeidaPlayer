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
        var addresses = new List<AddressCandidate>();
        foreach (var network in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (network.OperationalStatus != OperationalStatus.Up) continue;
            if (network.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
            if (network.Description.Contains("Virtual", StringComparison.OrdinalIgnoreCase)) continue;
            if (network.Description.Contains("VMware", StringComparison.OrdinalIgnoreCase)) continue;
            if (network.Description.Contains("Hyper-V", StringComparison.OrdinalIgnoreCase)) continue;
            if (network.Description.Contains("VirtualBox", StringComparison.OrdinalIgnoreCase)) continue;

            var ipProperties = network.GetIPProperties();
            var hasGateway = ipProperties.GatewayAddresses.Any(gateway =>
                gateway.Address.AddressFamily == AddressFamily.InterNetwork &&
                gateway.Address.ToString() != "0.0.0.0");
            foreach (var address in network.GetIPProperties().UnicastAddresses)
            {
                if (address.Address.AddressFamily == AddressFamily.InterNetwork)
                {
                    addresses.Add(new AddressCandidate(address.Address.ToString(), hasGateway, network.NetworkInterfaceType));
                }
            }
        }
        return addresses
            .Where(candidate => !candidate.Address.StartsWith("169.254."))
            .OrderBy(AddressPriority)
            .Select(candidate => candidate.Address)
            .FirstOrDefault() ?? "127.0.0.1";
    }

    private static int AddressPriority(AddressCandidate candidate)
    {
        var address = candidate.Address;
        var score = 0;
        if (!candidate.HasGateway) score += 100;
        if (candidate.Type is not NetworkInterfaceType.Wireless80211 and not NetworkInterfaceType.Ethernet) score += 50;
        if (address.StartsWith("192.168.")) return score;
        if (address.StartsWith("10.")) return score + 1;
        var parts = address.Split('.');
        if (parts.Length > 1 && address.StartsWith("172.") && int.TryParse(parts[1], out var second) && second is >= 16 and <= 31)
        {
            return score + 2;
        }
        return score + 3;
    }

    private sealed record AddressCandidate(string Address, bool HasGateway, NetworkInterfaceType Type);
}
