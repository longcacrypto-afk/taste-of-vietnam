// =============================================================================
// DEMO CATALOGUE (removable): 106 dishes + 40 drinks researched for demo use, plus a
// few menu links to the existing demo places. Everything here carries is_demo: true.
//   SEED_DEMO_CATALOG=false  → never loaded (memory) / never seeded (Postgres).
//   Removal (Postgres): DELETE FROM place_dishes WHERE is_demo; DELETE FROM dishes WHERE is_demo;
// See docs/DEMO_CATALOG.md.
// Drinks live in the dishes table with category 'drink' (ids DISH-DR…, so every
// existing DISH- id check — dislikes, routes — keeps working). They are searchable in
// M2 but never offered as a main-meal suggestion (src/services/candidatePipeline.js).
// =============================================================================
import { DEMO_CATALOG_ROWS } from './demoCatalogData.js';

/** Default on; only the exact string 'false' turns the demo catalogue off. */
export function demoCatalogEnabled(env = process.env) {
  return String(env.SEED_DEMO_CATALOG ?? '').trim().toLowerCase() !== 'false';
}

/**
 * Menu links to the existing demo places (src/data/seed.js), only where the place's
 * type plausibly sells the item; price = a value inside the item's researched range.
 */
export const DEMO_MENU_LINKS = [
  { place_id: 'PLACE-401', dish_id: 'DISH-D002', price: 50000 },   // Phở gia truyền → Phở gà Hà Nội
  { place_id: 'PLACE-401', dish_id: 'DISH-DR008', price: 5000 },   // trà đá
  { place_id: 'PLACE-402', dish_id: 'DISH-D060', price: 40000 },   // Cơm tấm → Thịt kho hột vịt
  { place_id: 'PLACE-402', dish_id: 'DISH-D059', price: 45000 },   // Cá kho tộ
  { place_id: 'PLACE-402', dish_id: 'DISH-D061', price: 20000 },   // Canh khổ qua nhồi thịt
  { place_id: 'PLACE-402', dish_id: 'DISH-DR008', price: 3000 },   // trà đá
  { place_id: 'PLACE-403', dish_id: 'DISH-D030', price: 30000 },   // Bún bò Huế → Bánh bèo chén Huế
  { place_id: 'PLACE-403', dish_id: 'DISH-D031', price: 30000 },   // Bánh nậm Huế
  { place_id: 'PLACE-403', dish_id: 'DISH-D032', price: 30000 },   // Bánh bột lọc Huế
  { place_id: 'PLACE-404', dish_id: 'DISH-D076', price: 45000 },   // Tiệm bánh mì → Bánh mì chảo
  { place_id: 'PLACE-404', dish_id: 'DISH-DR001', price: 20000 },  // Cà phê sữa đá
  { place_id: 'PLACE-404', dish_id: 'DISH-DR022', price: 10000 },  // Sữa đậu nành
  { place_id: 'PLACE-405', dish_id: 'DISH-D056', price: 50000 },   // Bánh canh cua
  { place_id: 'PLACE-406', dish_id: 'DISH-D057', price: 55000 },   // Bánh xèo → Bánh khọt Vũng Tàu
  { place_id: 'PLACE-407', dish_id: 'DISH-D085', price: 30000 },   // Cơm chay → Đậu hũ sốt cà chua chay
  { place_id: 'PLACE-407', dish_id: 'DISH-D087', price: 40000 },   // Phở chay
  { place_id: 'PLACE-407', dish_id: 'DISH-D089', price: 25000 },   // Gỏi cuốn chay
  { place_id: 'PLACE-407', dish_id: 'DISH-D091', price: 30000 },   // Nấm kho tiêu chay
  { place_id: 'PLACE-407', dish_id: 'DISH-D092', price: 25000 },   // Canh chua chay
  { place_id: 'PLACE-407', dish_id: 'DISH-D093', price: 35000 },   // Bún riêu chay
  { place_id: 'PLACE-408', dish_id: 'DISH-D035', price: 40000 },   // Mì Quảng → Mì Quảng tôm thịt
  { place_id: 'PLACE-408', dish_id: 'DISH-D034', price: 40000 },   // Cao lầu Hội An
  { place_id: 'PLACE-408', dish_id: 'DISH-D040', price: 35000 }    // Bún mắm nêm Đà Nẵng
];

/** Demo rows in the in-memory store shape (same keys as src/data/seed.js dishes). */
export function demoCatalogDishes() {
  return DEMO_CATALOG_ROWS.map(r => {
    const d = {
      id: r.id, name: r.name, category: r.category, is_demo: true, region: r.region,
      // Same fields Postgres stores, so memory and Postgres answer alike. The price range,
      // price basis, calorie-estimate flag and sources stay in the CSV / data module.
      meal_slots: [...r.meal_slots], ref_price: r.ref_price, calories: r.calories, spice_level: r.spice_level,
      allergen_tags: [...r.allergen_tags], diet_flags: [...r.diet_flags], weather_fit: [...r.weather_fit], tags: [...r.tags],
      description: r.description,
      // Main ingredients only (names from the sources). No amounts/steps were invented.
      ingredients: r.ingredients.map(name => ({ name })), steps: [], base_servings: 1
    };
    if (typeof r.is_soup === 'boolean') d.is_soup = r.is_soup;
    return d;
  });
}

/** Idempotently add the demo catalogue (dishes + menu links) to an in-memory store. */
export function applyDemoCatalog(store) {
  const ids = new Set((store.dishes || []).map(d => d.id));
  store.dishes = store.dishes || [];
  let dishes = 0, links = 0;
  for (const d of demoCatalogDishes()) if (!ids.has(d.id)) { store.dishes.push(d); dishes++; }
  for (const l of DEMO_MENU_LINKS) {
    const place = (store.places || []).find(p => p.id === l.place_id);
    if (!place) continue;
    place.menu = place.menu || [];
    if (place.menu.some(m => m.dish_id === l.dish_id)) continue;
    const dish = store.dishes.find(d => d.id === l.dish_id);
    place.menu.push({ dish_id: l.dish_id, name: dish?.name, price: l.price, available: true, is_demo: true });
    links++;
  }
  return { dishes, links };
}

/** In-memory equivalent of the documented removal SQL. */
export function removeDemoCatalog(store) {
  const demoIds = new Set((store.dishes || []).filter(d => d.is_demo === true).map(d => d.id));
  for (const p of store.places || []) p.menu = (p.menu || []).filter(m => m.is_demo !== true && !demoIds.has(m.dish_id));
  store.dishes = (store.dishes || []).filter(d => !demoIds.has(d.id));
  return demoIds.size;
}
