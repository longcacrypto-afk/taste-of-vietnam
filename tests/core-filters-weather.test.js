// core-filters-weather: M2-S02 / M4-S01 chips filter server-side on real catalogue fields,
// M2-S08 collection chip counts real collections, and /suggestions/today reads real
// Open-Meteo weather (user location or default Biên Hòa). No test touches the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { handleApiRequest } from '../src/api/router.js';
import { createInitialStore } from '../src/data/seed.js';
import { setWeatherFetch, weatherForProfile, DEFAULT_WEATHER_LOCATION } from '../src/services/weatherProvider.js';
import { placeMatchesFilters, placeDelivers } from '../src/services/placeQuery.js';
import { guest } from './helpers/auth.js';

const q = (s = '') => new URLSearchParams(s);
const ids = (r) => r.data.items.map((x) => x.id);
const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const between = (a, b) => {
  const i = runtime.indexOf(a), j = runtime.indexOf(b, i + a.length);
  assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`);
  return runtime.slice(i, j);
};
const reading = (current) => async () => ({ ok: true, json: async () => ({ current }) });
const HOT = { time: '2026-11-28T04:00', temperature_2m: 31.4, weather_code: 1 };

test.afterEach(() => {
  setWeatherFetch(null);
  for (const k of ['WEATHER_PROVIDER', 'WEATHER_TIMEOUT_MS', 'WEATHER_CACHE_SECONDS']) delete process.env[k];
});

// ── M2-S02: GET /dishes ──────────────────────────────────────────────────────
test('GET /dishes soup=true: only dishes recorded as món nước; not entered never matches', async () => {
  const store = createInitialStore();
  const all = await handleApiRequest(store, 'GET', '/api/v1/dishes', q('safe_only=false&limit=100'));
  const soup = await handleApiRequest(store, 'GET', '/api/v1/dishes', q('safe_only=false&soup=true&limit=100'));
  assert.equal(soup.status, 200);
  assert.deepEqual(ids(soup), all.data.items.filter((d) => d.is_soup === true).map((d) => d.id));
  assert.ok(!ids(soup).includes('DISH-108') && !ids(soup).includes('DISH-111'), 'ambiguous dishes are NULL, not soup');
  const notSoup = await handleApiRequest(store, 'GET', '/api/v1/dishes', q('safe_only=false&soup=false&limit=100'));
  assert.ok(notSoup.data.items.every((d) => d.is_soup === false));
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/dishes', q('soup=yes'))).status, 400);
});

test('GET /dishes exclude_seafood=true hides seafood tags and unknown allergen data, on top of the hard allergy filter', async () => {
  const store = createInitialStore();
  store.dishes.push({ ...store.dishes[0], id: 'DISH-990', name: 'Món chưa khai dị ứng', allergen_tags: undefined });
  const r = await handleApiRequest(store, 'GET', '/api/v1/dishes', q('safe_only=false&exclude_seafood=true&limit=100'));
  assert.equal(r.status, 200);
  for (const d of r.data.items) {
    assert.ok(Array.isArray(d.allergen_tags), d.id);
    assert.ok(!d.allergen_tags.some((t) => ['shrimp', 'shrimp_paste', 'shellfish', 'fish'].includes(t)), d.id);
    assert.ok(!(d.tags || []).includes('Hải sản'), d.id);
  }
  assert.ok(!ids(r).includes('DISH-990'), 'unknown allergen data is not "seafood-free"');
  // Hard allergy (default profile: shrimp + peanut) still applies whatever the chips say.
  const safe = await handleApiRequest(store, 'GET', '/api/v1/dishes', q('budget_max=55000&soup=true&limit=100'));
  assert.ok(safe.data.items.every((d) => !(d.allergen_tags || []).some((t) => ['shrimp', 'peanut'].includes(t))));
  assert.ok(safe.data.items.every((d) => d.ref_price <= 55000 && d.is_soup === true));
  assert.ok(!ids(safe).includes('DISH-106'), 'bún riêu (shrimp) blocked by the hard filter');
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/dishes', q('exclude_seafood=1'))).status, 400);
});

// ── M4-S01: GET /places ──────────────────────────────────────────────────────
test('GET /places has_ac / delivery / max_price filter server-side; filtered_out counts the rest', async () => {
  const store = createInitialStore();
  const base = await handleApiRequest(store, 'GET', '/api/v1/places', q());
  const ac = await handleApiRequest(store, 'GET', '/api/v1/places', q('has_ac=true'));
  assert.equal(ac.status, 200);
  assert.ok(ac.data.items.length > 0 && ac.data.items.every((p) => p.has_ac === true));
  assert.equal(ac.data.filtered_out, base.data.total - ac.data.total);
  assert.deepEqual(ac.data.filters, { has_ac: true });
  const cheap = await handleApiRequest(store, 'GET', '/api/v1/places', q('dish_id=DISH-101&max_price=50000'));
  assert.ok(cheap.data.items.every((p) => p.menu.some((m) => m.dish_id === 'DISH-101' && m.price <= 50000)));
  const tooCheap = await handleApiRequest(store, 'GET', '/api/v1/places', q('dish_id=DISH-101&max_price=1000'));
  assert.equal(tooCheap.data.total, 0);
  assert.ok(tooCheap.data.filtered_out > 0);
  const del = await handleApiRequest(store, 'GET', '/api/v1/places', q('delivery=true'));
  assert.ok(del.data.items.every((p) => p.links.grabfood || p.links.shopeefood));
  for (const bad of ['has_ac=false', 'delivery=1', 'max_price=0', 'max_price=abc'])
    assert.equal((await handleApiRequest(store, 'GET', '/api/v1/places', q(bad))).status, 400, bad);
  const none = await handleApiRequest(store, 'GET', '/api/v1/places', q());
  assert.equal(none.data.filtered_out, 0);
  assert.deepEqual(none.data.filters, {});
});

test('place filters: unknown data never matches; only verified, not-paused, open places', async () => {
  assert.equal(placeMatchesFilters({ has_ac: null, menu: [] }, { has_ac: true }), false, 'AC not entered');
  assert.equal(placeMatchesFilters({ has_ac: undefined }, { has_ac: true }), false);
  assert.equal(placeMatchesFilters({ menu: [{ dish_id: 'D', price: null, available: true }] }, { max_price: 50000 }, 'D'), false, 'no price');
  assert.equal(placeMatchesFilters({ menu: [{ dish_id: 'D', price: 40000, available: false }] }, { max_price: 50000 }, 'D'), false, 'unavailable row');
  assert.equal(placeMatchesFilters({ menu: [{ dish_id: 'D', price: 40000, available: true }] }, { max_price: 50000 }, 'D'), true);
  assert.equal(placeDelivers({ links: {} }), false);
  assert.equal(placeDelivers({ links: { befood: 'https://be.com.vn/x' } }), false, 'partner the redirect does not accept');
  assert.equal(placeDelivers({ links: { grabfood: 'https://evil.example/x' } }), false, 'host not on the allowlist');
  assert.equal(placeDelivers({ links: { grabfood: 'https://food.grab.com/vn/vi/restaurant/x' } }), true);

  const store = createInitialStore();
  const p = store.places.find((x) => x.id === 'PLACE-401');
  p.has_ac = null; // not entered
  store.places.find((x) => x.id === 'PLACE-402').is_verified = false;
  store.places.find((x) => x.id === 'PLACE-406').is_open_override = false; // paused / reported closed
  const r = await handleApiRequest(store, 'GET', '/api/v1/places', q('has_ac=true'));
  assert.ok(!ids(r).includes('PLACE-401'), 'unknown AC is not matching');
  assert.ok(!ids(r).includes('PLACE-402'), 'unverified never suggested');
  assert.ok(!ids(r).includes('PLACE-406'), 'paused never suggested');
  assert.ok(r.data.items.every((x) => x.is_currently_open === true || x.open_status.status !== 'closed'));
});

// ── M2-S08: GET /me/collections ──────────────────────────────────────────────
test('GET /me/collections returns dish_count of dishes that still exist', async () => {
  const store = createInitialStore();
  const g = await guest(store);
  const call = (m, p, b) => handleApiRequest(store, m, p, q(), b, g.headers);
  const c = (await call('POST', '/api/v1/me/collections', { name: 'Món nước buổi sáng' })).data.collection;
  await call('POST', `/api/v1/me/collections/${c.id}/dishes`, { dish_id: 'DISH-101' });
  await call('POST', `/api/v1/me/collections/${c.id}/dishes`, { dish_id: 'DISH-103' });
  let list = (await call('GET', '/api/v1/me/collections')).data.collections;
  assert.equal(list.find((x) => x.id === c.id).dish_count, 2);
  store.dishes = store.dishes.filter((d) => d.id !== 'DISH-103'); // removed from the catalogue
  list = (await call('GET', '/api/v1/me/collections')).data.collections;
  assert.equal(list.find((x) => x.id === c.id).dish_count, 1);
});

// ── Weather ──────────────────────────────────────────────────────────────────
test('weather: default area Biên Hòa when no location is chosen; profile location when it is', async () => {
  const urls = [];
  setWeatherFetch(async (url) => { urls.push(url); return reading(HOT)(); });
  assert.deepEqual({ ...DEFAULT_WEATHER_LOCATION }, { lat: 10.957, lng: 106.843, name: 'Biên Hòa' });
  const d = await weatherForProfile({ lat: 10.9574, lng: 106.8426, location_set: false });
  assert.equal(d.location.source, 'default');
  assert.equal(d.location.name, 'Biên Hòa');
  assert.equal(d.temp_c, 31);
  const own = await weatherForProfile({ lat: 10.80, lng: 106.70, location_set: true });
  assert.deepEqual(own.location, { lat: 10.8, lng: 106.7, source: 'profile', name: null });
  assert.match(urls.at(-1), /latitude=10\.80&longitude=106\.70&current=temperature_2m,weather_code$/);

  const store = createInitialStore();
  const r = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', q());
  assert.equal(r.status, 200);
  assert.equal(r.data.live_weather.source, 'Open-Meteo');
  assert.equal(r.data.live_weather.location.source, 'default');
  assert.deepEqual(r.data.weather, r.data.live_weather, 'ranking sees the same real reading');
});

test('weather: off switch, provider failure and timeout give null (nothing invented); 30-min cache, 2 s timeout', async () => {
  let calls = 0;
  setWeatherFetch(async () => { calls++; return reading(HOT)(); });
  process.env.WEATHER_PROVIDER = 'off';
  const store = createInitialStore();
  const off = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', q());
  assert.equal(off.data.live_weather, null);
  assert.equal(off.data.weather, null);
  assert.doesNotMatch(JSON.stringify(off.data), /°C|Hợp trời/);
  assert.equal(calls, 0);
  delete process.env.WEATHER_PROVIDER;

  setWeatherFetch(async () => { throw new Error('network blocked'); });
  assert.equal(await weatherForProfile({ lat: 11.11, lng: 106.11, location_set: true }), null);
  setWeatherFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }));
  assert.equal(await weatherForProfile({ lat: 11.12, lng: 106.12, location_set: true }), null);

  const src = fs.readFileSync('src/services/weatherProvider.js', 'utf8');
  assert.match(src, /WEATHER_TIMEOUT_MS\) \|\| 2000/);
  assert.match(src, /WEATHER_CACHE_SECONDS\) \|\| 1800/);
  process.env.WEATHER_TIMEOUT_MS = '30';
  setWeatherFetch((url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));
  const t0 = Date.now();
  assert.equal(await weatherForProfile({ lat: 11.13, lng: 106.13, location_set: true }), null);
  assert.ok(Date.now() - t0 < 1000);

  let n = 0;
  setWeatherFetch(async () => { n++; return reading(HOT)(); });
  await weatherForProfile({}); await weatherForProfile({});
  assert.equal(n, 1, 'cached for the default area');
});

// ── UI ───────────────────────────────────────────────────────────────────────
test('UI: chips map to server params only; flags on; bundle rebuilt', () => {
  const block = between('  // <core-filters>', '  // </core-filters>');
  assert.ok(fs.readFileSync('ui-design/index.html', 'utf8').includes(block), 'rebuild ui-design/index.html');
  const ctx = vm.createContext({ SOON: ' · sắp có', J: (s) => s, click() {} });
  vm.runInContext(block + ';this.SEARCH_CHIPS=SEARCH_CHIPS;this.PLACE_CHIPS=PLACE_CHIPS;this.chipLabel=chipLabel;', ctx);
  assert.equal(ctx.chipQuery(ctx.SEARCH_CHIPS, ['Dưới 55k', 'Món nước', '🚫 Ẩn Hải sản']), '&budget_max=55000&soup=true&exclude_seafood=true');
  assert.equal(ctx.chipQuery(ctx.PLACE_CHIPS, ['Máy lạnh', 'Giao hàng', 'Dưới 50k']), '&max_price=50000&has_ac=true&delivery=true');
  assert.equal(ctx.chipQuery(ctx.PLACE_CHIPS, []), '');
  assert.equal(ctx.chipLabel('Món nước ✓'), 'Món nước');
  assert.equal(ctx.chipLabel('Máy lạnh · sắp có'), 'Máy lạnh');
  const chip = ctx.collectionChip([{ name: 'Món nước buổi sáng', dish_ids: ['DISH-101', 'DISH-103'], dish_count: 2 },
    { name: 'Cuối tuần', dish_ids: ['DISH-101'], dish_count: 1 }], 'DISH-101');
  assert.equal(chip.text, 'Món nước buổi sáng · 2 món +1');
  assert.match(chip.title, /Cuối tuần/);
  assert.equal(ctx.collectionChip([], 'DISH-101'), null);
  assert.equal(ctx.placeFilterNote({ filtered_out: 3 }).startsWith('Bộ lọc đang ẩn 3 quán'), true);
  assert.equal(ctx.placeFilterNote({ filtered_out: 0 }), '');
  assert.doesNotMatch(block, /\.filter\(\(p\)|has_ac ===|links\?\./, 'no client-side place filtering');
  for (const f of ['placeFilters: true', 'searchFilters: true', 'collections: true']) assert.ok(runtime.includes(f), f);
});

test('UI weather pill names the default area; a profile reading does not', () => {
  const pill = between('  function weatherPill(w) {', '  function whyText(d) {');
  const ctx = vm.createContext({ SOON: ' · sắp có' });
  vm.runInContext(pill, ctx);
  assert.equal(ctx.weatherPill({ label: '31°C · Ít mây', emoji: '🌤️', location: { source: 'default', name: 'Biên Hòa' } }).text, '🌤️ 31°C · Ít mây · Biên Hòa');
  assert.equal(ctx.weatherPill({ label: '31°C · Ít mây', emoji: '🌤️', location: { source: 'profile', name: null } }).text, '🌤️ 31°C · Ít mây');
  assert.equal(ctx.weatherPill(null).live, false);
});
