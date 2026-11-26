import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { createAppServer } from '../server.js';
import {
  clientIp, createRateLimiter, rateGroups, parseOrigins, MAX_REQUEST_BYTES,
  logHttpFailure
} from '../src/services/httpSecurity.js';

async function withServer(options, fn) {
  const server = createAppServer(options);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`, server); }
  finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
}
function rawRequest(base, { method = 'POST', path = '/api/v1/probe', headers = {}, chunks = [] } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + path, { method, headers }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    for (const chunk of chunks) req.write(chunk);
    req.end();
  });
}
const echo = async (_store, _method, _path, _query, body) => ({ status: 200, data: body });

test('CORS configuration accepts only exact origins and fails closed on invalid config', () => {
  assert.deepEqual([...parseOrigins('https://example.com, http://localhost:3000')], ['https://example.com','http://localhost:3000']);
  for (const value of ['*','null','https://example.com/','https://example.com/path','https://user:pass@example.com','file:///tmp/x']) {
    assert.throws(() => parseOrigins(value));
  }
});
test('default CORS denies foreign/null origins on reads, writes and preflight before API dispatch', async () => {
  let calls = 0;
  await withServer({ apiHandler: async () => { calls++; return {status: 200, data: {}}; } }, async base => {
    for (const method of ['GET','POST','OPTIONS']) for (const origin of ['https://evil.invalid','null']) {
      const r = await fetch(base + '/api/v1/me/profile', { method, headers: { Origin: origin } });
      assert.equal(r.status, 403);
      assert.equal(r.headers.get('access-control-allow-origin'), null);
      assert.equal(r.headers.get('cache-control'), 'private, no-store');
    }
    assert.equal(calls, 0);
  });
});
test('same-origin and native requests work without an allowlist', async () => {
  await withServer({ apiHandler: echo }, async base => {
    for (const origin of [null, base]) {
      const r = await fetch(base + '/api/v1/probe', { headers: origin ? {Origin: origin} : {} });
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('access-control-allow-origin'), origin);
      assert.equal(r.headers.get('access-control-allow-credentials'), null);
      assert.equal(r.headers.get('vary'), 'Origin, Authorization');
    }
  });
});
test('explicit allowlist echoes only the exact origin with working preflight', async () => {
  const prev = process.env.CORS_ALLOWED_ORIGINS;
  process.env.CORS_ALLOWED_ORIGINS = 'https://approved.invalid';
  try {
    await withServer({}, async base => {
      const r = await fetch(base + '/api/v1/auth/google', { method: 'OPTIONS', headers: { Origin: 'https://approved.invalid', 'Access-Control-Request-Headers': 'authorization,content-type' } });
      assert.equal(r.status, 204);
      assert.equal(r.headers.get('access-control-allow-origin'), 'https://approved.invalid');
      assert.match(r.headers.get('access-control-allow-headers'), /Authorization/);
      assert.match(r.headers.get('access-control-allow-methods'), /PATCH/);
      const bad = await fetch(base + '/api/v1/dishes', { headers: { Origin: 'https://approved.invalid.evil.invalid' } });
      assert.equal(bad.status, 403);
    });
  } finally { if (prev === undefined) delete process.env.CORS_ALLOWED_ORIGINS; else process.env.CORS_ALLOWED_ORIGINS = prev; }
});
test('production same-origin works behind HTTPS termination; insecure origin denied', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await withServer({ apiHandler: echo }, async base => {
      assert.equal((await fetch(base + '/api/v1/probe', {headers: {Origin: base.replace('http:', 'https:')}})).status, 200);
      assert.equal((await fetch(base + '/api/v1/probe', {headers: {Origin: base}})).status, 403);
    });
  } finally { if (prev === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prev; }
});
test('security headers protect UI, API, static files, errors and health without disabling GPS', async () => {
  await withServer({}, async base => {
    for (const path of ['/', '/app', '/studio', '/health', '/api/v1/me/profile', '/sw.js', '/missing']) {
      const r = await fetch(base + path);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(r.headers.get('x-frame-options'), 'DENY');
      assert.match(r.headers.get('content-security-policy'), /object-src 'none'/);
      assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      assert.equal(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.match(r.headers.get('permissions-policy'), /geolocation=\(self\)/);
      assert.match(r.headers.get('strict-transport-security'), /max-age=31536000/);
      assert.match(r.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
      await r.arrayBuffer();
    }
  });
});
test('personal and catalogue API results never enter shared or browser caches, including denied reads', async () => {
  await withServer({}, async base => {
    const g = await fetch(base + '/api/v1/auth/guest', { method:'POST' });
    assert.equal(g.status, 200);
    assert.equal(g.headers.get('cache-control'), 'private, no-store');
    const guest = await g.json();
    for (const path of ['/auth/me','/me/profile','/me/export','/me/collections','/suggestions/today','/suggestions/history','/dishes']) {
      const r = await fetch(base + '/api/v1' + path, { headers: { Authorization: `Bearer ${guest.access_token}` } });
      assert.equal(r.status, 200, path);
      assert.equal(r.headers.get('cache-control'), 'private, no-store');
      assert.match(r.headers.get('vary'), /Authorization/);
    }
    assert.equal((await fetch(base + '/api/v1/me/profile')).headers.get('cache-control'), 'private, no-store');
  });
});
test('rate groups cover every auth/write/report/redirect variant, not read-only catalogue', () => {
  for (const path of ['/auth/guest','/auth/google','/auth/login','/auth/otp/request','/auth/otp/verify']) {
    assert.deepEqual(rateGroups('POST','/api/v1'+path), ['write','auth']);
  }
  for (const method of ['POST','PUT','PATCH','DELETE']) assert.deepEqual(rateGroups(method,'/api/v1/admin/dishes/1'), ['write']);
  assert.deepEqual(rateGroups('POST','/api/v1/places/P1/reports'), ['write','report']);
  assert.deepEqual(rateGroups('POST','/api/v1/orders/redirect'), ['write','redirect']);
  assert.deepEqual(rateGroups('POST','/api/v1/orders/R1/confirm-eaten'), ['write','redirect']);
  for (const method of ['GET','HEAD','OPTIONS']) assert.deepEqual(rateGroups(method,'/api/v1/dishes'), []);
});
test('fixed windows isolate addresses, reset at expiry and share budgets across route ids', () => {
  let now = 0;
  const limiter = createRateLimiter({now: () => now, rules: {write:{limit:2,windowMs:1000}}});
  assert.equal(limiter('A',['write']),0);
  assert.equal(limiter('A',['write']),0);
  assert.equal(limiter('A',['write']),1);
  assert.equal(limiter('B',['write']),0);
  now = 1000;
  assert.equal(limiter('A',['write']),0);
});
test('bounded limiter fails closed on address floods without evicting active limits', () => {
  let now = 0;
  const limiter = createRateLimiter({now:()=>now,maxEntries:1,rules:{write:{limit:1,windowMs:1000}}});
  assert.equal(limiter('A',['write']),0);
  assert.equal(limiter('B',['write']),60);
  assert.equal(limiter('A',['write']),1);
  now = 1000;
  assert.equal(limiter('B',['write']),0);
});
test('forwarded headers are ignored by default, bounded trust reads from right, malformed chains fail safe', () => {
  const req = {socket:{remoteAddress:'10.0.0.1'}, headers:{'x-forwarded-for':'1.1.1.1, 2.2.2.2'}};
  assert.equal(clientIp(req), '10.0.0.1');
  assert.equal(clientIp(req,1), '2.2.2.2');
  assert.equal(clientIp(req,2), '1.1.1.1');
  assert.equal(clientIp(req,3), '10.0.0.1');
  req.headers['x-forwarded-for'] = 'spoofed';
  assert.equal(clientIp(req,1),'10.0.0.1');
});
test('invalid proxy trust configuration refuses to boot rather than trusting all proxies', () => {
  const prev = process.env.TRUST_PROXY_HOPS;
  try {
    for (const value of ['true','-1','1.5','6']) {
      process.env.TRUST_PROXY_HOPS = value;
      assert.throws(() => createAppServer(), /TRUST_PROXY_HOPS/);
    }
  } finally { if (prev === undefined) delete process.env.TRUST_PROXY_HOPS; else process.env.TRUST_PROXY_HOPS = prev; }
});
for (const [name, paths, limit] of [
  ['auth',['/auth/guest','/auth/google'],30],
  ['write',['/me/profile','/admin/dishes'],120],
  ['report',['/places/A/reports','/places/B/reports'],10],
  ['redirect',['/orders/redirect','/orders/R1/confirm-eaten'],30]
]) test(`HTTP ${name} default limit returns 429 + retry without dispatch; token and fake proxy rotation cannot bypass`, async () => {
  let calls = 0;
  await withServer({apiHandler: async () => { calls++; return {status:200,data:{ok:true}}; }}, async base => {
    for (let i=0;i<limit+1;i++) {
      const r = await fetch(base+'/api/v1'+paths[i%paths.length], { method:'POST',headers:{Authorization:`Bearer fake-${i}`, 'X-Forwarded-For':`192.0.2.${i%255}`} });
      assert.equal(r.status, i < limit ? 200 : 429, `request ${i+1}`);
      if (i === limit) {
        assert.ok(Number(r.headers.get('retry-after')) > 0);
        assert.equal(r.headers.get('cache-control'),'private, no-store');
        assert.equal((await r.json()).request_id,r.headers.get('x-request-id'));
      } else await r.arrayBuffer();
    }
    assert.equal(calls,limit);
    assert.equal((await fetch(base+'/health')).status,200);
    assert.equal((await fetch(base+'/api/v1/dishes')).status,200);
  });
});
test('JSON payload cap counts bytes, handles exact cap and rejects Content-Length and chunked overflow before dispatch', async () => {
  let calls=0;
  await withServer({apiHandler:async (...args)=>{calls++;return echo(...args);}},async base=>{
    const exact = JSON.stringify({x:'a'.repeat(MAX_REQUEST_BYTES-8)});
    assert.equal(Buffer.byteLength(exact),MAX_REQUEST_BYTES);
    assert.equal((await rawRequest(base,{headers:{'Content-Type':'application/json'},chunks:[exact]})).status,200);
    const bad = 'é'.repeat(MAX_REQUEST_BYTES);
    assert.equal((await rawRequest(base,{headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(bad)},chunks:[bad]})).status,413);
    assert.equal((await rawRequest(base,{headers:{'Content-Type':'application/json'},chunks:[bad.slice(0,10000),bad.slice(10000)]})).status,413);
    assert.equal(calls,1);
  });
});
test('DELETE and GET bodies also have payload caps; unsupported encoding is rejected', async () => {
  await withServer({apiHandler:echo},async base=>{
    for(const method of ['DELETE','GET']) assert.equal((await rawRequest(base,{method,headers:{'Content-Length':MAX_REQUEST_BYTES+1},chunks:['x']})).status,413);
    assert.equal((await rawRequest(base,{headers:{'Content-Encoding':'gzip'}})).status,415);
  });
});
test('malformed JSON, scalar/array payloads and wrong content types cannot become an empty mutation', async () => {
  let calls=0;
  await withServer({apiHandler:async()=>{calls++;return {status:200,data:{}};}}, async base=>{
    for(const body of ['{','null','[]','1','"x"']) {
      assert.equal((await rawRequest(base,{headers:{'Content-Type':'application/json'},chunks:[body]})).status,400);
    }
    assert.equal((await rawRequest(base,{headers:{'Content-Type':'text/plain'},chunks:['{}']})).status,415);
    assert.equal(calls,0);
    assert.equal((await rawRequest(base,{headers:{'Content-Type':'application/json; charset=utf-8'},chunks:['{}']})).status,200);
  });
});
test('M6 snapshot and all WebSocket upgrades are disabled; no KPI or handshake leakage', async () => {
  await withServer({}, async (base,server)=>{
    for(const path of ['/api/v1/ws/test-payload','/ws/merchant']) {
      const r=await fetch(base+path);
      assert.equal(r.status,404);
      assert.doesNotMatch(await r.text(),/kpi|impressions|analytics/);
    }
    for(const path of ['/ws/merchant','/ws/other']) {
      const data=await new Promise((resolve,reject)=>{
        const socket=net.connect(server.address().port,'127.0.0.1');
        let reply='';
        socket.on('connect',()=>socket.write(`GET ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`));
        socket.on('data',c=>reply+=c);
        socket.on('end',()=>resolve(reply));socket.on('error',reject);
      });
      assert.match(data,/404 Not Found/);
      assert.doesNotMatch(data,/101 |Sec-WebSocket-Accept|kpi/);
    }
  });
});
test('thrown and returned server failures become private generic responses and structured sanitized error events', async () => {
  const logs=[];
  let thrown=true;
  await withServer({logError:line=>logs.push(JSON.parse(line)),apiHandler:async()=>{
    if(thrown)throw new Error('postgres://user:secret@host?token=private');
    return {status:503,data:{error:'OTP=123456',stack:'secret'}};
  }},async base=>{
    for(const status of [500,503]){
      const r=await fetch(base+'/api/v1/probe?email=private&token=secret',{headers:{Authorization:'Bearer private','X-Request-Id':'injected'}});
      assert.equal(r.status,status);
      assert.equal(r.headers.get('cache-control'),'private, no-store');
      const body=await r.text();
      assert.doesNotMatch(body,/secret|OTP|stack|postgres/);
      const log=logs.at(-1);
      assert.equal(log.event,'http_failure');assert.equal(log.status,status);
      assert.equal(log.request_id,r.headers.get('x-request-id'));
      assert.notEqual(log.request_id,'injected');
      assert.ok(log.duration_ms>=0);
      thrown=false;
    }
    assert.equal(logs.length,2);
    assert.doesNotMatch(JSON.stringify(logs),/private|secret|OTP|stack|email|token=|postgres/);
  });
});
test('monitor hook normalizes unknown methods and only logs a fixed safe schema',()=>{
  let line;
  logHttpFailure({requestId:'fixture',method:'SECRET',status:500,durationMs:-10,body:'secret'},s=>line=s);
  const record=JSON.parse(line);
  assert.equal(record.method,'OTHER');assert.equal(record.duration_ms,0);
  assert.deepEqual(Object.keys(record).sort(),['timestamp','level','event','request_id','method','status','duration_ms'].sort());
});
