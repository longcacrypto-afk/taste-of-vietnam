// Demo catalogue in PostgreSQL: migration 014, seed path, idempotency, API contract,
// allergy correctness and the documented removal (docs/DEMO_CATALOG.md).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../../src/data/seed.js';
import { initRepository } from '../../src/db/repository.js';
import { seedCatalog } from '../../src/db/seedCatalog.js';
import { DEMO_MENU_LINKS } from '../../src/data/demoCatalog.js';
import { registerDemoCatalogTests } from '../contracts/demoCatalog.js';
import { rawPool, skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';

let store, db;
const n = async (sql) => Number((await db.query(sql)).rows[0].n);
before(async () => {
  if (skip) return;
  await resetDatabase(); // helpers: SEED_DEMO_CATALOG=false → original catalogue only
  db = rawPool();
  store = createInitialStore();
  await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
});
after(async () => { if (db) await db.end(); if (store?.repo) await store.repo.pool.end(); });

test('PG demo catalogue: SEED_DEMO_CATALOG=false seeds nothing; demo seed inserts 146 rows + menu links once', { skip }, async () => {
  assert.equal(await n('SELECT COUNT(*) n FROM dishes'), 12);
  assert.equal(await n('SELECT COUNT(*) n FROM dishes WHERE is_demo'), 0);
  const baseLinks = await n('SELECT COUNT(*) n FROM place_dishes');
  const first = await seedCatalog(db, { log: () => {}, demo: true });
  assert.equal(first.dishes, 0, 'original rows kept');
  assert.equal(first.demo_dishes, 146);
  assert.equal(first.demo_menu_items, DEMO_MENU_LINKS.length);
  const again = await seedCatalog(db, { log: () => {}, demo: true });
  assert.equal(again.demo_dishes, 0);
  assert.equal(again.demo_menu_items, 0);
  assert.equal(await n('SELECT COUNT(*) n FROM dishes'), 158);
  assert.equal(await n("SELECT COUNT(*) n FROM dishes WHERE is_demo AND category = 'drink'"), 40);
  assert.equal(await n("SELECT COUNT(*) n FROM dishes WHERE NOT is_demo AND category IS NULL"), 12);
  assert.equal(await n('SELECT COUNT(*) n FROM place_dishes WHERE is_demo'), DEMO_MENU_LINKS.length);
  assert.equal(await n('SELECT COUNT(*) n FROM place_dishes'), baseLinks + DEMO_MENU_LINKS.length);
  await assert.rejects(db.query("UPDATE dishes SET category = 'snack' WHERE id = 'DISH-D001'"), /dishes_category_check/);
  // --update refreshes demo rows only; an original row an admin edited stays as it is.
  await db.query("UPDATE dishes SET description = 'admin edit' WHERE id = 'DISH-D001'");
  await db.query("UPDATE dishes SET description = 'admin edit 101' WHERE id = 'DISH-101'");
  await seedCatalog(db, { log: () => {}, demo: true, update: false });
  assert.equal((await db.query("SELECT description FROM dishes WHERE id = 'DISH-D001'")).rows[0].description, 'admin edit');
  await seedCatalog(db, { log: () => {}, demo: true, update: true });
  assert.notEqual((await db.query("SELECT description FROM dishes WHERE id = 'DISH-D001'")).rows[0].description, 'admin edit');
  await db.query("UPDATE dishes SET description = 'Nước dùng xương bò ninh thảo quả thơm dịu, thịt bò thăn mềm ngọt chuẩn vị truyền thống.' WHERE id = 'DISH-101'");
});

registerDemoCatalogTests(test, () => store, { skip });

test('PG demo catalogue: saving a place keeps the is_demo flag on its demo menu rows', { skip }, async () => {
  const place = await store.repo.getPlace('PLACE-407');
  assert.ok(place.menu.some(m => m.is_demo === true));
  assert.ok(place.menu.filter(m => m.dish_id === 'DISH-112').every(m => m.is_demo === undefined));
  await store.repo.savePlace(place);
  assert.equal(await n("SELECT COUNT(*) n FROM place_dishes WHERE place_id = 'PLACE-407' AND is_demo"), 6);
});

test('PG demo catalogue: documented removal leaves exactly the original catalogue', { skip }, async () => {
  const before = (await db.query('SELECT id FROM dishes WHERE NOT is_demo ORDER BY id')).rows;
  await db.query('DELETE FROM place_dishes WHERE is_demo');
  await db.query('DELETE FROM dishes WHERE is_demo');
  assert.equal(await n('SELECT COUNT(*) n FROM dishes'), 12);
  assert.deepEqual((await db.query('SELECT id FROM dishes ORDER BY id')).rows, before);
  assert.equal(await n('SELECT COUNT(*) n FROM place_dishes WHERE is_demo'), 0);
  // With the flag off, a re-seed does not bring them back.
  await seedCatalog(db, { log: () => {}, demo: false });
  assert.equal(await n('SELECT COUNT(*) n FROM dishes'), 12);
  const r = await (await import('../../src/api/router.js')).handleApiRequest(store, 'GET', '/api/v1/dishes',
    new URLSearchParams({ safe_only: 'false', limit: '100' }), {}, {});
  assert.equal(r.data.total, 12);
});
