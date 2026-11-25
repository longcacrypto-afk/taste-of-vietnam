// Exercise the matrix with the approval rollout gate ON; compatibility is tested separately.
process.env.REQUIRE_SAFETY_APPROVAL = 'true';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../../src/data/seed.js';
import { initRepository } from '../../src/db/repository.js';
import { PostgresRepository } from '../../src/db/postgresRepository.js';
import { createPool } from '../../src/db/connection.js';
import { handleApiRequest } from '../../src/api/router.js';
import { candidateContract, matrixDishes } from '../contracts/candidateContract.js';
import { skip, resetDatabase, rawPool, TEST_DATABASE_URL } from './helpers.js';

let store, repo, db;
const q = () => new URLSearchParams();
before(async () => {
  if (skip) return;
  await resetDatabase(); store = createInitialStore();
  repo = await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} }); db = rawPool();
  // Demo entries remain pending in real seed; reject here to isolate synthetic matrix.
  await db.query("UPDATE dishes SET safety_status = 'rejected'");
  for (const dish of matrixDishes()) {
    await repo.createDish(dish);
    await db.query('INSERT INTO place_dishes (place_id, dish_id, price_vnd, is_available) VALUES ($1,$2,$3,true)', ['PLACE-401', dish.id, dish.ref_price]);
  }
});
after(async () => { if (!skip) { await db.end(); await repo.pool.end(); } });

candidateContract('postgres', async (profile, history) => {
  const g = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', q());
  const id = g.data.guest_id, headers = { authorization: `Bearer ${g.data.access_token}` };
  await repo.saveProfile(id, profile);
  for (const h of history) await repo.addHistory(id, h);
  return { store, headers, view: { ...store, dishes: await repo.listDishes(), places: await repo.listPlaces(),
    campaigns: [], userProfile: (await repo.getUser(id)).profile, suggestionHistory: await repo.listHistory(id) } };
}, { skip });

test('Postgres safety defaults pending, status persists on reopen, content update revokes approval', { skip }, async () => {
  const d = { ...matrixDishes()[0], id: 'SAFETY-PERSIST' }; delete d.safety_status;
  assert.equal((await repo.createDish(d)).safety_status, 'pending');
  assert.equal((await repo.updateDish(d.id, { safety_status: 'approved' })).safety_status, 'approved');
  const pool = createPool(TEST_DATABASE_URL), reopened = new PostgresRepository(pool);
  try { assert.equal((await reopened.getDish(d.id)).safety_status, 'approved'); } finally { await pool.end(); }
  assert.equal((await repo.updateDish(d.id, { allergen_tags: ['shrimp'], safety_status: 'approved' })).safety_status, 'pending');
  await repo.updateDish(d.id, { safety_status: 'approved' });
  await db.query("UPDATE dishes SET diet_flags = ARRAY['vegan'] WHERE id=$1", [d.id]);
  assert.equal((await repo.getDish(d.id)).safety_status, 'pending');
  await assert.rejects(repo.updateDish(d.id, { safety_status: 'not-reviewed-but-safe' }), /check constraint/);
});

test('Postgres approval rollout and DB edits invalidate API results without restarting or clearing cache', { skip }, async () => {
  const old = process.env.REQUIRE_SAFETY_APPROVAL;
  const g = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', q());
  const headers = { authorization: `Bearer ${g.data.access_token}` };
  await repo.saveProfile(g.data.guest_id, { ...store.userProfile, hard_allergies: [], diet_mode: 'balanced', budget_min: 0, budget_max: 50000, meal_slot: 'lunch', mode: 'cook' });
  const today = () => handleApiRequest(store, 'GET', '/api/v1/suggestions/today', q(), {}, headers);
  try {
    process.env.REQUIRE_SAFETY_APPROVAL = 'true';
    await db.query("UPDATE dishes SET safety_status = 'pending'");
    assert.equal((await today()).data.items.length, 0);
    await db.query("UPDATE dishes SET safety_status = 'approved' WHERE id='MATRIX-0'");
    assert.deepEqual((await today()).data.items.map(d => d.dish_id), ['MATRIX-0']);
    await db.query("UPDATE dishes SET safety_status = 'rejected' WHERE id='MATRIX-0'");
    assert.equal((await today()).data.items.length, 0);
    process.env.REQUIRE_SAFETY_APPROVAL = 'false';
    assert.ok((await today()).data.items.length > 0);
  } finally { if (old === undefined) delete process.env.REQUIRE_SAFETY_APPROVAL; else process.env.REQUIRE_SAFETY_APPROVAL = old; }
});
