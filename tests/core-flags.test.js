// Core UI flags switched on now that M7, M8 and M10 are live:
//   mealReminders  M1-S10 row ← GET /me/meal-schedule (M8-S04)
//   adsModeration  M9-S07     ← GET /admin/ads + POST /admin/ads/:id/moderate (pre-checks enforced)
//   adminMetrics   M9 chrome  ← /analytics/overview + /analytics/ai-performance (M10, super_admin)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { loginAdmin, loginMerchant, login } from './helpers/auth.js';
import { moderationChecks } from '../src/services/adModeration.js';

const q = (s = '') => new URLSearchParams(s);
const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const as = (store, who) => (method, path, body = {}) => {
  const [p, qs] = path.split('?');
  return handleApiRequest(store, method, p, q(qs), body, who ? who.headers : {});
};
async function withRole(store, admin, phone, role) {
  const u = await login(store, phone);
  const r = await as(store, admin)('POST', '/api/v1/admin/rbac/users', { user_id: u.user.id, role, reason: 'Kiểm thử phân quyền' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return u;
}
const served = async (store) => {
  const r = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', q());
  assert.equal(r.status, 200);
  const sp = r.data.items.filter(i => i.is_sponsored);
  assert.ok(sp.length <= 1, 'max 1 of 3 sponsored');
  for (const i of sp) assert.equal(i.badge_label, 'Tài trợ');
  return sp.map(i => i.campaign_id);
};

test('flags are on and each one reads a live endpoint', () => {
  assert.match(runtime, /mealReminders: true/);
  assert.match(runtime, /adsModeration: true/);
  assert.match(runtime, /adminMetrics: true/);
  assert.match(runtime, /api\("\/me\/meal-schedule"\)/);
  assert.match(runtime, /soft\("\/admin\/ads"\)/);
  assert.match(runtime, /soft\("\/analytics\/overview\?days=7"\)/);
  assert.match(runtime, /soft\("\/analytics\/ai-performance"\)/);
  assert.match(runtime, /P2\.moderateAd\(/);
  // Sample figures from the design are never written back by the flag-on paths.
  const block = runtime.slice(runtime.indexOf('// <core-flags>'), runtime.indexOf('  function bindAdmin('));
  assert.doesNotMatch(block, /1\.12s|94\.5%|48\.200|Bún bò Huế O Xuân/);
});

test('M1-S10 reminder row source: /me/meal-schedule returns what M8-S04 saved', async () => {
  const store = createInitialStore();
  const u = await login(store, '0911111111');
  const call = as(store, u);
  const before = await call('GET', '/api/v1/me/meal-schedule');
  assert.equal(before.status, 200);
  assert.equal(typeof before.data.max_per_day, 'number');
  const put = await call('PUT', '/api/v1/me/meal-schedule', { lunch: '11:00', dinner: '18:15', max_per_day: 1, dinner_enabled: false });
  assert.equal(put.status, 200);
  const after = await call('GET', '/api/v1/me/meal-schedule');
  assert.equal(after.data.lunch, '11:00');
  assert.equal(after.data.dinner, '18:15');
  assert.equal(after.data.dinner_enabled, false);
  assert.equal(after.data.max_per_day, 1);
  assert.equal(after.data.meal_suggestions, true);
  // Hard cap 2/day stays server-side.
  await call('PUT', '/api/v1/me/meal-schedule', { max_per_day: 9 });
  assert.equal((await call('GET', '/api/v1/me/meal-schedule')).data.max_per_day, 2);
  assert.equal((await as(store, null)('GET', '/api/v1/me/meal-schedule')).status, 401);
  // The row text is built only from those fields.
  const copy = runtime.slice(runtime.indexOf('  function reminderCopy(d) {'), runtime.indexOf('  // A core screen reads a live module'));
  const reminderCopy = new Function(copy + '; return reminderCopy;')();
  assert.deepEqual(reminderCopy(after.data), { title: 'Lịch nhắc bữa ăn (11:00)', sub: 'Tối đa 1 thông báo/ngày · trong ứng dụng' });
  assert.equal(reminderCopy({ ...after.data, max_per_day: 0, meal_suggestions: false }).title, 'Lịch nhắc bữa ăn (đang tắt)');
});

test('M9-S07 GET /admin/ads: ops/super admin only, real pre-checks, pending first', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const ops = await withRole(store, admin, '0922222222', 'ops_admin');
  const mod = await withRole(store, admin, '0933333333', 'content_moderator');
  const consumer = await login(store, '0944444444');
  assert.equal((await as(store, null)('GET', '/api/v1/admin/ads')).status, 401);
  assert.equal((await as(store, consumer)('GET', '/api/v1/admin/ads')).status, 403);
  assert.equal((await as(store, mod)('GET', '/api/v1/admin/ads')).status, 403);
  assert.equal((await as(store, ops)('GET', '/api/v1/admin/ads')).status, 200);
  const r = await as(store, admin)('GET', '/api/v1/admin/ads');
  assert.equal(r.status, 200);
  assert.equal(r.data.total, store.campaigns.length);
  assert.equal(r.data.serving_rules.max_sponsored_ratio, '1/3');
  assert.equal(r.data.is_demo, true, 'M7 demo targeting rows are flagged');
  const c701 = r.data.items.find(c => c.id === 'CMP-701');
  assert.equal(c701.ready, true);
  assert.deepEqual(c701.checks.map(c => c.key), ['sponsor_label', 'allergens_declared', 'menu_price']);
  assert.equal(c701.price_vnd, 50000);
  // CMP-702's dish is not on its place's menu: the check says so instead of passing.
  const c702 = r.data.items.find(c => c.id === 'CMP-702');
  assert.equal(c702.ready, false);
  assert.equal(c702.checks.find(c => c.key === 'menu_price').ok, false);
  assert.equal((await as(store, admin)('GET', '/api/v1/admin/ads?status=bogus')).status, 400);

  // A merchant submission shows up first, in review, with its M7 targeting.
  const m = as(store, await loginMerchant(store));
  assert.equal((await m('POST', '/api/v1/ads/campaigns/builder', { dish_id: 'DISH-101', place_id: 'PLACE-401', meal_slots: ['breakfast'], plan: 'ctx30' })).status, 200);
  const sub = await m('POST', '/api/v1/ads/campaigns/builder/submit');
  assert.equal(sub.status, 201);
  const r2 = await as(store, ops)('GET', '/api/v1/admin/ads');
  assert.equal(r2.data.items[0].id, sub.data.campaign.id);
  assert.equal(r2.data.items[0].status, 'pending_review');
  assert.deepEqual(r2.data.items[0].meal_slots, ['breakfast']);
  assert.equal(r2.data.pending_review, 1);
  const pend = await as(store, admin)('GET', '/api/v1/admin/ads?status=pending_review');
  assert.deepEqual(pend.data.items.map(c => c.id), [sub.data.campaign.id]);
});

test('M9-S07 moderate: approve only when every pre-check passes; reject/pause need a reason; audit row', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const a = as(store, admin);
  const m = as(store, await loginMerchant(store));
  await m('POST', '/api/v1/ads/campaigns/builder', { dish_id: 'DISH-101', place_id: 'PLACE-401', meal_slots: ['lunch'], plan: 'ctx30' });
  const id = (await m('POST', '/api/v1/ads/campaigns/builder/submit')).data.campaign.id;
  assert.ok(!(await served(store)).includes(id), 'pending never served');

  assert.equal((await a('POST', `/api/v1/admin/ads/${id}/moderate`, { decision: 'rejected' })).status, 400, 'reason required');
  assert.equal((await a('POST', `/api/v1/admin/ads/${id}/moderate`, { decision: 'deleted', reason: 'x' })).status, 400);
  assert.equal((await a('POST', '/api/v1/admin/ads/NOPE/moderate', { decision: 'active', reason: 'x' })).status, 404);

  // Break a pre-check: an un-labelled campaign cannot be approved, status unchanged.
  const row = store.campaigns.find(c => c.id === id);
  row.badge_label = 'Quảng cáo';
  const no = await a('POST', `/api/v1/admin/ads/${id}/moderate`, { decision: 'active', reason: 'Duyệt' });
  assert.equal(no.status, 409);
  assert.ok(no.data.checks.some(c => c.key === 'sponsor_label' && !c.ok));
  assert.equal(row.status, 'pending_review');
  row.badge_label = 'Tài trợ';

  const rej = await a('POST', `/api/v1/admin/ads/${id}/moderate`, { decision: 'rejected', reason: 'Ảnh không đúng món' });
  assert.equal(rej.status, 200);
  assert.equal(row.status, 'rejected');
  const ok = await a('POST', `/api/v1/admin/ads/${id}/moderate`, { decision: 'active', reason: 'Đã sửa ảnh, đạt tiêu chí' });
  assert.equal(ok.status, 200);
  assert.equal(row.status, 'active');
  const audit = await a('GET', '/api/v1/admin/audit-logs?limit=5');
  assert.ok(audit.data.items.some(x => x.action === 'MODERATE_AD' && x.target === id));
  // Ops admin may moderate; content moderator may not.
  const ops = await withRole(store, admin, '0922222222', 'ops_admin');
  const mod = await withRole(store, admin, '0933333333', 'content_moderator');
  assert.equal((await as(store, mod)('POST', `/api/v1/admin/ads/${id}/moderate`, { decision: 'paused', reason: 'x' })).status, 403);
  assert.equal((await as(store, ops)('POST', `/api/v1/admin/ads/${id}/moderate`, { decision: 'paused', reason: 'Tạm dừng kiểm tra' })).status, 200);
  assert.ok(!(await served(store)).includes(id), 'paused never served');
});

test('moderationChecks: computed from stored data only', () => {
  const dish = { id: 'D', allergen_tags: ['shrimp'], spice_level: 2 };
  const place = { id: 'P', menu: [{ dish_id: 'D', price: 45000 }] };
  const ok = moderationChecks({ dish_id: 'D', badge_label: 'Tài trợ' }, dish, place);
  assert.equal(ok.ready, true);
  assert.match(ok.checks[1].label, /tôm/);
  assert.equal(ok.price_vnd, 45000);
  assert.equal(moderationChecks({ dish_id: 'D', badge_label: 'Tài trợ' }, { ...dish, allergen_tags: undefined }, place).ready, false);
  assert.equal(moderationChecks({ dish_id: 'D', badge_label: 'Tài trợ' }, { ...dish, spice_level: null }, place).ready, false);
  assert.equal(moderationChecks({ dish_id: 'D', badge_label: 'Tài trợ' }, dish, { menu: [] }).ready, false);
  assert.equal(moderationChecks({ dish_id: 'D', badge_label: 'Tài trợ' }, null, place).ready, false);
});

test('M9 admin metrics: super_admin reads p95 / NLU / safety from M10; run history feeds the trend', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const a = as(store, admin);
  const ov = await a('GET', '/api/v1/analytics/overview?days=7');
  assert.equal(ov.status, 200);
  assert.ok('p95_ms' in ov.data.suggestion_latency && 'samples' in ov.data.suggestion_latency);
  const ai = await a('GET', '/api/v1/analytics/ai-performance');
  assert.equal(ai.status, 200);
  assert.equal(typeof ai.data.nlu.accuracy_pct, 'number');
  assert.equal(typeof ai.data.safety.items, 'number');
  assert.equal(ai.data.safety.allergy_violations, 0, 'allergy hard filter holds in the audit');
  assert.ok(Array.isArray(ai.data.history) && ai.data.history.length >= 1);
  await a('POST', '/api/v1/analytics/ai-performance/run');
  const ai2 = await a('GET', '/api/v1/analytics/ai-performance');
  assert.equal(ai2.data.history.length, ai.data.history.length + 1);
  assert.ok(ai2.data.history.every((h, i, l) => !i || Date.parse(l[i - 1].ran_at) <= Date.parse(h.ran_at)), 'oldest → newest');
  // Other admin roles do not get analytics; the UI shows "chỉ Super Admin xem được" for them.
  const ops = await withRole(store, admin, '0922222222', 'ops_admin');
  assert.equal((await as(store, ops)('GET', '/api/v1/analytics/overview')).status, 403);
  assert.match(runtime, /chỉ Super Admin xem được/);
});
