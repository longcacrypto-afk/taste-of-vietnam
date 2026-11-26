// Core static controls (screen map PR 3): meal chips M2-S01/M3-S01, M1-S07 ✓, M3-S05 subtitle/cards.
// Owner rule 26/11: original elements stay; not-live ones show "sắp có"; no invented data.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { handleApiRequest } from '../src/api/router.js';
import { createInitialStore } from '../src/data/seed.js';

const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const helpers = runtime.slice(runtime.indexOf('  // <m2-real-data>'), runtime.indexOf('  // </m2-real-data>'));
const configSrc = runtime.slice(runtime.indexOf('  function config(id)'), runtime.indexOf('  let originalStage'));
const plain = (v) => JSON.parse(JSON.stringify(v));
function load(extra = {}) {
  const ctx = vm.createContext({ window: {}, money: (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ', ...extra });
  vm.runInContext(helpers + '\n' + configSrc, ctx);
  return ctx;
}
const get = async (store, path) => {
  const url = new URL(path, 'http://local');
  return handleApiRequest(store, 'GET', '/api/v1' + url.pathname, url.searchParams);
};

test('meal chips: every original chip label is mapped; only real API meal_slot values, dessert is "sắp có"', () => {
  const kit = fs.readFileSync('ui-design/src/ui_kit.js', 'utf8');
  const row = kit.slice(kit.indexOf('categoryRow()'), kit.indexOf('mascotSVG('));
  const labels = [...row.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  const MEAL_CHIPS = vm.runInContext('MEAL_CHIPS', load());
  assert.deepEqual(Object.keys(plain(MEAL_CHIPS)), labels, 'one entry per original chip, same order');
  assert.deepEqual(plain(MEAL_CHIPS), { 'Bữa sáng': 'breakfast', 'Bữa trưa': 'lunch', 'Bữa tối': 'dinner', 'Ăn vặt': 'snack', 'Tráng miệng': null });
  const bind = runtime.slice(runtime.indexOf('  function bindMealChips'), runtime.indexOf('  function mobile('));
  assert.match(bind, /text\(label, name \+ SOON\)/);
  assert.match(bind, /soon\(b,/, 'dessert chip stays in place, disabled with a reason');
  assert.doesNotMatch(bind, /\.remove\(\)/);
  assert.match(runtime, /bindMealChips\(root, false\);\n      const cards = \$\$\("\.grid-cols-2 > \.group", root\);/, 'M3-S01 chips bound');
  assert.match(runtime, /bindMealChips\(root, true\);/, 'M2-S01 chips bound with active state');
});

test('M2-S01 meal filter calls GET /dishes?meal_slot= and shows only dishes of that meal', async () => {
  const store = createInitialStore();
  const state = { cache: {}, query: '', region: '', meal: '' };
  const calls = [];
  const ctx = load({ state, appState: {}, api: async (p) => { calls.push(p); return (await get(store, p)).data; } });
  const all = await ctx.config('M2-S01')[1]();
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    state.meal = slot;
    const [key, fetch] = ctx.config('M2-S01');
    assert.match(key, new RegExp(':' + slot + '$'), 'cache key separates meal filters');
    const d = await fetch();
    assert.equal(new URL(calls.at(-1), 'http://l').searchParams.get('meal_slot'), slot);
    assert.ok(d.items.length > 0 && d.items.length <= all.items.length, slot);
    for (const dish of d.items) assert.ok(store.dishes.find((x) => x.id === dish.id).meal_slots.includes(slot), dish.id);
  }
  state.meal = '';
  await ctx.config('M2-S01')[1]();
  assert.ok(!new URL(calls.at(-1), 'http://l').searchParams.has('meal_slot'), 'no chip → no empty enum sent');
  const p2 = runtime.slice(runtime.indexOf('    search(q) {'), runtime.indexOf('    choose(key, value, multi) {'));
  assert.match(p2, /meal\(slot\) \{[\s\S]*state\.meal === slot \? "" : slot[\s\S]*goScreen\("M2-S01"\)/, 'chip toggles and opens Explore');
  assert.match(p2, /region\(reg\) \{[\s\S]*state\.meal = "";/, 'region pick clears meal filter');
  assert.match(p2, /search\(q\) \{\s*state\.query = q;\s*state\.meal = "";/, 'search is not silently meal-filtered');
});

test('M1-S07 ✓ and highlight follow the saved budget range exactly; none for other ranges', () => {
  const ctx = load(); const { budgetIndex } = ctx; const BUDGETS = vm.runInContext('BUDGETS', ctx);
  assert.deepEqual(plain(BUDGETS), [[0, 35000], [35000, 65000], [60000, 120000]]);
  assert.equal(budgetIndex({ budget_min: 0, budget_max: 35000 }), 0);
  assert.equal(budgetIndex({ budget_min: 35000, budget_max: 65000 }), 1);
  assert.equal(budgetIndex({ budget_min: 60000, budget_max: 120000 }), 2);
  assert.equal(budgetIndex({ budget_min: 0, budget_max: 1000000 }), -1, 'new-profile default matches no card');
  assert.equal(budgetIndex({}), -1);
  assert.equal(budgetIndex({ budget_min: null, budget_max: 35000 }), -1);
  const s07 = runtime.slice(runtime.indexOf('    if (id === "M1-S07") {'), runtime.indexOf('    const next = {'));
  assert.match(s07, /chosen = budgetIndex\(p\)/);
  assert.match(s07, /replace\(\/\\s\*✓\\s\*\$\/, ""\) \+ \(i === chosen \? " ✓" : ""\)/, 'design ✓ is stripped and re-added only on the saved card');
  assert.match(runtime, /\[p\.budget_min, p\.budget_max\] = BUDGETS\[i\];/, 'cards save the same ranges they are matched against');
});

test('M3-S05 subtitle and cards come from the real /chat answer; nothing from the design sample', async () => {
  const { chatSubtitle, chatOptionCard } = load();
  assert.equal(chatSubtitle(null), 'M3-S05', 'no chat yet → no invented party size or budget');
  const store = createInitialStore();
  const r = await handleApiRequest(store, 'POST', '/api/v1/chat', new URLSearchParams(), { query: '2 người ăn tối dưới 100k' });
  assert.equal(r.status, 200);
  assert.equal(chatSubtitle(r.data.intent), 'M3-S05 · 2 người · Ngân sách <= 100.000đ');
  assert.ok(r.data.options.length > 0);
  r.data.options.forEach((o, i) => {
    const c = plain(chatOptionCard(o, i));
    assert.ok(c.pill.startsWith('Phương án ' + (i + 1) + ' · '));
    assert.equal(c.total, 'Tổng ~' + o.estimated_group_cost_vnd.toLocaleString('vi-VN') + 'đ');
    if (o.place) {
      assert.equal(c.name, o.place.place_name);
      assert.equal(c.detail, o.dish_name);
      assert.match(c.pill, new RegExp('Cách ' + Math.round(o.place.distance_m) + 'm$'));
    } else assert.equal(c.name, o.dish_name);
  });
  const home = plain(chatOptionCard({ option_type: 'home_recipe', dish_name: 'Canh chua', prep_minutes: 30, place: null }, 2));
  assert.deepEqual(home, { pill: 'Phương án 3 · Tự nấu 30p', total: 'Chưa có giá', name: 'Canh chua', detail: 'Có công thức tự nấu' });
  assert.equal(plain(chatOptionCard({ dish_name: 'X', place: { place_name: 'Q', distance_m: null }, estimated_group_cost_vnd: 0 }, 0)).pill, 'Phương án 1 · Ăn tại quán');
  const s05 = runtime.slice(runtime.indexOf('    if (id === "M3-S05") {'), runtime.indexOf('    if (id === "M3-S04" || id === "M3-S05") {'));
  assert.match(s05, /chatSubtitle\(state\.chatIntent\)/);
  assert.match(s05, /emptySlot\(n, "Chưa có thêm phương án"\)/, 'fewer than 3 options keeps the card as an empty slot');
  assert.doesNotMatch(s05, /Phát Tài|300k|240\.000|Hương Việt/);
  assert.match(runtime, /state\.chatIntent = d\.intent \|\| null;/);
});
