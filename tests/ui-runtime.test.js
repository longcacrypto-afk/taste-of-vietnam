import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

test('all generated UI scripts parse, including literal double-dollar DOM selectors',()=>{
 const html=fs.readFileSync('ui-design/index.html','utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim());
 assert.ok(scripts.length>2);
 for(const script of scripts)new vm.Script(script);
 const runtime=fs.readFileSync('ui-design/src/product_runtime.js','utf8');
 assert.ok(html.includes(runtime),'build must preserve literal source without replacement-dollar expansion');
});

test('224 desktop UI source-function assertions: real errors, empty data, retry, permissions and escaping',()=>{
 const r=spawnSync(process.execPath,['tests/helpers/ui-desktop-proof.cjs'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stdout+r.stderr);
 assert.match(r.stdout,/224 focused source-function assertions/);
});

test('product bindings preserve original screen renderers, Google contract and read-only library layout',()=>{
 const runtime=fs.readFileSync('ui-design/src/product_runtime.js','utf8');
 assert.match(runtime,/if \(!\["\/", "\/app"\]\.includes\(location.pathname\)\) return/);
 assert.match(runtime,/const original = scr.render/);
 assert.match(runtime,/api\/v1\/auth\/google\/config/);
 assert.match(runtime,/Google · Sắp có/);
 assert.doesNotMatch(runtime,/function adminHtml|P2\.saveDish|P2\.edit\(/,'no invented admin editor');
 assert.match(runtime,/\.grid-cols-2 > \.group/,'suggestion binding must not consume category buttons');
});

test('M2 product servings controls cannot exceed the API maximum of ten', () => {
  const source = fs.readFileSync(new URL('../ui-design/src/product_runtime.js', import.meta.url), 'utf8');
  assert.match(source, /Math\.min\(10, \(appState\.servings \|\| 2\) \+ delta\)/);
  assert.doesNotMatch(source, /Math\.min\(20, \(appState\.servings/);
});


test('original Explore query is accepted by strict M2 API with no region and with selected filters', async () => {
  const runtime = fs.readFileSync('ui-design/src/product_runtime.js','utf8');
  const config = runtime.slice(runtime.indexOf('  function config(id)'), runtime.indexOf('  let originalStage'));
  const state={query:'',region:''};
  const context=vm.createContext({state,api:path=>path});
  vm.runInContext(config,context);
  const {handleApiRequest}=await import('../src/api/router.js');
  const {createInitialStore}=await import('../src/data/seed.js');
  for(const [query,region] of [['',''],['cơm',''],['','nam']]) {
    Object.assign(state,{query,region});
    const path=context.config('M2-S01')[1]();
    const url=new URL(path,'http://local');
    assert.equal(url.searchParams.has('region'),Boolean(region),'never send an invalid empty enum');
    const r=await handleApiRequest(createInitialStore(),'GET','/api/v1'+url.pathname,url.searchParams);
    assert.equal(r.status,200);
    assert.ok(r.data.items.length>0);
  }
});
