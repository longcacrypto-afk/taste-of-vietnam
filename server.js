// =============================================================================
// FULL-STACK PRODUCTION SERVER FOR "HÔM NAY ĂN GÌ · TASTE OF VIETNAM v0.1"
// + WebSocket Live Merchant Dashboard (ws://127.0.0.1:3000/ws/merchant)
// =============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createInitialStore } from './src/data/seed.js';
import { handleApiRequest } from './src/api/router.js';
import { setupWebSocket, getWsTestPayload } from './src/services/websocketService.js';
import { initDatabase } from './src/db/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const store = createInitialStore();

// ---------------------------------------------------------------------------
// In-memory Rate Limiter: 60 requests / minute / IP for /api/v1/* routes
// ---------------------------------------------------------------------------
const rateLimitMap = new Map(); // ip -> { count, resetAt }
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
    return true; // allowed
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

// Clean up stale rate-limit entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 2 * 60 * 1000);

// ---------------------------------------------------------------------------
// ETag helper: MD5 of content
// ---------------------------------------------------------------------------
function computeETag(content) {
  return '"' + crypto.createHash('md5').update(content).digest('hex') + '"';
}

// ---------------------------------------------------------------------------
// Gzip helper: compress buffer if client supports it
// ---------------------------------------------------------------------------
function sendCompressed(req, res, contentType, content, extraHeaders = {}) {
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const shouldCompress =
    acceptEncoding.includes('gzip') &&
    (contentType.includes('text/html') || contentType.includes('application/json'));

  const headers = {
    'Content-Type': contentType,
    ...extraHeaders,
  };

  if (shouldCompress) {
    zlib.gzip(buf, (err, compressed) => {
      if (err) {
        res.writeHead(200, headers);
        return res.end(buf);
      }
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
      res.writeHead(200, headers);
      res.end(compressed);
    });
  } else {
    res.writeHead(200, headers);
    res.end(buf);
  }
}

export function createAppServer() {
  const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
    const pathname = urlObj.pathname;

    // CORS & Production Security headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Phase F: Additional Security Headers
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' cdn.tailwindcss.com fonts.googleapis.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://generativelanguage.googleapis.com https://api.render.com; font-src 'self' fonts.gstatic.com; frame-ancestors 'none'"
    );
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(none), microphone=(none)');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // Phase F: Rate Limiting for /api/v1/* routes
    if (pathname.startsWith('/api/v1/')) {
      const ip =
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        'unknown';
      if (!checkRateLimit(ip)) {
        res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(
          JSON.stringify({ error: 'Too Many Requests', retryAfter: 60 })
        );
      }
    }

    // 1. WebSocket test payload (REST endpoint)
    if (pathname === '/api/v1/ws/test-payload' && req.method === 'GET') {
      const payload = JSON.stringify(getWsTestPayload(store), null, 2);
      res.setHeader('Cache-Control', 'no-store');
      return sendCompressed(req, res, 'application/json; charset=utf-8', payload);
    }

    // 2. REST API Gateway (/api/v1/*)
    if (pathname.startsWith('/api/v1/')) {
      let body = {};
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString('utf8');
        if (raw) {
          try { body = JSON.parse(raw); } catch { body = {}; }
        }
      }
      const result = await handleApiRequest(store, req.method, pathname, urlObj.searchParams, body);
      const payload = JSON.stringify(result.data, null, 2);
      res.setHeader('Cache-Control', 'no-store');
      res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(payload);
    }

    // 3. Serve PWA Web Manifest & Service Worker (ETag + Cache-Control)
    if (pathname === '/manifest.json') {
      const manifestFile = path.join(__dirname, 'ui-design', 'manifest.json');
      if (fs.existsSync(manifestFile)) {
        const content = fs.readFileSync(manifestFile);
        const etag = computeETag(content);
        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304);
          return res.end();
        }
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'no-cache');
        res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8' });
        return res.end(content);
      }
    }
    if (pathname === '/sw.js') {
      const swFile = path.join(__dirname, 'ui-design', 'sw.js');
      if (fs.existsSync(swFile)) {
        const content = fs.readFileSync(swFile);
        const etag = computeETag(content);
        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304);
          return res.end();
        }
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'no-cache');
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        return res.end(content);
      }
    }

    // 4. Serve 93-Screen UI/UX Studio at / and /studio (ETag + gzip + Cache-Control)
    const studioFile = path.join(__dirname, 'ui-design', 'index.html');
    if ((pathname === '/' || pathname === '/studio') && fs.existsSync(studioFile)) {
      const content = fs.readFileSync(studioFile);
      const etag = computeETag(content);
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304);
        return res.end();
      }
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'no-cache');
      return sendCompressed(req, res, 'text/html; charset=utf-8', content);
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not Found', path: pathname }));
  });

  // Wire up WebSocket on the same HTTP server
  setupWebSocket(server, store);

  // Initialize Database (Postgres with In-Memory fallback)
  initDatabase();

  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const PORT = process.env.PORT || 3000;
  // Bind 0.0.0.0 for Render.com / production; 127.0.0.1 locally
  const HOST = process.env.HOST || '0.0.0.0';
  const server = createAppServer();
  server.listen(PORT, HOST, () => {
    console.log(`🚀 Hôm nay ăn gì · Taste of Vietnam Server running at http://${HOST}:${PORT}`);
    console.log(`   - UI/UX 93-Screen Studio:        http://127.0.0.1:${PORT}/`);
    console.log(`   - REST API Gateway:              http://127.0.0.1:${PORT}/api/v1/suggestions/today`);
    console.log(`   - Gemini AI Chat (M3-S04):       http://127.0.0.1:${PORT}/api/v1/chat`);
    console.log(`   - Dish Cultural Story (M14):     http://127.0.0.1:${PORT}/api/v1/dishes/DISH-101/story`);
    console.log(`   - WebSocket Live Dashboard:      ws://127.0.0.1:${PORT}/ws/merchant`);
    console.log(`   - WS Test Payload (REST):        http://127.0.0.1:${PORT}/api/v1/ws/test-payload`);
    if (process.env.GEMINI_API_KEY) {
      console.log(`   ✨ Gemini 2.0 Flash API: ACTIVE`);
    } else {
      console.log(`   ⚠️  Gemini API: Fallback mode (set GEMINI_API_KEY env to enable)`);
    }
  });
}
