// One candidate gate for Today, chat and decision games. No network/provider calls.
import { getPlaceOpenStatus, isPlaceEligible } from './placeHours.js';
import { haversineDistanceMeters } from './textUtils.js';

export const REJECTION_MESSAGES = {
  safety: 'Thông tin an toàn chưa được duyệt hoặc thiếu nhãn dị ứng.',
  allergy: 'Có thành phần trùng dị ứng của bạn.',
  disliked: 'Món nằm trong danh sách không thích.',
  diet: 'Không phù hợp chế độ ăn đã chọn.',
  meal: 'Không phù hợp bữa ăn đã chọn.',
  spice: 'Vượt mức cay cho phép.',
  cooldown: 'Đã ăn trong 72 giờ gần đây.',
  budget: 'Không có lựa chọn trong khoảng ngân sách.',
  mode: 'Không có quán đủ điều kiện hoặc công thức hợp lệ.',
  invalid_context: 'Điều kiện lựa chọn không hợp lệ.',
  insufficient_candidates: 'Không đủ 3 món phù hợp; không tự nới điều kiện.'
};
const finite = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value));
const number = (value, fallback) => value === undefined ? fallback : finite(value) ? Number(value) : NaN;
const MODES = ['both', 'eat_out', 'cook'];
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

export function candidateContext(profile = {}, opts = {}) {
  const diets = [...new Set([profile.diet_mode, opts.diet_mode].filter(d => d && !['balanced', 'normal', 'none'].includes(d)))];
  const context = {
    mode: opts.mode ?? profile.mode ?? 'both',
    meal_slot: opts.meal_slot ?? profile.meal_slot ?? 'lunch',
    diets,
    budget_min: number(opts.budget_min, number(profile.budget_min, 0)),
    budget_max: number(opts.budget_max, number(profile.budget_max, 60000)),
    spice_max: opts.spice_max === undefined && profile.spice_max === undefined ? null : Math.min(number(opts.spice_max, 3), number(profile.spice_max, 3)),
    radius_m: number(opts.radius_m, number(profile.radius_m, 3000)),
    party_size: number(opts.party_size, 1)
  };
  context.valid = MODES.includes(context.mode) && MEALS.includes(context.meal_slot)
    && diets.every(d => typeof d === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(d)) && context.budget_min >= 0
    && Number.isFinite(context.budget_max) && context.budget_max >= context.budget_min
    && context.radius_m > 0 && context.radius_m <= 100000
    && Number.isInteger(context.party_size) && context.party_size >= 1 && context.party_size <= 100
    && (context.spice_max === null || (Number.isFinite(context.spice_max) && context.spice_max >= 0 && context.spice_max <= 3));
  return context;
}

// Share M4's verified-hours policy; eligibility is not a claim of being open.
export function placeEligibility(place, now = Date.now()) {
  return (place?.closed_report_count ?? 0) < 3 && isPlaceEligible(place, now, {
    requireVerifiedHours: process.env.REQUIRE_VERIFIED_HOURS === 'true'
  });
}

export function eligiblePlaces(store, dishId, context, now = Date.now(), predicate = placeEligibility) {
  const user = store.userProfile || {};
  if (![user.lat, user.lng].every(finite) || Math.abs(Number(user.lat)) > 90 || Math.abs(Number(user.lng)) > 180) return [];
  const results = [];
  for (const p of store.places || []) {
    if (!predicate(p, now) || ![p.lat, p.lng].every(finite) || Math.abs(Number(p.lat)) > 90 || Math.abs(Number(p.lng)) > 180) continue;
    const distance = haversineDistanceMeters(Number(user.lat), Number(user.lng), Number(p.lat), Number(p.lng));
    if (!Number.isFinite(distance) || distance > context.radius_m) continue;
    const menu = (p.menu || []).find(m => m.dish_id === dishId && m.available === true && finite(m.price) && Number(m.price) >= 0);
    if (!menu) continue;
    results.push({ place_id: p.id, place_name: p.name, address: p.address, distance_m: distance,
      price_vnd: Number(menu.price), rating: p.rating, has_ac: p.has_ac, has_kids_seat: p.has_kids_seat,
      phone: p.phone, links: p.links, open_status: getPlaceOpenStatus(p, now),
      is_currently_open: getPlaceOpenStatus(p, now).is_currently_open });
  }
  return results.sort((a, b) => a.distance_m - b.distance_m);
}

export function buildCandidates(store, opts = {}, { now = Date.now(), placePredicate = placeEligibility } = {}) {
  const profile = store.userProfile || {};
  const context = candidateContext(profile, opts);
  const excluded = {};
  const reject = reason => { excluded[reason] = (excluded[reason] || 0) + 1; };
  const candidates = [];
  const approvalRequired = process.env.REQUIRE_SAFETY_APPROVAL === 'true';
  if (!Array.isArray(profile.hard_allergies ?? []) || !Array.isArray(profile.disliked_dish_ids ?? []) || !(profile.hard_allergies ?? []).every(t => typeof t === 'string')) context.valid = false;
  if (!context.valid) reject('invalid_context');
  else for (const dish of store.dishes || []) {
    const allergens = dish.allergen_tags;
    const allergies = profile.hard_allergies || [];
    if (dish.safety_status === 'rejected' || (approvalRequired && dish.safety_status !== 'approved')
      || ((allergies.length > 0 || approvalRequired || allergens !== undefined) && (!Array.isArray(allergens) || allergens.some(t => typeof t !== 'string')))) { reject('safety'); continue; }
    if ((allergens || []).some(t => allergies.includes(t))) { reject('allergy'); continue; }
    if ((profile.disliked_dish_ids || []).includes(dish.id)) { reject('disliked'); continue; }
    const flags = Array.isArray(dish.diet_flags) ? dish.diet_flags : [];
    if (!context.diets.every(d => flags.includes(d) || (d === 'vegetarian' && flags.includes('vegan')))) { reject('diet'); continue; }
    if (!Array.isArray(dish.meal_slots) || !dish.meal_slots.includes(context.meal_slot)) { reject('meal'); continue; }
    if (context.spice_max !== null && (!finite(dish.spice_level) || Number(dish.spice_level) > context.spice_max)) { reject('spice'); continue; }
    if ((store.suggestionHistory || []).some(h => h.dish_id === dish.id && h.action === 'eaten'
      && Number.isFinite(Date.parse(h.created_at)) && Date.parse(h.created_at) > now - 72 * 3600000)) { reject('cooldown'); continue; }
    const places = context.mode === 'cook' ? [] : eligiblePlaces(store, dish.id, context, now, placePredicate);
    const recipe = Array.isArray(dish.ingredients) && dish.ingredients.length > 0 && dish.ingredients.every(i => i && typeof i.name === 'string' && i.name.trim())
      && Array.isArray(dish.steps) && dish.steps.length > 0 && dish.steps.every(s => s && (s.title || s.text)) && finite(dish.base_servings) && Number(dish.base_servings) > 0
      && finite(dish.market_cost_base) && Number(dish.market_cost_base) >= 0;
    const canCook = context.mode !== 'eat_out' && recipe;
    if (!places.length && !canCook) { reject('mode'); continue; }
    const withinBudget = price => price >= context.budget_min && price <= context.budget_max;
    const affordablePlaces = places.filter(p => withinBudget(p.price_vnd));
    const recipePrice = canCook ? Number(dish.market_cost_base) / Number(dish.base_servings) : null;
    const place = affordablePlaces[0] || null;
    if (!place && !(canCook && withinBudget(recipePrice))) { reject('budget'); continue; }
    const unitPrice = place ? place.price_vnd : recipePrice;
    let score = 50;
    if ((profile.regions || []).includes(dish.region)) score += 20;
    if ((dish.weather_fit || []).includes(store.weather?.condition)) score += 15;
    if (Number(dish.spice_level) === profile.spice_level) score += 10;
    if (place) score += 15;
    candidates.push({ dish, dish_id: dish.id, price_vnd: unitPrice, nearest_place: place,
      open_places: affordablePlaces, option_type: place ? 'verified_restaurant' : 'home_recipe', score });
  }
  candidates.sort((a, b) => b.score - a.score || a.dish_id.localeCompare(b.dish_id));
  const reasons = Object.entries(excluded).map(([code, count]) => ({ code, count, message: REJECTION_MESSAGES[code] }));
  if (candidates.length < 3) reasons.push({ code: 'insufficient_candidates', message: REJECTION_MESSAGES.insufficient_candidates });
  return { candidates, context, reasons, safety_approval_required: approvalRequired };
}
