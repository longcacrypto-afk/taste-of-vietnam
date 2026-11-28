// Core flags over PostgreSQL: GET /admin/ads joins ad_campaigns with M7 module_records,
// the approve gate reads dishes/places inside the moderation transaction, M10 run history.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';
import { loginMerchant, loginAdmin } from '../helpers/auth.js';

const q = (s = '') => new URLSearchParams(s);

test('core flags over Postgres: ads moderation list + gate, meal schedule, NLU history', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = createInitialStore();
    store.repo = new PostgresRepository(pool);
    store.users ||= {};
    const admin = await loginAdmin(store), merchant = await loginMerchant(store);
    const a = (meth, p, b = {}) => { const [path, qs] = p.split('?'); return handleApiRequest(store, meth, path, q(qs), b, admin.headers); };
    const m = (meth, p, b = {}) => handleApiRequest(store, meth, p, q(), b, merchant.headers);

    const list = await a('GET', '/api/v1/admin/ads');
    assert.equal(list.status, 200);
    const n = (await pool.query('SELECT COUNT(*)::int n FROM ad_campaigns')).rows[0].n;
    assert.equal(list.data.total, n);
    assert.equal(list.data.is_demo, true);
    assert.equal(list.data.items.find(c => c.id === 'CMP-701').ready, true);

    await m('POST', '/api/v1/ads/campaigns/builder', { dish_id: 'DISH-101', place_id: 'PLACE-401', meal_slots: ['breakfast'], plan: 'ctx30' });
    const id = (await m('POST', '/api/v1/ads/campaigns/builder/submit')).data.campaign.id;
    const l2 = await a('GET', '/api/v1/admin/ads');
    assert.equal(l2.data.items[0].id, id);
    assert.deepEqual(l2.data.items[0].meal_slots, ['breakfast']);

    // Gate: an un-labelled row cannot go active; the row stays in review.
    await pool.query("UPDATE ad_campaigns SET badge_label='Khác' WHERE id=$1", [id]);
    const no = await a('POST', `/api/v1/admin/ads/${id}/moderate`, { decision: 'active', reason: 'Duyệt' });
    assert.equal(no.status, 409);
    assert.equal((await pool.query('SELECT status FROM ad_campaigns WHERE id=$1', [id])).rows[0].status, 'pending_review');
    await pool.query("UPDATE ad_campaigns SET badge_label='Tài trợ' WHERE id=$1", [id]);
    assert.equal((await a('POST', `/api/v1/admin/ads/${id}/moderate`, { decision: 'active', reason: 'Đạt tiêu chí' })).status, 200);
    assert.equal((await pool.query('SELECT status FROM ad_campaigns WHERE id=$1', [id])).rows[0].status, 'active');
    assert.equal((await pool.query("SELECT COUNT(*)::int n FROM rbac_audit_logs WHERE action='MODERATE_AD' AND target=$1", [id])).rows[0].n, 1);

    // M1-S10 source persists in Postgres.
    assert.equal((await m('PUT', '/api/v1/me/meal-schedule', { lunch: '11:15', dinner: '18:00', max_per_day: 1 })).status, 200);
    const sch = await m('GET', '/api/v1/me/meal-schedule');
    assert.equal(sch.data.lunch, '11:15');
    assert.equal(sch.data.max_per_day, 1);

    // M10 history used by the M9-S01 NLU trend.
    const ai = await a('GET', '/api/v1/analytics/ai-performance');
    assert.equal(ai.status, 200);
    assert.ok(ai.data.history.length >= 1);
    assert.equal(ai.data.safety.allergy_violations, 0);
  } finally {
    await pool.end();
  }
});
