// M13 over PostgreSQL: slot capacity holds under concurrent bookings; a voucher is spent once.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';
import { initRepository } from '../../src/db/repository.js';
import { moduleStore } from '../../src/modules/moduleStore.js';
import { skip, resetDatabase, rawPool, TEST_DATABASE_URL } from './helpers.js';

process.env.MERCHANT_PHONES = [process.env.MERCHANT_PHONES, '0900000902'].filter(Boolean).join(',');
let store, db;
const api = (method, path, who, body = {}, query = '') => handleApiRequest(store, method, path, new URLSearchParams(query), body, who?.headers || {});
async function login(phone) {
  const r = await api('POST', '/api/v1/auth/otp/request', null, { phone });
  const v = await api('POST', '/api/v1/auth/otp/verify', null, { phone, code: r.data.dev_code });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return { headers: { authorization: `Bearer ${v.data.access_token}` }, id: v.data.user.id };
}
const vnDate = (plusDays = 0) => new Date(Date.now() + 7 * 3600000 + plusDays * 86400000).toISOString().slice(0, 10);
before(async () => {
  if (skip) return;
  await resetDatabase();
  store = createInitialStore();
  await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
  db = rawPool();
});
after(async () => {
  if (skip) return;
  await db.end();
  await store.repo.pool.end();
});

test('M13 on Postgres: concurrent bookings never exceed the slot capacity; cancel frees a table', { skip }, async () => {
  const users = [];
  for (let i = 0; i < 7; i++) users.push(await login('09132001' + String(i).padStart(2, '0')));
  const date = vnDate(1);
  const res = await Promise.all(users.map(u => api('POST', '/api/v1/bookings', u, { place_id: 'PLACE-403', date, time: '18:00', party_size: 2 })));
  assert.equal(res.filter(r => r.status === 200).length, 4, 'PLACE-403 has 4 tables per slot');
  assert.equal(res.filter(r => r.status === 409).length, 3);
  const slots = await api('GET', '/api/v1/bookings/slots', users[0], {}, `place_id=PLACE-403&date=${date}`);
  assert.equal(slots.data.slots.find(s => s.time === '18:00').remaining_tables, 0);
  const winner = res.findIndex(r => r.status === 200);
  assert.equal((await api('DELETE', `/api/v1/bookings/${res[winner].data.id}`, users[winner])).status, 200);
  const loser = res.findIndex(r => r.status === 409);
  assert.equal((await api('POST', '/api/v1/bookings', users[loser], { place_id: 'PLACE-403', date, time: '18:00', party_size: 2 })).status, 200);
});

test('M13 on Postgres: a voucher redeemed twice at once is spent once (sandbox payment only)', { skip }, async () => {
  const u = await login('0913300101');
  const saved = await api('POST', '/api/v1/vouchers/VC-PHATTAI-30K/save', u);
  assert.equal(saved.status, 201);
  const both = await Promise.all([1, 2, 3].map(() => api('POST', '/api/v1/vouchers/redeem', u, { wallet_id: saved.data.wallet_id, bill_vnd: 180000, method: 'momo' })));
  assert.equal(both.filter(r => r.status === 200).length, 1);
  assert.equal(both.filter(r => r.status === 409).length, 2);
  const ok = both.find(r => r.status === 200);
  assert.equal(ok.data.payment.money_moved, false);
  assert.equal(Number((await db.query("SELECT COUNT(*) n FROM module_records WHERE module='M13' AND kind='payment' AND owner_id=$1 AND (data->>'sandbox')::boolean", [u.id])).rows[0].n), 1);
});
