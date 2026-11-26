// M1-S08 manual area picker. Areas are derived from the place catalogue the API
// already serves (ward + city in the address of verified places), never a fixed list.
const WARD = /^(P\.|Phường|X\.|Xã|TT\.|Thị trấn)\s*\S/i;

const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Group verified, non-archived places with coordinates by "ward, city". */
export function areasFromPlaces(places = []) {
  const groups = new Map();
  for (const p of places) {
    if (p?.is_verified !== true || p.cms?.status === 'archived') continue;
    const lat = Number(p.lat), lng = Number(p.lng);
    if (p.lat == null || p.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const parts = String(p.address || '').split(',').map(s => s.trim()).filter(Boolean);
    const ward = parts.find(s => WARD.test(s));
    const city = parts.at(-1);
    if (!ward || !city || city === ward) continue; // no ward in the address: not guessable
    const name = `${ward}, ${city}`;
    const g = groups.get(name) || { id: slug(name), name, lat: 0, lng: 0, place_count: 0 };
    g.lat += lat; g.lng += lng; g.place_count += 1;
    groups.set(name, g);
  }
  return [...groups.values()]
    .map(g => ({ ...g, lat: Number((g.lat / g.place_count).toFixed(6)), lng: Number((g.lng / g.place_count).toFixed(6)) }))
    .sort((a, b) => b.place_count - a.place_count || a.name.localeCompare(b.name, 'vi'));
}
