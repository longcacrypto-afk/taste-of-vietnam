import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../ui-design/src/admin_forms.js',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../ui-design/src/product_runtime.js',import.meta.url),'utf8');
function harness() {
  const buttons=[{disabled:false},{disabled:true}], box={textContent:'',children:[],append(n){this.children.push(n);}};
  const form={dataset:{},querySelector:()=>box,querySelectorAll:()=>buttons};
  const context={window:{escHtml:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    appState:{activeScreenId:'M9-S02'},P2:{reload(){context.reloads++;}}},
    location:{pathname:'/app'},document:{querySelector:()=>null,createElement:()=>({addEventListener(){}})},
    Response,Headers,URLSearchParams,FormData,Event,console,reloads:0};
  vm.createContext(context);
  vm.runInContext(source.slice(0,source.indexOf('  const navTemplate'))+
    'window.test={C,content,ops,isAdmin,selections};})();',context);
  return {...context.window.test,context,form,buttons,box};
}
test('M9 forms: all input and option values are escaped, label is associated',()=>{
  const {C}=harness();
  const html=C.field('name"','Tên món','<img src=x onerror=1>','text');
  assert.ok(!html.includes('<img'));
  assert.match(html,/&lt;img/);assert.match(html,/name="name&quot;"/);
  assert.match(html,/<label/);assert.match(html,/aria-label="Tên món"/);
  assert.match(C.area('evidence','Bằng chứng','</textarea><script>'),/&lt;\/textarea&gt;/);
  assert.match(C.select('id','Món','x',[['x','<script>']]),/selected/);
  assert.ok(!C.select('id','Món','x',[['x','<script>']]).includes('<script>'));
});
test('M9 forms: explicit action buttons cannot submit the surrounding form',()=>{
  const {C}=harness();
  assert.match(C.button('Lưu'),/type="submit"/);
  assert.match(C.button('Thêm','add-menu'),/type="button" data-action="add-menu"/);
  assert.match(C.button('Bỏ','button'),/type="button"/);
  assert.match(runtime,/button:not\(\[onclick\]\):not\(\[type\]\)/);
});
test('M9 forms: role capability matrix exactly matches content and ops API roles',()=>{
  const {content,ops,isAdmin}=harness();
  for(const role of ['guest','consumer','merchant_owner','merchant_staff','admin','merchant']) {
    assert.equal(content(role),false);assert.equal(ops(role),false);assert.equal(isAdmin(role),false);
  }
  assert.equal(content('content_moderator'),true);assert.equal(ops('content_moderator'),false);
  assert.equal(content('ops_admin'),false);assert.equal(ops('ops_admin'),true);
  assert.equal(content('super_admin'),true);assert.equal(ops('super_admin'),true);
});
test('M9 forms: API sends typed JSON and returns server data only after 2xx',async()=>{
  const {C,context,selections}=harness();
  let received;
  context.window.M9_AUTH_FETCH=async(path,init)=>{
    received={path,init};
    return new Response(JSON.stringify({id:'DISH-fixture',cms:{version:1}}),{status:201});
  };
  const result=await C.api('/admin/dishes','POST',{name:'Fixture',version:0});
  assert.equal(received.path,'/api/v1/admin/dishes');
  assert.deepEqual(JSON.parse(received.init.body),{name:'Fixture',version:0});
  assert.equal(result.cms.version,1);assert.equal(selections['M9-S02'],'DISH-fixture');
});
test('M9 forms: API retains structured CSV errors and server validation reason',async()=>{
  const {C,context}=harness();
  context.window.M9_AUTH_FETCH=async()=>new Response(JSON.stringify({
    error:'Dữ liệu CSV không hợp lệ',errors:[{line:2,error:'Thiếu tên'}]}),{status:400});
  await assert.rejects(C.api('/admin/places/import','POST',{csv:'x',dry_run:true}),e=>{
    assert.equal(e.status,400);assert.equal(e.message,'Dữ liệu CSV không hợp lệ');
    assert.equal(e.data.errors[0].line,2);return true;
  });
});
test('M9 forms: successful mutation reloads; string/read-only results retain form',async()=>{
  const {C,context,form,buttons,box}=harness();
  await C.run(form,async()=>{});
  assert.equal(context.reloads,1);assert.equal(form.dataset.busy,undefined);
  assert.deepEqual(buttons.map(b=>b.disabled),[false,true]);
  await C.run(form,async()=>'Đã chạy thử; chưa ghi dữ liệu');
  assert.equal(context.reloads,1);assert.match(box.textContent,/chưa ghi/);
});
test('M9 forms: double click while busy does not submit twice',async()=>{
  const {C,form}=harness();let resolve,calls=0;
  const first=C.run(form,()=>{calls++;return new Promise(r=>resolve=r);});
  await C.run(form,async()=>{calls++;});assert.equal(calls,1);
  resolve('Đã đọc');await first;
});
test('M9 forms: 503 preserves inputs and disables no control permanently, never fake success',async()=>{
  const {C,context,form,buttons,box}=harness();form.typedValue='Nội dung chưa lưu';
  await C.run(form,async()=>{throw Object.assign(new Error('unavailable'),{status:503});});
  assert.equal(context.reloads,0);assert.equal(form.typedValue,'Nội dung chưa lưu');
  assert.match(box.textContent,/503/);assert.match(box.textContent,/Chưa lưu/);
  assert.deepEqual(buttons.map(b=>b.disabled),[false,true]);
});
test('M9 forms: stale conflict retains draft and offers refresh instead of automatic replay',async()=>{
  const {C,context,form,box}=harness();
  await C.run(form,async()=>{throw Object.assign(new Error('Phiên bản đã thay đổi'),{status:409});});
  assert.equal(context.reloads,0);assert.match(box.textContent,/tải bản mới/i);
  assert.equal(box.children[0].textContent,'Tải bản mới');
});
test('M9 forms: forbidden write and validation display inline without reloading',async()=>{
  const {C,context,form,box}=harness();
  await C.run(form,async()=>{throw Object.assign(new Error('forbidden'),{status:403});});
  assert.match(box.textContent,/không có quyền/);assert.equal(context.reloads,0);
  await C.run(form,async()=>{throw new Error('Cần nêu lý do xử lý');});
  assert.equal(box.textContent,'Cần nêu lý do xử lý');assert.equal(context.reloads,0);
});
test('M9 identity checks carry auth, use persisted server role, and load forms after actual paint',()=>{
  const shell=fs.readFileSync(new URL('../ui-design/src/app_shell.html',import.meta.url),'utf8');
  assert.match(shell,/p !== '\/api\/v1\/auth\/me'/);
  assert.match(runtime,/actor_role: identity.role/);
  assert.match(runtime,/window\.M9Forms\?\.mount\(root, appState\.activeScreenId/);
  assert.match(source,/const actualRole = d.actor_role/);
  assert.match(source,/p.is_open_override === false/);
});
