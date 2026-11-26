// M7 live: sponsored campaigns (overview, list, builder → review, pause/resume, analytics),
// VietQR top-up with a real EMVCo payload, sandbox confirmation, ownership and serving rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { signPayosData } from '../src/services/paymentService.js';
import { loginMerchant, loginAdmin, login } from './helpers/auth.js';
import { crc16, parseTlv, vietQrPayload, qrMatrix, asciiMemo } from '../src/modules/m7-qr.js';

const q = (s = '') => new URLSearchParams(s);
async function setup() {
  const store = createInitialStore();
  const merchant = await loginMerchant(store);
  const admin = await loginAdmin(store);
  const as = (who) => (method, path, body = {}) => {
    const [p, qs] = path.split('?');
    return handleApiRequest(store, method, p, q(qs), body, who ? who.headers : {});
  };
  return { store, merchant, admin, m: as(merchant), a: as(admin), anon: as(null) };
}
const sponsoredIds = async (store) => {
  const r = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', q());
  assert.equal(r.status, 200);
  assert.ok(r.data.items.filter(i => i.is_sponsored).length <= 1, 'max 1 of 3 sponsored');
  for (const i of r.data.items.filter(x => x.is_sponsored)) assert.equal(i.badge_label, 'Tài trợ');
  return r.data.items.filter(i => i.is_sponsored).map(i => i.campaign_id);
};

test('M7 access: anonymous 401, consumer 403, merchant/admin 200 on the new endpoints', async () => {
  const { store, m, a, anon } = await setup();
  const user = await login(store, '0977777777');
  for (const [meth, p] of [['GET', '/api/v1/ads/overview'], ['GET', '/api/v1/ads/account'], ['GET', '/api/v1/ads/campaigns/builder'],
    ['GET', '/api/v1/ads/payments/invoices'], ['GET', '/api/v1/ads/campaigns/CMP-701/analytics']]) {
    assert.equal((await anon(meth, p)).status, 401, `${p} anon`);
    assert.equal((await handleApiRequest(store, meth, p, q(), {}, user.headers)).status, 403, `${p} user`);
    assert.equal((await m(meth, p)).status, 200, `${p} merchant`);
    assert.equal((await a(meth, p)).status, 200, `${p} admin`);
  }
});

test('M7-S01/S02: demo overview and a campaign list scoped to the merchant\'s places', async () => {
  const { store, m, a } = await setup();
  const ov = await m('GET', '/api/v1/ads/overview');
  assert.equal(ov.data.is_demo, true);
  assert.ok(ov.data.kpis.roas > 0 && ov.data.kpis.spend_vnd_30d > 0);
  assert.equal(ov.data.series.length, 14);
  assert.equal(ov.data.performance.length, 7);
  assert.ok(ov.data.performance.some(p => p.index === 100));
  assert.ok(store.moduleRecords.every(r => r.module !== 'M7' || r.is_demo));
  const list = await m('GET', '/api/v1/ads/campaigns');
  assert.deepEqual(list.data.items.map(c => c.id).sort(), ['CMP-701', 'CMP-702']);
  assert.equal(list.data.policy.max_sponsored_ratio, '1/3');
  const c = list.data.items.find(x => x.id === 'CMP-701');
  assert.equal(c.ctr_pct, 6.8);
  assert.deepEqual(c.meal_slots, ['lunch', 'dinner']);
  assert.equal(c.created_by, undefined);
  const all = await a('GET', '/api/v1/ads/campaigns');
  assert.equal(all.data.items.length, store.campaigns.length, 'admin sees every campaign');
});

test('M7-S03..S06: builder validates dish/targeting/plan, submit → pending review, never served until approved', async () => {
  const { store, m, a } = await setup();
  const b = await m('GET', '/api/v1/ads/campaigns/builder');
  assert.equal(b.status, 200);
  assert.ok(b.data.dishes.length >= 3);
  assert.ok(b.data.dishes.every(d => ['PLACE-401', 'PLACE-403'].includes(d.place_id)));
  assert.equal((await m('POST', '/api/v1/ads/campaigns/builder', { dish_id: 'DISH-103', place_id: 'PLACE-401' })).status, 400, 'not on that menu');
  assert.equal((await m('POST', '/api/v1/ads/campaigns/builder', { dish_id: 'DISH-111' })).status, 400, 'other merchant\'s dish');
  assert.equal((await m('POST', '/api/v1/ads/campaigns/builder', { meal_slots: [] })).status, 400);
  assert.equal((await m('POST', '/api/v1/ads/campaigns/builder', { plan: 'free' })).status, 400);
  const s = await m('POST', '/api/v1/ads/campaigns/builder', { dish_id: 'DISH-101', place_id: 'PLACE-401', radius_m: 9000,
    meal_slots: ['dinner', 'breakfast', 'nope'], weather: ['hot_sunny', 'any'], plan: 'cpa_daily', days: 14, daily_budget_vnd: 30000, title: '<b>Phở</b> sáng' });
  assert.equal(s.status, 200);
  assert.equal(s.data.draft.radius_m, 5000);
  assert.deepEqual(s.data.draft.meal_slots, ['breakfast', 'dinner']);
  assert.deepEqual(s.data.draft.weather, ['any']);
  assert.equal(s.data.quote.total_vnd, 30000 * 14);
  assert.equal(s.data.draft.title, 'Phở sáng');
  assert.equal(s.data.preview.badge_label, 'Tài trợ');
  assert.ok(s.data.ready && s.data.checks.every(c => c.ok));
  const sub = await m('POST', '/api/v1/ads/campaigns/builder/submit');
  assert.equal(sub.status, 201);
  const id = sub.data.campaign.id;
  assert.equal(sub.data.campaign.status, 'pending_review');
  assert.equal(sub.data.amount_due_vnd, 420000);
  assert.equal(store.campaigns.find(c => c.id === id).badge_label, 'Tài trợ');
  assert.equal((await m('GET', '/api/v1/ads/campaigns/builder')).data.saved, false, 'draft cleared');
  assert.ok(!(await sponsoredIds(store)).includes(id), 'pending campaigns are never served');
  // Merchant cannot approve itself; pausing a pending campaign is refused.
  assert.equal((await m('PATCH', `/api/v1/ads/campaigns/${id}`, { status: 'active' })).status, 409);
  assert.equal((await m('POST', `/api/v1/ads/campaigns/${id}/pause`)).status, 409);
  const mod = await a('POST', `/api/v1/admin/ads/${id}/moderate`, { decision: 'active', reason: 'Đã kiểm tra món và nhãn dị ứng' });
  assert.equal(mod.status, 200);
  assert.equal((await m('POST', `/api/v1/ads/campaigns/${id}/pause`)).status, 200);
});

test('M7-S03: a dish without declared allergen tags cannot be promoted', async () => {
  const { store, m } = await setup();
  delete store.dishes.find(d => d.id === 'DISH-108').allergen_tags;
  const b = await m('GET', '/api/v1/ads/campaigns/builder');
  const d = b.data.dishes.find(x => x.dish_id === 'DISH-108');
  assert.equal(d.eligible, false);
  assert.match(d.reason, /dị ứng/);
  const r = await m('POST', '/api/v1/ads/campaigns/builder', { dish_id: 'DISH-108', place_id: 'PLACE-401' });
  assert.equal(r.status, 400);
  assert.equal((await m('POST', '/api/v1/ads/campaigns', { dish_id: 'DISH-108', place_id: 'PLACE-401' })).status, 400);
});

test('M7 pause/resume changes serving; ownership 403/404; admin pause is not merchant-resumable', async () => {
  const { store, m, a } = await setup();
  assert.ok((await sponsoredIds(store)).includes('CMP-701'), 'seed serves CMP-701 for the default profile');
  assert.equal((await m('POST', '/api/v1/ads/campaigns/CMP-701/pause')).data.campaign.status, 'paused');
  assert.ok(!(await sponsoredIds(store)).includes('CMP-701'));
  const again = await m('POST', '/api/v1/ads/campaigns/CMP-701/pause');
  assert.equal(again.status, 409);
  const res = await m('POST', '/api/v1/ads/campaigns/CMP-701/resume');
  assert.equal(res.data.campaign.status, 'active');
  assert.ok((await sponsoredIds(store)).includes('CMP-701'));
  assert.equal((await m('POST', '/api/v1/ads/campaigns/CMP-703/pause')).status, 403);
  assert.equal((await m('PATCH', '/api/v1/ads/campaigns/CMP-703', { status: 'paused' })).status, 403);
  assert.equal((await m('GET', '/api/v1/ads/campaigns/CMP-703/analytics')).status, 403);
  assert.equal((await m('POST', '/api/v1/ads/campaigns/NOPE/pause')).status, 404);
  await a('POST', '/api/v1/admin/ads/CMP-702/moderate', { decision: 'paused', reason: 'Vi phạm nội dung' });
  assert.equal((await m('POST', '/api/v1/ads/campaigns/CMP-702/resume')).status, 409);
  const an = await m('GET', '/api/v1/ads/campaigns/CMP-701/analytics');
  assert.equal(an.data.anti_fraud.cooldown_window_seconds, 60);
  assert.equal(an.data.metrics.impressions, 18420);
});

test('M7-S07: duplicate clicks within 60 s are filtered and show up in analytics', async () => {
  const { store, m } = await setup();
  const u = await login(store, '0977777777');
  for (let i = 0; i < 2; i++) await handleApiRequest(store, 'POST', '/api/v1/ads/campaigns/CMP-701/click', q(), { fingerprint: 'fp-m7-test' }, u.headers);
  const an = await m('GET', '/api/v1/ads/campaigns/CMP-701/analytics');
  assert.equal(an.data.metrics.filtered_fraud_clicks, 1);
  assert.equal(an.data.campaign.clicks, 1253);
});

test('M7-S08: VietQR top-up builds a valid EMVCo payload; sandbox confirm never touches the real balance', async () => {
  const { store, m } = await setup();
  const before = store.campaigns.find(c => c.id === 'CMP-701');
  const realBefore = before.balance_vnd ?? before.budget_monthly_vnd;
  assert.equal((await m('POST', '/api/v1/ads/payments/topup', { campaign_id: 'CMP-701', amount_vnd: 50 })).status, 400);
  assert.equal((await m('POST', '/api/v1/ads/payments/topup', { campaign_id: 'CMP-703', amount_vnd: 500000 })).status, 403);
  const t = await m('POST', '/api/v1/ads/payments/topup', { campaign_id: 'CMP-701', amount_vnd: 500000 });
  assert.equal(t.status, 201);
  assert.equal(t.data.money_moved, false);
  const p = t.data.qr.payload;
  assert.equal(crc16(p.slice(0, -4)), p.slice(-4), 'CRC16 over the payload');
  const f = parseTlv(p);
  assert.equal(f['00'], '01');
  assert.equal(f['53'], '704');
  assert.equal(f['54'], '500000');
  assert.equal(f['58'], 'VN');
  const acct = parseTlv(f['38']);
  assert.equal(acct['00'], 'A000000727');
  assert.equal(acct['02'], 'QRIBFTTA');
  assert.deepEqual(parseTlv(acct['01']), { '00': t.data.qr.bank_bin, '01': t.data.qr.account_number });
  assert.equal(parseTlv(f['62'])['08'], t.data.qr.memo);
  assert.match(t.data.qr.image, /^data:image\/svg\+xml;base64,/);
  const order = await m('GET', `/api/v1/payments/orders/${t.data.invoice.order_id}`);
  assert.equal(order.data.status, 'PENDING_PAYMENT');

  const list = await m('GET', '/api/v1/ads/payments/invoices');
  const inv = list.data.items.find(i => i.id === t.data.invoice.id);
  assert.equal(inv.status, 'PENDING_PAYMENT');
  assert.ok(inv.qr && inv.qr.payload === p);
  assert.ok(list.data.items.some(i => i.status === 'DEMO_PAID'));

  const ok = await m('POST', `/api/v1/ads/payments/invoices/${inv.id}/sandbox-confirm`);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.sandbox, true);
  assert.equal(ok.data.money_moved, false);
  assert.equal(ok.data.invoice.status, 'SANDBOX_PAID');
  assert.equal(ok.data.balance.sandbox_vnd, 500000);
  const after = store.campaigns.find(c => c.id === 'CMP-701');
  assert.equal(after.balance_vnd ?? after.budget_monthly_vnd, realBefore, 'real balance unchanged');
  assert.equal((await m('GET', `/api/v1/payments/orders/${inv.order_id}`)).data.status, 'PENDING_PAYMENT');
  assert.equal((await m('POST', `/api/v1/ads/payments/invoices/${inv.id}/sandbox-confirm`)).status, 409);
  assert.equal((await m('POST', '/api/v1/ads/payments/invoices/M7-INV-NOPE/sandbox-confirm')).status, 404);
});

test('M7-S08: a signed PayOS webhook marks the invoice paid for real (sandbox credit then no longer counted)', async () => {
  const { store, m } = await setup();
  process.env.PAYOS_CHECKSUM_KEY = 'm7-test-key';
  try {
    const t = await m('POST', '/api/v1/ads/payments/topup', { campaign_id: 'CMP-702', amount_vnd: 300000 });
    await m('POST', `/api/v1/ads/payments/invoices/${t.data.invoice.id}/sandbox-confirm`);
    const data = { orderCode: Number(t.data.invoice.order_code), amount: 300000, description: t.data.invoice.memo, code: '00', desc: 'Thành công' };
    const wh = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', q(), { code: '00', success: true, data, signature: signPayosData(data, 'm7-test-key') });
    assert.equal(wh.status, 200);
    assert.equal(wh.data.credited, true);
    const acc = await m('GET', '/api/v1/ads/account');
    const inv = acc.data.invoices.find(i => i.id === t.data.invoice.id);
    assert.equal(inv.status, 'PAID');
    assert.equal(acc.data.balance.sandbox_vnd, 0);
    assert.equal(acc.data.campaigns.find(c => c.id === 'CMP-702').balance_vnd, 1200000 + 300000);
    assert.equal(acc.data.payos_configured, true);
  } finally { delete process.env.PAYOS_CHECKSUM_KEY; }
});

test('M7 sandbox can be switched off; merchant cannot create core VietQR orders for other campaigns', async () => {
  const { m } = await setup();
  const t = await m('POST', '/api/v1/ads/payments/topup', { campaign_id: 'CMP-701', amount_vnd: 100000 });
  process.env.PAYMENTS_SANDBOX = 'false';
  try {
    assert.equal((await m('POST', `/api/v1/ads/payments/invoices/${t.data.invoice.id}/sandbox-confirm`)).status, 403);
  } finally { delete process.env.PAYMENTS_SANDBOX; }
  assert.equal((await m('POST', '/api/v1/ads/payments/vietqr/create', { campaign_id: 'CMP-703', amount_vnd: 100000 })).status, 403);
  assert.equal((await m('POST', '/api/v1/ads/payments/vietqr/create', { campaign_id: 'CMP-701', amount_vnd: 100000 })).status, 200);
});

test('M7 tab: account summary carries places, balance and a default campaign', async () => {
  const { m } = await setup();
  const r = await m('GET', '/api/v1/ads/account');
  assert.equal(r.data.account.id, 'M7-ACC-DEMO');
  assert.deepEqual(r.data.places.map(p => p.id), ['PLACE-401', 'PLACE-403']);
  assert.ok(r.data.places.every(p => ['open', 'closed', 'unknown', 'stale'].includes(p.open_status)));
  assert.equal(r.data.balance.real_vnd, 1500000 + 1200000);
  assert.equal(r.data.default_campaign_id, 'CMP-701');
  assert.equal(r.data.is_demo, true);
});

test('M7 QR helpers: CRC vector, ASCII memo, QR matrix structure', () => {
  assert.equal(crc16('123456789'), '29B1');
  assert.equal(asciiMemo('Nạp Phở Đông <x>'), 'Nap Pho Dong x');
  const p = vietQrPayload({ bin: '970436', accountNumber: '0121000889999', amountVnd: 1500000, memo: 'HNAG CMP-701 123456' });
  assert.ok(p.startsWith('000201010212'));
  const mtx = qrMatrix(p);
  assert.equal((mtx.length - 17) % 4, 0);
  // finder pattern corners: dark 7x7 ring with dark 3x3 centre
  for (const [x, y] of [[0, 0], [mtx.length - 7, 0], [0, mtx.length - 7]]) {
    assert.equal(mtx[y][x], true); assert.equal(mtx[y + 1][x + 1], false); assert.equal(mtx[y + 3][x + 3], true);
  }
  assert.throws(() => vietQrPayload({ bin: '12', accountNumber: '1', amountVnd: 1 }));
});
