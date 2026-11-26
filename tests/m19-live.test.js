// M19 live: BMR (Mifflin-St Jeor) from the body profile the user enters, TDEE = BMR×1.2 + active kcal,
// macro split 30/50/20, manual vs sandbox sync, intake from "eaten" history, Low-GI flag + allergy filter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { guest } from './helpers/auth.js';
import { mifflinBmr, targets } from '../src/modules/m19.js';

const q = () => new URLSearchParams();
const api = (store, u, m, p, body) => handleApiRequest(store, m, p, q(), body, u.headers);

test('M19: Mifflin-St Jeor and 30/50/20 targets', () => {
  assert.equal(mifflinBmr({ sex: 'male', age: 30, height_cm: 172, weight_kg: 75 }), 1680);
  assert.equal(mifflinBmr({ sex: 'female', age: 28, height_cm: 158, weight_kg: 52 }), 1207);
  assert.equal(mifflinBmr({ sex: 'male', age: 30 }), null);
  const t = targets(1680, 480, 'maintain');
  assert.equal(t.tdee, 2496);
  assert.deepEqual(t.macro_targets_g, { protein: 187, carbs: 312, fat: 55 });
  assert.equal(targets(1680, 480, 'cut').target_calories_daily, 2096);
  assert.equal(targets(1680, 0, 'bulk').target_calories_daily, 2316);
});

test('M19: needs a token; without a body profile nothing is invented', async () => {
  const store = createInitialStore();
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/health/nutrition-profile', q())).status, 401);
  const a = await guest(store);
  const r = await api(store, a, 'GET', '/api/v1/health/nutrition-profile');
  assert.equal(r.status, 200);
  assert.equal(r.data.needs_profile, true);
  assert.equal(r.data.bmr, null);
  assert.equal(r.data.tdee, null);
  assert.equal(r.data.daily_steps, null);
  assert.equal(r.data.macro_targets_g, null);
});

test('M19: profile validation, manual and sandbox sync, TDEE and macros', async () => {
  const store = createInitialStore();
  const a = await guest(store);
  assert.equal((await api(store, a, 'PUT', '/api/v1/health/profile', { sex: 'x' })).status, 400);
  assert.equal((await api(store, a, 'PUT', '/api/v1/health/profile', { age: 5 })).status, 400);
  assert.equal((await api(store, a, 'PUT', '/api/v1/health/profile', { weight_kg: 900 })).status, 400);
  const p = await api(store, a, 'PUT', '/api/v1/health/profile', { sex: 'male', age: 30, height_cm: 172, weight_kg: 75 });
  assert.equal(p.data.bmr, 1680);
  assert.equal((await api(store, a, 'POST', '/api/v1/health/sync', { daily_steps: -1, active_calories_burned: 10 })).status, 400);
  assert.equal((await api(store, a, 'POST', '/api/v1/health/sync', { daily_steps: 100 })).status, 400);
  assert.equal((await api(store, a, 'POST', '/api/v1/health/sync', { source: 'fitbit', daily_steps: 1, active_calories_burned: 1 })).status, 400);
  const m = await api(store, a, 'POST', '/api/v1/health/sync', { daily_steps: 8420, active_calories_burned: 480 });
  assert.equal(m.data.sandbox, false);
  assert.equal(m.data.sync_source, 'manual');
  assert.equal(m.data.tdee, 2496);
  assert.deepEqual(m.data.macro_split_pct, { protein: 30, carbs: 50, fat: 20 });
  const s = await api(store, a, 'POST', '/api/v1/health/sync', { wearable: 'Apple Health', daily_steps: 9000, active_calories_burned: 500 });
  assert.equal(s.data.sandbox, true);
  assert.match(s.data.connected_wearable, /sandbox/);
  assert.match(s.data.note, /Chưa kết nối/);
  assert.equal(s.data.tdee, 2516);
  assert.equal(s.data.history.length, 1, 'one reading per day, the later one wins');
  const g = await api(store, a, 'GET', '/api/v1/health/nutrition-profile');
  assert.equal(g.data.daily_steps, 9000);
  const other = await guest(store);
  assert.equal((await api(store, other, 'GET', '/api/v1/health/nutrition-profile')).data.daily_steps, null, 'per user');
});

test('M19: intake from dishes marked eaten today, Low-GI flag and fast-carb warning, allergy-safe', async () => {
  const store = createInitialStore();
  const a = await guest(store);
  await api(store, a, 'PUT', '/api/v1/health/profile', { sex: 'female', age: 28, height_cm: 158, weight_kg: 52, goal: 'cut', low_gi: true });
  await handleApiRequest(store, 'PUT', '/api/v1/me/profile', q(), { hard_allergies: ['shrimp', 'peanut'] }, a.headers);
  const fb = await api(store, a, 'POST', '/api/v1/suggestions/feedback', { dish_id: 'DISH-102', action: 'eaten' });
  assert.equal(fb.status, 200);
  const r = await api(store, a, 'GET', '/api/v1/health/nutrition-profile');
  assert.equal(r.data.intake_today_kcal, 620);
  assert.equal(r.data.eaten_today[0].dish_id, 'DISH-102');
  assert.equal(r.data.blood_sugar_support, true);
  assert.equal(r.data.fast_carb_warnings[0].dish_id, 'DISH-102');
  assert.equal(r.data.target_calories_daily, 1207, 'cut never goes below BMR (1448 − 400 < 1207)');
  assert.ok(r.data.low_gi_dishes.length > 0);
  assert.ok(!r.data.low_gi_dishes.some(d => d.dish_id === 'DISH-107'), 'gỏi cuốn (shrimp/peanut) filtered');
  assert.equal(r.data.is_demo, true);
  assert.match(r.data.gi_note, /demo/);
});
