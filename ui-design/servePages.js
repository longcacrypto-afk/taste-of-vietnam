import fs from 'node:fs';
import path from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const digest = value => createHash('sha256').update(value).digest();

// Kept separate from the API/auth layer: Studio access never grants an app role.
export function serveUiPage(req, res, pathname) {
  if (!['/', '/app', '/studio'].includes(pathname)) return false;
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' });
    res.end(); return true;
  }
  const isStudio = pathname === '/studio';
  res.setHeader('Cache-Control', 'no-store');
  if (isStudio) {
    res.setHeader('Vary', 'Authorization');
    const password = process.env.STUDIO_PASSWORD;
    if (!password) { res.writeHead(404); res.end('Not Found'); return true; }
    let supplied = '';
    const auth = req.headers.authorization || '';
    if (/^Basic /i.test(auth)) {
      const credentials = Buffer.from(auth.slice(6), 'base64').toString('utf8');
      const separator = credentials.indexOf(':');
      if (separator >= 0) supplied = credentials.slice(separator + 1);
    }
    if (!timingSafeEqual(digest(supplied), digest(password))) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Taste of Vietnam Studio", charset="UTF-8"' });
      res.end('Studio requires a password'); return true;
    }
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(path.join(root, isStudio ? 'index.html' : 'product.html')).pipe(res);
  return true;
}
