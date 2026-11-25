import test from 'node:test';
import assert from 'node:assert/strict';
import { contracts } from '../contracts/dataEntryContract.js';
import { createInitialStore } from '../../src/data/seed.js';
import { initRepository } from '../../src/db/repository.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/postgresRepository.js';
import { resetDatabase, skip, TEST_DATABASE_URL } from './helpers.js';
async function setup(t) {
  await resetDatabase();
  const store=createInitialStore(),repo=await initRepository(store,{databaseUrl:TEST_DATABASE_URL,log:()=>{}});
  t.after(()=>repo.pool.end());return {store,repo};
}
contracts(setup,{skip});
test('CMS PostgreSQL: out-of-band ingredient edits revoke published approval and provenance',{skip},async t=>{
  const {repo}=await setup(t);
  await repo.q(`UPDATE dishes SET cms='{"status":"published","version":1,"verified_at":"2026-01-01","verified_by":"x"}',safety_status='approved' WHERE id='DISH-101'`);
  await repo.q(`UPDATE dishes SET ingredients='[{"name":"changed","amount":2,"unit":"g"}]' WHERE id='DISH-101'`);
  const d=await repo.getDish('DISH-101');
  assert.equal(d.cms.status,'draft');assert.equal(d.cms.verified_at,null);assert.equal(d.safety_status,'pending');
});
test('CMS PostgreSQL: place/menu geometry and snapshot persist through a fresh pool',{skip},async t=>{
  const {repo}=await setup(t);
  const p={...(await repo.getPlace('PLACE-401')),cms:{status:'pending',version:1},is_verified:false,lat:10.95123,lng:106.84123};
  await repo.atomic(async tx=>{await tx.savePlace(p);await tx.saveContentVersion('place',p.id,1,p);});
  const pool=createPool(TEST_DATABASE_URL,{max:2});t.after(()=>pool.end());
  const fresh=new PostgresRepository(pool),read=await fresh.getPlace(p.id);
  assert.equal(read.lat,p.lat);assert.equal(read.lng,p.lng);assert.equal(read.is_verified,false);
  assert.deepEqual(read.menu.map(m=>m.dish_id),p.menu.map(m=>m.dish_id));
  assert.equal((await fresh.listContentVersions('place',p.id))[0].snapshot.cms.status,'pending');
});
