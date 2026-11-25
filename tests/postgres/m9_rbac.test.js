import test from 'node:test';
import assert from 'node:assert/strict';
import { contracts } from '../contracts/adminContract.js';
import { createInitialStore } from '../../src/data/seed.js';
import { initRepository } from '../../src/db/repository.js';
import { PostgresRepository } from '../../src/db/postgresRepository.js';
import { createPool } from '../../src/db/connection.js';
import { handleApiRequest } from '../../src/api/router.js';
import { signToken } from '../../src/services/authService.js';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
async function setup(t) {
  await resetDatabase();
  const store=createInitialStore();
  const repo=await initRepository(store,{databaseUrl:TEST_DATABASE_URL,log:()=>{}});
  t.after(()=>repo.pool.end());
  return {store,repo,ageReports:async(placeId,hours)=>{
    await repo.q("UPDATE place_reports SET created_at=NOW()-make_interval(hours=>$2) WHERE place_id=$1",[placeId,hours]);
    await repo.q("UPDATE report_dedupe SET last_at=NOW()-make_interval(hours=>$2) WHERE place_id=$1",[placeId,hours]);
  }};
}
contracts(setup,{skip});

test('M9 PostgreSQL: audit failure rolls back each admin mutation and automatic closure pause', {skip},async t=>{
  const {store,repo}=await setup(t);
  for(const id of ['admin','user1','user2','user3']) await repo.createUser({id,role:id==='admin'?'super_admin':'consumer',
    guest:false,phone:`+8490000000${id==='admin'?0:id.slice(-1)}`,profile:store.userProfile});
  const api=(method,path,who,body)=>handleApiRequest(store,method,path,new URLSearchParams(),body,{authorization:`Bearer ${signToken({sub:who})}`});
  const before=await repo.getDish('DISH-101');
  await repo.createRecipe({id:'REC-M9-AUDIT',author_id:'user1',author:'Tác giả',title:'Món cũ',ingredients:[],prep_time_minutes:25,difficulty:'Dễ',calories:450,zero_waste_tag:null});
  await repo.q(`CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$`);
  await repo.q(`CREATE TRIGGER fail_audit BEFORE INSERT ON rbac_audit_logs FOR EACH ROW EXECUTE FUNCTION fail_audit()`);
  for(const [method,path,body] of [
    ['POST','/api/v1/admin/dishes',{name:'Không được lưu'}],
    ['PATCH','/api/v1/admin/dishes/DISH-101',{name:'Không được sửa'}],
    ['DELETE','/api/v1/admin/dishes/DISH-101',{}],
    ['POST','/api/v1/admin/rbac/users',{user_id:'user1',role:'ops_admin',reason:'Thử rollback'}],
    ['POST','/api/v1/admin/places/PLACE-405/unpause',{reason:'Thử rollback'}],
    ['POST','/api/v1/admin/places/PLACE-405/approve',{reason:'Thử rollback'}],
    ['POST','/api/v1/admin/ocr-review',{ocr_id:'ocr-901',decision:'rejected',reason:'Thử rollback'}],
    ['POST','/api/v1/admin/ads/CMP-701/moderate',{decision:'paused',reason:'Thử rollback'}],
    ['PATCH','/api/v1/community/recipes/REC-M9-AUDIT',{title:'Không được sửa',reason:'Thử rollback'}],
    ['DELETE','/api/v1/community/recipes/REC-M9-AUDIT',{reason:'Thử rollback'}]
  ]) await assert.rejects(api(method,path,'admin',body),/audit unavailable/);
  assert.equal((await repo.getDish('DISH-101')).name,before.name);
  assert.equal((await repo.getRecipe('REC-M9-AUDIT')).title,'Món cũ');
  assert.equal((await repo.listDishes()).length,12);
  assert.equal((await repo.getUser('user1')).role,'consumer');
  assert.equal((await repo.getPlace('PLACE-405')).is_open_override,false);
  assert.notEqual((await repo.listOcrQueue()).find(r=>r.id==='ocr-901').status,'rejected');
  assert.notEqual((await repo.getCampaign('CMP-701')).status,'paused');
  await api('POST','/api/v1/places/PLACE-404/reports','user1',{reason:'closed'});
  await api('POST','/api/v1/places/PLACE-404/reports','user2',{reason:'closed'});
  await assert.rejects(api('POST','/api/v1/places/PLACE-404/reports','user3',{reason:'closed'}),/audit unavailable/);
  assert.equal((await repo.getPlace('PLACE-404')).closed_report_count,2);
  assert.equal((await repo.getPlace('PLACE-404')).is_open_override,true);
  assert.equal((await repo.listUserReports()).filter(r=>r.place_id==='PLACE-404').length,2);
  await repo.q('DROP TRIGGER fail_audit ON rbac_audit_logs');
  const report=(await repo.listUserReports()).find(r=>r.place_id==='PLACE-404');
  await repo.q(`CREATE TRIGGER fail_audit BEFORE INSERT ON rbac_audit_logs FOR EACH ROW EXECUTE FUNCTION fail_audit()`);
  await assert.rejects(api('PATCH',`/api/v1/admin/reports/${report.id}`,'admin',{status:'resolved',reason:'Thử rollback'}),/audit unavailable/);
  assert.equal((await repo.listUserReports()).find(r=>r.id===report.id).status,'pending_review');
});

test('M9 PostgreSQL: audit rejects UPDATE/DELETE; role grant survives a new repository/pool', {skip},async t=>{
  const {repo}=await setup(t);
  await repo.createUser({id:'a',role:'consumer',phone:'+84900000100',guest:false,profile:{}});
  await repo.atomic(async tx=>{
    await tx.assignRole('a','ops_admin');
    await tx.addAudit({actor:'test',role:'super_admin',action:'ASSIGN_ROLE',target:'a',before:{role:'consumer'},after:{role:'ops_admin'},reason:'Test restart'});
  });
  const pool=createPool(TEST_DATABASE_URL,{max:2});
  t.after(()=>pool.end());
  const fresh=new PostgresRepository(pool);
  assert.equal((await fresh.getUser('a')).role,'ops_admin');
  await assert.rejects(repo.q("UPDATE rbac_audit_logs SET reason='tampered'"),/append-only/);
  await assert.rejects(repo.q('DELETE FROM rbac_audit_logs'),/append-only/);
});

test('M9 PostgreSQL: concurrent bootstrap grants exactly one super admin; allowlist and guest guarded in repository', {skip},async t=>{
  const {repo}=await setup(t);
  const old=process.env.ADMIN_PHONES;
  process.env.ADMIN_PHONES='0900000100,0900000101';
  t.after(()=>{if(old===undefined) delete process.env.ADMIN_PHONES;else process.env.ADMIN_PHONES=old;});
  for(const [id,phone,guest] of [['a','+84900000100',false],['b','+84900000101',false],['g',null,true],['x','+84900000102',false]])
    await repo.createUser({id,role:guest?'guest':'consumer',guest,phone,profile:{}});
  assert.equal(await repo.bootstrapSuperAdmin('g'),false);
  assert.equal(await repo.bootstrapSuperAdmin('x'),false);
  const out=await Promise.all([repo.bootstrapSuperAdmin('a'),repo.bootstrapSuperAdmin('b')]);
  assert.equal(out.filter(Boolean).length,1);
  assert.equal((await repo.listUsers()).filter(u=>u.role==='super_admin').length,1);
  assert.equal((await repo.listAudit(100)).filter(r=>r.action==='BOOTSTRAP_SUPER_ADMIN').length,1);
});
