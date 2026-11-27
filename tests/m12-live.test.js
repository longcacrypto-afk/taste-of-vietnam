// M12 live: group poll with share code + combined allergy hard filter, streak & badges from
// the real eaten history, GPS-verified reviews (≤ 500 m) stored and listed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { login } from './helpers/auth.js';

const q = (s = '') => new URLSearchParams(s);
const hit = (store, m, p, who, body = {}, qs = '') => handleApiRequest(store, m, p, q(qs), body, who?.headers || {});

test('M12-S01: create room, join by code, allergy of a member blocks options, vote and results', async () => {
  const store = createInitialStore();
  const a = await login(store, '0912100101');
  const b = await login(store, '0912100102');
  const c = await login(store, '0912100103');
  await hit(store, 'PUT', '/api/v1/me/profile', b, { hard_allergies: ['egg'] });
  const created = await hit(store, 'POST', '/api/v1/polls', a, { title: 'Trưa nay ăn gì?', dish_ids: ['DISH-101', 'DISH-102', 'DISH-103'] });
  assert.equal(created.status, 201);
  const p = created.data;
  assert.match(p.code, /^[A-Z0-9]{6}$/);
  assert.equal(p.members_count, 1);
  assert.ok(p.options.every(o => !o.blocked));

  assert.equal((await hit(store, 'GET', `/api/v1/polls/${p.id}`, b)).status, 403, 'not a member yet');
  assert.equal((await hit(store, 'POST', `/api/v1/polls/${p.id}/vote`, b, { option_id: 'OPT-1' })).status, 403);
  assert.equal((await hit(store, 'POST', '/api/v1/polls/join', b, { code: 'ZZZZZZ' })).status, 404);
  const joined = await hit(store, 'POST', '/api/v1/polls/join', b, { code: p.code.toLowerCase() });
  assert.equal(joined.status, 200);
  assert.equal(joined.data.members_count, 2);
  assert.deepEqual(joined.data.combined_allergies.map(x => x.tag), ['egg']);
  const egg = joined.data.options.find(o => o.dish_id === 'DISH-102');
  assert.equal(egg.blocked, true, 'cơm tấm (egg) is removed for the whole room');
  assert.equal((await hit(store, 'POST', `/api/v1/polls/${p.id}/vote`, a, { option_id: egg.id })).status, 409);

  assert.equal((await hit(store, 'POST', `/api/v1/polls/${p.id}/vote`, a, { option_id: 'OPT-1' })).status, 200);
  await hit(store, 'POST', `/api/v1/polls/${p.id}/vote`, b, { dish_id: 'DISH-103' });
  await hit(store, 'POST', '/api/v1/polls/join', c, { code: p.code });
  const r = await hit(store, 'POST', `/api/v1/polls/${p.id}/vote`, c, { option_id: 'OPT-1' });
  assert.equal(r.data.total_votes, 3);
  assert.equal(r.data.leader.dish_id, 'DISH-101');
  assert.equal(r.data.options.find(o => o.dish_id === 'DISH-101').pct, 67);
  assert.equal(r.data.my_vote, 'OPT-1');
  // Changing a vote replaces it.
  const ch = await hit(store, 'POST', `/api/v1/polls/${p.id}/vote`, c, { option_id: 'OPT-3' });
  assert.equal(ch.data.total_votes, 3);
  assert.equal(ch.data.leader.dish_id, 'DISH-103');
  assert.equal(ch.data.members.some(m => 'user_id' in m || 'allergies' in m), false, 'no member ids or allergies exposed');

  assert.equal((await hit(store, 'POST', `/api/v1/polls/${p.id}/close`, b)).status, 403);
  const closed = await hit(store, 'POST', `/api/v1/polls/${p.id}/close`, a);
  assert.equal(closed.data.status, 'closed');
  assert.equal((await hit(store, 'POST', `/api/v1/polls/${p.id}/vote`, a, { option_id: 'OPT-1' })).status, 409);
  const mine = await hit(store, 'GET', '/api/v1/polls', b);
  assert.ok(mine.data.items.some(x => x.id === p.id));
  assert.equal((await hit(store, 'GET', '/api/v1/polls', null)).status, 401);
});

test('M12-S01: options must be safe for the creator; auto options; demo room is joinable', async () => {
  const store = createInitialStore();
  const a = await login(store, '0912100104');
  await hit(store, 'PUT', '/api/v1/me/profile', a, { hard_allergies: ['shrimp'] });
  const bad = await hit(store, 'POST', '/api/v1/polls', a, { title: 'X', dish_ids: ['DISH-101', 'DISH-106'] });
  assert.equal(bad.status, 422, 'bún riêu tôm is not safe for a shrimp allergy');
  assert.equal((await hit(store, 'POST', '/api/v1/polls', a, { title: '' })).status, 400);
  const auto = await hit(store, 'POST', '/api/v1/polls', a, { title: 'Tối nay', meal_slot: 'dinner' });
  assert.equal(auto.status, 201);
  const byId = new Map(store.dishes.map(d => [d.id, d]));
  assert.ok(auto.data.options.length >= 2);
  assert.ok(auto.data.options.every(o => !byId.get(o.dish_id).allergen_tags.includes('shrimp')));
  const list = await hit(store, 'GET', '/api/v1/polls', a);
  const demo = list.data.items.find(x => x.is_demo);
  assert.ok(demo && demo.code === 'BH2611' && !demo.is_member);
  const j = await hit(store, 'POST', '/api/v1/polls/join', a, { code: 'BH2611' });
  assert.equal(j.status, 200);
  assert.ok(j.data.is_member);
});

test('M12-S02: streak, level and badges come from the eaten history', async () => {
  const store = createInitialStore();
  const u = await login(store, '0912100105');
  const empty = await hit(store, 'GET', '/api/v1/me/gamification', u);
  assert.equal(empty.status, 200);
  assert.equal(empty.data.current_streak_days, 0);
  assert.equal(empty.data.earned_count, 0);
  for (const [dish, place] of [['DISH-101', 'PLACE-401'], ['DISH-101', 'PLACE-401'], ['DISH-101', 'PLACE-405'], ['DISH-103', 'PLACE-403'], ['DISH-102', 'PLACE-402']])
    assert.equal((await hit(store, 'POST', '/api/v1/suggestions/feedback', u, { dish_id: dish, place_id: place, action: 'eaten' })).status, 200);
  await hit(store, 'POST', '/api/v1/suggestions/feedback', u, { dish_id: 'DISH-104', action: 'skipped' });
  const g = await hit(store, 'GET', '/api/v1/me/gamification', u);
  assert.equal(g.data.total_meals, 5, 'skipped meals do not count');
  assert.equal(g.data.current_streak_days, 1);
  assert.equal(g.data.level, 2);
  const badge = id => g.data.badges.find(b => b.id === id);
  assert.equal(badge('pho-bac').earned, true);
  assert.equal(badge('ba-mien').earned, true);
  assert.equal(badge('tho-dia-bien-hoa').progress, 4);
  assert.equal(badge('tho-dia-bien-hoa').earned, false);
  assert.ok(badge('pho-bac').earned_at);
  // Earned badges are stored once with their first date.
  const again = await hit(store, 'GET', '/api/v1/me/gamification', u);
  assert.equal(again.data.badges.find(b => b.id === 'pho-bac').earned_at, badge('pho-bac').earned_at);
  assert.equal(store.moduleRecords.filter(r => r.module === 'M12' && r.kind === 'badge' && r.owner_id === u.user.id).length, 2);
  assert.equal(g.data.week.meals, 5);
  assert.equal(g.data.week.spent_vnd, 45000 * 3 + 50000 + 40000);
  assert.equal((await hit(store, 'GET', '/api/v1/me/gamification', null)).status, 401);
});

test('M12-S03: GPS review accepted within 500 m, rejected beyond, stored and listed', async () => {
  const store = createInitialStore();
  const u = await login(store, '0912100106');
  const other = await login(store, '0912100107');
  const list0 = await hit(store, 'GET', '/api/v1/places/PLACE-401/reviews');
  assert.equal(list0.status, 200);
  assert.ok(list0.data.items.length >= 2 && list0.data.items.every(r => r.is_demo && r.verified));
  // PLACE-401 is at 10.9598, 106.8452
  const near = await hit(store, 'POST', '/api/v1/places/PLACE-401/reviews', u, { lat: 10.9601, lng: 106.8455, rating: 5, text: 'Nước dùng ngọt thanh!' });
  assert.equal(near.status, 200);
  assert.equal(near.data.verified, true);
  assert.ok(near.data.distance_m <= 500);
  const far = await hit(store, 'POST', '/api/v1/places/PLACE-401/reviews', other, { lat: 11.005, lng: 106.89, rating: 1, text: 'Tệ' });
  assert.equal(far.status, 400);
  assert.equal(far.data.verified, false);
  assert.equal(far.data.status, 'rejected_distance');
  assert.ok(far.data.distance_m > 500);
  assert.equal((await hit(store, 'POST', '/api/v1/places/PLACE-401/reviews', other, { rating: 5, text: 'Ngon' })).status, 400, 'no GPS = no review');
  assert.equal((await hit(store, 'POST', '/api/v1/places/PLACE-401/reviews', other, { lat: 10.9598, lng: 106.8452, rating: 9, text: 'Ngon' })).status, 400);
  assert.equal((await hit(store, 'POST', '/api/v1/places/PLACE-401/reviews', other, { lat: 10.9598, lng: 106.8452, rating: 4, text: '' })).status, 400);
  assert.equal((await hit(store, 'POST', '/api/v1/places/PLACE-999/reviews', other, { lat: 10.9598, lng: 106.8452, rating: 4, text: 'Ngon' })).status, 404);
  assert.equal((await hit(store, 'POST', '/api/v1/places/PLACE-401/reviews', u, { lat: 10.9601, lng: 106.8455, rating: 4, text: 'Lần hai' })).status, 409, 'one review per place per day');
  assert.equal((await hit(store, 'POST', '/api/v1/places/PLACE-401/reviews', null, { lat: 10.96, lng: 106.84, rating: 4, text: 'x' })).status, 401);
  const alias = await hit(store, 'POST', '/api/v1/reviews/gps', other, { place_id: 'PLACE-403', lat: 10.9531, lng: 106.8391, rating: 5, text: 'Bún bò chuẩn vị' });
  assert.equal(alias.status, 200);
  const list = await hit(store, 'GET', '/api/v1/places/PLACE-401/reviews', u);
  assert.equal(list.data.items[0].id, near.data.id);
  assert.equal(list.data.items[0].is_mine, true);
  assert.equal(list.data.total, list0.data.total + 1);
  assert.equal((await hit(store, 'DELETE', `/api/v1/reviews/${near.data.id}`, other)).status, 403);
  assert.equal((await hit(store, 'GET', '/api/v1/reviews/mine', u)).data.total, 1);
  assert.equal((await hit(store, 'DELETE', `/api/v1/reviews/${near.data.id}`, u)).status, 200);
});
