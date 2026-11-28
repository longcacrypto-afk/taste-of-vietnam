// Backend only; existing UI hooks and compatibility aliases are documented in docs/M2_API.md.
import { randomUUID } from 'node:crypto';
import { parseDishQuery, filterDishes, scaleDish, fail, notFound } from '../services/dishContract.js';

export async function handleDishRoutes({ repo, method, pathname, searchParams, body, userId, profile, openPlaces, bump, cleanText }) {
  if (pathname === '/api/v1/dishes/categories' && method === 'GET') {
    const f = parseDishQuery(searchParams);
    if (!f) return fail(400, 'Bộ lọc không hợp lệ');
    const dishes = filterDishes(await repo.listDishes(), f, profile);
    const categories = [
      ['breakfast', 'Bữa sáng', '#FEF3C7', d => (d.meal_slots || []).includes('breakfast')],
      ['lunch', 'Cơm trưa', '#DCFCE7', d => (d.meal_slots || []).includes('lunch')],
      ['dinner', 'Bữa tối', '#EDE9FE', d => (d.meal_slots || []).includes('dinner')],
      ['snacks', 'Ăn vặt', '#FFE4E6', d => (d.meal_slots || []).includes('snack')],
      ['vegan', 'Món chay', '#FCE7F3', d => (d.diet_flags || []).includes('vegan')]
    ].map(([id, name, color, predicate]) => ({ id, name, color, count: dishes.filter(predicate).length }));
    return { status: 200, data: { total: dishes.length, categories, regions: ['Miền Bắc', 'Miền Trung', 'Miền Nam'],
      region_options: [{ id: 'bac', name: 'Miền Bắc' }, { id: 'trung', name: 'Miền Trung' }, { id: 'nam', name: 'Miền Nam' }] } };
  }
  if (pathname === '/api/v1/dishes' && method === 'GET') {
    const f = parseDishQuery(searchParams);
    if (!f) return fail(400, 'Bộ lọc không hợp lệ');
    const items = filterDishes(await repo.listDishes(), f, profile);
    const offset = (f.page - 1) * f.limit;
    return { status: 200, data: { total: items.length, page: f.page, limit: f.limit,
      total_pages: Math.ceil(items.length / f.limit), items: items.slice(offset, offset + f.limit) } };
  }
  // /ingredients is the existing screen's advertised alias; it returns the same
  // recipe detail contract so clients never need to reconstruct scaling.
  const detail = pathname.match(/^\/api\/v1\/dishes\/([^/]+)(?:\/ingredients)?$/);
  if (detail && detail[1] !== 'semantic-search' && method === 'GET') {
    const dish = await repo.getDish(detail[1]);
    if (!dish) return notFound();
    const data = scaleDish(dish, searchParams.get('servings'));
    if (!data) return fail(400, 'Khẩu phần phải là số nguyên từ 1 đến 10');
    data.open_places = await openPlaces(dish.id);
    bump('dish_view');
    return { status: 200, data };
  }

  const root = '/api/v1/me/collections';
  if (pathname !== root && !pathname.startsWith(root + '/')) return null;
  const parts = pathname.slice(root.length).split('/').filter(Boolean);
  let op;
  let status = 200;
  if (method === 'GET' && parts.length <= 1) {
    // dish_count (M2-S08 "N món" chip): dishes of the collection that still exist in the catalogue.
    const known = new Set((await repo.listDishes()).map(d => d.id));
    const collections = (await repo.listCollections(userId)).map(c => ({ ...c,
      dish_count: (c.dish_ids || []).filter(id => known.has(id)).length }));
    if (!parts.length) return { status: 200, data: { collections } };
    const collection = collections.find(c => c.id === parts[0]);
    return collection ? { status: 200, data: { collection } } : notFound();
  }
  const name = typeof body.name === 'string' ? cleanText(body.name, 80) : '';
  if (method === 'POST' && !parts.length) {
    if (Object.hasOwn(body, 'dish_id')) op = { type: 'save_default', dishId: body.dish_id };
    else {
      if (!name || body.name.trim().length > 80) return fail(400, 'Tên bộ sưu tập cần 1–80 ký tự');
      op = { type: 'create', id: `col-${randomUUID()}`, name };
      status = 201;
    }
  } else if (parts.length === 1 && method === 'PATCH') {
    if (!name || body.name.trim().length > 80) return fail(400, 'Tên bộ sưu tập cần 1–80 ký tự');
    op = { type: 'rename', id: parts[0], name };
  } else if (parts.length === 1 && method === 'DELETE') {
    // Old UI removes a dish everywhere with DELETE /collections/DISH-xxx.
    // Collection IDs are server-generated col-UUID, so this alias is unambiguous.
    op = parts[0].startsWith('DISH-')
      ? { type: 'remove_everywhere', dishId: parts[0] } : { type: 'delete', id: parts[0] };
  } else if (parts.length === 2 && parts[1] === 'dishes' && method === 'POST') {
    op = { type: 'add', id: parts[0], dishId: body.dish_id };
  } else if (parts.length === 3 && parts[1] === 'dishes' && method === 'DELETE') {
    op = { type: 'remove', id: parts[0], dishId: parts[2] };
  } else return notFound();
  if (['save_default', 'add', 'remove', 'remove_everywhere'].includes(op.type) &&
    (typeof op.dishId !== 'string' || !op.dishId.trim() || op.dishId.length > 100)) {
    return fail(400, 'dish_id không hợp lệ');
  }
  const result = await repo.mutateCollection(userId, op);
  if (!result) return notFound();
  if (['save_default', 'add'].includes(op.type)) bump('save_dish');
  return { status, data: { ...result, ...(op.type === 'remove_everywhere' ? { removed: op.dishId } : {}) } };
}
