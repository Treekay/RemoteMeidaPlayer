import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import { encodeMediaPath, fileKind, toPosixPath } from './media-types.js';

export function publicLibrary(library) {
  return {
    id: library.id,
    name: library.name,
    locked: library.locked
  };
}

export function safeResolve(library, relativePath = '') {
  const clean = String(relativePath).replaceAll('\\', '/').replace(/^\/+/, '');
  const resolved = path.resolve(library.path, clean);
  if (resolved !== library.path && !resolved.startsWith(library.path + path.sep)) {
    return null;
  }
  return resolved;
}

export async function listLibraryFolder(library, requested = '') {
  const resolved = safeResolve(library, requested);
  if (!resolved) {
    const error = new Error('无效路径 / Invalid path');
    error.status = 400;
    throw error;
  }

  const rootStat = await stat(resolved);
  if (!rootStat.isDirectory()) {
    const error = new Error('路径不是文件夹 / Path is not a folder');
    error.status = 400;
    throw error;
  }

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
    const kind = fileKind(entry.name);
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

  return {
    library: publicLibrary(library),
    path: toPosixPath(path.relative(library.path, resolved)),
    parent: requested ? toPosixPath(path.dirname(requested)).replace(/^\.$/, '') : '',
    items
  };
}
