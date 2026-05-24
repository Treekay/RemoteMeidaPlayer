import { getAccessInfo } from './access.js';
import { audioExts, videoExts } from './media-types.js';
import { listLibraryFolder, publicLibrary } from './libraries.js';
import { readJsonBody, sendJson } from './http.js';
import { verifyPassword } from './security.js';

export function getHealth(config) {
  return {
    ok: true,
    libraries: config.libraries.map(publicLibrary),
    access: getAccessInfo(config),
    supported: supportedMedia()
  };
}

export function getLibraries(config) {
  return {
    libraries: config.libraries.map(publicLibrary),
    supported: supportedMedia()
  };
}

export async function unlockLibrary(req, res, config, security) {
  try {
    const body = await readJsonBody(req);
    const library = config.libraryMap.get(String(body.libraryId || ''));
    if (!library) return sendJson(res, 404, { error: '媒体库不存在' });
    if (!library.locked) return sendJson(res, 200, { token: security.createToken(library.id) });

    const password = security.decryptPassword(body.encryptedPassword, body.keyId);
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
  return { audio: [...audioExts], video: [...videoExts] };
}
