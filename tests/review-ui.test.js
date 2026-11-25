import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const runtime=fs.readFileSync('ui-design/src/product_runtime.js','utf8');
test('Review UI: conflict retries refresh rather than resubmitting a stale approval',async()=>{
  const source=runtime.slice(runtime.indexOf('  const action ='),runtime.indexOf('  function selected()'));
  const messages=[];let loads=0,writes=0;
  const context=vm.createContext({status:(...args)=>messages.push(args),$:()=>({remove(){}}),
    P2:{reload(){loads++;}},fail:async()=>{writes++;throw Object.assign(new Error('conflict'),{status:409});}});
  vm.runInContext('let retryWrite;'+source,context);
  await vm.runInContext('action(fail)',context);
  assert.match(messages.at(-1)[0],/tải dữ liệu mới/);
  vm.runInContext('retryWrite()',context);
  assert.equal(loads,1);assert.equal(writes,1);
});
test('Review UI: offline retry still retries original write and creates no new form controls',async()=>{
  const source=runtime.slice(runtime.indexOf('  const action ='),runtime.indexOf('  function selected()'));
  let writes=0;
  const context=vm.createContext({status(){},$:()=>({remove(){}}),
    fail:async()=>{writes++;if(writes===1)throw Object.assign(new Error('offline'),{status:503});}});
  vm.runInContext('let retryWrite;'+source,context);
  await vm.runInContext('action(fail)',context);
  await vm.runInContext('retryWrite()',context);
  assert.equal(writes,2);
  const admin=runtime.slice(runtime.indexOf('  function bindAdmin('),runtime.indexOf('  function polish('));
  assert.doesNotMatch(admin,/<input|<select|<textarea/);
  assert.match(admin,/button\.disabled=true;button\.removeAttribute/);
});
