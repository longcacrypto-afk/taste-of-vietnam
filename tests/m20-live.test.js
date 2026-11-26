// M20 live: core community recipes + what M20 adds — filters, one like per account,
// author payout account, tip-intent with a real VietQR (EMVCo + CRC) or sandbox, tipper confirmation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { guest } from './helpers/auth.js';
import { crc16ccitt, buildVietQrTransfer } from '../src/services/paymentService.js';

const q = (s = '') => new URLSearchParams(s);
const api = (store, u, m, p, body) => handleApiRequest(store, m, p.split('?')[0], q(p.split('?')[1] || ''), body, u?.headers);

test('VietQR transfer payload: EMVCo fields + CRC16-CCITT', () => {
  assert.equal(crc16ccitt('123456789'), '29B1');
  const v = buildVietQrTransfer({ bankBin: '970436', accountNumber: '0011001234567', accountName: 'NGUYEN VAN A', amountVnd: 20000, memo: 'TOV TIP ABC' });
  const raw = v.qr_emvco_raw;
  assert.ok(raw.startsWith('000201010212'));
  assert.ok(raw.includes('0010A000000727'));
  assert.ok(raw.includes('0006970436'));
  assert.ok(raw.includes('01130011001234567'));
  assert.ok(raw.includes('540520000'));
  assert.ok(raw.includes('5802VN'));
  assert.ok(raw.includes('0811TOV TIP ABC'));
  assert.equal(raw.slice(-4), crc16ccitt(raw.slice(0, -4)));
  assert.throws(() => buildVietQrTransfer({ bankBin: '999999', accountNumber: '123456', amountVnd: 1 }));
});

test('M20: list keeps { total, recipes }, marks sample recipes demo, filters q / max_minutes / zero_waste', async () => {
  const store = createInitialStore();
  const r = await api(store, null, 'GET', '/api/v1/community/recipes');
  assert.equal(r.status, 200);
  assert.equal(r.data.total, r.data.recipes.length);
  assert.ok(r.data.recipes.every(x => x.is_demo === true && x.payout_ready === false));
  assert.deepEqual((await api(store, null, 'GET', '/api/v1/community/recipes?q=dau hu')).data.recipes.map(x => x.id), ['CREC-02']);
  assert.deepEqual((await api(store, null, 'GET', '/api/v1/community/recipes?max_minutes=15')).data.recipes.map(x => x.id), ['CREC-02']);
  assert.equal((await api(store, null, 'GET', '/api/v1/community/recipes?tag=zero_waste')).data.total, 2);
  const one = await api(store, null, 'GET', '/api/v1/community/recipes/CREC-01');
  assert.equal(one.data.title, 'Cơm Chiên Kim Chi Bò Áp Chảo');
  assert.equal((await api(store, null, 'GET', '/api/v1/community/recipes/NOPE')).status, 404);
});

test('M20: one like per account', async () => {
  const store = createInitialStore();
  const a = await guest(store), b = await guest(store);
  const l1 = await api(store, a, 'POST', '/api/v1/community/recipes/CREC-01/like');
  assert.equal(l1.data.likes_count, 343);
  const l2 = await api(store, a, 'POST', '/api/v1/community/recipes/CREC-01/like');
  assert.equal(l2.data.likes_count, 343);
  assert.equal(l2.data.already_liked, true);
  assert.equal((await api(store, b, 'POST', '/api/v1/community/recipes/CREC-01/like')).data.likes_count, 344);
  assert.equal((await api(store, a, 'GET', '/api/v1/community/recipes')).data.recipes.find(x => x.id === 'CREC-01').liked_by_me, true);
  assert.equal((await api(store, null, 'POST', '/api/v1/community/recipes/CREC-01/like')).status, 401);
  assert.equal((await api(store, a, 'POST', '/api/v1/community/recipes/NOPE/like')).status, 404);
});

test('M20: tip without an author account is sandbox — no QR to pay, cannot be confirmed, counter unchanged', async () => {
  const store = createInitialStore();
  const a = await guest(store);
  assert.equal((await api(store, a, 'POST', '/api/v1/community/recipes/CREC-01/tip-intent', { amount_vnd: 500 })).status, 400);
  const t = await api(store, a, 'POST', '/api/v1/community/recipes/CREC-01/tip-intent', { amount_vnd: 20000 });
  assert.equal(t.status, 201);
  assert.equal(t.data.sandbox, true);
  assert.equal(t.data.status, 'SANDBOX');
  assert.equal(t.data.vietqr.qr_emvco_raw, null);
  const c = await api(store, a, 'POST', `/api/v1/community/tips/${t.data.tip_id}/confirm`);
  assert.equal(c.status, 409);
  assert.equal(store.communityRecipes.find(x => x.id === 'CREC-01').tips_received_vnd, 250000);
});

test('M20: author payout → real VietQR to that account; tipper confirms once; others cannot', async () => {
  const store = createInitialStore();
  const author = await guest(store), fan = await guest(store), other = await guest(store);
  assert.equal((await api(store, author, 'PUT', '/api/v1/community/payout-account', { bank_bin: '123', account_number: '1', account_name: 'X' })).status, 400);
  const p = await api(store, author, 'PUT', '/api/v1/community/payout-account', { bank_bin: '970436', account_number: '0011001234567', account_name: 'Nguyễn Văn A' });
  assert.equal(p.data.payout.account_name, 'NGUYEN VAN A');
  assert.equal(p.data.payout.account_number_masked, '•••• 4567');
  assert.ok(!JSON.stringify(p.data).includes('0011001234567'), 'full number not echoed');
  const rec = await api(store, author, 'POST', '/api/v1/community/recipes', { title: 'Gà kho gừng', ingredients: ['Gà 500g'] });
  assert.equal((await api(store, author, 'POST', `/api/v1/community/recipes/${rec.data.id}/tip-intent`, { amount_vnd: 20000 })).status, 400, 'no self-tip');
  const list = await api(store, fan, 'GET', '/api/v1/community/recipes');
  assert.equal(list.data.recipes.find(x => x.id === rec.data.id).payout_ready, true);
  const t = await api(store, fan, 'POST', `/api/v1/community/recipes/${rec.data.id}/tip-intent`, { amount_vnd: 50000 });
  assert.equal(t.data.sandbox, false);
  assert.equal(t.data.status, 'PENDING_TRANSFER');
  assert.equal(t.data.vietqr.bank_name, 'Vietcombank');
  assert.ok(t.data.vietqr.qr_emvco_raw.includes('01130011001234567'));
  assert.equal(store.communityRecipes.find(x => x.id === rec.data.id).tips_received_vnd, 0, 'QR alone moves nothing');
  assert.equal((await api(store, other, 'POST', `/api/v1/community/tips/${t.data.tip_id}/confirm`)).status, 403);
  const c = await api(store, fan, 'POST', `/api/v1/community/tips/${t.data.tip_id}/confirm`);
  assert.equal(c.data.status, 'CONFIRMED_BY_TIPPER');
  assert.equal(c.data.total_tips_vnd, 50000);
  assert.match(c.data.note, /không đối soát/);
  const again = await api(store, fan, 'POST', `/api/v1/community/tips/${t.data.tip_id}/confirm`);
  assert.equal(again.data.already_confirmed, true);
  assert.equal(again.data.total_tips_vnd, 50000);
  assert.equal((await api(store, fan, 'GET', '/api/v1/community/tips')).data.total, 1);
  assert.equal((await api(store, null, 'GET', '/api/v1/community/payout-account')).status, 401);
});

test('M20: legacy one-step POST /tip stays in the core router (unchanged)', async () => {
  const store = createInitialStore();
  const a = await guest(store);
  const r = await api(store, a, 'POST', '/api/v1/community/recipes/CREC-02/tip', { amount_vnd: 20000 });
  assert.equal(r.status, 200);
  assert.equal(r.data.total_tips_vnd, 440000);
});
