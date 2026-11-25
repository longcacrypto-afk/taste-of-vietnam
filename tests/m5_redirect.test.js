import { createInitialStore } from '../src/data/seed.js';
import { getRepository } from '../src/db/repository.js';
import { m5Contract } from './helpers/m5Contract.js';
m5Contract(async () => {
  const store = createInitialStore();
  return { store, repo: getRepository(store) };
});
