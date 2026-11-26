// W over PostgreSQL: public collections seeded once into module_records and resolved
// against the Postgres catalogue with the caller's allergy filter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';

const q = (s = '') => new URLSearchParams(s);

test('W over Postgres: collections from module_records, allergy filtered, 404', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = createInitialStore();
    store.repo = new PostgresRepository(pool);
    const r = await handleApiRequest(store, 'GET', '/api/v1/collections/public', q());
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.items.map(c => c.id), ['W-COL-NUOC-AM', 'W-COL-COM-NHA-NAM', 'W-COL-PHO-BUN']);
    const rows = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='W' AND kind='collection' AND is_demo")).rows[0].n;
    assert.equal(rows, 3);
    assert.ok(r.data.items.every(c => c.dish_count > 0));
    // second read does not seed again
    await handleApiRequest(store, 'GET', '/api/v1/collections/public', q());
    assert.equal((await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='W'")).rows[0].n, 3);
    const one = await handleApiRequest(store, 'GET', '/api/v1/collections/public/hanh-trinh-pho-bun-viet-nam', q());
    assert.equal(one.status, 200);
    assert.equal(one.data.id, 'W-COL-PHO-BUN');
    assert.ok(one.data.dishes.every(d => !d.allergen_tags.some(t => (one.data.applied_allergies || []).includes(t))));
    assert.equal((await handleApiRequest(store, 'GET', '/api/v1/collections/public/NOPE', q())).status, 404);
  } finally { await pool.end(); }
});
