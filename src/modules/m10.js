// M10 — Analytics & Event tracking (M10-S01..S06, desktop tab "analytics"). Admin only
// (/api/v1/analytics/* is super_admin in accessPolicy); event ingestion POST /api/v1/events is public.
//
// Storage (module_records)
//   M10/event        one stored event { name, ts, session_id, actor, platform, props }
//                    owner_id = the signed-in user (null for anonymous / demo actors)
//   M10/experiment   A/B test definitions (demo seeded); results computed from events
//   M10/nlu_case     Vietnamese intent test sentences with the expected fields (demo seeded)
//   M10/ai_run       each benchmark run (NLU accuracy + recommendation safety audit)
//
// Every metric is computed from stored events plus real repository data (order redirects,
// ad campaigns' counters, completed ad payments). Demo events are flagged is_demo and the
// responses say how many of the counted events were demo.
import { extractVietnameseIntent } from '../services/intentParser.js';
import { runVietnameseIntentBenchmark } from '../services/expansionServices.js';
import { getTodaySuggestions } from '../services/recommender.js';
import { scopeStoreToUser } from '../services/authService.js';
import { getPlaceOpenStatus } from '../services/placeHours.js';

const M = 'M10';
export const EVENTS = ['app_open', 'suggestion_shown', 'suggestion_swiped', 'dish_view', 'recipe_view', 'place_view',
  'order_click', 'direction_click', 'call_click', 'chat_query', 'save_dish', 'ad_impression', 'ad_click', 'report_issue'];
const CONVERSIONS = new Set(['order_click', 'direction_click', 'call_click']);
const DAY = 86400_000, TZ_MS = 7 * 3600_000;
const NLU_TARGET = 90, LATENCY_SLA_MS = 1500, SPONSOR_CAP = 1 / 3;

let clock = () => new Date();
export function __setNow(fn) { clock = fn || (() => new Date()); }
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${String(d.getUTCMilliseconds()).padStart(3, '0')}Z`;
const ms_ = v => { const t = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : NaN; };
const dayKey = t => { const d = new Date(t + TZ_MS); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const dayIndex = t => Math.floor((t + TZ_MS) / DAY);
const hourOf = t => new Date(t + TZ_MS).getUTCHours();
const mealOf = t => { const h = hourOf(t); return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 17 ? 'snack' : 'dinner'; };
const pct = (a, b, digits = 1) => (b > 0 ? Number(((a / b) * 100).toFixed(digits)) : null);
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantile = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]; };

// ── Demo seed ──────────────────────────────────────────────────────────────
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hashStr = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const variantOf = (actor, expId) => (hashStr(`${actor}:${expId}`) % 2 ? 'B' : 'A');
const DISHES = ['DISH-101', 'DISH-102', 'DISH-103', 'DISH-104', 'DISH-105', 'DISH-106', 'DISH-108', 'DISH-109', 'DISH-110', 'DISH-111', 'DISH-112'];
const PLACE_OF = { 'DISH-101': 'PLACE-401', 'DISH-102': 'PLACE-402', 'DISH-103': 'PLACE-403', 'DISH-104': 'PLACE-404', 'DISH-105': 'PLACE-405',
  'DISH-106': 'PLACE-401', 'DISH-108': 'PLACE-406', 'DISH-109': 'PLACE-406', 'DISH-110': 'PLACE-405', 'DISH-111': 'PLACE-408', 'DISH-112': 'PLACE-407' };
const CHAT = ['Trưa nay 2 người ăn gì dưới 120k gần Bửu Long?', 'Tối nay 4 người có trẻ nhỏ, 300k', 'Món nước nóng ngày mưa ở Tân Tiến',
  'Ăn chay rằm ở Biên Hòa', 'Bún bò Huế nào gần Quyết Thắng còn mở?'];
const EXPERIMENTS = [
  { id: 'EXP-RANK', name: 'Thứ tự gợi ý — Ưu tiên thời tiết (B) vs Ưu tiên khẩu vị (A)', metric: 'dish_view_rate', metric_label: 'Tỷ lệ xem món',
    variants: { A: 'Taste-first', B: 'Weather-first' }, status: 'running', started_days_ago: 28 },
  { id: 'EXP-WHEEL', name: 'Vòng quay chọn món — 3D (B) vs 2D (A)', metric: 'conversion_rate', metric_label: 'Tỷ lệ chuyển đổi',
    variants: { A: '2D', B: '3D' }, status: 'running', started_days_ago: 21 },
  { id: 'EXP-PUSH', name: 'Giờ nhắc bữa trưa — 10:30 (A) vs 11:00 (B)', metric: 'push_open_rate', metric_label: 'Tỷ lệ mở app từ nhắc bữa',
    variants: { A: '10:30', B: '11:00' }, status: 'running', started_days_ago: 14 }
];
const NLU_CASES = [
  ['Trưa nay 3 người ăn gì ở Biên Hòa dưới 150k?', { party_size: 3, total_budget_vnd: 150000, has_kids: false, meal_slot: 'lunch' }],
  ['Tối nay cả nhà 5 người, có 2 bé, ngân sách 500k', { party_size: 5, total_budget_vnd: 500000, has_kids: true, meal_slot: 'dinner' }],
  ['Sáng nay 1 người ăn nhanh 30k gần chợ Biên Hòa', { party_size: 1, total_budget_vnd: 30000, has_kids: false, meal_slot: 'breakfast' }],
  ['Nhóm 8 người đi ăn lẩu tối thứ bảy 1 triệu', { party_size: 8, total_budget_vnd: 1000000, has_kids: false, meal_slot: 'dinner' }],
  ['Hai vợ chồng ăn trưa 200k không cay', { party_size: 2, total_budget_vnd: 200000, has_kids: false, meal_slot: 'lunch' }],
  ['Đi ăn tối 4 người có trẻ nhỏ khoảng 400k gần Vincom Biên Hòa', { party_size: 4, total_budget_vnd: 400000, has_kids: true, meal_slot: 'dinner' }],
  ['Mình ăn trưa một mình 50k thôi', { party_size: 1, total_budget_vnd: 50000, has_kids: false, meal_slot: 'lunch' }],
  ['Tủ lạnh còn trứng với cà chua, nấu gì cho 3 người 80k?', { party_size: 3, total_budget_vnd: 80000, has_kids: false, mode: 'cook' }],
  ['Bữa tối gia đình 6 người 700k có con nhỏ', { party_size: 6, total_budget_vnd: 700000, has_kids: true, meal_slot: 'dinner' }],
  ['Ăn xế chiều 2 người 60k', { party_size: 2, total_budget_vnd: 60000, has_kids: false, meal_slot: 'snack' }],
  ['Trưa nay 10 người công ty ngân sách 1.5 triệu', { party_size: 10, total_budget_vnd: 1500000, has_kids: false, meal_slot: 'lunch' }],
  ['Cuối tuần 4 người đi ăn hải sản 800k', { party_size: 4, total_budget_vnd: 800000, has_kids: false }],
  ['Tối nay 2 người muốn ăn chay 120k', { party_size: 2, total_budget_vnd: 120000, has_kids: false, meal_slot: 'dinner', diet_mode: 'vegetarian' }],
  ['Sáng mai 3 người ăn phở 120 nghìn', { party_size: 3, total_budget_vnd: 120000, has_kids: false, meal_slot: 'breakfast' }],
  ['Trưa nay 4 suất cơm văn phòng 160k', { party_size: 4, total_budget_vnd: 160000, has_kids: false, meal_slot: 'lunch' }],
  ['Tối nay đãi khách 12 người 2 triệu', { party_size: 12, total_budget_vnd: 2000000, has_kids: false, meal_slot: 'dinner' }],
  ['Gia đình có em bé, đi ăn trưa 300k', { total_budget_vnd: 300000, has_kids: true, meal_slot: 'lunch' }],
  ['3 người ăn tối không cay dưới 250k', { party_size: 3, total_budget_vnd: 250000, has_kids: false, meal_slot: 'dinner' }],
  ['Ăn sáng 2 người 70k gần Amata', { party_size: 2, total_budget_vnd: 70000, has_kids: false, meal_slot: 'breakfast' }],
  ['Nhóm bạn 5 người ăn vặt 150k', { party_size: 5, total_budget_vnd: 150000, has_kids: false, meal_slot: 'snack' }],
  ['Trưa 1 người 45 ngàn', { party_size: 1, total_budget_vnd: 45000, has_kids: false, meal_slot: 'lunch' }],
  ['Tối nay 4 người trong đó 2 trẻ nhỏ, 350k', { party_size: 4, total_budget_vnd: 350000, has_kids: true, meal_slot: 'dinner' }],
  ['Muốn ăn bún bò cho 2 người tầm 100 nghìn buổi trưa', { party_size: 2, total_budget_vnd: 100000, has_kids: false, meal_slot: 'lunch' }],
  ['Đặt bàn 6 khách tối mai 900k', { party_size: 6, total_budget_vnd: 900000, has_kids: false, meal_slot: 'dinner' }]
];

function demoEvents(now = Date.now()) {
  const r = rng(20261126), out = [];
  const today = dayIndex(now);
  let n = 0;
  const push = (name, t, session, actor, props = {}) => out.push({ kind: 'event', id: `M10-EV-${String(++n).padStart(5, '0')}`,
    data: { name, ts: isoOf(new Date(t)), session_id: session, actor, platform: r() < 0.7 ? 'mobile' : 'web', props } });
  for (let u = 1; u <= 64; u++) {
    const actor = `DEMO-U${pad(u)}`;
    const first = today - Math.floor(r() * 30);
    const loyal = r();
    const last = first + 3 + Math.floor(r() * 40); // users churn after a while
    for (let d = first; d <= Math.min(today, last); d++) {
      if (d > first && r() > 0.08 + loyal * 0.3) continue;
      const sessions = r() < 0.25 ? 2 : 1;
      for (let s = 0; s < sessions; s++) {
        const lunch = s === 0 ? r() < 0.6 : false;
        const hour = lunch ? 10 + Math.floor(r() * 3) : 17 + Math.floor(r() * 3);
        let t = d * DAY - TZ_MS + hour * 3600_000 + Math.floor(r() * 3600_000);
        if (t > now) continue;
        const session = `DEMO-S-${actor}-${d}-${s}`;
        const exp = Object.fromEntries(EXPERIMENTS.map(e => [e.id, variantOf(actor, e.id)]));
        push('app_open', t, session, actor, { exp, source: lunch && r() < 0.4 ? 'meal_reminder' : 'organic' });
        if (r() > 0.95) continue;
        const sponsored = r() < 0.32 ? 1 : 0;
        const shown = [0, 1, 2].map(() => DISHES[Math.floor(r() * DISHES.length)]);
        t += 400 + Math.floor(r() * 900);
        push('suggestion_shown', t, session, actor, { items: 3, sponsored, dish_ids: shown, latency_ms: 280 + Math.floor(r() * 1100) });
        if (sponsored) push('ad_impression', t + 50, session, actor, { campaign_id: ['CMP-701', 'CMP-703', 'CMP-704'][Math.floor(r() * 3)] });
        const swiped = r() < 0.33;
        if (swiped) { t += 4000 + Math.floor(r() * 8000); push('suggestion_swiped', t, session, actor, { direction: 'left' }); }
        const lift = exp['EXP-RANK'] === 'B' ? 0.08 : 0;
        if (r() < 0.12) { t += 6000; push('chat_query', t, session, actor, { query: CHAT[Math.floor(r() * CHAT.length)] }); }
        if (r() > 0.6 + lift) continue;
        const rank = 1 + Math.floor(r() * 3), dish = shown[rank - 1];
        t += 5000 + Math.floor(r() * 20000);
        push('dish_view', t, session, actor, { dish_id: dish, rank, sponsored: sponsored === 1 && rank === 3, source: 'suggestion' });
        if (sponsored && rank === 3 && r() < 0.5) push('ad_click', t + 20, session, actor, { campaign_id: 'CMP-701' });
        if (r() < 0.08) push('save_dish', t + 1500, session, actor, { dish_id: dish });
        const recipe = r() < 0.22;
        if (r() > 0.66 && !recipe) continue;
        t += 4000 + Math.floor(r() * 15000);
        if (recipe) { push('recipe_view', t, session, actor, { dish_id: dish }); continue; }
        push('place_view', t, session, actor, { place_id: PLACE_OF[dish], dish_id: dish });
        if (r() < 0.01) push('report_issue', t + 3000, session, actor, { place_id: PLACE_OF[dish], reason: 'closed' });
        const wheelLift = exp['EXP-WHEEL'] === 'B' ? 0.06 : 0;
        if (r() > 0.55 + wheelLift) continue;
        t += 3000 + Math.floor(r() * 40000);
        const x = r();
        const nm = x < 0.42 ? 'direction_click' : x < 0.95 ? 'order_click' : 'call_click';
        const y = r();
        const partner = nm === 'direction_click' ? 'maps' : nm === 'call_click' ? 'phone' : y < 0.4 ? 'grabfood' : y < 0.7 ? 'shopeefood' : y < 0.85 ? 'befood' : 'xanhsm';
        push(nm, t, session, actor, { place_id: PLACE_OF[dish], dish_id: dish, partner });
      }
    }
  }
  return out;
}
const seed = () => [
  ...EXPERIMENTS.map(e => ({ kind: 'experiment', id: e.id, data: { ...e, started_at: isoOf(new Date(Date.now() - e.started_days_ago * DAY)) } })),
  ...NLU_CASES.map(([query, expect], i) => ({ kind: 'nlu_case', id: `M10-NLU-${pad(i + 1)}`, data: { query, expect } })),
  ...demoEvents()
];

// ── Data access ────────────────────────────────────────────────────────────
async function loadEvents(ms) {
  return (await ms.list(M, 'event')).map(e => ({ ...e, t: ms_(e.ts) })).filter(e => Number.isFinite(e.t)).sort((a, b) => a.t - b.t);
}
/** Repository redirects not already counted through a tracked event (props.redirect_id). */
async function realRedirects(repo, events) {
  const tracked = new Set(events.map(e => e.props?.redirect_id).filter(Boolean));
  return (await allRedirects(repo)).filter(o => !tracked.has(o.id)).map(redirectEvent).filter(e => Number.isFinite(e.t));
}
async function allRedirects(repo) {
  try {
    if (repo.kind === 'memory') return [...(repo.store?.orderRedirects || [])];
    const r = await repo.q('SELECT id, user_id, place_id, dish_id, partner, action_type, created_at, clicked_at FROM order_redirects ORDER BY created_at');
    return r.rows;
  } catch { return []; }
}
async function completedPayments(repo) {
  try {
    if (repo.kind === 'memory') return Object.values(repo.store?.paymentOrders || {}).filter(o => /COMPLETED|PAID/i.test(o.status || ''));
    return (await repo.q("SELECT amount_vnd, status, paid_at, created_at FROM payment_orders WHERE status IN ('COMPLETED','PAID')")).rows;
  } catch { return []; }
}
const redirectTime = o => ms_(o.clicked_at instanceof Date ? o.clicked_at.getTime() : o.clicked_at) || ms_(o.created_at instanceof Date ? o.created_at.getTime() : o.created_at);
const redirectEvent = o => ({ name: o.partner === 'maps' ? 'direction_click' : o.partner === 'phone' ? 'call_click' : 'order_click',
  t: redirectTime(o), actor: `user:${o.user_id || 'deleted'}`, session_id: `redirect:${o.id}`, is_demo: false, real_redirect: true,
  props: { partner: o.partner, place_id: o.place_id, dish_id: o.dish_id } });

function windowOf(searchParams, util) {
  const days = Math.round(util.cleanNumber(searchParams.get('days') || undefined, 1, 90, 7));
  const now = clock().getTime();
  return { days, now, from: now - days * DAY, prevFrom: now - 2 * days * DAY };
}
const inWin = (e, a, b) => e.t >= a && e.t <= b; // upper bound inclusive: an event stamped in the same ms as "now" still counts
function bySession(events) {
  const m = new Map();
  for (const e of events) { if (!m.has(e.session_id)) m.set(e.session_id, []); m.get(e.session_id).push(e); }
  return m;
}
const has = (list, names) => list.some(e => names.includes(e.name));
function sourceNote(events) {
  const demo = events.filter(e => e.is_demo).length;
  return { events_counted: events.length, demo_events: demo, real_events: events.length - demo, is_demo: demo > 0 };
}

// ── Metrics ────────────────────────────────────────────────────────────────
function decisionTimes(events) {
  const out = [];
  for (const list of bySession(events).values()) {
    const shown = list.find(e => e.name === 'suggestion_shown');
    const conv = list.find(e => CONVERSIONS.has(e.name) && shown && e.t >= shown.t);
    if (shown && conv) out.push((conv.t - shown.t) / 1000);
  }
  return out;
}
function wamd(events, from, to) {
  const set = new Set();
  for (const e of events) if (CONVERSIONS.has(e.name) && inWin(e, from, to)) set.add(`${e.actor}|${dayKey(e.t)}|${mealOf(e.t)}`);
  return set.size;
}
function dauMau(events, from, to) {
  const win = events.filter(e => inWin(e, from, to));
  const days = new Map();
  for (const e of win) { const k = dayKey(e.t); if (!days.has(k)) days.set(k, new Set()); days.get(k).add(e.actor); }
  const nDays = Math.max(1, Math.round((to - from) / DAY));
  const dau = [...days.values()].reduce((s, x) => s + x.size, 0) / nDays;
  const mau = new Set(events.filter(e => inWin(e, to - 30 * DAY, to)).map(e => e.actor)).size;
  return { dau: Number(dau.toFixed(1)), mau, pct: pct(dau, mau) };
}
function retention(events, now) {
  const first = new Map(), active = new Map();
  for (const e of events) {
    const d = dayIndex(e.t);
    if (!first.has(e.actor) || d < first.get(e.actor)) first.set(e.actor, d);
    if (!active.has(e.actor)) active.set(e.actor, new Set());
    active.get(e.actor).add(d);
  }
  const today = dayIndex(now);
  const calc = (n, span) => {
    let cohort = 0, kept = 0;
    for (const [actor, f] of first) {
      if (f + n > today) continue; // window has started (partial windows count)
      cohort++;
      const days = active.get(actor);
      for (let d = f + n; d < f + n + span; d++) if (days.has(d)) { kept++; break; }
    }
    return { pct: pct(kept, cohort), cohort, retained: kept };
  };
  return { d1: calc(1, 1), d7: calc(7, 7), d30: calc(30, 7) };
}
function latencies(events) { return events.filter(e => e.name === 'suggestion_shown' && Number.isFinite(Number(e.props?.latency_ms))).map(e => Number(e.props.latency_ms)); }
function top3NoRefresh(events) {
  let shownSessions = 0, picked = 0;
  for (const list of bySession(events).values()) {
    if (!has(list, ['suggestion_shown'])) continue;
    shownSessions++;
    const view = list.find(e => e.name === 'dish_view' && Number(e.props?.rank) <= 3);
    if (view && !list.some(e => e.name === 'suggestion_swiped' && e.t < view.t)) picked++;
  }
  return { pct: pct(picked, shownSessions), sessions: shownSessions, picked };
}
function funnel(events, redirects) {
  const sessions = [...bySession(events).values()];
  const s = names => sessions.filter(l => has(l, names)).length;
  const base = s(['app_open']);
  const conv = s([...CONVERSIONS]);
  const stages = [
    { key: 'suggestion_shown', label: 'app_open → suggestion_shown', count: s(['suggestion_shown']) },
    { key: 'engage', label: 'dish_view / chat_query (Tương tác chọn món)', count: s(['dish_view', 'chat_query']) },
    { key: 'place', label: 'place_view / recipe_view (Xem quán hoặc Công thức)', count: s(['place_view', 'recipe_view']) },
    { key: 'conversion', label: 'order_click / direction_click / call_click (Conversion)', count: conv + redirects.length, from_events: conv, from_redirects: redirects.length }
  ].map(x => ({ ...x, pct: base ? Math.min(100, pct(x.count, base)) : 0 }));
  return { base_sessions: base, stages };
}
function conversions(events) {
  const buckets = { maps: 0, grabfood: 0, shopeefood: 0, other: 0, phone: 0 };
  const byPartner = {};
  const dirHours = new Array(24).fill(0);
  for (const e of events) {
    if (!CONVERSIONS.has(e.name)) continue;
    const p = e.props?.partner || (e.name === 'direction_click' ? 'maps' : e.name === 'call_click' ? 'phone' : 'other');
    byPartner[p] = (byPartner[p] || 0) + 1;
    if (p === 'maps') { buckets.maps++; dirHours[hourOf(e.t)]++; }
    else if (p === 'grabfood' || p === 'shopeefood' || p === 'phone') buckets[p]++;
    else buckets.other++;
  }
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  const peak = dirHours.reduce((best, n, h) => (n > best.n ? { h, n } : best), { h: null, n: 0 });
  return { total, buckets, by_partner: byPartner, share: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, pct(v, total)])),
    direction_peak: peak.h === null ? null : { from: `${pad(peak.h)}:00`, to: `${pad((peak.h + 1) % 24)}:00`, clicks: peak.n, pct_of_directions: pct(peak.n, buckets.maps) } };
}
function adsHealth(events, campaigns) {
  let slots = 0, sponsored = 0, organicSlots = 0, overCap = 0, lists = 0;
  for (const e of events) if (e.name === 'suggestion_shown') {
    const items = Number(e.props?.items) || 0, sp = Number(e.props?.sponsored) || 0;
    lists++; slots += items; sponsored += sp; organicSlots += Math.max(0, items - sp);
    if (items && sp / items > SPONSOR_CAP + 1e-9) overCap++;
  }
  const organicViews = events.filter(e => e.name === 'dish_view' && e.props?.source === 'suggestion' && !e.props?.sponsored).length;
  const impressions = campaigns.reduce((s, c) => s + (Number(c.impressions) || 0), 0);
  const clicks = campaigns.reduce((s, c) => s + (Number(c.clicks) || 0), 0);
  const evImp = events.filter(e => e.name === 'ad_impression').length, evClk = events.filter(e => e.name === 'ad_click').length;
  return { lists, slots, sponsored_slots: sponsored, sponsored_ratio_pct: pct(sponsored, slots), cap_pct: Number((SPONSOR_CAP * 100).toFixed(1)),
    lists_over_cap: overCap, organic_ctr_pct: pct(organicViews, organicSlots),
    sponsored_ctr_pct: pct(clicks, impressions), campaign_impressions: impressions, campaign_clicks: clicks,
    event_ad_impressions: evImp, event_ad_clicks: evClk, event_sponsored_ctr_pct: pct(evClk, evImp),
    active_campaigns: campaigns.filter(c => c.status === 'active' || c.is_active).length };
}
function zTest(c1, n1, c2, n2) {
  if (!n1 || !n2) return null;
  const p = (c1 + c2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return null;
  const z = Math.abs(c1 / n1 - c2 / n2) / se;
  // two-sided p-value via erfc approximation
  const t = 1 / (1 + 0.3275911 * z / Math.SQRT2);
  const erfc = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-(z * z) / 2);
  return Number(erfc.toFixed(4));
}
function abResults(exps, events) {
  const sessions = [...bySession(events).values()];
  return exps.map(x => {
    const arms = { A: { sessions: 0, hits: 0 }, B: { sessions: 0, hits: 0 } };
    for (const list of sessions) {
      const open = list.find(e => e.name === 'app_open');
      const v = open?.props?.exp?.[x.id];
      if (!arms[v]) continue;
      if (x.metric === 'push_open_rate') { arms[v].sessions++; if (open.props?.source === 'meal_reminder') arms[v].hits++; continue; }
      if (x.metric === 'dish_view_rate') { if (!has(list, ['suggestion_shown'])) continue; arms[v].sessions++; if (has(list, ['dish_view'])) arms[v].hits++; continue; }
      arms[v].sessions++; if (has(list, [...CONVERSIONS])) arms[v].hits++;
    }
    const rate = a => (a.sessions ? Number((a.hits / a.sessions).toFixed(3)) : null);
    const p = zTest(arms.A.hits, arms.A.sessions, arms.B.hits, arms.B.sessions);
    const enough = arms.A.sessions >= 30 && arms.B.sessions >= 30;
    const better = rate(arms.B) > rate(arms.A) ? 'B' : 'A';
    const winner = enough && p !== null && p < 0.05 ? `${better} (${x.variants[better]})` : null;
    return { id: x.id, name: x.name, status: x.status, metric: x.metric, metric_label: x.metric_label, variants: x.variants,
      started_at: x.started_at, is_demo: x.is_demo,
      variant_a: { ...arms.A, rate: rate(arms.A) }, variant_b: { ...arms.B, rate: rate(arms.B) },
      variant_a_rate: rate(arms.A), variant_b_rate: rate(arms.B),
      uplift_pct: rate(arms.A) ? Number((((rate(arms.B) - rate(arms.A)) / rate(arms.A)) * 100).toFixed(1)) : null,
      p_value: p, significant: winner !== null, winner: winner || (enough ? 'Chưa có khác biệt có ý nghĩa' : 'Chưa đủ dữ liệu (cần ≥30 phiên mỗi nhánh)') };
  });
}

// ── AI benchmark (real run) ────────────────────────────────────────────────
const FIELDS = ['party_size', 'total_budget_vnd', 'has_kids', 'meal_slot', 'mode', 'diet_mode'];
async function runAi(ctx) {
  const { ms, repo } = ctx;
  const view = await ctx.view();
  const base = { ...(view.userProfile || {}), hard_allergies: [], disliked_dish_ids: [], diet_mode: 'balanced', budget_max: 60000, meal_slot: 'lunch' };
  // 1) NLU: the core 6-case suite (runVietnameseIntentBenchmark, real parser) + the seeded M10 sentences.
  const core = runVietnameseIntentBenchmark({ userProfile: base });
  const cases = await ms.list(M, 'nlu_case');
  const details = core.details.map(d => ({ query: d.query, passed: d.passed, parsed: d.parsed, source: 'core', checked: ['party_size', 'total_budget_vnd', 'has_kids'], failed_fields: d.passed ? [] : ['party_size/total_budget_vnd/has_kids'] }));
  for (const c of cases) {
    const parsed = extractVietnameseIntent(c.query, base);
    const checked = FIELDS.filter(f => c.expect?.[f] !== undefined);
    const failed = checked.filter(f => parsed[f] !== c.expect[f]);
    details.push({ id: c.id, query: c.query, passed: failed.length === 0, parsed, expected: c.expect, checked, failed_fields: failed, source: 'm10', is_demo: c.is_demo });
  }
  const passed = details.filter(d => d.passed).length;
  const accuracy = pct(passed, details.length) ?? 0;
  // 2) Safety audit: the real recommender over test profiles (allergy sets × meal × recent history).
  const allergySets = [[], ['shrimp'], ['peanut', 'shrimp'], ['egg'], ['gluten'], ['fish'], ['shrimp', 'egg', 'gluten']];
  const now = clock().getTime();
  let lists = 0, items = 0, allergyViol = 0, closedViol = 0, closedShown = 0, repeatViol = 0, overCap = 0, sponsoredItems = 0;
  const placeById = new Map((view.places || []).map(p => [p.id, p]));
  const lat = [];
  for (const allergies of allergySets) for (const meal of ['lunch', 'dinner']) for (const recent of [false, true]) {
    const profile = { ...base, hard_allergies: allergies, meal_slot: meal };
    const history = recent ? ['DISH-101', 'DISH-103'].map((d, i) => ({ id: `audit-${d}`, dish_id: d, action: 'eaten', created_at: isoOf(new Date(now - (i + 1) * 20 * 3600_000)) })) : [];
    const scoped = scopeStoreToUser(view, null, { userProfile: profile, suggestionHistory: history, weather: null });
    const out = getTodaySuggestions(scoped, { meal_slot: meal });
    if (!out.context?.valid) continue;
    lists++; lat.push(out.latency_ms);
    const eaten = new Set(history.map(h => h.dish_id));
    let sp = 0;
    for (const it of out.items) {
      items++;
      if ((it.allergen_tags || []).some(t => allergies.includes(t))) allergyViol++;
      if (it.nearest_place) {
        // Violation: a paused / reported-closed / force-closed place, or "open" shown while its hours say closed.
        const raw = placeById.get(it.nearest_place.place_id);
        const actuallyOpen = raw ? getPlaceOpenStatus(raw, now).is_currently_open : false;
        if (!raw || raw.is_paused || raw.is_open_override === false || (raw.closed_report_count ?? 0) >= 3
          || (it.nearest_place.is_currently_open === true && !actuallyOpen)) closedViol++;
        if (it.nearest_place.is_currently_open === false) closedShown++;
      }
      if (eaten.has(it.dish_id)) repeatViol++;
      if (it.is_sponsored) sp++;
    }
    sponsoredItems += sp;
    if (out.items.length && sp / out.items.length > SPONSOR_CAP + 1e-9) overCap++;
  }
  const rate = v => (items ? Number(((v / items) * 100).toFixed(2)) : null);
  const run = { ran_at: isoOf(clock()), nlu: { cases: details.length, passed, accuracy_pct: accuracy, target_pct: NLU_TARGET, passed_sla: accuracy >= NLU_TARGET,
      core_cases: core.details.length, m10_cases: cases.length, details },
    safety: { lists, items, allergy_violations: allergyViol, allergy_violation_pct: rate(allergyViol), closed_place_violations: closedViol,
      closed_place_pct: rate(closedViol), closed_now_labelled: closedShown, repeat_3d_violations: repeatViol, repeat_3d_pct: rate(repeatViol), sponsored_items: sponsoredItems,
      lists_over_sponsor_cap: overCap, latency_p95_ms: quantile(lat, 0.95), profiles: allergySets.length * 4,
      note: items ? null : 'Lúc chạy kiểm thử không có quán nào đang mở phù hợp nên chưa có món để kiểm tra.' } };
  await ms.insert({ module: M, kind: 'ai_run', data: run });
  return run;
}
async function latestRun(ctx, force = false) {
  if (!force) {
    const runs = (await ctx.ms.list(M, 'ai_run')).sort((a, b) => ms_(b.ran_at) - ms_(a.ran_at));
    if (runs[0]) return runs[0];
  }
  return runAi(ctx);
}

// ── Event ingestion ────────────────────────────────────────────────────────
function cleanProps(raw, util) {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const [k, v] of Object.entries(raw).slice(0, 20)) {
    const key = util.cleanText(k, 40);
    if (!key) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    else if (typeof v === 'boolean') out[key] = v;
    else if (typeof v === 'string') out[key] = util.cleanText(v, 200);
    else if (Array.isArray(v)) out[key] = v.slice(0, 10).map(x => (typeof x === 'number' ? x : util.cleanText(String(x), 60)));
    else if (v && typeof v === 'object') out[key] = Object.fromEntries(Object.entries(v).slice(0, 10).map(([a, b]) => [util.cleanText(a, 40), typeof b === 'number' ? b : util.cleanText(String(b), 60)]));
  }
  return JSON.stringify(out).length > 2048 ? null : out;
}
function parseEvent(b, ctx) {
  const { util, userId } = ctx;
  if (!b || typeof b !== 'object') return { error: 'Sự kiện phải là đối tượng JSON' };
  const name = util.cleanText(b.event_name ?? b.event ?? b.name, 40);
  if (!EVENTS.includes(name)) return { error: `Tên sự kiện không thuộc 14 sự kiện chuẩn: ${name || '(trống)'}` };
  const props = cleanProps(b.properties ?? b.props, util);
  if (props === null) return { error: 'properties không hợp lệ hoặc quá lớn (tối đa 2KB)' };
  const session = util.cleanText(b.session_id, 64) || `srv-${Math.random().toString(36).slice(2, 10)}`;
  const platform = ['mobile', 'web', 'desktop'].includes(b.platform) ? b.platform : 'web';
  return { data: { name, ts: isoOf(clock()), session_id: session, actor: userId ? `user:${userId}` : `anon:${session}`, platform, props } };
}
async function storeEvent(ctx, data) {
  ctx.store.analyticsEvents = ctx.store.analyticsEvents || {};
  ctx.store.analyticsEvents[data.name] = (ctx.store.analyticsEvents[data.name] || 0) + 1;
  return ctx.ms.insert({ module: M, kind: 'event', ownerId: ctx.userId || null, data });
}
const pubEvent = e => ({ id: e.id, name: e.name, ts: e.ts || isoOf(new Date(e.t)), session_id: e.session_id,
  actor: String(e.actor || '').replace(/^(user:)(.{4}).*$/, '$1$2…'), platform: e.platform, props: e.props || {}, is_demo: !!e.is_demo, real_redirect: !!e.real_redirect });

// ── Shared admin chrome (sidebar / header numbers on every M10 screen) ─────
async function chrome(ctx, events, run) {
  run = run || await latestRun(ctx);
  const lat = latencies(events);
  return { nlu_accuracy_pct: run.nlu.accuracy_pct, suggestion_p95_ms: quantile(lat, 0.95),
    suggestion_sessions: new Set(events.filter(e => e.name === 'suggestion_shown').map(e => e.session_id)).size,
    audit_items: run.safety.items, allergy_violation_pct: run.safety.allergy_violation_pct, ran_at: run.ran_at };
}

async function overview(ctx) {
  const w = windowOf(ctx.searchParams, ctx.util);
  const all = await loadEvents(ctx.ms);
  const redirects = await realRedirects(ctx.repo, all);
  const withReal = [...all, ...redirects].sort((a, b) => a.t - b.t);
  const cur = withReal.filter(e => inWin(e, w.from, w.now)), prev = withReal.filter(e => inWin(e, w.prevFrom, w.from));
  const dm = dauMau(withReal, w.from, w.now), dmPrev = dauMau(withReal, w.prevFrom, w.from);
  const ret = retention(withReal, w.now);
  const dt = decisionTimes(cur), dtPrev = decisionTimes(prev);
  const lat = latencies(cur);
  const dec = median(dt), decPrev = median(dtPrev);
  return { period_days: w.days, from: isoOf(new Date(w.from)), to: isoOf(new Date(w.now)),
    dau_mau: { ...dm, delta_pct_points: dm.pct !== null && dmPrev.pct !== null ? Number((dm.pct - dmPrev.pct).toFixed(1)) : null },
    retention: ret,
    decision_time_s: { median: dec === null ? null : Math.round(dec), previous: decPrev === null ? null : Math.round(decPrev), delta_s: dec !== null && decPrev !== null ? Math.round(dec - decPrev) : null,
      under_60s_pct: pct(dt.filter(x => x < 60).length, dt.length), decisions: dt.length },
    suggestion_latency: { p95_ms: quantile(lat, 0.95), sla_ms: LATENCY_SLA_MS, samples: lat.length, within_sla: lat.length ? quantile(lat, 0.95) < LATENCY_SLA_MS : null },
    top3_no_refresh: top3NoRefresh(cur),
    wamd: { current: wamd(withReal, w.now - 7 * DAY, w.now), previous: wamd(withReal, w.now - 14 * DAY, w.now - 7 * DAY) },
    real_redirects_in_period: redirects.filter(e => inWin(e, w.from, w.now)).length,
    ...sourceNote(cur), chrome: await chrome(ctx, cur) };
}

export default {
  id: M,
  personalKinds: ['event'],
  seed,
  // Early: the core router answers GET /analytics/ab-test with a static sample.
  async routeEarly(ctx) {
    const { method, pathname, ms, util, body } = ctx;
    if (pathname === '/api/v1/analytics/ab-test' && method === 'GET') {
      const w = windowOf(new URLSearchParams({ days: ctx.searchParams.get('days') || '30' }), util);
      const events = (await loadEvents(ms)).filter(e => inWin(e, w.from, w.now));
      const exps = abResults(await ms.list(M, 'experiment'), events);
      const run = await latestRun(ctx);
      return { status: 200, data: { period_days: w.days, active_experiments: exps, experiments: exps,
        nlu_accuracy: { score: run.nlu.accuracy_pct, benchmark_queries_tested: run.nlu.cases, threshold: NLU_TARGET, ran_at: run.ran_at },
        ...sourceNote(events), is_demo: exps.some(x => x.is_demo) || sourceNote(events).is_demo } };
    }
    const ab = pathname.match(/^\/api\/v1\/analytics\/ab-test\/([^/]+)$/);
    if (ab && (method === 'PATCH' || method === 'PUT')) {
      const status = util.cleanText(body.status, 20);
      if (!['running', 'paused', 'completed'].includes(status)) return util.bad('status phải là running, paused hoặc completed');
      const rec = await ms.get(decodeURIComponent(ab[1]));
      if (!rec || rec.module !== M || rec.kind !== 'experiment') return util.notFound('Không tìm thấy thử nghiệm');
      return { status: 200, data: await ms.update(rec.id, { status, status_changed_at: isoOf(clock()) }) };
    }
    return null;
  },
  async route(ctx) {
    const { method, pathname, ms, util, body, searchParams, repo } = ctx;

    if (pathname === '/api/v1/events' && method === 'POST') {
      const p = parseEvent(body, ctx);
      if (p.error) return util.bad(p.error);
      const rec = await storeEvent(ctx, p.data);
      return { status: 201, data: { stored: true, id: rec.id, event: rec.name, ts: rec.ts, count: ctx.store.analyticsEvents[rec.name] } };
    }
    if (pathname === '/api/v1/events/batch' && method === 'POST') {
      const list = Array.isArray(body.events) ? body.events : null;
      if (!list || !list.length) return util.bad('events phải là mảng không rỗng');
      if (list.length > 50) return util.bad('Tối đa 50 sự kiện mỗi lần gửi');
      const parsed = list.map(e => parseEvent({ session_id: body.session_id, platform: body.platform, ...e }, ctx));
      const bad = parsed.findIndex(p => p.error);
      if (bad >= 0) return util.bad(`Sự kiện #${bad + 1}: ${parsed[bad].error}`);
      const ids = [];
      for (const p of parsed) ids.push((await storeEvent(ctx, p.data)).id);
      return { status: 201, data: { stored: ids.length, ids } };
    }

    if (!pathname.startsWith('/api/v1/analytics/') || method !== 'GET') {
      if (pathname === '/api/v1/analytics/ai-performance/run' && method === 'POST') {
        const run = await latestRun(ctx, true);
        return { status: 201, data: { ...run, chrome: await chrome(ctx, await loadEvents(ms), run) } };
      }
      return null;
    }
    const route = pathname.slice('/api/v1/analytics/'.length);

    if (route === 'overview') return { status: 200, data: await overview(ctx) };

    if (route === 'funnel') {
      const w = windowOf(searchParams, util);
      const all = await loadEvents(ms);
      const events = all.filter(e => inWin(e, w.from, w.now));
      const redirects = (await realRedirects(repo, all)).filter(e => inWin(e, w.from, w.now));
      const f = funnel(events, redirects);
      const ov = await overview(ctx);
      const counts = Object.fromEntries(EVENTS.map(n => [n, events.filter(e => e.name === n).length]));
      return { status: 200, data: { period_days: w.days, north_star_metric: 'Weekly Active Meal Decisions (WAMD)',
        wamd_current: ov.wamd.current, wamd_previous: ov.wamd.previous, d7_retention_pct: ov.retention.d7.pct,
        decision_under_60s_pct: ov.decision_time_s.under_60s_pct, suggestion_p95_ms: ov.suggestion_latency.p95_ms,
        base_sessions: f.base_sessions, stages: f.stages,
        funnel: [{ step: '1. app_open', count: f.base_sessions }, ...f.stages.map((s, i) => ({ step: `${i + 2}. ${s.label}`, count: s.count }))],
        real_redirects: redirects.length, events: counts, ...sourceNote(events), chrome: ov.chrome } };
    }

    if (route === 'ai-performance' || route === 'ai-benchmark') {
      const run = await latestRun(ctx, route === 'ai-benchmark' || searchParams.get('rerun') === '1');
      const events = await loadEvents(ms);
      const n = run.nlu;
      return { status: 200, data: { ...run, accuracy_pct: n.accuracy_pct, target_pct: n.target_pct, passed_sla: n.passed_sla,
        benchmark_size: n.cases, sampled_cases: n.cases, details: n.details,
        is_demo: n.details.some(d => d.is_demo), chrome: await chrome(ctx, events, run) } };
    }

    if (route === 'conversions') {
      const w = windowOf(searchParams, util);
      const all = await loadEvents(ms);
      const events = all.filter(e => inWin(e, w.from, w.now));
      const redirects = (await realRedirects(repo, all)).filter(e => inWin(e, w.from, w.now));
      const c = conversions([...events, ...redirects]);
      return { status: 200, data: { period_days: w.days, ...c, real_redirects: redirects.length, ...sourceNote(events), chrome: await chrome(ctx, events) } };
    }

    if (route === 'ads-health') {
      const w = windowOf(searchParams, util);
      const events = (await loadEvents(ms)).filter(e => inWin(e, w.from, w.now));
      const campaigns = await repo.listCampaigns();
      const a = adsHealth(events, campaigns);
      const run = await latestRun(ctx);
      const pays = await completedPayments(repo);
      const now = clock();
      const monthKey = d => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
      const thisM = monthKey(new Date(now.getTime() + TZ_MS));
      const prevD = new Date(now.getTime() + TZ_MS); prevD.setUTCDate(1); prevD.setUTCMonth(prevD.getUTCMonth() - 1);
      const sumFor = key => pays.filter(p => { const t = ms_(p.paid_at instanceof Date ? p.paid_at.getTime() : p.paid_at || p.created_at); return Number.isFinite(t) && monthKey(new Date(t + TZ_MS)) === key; })
        .reduce((s, p) => s + (Number(p.amount_vnd ?? p.amount) || 0), 0);
      const rev = sumFor(thisM), revPrev = sumFor(monthKey(prevD));
      return { status: 200, data: { period_days: w.days, ...a, audit: { lists: run.safety.lists, lists_over_sponsor_cap: run.safety.lists_over_sponsor_cap, sponsored_items: run.safety.sponsored_items, items: run.safety.items, ran_at: run.ran_at },
        revenue: { this_month_vnd: rev, previous_month_vnd: revPrev, mom_pct: revPrev ? Number((((rev - revPrev) / revPrev) * 100).toFixed(1)) : null, completed_payments: pays.length, source: 'payment_orders' },
        ...sourceNote(events), chrome: await chrome(ctx, events) } };
    }

    if (route === 'events') {
      const w = windowOf(searchParams, util);
      const all = await loadEvents(ms);
      const events = all.filter(e => inWin(e, w.from, w.now));
      const name = util.cleanText(searchParams.get('name'), 40);
      if (name && !EVENTS.includes(name)) return util.bad('Tên sự kiện không hợp lệ');
      const limit = util.cleanNumber(searchParams.get('limit'), 1, 100, 25);
      const counts = EVENTS.map(n => ({ name: n, count: events.filter(e => e.name === n).length, is_click: n.includes('click') }));
      const recent = all.filter(e => !name || e.name === name).slice(-limit).reverse().map(pubEvent);
      return { status: 200, data: { period_days: w.days, catalog: counts, filter: name || null, recent,
        total_stored: all.length, last_event_at: all.length ? isoOf(new Date(all[all.length - 1].t)) : null,
        ...sourceNote(events), chrome: await chrome(ctx, events) } };
    }
    return null;
  }
};
