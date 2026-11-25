import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApiRequest } from '../../src/api/router.js';
import { signToken, requestOtp, verifyOtp } from '../../src/services/authService.js';
import { reportInput } from '../../src/services/reportPolicy.js';

const roles=['guest','user','merchant','admin','consumer','merchant_owner','merchant_staff','content_moderator','ops_admin','super_admin'];
const permissions={
  guest:[],user:[],merchant:[],admin:[],consumer:[],merchant_owner:[],merchant_staff:[],
  content_moderator:['dashboard','dishes','ocr','reports'],
  ops_admin:['dashboard','places','reports','ads','audit'],
  super_admin:['dashboard','dishes','ocr','reports','places','ads','audit','rbac']
};
// Independent acceptance list, deliberately not imported from the implementation's ACL.
const routes=[
  ['GET','dashboard','dashboard',{}],
  ['POST','dishes','dishes',{name:'Món kiểm thử'}],
  ['PUT','dishes/NOPE','dishes',{name:'Món sửa'}],
  ['PATCH','dishes/NOPE','dishes',{name:'Món sửa'}],
  ['DELETE','dishes/NOPE','dishes',{}],
  ['POST','ocr-review','ocr',{ocr_id:'NOPE',decision:'rejected',reason:'Ảnh mờ'}],
  ['POST','places/NOPE/approve','places',{reason:'Đã xác minh'}],
  ['POST','places/NOPE/unpause','places',{reason:'Đã xác minh'}],
  ['GET','reports','reports',{}],
  ['PATCH','reports/NOPE','reports',{status:'resolved',reason:'Đã kiểm tra'}],
  ['POST','ads/NOPE/moderate','ads',{decision:'paused',reason:'Đã kiểm tra'}],
  ['GET','audit-logs','audit',{}],
  ['GET','rbac/roles','rbac',{}],
  ['GET','rbac/users','rbac',{}],
  ['POST','rbac/users','rbac',{user_id:'test-user',role:'consumer',reason:'Quyền phù hợp'}]
];

export function contracts(make,options={}) {
  async function setup(t) {
    const f=await make(t);
    const {store,repo}=f;
    let i=100;
    for(const role of roles) await repo.createUser({
      id:`test-${role}`,role,phone:role==='guest'?null:`+84980000${String(i++).padStart(3,'0')}`,
      guest:role==='guest',identity_verified:role!=='guest',created_at:new Date().toISOString(),profile:structuredClone(store.userProfile)
    });
    const headers=id=>id?{authorization:`Bearer ${signToken({sub:id,role:'super_admin'})}`}:{};
    const api=(method,path,who='super_admin',body={},query={})=>
      handleApiRequest(store,method,path,new URLSearchParams(query),body,headers(who===null?null:who.startsWith('test-')?who:`test-${who}`));
    return {...f,headers,api};
  }
  test('M9 every route: anonymous, guest, user, legacy roles and each of the six roles',options,async t=>{
    const {api}=await setup(t);
    for(const [method,path,permission,body] of routes) {
      assert.equal((await api(method,`/api/v1/admin/${path}`,null,body)).status,401,`${method} ${path}: anonymous`);
      for(const role of roles) {
        const r=await api(method,`/api/v1/admin/${path}`,role,body);
        const allowed=permissions[role].includes(permission);
        if(!allowed) assert.equal(r.status,403,`${method} ${path}: ${role}`);
        else assert.ok([200,201,404].includes(r.status),`${method} ${path}: ${role}: ${JSON.stringify(r)}`);
      }
    }
    for(const role of roles) for(const [method,path] of [
      ['GET','new-admin-feature'],['DELETE','rbac/users'],['PUT','reports/NOPE'],['POST','audit-logs'],['GET','dishes/NOPE'],
      ['HEAD','dashboard'],['POST','dashboard'],['GET','reports/NOPE/extra']
    ]) assert.equal((await api(method,`/api/v1/admin/${path}`,role)).status,403,`${role}: deny unregistered ${method} ${path}`);
  });

  test('M9 persisted role assignments take effect on existing tokens and cannot be forged in profiles',options,async t=>{
    const {api,repo}=await setup(t);
    const assign=role=>api('POST','/api/v1/admin/rbac/users','super_admin',{user_id:'test-user',role,reason:'Phân công kiểm duyệt'});
    assert.equal((await assign('content_moderator')).status,200);
    assert.equal((await repo.getUser('test-user')).role,'content_moderator');
    assert.equal((await api('POST','/api/v1/admin/dishes','user',{name:'Được phép'})).status,201);
    assert.equal((await api('GET','/api/v1/admin/audit-logs','user')).status,403);
    assert.equal((await api('PUT','/api/v1/me/profile','user',{role:'super_admin',identity_verified:true})).status,200);
    assert.equal((await api('GET','/api/v1/admin/rbac/users','user')).status,403);
    assert.equal((await assign('consumer')).status,200);
    assert.equal((await api('POST','/api/v1/admin/dishes','user',{name:'Không được phép'})).status,403);
    const logs=await repo.listAudit(100);
    const row=logs.find(l=>l.action==='ASSIGN_ROLE');
    assert.ok(row.before && row.after && row.reason);
    assert.ok(row.request_id || row.requestId);
    assert.equal(row.actor_id,'test-super_admin');
    assert.ok(!JSON.stringify(row).includes('authorization'));
  });

  test('M9 validates assignment, disallows guests, missing reason and last-super-admin self lockout',options,async t=>{
    const {api,repo}=await setup(t);
    const assign=(user_id,role,reason='Có lý do')=>api('POST','/api/v1/admin/rbac/users','super_admin',{user_id,role,reason});
    assert.equal((await assign('test-super_admin','consumer')).status,409);
    assert.equal((await api('DELETE','/api/v1/me','super_admin')).status,409);
    assert.equal((await repo.getUser('test-super_admin')).role,'super_admin');
    assert.equal((await assign('test-user','editor')).status,400);
    assert.equal((await assign('test-guest','super_admin')).status,400);
    assert.equal((await assign('NOPE','consumer')).status,404);
    assert.equal((await assign('test-user','consumer','')).status,400);
    assert.equal((await assign('test-user','super_admin')).status,200);
    const results=await Promise.all([
      api('POST','/api/v1/admin/rbac/users','super_admin',{user_id:'test-super_admin',role:'consumer',reason:'Bàn giao'}),
      api('POST','/api/v1/admin/rbac/users','test-user',{user_id:'test-user',role:'consumer',reason:'Bàn giao'})
    ]);
    assert.equal(results.filter(r=>r.status===200).length,1);
    assert.equal((await repo.listUsers()).filter(u=>u.role==='super_admin').length,1);
  });

  test('M9 bootstrap only first trusted allowlisted identity; re-login never overwrites DB roles',options,async t=>{
    const {repo,store}=await setup(t);
    const phone='0912345000';
    const old=process.env.ADMIN_PHONES;
    process.env.ADMIN_PHONES=phone;
    t.after(()=>{ if(old===undefined)delete process.env.ADMIN_PHONES;else process.env.ADMIN_PHONES=old; });
    const r=await requestOtp(repo,phone);
    const v=await verifyOtp(repo,phone,r.data.dev_code,store.userProfile);
    assert.equal(v.data.role,'user','existing super_admin prevents env promotion');
    const u=await repo.findUserByPhone('+84912345000');
    await repo.atomic(tx=>tx.assignRole(u.id,'ops_admin'));
    // Re-send fixture resets OTP resend window without waiting.
    await repo.deleteOtp('+84912345000');
    const r2=await requestOtp(repo,phone);
    const v2=await verifyOtp(repo,phone,r2.data.dev_code,store.userProfile);
    assert.equal(v2.data.role,'ops_admin');
    assert.equal(await repo.bootstrapSuperAdmin('test-guest'),false);
    assert.equal(await repo.bootstrapSuperAdmin('test-consumer'),false);
  });

  test('M4 report eligibility: anonymous/guest cannot vote; reason enum and trusted root identity only',options,async t=>{
    const {api,repo}=await setup(t);
    const path='/api/v1/places/PLACE-404/reports';
    assert.equal((await api('POST',path,null,{reason:'closed'})).status,401);
    assert.equal((await api('POST',path,'guest',{reason:'closed'})).status,403);
    assert.equal((await api('POST',path,'user',{reason:'made_up'})).status,400);
    assert.equal((await api('POST',path,'user',{})).status,400);
    await repo.createUser({id:'test-unverified',role:'user',guest:false,phone:null,profile:{phone:'+84999999999',identity_verified:true}});
    assert.equal((await api('POST',path,'test-unverified',{reason:'closed'})).status,403);
    assert.equal((await api('POST','/api/v1/places/NOPE/reports','user',{reason:'closed'})).status,404);
  });

  test('M4 wrong price/menu/location/other never pauses; same person 3x is one closure vote',options,async t=>{
    const {api,repo}=await setup(t);
    const path='/api/v1/places/PLACE-404/reports';
    for(const role of ['user','consumer','merchant_owner']) for(const reason of ['wrong_price','wrong_menu','wrong_location','other']) {
      const r=await api('POST',path,role,{reason,evidence:'Bằng chứng người dùng'});
      assert.equal(r.status,200);
    }
    assert.equal((await repo.getPlace('PLACE-404')).is_open_override,true);
    const results=await Promise.all(Array.from({length:8},()=>api('POST',path,'user',{reason:'closed'})));
    assert.equal(results.filter(r=>!r.data.duplicate).length,1);
    assert.equal((await repo.getPlace('PLACE-404')).closed_report_count,1);
    assert.equal((await repo.getPlace('PLACE-404')).is_open_override,true);
    await api('POST',path,'consumer',{reason:'closed'});
    assert.equal((await repo.getPlace('PLACE-404')).is_open_override,true);
    const third=await api('POST',path,'merchant_owner',{reason:'closed'});
    assert.equal(third.data.status,'auto_paused');
    assert.equal((await repo.getPlace('PLACE-404')).is_open_override,false);
    assert.equal((await repo.listAudit(100)).filter(r=>r.action==='AUTO_PAUSE_PLACE').length,1);
  });

  test('M4 closure window excludes old votes and permits a fresh vote after 24h',options,async t=>{
    const {api,repo,ageReports}=await setup(t);
    const path='/api/v1/places/PLACE-404/reports';
    await api('POST',path,'user',{reason:'closed'});
    await ageReports('PLACE-404',25);
    await api('POST',path,'consumer',{reason:'closed'});
    await api('POST',path,'merchant_owner',{reason:'closed'});
    assert.equal((await repo.getPlace('PLACE-404')).closed_report_count,2);
    assert.equal((await repo.getPlace('PLACE-404')).is_open_override,true);
    assert.equal((await api('POST',path,'user',{reason:'closed'})).data.status,'auto_paused');
    assert.equal((await repo.listUserReports()).filter(r=>r.place_id==='PLACE-404').length,4);
  });

  test('M4 exactly 24h-old and rejected reports are not active closure votes',options,async t=>{
    const {api,repo,ageReports}=await setup(t);
    const path='/api/v1/places/PLACE-404/reports';
    await api('POST',path,'user',{reason:'closed'});
    await ageReports('PLACE-404',24);
    await api('POST',path,'consumer',{reason:'closed'});
    const r=(await repo.listUserReports()).find(r=>r.user_id==='test-consumer');
    await api('PATCH',`/api/v1/admin/reports/${r.id}`,'content_moderator',{status:'rejected',reason:'Báo sai'});
    await api('POST',path,'merchant_owner',{reason:'closed'});
    await api('POST',path,'merchant_staff',{reason:'closed'});
    assert.equal((await repo.getPlace('PLACE-404')).closed_report_count,2);
    assert.equal((await repo.getPlace('PLACE-404')).is_open_override,true);
  });

  test('M4 deleting/recreating the same verified phone does not create a different voter',options,async t=>{
    const {api,repo}=await setup(t);
    const path='/api/v1/places/PLACE-404/reports';
    const u=await repo.getUser('test-user');
    await api('POST',path,'user',{reason:'closed'});
    assert.equal((await api('DELETE','/api/v1/me','user')).status,200);
    await repo.createUser({...u,id:'test-recreated'});
    const r=await api('POST',path,'test-recreated',{reason:'closed'});
    assert.equal(r.data.duplicate,true);
    assert.equal((await repo.getPlace('PLACE-404')).closed_report_count,1);
  });

  test('M9 report review preserves evidence; reopen requires reason/ops role, never changes verification',options,async t=>{
    const {api,repo}=await setup(t);
    const path='/api/v1/places/PLACE-404/reports';
    for(const role of ['user','consumer','merchant_owner']) await api('POST',path,role,{reason:'closed',evidence:'Ảnh quán đóng'});
    const rows=(await repo.listUserReports()).filter(r=>r.place_id==='PLACE-404');
    const r=rows[0];
    assert.equal((await api('PATCH',`/api/v1/admin/reports/${r.id}`,'content_moderator',{status:'rejected'})).status,400);
    const done=await api('PATCH',`/api/v1/admin/reports/${r.id}`,'content_moderator',{status:'rejected',reason:'Báo nhầm'});
    assert.equal(done.data.report.evidence,'Ảnh quán đóng');
    assert.equal((await api('PATCH',`/api/v1/admin/reports/${r.id}`,'content_moderator',{status:'resolved',reason:'Lần hai'})).status,409);
    assert.equal((await api('POST','/api/v1/admin/places/PLACE-404/unpause','content_moderator',{reason:'Mở lại'})).status,403);
    assert.equal((await api('POST','/api/v1/admin/places/PLACE-404/unpause','ops_admin',{})).status,400);
    assert.equal((await api('POST','/api/v1/admin/places/PLACE-404/unpause','ops_admin',{reason:'Đã kiểm tra thực tế'})).status,200);
    assert.equal((await repo.listUserReports()).filter(r=>r.place_id==='PLACE-404').length,3);
    assert.equal((await repo.getPlace('PLACE-404')).is_open_override,true);
    assert.equal((await api('POST',path,'user',{reason:'closed'})).data.duplicate,true);
    assert.equal((await repo.getPlace('PLACE-404')).is_open_override,true,'old reports do not immediately re-pause');
    const before=await repo.getPlace('PLACE-405');
    await api('POST','/api/v1/admin/places/PLACE-405/unpause','ops_admin',{reason:'Đã kiểm tra'});
    assert.equal((await repo.getPlace('PLACE-405')).is_verified,before.is_verified);
    const q=await api('GET','/api/v1/admin/reports','content_moderator',{}, {place_id:'PLACE-404',status:'resolved',limit:'1'});
    assert.equal(q.data.items.length,1);
    assert.equal(q.data.total,2);
  });

  test('M9 deleting an actor anonymizes identity, keeps business evidence and records a privacy receipt',options,async t=>{
    const {api,repo}=await setup(t);
    await api('POST','/api/v1/admin/rbac/users','super_admin',{user_id:'test-user',role:'content_moderator',reason:'Phân công'});
    await api('POST','/api/v1/admin/dishes','user',{name:'Món do người sẽ xóa tạo',reason:'Nhập món'});
    const before=structuredClone((await repo.listAudit(100)).find(r=>r.actor_id==='test-user'));
    assert.ok(before);
    assert.equal((await api('DELETE','/api/v1/me','user')).status,200);
    assert.equal(await repo.getUser('test-user'),null);
    const logs=await repo.listAudit(100);
    const after=logs.find(r=>r.id===before.id);
    assert.equal(after.actor_id,null);assert.equal(after.actor,'deleted-user');
    for(const field of ['action','target','before','after','reason','timestamp','request_id']) assert.deepEqual(after[field],before[field],field);
    assert.equal(logs.filter(r=>r.action==='ANONYMIZE_ACTOR').length,1);
    assert.equal(await repo.atomic(tx=>tx.anonymizeAuditActor('test-user')),0,'idempotent privacy cleanup');
  });

  test('M9 audit is filterable/paginated with real actor, target, reason, before-after and server request id',options,async t=>{
    const {api}=await setup(t);
    await api('POST','/api/v1/admin/dishes','content_moderator',{name:'Món mới A',reason:'Bổ sung món'});
    await api('POST','/api/v1/admin/dishes','content_moderator',{name:'Món mới B',reason:'Bổ sung món'});
    const r=await api('GET','/api/v1/admin/audit-logs','ops_admin',{}, {action:'CREATE_DISH',actor_id:'test-content_moderator',limit:'1'});
    assert.equal(r.data.logs.length,1);assert.equal(r.data.total,2);
    const row=r.data.logs[0];
    assert.equal(row.before,null);assert.equal(row.after.name.startsWith('Món mới'),true);
    assert.equal(row.reason,'Bổ sung món');assert.equal(row.role,'content_moderator');
    const id=row.request_id || row.requestId;
    assert.ok(id);
    const filtered=await api('GET','/api/v1/admin/audit-logs','ops_admin',{}, {request_id:id});
    // Memory and PG both expose the same snake_case API request_id.
    assert.equal(filtered.data.total,1);
    assert.equal((await api('GET','/api/v1/admin/audit-logs','ops_admin',{}, {from:'bad-date'})).status,400);
  });
}
