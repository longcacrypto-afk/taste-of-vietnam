// M6 Merchant Portal over PostgreSQL: demo memberships in module_records, menu availability
// synced into place_dishes, merchant pause into places.is_paused, KPIs read real
// order_redirects rows, OCR publish happens exactly once under concurrency, restart-safe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';
import { TEST_MERCHANT_PHONE } from '../helpers/auth.js';

// Postgres mode keeps users in the database (store.users is empty): log in by OTP directly.
async function login(store, phone) {
  const a = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/request', new URLSearchParams(), { phone });
  const v = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/verify', new URLSearchParams(), { phone, code: a.data.dev_code });
  return { headers: { authorization: `Bearer ${v.data.access_token}` } };
}
const loginMerchant = store => login(store, TEST_MERCHANT_PHONE);

const q = (s = '') => new URLSearchParams(s);
const pgStore = pool => { const s = createInitialStore(); s.repo = new PostgresRepository(pool); return s; };

test('M6 over Postgres: membership, menu toggle → place_dishes, pause → places, KPIs from order_redirects', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = pgStore(pool);
    const m = await loginMerchant(store);
    const call = (method, path, body = {}, search = '') => handleApiRequest(store, method, '/api/v1' + path, q(search), body, m.headers);
    const me = await call('GET', '/merchant/me');
    assert.equal(me.status, 200);
    assert.deepEqual(me.data.places.map(p => p.id).sort(), ['PLACE-401', 'PLACE-405']);
    const linked = (await pool.query("SELECT data->>'user_id' AS u FROM module_records WHERE id='M6-MEM-TAI'")).rows[0].u;
    assert.ok(linked, 'membership bound to the user id');

    const off = await call('PATCH', '/merchant/menu/M6-MENU-401-101', { available: false });
    assert.equal(off.status, 200, JSON.stringify(off.data));
    assert.equal(off.data.synced_to_catalogue, true);
    const pd = (await pool.query("SELECT is_available FROM place_dishes WHERE place_id='PLACE-401' AND dish_id='DISH-101'")).rows[0];
    assert.equal(pd.is_available, false);
    await call('PATCH', '/merchant/menu/M6-MENU-401-101', { available: true });

    const before = await call('GET', '/merchant/overview');
    assert.equal(before.status, 200);
    const u = await login(store, '0977000222');
    const r = await handleApiRequest(store, 'POST', '/api/v1/orders/redirect', q(), { place_id: 'PLACE-401', partner: 'maps' }, u.headers);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const after = await call('GET', '/merchant/overview');
    assert.equal(after.data.kpis.direction_clicks_7d, before.data.kpis.direction_clicks_7d + 1);
    assert.equal(after.data.real_redirects_7d, 1);

    const pause = await call('PUT', '/merchant/places/PLACE-401', { paused: true, amenities: { has_ac: false } });
    assert.equal(pause.status, 200, JSON.stringify(pause.data));
    const pl = (await pool.query("SELECT is_paused, has_ac FROM places WHERE id='PLACE-401'")).rows[0];
    assert.deepEqual(pl, { is_paused: true, has_ac: false });
    assert.equal(pause.data.open_status.status, 'closed');
    await call('PUT', '/merchant/places/PLACE-401', { paused: false });
    assert.equal((await pool.query("SELECT is_paused FROM places WHERE id='PLACE-401'")).rows[0].is_paused, false);
    const versions = (await pool.query("SELECT COUNT(*)::int n FROM content_versions WHERE entity='place' AND target='PLACE-401'")).rows[0].n;
    assert.ok(versions >= 3, 'every catalogue change is versioned');

    // Restart: a new store over the same database still sees the module data.
    const store2 = pgStore(pool);
    const m2 = await loginMerchant(store2);
    const menu = await handleApiRequest(store2, 'GET', '/api/v1/merchant/menu', q(), {}, m2.headers);
    assert.equal(menu.data.items.find(i => i.id === 'M6-MENU-401-101').available, true);
    assert.equal((await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE id='M6-MEM-TAI'")).rows[0].n, 1, 'seeded once');
  } finally { await pool.end(); }
});

test('M6 over Postgres: OCR scan publishes exactly once under concurrent requests', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = pgStore(pool);
    const m = await loginMerchant(store);
    const queue = async () => (await pool.query('SELECT COUNT(*)::int n FROM ocr_review_queue')).rows[0].n;
    const queueBefore = await queue();
    const scan = await handleApiRequest(store, 'POST', '/api/v1/merchant/menu/ocr', q(), { raw_text: 'Phở bò tái nạm 45k\nBánh flan 15k' }, m.headers);
    assert.equal(scan.status, 201, JSON.stringify(scan.data));
    const rs = await Promise.all(Array.from({ length: 5 }, () =>
      handleApiRequest(store, 'POST', `/api/v1/merchant/menu/ocr/${scan.data.id}/publish`, q(), {}, m.headers)));
    assert.deepEqual(rs.map(r => r.status).sort(), [200, 409, 409, 409, 409]);
    const n = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M6' AND kind='menu_item' AND data->>'source'='ocr'")).rows[0].n;
    assert.equal(n, 2);
    assert.equal(await queue(), queueBefore, 'the M9 queue is not written by M6');
  } finally { await pool.end(); }
});
