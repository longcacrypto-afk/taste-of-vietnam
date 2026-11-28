// M10 live: event ingestion (14 standard events), admin analytics computed from stored events
// + real order redirects, real NLU benchmark & recommender safety audit, A/B tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { login, loginAdmin } from './helpers/auth.js';
import { __setNow, EVENTS } from '../src/modules/m10.js';

const q = (s = '') => new URLSearchParams(s);
const api = (store, who, method, path, body, qs) => handleApiRequest(store, method, path, q(qs), body || {}, who ? who.headers : {});

test.afterEach(() => { __setNow(null); delete process.env.SEED_DEMO_MODULES; });

test('M10: POST /events stores one of the 14 standard events; validation; owner link', async () => {
  const store = createInitialStore();
  assert.equal(EVENTS.length, 14);
  const anon = await api(store, null, 'POST', '/api/v1/events', { event_name: 'app_open', session_id: 'S-a1', properties: { source: 'organic' } });
  assert.equal(anon.status, 201);
  const rec = store.moduleRecords.find(r => r.id === anon.data.id);
  assert.equal(rec.module, 'M10');
  assert.equal(rec.owner_id, null);
  assert.equal(rec.is_demo, false);
  assert.equal(rec.data.actor, 'anon:S-a1');
  assert.equal((await api(store, null, 'POST', '/api/v1/events', { event: 'x' })).status, 400);
  assert.equal((await api(store, null, 'POST', '/api/v1/events', { event_name: 'app_open', properties: 'nope' })).status, 400);
  assert.equal((await api(store, null, 'POST', '/api/v1/events', { event_name: 'app_open', properties: Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['k' + i, 'x'.repeat(200)])) })).status, 400);
  const u = await login(store, '0900000091');
  const own = await api(store, u, 'POST', '/api/v1/events', { name: 'dish_view', session_id: 'S-u1', props: { dish_id: 'DISH-101', rank: 1 } });
  assert.equal(store.moduleRecords.find(r => r.id === own.data.id).owner_id, u.user.id);
  // batch: needs a token, max 50, all-or-nothing validation
  assert.equal((await api(store, null, 'POST', '/api/v1/events/batch', { events: [{ event_name: 'app_open' }] })).status, 401);
  assert.equal((await api(store, u, 'POST', '/api/v1/events/batch', { events: Array.from({ length: 51 }, () => ({ event_name: 'app_open' })) })).status, 400);
  assert.equal((await api(store, u, 'POST', '/api/v1/events/batch', { events: [{ event_name: 'app_open' }, { event_name: 'nope' }] })).status, 400);
  const b = await api(store, u, 'POST', '/api/v1/events/batch', { session_id: 'S-u1', events: [{ event_name: 'place_view', properties: { place_id: 'PLACE-401' } }, { event_name: 'direction_click', properties: { partner: 'maps' } }] });
  assert.equal(b.data.stored, 2);
});

test('M10: analytics are admin only', async () => {
  const store = createInitialStore();
  const u = await login(store, '0900000092');
  for (const p of ['overview', 'funnel', 'ai-performance', 'ai-benchmark', 'conversions', 'ads-health', 'events', 'ab-test']) {
    assert.equal((await api(store, null, 'GET', '/api/v1/analytics/' + p)).status, 401, p);
    assert.equal((await api(store, u, 'GET', '/api/v1/analytics/' + p)).status, 403, p);
  }
  assert.equal((await api(store, u, 'POST', '/api/v1/analytics/ai-performance/run')).status, 403);
  assert.equal((await api(store, u, 'PATCH', '/api/v1/analytics/ab-test/EXP-RANK', { status: 'paused' })).status, 403);
});

test('M10: demo events are seeded, flagged, and every screen reports demo vs real counts', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const ov = await api(store, admin, 'GET', '/api/v1/analytics/overview');
  assert.equal(ov.status, 200);
  assert.ok(store.moduleRecords.filter(r => r.module === 'M10' && r.kind === 'event').every(r => r.is_demo));
  assert.ok(ov.data.demo_events > 0);
  assert.equal(ov.data.is_demo, true);
  assert.ok(ov.data.dau_mau.mau > 0);
  assert.ok(ov.data.suggestion_latency.samples > 0);
  const f = await api(store, admin, 'GET', '/api/v1/analytics/funnel', null, 'days=30');
  assert.equal(f.data.period_days, 30);
  const counts = f.data.stages.map(s => s.count);
  assert.ok(f.data.base_sessions >= counts[0] && counts[0] >= counts[1] && counts[1] >= counts[2] && counts[2] >= counts[3]);
  assert.equal(f.data.funnel.length, 5);
  for (const p of ['conversions', 'ads-health', 'events'])
    assert.equal((await api(store, admin, 'GET', '/api/v1/analytics/' + p)).status, 200, p);
});

test('M10: funnel, WAMD, conversions and retention computed from stored events + real redirects', async () => {
  process.env.SEED_DEMO_MODULES = 'false';
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const u = await login(store, '0900000093');
  const ev = (t, name, props, sid = 'S-1') => { __setNow(() => new Date(t)); return api(store, u, 'POST', '/api/v1/events', { event_name: name, session_id: sid, properties: props }); };
  // day 1 lunch (12:00 VN): full path to an order
  await ev('2026-11-20T05:00:00Z', 'app_open', {});
  await ev('2026-11-20T05:00:01Z', 'suggestion_shown', { items: 3, sponsored: 1, latency_ms: 400 });
  await ev('2026-11-20T05:00:20Z', 'dish_view', { dish_id: 'DISH-101', rank: 1, source: 'suggestion' });
  await ev('2026-11-20T05:00:30Z', 'place_view', { place_id: 'PLACE-401' });
  await ev('2026-11-20T05:00:41Z', 'order_click', { partner: 'grabfood' });
  // day 1 dinner: another decision; day 8: the user comes back (D7 retention)
  await ev('2026-11-20T12:00:00Z', 'app_open', {}, 'S-2');
  await ev('2026-11-20T12:00:30Z', 'direction_click', { partner: 'maps' }, 'S-2');
  await ev('2026-11-27T03:00:00Z', 'app_open', {}, 'S-3');
  __setNow(() => new Date('2026-11-27T04:00:00Z'));
  const f = (await api(store, admin, 'GET', '/api/v1/analytics/funnel', null, 'days=30')).data;
  assert.equal(f.base_sessions, 3);
  assert.deepEqual(f.stages.map(s => s.count), [1, 1, 1, 2]);
  assert.equal(f.wamd_current, 2, 'lunch + dinner decisions on one day');
  assert.equal(f.demo_events, 0);
  const ov = (await api(store, admin, 'GET', '/api/v1/analytics/overview', null, 'days=30')).data;
  assert.equal(ov.decision_time_s.median, 40);
  assert.equal(ov.retention.d7.pct, 100);
  assert.equal(ov.suggestion_latency.p95_ms, 400);
  // A real order redirect from the repository counts as a conversion
  __setNow(null);
  const red = await api(store, u, 'POST', '/api/v1/orders/redirect', { place_id: 'PLACE-401', partner: 'maps' });
  assert.equal(red.status, 200);
  const f2 = (await api(store, admin, 'GET', '/api/v1/analytics/funnel', null, 'days=30')).data;
  assert.equal(f2.real_redirects, 1);
  assert.equal(f2.stages[3].from_redirects, 1);
  // ...unless the client already tracked it with its redirect_id (no double count)
  await api(store, u, 'POST', '/api/v1/events', { event_name: 'direction_click', session_id: 'S-4', properties: { partner: 'maps', redirect_id: red.data.id } });
  const f3 = (await api(store, admin, 'GET', '/api/v1/analytics/funnel', null, 'days=30')).data;
  assert.equal(f3.real_redirects, 0);
  const c = (await api(store, admin, 'GET', '/api/v1/analytics/conversions', null, 'days=30')).data;
  assert.equal(c.buckets.maps, 2);
  assert.equal(c.buckets.grabfood, 1);
});

test('M10: NLU benchmark runs the real parser (accuracy = passed/cases) and the safety audit runs the real recommender', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const b = (await api(store, admin, 'GET', '/api/v1/analytics/ai-benchmark')).data;
  assert.equal(b.details.length, b.benchmark_size);
  assert.equal(b.benchmark_size, 6 + 26);
  const passed = b.details.filter(d => d.passed).length;
  assert.equal(b.accuracy_pct, Number(((passed / b.details.length) * 100).toFixed(1)));
  assert.equal(b.passed_sla, b.accuracy_pct >= 90);
  assert.ok(b.details.filter(d => !d.passed).every(d => d.failed_fields.length > 0));
  for (const q of ["Hai vợ chồng có 2 bé ăn tối 400k", "Trưa nay 8 người ngân sách 1,5 triệu", "Trưa nay 10 người công ty ngân sách 1.5 triệu", "Hai vợ chồng ăn trưa 200k không cay", "Tối nay cả nhà 5 người, có 2 bé, ngân sách 500k"]) {
    assert.equal(b.details.find(d => d.query === q)?.passed, true, q);
  }
  assert.ok(b.safety.items > 0);
  assert.equal(b.safety.allergy_violations, 0);
  assert.equal(b.safety.repeat_3d_violations, 0);
  assert.equal(b.safety.lists_over_sponsor_cap, 0);
  const runs = store.moduleRecords.filter(r => r.module === 'M10' && r.kind === 'ai_run').length;
  const again = await api(store, admin, 'POST', '/api/v1/analytics/ai-performance/run');
  assert.equal(again.status, 201);
  assert.equal(store.moduleRecords.filter(r => r.module === 'M10' && r.kind === 'ai_run').length, runs + 1);
  const perf = (await api(store, admin, 'GET', '/api/v1/analytics/ai-performance')).data;
  assert.equal(perf.ran_at, again.data.ran_at, 'GET returns the latest stored run');
});

test('M10: A/B tests computed per variant from events; status changes are stored', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const ab = (await api(store, admin, 'GET', '/api/v1/analytics/ab-test')).data;
  assert.equal(ab.active_experiments.length, 3);
  for (const x of ab.active_experiments) {
    assert.ok(x.variant_a.sessions > 0 && x.variant_b.sessions > 0, x.id);
    assert.equal(x.variant_a_rate, Number((x.variant_a.hits / x.variant_a.sessions).toFixed(3)));
    assert.ok(x.p_value === null || (x.p_value >= 0 && x.p_value <= 1));
  }
  assert.equal(ab.nlu_accuracy.threshold, 90);
  assert.equal((await api(store, admin, 'PATCH', '/api/v1/analytics/ab-test/EXP-PUSH', { status: 'paused' })).data.status, 'paused');
  assert.equal((await api(store, admin, 'GET', '/api/v1/analytics/ab-test')).data.active_experiments.find(x => x.id === 'EXP-PUSH').status, 'paused');
  assert.equal((await api(store, admin, 'PATCH', '/api/v1/analytics/ab-test/EXP-PUSH', { status: 'boom' })).status, 400);
  assert.equal((await api(store, admin, 'PATCH', '/api/v1/analytics/ab-test/NOPE', { status: 'paused' })).status, 404);
});

test('M10: event explorer lists the 14-event catalogue with counts, filters, and PDPD removes own events', async () => {
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const u = await login(store, '0900000094');
  await api(store, u, 'POST', '/api/v1/events', { event_name: 'report_issue', session_id: 'S-x', properties: { place_id: 'PLACE-405' } });
  const e = (await api(store, admin, 'GET', '/api/v1/analytics/events', null, 'name=report_issue&limit=5')).data;
  assert.deepEqual(e.catalog.map(c => c.name), EVENTS);
  assert.ok(e.recent.length >= 1 && e.recent.every(x => x.name === 'report_issue'));
  assert.equal(e.recent[0].is_demo, false);
  assert.equal((await api(store, admin, 'GET', '/api/v1/analytics/events', null, 'name=bogus')).status, 400);
  assert.equal((await api(store, u, 'GET', '/api/v1/me/export')).data.modules.M10.event.length, 1);
  await api(store, u, 'DELETE', '/api/v1/me');
  assert.equal(store.moduleRecords.filter(r => r.owner_id === u.user.id).length, 0);
});
