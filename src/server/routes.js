import { getAccessInfo } from './access.js';
import { writeFile } from 'node:fs/promises';
import { audioExts, documentExts, imageExts, textExts, videoExts } from './media-types.js';
import { listLibraryFolder, publicLibrary } from './libraries.js';
import { readJsonBody, sendJson } from './http.js';
import { verifyPassword } from './security.js';
import { applyAppConfig } from './config.js';

export function getHealth(config) {
  return {
    ok: true,
    libraries: config.libraries.map(publicLibrary),
    access: getAccessInfo(config),
    adminEnabled: config.adminLocked,
    supported: supportedMedia()
  };
}

export function getLibraries(config) {
  return {
    libraries: config.libraries.map(publicLibrary),
    adminEnabled: config.adminLocked,
    supported: supportedMedia()
  };
}

export function getAdminStatus(config) {
  return { enabled: config.adminLocked };
}

export async function unlockAdmin(req, res, config, security) {
  try {
    if (!config.adminLocked) return sendJson(res, 403, { error: '管理员密码未启用 / Admin password is not enabled' });
    const body = await readJsonBody(req);
    const password = readSubmittedPassword(req, body, security);
    if (password !== config.adminPassword) {
      return sendJson(res, 401, { error: '管理员密码不正确 / Incorrect admin password' });
    }
    return sendJson(res, 200, {
      token: security.createAdminToken(),
      expiresIn: security.ttlSeconds
    });
  } catch (error) {
    return sendJson(res, error.status || 400, { error: error.message || '无法验证管理员密码 / Cannot verify admin password' });
  }
}

export function getAdminConfig(req, res, url, config, security) {
  if (!security.tokenAllowsAdmin(req, url)) return sendJson(res, 401, { error: '需要管理员权限 / Admin access required' });
  return sendJson(res, 200, {
    publicUrl: config.publicUrl,
    libraries: config.libraries.map((library) => ({
      id: library.id,
      name: library.name,
      path: library.path,
      locked: library.locked,
      passwordSet: library.locked
    }))
  });
}

export async function saveAdminConfig(req, res, url, config, security) {
  if (!security.tokenAllowsAdmin(req, url)) return sendJson(res, 401, { error: '需要管理员权限 / Admin access required' });
  try {
    const body = await readJsonBody(req, 512 * 1024);
    const previous = new Map(config.libraries.map((library) => [library.id, library]));
    const libraries = normalizeAdminLibraries(body.libraries || [], previous);
    if (!libraries.length) return sendJson(res, 400, { error: '至少保留一个文件夹 / Keep at least one folder' });

    const appConfig = {
      publicUrl: String(body.publicUrl || '').trim(),
      adminPassword: config.adminPassword,
      closeToTray: config.closeToTray !== false,
      libraries
    };
    await writeFile(config.configPath, JSON.stringify(appConfig, null, 2) + '\n', 'utf8');
    applyAppConfig(config, appConfig);
    return sendJson(res, 200, { ok: true, libraries: config.libraries.map(publicLibrary) });
  } catch (error) {
    return sendJson(res, error.status || 400, { error: error.message || '保存失败 / Save failed' });
  }
}

export async function unlockLibrary(req, res, config, security) {
  try {
    const body = await readJsonBody(req);
    const library = config.libraryMap.get(String(body.libraryId || ''));
    if (!library) return sendJson(res, 404, { error: '媒体库不存在' });
    if (!library.locked) return sendJson(res, 200, { token: security.createToken(library.id) });

    const password = readSubmittedPassword(req, body, security);
    if (!verifyPassword(library, password)) {
      return sendJson(res, 401, { error: '密码不正确' });
    }

    return sendJson(res, 200, {
      token: security.createToken(library.id),
      expiresIn: security.ttlSeconds
    });
  } catch (error) {
    return sendJson(res, error.status || 400, { error: error.message || '无法验证密码' });
  }
}

export async function listFolder(req, res, url, config, security) {
  const libraryId = url.searchParams.get('library') || config.libraries[0]?.id || '';
  const library = config.libraryMap.get(libraryId);
  if (!library) return sendJson(res, 404, { error: '媒体库不存在' });
  if (!security.tokenAllows(req, library, url)) return sendJson(res, 401, { error: '需要密码', locked: true });

  try {
    const payload = await listLibraryFolder(library, url.searchParams.get('path') || '');
    return sendJson(res, 200, payload);
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(res, 404, { error: '文件夹不存在' });
    return sendJson(res, error.status || 500, { error: error.message || '无法读取文件夹' });
  }
}

function supportedMedia() {
  return {
    audio: [...audioExts],
    video: [...videoExts],
    image: [...imageExts],
    text: [...textExts],
    document: [...documentExts]
  };
}

function normalizeAdminLibraries(rawLibraries, previous) {
  return rawLibraries
    .map((entry, index) => {
      const id = String(entry.id || `library-${index + 1}`).trim() || `library-${index + 1}`;
      const old = previous.get(id);
      const locked = Boolean(entry.locked);
      const password = String(entry.password || '');
      return {
        id,
        name: String(entry.name || `Library ${index + 1}`).trim(),
        path: String(entry.path || '').trim(),
        password: locked ? password || old?.password || '' : '',
        passwordHash: locked && !password ? old?.passwordHash || '' : ''
      };
    })
    .filter((library) => library.path);
}

function readSubmittedPassword(req, body, security) {
  if (body.encryptedPassword) return security.decryptPassword(body.encryptedPassword, body.keyId);
  if (body.plainPassword && allowsPlainPassword(req)) return String(body.plainPassword);
  const error = new Error('当前连接不能明文提交密码，请使用 HTTPS 或局域网地址 / Plain password is only allowed on private LAN addresses');
  error.status = 400;
  throw error;
}

function allowsPlainPassword(req) {
  const host = String(req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const remote = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '').replace(/^\[|\]$/g, '');
  return isPrivateHost(host) && isPrivateHost(remote);
}

function isPrivateHost(host) {
  const value = String(host || '').toLowerCase();
  if (value === 'localhost' || value.endsWith('.local')) return true;
  if (value === '::1' || value === '0:0:0:0:0:0:0:1') return true;
  if (value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')) return true;
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}
