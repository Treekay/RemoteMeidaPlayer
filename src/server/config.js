import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export async function loadServerConfig() {
  const port = Number(process.env.PORT || getArg('--port') || 5178);
  const host = process.env.HOST || getArg('--host') || '0.0.0.0';
  const mediaRoot = path.resolve(process.env.MEDIA_ROOT || getArg('--media') || process.cwd());
  const configPath = process.env.MEDIA_CONFIG || getArg('--config') || '';
  const libraries = await loadLibraries(configPath, mediaRoot);

  return {
    port,
    host,
    mediaRoot,
    publicDir: path.join(projectRoot, 'public'),
    libraries,
    libraryMap: new Map(libraries.map((library) => [library.id, library]))
  };
}

async function loadLibraries(configPath, mediaRoot) {
  if (configPath) {
    const config = JSON.parse(await readFile(path.resolve(configPath), 'utf8'));
    const libraries = normalizeLibraries(config.libraries || config.folders || [], mediaRoot);
    if (libraries.length) return libraries;
  }

  return normalizeLibraries(
    [
      {
        id: 'main',
        name: process.env.MEDIA_NAME || '媒体库',
        path: mediaRoot,
        password: process.env.MEDIA_PASSWORD || ''
      }
    ],
    mediaRoot
  );
}

function normalizeLibraries(rawLibraries, fallbackRoot) {
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

    const password = entry.password ? String(entry.password) : '';
    const passwordHash = entry.passwordHash ? String(entry.passwordHash) : '';
    return {
      id,
      name: String(entry.name || entry.displayName || id),
      path: path.resolve(String(entry.path || entry.root || fallbackRoot)),
      password,
      passwordHash,
      locked: Boolean(password || passwordHash)
    };
  });
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
