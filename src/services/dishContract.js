// M2 catalogue contract. Nutrition is per serving; recipe amounts/cost are per base recipe.
import { matchesVietnameseQuery } from './textUtils.js';
import { isDishSafeForUser } from './recommender.js';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
export const DIETS = ['balanced', 'vegetarian', 'vegan', 'low_carb', 'eat_clean'];
// M2-S02 "🚫 Ẩn Hải sản": allergen tags that are seafood. A user preference filter on
// top of (never instead of) the hard allergy filter in isDishSafeForUser.
export const SEAFOOD_TAGS = ['shrimp', 'shrimp_paste', 'shellfish', 'fish'];
export const fail = (status, error) => ({ status, data: { error } });
export const notFound = () => fail(404, 'Không tìm thấy');

export function parseDishQuery(params) {
  const out = { q: (params.get('q') || '').trim(), safe_only: params.get('safe_only') !== 'false' };
  for (const [key, choices] of Object.entries({
    region: ['bac', 'trung', 'nam'], meal_slot: MEALS, diet: DIETS, safe_only: ['true', 'false'],
    soup: ['true', 'false'], exclude_seafood: ['true', 'false']
  })) {
    if (params.has(key) && !choices.includes(params.get(key))) return null;
    if (!['safe_only', 'soup', 'exclude_seafood'].includes(key)) out[key] = params.get(key) || '';
  }
  // soup=true: only dishes recorded as "món nước" (is_soup === true; not entered ≠ match).
  // soup=false: only dishes recorded as not soup. Absent: no soup filter.
  out.soup = params.has('soup') ? params.get('soup') === 'true' : null;
  // exclude_seafood=true: hide any dish with a seafood allergen tag, the "Hải sản" tag,
  // or no allergen data at all (unknown is never treated as seafood-free).
  out.exclude_seafood = params.get('exclude_seafood') === 'true';
  for (const [key, fallback, min, max] of [
    ['page', 1, 1, Number.MAX_SAFE_INTEGER], ['limit', 20, 1, 100],
    ['budget_min', 0, 0, Number.MAX_SAFE_INTEGER], ['budget_max', Number.MAX_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER]
  ]) {
    const raw = params.get(key);
    const n = raw === null ? fallback : (/^\d+$/.test(raw) ? Number(raw) : NaN);
    if (!Number.isSafeInteger(n) || n < min || n > max) return null;
    out[key] = n;
  }
  if (out.budget_min > out.budget_max || out.q.length > 200) return null;
  return out;
}

export function isSeafoodFree(d) {
  if (!Array.isArray(d.allergen_tags)) return false;
  return !d.allergen_tags.some(t => SEAFOOD_TAGS.includes(t)) && !(d.tags || []).includes('Hải sản');
}

export function filterDishes(dishes, f, profile) {
  return dishes.filter(d =>
    (!f.safe_only || isDishSafeForUser(d, profile)) &&
    (!f.region || d.region === f.region) &&
    (!f.meal_slot || (d.meal_slots || []).includes(f.meal_slot)) &&
    (!f.diet || f.diet === 'balanced' || (d.diet_flags || []).includes(f.diet) ||
      (f.diet === 'vegetarian' && (d.diet_flags || []).includes('vegan'))) &&
    Number(d.ref_price) >= f.budget_min && Number(d.ref_price) <= f.budget_max &&
    (f.soup == null || d.is_soup === f.soup) &&
    (!f.exclude_seafood || isSeafoodFree(d)) &&
    matchesVietnameseQuery(`${d.name} ${d.description || ''} ${(d.tags || []).join(' ')}`, f.q)
  );
}

// 2 decimals for g/ml, 3 for litres/kg/spoons/counts. Never round a positive
// quantity down to zero: retain its significant digits for very small amounts.
export function roundAmount(value, unit = '') {
  const places = ['g', 'ml'].includes(unit.toLowerCase()) ? 2 : 3;
  const rounded = Number(value.toFixed(places));
  return value > 0 && rounded === 0 ? Number(value.toPrecision(3)) : rounded;
}

export function scaleDish(dish, rawServings) {
  const base = Number(dish.base_servings || 2);
  const servings = rawServings === null ? base : (/^(?:[1-9]|10)$/.test(rawServings) ? Number(rawServings) : NaN);
  if (!Number.isInteger(servings) || servings < 1 || servings > 10) return null;
  const factor = servings / base;
  const macros = Object.fromEntries(Object.entries(dish.macros || {}).map(([k, v]) => [k, roundAmount(Number(v) * servings, 'g')]));
  return {
    ...dish, requested_servings: servings,
    nutrition_basis: 'per_serving', calories_per_serving: dish.calories,
    macros_per_serving: dish.macros || {}, scaled_calories_total: Math.round(Number(dish.calories || 0) * servings),
    scaled_macros_total: macros,
    scaled_market_cost_vnd: Math.round(Number(dish.market_cost_base || 0) * factor),
    scaled_ingredients: (dish.ingredients || []).map(ing => ({
      ...ing, scaled_amount: roundAmount(Number(ing.amount) * factor, ing.unit)
    }))
  };
}
