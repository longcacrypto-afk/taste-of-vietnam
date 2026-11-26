// Live-module kit on PostgreSQL: module_records CRUD, row-locked concurrent updates,
// demo seeding once, M14 routes over the Postgres repository, PDPD delete.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { moduleStore } from '../../src/modules/moduleStore.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';

test('module_records: insert/list/get/update/remove + concurrent increments', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const ms = moduleStore(new PostgresRepository(pool));
    const a = await ms.insert({ module: 'MX', kind: 'thing', ownerId: 'u1', data: { n: 0, name: 'a' } });
    await ms.insert({ module: 'MX', kind: 'thing', ownerId: 'u2', data: { n: 0, name: 'b' } });
    assert.equal((await ms.list('MX', 'thing')).length, 2);
    assert.equal((await ms.list('MX', 'thing', { ownerId: 'u1' }))[0].name, 'a');
    await Promise.all(Array.from({ length: 20 }, () => ms.update(a.id, r => ({ ...r, n: r.n + 1 }))));
    assert.equal((await ms.get(a.id)).n, 20);
    await ms.removeOwner('u2');
    assert.equal(await ms.count('MX', 'thing'), 1);
    assert.equal(await ms.remove(a.id), true);
    assert.equal(await ms.get(a.id), null);
  } finally { await pool.end(); }
});

test('M14 over Postgres: demo seeded once, served from module_records', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = createInitialStore();
    store.repo = new PostgresRepository(pool);
    const r = await handleApiRequest(store, 'GET', '/api/v1/stories', new URLSearchParams());
    assert.equal(r.status, 200);
    assert.ok(r.data.items.length >= 3);
    const rows = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M14' AND is_demo")).rows[0].n;
    assert.equal(rows, r.data.items.length);
    const store2 = createInitialStore();
    store2.repo = new PostgresRepository(pool);
    await handleApiRequest(store2, 'GET', '/api/v1/stories', new URLSearchParams());
    assert.equal((await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M14'")).rows[0].n, rows, 'not seeded twice');
  } finally { await pool.end(); }
});
