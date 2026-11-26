// M15 on PostgreSQL: trails seeded once into module_records, concurrent check-ins at one stop
// produce exactly one stamp (deterministic id + primary key), progress survives a new store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';

const q = () => new URLSearchParams();
const pgStore = pool => { const s = createInitialStore(); s.repo = new PostgresRepository(pool); return s; };
async function guestH(store) {
  const r = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', q());
  return { authorization: `Bearer ${r.data.access_token}` };
}

test('M15 over Postgres: one stamp per stop under concurrent check-ins, persisted', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = pgStore(pool);
    const t = await handleApiRequest(store, 'GET', '/api/v1/tourism/trails', q());
    assert.equal(t.status, 200);
    assert.equal(t.data.items[0].stops[0].place_name, 'Phở Gia Truyền Phát Tài');
    const h = await guestH(store);
    const rs = await Promise.all(Array.from({ length: 8 }, () =>
      handleApiRequest(store, 'POST', '/api/v1/tourism/passport/checkin', q(), { qr_token: 'BH1-SANG-7Q2K' }, h)));
    assert.ok(rs.every(r => r.status === 200));
    assert.equal(rs.filter(r => r.data.stamped).length, 1);
    const n = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M15' AND kind='stamp'")).rows[0].n;
    assert.equal(n, 1);
    const store2 = pgStore(pool);
    const p = await handleApiRequest(store2, 'GET', '/api/v1/tourism/passport', q(), {}, h);
    assert.equal(p.status, 200);
    assert.equal(p.data.stamped_count, 1);
    const trails = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M15' AND kind='trail' AND is_demo")).rows[0].n;
    assert.equal(trails, t.data.items.length);
  } finally { await pool.end(); }
});
