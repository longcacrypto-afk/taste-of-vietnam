// M9 CMS uses the existing dish / recipe and M4 place shapes. No parallel catalogue.
import crypto from 'node:crypto';
import { PolicyError } from './adminPolicy.js';
import { getPlaceOpenStatus } from './placeHours.js';
import { removeVietnameseTones } from './textUtils.js';

const fail = message => { throw new PolicyError(400, message); };
const own = (v,k) => Object.hasOwn(v,k);
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const text = (v,max=1000) => {
  if(typeof v !== 'string' || v.length>max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) fail('Chuỗi không hợp lệ');
  return v.trim();
};
const required = (v,max) => text(v,max) || fail('Thiếu trường bắt buộc');
const number = (v,min,max,integer=false) => {
  if(typeof v!=='number' || !Number.isFinite(v) || v<min || v>max || (integer && !Number.isInteger(v))) fail('Số không hợp lệ');
  return v;
};
const boolean = v => typeof v === 'boolean' ? v : fail('Cần giá trị true/false');
const strings = v => {
  if(!Array.isArray(v) || v.length>50) fail('Cần danh sách nhãn');
  return [...new Set(v.map(s=>required(s,80)))];
};
function url(v) {
  v=text(v,2000);
  if(!v) return '';
  let u; try {u=new URL(v);} catch {fail('URL không hợp lệ');}
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password) fail('URL không hợp lệ');
  return u.href;
}
function source(v) {
  if(!object(v)) fail('Cần nguồn và quyền sử dụng');
  return {author:required(v.author,200),url:url(v.url||''),license:required(v.license,500)};
}
export function publicDish(d) {
  // Legacy compatibility is deliberate until REQUIRE_SAFETY_APPROVAL is enabled.
  return d && (!d.cms || (d.cms.status==='published' && d.safety_status==='approved' && d.cms.verified_at && d.cms.verified_by));
}
export const publicPlace = p => p && p.is_verified===true && (!p.cms || p.cms.status==='verified');
export function publicRepository(repo) {
  const out=Object.create(repo);
  out.listDishes=async()=> (await repo.listDishes()).filter(publicDish);
  out.getDish=async id=> {const d=await repo.getDish(id);return publicDish(d)?d:null;};
  out.mutateCollection=async(id,op)=>{
    if(['add','save_default'].includes(op.type)&&!await out.getDish(op.dishId)) return null;
    return repo.mutateCollection(id,op);
  };
  const filterMenu=async p=>{
    if(!p) return null;
    const ids=new Set((await out.listDishes()).map(d=>d.id));
    return {...p,menu:(p.menu||[]).filter(m=>ids.has(m.dish_id))};
  };
  out.listPlaces=async()=>Promise.all((await repo.listPlaces()).filter(publicPlace).map(filterMenu));
  out.getPlace=async id=>{const p=await repo.getPlace(id);return publicPlace(p)?filterMenu(p):null;};
  out.findPlacesNear=async opts=>{
    if(opts.dishId && !await out.getDish(opts.dishId)) return [];
    return Promise.all((await repo.findPlacesNear(opts)).filter(publicPlace).map(filterMenu));
  };
  return new Proxy(repo,{get(target,key) {
    if(Object.hasOwn(out,key)) return out[key];
    const value=target[key];
    return typeof value==='function'?value.bind(target):value;
  }});
}
export function dishInput(body,before=null) {
  const d=before ? structuredClone(before) : {
    id:`DISH-${crypto.randomUUID().slice(0,20)}`,region:'Miền Nam',meal_slots:['lunch','dinner'],
    calories:450,ref_price:50000,spice_level:1,allergen_tags:[],diet_flags:[],weather_fit:['any'],tags:[],
    description:'',ingredients:[],steps:[],base_servings:2,market_cost_base:0
  };
  for(const k of ['name','region','description','difficulty','img_key']) if(own(body,k)) d[k]=text(body[k],k==='description'?4000:120);
  if(!d.name) fail('Cần tên món');
  if(!['Miền Bắc','Miền Trung','Miền Nam','bac','trung','nam','Toàn quốc'].includes(d.region)) fail('Vùng không hợp lệ');
  for(const [k,max] of [['calories',10000],['ref_price',1e8],['spice_level',3],['prep_minutes',1440],['market_cost_base',1e8],['base_servings',10]]) {
    if(own(body,k)) d[k]=number(body[k],k==='base_servings'?1:0,max,['calories','ref_price','spice_level','prep_minutes','base_servings','market_cost_base'].includes(k));
  }
  for(const k of ['allergen_tags','diet_flags','tags','weather_fit','meal_slots']) if(own(body,k)) d[k]=strings(body[k]);
  if(own(body,'allergens')) d.allergen_tags=strings(body.allergens);
  if(!d.meal_slots.length || d.meal_slots.some(s=>!['breakfast','lunch','dinner','snack','late_night'].includes(s))) fail('Bữa ăn không hợp lệ');
  if(own(body,'ingredients')) {
    if(!Array.isArray(body.ingredients)||body.ingredients.length>200) fail('Nguyên liệu không hợp lệ');
    d.ingredients=body.ingredients.map(i=>{
      if(!object(i)) fail('Nguyên liệu không hợp lệ');
      return {name:required(i.name,200),amount:number(i.amount,0,1e6),unit:required(i.unit,40),...(own(i,'is_allergen')?{is_allergen:boolean(i.is_allergen)}:{})};
    });
  }
  if(own(body,'steps')) {
    if(!Array.isArray(body.steps)||body.steps.length>100) fail('Bước nấu không hợp lệ');
    d.steps=body.steps.map((s,i)=>{
      if(!object(s)) fail('Bước nấu không hợp lệ');
      return {step:i+1,title:required(s.title||s.text,2000),text:text(s.text||s.title,4000),duration_min:number(s.duration_min??0,0,1440)};
    });
  }
  if(own(body,'macros')) {
    if(!object(body.macros)) fail('Macro không hợp lệ');
    d.macros=Object.fromEntries(Object.entries(body.macros).map(([k,v])=>{
      if(!['protein','carbs','fat','fiber','protein_g','carbs_g','fat_g','fiber_g'].includes(k)) fail('Macro không hợp lệ');
      return [k,number(v,0,10000)];
    }));
  }
  const cms={...(d.cms||{}),status:'draft',version:(d.cms?.version||0)+1,verified_at:null,verified_by:null,evidence:''};
  for(const k of ['source','image_source']) if(own(body,k)) cms[k]=source(body[k]);
  d.cms=cms;d.safety_status='pending';
  return d;
}
export function validateHours(hours) {
  if(!object(hours)||!object(hours.weekly)|| (hours.overrides!==undefined&&!object(hours.overrides))) fail('Giờ mở cửa không hợp lệ');
  if(Object.keys(hours.weekly).some(k=>!/^[0-6]$/.test(k))) fail('Ngày trong tuần không hợp lệ');
  for(let day=0;day<7;day++) {
    // Reuse the M4 schedule parser instead of an independent interpretation.
    const probe={is_verified:true,verified_at:'2026-01-01T00:00:00Z',opening_hours:hours};
    const status=getPlaceOpenStatus(probe,new Date(Date.UTC(2026,0,4+day,5)));
    if(['missing_hours','missing_or_invalid_day','missing_previous_day'].includes(status.reason)) fail('Cần lịch hợp lệ đủ 7 ngày');
  }
  for(const [date,pairs] of Object.entries(hours.overrides||{})) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date) fail('Ngày ngoại lệ không hợp lệ');
    const probe={is_verified:true,verified_at:date+'T00:00:00Z',opening_hours:{weekly:hours.weekly,overrides:{[date]:pairs}}};
    if(getPlaceOpenStatus(probe,date+'T05:00:00Z').reason==='missing_or_invalid_day') fail('Giờ ngoại lệ không hợp lệ');
  }
  return structuredClone(hours);
}
export async function placeInput(repo,body,before=null) {
  const p=before?structuredClone(before):{
    id:`PLACE-${crypto.randomUUID().slice(0,20)}`,name:'',address:'',lat:null,lng:null,
    menu:[],opening_hours:null,is_verified:false,is_open_override:true,closed_report_count:0,
    rating:0,review_count:0,has_ac:false,has_kids_seat:false,phone:'',links:{}
  };
  for(const k of ['name','address','phone','img_key']) if(own(body,k)) p[k]=text(body[k],k==='address'?1000:200);
  if(!p.name||!p.address) fail('Cần tên và địa chỉ quán');
  for(const [k,max] of [['lat',90],['lng',180]]) if(own(body,k)) p[k]=number(body[k],-max,max);
  for(const k of ['has_ac','has_kids_seat']) if(own(body,k)) p[k]=boolean(body[k]);
  if(own(body,'opening_hours')) p.opening_hours=validateHours(body.opening_hours);
  if(own(body,'menu')) {
    if(!Array.isArray(body.menu)||body.menu.length>200) fail('Menu không hợp lệ');
    const ids=new Set();
    p.menu=[];
    for(const m of body.menu) {
      if(!object(m)||typeof m.dish_id!=='string'||!await repo.getDish(m.dish_id)||ids.has(m.dish_id)) fail('Món không tồn tại hoặc trùng menu');
      ids.add(m.dish_id);
      p.menu.push({dish_id:m.dish_id,name:text(m.name||'',200),price:number(m.price,0,1e8,true),available:boolean(m.available)});
    }
  }
  p.cms={...(p.cms||{}),status:'pending',version:(p.cms?.version||0)+1,verified_by:null,evidence:''};
  for(const k of ['source','image_source']) if(own(body,k)) p.cms[k]=source(body[k]);
  if(own(body,'evidence')) p.cms.evidence=required(body.evidence,4000);
  p.is_verified=false;p.verified_at=null;
  return p;
}
export const checkVersion=(body,item)=>{
  if(body.version!==undefined && body.version!==(item.cms?.version||0)) throw new PolicyError(409,'Phiên bản đã thay đổi');
};
export function verifyDish(d,actor,body) {
  if(body.allergen_verified!==true||body.diet_verified!==true) fail('Phải xác minh cả dị ứng và chế độ ăn');
  if(!d.ingredients?.length||!d.steps?.length||!d.cms?.source) fail('Thiếu công thức hoặc nguồn/quyền sử dụng');
  if(d.img_key && !d.cms.image_source) fail('Thiếu quyền sử dụng ảnh');
  d.cms={...d.cms,version:d.cms.version+1,verified_at:new Date().toISOString(),verified_by:actor.id,evidence:required(body.evidence,4000)};
  d.safety_status='approved'; return d;
}
export function verifyPlace(p,actor,body) {
  if(![p.lat,p.lng].every(Number.isFinite)||!p.menu?.length) fail('Cần tọa độ và menu');
  validateHours(p.opening_hours);
  if(!p.cms?.source) fail('Cần nguồn/quyền sử dụng');
  p.cms={...p.cms,status:'verified',version:p.cms.version+1,verified_by:actor.id,evidence:required(body.evidence||p.cms.evidence,4000)};
  p.is_verified=true;p.verified_at=new Date().toISOString();
  // Approve never clears a pause, count or report.
  return p;
}
const headers=['name','address','lat','lng','phone','opening_hours','menu','source_author','source_url','source_license','evidence','is_example'];
export const CSV_HEADERS=headers.join(',');
export function parseCsv(csv) {
  if(typeof csv!=='string'||Buffer.byteLength(csv)>500000) fail('CSV tối đa 500 KB');
  csv=csv.replace(/^\uFEFF/,'');
  const rows=[];let row=[],field='',quoted=false,closed=false;
  for(let i=0;i<=csv.length;i++) {
    const c=csv[i]??'\n';
    if(quoted) {
      if(c==='"'&&csv[i+1]==='"'){field+='"';i++;}
      else if(c==='"'){quoted=false;closed=true;}
      else if(i===csv.length) fail('CSV thiếu dấu ngoặc kép');
      else field+=c;
    } else if(c==='"') {
      if(field||closed) fail('CSV dấu ngoặc kép không hợp lệ');
      quoted=true;
    } else if(c===','||c==='\n'||c==='\r') {
      row.push(field);field='';closed=false;
      if(c!==',') {
        if(c==='\r'&&csv[i+1]==='\n') i++;
        if(row.some(v=>v!=='')) rows.push(row);
        row=[];
      }
    } else {
      if(closed) fail('CSV ký tự sau dấu ngoặc kép');
      field+=c;
    }
  }
  if(rows.length<1||rows[0].join(',')!==CSV_HEADERS) fail('Header CSV không đúng mẫu');
  if(rows.length>501) fail('CSV tối đa 500 dòng');
  return rows.slice(1).map((values,i)=>{
    if(values.length!==headers.length) fail(`Dòng ${i+2}: sai số cột`);
    return {line:i+2,...Object.fromEntries(headers.map((h,j)=>[h,values[j]]))};
  });
}
export const dedupeKey=p=>removeVietnameseTones(`${p.name}|${p.address}`).toLowerCase().replace(/\s+/g,' ').trim();
export async function importPlaces(repo,body) {
  if(typeof body.dry_run!=='boolean') fail('Cần dry_run true/false');
  const rows=parseCsv(body.csv),keys=new Set((await repo.listPlaces()).map(dedupeKey));
  const errors=[],duplicates=[],examples=[],items=[];
  for(const r of rows) {
    if(r.is_example==='true'){examples.push(r.line);continue;}
    try {
      if(!['','false'].includes(r.is_example)) fail('is_example cần true/false');
      const data={name:r.name,address:r.address,phone:r.phone,lat:r.lat.trim()?Number(r.lat):null,lng:r.lng.trim()?Number(r.lng):null,
        opening_hours:JSON.parse(r.opening_hours),menu:JSON.parse(r.menu),
        source:{author:r.source_author,url:r.source_url,license:r.source_license},evidence:r.evidence};
      const item=await placeInput(repo,data);
      const key=dedupeKey(item);
      if(keys.has(key)) {duplicates.push(r.line);continue;}
      keys.add(key);items.push(item);
    } catch(e) {
      if(!(e instanceof PolicyError || e instanceof SyntaxError)) throw e;
      errors.push({line:r.line,error:e instanceof SyntaxError?'JSON không hợp lệ':e.message});
    }
  }
  if(errors.length) return {status:400,data:{dry_run:body.dry_run,errors,duplicates,examples,would_create:0,created:0}};
  if(!body.dry_run) for(const p of items) {
    await repo.savePlace(p);
    await repo.saveContentVersion('place',p.id,p.cms.version,p);
  }
  return {status:200,data:{dry_run:body.dry_run,errors,duplicates,examples,would_create:items.length,created:body.dry_run?0:items.length,items}};
}
