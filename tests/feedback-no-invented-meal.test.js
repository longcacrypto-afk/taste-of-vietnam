// Owner rule 26/11: never invent data. Feedback records only the meal (and place) the user
// really chose; M5-S05 names that meal or says there is none, never a sample dish.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { handleApiRequest } from '../src/api/router.js';
import { createInitialStore } from '../src/data/seed.js';
import { login } from './helpers/auth.js';

const q = () => new URLSearchParams();
const feedback = (store, u, body) => handleApiRequest(store, 'POST', '/api/v1/suggestions/feedback', q(), body, u.headers);
const history = async (store, u) => (await handleApiRequest(store, 'GET', '/api/v1/suggestions/history', q(), {}, u.headers)).data.items;

test('feedback for an unknown or missing dish is refused, nothing is substituted', async () => {
  const store = createInitialStore();
  const u = await login(store, '0900000091');
  const unknown = await feedback(store, u, { dish_id: 'NOPE', action: 'eaten' });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.data.error, 'Dish not found');
  const missing = await feedback(store, u, { action: 'eaten' });
  assert.equal(missing.status, 400);
  assert.deepEqual(await history(store, u), [], 'no meal written to history');
});

test('feedback without a place stores no place (no sample place filled in)', async () => {
  const store = createInitialStore();
  const u = await login(store, '0900000092');
  const r = await feedback(store, u, { dish_id: 'DISH-102', action: 'eaten' });
  assert.equal(r.status, 200);
  assert.equal(r.data.recorded.dish_id, 'DISH-102');
  assert.equal(r.data.recorded.place_id, null);
  assert.equal(r.data.recorded.place_name, null);
  const [h] = await history(store, u);
  assert.equal(h.dish_id, 'DISH-102');
  assert.equal(h.place_name, null);
  assert.doesNotMatch(JSON.stringify(h), /PLACE-401|Phát Tài/);
});

test('feedback with a place uses the real place record; an unknown place is refused', async () => {
  const store = createInitialStore();
  const u = await login(store, '0900000093');
  const place = (await handleApiRequest(store, 'GET', '/api/v1/places', q())).data.items[0];
  const ok = await feedback(store, u, { dish_id: 'DISH-102', action: 'eaten', place_id: place.id, place_name: 'Tên tự gõ' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.recorded.place_id, place.id);
  assert.equal(ok.data.recorded.place_name, place.name, 'name comes from the place, not the client');
  const bad = await feedback(store, u, { dish_id: 'DISH-102', action: 'eaten', place_id: 'PLACE-NOPE' });
  assert.equal(bad.status, 404);
  assert.equal((await history(store, u)).length, 1);
});

const screens = fs.readFileSync('ui-design/src/screens_m3_m4_m5_m8.js', 'utf8');
const runtime = fs.readFileSync('ui-design/src/product_runtime.js', 'utf8');

test('M5-S05 design no longer names a hard-coded dish', () => {
  const block = screens.slice(screens.indexOf("'M5-S05': {"), screens.indexOf("'M8-S01': {"));
  assert.ok(block.includes('M5-S05'));
  assert.doesNotMatch(block, /Phở bò/i);
  assert.match(block, /✓ Đánh dấu Đã ăn & Xem lịch sử/, 'original button stays');
});

test('M5-S05 copy names the real meal, or says there is none', () => {
  const ctx = vm.createContext({});
  vm.runInContext(runtime.slice(runtime.indexOf('  // <m5-confirm>'), runtime.indexOf('  // </m5-confirm>')), ctx);
  const none = ctx.confirmCopy(null);
  assert.equal(none.ready, false);
  assert.match(none.title, /Chưa có món/);
  const named = ctx.confirmCopy({ dish_id: 'DISH-102', dish_name: 'Cơm tấm sườn bì chả', place_name: 'Quán A' });
  assert.equal(named.ready, true);
  assert.match(named.text, /món Cơm tấm sườn bì chả tại Quán A/);
  const unnamed = ctx.confirmCopy({ dish_id: 'DISH-102' });
  assert.match(unnamed.text, /món bạn đã chọn/);
  for (const c of [none, named, unnamed]) assert.doesNotMatch(JSON.stringify(c), /Phở bò/i);
});

test('M5-S05 confirm never posts a guessed meal', () => {
  const confirm = runtime.slice(runtime.indexOf('    confirmMeal() {'), runtime.indexOf('    exportData() {'));
  assert.match(confirm, /P2\.feedback\("eaten", state\.order\.dish_id, state\.order\.place_id\)/);
  assert.doesNotMatch(confirm, /else P2\.feedback\("eaten"\);/);
  assert.match(runtime, /else soon\(b, "Chưa có lượt đặt món/);
});
