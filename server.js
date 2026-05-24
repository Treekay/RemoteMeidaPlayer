import { createServer } from './src/server/app.js';
import { loadServerConfig } from './src/server/config.js';
import { createSecurityService } from './src/server/security.js';

const config = await loadServerConfig();
const security = createSecurityService();
const server = createServer(config, security);

server.listen(config.port, config.host, () => {
  console.log(`RemoteMediaPlayer listening on http://${config.host}:${config.port}`);
  console.log('Configured media libraries:');
  config.libraries.forEach((library) => {
    const lock = library.locked ? 'locked' : 'open';
    console.log(`- ${library.name} (${library.id}, ${lock}): ${library.path}`);
  });
  console.log('Open this URL on your phone using your PC LAN IP, for example http://192.168.x.x:' + config.port);
});
