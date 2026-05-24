import os from 'node:os';

export function getAccessInfo(config) {
  if (config.publicUrl) {
    return {
      primaryUrl: config.publicUrl,
      urls: [config.publicUrl],
      source: 'public'
    };
  }

  const urls = getLanAddresses().map((address) => `http://${address}:${config.port}`);
  return {
    primaryUrl: urls[0] || `http://localhost:${config.port}`,
    urls,
    source: 'lan'
  };
}

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  return Object.values(interfaces)
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address)
    .filter((address) => !address.startsWith('169.254.'))
    .sort((a, b) => addressPriority(a) - addressPriority(b));
}

function addressPriority(address) {
  if (address.startsWith('192.168.')) return 0;
  if (address.startsWith('10.')) return 1;
  const second = Number(address.split('.')[1]);
  if (address.startsWith('172.') && second >= 16 && second <= 31) return 2;
  return 3;
}
