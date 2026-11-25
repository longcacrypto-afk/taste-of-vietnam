import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const shell = fs.readFileSync('ui-design/src/app_shell.html', 'utf8');
const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');

test('product game bridge calls each M3 endpoint and never falls back after empty/error results', async () => {
  const start = runtime.indexOf('    async gamePick(kind) {');
  const end = runtime.indexOf('    dish(id, target', start);
  const source = runtime.slice(start, end).trim().replace(/^async gamePick/, 'async function gamePick').replace(/,$/, '');
  const state = {}, messages = [], calls = [];
  let response, failure;
  const context = vm.createContext({
    state, status: m => messages.push(m),
    api: async path => { calls.push(path); if (failure) throw failure; return response; }
  });
  vm.runInContext(source, context);
  for (const kind of ['spin', 'game', 'fortune', 'blind-box']) {
    response = { picked_dish: { id: 'ONLY-SAFE', name: 'Món an toàn fixture' }, nearest_place: { place_id: 'PLACE-FIXTURE' } };
    assert.equal((await context.gamePick(kind)).id, 'ONLY-SAFE');
    assert.equal(calls.at(-1), '/suggestions/' + kind);
    assert.equal(state.dish, 'ONLY-SAFE');
    assert.equal(state.place, 'PLACE-FIXTURE');
    response = { picked_dish: null, reasons: [{message:'Không có món phù hợp'}] };
    assert.equal(await context.gamePick(kind), null);
    assert.equal(state.spin, null);
    assert.equal(state.dish, null);
    failure = new Error('offline');
    assert.equal(await context.gamePick(kind), null);
    assert.equal(state.dish, null);
    failure = null;
  }
  assert.equal(calls.length, 12);
  assert.equal(await context.gamePick('unregistered'), null);
  assert.equal(calls.length, 12);
  assert.equal(messages.length, 8);
});

function gameHarness(picked) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      disabled: false, textContent: '', innerHTML: '', dataset: {}, style: {},
      classList: {add(){},remove(){}}, querySelectorAll: () => [], querySelector: () => null
    });
    return elements.get(id);
  };
  const calls = [];
  const context = vm.createContext({
    window: {P2: true}, P2: {gamePick: async kind => {calls.push(kind);return picked;}},
    document: {getElementById: element}, liveWheelRotation:0,
    Math: {...Math, random(){throw new Error('Product must not pick a local dish');}},
    Number, escHtml: v => String(v ?? ''), escJs: v => String(v ?? ''),
    playWebAudioSound(){}, launchMiniConfetti(){}, setTimeout: fn => fn()
  });
  for (const [name, next] of [
    ['startLiveSpin','    // GAME 2:'],
    ['drawFoodFortune','    // GAME 3:'],
    ['openBlindBox','    function resetBlindBoxes']
  ]) {
    const start = shell.indexOf('    async function ' + name);
    const end = shell.indexOf(next, start);
    assert.ok(start >= 0 && end > start);
    vm.runInContext(shell.slice(start,end), context);
  }
  return {context, element, calls};
}

test('existing game animations display only the server dish; product never uses local fortunes/loot', async () => {
  const {context,element,calls} = gameHarness({id:'SAFE-ONLY',name:'Món fixture từ máy chủ',ref_price:25000,calories:400,description:'Mô tả fixture'});
  await context.startLiveSpin();
  await context.drawFoodFortune();
  await context.openBlindBox(0);
  assert.deepEqual(calls,['game','fortune','blind-box']);
  for (const id of ['live-spin-title','fortune-card-result','blindbox-reveal']) {
    assert.match(element(id).innerHTML,/Món fixture từ máy chủ/);
    assert.doesNotMatch(element(id).innerHTML,/undefined|GRAB50|GIAM50/);
  }
});

test('empty game API never runs a local animation fallback and permits retry on the original controls', async () => {
  const {context,element,calls} = gameHarness(null);
  await context.startLiveSpin();
  await context.drawFoodFortune();
  await context.openBlindBox(0);
  assert.deepEqual(calls,['game','fortune','blind-box']);
  for (const id of ['live-spin-title','fortune-card-result','blindbox-reveal'])
    assert.match(element(id).textContent,/Chưa có món phù hợp/);
  assert.equal(element('btn-spin-live').disabled,false);
  assert.equal(element('btn-draw-fortune').disabled,false);
  assert.equal(element('blindbox-0').dataset.loading,undefined);
});
