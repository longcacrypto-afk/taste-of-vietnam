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
