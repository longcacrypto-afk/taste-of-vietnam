import { PolicyError } from '../services/adminPolicy.js';
import { dishInput, placeInput, checkVersion, verifyDish, verifyPlace, importPlaces } from '../services/dataEntry.js';

const ok=data=>({status:200,data});
const changed=(data,action,target,before,after,reason='CMS update',status=200)=>{
  if(typeof reason!=='string'||reason.length>1000) throw new PolicyError(400,'Lý do không hợp lệ');
  return {status,data,audit:{action,target,before:structuredClone(before??null),after:structuredClone(after??null),reason}};
};
const missing=()=>{throw new PolicyError(404,'Không tìm thấy bản ghi');};
async function saveDish(repo,d,before) {
  // Preserve repository safety revocation for actual edits, not lifecycle-only writes.
  if(!before) await repo.createDish(d);
  else {
    const patch=Object.fromEntries(Object.entries(d).filter(([k,v])=>k!=='id'&&JSON.stringify(v)!==JSON.stringify(before[k])));
    await repo.updateDish(d.id,patch);
  }
  const saved=await repo.getDish(d.id);
  await repo.saveContentVersion('dish',d.id,saved.cms.version,saved);
  return saved;
}
export async function handleAdminDataRoute(repo,actor,method,path,q,body) {
  if(path==='/api/v1/admin/dishes'&&method==='GET') return ok({items:await repo.listDishes()});
  if(path==='/api/v1/admin/dishes'&&method==='POST') {
    const d=dishInput(body),saved=await saveDish(repo,d,null);
    return changed({...saved,allergens:saved.allergen_tags},'CREATE_DISH',saved.id,null,saved,body.reason,201);
  }
  let m=path.match(/^\/api\/v1\/admin\/(?:dishes|recipes)\/([^/]+)(?:\/(verify|publish|archive|versions|restore))?$/);
  if(m) {
    const before=structuredClone(await repo.getDish(m[1]));if(!before) missing();
    const action=m[2];
    if(method==='GET') return ok(action==='versions'?{items:await repo.listContentVersions('dish',m[1])}:before);
    if(method==='DELETE') return null; // Existing hard delete cleans collections and audits atomically.
    checkVersion(body,before);
    let d;
    if(!action) d=dishInput(body,before);
    else if(action==='verify') {
      d=structuredClone(before);
      if(!d.cms) d=dishInput({},d);
      d=verifyDish(d,actor,body);
    } else if(action==='publish') {
      if(before.safety_status!=='approved'||!before.cms?.verified_at||!before.cms?.verified_by) throw new PolicyError(400,'Thông tin an toàn chưa được xác minh');
      d={...before,cms:{...before.cms,status:'published',version:before.cms.version+1}};
    } else if(action==='archive') {
      d={...before,cms:{...(before.cms||{}),status:'archived',version:(before.cms?.version||0)+1}};
    } else if(action==='restore') {
      const revision=(await repo.listContentVersions('dish',m[1])).find(v=>v.version===body.restore_version);
      if(!revision) missing();
      // Restoring old content is a new draft and MUST be re-reviewed.
      d=dishInput({...revision.snapshot,...(revision.snapshot.cms?.source?{source:revision.snapshot.cms.source}:{}),...(revision.snapshot.cms?.image_source?{image_source:revision.snapshot.cms.image_source}:{})});
      d.id=before.id;d.cms.version=before.cms.version+1;
    } else return null;
    const saved=await saveDish(repo,d,before);
    return changed({...saved,allergens:saved.allergen_tags},action?`${action.toUpperCase()}_DISH`:'UPDATE_DISH',saved.id,before,saved,body.reason);
  }
  if(path==='/api/v1/admin/places/import'&&method==='POST') {
    const result=await importPlaces(repo,body);
    if(body.dry_run||result.status!==200) return result;
    return changed(result.data,'IMPORT_PLACES','places',null,{ids:result.data.items.map(p=>p.id)},body.reason);
  }
  if(path==='/api/v1/admin/places') {
    if(method==='GET') return ok({items:await repo.listPlaces()});
    const p=await placeInput(repo,body);await repo.savePlace(p);await repo.saveContentVersion('place',p.id,p.cms.version,p);
    return changed(p,'CREATE_PLACE',p.id,null,p,body.reason,201);
  }
  m=path.match(/^\/api\/v1\/admin\/places\/([^/]+)(?:\/(menu|hours|availability|approve|archive|versions))?$/);
  if(!m) return null;
  if(method!=='GET') await repo.lockPlace(m[1]);
  const before=structuredClone(await repo.getPlace(m[1]));if(!before) missing();
  const action=m[2];
  if(method==='GET') return ok(action==='versions'?{items:await repo.listContentVersions('place',m[1])}:before);
  checkVersion(body,before);
  let p;
  if(action==='approve'&&!before.cms) return null; // Legacy approve path kept during rollout.
  if(action==='approve') p=verifyPlace(structuredClone(before),actor,body);
  else if(method==='DELETE'||action==='archive') {
    p={...before,is_verified:false,cms:{...(before.cms||{}),status:'archived',version:(before.cms?.version||0)+1}};
  } else {
    if(action==='menu'&&!Object.hasOwn(body,'menu')) throw new PolicyError(400,'Cần menu');
    if(action==='hours'&&!Object.hasOwn(body,'opening_hours')) throw new PolicyError(400,'Cần opening_hours');
    if(action==='availability') {
      const menu=structuredClone(before.menu||[]),item=menu.find(m=>m.dish_id===body.dish_id);
      if(!item) missing();
      if(typeof body.available!=='boolean') throw new PolicyError(400,'Cần available true/false');
      item.available=body.available;
      // Availability toggles don't rewrite location/menu price evidence or approve a pending place.
      p={...before,menu,cms:{...(before.cms||{status:before.is_verified?'verified':'pending'}),version:(before.cms?.version||0)+1}};
    } else p=await placeInput(repo,body,before);
  }
  await repo.savePlace(p);const saved=await repo.getPlace(p.id);
  await repo.saveContentVersion('place',p.id,saved.cms.version,saved);
  return changed(saved,action?`${action.toUpperCase()}_PLACE`:'UPDATE_PLACE',p.id,before,saved,body.reason);
}
