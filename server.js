// =============================================================================
// FULL-STACK PRODUCTION SERVER FOR "HÔM NAY ĂN GÌ · TASTE OF VIETNAM v0.1"
// + WebSocket Live Merchant Dashboard (ws://127.0.0.1:3000/ws/merchant)
// =============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialStore } from './src/data/seed.js';
import { handleApiRequest } from './src/api/router.js';
import { setupWebSocket, getWsTestPayload } from './src/services/websocketService.js';
import { initDatabase } from './src/db/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const store = createInitialStore();

export function createAppServer() {
  const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
    const pathname = urlObj.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // 1. WebSocket test payload (REST endpoint)
    if (pathname === '/api/v1/ws/test-payload' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
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
      const result = await handleApiRequest(store, req.method, pathname, urlObj.searchParams, body);
      res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(result.data, null, 2));
    }

    // 3. Serve PWA Web Manifest & Service Worker
    if (pathname === '/manifest.json') {
      const manifestFile = path.join(__dirname, 'ui-design', 'manifest.json');
      if (fs.existsSync(manifestFile)) {
        res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8' });
        return fs.createReadStream(manifestFile).pipe(res);
      }
    }
    if (pathname === '/sw.js') {
      const swFile = path.join(__dirname, 'ui-design', 'sw.js');
      if (fs.existsSync(swFile)) {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        return fs.createReadStream(swFile).pipe(res);
      }
    }

    // 4. Serve 93-Screen UI/UX Studio at / and /studio
    const studioFile = path.join(__dirname, 'ui-design', 'index.html');
    if ((pathname === '/' || pathname === '/studio') && fs.existsSync(studioFile)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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
