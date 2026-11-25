// =============================================================================
// FULL-STACK PRODUCTION SERVER FOR "HÔM NAY ĂN GÌ · TASTE OF VIETNAM v0.2"
// + WebSocket Live Merchant Dashboard (ws://127.0.0.1:3000/ws/merchant)
// =============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialStore } from './src/data/seed.js';
import { handleApiRequest } from './src/api/router.js';
import { setupWebSocket, getWsTestPayload } from './src/services/websocketService.js';
import { initDatabase, isPostgresConnected } from './src/db/connection.js';
import { getJwtSecret } from './src/services/authService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const store = createInitialStore();

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
        postgres_connected: isPostgresConnected(),
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      }, null, 2));
    }

    // 1. WebSocket test payload (REST endpoint)
    if (pathname === '/api/v1/ws/test-payload' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(getWsTestPayload(store), null, 2));
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
      const result = await handleApiRequest(store, req.method, pathname, urlObj.searchParams, body, req.headers);
      res.writeHead(result.status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      return res.end(JSON.stringify(result.data, null, 2));
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

    // 4. Serve Exact 99-Screen UI/UX (1-Screen Full-Screen App Mode at /app & mobile /, Full Studio at /studio & desktop /)
    const studioFile = path.join(__dirname, 'ui-design', 'index.html');
    if ((pathname === '/' || pathname === '/app' || pathname === '/studio') && fs.existsSync(studioFile)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      return fs.createReadStream(studioFile).pipe(res);
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
    console.log(`   - UI/UX 99-Screen Studio:        http://127.0.0.1:${PORT}/`);
    console.log(`   - Health Check:                  http://127.0.0.1:${PORT}/health`);
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
