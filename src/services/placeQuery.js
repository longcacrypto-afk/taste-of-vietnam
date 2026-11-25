import { getPlaceOpenStatus } from './placeHours.js';
import { haversineDistanceMeters } from './textUtils.js';

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
  return { lat, lng, radiusM, dishId: params.get('dish_id') || null, openOnly: params.get('open_only') !== 'false' };
}
