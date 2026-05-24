import path from 'node:path';

export const audioExts = new Set(['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus', '.webm']);
export const videoExts = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi']);
export const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif']);
export const textExts = new Set(['.txt', '.md', '.markdown', '.log', '.csv', '.json', '.xml', '.yaml', '.yml']);
export const documentExts = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.rtf']);

export function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.markdown': 'text/markdown; charset=utf-8',
    '.log': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.avif': 'image/avif',
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
    '.avi': 'video/x-msvideo',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.rtf': 'application/rtf'
  };
  return types[ext] || 'application/octet-stream';
}

export function fileKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (audioExts.has(ext)) return 'audio';
  if (videoExts.has(ext)) return 'video';
  if (imageExts.has(ext)) return 'image';
  if (textExts.has(ext)) return 'text';
  if (documentExts.has(ext)) return 'document';
  return null;
}

export function isPlayableMedia(kind) {
  return kind === 'audio' || kind === 'video';
}

export function encodeMediaPath(value) {
  return toPosixPath(value).split('/').map(encodeURIComponent).join('/');
}

export function toPosixPath(value) {
  return value.split(path.sep).join('/');
}
