import { contracts } from './contracts/reviewReportsContract.js';
import { createInitialStore } from '../src/data/seed.js';
import { getRepository } from '../src/db/repository.js';
contracts(async()=>{
  const store=createInitialStore(),repo=getRepository(store);
  return {store,repo};
});
