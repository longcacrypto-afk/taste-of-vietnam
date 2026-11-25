// =============================================================================
// P0: OTP login, signed expiring tokens, per-user profile, real DELETE /me
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { signToken, verifyToken, normalizePhone } from '../src/services/authService.js';
import { login, guest } from './helpers/auth.js';

const q = () => new URLSearchParams();
const bearer = (t) => ({ authorization: `Bearer ${t}` });

test('normalizePhone accepts VN mobile formats and rejects junk', () => {
  assert.equal(normalizePhone('0912 345 678'), '+84912345678');
  assert.equal(normalizePhone('+84912345678'), '+84912345678');
  assert.equal(normalizePhone('84912345678'), '+84912345678');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('<script>'), null);
  assert.equal(normalizePhone(undefined), null);
});

test('OTP: random 6-digit code, wrong code rejected, attempt limit burns the code', async () => {
  const store = createInitialStore();
  const r = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/request', q(), { phone: '0911111111' });
  assert.equal(r.status, 200);
  assert.match(r.data.dev_code, /^\d{6}$/);
  const wrong = r.data.dev_code === '000000' ? '111111' : '000000';

  const bad = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/verify', q(), { phone: '0911111111', code: wrong });
  assert.equal(bad.status, 401);
  assert.equal(bad.data.verified, false);
  assert.equal(bad.data.access_token, undefined);

  for (let i = 0; i < 4; i++) {
    await handleApiRequest(store, 'POST', '/api/v1/auth/otp/verify', q(), { phone: '0911111111', code: wrong });
  }
  const afterLimit = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/verify', q(), { phone: '0911111111', code: r.data.dev_code });
  assert.notEqual(afterLimit.status, 200, 'correct code must not work after 5 wrong attempts');

  const invalidPhone = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/request', q(), { phone: 'abc' });
  assert.equal(invalidPhone.status, 400);
});

test('OTP: expired code rejected; resend is rate limited', async () => {
  const store = createInitialStore();
  const r = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/request', q(), { phone: '0922222222' });
  const again = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/request', q(), { phone: '0922222222' });
  assert.equal(again.status, 429);
  store.otpChallenges['+84922222222'].expires_at = Date.now() - 1;
  const late = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/verify', q(), { phone: '0922222222', code: r.data.dev_code });
  assert.equal(late.status, 401);
});

test('OTP: production without SMS keys refuses to issue codes (never leaks dev_code)', async () => {
  const store = createInitialStore();
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const r = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/request', q(), { phone: '0933333333' });
    assert.equal(r.status, 503);
    assert.equal(r.data.dev_code, undefined);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test('Tokens: forged, tampered and expired tokens are rejected', async () => {
  const store = createInitialStore();
  const { token, user } = await login(store, '0944444444');
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/me/profile', q(), {}, bearer(token))).status, 200);

  const [h, p, s] = token.split('.');
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  const tampered = `${h}.${Buffer.from(JSON.stringify({ ...claims, role: 'admin' })).toString('base64url')}.${s}`;
  assert.equal(verifyToken(tampered), null);
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/me/profile', q(), {}, bearer(tampered))).status, 401);

  const expired = signToken({ sub: user.id, role: 'user' }, -10);
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/me/profile', q(), {}, bearer(expired))).status, 401);

  // the old hard-coded demo token is worthless now
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/me/profile', q(), {}, bearer('jwt-homnayangi-verified-token'))).status, 401);
});

test('Profiles are per user: anonymous PUT is 401, one user cannot change another', async () => {
  const store = createInitialStore();
  const anon = await handleApiRequest(store, 'PUT', '/api/v1/me/profile', q(), { name: 'Hacker' });
  assert.equal(anon.status, 401);
  assert.notEqual(store.userProfile.name, 'Hacker');

  const a = await login(store, '0955555555');
  const b = await guest(store);
  await handleApiRequest(store, 'PUT', '/api/v1/me/profile', q(), { name: 'Chị An', hard_allergies: ['dairy'], id: 'usr-evil' }, a.headers);
  const aProfile = await handleApiRequest(store, 'GET', '/api/v1/me/profile', q(), {}, a.headers);
  const bProfile = await handleApiRequest(store, 'GET', '/api/v1/me/profile', q(), {}, b.headers);
  assert.equal(aProfile.data.name, 'Chị An');
  assert.equal(aProfile.data.id, a.user.id, 'id cannot be overwritten');
  assert.notEqual(bProfile.data.name, 'Chị An');
  assert.deepEqual(bProfile.data.hard_allergies, []);
  assert.equal(store.userProfile.name, 'Anh Long', 'shared default profile untouched');
});

test('DELETE /me requires a token and really removes the user', async () => {
  const store = createInitialStore();
  assert.equal((await handleApiRequest(store, 'DELETE', '/api/v1/me', q())).status, 401);

  const a = await login(store, '0966666666');
  await handleApiRequest(store, 'PUT', '/api/v1/me/profile', q(), { name: 'Sẽ bị xóa' }, a.headers);
  await handleApiRequest(store, 'POST', '/api/v1/suggestions/feedback', q(), { dish_id: 'DISH-101', action: 'eaten' }, a.headers);
  assert.equal(a.user.suggestionHistory.length, 1);

  const del = await handleApiRequest(store, 'DELETE', '/api/v1/me', q(), {}, a.headers);
  assert.equal(del.status, 200);
  assert.equal(del.data.deleted, true);
  assert.equal(store.users[a.user.id], undefined);
  assert.ok(!JSON.stringify(store.users).includes('Sẽ bị xóa'));
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/me/profile', q(), {}, a.headers)).status, 401, 'token of a deleted user is dead');

  // logging in again with the same phone starts from a fresh profile
  store.otpChallenges = {};
  const again = await login(store, '0966666666');
  assert.notEqual(again.user.id, a.user.id);
  assert.notEqual(again.user.profile.name, 'Sẽ bị xóa');
});
