
import test, { before, after } from 'node:test';
import { createInitialStore } from '../../src/data/seed.js';
import { initRepository } from '../../src/db/repository.js';
import { registerM2Tests } from '../contracts/m2.js';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
let store;
before(async () => {
  if (skip) return;
  await resetDatabase();
  store = createInitialStore();
  await initRepository(store, { databaseUrl: TEST_DATABASE_URL, log: () => {} });
});
after(async () => { if (store) await store.repo.pool.end(); });
registerM2Tests(test, () => store, { skip });
