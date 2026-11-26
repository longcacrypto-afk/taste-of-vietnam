// Weather provider (M3-S01/M3-S02, desktop Live App header). Open-Meteo current
// conditions for the user's saved location (the M1-S08 area picker / GPS writes
// profile.lat/lng), with a short in-memory cache, a timeout and a null fallback:
// when there is no reading the UI keeps the weather chip in its "sắp có" state.
// Never returns an invented temperature.
//
// Switches:
//   WEATHER_PROVIDER=off      → always null (UI shows "sắp có")
//   WEATHER_PROVIDER=open-meteo (default)
//   WEATHER_TIMEOUT_MS        → provider timeout (default 2500)
//   WEATHER_CACHE_SECONDS     → cache for a good reading (default 600)
// Under `node --test` the real network is never used unless a fetch is injected
// with setWeatherFetch(), so the test suite stays offline.
//
// Note: Open-Meteo's free API is for non-commercial use; a commercial launch needs
// their paid plan (or another provider behind this same function).

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const FAIL_CACHE_MS = 60_000;

let injectedFetch = null;
const cache = new Map(); // key -> { until, value } | { pending }

/** Tests (and future providers) inject the fetch used for the provider call. */
export function setWeatherFetch(fn) {
  injectedFetch = fn || null;
  cache.clear();
}
export function clearWeatherCache() {
  cache.clear();
}

// WMO weather codes (Open-Meteo) → Vietnamese label + emoji.
const WMO = [
  [[0], '☀️', 'Trời quang'],
  [[1, 2], '🌤️', 'Ít mây'],
  [[3], '☁️', 'Nhiều mây'],
  [[45, 48], '🌫️', 'Sương mù'],
  [[51, 53, 55, 56, 57], '🌦️', 'Mưa phùn'],
  [[61, 63, 66, 80, 81], '🌧️', 'Có mưa'],
  [[65, 67, 82], '🌧️', 'Mưa to'],
  [[71, 73, 75, 77, 85, 86], '🌨️', 'Tuyết'],
  [[95, 96, 99], '⛈️', 'Dông'],
];
const RAIN = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

/**
 * Dish matching uses the catalogue's weather_fit tags ('rain_cool', 'hot_sunny').
 * rain_cool: rain/drizzle/storm, or ≤ 24°C. hot_sunny: ≥ 30°C and clear/partly cloudy.
 * Anything else is 'mild' (no dish gets a weather bonus).
 */
export function weatherCondition(tempC, code) {
  if (RAIN.has(code) || tempC <= 24) return 'rain_cool';
  if (tempC >= 30 && code <= 2) return 'hot_sunny';
  return 'mild';
}

// Open-Meteo returns GMT times like "2026-11-26T05:45" (no zone) unless asked otherwise.
function observedAt(time, now) {
  if (typeof time !== 'string') return now.toISOString();
  const t = Date.parse(/[zZ]$|[+-]\d\d:?\d\d$/.test(time) ? time : time + 'Z');
  return Number.isFinite(t) ? new Date(t).toISOString() : now.toISOString();
}

/** Parse an Open-Meteo `current` payload into the app's reading, or null if unusable. */
export function parseOpenMeteo(json, now = new Date()) {
  const c = json?.current;
  const temp = Number(c?.temperature_2m);
  const code = Number(c?.weather_code);
  if (!c || c.temperature_2m == null || !Number.isFinite(temp) || !Number.isInteger(code)) return null;
  const [, emoji, text] = WMO.find(([codes]) => codes.includes(code)) || [null, '🌡️', 'Thời tiết hiện tại'];
  const temp_c = Math.round(temp);
  return {
    temp_c,
    weather_code: code,
    condition: weatherCondition(temp, code),
    emoji,
    label: `${temp_c}°C · ${text}`,
    source: 'Open-Meteo',
    observed_at: observedAt(c.time, now),
    fetched_at: now.toISOString(),
  };
}

function enabled() {
  const p = String(process.env.WEATHER_PROVIDER || 'open-meteo').toLowerCase();
  return !['off', 'none', 'false', '0'].includes(p);
}

function fetchImpl() {
  if (injectedFetch) return injectedFetch;
  if (process.env.NODE_TEST_CONTEXT) return null; // test runner: never touch the network
  return typeof globalThis.fetch === 'function' ? globalThis.fetch : null;
}

async function fetchReading(lat, lng, doFetch) {
  const timeoutMs = Number(process.env.WEATHER_TIMEOUT_MS) || 2500;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`;
    const res = await doFetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res || !res.ok) return null;
    return parseOpenMeteo(await res.json());
  } catch {
    return null; // timeout, network or JSON error → no reading
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Current weather at the given coordinates, or null when there is no real reading
 * (provider off, no coordinates, timeout, provider error).
 */
export async function currentWeather({ lat, lng } = {}) {
  if (!enabled()) return null;
  const la = Number(lat), ln = Number(lng);
  if (lat == null || lng == null || !Number.isFinite(la) || !Number.isFinite(ln)
    || Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  const doFetch = fetchImpl();
  if (!doFetch) return null;
  // ~1 km grid: users in the same area share one provider call.
  const key = `${la.toFixed(2)},${ln.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit?.pending) return hit.pending;
  if (hit && hit.until > Date.now()) return hit.value;
  const pending = fetchReading(la.toFixed(2), ln.toFixed(2), doFetch).then((value) => {
    const ttl = value ? (Number(process.env.WEATHER_CACHE_SECONDS) || 600) * 1000 : FAIL_CACHE_MS;
    cache.set(key, { value, until: Date.now() + ttl });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return value;
  });
  cache.set(key, { pending });
  return pending;
}
