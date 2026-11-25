import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApiRequest } from '../../src/api/router.js';
import { signToken } from '../../src/services/authService.js';
import { buildCandidates } from '../../src/services/candidatePipeline.js';
import { CSV_HEADERS } from '../../src/services/dataEntry.js';

const source={author:'Nhóm nhập thử',url:'https://example.invalid/evidence',license:'Dữ liệu tự nhập fixture, không phải quán thật'};
const dish={name:'Món kiểm thử CMS',region:'nam',allergen_tags:[],diet_flags:['vegan'],base_servings:2,market_cost_base:40000,
  ingredients:[{name:'Đậu',amount:200,unit:'g'}],steps:[{title:'Nấu fixture',duration_min:5}],source};
const hours={weekly:Object.fromEntries(Array.from({length:7},(_,i)=>[i,[['00:00','24:00']]]))};
const verification={allergen_verified:true,diet_verified:true,evidence:'Đã kiểm thành phần bằng fixture, không xác nhận nội dung thật'};
const csvCell=v=>`"${String(typeof v==='object'?JSON.stringify(v):v).replaceAll('"','""')}"`;
function csvRow(name='Quán fixture CSV',extra={}) {
  const r={name,address:'Địa chỉ giả, Biên Hòa',lat:10.958,lng:106.842,phone:'',opening_hours:hours,menu:[{dish_id:'DISH-101',price:35000,available:true}],
    source_author:source.author,source_url:source.url,source_license:source.license,evidence:'Bằng chứng fixture',is_example:'false',...extra};
  return CSV_HEADERS.split(',').map(k=>csvCell(r[k])).join(',');
}
export function contracts(make,options={}) {
  async function setup(t) {
    const f=await make(t);
    for(const role of ['guest','consumer','merchant_owner','merchant_staff','content_moderator','ops_admin','super_admin'])
      await f.repo.createUser({id:`cms-${role}`,role,guest:role==='guest',profile:{...f.store.userProfile,hard_allergies:[],disliked_dish_ids:[],diet_mode:'balanced'}});
    const api=(method,path,body={},role='super_admin',query={})=>handleApiRequest(f.store,method,`/api/v1${path}`,new URLSearchParams(query),body,
      role?{authorization:`Bearer ${signToken({sub:`cms-${role}`})}`}:{});
    const create=async(body=dish)=> {
      const r=await api('POST','/admin/dishes',body);assert.equal(r.status,201,JSON.stringify(r));return r.data;
    };
    const publish=async d=>{
      let r=await api('POST',`/admin/dishes/${d.id}/verify`,verification);assert.equal(r.status,200,JSON.stringify(r));
      r=await api('POST',`/admin/dishes/${d.id}/publish`,{});assert.equal(r.status,200,JSON.stringify(r));return r.data;
    };
    const place=async(extra={})=>{
      const r=await api('POST','/admin/places',{name:'Quán fixture (không thật)',address:'Địa chỉ giả, Biên Hòa',lat:10.958,lng:106.842,opening_hours:hours,
        menu:[{dish_id:'DISH-101',price:35000,available:true}],source,evidence:'Đã kiểm fixture',...extra});
      assert.equal(r.status,201,JSON.stringify(r));return r.data;
    };
    return {...f,api,create,publish,place};
  }
  test('CMS: all six roles, guest and anonymous checked for every new route family',options,async t=>{
    const {api}=await setup(t);
    const routes=[
      ['GET','/admin/dishes',{},'d'],['GET','/admin/dishes/NOPE',{},'d'],['GET','/admin/dishes/NOPE/versions',{},'d'],
      ['PATCH','/admin/recipes/NOPE',{},'d'],['POST','/admin/dishes/NOPE/verify',verification,'d'],
      ['POST','/admin/dishes/NOPE/publish',{},'d'],['POST','/admin/dishes/NOPE/archive',{},'d'],
      ['POST','/admin/dishes/NOPE/restore',{restore_version:1},'d'],
      ['GET','/admin/places',{},'p'],['POST','/admin/places',{name:'X',address:'Y'},'p'],['GET','/admin/places/NOPE',{},'p'],
      ['PATCH','/admin/places/NOPE/menu',{menu:[]},'p'],['PATCH','/admin/places/NOPE/hours',{opening_hours:hours},'p'],
      ['PATCH','/admin/places/NOPE/availability',{available:false,dish_id:'DISH-101'},'p'],
      ['DELETE','/admin/places/NOPE',{},'p'],['POST','/admin/places/import',{csv:CSV_HEADERS,dry_run:true},'p']
    ];
    for(const [method,path,body,permission] of routes) {
      assert.equal((await api(method,path,body,null)).status,401,path);
      for(const role of ['guest','consumer','merchant_owner','merchant_staff','content_moderator','ops_admin','super_admin']) {
        const r=await api(method,path,body,role);
        const allowed=role==='super_admin'||role===(permission==='d'?'content_moderator':'ops_admin');
        assert.ok(allowed?[200,201,404].includes(r.status):r.status===403,`${role} ${method} ${path}: ${JSON.stringify(r)}`);
      }
    }
  });
  test('CMS: new dish is draft, private even safe_only=false; no forged approval or actor',options,async t=>{
    const {api,create}=await setup(t);
    const d=await create({...dish,cms:{status:'published',verified_by:'attacker'},safety_status:'approved'});
    assert.equal(d.cms.status,'draft');assert.equal(d.safety_status,'pending');
    assert.equal((await api('GET',`/dishes/${d.id}`)).status,404);
    assert.ok(!(await api('GET','/dishes',{},null,{safe_only:'false'})).data.items.some(x=>x.id===d.id));
    assert.ok((await api('GET','/admin/dishes')).data.items.some(x=>x.id===d.id));
  });
  test('CMS: publish requires explicit verification of both allergen and diet, recipe and evidence',options,async t=>{
    const {api,create}=await setup(t);const d=await create();
    assert.equal((await api('POST',`/admin/dishes/${d.id}/publish`)).status,400);
    for(const body of [{}, {...verification,allergen_verified:false},{...verification,diet_verified:false},{...verification,evidence:''}])
      assert.equal((await api('POST',`/admin/dishes/${d.id}/verify`,body)).status,400);
    const blank=await create({name:'Thiếu công thức'});
    assert.equal((await api('POST',`/admin/dishes/${blank.id}/verify`,verification)).status,400);
    const photo=await create({...dish,img_key:'298'});
    assert.equal((await api('POST',`/admin/dishes/${photo.id}/verify`,verification)).status,400);
  });
  test('CMS: verified published recipe uses same M2 detail/scaler and appears in M3 pipeline',options,async t=>{
    const {api,create,publish,repo,store}=await setup(t);let d=await publish(await create());
    assert.equal(d.cms.verified_by,'cms-super_admin');assert.ok(Date.parse(d.cms.verified_at));
    const detail=await api('GET',`/dishes/${d.id}`,{},null,{servings:'4'});
    assert.equal(detail.status,200);assert.equal(detail.data.scaled_ingredients[0].scaled_amount,400);
    const profile={...store.userProfile,hard_allergies:[],diet_mode:'balanced',disliked_dish_ids:[],budget_min:0,budget_max:60000};
    assert.ok(buildCandidates({dishes:await repo.listDishes(),places:[],userProfile:profile,suggestionHistory:[]},{mode:'cook'}).candidates.some(x=>x.dish_id===d.id));
  });
  test('CMS: every content edit returns draft and revokes approval, archive hides list/detail/games',options,async t=>{
    const {api,create,publish,repo,store}=await setup(t);
    for(const patch of [{name:'Đổi tên'},{allergen_tags:['soy']},{diet_flags:[]},{ingredients:dish.ingredients},{steps:dish.steps},{source}]) {
      let d=await publish(await create());
      const r=await api('PATCH',`/admin/dishes/${d.id}`,patch);
      assert.equal(r.status,200);assert.equal(r.data.cms.status,'draft');assert.equal(r.data.safety_status,'pending');
      assert.equal((await api('GET',`/dishes/${d.id}`)).status,404);
    }
    const d=await publish(await create());
    assert.equal((await api('POST',`/admin/dishes/${d.id}/archive`)).status,200);
    assert.equal((await api('GET',`/dishes/${d.id}`)).status,404);
    assert.ok(!buildCandidates({...store,dishes:await repo.listDishes()},{mode:'cook'}).candidates.some(x=>x.dish_id===d.id));
  });
  test('CMS: M3 Today/chat/all decision games exclude draft and include published; no stale cache after archive',options,async t=>{
    const {api,repo,create,publish}=await setup(t);
    for(const d of await repo.listDishes()) await repo.updateDish(d.id,{safety_status:'rejected'});
    const draft=await create(),published=await publish(await create({...dish,name:'Món đã xuất bản',market_cost_base:80000}));
    for(const path of ['/suggestions/today','/suggestions/spin','/suggestions/game','/suggestions/fortune','/suggestions/blind-box']) {
      const r=await api('GET',path,{},'super_admin',{mode:'cook'});
      assert.equal(r.status,200);
      const items=r.data.items??(r.data.picked_dish?[r.data.picked_dish]:[]);
      assert.ok(items.some(x=>(x.dish_id||x.id)===published.id),`${path}: ${JSON.stringify(r)}`);
      assert.ok(!JSON.stringify(r.data).includes(draft.id));
    }
    const chat=await api('POST','/chat',{query:'Nấu ăn ở nhà'});
    assert.ok(!JSON.stringify(chat.data).includes(draft.id));
    await api('POST',`/admin/dishes/${published.id}/archive`);
    assert.ok(!JSON.stringify((await api('GET','/suggestions/today',{},'super_admin',{mode:'cook'})).data).includes(published.id));
  });
  test('CMS: M4 hides unpublished menu dishes and M5 refuses unavailable stock immediately',options,async t=>{
    const {api,create,place}=await setup(t);
    const draft=await create();
    const p=await place({menu:[{dish_id:draft.id,price:10000,available:true},{dish_id:'DISH-101',price:35000,available:true}]});
    await api('POST',`/admin/places/${p.id}/approve`,{});
    let detail=(await api('GET',`/places/${p.id}`)).data;
    assert.deepEqual(detail.menu.map(m=>m.dish_id),['DISH-101']);
    assert.equal((await api('POST','/orders/redirect',{partner:'maps',place_id:p.id,dish_id:draft.id})).status,404);
    assert.equal((await api('POST','/orders/redirect',{partner:'maps',place_id:p.id,dish_id:'DISH-101'})).status,200);
    await api('PATCH',`/admin/places/${p.id}/availability`,{dish_id:'DISH-101',available:false});
    assert.equal((await api('POST','/orders/redirect',{partner:'maps',place_id:p.id,dish_id:'DISH-101'})).status,409);
  });
  test('CMS: versions preview, optimistic conflict and restore create a new unverified draft',options,async t=>{
    const {api,create}=await setup(t);const d=await create();
    const concurrent=await Promise.all(['A','B'].map(name=>api('PATCH',`/admin/dishes/${d.id}`,{name,version:1})));
    assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
    const rows=(await api('GET',`/admin/dishes/${d.id}/versions`)).data.items;
    assert.equal(rows.length,2);
    const r=await api('POST',`/admin/dishes/${d.id}/restore`,{restore_version:1,version:2});
    assert.equal(r.status,200);assert.equal(r.data.name,d.name);assert.equal(r.data.cms.version,3);assert.equal(r.data.cms.status,'draft');
    assert.equal(r.data.cms.verified_at,null);
  });
  test('CMS: invalid typed recipe/ingredient/unit/macro/numbers/source fail without writes',options,async t=>{
    const {api,repo}=await setup(t);const before=(await repo.listDishes()).length;
    for(const patch of [{spice_level:9},{ref_price:-1},{base_servings:0},{calories:'450'},{diet_flags:'vegan'},
      {ingredients:[{name:'x',amount:1,unit:''}]},{steps:[{}]},{macros:{fat:-2}},{source:{author:'X',url:'javascript:1',license:'X'}},
      {region:'not-a-region'},{meal_slots:['invalid']},{image_source:{author:'A'}}]) {
      assert.equal((await api('POST','/admin/dishes',{...dish,...patch})).status,400,JSON.stringify(patch));
    }
    assert.equal((await repo.listDishes()).length,before);
  });
  test('CMS: hard delete cleans collection links and preserves version evidence',options,async t=>{
    const {api,repo,create,publish}=await setup(t);const d=await publish(await create());
    assert.equal((await api('POST','/me/collections',{dish_id:d.id})).status,200);
    assert.equal((await api('DELETE',`/admin/dishes/${d.id}`)).status,200);
    assert.equal((await api('GET',`/dishes/${d.id}`)).status,404);
    assert.ok(!(await repo.listCollections('cms-super_admin')).some(c=>c.dish_ids.includes(d.id)));
    assert.ok((await repo.listContentVersions('dish',d.id)).length>=3);
  });
  test('CMS: place remains hidden with open_only=false and direct detail until verified',options,async t=>{
    const {api,place}=await setup(t);const p=await place();
    assert.equal(p.cms.status,'pending');assert.equal(p.is_verified,false);
    assert.ok(!(await api('GET','/places',{},null,{open_only:'false'})).data.items.some(x=>x.id===p.id));
    assert.equal((await api('GET',`/places/${p.id}`)).status,404);
    const approved=await api('POST',`/admin/places/${p.id}/approve`,{evidence:'Fixture verification'});
    assert.equal(approved.status,200,JSON.stringify(approved));assert.equal(approved.data.cms.verified_by,'cms-super_admin');
    assert.ok(Date.parse(approved.data.verified_at));
    assert.equal((await api('GET',`/places/${p.id}`)).status,200);
    assert.ok((await api('GET','/places',{},null,{open_only:'false'})).data.items.some(x=>x.id===p.id));
  });
  test('CMS: approval needs location, full hours, menu, source and evidence',options,async t=>{
    const {api,place}=await setup(t);
    for(const patch of [{lat:null},{lng:181},{opening_hours:{weekly:{0:[]}}},{menu:[{dish_id:'NOPE',price:1,available:true}]},
      {menu:[{dish_id:'DISH-101',price:-1,available:true}]},{menu:[{dish_id:'DISH-101',price:1,available:'true'}]},
      {opening_hours:{...hours,overrides:{'2026-02-30':[]}}}]) {
      const body={name:'Invalid',address:'X',...patch};
      assert.equal((await api('POST','/admin/places',body)).status,400,JSON.stringify(patch));
    }
    for(const patch of [{menu:[]},{evidence:''},{source:undefined}]) {
      const base={name:'Incomplete',address:'X',lat:10.958,lng:106.842,menu:[{dish_id:'DISH-101',price:1,available:true}],opening_hours:hours,source,evidence:'X',...patch};
      if(base.source===undefined) delete base.source;
      if(base.evidence==='') delete base.evidence;
      const r=await api('POST','/admin/places',base);assert.equal(r.status,201);
      assert.equal((await api('POST',`/admin/places/${r.data.id}/approve`,{})).status,400);
    }
  });
  test('CMS: approval never unpauses or erases reports; unpause never verifies pending content',options,async t=>{
    const {api,repo,place}=await setup(t);let p=await place();
    p.is_open_override=false;p.closed_report_count=3;
    await repo.savePlace(p);
    let r=await api('POST',`/admin/places/${p.id}/approve`,{reason:'Đã xem fixture'});
    assert.equal(r.status,200);assert.equal(r.data.is_open_override,false);assert.equal(r.data.closed_report_count,3);
    assert.equal((await api('POST',`/admin/places/${p.id}/unpause`,{reason:'Đã mở lại fixture'})).status,200);
    assert.equal((await repo.getPlace(p.id)).is_verified,true);
    p=await place();await api('POST',`/admin/places/${p.id}/unpause`,{reason:'Chỉ mở lại'});
    assert.equal((await repo.getPlace(p.id)).is_verified,false);
    assert.equal((await api('GET',`/places/${p.id}`)).status,404);
  });
  test('CMS: price/menu/hours edits require re-verification; availability is a separate operational toggle',options,async t=>{
    const {api,place}=await setup(t);const p=await place();
    await api('POST',`/admin/places/${p.id}/approve`,{});
    let r=await api('PATCH',`/admin/places/${p.id}/menu`,{menu:[{dish_id:'DISH-101',price:41000,available:true}]});
    assert.equal(r.status,200);assert.equal(r.data.cms.status,'pending');
    await api('POST',`/admin/places/${p.id}/approve`,{evidence:'Đã kiểm giá mới fixture'});
    r=await api('PATCH',`/admin/places/${p.id}/availability`,{dish_id:'DISH-101',available:false});
    assert.equal(r.status,200);assert.equal(r.data.is_verified,true);
    const detail=(await api('GET',`/places/${p.id}`)).data;
    assert.equal(detail.menu[0].price,41000);assert.equal(detail.menu[0].available,false);
    r=await api('PATCH',`/admin/places/${p.id}/hours`,{opening_hours:hours});
    assert.equal(r.data.cms.status,'pending');
  });
  test('CMS: archived place cannot appear even with open_only=false; audit and revisions retained',options,async t=>{
    const {api,repo,place}=await setup(t);const p=await place();
    await api('POST',`/admin/places/${p.id}/approve`,{});
    assert.equal((await api('DELETE',`/admin/places/${p.id}`)).status,200);
    assert.equal((await api('GET',`/places/${p.id}`)).status,404);
    assert.ok((await repo.listContentVersions('place',p.id)).length>=3);
    assert.ok((await repo.listAudit(100)).some(a=>a.target===p.id&&a.before&&a.after));
  });
  test('CMS CSV: dry-run creates no data/audit/revisions, import dedupes file and existing rows',options,async t=>{
    const {api,repo}=await setup(t);
    const before=(await repo.listPlaces()).length,audit=(await repo.listAudit(1000)).length;
    const csv=CSV_HEADERS+'\r\n'+csvRow()+'\r\n'+csvRow()+'\r\n'+csvRow('EXAMPLE',{is_example:'true'});
    let r=await api('POST','/admin/places/import',{csv,dry_run:true});
    assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.would_create,1);assert.deepEqual(r.data.duplicates,[3]);assert.deepEqual(r.data.examples,[4]);
    assert.equal((await repo.listPlaces()).length,before);assert.equal((await repo.listAudit(1000)).length,audit);
    r=await api('POST','/admin/places/import',{csv,dry_run:false});
    assert.equal(r.data.created,1);assert.equal((await repo.listPlaces()).length,before+1);
    assert.equal((await repo.getPlace(r.data.items[0].id)).is_verified,false);
    assert.equal((await api('POST','/admin/places/import',{csv,dry_run:false})).data.created,0);
  });
  test('CMS CSV: invalid row cannot partially import, strict format and explicit dry_run',options,async t=>{
    const {api,repo}=await setup(t);const before=(await repo.listPlaces()).length;
    for(const csv of ['name,address\nx,y',CSV_HEADERS+'\n"unterminated',CSV_HEADERS+'\n'+csvRow()+'\n'+csvRow('Bad',{lat:'oops'}),
      CSV_HEADERS+'\n'+csvRow('Bad',{opening_hours:'not-json'}),CSV_HEADERS+'\n'+csvRow('Bad',{menu:[{dish_id:'NOPE',price:1,available:true}]})]) {
      const r=await api('POST','/admin/places/import',{csv,dry_run:false});assert.equal(r.status,400,JSON.stringify(r));
      assert.equal((await repo.listPlaces()).length,before);
    }
    assert.equal((await api('POST','/admin/places/import',{csv:CSV_HEADERS})).status,400);
  });
  test('CMS: audit failure rolls back dish, place, import and snapshots',options,async t=>{
    const {api,repo,create,place}=await setup(t);
    const d=await create(),p=await place(),before=(await repo.listPlaces()).length;
    const count=(await repo.listContentVersions('dish',d.id)).length;
    const original=repo.addAudit;repo.addAudit=async()=>{throw Error('injected audit failure');};
    try {
      for(const [method,path,body] of [
        ['POST','/admin/dishes',dish],['PATCH',`/admin/dishes/${d.id}`,{name:'Not committed'}],
        ['POST',`/admin/dishes/${d.id}/verify`,verification],
        ['POST','/admin/places',{name:'No',address:'No'}],
        ['PATCH',`/admin/places/${p.id}/menu`,{menu:[]}],
        ['POST',`/admin/places/${p.id}/approve`,{}],
        ['POST','/admin/places/import',{csv:CSV_HEADERS+'\n'+csvRow('Rollback CSV'),dry_run:false}]
      ]) await assert.rejects(api(method,path,body),/injected audit failure/);
    } finally {repo.addAudit=original;}
    assert.equal((await repo.getDish(d.id)).name,d.name);
    assert.equal((await repo.getPlace(p.id)).is_verified,false);
    assert.equal((await repo.listPlaces()).length,before);
    assert.equal((await repo.listContentVersions('dish',d.id)).length,count);
  });
}
