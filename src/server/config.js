import { readFile } from 'node:fs/promises';
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
  const appConfig = await loadAppConfig(configPath, Boolean(explicitConfigPath));
  const libraries = loadLibraries(appConfig, mediaRoot);

  return {
    port,
    host,
    mediaRoot,
    publicUrl: normalizePublicUrl(appConfig.publicUrl),
    configPath,
    publicDir: path.join(projectRoot, 'public'),
    libraries,
    libraryMap: new Map(libraries.map((library) => [library.id, library]))
  };
}

async function loadAppConfig(configPath, failOnMissingConfig) {
  try {
    return JSON.parse(await readFile(configPath, 'utf8'));
  } catch (error) {
    if (failOnMissingConfig && error.code !== 'ENOENT') throw error;
    return {};
  }
}

function loadLibraries(appConfig, mediaRoot) {
  const configured = normalizeLibraries(appConfig.libraries || appConfig.folders || [], mediaRoot);
  if (configured.length) return configured;
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

function normalizePublicUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}
