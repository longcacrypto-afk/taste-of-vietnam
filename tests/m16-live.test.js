// M16 live: glossary-based menu translation (no LLM), Vietnamese name kept, catalogue allergens,
// 'chưa dịch được' for unknown lines, phrases card, request log without menu text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { guest } from './helpers/auth.js';

const q = (s = '') => new URLSearchParams(s);
const tr = (store, body, h) => handleApiRequest(store, 'POST', '/api/v1/translate/menu', q(), body, h?.headers || {});

test('M16: POST /translate/menu is public; catalogue dishes translate into EN/KO/JA/ZH keeping the VI name', async () => {
  const store = createInitialStore();
  for (const L of ['EN', 'KO', 'JA', 'ZH']) {
    const r = await tr(store, { target_lang: L, lines: ['Phở bò tái nạm 45.000đ'] });
    assert.equal(r.status, 200);
    assert.equal(r.data.llm, false);
    const it = r.data.items[0];
    assert.equal(it.original_vietnamese_name, 'Phở bò tái nạm');
    assert.equal(it.matched_dish_id, 'DISH-101');
    assert.equal(it.status, 'translated');
    assert.ok(it.translated_title && it.translated_title !== it.original_vietnamese_name);
    assert.equal(it.price_vnd, 45000);
  }
  assert.equal((await tr(store, { target_lang: 'FR' })).status, 400);
  assert.equal((await tr(store, { target_lang: 'EN', lines: [] })).status, 400);
  assert.equal((await tr(store, { target_lang: 'EN', lines: 'x'.repeat(5) })).status, 200);
  assert.equal((await tr(store, { target_lang: 'EN', lines: { a: 1 } })).status, 400);
});

test('M16: allergen warnings come from the catalogue in the visitor language', async () => {
  const store = createInitialStore();
  const r = await tr(store, { target_lang: 'EN', lines: ['Gỏi cuốn tôm thịt 35k', 'Bánh xèo'] });
  const [goi, xeo] = r.data.items;
  assert.deepEqual(goi.allergen_tags, store.dishes.find(d => d.id === 'DISH-107').allergen_tags);
  assert.match(goi.allergen_warning, /shrimp/);
  assert.match(goi.allergen_warning, /peanuts/);
  assert.equal(goi.price_vnd, 35000);
  assert.match(xeo.allergen_warning, /egg/);
  const ko = await tr(store, { target_lang: 'KO', lines: ['Gỏi cuốn tôm thịt'] });
  assert.match(ko.data.items[0].allergen_warning, /새우/);
});

test('M16: unknown lines are marked chưa dịch được, never invented; known words get a partial gloss', async () => {
  const store = createInitialStore();
  const r = await tr(store, { target_lang: 'EN', lines: ['Bánh tráng trộn Tây Ninh 20k', 'Cơm gà nướng 40.000', 'Xyz abc'] });
  const [btt, com, xyz] = r.data.items;
  assert.equal(btt.status, 'untranslated');
  assert.equal(btt.translated_title, null);
  assert.equal(btt.status_label, 'chưa dịch được');
  assert.equal(com.status, 'partial');
  assert.match(com.translated_title, /rice/);
  assert.match(com.translated_title, /chicken/);
  assert.equal(xyz.status, 'untranslated');
  assert.deepEqual(r.data.counts, { translated: 0, partial: 1, untranslated: 2 });
  const tomLine = await tr(store, { target_lang: 'EN', lines: ['Mực xào tôm'] });
  assert.match(tomLine.data.items[0].allergen_warning, /shrimp/);
});

test('M16: no lines → catalogue sample menu, place_id → that place menu; legacy shape kept', async () => {
  const store = createInitialStore();
  const r = await tr(store, { target_lang: 'JA' });
  assert.equal(r.data.source, 'catalogue');
  assert.equal(r.data.items.length, store.dishes.length);
  assert.ok(r.data.translated_items[0].name_vi);
  const p = await tr(store, { target_lang: 'EN', place_id: 'PLACE-403' });
  assert.equal(p.data.source, 'place_menu');
  assert.equal(p.data.items[0].matched_dish_id, 'DISH-103');
  assert.equal((await tr(store, { target_lang: 'EN', place_id: 'NOPE' })).status, 404);
});

test('M16: phrases card (order + allergy), personal allergy line from the profile', async () => {
  const store = createInitialStore();
  const r = await handleApiRequest(store, 'GET', '/api/v1/translate/phrases', q('lang=KO'));
  assert.equal(r.status, 200);
  assert.equal(r.data.speech_lang, 'vi-VN');
  assert.ok(r.data.items.some(p => p.kind === 'order'));
  assert.ok(r.data.items.some(p => p.id === 'no-peanut' && p.translation.includes('땅콩')));
  assert.ok(!r.data.items.some(p => p.from_profile), 'anonymous: no personal phrase');
  const g = await guest(store);
  store.users[g.user.id].profile.hard_allergies = ['shrimp', 'peanut'];
  const me = await handleApiRequest(store, 'GET', '/api/v1/translate/phrases', q('lang=EN'), {}, g.headers);
  const mine = me.data.items.find(p => p.from_profile);
  assert.ok(mine, 'personal allergy phrase from the profile');
  assert.match(mine.translation, /shrimp/);
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/translate/phrases', q('lang=XX'))).status, 400);
});

test('M16: requests are logged as counts only (no menu text)', async () => {
  const store = createInitialStore();
  await tr(store, { target_lang: 'ZH', lines: ['Bí mật quán 99k'] });
  const log = store.moduleRecords.filter(r => r.module === 'M16' && r.kind === 'request');
  assert.equal(log.length, 1);
  assert.equal(log[0].data.lang, 'ZH');
  assert.ok(!JSON.stringify(log[0].data).includes('Bí mật'));
});
