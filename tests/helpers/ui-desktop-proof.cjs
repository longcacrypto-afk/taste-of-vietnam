const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const shell = fs.readFileSync(process.argv[2] || 'ui-design/src/app_shell.html','utf8');
const names = ['refreshLiveSuggestions','executeLiveSemanticSearch','sendLiveChatMessage','loadLivePlaces','renderLivePlacesGrid','loadLiveExplore','loadLiveRecipe','loadLiveAdmin','loadLiveProfile','selectSpiceLevel','selectDietMode','markDishEaten','addToCollection','submitOcrReview','unpausePlace','deleteAccountPdpd','likeDish','skipDish','saveLiveProfile'];
const defs = names.map(name => {
  const re = new RegExp('^    (?:async )?function '+name+'\\(', 'm');
  const m = re.exec(shell); assert(m, name);
  const rest = shell.slice(m.index + m[0].length);
  const n = /^    (?:async )?function /m.exec(rest);
  return shell.slice(m.index, m.index + m[0].length + n.index);
}).join('\n');
let assertions = 0;
function check(fn) { fn(); assertions++; }
function env(fetcher) {
  const elements = {};
  for (const id of ['live-suggestions-grid','live-weather-badge','live-semantic-input','live-chat-input','live-chat-messages','live-places-grid','live-explore-grid','live-explore-search','live-recipe-card','live-admin-content','live-profile-content','input-spice-level','input-diet-mode','input-budget-min','input-budget-max','reg-bac','reg-nam','reg-trung','ocr-card-o1','report-card-p1']) {
    elements[id] = {innerHTML:'',value:'',checked:false,disabled:false,dataset:{},attrs:{},scrollTop:0,scrollHeight:0,setAttribute(k,v){ this.attrs[k]=v; },focus(){this.focused=true;},remove(){this.removed=true;}};
  }
  elements['live-semantic-input'].value='bún';
  elements['live-chat-input'].value='Món <img src=x>';
  elements['input-spice-level'].value='0';
  elements['input-diet-mode'].value='balanced';
  elements['input-budget-min'].value='0';
  elements['input-budget-max'].value='65000';
  elements['reg-bac'].checked=true;
  const events = [], calls=[];
  const w = {console,Date,Math,Number,Set,Object,JSON,encodeURIComponent,
    document:{getElementById:id=>elements[id] || null},
    fetch:async (...args)=>{ calls.push(args); return fetcher(...args); },
    escHtml:v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),
    escJs:v=>String(v??'').replace(/'/g,'\\x27').replace(/"/g,'&quot;').replace(/</g,'\\x3c'),
    safeUrl:v=>/^https?:|^tel:|^#/.test(v)?v:'#',
    setLiveAppTab:()=>{},showFloatingToast:(...args)=>events.push(args.join(' ')),
    alert:msg=>events.push(msg),confirm:()=>true,prompt:()=> 'không rõ',
    setTimeout:()=>{},location:{reload:()=>events.push('reload')},
    TOV_AUTH:{renderLoginRequired:(c,status)=>{c.innerHTML='LOGIN '+status;}}
  };
  w.window=w;
  vm.createContext(w);
  vm.runInContext("let rawLivePlaces=[]; let currentPlaceFilter='all'; let currentExploreRegion=''; let currentRecipeDishId='d1'; let currentRecipeServings=2; let liveUserProfile=null;\n"+defs,w);
  return {w,e:elements,events,calls};
}
const response = (data,status=200) => ({ok:status>=200 && status<300,status,json:async()=>data});
const loaders = [
 ['refreshLiveSuggestions','live-suggestions-grid',{items:[]}],
 ['executeLiveSemanticSearch','live-suggestions-grid',{results:[]}],
 ['loadLivePlaces','live-places-grid',{places:[]}],
 ['loadLiveExplore','live-explore-grid',{items:[]}],
 ['loadLiveRecipe','live-recipe-card',{id:'d1',name:'Phở',ingredients:[],steps:[]}],
 ['loadLiveAdmin','live-admin-content',{total_dishes:0,total_verified_places:0,ocr_queue:[],user_reports:[],campaigns:[]}],
 ['loadLiveProfile','live-profile-content',{id:'guest',spice_level:0,budget_min:0,budget_max:65000}]
];
(async()=>{
  for (const [name,id,success] of loaders) {
    for (const kind of ['http','network','json','malformed']) {
      const a=env(async()=>{
        if(kind==='network') throw Error('offline');
        if(kind==='json') return {ok:true,status:200,json:async()=>{throw Error('bad json')}};
        return response(kind==='malformed'?{}:{error:'failure'},kind==='http'?500:200);
      });
      await a.w[name]();
      check(()=>assert.match(a.e[id].innerHTML,/Thử lại/,name+' '+kind));
      check(()=>assert.equal(a.e[id].attrs['aria-busy'],'false',name+' busy'));
    }
    const a=env(async()=>response(success));
    await a.w[name]();
    check(()=>assert(!a.e[id].innerHTML.includes('Đang tải'),name+' not stuck loading'));
    check(()=>assert.equal(a.e[id].attrs['aria-busy'],'false'));
    if(name==='loadLiveAdmin') {
      check(()=>assert(a.e[id].innerHTML.includes('>0 món')));
      check(()=>assert(a.e[id].innerHTML.includes('>0 quán')));
      check(()=>assert(a.e[id].innerHTML.includes('Không có mục OCR')));
      check(()=>assert(a.e[id].innerHTML.includes('Chưa có chiến dịch')));
    }
    if(name==='loadLiveProfile') {
      check(()=>assert(a.e[id].innerHTML.includes('aria-label="Ngân sách tối thiểu')));
      check(()=>assert(a.e[id].innerHTML.includes('value="0"')));
      check(()=>assert(!a.e[id].innerHTML.includes('text-white block')));
    }
  }
  for(const status of [401,403]) {
    const a=env(async()=>response({error:'forbidden'},status));
    await a.w.loadLiveAdmin();
    check(()=>assert.equal(a.e['live-admin-content'].innerHTML,'LOGIN '+status));
  }
  const p=env(async()=>response({places:[{id:'p1',name:'<img src=x>',rating:0,review_count:0,distance_m:0,open_hour:0,close_hour:0}]}));
  await p.w.loadLivePlaces();
  check(()=>assert(p.e['live-places-grid'].innerHTML.includes('Cách bạn 0m · ⭐ 0 (0 đánh giá)')));
  check(()=>assert(!p.e['live-places-grid'].innerHTML.includes('<img src=x>')));
  check(()=>assert(!p.e['live-places-grid'].innerHTML.includes('120 đánh giá')));
  const s=env(async()=>response({items:[{dish_id:'d1',name:'<img src=x>',price_vnd:0,calories:0,prep_minutes:0}]}));
  await s.w.refreshLiveSuggestions();
  check(()=>assert(s.e['live-suggestions-grid'].innerHTML.includes('>0đ')));
  check(()=>assert(!s.e['live-suggestions-grid'].innerHTML.includes('<img src=x>')));
  check(()=>assert.equal(s.e['live-chat-input'].attrs['aria-label'],'Tin nhắn cho Măm'));
  for (const status of [400,401,403,500]) {
    const a=env(async()=>response({error:'failed'},status));
    await a.w.sendLiveChatMessage();
    check(()=>assert(a.e['live-chat-messages'].innerHTML.includes('Thử lại')));
    check(()=>assert.equal(a.e['live-chat-input'].value,'Món <img src=x>'));
    check(()=>assert.equal(a.e['live-chat-input'].disabled,false));
    check(()=>assert(!a.e['live-chat-messages'].innerHTML.includes('đã ghi nhận')));
  }
  const chat=env(async()=>response({assistant_message:'<img src=x>',options:[]}));
  await chat.w.sendLiveChatMessage();
  check(()=>assert(chat.e['live-chat-messages'].innerHTML.includes('&lt;img src=x&gt;')));
  check(()=>assert(!chat.e['live-chat-messages'].innerHTML.includes('<img src=x>')));
  const emptyChat=env(async()=>response({}));
  await emptyChat.w.sendLiveChatMessage();
  check(()=>assert(emptyChat.e['live-chat-messages'].innerHTML.includes('Thử lại')));
  let release;
  const pending=env(()=>new Promise(resolve=>{release=resolve}));
  const first=pending.w.sendLiveChatMessage();
  pending.e['live-chat-input'].value='duplicate';
  await pending.w.sendLiveChatMessage();
  check(()=>assert.equal(pending.calls.length,1,'prevent duplicate chat while pending'));
  release(response({assistant_message:'OK'})); await first;
  const writes = [
    ['markDishEaten',['d1','Phở']],['likeDish',['d1','Phở']],['skipDish',['d1','Phở']],['addToCollection',['d1']],
    ['submitOcrReview',['o1','approved']],['unpausePlace',['p1','Quán']],['saveLiveProfile',[]],['deleteAccountPdpd',[]]
  ];
  for (const [name,args] of writes) {
    for(const status of [400,401,403,500]) {
      const a=env(async()=>response({error:'failed'},status));
      a.w.refreshLiveSuggestions=()=>a.events.push('refresh');
      await a.w[name](...args);
      check(()=>assert(!a.events.some(x=>/Thành Công|Đã Ghi Nhận|Đã Lưu Món|Đã Đổi|Đã Cập Nhật|Đã Xóa|⭐ Đã lưu|refresh/.test(x)),name+' '+status));
      check(()=>assert.equal(a.e['ocr-card-o1'].innerHTML,''));
      check(()=>assert.equal(a.e['report-card-p1'].innerHTML,''));
    }
  }
  const save=env(async()=>response({id:'u',spice_level:0,budget_min:0}));
  save.w.refreshLiveSuggestions=()=>{};
  await save.w.saveLiveProfile();
  const payload=JSON.parse(save.calls[0][1].body);
  check(()=>assert.equal(payload.spice_level,0));
  check(()=>assert.equal(payload.budget_min,0));
  // Use the real memory repository/router shapes, not only hand-written fixtures.
  const {createInitialStore}=await import('file://'+process.cwd()+'/src/data/seed.js');
  const {handleApiRequest}=await import('file://'+process.cwd()+'/src/api/router.js');
  const {guest,loginAdmin}=await import('file://'+process.cwd()+'/tests/helpers/auth.js');
  const store=createInitialStore();
  const g=await guest(store), admin=await loginAdmin(store);
  function api(headers) {
    return async (url,init={})=>{
      const parsed=new URL(url,'http://localhost');
      const r=await handleApiRequest(store,init.method || 'GET',parsed.pathname,parsed.searchParams,init.body ? JSON.parse(init.body) : {}, headers);
      return response(r.data,r.status);
    };
  }
  for(const [name,id] of loaders) {
    const a=env(api(name==='loadLiveAdmin'?admin.headers:g.headers));
    vm.runInContext("currentRecipeDishId='DISH-101';",a.w);
    await a.w[name]();
    check(()=>assert(!a.e[id].innerHTML.includes('role="alert"'),name+' real API renders'));
    check(()=>assert(!a.e[id].innerHTML.includes('undefined'),name+' no undefined'));
  }
  const realChat=env(api(g.headers));
  await realChat.w.sendLiveChatMessage();
  check(()=>assert(!realChat.e['live-chat-messages'].innerHTML.includes('Không gửi được')));
  const realSave=env(api(g.headers));
  realSave.w.refreshLiveSuggestions=()=>{};
  await realSave.w.saveLiveProfile();
  check(()=>assert(realSave.events.some(x=>x.includes('Đã Cập Nhật'))));
  const realAdmin=env(api(admin.headers));
  await realAdmin.w.submitOcrReview('ocr-901','approved');
  await realAdmin.w.loadLiveAdmin();
  check(()=>assert(!realAdmin.e['live-admin-content'].innerHTML.includes('ocr-card-ocr-901'),'reviewed OCR no longer pending'));
  check(()=>assert(realAdmin.e['live-admin-content'].innerHTML.includes('>1 mục')));
  const noRecipe=env(api(g.headers));
  await noRecipe.w.loadLiveRecipe('');
  check(()=>assert.equal(noRecipe.calls.length,0,'no bogus missing recipe request'));
  check(()=>assert(noRecipe.e['live-recipe-card'].innerHTML.includes('Khám Phá')));
  const stalePlaces=env(async()=>response({error:'offline'},500));
  await stalePlaces.w.loadLivePlaces();
  const err=stalePlaces.e['live-places-grid'].innerHTML;
  stalePlaces.w.renderLivePlacesGrid();
  check(()=>assert.equal(stalePlaces.e['live-places-grid'].innerHTML,err,'filter cannot erase load failure'));
  console.log(`PASS: ${assertions} focused source-function assertions`);
})().catch(e=>{console.error(e);process.exitCode=1;});
