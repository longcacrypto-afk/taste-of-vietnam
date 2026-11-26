// Core filters (screen map PR 6): M2-S02 search chips and M4-S01 place chips.
// Owner rule 26/11: original elements stay; a chip without real data/API stays "sắp có";
// missing data is never treated as a known "no"; no new API parameter.
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
// Chip labels exactly as the original design draws them (✓ stripped).
const designChips = (file, id, next) => {
  const src = fs.readFileSync(file, 'utf8');
  const screen = src.slice(src.indexOf(`'${id}': {`), src.indexOf(`'${next}': {`));
  return [...screen.matchAll(/tagPill\('([^']+)'/g)].map((m) => m[1].replace(/\s*✓\s*$/, ''));
};

test('M2-S02: one entry per original chip; only "Dưới 55k" has an existing parameter (budget_max=55000)', () => {
  const ctx = load();
  const SEARCH_CHIPS = plain(vm.runInContext('SEARCH_CHIPS', ctx));
  assert.deepEqual(Object.keys(SEARCH_CHIPS), designChips('ui-design/src/screens_m1_m2.js', 'M2-S02', 'M2-S03'));
  assert.deepEqual(SEARCH_CHIPS, { 'Dưới 55k': 'budget_max=55000', 'Món nước': null, '🚫 Ẩn Hải sản': null });
  assert.equal(ctx.searchChipQuery([]), '');
  assert.equal(ctx.searchChipQuery(['Dưới 55k']), '&budget_max=55000');
  assert.equal(ctx.searchChipQuery(['Món nước', '🚫 Ẩn Hải sản']), '', '"sắp có" chips send no parameter');
  const chipLabel = vm.runInContext('chipLabel', ctx);
  assert.equal(chipLabel('Dưới 55k ✓'), 'Dưới 55k');
  assert.equal(chipLabel('Món nước · sắp có'), 'Món nước');
});

test('M2-S02 chip → GET /dishes?budget_max=55000; results all within budget; off → no parameter; M2-S01 never gets it', async () => {
  const store = createInitialStore();
  // Seed dishes are all <= 55k: add one test dish above the budget (fixture, not product data).
  const base = store.dishes.find((x) => x.id === 'DISH-101');
  store.dishes.push({ ...structuredClone(base), id: 'DISH-T65', name: 'Món thử 65k', ref_price: 65000 });
  const state = { cache: {}, query: '', region: '', meal: '', searchChips: [] };
  const calls = [];
  const ctx = load({ state, appState: {}, api: async (p) => { calls.push(p); return (await get(store, p)).data; } });
  const [offKey, offFetch] = ctx.config('M2-S02');
  const all = await offFetch();
  assert.ok(!new URL(calls.at(-1), 'http://l').searchParams.has('budget_max'));
  state.searchChips = ['Dưới 55k'];
  const [onKey, onFetch] = ctx.config('M2-S02');
  assert.notEqual(onKey, offKey, 'cache key separates chip states');
  const d = await onFetch();
  assert.equal(new URL(calls.at(-1), 'http://l').searchParams.get('budget_max'), '55000');
  assert.ok(d.items.length > 0 && d.items.length < all.items.length, 'seed has dishes on both sides of 55k');
  for (const dish of d.items) assert.ok(Number(dish.ref_price) <= 55000, dish.id);
  const over = all.items.filter((x) => Number(x.ref_price) > 55000);
  assert.ok(over.length > 0 && over.every((x) => !d.items.some((y) => y.id === x.id)));
  state.query = 'phở';
  await ctx.config('M2-S02')[1]();
  const u = new URL(calls.at(-1), 'http://l').searchParams;
  assert.equal(u.get('q'), 'phở'); assert.equal(u.get('budget_max'), '55000', 'chip combines with the text search');
  state.query = '';
  await ctx.config('M2-S01')[1]();
  assert.ok(!new URL(calls.at(-1), 'http://l').searchParams.has('budget_max'), 'Explore is not filtered by search chips');
});

test('M4-S01: one entry per original filter chip; tests use only /places fields', () => {
  const ctx = load();
  const labels = Object.keys(plain(vm.runInContext('Object.fromEntries(Object.keys(PLACE_CHIPS).map(k=>[k,1]))', ctx)));
  assert.deepEqual(labels, designChips('ui-design/src/screens_m3_m4_m5_m8.js', 'M4-S01', 'M4-S02').slice(1));
});

test('M4-S01 filters: known match shown, known mismatch hidden, missing data never read as "no" and always named', () => {
  const { filterPlaces, placeFilterNote } = load();
  const partners = ['grabfood', 'shopeefood'];
  const D = 'DISH-1';
  const P = (id, o) => ({ id, menu: [], links: {}, has_ac: false, ...o });
  const items = [
    P('cheap', { menu: [{ dish_id: D, price: 45000 }], has_ac: true, links: { grabfood: 'https://g' } }),
    P('edge', { menu: [{ dish_id: D, price: 50000 }] }),
    P('dear', { menu: [{ dish_id: D, price: 65000 }], has_ac: true }),
    P('noprice', { menu: [{ dish_id: D, price: null }] }),
    P('otherdish', { menu: [{ dish_id: 'DISH-2', price: 20000 }], links: { maps: 'https://m', befood: 'https://b' } }),
  ];
  const ids = (r) => plain(r.shown).map((p) => p.id);
  const none = filterPlaces(items, [], D, partners);
  assert.deepEqual(ids(none), items.map((p) => p.id), 'no chip → nothing hidden');
  assert.equal(placeFilterNote(none.hidden), '');

  const price = filterPlaces(items, ['Dưới 50k'], D, partners);
  assert.deepEqual(ids(price), ['cheap', 'edge'], 'price of this dish only (another dish row does not count)');
  assert.deepEqual(plain(price.hidden), { 'giá món này trên 50.000đ': 1, 'chưa có giá món này': 2 });
  assert.equal(placeFilterNote(price.hidden), 'Đang ẩn 1 quán giá món này trên 50.000đ, 2 quán chưa có giá món này. Bỏ chọn bộ lọc để xem tất cả.');

  const ac = filterPlaces(items, ['Máy lạnh'], D, partners);
  assert.deepEqual(ids(ac), ['cheap', 'dear']);
  assert.deepEqual(plain(ac.hidden), { 'chưa ghi nhận có máy lạnh': 3 }, 'has_ac false is "not recorded", never "no AC"');

  const del = filterPlaces(items, ['Giao hàng'], D, partners);
  assert.deepEqual(ids(del), ['cheap'], 'maps/befood links are not a connected delivery partner');
  assert.deepEqual(plain(del.hidden), { 'chưa có liên kết giao hàng': 4 });

  const both = filterPlaces(items, ['Dưới 50k', 'Máy lạnh'], D, partners);
  assert.deepEqual(ids(both), ['cheap'], 'chips combine with AND');
  const hiddenTotal = Object.values(plain(both.hidden)).reduce((a, b) => a + b, 0);
  assert.equal(hiddenTotal + both.shown.length, items.length, 'every hidden place is counted in the note');
  assert.deepEqual(ids(filterPlaces(items, ['Unknown chip'], D, partners)), items.map((p) => p.id));
});

test('M4-S01 filters on the real /places response for a dish', async () => {
  const store = createInitialStore();
  const { filterPlaces, dishPrice } = load();
  // All nearby places (each seed place sells a different dish): the others have no
  // DISH-101 price, which must be counted as unknown, not as "over 50k".
  const d = (await get(store, '/places')).data;
  assert.ok(d.items.length > 1);
  const price = filterPlaces(d.items, ['Dưới 50k'], 'DISH-101', []);
  assert.deepEqual(plain(price.shown).map((p) => p.id), ['PLACE-401']);
  assert.deepEqual(plain(price.hidden), { 'chưa có giá món này': d.items.length - 1 });
  for (const chip of ['Dưới 50k', 'Máy lạnh', 'Giao hàng']) {
    const r = filterPlaces(d.items, [chip], 'DISH-101', ['grabfood', 'shopeefood']);
    const n = r.shown.length + Object.values(r.hidden).reduce((a, b) => a + b, 0);
    assert.equal(n, d.items.length, chip);
    for (const p of r.shown) {
      if (chip === 'Dưới 50k') assert.ok(dishPrice(p, 'DISH-101') <= 50000, p.id);
      if (chip === 'Máy lạnh') assert.equal(p.has_ac, true, p.id);
      if (chip === 'Giao hàng') assert.ok(p.links.grabfood || p.links.shopeefood, p.id);
    }
  }
});

test('runtime wiring: mapped chips toggle with ✓ and aria-pressed; unmapped chips stay "sắp có"; hidden places get a note', () => {
  assert.match(runtime, /searchFilters: true,/);
  assert.match(runtime, /placeFilters: true,/);
  const s02 = runtime.slice(runtime.indexOf('      if (id === "M2-S02") {'), runtime.indexOf('      if (id === "M2-S08") {'));
  assert.match(s02, /if \(FEATURES\.searchFilters && SEARCH_CHIPS\[label\]\) \{/);
  assert.match(s02, /chip\.textContent = label \+ \(on \? " ✓" : ""\);/, '✓ only while applied');
  assert.match(s02, /click\(chip, `P2\.searchChip\('\$\{J\(label\)\}'\)`\)/);
  assert.match(s02, /chip\.textContent = label \+ SOON;\s*soon\(chip,/, 'other chips stay in place as "sắp có"');
  assert.doesNotMatch(s02, /\.remove\(\)/);
  const s01 = runtime.slice(runtime.indexOf('    if (id === "M4-S01") {'), runtime.indexOf('    if (id === "M4-S02") {'));
  assert.match(s01, /filterPlaces\(items, state\.placeChips, selected\(\), FEATURES\.orderPartners\)/);
  assert.match(s01, /rows\(holder, tile, pf\.shown,/);
  assert.match(s01, /placeFilterNote\(pf\.hidden\)/);
  assert.match(s01, /data-place-filter-note role="status"/);
  assert.match(s01, /if \(FEATURES\.placeFilters && PLACE_CHIPS\[label\]\) \{/);
  assert.match(s01, /soon\(chip, "Bộ lọc này chưa hoạt động\."\);/);
  assert.match(s01, /openChipText\(items\)/, 'open count still counts every loaded place');
  const p2 = runtime.slice(runtime.indexOf('    searchChip(label) {'), runtime.indexOf('    choose(key, value, multi) {'));
  assert.match(p2, /if \(!SEARCH_CHIPS\[label\]\) return;[\s\S]*goScreen\("M2-S02"\)/, '"sắp có" chips cannot be toggled');
  assert.match(p2, /placeChip\(label\) \{\s*if \(!PLACE_CHIPS\[label\]\) return;[\s\S]*paint\(\);/);
});
