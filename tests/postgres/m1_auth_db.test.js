import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';
import { initRepository } from '../../src/db/repository.js';
import { CLIENT_ID, googleToken, mockGoogleFetch } from '../helpers/googleFixtures.js';
import { resetGoogleKeyCache } from '../../src/services/googleAuthService.js';
import { skip, resetDatabase, rawPool, TEST_DATABASE_URL } from './helpers.js';

let store, repo, db;
const api = (method, path, body = {}, headers = {}) => handleApiRequest(store, method, '/api/v1' + path, new URLSearchParams(), body, headers);
const headers = r => ({ authorization: `Bearer ${r.data.access_token}` });
const login = (sub, guest = null) => api('POST', '/auth/google', { id_token: googleToken({ sub }) }, guest ? headers(guest) : {});
const guest = () => api('POST', '/auth/guest');
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
function google(t) {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  resetGoogleKeyCache();
  mockGoogleFetch(t);
  t.after(() => { delete process.env.GOOGLE_CLIENT_ID; resetGoogleKeyCache(); });
}
before(async () => {
  if (skip) return;
  await resetDatabase();
  store = createInitialStore();
  repo = await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
  db = rawPool();
});
after(async () => { if (!skip) { await db.end(); await repo.pool.end(); } });

test('M1 PostgreSQL: Google identity persists across pool restart and cannot self-grant a role', { skip }, async t => {
  google(t);
  const a = await login('persist');
  assert.equal(a.status, 200);
  const [user] = await rows('SELECT * FROM users WHERE id=$1', [a.data.user.id]);
  assert.equal(user.google_sub, 'persist');
  assert.equal(user.email, 'owner@example.com');
  assert.equal(user.identity_verified, true);
  assert.equal(user.is_guest, false);
  assert.equal(user.role, 'user');
  assert.deepEqual(user.profile.hard_allergies, []);
  assert.equal(user.profile.pdpd_consent, false);
  await repo.pool.end();
  store = createInitialStore();
  repo = await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
  const b = await login('persist');
  assert.equal(b.data.user.id, a.data.user.id);
  assert.equal((await api('GET', '/me/profile', {}, headers(a))).status, 200);
  assert.equal((await rows('SELECT * FROM users WHERE google_sub=$1', ['persist'])).length, 1);
});

test('M1 PostgreSQL: invalid profile gets 400 with zero UPDATEs and unchanged raw JSON', { skip }, async t => {
  const g = await guest();
  const [before] = await rows('SELECT profile,updated_at FROM users WHERE id=$1', [g.data.guest_id]);
  let writes = 0;
  const save = repo.saveProfile.bind(repo);
  t.mock.method(repo, 'saveProfile', async (...args) => { writes++; return save(...args); });
  for (const patch of [null, [], { hard_allergies: null }, { diet_mode: [] }, { spice_level: 99 }, { lat: 91 }, { lng: -181 }, { budget_min: 100, budget_max: 10 }, { regions: [null] }, { pdpd_consent: 1 }]) {
    assert.equal((await api('PATCH', '/me/profile', patch, headers(g))).status, 400, JSON.stringify(patch));
  }
  assert.equal(writes, 0);
  const [after] = await rows('SELECT profile,updated_at FROM users WHERE id=$1', [g.data.guest_id]);
  assert.deepEqual(after, before);
  const valid = await api('PUT', '/me/profile', { spice_level: 0, lat: 90, lng: -180, hard_allergies: ['egg'], regions: ['trung'], budget_min: 1, budget_max: 100 }, headers(g));
  assert.equal(valid.status, 200);
  assert.equal((await rows('SELECT profile FROM users WHERE id=$1', [g.data.guest_id]))[0].profile.lat, 90);
});

test('M1 PostgreSQL: guest collections/history/redirects move atomically into Google; other user stays isolated', { skip }, async t => {
  google(t);
  const g = await guest();
  const other = await guest();
  const gid = g.data.guest_id;
  await api('PATCH', '/me/profile', { name: 'Khách đã chọn', spice_level: 2, hard_allergies: ['egg'] }, headers(g));
  await repo.saveCollections(gid, [{ id: 'col-1', name: 'Guest', dish_ids: ['DISH-101', 'DISH-102'] }]);
  await repo.addHistory(gid, { id: 'merge-history', dish_id: 'DISH-101', action: 'eaten', created_at: new Date().toISOString() });
  await repo.addHistory(other.data.guest_id, { id: 'other-private', action: 'eaten', created_at: new Date().toISOString() });
  await repo.createOrderRedirect({ id: 'merge-redirect', user_id: gid, partner: 'grab', target_deeplink: 'https://example.test', loopback_confirmed_eaten: false, created_at: new Date().toISOString() });
  const a = await login('merge-target', g);
  assert.equal(a.status, 200);
  assert.equal(a.data.user.name, 'Khách đã chọn');
  assert.equal(a.data.user.spice_level, 2);
  const id = a.data.user.id;
  assert.equal((await rows('SELECT user_id FROM suggestion_history WHERE id=$1', ['merge-history']))[0].user_id, id);
  assert.equal((await rows('SELECT user_id FROM order_redirects WHERE id=$1', ['merge-redirect']))[0].user_id, id);
  assert.equal((await rows('SELECT * FROM users WHERE id=$1', [gid])).length, 0);
  assert.deepEqual((await repo.listCollections(id))[0].dish_ids, ['DISH-101', 'DISH-102']);
  assert.equal((await api('GET', '/me/export', {}, headers(g))).status, 401);
  assert.equal((await repo.listHistory(other.data.guest_id))[0].id, 'other-private');
  // A replayed guest token cannot duplicate anything or consume another guest by body id.
  const repeat = await api('POST', '/auth/google', { id_token: googleToken({ sub: 'merge-target' }), guest_id: other.data.guest_id }, headers(g));
  assert.equal(repeat.data.user.id, id);
  assert.equal((await repo.listHistory(id)).length, 1);
  assert.ok(await repo.getUser(other.data.guest_id));

  const next = await guest();
  await api('PATCH', '/me/profile', { spice_level: 3, hard_allergies: ['peanut'] }, headers(next));
  await repo.saveCollections(next.data.guest_id, [{ id: 'col-1', name: 'Guest2', dish_ids: ['DISH-102','DISH-103'] }]);
  const merged = await login('merge-target', next);
  assert.equal(merged.data.user.spice_level, 2, 'existing account preference wins');
  assert.deepEqual(new Set(merged.data.user.hard_allergies), new Set(['egg','peanut']));
  assert.deepEqual((await repo.listCollections(id))[0].dish_ids, ['DISH-101','DISH-102','DISH-103']);
});

test('M1 PostgreSQL: failing late merge rolls back identity creation, moved history and guest deletion', { skip }, async t => {
  google(t);
  const g = await guest();
  const gid = g.data.guest_id;
  await repo.addHistory(gid, { id: 'rollback-h', action: 'eaten', created_at: new Date().toISOString() });
  const [before] = await rows('SELECT profile FROM users WHERE id=$1', [gid]);
  // Fail the final identity update, after collections/history transfer and guest delete.
  await db.query(`CREATE FUNCTION reject_google_update() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.google_sub = 'rollback-target' THEN RAISE EXCEPTION 'forced test rollback'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_merge BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION reject_google_update();`);
  try {
    await assert.rejects(login('rollback-target', g), /forced test rollback/);
    assert.equal((await rows('SELECT * FROM users WHERE google_sub=$1', ['rollback-target'])).length, 0);
    assert.equal((await rows('SELECT user_id FROM suggestion_history WHERE id=$1', ['rollback-h']))[0].user_id, gid);
    assert.deepEqual((await rows('SELECT profile FROM users WHERE id=$1', [gid]))[0], before);
    assert.equal((await repo.listCollections(gid)).length, 1);
    assert.equal((await api('GET', '/me/profile', {}, headers(g))).status, 200);
  } finally { await db.query('DROP TRIGGER fail_merge ON users; DROP FUNCTION reject_google_update();'); }
});

test('M1 PostgreSQL: concurrent Google login for one subject creates one account and merges each guest once', { skip }, async t => {
  google(t);
  const a = await guest(); const b = await guest();
  await repo.saveCollections(a.data.guest_id, [{ id: 'col-1', name: 'A', dish_ids: ['DISH-101'] }]);
  await repo.saveCollections(b.data.guest_id, [{ id: 'col-1', name: 'B', dish_ids: ['DISH-102'] }]);
  const [x,y] = await Promise.all([login('concurrent-same', a), login('concurrent-same', b)]);
  assert.equal(x.status, 200); assert.equal(y.status, 200);
  assert.equal(x.data.user.id, y.data.user.id);
  assert.equal((await rows('SELECT * FROM users WHERE google_sub=$1', ['concurrent-same'])).length, 1);
  assert.deepEqual(new Set((await repo.listCollections(x.data.user.id))[0].dish_ids), new Set(['DISH-101','DISH-102']));
  assert.equal(await repo.getUser(a.data.guest_id), null);
  assert.equal(await repo.getUser(b.data.guest_id), null);
});

test('M1 PostgreSQL: concurrent claims on one guest cannot copy it into two accounts', { skip }, async t => {
  google(t);
  const g = await guest();
  await repo.addHistory(g.data.guest_id, { id: 'race-history', action: 'eaten', created_at: new Date().toISOString() });
  const [a,b] = await Promise.all([login('race-a', g),login('race-b', g)]);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  const histories = [...await repo.listHistory(a.data.user.id), ...await repo.listHistory(b.data.user.id)];
  assert.equal(histories.length, 1);
  assert.equal(histories[0].id, 'race-history');
  assert.notEqual(a.data.user.id, b.data.user.id);
});

test('M1 PostgreSQL: export has >200 own history rows, reports/orders/recipes; delete unlinks money and revokes tokens', { skip }, async t => {
  google(t);
  const a = await login('privacy'); const b = await login('privacy-other');
  const id = a.data.user.id;
  await db.query(`INSERT INTO suggestion_history(id,user_id,action) SELECT 'export-' || n,$1,'eaten' FROM generate_series(1,251) n`, [id]);
  await repo.addHistory(b.data.user.id, { id: 'private-b', action: 'eaten', created_at: new Date().toISOString() });
  await repo.createOrderRedirect({ id: 'delete-redirect', user_id: id, partner: 'grab', target_deeplink: 'https://example.test', loopback_confirmed_eaten: false, created_at: new Date().toISOString() });
  await db.query("INSERT INTO place_reports(id,place_id,user_id,reason) VALUES('delete-report','PLACE-401',$1,'wrong price')", [id]);
  await db.query("INSERT INTO payment_orders(order_id,order_code,amount_vnd,created_by) VALUES('delete-payment',999991,10000,$1)", [id]);
  await db.query("INSERT INTO community_recipes(id,title,author_name,author_id) VALUES('delete-recipe','Recipe','Author',$1)", [id]);
  const ex = await api('GET', '/me/export', {}, headers(a));
  assert.equal(ex.status, 200);
  assert.equal(ex.data.suggestion_history.length, 251);
  assert.equal(ex.data.order_redirects.length, 1);
  assert.equal(ex.data.place_reports.length, 1);
  assert.equal(ex.data.community_recipes.length, 1);
  assert.equal(ex.data.payment_orders.length, 1);
  assert.equal(ex.data.analytics_summary, undefined);
  assert.equal(JSON.stringify(ex.data).includes('private-b'), false);
  await api('DELETE', '/me', {}, headers(a));
  for (const table of ['suggestion_history','saved_collections','order_redirects']) assert.equal((await rows(`SELECT * FROM ${table} WHERE user_id=$1`, [id])).length, 0);
  assert.equal((await rows('SELECT * FROM community_recipes WHERE author_id=$1', [id])).length, 0);
  assert.equal((await rows("SELECT created_by FROM payment_orders WHERE order_id='delete-payment'"))[0].created_by, null);
  assert.equal((await rows("SELECT user_id FROM place_reports WHERE id='delete-report'"))[0].user_id, null);
  for (const path of ['/auth/me', '/me/profile', '/me/export']) assert.equal((await api('GET', path, {}, headers(a))).status, 401);
  assert.equal((await api('GET', '/me/profile', {}, headers(b))).status, 200);
  const again = await login('privacy');
  assert.notEqual(again.data.user.id, id);
  assert.equal((await repo.listHistory(again.data.user.id)).length, 0);
});

test('M1 PostgreSQL: M9 audit anonymization hook receives deletion transaction and rolls back together', { skip }, async t => {
  google(t);
  const a = await login('audit-delete');
  const id = a.data.user.id;
  await repo.addAudit({ actor: 'owner@example.com', actor_id: id, role: 'user', action: 'TEST_ACTOR', target: id, ip: '127.0.0.1' });
  let calls = 0;
  repo.anonymizeAuditActor = async (uid, c) => {
    calls++;
    assert.equal(uid, id);
    assert.ok(c && typeof c.query === 'function', 'must use deletion transaction');
    await c.query("UPDATE rbac_audit_logs SET actor_id=NULL,actor_email='deleted-user' WHERE actor_id=$1", [uid]);
  };
  await db.query(`CREATE FUNCTION reject_audit_delete() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF OLD.google_sub='audit-delete' THEN RAISE EXCEPTION 'forced delete rollback'; END IF; RETURN OLD; END $$;
    CREATE TRIGGER fail_audit_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION reject_audit_delete();`);
  try {
    await assert.rejects(api('DELETE', '/me', {}, headers(a)), /forced delete rollback/);
    assert.ok(await repo.getUser(id));
    const [audit] = await rows("SELECT actor_id,actor_email FROM rbac_audit_logs WHERE action='TEST_ACTOR'");
    assert.equal(audit.actor_id, id);
    assert.equal(audit.actor_email, 'owner@example.com');
    await db.query('DROP TRIGGER fail_audit_delete ON users; DROP FUNCTION reject_audit_delete();');
    await api('DELETE', '/me', {}, headers(a));
    const [anonymized] = await rows("SELECT actor_id,actor_email FROM rbac_audit_logs WHERE action='TEST_ACTOR'");
    assert.equal(anonymized.actor_id, null);
    assert.equal(anonymized.actor_email, 'deleted-user');
    assert.equal(calls, 2);
  } finally {
    delete repo.anonymizeAuditActor;
    await db.query('DROP TRIGGER IF EXISTS fail_audit_delete ON users; DROP FUNCTION IF EXISTS reject_audit_delete();');
  }
});

test('M1+M2 Google merge takes catalogue barrier first, filters stale IDs and survives concurrent deletion', { skip }, async t => {
  google(t);
  const original = await repo.getDish('DISH-101');
  for (let n = 0; n < 8; n++) {
    const id = 'DISH-GOOGLE-RACE-' + n;
    await repo.createDish({ ...original, id });
    const g = await guest();
    await repo.saveCollections(g.data.guest_id, [{ id: 'col-1', name: 'Race', dish_ids: [id, 'DISH-101'] }]);
    // Simulate legacy dangling references predating the M2 barrier.
    await db.query("UPDATE saved_collections SET dish_ids=array_append(dish_ids, 'DISH-GONE') WHERE user_id=$1", [g.data.guest_id]);
    const result = await Promise.all([login('catalogue-race-' + n, g), repo.deleteDish(id)]);
    assert.equal(result[0].status, 200);
    const cols = await repo.listCollections(result[0].data.user.id);
    assert.deepEqual(cols[0].dish_ids, ['DISH-101']);
    assert.equal((await rows('SELECT COUNT(*)::int n FROM saved_collections WHERE $1=ANY(dish_ids)', [id]))[0].n, 0);
  }
  // Instrument the actual transaction, not the source text: first statement in
  // loginGoogle must acquire the shared barrier before identity/user row locks.
  const tx = repo.tx.bind(repo);
  let first;
  t.mock.method(repo, 'tx', fn => tx(c => fn({ query: async (...args) => {
    first ??= args[0];
    return c.query(...args);
  } })));
  await repo.loginGoogle({ sub: 'lock-order-proof', email: null, identity_verified: false }, null, {
    id: 'usr-lock-order', profile: { id: 'usr-lock-order' }, savedCollections: []
  });
  assert.match(first, /pg_advisory_xact_lock_shared.*m2-collections-catalogue/);
});
