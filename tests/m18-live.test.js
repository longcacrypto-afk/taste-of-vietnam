// M18 live: fridge inventory (shared contract M18/item), ≤48 h alert, CRUD + consume,
// EAN-13 check digit + demo product table, unknown barcode naming, allergy-safe suggestions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { guest } from './helpers/auth.js';
import { ean13Valid, gs1Country } from '../src/modules/m18.js';
import { moduleStore } from '../src/modules/moduleStore.js';
import { getRepository } from '../src/db/repository.js';

const q = (s = '') => new URLSearchParams(s);
const api = (store, u, m, p, body) => handleApiRequest(store, m, p.split('?')[0], q(p.split('?')[1] || ''), body, u.headers);

test('M18: EAN-13 check digit and GS1 country', () => {
  assert.equal(ean13Valid('8934567890120'), true);
  assert.equal(ean13Valid('8934567890123'), false);
  assert.equal(ean13Valid('893456789012'), false);
  assert.equal(ean13Valid('89345678901a0'), false);
  assert.equal(gs1Country('8934567890120'), 'Việt Nam');
  assert.equal(gs1Country('8850000001468'), 'Thái Lan');
});

test('M18: fridge needs a token; starter demo fridge is per user, 4 compartments, ≤48 h alert', async () => {
  const store = createInitialStore();
  assert.equal((await handleApiRequest(store, 'GET', '/api/v1/fridge/inventory', q())).status, 401);
  const a = await guest(store), b = await guest(store);
  const r = await api(store, a, 'GET', '/api/v1/fridge/inventory');
  assert.equal(r.status, 200);
  assert.equal(r.data.is_demo, true);
  assert.ok(r.data.total_items >= 5);
  assert.deepEqual(Object.keys(r.data.by_compartment).sort(), ['chill', 'door', 'freeze', 'vegetable']);
  for (const it of r.data.items) assert.equal(it.is_expiring_soon, Date.parse(it.expires_at) - Date.now() <= 48 * 3600000);
  assert.equal(r.data.expiring_soon_count, r.data.items.filter(i => i.is_expiring_soon).length);
  assert.ok(r.data.expiring_soon_count >= 2);
  // contract rows: module M18, kind item, owner = user, data fields
  const rows = await moduleStore(getRepository(store)).list('M18', 'item', { ownerId: a.user.id });
  assert.equal(rows.length, r.data.total_items);
  for (const row of rows) {
    assert.ok(['chill', 'freeze', 'door', 'vegetable'].includes(row.compartment));
    assert.equal(typeof row.quantity, 'number');
    assert.ok(row.unit && row.name && !Number.isNaN(Date.parse(row.expires_at)));
    assert.ok('barcode' in row);
  }
  // opening twice does not copy the starter fridge again
  assert.equal((await api(store, a, 'GET', '/api/v1/fridge/inventory')).data.total_items, r.data.total_items);
  const fb = await api(store, b, 'GET', '/api/v1/fridge/inventory?compartment=freeze');
  assert.ok(fb.data.items.every(i => i.compartment === 'freeze'));
  assert.equal((await api(store, b, 'GET', '/api/v1/fridge/inventory?compartment=attic')).status, 400);
});

test('M18: add / edit / consume / delete with validation and ownership', async () => {
  const store = createInitialStore();
  const a = await guest(store), b = await guest(store);
  assert.equal((await api(store, a, 'POST', '/api/v1/fridge/inventory', { name: 'x' })).status, 400);
  assert.equal((await api(store, a, 'POST', '/api/v1/fridge/inventory', { name: 'Thịt heo', compartment: 'oven' })).status, 400);
  assert.equal((await api(store, a, 'POST', '/api/v1/fridge/inventory', { name: 'Thịt heo', quantity: -1 })).status, 400);
  assert.equal((await api(store, a, 'POST', '/api/v1/fridge/inventory', { name: 'Thịt heo', expires_at: 'mai' })).status, 400);
  const add = await api(store, a, 'POST', '/api/v1/fridge/inventory', { name: '<b>Trứng vịt</b>', quantity: 4, unit: 'quả', compartment: 'door', expires_in_days: 6 });
  assert.equal(add.status, 201);
  assert.equal(add.data.name, 'Trứng vịt');
  assert.equal(add.data.is_expiring_soon, false);
  const id = add.data.id;
  assert.equal((await api(store, b, 'PATCH', `/api/v1/fridge/inventory/${id}`, { name: 'Bị sửa' })).status, 403);
  assert.equal((await api(store, b, 'DELETE', `/api/v1/fridge/inventory/${id}`)).status, 403);
  assert.equal((await api(store, a, 'PATCH', '/api/v1/fridge/inventory/NOPE', { name: 'abc' })).status, 404);
  const ed = await api(store, a, 'PATCH', `/api/v1/fridge/inventory/${id}`, { expires_in_days: 1, compartment: 'chill' });
  assert.equal(ed.data.is_expiring_soon, true);
  assert.equal(ed.data.compartment, 'chill');
  const c1 = await api(store, a, 'POST', `/api/v1/fridge/inventory/${id}/consume`, { amount: 1 });
  assert.equal(c1.data.remaining, 3);
  assert.equal((await api(store, a, 'POST', `/api/v1/fridge/inventory/${id}/consume`, { amount: 0 })).status, 400);
  const c2 = await api(store, a, 'POST', `/api/v1/fridge/inventory/${id}/consume`, { amount: 'all' });
  assert.equal(c2.data.removed, true);
  assert.equal((await api(store, a, 'DELETE', `/api/v1/fridge/inventory/${id}`)).status, 404);
});

test('M18: barcode lookup, scan known product, unknown barcode must be named', async () => {
  const store = createInitialStore();
  const a = await guest(store);
  assert.equal((await api(store, a, 'GET', '/api/v1/fridge/barcode/8934567890123')).status, 400);
  const k = await api(store, a, 'GET', '/api/v1/fridge/barcode/8934567890120');
  assert.equal(k.data.found, true);
  assert.equal(k.data.is_vietnam, true);
  assert.equal(k.data.product.compartment, 'chill');
  const u = await api(store, a, 'GET', '/api/v1/fridge/barcode/8934567890991');
  assert.equal(u.data.found, false);
  assert.equal(u.data.needs_name, true);
  assert.equal((await api(store, a, 'POST', '/api/v1/fridge/scan', { barcode: '8934567890123' })).status, 400);
  assert.equal((await api(store, a, 'POST', '/api/v1/fridge/scan', { barcode: '8934567890991' })).status, 422);
  const s1 = await api(store, a, 'POST', '/api/v1/fridge/scan', { barcode: '8934567890120' });
  assert.equal(s1.status, 200);
  assert.equal(s1.data.scanned_item.name, 'Sữa chua uống men sống Probi');
  assert.equal(s1.data.scanned_item.expires_in_days, 5);
  assert.equal(s1.data.scanned_item.barcode, '8934567890120');
  const s2 = await api(store, a, 'POST', '/api/v1/fridge/scan', { barcode: '8934567890991', item_name: 'Chả lụa nhà làm', expires_in_days: 2, compartment: 'chill' });
  assert.equal(s2.data.scanned_item.name, 'Chả lụa nhà làm');
  assert.equal(s2.data.found, false);
});

test('M18: suggestions come from catalogue dishes that use fridge items, allergy filter applied', async () => {
  const store = createInitialStore();
  const a = await guest(store);
  const all = await api(store, a, 'GET', '/api/v1/fridge/suggestions');
  assert.ok(all.data.items.length > 0);
  for (const s of all.data.items) { assert.match(s.dish_id, /^DISH-/); assert.ok(s.matched.length > 0); }
  assert.ok(all.data.items.some(s => s.dish_id === 'DISH-106'), 'bún riêu uses đậu hũ');
  await handleApiRequest(store, 'PUT', '/api/v1/me/profile', q(), { hard_allergies: ['shrimp', 'fish'] }, a.headers);
  const safe = await api(store, a, 'GET', '/api/v1/fridge/suggestions');
  const dishes = store.dishes;
  for (const s of safe.data.items) {
    const d = dishes.find(x => x.id === s.dish_id);
    assert.ok(!d.allergen_tags.some(t => ['shrimp', 'fish'].includes(t)), `${s.dish_id} must be allergy-safe`);
  }
  assert.ok(!safe.data.items.some(s => s.dish_id === 'DISH-106'));
  const inv = await api(store, a, 'GET', '/api/v1/fridge/inventory');
  assert.ok(!inv.data.suggestion || !['DISH-106', 'DISH-110'].includes(inv.data.suggestion.dish_id));
});

test('M18: PDPD — fridge rows are exported and deleted with the account', async () => {
  const store = createInitialStore();
  const a = await guest(store);
  await api(store, a, 'GET', '/api/v1/fridge/inventory');
  const ex = await handleApiRequest(store, 'GET', '/api/v1/me/export', q(), {}, a.headers);
  assert.equal(ex.status, 200);
  assert.ok(JSON.stringify(ex.data).includes('Đậu hũ non'));
  await handleApiRequest(store, 'DELETE', '/api/v1/me', q(), {}, a.headers);
  assert.equal((store.moduleRecords || []).filter(r => r.owner_id === a.user.id).length, 0);
});

test('UI: M18/M19/M20 live files register every screen and replace the desktop tab functions', async () => {
  const fs = await import('node:fs');
  const vm = await import('node:vm');
  const window = {};
  const ctx = vm.createContext({ window, document: {}, console });
  vm.runInContext(fs.readFileSync('ui-design/src/live_modules.js', 'utf8'), ctx);
  for (const m of ['m18', 'm19', 'm20']) vm.runInContext(fs.readFileSync(`ui-design/src/live/${m}.js`, 'utf8'), ctx);
  const mods = window.TOV_LIVE.modules;
  assert.deepEqual(Object.keys(mods.M18.screens), ['M18-S01', 'M18-S02']);
  assert.deepEqual(Object.keys(mods.M19.screens), ['M19-S01', 'M19-S02']);
  assert.deepEqual(Object.keys(mods.M20.screens), ['M20-S01', 'M20-S02']);
  assert.deepEqual(Object.keys(mods.M18.fns).sort(), ['loadLiveFridge', 'scanLiveFridgeItem']);
  assert.deepEqual(Object.keys(mods.M19.fns).sort(), ['loadLiveHealth', 'syncLiveWearable']);
  assert.deepEqual(Object.keys(mods.M20.fns).sort(), ['loadLiveCommunity', 'openLiveCreateRecipeModal', 'tipLiveRecipe']);
  // UI never posts invented sample numbers (the legacy loaders hard-coded 9,240 steps / Probi barcode)
  for (const m of ['m18', 'm19', 'm20']) {
    const src = fs.readFileSync(`ui-design/src/live/${m}.js`, 'utf8');
    assert.doesNotMatch(src, /9240|8934567890123|2,330|Chef Hưng/);
  }
});
