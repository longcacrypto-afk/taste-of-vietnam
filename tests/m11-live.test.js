// M11 live: 7-day plan from the real catalogue through the shared safety gate, swaps,
// grocery list merged from recipes minus M18 fridge items, check-off, fridge suggestions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { moduleStore } from '../src/modules/moduleStore.js';
import { fridgeMatches } from '../src/modules/m11.js';
import { login } from './helpers/auth.js';

const q = (s = '') => new URLSearchParams(s);
const hit = (store, m, p, who, body = {}, qs = '') => handleApiRequest(store, m, p, q(qs), body, who?.headers || {});
const dishIds = plan => plan.days.flatMap(d => Object.values(d.meals).filter(Boolean).map(m => m.dish_id));

test('M11-S01: anonymous preview respects the default profile allergies and is not stored', async () => {
  const store = createInitialStore();
  const r = await hit(store, 'GET', '/api/v1/meal-plans/weekly');
  assert.equal(r.status, 200);
  assert.equal(r.data.saved, false);
  assert.equal(r.data.days.length, 7);
  const byId = new Map(store.dishes.map(d => [d.id, d]));
  for (const id of dishIds(r.data)) {
    const tags = byId.get(id).allergen_tags;
    assert.ok(!tags.includes('shrimp') && !tags.includes('peanut'), `${id} is blocked by the default allergies`);
  }
  assert.ok(!(store.moduleRecords || []).some(x => x.module === 'M11' && x.kind === 'plan'));
});

test('M11-S01: a user plan is stored, follows allergies/diet, swaps and regenerates safely', async () => {
  const store = createInitialStore();
  const u = await login(store, '0912000101');
  assert.equal((await hit(store, 'PUT', '/api/v1/me/profile', u, { hard_allergies: ['egg'] })).status, 200);
  const r = await hit(store, 'GET', '/api/v1/meal-plans/weekly', u);
  assert.equal(r.status, 200);
  assert.equal(r.data.saved, true);
  assert.equal(r.data.meals_per_day, 2);
  const byId = new Map(store.dishes.map(d => [d.id, d]));
  const ids = dishIds(r.data);
  assert.equal(ids.length, 14);
  assert.ok(ids.every(id => !byId.get(id).allergen_tags.includes('egg')), 'no egg dish in the plan');
  assert.ok(ids.every(id => byId.get(id).meal_slots.some(s => s === 'lunch' || s === 'dinner')));
  for (const d of r.data.days) assert.notEqual(d.meals.lunch?.dish_id, d.meals.dinner?.dish_id, 'no dish twice the same day');
  assert.equal(r.data.applied_allergies[0].tag, 'egg');
  // Same plan on reload (persisted), and the cost totals add up.
  const again = await hit(store, 'GET', '/api/v1/meal-plans/weekly', u);
  assert.deepEqual(dishIds(again.data), ids);
  assert.equal(again.data.total_cost_vnd, again.data.days.reduce((s, d) => s + d.est_market_cost_vnd, 0));

  const date = r.data.days[1].date;
  const unsafe = await hit(store, 'PUT', '/api/v1/meal-plans/weekly', u, { days: [{ date, meals: { lunch: 'DISH-102' } }] });
  assert.equal(unsafe.status, 422, 'egg dish refused for an egg allergy');
  assert.equal((await hit(store, 'PUT', '/api/v1/meal-plans/weekly', u, { days: [{ date, meals: { lunch: 'DISH-999' } }] })).status, 404);
  assert.equal((await hit(store, 'PUT', '/api/v1/meal-plans/weekly', u, { days: [{ date: '2001-01-01', meals: { lunch: 'DISH-105' } }] })).status, 400);
  const ok = await hit(store, 'PUT', '/api/v1/meal-plans/weekly', u, { days: [{ date, meals: { lunch: 'DISH-105' } }] });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.days[1].meals.lunch.dish_id, 'DISH-105');

  const before = r.data.days[2].meals.dinner.dish_id;
  const re = await hit(store, 'POST', `/api/v1/meal-plans/weekly/days/${r.data.days[2].date}/regenerate`, u, { slot: 'dinner' });
  assert.equal(re.status, 200);
  assert.notEqual(re.data.days[2].meals.dinner.dish_id, before);
  assert.ok(!byId.get(re.data.days[2].meals.dinner.dish_id).allergen_tags.includes('egg'));
  assert.equal((await hit(store, 'POST', '/api/v1/meal-plans/weekly/days/2001-01-01/regenerate', u)).status, 404);

  // A new allergy later: stored meals that conflict are swapped on the next read.
  await hit(store, 'PUT', '/api/v1/me/profile', u, { hard_allergies: ['egg', 'gluten'] });
  const after = await hit(store, 'GET', '/api/v1/meal-plans/weekly', u);
  assert.ok(dishIds(after.data).every(id => !byId.get(id).allergen_tags.includes('gluten')));
});

test('M11-S01: settings — servings scale costs, 3 meals adds breakfast, validation', async () => {
  const store = createInitialStore();
  const u = await login(store, '0912000102');
  const two = await hit(store, 'POST', '/api/v1/meal-plans/weekly', u, { servings: 2 });
  const four = await hit(store, 'POST', '/api/v1/meal-plans/weekly', u, { servings: 4 });
  assert.equal(four.data.servings, 4);
  assert.ok(four.data.total_cost_vnd > two.data.total_cost_vnd);
  const three = await hit(store, 'POST', '/api/v1/meal-plans/weekly', u, { meals_per_day: 3 });
  assert.ok(three.data.days.every(d => 'breakfast' in d.meals));
  assert.equal((await hit(store, 'POST', '/api/v1/meal-plans/weekly', u, { servings: 99 })).status, 400);
  assert.equal((await hit(store, 'POST', '/api/v1/meal-plans/weekly', u, { meals_per_day: 5 })).status, 400);
  const budget = await hit(store, 'POST', '/api/v1/meal-plans/weekly', u, { meals_per_day: 2, servings: 2, weekly_budget_vnd: 500000 });
  assert.equal(budget.data.weekly_budget_vnd, 500000);
  assert.equal(typeof budget.data.over_budget, 'boolean');
  assert.equal((await hit(store, 'POST', '/api/v1/meal-plans/weekly', null, {})).status, 401);
});

test('M11-S02: grocery list merges recipe ingredients, subtracts M18 fridge items, check-off persists', async () => {
  const store = createInitialStore();
  const u = await login(store, '0912000103');
  const plan = await hit(store, 'PUT', '/api/v1/meal-plans/weekly', u, { days: [] });
  assert.equal(plan.status, 400);
  const p = await hit(store, 'GET', '/api/v1/meal-plans/weekly', u);
  // Put phở on the first two days so the merge is visible.
  await hit(store, 'PUT', '/api/v1/meal-plans/weekly', u, { days: [
    { date: p.data.days[0].date, meals: { lunch: 'DISH-101' } }, { date: p.data.days[1].date, meals: { dinner: 'DISH-101' } }] });
  const ms = moduleStore(store);
  await ms.insert({ module: 'M18', kind: 'item', ownerId: u.user.id, data: { name: 'Bánh phở', quantity: 200, unit: 'g', compartment: 'chill', expires_at: new Date(Date.now() + 86400000).toISOString(), barcode: null } });
  await ms.insert({ module: 'M18', kind: 'item', ownerId: u.user.id, data: { name: 'Thịt bò', quantity: 2, unit: 'kg', compartment: 'freeze', expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), barcode: null } });
  const g = await hit(store, 'GET', '/api/v1/groceries/consolidated', u);
  assert.equal(g.status, 200);
  const pho = g.data.items.find(i => i.name === 'Bánh phở tươi');
  const phoUses = (await hit(store, 'GET', '/api/v1/meal-plans/weekly', u)).data.days.flatMap(d => Object.values(d.meals)).filter(m => m?.dish_id === 'DISH-101').length;
  assert.ok(phoUses >= 2);
  assert.equal(pho.amount, 350 * phoUses >= 1000 ? Math.round(350 * phoUses / 100) / 10 : 350 * phoUses);
  assert.equal(pho.partly_in_fridge, true, '200 g in the fridge, more needed');
  assert.equal(pho.in_fridge, false);
  const beef = g.data.items.find(i => i.name === 'Thịt bò tái & nạm');
  assert.equal(beef.in_fridge, true, '2 kg of beef covers the recipes');
  assert.equal(g.data.fridge_count, 2);
  assert.ok(g.data.aisles.find(a => a.id === 'protein').items.some(i => i.name === 'Thịt bò tái & nạm'));
  assert.ok(g.data.aisles.find(a => a.id === 'dry').items.some(i => i.name === 'Bánh phở tươi'));

  const chk = await hit(store, 'PATCH', `/api/v1/groceries/items/${pho.id}`, u, { checked: true });
  assert.equal(chk.status, 200);
  assert.equal((await hit(store, 'GET', '/api/v1/groceries/consolidated', u)).data.items.find(i => i.id === pho.id).checked, true);
  assert.equal((await hit(store, 'PATCH', '/api/v1/groceries/items/G-NOPE', u, { checked: true })).status, 404);
  assert.equal((await hit(store, 'PATCH', `/api/v1/groceries/items/${pho.id}`, u, { checked: 'yes' })).status, 400);
  const add = await hit(store, 'POST', '/api/v1/groceries/items', u, { name: 'Hành lá', amount: 1, unit: 'bó' });
  assert.equal(add.status, 201);
  assert.ok((await hit(store, 'GET', '/api/v1/groceries/consolidated', u)).data.items.some(i => i.extra && i.name === 'Hành lá'));
  assert.equal((await hit(store, 'DELETE', `/api/v1/groceries/items/${pho.id}`, u)).status, 404, 'recipe lines cannot be deleted');
  assert.equal((await hit(store, 'DELETE', `/api/v1/groceries/items/${add.data.id}`, u)).status, 200);
  assert.equal((await hit(store, 'POST', '/api/v1/groceries/items', u, { name: '' })).status, 400);

  // Another user sees their own list, not these checks or fridge items.
  const other = await login(store, '0912000104');
  const og = await hit(store, 'GET', '/api/v1/groceries/consolidated', other);
  assert.equal(og.data.fridge_count, 0);
  assert.ok(og.data.items.every(i => !i.checked));
  assert.equal((await hit(store, 'GET', '/api/v1/groceries/consolidated', null)).status, 401);
});

test('M11-S03: fridge suggestions — safe dishes ranked by matched ingredients, expiring first', async () => {
  const store = createInitialStore();
  const u = await login(store, '0912000105');
  const r = await hit(store, 'GET', '/api/v1/meal-plans/fridge-suggestions', u, {}, 'ingredients=Thịt bò,Bánh phở,Hành tím');
  assert.equal(r.status, 200);
  assert.equal(r.data.suggestions[0].dish_id, 'DISH-101');
  assert.ok(r.data.suggestions[0].match_pct >= 75);
  const post = await hit(store, 'POST', '/api/v1/dishes/by-ingredients', u, { ingredients: ['Tôm tươi'] });
  assert.equal(post.status, 200);
  assert.ok(post.data.suggestions.some(s => s.dish_id === 'DISH-106'));
  await hit(store, 'PUT', '/api/v1/me/profile', u, { hard_allergies: ['shrimp'] });
  const safe = await hit(store, 'POST', '/api/v1/dishes/by-ingredients', u, { ingredients: ['Tôm tươi'] });
  assert.ok(!safe.data.suggestions.some(s => s.dish_id === 'DISH-106'), 'allergy hard filter');
  const empty = await hit(store, 'GET', '/api/v1/meal-plans/fridge-suggestions', u);
  assert.deepEqual(empty.data.fridge, []);
  assert.deepEqual(empty.data.suggestions, []);
});

test('M11: fridge name matching is whole-phrase', () => {
  assert.equal(fridgeMatches('Cà chua', 'Đồ chua cà rốt củ cải'), false);
  assert.equal(fridgeMatches('Cà chua', 'Me vắt & Cà chua'), true);
  assert.equal(fridgeMatches('Thịt bò', 'Thịt bò tái & nạm'), true);
  assert.equal(fridgeMatches('Hành lá', 'Sả cây & Hành tây'), false);
});

test('M11: plan is personal data (export + account deletion)', async () => {
  const store = createInitialStore();
  const u = await login(store, '0912000106');
  await hit(store, 'GET', '/api/v1/meal-plans/weekly', u);
  const ex = await hit(store, 'GET', '/api/v1/me/export', u);
  assert.equal(ex.status, 200);
  assert.ok(JSON.stringify(ex.data).includes('"M11"'));
  assert.equal((await hit(store, 'DELETE', '/api/v1/me', u)).status, 200);
  assert.ok(!store.moduleRecords.some(x => x.owner_id === u.user.id));
});
