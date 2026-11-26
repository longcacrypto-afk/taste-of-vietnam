// M15 live: Food Trail from catalogue places/dishes, passport check-in (QR token, optional GPS ≤ 500 m,
// one stamp per stop per user), progress counter, staff-only QR codes, PDPD export/delete.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { guest, loginAdmin } from './helpers/auth.js';

const q = (s = '') => new URLSearchParams(s);
const api = (store, m, p, body, h, s) => handleApiRequest(store, m, p, q(s), body, h?.headers || {});
const TRAIL = 'TRAIL-BH-1NGAY';
const SANG = 'BH1-SANG-7Q2K';

test('M15: trails are demo-seeded, 4 stops sáng/trưa/xế/tối, enriched from the catalogue', async () => {
  const store = createInitialStore();
  const r = await api(store, 'GET', '/api/v1/tourism/trails');
  assert.equal(r.status, 200);
  assert.ok(r.data.items.length >= 2);
  const t = r.data.items.find(x => x.id === TRAIL);
  assert.equal(t.is_demo, true);
  assert.deepEqual(t.stops.map(s => s.slot), ['sang', 'trua', 'xe', 'toi']);
  const place = store.places.find(p => p.id === t.stops[0].place_id);
  assert.equal(t.stops[0].place_name, place.name);
  assert.equal(t.stops[0].address, place.address);
  assert.ok(t.stops.every(s => s.dish_name && s.price_vnd > 0));
  assert.ok(t.total_distance_m > 0 && t.total_distance_m < 5000, 'stops within Biên Hòa');
  assert.ok(t.stops.every(s => !('qr_token' in s)), 'QR tokens are never public');
  assert.equal(t.progress, null, 'anonymous: no progress');
  assert.equal(r.data.stops.length, 4); // legacy shape
  const one = await api(store, 'GET', '/api/v1/tourism/trails/bien-hoa-1-ngay');
  assert.equal(one.data.id, TRAIL);
  assert.equal((await api(store, 'GET', '/api/v1/tourism/trails/NOPE')).status, 404);
});

test('M15: a paused place is never shown as open on the trail and refuses check-in', async () => {
  const store = createInitialStore();
  store.places.find(p => p.id === 'PLACE-402').is_paused = true;
  const g = await guest(store);
  const t = (await api(store, 'GET', `/api/v1/tourism/trails/${TRAIL}`, {}, g)).data;
  const s = t.stops.find(x => x.place_id === 'PLACE-402');
  assert.equal(s.available, false);
  assert.equal(s.open_now, false);
  const c = await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: 'BH1-TRUA-4MZ8' }, g);
  assert.equal(c.status, 409);
});

test('M15: check-in needs a token and a valid QR code; one stamp per stop per user', async () => {
  const store = createInitialStore();
  assert.equal((await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: SANG })).status, 401);
  assert.equal((await api(store, 'GET', '/api/v1/tourism/passport')).status, 401);
  const g = await guest(store);
  assert.equal((await api(store, 'POST', '/api/v1/tourism/passport/checkin', {}, g)).status, 400);
  assert.equal((await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: 'FAKE-CODE' }, g)).status, 404);
  assert.equal((await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: SANG, stop_id: 'STOP-BH1-TOI' }, g)).status, 400);
  const a = await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: SANG.toLowerCase() }, g);
  assert.equal(a.status, 200);
  assert.equal(a.data.stamped, true);
  assert.equal(a.data.stamped_count, 1);
  const b = await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: SANG }, g);
  assert.equal(b.status, 200);
  assert.equal(b.data.stamped, false);
  assert.equal(b.data.already_stamped, true);
  assert.equal(store.moduleRecords.filter(r => r.module === 'M15' && r.kind === 'stamp').length, 1);
  // Another user has their own passport.
  const g2 = await guest(store);
  const p2 = await api(store, 'GET', '/api/v1/tourism/passport', {}, g2, `trail_id=${TRAIL}`);
  assert.equal(p2.data.stamped_count, 0);
});

test('M15: GPS check is optional, ≤ 500 m when lat/lng are given', async () => {
  const store = createInitialStore();
  const g = await guest(store);
  const far = await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: SANG, lat: 10.99, lng: 106.9 }, g);
  assert.equal(far.status, 403);
  assert.ok(far.data.distance_m > 500);
  assert.equal((await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: SANG, lat: 10.96 }, g)).status, 400);
  assert.equal((await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: SANG, lat: 'x', lng: 'y' }, g)).status, 400);
  const near = await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: SANG, lat: 10.9601, lng: 106.8455 }, g);
  assert.equal(near.status, 200);
  assert.equal(near.data.gps_verified, true);
  assert.ok(near.data.distance_m <= 500);
});

test('M15: progress counter reaches 4/4 and unlocks the badge; export + delete with the account', async () => {
  const store = createInitialStore();
  const g = await guest(store);
  const admin = await loginAdmin(store);
  const codes = await api(store, 'GET', `/api/v1/tourism/trails/${TRAIL}/qr-codes`, {}, admin);
  assert.equal(codes.status, 200);
  assert.equal((await api(store, 'GET', `/api/v1/tourism/trails/${TRAIL}/qr-codes`, {}, g)).status, 403);
  let last;
  for (const c of codes.data.items) last = await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: c.qr_token }, g);
  assert.equal(last.data.stamped_count, 4);
  assert.equal(last.data.completed, true);
  assert.equal(last.data.badge_unlocked, 'Đại Sứ Ẩm Thực Biên Hòa');
  const p = await api(store, 'GET', '/api/v1/tourism/passport', {}, g);
  assert.equal(p.data.progress_pct, 100);
  const t = await api(store, 'GET', '/api/v1/tourism/trails', {}, g);
  assert.equal(t.data.items.find(x => x.id === TRAIL).progress.completed, true);
  const exp = await api(store, 'GET', '/api/v1/me/export', {}, g);
  assert.equal(exp.status, 200);
  assert.equal(JSON.stringify(exp.data).includes('STOP-BH1-SANG'), true);
  assert.equal((await api(store, 'DELETE', '/api/v1/me', {}, g)).status, 200);
  assert.equal(store.moduleRecords.filter(r => r.module === 'M15' && r.kind === 'stamp').length, 0);
});
