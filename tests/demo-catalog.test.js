// Demo catalogue (docs/DEMO_CATALOG.md): data integrity, memory import, idempotency, removal.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInitialStore } from '../src/data/seed.js';
import { DEMO_CATALOG_ROWS } from '../src/data/demoCatalogData.js';
import { applyDemoCatalog, removeDemoCatalog, demoCatalogEnabled, demoCatalogDishes, DEMO_MENU_LINKS } from '../src/data/demoCatalog.js';
import { removeVietnameseTones } from '../src/services/textUtils.js';
import { registerDemoCatalogTests, ALLERGENS } from './contracts/demoCatalog.js';

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const list = s => (s ? s.split(';') : []);

test('CSV (docs/data) and the data module are the same 146 rows', () => {
  const csv = parseCsv(fs.readFileSync(new URL('../docs/data/demo-catalog-dishes-drinks.csv', import.meta.url), 'utf8'));
  assert.equal(csv.length, DEMO_CATALOG_ROWS.length);
  csv.forEach((c, i) => {
    const r = DEMO_CATALOG_ROWS[i];
    assert.deepEqual({ id: c.id, category: c.category, name: c.name, region: c.region, description: c.description,
      ingredients: list(c.ingredients), meal_slots: list(c.meal_slots), is_soup: c.is_soup === '' ? null : c.is_soup === 'true',
      spice_level: Number(c.spice_level), allergen_tags: list(c.allergen_flags), diet_flags: list(c.diet_flags),
      price_min_vnd: Number(c.price_min_vnd), price_max_vnd: Number(c.price_max_vnd), ref_price: Number(c.estimated_price_vnd),
      price_basis: c.price_basis, price_source_url: c.price_source_url || null, calories: Number(c.calories),
      weather_fit: list(c.weather_fit), tags: list(c.tags), source_url: c.source_url },
    r, c.id);
    assert.equal(c.is_demo, 'true');
    assert.equal(c.calories_is_estimate, 'true');
    assert.equal(c.unaccented_name, removeVietnameseTones(c.name), c.id);
  });
});

test('demo rows: 106 dishes + 40 drinks, distinct ids, valid vocabulary, sources, conservative allergens', () => {
  const seedIds = new Set(createInitialStore().dishes.map(d => d.id));
  const ids = DEMO_CATALOG_ROWS.map(r => r.id);
  assert.equal(new Set(ids).size, 146);
  assert.equal(DEMO_CATALOG_ROWS.filter(r => r.category === 'dish').length, 106);
  assert.equal(DEMO_CATALOG_ROWS.filter(r => r.category === 'drink').length, 40);
  for (const r of DEMO_CATALOG_ROWS) {
    assert.ok(!seedIds.has(r.id));
    assert.match(r.id, r.category === 'drink' ? /^DISH-DR\d{3}$/ : /^DISH-D\d{3}$/);
    assert.ok(['bac', 'trung', 'nam', 'toan_quoc'].includes(r.region), r.id);
    assert.ok(r.meal_slots.length && r.meal_slots.every(m => ['breakfast', 'lunch', 'dinner', 'snack', 'late_night'].includes(m)), r.id);
    assert.ok(r.allergen_tags.every(a => ALLERGENS.includes(a)), r.id);
    assert.ok(r.diet_flags.every(f => ['vegan', 'vegetarian'].includes(f)), r.id);
    if (r.diet_flags.includes('vegan')) {
      assert.ok(r.diet_flags.includes('vegetarian'), r.id);
      assert.ok(!r.allergen_tags.some(a => ['dairy', 'egg', 'fish', 'shrimp', 'shrimp_paste', 'shellfish'].includes(a)), r.id);
    }
    if (r.allergen_tags.includes('shrimp')) assert.ok(r.allergen_tags.includes('shellfish'), r.id);
    if (r.allergen_tags.includes('shrimp_paste')) assert.ok(r.allergen_tags.includes('shrimp'), r.id);
    assert.ok(Number.isInteger(r.spice_level) && r.spice_level >= 0 && r.spice_level <= 3, r.id);
    assert.ok(r.price_min_vnd > 0 && r.price_min_vnd <= r.ref_price && r.ref_price <= r.price_max_vnd, r.id);
    assert.match(r.source_url, /^https:\/\//, r.id);
    if (r.price_basis === 'source') assert.match(r.price_source_url, /^https:\/\//, r.id);
    else assert.equal(r.price_basis, 'estimate');
    // Ingredient words that name an allergen must carry its tag.
    for (const ing of r.ingredients.map(i => i.toLowerCase())) for (const [re, tag] of [
      [/(^|[^\p{L}])tôm([^\p{L}]|$)/u, 'shrimp'], [/mắm tôm|mắm ruốc|ruốc huế/u, 'shrimp_paste'], [/(^|[^\p{L}])(cua|mực|hến|ốc)([^\p{L}]|$)|dầu hào/u, 'shellfish'],
      [/đậu phộng|(^|[^\p{L}])lạc([^\p{L}]|$)/u, 'peanut'], [/trứng|hột vịt/u, 'egg'], [/sữa|(^|[^\p{L}])bơ([^\p{L}]|$)|kem sữa/u, 'dairy'],
      [/đậu hũ|đậu phụ|tàu hũ|nước tương|xì dầu|đậu nành/u, 'soy'], [/bột mì|bánh mì|quẩy|xì dầu|nước tương|tương đen/u, 'gluten'],
      [/nước mắm|mắm nêm|mắm cá|(^|[^\p{L}])cá([^\p{L}]|$)|lươn/u, 'fish']
    ]) if (re.test(ing) && !(tag === 'dairy' && /bơ sáp/.test(ing))) assert.ok(r.allergen_tags.includes(tag), `${r.id} ${r.name}: "${ing}" needs ${tag}`);
  }
  // all three regions are covered for dishes
  for (const reg of ['bac', 'trung', 'nam']) assert.ok(DEMO_CATALOG_ROWS.filter(r => r.category === 'dish' && r.region === reg).length >= 25, reg);
});

test('SEED_DEMO_CATALOG: on by default, only "false" turns it off', () => {
  assert.equal(demoCatalogEnabled({}), true);
  assert.equal(demoCatalogEnabled({ SEED_DEMO_CATALOG: 'true' }), true);
  assert.equal(demoCatalogEnabled({ SEED_DEMO_CATALOG: 'false' }), false);
  assert.equal(demoCatalogEnabled({ SEED_DEMO_CATALOG: ' FALSE ' }), false);
});

test('memory import is idempotent and removal restores the original catalogue exactly', () => {
  const original = createInitialStore();
  const store = createInitialStore();
  assert.deepEqual(applyDemoCatalog(store), { dishes: 146, links: DEMO_MENU_LINKS.length });
  assert.deepEqual(applyDemoCatalog(store), { dishes: 0, links: 0 });
  assert.equal(store.dishes.length, 158);
  for (const l of DEMO_MENU_LINKS) {
    const place = store.places.find(p => p.id === l.place_id);
    assert.ok(place.menu.some(m => m.dish_id === l.dish_id && m.is_demo === true && m.price === l.price));
    const row = DEMO_CATALOG_ROWS.find(r => r.id === l.dish_id);
    assert.ok(l.price >= row.price_min_vnd && l.price <= row.price_max_vnd, l.dish_id);
  }
  // Demo rows have no recipe steps, so the shared gate never offers them as home cooking.
  assert.ok(demoCatalogDishes().every(d => d.steps.length === 0 && d.is_demo === true));
  assert.equal(removeDemoCatalog(store), 146);
  assert.deepEqual(store.dishes, original.dishes);
  assert.deepEqual(store.places, original.places);
});

const demoStore = createInitialStore();
applyDemoCatalog(demoStore);
registerDemoCatalogTests(test, () => demoStore);
