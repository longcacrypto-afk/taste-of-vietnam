import test from 'node:test';
import assert from 'node:assert/strict';
import { contracts } from '../contracts/reviewReportsContract.js';
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

test('Review PostgreSQL: approved mapping, price revision and actor survive a new pool', {skip}, async t=>{
  const {repo,store}=await setup(t);
  const {handleApiRequest}=await import('../../src/api/router.js');
  const {signToken}=await import('../../src/services/authService.js');
  await repo.createUser({id:'persist-reviewer',role:'content_moderator',guest:false,profile:store.userProfile});
  const before=structuredClone(await repo.getPlace('PLACE-401'));
  const r=await handleApiRequest(store,'POST','/api/v1/admin/ocr-review',new URLSearchParams(),
    {ocr_id:'ocr-901',version:1,decision:'approved',dish_id:'DISH-101',price:58000},
    {authorization:`Bearer ${signToken({sub:'persist-reviewer'})}`});
  assert.equal(r.status,200);
  const pool=createPool(TEST_DATABASE_URL,{max:2});t.after(()=>pool.end());
  const fresh=new PostgresRepository(pool);
  assert.equal((await fresh.getPlace('PLACE-401')).menu.find(m=>m.dish_id==='DISH-101').price,58000);
  const revision=(await fresh.listMenuRevisions('PLACE-401'))[0];
  assert.deepEqual(revision.before_menu,before.menu);assert.equal(revision.actor_id,'persist-reviewer');
  assert.equal((await fresh.listOcrQueue()).find(r=>r.id==='ocr-901').reviewed_by,'persist-reviewer');
  assert.equal((await fresh.listOcrQueue()).find(r=>r.id==='ocr-901').version,2);
  await assert.rejects(repo.q("DELETE FROM menu_revisions"),/append-only/);
  await assert.rejects(repo.q("UPDATE menu_revisions SET reason='rewrite'"),/append-only/);
});
test('Reports PostgreSQL: report evidence cannot be deleted/rewritten; privacy unlink remains allowed', {skip}, async t=>{
  const {repo}=await setup(t);
  await assert.rejects(repo.q("DELETE FROM place_reports WHERE id='rep-501'"),/cannot be deleted/);
  await assert.rejects(repo.q("UPDATE place_reports SET evidence='rewrite' WHERE id='rep-501'"),/immutable/);
  await assert.rejects(repo.q("UPDATE place_reports SET reason='closed' WHERE id='rep-501'"),/immutable/);
  await repo.q("UPDATE place_reports SET user_id=NULL WHERE id='rep-501'");
  assert.ok((await repo.listUserReports()).find(r=>r.id==='rep-501'));
});
test('Review PostgreSQL: real SQL audit failure rolls back approved menu and revision', {skip}, async t=>{
  const {repo,store}=await setup(t);
  const {handleApiRequest}=await import('../../src/api/router.js');
  const {signToken}=await import('../../src/services/authService.js');
  await repo.createUser({id:'failed-reviewer',role:'content_moderator',guest:false,profile:store.userProfile});
  const before=structuredClone(await repo.getPlace('PLACE-401'));
  await repo.q(`CREATE FUNCTION fail_menu_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'menu audit unavailable'; END $$`);
  await repo.q(`CREATE TRIGGER fail_menu_audit BEFORE INSERT ON rbac_audit_logs FOR EACH ROW EXECUTE FUNCTION fail_menu_audit()`);
  await assert.rejects(handleApiRequest(store,'POST','/api/v1/admin/ocr-review',new URLSearchParams(),
    {ocr_id:'ocr-901',version:1,decision:'approved',dish_id:'DISH-101',price:59000},
    {authorization:`Bearer ${signToken({sub:'failed-reviewer'})}`}),/menu audit unavailable/);
  assert.deepEqual(await repo.getPlace('PLACE-401'),before);
  assert.equal((await repo.listMenuRevisions('PLACE-401')).length,0);
  assert.equal((await repo.listOcrQueue()).find(r=>r.id==='ocr-901').version,1);
  assert.equal((await repo.listContentVersions('place','PLACE-401')).length,0);
});
