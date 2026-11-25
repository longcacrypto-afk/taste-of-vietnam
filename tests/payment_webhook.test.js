// =============================================================================
// P0: PayOS webhook must be signed (HMAC-SHA256 with PAYOS_CHECKSUM_KEY)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { loginMerchant } from './helpers/auth.js';
import { buildPayosSignData, signPayosData, verifyPaymentWebhookSignature } from '../src/services/paymentService.js';

const KEY = 'unit-test-checksum-key';
const q = () => new URLSearchParams();

async function setup() {
  process.env.PAYOS_CHECKSUM_KEY = KEY;
  const store = createInitialStore();
  const merchant = await loginMerchant(store);
  const inv = await handleApiRequest(store, 'POST', '/api/v1/ads/payments/vietqr/create', q(), { campaign_id: 'CMP-701', amount_vnd: 300000 }, merchant.headers);
  const campaign = store.campaigns.find(c => c.id === 'CMP-701');
  const balanceBefore = campaign.balance_vnd; // may be undefined: first top-up starts from budget_monthly_vnd
  const data = { orderCode: inv.data.order_code, amount: 300000, description: inv.data.transfer_memo, code: '00', desc: 'Thành công' };
  return { store, inv: inv.data, campaign, balanceBefore, data, merchant };
}

test('PayOS sign data: sorted keys, null -> empty, undefined skipped, arrays JSON', () => {
  assert.equal(buildPayosSignData({ b: 2, a: 'x', c: null, d: undefined, e: 'null' }), 'a=x&b=2&c=&e=');
  assert.equal(buildPayosSignData({ items: [{ y: 1, x: 2 }] }), 'items=[{"x":2,"y":1}]');
  const data = { orderCode: 123, amount: 3000, description: 'VQRIO123' };
  const expected = crypto.createHmac('sha256', KEY).update('amount=3000&description=VQRIO123&orderCode=123').digest('hex');
  assert.equal(signPayosData(data, KEY), expected);
  assert.equal(verifyPaymentWebhookSignature(data, expected, KEY), true);
  assert.equal(verifyPaymentWebhookSignature(data, expected.toUpperCase(), KEY), true);
  assert.equal(verifyPaymentWebhookSignature(data, expected, ''), false, 'no key => never valid');
  assert.equal(verifyPaymentWebhookSignature(data, 'abc', KEY), false);
});

test('Unsigned webhook -> 401, no money credited', async () => {
  const { store, campaign, balanceBefore, data } = await setup();
  const res = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', q(), { code: '00', success: true, data });
  assert.equal(res.status, 401);
  // legacy flat body (what the old endpoint accepted)
  const legacy = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', q(), { orderId: 'X1', campaignId: 'CMP-701', amountVnd: 99999999 });
  assert.equal(legacy.status, 401);
  assert.equal(campaign.balance_vnd, balanceBefore);
});

test('Wrong signature or tampered amount -> 401, no money credited', async () => {
  const { store, campaign, balanceBefore, data } = await setup();
  const wrongKeySig = signPayosData(data, 'attacker-key');
  const r1 = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', q(), { code: '00', success: true, data, signature: wrongKeySig });
  assert.equal(r1.status, 401);
  const goodSig = signPayosData(data, KEY);
  const r2 = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', q(), { code: '00', success: true, data: { ...data, amount: 99999999 }, signature: goodSig });
  assert.equal(r2.status, 401);
  assert.equal(campaign.balance_vnd, balanceBefore);
});

test('No PAYOS_CHECKSUM_KEY configured -> webhook rejected (fail closed)', async () => {
  const { store, campaign, balanceBefore, data } = await setup();
  const signature = signPayosData(data, KEY);
  delete process.env.PAYOS_CHECKSUM_KEY;
  try {
    const res = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', q(), { code: '00', success: true, data, signature });
    assert.equal(res.status, 503);
    assert.equal(campaign.balance_vnd, balanceBefore);
  } finally {
    process.env.PAYOS_CHECKSUM_KEY = KEY;
  }
});

test('Valid signed webhook credits the pending order once; unknown order and wrong amount credit nothing', async () => {
  const { store, inv, campaign, balanceBefore, data, merchant } = await setup();
  const signature = signPayosData(data, KEY);
  const ok = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', q(), { code: '00', success: true, data, signature });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.credited, true);
  assert.equal(campaign.balance_vnd, (balanceBefore !== undefined ? balanceBefore : campaign.budget_monthly_vnd || 0) + 300000);
  const afterFirst = campaign.balance_vnd;
  assert.equal(store.paymentOrders[inv.order_id].status, 'COMPLETED');

  const dup = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', q(), { code: '00', success: true, data, signature });
  assert.equal(dup.data.already_processed, true);
  assert.equal(campaign.balance_vnd, afterFirst);

  const unknown = { ...data, orderCode: 42 };
  const r3 = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', q(), { code: '00', success: true, data: unknown, signature: signPayosData(unknown, KEY) });
  assert.equal(r3.status, 200);
  assert.equal(r3.data.credited, false);

  const inv2 = await handleApiRequest(store, 'POST', '/api/v1/ads/payments/vietqr/create', q(), { campaign_id: 'CMP-701', amount_vnd: 100000 }, merchant.headers);
  const cheap = { ...data, orderCode: inv2.data.order_code, amount: 1000 };
  const r4 = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', q(), { code: '00', success: true, data: cheap, signature: signPayosData(cheap, KEY) });
  assert.equal(r4.status, 409);
  assert.equal(campaign.balance_vnd, afterFirst);
});
