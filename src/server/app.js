import http from 'node:http';
import { sendCorsPreflight, sendJson, sendText } from './http.js';
import { chooseFolder, getHealth, getLibraries, getSetup, listFolder, saveSetup, unlockLibrary } from './routes.js';
import { serveStatic } from './static-files.js';
import { streamMedia } from './media-stream.js';

export function createServer(config, security) {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return sendCorsPreflight(res);

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, getHealth(config));
    }
    if (req.method === 'GET' && url.pathname === '/api/libraries') {
      return sendJson(res, 200, getLibraries(config));
    }
    if (req.method === 'GET' && url.pathname === '/api/crypto-key') {
      return sendJson(res, 200, security.getPublicKey());
    }
    if (req.method === 'GET' && url.pathname === '/api/setup') {
      if (!isLocalRequest(req)) return sendText(res, 403, 'Setup is only available on this computer');
      return sendJson(res, 200, getSetup(config));
    }
    if (req.method === 'POST' && url.pathname === '/api/setup') {
      if (!isLocalRequest(req)) return sendText(res, 403, 'Setup is only available on this computer');
      return saveSetup(req, res, config);
    }
    if (req.method === 'POST' && url.pathname === '/api/setup/pick-folder') {
      if (!isLocalRequest(req)) return sendText(res, 403, 'Setup is only available on this computer');
      return chooseFolder(req, res);
    }
    if (req.method === 'POST' && url.pathname === '/api/unlock') {
      return unlockLibrary(req, res, config, security);
    }
    if (req.method === 'GET' && url.pathname === '/api/list') {
      return listFolder(req, res, url, config, security);
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (url.pathname.startsWith('/media/')) return streamMedia(req, res, url, config, security);
      return serveStatic(req, res, config.publicDir, url.pathname);
    }

    return sendText(res, 405, 'Method not allowed');
  });
}

function isLocalRequest(req) {
  const address = req.socket.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}
