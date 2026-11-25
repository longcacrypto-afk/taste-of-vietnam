// Loads the UI helper script + screen templates into a VM "window" (no browser needed)
import fs from 'node:fs';
import vm from 'node:vm';

const src = (f) => fs.readFileSync(new URL(`../../ui-design/src/${f}`, import.meta.url), 'utf8');

/** Loads the first <script> of app_shell (helpers) + ui_kit + screens into a sandbox window. */
export function loadUi(appState = {}) {
  const shell = src('app_shell.html');
  const helpers = shell.slice(shell.indexOf('window.appState = {'), shell.indexOf('// ===== Auth client (P0) ====='));
  // like a browser: `window` is the global object, so window.escHtml is also bare `escHtml`
  const ctx = vm.createContext({ appState: {}, fetch: async () => ({}), location: { href: 'http://x/' }, document: { querySelectorAll: () => [] }, console, URL, Headers: class {}, Request: class {} });
  ctx.window = ctx;
  const window = ctx;
  vm.runInContext(helpers, ctx);
  Object.assign(window.appState, appState);
  for (const f of ['ui_kit.js', 'screens_m1_m2.js', 'screens_m3_m4_m5_m8.js', 'screens_web_m6_m7.js', 'screens_m9_m10_expansion.js']) {
    vm.runInContext(src(f), ctx, { filename: f });
  }
  return window;
}

