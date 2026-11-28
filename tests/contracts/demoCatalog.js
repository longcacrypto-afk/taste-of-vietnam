// Shared API contract for the removable demo catalogue (memory + PostgreSQL).
import assert from 'node:assert/strict';
import { handleApiRequest } from '../../src/api/router.js';
import { DEMO_CATALOG_ROWS } from '../../src/data/demoCatalogData.js';

export const ALLERGENS = ['shrimp', 'peanut', 'shrimp_paste', 'dairy', 'egg', 'gluten', 'fish', 'soy', 'shellfish'];
export const ALLERGY_SETS = [...ALLERGENS.map(a => [a]), ['shrimp', 'peanut'], ['fish', 'soy', 'gluten'],
  ['dairy', 'egg'], ['shellfish', 'shrimp_paste'], ALLERGENS];

export function registerDemoCatalogTests(test, getStore, options = {}) {
  const api = (method, path, { body = {}, query = {}, headers = {} } = {}) =>
    handleApiRequest(getStore(), method, path, new URLSearchParams(query), body, headers);
  const guestWith = async (patch) => {
    const r = await api('POST', '/api/v1/auth/guest');
    const headers = { authorization: `Bearer ${r.data.access_token}` };
    if (patch) assert.equal((await api('PATCH', '/api/v1/me/profile', { body: patch, headers })).status, 200);
    return headers;
  };
  const allDishes = async (headers, query = {}) => {
    const out = [];
    for (let page = 1; ; page++) {
      const r = await api('GET', '/api/v1/dishes', { query: { limit: '100', page: String(page), ...query }, headers });
      assert.equal(r.status, 200);
      out.push(...r.data.items);
      if (page >= r.data.total_pages) return out;
    }
  };
  const t = (name, fn) => test(`Demo catalogue contract: ${name}`, options, fn);

  t('all 146 demo rows are listed, flagged is_demo, original rows are not flagged', async () => {
    const items = await allDishes(await guestWith(), { safe_only: 'false' });
    const demo = items.filter(d => d.is_demo === true);
    assert.equal(demo.length, 146);
    assert.equal(demo.filter(d => d.category === 'drink').length, 40);
    assert.deepEqual(new Set(demo.map(d => d.id)), new Set(DEMO_CATALOG_ROWS.map(r => r.id)));
    for (const d of items.filter(d => /^DISH-1\d\d$/.test(d.id))) {
      assert.equal(d.is_demo, undefined, d.id);
      assert.equal(d.category, undefined, d.id);
    }
    const detail = await api('GET', '/api/v1/dishes/DISH-D001', { headers: await guestWith() });
    assert.equal(detail.status, 200);
    assert.equal(detail.data.is_demo, true);
    assert.deepEqual(detail.data.allergen_tags, DEMO_CATALOG_ROWS[0].allergen_tags);
    assert.equal(detail.data.steps.length, 0, 'no invented recipe steps');
  });

  t('drinks are searchable in M2 (accent-insensitive)', async () => {
    const headers = await guestWith();
    for (const q of ['cà phê sữa đá', 'ca phe sua da', 'BẠC XỈU', 'nuoc mia']) {
      const r = await api('GET', '/api/v1/dishes', { query: { q, safe_only: 'false' }, headers });
      assert.ok(r.data.items.some(d => d.category === 'drink' && d.is_demo === true), q);
    }
  });

  t('hard allergy filter stays exact on demo rows (search + every meal suggestion)', async () => {
    for (const set of ALLERGY_SETS) {
      const headers = await guestWith({ hard_allergies: set });
      const listed = await allDishes(headers);
      for (const d of listed) assert.ok(!(d.allergen_tags || []).some(a => set.includes(a)), `${d.id} leaked for ${set}`);
      // Nothing safe is over-blocked: each demo row without those allergens is listed.
      const ids = new Set(listed.map(d => d.id));
      for (const r of DEMO_CATALOG_ROWS.filter(r => !r.allergen_tags.some(a => set.includes(a)))) assert.ok(ids.has(r.id), `${r.id} missing for ${set}`);
      for (const meal_slot of ['breakfast', 'lunch', 'dinner', 'snack']) for (const diet_mode of [undefined, 'vegan']) {
        const query = { meal_slot, budget_max: '1000000', ...(diet_mode ? { diet_mode } : {}) };
        const r = await api('GET', '/api/v1/suggestions/today', { query, headers });
        assert.equal(r.status, 200, JSON.stringify(r.data));
        for (const it of r.data.items) {
          assert.ok(!(it.allergen_tags || []).some(a => set.includes(a)), `${it.dish_id} suggested for ${set}`);
          assert.ok(!it.dish_id.startsWith('DISH-DR'), `drink ${it.dish_id} suggested as a meal`);
        }
      }
    }
  });

  t('demo dishes linked to plausible demo places can be suggested and carry is_demo', async () => {
    const headers = await guestWith({ diet_mode: 'vegan' });
    const r = await api('GET', '/api/v1/suggestions/today', { query: { meal_slot: 'lunch', budget_max: '1000000' }, headers });
    assert.equal(r.status, 200);
    const demo = r.data.items.filter(i => i.is_demo === true);
    assert.ok(demo.length > 0, JSON.stringify(r.data.items.map(i => i.dish_id)));
    for (const i of demo) assert.equal(i.nearest_place?.place_id, 'PLACE-407');
  });
}
