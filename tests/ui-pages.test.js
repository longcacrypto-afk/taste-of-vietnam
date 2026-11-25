import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs';
import { serveUiPage } from '../ui-design/servePages.js';

test('product routes never serve Studio; protected Studio is uncached and disabled without config', async t => {
  const original = process.env.STUDIO_PASSWORD;
  const env = process.env.NODE_ENV;
  const server = http.createServer((req,res)=>{if(!serveUiPage(req,res,new URL(req.url,'http://local').pathname)){res.writeHead(404);res.end();}});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{if(original===undefined)delete process.env.STUDIO_PASSWORD;else process.env.STUDIO_PASSWORD=original;if(env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=env;server.closeAllConnections();await new Promise(r=>server.close(r));});
  const base='http://127.0.0.1:'+server.address().port;
  process.env.NODE_ENV='production';delete process.env.STUDIO_PASSWORD;
  for(const route of ['/','/app','/?studio=1','/app?mode=studio']){
    const r=await fetch(base+route);assert.equal(r.status,200);const s=await r.text();
    assert.match(s,/product.js/);assert.doesNotMatch(s,/Master UI|M3-S01|Gemini Active|v0\.1|93-Screen/);assert.equal(r.headers.get('cache-control'),'no-store');
  }
  assert.equal((await fetch(base+'/studio')).status,404);
  process.env.STUDIO_PASSWORD='test:studio-password';
  for(const authorization of [undefined,'Bearer test:studio-password','Basic '+Buffer.from('studio:wrong').toString('base64'),'Basic malformed']){
    const r=await fetch(base+'/studio',{headers:authorization?{authorization}:{}});assert.equal(r.status,401);assert.match(r.headers.get('www-authenticate'),/Basic/);assert.equal(r.headers.get('cache-control'),'no-store');
  }
  const headers={authorization:'Basic '+Buffer.from('studio:test:studio-password').toString('base64')};
  const r=await fetch(base+'/studio',{headers});assert.equal(r.status,200);assert.equal(r.headers.get('vary'),'Authorization');assert.match(await r.text(),/Master UI/);
  const head=await fetch(base+'/studio',{headers,method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(base+'/studio',{headers,method:'POST'})).status,405);
});

test('offline cache bypasses Studio and personal API data',()=>{
  const sw=fs.readFileSync(new URL('../ui-design/sw.js',import.meta.url),'utf8');
  assert.match(sw,/url.pathname === '\/studio'.*url.pathname.startsWith\('\/api\/'\)/);
  assert.match(sw,/hnag-v12-product/);
});
