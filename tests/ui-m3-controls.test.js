// Small controls inside existing screens (owner decision 26/11): M1-S08 area picker,
// M1-S10 consent switch, M9-S01 activity chart, M9-S08 roles, M9-S09 audit filters.
// Owner rule 26/11: original elements stay; not-live ones show "sắp có".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { handleApiRequest } from '../src/api/router.js';
import { createInitialStore } from '../src/data/seed.js';
import { areasFromPlaces } from '../src/services/areas.js';
import { login, loginAdmin } from './helpers/auth.js';

const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');
const q = (o = {}) => new URLSearchParams(o);
const helpers = runtime.slice(runtime.indexOf('  // <m2-real-data>'), runtime.indexOf('  // </m3-controls>'));
const loadHelpers = () => {
  const ctx = vm.createContext({ window: {}, money: (n) => String(n) });
  vm.runInContext(helpers, ctx);
  return ctx;
};
const plain = (v) => JSON.parse(JSON.stringify(v));

test('areas come from verified places (ward + city), with centroid and count', () => {
  const places = [
    { is_verified: true, lat: 10, lng: 106, address: '1 A, P. Một, Biên Hòa' },
    { is_verified: true, lat: 12, lng: 108, address: '2 B, P. Một, Biên Hòa' },
    { is_verified: true, lat: 11, lng: 107, address: '3 C, Biên Hòa' }, // no ward: not guessed
    { is_verified: false, lat: 11, lng: 107, address: '4 D, P. Hai, Biên Hòa' },
    { is_verified: true, lat: 11, lng: 107, address: '5 E, P. Ba, Biên Hòa', cms: { status: 'archived' } },
    { is_verified: true, lat: null, lng: null, address: '6 F, P. Bốn, Biên Hòa' }
  ];
  assert.deepEqual(areasFromPlaces(places), [{ id: 'p-mot-bien-hoa', name: 'P. Một, Biên Hòa', lat: 11, lng: 107, place_count: 2 }]);
});

test('GET /areas is public and matches the seeded catalogue', async () => {
  const store = createInitialStore();
  const r = await handleApiRequest(store, 'GET', '/api/v1/areas', q());
  assert.equal(r.status, 200);
  assert.equal(r.data.total, r.data.items.length);
  assert.ok(r.data.items.length >= 1);
  for (const a of r.data.items) {
    assert.match(a.name, /^P\. .+, Biên Hòa$/);
    assert.ok(Number.isFinite(a.lat) && Number.isFinite(a.lng) && a.place_count >= 1);
  }
  assert.ok(!r.data.items.some((a) => /Quy Nhơn/.test(a.name)), 'no invented cities');
});

test('M1-S08 helper marks the area matching the saved location, else offers the saved one', () => {
  const { areaRows } = loadHelpers();
  const areas = [{ id: 'a', lat: 10.9535, lng: 106.839 }, { id: 'b', lat: 10.96, lng: 106.85 }];
  const r = plain(areaRows(areas, { lat: 10.9535, lng: 106.839 }));
  assert.deepEqual(r.list.map((a) => a.selected), [true, false]);
  assert.equal(r.saved, false);
  assert.equal(plain(areaRows(areas, { lat: 1, lng: 1 })).saved, true);
});

test('M1-S08 picking an area saves its coordinates and places are measured from there', async () => {
  const store = createInitialStore();
  const u = await login(store, '0900000077');
  const area = (await handleApiRequest(store, 'GET', '/api/v1/areas', q())).data.items[0];
  const r = await handleApiRequest(store, 'PATCH', '/api/v1/me/profile', q(), { lat: area.lat, lng: area.lng }, u.headers);
  assert.equal(r.status, 200);
  assert.equal(r.data.lat, area.lat);
  const places = await handleApiRequest(store, 'GET', '/api/v1/places', q(), {}, u.headers);
  assert.ok(places.data.items.length > 0);
  assert.ok(places.data.items[0].distance_m < 1000, 'nearest place is near the chosen ward');
  assert.match(runtime, /P2\.area\('/);
  assert.match(runtime, /area\(id\) \{/);
});

test('M1-S10 consent is a real switch persisted through PATCH /me/profile', async () => {
  const store = createInitialStore();
  const u = await login(store, '0900000078');
  for (const v of [true, false]) {
    const r = await handleApiRequest(store, 'PATCH', '/api/v1/me/profile', q(), { pdpd_consent: v }, u.headers);
    assert.equal(r.status, 200);
    const back = await handleApiRequest(store, 'GET', '/api/v1/me/profile', q(), {}, u.headers);
    assert.equal(back.data.pdpd_consent, v);
  }
  const bad = await handleApiRequest(store, 'PATCH', '/api/v1/me/profile', q(), { pdpd_consent: 'yes' }, u.headers);
  assert.equal(bad.status, 400);
  assert.match(runtime, /setAttribute\("role", "switch"\)/);
  assert.match(runtime, /P2\.consent\(\$\{!on\}\)/);
});

test('M9-S08: rbac user list carries email, super_admin only', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const other = await login(store, '0900000079');
  store.users[other.user.id].email = 'nguoi.dung@example.com';
  const r = await handleApiRequest(store, 'GET', '/api/v1/admin/rbac/users', q(), {}, admin.headers);
  assert.equal(r.status, 200);
  assert.equal(r.data.users.find((x) => x.id === other.user.id).email, 'nguoi.dung@example.com');
  assert.ok(r.data.users.every((x) => Object.hasOwn(x, 'email')));
  for (const role of ['ops_admin', 'content_moderator', 'consumer']) {
    store.users[other.user.id].role = role;
    const denied = await handleApiRequest(store, 'GET', '/api/v1/admin/rbac/users', q(), {}, other.headers);
    assert.equal(denied.status, 403, role + ' must not see account emails');
  }
  store.users[other.user.id].role = 'consumer';
  const change = await handleApiRequest(store, 'POST', '/api/v1/admin/rbac/users', q(),
    { user_id: other.user.id, role: 'content_moderator', reason: 'thử' }, admin.headers);
  assert.equal(change.status, 200);
  const log = await handleApiRequest(store, 'GET', '/api/v1/admin/audit-logs', q({ action: 'ASSIGN_ROLE' }), {}, admin.headers);
  assert.equal(log.data.total, 1);
});

test('M9-S08/S09 UI helpers: role counts skip guests, audit query uses Vietnam day bounds, log lines escape', () => {
  const src = fs.readFileSync('ui-design/src/admin_rbac_audit.js', 'utf8');
  const ctx = vm.createContext({ window: {}, URLSearchParams });
  vm.runInContext(src, ctx);
  const A = ctx.window.M9RbacAudit;
  assert.deepEqual(plain(A.roleCounts([{ role: 'consumer' }, { role: 'user' }, { role: 'consumer', guest: true }, { role: 'super_admin' }])),
    { consumer: 2, super_admin: 1 });
  const form = new Map(Object.entries({ action: ' ASSIGN_ROLE ', actor_id: '', target: '', from: '2026-11-20', to: '2026-11-26' }));
  const query = A.auditQuery(form);
  assert.equal(query.get('action'), 'ASSIGN_ROLE');
  assert.equal(query.has('actor_id'), false);
  assert.equal(query.get('from'), '2026-11-20T00:00:00+07:00');
  assert.equal(query.get('to'), '2026-11-26T23:59:59.999+07:00');
  const H = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const line = A.logLine({ timestamp: '2026-11-26T04:00:00Z', actor: '<b>x</b>', action: 'ASSIGN_ROLE', target: 'u1', reason: 'ok' }, H);
  assert.match(line, /\[2026-11-26 11:00:00\]/);
  assert.doesNotMatch(line, /<b>x<\/b>/);
  assert.match(fs.readFileSync('ui-design/build.js', 'utf8'), /admin_rbac_audit\.js/);
  assert.match(fs.readFileSync('ui-design/src/admin_forms.js', 'utf8'), /M9-S0\[1-9\]\$/); // S07 mounts too since M7 is live (adsModeration)
});

test('M9-S01 activity: 7 Vietnam calendar days, bars scaled to the real counts', async () => {
  const { activityBars, vnDays } = loadHelpers();
  const days = plain(vnDays(7, new Date('2026-11-26T18:00:00Z'))); // 01:00 on 27/11 in Vietnam
  assert.equal(days.length, 7);
  assert.equal(days[6], '2026-11-27');
  assert.equal(days[0], '2026-11-21');
  const bars = plain(activityBars([{ day: '2026-11-26', count: 4 }, { day: '2026-11-27', count: 2 }]));
  assert.deepEqual(bars.map((b) => [b.label, b.height]), [['T5', 100], ['T6', 50]]);
  assert.deepEqual(plain(activityBars([{ day: '2026-11-22', count: 0 }])).map((b) => b.height), [0], 'no invented activity');
  // the same day bounds the runtime sends are accepted by the API
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const r = await handleApiRequest(store, 'GET', '/api/v1/admin/audit-logs',
    q({ limit: '1', from: days[6] + 'T00:00:00+07:00', to: days[6] + 'T23:59:59.999+07:00' }), {}, admin.headers);
  assert.equal(r.status, 200);
  assert.equal(typeof r.data.total, 'number');
});

test('owner rule: kept-but-not-live elements are marked "sắp có", never removed', () => {
  const m1s10 = runtime.slice(runtime.indexOf('    if (id === "M1-S10") {'), runtime.indexOf('  function bindPlaces('));
  assert.doesNotMatch(m1s10, /closest\("div\.flex"\)\?\.remove\(\)/, 'meal reminder row stays');
  assert.match(m1s10, /FEATURES\.mealReminders/);
  const admin = runtime.slice(runtime.indexOf('  function bindAdmin('), runtime.indexOf('    if(id==="M9-S02")'));
  assert.doesNotMatch(admin, /code\.includes\("M9-S07"\)\) n\.remove\(\)/, 'M9-S07 link stays');
  assert.doesNotMatch(admin, /\$\("aside > div:last-child",root\)\?\.remove\(\)/, 'sidebar guard card stays');
  assert.doesNotMatch(admin, /LiteLLM.*forEach\(n=>n\.remove\(\)\)/);
  assert.match(admin, /FEATURES\.adsModeration/);
  assert.match(admin, /FEATURES\.adminMetrics/);
  const m1s08 = runtime.slice(runtime.indexOf('    if (id === "M1-S08") {'), runtime.indexOf('    if (id === "M1-S09") {'));
  assert.match(m1s08, /Khu vực này chưa có dữ liệu quán/, 'original second city row kept as "sắp có"');
});
