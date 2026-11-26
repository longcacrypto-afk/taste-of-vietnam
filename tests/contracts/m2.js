import assert from 'node:assert/strict';
import { handleApiRequest } from '../../src/api/router.js';
import { getRepository } from '../../src/db/repository.js';

export function registerM2Tests(test, getStore, options = {}) {
  const api = (method, path, { body = {}, query = {}, headers = {} } = {}) =>
    handleApiRequest(getStore(), method, path, new URLSearchParams(query), body, headers);
  const guest = async () => {
    const r = await api('POST', '/api/v1/auth/guest');
    assert.equal(r.status, 200);
    return { authorization: `Bearer ${r.data.access_token}` };
  };
  const t = (name, fn) => test(`M2 contract: ${name}`, options, fn);
  const root = '/api/v1/me/collections';

  t('accent/case/token insensitive search and no-match returns empty', async () => {
    for (const q of ['pho bo', 'PHỞ BÒ', 'bo pho', 'PHO\u0309 BO\u0300']) {
      const r = await api('GET', '/api/v1/dishes', { query: { q, safe_only: 'false' } });
      assert.equal(r.status, 200);
      assert.ok(r.data.items.some(d => d.id === 'DISH-101'), q);
    }
    const no = await api('GET', '/api/v1/dishes', { query: { q: 'khonghecotrongkhomon' } });
    assert.equal(no.data.total, 0);
    assert.deepEqual(no.data.items, []);
  });
  t('filters compose; enums/prices/page validation is strict', async () => {
    for (const query of [
      { region: 'foo' }, { meal_slot: 'brunch' }, { diet: 'unknown' }, { budget_max: '-1' },
      { budget_max: 'abc' }, { budget_max: '1e9' }, { budget_min: '10', budget_max: '9' },
      { page: '0' }, { page: '1.5' }, { limit: '101' }, { safe_only: 'yes' }
    ]) assert.equal((await api('GET', '/api/v1/dishes', { query })).status, 400, JSON.stringify(query));
    const repo = getRepository(getStore());
    const dish = { ...structuredClone(await repo.getDish('DISH-101')), id: 'DISH-M2-FILTER',
      region: 'nam', meal_slots: ['lunch'], diet_flags: ['vegan'], ref_price: 12345, allergen_tags: [] };
    await repo.createDish(dish);
    const r = await api('GET', '/api/v1/dishes', { query: {
      region: 'nam', meal_slot: 'lunch', diet: 'vegetarian', budget_min: '12345', budget_max: '12345'
    } });
    assert.deepEqual(r.data.items.map(d => d.id), [dish.id]);
    await repo.deleteDish(dish.id);
  });
  t('pagination is stable, totals describe pre-page results, beyond last page is empty', async () => {
    const all = await api('GET', '/api/v1/dishes', { query: { safe_only: 'false', limit: '100' } });
    const ids = [];
    for (let page = 1; page <= 6; page++) {
      const r = await api('GET', '/api/v1/dishes', { query: { safe_only: 'false', limit: '2', page: String(page) } });
      assert.equal(r.data.total, all.data.total);
      assert.equal(r.data.total_pages, 6);
      ids.push(...r.data.items.map(d => d.id));
    }
    assert.deepEqual(ids, all.data.items.map(d => d.id));
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual((await api('GET', '/api/v1/dishes', { query: { page: '100' } })).data.items, []);
  });
  t('category counts reflect catalogue additions/deletions, not mock counts', async () => {
    const query = { safe_only: 'false' };
    const before = (await api('GET', '/api/v1/dishes/categories', { query })).data;
    const repo = getRepository(getStore());
    const d = { ...structuredClone(await repo.getDish('DISH-101')), id: 'DISH-M2-COUNT', meal_slots: ['breakfast'], diet_flags: ['vegan'] };
    await repo.createDish(d);
    const after = (await api('GET', '/api/v1/dishes/categories', { query })).data;
    assert.equal(after.total, before.total + 1);
    for (const id of ['breakfast', 'vegan']) assert.equal(
      after.categories.find(c => c.id === id).count, before.categories.find(c => c.id === id).count + 1);
    await repo.deleteDish(d.id);
    assert.deepEqual((await api('GET', '/api/v1/dishes/categories', { query })).data, before);
  });
  t('invalid ID is 404 for detail, ingredients, story, similar and variants', async () => {
    for (const suffix of ['', '/ingredients', '/story', '/similar', '/regional-variants']) {
      assert.equal((await api('GET', `/api/v1/dishes/DISH-NOT-REAL${suffix}`)).status, 404, suffix);
    }
    assert.equal((await api('GET', '/api/v1/stories/DISH-NOT-REAL')).status, 404);
  });
  t('servings 1/2/4/10 scale recipe but nutrition is per serving', async () => {
    const base = await getRepository(getStore()).getDish('DISH-101');
    for (const n of [1, 2, 4, 10]) {
      const r = await api('GET', '/api/v1/dishes/DISH-101', { query: { servings: String(n) } });
      assert.equal(r.status, 200);
      assert.equal(r.data.requested_servings, n);
      assert.equal(r.data.scaled_ingredients[0].scaled_amount, 350 * n / 2);
      assert.equal(r.data.scaled_calories_total, base.calories * n);
      assert.equal(r.data.scaled_macros_total.protein, base.macros.protein * n);
      assert.equal(r.data.nutrition_basis, 'per_serving');
    }
  });
  t('invalid servings reject instead of clamp/parseInt', async () => {
    for (const servings of ['0', '-1', 'abc', '1e9', '11', '1.5', '2foo', '', ' 2', '02']) {
      assert.equal((await api('GET', '/api/v1/dishes/DISH-101', { query: { servings } })).status, 400, servings);
    }
  });
  t('small quantities survive rounding; ingredients alias preserves dish identity', async () => {
    const repo = getRepository(getStore());
    const d = { ...structuredClone(await repo.getDish('DISH-101')), id: 'DISH-M2-TINY',
      ingredients: [
        { name: 'A', unit: 'g', amount: 0.5 }, { name: 'B', unit: 'ml', amount: 0.25 },
        { name: 'C', unit: 'thìa', amount: 0.25 }, { name: 'D', unit: 'lít', amount: 0.0001 }
      ] };
    await repo.createDish(d);
    const r = await api('GET', `/api/v1/dishes/${d.id}/ingredients`, { query: { servings: '1' } });
    assert.equal(r.data.id, d.id);
    assert.deepEqual(r.data.scaled_ingredients.map(i => i.scaled_amount), [0.25, 0.13, 0.125, 0.00005]);
    assert.ok(r.data.steps.length);
    await repo.deleteDish(d.id);
  });
  t('personal collections require authentication', async () => {
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE'])
      assert.equal((await api(method, root)).status, 401);
  });
  t('collection CRUD uses opaque ID and validates names', async () => {
    const headers = await guest();
    for (const name of ['', ' ', 23, '<b></b>', 'x'.repeat(81)])
      assert.equal((await api('POST', root, { headers, body: { name } })).status, 400);
    const c = await api('POST', root, { headers, body: { name: 'Bữa sáng' } });
    assert.equal(c.status, 201);
    const id = c.data.collection.id;
    assert.ok(id.startsWith('col-'));
    assert.equal((await api('GET', `${root}/${id}`, { headers })).data.collection.name, 'Bữa sáng');
    assert.equal((await api('PATCH', `${root}/${id}`, { headers, body: { name: 'Cuối tuần' } })).data.collection.name, 'Cuối tuần');
    assert.equal((await api('DELETE', `${root}/${id}`, { headers })).status, 200);
    assert.equal((await api('GET', `${root}/${id}`, { headers })).status, 404);
  });
  t('collection items validate dish existence, are idempotent, and can be removed', async () => {
    const headers = await guest();
    const id = (await api('POST', root, { headers, body: { name: 'A' } })).data.collection.id;
    for (const dish_id of [undefined, '', {}, 123])
      assert.equal((await api('POST', `${root}/${id}/dishes`, { headers, body: { dish_id } })).status, 400);
    assert.equal((await api('POST', `${root}/${id}/dishes`, { headers, body: { dish_id: 'DISH-MISSING' } })).status, 404);
    for (let n = 0; n < 2; n++)
      assert.equal((await api('POST', `${root}/${id}/dishes`, { headers, body: { dish_id: 'DISH-101' } })).status, 200);
    assert.deepEqual((await api('GET', `${root}/${id}`, { headers })).data.collection.dish_ids, ['DISH-101']);
    assert.equal((await api('DELETE', `${root}/${id}/dishes/DISH-101`, { headers })).status, 200);
    assert.deepEqual((await api('GET', `${root}/${id}`, { headers })).data.collection.dish_ids, []);
  });
  t('another user cannot read/rename/delete/save to collection', async () => {
    const a = await guest(), b = await guest();
    const id = (await api('POST', root, { headers: a, body: { name: 'Private' } })).data.collection.id;
    for (const [method, suffix, body] of [
      ['GET', '', {}], ['PATCH', '', { name: 'Hacked' }], ['DELETE', '', {}],
      ['POST', '/dishes', { dish_id: 'DISH-101' }], ['DELETE', '/dishes/DISH-101', {}]
    ]) assert.equal((await api(method, `${root}/${id}${suffix}`, { headers: b, body })).status, 404);
    assert.equal((await api('GET', `${root}/${id}`, { headers: a })).data.collection.name, 'Private');
  });
  t('legacy default save/remove remains compatible and rejects nonexistent dish', async () => {
    const headers = await guest();
    assert.equal((await api('POST', root, { headers, body: { dish_id: 'DISH-MISSING' } })).status, 404);
    await api('POST', root, { headers, body: { dish_id: 'DISH-101' } });
    const saved = await api('POST', root, { headers, body: { dish_id: 'DISH-102' } });
    assert.deepEqual(saved.data.collections[0].dish_ids, ['DISH-101', 'DISH-102']);
    const removed = await api('DELETE', `${root}/DISH-101`, { headers });
    assert.deepEqual(removed.data.collections[0].dish_ids, ['DISH-102']);
  });
  t('simultaneous first saves do not lose dishes or duplicate default collection', async () => {
    const headers = await guest();
    const ids = (await getRepository(getStore()).listDishes()).map(d => d.id);
    const responses = await Promise.all(ids.map(dish_id => api('POST', root, { headers, body: { dish_id } })));
    for (const r of responses) assert.equal(r.status, 200);
    const cols = (await api('GET', root, { headers })).data.collections;
    assert.equal(cols.length, 1);
    assert.deepEqual([...cols[0].dish_ids].sort(), ids.sort());
  });
  t('simultaneous collection adds preserve both items and name', async () => {
    const headers = await guest();
    const id = (await api('POST', root, { headers, body: { name: 'A' } })).data.collection.id;
    const results = await Promise.all([
      api('POST', `${root}/${id}/dishes`, { headers, body: { dish_id: 'DISH-101' } }),
      api('POST', `${root}/${id}/dishes`, { headers, body: { dish_id: 'DISH-102' } }),
      api('PATCH', `${root}/${id}`, { headers, body: { name: 'B' } })
    ]);
    for (const r of results) assert.equal(r.status, 200);
    const c = (await api('GET', `${root}/${id}`, { headers })).data.collection;
    assert.equal(c.name, 'B');
    assert.deepEqual([...c.dish_ids].sort(), ['DISH-101', 'DISH-102']);
  });
  t('removing dish clears saved references for all users; concurrent saves cannot revive it', async () => {
    const repo = getRepository(getStore());
    const original = await repo.getDish('DISH-101');
    const a = await guest(), b = await guest();
    await api('POST', root, { headers: a, body: { dish_id: original.id } });
    await api('POST', root, { headers: b, body: { dish_id: original.id } });
    await Promise.all([
      repo.deleteDish(original.id),
      api('POST', root, { headers: a, body: { dish_id: 'DISH-102' } }),
      api('POST', root, { headers: b, body: { dish_id: original.id } })
    ]);
    for (const headers of [a, b]) {
      const cols = (await api('GET', root, { headers })).data.collections;
      assert.ok(cols.every(c => !c.dish_ids.includes(original.id)));
    }
    await repo.createDish(original);
  });
}
