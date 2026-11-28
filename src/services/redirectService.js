// Only these existing partners are enabled. Adding one requires a reviewed host policy.
// Never accept a client URL or silently substitute a map for an ordering partner.
const PARTNER_HOSTS = new Map([
  ['grabfood', ['food.grab.com', 'r.grab.com']],
  ['shopeefood', ['shopeefood.vn', 'www.shopeefood.vn']]
]);
/** Ordering partners the server will redirect to (M4-S01 "Giao hàng" filter uses the same list). */
export const ORDER_PARTNERS = [...PARTNER_HOSTS.keys()];
export const redirectAction = partner => partner === 'maps' ? 'direction' : partner === 'phone' ? 'call' : 'order';
export function buildRedirect(place, partner) {
  if (!PARTNER_HOSTS.has(partner) && partner !== 'maps' && partner !== 'phone')
    return { error: 'Unknown partner', status: 400 };
  if (partner === 'phone') {
    const raw = String(place.phone || '');
    if (!/^[+\d ().-]+$/.test(raw)) return { error: 'Invalid phone', status: 422 };
    const digits = raw.replace(/\D/g, '');
    if (!/^\d{8,15}$/.test(digits)) return { error: 'Invalid phone', status: 422 };
    return { target_deeplink: `tel:${digits}`, fallback_web_url: null };
  }
  if (partner === 'maps') {
    const { lat, lng } = place;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) ||
        !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return { error: 'Invalid destination', status: 422 };
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('destination', `${lat},${lng}`);
    return { target_deeplink: url.href, fallback_web_url: url.href };
  }
  try {
    const raw = place.links?.[partner];
    if (typeof raw !== 'string' || /[\s\\]/.test(raw)) throw new Error();
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !PARTNER_HOSTS.get(partner).includes(url.hostname)) throw new Error();
    // Drop all stored tracking parameters/fragments: no user phone, location or token is forwarded.
    url.search = '';
    url.hash = '';
    const fallback = url.href;
    url.searchParams.set('utm_source', 'hom_nay_an_gi');
    url.searchParams.set('utm_medium', 'app_mvp');
    return { target_deeplink: url.href, fallback_web_url: fallback };
  } catch {
    return { error: 'Partner link unavailable or unsafe', status: 422 };
  }
}
// Analytics is a projection of durable redirect rows, never a second outbound tracking request.
export function redirectEvent(row) {
  return { redirect_id: row.id, action_type: row.action_type, clicked_at: row.clicked_at,
    confirmed_at: row.confirmed_at || null, confirmation_source: row.confirmed_at ? 'self_report' : null };
}
