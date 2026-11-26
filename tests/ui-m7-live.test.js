// m7 (audit milestone 4): real weather (Open-Meteo behind src/services/weatherProvider.js)
// and a real map (vendored Leaflet + OpenStreetMap tiles) inside the original frames of
// M4-S02 and M5-S03. No test touches the network: the provider fetch is injected.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { handleApiRequest } from '../src/api/router.js';
import { createInitialStore } from '../src/data/seed.js';
import { currentWeather, setWeatherFetch, parseOpenMeteo, weatherCondition } from '../src/services/weatherProvider.js';

const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const between = (a, b) => {
  const i = runtime.indexOf(a), j = runtime.indexOf(b, i + a.length);
  assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`);
  return runtime.slice(i, j);
};
const ok = (current) => async () => ({ ok: true, json: async () => ({ current }) });
const HOT = { time: '2026-11-26T05:45', temperature_2m: 31.6, weather_code: 0 };
const RAIN = { time: '2026-11-26T05:45', temperature_2m: 23.2, weather_code: 63 };

test.afterEach(() => { setWeatherFetch(null); delete process.env.WEATHER_PROVIDER; delete process.env.WEATHER_TIMEOUT_MS; });

test('no seeded weather is left in the store or the API', async () => {
  const store = createInitialStore();
  assert.equal(store.weather, undefined);
  assert.doesNotMatch(fs.readFileSync('src/data/seed.js', 'utf8'), /26°C|temp_c: 26|condition: 'rain_cool'/);
  const r = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  assert.equal(r.status, 200);
  assert.equal(r.data.weather, null);
  assert.equal(r.data.live_weather, null);
  assert.doesNotMatch(JSON.stringify(r.data), /°C|Trời dịu mát|Hợp trời/);
});

test('parseOpenMeteo: real reading → label/emoji/condition; unusable payload → null', () => {
  const w = parseOpenMeteo({ current: HOT });
  assert.equal(w.temp_c, 32);
  assert.equal(w.label, '32°C · Trời quang');
  assert.equal(w.emoji, '☀️');
  assert.equal(w.condition, 'hot_sunny');
  assert.equal(w.source, 'Open-Meteo');
  assert.equal(w.observed_at, '2026-11-26T05:45:00.000Z');
  assert.equal(parseOpenMeteo({ current: RAIN }).condition, 'rain_cool');
  assert.equal(weatherCondition(27, 3), 'mild');
  for (const bad of [null, {}, { current: {} }, { current: { temperature_2m: null, weather_code: 0 } }, { current: { temperature_2m: 'x', weather_code: 1 } }])
    assert.equal(parseOpenMeteo(bad), null);
});

test('currentWeather: injected fetch, coordinates in the URL, cached per ~1 km', async () => {
  const urls = [];
  setWeatherFetch(async (url) => { urls.push(url); return ok(HOT)(); });
  const a = await currentWeather({ lat: 10.9574, lng: 106.8426 });
  const b = await currentWeather({ lat: 10.9581, lng: 106.8431 });
  assert.equal(a.label, '32°C · Trời quang');
  assert.deepEqual(a, b);
  assert.equal(urls.length, 1, 'second call inside the cache window does not refetch');
  assert.match(urls[0], /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=10\.96&longitude=106\.84&current=temperature_2m,weather_code$/);
});

test('currentWeather fallback: off switch, bad coordinates, HTTP error, bad JSON, timeout → null (never a number)', async () => {
  let calls = 0;
  setWeatherFetch(async () => { calls++; return ok(HOT)(); });
  process.env.WEATHER_PROVIDER = 'off';
  assert.equal(await currentWeather({ lat: 10, lng: 106 }), null);
  delete process.env.WEATHER_PROVIDER;
  for (const pos of [{}, { lat: null, lng: 106 }, { lat: 'x', lng: 1 }, { lat: 95, lng: 1 }]) assert.equal(await currentWeather(pos), null);
  assert.equal(calls, 0);
  setWeatherFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
  assert.equal(await currentWeather({ lat: 1, lng: 1 }), null);
  setWeatherFetch(async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } }));
  assert.equal(await currentWeather({ lat: 2, lng: 2 }), null);
  setWeatherFetch(async () => { throw new Error('network down'); });
  assert.equal(await currentWeather({ lat: 3, lng: 3 }), null);
  process.env.WEATHER_TIMEOUT_MS = '30';
  setWeatherFetch((url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))));
  const t0 = Date.now();
  assert.equal(await currentWeather({ lat: 4, lng: 4 }), null);
  assert.ok(Date.now() - t0 < 1000, 'timeout is honoured');
});

test('under the test runner the real network is never used without an injected fetch', async () => {
  const real = globalThis.fetch;
  let touched = false;
  globalThis.fetch = async () => { touched = true; throw new Error('no network in tests'); };
  try {
    assert.equal(await currentWeather({ lat: 10.5, lng: 106.5 }), null);
    assert.equal(touched, false);
  } finally { globalThis.fetch = real; }
});

test('/suggestions/today: the reading (and only it) drives weather, ranking bonus and reason', async () => {
  const seen = [];
  setWeatherFetch(async (url) => { seen.push(url); return ok(HOT)(); });
  const store = createInitialStore();
  const r = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  assert.equal(r.status, 200);
  assert.equal(r.data.live_weather.label, '32°C · Trời quang');
  assert.deepEqual(r.data.weather, r.data.live_weather);
  assert.match(seen[0], /latitude=10\.96&longitude=106\.84/, 'keyed to the profile location the area picker/GPS saved');
  for (const item of r.data.items) {
    const dish = store.dishes.find((d) => d.id === item.dish_id);
    const fits = (dish.weather_fit || []).includes('hot_sunny');
    assert.equal(/Hợp trời hiện tại \(32°C, Trời quang\)/.test(item.reason), fits, item.dish_id);
  }
  const spin = await handleApiRequest(store, 'GET', '/api/v1/suggestions/spin', new URLSearchParams());
  assert.equal(spin.status, 200);
});

test('/places returns the search centre used, for the map', async () => {
  const store = createInitialStore();
  const r = await handleApiRequest(store, 'GET', '/api/v1/places', new URLSearchParams('dish_id=DISH-101'));
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.center, { lat: store.userProfile.lat, lng: store.userProfile.lng, radius_m: store.userProfile.radius_m });
  const q = await handleApiRequest(store, 'GET', '/api/v1/places', new URLSearchParams('lat=10.9&lng=106.8&radius=1500'));
  assert.deepEqual(q.data.center, { lat: 10.9, lng: 106.8, radius_m: 1500 });
  assert.ok(r.data.items.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)));
});

test('UI weather: reading shown with its own emoji; no reading keeps the "sắp có" chip', () => {
  const pill = between('  function weatherPill(w) {', '  function whyText(d) {');
  const ctx = vm.createContext({ SOON: ' · sắp có' });
  vm.runInContext(pill, ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.weatherPill({ label: '23°C · Có mưa', emoji: '🌧️' }))), { text: '🌧️ 23°C · Có mưa', live: true });
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.weatherPill(null))), { text: '🌤️ Thời tiết · sắp có', live: false });
  const desk = between('  function desktopWeather() {', '  // </m4-restore>');
  assert.match(desk, /replace\(\/ · \/g, ", "\)/, 'the " · " separated desktop line stays idempotent');
});

test('UI map: Leaflet is vendored, behind TOV_FEATURES.liveMap, pins only from real coordinates', () => {
  for (const f of ['leaflet.js', 'leaflet.css', 'LICENSE', 'images/marker-icon.png'])
    assert.ok(fs.existsSync('ui-design/assets/leaflet/' + f), f);
  assert.match(fs.readFileSync('ui-design/assets/leaflet/leaflet.js', 'utf8').slice(0, 200), /Leaflet 1\.9\.4/);
  assert.match(runtime, /liveMap: true,/);
  const block = between('  // <m7-live>', '  // </m7-live>');
  assert.ok(fs.readFileSync('ui-design/index.html', 'utf8').includes(block), 'rebuild ui-design/index.html');
  assert.match(block, /openstreetmap\.org\/copyright/, 'OSM attribution');
  assert.match(block, /"\/assets\/leaflet\/leaflet\.js"/, 'served from the repo, no CDN');
  assert.match(block, /function mapFallback/);
  assert.match(block, /tileerror/);
  const ctx = vm.createContext({ FEATURES: {} });
  vm.runInContext(between('  const coord = ', '  let leafletPromise'), ctx);
  const spec = ctx.mapSpec({ lat: 10.95, lng: 106.84, radius_m: 3000 }, [
    { id: 'a', lat: 10.96, lng: 106.85 }, { id: 'b', lat: null, lng: 106.8 }, { id: 'c' }, { id: 'd', lat: 99, lng: 1 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(spec)), { center: { lat: 10.95, lng: 106.84, radius_m: 3000 }, pins: [{ id: 'a', lat: 10.96, lng: 106.85 }] });
  assert.equal(ctx.mapSpec(null, [{ id: 'b', lat: null, lng: null }]), null, 'no real coordinates → no map, frame unchanged');
});

test('UI map only mounts in M4-S02 and M5-S03; frozen previews never get a live map', () => {
  const sets = [...runtime.matchAll(/dataset\.liveMap = /g)].map((m) => m.index);
  assert.equal(sets.length, 2);
  const m4 = runtime.indexOf('    if (id === "M4-S02") {'), m43 = runtime.indexOf('    if (id === "M4-S03") {');
  const m5 = runtime.indexOf('    if (id === "M5-S03") {'), m54 = runtime.indexOf('    if (id === "M5-S04") {');
  assert.ok(sets[0] > m4 && sets[0] < m43, 'M4-S02');
  assert.ok(sets[1] > m5 && sets[1] < m54, 'M5-S03');
  for (const f of ['screens_web_m6_m7.js', 'screens_m3_m4_m5_m8.js', 'screens_m9_m10_expansion.js'])
    assert.doesNotMatch(fs.readFileSync('ui-design/src/' + f, 'utf8'), /data-live-map/, f + ' design files untouched');
});
