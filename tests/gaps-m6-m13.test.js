// Gaps: M6 claim approval by admins (M9-S04), PDPD deletion removes M6 memberships,
// M13 slot holds carry the booking owner and are released when that account is deleted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { login, loginAdmin, loginMerchant } from './helpers/auth.js';

const CLAIMANT = '0900000071', OTHER = '0900000072', STAFF = '0900000003';
process.env.MERCHANT_PHONES = [process.env.MERCHANT_PHONES, CLAIMANT, OTHER, STAFF].filter(Boolean).join(',');
const q = (s = '') => new URLSearchParams(s);
const api = (store, who, method, path, body = {}, search = '') => handleApiRequest(store, method, '/api/v1' + path, q(search), body, who?.headers || {});
const vnDate = (plusDays = 0) => new Date(Date.now() + 7 * 3600000 + plusDays * 86400000).toISOString().slice(0, 10);

test('M6 claim: only admins list/approve/reject; approval creates the owner membership', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const c = await login(store, CLAIMANT);
  const other = await login(store, OTHER);
  const claim = (await api(store, c, 'POST', '/merchant/claim', { place_id: 'PLACE-403', note: 'Chủ quán O Xuân' })).data;
  assert.equal(claim.status, 'pending_review');
  const claim2 = (await api(store, other, 'POST', '/merchant/claim', { place_id: 'PLACE-403' })).data;

  // Not an admin → 403 (merchant / claimant); no token → 401.
  assert.equal((await api(store, c, 'GET', '/merchant/admin/claims')).status, 403);
  assert.equal((await api(store, c, 'POST', `/merchant/admin/claims/${claim.id}/approve`)).status, 403);
  assert.equal((await api(store, await loginMerchant(store), 'POST', `/merchant/admin/claims/${claim.id}/approve`)).status, 403);
  assert.equal((await api(store, null, 'GET', '/merchant/admin/claims')).status, 401);

  const list = await api(store, admin, 'GET', '/merchant/admin/claims');
  assert.equal(list.status, 200);
  assert.deepEqual(list.data.items.map(i => i.id).sort(), [claim.id, claim2.id].sort());
  const item = list.data.items.find(i => i.id === claim.id);
  assert.equal(item.place_name.length > 0, true);
  assert.match(item.claimant.phone_masked, /^09\d\*{4}\d{3}$/);

  // Before approval the claimant has no access.
  assert.equal((await api(store, c, 'GET', '/merchant/overview', {}, 'place_id=PLACE-403')).status, 403);
  const ok = await api(store, admin, 'POST', `/merchant/admin/claims/${claim.id}/approve`);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.claim.status, 'approved');
  assert.equal(ok.data.membership.role, 'owner');
  assert.deepEqual(ok.data.membership.place_ids, ['PLACE-403']);
  const mem = store.moduleRecords.find(r => r.id === ok.data.membership.id);
  assert.equal(mem.data.user_id, c.user.id);
  assert.equal(mem.data.claim_id, claim.id);
  assert.equal(mem.is_demo, false);
  const me = await api(store, c, 'GET', '/merchant/me');
  assert.deepEqual(me.data.places.map(p => [p.id, p.role]), [['PLACE-403', 'owner']]);
  assert.equal((await api(store, c, 'GET', '/merchant/overview', {}, 'place_id=PLACE-403')).status, 200);

  // Twice → 409; the competing claim for an owned place cannot be approved, only rejected (with reason).
  assert.equal((await api(store, admin, 'POST', `/merchant/admin/claims/${claim.id}/approve`)).status, 409);
  assert.equal((await api(store, admin, 'POST', `/merchant/admin/claims/${claim2.id}/approve`)).status, 409);
  assert.equal((await api(store, admin, 'POST', `/merchant/admin/claims/${claim2.id}/reject`, { reason: '' })).status, 400);
  const rej = await api(store, admin, 'POST', `/merchant/admin/claims/${claim2.id}/reject`, { reason: 'Giấy phép kinh doanh không khớp' });
  assert.equal(rej.status, 200);
  assert.equal(rej.data.claim.status, 'rejected');
  assert.equal((await api(store, other, 'GET', '/merchant/me')).data.places.length, 0);
  assert.equal((await api(store, admin, 'GET', '/merchant/admin/claims')).data.items.length, 0, 'queue only shows pending');
  assert.equal((await api(store, admin, 'GET', '/merchant/admin/claims', {}, 'status=all')).data.items.length, 2);
  assert.equal((await api(store, admin, 'POST', '/merchant/admin/claims/NOPE/approve')).status, 404);
});

test('M6 claim: a place that already has an owner (demo Tài, PLACE-401) is not handed over', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const c = await login(store, CLAIMANT);
  const claim = (await api(store, c, 'POST', '/merchant/claim', { place_id: 'PLACE-401' })).data;
  const r = await api(store, admin, 'POST', `/merchant/admin/claims/${claim.id}/approve`);
  assert.equal(r.status, 409);
  assert.equal(store.moduleRecords.find(x => x.id === claim.id).data.status, 'pending_review');
});

test('PDPD delete: removes the user\'s M6 memberships (linked by user id and unlinked phone invites)', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const c = await login(store, CLAIMANT);
  const claim = (await api(store, c, 'POST', '/merchant/claim', { place_id: 'PLACE-403' })).data;
  const mem = (await api(store, admin, 'POST', `/merchant/admin/claims/${claim.id}/approve`)).data.membership;
  // An owner invites a staff number that has not logged in yet, plus the demo staff Mai logs in (linked).
  const owner = await loginMerchant(store);
  const inv = await api(store, owner, 'POST', '/merchant/staff', { place_id: 'PLACE-401', name: 'Người được mời', phone: CLAIMANT, role: 'staff' });
  assert.equal(inv.status, 201);
  const mai = await login(store, STAFF);
  await api(store, mai, 'GET', '/merchant/me');
  assert.equal(store.moduleRecords.find(r => r.id === 'M6-MEM-MAI').data.user_id, mai.user.id);

  const del = await api(store, c, 'DELETE', '/me');
  assert.equal(del.status, 200);
  assert.equal(store.moduleRecords.find(r => r.id === mem.id), undefined, 'approved owner membership removed');
  assert.equal(store.moduleRecords.find(r => r.id === inv.data.id), undefined, 'unlinked invite for the phone removed');
  assert.equal(store.moduleRecords.find(r => r.id === claim.id), undefined, 'claim removed');
  assert.ok(store.moduleRecords.find(r => r.id === 'M6-MEM-MAI'), 'other users keep theirs');
  assert.ok(store.moduleRecords.find(r => r.id === 'M6-MEM-TAI'));

  const del2 = await api(store, mai, 'DELETE', '/me');
  assert.equal(del2.status, 200);
  assert.equal(store.moduleRecords.find(r => r.id === 'M6-MEM-MAI'), undefined);
});

test('M13: slot holds carry the booking owner; deleting the account releases them; only the owner cancels', async () => {
  const store = createInitialStore();
  const date = vnDate(1);
  const users = [];
  for (let i = 0; i < 5; i++) users.push(await login(store, '091330010' + i));
  const [u, ...rest] = users;
  const book = who => api(store, who, 'POST', '/bookings', { place_id: 'PLACE-403', date, time: '18:00', party_size: 2 });
  const b1 = await book(u);
  assert.equal(b1.status, 200);
  const cnt = store.moduleRecords.find(r => r.kind === 'slotcount' && r.data.place_id === 'PLACE-403' && r.data.date === date && r.data.time === '18:00');
  assert.equal(cnt.data.holds[b1.data.id], u.user.id, 'the hold names its owner');
  const bk = store.moduleRecords.find(r => r.id === b1.data.id);
  assert.equal(bk.owner_id, u.user.id);
  for (const x of rest.slice(0, 3)) assert.equal((await book(x)).status, 200);
  assert.equal((await book(rest[3])).status, 409, 'PLACE-403 has 4 tables per slot');

  assert.equal((await api(store, rest[0], 'DELETE', `/bookings/${b1.data.id}`)).status, 403, 'not the owner');
  assert.equal((await api(store, rest[0], 'PATCH', `/bookings/${b1.data.id}`, { party_size: 3 })).status, 403);

  // Owner deletes the account: the booking goes and its table reopens.
  assert.equal((await api(store, u, 'DELETE', '/me')).status, 200);
  assert.equal(store.moduleRecords.find(r => r.id === b1.data.id), undefined);
  const after = store.moduleRecords.find(r => r.id === cnt.id);
  assert.equal(after.data.n, 3);
  assert.equal(b1.data.id in after.data.holds, false);
  const slots = await api(store, rest[0], 'GET', '/bookings/slots', {}, `place_id=PLACE-403&date=${date}`);
  assert.equal(slots.data.slots.find(s => s.time === '18:00').remaining_tables, 1);
  assert.equal((await book(rest[3])).status, 200, 'the released table can be booked');

  // Moving a booking moves its hold; cancel releases it exactly once.
  const mine = (await api(store, rest[0], 'GET', '/bookings')).data.bookings[0];
  assert.equal((await api(store, rest[0], 'PATCH', `/bookings/${mine.id}`, { time: '18:30' })).status, 200);
  const c1800 = store.moduleRecords.find(r => r.id === cnt.id).data, c1830 = store.moduleRecords.find(r => r.kind === 'slotcount' && r.data.date === date && r.data.time === '18:30' && r.data.place_id === 'PLACE-403').data;
  assert.equal(c1800.n, 3);
  assert.equal(c1830.holds[mine.id], rest[0].user.id);
  assert.equal((await api(store, rest[0], 'DELETE', `/bookings/${mine.id}`)).status, 200);
  assert.equal(store.moduleRecords.find(r => r.kind === 'slotcount' && r.data.time === '18:30' && r.data.date === date && r.data.place_id === 'PLACE-403').data.n, 0);
});
