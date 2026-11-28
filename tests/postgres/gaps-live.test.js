// Gaps over PostgreSQL: M6 claim approval creates the membership; PDPD delete removes the
// user's memberships; M13 slot holds are released when the booking owner's account is deleted.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';
import { initRepository } from '../../src/db/repository.js';
import { skip, resetDatabase, rawPool, TEST_DATABASE_URL } from './helpers.js';

process.env.ADMIN_PHONES = [process.env.ADMIN_PHONES, '0900000951'].filter(Boolean).join(',');
process.env.MERCHANT_PHONES = [process.env.MERCHANT_PHONES, '0900000952'].filter(Boolean).join(',');
let store, db;
const api = (method, path, who, body = {}, query = '') => handleApiRequest(store, method, path, new URLSearchParams(query), body, who?.headers || {});
async function login(phone) {
  const r = await api('POST', '/api/v1/auth/otp/request', null, { phone });
  const v = await api('POST', '/api/v1/auth/otp/verify', null, { phone, code: r.data.dev_code });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return { headers: { authorization: `Bearer ${v.data.access_token}` }, id: v.data.user.id, role: v.data.role };
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
const row = async id => (await db.query('SELECT * FROM module_records WHERE id=$1', [id])).rows[0];

test('Gaps on Postgres: admin approves a claim → owner membership; PDPD delete removes it', { skip }, async () => {
  const admin = await login('0900000951');
  assert.equal(admin.role, 'super_admin');
  const m = await login('0900000952');
  const claim = (await api('POST', '/api/v1/merchant/claim', m, { place_id: 'PLACE-403' })).data;
  assert.equal((await api('POST', `/api/v1/merchant/admin/claims/${claim.id}/approve`, m)).status, 403);
  const list = await api('GET', '/api/v1/merchant/admin/claims', admin);
  assert.ok(list.data.items.some(i => i.id === claim.id));
  // Two approvals at once: exactly one wins.
  const both = await Promise.all([1, 2].map(() => api('POST', `/api/v1/merchant/admin/claims/${claim.id}/approve`, admin)));
  assert.deepEqual(both.map(r => r.status).sort(), [200, 409]);
  const memId = both.find(r => r.status === 200).data.membership.id;
  const mem = await row(memId);
  assert.equal(mem.kind, 'membership');
  assert.equal(mem.data.user_id, m.id);
  assert.equal(mem.is_demo, false);
  assert.equal((await db.query("SELECT count(*)::int n FROM module_records WHERE kind='membership' AND data->>'claim_id'=$1", [claim.id])).rows[0].n, 1);
  const me = await api('GET', '/api/v1/merchant/me', m);
  assert.deepEqual(me.data.places.map(p => p.id), ['PLACE-403']);

  assert.equal((await api('DELETE', '/api/v1/me', m)).status, 200);
  assert.equal(await row(memId), undefined);
  assert.equal(await row(claim.id), undefined);
  assert.ok(await row('M6-MEM-TAI'), 'demo memberships of others stay');
});

test('Gaps on Postgres: deleting the booking owner releases the held table', { skip }, async () => {
  const date = vnDate(2);
  const users = [];
  for (let i = 0; i < 5; i++) users.push(await login('09135001' + String(i).padStart(2, '0')));
  const res = await Promise.all(users.slice(0, 4).map(u => api('POST', '/api/v1/bookings', u, { place_id: 'PLACE-403', date, time: '19:00', party_size: 2 })));
  assert.ok(res.every(r => r.status === 200));
  assert.equal((await api('POST', '/api/v1/bookings', users[4], { place_id: 'PLACE-403', date, time: '19:00', party_size: 2 })).status, 409);
  const cntId = `M13-CNT-PLACE-403-${date}-1900`;
  const cnt = await row(cntId);
  assert.equal(cnt.data.n, 4);
  assert.equal(Object.keys(cnt.data.holds).length, 4);
  assert.equal(cnt.data.holds[res[0].data.id], users[0].id);
  assert.equal((await api('DELETE', `/api/v1/bookings/${res[0].data.id}`, users[1])).status, 403);
  assert.equal((await api('DELETE', '/api/v1/me', users[0])).status, 200);
  const after = await row(cntId);
  assert.equal(after.data.n, 3);
  assert.equal(after.data.holds[res[0].data.id], undefined);
  assert.equal(await row(res[0].data.id), undefined);
  assert.equal((await api('POST', '/api/v1/bookings', users[4], { place_id: 'PLACE-403', date, time: '19:00', party_size: 2 })).status, 200);
});
