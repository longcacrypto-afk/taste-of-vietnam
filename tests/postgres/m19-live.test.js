// M19 over PostgreSQL: body profile + daily sync persisted in module_records, intake from
// suggestion_history "eaten" rows, GI demo table seeded once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';

test('M19 over Postgres: BMR/TDEE from saved profile and sync, intake from eaten history', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = createInitialStore();
    store.repo = new PostgresRepository(pool);
    const call = (m, p, body, h) => handleApiRequest(store, m, p, new URLSearchParams(), body, h);
    const g = await call('POST', '/api/v1/auth/guest');
    const h = { authorization: `Bearer ${g.data.access_token}` };
    await call('PUT', '/api/v1/health/profile', { sex: 'male', age: 30, height_cm: 172, weight_kg: 75 }, h);
    await call('POST', '/api/v1/health/sync', { source: 'google_fit', daily_steps: 7000, active_calories_burned: 300 }, h);
    await call('POST', '/api/v1/health/sync', { source: 'manual', daily_steps: 8420, active_calories_burned: 480 }, h);
    const fb = await call('POST', '/api/v1/suggestions/feedback', { dish_id: 'DISH-101', action: 'eaten' }, h);
    assert.equal(fb.status, 200);
    const store2 = createInitialStore();
    store2.repo = new PostgresRepository(pool);
    const r = await handleApiRequest(store2, 'GET', '/api/v1/health/nutrition-profile', new URLSearchParams(), {}, h);
    assert.equal(r.data.bmr, 1680);
    assert.equal(r.data.tdee, 2496);
    assert.equal(r.data.daily_steps, 8420);
    assert.equal(r.data.sandbox, false);
    assert.equal(r.data.intake_today_kcal, 480);
    const syncs = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M19' AND kind='sync' AND owner_id=$1", [g.data.guest_id])).rows[0].n;
    assert.equal(syncs, 1);
    const gi = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M19' AND kind='gi' AND is_demo")).rows[0].n;
    assert.equal(gi, 12);
  } finally { await pool.end(); }
});
