// Milestone 2: screens that showed fixed sample text now show API data
// (M2-S03 region counts, M3-S02 reasons, M3-S03 wheel labels, M4-S01 chip/price, M4-S05 availability).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { handleApiRequest } from '../src/api/router.js';
import { createInitialStore } from '../src/data/seed.js';

const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const helpers = runtime.slice(runtime.indexOf('  // <m2-real-data>'), runtime.indexOf('  // </m2-real-data>'));
const configSrc = runtime.slice(runtime.indexOf('  function config(id)'), runtime.indexOf('  let originalStage'));

function load(extra = {}) {
  const ctx = vm.createContext({ window: {}, money: (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ', ...extra });
  vm.runInContext(helpers + '\n' + configSrc, ctx);
  return ctx;
}

test('helper block exists and the bundle carries it', () => {
  assert.ok(helpers.length > 200);
  assert.ok(fs.readFileSync('ui-design/index.html', 'utf8').includes(helpers), 'rebuild ui-design/index.html');
});

test('M3-S03 wheel labels: only real pool names, picked dish under the pointer, nothing invented', () => {
  const ctx = load();
  const { wheelLabels } = ctx;
  assert.equal(vm.runInContext('WHEEL_LAND', ctx), 4, '1560deg spin leaves segment 5 (135-180deg) under the pointer');
  assert.match(fs.readFileSync('ui-design/src/app_shell.html', 'utf8'), /100% \{ transform: rotate\(1560deg\); \}/, 'WHEEL_LAND depends on this keyframe');
  const names = ['Phở Bò', 'Cơm Tấm', 'Bún Bò Huế O Xuân'];
  const plain = wheelLabels(names);
  assert.equal(plain.length, 8);
  assert.deepEqual(JSON.parse(JSON.stringify(plain.slice(4, 7))), ['Phở Bò', 'Cơm Tấm', 'Bún Bò Hu…'], 'pool repeats in order from the landing segment');
  for (const l of plain) assert.ok(names.some((n) => n.startsWith(l.replace('…', ''))), l);
  const picked = wheelLabels(names, 'Cơm Tấm');
  assert.equal(picked[4], 'Cơm Tấm');
  assert.deepEqual(JSON.parse(JSON.stringify(wheelLabels([], null))), Array(8).fill(''), 'no pool -> blank segments, no sample dishes');
  assert.equal(wheelLabels(['A'], 'B')[4], 'B', 'picked dish always shown even if pool list is stale');
});

test('M4-S01 open chip counts only verified-open places and says when hours are unknown', () => {
  const { openChipText, placeLine } = load();
  const unknown = { open_status: { status: 'unknown' }, is_currently_open: false, distance_m: 390.4 };
  const open = { open_status: { status: 'open' }, is_currently_open: true, distance_m: 100 };
  const closed = { open_status: { status: 'closed' }, distance_m: 50 };
  assert.equal(openChipText([unknown, unknown]), '● Chưa rõ giờ mở (2)');
  assert.equal(openChipText([open, unknown]), '● Đang mở (1)');
  assert.equal(openChipText([closed]), '● Đang mở (0)');
  assert.equal(placeLine(unknown), '390m · Hỏi quán để xác nhận');
  assert.equal(placeLine(closed), '50m · Đang đóng');
  assert.equal(placeLine({ ...open, distance_m: null }), 'Đang mở', 'unknown distance is not shown as 0m');
});

test('M4-S01 price is the selected dish menu row, named; missing price is not shown as 0đ', () => {
  const { menuPrice } = load();
  const menu = [{ dish_id: 'DISH-101', name: 'Phở bò tái nạm', price: 45000 },
    { dish_id: 'DISH-108', name: 'Combo Phở & Bò hầm gia đình 4 người', price: 240000 }];
  assert.match(menuPrice(menu, 'DISH-101'), /^45\.000đ · Phở bò tái nạm$/);
  assert.match(menuPrice(menu, 'DISH-108'), /240\.000đ · Combo .*4 người/);
  assert.equal(menuPrice(menu, 'DISH-999'), 'Chưa có giá');
});

test('M4-S05 availability note comes from the place open status, not sample hours', () => {
  const { hoursNote } = load();
  assert.equal(hoursNote({ open_status: { status: 'unknown' }, open_hour: 6, close_hour: 22 }), 'Giờ mở chưa xác minh');
  assert.equal(hoursNote({ open_status: { status: 'open' } }), 'Quán đang mở theo giờ đã xác minh');
  assert.equal(hoursNote({ open_status: { status: 'stale' } }), 'Giờ mở cần xác minh lại');
  const m4s05 = runtime.slice(runtime.indexOf('if (id === "M4-S05")'), runtime.indexOf('if (id === "M4-S04")'));
  assert.doesNotMatch(m4s05, /06:00|8 phần/);
  assert.match(m4s05, /Number\.isInteger\(m\.remaining_portions\)/, 'stock hook only uses real remaining_portions');
});

test('M3-S02 reason uses the suggestion: weather chip kept as "sắp có", no match %, sponsored disclosed', () => {
  const { whyText } = load();
  const dish = { id: 'DISH-103', name: 'Bún Bò Huế O Xuân', ref_price: 50000, description: 'mô tả' };
  const s = { dish_id: 'DISH-103', reason: 'Quán cách 628m · Hợp điều kiện đã chọn', price_vnd: 50000, is_sponsored: true,
    nearest_place: { place_id: 'PLACE-403', place_name: 'Bún Bò Huế O Xuân', distance_m: 628 } };
  const w = whyText({ ...dish, suggestion: s });
  assert.equal(w.title, s.reason);
  assert.match(w.message, /cách 628m · Giá 50\.000đ · Gợi ý có tài trợ/);
  assert.deepEqual(JSON.parse(JSON.stringify(w.pills)), ['🌤️ Thời tiết · sắp có', '📍 Cách 628m', '🚫 Đã lọc theo dị ứng đã khai báo']);
  assert.equal(w.weather.live, false);
  for (const v of [w.title, w.message, ...w.pills]) assert.doesNotMatch(v, /°C|98%|trời/i);
  const live = whyText({ ...dish, suggestion: s, live_weather: { label: '31°C · Nắng' } });
  assert.equal(live.pills[0], '🌧️ 31°C · Nắng', 'provider hook output is shown as-is once it returns data');
  assert.equal(live.weather.live, true);
  const none = whyText({ ...dish, suggestion: null });
  assert.equal(none.title, 'Món này không có trong gợi ý hôm nay');
  assert.equal(none.pills.length, 3, 'all three original chips stay');
  assert.match(none.pills[2], /Chưa lọc dị ứng/);
  const home = whyText({ ...dish, suggestion: { ...s, is_sponsored: false, nearest_place: null } });
  assert.match(home.message, /Chưa có quán gần bạn/);
  assert.doesNotMatch(home.message, /tài trợ/);
});

test('M2-S03 binds only the three region cards (not header buttons) to API totals per region', async () => {
  const store = createInitialStore();
  const api = async (path) => {
    const url = new URL(path, 'http://local');
    return (await handleApiRequest(store, 'GET', '/api/v1' + url.pathname, url.searchParams)).data;
  };
  const ctx = load({ api, state: { cache: {}, query: '', region: 'trung' }, appState: {} });
  const [key, get] = ctx.config('M2-S03');
  assert.equal(key, 'regions', 'counts must not depend on the active Explore region filter');
  const { counts } = await get();
  for (const region of ['bac', 'trung', 'nam']) {
    const r = await handleApiRequest(store, 'GET', '/api/v1/dishes', new URLSearchParams({ region, limit: '100' }));
    assert.equal(counts[region], r.data.items.length, region);
  }
  assert.ok(counts.bac > 0 && counts.trung > 0 && counts.nam > 0);
  const m2s03 = runtime.slice(runtime.indexOf('if (id === "M2-S03") {'), runtime.indexOf('if (/^M2-S0[4-7]$/.test(id) || id === "M3-S02")'));
  assert.match(m2s03, /\$\$\('\[onclick\*="M2-S04"\]', root\)/);
  assert.doesNotMatch(m2s03, /\$\$\("\[onclick\]", root\)/);
});

test('M3-S02 loads the dish with its suggestion; M3-S03 loads the real spin pool', async () => {
  const store = createInitialStore();
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    const url = new URL(path, 'http://local');
    return (await handleApiRequest(store, 'GET', '/api/v1' + url.pathname, url.searchParams)).data;
  };
  const state = { cache: {}, dish: null };
  const appState = { servings: 2 };
  const ctx = load({ api, state, appState, selected: () => state.dish, encodeURIComponent });
  const today = (await api('/suggestions/today')).items;
  state.dish = today[1].dish_id;
  const [key, get] = ctx.config('M3-S02');
  assert.match(key, /^why:/);
  const d = await get();
  assert.equal(d.id, today[1].dish_id);
  assert.equal(d.suggestion.dish_id, today[1].dish_id);
  assert.equal(appState.liveToday.items.length, today.length);
  const [poolKey, pool] = ctx.config('M3-S03');
  assert.equal(poolKey, 'spin-pool');
  const p = await pool();
  assert.ok(p.candidates.length > 0);
});

test('spin/game endpoints return the safe pool the pick came from (names only, no invented dishes)', async () => {
  const store = createInitialStore();
  const ids = new Set(store.dishes.map((d) => d.id));
  for (const kind of ['spin', 'game', 'fortune', 'blind-box']) {
    const r = await handleApiRequest(store, 'GET', '/api/v1/suggestions/' + kind, new URLSearchParams());
    assert.equal(r.status, 200);
    assert.equal(r.data.candidates.length, r.data.total_safe_candidates, kind);
    for (const c of r.data.candidates) {
      assert.deepEqual(Object.keys(c).sort(), ['dish_id', 'name']);
      assert.ok(ids.has(c.dish_id));
    }
    if (r.data.picked_dish) assert.ok(r.data.candidates.some((c) => c.dish_id === r.data.picked_dish.id), kind);
  }
});

test('owner rule: original elements are kept; not-live ones are marked, never removed', () => {
  const m3s02 = runtime.slice(runtime.indexOf('      if (id === "M3-S02") {\n        const why'), runtime.indexOf('    if (id === "M3-S05") {'));
  assert.doesNotMatch(m3s02, /\.remove\(\)/, 'M3-S02 removes nothing');
  assert.match(m3s02, /soon\(pills\[0\]/);
  const m4s01 = runtime.slice(runtime.indexOf('    if (id === "M4-S01") {'), runtime.indexOf('    if (id === "M4-S02") {'));
  assert.doesNotMatch(m4s01, /\.remove\(\)/);
  assert.match(m4s01, /FEATURES\.placeFilters/);
});

test('today suggestions expose the weather hook: null until a provider is configured', async () => {
  const r = await handleApiRequest(createInitialStore(), 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  assert.equal(r.status, 200);
  assert.ok(Object.hasOwn(r.data, 'live_weather'));
  assert.equal(r.data.live_weather, null);
  const { currentWeather } = await import('../src/services/weatherProvider.js');
  assert.equal(await currentWeather({ lat: 10.95, lng: 106.84 }), null);
});
