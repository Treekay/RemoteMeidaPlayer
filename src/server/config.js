import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaultConfigPath = path.join(projectRoot, 'media.config.json');

export function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export async function loadServerConfig() {
  const port = Number(process.env.PORT || getArg('--port') || 5178);
  const host = process.env.HOST || getArg('--host') || '0.0.0.0';
  const mediaRoot = path.resolve(process.env.MEDIA_ROOT || getArg('--media') || process.cwd());
  const explicitConfigPath = process.env.MEDIA_CONFIG || getArg('--config') || '';
  const configPath = explicitConfigPath ? path.resolve(explicitConfigPath) : defaultConfigPath;
  const libraries = await loadLibraries(configPath, mediaRoot, Boolean(explicitConfigPath));

  return createRuntimeConfig({
    port,
    host,
    mediaRoot,
    configPath,
    publicDir: path.join(projectRoot, 'public'),
    libraries
  });
}

export function createRuntimeConfig(config) {
  return {
    ...config,
    libraryMap: new Map(config.libraries.map((library) => [library.id, library])),
    replaceLibraries(nextLibraries) {
      this.libraries = normalizeLibraries(nextLibraries, this.mediaRoot);
      this.libraryMap = new Map(this.libraries.map((library) => [library.id, library]));
    }
  };
}

export async function saveLibraries(config, rawLibraries) {
  const existingById = new Map(config.libraries.map((library) => [library.id, library]));
  const merged = rawLibraries.map((library) => {
    if (!library.keepPassword) return library;
    const existing = existingById.get(String(library.id || ''));
    return {
      ...library,
      password: existing?.password || '',
      passwordHash: existing?.passwordHash || ''
    };
  });
  config.replaceLibraries(merged);
  const persisted = {
    libraries: config.libraries.map((library) => ({
      id: library.id,
      name: library.name,
      path: library.path,
      ...(library.password ? { password: library.password } : {}),
      ...(library.passwordHash ? { passwordHash: library.passwordHash } : {})
    }))
  };
  await writeFile(config.configPath, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
  return config.libraries;
}

async function loadLibraries(configPath, mediaRoot, failOnMissingConfig) {
  try {
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    const libraries = normalizeLibraries(config.libraries || config.folders || [], mediaRoot);
    if (libraries.length) return libraries;
  } catch (error) {
    if (failOnMissingConfig && error.code !== 'ENOENT') throw error;
  }

  return normalizeLibraries(
    [
      {
        id: 'main',
        name: process.env.MEDIA_NAME || '我的媒体',
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
