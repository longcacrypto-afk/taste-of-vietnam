// M17 live: admin-only enterprise insights with k-anonymity (k ≥ 50) over demo + real events,
// FMCG brand campaigns list/performance and pause/resume.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { guest, loginAdmin, loginMerchant } from './helpers/auth.js';

const q = (s = '') => new URLSearchParams(s);
const api = (store, m, p, body, h) => handleApiRequest(store, m, p, q(), body, h?.headers || {});

test('M17: enterprise routes are super_admin only', async () => {
  const store = createInitialStore();
  assert.equal((await api(store, 'GET', '/api/v1/enterprise/tourism-insights')).status, 401);
  assert.equal((await api(store, 'GET', '/api/v1/enterprise/tourism-insights', {}, await guest(store))).status, 403);
  assert.equal((await api(store, 'GET', '/api/v1/enterprise/brand-campaigns', {}, await loginMerchant(store))).status, 403);
  assert.equal((await api(store, 'GET', '/api/v1/enterprise/brand-campaigns', {}, await loginAdmin(store))).status, 200);
});

test('M17: insights suppress every cell under k = 50 and totals add only shown cells', async () => {
  const store = createInitialStore();
  const a = await loginAdmin(store);
  const r = await api(store, 'GET', '/api/v1/enterprise/tourism-insights', {}, a);
  assert.equal(r.status, 200);
  const d = r.data;
  assert.equal(d.k_anonymity.k, 50);
  assert.ok(d.k_anonymity.suppressed_cells >= 3);
  const cells = [...d.top_dishes, ...d.languages, ...d.checkin_places, ...d.areas];
  for (const c of cells) {
    if (c.suppressed) { assert.equal(c.value, null); assert.equal(c.contributors, null); }
    else assert.ok(c.contributors >= 50);
  }
  const zh = d.languages.find(l => l.lang === 'ZH');
  assert.equal(zh.suppressed, true);
  assert.equal(zh.pct, null);
  assert.equal(d.kpis.translator_sessions, d.languages.reduce((s, l) => s + (l.value || 0), 0));
  assert.equal(d.kpis.trail_checkins, d.checkin_places.reduce((s, l) => s + (l.value || 0), 0));
  assert.equal(d.trend.length, 4);
  assert.equal(d.is_demo, true);
  assert.equal(d.k_anonymity_enforced, true); // legacy key
});

test('M17: real stamps, translations and order redirects are merged into the cells', async () => {
  const store = createInitialStore();
  const a = await loginAdmin(store);
  const before = (await api(store, 'GET', '/api/v1/enterprise/tourism-insights', {}, a)).data;
  const g = await guest(store);
  await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: 'BH1-SANG-7Q2K' }, g);
  await api(store, 'POST', '/api/v1/translate/menu', { target_lang: 'KO', lines: ['Phở bò'] }, g);
  const red = await api(store, 'POST', '/api/v1/orders/redirect', { place_id: 'PLACE-401', dish_id: 'DISH-101', partner: 'grabfood' }, g);
  assert.equal(red.status, 200);
  const after = (await api(store, 'GET', '/api/v1/enterprise/tourism-insights', {}, a)).data;
  assert.equal(after.sources.real_events.passport_stamps, before.sources.real_events.passport_stamps + 1);
  assert.equal(after.sources.real_events.translator_requests, before.sources.real_events.translator_requests + 1);
  assert.equal(after.sources.real_events.order_redirects, before.sources.real_events.order_redirects + 1);
  const v = (d, list, key) => d[list].find(x => x.key === key).value;
  assert.equal(v(after, 'checkin_places', 'PLACE-401'), v(before, 'checkin_places', 'PLACE-401') + 1);
  assert.equal(v(after, 'languages', 'KO'), v(before, 'languages', 'KO') + 1);
  assert.equal(v(after, 'top_dishes', 'DISH-101'), v(before, 'top_dishes', 'DISH-101') + 1);
  // A cell made only of a few real users stays hidden.
  assert.equal(after.checkin_places.find(x => x.key === 'PLACE-408').suppressed, true);
});

test('M17: with no demo data, a handful of real events is fully suppressed', async () => {
  process.env.SEED_DEMO_MODULES = 'false';
  try {
    const store = createInitialStore();
    const a = await loginAdmin(store);
    const g = await guest(store);
    await api(store, 'POST', '/api/v1/tourism/passport/checkin', { qr_token: 'BH1-SANG-7Q2K' }, g);
    const d = (await api(store, 'GET', '/api/v1/enterprise/tourism-insights', {}, a)).data;
    assert.equal(d.kpis.trail_checkins, 0);
    assert.ok([...d.checkin_places, ...d.areas].every(c => c.suppressed));
    assert.ok(d.trend.every(t => t.suppressed && t.value === null));
  } finally { delete process.env.SEED_DEMO_MODULES; }
});

test('M17: brand campaigns list with performance, pause / resume, validation', async () => {
  const store = createInitialStore();
  const a = await loginAdmin(store);
  const r = await api(store, 'GET', '/api/v1/enterprise/brand-campaigns', {}, a);
  assert.ok(r.data.items.length >= 3);
  const c = r.data.items.find(x => x.id === 'BRAND-901');
  assert.equal(c.ctr_pct, Math.round((c.clicks / c.impressions) * 1000) / 10);
  assert.ok(c.dishes.every(x => store.dishes.some(d => d.id === x.dish_id)));
  assert.equal(c.sponsored_label, 'Tài trợ');
  const p = await api(store, 'POST', '/api/v1/enterprise/brand-campaigns/BRAND-901/status', { status: 'paused' }, a);
  assert.equal(p.status, 200);
  assert.equal(p.data.status, 'paused');
  assert.equal(p.data.status_history.length, 1);
  assert.equal((await api(store, 'POST', '/api/v1/enterprise/brand-campaigns/BRAND-901/status', { status: 'deleted' }, a)).status, 400);
  assert.equal((await api(store, 'POST', '/api/v1/enterprise/brand-campaigns/NOPE/status', { status: 'active' }, a)).status, 404);
  assert.equal((await api(store, 'GET', '/api/v1/enterprise/brand-campaigns/BRAND-902', {}, a)).data.id, 'BRAND-902');
  const g = await guest(store);
  assert.equal((await api(store, 'POST', '/api/v1/enterprise/brand-campaigns/BRAND-901/status', { status: 'active' }, g)).status, 403);
});
