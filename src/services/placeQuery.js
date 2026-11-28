import { getPlaceOpenStatus } from './placeHours.js';
import { haversineDistanceMeters } from './textUtils.js';
import { ORDER_PARTNERS, buildRedirect } from './redirectService.js';

export function validCoordinates(lat, lng) {
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180;
}

export function placeWithStatus(place, now = new Date()) {
  const open_status = getPlaceOpenStatus(place, now);
  return { ...place, open_status, is_currently_open: open_status.status === 'open' };
}

export function placeDistance(place, lat, lng) {
  return validCoordinates(lat, lng) && validCoordinates(place.lat, place.lng)
    ? haversineDistanceMeters(lat, lng, place.lat, place.lng) : null;
}

/** Explicit query coordinates replace (never mix with) profile coordinates. */
export function parsePlaceQuery(params, profile = {}) {
  const hasPosition = params.has('lat') || params.has('lng');
  const number = key => {
    const raw = params.get(key);
    return raw !== null && raw.trim() !== '' ? Number(raw) : NaN;
  };
  const lat = hasPosition ? number('lat') : profile.lat;
  const lng = hasPosition ? number('lng') : profile.lng;
  if (hasPosition && !validCoordinates(lat, lng)) return { error: 'lat/lng phải là một cặp tọa độ hợp lệ' };
  const radiusM = params.has('radius') ? number('radius') : (profile.radius_m ?? 3000);
  if (!Number.isFinite(radiusM) || radiusM < 1 || radiusM > 50000) return { error: 'radius phải từ 1 đến 50000 mét' };
  if (params.has('open_only') && !['true', 'false'].includes(params.get('open_only'))) return { error: 'open_only phải là true hoặc false' };
  const filters = {};
  for (const key of ['has_ac', 'delivery']) {
    if (!params.has(key)) continue;
    if (params.get(key) !== 'true') return { error: `${key} chỉ nhận giá trị true` };
    filters[key] = true;
  }
  if (params.has('max_price')) {
    const raw = params.get('max_price');
    const n = /^\d{1,10}$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(n) || n < 1) return { error: 'max_price phải là số nguyên dương (VND)' };
    filters.max_price = n;
  }
  return { lat, lng, radiusM, dishId: params.get('dish_id') || null, openOnly: params.get('open_only') !== 'false', filters };
}

/** A place can be ordered for delivery: a link the order redirect would accept. */
export function placeDelivers(place) {
  return ORDER_PARTNERS.some(k => !buildRedirect(place, k).error);
}

/**
 * M4-S01 chips, applied server-side. Every test needs a recorded TRUE / a recorded price:
 * missing data is never read as a match.
 *   has_ac=true    → place.has_ac === true
 *   delivery=true  → a valid GrabFood/ShopeeFood link (placeDelivers)
 *   max_price=N    → price of the dish_id's available menu row ≤ N (without dish_id:
 *                    any available menu row ≤ N)
 */
export function placeMatchesFilters(place, filters = {}, dishId = null) {
  if (filters.has_ac && place.has_ac !== true) return false;
  if (filters.delivery && !placeDelivers(place)) return false;
  if (filters.max_price != null) {
    const rows = (place.menu || []).filter(m => m.available !== false && (!dishId || m.dish_id === dishId));
    const ok = rows.some(m => m.price !== null && m.price !== '' && Number.isFinite(Number(m.price))
      && Number(m.price) > 0 && Number(m.price) <= filters.max_price);
    if (!ok) return false;
  }
  return true;
}
