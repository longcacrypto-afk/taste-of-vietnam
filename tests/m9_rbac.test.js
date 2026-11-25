import { contracts } from './contracts/adminContract.js';
import { createInitialStore } from '../src/data/seed.js';
import { getRepository } from '../src/db/repository.js';
contracts(async () => {
  const store=createInitialStore();
  const repo=getRepository(store);
  return {store,repo,ageReports:async(placeId,hours)=>{
    for(const r of store.userReports) if(r.place_id===placeId) r.created_at=new Date(Date.now()-hours*3600000).toISOString();
  }};
});
