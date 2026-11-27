// M10 over PostgreSQL: demo events seeded once, ingested events persisted and counted in the funnel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';
import { TEST_ADMIN_PHONE } from '../helpers/auth.js';

test('M10 over Postgres: events persist across processes and demo seed runs once', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const mk = () => { const s = createInitialStore(); s.repo = new PostgresRepository(pool); return s; };
    const store = mk();
    const call = (st, m, p, body, h, qs = '') => handleApiRequest(st, m, p, new URLSearchParams(qs), body || {}, h);
    const g = await call(store, 'POST', '/api/v1/auth/guest');
    const h = { authorization: `Bearer ${g.data.access_token}` };
    const e1 = await call(store, 'POST', '/api/v1/events', { event_name: 'app_open', session_id: 'PG-1', properties: {} }, h);
    assert.equal(e1.status, 201);
    await Promise.all([mk(), mk()].map(st => call(st, 'POST', '/api/v1/events', { event_name: 'dish_view', session_id: 'PG-1', properties: { dish_id: 'DISH-101' } }, h)));
    const demo1 = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M10' AND kind='event' AND is_demo")).rows[0].n;
    const real = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M10' AND kind='event' AND NOT is_demo")).rows[0].n;
    assert.equal(real, 3);
    const store3 = mk();
    await call(store3, 'POST', '/api/v1/events', { event_name: 'app_open', session_id: 'PG-2', properties: {} }, h);
    const demo2 = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M10' AND kind='event' AND is_demo")).rows[0].n;
    assert.equal(demo2, demo1, 'demo seed is not repeated');
    const bad = await call(store, 'POST', '/api/v1/events', { event_name: 'not_an_event', session_id: 'PG-1' }, h);
    assert.equal(bad.status, 400);
    const rq = await call(store3, 'POST', '/api/v1/auth/otp/request', { phone: TEST_ADMIN_PHONE });
    const vr = await call(store3, 'POST', '/api/v1/auth/otp/verify', { phone: TEST_ADMIN_PHONE, code: rq.data.dev_code });
    const f = await call(store3, 'GET', '/api/v1/analytics/funnel', null, { authorization: `Bearer ${vr.data.access_token}` }, 'days=7');
    assert.equal(f.status, 200);
    assert.ok(f.data.events.app_open >= 2);
  } finally { await pool.end(); }
});
