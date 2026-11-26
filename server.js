// =============================================================================
// FULL-STACK PRODUCTION SERVER FOR "HÔM NAY ĂN GÌ · TASTE OF VIETNAM v0.2"
// Merchant WebSocket is disabled for the MVP (M6 frozen).
// =============================================================================

import http from 'node:http';
import { serveUiPage } from './ui-design/servePages.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialStore } from './src/data/seed.js';
import { handleApiRequest } from './src/api/router.js';
import {
  HttpError, parseOrigins, clientIp, createRateLimiter, rateGroups,
  applySecurityHeaders, allowOrigin, readJsonBody, logHttpFailure, requestId
} from './src/services/httpSecurity.js';
import { initRepository } from './src/db/repository.js';
import { getJwtSecret } from './src/services/authService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const store = createInitialStore();

export function createAppServer({ apiHandler = handleApiRequest, logError = console.error, rateLimiter = createRateLimiter() } = {}) {
  const origins = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);
  const trustedHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustedHops) || trustedHops < 0 || trustedHops > 5) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5');
  }
  const production = process.env.NODE_ENV === 'production';
  const server = http.createServer(async (req, res) => {
    const id = requestId();
    const started = performance.now();
    applySecurityHeaders(res, id);
    res.on('finish', () => {
      if (res.statusCode >= 500) logHttpFailure({
        requestId: id, method: req.method, status: res.statusCode, durationMs: performance.now() - started
      }, logError);
    });
    const sendError = (status, error) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', Connection: 'close' });
      res.end(JSON.stringify({ error, request_id: id }));
    };
    try {
    const urlObj = new URL(req.url, 'http://localhost');
    const pathname = urlObj.pathname;

    if (pathname.startsWith('/api/v1/')) {
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Vary', 'Origin, Authorization');
      if (!allowOrigin(req, res, origins, production)) return sendError(403, 'Nguồn truy cập không được phép');
      const retryAfter = rateLimiter(clientIp(req, trustedHops), rateGroups(req.method, pathname));
      if (retryAfter) {
        res.setHeader('Retry-After', String(retryAfter));
        return sendError(429, 'Bạn thao tác quá nhanh, vui lòng thử lại sau');
      }
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // 0. Cloud Load Balancer & Container Health Check (/health & /healthz)
    if ((pathname === '/health' || pathname === '/healthz') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({
        status: 'healthy',
        service: 'taste_of_vietnam_backend',
        version: '0.2.0',
        uptime_seconds: Math.floor(process.uptime()),
        modules_loaded: 20,
        postgres_connected: Boolean(store.repo),
        storage: store.repo ? 'postgres' : 'memory',
        gemini_active: Boolean(process.env.GEMINI_API_KEY),
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      }, null, 2));
    }

    // M6 is frozen: neither live frames nor the unauthenticated REST snapshot.
    if (pathname === '/api/v1/ws/test-payload' || pathname === '/ws/merchant') {
      return sendError(404, 'Not Found');
    }

    // 2. REST API Gateway (/api/v1/*)
    if (pathname.startsWith('/api/v1/')) {
      const body = await readJsonBody(req);
      const result = await apiHandler(store, req.method, pathname, urlObj.searchParams, body, req.headers);
      res.writeHead(result.status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store'
      });
      const data = result.status >= 500 ? { error: 'Dịch vụ tạm thời chưa sẵn sàng', request_id: id } : result.data;
      return res.end(JSON.stringify(data, null, 2));
    }

    // 3. Serve PWA Web Manifest & Service Worker
    if (pathname === '/manifest.json') {
      const manifestFile = path.join(__dirname, 'ui-design', 'manifest.json');
      if (fs.existsSync(manifestFile)) {
        res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-cache' });
        return fs.createReadStream(manifestFile).pipe(res);
      }
    }
    if (pathname === '/sw.js') {
      const swFile = path.join(__dirname, 'ui-design', 'sw.js');
      if (fs.existsSync(swFile)) {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
        return fs.createReadStream(swFile).pipe(res);
      }
    }

    // 3b. Serve Static Assets (/assets/*)
    if (pathname.startsWith('/assets/')) {
      const assetRelative = pathname.replace(/^\/assets\//, '');
      const assetPath = path.normalize(path.join(__dirname, 'ui-design', 'assets', assetRelative));
      const assetsRoot = path.normalize(path.join(__dirname, 'ui-design', 'assets'));
      if (assetPath.startsWith(assetsRoot) && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
        const ext = path.extname(assetPath).toLowerCase();
        const mimeMap = {
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.webp': 'image/webp'
        };
        const contentType = mimeMap[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400'
        });
        return fs.createReadStream(assetPath).pipe(res);
      }
    }

    // Product entry points are separate from the password-protected Studio.
    if (serveUiPage(req, res, pathname)) return;

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not Found' }));
    } catch (err) {
      if (res.headersSent) { res.destroy(); return; }
      const status = err instanceof HttpError ? err.status : 500;
      sendError(status, status === 500 ? 'Có lỗi xảy ra, vui lòng thử lại sau' : err.message);
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.on('upgrade', (_req, socket) => {
    socket.on('error', () => {});
    socket.end('HTTP/1.1 404 Not Found\\r\\nConnection: close\\r\\nContent-Length: 0\\r\\n\\r\\n');
  });

  // Storage: call initRepository(store) before listening (done below when run directly).
  // Without it the API uses the in-memory store.
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const PORT = process.env.PORT || 3000;
  // Bind 0.0.0.0 for Render.com / production; 127.0.0.1 locally
  const HOST = process.env.HOST || '0.0.0.0';
  let server;
  try {
    // PostgreSQL when DATABASE_URL is set (refuses to start if migrations are pending), else memory
    await initRepository(store);
  } catch (err) {
    console.error(`❌ Storage init failed: ${err.message}`);
    process.exit(1);
  }
  server = createAppServer();
  const shutdown = (signal) => {
    console.log(`${signal} received, closing…`);
    server.close(() => {
      Promise.resolve(store.repo && store.repo.pool.end()).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  server.listen(PORT, HOST, () => {
    console.log(`🚀 Hôm nay ăn gì · Taste of Vietnam Server running at http://${HOST}:${PORT}`);
    console.log(`   - UI/UX 99-Screen Studio:        http://127.0.0.1:${PORT}/`);
    console.log(`   - Health Check:                  http://127.0.0.1:${PORT}/health`);
    console.log(`   - REST API Gateway:              http://127.0.0.1:${PORT}/api/v1/suggestions/today`);
    console.log(`   - Gemini AI Chat (M3-S04):       http://127.0.0.1:${PORT}/api/v1/chat`);
    console.log(`   - Dish Cultural Story (M14):     http://127.0.0.1:${PORT}/api/v1/dishes/DISH-101/story`);
    console.log('   - Merchant WebSocket: disabled (MVP)');
    if (process.env.GEMINI_API_KEY) {
      console.log(`   ✨ Gemini 2.0 Flash API: ACTIVE`);
    } else {
      console.log(`   ⚠️  Gemini API: Fallback mode (set GEMINI_API_KEY env to enable)`);
    }
    getJwtSecret(); // warns once if JWT_SECRET is missing
    if (!process.env.PAYOS_CHECKSUM_KEY) {
      console.log(`   ⚠️  PayOS webhook: DISABLED (set PAYOS_CHECKSUM_KEY to accept signed payment webhooks)`);
    }
    if (!process.env.SMS_API_KEY || !process.env.SMS_SECRET_KEY) {
      console.log(process.env.NODE_ENV === 'production'
        ? `   ⚠️  OTP SMS not configured: phone login disabled (guest mode still works)`
        : `   🔐 OTP dev mode: codes are logged here and returned in the API response`);
    }
  });
}
