// M20 over PostgreSQL: tip-intent + confirm on community_recipes (core table), one like per
// account (row-level unique id), payout account in module_records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';

test('M20 over Postgres: likes once, VietQR tip confirmed once updates total_tips_vnd', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = createInitialStore();
    store.repo = new PostgresRepository(pool);
    const call = (m, p, body, h) => handleApiRequest(store, m, p, new URLSearchParams(), body, h);
    const guest = async () => { const g = await call('POST', '/api/v1/auth/guest'); return { id: g.data.guest_id, h: { authorization: `Bearer ${g.data.access_token}` } }; };
    const author = await guest(), fan = await guest();
    await call('PUT', '/api/v1/community/payout-account', { bank_bin: '970415', account_number: '1020304050', account_name: 'Tran Thi B' }, author.h);
    const rec = await call('POST', '/api/v1/community/recipes', { title: 'Canh chua cá lóc' }, author.h);
    await Promise.all([1, 2, 3].map(() => call('POST', `/api/v1/community/recipes/${rec.data.id}/like`, {}, fan.h)));
    assert.equal((await pool.query('SELECT likes_count FROM community_recipes WHERE id=$1', [rec.data.id])).rows[0].likes_count, 2);
    const t = await call('POST', `/api/v1/community/recipes/${rec.data.id}/tip-intent`, { amount_vnd: 20000 }, fan.h);
    assert.equal(t.data.vietqr.bank_name, 'VietinBank');
    assert.equal(Number((await pool.query('SELECT total_tips_vnd FROM community_recipes WHERE id=$1', [rec.data.id])).rows[0].total_tips_vnd), 0);
    await Promise.all([1, 2].map(() => call('POST', `/api/v1/community/tips/${t.data.tip_id}/confirm`, {}, fan.h)));
    assert.equal(Number((await pool.query('SELECT total_tips_vnd FROM community_recipes WHERE id=$1', [rec.data.id])).rows[0].total_tips_vnd), 20000, 'confirmed once');
    const list = await call('GET', '/api/v1/community/recipes', {}, fan.h);
    const mine = list.data.recipes.find(r => r.id === rec.data.id);
    assert.equal(mine.payout_ready, true);
    assert.equal(mine.liked_by_me, true);
    assert.equal(list.data.recipes.find(r => r.id === 'CREC-01').is_demo, true);
  } finally { await pool.end(); }
});
