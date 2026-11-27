// M8 — Nhắc bữa & Thông báo (M8-S01 inbox, M8-S02 detail, M8-S03 preferences, M8-S04 schedule).
//
// Storage
//   profile.meal_reminders {lunch, dinner, max_per_day}  core field (users.profile), kept compatible
//                                                         with M1 profile validation.
//   M8/settings      one per user: slot switches, weather / lunar-vegetarian switches.
//   M8/notification  in-app inbox, one record per delivered reminder or test.
//   M8/daycount      per user per local day: notifications delivered (row-locked counter).
//   M8/template      demo message templates (is_demo) for the weather-aware text.
//
// Rules
//   * Hard anti-fatigue cap: at most 2 notifications per user per local day (Asia/Ho_Chi_Minh),
//     counted server-side over every delivery, tests included. The user may lower it to 1 or 0.
//   * A scheduled reminder is delivered in-app when the user next opens the inbox inside the
//     slot window (slot time .. +3h, local), once per slot per day.
//   * Weather text only from a real reading (weatherProvider.currentWeather) at a location
//     the user chose; otherwise the text says nothing about weather.
//   * Dishes named in a reminder come from the real recommender gate (allergies, open
//     places, 3-day cooldown) at delivery time; never invented.
//   * No push service is configured: every record says push.sandbox = true, delivered = false.
import { currentWeather } from '../services/weatherProvider.js';
import { locationChosen } from '../services/profileService.js';
import { getTodaySuggestions } from '../services/recommender.js';
import { scopeStoreToUser } from '../services/authService.js';

const M = 'M8';
export const HARD_CAP = 2;
const TZ = 'Asia/Ho_Chi_Minh';
const TZ_OFFSET_H = 7; // Vietnam has no DST
const WINDOW_MS = 3 * 3600_000;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLOTS = ['lunch', 'dinner'];
const SLOT_LABEL = { lunch: 'Bữa trưa', dinner: 'Bữa tối', test: 'Gửi thử' };
const DEFAULTS = { lunch: '10:30', dinner: '17:00' };
const PUSH_SANDBOX = { sandbox: true, delivered: false, channel: 'web_push',
  note: 'Chưa cấu hình dịch vụ Web Push — thông báo chỉ hiển thị trong ứng dụng.' };

// Clock (tests inject a fixed time).
let clock = () => new Date();
// Own ISO formatter (some runtimes patch Date#toISOString for display).
export const isoOf = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}.${String(d.getUTCMilliseconds()).padStart(3, '0')}Z`;
export function __setNow(fn) { clock = fn || (() => new Date()); }

// ── Vietnam local time ─────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
function local(date = clock()) {
  const t = new Date(date.getTime() + TZ_OFFSET_H * 3600_000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), hh: t.getUTCHours(), mm: t.getUTCMinutes(),
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` };
}
function slotInstant(dateStr, hhmm) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - TZ_OFFSET_H, mm));
}
const addDays = (dateStr, n) => { const t = slotInstant(dateStr, '12:00'); t.setUTCDate(t.getUTCDate() + n); return local(t).date; };

// ── Lunar calendar (Hồ Ngọc Đức's algorithm, UTC+7) for "ngày chay" (mùng 1 & rằm) ──
const INT = Math.floor;
function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}
function newMoonDay(k, tz) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const Mn = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(Mn * dr) + 0.0021 * Math.sin(2 * dr * Mn);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (Mn + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (Mn - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + Mn));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - Mn)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + Mn));
  const deltat = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return INT(Jd1 + C1 - deltat + 0.5 + tz / 24);
}
function sunLongitude(jdn, tz) {
  const T = (jdn - 2451545.5 - tz / 24) / 36525, T2 = T * T, dr = Math.PI / 180;
  const Mn = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * Mn);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * Mn) + 0.000290 * Math.sin(dr * 3 * Mn);
  let L = (L0 + DL) * dr;
  L -= Math.PI * 2 * INT(L / (Math.PI * 2));
  return INT(L / Math.PI * 6);
}
function lunarMonth11(yy, tz) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = newMoonDay(k, tz);
  if (sunLongitude(nm, tz) >= 9) nm = newMoonDay(k - 1, tz);
  return nm;
}
function leapMonthOffset(a11, tz) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last, i = 1, arc = sunLongitude(newMoonDay(k + i, tz), tz);
  do { last = arc; i++; arc = sunLongitude(newMoonDay(k + i, tz), tz); } while (arc !== last && i < 14);
  return i - 1;
}
export function solarToLunar(dd, mm, yy, tz = 7) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1, tz);
  if (monthStart > dayNumber) monthStart = newMoonDay(k, tz);
  let a11 = lunarMonth11(yy, tz), b11 = a11, lunarYear;
  if (a11 >= monthStart) { lunarYear = yy; a11 = lunarMonth11(yy - 1, tz); }
  else { lunarYear = yy + 1; b11 = lunarMonth11(yy + 1, tz); }
  const day = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false, month = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11, tz);
    if (diff >= leapDiff) { month = diff + 10; if (diff === leapDiff) leap = true; }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) lunarYear -= 1;
  return { day, month, year: lunarYear, leap };
}
function lunarInfo(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const l = solarToLunar(d, m, y, TZ_OFFSET_H);
  const veg = l.day === 1 || l.day === 15;
  // next vegetarian day (mùng 1 or rằm) on or after this date
  let next = null;
  for (let i = 0; i <= 31 && !next; i++) {
    const ds = addDays(dateStr, i);
    const [yy, mm, dd] = ds.split('-').map(Number);
    const ll = solarToLunar(dd, mm, yy, TZ_OFFSET_H);
    if (ll.day === 1 || ll.day === 15) next = { date: ds, lunar_day: ll.day, lunar_month: ll.month, label: ll.day === 1 ? 'Mùng 1' : 'Rằm' };
  }
  return { day: l.day, month: l.month, year: l.year, leap: l.leap, is_vegetarian_day: veg,
    label: `${l.day}/${l.month}${l.leap ? ' (nhuận)' : ''} âm lịch`, next_vegetarian_day: next };
}

// ── Demo templates (message wording only; data comes from weather + recommender) ──
const seed = () => [
  { kind: 'template', id: 'M8-TPL-RAIN', data: { condition: 'rain_cool', title: '{emoji} {meal} nay trời mát {temp}°C, ăn {dish1} hay {dish2}?',
    tip_title: '{meal} ấm bụng ngày trời mát!', tip: '{area} đang {weather}. Măm chọn sẵn {count} món nước nóng cho anh{place}.' } },
  { kind: 'template', id: 'M8-TPL-HOT', data: { condition: 'hot_sunny', title: '{emoji} {meal} nay nắng {temp}°C, giải nhiệt với {dish1} nhé?',
    tip_title: '{meal} thanh mát ngày nắng nóng!', tip: '{area} đang {weather}. Măm chọn {count} món thanh mát, dễ ăn cho anh{place}.' } },
  { kind: 'template', id: 'M8-TPL-MILD', data: { condition: 'mild', title: '{emoji} {meal} nay {temp}°C dễ chịu, thử {dish1} hay {dish2}?',
    tip_title: 'Đến giờ chọn món {mealLower} rồi!', tip: '{area} đang {weather}. Măm chọn sẵn {count} món hợp khẩu vị anh{place}.' } },
  { kind: 'template', id: 'M8-TPL-NOWEATHER', data: { condition: 'none', title: '🍽️ Đến giờ {mealLower} rồi, ăn {dish1} hay {dish2}?',
    tip_title: 'Đến giờ chọn món {mealLower} rồi!', tip: 'Măm chọn sẵn {count} món hợp khẩu vị anh{place}. Chọn khu vực ở Hồ sơ để Măm gợi ý theo thời tiết.' } },
  { kind: 'template', id: 'M8-TPL-LUNAR', data: { condition: 'lunar', title: '🪷 Hôm nay {lunar}, {mealLower} chay với {dish1}?',
    tip_title: 'Ngày ăn chay {lunar}', tip: 'Măm lọc sẵn {count} món chay hợp khẩu vị anh{place}.' } },
  { kind: 'template', id: 'M8-TPL-EMPTY', data: { condition: 'empty', title: '🍽️ Đến giờ {mealLower} rồi!',
    tip_title: 'Đến giờ chọn món {mealLower} rồi!', tip: 'Lúc này chưa có quán mở cửa phù hợp quanh anh. Mở "Gợi ý hôm nay" để Măm tìm thêm lựa chọn.' } }
];
const fill = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

// ── Settings ───────────────────────────────────────────────────────────────
const settingsId = userId => `M8-SET-${userId}`;
async function readSettings(ms, userId, profile) {
  const mr = profile?.meal_reminders || {};
  const s = userId ? await ms.get(settingsId(userId)) : null;
  const max = Number.isInteger(mr.max_per_day) ? Math.min(HARD_CAP, Math.max(0, mr.max_per_day)) : 0;
  return {
    lunch: TIME_RE.test(mr.lunch || '') ? mr.lunch : DEFAULTS.lunch,
    dinner: TIME_RE.test(mr.dinner || '') ? mr.dinner : DEFAULTS.dinner,
    max_per_day: max,
    meal_suggestions: max > 0,
    lunch_enabled: s ? s.lunch_enabled !== false : true,
    dinner_enabled: s ? s.dinner_enabled !== false : true,
    weather_aware: s ? s.weather_aware !== false : true,
    lunar_vegan_reminder: s ? s.lunar_vegan_reminder !== false : true,
    hard_cap_per_day: HARD_CAP, timezone: TZ
  };
}
async function writeSettings(ctx, patch) {
  const { ms, authUser, profile, repo } = ctx;
  const cur = await readSettings(ms, authUser.id, profile);
  const next = { ...cur, ...patch };
  if ('meal_suggestions' in patch && !('max_per_day' in patch)) next.max_per_day = patch.meal_suggestions ? HARD_CAP : 0;
  next.max_per_day = Math.min(HARD_CAP, Math.max(0, Math.round(next.max_per_day)));
  next.meal_suggestions = next.max_per_day > 0;
  if (next.lunch >= next.dinner) return { error: 'Giờ nhắc bữa trưa phải sớm hơn bữa tối' };
  profile.meal_reminders = { lunch: next.lunch, dinner: next.dinner, max_per_day: next.max_per_day };
  await repo.saveProfile(authUser.id, profile);
  const data = { lunch_enabled: next.lunch_enabled, dinner_enabled: next.dinner_enabled,
    weather_aware: next.weather_aware, lunar_vegan_reminder: next.lunar_vegan_reminder };
  const id = settingsId(authUser.id);
  if (await ms.get(id)) await ms.update(id, data);
  else {
    try { await ms.insert({ module: M, kind: 'settings', id, ownerId: authUser.id, data }); }
    catch (e) { if (e.status !== 409) throw e; await ms.update(id, data); }
  }
  return { settings: await readSettings(ms, authUser.id, profile) };
}
function parseSettingsBody(body, util, { schedule }) {
  const patch = {};
  if (schedule) {
    for (const k of ['lunch', 'dinner']) {
      if (body[k] === undefined) continue;
      const v = util.cleanText(body[k], 5);
      if (!TIME_RE.test(v)) return { error: `Giờ ${k === 'lunch' ? 'bữa trưa' : 'bữa tối'} phải có dạng HH:MM` };
      patch[k] = v;
    }
    if (body.max_per_day !== undefined) {
      const n = Number(body.max_per_day);
      if (!Number.isFinite(n)) return { error: 'max_per_day phải là số' };
      patch.max_per_day = Math.min(HARD_CAP, Math.max(0, Math.round(n))); // hard cap 2/day
    }
  }
  for (const k of ['meal_suggestions', 'lunch_enabled', 'dinner_enabled', 'weather_aware', 'lunar_vegan_reminder']) {
    if (body[k] === undefined) continue;
    if (typeof body[k] !== 'boolean') return { error: `${k} phải là true/false` };
    patch[k] = body[k];
  }
  return { patch };
}

// ── Daily cap (row-locked counter) ─────────────────────────────────────────
const dayId = (userId, date) => `M8-DAY-${userId}-${date}`;
async function sentToday(ms, userId, date) { return (await ms.get(dayId(userId, date)))?.n || 0; }
async function reserve(ms, userId, date, cap) {
  const id = dayId(userId, date);
  if (!(await ms.get(id))) {
    try { await ms.insert({ module: M, kind: 'daycount', id, ownerId: userId, data: { date, n: 0 } }); }
    catch (e) { if (e.status !== 409) throw e; }
  }
  let granted = false;
  await ms.update(id, cur => { if ((cur.n || 0) >= cap) return null; granted = true; return { ...cur, n: (cur.n || 0) + 1 }; });
  return granted;
}
async function release(ms, userId, date) {
  await ms.update(dayId(userId, date), cur => ({ ...cur, n: Math.max(0, (cur.n || 0) - 1) }));
}

// ── Message composition ────────────────────────────────────────────────────
async function weatherFor(profile, settings) {
  if (!settings.weather_aware || !locationChosen(profile)) return null;
  return currentWeather({ lat: profile.lat, lng: profile.lng });
}
async function compose(ctx, slot, weather, lunar, settings) {
  const meal = slot === 'dinner' ? 'dinner' : 'lunch';
  const view = await ctx.view();
  const scoped = scopeStoreToUser(view, null, { weather });
  const vegDay = settings.lunar_vegan_reminder && lunar?.is_vegetarian_day;
  const opts = { meal_slot: meal, ...(vegDay ? { diet_mode: 'vegetarian' } : {}) };
  let out = getTodaySuggestions(scoped, opts);
  if (!out.context?.valid) out = { items: [] };
  const dishes = (out.items || []).slice(0, 3).map(i => ({ dish_id: i.dish_id, name: i.name, price_vnd: i.price_vnd,
    img_key: i.img_key, is_sponsored: !!i.is_sponsored, badge_label: i.badge_label,
    nearest_place: i.nearest_place ? { place_id: i.nearest_place.place_id, place_name: i.nearest_place.place_name,
      distance_m: Math.round(i.nearest_place.distance_m) } : null }));
  const templates = await ctx.ms.list(M, 'template');
  const cond = !dishes.length ? 'empty' : vegDay ? 'lunar' : weather?.condition || 'none';
  const tpl = templates.find(t => t.condition === cond) || templates.find(t => t.condition === 'none') || { title: '🍽️ Đến giờ {mealLower} rồi!', tip_title: '', tip: '' };
  const near = dishes.find(d => d.nearest_place)?.nearest_place;
  const vars = { meal: SLOT_LABEL[meal], mealLower: SLOT_LABEL[meal].toLowerCase(), emoji: weather?.emoji || '🍽️',
    temp: weather?.temp_c ?? '', weather: weather ? weather.label.replace(' · ', ', ').toLowerCase() : '',
    area: ctx.profile?.area_name || 'Khu vực của anh', dish1: dishes[0]?.name || '', dish2: dishes[1]?.name || dishes[0]?.name || '',
    count: dishes.length, lunar: lunar ? (lunar.day === 1 ? 'mùng 1' : 'rằm') + ` tháng ${lunar.month} âm lịch` : '',
    place: near ? `, quán mở gần nhất "${near.place_name}" cách ${near.distance_m < 1000 ? near.distance_m + 'm' : (near.distance_m / 1000).toFixed(1) + 'km'}` : '' };
  return { title: fill(tpl.title, vars).replace(/\s+/g, ' ').trim(), body: fill(tpl.tip, vars), tip_title: fill(tpl.tip_title, vars),
    dishes, template_id: tpl.id || null, template_is_demo: !!tpl.is_demo,
    weather: weather ? { temp_c: weather.temp_c, label: weather.label, condition: weather.condition, emoji: weather.emoji, source: weather.source, observed_at: weather.observed_at } : null };
}
async function deliver(ctx, { slot, date, slotTime, test = false, cap }) {
  const { ms, authUser } = ctx;
  const id = test ? undefined : `M8-N-${authUser.id}-${date}-${slot}`;
  if (id && await ms.get(id)) return { duplicate: true };
  if (!(await reserve(ms, authUser.id, date, cap))) return { capped: true };
  const settings = await readSettings(ms, authUser.id, ctx.profile);
  const lunar = lunarInfo(date);
  const weather = await weatherFor(ctx.profile, settings);
  const msg = await compose(ctx, slot === 'test' ? (local().hh >= 14 ? 'dinner' : 'lunch') : slot, weather, lunar, settings);
  const now = isoOf(clock());
  try {
    const rec = await ms.insert({ module: M, kind: 'notification', id, ownerId: authUser.id, data: {
      slot, slot_time: slotTime || null, local_date: date, test, ...msg, lunar: lunar.is_vegetarian_day ? { day: lunar.day, month: lunar.month } : null,
      deeplink: 'M3-S01', channel: 'in_app', push: PUSH_SANDBOX, delivered_at: now, read_at: null } });
    return { record: rec };
  } catch (e) {
    await release(ms, authUser.id, date);
    if (e.status === 409) return { duplicate: true };
    throw e;
  }
}
/** Deliver today's due reminders (slot time passed, inside the 3h window, under the cap). */
async function dispatchDue(ctx, settings) {
  const now = clock(), today = local(now).date;
  if (settings.max_per_day <= 0) return;
  for (const slot of SLOTS) {
    if (!settings[`${slot}_enabled`]) continue;
    const at = slotInstant(today, settings[slot]);
    if (now < at || now - at > WINDOW_MS) continue;
    if (await sentToday(ctx.ms, ctx.authUser.id, today) >= settings.max_per_day) return;
    await deliver(ctx, { slot, date: today, slotTime: settings[slot], cap: settings.max_per_day });
  }
}
function upcoming(settings, inbox) {
  const now = clock(), today = local(now).date;
  return SLOTS.filter(s => settings[`${s}_enabled`]).map(slot => {
    let date = today;
    const delivered = inbox.some(n => n.slot === slot && n.local_date === today);
    if (delivered || now > slotInstant(today, settings[slot])) date = addDays(today, 1);
    const lunar = lunarInfo(date);
    const veg = settings.lunar_vegan_reminder && lunar.is_vegetarian_day;
    return { id: `upcoming-${slot}`, status: 'scheduled', slot, slot_time: settings[slot], local_date: date,
      scheduled_for: isoOf(slotInstant(date, settings[slot])), active: settings.max_per_day > 0,
      title: `${SLOT_LABEL[slot]} · ${settings[slot]}${date !== today ? ' (ngày mai)' : ''}`,
      body: settings.max_per_day <= 0 ? 'Nhắc bữa đang tắt — bật "Gợi ý món ăn theo bữa" để nhận.'
        : veg ? `Ngày ${lunar.day === 1 ? 'mùng 1' : 'rằm'} âm lịch: Măm sẽ gợi ý món chay lúc ${settings[slot]}.`
        : `Măm sẽ gợi ý món lúc ${settings[slot]}${settings.weather_aware ? ' theo thời tiết lúc đó' : ''}.`,
      read_at: null, push: PUSH_SANDBOX };
  });
}
const pubNote = n => ({ id: n.id, status: 'delivered', slot: n.slot, slot_time: n.slot_time, local_date: n.local_date, test: !!n.test,
  title: n.title, body: n.body, tip_title: n.tip_title, dishes: n.dishes || [], weather: n.weather || null, lunar: n.lunar || null,
  deeplink: n.deeplink, channel: n.channel, push: n.push, delivered_at: n.delivered_at, read_at: n.read_at,
  template_id: n.template_id, is_demo: !!n.template_is_demo });

async function inboxFor(ms, userId) {
  return (await ms.list(M, 'notification', { ownerId: userId })).sort((a, b) => String(b.delivered_at).localeCompare(String(a.delivered_at)));
}
async function summary(ctx) {
  const { ms, authUser, profile } = ctx;
  const today = local().date;
  const templatesDemo = (await ms.list(M, 'template')).some(t => t.is_demo);
  const settings = await readSettings(ms, authUser?.id, profile);
  const lunar = lunarInfo(today);
  if (!authUser) {
    const up = upcoming({ ...settings, max_per_day: HARD_CAP }, []);
    return { max_push_per_day: HARD_CAP, max_per_day: settings.max_per_day, timezone: TZ, local_date: today, signed_in: false,
      sent_today: 0, remaining_today: HARD_CAP, unread_count: 0, schedule: settings, settings, lunar_today: lunar,
      items: up, inbox: [], upcoming: up, push: PUSH_SANDBOX, is_demo: templatesDemo };
  }
  await dispatchDue(ctx, settings);
  const inbox = (await inboxFor(ms, authUser.id)).map(pubNote);
  const sent = await sentToday(ms, authUser.id, today);
  const up = upcoming(settings, inbox);
  return { max_push_per_day: HARD_CAP, max_per_day: settings.max_per_day, timezone: TZ, local_date: today, signed_in: true,
    sent_today: sent, remaining_today: Math.max(0, HARD_CAP - sent), unread_count: inbox.filter(n => !n.read_at).length,
    schedule: settings, settings, lunar_today: lunar, items: [...inbox.slice(0, 20), ...up], inbox: inbox.slice(0, 50), upcoming: up,
    push: PUSH_SANDBOX, is_demo: templatesDemo };
}

export default {
  id: M,
  personalKinds: ['notification', 'settings'],
  seed,
  // Early: the core router answers GET /notifications (static sample) and PUT /me/meal-schedule.
  async routeEarly(ctx) {
    const { ms, method, pathname, body, authUser, util } = ctx;
    if (pathname === '/api/v1/notifications' && method === 'GET') return { status: 200, data: await summary(ctx) };

    if (pathname === '/api/v1/notifications/test' && method === 'POST') {
      if (!authUser) return util.unauthorized();
      const today = local().date;
      const out = await deliver(ctx, { slot: 'test', date: today, test: true, cap: HARD_CAP });
      if (out.capped) return { status: 429, data: { error: `Đã đạt giới hạn ${HARD_CAP} thông báo/ngày (chống làm phiền). Thử lại vào ngày mai.`, capped: true, sent_today: await sentToday(ms, authUser.id, today), max_push_per_day: HARD_CAP } };
      const sent = await sentToday(ms, authUser.id, today);
      return { status: 201, data: { notification: pubNote(out.record), sent_today: sent, remaining_today: Math.max(0, HARD_CAP - sent), push: PUSH_SANDBOX, sandbox: true } };
    }
    if (pathname === '/api/v1/notifications/read-all' && method === 'POST') {
      if (!authUser) return util.unauthorized();
      const now = isoOf(clock());
      let n = 0;
      for (const r of await ms.list(M, 'notification', { ownerId: authUser.id })) if (!r.read_at) { await ms.update(r.id, { read_at: now }); n++; }
      return { status: 200, data: { marked_read: n } };
    }
    const one = pathname.match(/^\/api\/v1\/notifications\/([^/]+?)(\/read)?$/);
    if (one && !['batch-dispatch', 'queue-status', 'test', 'read-all'].includes(one[1])) {
      const id = decodeURIComponent(one[1]);
      if (method === 'GET' && !one[2] && /^upcoming-(lunch|dinner)$/.test(id)) {
        const s = await summary(ctx);
        const item = s.upcoming.find(u => u.id === id);
        return item ? { status: 200, data: { ...item, lunar_today: s.lunar_today, is_demo: s.is_demo } } : util.notFound('Khung giờ này đang tắt');
      }
      if ((method === 'GET' && !one[2]) || (method === 'POST' && one[2])) {
        if (!authUser) return util.unauthorized();
        const rec = await ms.get(id);
        if (!rec || rec.module !== M || rec.kind !== 'notification') return util.notFound('Không tìm thấy thông báo');
        if (rec.owner_id !== authUser.id) return util.forbidden('Thông báo này không thuộc tài khoản của bạn');
        if (method === 'GET') return { status: 200, data: pubNote(rec) };
        const upd = rec.read_at ? rec : await ms.update(id, { read_at: isoOf(clock()) });
        return { status: 200, data: pubNote(upd) };
      }
    }

    const isSchedule = pathname === '/api/v1/me/meal-schedule';
    const isSettings = pathname === '/api/v1/me/notification-settings';
    if (isSchedule || isSettings) {
      if (!authUser) return util.unauthorized();
      if (method === 'GET') return { status: 200, data: await readSettings(ms, authUser.id, ctx.profile) };
      if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
        const { patch, error } = parseSettingsBody(body, util, { schedule: isSchedule });
        if (error) return util.bad(error);
        const out = await writeSettings(ctx, patch);
        return out.error ? util.bad(out.error) : { status: 200, data: out.settings };
      }
    }
    return null;
  }
};
