// M2-S08 un-save and M2-S07 step timers (screen map PR 5).
// Owner rule 26/11: no new screens, original elements stay, no invented data.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { handleApiRequest } from '../src/api/router.js';
import { createInitialStore } from '../src/data/seed.js';
import { guest } from './helpers/auth.js';

const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const helpers = runtime.slice(runtime.indexOf('  // <m2-real-data>'), runtime.indexOf('  // </m2-real-data>'));
const configSrc = runtime.slice(runtime.indexOf('  function config(id)'), runtime.indexOf('  let originalStage'));
const between = (a, b) => runtime.slice(runtime.indexOf(a), runtime.indexOf(b, runtime.indexOf(a)));
const plain = (v) => JSON.parse(JSON.stringify(v));
function load(extra = {}) {
  const ctx = vm.createContext({ window: {}, money: (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ', ...extra });
  vm.runInContext(helpers + '\n' + configSrc, ctx);
  return ctx;
}
// The page's api(): JSON body, throws on non-2xx (the product fetch wrapper does the same).
function apiFor(store, headers) {
  return async (path, method = 'GET', body) => {
    const url = new URL('/api/v1' + path, 'http://local');
    const r = await handleApiRequest(store, method, url.pathname, url.searchParams, body || {}, headers);
    if (r.status < 200 || r.status >= 300) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
    return r.data;
  };
}

test('M2-S08 un-save: DELETE removes the dish from every own collection; after reload it is gone', async () => {
  const store = createInitialStore();
  const { headers } = await guest(store);
  const api = apiFor(store, headers);
  await api('/me/collections', 'POST', { dish_id: 'DISH-101' });
  await api('/me/collections', 'POST', { dish_id: 'DISH-102' });
  const extra = (await api('/me/collections', 'POST', { name: 'Món ấm' })).collection;
  await api('/me/collections/' + extra.id + '/dishes', 'POST', { dish_id: 'DISH-101' });

  const ctx = load({ state: { cache: {} }, appState: {}, api, selected: () => 'DISH-101' });
  const [key, fetchSaved] = ctx.config('M2-S08');
  assert.equal(key, 'saved');
  const before = await fetchSaved();
  assert.deepEqual(plain(before.items.map((d) => d.id).sort()), ['DISH-101', 'DISH-102']);
  assert.equal(before.collections.length, 2, 'the screen keeps which collections hold each dish');

  const paths = plain(ctx.savedRemovals(before.collections, 'DISH-101'));
  assert.deepEqual(paths, before.collections.map((c) => '/me/collections/' + c.id + '/dishes/DISH-101'));
  for (const p of paths) await api(p, 'DELETE');

  const after = await fetchSaved(); // what P2.unsave → load("M2-S08", true) shows after reload
  assert.deepEqual(plain(after.items.map((d) => d.id)), ['DISH-102']);
  assert.equal(after.collections.length, 2, 'un-save removes the dish, never a whole collection');
  assert.ok(after.collections.every((c) => !c.dish_ids.includes('DISH-101')));
  assert.deepEqual(plain(ctx.savedRemovals(after.collections, 'DISH-101')), [], 'nothing left to remove');
  // Another user's saved list is untouched.
  const other = await guest(store);
  await apiFor(store, other.headers)('/me/collections', 'POST', { dish_id: 'DISH-101' });
  assert.deepEqual(plain((await fetchSaved()).items.map((d) => d.id)), ['DISH-102']);
});

test('M2-S08 card: original chip stays "sắp có", un-save button inside the card, list reloads', () => {
  const s08 = between('      if (id === "M2-S08") {', '    if (id === "M2-S03") {');
  assert.match(s08, /FEATURES\.collections/);
  assert.match(s08, /text\(x, "Bộ sưu tập" \+ SOON\)/);
  assert.match(s08, /off\.textContent = "Bỏ lưu";/);
  assert.match(s08, /event\.stopPropagation\(\);P2\.unsave\('\$\{J\(a\.id\)\}'\)/, 'button does not also open the dish');
  assert.match(s08, /n\.append\(off\)/);
  assert.doesNotMatch(s08, /\.remove\(\)/);
  const unsave = between('    unsave(id) {', '    timer(key) {');
  assert.match(unsave, /savedRemovals\(state\.cache\.saved\?\.data\?\.collections, id\)/);
  assert.match(unsave, /api\(path, "DELETE"\)/);
  assert.match(unsave, /delete state\.cache\.saved;\s*load\("M2-S08", true\);/, 'list is re-read from the server');
});

test('M2-S07 timer: counts down from the step duration_min, pause holds, resume continues', () => {
  const { stepTimer, timerToggle, timerLabel, timerLeft } = load();
  let t = stepTimer(5);
  assert.deepEqual(plain(t), { total: 300000, left: 300000, endsAt: null });
  assert.equal(timerLabel(t, 0), '⏱️ 05:00 · Bấm để hẹn giờ');
  t = timerToggle(t, 1000); // start
  assert.equal(timerLabel(t, 61000), '⏱️ 04:00 Đang đếm');
  assert.equal(timerLabel(t, 61500), '⏱️ 04:00 Đang đếm', 'rounds up to whole seconds');
  t = timerToggle(t, 61000); // pause
  assert.equal(t.endsAt, null);
  assert.equal(t.left, 240000);
  assert.equal(timerLabel(t, 61000), '⏱️ 04:00 Tạm dừng');
  assert.equal(timerLabel(t, 999999), '⏱️ 04:00 Tạm dừng', 'paused time does not count');
  t = timerToggle(t, 500000); // resume
  assert.equal(timerLabel(t, 530000), '⏱️ 03:30 Đang đếm');
  assert.equal(timerLeft(t, 740000), 0);
  assert.equal(timerLabel(t, 800000), '⏱️ 00:00 Hết giờ');
  t = timerToggle(t, 800000); // after the end, a tap resets to the full step time
  assert.equal(timerLabel(t, 800000), '⏱️ 05:00 · Bấm để hẹn giờ');
  for (const none of [null, undefined, 0, -3, '', 'abc', NaN]) {
    assert.equal(stepTimer(none), null, String(none));
    assert.equal(timerLabel(stepTimer(none), 0), '⏱️ Chưa có thời gian', 'no invented duration');
  }
  assert.equal(timerLabel(stepTimer(1.5), 0), '⏱️ 01:30 · Bấm để hẹn giờ');
});

test('M2-S07 every step gets the design clock with its own real duration_min', async () => {
  const store = createInitialStore();
  const { stepTimer, timerLabel } = load();
  const dish = (await handleApiRequest(store, 'GET', '/api/v1/dishes/DISH-101', new URLSearchParams())).data;
  assert.ok(dish.steps.length >= 2);
  for (const s of dish.steps) {
    const mm = String(s.duration_min).padStart(2, '0');
    assert.equal(timerLabel(stepTimer(s.duration_min), 0), '⏱️ ' + mm + ':00 · Bấm để hẹn giờ');
  }
  const s07 = between('      if (id === "M2-S07") {', '      if (id === "M3-S02") {');
  assert.match(s07, /pillTpl = \$\$\("\.flex-1 span", first\)\.find\(\(x\) => x\.textContent\.includes\("Đang đếm"\)\)/);
  assert.match(s07, /\$\("\.flex-1", n\)\?\.append\(\(pill = pillTpl\.cloneNode\(true\)\)\)/, 'steps without the clock get a copy');
  assert.match(s07, /stepTimer\(a\.duration_min\)/);
  assert.doesNotMatch(s07, /duration_min \|\| 0/, 'missing duration is not shown as 0');
  assert.match(s07, /click\(pill, `P2\.timer\('\$\{J\(key\)\}'\)`\)/);
  assert.match(s07, /soon\(pill, "Bước này chưa có thời gian nấu trong dữ liệu món\."\)/);
  assert.match(s07, /click\(root\.lastElementChild, `P2\.feedback\('eaten'\)`\)/, 'finish button unchanged');
  const timer = between('    timer(key) {', '    feedback(type');
  assert.match(timer, /state\.timers\[key\] = timerToggle\(t, Date\.now\(\)\);\s*tickTimers\(\);/);
  const loop = between('  function tickTimers() {', '  window.P2 = {');
  assert.match(loop, /if \(running\) timerLoop = setTimeout\(tickTimers, 250\);/, 'loop stops when nothing runs');
  assert.match(loop, /status\("Hết giờ: " \+ t\.label\)/);
});
