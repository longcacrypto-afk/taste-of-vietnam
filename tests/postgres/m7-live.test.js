// M7 over PostgreSQL: demo seeded once in module_records, builder → ad_campaigns row in review,
// pause/resume on ad_campaigns, VietQR order in payment_orders, sandbox confirm never credits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';
import { loginMerchant, loginAdmin } from '../helpers/auth.js';
import { crc16 } from '../../src/modules/m7-qr.js';

const q = (s = '') => new URLSearchParams(s);

test('M7 over Postgres: campaigns, review lifecycle, pause/resume, VietQR + sandbox', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = createInitialStore();
    store.repo = new PostgresRepository(pool);
    store.users ||= {};   // tests/helpers/auth.js looks the user up here; the account itself is in Postgres
    const merchant = await loginMerchant(store), admin = await loginAdmin(store);
    const m = (meth, p, b = {}) => handleApiRequest(store, meth, p, q(), b, merchant.headers);

    const ov = await m('GET', '/api/v1/ads/overview');
    assert.equal(ov.status, 200);
    assert.equal(ov.data.is_demo, true);
    const seeded = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M7' AND is_demo")).rows[0].n;
    assert.ok(seeded >= 7);
    const list = await m('GET', '/api/v1/ads/campaigns');
    assert.deepEqual(list.data.items.map(c => c.id).sort(), ['CMP-701', 'CMP-702']);

    // builder → pending_review row in ad_campaigns
    assert.equal((await m('POST', '/api/v1/ads/campaigns/builder', { dish_id: 'DISH-101', place_id: 'PLACE-401', meal_slots: ['breakfast'], plan: 'ctx30' })).status, 200);
    const sub = await m('POST', '/api/v1/ads/campaigns/builder/submit');
    assert.equal(sub.status, 201);
    const row = (await pool.query('SELECT status, badge_label, radius_m, budget_vnd FROM ad_campaigns WHERE id=$1', [sub.data.campaign.id])).rows[0];
    assert.deepEqual(row, { status: 'pending_review', badge_label: 'Tài trợ', radius_m: 3000, budget_vnd: 1500000 });
    assert.equal((await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE kind='draft'")).rows[0].n, 0);

    // pause / resume on the real table
    assert.equal((await m('POST', '/api/v1/ads/campaigns/CMP-701/pause')).status, 200);
    assert.equal((await pool.query("SELECT status FROM ad_campaigns WHERE id='CMP-701'")).rows[0].status, 'paused');
    assert.equal((await m('POST', '/api/v1/ads/campaigns/CMP-701/resume')).status, 200);
    assert.equal((await pool.query("SELECT status FROM ad_campaigns WHERE id='CMP-701'")).rows[0].status, 'active');
    const mod = await handleApiRequest(store, 'POST', `/api/v1/admin/ads/${sub.data.campaign.id}/moderate`, q(),
      { decision: 'active', reason: 'Đã kiểm tra nhãn dị ứng' }, admin.headers);
    assert.equal(mod.status, 200);

    // VietQR order + sandbox confirm (real balance untouched, order stays pending)
    const t = await m('POST', '/api/v1/ads/payments/topup', { campaign_id: 'CMP-701', amount_vnd: 250000 });
    assert.equal(t.status, 201);
    assert.equal(crc16(t.data.qr.payload.slice(0, -4)), t.data.qr.payload.slice(-4));
    const ord = (await pool.query('SELECT status, amount_vnd FROM payment_orders WHERE order_id=$1', [t.data.invoice.order_id])).rows[0];
    assert.equal(ord.status, 'PENDING_PAYMENT');
    assert.equal(Number(ord.amount_vnd), 250000);
    const balBefore = (await pool.query("SELECT balance_vnd FROM ad_campaigns WHERE id='CMP-701'")).rows[0].balance_vnd;
    const confirms = await Promise.all([1, 2, 3].map(() => m('POST', `/api/v1/ads/payments/invoices/${t.data.invoice.id}/sandbox-confirm`)));
    assert.equal(confirms.filter(r => r.status === 200).length, 1, 'only one concurrent sandbox confirmation wins');
    assert.equal((await pool.query("SELECT balance_vnd FROM ad_campaigns WHERE id='CMP-701'")).rows[0].balance_vnd, balBefore);
    assert.equal((await pool.query('SELECT status FROM payment_orders WHERE order_id=$1', [t.data.invoice.order_id])).rows[0].status, 'PENDING_PAYMENT');
    const inv = await m('GET', '/api/v1/ads/payments/invoices');
    assert.equal(inv.data.items.find(i => i.id === t.data.invoice.id).status, 'SANDBOX_PAID');
    assert.equal(inv.data.balance.sandbox_vnd, 250000);

    // seeded once
    const store2 = createInitialStore();
    store2.repo = new PostgresRepository(pool);
    await handleApiRequest(store2, 'GET', '/api/v1/ads/overview', q(), {}, merchant.headers);
    assert.equal((await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M7' AND is_demo")).rows[0].n, seeded);
  } finally { await pool.end(); }
});
