// =============================================================================
// P1 acceptance: data survives a server restart.
// Starts the real `node server.js` against PostgreSQL, writes through HTTP,
// stops the process, starts a new one and reads everything back.
// =============================================================================

import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';

const SERVER = fileURLToPath(new URL('../../server.js', import.meta.url));
const ADMIN_PHONE = '0900000201';

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

async function startServer(port, extraEnv = {}) {
  const child = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      NODE_ENV: 'development',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'restart-test-secret-do-not-use-in-prod',
      ADMIN_PHONES: ADMIN_PHONE,
      ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  const exited = new Promise(resolve => child.on('exit', code => resolve(code)));
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early (${child.exitCode}):\n${log}`);
    try {
      const h = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
      if (h.status === 'healthy') return { child, exited, health: h, log: () => log };
    } catch { /* not listening yet */ }
    await new Promise(r => setTimeout(r, 150));
  }
  child.kill('SIGKILL');
  throw new Error(`server did not become healthy:\n${log}`);
}

async function stopServer(srv) {
  srv.child.kill('SIGTERM');
  return srv.exited;
}

const http = (port) => async (method, path, { token, body } = {}) => {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json() };
};

before(async () => {
  if (!skip) await resetDatabase();
});

test('Restart survival: accounts, tokens, profile, history, collections, recipes, admin edits and payments persist', { skip }, async () => {
  const port = await freePort();
  const call = http(port);

  // ── first boot: write ────────────────────────────────────────────────────
  const first = await startServer(port);
  assert.equal(first.health.storage, 'postgres');
  assert.equal(first.health.postgres_connected, true);

  const otp = await call('POST', '/api/v1/auth/otp/request', { body: { phone: '0913000001' } });
  const login = await call('POST', '/api/v1/auth/otp/verify', { body: { phone: '0913000001', code: otp.data.dev_code } });
  const token = login.data.access_token;
  const userId = login.data.user.id;
  await call('PUT', '/api/v1/me/profile', { token, body: { name: 'Anh Tuấn', hard_allergies: ['peanut'], budget_max: 70000 } });
  await call('POST', '/api/v1/suggestions/feedback', { token, body: { dish_id: 'DISH-103', action: 'eaten' } });
  await call('POST', '/api/v1/me/collections', { token, body: { dish_id: 'DISH-104' } });
  const recipe = await call('POST', '/api/v1/community/recipes', { token, body: { title: 'Cá kho tộ nhà làm', ingredients: ['Cá lóc'] } });
  assert.equal(recipe.status, 201);

  const aOtp = await call('POST', '/api/v1/auth/otp/request', { body: { phone: ADMIN_PHONE } });
  const admin = await call('POST', '/api/v1/auth/otp/verify', { body: { phone: ADMIN_PHONE, code: aOtp.data.dev_code } });
  assert.equal(admin.data.role, 'admin');
  const dish = await call('POST', '/api/v1/admin/dishes', { token: admin.data.access_token, body: { name: 'Hủ Tiếu Nam Vang', ref_price: 45000 } });
  assert.equal(dish.status, 201);
  const report = await call('POST', '/api/v1/places/PLACE-401/reports', { token, body: { reason: 'Đóng cửa' } });
  assert.equal(report.data.report_count, 1);

  const exitCode = await stopServer(first);
  assert.equal(exitCode, 0, `clean shutdown\n${first.log()}`);

  // ── second boot: read back ───────────────────────────────────────────────
  const second = await startServer(port);
  try {
    const me = await call('GET', '/api/v1/auth/me', { token });
    assert.equal(me.status, 200, 'the token issued before the restart still works');
    assert.equal(me.data.id, userId);

    const profile = await call('GET', '/api/v1/me/profile', { token });
    assert.equal(profile.data.name, 'Anh Tuấn');
    assert.deepEqual(profile.data.hard_allergies, ['peanut']);
    assert.equal(profile.data.budget_max, 70000);

    const hist = await call('GET', '/api/v1/suggestions/history', { token });
    assert.equal(hist.data.items.length, 1);
    assert.equal(hist.data.items[0].dish_id, 'DISH-103');

    const today = await call('GET', '/api/v1/suggestions/today', { token });
    assert.ok(!today.data.items.some(i => i.dish_id === 'DISH-103'), '3-day cooldown still applies after restart');

    const cols = await call('GET', '/api/v1/me/collections', { token });
    assert.deepEqual(cols.data.collections[0].dish_ids, ['DISH-104']);

    const recipes = await call('GET', '/api/v1/community/recipes');
    assert.ok(recipes.data.recipes.some(r => r.id === recipe.data.id && r.title === 'Cá kho tộ nhà làm'));

    const newDish = await call('GET', `/api/v1/dishes/${dish.data.id}`);
    assert.equal(newDish.data.name, 'Hủ Tiếu Nam Vang');

    const places = await call('GET', '/api/v1/places');
    assert.equal(places.data.items.find(p => p.id === 'PLACE-401').closed_report_count, 1);

    const audit = await call('GET', '/api/v1/admin/audit-logs', { token: admin.data.access_token });
    assert.ok(audit.data.logs.some(l => l.action === 'CREATE_DISH' && l.target === dish.data.id));

    // the same phone logs into the same account after the restart
    const otp2 = await call('POST', '/api/v1/auth/otp/request', { body: { phone: '0913000001' } });
    const login2 = await call('POST', '/api/v1/auth/otp/verify', { body: { phone: '0913000001', code: otp2.data.dev_code } });
    assert.equal(login2.data.user.id, userId);
    assert.equal(login2.data.user.name, 'Anh Tuấn');
  } finally {
    await stopServer(second);
  }
});

test('Server exits with a clear message when DATABASE_URL points at an unreachable database', { skip }, async () => {
  const port = await freePort();
  await assert.rejects(
    startServer(port, { DATABASE_URL: 'postgres://nobody:nothing@127.0.0.1:1/none' }),
    /server exited early \(1\)[\s\S]*Storage init failed/
  );
});
