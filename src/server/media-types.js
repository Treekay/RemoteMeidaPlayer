import path from 'node:path';

export const audioExts = new Set(['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus', '.webm']);
export const videoExts = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi']);

export function mimeFor(filePath) {
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

export function mediaKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (audioExts.has(ext)) return 'audio';
  if (videoExts.has(ext)) return 'video';
  return null;
}

export function encodeMediaPath(value) {
  return toPosixPath(value).split('/').map(encodeURIComponent).join('/');
}

export function toPosixPath(value) {
  return value.split(path.sep).join('/');
}
