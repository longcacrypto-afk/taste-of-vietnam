// =============================================================================
// P0: admin, merchant and write routes need a valid token; public reads stay open
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { login, guest, loginAdmin, loginMerchant } from './helpers/auth.js';

const q = () => new URLSearchParams();
const hit = (store, method, path, headers = {}, body = {}) => handleApiRequest(store, method, path, q(), body, headers);

const PUBLIC_READS = [
  '/api/v1/dishes', '/api/v1/dishes/categories', '/api/v1/dishes/DISH-101', '/api/v1/dishes/semantic-search',
  '/api/v1/dishes/DISH-101/story', '/api/v1/dishes/DISH-101/similar', '/api/v1/suggestions/today',
  '/api/v1/suggestions/spin', '/api/v1/places', '/api/v1/community/recipes', '/api/v1/notifications',
  '/api/v1/stories', '/api/v1/tourism/trails', '/api/v1/vouchers', '/api/v1/meal-plans/weekly', '/api/v1/health-check'
];

// Every write route in the router (concrete ids), except the public ones
const WRITES = [
  ['PUT', '/api/v1/me/profile'], ['DELETE', '/api/v1/me'], ['POST', '/api/v1/me/collections'],
  ['DELETE', '/api/v1/me/collections/DISH-101'], ['POST', '/api/v1/suggestions/feedback'],
  ['POST', '/api/v1/places/PLACE-401/reports'], ['POST', '/api/v1/orders/redirect'],
  ['POST', '/api/v1/orders/ORD-1/confirm-eaten'], ['POST', '/api/v1/ads/campaigns/CMP-701/click'],
  ['PUT', '/api/v1/me/meal-schedule'], ['POST', '/api/v1/meal-plans/weekly'], ['POST', '/api/v1/groceries/items'],
  ['PATCH', '/api/v1/groceries/items/G1'], ['POST', '/api/v1/polls/POLL-701/vote'],
  ['POST', '/api/v1/places/PLACE-401/reviews'], ['POST', '/api/v1/reviews/gps'], ['POST', '/api/v1/bookings'],
  ['PATCH', '/api/v1/bookings/BK-1'], ['DELETE', '/api/v1/bookings/BK-1'], ['POST', '/api/v1/tourism/passport/checkin'],
  ['POST', '/api/v1/fridge/scan'], ['POST', '/api/v1/fridge/inventory'], ['PUT', '/api/v1/fridge/inventory/F1'],
  ['DELETE', '/api/v1/fridge/inventory/F1'], ['POST', '/api/v1/health/sync'], ['POST', '/api/v1/community/recipes'],
  ['POST', '/api/v1/community/recipes/CREC-01/tip'], ['POST', '/api/v1/community/recipes/CREC-01/like'],
  ['PATCH', '/api/v1/community/recipes/CREC-01'], ['DELETE', '/api/v1/community/recipes/CREC-01'],
  ['POST', '/api/v1/vision/analyze']
];

const MERCHANT_ROUTES = [
  ['GET', '/api/v1/merchant/overview'], ['GET', '/api/v1/merchant/menu'], ['POST', '/api/v1/merchant/menu'],
  ['PUT', '/api/v1/merchant/menu/M1'], ['DELETE', '/api/v1/merchant/menu/M1'], ['POST', '/api/v1/merchant/menu/ocr'],
  ['GET', '/api/v1/merchant/promotions'], ['POST', '/api/v1/merchant/promotions'], ['GET', '/api/v1/merchant/branches'],
  ['GET', '/api/v1/merchant/daily-special'], ['POST', '/api/v1/merchant/daily-special'],
  ['GET', '/api/v1/ads/campaigns'], ['POST', '/api/v1/ads/campaigns'], ['PATCH', '/api/v1/ads/campaigns/CMP-701'],
  ['POST', '/api/v1/ads/payments/vietqr/create'], ['GET', '/api/v1/payments/orders/ORD-1']
];

const ADMIN_ROUTES = [
  ['GET', '/api/v1/admin/dashboard'], ['POST', '/api/v1/admin/dishes'], ['PUT', '/api/v1/admin/dishes/DISH-101'],
  ['DELETE', '/api/v1/admin/dishes/DISH-999'], ['POST', '/api/v1/admin/ocr-review'],
  ['POST', '/api/v1/admin/places/PLACE-405/unpause'], ['POST', '/api/v1/admin/ads/CMP-701/moderate'],
  ['GET', '/api/v1/admin/audit-logs'], ['GET', '/api/v1/admin/rbac/roles'], ['POST', '/api/v1/admin/rbac/users'],
  ['GET', '/api/v1/analytics/funnel'], ['GET', '/api/v1/analytics/ab-test'], ['GET', '/api/v1/analytics/ai-benchmark'],
  ['GET', '/api/v1/ads/fraud-logs'], ['DELETE', '/api/v1/system/cache'], ['POST', '/api/v1/notifications/batch-dispatch'],
  ['GET', '/api/v1/enterprise/tourism-insights']
];

test('Public read-only routes still work without a token (UI can load)', async () => {
  const store = createInitialStore();
  for (const path of PUBLIC_READS) {
    const r = await hit(store, 'GET', path);
    assert.equal(r.status, 200, `GET ${path} should be public, got ${r.status}`);
  }
  for (const [m, p, b] of [['POST', '/api/v1/chat', { query: 'phở' }], ['POST', '/api/v1/auth/guest'], ['POST', '/api/v1/events', { event: 'x' }]]) {
    const r = await hit(store, m, p, {}, b);
    assert.notEqual(r.status, 401, `${m} ${p} should stay public`);
  }
});

test('Every write route returns 401 without a token, and works with a guest token', async () => {
  const store = createInitialStore();
  const g = await guest(store);
  for (const [m, p] of WRITES) {
    const anon = await hit(store, m, p);
    assert.equal(anon.status, 401, `${m} ${p} without token should be 401, got ${anon.status}`);
    const withBadToken = await hit(store, m, p, { authorization: 'Bearer not-a-token' });
    assert.equal(withBadToken.status, 401, `${m} ${p} with a bad token should be 401`);
  }
  // Editing/deleting a recipe is for its author (or an admin): covered by the ownership test below
  const OWNER_ONLY = (m, p) => /^\/api\/v1\/community\/recipes\/[^/]+$/.test(p) && (m === 'PATCH' || m === 'DELETE');
  for (const [m, p] of WRITES.filter(([m, p]) => p !== '/api/v1/me' && !OWNER_ONLY(m, p))) {
    const r = await hit(store, m, p, g.headers, { dish_id: 'DISH-101', title: 'Món thử', place_id: 'PLACE-401', party_size: 2 });
    assert.ok(r.status !== 401 && r.status !== 403, `${m} ${p} with guest token got ${r.status}`);
  }
});

test('Merchant routes: 401 anonymous, 403 guest/user, OK for merchant and admin', async () => {
  const store = createInitialStore();
  const g = await guest(store);
  const u = await login(store, '0977777777');
  const merchant = await loginMerchant(store);
  const admin = await loginAdmin(store);
  assert.equal(merchant.role, 'merchant');
  for (const [m, p] of MERCHANT_ROUTES) {
    assert.equal((await hit(store, m, p)).status, 401, `${m} ${p} anon`);
    assert.equal((await hit(store, m, p, g.headers)).status, 403, `${m} ${p} guest`);
    assert.equal((await hit(store, m, p, u.headers)).status, 403, `${m} ${p} user`);
    const asMerchant = await hit(store, m, p, merchant.headers, { name: 'Món', dish_id: 'DISH-101', raw_text: 'Phở bò 45k' });
    assert.ok(![401, 403].includes(asMerchant.status), `${m} ${p} merchant got ${asMerchant.status}`);
    const asAdmin = await hit(store, m, p, admin.headers, { name: 'Món', dish_id: 'DISH-101', raw_text: 'Phở bò 45k' });
    assert.ok(![401, 403].includes(asAdmin.status), `${m} ${p} admin got ${asAdmin.status}`);
  }
});

test('Admin routes: 401 anonymous, 403 for guest/user/merchant, OK for admin (role from ADMIN_PHONES)', async () => {
  const store = createInitialStore();
  const g = await guest(store);
  const u = await login(store, '0988888888');
  const merchant = await loginMerchant(store);
  const admin = await loginAdmin(store);
  assert.equal(admin.role, 'admin');
  for (const [m, p] of ADMIN_ROUTES) {
    assert.equal((await hit(store, m, p)).status, 401, `${m} ${p} anon`);
    for (const who of [g, u, merchant]) {
      assert.equal((await hit(store, m, p, who.headers)).status, 403, `${m} ${p} non-admin`);
    }
    const ok = await hit(store, m, p, admin.headers, { name: 'Món mới', ocr_id: 'OCR-1', status: 'approved', email: 'a@b.vn', role: 'editor' });
    assert.ok(![401, 403].includes(ok.status), `${m} ${p} admin got ${ok.status}`);
  }
  // Anonymous admin write changes nothing
  const before = store.dishes.length;
  await hit(store, 'POST', '/api/v1/admin/dishes', {}, { name: 'Spam' });
  assert.equal(store.dishes.length, before);
});

test('Community recipes: only the author or an admin can edit or delete one', async () => {
  const store = createInitialStore();
  const author = await guest(store);
  const other = await guest(store);
  const admin = await loginAdmin(store);
  const created = await hit(store, 'POST', '/api/v1/community/recipes', author.headers, { title: 'Canh chua nhà làm' });
  assert.equal(created.status, 201);
  const path = `/api/v1/community/recipes/${created.data.id}`;
  assert.equal((await hit(store, 'PATCH', path, other.headers, { title: 'Bị sửa' })).status, 403);
  assert.equal((await hit(store, 'DELETE', path, other.headers)).status, 403);
  assert.equal((await hit(store, 'PATCH', '/api/v1/community/recipes/CREC-01', author.headers, { title: 'Bị sửa' })).status, 403);
  const edited = await hit(store, 'PATCH', path, author.headers, { title: 'Canh chua cá lóc' });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.title, 'Canh chua cá lóc');
  assert.equal((await hit(store, 'DELETE', '/api/v1/community/recipes/CREC-01', admin.headers)).status, 200);
  assert.equal((await hit(store, 'DELETE', path, author.headers)).status, 200);
  assert.equal((await hit(store, 'GET', path.replace(/\/[^/]+$/, ''))).data.recipes.some(r => r.id === created.data.id), false);
});
