
import test, { before, after } from 'node:test';
import { createInitialStore } from '../../src/data/seed.js';
import { initRepository } from '../../src/db/repository.js';
import { registerM2Tests } from '../contracts/m2.js';
import { rawPool, skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
let store;
before(async () => {
  if (skip) return;
  await resetDatabase();
  store = createInitialStore();
  await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
});
after(async () => { if (store) await store.repo.pool.end(); });
registerM2Tests(test, () => store, { skip });


test('M2 PostgreSQL: saved rows are real, isolated and readable by a fresh repository instance', { skip }, async () => {
  const assert = (await import('node:assert/strict')).default;
  const { PostgresRepository } = await import('../../src/db/postgresRepository.js');
  const headersFor = async () => {
    const { handleApiRequest } = await import('../../src/api/router.js');
    const r = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', new URLSearchParams());
    return { id: r.data.guest_id, headers: { authorization: `Bearer ${r.data.access_token}` } };
  };
  const { handleApiRequest } = await import('../../src/api/router.js');
  const a = await headersFor(), b = await headersFor();
  const r = await handleApiRequest(store, 'POST', '/api/v1/me/collections', new URLSearchParams(), { name: 'PG bền vững' }, a.headers);
  const id = r.data.collection.id;
  await handleApiRequest(store, 'POST', `/api/v1/me/collections/${id}/dishes`, new URLSearchParams(), { dish_id: 'DISH-101' }, a.headers);
  const db = rawPool();
  try {
    const rows = (await db.query('SELECT user_id,name,dish_ids FROM saved_collections WHERE id=$1', [id])).rows;
    assert.deepEqual(rows, [{ user_id: a.id, name: 'PG bền vững', dish_ids: ['DISH-101'] }]);
    const fresh = new PostgresRepository(db);
    assert.deepEqual((await fresh.listCollections(a.id)).find(c => c.id === id).dish_ids, ['DISH-101']);
    assert.ok(!(await fresh.listCollections(b.id)).some(c => c.id === id));
  } finally { await db.end(); }
});

test('M2 PostgreSQL: repeated delete/save races leave no dangling IDs in raw rows', { skip }, async () => {
  const assert = (await import('node:assert/strict')).default;
  const { handleApiRequest } = await import('../../src/api/router.js');
  const g = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', new URLSearchParams());
  const headers = { authorization: `Bearer ${g.data.access_token}` };
  const original = await store.repo.getDish('DISH-101');
  const db = rawPool();
  try {
    for (let n = 0; n < 20; n++) {
      const id = `DISH-M2-RACE-${n}`;
      await store.repo.createDish({ ...original, id });
      await handleApiRequest(store, 'POST', '/api/v1/me/collections', new URLSearchParams(), { dish_id: id }, headers);
      await Promise.all([
        store.repo.deleteDish(id),
        handleApiRequest(store, 'POST', '/api/v1/me/collections', new URLSearchParams(), { dish_id: 'DISH-102' }, headers),
        handleApiRequest(store, 'POST', '/api/v1/me/collections', new URLSearchParams(), { dish_id: id }, headers)
      ]);
      assert.equal((await db.query('SELECT COUNT(*)::int n FROM saved_collections WHERE $1=ANY(dish_ids)', [id])).rows[0].n, 0);
    }
  } finally { await db.end(); }
});
