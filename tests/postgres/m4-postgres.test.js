import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../../src/data/seed.js';
import { initRepository } from '../../src/db/repository.js';
import { PostgresRepository } from '../../src/db/postgresRepository.js';
import { contract, fixtures, NOW } from '../contracts/m4PlacesContract.js';
import { skip, resetDatabase, rawPool, TEST_DATABASE_URL } from './helpers.js';

let store, pool;
before(async () => {
  if (skip) return;
  await resetDatabase();
  store = createInitialStore();
  await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
  pool = rawPool();
  await pool.query('TRUNCATE places CASCADE');
  for (const p of fixtures()) {
    await pool.query(`INSERT INTO places(id,name,address,geom,is_verified,is_paused,verified_at,opening_hours)
      VALUES ($1,$2,$3,CASE WHEN $4::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($5,$4),4326)::geography END,$6,$7,$8,$9)`,
    [p.id, p.name, p.address, p.lat, p.lng, p.is_verified, p.is_open_override === false, p.verified_at, p.opening_hours === null ? null : JSON.stringify(p.opening_hours)]);
    for (const m of p.menu) await pool.query(`INSERT INTO place_dishes(place_id,dish_id,price_vnd,is_available) VALUES($1,$2,$3,$4)`,
      [p.id, m.dish_id, m.price, m.available]);
  }
});
after(async () => {
  if (skip) return;
  await store.repo.pool.end();
  await pool.end();
});
contract(test, { skip }, () => store);
test('M4 PostgreSQL hours/verification/null location survive a new connection', { skip }, async () => {
  const fresh = rawPool();
  try {
    const repo = new PostgresRepository(fresh);
    const p = await repo.getPlace('M4-IN');
    assert.equal(p.verified_at, fixtures()[0].verified_at);
    assert.deepEqual(p.opening_hours, fixtures()[0].opening_hours);
    const rows = await repo.findPlacesNear({ lat: 0, lng: 0, radiusM: 3000, now: NOW, requireVerifiedHours: true });
    assert.ok(rows.some(p => p.id === 'M4-IN' && p.is_currently_open));
    const unknown = await repo.getPlace('M4-UNKNOWN');
    assert.equal(unknown.lat, null);
    assert.equal(unknown.lng, null);
  } finally { await fresh.end(); }
});
