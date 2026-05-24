import fs from 'node:fs';
import { stat } from 'node:fs/promises';
import { sendText } from './http.js';
import { safeResolve } from './libraries.js';
import { mimeFor } from './media-types.js';

export async function streamMedia(req, res, url, config, security) {
  const match = url.pathname.match(/^\/media\/([^/]+)\/?(.*)$/);
  if (!match) return sendText(res, 404, 'Not found');

  const libraryId = decodeURIComponent(match[1]);
  const library = config.libraryMap.get(libraryId);
  if (!library) return sendText(res, 404, 'Not found');
  if (!security.tokenAllows(req, library, url)) return sendText(res, 401, 'Password required');

  const mediaPath = decodeURIComponent(match[2] || '');
  const resolved = safeResolve(library, mediaPath);
  if (!resolved) return sendText(res, 400, 'Invalid path');

  try {
    const info = await stat(resolved);
    if (!info.isFile()) return sendText(res, 404, 'Not found');
    return sendMediaFile(req, res, resolved, info);
  } catch (error) {
    if (error.code === 'ENOENT') return sendText(res, 404, 'Not found');
    return sendText(res, 500, 'Unable to stream file');
  }
}

function sendMediaFile(req, res, filePath, info) {
  const range = req.headers.range;
  const contentType = mimeFor(filePath);

  if (!range) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': info.size,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const match = range.match(/bytes=(\d*)-(\d*)/);
  if (!match) return sendText(res, 416, 'Invalid range');

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : info.size - 1;
  if (start >= info.size || end >= info.size || start > end) {
    res.writeHead(416, { 'Content-Range': `bytes */${info.size}` });
    res.end();
    return;
  }

  res.writeHead(206, {
    'Content-Type': contentType,
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${info.size}`,
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath, { start, end }).pipe(res);
}
