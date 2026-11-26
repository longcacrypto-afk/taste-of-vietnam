// Migration 011: old databases get the original catalogue's display fields
// (photo key, description, macros, difficulty, tags) only where still empty.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialStore } from '../../src/data/seed.js';
import { initRepository } from '../../src/db/repository.js';
import { skip, resetDatabase, rawPool, TEST_DATABASE_URL } from './helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, '../../src/db/migrations/011_catalog_display_backfill.sql'), 'utf8');
let store, db;

before(async () => {
  if (skip) return;
  await resetDatabase();
  store = createInitialStore();
  await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
  db = rawPool();
});
after(async () => {
  if (skip) return;
  await db.end();
  await store.repo.pool.end();
});

test('011 fills empty display fields from the original catalogue, keeps edits and safety state', { skip }, async () => {
  const seed = createInitialStore();
  const pho = seed.dishes.find(d => d.id === 'DISH-101');
  // A database seeded before 002: display columns at their defaults.
  await db.query(`UPDATE dishes SET img_key=NULL, description='', macros='{}', difficulty=NULL, tags='{}', safety_status='approved' WHERE id='DISH-101'`);
  // An admin already edited this one: must not be overwritten.
  await db.query(`UPDATE dishes SET img_key='042', description='Mô tả của quản trị' WHERE id='DISH-102'`);
  await db.query(`UPDATE places SET img_key=NULL WHERE id='PLACE-401'`);
  await db.query(sql);
  const a = (await db.query(`SELECT img_key, description, macros, difficulty, tags, safety_status FROM dishes WHERE id='DISH-101'`)).rows[0];
  assert.equal(a.img_key, pho.img_key);
  assert.equal(a.description, pho.description);
  assert.deepEqual(a.macros, pho.macros);
  assert.equal(a.difficulty, pho.difficulty);
  assert.deepEqual(a.tags, pho.tags);
  assert.equal(a.safety_status, 'approved', 'display backfill must not revoke a safety review');
  const b = (await db.query(`SELECT img_key, description FROM dishes WHERE id='DISH-102'`)).rows[0];
  assert.deepEqual(b, { img_key: '042', description: 'Mô tả của quản trị' });
  const p = (await db.query(`SELECT img_key FROM places WHERE id='PLACE-401'`)).rows[0];
  assert.equal(p.img_key, seed.places.find(x => x.id === 'PLACE-401').img_key);
  // Re-running is harmless.
  await db.query(sql);
  assert.equal((await db.query(`SELECT description FROM dishes WHERE id='DISH-102'`)).rows[0].description, 'Mô tả của quản trị');
});
