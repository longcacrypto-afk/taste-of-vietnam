// P0: UI screen templates rendered in a VM with real API data
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';

const src = (f) => fs.readFileSync(new URL(`../ui-design/src/${f}`, import.meta.url), 'utf8');

/** Loads the first <script> of app_shell (helpers) + ui_kit + screens into a sandbox window. */
export function loadUi(appState = {}) {
  const shell = src('app_shell.html');
  const helpers = shell.slice(shell.indexOf('window.appState = {'), shell.indexOf('// ===== Auth client (P0) ====='));
  const window = { appState: {}, fetch: async () => ({}), location: { href: 'http://x/' } };
  const ctx = vm.createContext({ window, document: { querySelectorAll: () => [] }, console, URL, Headers: class {}, Request: class {} });
  vm.runInContext(helpers, ctx);
  Object.assign(window.appState, appState);
  for (const f of ['ui_kit.js', 'screens_m1_m2.js', 'screens_m3_m4_m5_m8.js', 'screens_web_m6_m7.js', 'screens_m9_m10_expansion.js']) {
    vm.runInContext(src(f), ctx, { filename: f });
  }
  return window;
}

test('/app M3-S01 shows the 3 dish names and prices returned by GET /suggestions/today (no "undefined")', async () => {
  const store = createInitialStore();
  const today = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  const win = loadUi({ liveToday: today.data });
  const html = win.SCREENS_M3_M4_M5_M8['M3-S01'].render();
  assert.ok(!html.includes('>undefined<'), 'no undefined dish names');
  for (const item of today.data.items) {
    assert.ok(html.includes(item.name), `card shows ${item.name}`);
    assert.ok(html.includes(Number(item.price_vnd).toLocaleString('vi-VN')), `card shows price of ${item.name}`);
  }
});
