// Owner rule 26/11: every original element stays in place; what is not live is shown
// as "sắp có" behind a TOV_FEATURES flag or a data hook. This covers the removals
// that predated milestone 2 (M1-S01, M2-S02, M2-S08, M3-S01, M4-S02, M5-S02, M9-S02,
// desktop login fields) and the seeded desktop weather.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const between = (a, b) => {
  const i = runtime.indexOf(a), j = runtime.indexOf(b, i + a.length);
  assert.ok(i >= 0 && j > i, `markers ${a} / ${b}`);
  return runtime.slice(i, j);
};
const flags = () => {
  const block = between('  const FEATURES = (window.TOV_FEATURES = {', '  });');
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(block + '\n  });', ctx);
  return JSON.parse(JSON.stringify(ctx.window.TOV_FEATURES));
};

test('every restored element has a named flag, off by default (partners mirror the server allowlist)', () => {
  const f = flags();
  for (const k of ['phoneLogin', 'zaloLogin', 'appleLogin']) assert.equal(f[k], false, k);
  // core-filters: these three are live now (server-side filters / real collection counts).
  for (const k of ['placeFilters', 'searchFilters', 'collections']) assert.equal(f[k], true, k);
  const allow = fs.readFileSync('src/services/redirectService.js', 'utf8');
  const serverPartners = [...allow.matchAll(/\['(\w+)', \[/g)].map((m) => m[1]).sort();
  assert.deepEqual([...f.orderPartners].sort(), serverPartners, 'M5-S02 live rows = redirect allowlist');
});

test('M1-S01: phone card, Zalo and Apple stay; no sample phone number', () => {
  const m1 = between('    if (id === "M1-S01") {', '    const choices = ');
  assert.doesNotMatch(m1, /\.remove\(\)/);
  assert.doesNotMatch(m1, /grid-cols-1/, 'social row keeps its 3 columns');
  assert.match(m1, /FEATURES\.phoneLogin/);
  assert.match(m1, /setAttribute\("value",""\)/, 'sample 0912 345 678 is cleared');
  assert.match(m1, /zaloLogin.*appleLogin/s);
});

test('desktop login card keeps its phone/OTP fields, disabled', () => {
  const block = between('  TOV_AUTH.renderLoginRequired = function', '  window.P2 = {');
  assert.doesNotMatch(block, /forEach\(n=>n\.remove\(\)\)/);
  assert.match(block, /FEATURES\.phoneLogin/);
  assert.match(block, /send\.textContent = "Gửi mã OTP" \+ SOON/);
});

test('M2-S02 filter row, M2-S08 collection chip and M9-S02 Vector DB column stay', () => {
  const m2s02 = between('      if (id === "M2-S02") {', '      if (id === "M2-S08") {');
  assert.doesNotMatch(m2s02, /children\[2\]\.remove\(\)/);
  assert.match(m2s02, /FEATURES\.searchFilters/);
  assert.match(m2s02, /chipLabel\(chip\.textContent\) \+ SOON/, 'flag off: no ✓, nothing is applied');
  const m2s08 = between('      if (id === "M2-S08") {', '    if (id === "M2-S03") {');
  assert.doesNotMatch(m2s08, /x\.remove\(\)/);
  assert.match(m2s08, /FEATURES\.collections/);
  const m9s02 = between('    if(id==="M9-S02") {', '    if(id==="M9-S03") {');
  assert.doesNotMatch(m9s02, /lastElementChild\?\.remove\(\)|cells\[4\]\?\.remove\(\)/);
  assert.match(m9s02, /a\.has_embedding===true/, 'vector status only from real data');
});

test('M3-S01 keeps design slots as empty placeholders; heading count is real', () => {
  const m3 = between('    if (id === "M3-S01") {', '    if (["M2-S01", "M2-S02", "M2-S08"].includes(id)) {');
  assert.doesNotMatch(m3, /node\.remove\(\)|third\.remove\(\)/);
  assert.match(m3, /emptySlot\(node, "Chưa có thêm món phù hợp"\)/);
  assert.match(m3, /emptySlot\(third, "Chưa có gợi ý thứ ba"\)/);
  assert.match(m3, /items\.length \+ " món AI\)"/);
  const slot = between('  function emptySlot(node, title) {', '  const WEATHER_SOON');
  assert.match(slot, /removeAttribute\("onclick"\)/);
  assert.doesNotMatch(slot, /\d{2}\.000đ|kcal"\)\s*;?\s*$/m, 'no invented price or kcal');
});

test('M5-S02 keeps every partner row; rows without a link or allowlist are "sắp có"', () => {
  const m5 = between('    if (id === "M5-S02") {', '    if (id === "M5-S03") {');
  assert.doesNotMatch(m5, /n\.remove\(\)/);
  assert.match(m5, /FEATURES\.orderPartners\.includes\(partner\)/);
  assert.match(m5, /beFood: "befood", "Xanh SM Ngon": "xanhsm"/);
});

test('M4-S02 quick card is bound to the real place (no sample "Cách 400m · Đang mở")', () => {
  const m4 = between('    if (id === "M4-S02") {', '    if (id === "M4-S03") {');
  assert.match(m4, /placeLine\(place\)/);
  assert.match(m4, /P2\.place\('\$\{J\(place\.id\)\}'\)/);
});

test('desktop weather badge and "Cá nhân hóa theo thời tiết" use only the live_weather hook', () => {
  const w = between('  const WEATHER_SOON = ', '  // </m4-restore>');
  assert.match(w, /appState\.liveToday\?\.live_weather/);
  assert.doesNotMatch(w, /26°C|dịu mát/);
  assert.match(runtime, /new MutationObserver\(\(\) => desktopWeather\(\)\)/, 'seeded label written by the shell is replaced');
  assert.match(runtime, /Hôm nay Biên Hòa 26°C trời mát lành, em\/g, "Em"/);
});
