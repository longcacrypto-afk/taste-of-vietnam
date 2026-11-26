// Backend for the existing M9 screens. All mutations and their audit rows share one
// transaction; role is loaded again under the same lock used by role assignment.
import crypto from 'node:crypto';
import { reviewMenu } from '../services/menuReview.js';
import { REPORT_REASONS } from '../services/reportPolicy.js';
import { handleAdminDataRoute } from './adminDataRoutes.js';
import { ROLES, adminAllowed, PolicyError } from '../services/adminPolicy.js';
import { cleanText } from './router.js';

const ok = data => ({status:200,data});
const number = (v,min,max,fallback) => Number.isFinite(Number(v)) ? Math.min(max,Math.max(min,Number(v))) : fallback;
const list = v => (Array.isArray(v) ? v : []).slice(0,20).map(x=>cleanText(x,40)).filter(Boolean);
const requireReason = body => {
  if(typeof body.reason!=='string'||body.reason.trim().length>1000) throw new PolicyError(400,'Cần lý do bằng chữ, tối đa 1000 ký tự');
  const s=cleanText(body.reason,1000);
  if (!s) throw new PolicyError(400,'Cần nêu lý do xử lý');
  return s;
};
const page = (rows,q) => {
  const limit=number(q.get('limit') || 50,1,100,50)|0;
  const offset=number(q.get('offset') || 0,0,1000000,0)|0;
  return {total:rows.length,limit,offset,items:rows.slice(offset,offset+limit)};
};
const publicReport = ({reporter_key,...r}) => r;

export async function handleAdminRoute(repo,user,method,path,q,body,headers,store) {
  return repo.atomic(async tx => {
    const actor=structuredClone(await tx.getUser(user.id));
    if (!actor || !adminAllowed(method,path,actor.role)) throw new PolicyError(403,'Không có quyền thực hiện thao tác này');
    const result=await dispatch(tx,actor,method,path,q,body,store);
    if (result.audit) {
      const {audit,...response}=result;
      await tx.addAudit({...audit,actor:actor.id,actor_id:actor.id,role:actor.role,
        // Do not trust/log arbitrary client IP or requestId. Server-generated, no secrets.
        requestId:crypto.randomUUID()});
      return response;
    }
    return result;
  });
}
const changed = (data,action,target,before,after,reason,status=200) =>
  ({status,data,audit:{action,target,before:structuredClone(before ?? null),after:structuredClone(after ?? null),reason:reason || 'M9 content update'}});

async function dispatch(repo,actor,method,path,q,body,store) {
  const content=await handleAdminDataRoute(repo,actor,method,path,q,body);
  if(content) return content;
  if(path==='/api/v1/admin/dashboard') {
    const [dishes,places,ocr,reports,campaigns,embedded]=await Promise.all([
      repo.listDishes(),repo.listPlaces(),repo.listOcrQueue(),repo.listUserReports(),repo.listCampaigns(),repo.listEmbeddedDishIds()]);
    // M9-S02 "Vector DB" column: has_embedding is read from storage, false until a vector exists.
    const vectors=new Set(embedded);
    return ok({catalog:['content_moderator','super_admin'].includes(actor.role)?dishes.map(d=>({...d,has_embedding:vectors.has(d.id)})):[],places:['ops_admin','super_admin'].includes(actor.role)?places:[],total_dishes:dishes.length,total_verified_places:places.filter(p=>p.is_verified).length,
      ocr_queue:ocr,user_reports:reports.map(publicReport),campaigns,events:store.analyticsEvents});
  }
  if(path==='/api/v1/admin/rbac/roles') return ok({roles:ROLES});
  if(path==='/api/v1/admin/rbac/users') {
    if(method==='GET') return ok({users:await repo.listUsers()});
    const reason=requireReason(body);
    const before=await repo.getUser(body.user_id);
    const beforeRole=before ? {id:before.id,role:before.role} : null;
    const after=await repo.assignRole(body.user_id,body.role);
    return changed({updated:true,user_id:after.id,new_role:after.role},'ASSIGN_ROLE',after.id,beforeRole,
      {id:after.id,role:after.role},reason);
  }
  if(path==='/api/v1/admin/audit-logs') {
    let rows=await repo.listAudit(100000);
    for(const k of ['actor_id','action','target','request_id']) if(q.has(k)) rows=rows.filter(r=>r[k]===q.get(k));
    for(const k of ['from','to']) if(q.has(k) && !Number.isFinite(Date.parse(q.get(k)))) throw new PolicyError(400,'Thời gian không hợp lệ');
    if(q.has('from')) rows=rows.filter(r=>Date.parse(r.timestamp)>=Date.parse(q.get('from')));
    if(q.has('to')) rows=rows.filter(r=>Date.parse(r.timestamp)<=Date.parse(q.get('to')));
    const p=page(rows,q);
    return ok({...p,logs:p.items,rbac_roles:ROLES.map(r=>r.name)});
  }
  if(path==='/api/v1/admin/reports') {
    if(q.has('status')&&!['pending_review','auto_paused','resolved','rejected'].includes(q.get('status'))) throw new PolicyError(400,'Trạng thái lọc không hợp lệ');
    if(q.has('reason')&&!REPORT_REASONS.includes(q.get('reason'))) throw new PolicyError(400,'Lý do lọc không hợp lệ');
    let rows=(await repo.listUserReports()).map(publicReport);
    for(const k of ['status','reason','place_id']) if(q.has(k)) rows=rows.filter(r=>r[k]===q.get(k));
    const p=page(rows,q);return ok({...p,reports:p.items});
  }
  let m=path.match(/^\/api\/v1\/admin\/reports\/([^/]+)$/);
  if(m) {
    if(method==='GET') {
      const row=(await repo.listUserReports()).find(r=>r.id===m[1]);
      if(!row) throw new PolicyError(404,'Không tìm thấy báo cáo');
      return ok({report:publicReport(row)});
    }
    const reason=requireReason(body);
    if(!['resolved','rejected'].includes(body.status)) throw new PolicyError(400,'Trạng thái xử lý không hợp lệ');
    const row=(await repo.listUserReports()).find(r=>r.id===m[1]);
    if(!row) throw new PolicyError(404,'Không tìm thấy báo cáo');
    await repo.lockPlace(row.place_id);
    const before=structuredClone(publicReport(row));
    const after=await repo.updateReport(m[1],{status:body.status,reason,actorId:actor.id});
    if(!after) throw new PolicyError(409,'Báo cáo đã được xử lý');
    // Resolving one report does not reopen a place. Reopen is a separate ops-only action.
    return changed({report:publicReport(after)},'REVIEW_REPORT',m[1],before,publicReport(after),reason);
  }
  m=path.match(/^\/api\/v1\/admin\/places\/([^/]+)\/(approve|unpause)$/);
  if(m) {
    const reason=requireReason(body);
    await repo.lockPlace(m[1]);
    const before=structuredClone(await repo.getPlace(m[1]));
    if(!before) throw new PolicyError(404,'Place not found');
    // Preserve evidence and record the resolver on all still-pending reports.
    if(m[2]==='unpause') for(const r of await repo.listUserReports()) {
      if(r.place_id===m[1] && ['pending_review','auto_paused'].includes(r.status))
        await repo.updateReport(r.id,{status:'resolved',reason,actorId:actor.id});
    }
    const place=await repo.unpausePlace(m[1],{approve:m[2]==='approve'});
    return changed({unpaused_place:place,message:'Đã xử lý; lịch sử báo sai được giữ lại.'},
      m[2]==='approve'?'APPROVE_PLACE':'UNPAUSE_PLACE',place.id,before,place,reason);
  }
  if(path==='/api/v1/admin/dishes') {
    const d={
      id:`DISH-${crypto.randomUUID().slice(0,20)}`,name:cleanText(body.name,120)||'Món Việt Mới',
      region:cleanText(body.region,32)||'Miền Nam',
      meal_slots:list(body.meal_slots).length?list(body.meal_slots):['lunch','dinner'],
      calories:number(body.calories,0,10000,450),ref_price:number(body.ref_price,0,1e8,50000),
      spice_level:Math.round(number(body.spice_level,0,3,1)),allergen_tags:list(body.allergen_tags||body.allergens),
      weather_fit:['any'],tags:list(body.tags).length?list(body.tags):['Đặc sản'],
      description:cleanText(body.description,1000)||'Món ăn mới từ Admin CMS'};
    const saved=await repo.createDish(d);
    return changed({...saved,allergens:saved.allergen_tags},'CREATE_DISH',saved.id,null,saved,cleanText(body.reason,1000),201);
  }
  m=path.match(/^\/api\/v1\/admin\/dishes\/([^/]+)$/);
  if(m) {
    const before=structuredClone(await repo.getDish(m[1]));
    if(!before) throw new PolicyError(404,'Dish not found');
    if(method==='DELETE') {
      await repo.deleteDish(m[1]);return changed({deleted:true,id:m[1]},'DELETE_DISH',m[1],before,null,cleanText(body.reason,1000));
    }
    const patch={};
    for(const k of ['name','region','description']) if(body[k]!==undefined) patch[k]=cleanText(body[k],k==='description'?1000:120);
    for(const [k,max,def] of [['calories',10000,450],['ref_price',1e8,50000],['spice_level',3,1]])
      if(body[k]!==undefined) patch[k]=number(body[k],0,max,def);
    if(body.allergens!==undefined||body.allergen_tags!==undefined) patch.allergen_tags=list(body.allergen_tags||body.allergens);
    const saved=await repo.updateDish(m[1],patch);
    return changed({...saved,allergens:saved.allergen_tags},'UPDATE_DISH',saved.id,before,saved,cleanText(body.reason,1000));
  }
  if(path==='/api/v1/admin/menu-revisions') {
    if(!q.get('place_id')) throw new PolicyError(400,'Cần place_id');
    return ok(page(await repo.listMenuRevisions(q.get('place_id')),q));
  }
  if(path==='/api/v1/admin/ocr-review') {
    if(method==='GET') {
      let rows=await repo.listOcrQueue();
      if(q.has('status')) {
        if(!['pending_review','approved','rejected'].includes(q.get('status'))) throw new PolicyError(400,'Trạng thái lọc không hợp lệ');
        rows=rows.filter(r=>r.status===q.get('status'));
      }
      if(q.has('place_id')) rows=rows.filter(r=>r.place_id===q.get('place_id'));
      return ok(page(rows,q));
    }
    return reviewMenu(repo,actor,body);
  }
  m=path.match(/^\/api\/v1\/admin\/ads\/([^/]+)\/moderate$/);
  if(m) {
    const reason=requireReason(body);
    if(!['active','rejected','paused'].includes(body.decision)) throw new PolicyError(400,'Quyết định không hợp lệ');
    const before=structuredClone(await repo.getCampaign(m[1]));
    if(!before) throw new PolicyError(404,'Campaign not found');
    const after=await repo.updateCampaign(m[1],{status:body.decision});
    // Do not claim allergy/sponsor checks that this endpoint has not performed.
    return changed({campaign:after},'MODERATE_AD',after.id,before,after,reason);
  }
  throw new PolicyError(403,'API quản trị chưa được cấp quyền');
}
