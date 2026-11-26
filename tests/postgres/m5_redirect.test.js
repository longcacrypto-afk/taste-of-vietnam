import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInitialStore } from '../../src/data/seed.js';
import { initRepository } from '../../src/db/repository.js';
import { m5Contract } from '../helpers/m5Contract.js';
import { handleApiRequest } from '../../src/api/router.js';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
async function setup() {
  await resetDatabase();
  const store = createInitialStore();
  const repo = await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
  return { store, repo, close: () => repo.pool.end() };
}
m5Contract(setup, { skip });

test('M5 PostgreSQL: failed history insert rolls back confirmation and can retry', { skip }, async t => {
  const { store, repo, close } = await setup(); t.after(close);
  const q = new URLSearchParams();
  const g = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', q, {});
  const headers = { authorization: `Bearer ${g.data.access_token}` };
  const r = await handleApiRequest(store, 'POST', '/api/v1/orders/redirect', q,
    { place_id: 'PLACE-401', dish_id: 'DISH-101' }, headers);
  await repo.q(`CREATE FUNCTION fail_m5_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$`);
  await repo.q(`CREATE TRIGGER fail_m5 BEFORE INSERT ON suggestion_history FOR EACH ROW EXECUTE FUNCTION fail_m5_history()`);
  await assert.rejects(repo.confirmOrderEaten(r.data.id, g.data.guest_id), /injected failure/);
  const before = await repo.getOrderRedirect(r.data.id);
  assert.equal(before.loopback_confirmed_eaten, false);
  assert.equal(before.confirmed_at, null);
  await repo.q('DROP TRIGGER fail_m5 ON suggestion_history');
  assert.equal((await repo.confirmOrderEaten(r.data.id, g.data.guest_id)).already_confirmed, false);
  assert.equal((await repo.listHistory(g.data.guest_id)).length, 1);
});

test('M5 PostgreSQL: new pool resumes same event and repeat confirm does not duplicate history', { skip }, async t => {
  const { store, repo, close } = await setup(); t.after(close);
  const q = new URLSearchParams();
  const g = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', q, {});
  const headers = { authorization: `Bearer ${g.data.access_token}` };
  const r = await handleApiRequest(store, 'POST', '/api/v1/orders/redirect', q,
    { place_id: 'PLACE-401', dish_id: 'DISH-101' }, headers);
  await repo.confirmOrderEaten(r.data.id, g.data.guest_id);
  const fresh = createInitialStore();
  const reopened = await initRepository(fresh, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
  t.after(() => reopened.pool.end());
  const rows = await reopened.listOrderRedirects(g.data.guest_id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].clicked_at, r.data.clicked_at);
  assert.ok(rows[0].confirmed_at);
  assert.equal((await reopened.confirmOrderEaten(r.data.id, g.data.guest_id)).already_confirmed, true);
  assert.equal((await reopened.listHistory(g.data.guest_id)).length, 1);
});

test('M5 PostgreSQL: migration SQL repeat is safe and real unavailable menu blocks redirect', { skip }, async t => {
  const { store, repo, close } = await setup(); t.after(close);
  const sql = fs.readFileSync(new URL('../../src/db/migrations/006_m5_redirect.sql', import.meta.url), 'utf8');
  await repo.q(sql); await repo.q(sql);
  await repo.q("UPDATE place_dishes SET is_available = false WHERE place_id = 'PLACE-401' AND dish_id = 'DISH-101'");
  const g = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', new URLSearchParams(), {});
  const r = await handleApiRequest(store, 'POST', '/api/v1/orders/redirect', new URLSearchParams(),
    { place_id: 'PLACE-401', dish_id: 'DISH-101' }, { authorization: `Bearer ${g.data.access_token}` });
  assert.equal(r.status, 409);
});
