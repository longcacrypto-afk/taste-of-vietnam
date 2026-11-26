// Owner decision 26/11 "Sửa cho đúng thực tế": in-scope copy (M1–M5, M9, desktop Live
// App) that claims more than the code does is reworded; words only. Allergy copy says what
// is filtered and asks the user to confirm with the restaurant.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadUi } from './helpers/ui.js';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { login } from './helpers/auth.js';

const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const shell = fs.readFileSync('ui-design/src/app_shell.html', 'utf8');
const block = runtime.slice(runtime.indexOf('  // <m6-wording>'), runtime.indexOf('  // </m6-wording>'));
const ctx = vm.createContext({});
vm.runInContext(block + '\nthis.kit = { allergyLine, reword, WORDING };', ctx);
const { allergyLine } = ctx.kit;
// The whole polish() text pipeline: the earlier invented-claim rules, then reword().
const chain = runtime.slice(runtime.indexOf('      const next = n.textContent') + '      const next = n.textContent'.length, runtime.indexOf(';\n      const fixed = reword(next);'));
const polishText = vm.runInContext(`(t) => t${chain}`, ctx);
const reword = (t) => ctx.kit.reword(polishText(t));

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&le;/g, '≤').replace(/&nbsp;/g, ' ');
// Text runs as the browser's text nodes see them (polish() rewrites text nodes).
const runs = (html) => decode(html).split(/<[^>]*>/).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);

const ui = loadUi();
const ALL = Object.assign({}, ui.SCREENS_M1_M2, ui.SCREENS_M3_M4_M5_M8, ui.SCREENS_WEB_M6_M7, ui.SCREENS_M9_M10_EXP);
const CORE = Object.keys(ALL).filter((id) => /^M[1-59]-/.test(id));
const IN_SCOPE_PANELS = ['today', 'explore', 'recipe', 'chat', 'wheel', 'places', 'admin', 'profile'];
const panel = (t) => {
  const i = shell.indexOf(`<div id="lpanel-${t}"`);
  const j = shell.indexOf('<!-- TAB PANEL', i + 10);
  return shell.slice(i, j);
};
// The desktop places and profile panels are filled by app_shell loaders; include those templates.
const loader = (name) => {
  const i = shell.indexOf(`function ${name}(`);
  return shell.slice(i, shell.indexOf('\n    }\n', i));
};
const desktop = [shell.slice(shell.indexOf('<div id="main-liveapp"'), shell.indexOf('<!-- TAB PANEL 1')), ...IN_SCOPE_PANELS.map(panel),
  loader('renderLivePlacesGrid'), loader('loadLiveProfile'), loader('refreshLiveSuggestions')].join('\n');

const OVERCLAIMS = [/Chặn tuyệt đối/, /chặn cứng 100%/i, /Chặn 100%/i, /Đã lọc 100%/, /0% Dị ứng/, /Cập nhật thời gian thực/,
  /600\+/, /Kiểm Duyệt Tự Động/, /^Đạt chuẩn An toàn$/, /^100% Compliant$/, /bảo mật tuyệt đối/, /Đã loại trừ hải sản/,
  /ngày mát/, /cùng chuyên gia dinh dưỡng/, /mọi quán đều được xác minh/, /Tuyệt đối không đề xuất/, /không lưu trữ bản sao/,
  /tuân thủ nghiêm ngặt/, /Tuân Thủ Nghị Định/, /chuẩn PDPD/, /Chuẩn hóa bởi AI OCR/, /đang mở cửa trong bán kính/, /\d+ đánh giá\)/, /vector 1536-dim/];

test('no over-claim survives in in-scope screens and the desktop Live App', () => {
  const texts = [...CORE.flatMap((id) => runs(ALL[id].render()).map((t) => [id, t])), ...runs(desktop).map((t) => ['desktop', t])];
  const left = [];
  for (const [where, t] of texts) {
    const out = reword(t);
    for (const re of OVERCLAIMS) if (re.test(out)) left.push(`${where}: ${out}`);
  }
  assert.deepEqual(left, []);
  // The phrases did exist before the change (the test is not vacuous).
  const before = texts.filter(([, t]) => OVERCLAIMS.some((re) => re.test(t))).length;
  assert.ok(before >= 18, `found ${before} over-claims in the templates`);
});

test('allergy copy says what is filtered and to confirm with the restaurant; never overstates', () => {
  assert.equal(allergyLine(['shrimp', 'peanut']), 'Đã lọc món có tôm/hải sản, đậu phộng theo thành phần đã ghi, hãy xác nhận lại với quán');
  assert.equal(allergyLine([]), 'Chưa khai báo dị ứng, chưa lọc món nào');
  assert.match(allergyLine(['dairy', 'egg', 'unknown_tag']), /sữa, trứng, unknown_tag/);
  for (const s of ['Mọi thành phần anh đánh dấu dưới đây sẽ bị chặn cứng 100%, kể cả trong slot Tài trợ.', 'Tuyệt đối không đề xuất món có dị ứng'])
    assert.match(reword(s), /xác nhận lại với quán/, s);
  assert.ok(chain.includes('.replace('), 'polish chain found');
  for (const [, to] of ctx.kit.WORDING) assert.doesNotMatch(String(to), /100%|tuyệt đối|chặn cứng/i, String(to));
});

test('/suggestions/today names the allergens it filtered by (desktop line binds to it)', async () => {
  const store = createInitialStore();
  const anon = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams(), {}, {});
  assert.equal(anon.status, 200);
  assert.deepEqual(anon.data.applied_allergies, store.userProfile.hard_allergies);
  for (const it of anon.data.items) assert.ok(!(it.allergen_tags || []).some((t) => anon.data.applied_allergies.includes(t)), it.dish_id);
  const again = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams(), {}, {});
  assert.equal(again.data.from_cache, true);
  assert.deepEqual(again.data.applied_allergies, store.userProfile.hard_allergies, 'cached path too');
  const u = await login(store, '0900000078');
  const mine = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams(), {}, u.headers);
  assert.deepEqual(mine.data.applied_allergies, u.user.profile.hard_allergies || []);
  assert.match(runtime, /parts\[1\] = allergyLine\(applied\)/);
});

test('bindings fixed alongside the wording: M2-S05 tip shows the dish description, M4-S05 says "Đang bán"', () => {
  assert.match(runtime, /text\(\$\("\.text-\\\\\[\\\\#334155\\\\\]",tip\),d\.description\|\|""\)/);
  assert.match(runtime, /m\.available \? "● Đang bán" : "Tạm hết"/);
  assert.doesNotMatch(runtime, /"● Còn món"/);
  // Reworded copy goes through polish(), which skips frozen previews (their design text stays).
  assert.match(runtime, /const fixed = reword\(next\);/);
});
