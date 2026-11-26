// M17 on PostgreSQL: insights read order_redirects of all users (aggregate only), k-anonymity,
// campaign pause persisted with a row lock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';
import { TEST_ADMIN_PHONE } from '../helpers/auth.js';

async function adminHeaders(store) {
  const req = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/request', new URLSearchParams(), { phone: TEST_ADMIN_PHONE });
  const ver = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/verify', new URLSearchParams(), { phone: TEST_ADMIN_PHONE, code: req.data.dev_code });
  return { authorization: `Bearer ${ver.data.access_token}` };
}

const q = () => new URLSearchParams();

test('M17 over Postgres: real redirects + stamps merged, small cells hidden, campaign status persisted', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = createInitialStore();
    store.repo = new PostgresRepository(pool);
    const admin = await adminHeaders(store);
    const before = (await handleApiRequest(store, 'GET', '/api/v1/enterprise/tourism-insights', q(), {}, admin)).data;
    const g = { authorization: `Bearer ${(await handleApiRequest(store, 'POST', '/api/v1/auth/guest', q())).data.access_token}` };
    const red = await handleApiRequest(store, 'POST', '/api/v1/orders/redirect', q(), { place_id: 'PLACE-401', dish_id: 'DISH-101', partner: 'grabfood' }, g);
    assert.equal(red.status, 200);
    await handleApiRequest(store, 'POST', '/api/v1/tourism/passport/checkin', q(), { qr_token: 'BH2-SANG-6PW1' }, g);
    const after = (await handleApiRequest(store, 'GET', '/api/v1/enterprise/tourism-insights', q(), {}, admin)).data;
    assert.equal(after.sources.real_events.order_redirects, before.sources.real_events.order_redirects + 1);
    assert.equal(after.sources.real_events.passport_stamps, 1);
    assert.equal(after.top_dishes.find(x => x.key === 'DISH-101').value, before.top_dishes.find(x => x.key === 'DISH-101').value + 1);
    assert.equal(after.checkin_places.find(x => x.key === 'PLACE-408').suppressed, true);
    const p = await handleApiRequest(store, 'POST', '/api/v1/enterprise/brand-campaigns/BRAND-902/status', q(), { status: 'paused' }, admin);
    assert.equal(p.data.status, 'paused');
    const row = (await pool.query("SELECT data->>'status' s FROM module_records WHERE id='BRAND-902'")).rows[0];
    assert.equal(row.s, 'paused');
  } finally { await pool.end(); }
});
