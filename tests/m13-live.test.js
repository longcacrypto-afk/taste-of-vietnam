// M13 live: slots per place with capacity, instant booking, edit/cancel by the owner,
// voucher wallet with signed QR payload, MoMo/ZaloPay sandbox redeem (no money moves).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { login, loginMerchant } from './helpers/auth.js';

const q = (s = '') => new URLSearchParams(s);
const hit = (store, m, p, who, body = {}, qs = '') => handleApiRequest(store, m, p, q(qs), body, who?.headers || {});
const vnDate = (plusDays = 0) => new Date(Date.now() + 7 * 3600000 + plusDays * 86400000).toISOString().slice(0, 10);

test('M13-S01: bookable places and slots; booking is confirmed instantly and fills capacity', async () => {
  const store = createInitialStore();
  const users = [];
  for (let i = 0; i < 6; i++) users.push(await login(store, '091220010' + i));
  const [u] = users;
  const places = await hit(store, 'GET', '/api/v1/bookings/places', u);
  assert.equal(places.status, 200);
  assert.ok(places.data.items.some(p => p.place_id === 'PLACE-403'));
  assert.ok(!places.data.items.some(p => p.place_id === 'PLACE-405'), 'paused place not bookable');
  const date = vnDate(1);
  const slots = await hit(store, 'GET', '/api/v1/bookings/slots', u, {}, `place_id=PLACE-403&date=${date}&party_size=2`);
  assert.equal(slots.status, 200);
  assert.ok(slots.data.slots.some(s => s.time === '19:00' && s.remaining_tables === 4));
  assert.ok(slots.data.slots.every(s => s.time >= '10:30' && s.time <= '20:30'));
  assert.equal(slots.data.is_demo, true);

  const bk = await hit(store, 'POST', '/api/v1/bookings', u, { place_id: 'PLACE-403', date, time: '19:00', party_size: 4, has_baby_chair: true, note: 'Gần cửa sổ' });
  assert.equal(bk.status, 200);
  assert.equal(bk.data.status, 'confirmed_instant');
  assert.match(bk.data.code, /^BK-[0-9A-F]{6}$/);
  assert.equal(bk.data.confirmation.sandbox, true);
  assert.equal(bk.data.confirmation.sent, false, 'no Zalo/SMS is claimed');
  assert.equal((await hit(store, 'POST', '/api/v1/bookings', u, { place_id: 'PLACE-403', date, time: '19:00', party_size: 2 })).status, 409, 'same user, same slot');
  for (const x of users.slice(1, 4)) assert.equal((await hit(store, 'POST', '/api/v1/bookings', x, { place_id: 'PLACE-403', date, time: '19:00', party_size: 2 })).status, 200);
  const full = await hit(store, 'POST', '/api/v1/bookings', users[4], { place_id: 'PLACE-403', date, time: '19:00', party_size: 2 });
  assert.equal(full.status, 409, '4 tables per slot at PLACE-403');
  const s2 = await hit(store, 'GET', '/api/v1/bookings/slots', u, {}, `place_id=PLACE-403&date=${date}`);
  assert.equal(s2.data.slots.find(s => s.time === '19:00').available, false);

  // Cancel frees the table; only the owner may cancel.
  assert.equal((await hit(store, 'DELETE', `/api/v1/bookings/${bk.data.id}`, users[5])).status, 403);
  const del = await hit(store, 'DELETE', `/api/v1/bookings/${bk.data.id}`, u);
  assert.equal(del.data.cancelled, true);
  assert.equal(del.data.status, 'cancelled');
  assert.equal((await hit(store, 'DELETE', `/api/v1/bookings/${bk.data.id}`, u)).status, 409);
  assert.equal((await hit(store, 'POST', '/api/v1/bookings', users[4], { place_id: 'PLACE-403', date, time: '19:00', party_size: 2 })).status, 200);
  assert.equal((await hit(store, 'DELETE', '/api/v1/bookings/BK-NOPE', u)).status, 404);
  const mine = await hit(store, 'GET', '/api/v1/bookings', users[1]);
  assert.equal(mine.data.bookings.length, 1);
  assert.ok(mine.data.bookings.every(b => b.place_id === 'PLACE-403'));
});

test('M13-S01: validation — amenities, party size, dates, slot times, auth', async () => {
  const store = createInitialStore();
  const u = await login(store, '0912200201');
  const date = vnDate(2);
  const post = body => hit(store, 'POST', '/api/v1/bookings', u, { place_id: 'PLACE-401', date, time: '12:00', party_size: 2, ...body });
  assert.equal((await post({ place_id: 'PLACE-403', ac_room: true })).status, 400, 'O Xuân has no AC room');
  assert.equal((await post({ party_size: 13 })).status, 400, 'max 12 at PLACE-401');
  assert.equal((await post({ party_size: 0 })).status, 400);
  assert.equal((await post({ date: vnDate(-1) })).status, 400);
  assert.equal((await post({ date: vnDate(20) })).status, 400);
  assert.equal((await post({ time: '12:15' })).status, 400);
  assert.equal((await post({ time: '15:00' })).status, 409, 'outside lunch/dinner windows');
  assert.equal((await post({ place_id: 'PLACE-405' })).status, 404);
  assert.equal((await post({ place_id: 'PLACE-404' })).status, 404, 'no booking config');
  assert.equal((await hit(store, 'POST', '/api/v1/bookings', null, { place_id: 'PLACE-401', date, time: '12:00', party_size: 2 })).status, 401);
  const ok = await post({});
  assert.equal(ok.status, 200);
  const moved = await hit(store, 'PATCH', `/api/v1/bookings/${ok.data.id}`, u, { time: '18:30', party_size: 6 });
  assert.equal(moved.status, 200);
  assert.equal(moved.data.time, '18:30');
  assert.equal(moved.data.party_size, 6);
  const slots = await hit(store, 'GET', '/api/v1/bookings/slots', u, {}, `place_id=PLACE-401&date=${date}`);
  assert.equal(slots.data.slots.find(s => s.time === '12:00').remaining_tables, 6, 'old slot released');
  assert.equal(slots.data.slots.find(s => s.time === '18:30').remaining_tables, 5);
});

test('M13-S02: voucher wallet, signed QR, sandbox MoMo payment, single use, counter verify', async () => {
  const store = createInitialStore();
  const anon = await hit(store, 'GET', '/api/v1/vouchers');
  assert.equal(anon.status, 200);
  assert.ok(anon.data.vouchers.length >= 4);
  assert.ok(anon.data.vouchers.every(v => v.qr_payload === null && v.is_demo));
  const u = await login(store, '0912200301');
  const other = await login(store, '0912200302');
  assert.equal((await hit(store, 'POST', '/api/v1/vouchers/VC-PHATTAI-30K/save', null)).status, 401);
  const saved = await hit(store, 'POST', '/api/v1/vouchers/VC-PHATTAI-30K/save', u);
  assert.equal(saved.status, 201);
  assert.match(saved.data.qr_payload, /^TOV1:VC:VW-[0-9A-F]{8}:PHATTAI30K:[0-9A-F]{12}$/);
  assert.equal((await hit(store, 'POST', '/api/v1/vouchers/VC-PHATTAI-30K/save', u)).data.already_saved, true);
  assert.equal((await hit(store, 'POST', '/api/v1/vouchers/VC-NOPE/save', u)).status, 404);
  const wallet = (await hit(store, 'GET', '/api/v1/vouchers', u)).data.wallet;
  assert.equal(wallet.length, 1);
  const wid = saved.data.wallet_id;

  assert.equal((await hit(store, 'POST', '/api/v1/vouchers/redeem', other, { wallet_id: wid, bill_vnd: 200000 })).status, 403);
  assert.equal((await hit(store, 'POST', '/api/v1/vouchers/redeem', u, { wallet_id: wid, bill_vnd: 100000 })).status, 400, 'below minimum bill');
  assert.equal((await hit(store, 'POST', '/api/v1/vouchers/redeem', u, { wallet_id: wid, bill_vnd: 200000, place_id: 'PLACE-403' })).status, 400, 'wrong place');
  assert.equal((await hit(store, 'POST', '/api/v1/vouchers/redeem', u, { wallet_id: wid, bill_vnd: 200000, method: 'bitcoin' })).status, 400);

  // Counter check before use (merchant only).
  const merchant = await loginMerchant(store);
  assert.equal((await hit(store, 'POST', '/api/v1/vouchers/verify', u, { qr_payload: saved.data.qr_payload })).status, 403);
  const ver = await hit(store, 'POST', '/api/v1/vouchers/verify', merchant, { qr_payload: saved.data.qr_payload });
  assert.equal(ver.data.valid, true);
  const forged = saved.data.qr_payload.replace(/[0-9A-F]{12}$/, '000000000000');
  assert.equal((await hit(store, 'POST', '/api/v1/vouchers/verify', merchant, { qr_payload: forged })).data.valid, false);

  const red = await hit(store, 'POST', '/api/v1/vouchers/redeem', u, { wallet_id: wid, bill_vnd: 200000, method: 'momo', place_id: 'PLACE-401' });
  assert.equal(red.status, 200);
  assert.equal(red.data.discount_vnd, 30000);
  assert.equal(red.data.payable_vnd, 170000);
  assert.equal(red.data.payment.sandbox, true);
  assert.equal(red.data.payment.money_moved, false);
  assert.match(red.data.payment.message, /sandbox/);
  assert.equal((await hit(store, 'POST', '/api/v1/vouchers/redeem', u, { wallet_id: wid, bill_vnd: 200000 })).status, 409, 'single use');
  assert.equal((await hit(store, 'POST', '/api/v1/vouchers/verify', merchant, { qr_payload: saved.data.qr_payload })).data.valid, false);
  const after = (await hit(store, 'GET', '/api/v1/vouchers', u)).data.vouchers.find(v => v.id === 'VC-PHATTAI-30K');
  assert.equal(after.wallet_status, 'used');
  assert.equal(after.qr_payload, null);

  // Percent voucher with a cap, ZaloPay sandbox; gift voucher pays the full bill.
  const pct = await hit(store, 'POST', '/api/v1/vouchers/VC-BANHXEO-15/save', u);
  const r2 = await hit(store, 'POST', '/api/v1/vouchers/redeem', u, { wallet_id: pct.data.wallet_id, bill_vnd: 400000, method: 'zalopay' });
  assert.equal(r2.data.discount_vnd, 40000);
  assert.equal(r2.data.payment.provider, 'zalopay');
  const gift = await hit(store, 'POST', '/api/v1/vouchers/VC-OXUAN-DRINK/save', u);
  const r3 = await hit(store, 'POST', '/api/v1/vouchers/redeem', u, { wallet_id: gift.data.wallet_id, bill_vnd: 120000 });
  assert.equal(r3.data.discount_vnd, 0);
  assert.equal(r3.data.gift, '2 ly nước sâm dứa');
  assert.equal(r3.data.payment, null, 'cash at the counter');
});

test('M13: bookings and wallet are personal data (export + deletion)', async () => {
  const store = createInitialStore();
  const u = await login(store, '0912200401');
  await hit(store, 'POST', '/api/v1/bookings', u, { place_id: 'PLACE-401', date: vnDate(3), time: '19:00', party_size: 2 });
  await hit(store, 'POST', '/api/v1/vouchers/VC-ANLANH-20K/save', u);
  const ex = await hit(store, 'GET', '/api/v1/me/export', u);
  const text = JSON.stringify(ex.data);
  assert.ok(text.includes('"M13"') && text.includes('booking') && text.includes('wallet'));
  await hit(store, 'DELETE', '/api/v1/me', u);
  assert.ok(!store.moduleRecords.some(r => r.owner_id === u.user.id));
});
