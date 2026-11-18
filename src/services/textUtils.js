// =============================================================================
// VIETNAMESE TEXT NORMALIZATION & GEO HAVERSINE DISTANCE UTILITIES
// =============================================================================

export function removeVietnameseTones(str = '') {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesVietnameseQuery(targetText, query) {
  if (!query || !query.trim()) return true;
  const normTarget = removeVietnameseTones(targetText);
  const normQuery = removeVietnameseTones(query);
  const tokens = normQuery.split(' ').filter(Boolean);
  return tokens.every(tok => normTarget.includes(tok));
}

export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function computeStringSimilarity(a, b) {
  const tokA = new Set(removeVietnameseTones(a).split(' ').filter(Boolean));
  const tokB = new Set(removeVietnameseTones(b).split(' ').filter(Boolean));
  if (!tokA.size || !tokB.size) return 0;
  let overlap = 0;
  for (const t of tokA) {
    if (tokB.has(t)) overlap++;
  }
  return overlap / Math.max(tokA.size, tokB.size);
}
