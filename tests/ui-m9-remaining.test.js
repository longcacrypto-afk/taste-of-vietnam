// fix/m9-remaining. M9-S07 "Kiểm duyệt Ads M7" reviews campaigns of the frozen M7 module:
// it is shown like the M7 screens (inert "sắp có" design preview, no API calls) until
// TOV_FEATURES.adsModeration is on. M9-S02 "Vector DB" reads has_embedding from the
// dashboard response, which the server fills from storage (false until a vector exists).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadUi } from './helpers/ui.js';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { loginAdmin, login } from './helpers/auth.js';
import { getRepository } from '../src/db/repository.js';

const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const between = (a, b) => {
  const i = runtime.indexOf(a), j = runtime.indexOf(b, i + a.length);
  assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`);
  return runtime.slice(i, j);
};
const FLAGS = between('  const FEATURES = (window.TOV_FEATURES = {', '  });') + '\n  });';
const HELPERS = between('  // Frozen modules with real wiring would register here', '  // </m5-frozen>');
const CONFIG = between('  function config(id) {', '  let originalStage');
const LOAD = between('  async function load(id, force = false) {', '  async function loadAreas(');
const GO = between('  goScreen = function (id) {', '  renderStage = function () {');
const WRAP = between('  window.P2.frozenNotice =', '  function widenPreview(id) {');
const ui = loadUi();
const ALL = Object.assign({}, ui.SCREENS_M1_M2, ui.SCREENS_M3_M4_M5_M8, ui.SCREENS_WEB_M6_M7, ui.SCREENS_M9_M10_EXP);
const plain = (v) => JSON.parse(JSON.stringify(v));

// The runtime's own frozen helpers, config(), load(), goScreen() and render wrappers in a VM,
// with every API call recorded. Only DOM painting is stubbed.
function runtimeKit(overrides, apiImpl) {
  const calls = [], went = [], notices = [];
  const screens = Object.fromEntries(['M9-S01', 'M9-S02', 'M9-S07', 'M7-S01'].map((id) => [id, { ...ALL[id] }]));
  const ctx = vm.createContext({
    window: overrides ? { TOV_FEATURES: overrides, P2: {} } : { P2: {} },
    appState: { activeScreenId: 'M9-S07', servings: 2 }, state: { cache: {}, query: '', region: '', meal: '' },
    ALL_SCREENS: screens, calls, went, notices, originals: {}, AUDIT_ROLES: ['super_admin', 'auditor'],
    api: async (p, m = 'GET') => { calls.push(m + ' ' + p); return apiImpl ? apiImpl(p, m) : {}; },
    originalGo: (id) => went.push(id), status: (t) => notices.push(t),
    paint() {}, polish() {}, widenPreview() {}, loadAreas() {}, desktopWeather() {}, $: () => null,
    vnDays: () => [], selected: () => 'DISH-101', REGIONS: ['bac', 'trung', 'nam'],
    stateHtml: (id, s) => `<state ${id} ${s}>`, mobile: (id, html) => `<bound ${id}>`,
  });
  vm.runInContext(`const H = (s) => String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
    const SOON = " · sắp có";\n${FLAGS}\n${HELPERS}\n${CONFIG}\n${LOAD}\nvar goScreen;\n${GO}\n${WRAP}
    window.kit = { FEATURES, frozenMode, frozenPreviewHtml, FROZEN_LABEL, config, load, goScreen, P2: window.P2 };`, ctx);
  return { ...ctx.window.kit, ctx, calls, went, notices, screens };
}

test('M9-S07 follows the frozen M7 flag: preview by default, core only when adsModeration is on', () => {
  assert.equal(runtimeKit().frozenMode('M9-S07'), 'preview');
  assert.equal(runtimeKit({ frozenModules: { M7: 'off' } }).frozenMode('M9-S07'), 'off', 'same switch as M7');
  assert.equal(runtimeKit({ frozenPreview: false }).frozenMode('M9-S07'), 'off');
  assert.equal(runtimeKit({ frozenModules: { M7: 'live' } }).frozenMode('M9-S07'), 'preview', 'live needs FROZEN_LIVE.M7');
  assert.equal(runtimeKit({ adsModeration: true }).frozenMode('M9-S07'), 'core', 'real moderation → normal admin screen');
  for (const id of ['M9-S01', 'M9-S02', 'M9-S04', 'M9-S06', 'M9-S08']) assert.equal(runtimeKit().frozenMode(id), 'core', id);
});

test('M9-S07 renders its original design with the preview label; the approve button is inert', () => {
  const k = runtimeKit();
  const html = k.screens['M9-S07'].render();
  assert.match(html, /^<div data-frozen-preview="M9-S07" data-module="M9">/);
  assert.ok(html.includes(k.FROZEN_LABEL), 'label "Bản xem trước thiết kế · sắp có"');
  assert.match(html, /mẫu minh hoạ, không phải dữ liệu thật/);
  // Original elements kept (owner rule), but the sample campaign is labelled and nothing runs.
  assert.match(html, /Chiến dịch: Bún bò Huế O Xuân/);
  const approve = html.match(/<button\b[^>]*>✓ Phê duyệt cho phép chạy<\/button>/)?.[0];
  assert.ok(approve, 'approve button kept');
  assert.match(approve, /^<button(?![^>]*\sonclick=(?!"P2\.frozenNotice\(\)"))[^>]*>/, 'no handler but the "chưa mở" notice');
  assert.doesNotMatch(html, /fetch\(|api\(/);
  assert.equal(k.ctx.originals['M9-S07'], undefined, 'not bound to admin data');
  assert.equal(k.screens['M9-S02'].render(), '<state M9-S02 loading>', 'other M9 screens keep the core binding');
});

test('opening M9-S07 makes 0 API calls (M9-S01 still loads the dashboard)', async () => {
  const k = runtimeKit();
  k.goScreen('M9-S07');
  await k.load('M9-S07', true);
  assert.deepEqual(plain(k.went), ['M9-S07'], 'design preview is shown');
  assert.deepEqual(plain(k.calls), [], 'no API call for the preview');
  assert.equal(k.config('M9-S07')?.[0], 'admin', 'config unchanged; load() refuses previews');
  // Control: the same harness does load data for a real admin screen.
  k.ctx.appState.activeScreenId = 'M9-S01';
  k.goScreen('M9-S01');
  await new Promise((r) => setImmediate(r));
  assert.ok(k.calls.includes('GET /admin/dashboard'), JSON.stringify(k.calls));
  // M7 preview switched off: the old "chưa mở" notice, still no call.
  const off = runtimeKit({ frozenModules: { M7: 'off' } });
  off.goScreen('M9-S07');
  assert.deepEqual(plain(off.calls), []);
  assert.deepEqual(plain(off.notices), ['Tính năng này chưa mở trong bản hiện tại.']);
});

test('M9 sidebar and M9-S01 card keep the M9-S07 entry; it opens the preview instead of being removed', () => {
  const side = between('    $$("aside nav button",root).forEach(b=>{', '      const badge=b.lastElementChild;');
  assert.match(side, /frozenTarget && frozenMode\(frozenTarget\) === "preview"/, 'M9-S07 matches the frozen-entry branch');
  const s01 = between('    if(id==="M9-S01") {', '    if(id==="M9-S02") {');
  assert.match(s01, /if\(frozenMode\("M9-S07"\)==="preview"\)\{n\.title=FROZEN_LABEL;n\.style\.opacity="0\.75";\}\s*else soon\(n,"Kiểm duyệt quảng cáo chưa mở\."\);/);
  assert.match(s01, /"Chưa mở \(M7 đang đóng băng\)"/);
});

test('M9-S02: dashboard catalog carries has_embedding from storage (false: no vectors yet)', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const dash = () => handleApiRequest(store, 'GET', '/api/v1/admin/dashboard', new URLSearchParams(), {}, admin.headers);
  const r = await dash();
  assert.equal(r.status, 200);
  assert.ok(r.data.catalog.length > 0);
  for (const d of r.data.catalog) assert.equal(d.has_embedding, false, d.id);
  // The flag is the storage answer, not a constant.
  getRepository(store).listEmbeddedDishIds = async () => ['DISH-101'];
  const r2 = await dash();
  assert.deepEqual(r2.data.catalog.filter((d) => d.has_embedding).map((d) => d.id), ['DISH-101']);
  assert.ok(r2.data.catalog.filter((d) => d.id !== 'DISH-101').every((d) => d.has_embedding === false));
  // Public dish API is unchanged.
  const pub = await handleApiRequest(store, 'GET', '/api/v1/dishes/DISH-101', new URLSearchParams(), {}, admin.headers);
  assert.equal(pub.status, 200);
  assert.equal('has_embedding' in pub.data, false);
  // A role without the catalogue still gets none.
  const ops = await login(store, '0900000088');
  await getRepository(store).assignRole(ops.user.id, 'ops_admin');
  const r3 = await handleApiRequest(store, 'GET', '/api/v1/admin/dashboard', new URLSearchParams(), {}, ops.headers);
  assert.deepEqual(plain(r3.data.catalog), []);
});

test('M9-S02 loader passes has_embedding from the response through to the "Vector DB" cell', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  getRepository(store).listEmbeddedDishIds = async () => ['DISH-102'];
  const k = runtimeKit(undefined, async (p) =>
    (await handleApiRequest(store, 'GET', '/api/v1' + p.split('?')[0], new URLSearchParams(p.split('?')[1] || ''), {}, admin.headers)).data);
  const data = await k.config('M9-S02')[1]();
  assert.equal(data.catalog.find((d) => d.id === 'DISH-102').has_embedding, true);
  assert.equal(data.catalog.find((d) => d.id === 'DISH-101').has_embedding, false);
  const cell = between('    if(id==="M9-S02") {', '    if(id==="M9-S03") {');
  assert.match(cell, /if\(a\.has_embedding===true\) text\(cells\[4\],"pgvector ✔"\);/);
  assert.match(cell, /text\(cells\[4\],"Chưa có vector"\+SOON\)/);
});
