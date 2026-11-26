// M18 over PostgreSQL: the starter fridge is copied once per user (also under concurrent first
// opens), items are module_records rows of the shared contract, CRUD + scan persist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';

test('M18 over Postgres: per-user fridge, contract rows, scan + consume persisted', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = createInitialStore();
    store.repo = new PostgresRepository(pool);
    const call = (m, p, body, h) => handleApiRequest(store, m, p, new URLSearchParams(), body, h);
    const g = await call('POST', '/api/v1/auth/guest');
    const h = { authorization: `Bearer ${g.data.access_token}` };
    const [r1, r2] = await Promise.all([call('GET', '/api/v1/fridge/inventory', {}, h), call('GET', '/api/v1/fridge/inventory', {}, h)]);
    assert.equal(r1.status, 200);
    const n = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M18' AND kind='item' AND owner_id=$1", [g.data.guest_id])).rows[0].n;
    assert.equal(n, 6, 'starter fridge copied exactly once');
    assert.ok(r1.data.total_items === 6 || r2.data.total_items === 6);
    const row = (await pool.query("SELECT data, is_demo FROM module_records WHERE module='M18' AND kind='item' AND owner_id=$1 LIMIT 1", [g.data.guest_id])).rows[0];
    assert.equal(row.is_demo, true);
    for (const k of ['name', 'quantity', 'unit', 'compartment', 'expires_at', 'barcode']) assert.ok(k in row.data, k);
    const s = await call('POST', '/api/v1/fridge/scan', { barcode: '8938612004524' }, h);
    assert.equal(s.data.scanned_item.quantity, 10);
    const c = await call('POST', `/api/v1/fridge/inventory/${s.data.scanned_item.id}/consume`, { amount: 3 }, h);
    assert.equal(c.data.remaining, 7);
    const store2 = createInitialStore();
    store2.repo = new PostgresRepository(pool);
    const again = await handleApiRequest(store2, 'GET', '/api/v1/fridge/inventory', new URLSearchParams(), {}, h);
    assert.equal(again.data.total_items, 7);
    assert.equal(again.data.items.find(i => i.id === s.data.scanned_item.id).quantity, 7);
    const sg = await call('GET', '/api/v1/fridge/suggestions', {}, h);
    assert.ok(sg.data.items.length > 0);
  } finally { await pool.end(); }
});
