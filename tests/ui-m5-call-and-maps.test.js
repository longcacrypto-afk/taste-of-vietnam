// M5-S04 call, M5-S03 Apple Maps, M5-S05 confirm after a call (screen map §4 row 4).
// Owner rules 26/11: original elements stay ("sắp có" when not live); no invented data,
// so a call never records a meal the user did not choose.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { handleApiRequest } from '../src/api/router.js';
import { createInitialStore } from '../src/data/seed.js';
import { buildRedirect } from '../src/services/redirectService.js';

const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const between = (a, b) => runtime.slice(runtime.indexOf(a), runtime.indexOf(b));
const methods = between('    call() {', '    exportData() {');
const helpers = between('  const chosenDish = () =>', '  function selected() {') +
  between('  function selected() {', '  function config(id)') + between('  // <m5-confirm>', '  // </m5-confirm>');

// The real call()/confirmMeal() source against the in-memory API, as the page would run it.
async function page({ dish = null, place = null } = {}) {
  const store = createInitialStore();
  const g = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', new URLSearchParams(), {});
  const headers = { authorization: `Bearer ${g.data.access_token}` };
  const api = async (path, method = 'GET', body) => {
    const url = new URL(path, 'http://local');
    const r = await handleApiRequest(store, method, '/api/v1' + url.pathname, url.searchParams, body, headers);
    // The page's fetch wrapper throws on non-2xx; mirror it.
    if (r.status >= 400) throw Object.assign(new Error(r.data.error), { status: r.status });
    return r.data;
  };
  const ctx = vm.createContext({
    window: { appState: {} }, state: { dish, place, cache: {}, order: null }, location: { href: '' },
    screens: [], messages: [], feedback: [],
  });
  Object.assign(ctx, {
    api,
    status: (m) => ctx.messages.push(m),
    goScreen: (id) => ctx.screens.push(id),
    action: async (job, done) => { try { await done(await job()); } catch (e) { ctx.messages.push('error: ' + e.message); } },
  });
  vm.runInContext(helpers + '\nvar P2 = {' + methods + '};\nP2.feedback = (...a) => feedback.push(a);', ctx);
  const sel = vm.runInContext('selected()', ctx);
  ctx.state.cache['places:' + sel] = { data: await api('/places?dish_id=' + sel) };
  const rows = async () => (await api('/orders/redirects')).items;
  const history = async () => (await api('/suggestions/history')).items;
  return { ctx, store, api, rows, history, P2: ctx.P2 };
}

test('M5-S04: each call goes through POST /orders/redirect and leaves exactly one "call" row', async () => {
  const p = await page({ dish: 'DISH-101' });
  const place = p.ctx.state.cache['places:DISH-101'].data.items[0];
  await p.P2.call();
  let rows = await p.rows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].action_type, 'call');
  assert.equal(rows[0].partner, 'phone');
  assert.equal(rows[0].place_id, place.id);
  assert.equal(rows[0].dish_id, 'DISH-101');
  assert.equal(p.ctx.location.href, 'tel:' + place.phone.replace(/\D/g, ''), 'dials the server-built tel: link');
  assert.equal(p.ctx.state.order.id, rows[0].id, 'M5-S05 gets the redirect id');
  assert.deepEqual([...p.ctx.screens], ['M5-S05']);
  await p.P2.call();
  assert.equal((await p.rows()).length, 2, 'a second call is a second row');
  // A double tap while the first request is still in flight records one call, not two.
  await Promise.all([p.P2.call(), p.P2.call()]);
  rows = await p.rows();
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.action_type === 'call'));
});

test('M5-S05: confirm-eaten works after a call and writes the chosen meal once', async () => {
  const p = await page({ dish: 'DISH-101' });
  await p.P2.call();
  await p.P2.confirmMeal();
  const [row] = await p.rows();
  assert.ok(row.confirmed_at, 'the call redirect is confirmed');
  assert.equal(row.loopback_confirmed_eaten, true);
  const h = await p.history();
  assert.equal(h.length, 1);
  assert.equal(h[0].dish_id, 'DISH-101');
  assert.equal(h[0].place_id, row.place_id);
  assert.equal(p.ctx.feedback.length, 0, 'no separate feedback fallback');
  assert.equal(p.ctx.screens.at(-1), 'M3-S07');
  await p.P2.confirmMeal();
  assert.equal((await p.history()).length, 1, 'confirming twice stays one meal');
});

test('M5-S04 opened with no dish chosen: a place-only call, never the default dish', async () => {
  const p = await page({ dish: null });
  await p.P2.call();
  const rows = await p.rows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].action_type, 'call');
  assert.equal(rows[0].dish_id, null, 'no DISH-101 fallback in the call');
  const copy = p.ctx.confirmCopy(p.ctx.state.order);
  assert.equal(copy.ready, false, 'M5-S05 button stays disabled');
  assert.match(copy.heading, /Đã ghi nhận lượt liên hệ quán/);
  assert.match(copy.text, new RegExp(rows[0].place_name));
  assert.doesNotMatch(JSON.stringify(copy), /món Phở|Phở Bò|DISH-101/, 'names no dish');
  await assert.rejects(p.api('/orders/' + rows[0].id + '/confirm-eaten', 'POST', {}), { status: 409 }, 'server also refuses');
  assert.equal((await p.history()).length, 0);
});

test('M5-S04: a refused call (bad phone) dials nothing and records nothing', async () => {
  const p = await page({ dish: 'DISH-101' });
  const place = p.store.places.find((x) => x.id === p.ctx.state.cache['places:DISH-101'].data.items[0].id);
  place.phone = '12';
  await p.P2.call();
  assert.equal(p.ctx.location.href, '');
  assert.equal(p.ctx.state.order, null);
  assert.equal((await p.rows()).length, 0);
  assert.ok(p.ctx.messages.some((m) => /^error: Invalid phone/.test(m)), 'the refusal is shown');
});

test('M5-S03: Apple Maps stays "sắp có" while the allowlist builds Google Maps only', () => {
  const place = createInitialStore().places[0];
  assert.equal(buildRedirect(place, 'apple_maps').status, 400, 'no Apple Maps partner on the server');
  assert.match(new URL(buildRedirect(place, 'maps').target_deeplink).hostname, /google\.com$/);
  assert.match(runtime, /appleMaps: false,/);
  const s03 = between('    if (id === "M5-S03") {', '    if (id === "M5-S04") {');
  assert.match(s03, /click\(google, "P2\.order\('maps'\)"\)/);
  assert.match(s03, /if \(FEATURES\.appleMaps\) click\(apple, "P2\.order\('apple_maps'\)"\);/);
  assert.match(s03, /text\(apple, apple\.textContent\.trimEnd\(\) \+ SOON\);\s*soon\(apple,/, 'kept in place, labelled and disabled');
  assert.doesNotMatch(s03, /forEach\(\(b\) => click\(b, "P2\.order\('maps'\)"\)\)/, 'Apple label no longer opens Google Maps');
  assert.doesNotMatch(s03, /\.remove\(\)/);
  const design = fs.readFileSync('ui-design/src/screens_m3_m4_m5_m8.js', 'utf8');
  assert.match(design.slice(design.indexOf("'M5-S03': {"), design.indexOf("'M5-S04': {")), / Apple Maps<\/button>/, 'original button stays');
});

test('M5-S03 directions send only a dish the user chose', () => {
  const order = between('    order(partner) {', '    call() {');
  assert.match(order, /partner==="maps"\|\|partner==="apple_maps"\?chosenDish\(\):selected\(\)/);
});
