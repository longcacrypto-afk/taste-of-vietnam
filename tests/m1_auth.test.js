import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { getRepository } from '../src/db/repository.js';
import { googleConfig, resetGoogleKeyCache, verifyGoogleIdToken } from '../src/services/googleAuthService.js';
import { defaultProfile, validateProfilePatch } from '../src/services/profileService.js';
import { CLIENT_ID, googleToken, jwk, mockGoogleFetch } from './helpers/googleFixtures.js';

const api = (store, method, path, body = {}, headers = {}) => handleApiRequest(store, method, '/api/v1' + path, new URLSearchParams(), body, headers);
const bearer = r => ({ authorization: `Bearer ${r.data.access_token}` });
function setup(t) {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  resetGoogleKeyCache();
  t.after(() => { delete process.env.GOOGLE_CLIENT_ID; resetGoogleKeyCache(); });
  return mockGoogleFetch(t);
}

test('M1 Google is disabled cleanly without config; public catalogue stays browsable', async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  const store = createInitialStore();
  assert.deepEqual(googleConfig(), { enabled: false, client_id: null });
  assert.deepEqual((await api(store, 'GET', '/auth/google/config')).data, { enabled: false, client_id: null });
  assert.equal((await api(store, 'POST', '/auth/google', { id_token: 'anything' })).status, 503);
  assert.equal((await api(store, 'GET', '/dishes')).status, 200);
  assert.equal((await api(store, 'GET', '/places')).status, 200);
  assert.equal(Object.keys(store.users || {}).length, 0);
});

test('M1 Google verifies signature/audience/issuer/expiry with cached Google JWKS and issues app JWT', async t => {
  const calls = setup(t);
  const store = createInitialStore();
  assert.deepEqual((await api(store, 'GET', '/auth/google/config')).data, { enabled: true, client_id: CLIENT_ID });
  const login = await api(store, 'POST', '/auth/google', { id_token: googleToken() });
  assert.equal(login.status, 200);
  assert.equal(login.data.role, 'user');
  assert.equal(login.data.verified, true);
  assert.equal(login.data.token_type, 'Bearer');
  const me = await api(store, 'GET', '/auth/me', {}, bearer(login));
  assert.equal(me.status, 200);
  assert.equal(me.data.guest, false);
  const user = await getRepository(store).getUser(me.data.id);
  assert.equal(user.email, 'owner@example.com');
  assert.equal(user.identity_verified, true);
  assert.equal(user.google_sub, 'google-sub-1');
  assert.equal(login.data.user.phone, null);
  assert.deepEqual(login.data.user.hard_allergies, []);
  assert.equal(login.data.user.pdpd_consent, false);
  const again = await api(store, 'POST', '/auth/google', { id_token: googleToken({ iss: 'accounts.google.com' }) });
  assert.equal(again.data.user.id, me.data.id);
  assert.equal(calls(), 1);
  assert.equal(Object.keys(store.users).length, 1);
  const multiAud = await verifyGoogleIdToken(googleToken({ aud: [CLIENT_ID, 'other'], azp: CLIENT_ID }));
  assert.equal(multiAud.sub, user.google_sub);
});

test('M1 Google rejects bad/missing/malformed tokens and never writes a user', async t => {
  const calls = setup(t);
  const store = createInitialStore();
  for (const id_token of [undefined, null, '', 4]) assert.equal((await api(store, 'POST', '/auth/google', { id_token })).status, 400);
  const now = Math.floor(Date.now() / 1000);
  const cases = [
    ['wrong audience', { aud: 'attacker' }], ['wrong issuer', { iss: 'https://evil.example' }],
    ['expired', { exp: now - 1 }], ['expires now', { exp: now }], ['missing exp', { exp: undefined }],
    ['string exp', { exp: String(now + 99) }], ['future issue', { iat: now + 500 }], ['missing iat', { iat: undefined }],
    ['missing sub', { sub: '' }], ['long sub', { sub: 'x'.repeat(256) }], ['future nbf', { nbf: now + 500 }],
    ['multiple audiences no azp', { aud: [CLIENT_ID, 'other'] }], ['wrong azp', { azp: 'other' }]
  ];
  for (const [name, changes] of cases) assert.equal((await api(store, 'POST', '/auth/google', { id_token: googleToken(changes) })).status, 401, name);
  assert.equal(calls(), 0, 'reject invalid claims before network');
  const foreignKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const bad = ['garbage', 'a.b.c', googleToken({}, { alg: 'none' }), googleToken({}, { alg: 'HS256' }), googleToken({}, { kid: 'unknown' }), googleToken({}, {}, foreignKey), googleToken() + 'x'];
  for (const id_token of bad) assert.equal((await api(store, 'POST', '/auth/google', { id_token })).status, 401);
  assert.equal(calls(), 1, 'unknown kids cannot force a fetch storm');
  assert.equal(Object.keys(store.users || {}).length, 0);
});

test('M1 Google JWKS outage returns clear 503 without writes', async t => {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  t.after(() => delete process.env.GOOGLE_CLIENT_ID);
  for (const options of [{ status: 503 }, { keys: [] }, { fail: true }]) {
    resetGoogleKeyCache();
    mockGoogleFetch(t, options);
    const store = createInitialStore();
    const result = await api(store, 'POST', '/auth/google', { id_token: googleToken() });
    assert.equal(result.status, 503);
    assert.equal(Object.keys(store.users || {}).length, 0);
    t.mock.restoreAll();
  }
});

test('M1 Google identity is provider subject, not an email/body claim or a privileged role', async t => {
  setup(t);
  const store = createInitialStore();
  process.env.ADMIN_EMAILS = 'owner@example.com'; // no implicit promotion without M9 policy
  t.after(() => delete process.env.ADMIN_EMAILS);
  const a = await api(store, 'POST', '/auth/google', { id_token: googleToken(), role: 'admin', user_id: 'victim' });
  const b = await api(store, 'POST', '/auth/google', { id_token: googleToken({ sub: 'different-sub', email_verified: false }), email_verified: true });
  assert.notEqual(a.data.user.id, b.data.user.id, 'same email never auto-links another subject');
  const ub = await getRepository(store).getUser(b.data.user.id);
  assert.equal(ub.identity_verified, false);
  assert.equal(ub.email, null);
  assert.equal(ub.role, 'user');
});

test('M1 Google consumes only authenticated guest, unions dishes/history and revokes guest token', async t => {
  setup(t);
  const store = createInitialStore();
  const g = await api(store, 'POST', '/auth/guest');
  const otherGuest = await api(store, 'POST', '/auth/guest');
  await api(store, 'PATCH', '/me/profile', { name: 'Khách tự chọn', spice_level: 3, hard_allergies: ['peanut'] }, bearer(g));
  const repo = getRepository(store);
  await repo.saveCollections(g.data.guest_id, [{ id: 'col-1', name: 'Saved', dish_ids: ['DISH-101', 'DISH-102'] }]);
  await repo.addHistory(g.data.guest_id, { id: 'h1', dish_id: 'DISH-101', action: 'eaten', created_at: new Date().toISOString() });
  await repo.createOrderRedirect({ id: 'o1', user_id: g.data.guest_id });
  const account = await api(store, 'POST', '/auth/google', { id_token: googleToken(), guest_id: otherGuest.data.guest_id }, bearer(g));
  assert.equal(account.status, 200);
  assert.equal(account.data.user.name, 'Khách tự chọn');
  assert.equal(account.data.user.spice_level, 3);
  const exported = await api(store, 'GET', '/me/export', {}, bearer(account));
  assert.deepEqual(exported.data.saved_collections[0].dish_ids, ['DISH-101', 'DISH-102']);
  assert.equal(exported.data.suggestion_history.length, 1);
  assert.equal(exported.data.order_redirects[0].user_id, account.data.user.id);
  assert.equal((await api(store, 'GET', '/me/profile', {}, bearer(g))).status, 401);
  assert.equal((await api(store, 'GET', '/me/profile', {}, bearer(otherGuest))).status, 200);
  const replay = await api(store, 'POST', '/auth/google', { id_token: googleToken() }, bearer(g));
  assert.equal(replay.data.user.id, account.data.user.id);
  assert.equal((await repo.listHistory(account.data.user.id)).length, 1);

  // Another guest merging into an existing account does not overwrite account settings.
  await api(store, 'PATCH', '/me/profile', { spice_level: 1 }, bearer(account));
  await api(store, 'PATCH', '/me/profile', { spice_level: 2, hard_allergies: ['shrimp'] }, bearer(otherGuest));
  await repo.saveCollections(otherGuest.data.guest_id, [{ id: 'col-1', name: 'Saved', dish_ids: ['DISH-102', 'DISH-103'] }]);
  const merged = await api(store, 'POST', '/auth/google', { id_token: googleToken() }, bearer(otherGuest));
  assert.equal(merged.data.user.spice_level, 1);
  assert.deepEqual(new Set(merged.data.user.hard_allergies), new Set(['peanut', 'shrimp']));
  assert.deepEqual((await repo.listCollections(account.data.user.id))[0].dish_ids, ['DISH-101', 'DISH-102', 'DISH-103']);

  // An account bearer must never transfer its data to another account.
  const separate = await api(store, 'POST', '/auth/google', { id_token: googleToken({ sub: 'other-google' }), guest_id: account.data.user.id }, bearer(account));
  assert.equal((await repo.listHistory(separate.data.user.id)).length, 0);
  assert.equal((await repo.listHistory(account.data.user.id)).length, 1);
});

test('M1 profile rejects invalid JSON shapes/enums/ranges before any write or mutation', async t => {
  const store = createInitialStore();
  const g = await api(store, 'POST', '/auth/guest');
  const headers = bearer(g);
  const repo = getRepository(store);
  let writes = 0;
  const original = repo.saveProfile.bind(repo);
  t.mock.method(repo, 'saveProfile', async (...args) => { writes++; return original(...args); });
  const before = structuredClone((await api(store, 'GET', '/me/profile', {}, headers)).data);
  const invalid = [[], { regions: null }, { regions: 'bac' }, { regions: ['invalid'] }, { regions: [{}] },
    { hard_allergies: 'shrimp' }, { hard_allergies: ['unknown'] }, { diet_mode: 'magic' },
    { spice_level: -1 }, { spice_level: 4 }, { spice_level: 1.1 }, { spice_level: '1' },
    { budget_min: 10, budget_max: 9 }, { budget_min: -1 }, { budget_max: null }, { budget_max: Infinity },
    { lat: -91 }, { lat: NaN }, { lng: 181 }, { radius_m: 0 }, { pdpd_consent: 'true' },
    { name: {} }, { name: '<script>x</script>' }, { disliked_dish_ids: [null] },
    { meal_reminders: null }, { meal_reminders: { lunch: '25:00', dinner: '18:00', max_per_day: 1 } },
    { meal_reminders: { lunch: '10:30', dinner: '18:00', max_per_day: 3 } },
    { unknown: 'value' }, JSON.parse('{"__proto__":{}}'), { constructor: {} }];
  for (const patch of invalid) {
    const result = await api(store, 'PATCH', '/me/profile', patch, headers);
    assert.equal(result.status, 400, JSON.stringify(patch));
    assert.deepEqual((await api(store, 'GET', '/me/profile', {}, headers)).data, before);
  }
  assert.equal(writes, 0);
  const valid = { regions: ['bac', 'bac', 'nam'], hard_allergies: ['fish', 'egg'], spice_level: 3, budget_min: 0, budget_max: 100000,
    lat: -90, lng: 180, diet_mode: 'eat_clean', pdpd_consent: false,
    meal_reminders: { lunch: '00:00', dinner: '23:59', max_per_day: 2 }, role: 'admin', id: 'evil', phone: 'evil' };
  const updated = await api(store, 'PATCH', '/me/profile', valid, headers);
  assert.equal(updated.status, 200);
  assert.equal(writes, 1);
  assert.deepEqual(updated.data.regions, ['bac', 'nam']);
  assert.equal(updated.data.id, g.data.guest_id);
  assert.equal(updated.data.phone, null);
  assert.equal((await repo.getUser(g.data.guest_id)).role, 'guest');
  assert.ok(validateProfilePatch(defaultProfile('x'), null).error);
});

test('M1 export has all own >50 histories, no shared analytics; deletion scopes cleanup and revokes JWT', async t => {
  setup(t);
  const store = createInitialStore();
  const a = await api(store, 'POST', '/auth/google', { id_token: googleToken() });
  const b = await api(store, 'POST', '/auth/google', { id_token: googleToken({ sub: 'other' }) });
  const repo = getRepository(store);
  for (let n=0;n<251;n++) await repo.addHistory(a.data.user.id, { id: 'own-'+n, created_at: new Date().toISOString() });
  await repo.addHistory(b.data.user.id, { id: 'secret-other' });
  store.analyticsEvents = { dish_view: 123456 };
  store.communityRecipes.push({ id: 'mine', author_id: a.data.user.id }, { id: 'other-recipe', author_id: b.data.user.id });
  store.userReports.push({ id: 'mine', user_id: a.data.user.id });
  store.paymentOrders = { paid: { created_by: a.data.user.id, status: 'COMPLETED' } };
  const exported = await api(store, 'GET', '/me/export', {}, bearer(a));
  assert.equal(exported.data.suggestion_history.length, 251);
  assert.equal(exported.data.analytics_summary, undefined);
  assert.equal(JSON.stringify(exported.data).includes('secret-other'), false);
  assert.equal(exported.data.community_recipes.length, 1);
  assert.equal((await api(store, 'DELETE', '/me', {}, bearer(a))).status, 200);
  for (const path of ['/me/profile', '/me/export', '/auth/me']) assert.equal((await api(store, 'GET', path, {}, bearer(a))).status, 401);
  assert.equal((await api(store, 'GET', '/me/profile', {}, bearer(b))).status, 200);
  assert.equal((await repo.listRecipes()).some(r => r.id === 'mine'), false);
  assert.equal(store.paymentOrders.paid.created_by, null);
  assert.equal(store.userReports.find(r => r.id === 'mine').user_id, null);
  const again = await api(store, 'POST', '/auth/google', { id_token: googleToken() });
  assert.notEqual(again.data.user.id, a.data.user.id);
  assert.equal((await repo.listHistory(again.data.user.id)).length, 0);
});
