// Owner decision 26/11 ("Mở lại, xem được thiết kế"): the 54 out-of-scope screens show
// their original design as an inert "sắp có" preview behind TOV_FEATURES.frozenPreview
// (+ one flag per module). Previews make no API calls; the server is unchanged, and
// today's refusals on frozen routes are pinned here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadUi } from './helpers/ui.js';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { guest, login } from './helpers/auth.js';

const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const between = (a, b) => {
  const i = runtime.indexOf(a), j = runtime.indexOf(b, i + a.length);
  assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`);
  return runtime.slice(i, j);
};
const FLAGS = between('  const FEATURES = (window.TOV_FEATURES = {', '  });') + '\n  });';
const HELPERS = between('  // Frozen modules with real wiring would register here', '  // </m5-frozen>');

function frozenKit(overrides) {
  const ctx = vm.createContext({ window: overrides ? { TOV_FEATURES: overrides } : {} });
  vm.runInContext(`const H = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
    const SOON = " · sắp có";\n${FLAGS}\n${HELPERS}
    window.kit = { FEATURES, FROZEN_LIVE, frozenMode, frozenApi, frozenInert, frozenPreviewHtml, FROZEN_TABS, tabMode, FROZEN_LABEL };`, ctx);
  return ctx.window.kit;
}
const ui = loadUi();
const ALL = Object.assign({}, ui.SCREENS_M1_M2, ui.SCREENS_M3_M4_M5_M8, ui.SCREENS_WEB_M6_M7, ui.SCREENS_M9_M10_EXP);
const FROZEN = Object.keys(ALL).filter((id) => !/^M[1-59]-/.test(id));
const CORE = Object.keys(ALL).filter((id) => /^M[1-59]-/.test(id));

test('one switch + one flag per frozen module, all on "preview"; nothing is live', () => {
  const k = frozenKit();
  assert.equal(FROZEN.length, 54);
  assert.equal(k.FEATURES.frozenPreview, true);
  const mods = [...new Set(FROZEN.map((id) => id.split('-')[0]))].sort();
  assert.deepEqual(Object.keys(k.FEATURES.frozenModules).sort(), mods);
  for (const m of mods) assert.equal(k.FEATURES.frozenModules[m], 'preview', m);
  assert.deepEqual(Object.keys(k.FROZEN_LIVE), [], 'no module has real wiring yet');
  for (const id of FROZEN) assert.equal(k.frozenMode(id), 'preview', id);
  for (const id of CORE) assert.equal(k.frozenMode(id), 'core', id);
});

test('flipping one flag restores the old "chưa mở" block; "live" without wiring stays a preview', () => {
  const all = frozenKit({ frozenPreview: false });
  for (const id of FROZEN) assert.equal(all.frozenMode(id), 'off', id);
  for (const id of CORE) assert.equal(all.frozenMode(id), 'core', id);
  const one = frozenKit({ frozenModules: { M6: 'off', M7: 'live' } });
  assert.equal(one.frozenMode('M6-S01'), 'off');
  assert.equal(one.frozenMode('M7-S08'), 'preview', 'live needs a FROZEN_LIVE entry');
  assert.equal(one.frozenMode('M11-S01'), 'off', 'modules missing from an override default to off');
  assert.equal(one.tabMode('merchant'), 'preview');
  // goScreen and the desktop tabs fall back to the old notice when a module is off.
  const go = between('  goScreen = function (id) {', '  renderStage = function () {');
  assert.match(go, /frozenMode\(id\) === "off"\)\s*return status\("Tính năng này chưa mở trong bản hiện tại\."\)/);
  assert.match(runtime, /if \(tabMode\(tab\) === "off"\) n\.remove\(\);/);
});

test('every frozen screen renders its original design with the "sắp có" preview label', () => {
  const k = frozenKit();
  for (const id of FROZEN) {
    const original = ALL[id].render();
    const html = k.frozenPreviewHtml(id, original, ALL);
    assert.match(html, new RegExp(`^<div data-frozen-preview="${id}" data-module="${id.split('-')[0]}">`), id);
    assert.ok(html.includes(k.FROZEN_LABEL), `${id} label`);
    assert.match(html, /mẫu minh hoạ, không phải dữ liệu thật/, `${id} says sample data`);
    // The design itself is kept: every visible text run of the original is still there.
    const words = (s) => s.replace(/<[^>]+>/g, ' ').replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, ' ').split(/\s+/).filter((w) => w.length > 3);
    const after = new Set(words(html));
    const missing = words(original).filter((w) => !after.has(w));
    assert.deepEqual(missing, [], `${id} design text kept`);
  }
});

test('frozen screen controls are inert: only design navigation or the "chưa mở" notice', () => {
  const k = frozenKit();
  const allowed = /^(goScreen\('[A-Za-z0-9-]+'\)|P2\.frozenNotice\(\)|event\.preventDefault\(\);P2\.frozenNotice\(\))$/;
  for (const id of FROZEN) {
    const html = k.frozenPreviewHtml(id, ALL[id].render(), ALL);
    for (const m of html.matchAll(/\s(on[a-z]+)="([^"]*)"/gi)) {
      const [, name, v] = m;
      if (name === 'onsubmit') assert.equal(v, 'event.preventDefault();P2.frozenNotice()', id);
      else {
        assert.equal(name, 'onclick', `${id}: no ${name} handler`);
        assert.match(v, allowed, `${id}: ${v}`);
        const nav = v.match(/^goScreen\('([^']+)'\)$/);
        if (nav) assert.ok(ALL[nav[1]], `${id}: navigates to an existing screen`);
      }
    }
    assert.doesNotMatch(html, /\s(href|action|formaction)\s*=/i, `${id}: no links or form targets`);
    assert.doesNotMatch(html, /type="submit"/i, `${id}: no submit buttons`);
    for (const inp of html.match(/<input\b[^>]*>/gi) || [])
      assert.match(inp, /\sreadonly\b|\sdisabled\b|onclick="event\.preventDefault\(\);P2\.frozenNotice\(\)"/, `${id}: ${inp.slice(0, 80)}`);
    for (const t of html.match(/<(textarea|select)\b[^>]*>/gi) || []) assert.match(t, /readonly|disabled/, id);
    assert.doesNotMatch(html, /fetch\(|api\(/, id);
  }
  // Handlers that would write, pay or call an API are replaced, not kept.
  const k2 = k.frozenInert(`<button onclick="openLiveVietQrModal(500000)">x</button><a href="https://x" onclick="goScreen('M7-S08');pay()">y</a><form onsubmit="send()"><input type="checkbox" onclick="t()"><input value="a"><button type="submit">z</button></form>`, ALL);
  assert.equal(k2, `<button onclick="P2.frozenNotice()">x</button><a onclick="P2.frozenNotice()">y</a><form onsubmit="event.preventDefault();P2.frozenNotice()"><input type="checkbox" onclick="event.preventDefault();P2.frozenNotice()"><input readonly value="a"><button type="button">z</button></form>`);
});

test('preview-only data that could mislead a real user is blanked', () => {
  const k = frozenKit();
  const m6 = k.frozenPreviewHtml('M6-S01', ALL['M6-S01'].render(), ALL);
  assert.ok(ALL['M6-S01'].render().includes('phophattai.bienhoa@gmail.com'));
  assert.doesNotMatch(m6, /@gmail\.com/);
  const shell = fs.readFileSync('ui-design/src/app_shell.html', 'utf8');
  const merchant = shell.slice(shell.indexOf('<div id="lpanel-merchant"'), shell.indexOf('<!-- TAB PANEL 8'));
  assert.match(merchant, /0121000889999/);
  assert.doesNotMatch(k.frozenInert(merchant, {}), /0121000889999/, 'bank account number of the desktop VietQR box');
});

test('product UI never calls frozen APIs (payments, orders, merchant...) while not live', () => {
  const k = frozenKit();
  for (const p of ['/api/v1/payments/orders/ORD-1', '/api/v1/ads/payments/vietqr/create', '/api/v1/ads/campaigns',
    '/api/v1/merchant/overview', '/api/v1/bookings', '/api/v1/polls/POLL-701/vote', '/api/v1/vouchers',
    '/api/v1/meal-plans/weekly', '/api/v1/fridge/scan', '/api/v1/health/sync', '/api/v1/community/recipes/CREC-01/tip',
    '/api/v1/analytics/funnel', '/api/v1/enterprise/tourism-insights', '/api/v1/notifications', '/api/v1/stories',
    '/api/v1/tourism/trails', '/api/v1/translate/menu', '/api/v1/me/meal-schedule'])
    assert.ok(k.frozenApi(p), p);
  // Every path the in-scope runtime calls stays reachable.
  const used = [...new Set([...fs.readFileSync('ui-design/src/product_runtime.js', 'utf8').matchAll(/api\("(\/[a-z/-]+)/g),
    ...['admin_dish_forms.js', 'admin_place_forms.js', 'admin_rbac_audit.js', 'admin_forms.js']
      .flatMap((f) => [...fs.readFileSync('ui-design/src/' + f, 'utf8').matchAll(/["'`](\/(?:admin|me|dishes|places|auth|suggestions|orders|areas|chat)[a-z/-]*)/g)])]
    .map((m) => '/api/v1' + m[1]))];
  assert.ok(used.length > 15);
  for (const p of [...used, '/api/v1/health-check', '/api/v1/orders/redirect'])
    assert.equal(k.frozenApi(p), null, p);
  // The guard sits in the fetch wrapper; frozen desktop loaders/actions are replaced.
  const wrapper = between('  window.fetch = async function (input, init = {}) {', '  // Existing alerts are feedback');
  assert.match(wrapper, /if \(frozenApi\(u\.pathname\)\) \{[\s\S]*?throw e;/);
  const shell = fs.readFileSync('ui-design/src/app_shell.html', 'utf8');
  const tabFn = shell.slice(shell.indexOf('function setLiveAppTab(tab)'), shell.indexOf('async function initLiveApp()'));
  const frozenLoaders = [...tabFn.matchAll(/if \(tab === '(\w+)'\) (\w+)\(/g)].filter(([, t]) => k.FROZEN_TABS[t]).map((m) => m[2]);
  assert.equal(frozenLoaders.length, 11);
  for (const f of frozenLoaders) assert.ok(runtime.includes(`"${f}"`), `${f} replaced`);
  for (const f of ['voteLivePoll', 'openLiveVietQrModal', 'confirmLivePayment', 'submitLiveBooking', 'tipLiveRecipe'])
    assert.ok(runtime.includes(`"${f}"`), `${f} replaced`);
});

test('frozen API routes still refuse: anonymous 401, consumer 403 on merchant/payment/analytics (server unchanged)', async () => {
  const store = createInitialStore();
  const hit = (m, p, headers = {}) => handleApiRequest(store, m, p, new URLSearchParams(), {}, headers);
  const user = await login(store, '0900000077');
  const g = await guest(store);
  const SENSITIVE = [['POST', '/api/v1/ads/payments/vietqr/create'], ['GET', '/api/v1/payments/orders/ORD-1'],
    ['GET', '/api/v1/merchant/overview'], ['POST', '/api/v1/merchant/menu'], ['POST', '/api/v1/ads/campaigns'],
    ['GET', '/api/v1/analytics/funnel'], ['GET', '/api/v1/enterprise/tourism-insights'], ['POST', '/api/v1/notifications/batch-dispatch']];
  for (const [m, p] of SENSITIVE) {
    assert.equal((await hit(m, p)).status, 401, `${m} ${p} anonymous`);
    for (const who of [user, g]) assert.equal((await hit(m, p, who.headers)).status, 403, `${m} ${p} consumer`);
  }
  for (const [m, p] of [['POST', '/api/v1/bookings'], ['POST', '/api/v1/polls/POLL-701/vote'], ['POST', '/api/v1/fridge/scan'],
    ['POST', '/api/v1/health/sync'], ['POST', '/api/v1/community/recipes/CREC-01/tip'], ['POST', '/api/v1/tourism/passport/checkin']])
    assert.equal((await hit(m, p)).status, 401, `${m} ${p} anonymous`);
  // Known, left for the owner: frozen GET reads are public (seed data) and frozen writes accept any token.
  assert.equal((await hit('GET', '/api/v1/vouchers')).status, 200);
});

test('in-scope screens are untouched: same core binding, admin sidebar keeps frozen entries as previews', () => {
  assert.match(runtime, /Object\.entries\(ALL_SCREENS\)\.forEach\(\(\[id, scr\]\) => \{\n    if \(!\/\^M\[1-59\]-\/\.test\(id\)\) return;\n    const original = scr\.render;\n    originals\[id\] = original;/);
  const side = between('    $$("aside nav button",root).forEach(b=>{', '      const badge=b.lastElementChild;');
  assert.match(side, /frozenMode\(frozenTarget\) === "preview"/);
  assert.match(side, /\+SOON/);
  // Polish text rules (invented-claim fixes) do not rewrite frozen design text.
  assert.match(runtime, /closest\("script,style,svg,\[data-frozen-preview\]"\)/);
});
