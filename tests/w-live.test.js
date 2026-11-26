// W (Consumer Web / PWA, W-S01..W-S05): public curated collections (W-S05) persisted in the
// module store, allergy-filtered per caller; the desktop UI binds the core endpoints.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { login } from './helpers/auth.js';

const q = (s = '') => new URLSearchParams(s);

test('W: public collections are demo-seeded with fixed ids and resolved against the catalogue', async () => {
  const store = createInitialStore();
  const r = await handleApiRequest(store, 'GET', '/api/v1/collections/public', q());
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.items.map(c => c.id), ['W-COL-NUOC-AM', 'W-COL-COM-NHA-NAM', 'W-COL-PHO-BUN']);
  assert.equal(r.data.is_demo, true);
  assert.ok(r.data.items.every(c => c.is_demo === true && c.dish_count === c.dishes.length));
  assert.ok(store.moduleRecords.some(x => x.module === 'W' && x.kind === 'collection' && x.is_demo));
  const ids = new Set(store.dishes.map(d => d.id));
  assert.ok(r.data.items.every(c => c.dishes.every(d => ids.has(d.id))));
});

test('W: hard allergy filter applies to collections (anonymous default profile blocks shrimp)', async () => {
  const store = createInitialStore();
  const r = await handleApiRequest(store, 'GET', '/api/v1/collections/public/W-COL-PHO-BUN', q());
  assert.equal(r.status, 200);
  assert.ok(!r.data.dishes.some(d => d.allergen_tags.includes('shrimp')));
  assert.equal(r.data.hidden_by_allergy, 1);
  assert.deepEqual(r.data.applied_allergies, store.userProfile.hard_allergies);
});

test('W: a signed-in user with no allergies sees every dish; their profile drives the filter', async () => {
  const store = createInitialStore();
  const { headers } = await login(store, '0900000077');
  await handleApiRequest(store, 'PATCH', '/api/v1/me/profile', q(), { hard_allergies: [] }, headers);
  const all = await handleApiRequest(store, 'GET', '/api/v1/collections/public/hanh-trinh-pho-bun-viet-nam', q(), {}, headers);
  assert.equal(all.status, 200);
  assert.equal(all.data.hidden_by_allergy, 0);
  assert.equal(all.data.dish_count, 4);
  await handleApiRequest(store, 'PATCH', '/api/v1/me/profile', q(), { hard_allergies: ['egg'] }, headers);
  const egg = await handleApiRequest(store, 'GET', '/api/v1/collections/public/W-COL-PHO-BUN', q(), {}, headers);
  assert.ok(!egg.data.dishes.some(d => d.allergen_tags.includes('egg')));
  assert.equal(egg.data.hidden_by_allergy, 1);
});

test('W: 404 for an unknown collection, writes need a token and are not allowed', async () => {
  const store = createInitialStore();
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/collections/public/NOPE', q())).status, 404);
  assert.equal((await handleApiRequest(store, 'POST', '/api/v1/collections/public', q(), {})).status, 401);
  const { headers } = await login(store, '0900000078');
  assert.equal((await handleApiRequest(store, 'POST', '/api/v1/collections/public', q(), {}, headers)).status, 405);
});

test('W: "save collection" flow uses the core personal collections (no copy of other data)', async () => {
  const store = createInitialStore();
  const { headers } = await login(store, '0900000079');
  const c = (await handleApiRequest(store, 'GET', '/api/v1/collections/public/W-COL-COM-NHA-NAM', q(), {}, headers)).data;
  const made = await handleApiRequest(store, 'POST', '/api/v1/me/collections', q(), { name: c.title }, headers);
  assert.equal(made.status, 201);
  for (const d of c.dishes)
    assert.equal((await handleApiRequest(store, 'POST', `/api/v1/me/collections/${made.data.collection.id}/dishes`, q(), { dish_id: d.id }, headers)).status, 200);
  const mine = await handleApiRequest(store, 'GET', '/api/v1/me/collections', q(), {}, headers);
  assert.deepEqual(mine.data.collections.find(x => x.name === c.title).dish_ids, c.dishes.map(d => d.id));
});

test('W UI: all five screens registered; login keeps phone/Zalo/Apple behind their flags', () => {
  const src = fs.readFileSync(new URL('../ui-design/src/live/w.js', import.meta.url), 'utf8');
  const reg = {};
  const ctx = vm.createContext({ window: {}, document: { readyState: 'complete', getElementById: () => null }, console });
  ctx.window.TOV_LIVE = { register: (id, def) => { reg[id] = def; } };
  ctx.window.addEventListener = () => {};
  vm.runInContext(src, ctx);
  assert.deepEqual(Object.keys(reg.W.screens).sort(), ['W-S01', 'W-S02', 'W-S03', 'W-S04', 'W-S05']);
  for (const a of ['dish', 'place', 'search', 'meal', 'budget', 'collection', 'saveCollection', 'order', 'logout'])
    assert.equal(typeof reg.W.actions[a], 'function', a);
  assert.match(src, /onclick="P2\.google\(\)"/);
  for (const f of ['phoneLogin', 'zaloLogin', 'appleLogin']) assert.ok(src.includes(`"${f}"`), f);
  assert.ok(!/<\/script>/.test(src), 'a literal closing script tag would break the inlined bundle');
  assert.ok(src.includes('/orders/redirect') && src.includes('/collections/public'));
});
