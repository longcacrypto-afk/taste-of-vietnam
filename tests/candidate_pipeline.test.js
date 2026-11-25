// Exercise the matrix with the approval rollout gate ON; compatibility is tested separately.
process.env.REQUIRE_SAFETY_APPROVAL = 'true';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { getRepository } from '../src/db/repository.js';
import { buildCandidates, placeEligibility } from '../src/services/candidatePipeline.js';
import { getTodaySuggestions } from '../src/services/recommender.js';
import { runAiFoodChat } from '../src/services/intentParser.js';
import { handleApiRequest } from '../src/api/router.js';
import { guest } from './helpers/auth.js';
import { candidateContract, matrixDishes, matrixPlace, NOW } from './contracts/candidateContract.js';

function fixture() {
  const store = createInitialStore();
  store.dishes = matrixDishes(); store.places = [matrixPlace(store.dishes)]; store.campaigns = [];
  store.userProfile = { ...store.userProfile, budget_min: 0, budget_max: 50000, hard_allergies: [], meal_slot: 'lunch' };
  store.suggestionHistory = [];
  return store;
}
candidateContract('memory', async (profile, history) => {
  const store = fixture(); store.userProfile = profile;
  const g = await guest(store);
  await getRepository(store).saveProfile(g.user.id, profile);
  for (const h of history) await getRepository(store).addHistory(g.user.id, h);
  return { store, view: { ...store, userProfile: profile, suggestionHistory: history }, headers: g.headers };
});

test('approval rollout: compatibility, approved-only, rejected and malformed/absent allergens', () => {
  const store = fixture(); store.dishes = [matrixDishes()[0]];
  const d = store.dishes[0];
  const old = process.env.REQUIRE_SAFETY_APPROVAL;
  try {
    delete d.safety_status;
    delete process.env.REQUIRE_SAFETY_APPROVAL;
    assert.equal(buildCandidates(store).candidates.length, 1);
    process.env.REQUIRE_SAFETY_APPROVAL = 'true';
    assert.equal(buildCandidates(store, { require_safety_approval: false }).candidates.length, 0);
    d.safety_status = 'approved'; assert.equal(buildCandidates(store).candidates.length, 1);
    d.safety_status = 'rejected'; assert.equal(buildCandidates(store).candidates.length, 0);
    process.env.REQUIRE_SAFETY_APPROVAL = 'false';
    assert.equal(buildCandidates(store).candidates.length, 0);
    d.safety_status = 'pending'; store.userProfile.hard_allergies = ['shrimp'];
    for (const tags of [undefined, null, 'shrimp', [null]]) {
      d.allergen_tags = tags; assert.equal(buildCandidates(store).candidates.length, 0);
    }
    d.allergen_tags = ['shrimp']; assert.equal(buildCandidates(store, { hard_allergies: [] }).candidates.length, 0);
  } finally { if (old === undefined) delete process.env.REQUIRE_SAFETY_APPROVAL; else process.env.REQUIRE_SAFETY_APPROVAL = old; }
});

test('0/1/2 candidates keep count and reasons; no sponsored slot below three', () => {
  for (let count = 0; count <= 3; count++) {
    const store = fixture(); store.dishes = matrixDishes().filter(d => d.meal_slots.includes('lunch')).slice(0, count);
    store.campaigns = store.dishes.map(d => ({ id: d.id, dish_id: d.id, place_id: 'MATRIX-PLACE', status: 'active' }));
    const today = getTodaySuggestions(store);
    assert.equal(today.items.length, count);
    assert.equal(today.items.filter(i => i.is_sponsored).length, count === 3 ? 1 : 0);
    assert.equal(today.reasons.some(r => r.code === 'insufficient_candidates'), count < 3);
  }
});

test('budget floor/ceiling exact, no tolerance; choose affordable farther place; cook uses recipe unit cost', () => {
  const store = fixture(); store.dishes = [matrixDishes()[0]];
  store.userProfile.budget_min = 20000; store.userProfile.budget_max = 20000;
  assert.equal(buildCandidates(store).candidates.length, 1);
  store.places[0].menu[0].price = 20001;
  assert.equal(buildCandidates(store, { mode: 'eat_out' }).candidates.length, 0);
  assert.equal(buildCandidates(store, { mode: 'cook' }).candidates[0].price_vnd, 20000);
  store.places.push({ ...structuredClone(store.places[0]), id: 'farther', lat: 10.959,
    menu: [{ dish_id: store.dishes[0].id, available: true, price: 20000 }] });
  assert.equal(buildCandidates(store, { mode: 'eat_out' }).candidates[0].nearest_place.place_id, 'farther');
  store.userProfile.budget_min = 20001; store.userProfile.budget_max = 30000;
  assert.equal(buildCandidates(store, { mode: 'cook' }).candidates.length, 0);
});

test('72h exact boundary and invalid dates; spice is hard only when constrained; vegan cannot relax', () => {
  const store = fixture(); const d = matrixDishes()[0]; store.dishes = [d]; d.spice_level = 3;
  assert.equal(buildCandidates(store).candidates.length, 1);
  assert.equal(buildCandidates(store, { spice_max: 0 }).candidates.length, 0);
  store.userProfile.diet_mode = 'vegan'; d.diet_flags = ['vegetarian'];
  assert.equal(buildCandidates(store, { diet_mode: 'balanced' }).candidates.length, 0);
  d.diet_flags = ['vegan']; assert.equal(buildCandidates(store).candidates.length, 1);
  for (const [date, count] of [[NOW - 72 * 3600000 + 1, 0], [NOW - 72 * 3600000, 1], [NOW - 72 * 3600000 - 1, 1]]) {
    store.suggestionHistory = [{ dish_id: d.id, action: 'eaten', created_at: new Date(date).toISOString() }];
    assert.equal(buildCandidates(store, {}, { now: NOW }).candidates.length, count);
  }
  store.suggestionHistory[0].created_at = 'bad'; assert.equal(buildCandidates(store).candidates.length, 1);
});

test('eat_out place gate: paused, unverified, unavailable, radius, bad coordinates; M4 predicate hook', () => {
  const store = fixture(); store.dishes = [matrixDishes()[0]];
  const original = structuredClone(store.places[0]);
  for (const patch of [{ is_verified: false }, { is_open_override: false }, { is_paused: true }, { closed_report_count: 3 }, { lat: 0 }, { lat: null }, { lng: Infinity }]) {
    store.places[0] = { ...original, ...patch };
    assert.equal(buildCandidates(store, { mode: 'eat_out' }).candidates.length, 0);
  }
  store.places[0] = original; original.menu[0].available = false;
  assert.equal(buildCandidates(store, { mode: 'eat_out' }).candidates.length, 0);
  original.menu[0].available = true;
  assert.equal(buildCandidates(store, { mode: 'eat_out' }, { placePredicate: () => false }).candidates.length, 0);
  assert.equal(placeEligibility(original), true);
});

test('cook requires real ingredients, steps and known cost; invalid contexts fail closed', () => {
  const store = fixture(); const d = matrixDishes()[0]; store.dishes = [d];
  for (const key of ['ingredients', 'steps', 'market_cost_base', 'base_servings']) {
    const value = d[key]; delete d[key];
    assert.equal(buildCandidates(store, { mode: 'cook' }).candidates.length, 0); d[key] = value;
  }
  for (const opts of [{ radius_m: 'x' }, { radius_m: -1 }, { budget_max: 'Infinity' }, { mode: 'magic' }, { meal_slot: 'midnight' }, { spice_max: 'x' }]) {
    const r = buildCandidates(store, opts); assert.equal(r.candidates.length, 0); assert.equal(r.context.valid, false);
  }
});

test('sponsored candidates cannot exceed user radius or budget, bypass history, or invent campaign place', () => {
  const store = fixture(); const d = store.dishes[0];
  store.campaigns = [{ id: 'ad', status: 'active', dish_id: d.id, place_id: 'MISSING', radius_m: 100000 }];
  assert.ok(getTodaySuggestions(store).items.every(i => !i.is_sponsored));
  store.campaigns[0].place_id = 'MATRIX-PLACE';
  store.places[0].menu[0].price = 999999;
  assert.ok(getTodaySuggestions(store).items.every(i => !i.is_sponsored));
});

test('cache cannot replay revoked approval, changed budget/menu/history, or leak between accounts; no provider call even with key', async () => {
  const store = fixture(); store.dishes = [matrixDishes()[0]];
  const g = await guest(store), repo = getRepository(store);
  const q = () => new URLSearchParams();
  const today = () => handleApiRequest(store, 'GET', '/api/v1/suggestions/today', q(), {}, g.headers);
  assert.equal((await today()).data.items.length, 1);
  store.dishes[0].safety_status = 'rejected'; assert.equal((await today()).data.items.length, 0);
  store.dishes[0].safety_status = 'approved'; assert.equal((await today()).data.items.length, 1);
  await repo.addHistory(g.user.id, { dish_id: store.dishes[0].id, action: 'eaten', created_at: new Date().toISOString() });
  assert.equal((await today()).data.items.length, 0);
  const other = await guest(store);
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', q(), {}, other.headers)).data.items.length, 1);
  const fetchOriginal = globalThis.fetch, key = process.env.GEMINI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = 'never-use'; globalThis.fetch = () => { throw new Error('provider must not be called'); };
    const chat = await handleApiRequest(store, 'POST', '/api/v1/chat', q(), { query: 'an trua' }, other.headers);
    assert.equal(chat.data.ai_source, 'local'); assert.equal(chat.data.options.length, 1);
  } finally { globalThis.fetch = fetchOriginal; if (key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = key; }
  for (const endpoint of ['spin', 'game', 'fortune', 'blind-box']) {
    const result = await handleApiRequest(store, 'GET', `/api/v1/suggestions/${endpoint}`, q(), {}, g.headers);
    assert.equal(result.status, 200); assert.equal(result.data.picked_dish, null);
  }
});

test('repository edits revoke safety review; missing recipe does not masquerade as cook; child claim is honest', async () => {
  const store = fixture(), repo = getRepository(store); const d = store.dishes[0];
  await repo.updateDish(d.id, { ingredients: [{ name: 'Thay đổi' }], safety_status: 'approved' });
  assert.equal(d.safety_status, 'pending');
  const chat = runAiFoodChat(store, 'tre nho khong cay di an');
  assert.ok(chat.options.every(o => !o.explanation.includes('Có ghế trẻ em')));
});


test('corrupt profile and catalogue constraints fail closed rather than matching substrings', () => {
  const store = fixture(); store.dishes = [matrixDishes()[0]];
  store.userProfile.hard_allergies = 'shrimp';
  assert.equal(buildCandidates(store).context.valid, false);
  store.userProfile.hard_allergies = []; store.userProfile.diet_mode = 'vegan';
  store.dishes[0].diet_flags = 'not-vegan'; assert.equal(buildCandidates(store).candidates.length, 0);
  store.userProfile.diet_mode = 'balanced'; store.dishes[0].meal_slots = 'lunch';
  assert.equal(buildCandidates(store).candidates.length, 0);
});
