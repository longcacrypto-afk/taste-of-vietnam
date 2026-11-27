// M11 over PostgreSQL: plan built from the DB catalogue, stored in module_records, groceries minus M18 items.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';
import { initRepository } from '../../src/db/repository.js';
import { moduleStore } from '../../src/modules/moduleStore.js';
import { skip, resetDatabase, rawPool, TEST_DATABASE_URL } from './helpers.js';

process.env.MERCHANT_PHONES = [process.env.MERCHANT_PHONES, '0900000902'].filter(Boolean).join(',');
let store, db;
const api = (method, path, who, body = {}, query = '') => handleApiRequest(store, method, path, new URLSearchParams(query), body, who?.headers || {});
async function login(phone) {
  const r = await api('POST', '/api/v1/auth/otp/request', null, { phone });
  const v = await api('POST', '/api/v1/auth/otp/verify', null, { phone, code: r.data.dev_code });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return { headers: { authorization: `Bearer ${v.data.access_token}` }, id: v.data.user.id };
}
const vnDate = (plusDays = 0) => new Date(Date.now() + 7 * 3600000 + plusDays * 86400000).toISOString().slice(0, 10);
before(async () => {
  if (skip) return;
  await resetDatabase();
  store = createInitialStore();
  await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
  db = rawPool();
});
after(async () => {
  if (skip) return;
  await db.end();
  await store.repo.pool.end();
});

test('M11 on Postgres: plan persisted per user, allergy filter, M18 fridge subtraction, check-off', { skip }, async () => {
  const u = await login('0913000101');
  await api('PUT', '/api/v1/me/profile', u, { hard_allergies: ['egg'] });
  const r = await api('GET', '/api/v1/meal-plans/weekly', u);
  assert.equal(r.status, 200);
  assert.equal(r.data.saved, true);
  const dishes = new Map((await store.repo.listDishes()).map(d => [d.id, d.allergen_tags || d.allergens || []]));
  assert.ok(dishes.size > 0);
  const ids = r.data.days.flatMap(d => Object.values(d.meals).filter(Boolean).map(m => m.dish_id));
  assert.equal(ids.length, 14);
  assert.ok(ids.every(id => !dishes.get(id).includes('egg')));
  assert.equal(Number((await db.query("SELECT COUNT(*) n FROM module_records WHERE module='M11' AND kind='plan' AND owner_id=$1", [u.id])).rows[0].n), 1);
  await api('PUT', '/api/v1/meal-plans/weekly', u, { days: [{ date: r.data.days[0].date, meals: { lunch: 'DISH-101' } }] });
  await moduleStore(store.repo).insert({ module: 'M18', kind: 'item', ownerId: u.id, data: { name: 'Thịt bò', quantity: 2, unit: 'kg', compartment: 'freeze', expires_at: new Date(Date.now() + 5 * 86400000).toISOString(), barcode: null } });
  const g = await api('GET', '/api/v1/groceries/consolidated', u);
  assert.equal(g.status, 200);
  const beef = g.data.items.find(i => i.name === 'Thịt bò tái & nạm');
  assert.equal(beef.in_fridge, true);
  const line = g.data.items.find(i => !i.in_fridge);
  assert.equal((await api('PATCH', `/api/v1/groceries/items/${line.id}`, u, { checked: true })).status, 200);
  const again = await api('GET', '/api/v1/groceries/consolidated', u);
  assert.equal(again.data.items.find(i => i.id === line.id).checked, true);
  const fs = await api('GET', '/api/v1/meal-plans/fridge-suggestions', u);
  assert.equal(fs.data.fridge[0].name, 'Thịt bò');
  assert.ok(fs.data.suggestions.some(s => s.dish_id === 'DISH-101'));
});
