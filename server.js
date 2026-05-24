import http from 'node:http';
import fs from 'node:fs';
import { stat, readdir, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');

const PORT = Number(process.env.PORT || getArg('--port') || 5178);
const HOST = process.env.HOST || getArg('--host') || '0.0.0.0';
const mediaRoot = path.resolve(process.env.MEDIA_ROOT || getArg('--media') || process.cwd());
const configPath = process.env.MEDIA_CONFIG || getArg('--config') || '';

const audioExts = new Set(['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus', '.webm']);
const videoExts = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi']);
const sessions = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const unlockTokens = new Map();
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8;
const rsaKeys = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
const keyId = crypto.randomBytes(12).toString('hex');

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization, X-Library-Token',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function sendText(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization, X-Library-Token'
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function normalizeLibraries(rawLibraries = []) {
  const used = new Set();
  return rawLibraries.map((entry, index) => {
    const baseId = normalizeId(entry.id || entry.name || `library-${index + 1}`) || `library-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (used.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    used.add(id);

    return {
      id,
      name: String(entry.name || entry.displayName || id),
      path: path.resolve(String(entry.path || entry.root || mediaRoot)),
      password: entry.password ? String(entry.password) : '',
      passwordHash: entry.passwordHash ? String(entry.passwordHash) : ''
    };
  });
}

async function loadLibraries() {
  if (configPath) {
    const config = JSON.parse(await readFile(path.resolve(configPath), 'utf8'));
    const libraries = normalizeLibraries(config.libraries || config.folders || []);
    if (libraries.length) return libraries;
  }

  const password = process.env.MEDIA_PASSWORD || '';
  return normalizeLibraries([{ id: 'main', name: process.env.MEDIA_NAME || '媒体库', path: mediaRoot, password }]);
}

const libraries = await loadLibraries();
const libraryMap = new Map(libraries.map((library) => [library.id, library]));

function isPasswordProtected(library) {
  return Boolean(library.password || library.passwordHash);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyPassword(library, password) {
  if (!isPasswordProtected(library)) return true;
  if (library.passwordHash) return timingSafeEqualText(sha256(password), library.passwordHash);
  return timingSafeEqualText(password, library.password);
}

function createToken(libraryId) {
  const token = crypto.randomBytes(32).toString('base64url');
  unlockTokens.set(token, { libraryId, expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

function cleanupTokens() {
  const now = Date.now();
  for (const [token, session] of unlockTokens) {
    if (session.expiresAt <= now) unlockTokens.delete(token);
  }
}

function tokenAllows(req, libraryId, url) {
  const library = libraryMap.get(libraryId);
  if (!library) return false;
  if (!isPasswordProtected(library)) return true;

  cleanupTokens();
  const auth = req.headers.authorization || '';
  const headerToken = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-library-token'];
  const queryToken = url.searchParams.get('token');
  const token = headerToken || queryToken || '';
  const session = unlockTokens.get(token);
  return Boolean(session && session.libraryId === libraryId && session.expiresAt > Date.now());
}

function safeResolve(library, relativePath = '') {
  const clean = String(relativePath).replaceAll('\\', '/').replace(/^\/+/, '');
  const resolved = path.resolve(library.path, clean);
  if (resolved !== library.path && !resolved.startsWith(library.path + path.sep)) {
    return null;
  }
  return resolved;
}

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo'
  };
  return types[ext] || 'application/octet-stream';
}

function mediaKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (audioExts.has(ext)) return 'audio';
  if (videoExts.has(ext)) return 'video';
  return null;
}

function encodeMediaPath(value) {
  return toPosixPath(value).split('/').map(encodeURIComponent).join('/');
}

function publicLibrary(library) {
  return {
    id: library.id,
    name: library.name,
    locked: isPasswordProtected(library)
  };
}

async function handleLibraries(req, res) {
  sendJson(res, 200, {
    libraries: libraries.map((library) => publicLibrary(library)),
    supported: { audio: [...audioExts], video: [...videoExts] }
  });
}

async function handleCryptoKey(req, res) {
  const publicKey = crypto.createPublicKey(rsaKeys.publicKey);
  sendJson(res, 200, {
    keyId,
    algorithm: 'RSA-OAEP-256',
    publicKey: publicKey.export({ format: 'jwk' })
  });
}

async function handleUnlock(req, res) {
  try {
    const body = await readJsonBody(req);
    const library = libraryMap.get(String(body.libraryId || ''));
    if (!library) return sendJson(res, 404, { error: '媒体库不存在' });
    if (!isPasswordProtected(library)) return sendJson(res, 200, { token: createToken(library.id) });
    if (body.keyId !== keyId) return sendJson(res, 400, { error: '加密密钥已过期，请重试' });

    const encrypted = Buffer.from(String(body.encryptedPassword || ''), 'base64');
    const password = crypto.privateDecrypt(
      {
        key: rsaKeys.privateKey,
        oaepHash: 'sha256',
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
      },
      encrypted
    ).toString('utf8');

    if (!verifyPassword(library, password)) {
      return sendJson(res, 401, { error: '密码不正确' });
    }

    sendJson(res, 200, {
      token: createToken(library.id),
      expiresIn: Math.floor(TOKEN_TTL_MS / 1000)
    });
  } catch {
    sendJson(res, 400, { error: '无法验证密码' });
  }
}

async function handleList(req, res, url) {
  const libraryId = url.searchParams.get('library') || libraries[0]?.id || '';
  const library = libraryMap.get(libraryId);
  if (!library) return sendJson(res, 404, { error: '媒体库不存在' });
  if (!tokenAllows(req, libraryId, url)) return sendJson(res, 401, { error: '需要密码', locked: true });

  const requested = url.searchParams.get('path') || '';
  const resolved = safeResolve(library, requested);
  if (!resolved) return sendJson(res, 400, { error: '无效路径' });

  try {
    const rootStat = await stat(resolved);
    if (!rootStat.isDirectory()) return sendJson(res, 400, { error: '路径不是文件夹' });

    const entries = await readdir(resolved, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(resolved, entry.name);
      const rel = toPosixPath(path.relative(library.path, fullPath));
      if (entry.isDirectory()) {
        items.push({ type: 'folder', name: entry.name, path: rel });
        continue;
      }

      if (!entry.isFile()) continue;
      const kind = mediaKind(entry.name);
      if (!kind) continue;
      const info = await stat(fullPath);
      items.push({
        type: 'file',
        kind,
        name: entry.name,
        path: rel,
        size: info.size,
        url: `/media/${encodeURIComponent(library.id)}/${encodeMediaPath(rel)}`
      });
    }

    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
    });

    const parent = requested ? toPosixPath(path.dirname(requested)).replace(/^\.$/, '') : '';
    sendJson(res, 200, {
      library: publicLibrary(library),
      path: toPosixPath(path.relative(library.path, resolved)),
      parent,
      items
    });
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(res, 404, { error: '文件夹不存在' });
    sendJson(res, 500, { error: '无法读取文件夹' });
  }
}

async function streamMedia(req, res, url) {
  const match = url.pathname.match(/^\/media\/([^/]+)\/?(.*)$/);
  if (!match) return sendText(res, 404, 'Not found');

  const libraryId = decodeURIComponent(match[1]);
  const library = libraryMap.get(libraryId);
  if (!library) return sendText(res, 404, 'Not found');
  if (!tokenAllows(req, libraryId, url)) return sendText(res, 401, 'Password required');

  const mediaPath = decodeURIComponent(match[2] || '');
  const resolved = safeResolve(library, mediaPath);
  if (!resolved) return sendText(res, 400, 'Invalid path');

  try {
    const info = await stat(resolved);
    if (!info.isFile()) return sendText(res, 404, 'Not found');

    const range = req.headers.range;
    const contentType = mimeFor(resolved);

    if (range) {
      const rangeMatch = range.match(/bytes=(\d*)-(\d*)/);
      if (!rangeMatch) return sendText(res, 416, 'Invalid range');

      const start = rangeMatch[1] ? Number(rangeMatch[1]) : 0;
      const end = rangeMatch[2] ? Number(rangeMatch[2]) : info.size - 1;
      if (start >= info.size || end >= info.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
        return res.end();
      }

      res.writeHead(206, {
        'Content-Type': contentType,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${info.size}`,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(resolved, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': info.size,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(resolved).pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT') return sendText(res, 404, 'Not found');
    sendText(res, 500, 'Unable to stream file');
  }
}

async function serveStatic(req, res, pathname) {
  const filePath = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.resolve(publicDir, '.' + decodeURIComponent(filePath));
  if (resolved !== publicDir && !resolved.startsWith(publicDir + path.sep)) {
    return sendText(res, 400, 'Invalid path');
  }

  try {
    await access(resolved, fs.constants.R_OK);
    const info = await stat(resolved);
    if (!info.isFile()) return sendText(res, 404, 'Not found');
    res.writeHead(200, {
      'Content-Type': mimeFor(resolved),
      'Content-Length': info.size,
      'Cache-Control': resolved.endsWith('index.html') ? 'no-store' : 'public, max-age=3600'
    });
    fs.createReadStream(resolved).pipe(res);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization, X-Library-Token'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      libraries: libraries.map((library) => publicLibrary(library)),
      supported: { audio: [...audioExts], video: [...videoExts] }
    });
  }
  if (req.method === 'GET' && url.pathname === '/api/libraries') return handleLibraries(req, res);
  if (req.method === 'GET' && url.pathname === '/api/crypto-key') return handleCryptoKey(req, res);
  if (req.method === 'POST' && url.pathname === '/api/unlock') return handleUnlock(req, res);
  if (req.method === 'GET' && url.pathname === '/api/list') return handleList(req, res, url);
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (url.pathname.startsWith('/media/')) return streamMedia(req, res, url);
    return serveStatic(req, res, url.pathname);
  }

  return sendText(res, 405, 'Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`RemoteMediaPlayer listening on http://${HOST}:${PORT}`);
  console.log('Configured media libraries:');
  libraries.forEach((library) => {
    const lock = isPasswordProtected(library) ? 'locked' : 'open';
    console.log(`- ${library.name} (${library.id}, ${lock}): ${library.path}`);
  });
  console.log('Open this URL on your phone using your PC LAN IP, for example http://192.168.x.x:' + PORT);
});
