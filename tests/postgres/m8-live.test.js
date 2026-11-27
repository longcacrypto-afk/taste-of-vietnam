// M8 over PostgreSQL: the 2-per-day cap holds under concurrent test sends; notifications persist and leave with the account.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';

test('M8 over Postgres: concurrent test sends never exceed 2 per day; deleted with the account', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = createInitialStore();
    store.repo = new PostgresRepository(pool);
    const call = (m, p, body, h) => handleApiRequest(store, m, p, new URLSearchParams(), body || {}, h);
    const g = await call('POST', '/api/v1/auth/guest');
    const h = { authorization: `Bearer ${g.data.access_token}` };
    const s = await call('PUT', '/api/v1/me/notification-settings', { meal_suggestions: true }, h);
    assert.equal(s.status, 200);
    const res = await Promise.all(Array.from({ length: 6 }, () => call('POST', '/api/v1/notifications/test', {}, h)));
    const ok = res.filter(r => r.status === 201).length;
    assert.ok(ok <= 2, `at most 2 sent, got ${ok}`);
    assert.ok(res.every(r => r.status === 201 || r.status === 429));
    const rows = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M8' AND kind='notification' AND owner_id=$1", [g.data.guest_id])).rows[0].n;
    assert.equal(rows, ok);
    // A second process sees the same inbox.
    const store2 = createInitialStore();
    store2.repo = new PostgresRepository(pool);
    const inbox = await handleApiRequest(store2, 'GET', '/api/v1/notifications', new URLSearchParams(), {}, h);
    assert.equal(inbox.status, 200);
    const del = await call('DELETE', '/api/v1/me', {}, h);
    assert.ok([200, 204].includes(del.status), `delete account ${del.status}`);
    const left = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M8' AND owner_id=$1", [g.data.guest_id])).rows[0].n;
    assert.equal(left, 0);
  } finally { await pool.end(); }
});
