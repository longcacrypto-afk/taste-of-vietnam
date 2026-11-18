// =============================================================================
// MODULE M3 CORE AI RECOMMENDATION ENGINE (WITH HARD GUARDRAILS)
// =============================================================================

import { haversineDistanceMeters } from './textUtils.js';

export function isDishSafeForUser(dish, userProfile) {
  const hardAllergies = userProfile.hard_allergies || [];
  if (dish.allergen_tags && dish.allergen_tags.some(tag => hardAllergies.includes(tag))) {
    return false;
  }
  if ((userProfile.disliked_dish_ids || []).includes(dish.id)) {
    return false;
  }
  return true;
}

export function getRecentlyEatenDishIds(store, withinDays = 3) {
  const cutoff = Date.now() - withinDays * 86400000;
  const set = new Set();
  for (const item of store.suggestionHistory || []) {
    if (item.action === 'eaten' && new Date(item.created_at).getTime() >= cutoff) {
      set.add(item.dish_id);
    }
  }
  return set;
}

export function findOpenPlacesForDish(store, dishId, userLat, userLng, maxRadiusM = 3000) {
  const results = [];
  for (const place of store.places) {
    // Rule: Never recommend closed or unverified or auto-paused places (>=3 closed reports)
    if (!place.is_verified || !place.is_open_override || place.closed_report_count >= 3) {
      continue;
    }
    const dist = haversineDistanceMeters(userLat, userLng, place.lat, place.lng);
    if (dist > maxRadiusM) continue;

    const menuItem = (place.menu || []).find(m => m.dish_id === dishId && m.available);
    if (menuItem) {
      results.push({
        place_id: place.id,
        place_name: place.name,
        address: place.address,
        distance_m: dist,
        price_vnd: menuItem.price,
        rating: place.rating,
        has_ac: place.has_ac,
        has_kids_seat: place.has_kids_seat,
        phone: place.phone,
        links: place.links
      });
    }
  }
  return results.sort((a, b) => a.distance_m - b.distance_m);
}

export function getTodaySuggestions(store, opts = {}) {
  const startMs = performance.now();
  const user = store.userProfile;
  const radiusM = Number(opts.radius_m || user.radius_m || 3000);
  const recentEaten = getRecentlyEatenDishIds(store, 3);

  // 1. Filter natural candidate dishes
  const naturalCandidates = [];
  for (const dish of store.dishes) {
    if (!isDishSafeForUser(dish, user)) continue;
    if (recentEaten.has(dish.id)) continue;

    const openPlaces = findOpenPlacesForDish(store, dish.id, user.lat, user.lng, radiusM);
    const nearest = openPlaces[0] || null;
    const price = nearest ? nearest.price_vnd : dish.ref_price;

    if (price > user.budget_max * 1.25) continue;

    let score = 50;
    if (user.regions.includes(dish.region)) score += 20;
    if (dish.weather_fit.includes(store.weather.condition)) score += 15;
    if (Math.abs(dish.spice_level - user.spice_level) === 0) score += 10;
    if (nearest) score += 15;

    naturalCandidates.push({
      dish_id: dish.id,
      name: dish.name,
      description: dish.description,
      price_vnd: price,
      calories: dish.calories,
      prep_minutes: dish.prep_minutes,
      difficulty: dish.difficulty,
      tags: dish.tags,
      allergen_tags: dish.allergen_tags,
      img_key: dish.img_key,
      is_sponsored: false,
      badge_label: 'Gợi ý tự nhiên',
      reason: `${store.weather.temp_c}°C dịu mát · ${nearest ? `Quán cách ${nearest.distance_m}m` : 'Tự nấu tại nhà'} · Hợp ngân sách`,
      nearest_place: nearest,
      open_places_count: openPlaces.length,
      score
    });
  }

  naturalCandidates.sort((a, b) => b.score - a.score);

  // 2. Pick up to 2 natural dishes + at most 1 Sponsored dish (Max 1/3 slot rule!)
  const selected = naturalCandidates.slice(0, 2);
  const usedDishIds = new Set(selected.map(s => s.dish_id));

  // Find eligible active campaign that ALSO passes Hard Allergy Filter & Open Place check
  let sponsoredItem = null;
  for (const cmp of store.campaigns || []) {
    if (cmp.status !== 'active') continue;
    const dish = store.dishes.find(d => d.id === cmp.dish_id);
    if (!dish || usedDishIds.has(dish.id)) continue;
    // CRITICAL RULE: Sponsored ads MUST NEVER bypass user hard allergy filters!
    if (!isDishSafeForUser(dish, user)) continue;

    const openPlaces = findOpenPlacesForDish(store, dish.id, user.lat, user.lng, cmp.radius_m || radiusM);
    const placeMatch = openPlaces.find(p => p.place_id === cmp.place_id) || openPlaces[0];
    if (!placeMatch) continue;

    sponsoredItem = {
      dish_id: dish.id,
      name: dish.name,
      description: dish.description,
      price_vnd: placeMatch.price_vnd,
      calories: dish.calories,
      prep_minutes: dish.prep_minutes,
      difficulty: dish.difficulty,
      tags: dish.tags,
      allergen_tags: dish.allergen_tags,
      img_key: dish.img_key,
      is_sponsored: true,
      campaign_id: cmp.id,
      badge_label: 'Tài trợ',
      reason: `Hợp khẩu vị · ${placeMatch.place_name} đang mở (${placeMatch.distance_m}m)`,
      nearest_place: placeMatch,
      open_places_count: openPlaces.length,
      score: 99
    };
    break;
  }

  if (sponsoredItem) {
    selected.push(sponsoredItem);
  } else if (naturalCandidates[2]) {
    selected.push(naturalCandidates[2]);
  }

  const latencyMs = Number((performance.now() - startMs).toFixed(2));
  return {
    weather: store.weather,
    latency_ms: latencyMs,
    sponsored_ratio: selected.length ? Number((selected.filter(i => i.is_sponsored).length / selected.length).toFixed(2)) : 0,
    items: selected
  };
}
