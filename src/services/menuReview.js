import { PolicyError } from './adminPolicy.js';
import { publicDish } from './dataEntry.js';

// Called only inside handleAdminRoute's role-rechecked atomic transaction.
export async function reviewMenu(repo, actor, body) {
  if (!['approved','rejected'].includes(body.decision))
    throw new PolicyError(400,'Chỉ được duyệt hoặc từ chối bản chờ duyệt');
  const item=structuredClone((await repo.listOcrQueue()).find(r=>r.id===body.ocr_id));
  if(!item) throw new PolicyError(404,'Không tìm thấy mục menu');
  if(!Number.isSafeInteger(body.version) || body.version<1)
    throw new PolicyError(400,'Cần version nguyên dương của mục menu');
  if((item.version||1)!==body.version || item.status!=='pending_review')
    throw new PolicyError(409,'Mục menu đã thay đổi hoặc đã xử lý; hãy tải lại');
  const reason=typeof body.reason==='string'?body.reason.trim():'';
  if(reason.length>1000 || (body.decision==='rejected'&&!reason))
    throw new PolicyError(400,'Cần lý do từ chối (tối đa 1000 ký tự)');
  let revision=null, mapping=null;
  if(body.decision==='approved') {
    if(typeof body.dish_id!=='string') throw new PolicyError(400,'Cần dish_id chuẩn');
    if(!Number.isSafeInteger(body.price) || body.price<0 || body.price>100000000)
      throw new PolicyError(400,'Giá phải là số nguyên từ 0 đến 100000000');
    const dish=await repo.getDish(body.dish_id);
    if(!dish) throw new PolicyError(404,'Không tìm thấy món chuẩn');
    if(!publicDish(dish) || dish.safety_status==='rejected')
      throw new PolicyError(400,'Món chuẩn chưa được xuất bản');
    await repo.lockPlace(item.place_id);
    const place=structuredClone(await repo.getPlace(item.place_id));
    if(!place) throw new PolicyError(404,'Không tìm thấy quán');
    if(place.cms?.status==='archived') throw new PolicyError(409,'Quán đã lưu trữ');
    const menu=structuredClone(place.menu||[]);
    const i=menu.findIndex(m=>m.dish_id===dish.id);
    mapping={dish_id:dish.id,name:item.extracted_name,price:body.price,available:i<0?true:menu[i].available!==false};
    if(i<0) menu.push(mapping); else menu[i]=mapping;
    // A human reviews this menu change; don't approve/unpause the place or change hours.
    const next={...place,menu,cms:{...(place.cms||{status:place.is_verified?'verified':'pending'}),
      version:(place.cms?.version||0)+1}};
    await repo.savePlace(next);
    await repo.saveContentVersion('place',next.id,next.cms.version,await repo.getPlace(next.id));
    revision={id:`menu-${item.id}-${body.version}`,ocr_id:item.id,place_id:place.id,
      before_menu:place.menu||[],after_menu:menu,actor_id:actor.id,reason:reason||'Xác nhận ghép menu',
      created_at:new Date().toISOString()};
    await repo.saveMenuRevision(revision);
  }
  const after={...item,status:body.decision,version:body.version+1,reviewed_by:actor.id,
    reviewed_at:new Date().toISOString(),rejection_reason:body.decision==='rejected'?reason:null,
    ...(mapping?{matched_dish_id:mapping.dish_id,matched_dish_name:(await repo.getDish(mapping.dish_id)).name,
      approved_price:mapping.price}: {})};
  await repo.saveOcrReview(after,body.version);
  return {status:200,data:{updated:after,menu_revision:revision},audit:{
    action:body.decision==='approved'?'APPROVE_OCR_MENU':'REJECT_OCR_MENU',target:item.id,
    before:item,after:{...after,menu_revision:revision},reason:reason||'Xác nhận ghép menu'}};
}
