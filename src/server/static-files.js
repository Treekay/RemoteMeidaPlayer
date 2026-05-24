import fs from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { sendText } from './http.js';
import { mimeFor } from './media-types.js';

export async function serveStatic(req, res, publicDir, pathname) {
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
