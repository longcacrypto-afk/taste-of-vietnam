// core-filters over PostgreSQL: migration 013 (dishes.is_soup nullable, places.has_ac
// nullable), and the M2-S02 / M4-S01 filters on the Postgres catalogue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';

const q = (s = '') => new URLSearchParams(s);
const ids = (r) => r.data.items.map((x) => x.id);

test('migration 013: is_soup / has_ac nullable, seeded only with known values', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const cols = (await pool.query(`SELECT table_name, column_name, is_nullable, column_default FROM information_schema.columns
      WHERE (table_name='dishes' AND column_name='is_soup') OR (table_name='places' AND column_name='has_ac') ORDER BY table_name`)).rows;
    assert.deepEqual(cols.map((c) => [c.table_name, c.is_nullable, c.column_default]), [['dishes', 'YES', null], ['places', 'YES', null]]);
    const soup = Object.fromEntries((await pool.query('SELECT id, is_soup FROM dishes')).rows.map((r) => [r.id, r.is_soup]));
    assert.equal(soup['DISH-101'], true);
    assert.equal(soup['DISH-102'], false);
    assert.equal(soup['DISH-108'], null, 'ambiguous dish left unknown');
    assert.equal(soup['DISH-111'], null);
  } finally { await pool.end(); }
});

test('Postgres: GET /dishes soup / exclude_seafood and GET /places has_ac / delivery / max_price', { skip }, async () => {
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = createInitialStore();
    store.repo = new PostgresRepository(pool);
    const soup = await handleApiRequest(store, 'GET', '/api/v1/dishes', q('safe_only=false&soup=true&limit=100'));
    assert.equal(soup.status, 200);
    assert.deepEqual(ids(soup).sort(), ['DISH-101', 'DISH-103', 'DISH-105', 'DISH-106', 'DISH-110']);
    const sea = await handleApiRequest(store, 'GET', '/api/v1/dishes', q('safe_only=false&exclude_seafood=true&limit=100'));
    assert.ok(!ids(sea).some((id) => ['DISH-106', 'DISH-107', 'DISH-109', 'DISH-110'].includes(id)));

    await pool.query("UPDATE places SET has_ac = NULL WHERE id = 'PLACE-401'"); // not entered
    const ac = await handleApiRequest(store, 'GET', '/api/v1/places', q('has_ac=true'));
    assert.equal(ac.status, 200);
    assert.ok(ac.data.items.length > 0 && ac.data.items.every((p) => p.has_ac === true));
    assert.ok(!ids(ac).includes('PLACE-401'), 'unknown AC does not match');
    assert.ok(ac.data.filtered_out > 0);
    const cheap = await handleApiRequest(store, 'GET', '/api/v1/places', q('dish_id=DISH-101&max_price=50000&delivery=true'));
    assert.ok(cheap.data.items.length > 0);
    assert.ok(cheap.data.items.every((p) => p.menu.some((m) => m.dish_id === 'DISH-101' && m.price <= 50000)
      && (p.links.grabfood || p.links.shopeefood)));
    // a place saved without has_ac stays unknown (not silently false)
    const p = await store.repo.getPlace('PLACE-401');
    await store.repo.savePlace({ ...p, has_ac: undefined });
    assert.equal((await pool.query("SELECT has_ac FROM places WHERE id='PLACE-401'")).rows[0].has_ac, null);
  } finally { await pool.end(); }
});
