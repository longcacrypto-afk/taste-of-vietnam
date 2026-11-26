// M6 Merchant Portal (live): membership/ownership, overview KPIs from real redirects +
// demo counters, profile sync rules, menu + "Còn món / Tạm hết", OCR, specials, staff roles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { login, loginMerchant, loginAdmin } from './helpers/auth.js';

const q = (s = '') => new URLSearchParams(s);
const STAFF_PHONE = '0900000003';
const OUTSIDER_PHONE = '0900000009';
process.env.MERCHANT_PHONES = [process.env.MERCHANT_PHONES, STAFF_PHONE, OUTSIDER_PHONE].filter(Boolean).join(',');

const api = (store, who, method, path, body = {}, search = '') =>
  handleApiRequest(store, method, '/api/v1' + path, q(search), body, who.headers);

test('M6: demo merchant is linked to its places at first login; outsider has none', async () => {
  const store = createInitialStore();
  const m = await loginMerchant(store);
  const me = await api(store, m, 'GET', '/merchant/me');
  assert.equal(me.status, 200);
  assert.deepEqual(me.data.places.map(p => p.id).sort(), ['PLACE-401', 'PLACE-405']);
  assert.ok(me.data.places.every(p => p.role === 'owner'));
  assert.equal(me.data.is_demo, true);
  const linked = store.moduleRecords.find(r => r.id === 'M6-MEM-TAI');
  assert.equal(linked.data.user_id, m.user.id);

  const o = await login(store, OUTSIDER_PHONE);
  const me2 = await api(store, o, 'GET', '/merchant/me');
  assert.equal(me2.data.places.length, 0);
  assert.ok(me2.data.claimable.length > 0);
  const ov = await api(store, o, 'GET', '/merchant/overview');
  assert.equal(ov.status, 403);
  assert.equal(ov.data.code, 'NO_MEMBERSHIP');
  assert.equal((await api(store, o, 'GET', '/merchant/menu', {}, 'place_id=PLACE-401')).status, 403);
  const claim = await api(store, o, 'POST', '/merchant/claim', { place_id: 'PLACE-403', note: 'Tôi là chủ quán' });
  assert.equal(claim.status, 201);
  assert.equal(claim.data.status, 'pending_review');
  assert.equal((await api(store, o, 'POST', '/merchant/claim', { place_id: 'PLACE-403' })).status, 409);
  // A claim never grants access by itself.
  assert.equal((await api(store, o, 'GET', '/merchant/menu', {}, 'place_id=PLACE-403')).status, 403);
  assert.equal((await api(store, o, 'POST', '/merchant/claim', {})).status, 400);
});

test('M6-S02/S08: KPIs = real order redirects + demo counters, legacy overview shape kept', async () => {
  const store = createInitialStore();
  const m = await loginMerchant(store);
  const before = await api(store, m, 'GET', '/merchant/overview');
  assert.equal(before.status, 200);
  for (const k of ['impressions_7d', 'direction_clicks_7d', 'order_clicks_7d', 'ctr_pct']) assert.equal(typeof before.data.kpis[k], 'number');
  assert.equal(before.data.place.id, 'PLACE-401');
  assert.equal(before.data.is_demo, true);
  assert.equal(before.data.chart.days.length, 7);
  assert.equal(before.data.top_dishes[0].name, 'Phở bò tái nạm');
  assert.equal(before.data.cards[0].source, 'demo_counter');
  // A real user taps "Chỉ đường" at PLACE-401 (M5 redirect) → the overview counts it as real.
  const u = await login(store, '0977000111');
  const r = await handleApiRequest(store, 'POST', '/api/v1/orders/redirect', q(), { place_id: 'PLACE-401', dish_id: 'DISH-101', partner: 'maps' }, u.headers);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const after = await api(store, m, 'GET', '/merchant/overview');
  assert.equal(after.data.kpis.direction_clicks_7d, before.data.kpis.direction_clicks_7d + 1);
  assert.equal(after.data.cards[1].real, before.data.cards[1].real + 1);
  assert.equal(after.data.real_redirects_7d, 1);
  const an = await api(store, m, 'GET', '/merchant/analytics', {}, 'days=30');
  assert.equal(an.status, 200);
  assert.equal(an.data.days, 30);
  const row = an.data.rows.find(x => x.id === 'M6-MENU-401-101');
  assert.equal(row.real, 1);
  assert.ok(row.cvr_pct > 0);
  // Ownership: PLACE-402 belongs to someone else.
  assert.equal((await api(store, m, 'GET', '/merchant/overview', {}, 'place_id=PLACE-402')).status, 403);
});

test('M6-S03/S04: profile — amenities/links/pause sync to the catalogue, name/hours stay pending', async () => {
  const store = createInitialStore();
  const m = await loginMerchant(store);
  const br = await api(store, m, 'GET', '/merchant/branches');
  assert.equal(br.data.branches.length, 2);
  assert.equal(br.data.branches.find(b => b.id === 'PLACE-405').open_status.status, 'closed');
  const g = await api(store, m, 'GET', '/merchant/places/PLACE-401');
  assert.equal(g.status, 200);
  assert.equal(g.data.hours_text, '06:00 – 22:00');
  assert.equal((await api(store, m, 'PUT', '/merchant/places/PLACE-401', { links: { grabfood: 'https://evil.example.com/x' } })).status, 400);
  assert.equal((await api(store, m, 'PUT', '/merchant/places/PLACE-401', { hours_text: 'cả ngày' })).status, 400);
  const put = await api(store, m, 'PUT', '/merchant/places/PLACE-401', {
    name: 'Phở Phát Tài Bửu Long', hours_text: '05:30 – 21:00', amenities: { has_ac: false, has_parking: true },
    links: { shopeefood: 'https://shopeefood.vn/bien-hoa/pho-phat-tai-moi' } });
  assert.equal(put.status, 200, JSON.stringify(put.data));
  assert.equal(put.data.synced_to_catalogue, true);
  assert.deepEqual(put.data.pending_fields.sort(), ['hours_text', 'name', 'opening_hours']);
  const core = store.places.find(p => p.id === 'PLACE-401');
  assert.equal(core.name, 'Phở Gia Truyền Phát Tài', 'name waits for M9');
  assert.equal(core.opening_hours, undefined, 'hours never applied unverified');
  assert.equal(core.has_ac, false);
  assert.equal(core.links.shopeefood, 'https://shopeefood.vn/bien-hoa/pho-phat-tai-moi');
  assert.equal(core.cms.version, 1);
  assert.equal(put.data.amenities.has_parking, true);
  assert.equal(put.data.pending_change.status, 'pending_review');
  // Pause / reopen by the merchant; a moderation pause (PLACE-405) cannot be lifted here.
  await api(store, m, 'PUT', '/merchant/places/PLACE-401', { paused: true });
  assert.equal(store.places.find(p => p.id === 'PLACE-401').is_open_override, false);
  await api(store, m, 'PUT', '/merchant/places/PLACE-401', { paused: false });
  assert.equal(store.places.find(p => p.id === 'PLACE-401').is_open_override, true);
  const r405 = await api(store, m, 'PUT', '/merchant/places/PLACE-405', { paused: false });
  assert.equal(r405.status, 409);
  assert.equal(store.places.find(p => p.id === 'PLACE-405').is_open_override, false);
  assert.equal((await api(store, m, 'PUT', '/merchant/places/PLACE-402', { amenities: { has_ac: true } })).status, 403);
});

test('M6-S05: menu CRUD + "Còn món / Tạm hết" syncs reviewed items; staff may only toggle', async () => {
  const store = createInitialStore();
  const m = await loginMerchant(store);
  const list = await api(store, m, 'GET', '/merchant/menu');
  assert.equal(list.status, 200);
  assert.ok(list.data.items.length >= 5);
  const pho = list.data.items.find(i => i.id === 'M6-MENU-401-101');
  assert.equal(pho.on_recommendations, true);
  const off = await api(store, m, 'PATCH', '/merchant/menu/M6-MENU-401-101', { available: false });
  assert.equal(off.status, 200);
  assert.equal(off.data.synced_to_catalogue, true);
  assert.equal(store.places.find(p => p.id === 'PLACE-401').menu.find(x => x.dish_id === 'DISH-101').available, false);
  // An item not on the reviewed catalogue menu changes only the merchant menu.
  const bb = await api(store, m, 'PATCH', '/merchant/menu/M6-MENU-401-BBH', { price_vnd: 52000 });
  assert.equal(bb.data.synced_to_catalogue, false);
  assert.equal((await api(store, m, 'PATCH', '/merchant/menu/M6-MENU-401-BBH', { price_vnd: -1 })).status, 400);
  assert.equal((await api(store, m, 'POST', '/merchant/menu', { name: 'Trà đá' })).status, 400);
  const add = await api(store, m, 'POST', '/merchant/menu', { name: 'Trà đá', price_vnd: 5000, category: 'Đồ uống' });
  assert.equal(add.status, 201);
  assert.equal((await api(store, m, 'DELETE', '/merchant/menu/' + add.data.id)).status, 200);
  assert.equal((await api(store, m, 'PATCH', '/merchant/menu/NOPE', { available: true })).status, 404);

  const staff = await login(store, STAFF_PHONE);
  const sl = await api(store, staff, 'GET', '/merchant/menu');
  assert.equal(sl.data.role, 'staff');
  assert.equal((await api(store, staff, 'PATCH', '/merchant/menu/M6-MENU-401-101', { available: true })).status, 200);
  assert.equal(store.places.find(p => p.id === 'PLACE-401').menu.find(x => x.dish_id === 'DISH-101').available, true);
  assert.equal((await api(store, staff, 'PATCH', '/merchant/menu/M6-MENU-401-101', { price_vnd: 1000 })).status, 403);
  assert.equal((await api(store, staff, 'GET', '/merchant/overview')).status, 403);
  assert.equal((await api(store, staff, 'PATCH', '/merchant/menu/M6-MENU-405-101', { available: true })).status, 403, 'not her branch');
});

test('M6-S06: OCR text → ready / pending items, publish once, image-only is a labelled sandbox', async () => {
  const store = createInitialStore();
  const m = await loginMerchant(store);
  const queueBefore = structuredClone(store.ocrQueue);
  const menuBefore = structuredClone(store.places.find(p => p.id === 'PLACE-401').menu);
  assert.equal((await api(store, m, 'POST', '/merchant/menu/ocr', {})).status, 400);
  const scan = await api(store, m, 'POST', '/merchant/menu/ocr', { raw_text: '1. Phở Bò Tái Nạm Hà Nội - 45k\nNước sâm bí đao\nBún bò Huế 50.000đ' });
  assert.equal(scan.status, 201);
  assert.equal(scan.data.items.length, 3);
  const [a, b] = scan.data.items;
  assert.equal(a.status, 'ready');
  assert.equal(a.price_vnd, 45000);
  assert.equal(a.dish_id, 'DISH-101');
  assert.equal(b.price_vnd, null, 'no invented price');
  assert.equal(b.status, 'pending_review');
  const latest = await api(store, m, 'GET', '/merchant/menu/ocr');
  assert.equal(latest.data.latest.id, scan.data.id);
  const pub = await api(store, m, 'POST', `/merchant/menu/ocr/${scan.data.id}/publish`);
  assert.equal(pub.status, 200);
  assert.ok(pub.data.published >= 1 && pub.data.pending_review >= 1);
  assert.equal((await api(store, m, 'POST', `/merchant/menu/ocr/${scan.data.id}/publish`)).status, 409);
  const menu = await api(store, m, 'GET', '/merchant/menu');
  const pend = menu.data.items.find(i => i.status === 'pending_review');
  assert.equal(pend.available, false);
  assert.equal((await api(store, m, 'PATCH', '/merchant/menu/' + pend.id, { available: true })).status, 409);
  // The core M9 queue and the reviewed catalogue menu are untouched.
  assert.deepEqual(store.ocrQueue, queueBefore);
  assert.deepEqual(store.places.find(p => p.id === 'PLACE-401').menu, menuBefore);
  const img = await api(store, m, 'POST', '/merchant/menu/ocr', { image_name: 'bang-gia.jpg' });
  assert.equal(img.status, 201);
  assert.equal(img.data.sandbox, true);
  assert.ok(img.data.sandbox_note);
});

test('M6-S07: daily special (one per day) and promotions; legacy daily-special shape', async () => {
  const store = createInitialStore();
  const m = await loginMerchant(store);
  const g = await api(store, m, 'GET', '/merchant/promotions');
  assert.equal(g.data.daily_special.length, 1);
  assert.equal(g.data.promotions.length, 1);
  const set = await api(store, m, 'POST', '/merchant/daily-special', { dish_id: 'DISH-103', label: 'Bún bò gân giá 45k hôm nay' });
  assert.equal(set.status, 200);
  assert.equal(set.data.tagged, true);
  const d = await api(store, m, 'GET', '/merchant/daily-special');
  assert.deepEqual(d.data.daily_special.map(x => x.id), ['DISH-103']);
  assert.equal((await api(store, m, 'POST', '/merchant/daily-special', { dish_id: 'DISH-110' })).status, 400);
  const p = await api(store, m, 'POST', '/merchant/promotions', { title: 'Combo sáng 49k', detail: 'Phở + quẩy + trà đá', discount_pct: 10, start_time: '06:00', end_time: '09:00' });
  assert.equal(p.status, 200);
  assert.equal((await api(store, m, 'POST', '/merchant/promotions', { title: 'X', discount_pct: 200 })).status, 400);
  const off = await api(store, m, 'PATCH', '/merchant/promotions/' + p.data.id, { active: false });
  assert.equal(off.data.active, false);
  const staff = await login(store, STAFF_PHONE);
  assert.equal((await api(store, staff, 'PATCH', '/merchant/promotions/' + p.data.id, { active: true })).status, 403);
});

test('M6-S09: staff list, owner adds/changes/removes staff, owner row protected', async () => {
  const store = createInitialStore();
  const m = await loginMerchant(store);
  const s = await api(store, m, 'GET', '/merchant/staff');
  assert.equal(s.status, 200);
  assert.deepEqual(s.data.staff.map(x => x.role), ['owner', 'staff']);
  assert.ok(!JSON.stringify(s.data).includes('900000003'), 'phones masked');
  const add = await api(store, m, 'POST', '/merchant/staff', { name: 'Phạm Thu Hà', phone: '0912345678', role: 'staff' });
  assert.equal(add.status, 201);
  assert.equal(add.data.invite.sandbox, true);
  assert.equal((await api(store, m, 'POST', '/merchant/staff', { name: 'Phạm Thu Hà', phone: '0912345678', role: 'staff' })).status, 409);
  assert.equal((await api(store, m, 'POST', '/merchant/staff', { name: 'A B', phone: '123', role: 'staff' })).status, 400);
  assert.equal((await api(store, m, 'PATCH', '/merchant/staff/' + add.data.id, { role: 'manager' })).data.role, 'manager');
  assert.equal((await api(store, m, 'DELETE', '/merchant/staff/M6-MEM-TAI')).status, 409);
  const staff = await login(store, STAFF_PHONE);
  assert.equal((await api(store, staff, 'POST', '/merchant/staff', { name: 'X Y', phone: '0912000000', role: 'staff' })).status, 403);
  assert.equal((await api(store, staff, 'DELETE', '/merchant/staff/' + add.data.id)).status, 403);
  assert.equal((await api(store, m, 'DELETE', '/merchant/staff/' + add.data.id)).status, 200);
});

test('M6: super_admin acts on any place; anonymous gets 401', async () => {
  const store = createInitialStore();
  const a = await loginAdmin(store);
  assert.equal((await api(store, a, 'GET', '/merchant/menu', {}, 'place_id=PLACE-402')).status, 200);
  assert.equal((await api(store, a, 'GET', '/merchant/menu', {}, 'place_id=NOPE')).status, 404);
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/merchant/overview', q())).status, 401);
});
