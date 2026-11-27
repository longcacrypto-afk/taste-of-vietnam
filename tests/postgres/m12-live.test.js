// M12 over PostgreSQL: concurrent votes are all kept (row lock), reviews and badges stored.
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

test('M12 on Postgres: poll join + concurrent votes, GPS review, badges', { skip }, async () => {
  const owner = await login('0913100101');
  const p = (await api('POST', '/api/v1/polls', owner, { title: 'Trưa nay', dish_ids: ['DISH-101', 'DISH-103'] })).data;
  const members = [];
  for (let i = 0; i < 8; i++) members.push(await login('09131002' + String(i).padStart(2, '0')));
  await Promise.all(members.map(m => api('POST', '/api/v1/polls/join', m, { code: p.code })));
  const votes = await Promise.all(members.map((m, i) => api('POST', `/api/v1/polls/${p.id}/vote`, m, { option_id: i % 2 ? 'OPT-2' : 'OPT-1' })));
  assert.ok(votes.every(v => v.status === 200));
  const r = await api('GET', `/api/v1/polls/${p.id}`, owner);
  assert.equal(r.data.members_count, 9, 'concurrent joins all kept');
  assert.equal(r.data.total_votes, 8, 'concurrent votes all kept');
  assert.equal(r.data.tie, true);

  const near = await api('POST', '/api/v1/places/PLACE-401/reviews', owner, { lat: 10.9599, lng: 106.8453, rating: 5, text: 'Ngon, sạch sẽ' });
  assert.equal(near.status, 200);
  const far = await api('POST', '/api/v1/places/PLACE-401/reviews', owner, { lat: 10.99, lng: 106.88, rating: 5, text: 'Ngon' });
  assert.equal(far.status, 400);
  const list = await api('GET', '/api/v1/places/PLACE-401/reviews', owner);
  assert.equal(list.data.items[0].id, near.data.id);

  for (let i = 0; i < 3; i++) await api('POST', '/api/v1/suggestions/feedback', owner, { dish_id: 'DISH-101', place_id: 'PLACE-401', action: 'eaten' });
  const g = await api('GET', '/api/v1/me/gamification', owner);
  assert.equal(g.data.badges.find(b => b.id === 'pho-bac').earned, true);
  assert.equal(g.data.current_streak_days, 1);
  assert.equal(Number((await db.query("SELECT COUNT(*) n FROM module_records WHERE module='M12' AND kind='badge' AND owner_id=$1", [owner.id])).rows[0].n), 1);
});
