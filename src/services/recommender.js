// M3 response adapter: every selectable dish has passed the shared candidate gate.
import { buildCandidates, eligiblePlaces, candidateContext } from './candidatePipeline.js';

// Legacy catalogue/semantic helper; recommendation approval lives in buildCandidates.
export function isDishSafeForUser(dish, userProfile) {
  const allergies = userProfile.hard_allergies || [];
  if (allergies.length && !Array.isArray(dish.allergen_tags)) return false;
  return !(dish.allergen_tags || []).some(tag => allergies.includes(tag))
    && !(userProfile.disliked_dish_ids || []).includes(dish.id);
}
export function getRecentlyEatenDishIds(store, withinDays = 3) {
  const cutoff = Date.now() - withinDays * 86400000;
  return new Set((store.suggestionHistory || []).filter(h => h.action === 'eaten' && Date.parse(h.created_at) > cutoff).map(h => h.dish_id));
}
export function findOpenPlacesForDish(store, dishId, lat, lng, radius = 3000) {
  return eligiblePlaces({ ...store, userProfile: { ...store.userProfile, lat, lng } }, dishId, candidateContext(store.userProfile, { radius_m: radius }));
}
export function suggestionItem(candidate) {
  const { dish: d, nearest_place: place } = candidate;
  return { dish_id: d.id, name: d.name, description: d.description, price_vnd: candidate.price_vnd,
    calories: d.calories, prep_minutes: d.prep_minutes, difficulty: d.difficulty, tags: d.tags,
    allergen_tags: d.allergen_tags, img_key: d.img_key, is_sponsored: false, badge_label: 'Gợi ý tự nhiên',
    reason: `${place ? `Quán cách ${Math.round(place.distance_m)}m` : 'Có công thức tự nấu'} · Hợp điều kiện đã chọn`,
    nearest_place: place, open_places_count: candidate.open_places.length, score: candidate.score };
}
export function getTodaySuggestions(store, opts = {}) {
  const start = performance.now();
  const result = buildCandidates(store, opts);
  const selected = result.candidates.slice(0, 3).map(suggestionItem);
  // Legacy campaigns never bypass the shared gate, budget, radius or actual denominator.
  if (selected.length === 3 && result.context.mode !== 'cook') {
    for (const cmp of store.campaigns || []) {
      if (cmp.status !== 'active') continue;
      const candidate = result.candidates.find(c => c.dish_id === cmp.dish_id);
      const place = candidate?.open_places.find(p => p.place_id === cmp.place_id
        && p.distance_m <= Math.min(Number(cmp.radius_m) || result.context.radius_m, result.context.radius_m));
      if (!place) continue;
      const sponsored = { ...suggestionItem(candidate), nearest_place: place, price_vnd: place.price_vnd,
        is_sponsored: true, campaign_id: cmp.id, badge_label: 'Tài trợ' };
      const index = selected.findIndex(c => c.dish_id === cmp.dish_id);
      selected[index < 0 ? 2 : index] = sponsored;
      break;
    }
  }
  return { weather: store.weather, latency_ms: Number((performance.now() - start).toFixed(2)),
    sponsored_ratio: selected.length ? Number((selected.filter(c => c.is_sponsored).length / selected.length).toFixed(2)) : 0,
    items: selected, reasons: result.reasons, context: result.context, safety_approval_required: result.safety_approval_required };
}
