// M16 on PostgreSQL: translation over the Postgres catalogue, demo FX reference, request log row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';

test('M16 over Postgres: glossary translation + allergen tags from the DB catalogue', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = createInitialStore();
    store.repo = new PostgresRepository(pool);
    const r = await handleApiRequest(store, 'POST', '/api/v1/translate/menu', new URLSearchParams(),
      { target_lang: 'JA', lines: ['Gỏi cuốn tôm thịt 35.000đ', 'Món lạ quán nhà 10k'] });
    assert.equal(r.status, 200);
    assert.equal(r.data.items[0].matched_dish_id, 'DISH-107');
    assert.ok(r.data.items[0].allergen_tags.includes('peanut'));
    assert.equal(r.data.items[1].status, 'untranslated');
    assert.equal(r.data.fx_is_demo, true);
    const n = (await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M16' AND kind='request'")).rows[0].n;
    assert.equal(n, 1);
  } finally { await pool.end(); }
});
