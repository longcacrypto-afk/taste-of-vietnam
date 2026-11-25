// Pure shared M4/M3 predicate. Never infer verified hours from legacy/demo times.
export const PLACE_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const PLACE_STALE_MS = 90 * 86400000;
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PLACE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const object = o => o && typeof o === 'object' && !Array.isArray(o);
const minute = s => {
  if (typeof s !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return null;
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
};
function intervals(value) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const start = minute(pair[0]);
    const end = pair[1] === '24:00' ? 1440 : minute(pair[1]);
    if (start === null || end === null || start === end) return null;
    out.push([start, end]);
  }
  return out;
}

/** Sunday=0. Half-open intervals [start,end); end<start carries into next day.
 * Date override replaces that local day completely (including yesterday's spill).
 * Missing day = unknown, [] = explicitly closed, 00:00–24:00 = all day.
 * now is injectable for both API tests and M3; no DB, mutation, or host timezone.
 */
export function getPlaceOpenStatus(place, now = new Date()) {
  const result = (status, reason) => ({
    status, reason, is_currently_open: status === 'open', timezone: PLACE_TIME_ZONE,
    label: { open: 'Đang mở', closed: 'Đang đóng', unknown: 'Chưa rõ', stale: 'Cần xác minh lại' }[status]
  });
  const at = new Date(now).getTime();
  if (!Number.isFinite(at)) return result('unknown', 'invalid_now');
  if (place?.is_paused === true || place?.is_open_override === false) return result('closed', 'paused');
  if (place?.is_verified !== true) return result('unknown', 'unverified');
  const verified = place.verified_at == null ? NaN : new Date(place.verified_at).getTime();
  if (!Number.isFinite(verified) || verified > at) return result('unknown', 'unverified_date');
  if (at - verified >= PLACE_STALE_MS) return result('stale', 'verification_expired');
  const hours = place.opening_hours;
  if (!object(hours) || !object(hours.weekly) || (hours.overrides !== undefined && !object(hours.overrides))) {
    return result('unknown', 'missing_hours');
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(at)).map(p => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const localDay = new Date(`${date}T00:00:00Z`);
  const weekday = localDay.getUTCDay();
  const prevDate = new Date(localDay.getTime() - 86400000).toISOString().slice(0, 10);
  const overrides = hours.overrides || {};
  const todayOverride = own(overrides, date);
  const today = intervals(todayOverride ? overrides[date] : hours.weekly[weekday]);
  if (today === null) return result('unknown', 'missing_or_invalid_day');
  const time = Number(parts.hour) * 60 + Number(parts.minute) + Number(parts.second) / 60;
  if (today.some(([s, e]) => time >= s && time < (e < s ? 1440 : e))) return result('open', 'schedule');
  if (!todayOverride) {
    const yesterday = intervals(own(overrides, prevDate) ? overrides[prevDate] : hours.weekly[(weekday + 6) % 7]);
    if (yesterday?.some(([s, e]) => e < s && time < e)) return result('open', 'overnight');
    // An absent/invalid previous day could carry into today: do not claim closed.
    if (yesterday === null && time < 1440) return result('unknown', 'missing_previous_day');
  }
  return result('closed', 'schedule');
}

/** Compatibility listing policy; eligibility NEVER means "currently open".
 * Strict mode is opt-in until the catalogue has genuinely verified hours.
 */
export function isPlaceEligible(place, now = new Date(), { requireVerifiedHours = false } = {}) {
  if (place?.is_verified !== true || place.is_paused === true || place.is_open_override === false) return false;
  const { status } = getPlaceOpenStatus(place, now);
  return requireVerifiedHours ? status === 'open' : status !== 'closed';
}
