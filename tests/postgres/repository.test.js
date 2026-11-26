// =============================================================================
// P1: the core API on a real PostgreSQL + PostGIS database (npm run test:db).
// Every write below is checked in the raw tables, not only in API responses.
// =============================================================================

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';
import { initRepository } from '../../src/db/repository.js';
import { runMigrations, listMigrationFiles } from '../../src/db/migrate.js';
import { haversineDistanceMeters } from '../../src/services/textUtils.js';
import { signPayosData } from '../../src/services/paymentService.js';
import { suggestionCache } from '../../src/services/cacheService.js';
import { skip, resetDatabase, rawPool, scratchDatabase, TEST_DATABASE_URL } from './helpers.js';

const ADMIN_PHONE = '0900000101';
const MERCHANT_PHONE = '0900000102';
process.env.ADMIN_PHONES = ADMIN_PHONE;
process.env.MERCHANT_PHONES = MERCHANT_PHONE;
process.env.PAYOS_CHECKSUM_KEY = 'pg-test-checksum';

const q = (o = {}) => new URLSearchParams(o);
let store;
let db;

async function api(method, path, { headers = {}, body = {}, query = {} } = {}) {
  return handleApiRequest(store, method, path, q(query), body, headers);
}

async function login(phone) {
  const r = await api('POST', '/api/v1/auth/otp/request', { body: { phone } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const v = await api('POST', '/api/v1/auth/otp/verify', { body: { phone, code: r.data.dev_code } });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return { headers: { authorization: `Bearer ${v.data.access_token}` }, id: v.data.user.id, token: v.data.access_token };
}

async function guest() {
  const g = await api('POST', '/api/v1/auth/guest');
  return { headers: { authorization: `Bearer ${g.data.access_token}` }, id: g.data.guest_id };
}

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const count = async (sql, params = []) => Number((await db.query(sql, params)).rows[0].n);

before(async () => {
  if (skip) return;
  await resetDatabase();
  store = createInitialStore();
  await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
  db = rawPool();
  suggestionCache.clear();
});

after(async () => {
  if (skip) return;
  await db.end();
  await store.repo.pool.end();
});

test('Migrations: ordered, recorded once, re-running is a no-op; seed loaded 12 dishes / 8 places', { skip }, async () => {
  const applied = (await db.query('SELECT version, name FROM schema_migrations ORDER BY version')).rows.map(r => r.name);
  assert.deepEqual(applied, listMigrationFiles().map(m => m.name));
  assert.ok(applied.includes('003_m9_rbac_reports'));
  assert.deepEqual(applied, ['001_baseline', '002_p1_core', '003_m9_rbac_reports', '004_m1_google_auth', '006_m5_redirect', '007_m3_safety_approval', '008_m4_places_hours']);
  assert.deepEqual(await runMigrations(db, { log: () => {} }), []);
  assert.equal(await count('SELECT COUNT(*) n FROM dishes'), 12);
  assert.equal(await count('SELECT COUNT(*) n FROM places'), 8);
  assert.ok((await one(`SELECT PostGIS_Version() v`)).v);
});

test('Server refuses to use a database with pending migrations (no silent fallback to memory)', { skip }, async () => {
  const scratch = await scratchDatabase(`tov_pending_${process.pid}`);
  try {
    await assert.rejects(
      initRepository(createInitialStore(), { databaseUrl: scratch.url, autoMigrate: false, log: () => {} }),
      /missing migrations: 001_baseline, 002_p1_core.*004_m1_google_auth.*npm run db:migrate/
    );
    // DB_AUTO_MIGRATE=true migrates instead
    const s = createInitialStore();
    const repo = await initRepository(s, { databaseUrl: scratch.url, autoMigrate: true, log: () => {} });
    assert.equal(repo.kind, 'postgres');
    assert.equal((await repo.listDishes()).length, 12, 'empty catalogue gets the demo seed when auto-migrating');
    await repo.updateDish('DISH-101', { name: 'Phở đã sửa' });
    await repo.pool.end();
    // a second boot neither re-runs migrations nor overwrites edited rows
    const again = await initRepository(createInitialStore(), { databaseUrl: scratch.url, autoMigrate: true, log: () => {} });
    assert.equal((await again.getDish('DISH-101')).name, 'Phở đã sửa');
    await again.pool.end();
  } finally {
    await scratch.drop();
  }
});

test('M2 dishes and M4 places are read from the database; distance comes from PostGIS', { skip }, async () => {
  const all = await api('GET', '/api/v1/dishes', { query: { safe_only: 'false' } });
  assert.equal(all.data.total, 12);
  const pho = await api('GET', '/api/v1/dishes/DISH-101', { query: { servings: '4' } });
  assert.equal(pho.data.name, 'Phở Bò Tái Nạm Hà Nội');
  assert.equal(pho.data.scaled_ingredients[0].scaled_amount, 700);
  assert.equal(pho.data.open_places[0].place_id, 'PLACE-401');

  const places = await api('GET', '/api/v1/places');
  const ids = places.data.items.map(p => p.id);
  assert.ok(!ids.includes('PLACE-405'), 'auto-paused place is hidden');
  const dists = places.data.items.map(p => p.distance_m);
  assert.deepEqual(dists, [...dists].sort((a, b) => a - b), 'nearest first');
  const user = store.userProfile;
  for (const p of places.data.items) {
    const hv = haversineDistanceMeters(user.lat, user.lng, p.lat, p.lng);
    assert.ok(Math.abs(p.distance_m - hv) <= Math.max(3, hv * 0.01), `${p.id}: PostGIS ${p.distance_m} m vs haversine ${hv} m`);
  }
  // radius really filters in SQL
  const near = await store.repo.findPlacesNear({ lat: user.lat, lng: user.lng, radiusM: 400, openOnly: true });
  assert.ok(near.length > 0 && near.every(p => p.distance_m <= 400));
  assert.ok(near.length < places.data.items.length);

  const today = await api('GET', '/api/v1/suggestions/today');
  assert.equal(today.data.items.length, 3);
  assert.ok(today.data.items.every(i => !(i.allergen_tags || []).some(t => ['shrimp', 'peanut'].includes(t))));
});

test('M1 accounts, OTP and profile live in the users / otp_challenges tables', { skip }, async () => {
  const r = await api('POST', '/api/v1/auth/otp/request', { body: { phone: '0912000001' } });
  assert.equal(await count(`SELECT COUNT(*) n FROM otp_challenges WHERE phone = '+84912000001'`), 1);
  const otp = await one(`SELECT code_hash FROM otp_challenges WHERE phone = '+84912000001'`);
  assert.ok(!otp.code_hash.includes(r.data.dev_code), 'only a hash of the code is stored');
  const wrong = r.data.dev_code === '000000' ? '111111' : '000000';
  await api('POST', '/api/v1/auth/otp/verify', { body: { phone: '0912000001', code: wrong } });
  assert.equal((await one(`SELECT attempts FROM otp_challenges WHERE phone = '+84912000001'`)).attempts, 1);
  const v = await api('POST', '/api/v1/auth/otp/verify', { body: { phone: '0912000001', code: r.data.dev_code } });
  assert.equal(v.status, 200);
  assert.equal(await count(`SELECT COUNT(*) n FROM otp_challenges WHERE phone = '+84912000001'`), 0, 'used code is gone');
  const headers = { authorization: `Bearer ${v.data.access_token}` };

  const put = await api('PUT', '/api/v1/me/profile', { headers, body: { name: 'Chị Hoa', hard_allergies: ['dairy'], role: 'admin' } });
  assert.equal(put.status, 200);
  const row = await one('SELECT role, phone, profile FROM users WHERE id = $1', [v.data.user.id]);
  assert.equal(row.role, 'user', 'role cannot be set through the profile');
  assert.equal(row.phone, '+84912000001');
  assert.equal(row.profile.name, 'Chị Hoa');
  assert.deepEqual(row.profile.hard_allergies, ['dairy']);

  // logging in again with the same phone finds the same account
  const again = await login('0912000001');
  assert.equal(again.id, v.data.user.id);

  const g = await guest();
  assert.equal((await one('SELECT is_guest, role FROM users WHERE id = $1', [g.id])).role, 'guest');
  const gp = await api('GET', '/api/v1/me/profile', { headers: g.headers });
  assert.notEqual(gp.data.name, 'Chị Hoa');
});

test('M3 feedback and M5 loopback are stored per user and drive the 3-day cooldown', { skip }, async () => {
  const u = await login('0912000002');
  const before = await api('GET', '/api/v1/suggestions/today', { headers: u.headers });
  const first = before.data.items.find(i => !i.is_sponsored);
  const fb = await api('POST', '/api/v1/suggestions/feedback', { headers: u.headers, body: { dish_id: first.dish_id, action: 'eaten' } });
  assert.equal(fb.data.history_count, 1);
  assert.equal(await count('SELECT COUNT(*) n FROM suggestion_history WHERE user_id = $1', [u.id]), 1);
  const afterEat = await api('GET', '/api/v1/suggestions/today', { headers: u.headers });
  assert.ok(!afterEat.data.items.some(i => i.dish_id === first.dish_id), 'eaten dish is in cooldown');

  const redir = await api('POST', '/api/v1/orders/redirect', { headers: u.headers, body: { place_id: 'PLACE-403', dish_id: 'DISH-103', partner: 'grabfood' } });
  assert.ok(redir.data.target_deeplink.includes('utm_source=hom_nay_an_gi'));
  assert.equal((await one('SELECT user_id FROM order_redirects WHERE id = $1', [redir.data.id])).user_id, u.id);
  const other = await guest();
  assert.equal((await api('POST', `/api/v1/orders/${redir.data.id}/confirm-eaten`, { headers: other.headers })).status, 404, 'cannot confirm someone else\'s order');
  const conf = await api('POST', `/api/v1/orders/${redir.data.id}/confirm-eaten`, { headers: u.headers });
  assert.equal(conf.data.confirmed, true);
  assert.equal((await one('SELECT loopback_confirmed_eaten c FROM order_redirects WHERE id = $1', [redir.data.id])).c, true);
  const hist = await api('GET', '/api/v1/suggestions/history', { headers: u.headers });
  assert.equal(hist.data.items[0].dish_id, 'DISH-103');
  assert.equal(hist.data.items.length, 2);

  const col = await api('POST', '/api/v1/me/collections', { headers: u.headers, body: { dish_id: 'DISH-102' } });
  assert.deepEqual(col.data.collections[0].dish_ids, ['DISH-102']);
  assert.deepEqual((await one('SELECT dish_ids FROM saved_collections WHERE user_id = $1', [u.id])).dish_ids, ['DISH-102']);
});

test('M4 reports auto-pause a place; M9 admin un-pause, dish CRUD and OCR review write the audit log', { skip }, async () => {
  for (let i = 0; i < 3; i++) {
    const u = await login('091300000' + i);
    await api('POST', '/api/v1/places/PLACE-404/reports', { headers: u.headers, body: { reason: 'Đóng cửa' } });
  }
  const p = await one(`SELECT is_paused, report_count FROM places WHERE id = 'PLACE-404'`);
  assert.deepEqual(p, { is_paused: true, report_count: 3 });

  const admin = await login(ADMIN_PHONE);
  const un = await api('POST', '/api/v1/admin/places/PLACE-404/unpause', { headers: admin.headers,body:{reason:'Đã xác minh mở lại'} });
  assert.equal(un.data.unpaused_place.is_open_override, true);
  assert.equal(await count(`SELECT COUNT(*) n FROM place_reports WHERE place_id = 'PLACE-404'`), 3);
  assert.equal((await api('POST', '/api/v1/admin/places/NOPE/unpause', { headers: admin.headers,body:{reason:'Đã kiểm tra'} })).status, 404);

  const created = await api('POST', '/api/v1/admin/dishes', { headers: admin.headers, body: { name: 'Bún Mắm Miền Tây', allergens: ['fish'], spice_level: 9 } });
  assert.equal(created.status, 201);
  const row = await one('SELECT name, unaccented_name, allergen_flags, spice_level FROM dishes WHERE id = $1', [created.data.id]);
  assert.equal(row.unaccented_name, 'bun mam mien tay');
  assert.deepEqual(row.allergen_flags, ['fish']);
  assert.equal(row.spice_level, 3, 'clamped to the 0–3 range the table allows');
  const list = await api('GET', '/api/v1/dishes', { query: { safe_only: 'false' } });
  assert.equal(list.data.items[0].id, created.data.id, 'newest dish first');
  const upd = await api('PUT', `/api/v1/admin/dishes/${created.data.id}`, { headers: admin.headers, body: { ref_price: 42000 } });
  assert.equal(upd.data.ref_price, 42000);
  assert.equal((await one('SELECT estimated_price_vnd p FROM dishes WHERE id = $1', [created.data.id])).p, 42000);
  assert.equal((await api('DELETE', `/api/v1/admin/dishes/${created.data.id}`, { headers: admin.headers })).status, 200);
  assert.equal(await count('SELECT COUNT(*) n FROM dishes WHERE id = $1', [created.data.id]), 0);

  const ocr = await api('POST', '/api/v1/admin/ocr-review', { headers: admin.headers, body: { ocr_id: 'ocr-901', decision: 'rejected', reason: 'Ảnh mờ' } });
  assert.equal(ocr.data.updated.rejection_reason, 'Ảnh mờ');
  assert.equal((await one(`SELECT status FROM ocr_review_queue WHERE id = 'ocr-901'`)).status, 'rejected');

  const logs = await api('GET', '/api/v1/admin/audit-logs', { headers: admin.headers });
  const actions = logs.data.logs.map(l => l.action);
  for (const a of ['UNPAUSE_PLACE', 'CREATE_DISH', 'UPDATE_DISH', 'DELETE_DISH', 'REJECT_OCR_MENU']) assert.ok(actions.includes(a), a);
  assert.equal(await count(`SELECT COUNT(*) n FROM rbac_audit_logs WHERE actor_id = $1 AND action <> 'BOOTSTRAP_SUPER_ADMIN'`, [admin.id]), 5);

  const dash = await api('GET', '/api/v1/admin/dashboard', { headers: admin.headers });
  assert.equal(dash.data.total_dishes, 12);
});

test('M7 click guard, VietQR order and signed webhook credit exactly once (even concurrently)', { skip }, async () => {
  const u = await guest();
  const c1 = await api('POST', '/api/v1/ads/campaigns/CMP-701/click', { headers: u.headers, body: { fingerprint: 'dev-1' } });
  const c2 = await api('POST', '/api/v1/ads/campaigns/CMP-701/click', { headers: u.headers, body: { fingerprint: 'dev-1' } });
  assert.equal(c1.data.charged, true);
  assert.equal(c2.data.fraud_filtered, true);
  assert.equal((await one(`SELECT clicks FROM ad_campaigns WHERE id = 'CMP-701'`)).clicks, 1253);
  assert.equal((await api('POST', '/api/v1/ads/campaigns/NOPE/click', { headers: u.headers })).status, 404);

  const m = await login(MERCHANT_PHONE);
  const inv = await api('POST', '/api/v1/ads/payments/vietqr/create', { headers: m.headers, body: { campaign_id: 'CMP-701', amount_vnd: 300000 } });
  assert.equal((await one('SELECT status, created_by FROM payment_orders WHERE order_id = $1', [inv.data.order_id])).status, 'PENDING_PAYMENT');
  const data = { orderCode: inv.data.order_code, amount: 300000, description: inv.data.transfer_memo, code: '00', desc: 'ok' };
  const body = { code: '00', success: true, data, signature: signPayosData(data, process.env.PAYOS_CHECKSUM_KEY) };
  const results = await Promise.all(Array.from({ length: 5 }, () => api('POST', '/api/v1/payments/webhook', { body })));
  assert.equal(results.filter(r => r.data.credited).length, 1, 'five concurrent deliveries credit once');
  const cmp = await one(`SELECT balance_vnd, budget_monthly_vnd FROM ad_campaigns WHERE id = 'CMP-701'`);
  assert.equal(cmp.balance_vnd, cmp.budget_monthly_vnd + 300000);
  const status = await api('GET', `/api/v1/payments/orders/${inv.data.order_id}`, { headers: m.headers });
  assert.equal(status.data.status, 'COMPLETED');
  assert.equal(status.data.campaign_balance_after, cmp.balance_vnd);

  const bad = { ...data, amount: 1 };
  const r = await api('POST', '/api/v1/payments/webhook', { body: { code: '00', success: true, data: bad, signature: signPayosData(bad, 'wrong') } });
  assert.equal(r.status, 401);
});

test('M20 recipes: create, like, tip, edit by author, delete — all in community_recipes', { skip }, async () => {
  const a = await guest();
  const rec = await api('POST', '/api/v1/community/recipes', { headers: a.headers, body: { title: '<b>Gà kho gừng</b>', ingredients: ['Gà 500g'] } });
  assert.equal(rec.status, 201);
  assert.equal(rec.data.title, 'Gà kho gừng');
  await api('POST', `/api/v1/community/recipes/${rec.data.id}/like`, { headers: a.headers });
  await api('POST', `/api/v1/community/recipes/${rec.data.id}/tip`, { headers: a.headers, body: { amount_vnd: 20000 } });
  const row = await one('SELECT author_id, likes_count, total_tips_vnd FROM community_recipes WHERE id = $1', [rec.data.id]);
  assert.equal(row.author_id, a.id);
  assert.equal(row.likes_count, 2);
  assert.equal(Number(row.total_tips_vnd), 20000);
  const b = await guest();
  assert.equal((await api('DELETE', `/api/v1/community/recipes/${rec.data.id}`, { headers: b.headers })).status, 403);
  assert.equal((await api('PATCH', `/api/v1/community/recipes/${rec.data.id}`, { headers: a.headers, body: { title: 'Gà kho sả' } })).data.title, 'Gà kho sả');
  const list = await api('GET', '/api/v1/community/recipes');
  assert.equal(list.data.recipes[0].id, rec.data.id, 'newest first');
  assert.equal((await api('DELETE', `/api/v1/community/recipes/${rec.data.id}`, { headers: a.headers })).status, 200);
  assert.equal(await count('SELECT COUNT(*) n FROM community_recipes WHERE id = $1', [rec.data.id]), 0);
});

test('DELETE /me deletes the account rows (Nghị định 13/2023); money records are kept but unlinked', { skip }, async () => {
  const u = await login(MERCHANT_PHONE.replace(/2$/, '9'));
  await api('PUT', '/api/v1/me/profile', { headers: u.headers, body: { name: 'Sẽ bị xóa' } });
  await api('POST', '/api/v1/suggestions/feedback', { headers: u.headers, body: { dish_id: 'DISH-101', action: 'liked' } });
  await api('POST', '/api/v1/me/collections', { headers: u.headers, body: { dish_id: 'DISH-104' } });
  await api('POST', '/api/v1/orders/redirect', { headers: u.headers, body: { place_id: 'PLACE-401', dish_id: 'DISH-101' } });
  await api('POST', '/api/v1/community/recipes', { headers: u.headers, body: { title: 'Món của tôi' } });
  await api('POST', '/api/v1/places/PLACE-402/reports', { headers: u.headers, body: { reason: 'Đóng cửa' } });
  await api('POST', '/api/v1/ads/campaigns/CMP-702/click', { headers: u.headers, body: { fingerprint: 'dev-del' } });
  await db.query(`INSERT INTO payment_orders (order_id, order_code, campaign_id, amount_vnd, created_by) VALUES ('ORD-DEL', 424242, 'CMP-701', 1000, $1)`, [u.id]);

  const tables = {
    users: 'SELECT COUNT(*) n FROM users WHERE id = $1',
    suggestion_history: 'SELECT COUNT(*) n FROM suggestion_history WHERE user_id = $1',
    saved_collections: 'SELECT COUNT(*) n FROM saved_collections WHERE user_id = $1',
    order_redirects: 'SELECT COUNT(*) n FROM order_redirects WHERE user_id = $1',
    community_recipes: 'SELECT COUNT(*) n FROM community_recipes WHERE author_id = $1',
    place_reports: 'SELECT COUNT(*) n FROM place_reports WHERE user_id = $1',
    ad_clicks: 'SELECT COUNT(*) n FROM ad_clicks WHERE user_id = $1',
    payment_orders: 'SELECT COUNT(*) n FROM payment_orders WHERE created_by = $1'
  };
  for (const [t, sql] of Object.entries(tables)) assert.ok(await count(sql, [u.id]) >= 1, `${t} has the user's row before deletion`);

  const del = await api('DELETE', '/api/v1/me', { headers: u.headers });
  assert.equal(del.data.deleted, true);
  for (const [t, sql] of Object.entries(tables)) assert.equal(await count(sql, [u.id]), 0, `${t} keeps nothing linked to the user`);
  assert.equal(await count(`SELECT COUNT(*) n FROM users WHERE profile::text LIKE '%Sẽ bị xóa%'`), 0);
  assert.equal(await count(`SELECT COUNT(*) n FROM payment_orders WHERE order_id = 'ORD-DEL'`), 1, 'payment record kept for accounting');
  assert.equal(await count(`SELECT COUNT(*) n FROM place_reports WHERE place_id = 'PLACE-402'`), 1, 'report kept, anonymised');
  assert.equal((await api('GET', '/api/v1/me/profile', { headers: u.headers })).status, 401, 'token of a deleted account is dead');
});

test('Frozen modules still answer in Postgres mode (catalogue view from the DB)', { skip }, async () => {
  const u = await guest();
  assert.equal((await api('GET', '/api/v1/meal-plans/weekly')).status, 200);
  assert.equal((await api('GET', '/api/v1/translate/menu', { query: { lang: 'EN' } })).status, 200);
  assert.equal((await api('POST', '/api/v1/fridge/inventory', { headers: u.headers, body: { name: 'Trứng' } })).status, 201);
  assert.equal((await api('PUT', '/api/v1/me/meal-schedule', { headers: u.headers, body: { max_per_day: 5 } })).data.max_per_day, 2);
  assert.equal((await one('SELECT profile FROM users WHERE id = $1', [u.id])).profile.meal_reminders.max_per_day, 2);
});

test('Upgrading a database set up by hand with the old schema.sql + old seed keeps its rows', { skip }, async () => {
  const fs = await import('node:fs');
  const { createPool } = await import('../../src/db/connection.js');
  const { seedCatalog } = await import('../../src/db/seedCatalog.js');
  const scratch = await scratchDatabase(`tov_legacy_${process.pid}`);
  const pool = createPool(scratch.url, { max: 2 });
  try {
    // what the old migrateAndSeed.js did: run schema.sql (= migration 001's SQL), no schema_migrations table
    await pool.query(fs.readFileSync(new URL('../../src/db/migrations/001_baseline.sql', import.meta.url), 'utf8'));
    await pool.query(`INSERT INTO dishes (id, name, unaccented_name, region, estimated_price_vnd) VALUES ('DISH-101', 'Phở Bò Tái Nạm Hà Nội', 'Phở Bò Tái Nạm Hà Nội', 'bac', 45000)`);
    await pool.query(`INSERT INTO ad_campaigns (id, cpc_vnd, balance_vnd, is_active) VALUES ('CMP-701', 4000, 1500000, true)`);
    assert.deepEqual(await runMigrations(pool, { log: () => {} }), listMigrationFiles().map(m => m.name));
    assert.equal((await pool.query(`SELECT balance_vnd FROM ad_campaigns WHERE id = 'CMP-701'`)).rows[0].balance_vnd, 1500000, 'money column untouched');
    await seedCatalog(pool, { log: () => {} });
    assert.equal((await pool.query(`SELECT description FROM dishes WHERE id = 'DISH-101'`)).rows[0].description, '', 'plain seed never overwrites');
    await seedCatalog(pool, { log: () => {}, update: true });
    const d = (await pool.query(`SELECT description, tags FROM dishes WHERE id = 'DISH-101'`)).rows[0];
    assert.ok(d.description.length > 10 && d.tags.length > 0, 'seed --update fills the demo fields');
    assert.equal((await pool.query(`SELECT balance_vnd FROM ad_campaigns WHERE id = 'CMP-701'`)).rows[0].balance_vnd, 1500000, 'seed --update never touches balances');
  } finally {
    await pool.end();
    await scratch.drop();
  }
});
