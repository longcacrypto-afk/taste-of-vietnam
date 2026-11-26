import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApiRequest } from '../../src/api/router.js';
import { signToken } from '../../src/services/authService.js';

const approval={ocr_id:'ocr-901',decision:'approved',version:1,dish_id:'DISH-101',price:57000};
const roles=['consumer','merchant_owner','merchant_staff','content_moderator','ops_admin','super_admin'];
export function contracts(make,options={}) {
  async function setup(t) {
    const f=await make(t);
    for(const [i,role] of [...roles,'guest'].entries())
      await f.repo.createUser({id:`rev-${role}`,role,guest:role==='guest',identity_verified:role!=='guest',
        phone:role==='guest'?null:`+8497000000${i}`,profile:structuredClone(f.store.userProfile)});
    const api=(method,path,body={},role='super_admin',query={})=>handleApiRequest(f.store,method,`/api/v1${path}`,
      new URLSearchParams(query),body,role?{authorization:`Bearer ${signToken({sub:`rev-${role}`})}`}:{});
    return {...f,api};
  }
  test('Review: six roles and guest/anonymous for queue, revision and report details',options,async t=>{
    const {api}=await setup(t);
    for(const [path,allowed] of [
      ['/admin/ocr-review',['content_moderator','super_admin']],
      ['/admin/menu-revisions',['content_moderator','super_admin']],
      ['/admin/reports/rep-501',['content_moderator','ops_admin','super_admin']]
    ]) {
      assert.equal((await api('GET',path,{},null,{place_id:'PLACE-401'})).status,401);
      for(const role of [...roles,'guest']) assert.equal((await api('GET',path,{},role,{place_id:'PLACE-401'})).status,
        allowed.includes(role)?200:403,`${role} ${path}`);
    }
    assert.equal((await api('POST','/admin/ocr-review',approval,'ops_admin')).status,403);
    assert.equal((await api('DELETE','/admin/reports/rep-501')).status,403);
    assert.equal((await api('DELETE','/admin/menu-revisions')).status,403);
  });
  test('Review: explicit canonical dish and price update only the correct restaurant with prior price revision',options,async t=>{
    const {api,repo}=await setup(t),before=structuredClone(await repo.getPlace('PLACE-401')),
      other=structuredClone(await repo.getPlace('PLACE-402'));
    const r=await api('POST','/admin/ocr-review',approval,'content_moderator');
    assert.equal(r.status,200,JSON.stringify(r));
    const p=await repo.getPlace('PLACE-401'),m=p.menu.find(m=>m.dish_id==='DISH-101');
    assert.equal(m.price,57000);assert.equal(p.is_verified,before.is_verified);
    assert.equal(p.is_open_override,before.is_open_override);
    assert.deepEqual(await repo.getPlace(other.id),other);
    const revisions=await repo.listMenuRevisions(p.id);
    assert.equal(revisions.length,1);assert.deepEqual(revisions[0].before_menu,before.menu);
    assert.equal(revisions[0].after_menu.find(m=>m.dish_id==='DISH-101').price,57000);
    assert.equal(revisions[0].actor_id,'rev-content_moderator');
    const item=(await repo.listOcrQueue()).find(r=>r.id==='ocr-901');
    assert.equal(item.version,2);assert.equal(item.approved_price,57000);
    assert.equal(item.reviewed_by,'rev-content_moderator');assert.ok(item.reviewed_at);
    const log=(await repo.listAudit(100)).find(r=>r.action==='APPROVE_OCR_MENU');
    assert.equal(log.after.menu_revision.id,revisions[0].id);assert.ok(log.before);
    assert.equal((await repo.listContentVersions('place',p.id))[0].snapshot.cms.version,p.cms.version);
    assert.equal((await api('GET','/admin/ocr-review',{},'content_moderator',{status:'approved'})).data.total,1);
  });
  test('Review: different canonical ID adds mapping, preserves existing entries and unavailability',options,async t=>{
    const {api,repo}=await setup(t);
    const p=structuredClone(await repo.getPlace('PLACE-401'));
    const original=structuredClone(p.menu);
    assert.equal((await api('POST','/admin/ocr-review',{...approval,dish_id:'DISH-112',price:0})).status,200);
    const saved=await repo.getPlace(p.id);
    for(const m of original) assert.deepEqual(saved.menu.find(n=>n.dish_id===m.dish_id),m);
    assert.equal(saved.menu.find(n=>n.dish_id==='DISH-112').price,0);
    // Second queue item maps to an already unavailable entry, never marks it available.
    const p2=structuredClone(await repo.getPlace('PLACE-402'));p2.menu[0].available=false;
    await repo.savePlace(p2);
    const r=await api('POST','/admin/ocr-review',{...approval,ocr_id:'ocr-902',dish_id:p2.menu[0].dish_id});
    assert.equal(r.status,200);assert.equal((await repo.getPlace(p2.id)).menu[0].available,false);
  });
  test('Review: two admins reviewing one version => one success, one conflict, one revision and audit',options,async t=>{
    const {api,repo}=await setup(t);
    const results=await Promise.all([
      api('POST','/admin/ocr-review',approval,'content_moderator'),
      api('POST','/admin/ocr-review',{...approval,price:99000},'super_admin')
    ]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    assert.equal((await repo.listMenuRevisions('PLACE-401')).length,1);
    assert.equal((await repo.listAudit(100)).filter(r=>r.action==='APPROVE_OCR_MENU').length,1);
    assert.equal((await api('POST','/admin/ocr-review',{...approval,version:2})).status,409);
    assert.equal((await api('POST','/admin/ocr-review',{...approval,version:2,decision:'rejected',reason:'Không được ghi đè'})).status,409);
  });
  test('Review: reject requires nonblank reason, records actor and version, never publishes a menu/revision',options,async t=>{
    const {api,repo}=await setup(t),before=structuredClone(await repo.getPlace('PLACE-401'));
    for(const reason of [undefined,'','   ',42,'x'.repeat(1001)])
      assert.equal((await api('POST','/admin/ocr-review',{ocr_id:'ocr-901',version:1,decision:'rejected',reason})).status,400);
    const r=await api('POST','/admin/ocr-review',{ocr_id:'ocr-901',version:1,decision:'rejected',reason:'Ảnh không rõ giá'});
    assert.equal(r.status,200);assert.equal(r.data.updated.rejection_reason,'Ảnh không rõ giá');
    assert.equal(r.data.updated.version,2);assert.deepEqual(await repo.getPlace(before.id),before);
    assert.equal((await repo.listMenuRevisions(before.id)).length,0);
    assert.equal((await api('GET','/admin/ocr-review',{},'content_moderator',{status:'rejected'})).data.total,1);
  });
  test('Review: mandatory version, canonical ID, price, status validation and unknown records fail without writes',options,async t=>{
    const {api,repo}=await setup(t),before=structuredClone(await repo.getPlace('PLACE-401'));
    for(const patch of [{version:undefined},{version:'1'},{version:0},{version:1.1},
      {dish_id:undefined},{price:undefined},{price:'57000'},{price:-1},{price:1.2},{price:100000001},
      {decision:'pending_review'},{decision:'other'}])
      assert.equal((await api('POST','/admin/ocr-review',{...approval,...patch})).status,400,JSON.stringify(patch));
    assert.equal((await api('POST','/admin/ocr-review',{...approval,version:2})).status,409);
    assert.equal((await api('POST','/admin/ocr-review',{...approval,dish_id:'NOPE'})).status,404);
    assert.equal((await api('POST','/admin/ocr-review',{...approval,ocr_id:'NOPE'})).status,404);
    await api('POST','/admin/dishes/DISH-101/archive',{});
    assert.equal((await api('POST','/admin/ocr-review',approval)).status,400);
    assert.deepEqual(await repo.getPlace(before.id),before);
    assert.equal((await repo.listMenuRevisions(before.id)).length,0);
  });
  test('Review: audit/revision/status failures roll back menu, mapping, place version and snapshots',options,async t=>{
    const {api,repo}=await setup(t);
    for(const hook of ['addAudit','saveMenuRevision','saveOcrReview']) {
      const before=structuredClone(await repo.getPlace('PLACE-401')),queue=structuredClone(await repo.listOcrQueue());
      const original=repo[hook];repo[hook]=async()=>{throw new Error('injected failure');};
      await assert.rejects(api('POST','/admin/ocr-review',approval),/injected failure/);
      repo[hook]=original;
      assert.deepEqual(await repo.getPlace(before.id),before,hook);
      assert.deepEqual(await repo.listOcrQueue(),queue,hook);
      assert.equal((await repo.listMenuRevisions(before.id)).length,0,hook);
      assert.equal((await repo.listContentVersions('place',before.id)).length,0,hook);
      assert.equal((await repo.listAudit(100)).filter(r=>r.action==='APPROVE_OCR_MENU').length,0,hook);
    }
  });
  test('Review: menu approval on paused or unverified place does not approve or reopen it',options,async t=>{
    const {api,repo}=await setup(t),p=structuredClone(await repo.getPlace('PLACE-401'));
    p.is_open_override=false;p.is_verified=false;await repo.savePlace(p);
    assert.equal((await api('POST','/admin/ocr-review',approval)).status,200);
    const saved=await repo.getPlace(p.id);
    assert.equal(saved.is_open_override,false);assert.equal(saved.is_verified,false);
    assert.equal((await api('GET',`/places/${p.id}`)).status,404);
  });
  test('Reports: evidence and status filter/detail retained after resolution, invalid filters denied',options,async t=>{
    const {api,repo}=await setup(t);
    const sent=await api('POST','/places/PLACE-401/reports',{reason:'wrong_price',evidence:'Bảng giá fixture 57K'},'consumer');
    assert.equal(sent.status,200);const id=sent.data.id;
    assert.equal((await api('GET','/admin/reports',{},'ops_admin',{status:'wrong'})).status,400);
    assert.equal((await api('GET','/admin/reports',{},'ops_admin',{reason:'wrong'})).status,400);
    assert.equal((await api('PATCH',`/admin/reports/${id}`,{status:'resolved',reason:'  '})).status,400);
    assert.equal((await api('PATCH',`/admin/reports/${id}`,{status:'resolved',reason:'Đã đối chiếu ảnh'},'content_moderator')).status,200);
    const rows=await api('GET','/admin/reports',{},'ops_admin',{place_id:'PLACE-401',reason:'wrong_price',status:'resolved',limit:1});
    assert.equal(rows.data.total,1);assert.equal(rows.data.items[0].evidence,'Bảng giá fixture 57K');
    assert.ok(!('reporter_key' in rows.data.items[0]));
    const detail=await api('GET',`/admin/reports/${id}`,{},'content_moderator');
    assert.equal(detail.data.report.resolution_reason,'Đã đối chiếu ảnh');
    assert.equal(detail.data.report.resolved_by,'rev-content_moderator');
    assert.equal((await api('DELETE',`/admin/reports/${id}`)).status,403);
    assert.equal((await repo.listUserReports()).filter(r=>r.id===id).length,1);
    assert.equal((await api('GET','/admin/reports/NOPE')).status,404);
    const two=await api('POST','/places/PLACE-401/reports',{reason:'wrong_menu',evidence:'Menu fixture'},'consumer');
    const results=await Promise.all(['resolved','rejected'].map(status=>api('PATCH',`/admin/reports/${two.data.id}`,{status,reason:'Đã kiểm'})));
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  });
  test('Reports: three distinct eligible closed voters hide M4; reasoned unpause restores after refresh with all evidence',options,async t=>{
    const {api,repo}=await setup(t),p=structuredClone(await repo.getPlace('PLACE-401'));
    // Explicit all-day hours make this fixture independent of CI clock/timezone.
    p.opening_hours={weekly:Object.fromEntries(Array.from({length:7},(_,i)=>[i,[['00:00','24:00']]]))};
    await repo.savePlace(p);
    const visible=async()=> (await api('GET','/places',{},null,{dish_id:'DISH-101'})).data.items.some(x=>x.id===p.id);
    assert.equal(await visible(),true);
    assert.equal((await api('POST',`/places/${p.id}/reports`,{reason:'closed'},'guest')).status,403);
    for(const role of ['consumer','merchant_owner','merchant_staff'])
      await api('POST',`/places/${p.id}/reports`,{reason:'wrong_price',evidence:'Giá sai'},role);
    assert.equal(await visible(),true);
    for(let i=0;i<3;i++) await api('POST',`/places/${p.id}/reports`,{reason:'closed',evidence:'Ảnh fixture'},'consumer');
    assert.equal((await repo.getPlace(p.id)).closed_report_count,1);
    await api('POST',`/places/${p.id}/reports`,{reason:'closed',evidence:'Ảnh fixture'},'merchant_owner');
    assert.equal(await visible(),true);
    await api('POST',`/places/${p.id}/reports`,{reason:'closed',evidence:'Ảnh fixture'},'merchant_staff');
    assert.equal(await visible(),false);
    const before=structuredClone(await repo.listUserReports());
    assert.equal((await api('POST',`/admin/places/${p.id}/unpause`,{},'ops_admin')).status,400);
    assert.equal((await api('POST',`/admin/places/${p.id}/unpause`,{reason:'Đã kiểm tra quán mở lại'},'content_moderator')).status,403);
    assert.equal((await api('POST',`/admin/places/${p.id}/unpause`,{reason:'Đã kiểm tra quán mở lại'},'ops_admin')).status,200);
    assert.equal(await visible(),true);
    assert.equal((await repo.getPlace(p.id)).is_verified,p.is_verified);
    const after=await repo.listUserReports();assert.equal(after.length,before.length);
    for(const b of before.filter(r=>r.place_id===p.id)) {
      const a=after.find(r=>r.id===b.id);
      assert.equal(a.evidence,b.evidence);assert.equal(a.reason,b.reason);assert.equal(a.status,'resolved');
      assert.equal(a.resolved_by,'rev-ops_admin');assert.equal(a.resolution_reason,'Đã kiểm tra quán mở lại');
    }
    await api('POST',`/places/${p.id}/reports`,{reason:'closed'},'consumer');
    assert.equal(await visible(),true,'deduped resolved votes never re-pause');
  });
  test('Reports: rejecting evidence does not silently reopen a paused place; unpause preserves unverified',options,async t=>{
    const {api,repo}=await setup(t);
    assert.equal((await api('PATCH','/admin/reports/rep-501',{status:'rejected',reason:'Bằng chứng không đúng'})).status,200);
    assert.equal((await repo.getPlace('PLACE-405')).is_open_override,false);
    const p=structuredClone(await repo.getPlace('PLACE-405'));p.is_verified=false;await repo.savePlace(p);
    await api('POST','/admin/places/PLACE-405/unpause',{reason:'Đã kiểm tra'},'ops_admin');
    assert.equal((await repo.getPlace(p.id)).is_verified,false);
    assert.equal((await api('GET',`/places/${p.id}`)).status,404);
  });
}
