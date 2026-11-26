// M9-S02 "Vector DB" on PostgreSQL: has_embedding comes from dishes.embedding.
// The CI image (postgis) has no pgvector, so the column is normally absent → all false.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../../src/data/seed.js';
import { initRepository } from '../../src/db/repository.js';
import { resetDatabase, skip, TEST_DATABASE_URL } from './helpers.js';
import { loginAdmin } from '../helpers/auth.js';

test('M9-S02 PostgreSQL: has_embedding is false without vectors and true only where one is stored', { skip }, async (t) => {
  await resetDatabase();
  const store = createInitialStore(), repo = await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
  t.after(() => repo.pool.end());
  const { handleApiRequest } = await import('../../src/api/router.js');
  const admin = await loginAdmin(store);
  const dash = async () => (await handleApiRequest(store, 'GET', '/api/v1/admin/dashboard', new URLSearchParams(), {}, admin.headers)).data;
  const hasColumn = async () => (await repo.q(`SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
    AND table_name = 'dishes' AND column_name = 'embedding'`)).rowCount > 0;
  const native = await hasColumn();
  const first = await dash();
  assert.ok(first.catalog.length > 0);
  for (const d of first.catalog) assert.equal(d.has_embedding, false, d.id);
  // Store one vector. Without pgvector, stand in a plain real[] column with the same name.
  if (!native) await repo.q('ALTER TABLE dishes ADD COLUMN embedding real[]');
  t.after(async () => { if (!native) await repo.q('ALTER TABLE dishes DROP COLUMN IF EXISTS embedding'); });
  await repo.q(`UPDATE dishes SET embedding = array_fill(0.1::real, ARRAY[768]) WHERE id = 'DISH-101'`);
  const second = await dash();
  assert.deepEqual(second.catalog.filter((d) => d.has_embedding).map((d) => d.id), ['DISH-101']);
  assert.deepEqual(await repo.listEmbeddedDishIds(), ['DISH-101']);
});
