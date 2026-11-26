// M7 — Quảng bá & Chiến dịch tài trợ + nạp tiền VietQR (M7-S01..M7-S08, desktop tab "merchant").
//
// Builds on the core repository (ad_campaigns, ad_clicks, payment_orders; src/api/router.js):
//   core keeps: campaign rows + counters, 60 s click guard, VietQR order creation, signed PayOS webhook.
//   M7 adds (module_records): merchant account ↔ places, campaign targeting (dish / radius / meal slots /
//   weather), plan & schedule, review lifecycle, invoices, sandbox top-up credits, demo performance stats.
// Sponsored-serving rules stay in the core (recommender + candidatePipeline): at most 1 of 3 slots,
// "Tài trợ" label, allergy hard filter, only status 'active' is ever served. New campaigns start as
// 'pending_review' and only an admin (POST /admin/ads/:id/moderate) can make them active.
// Money: no real money moves here. Top-ups create a real (core) VietQR order; until PayOS confirms it
// through the signed webhook, the only confirmation is the labelled SANDBOX endpoint, whose credit is
// kept apart from the real campaign balance and reported as sandbox.
import crypto from 'node:crypto';
import { generateVietQrInvoice } from '../services/paymentService.js';
import { getPlaceOpenStatus } from '../services/placeHours.js';
import { vietQrPayload, qrSvgDataUrl, asciiMemo } from './m7-qr.js';

const M = 'M7';
const DEMO_ACCOUNT = 'M7-ACC-DEMO';
const MERCHANT_ROLES = ['merchant', 'merchant_owner', 'merchant_staff', 'super_admin', 'admin'];
const isAdmin = u => !!u && (u.role === 'super_admin' || u.role === 'admin');

export const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Bữa sáng', short: 'Sáng', hours: '06:00–09:30' },
  { key: 'lunch', label: 'Bữa trưa', short: 'Trưa', hours: '10:30–13:30' },
  { key: 'afternoon', label: 'Bữa xế', short: 'Chiều', hours: '14:00–16:30' },
  { key: 'dinner', label: 'Bữa tối', short: 'Tối', hours: '17:00–20:00' },
  { key: 'late', label: 'Ăn khuya', short: 'Đêm', hours: '20:30–23:00' }
];
export const WEATHER = [
  { key: 'rain_cool', label: 'Trời mát / Mưa (< 29°C)', short: 'Mưa/mát', emoji: '🌧️' },
  { key: 'hot_sunny', label: 'Trời nắng nóng (≥ 29°C)', short: 'Nắng', emoji: '☀️' },
  { key: 'any', label: 'Mọi thời tiết', short: 'Mọi lúc', emoji: '🌤️' }
];
export const PLANS = {
  ctx30: { key: 'ctx30', name: 'Gói Ngữ Cảnh 30 Ngày', tag: 'Gói MVP Khuyên dùng', price_vnd: 1500000, days: 30,
    note: 'Gói cố định 30 ngày. Hiển thị ước tính trong bán kính đã chọn, không cam kết số lượt.' },
  cpa_daily: { key: 'cpa_daily', name: 'Theo Lượt Chuyển Đổi', tag: 'Giai đoạn mở rộng (CPA)', daily_budget_vnd: 50000,
    note: 'Trần chi tiêu theo ngày; chỉ tính khi người dùng bấm Chỉ đường hoặc Đặt món.' }
};
const RADIUS = { min: 1000, max: 5000, step: 500, default: 3000 };
const STATUS_LABEL = {
  active: ['● Đang chạy', 'green'], pending_review: ['⏳ Chờ duyệt M9-S07', 'yellow'], paused: ['⏸ Tạm dừng', 'purple'],
  rejected: ['✕ Bị từ chối', 'rose'], draft: ['✎ Bản nháp', 'blue']
};
const INVOICE_LABEL = {
  PAID: ['Đã TT', 'green'], DEMO_PAID: ['Đã TT (demo)', 'green'], SANDBOX_PAID: ['Sandbox · không có tiền thật', 'blue'],
  PENDING_PAYMENT: ['Chờ thanh toán', 'yellow'], EXPIRED: ['Hết hạn', 'rose']
};
const sandboxEnabled = () => process.env.PAYMENTS_SANDBOX !== 'false';
const payosConfigured = () => !!process.env.PAYOS_CHECKSUM_KEY;

// ── demo data (fixed ids; every row is_demo) ───────────────────────────────
function demoDaily(seedBase, days = 14) {
  const out = [];
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const wave = Math.round(seedBase * (0.78 + 0.03 * (days - i) + 0.06 * ((i * 7) % 3)));
    out.push({ date: d.toISOString().slice(0, 10), impressions: wave, clicks: Math.round(wave * 0.068) });
  }
  return out;
}
const seed = () => [
  { kind: 'account', id: DEMO_ACCOUNT, data: {
    name: 'Phở Gia Truyền Phát Tài', legal_name: 'Hộ kinh doanh Phát Tài (2 cơ sở)', city: 'Biên Hòa, Đồng Nai',
    place_ids: ['PLACE-401', 'PLACE-403'] } },
  { kind: 'campaign', id: 'M7-CMP-CMP-701', data: {
    campaign_id: 'CMP-701', account_id: DEMO_ACCOUNT, meal_slots: ['lunch', 'dinner'], weather: ['rain_cool'],
    plan: 'ctx30', days: 30, submitted_at: '2026-11-01T02:00:00.000Z' } },
  { kind: 'campaign', id: 'M7-CMP-CMP-702', data: {
    campaign_id: 'CMP-702', account_id: DEMO_ACCOUNT, meal_slots: ['breakfast', 'lunch'], weather: ['rain_cool'],
    plan: 'cpa_daily', days: 30, daily_budget_vnd: 40000, submitted_at: '2026-11-05T02:00:00.000Z' } },
  { kind: 'stats', id: 'M7-STATS-CMP-701', data: {
    campaign_id: 'CMP-701', spend_vnd_30d: 1480000, revenue_vnd_30d: 10400000, daily: demoDaily(560),
    by_slot: { breakfast: [2100, 98], lunch: [7400, 610], afternoon: [1500, 52], dinner: [5600, 430], late: [1820, 62] },
    by_weather: { rain_cool: [11200, 905], hot_sunny: [7220, 347] } } },
  { kind: 'stats', id: 'M7-STATS-CMP-702', data: {
    campaign_id: 'CMP-702', spend_vnd_30d: 270000, revenue_vnd_30d: 2000000, daily: demoDaily(170),
    by_slot: { breakfast: [2300, 140], lunch: [2400, 128], afternoon: [300, 10], dinner: [300, 25], late: [100, 7] },
    by_weather: { rain_cool: [3600, 240], hot_sunny: [1800, 70] } } },
  { kind: 'invoice', id: 'M7-INV-DEMO-2026-11', data: {
    account_id: DEMO_ACCOUNT, campaign_id: 'CMP-701', number: 'TOV-2026-11', label: 'Gói 30 ngày Bún bò Huế',
    amount_vnd: 1500000, status: 'DEMO_PAID', order_id: null, issued_at: '2026-11-01T02:05:00.000Z' } },
  { kind: 'invoice', id: 'M7-INV-DEMO-2026-10', data: {
    account_id: DEMO_ACCOUNT, campaign_id: 'CMP-702', number: 'TOV-2026-10', label: 'Gói Khai trương Cơ sở 2',
    amount_vnd: 1000000, status: 'DEMO_PAID', order_id: null, issued_at: '2026-10-03T02:05:00.000Z' } }
];

// ── helpers ─────────────────────────────────────────────────────────────────
const pct = (a, b) => (b > 0 ? Number(((a / b) * 100).toFixed(1)) : 0);
const realBalance = c => Number(c.balance_vnd ?? c.budget_monthly_vnd ?? 0) || 0;
const err = (status, error, extra = {}) => ({ status, data: { error, ...extra } });

function guard(ctx) {
  if (!ctx.authUser) return ctx.util.unauthorized();
  if (!MERCHANT_ROLES.includes(ctx.authUser.role)) return ctx.util.forbidden('Chỉ chủ quán hoặc quản trị viên được truy cập');
  return null;
}

async function account(ctx) {
  const own = ctx.userId ? (await ctx.ms.list(M, 'account', { ownerId: ctx.userId }))[0] : null;
  // Until a merchant account is bound to real places (data-loading phase), merchants work on the demo account.
  return own || (await ctx.ms.get(DEMO_ACCOUNT)) || { id: DEMO_ACCOUNT, name: 'Quán demo', place_ids: [], is_demo: true };
}
const owns = (ctx, acc, cmp) => isAdmin(ctx.authUser) || (acc.place_ids || []).includes(cmp.place_id);

async function load(ctx) {
  const acc = await account(ctx);
  const [all, metas, stats, dishes, places] = await Promise.all([
    ctx.repo.listCampaigns(), ctx.ms.list(M, 'campaign'), ctx.ms.list(M, 'stats'), ctx.repo.listDishes(), ctx.repo.listPlaces()
  ]);
  const meta = Object.fromEntries(metas.map(m => [m.campaign_id, m]));
  const stat = Object.fromEntries(stats.map(s => [s.campaign_id, s]));
  const dish = Object.fromEntries(dishes.map(d => [d.id, d]));
  const place = Object.fromEntries(places.map(p => [p.id, p]));
  const campaigns = all.filter(c => owns(ctx, acc, c));
  return { acc, all, campaigns, meta, stat, dish, place };
}

async function invoicesFor(ctx, acc, campaignIds = null) {
  let rows = await ctx.ms.list(M, 'invoice');
  if (!isAdmin(ctx.authUser)) rows = rows.filter(r => r.account_id === acc.id);
  if (campaignIds) rows = rows.filter(r => campaignIds.has(r.campaign_id));
  const now = Date.now();
  const out = [];
  for (const r of rows) {
    let status = r.status;
    if (r.order_id) {
      const ord = await ctx.repo.getPaymentOrder(r.order_id);
      if (ord && ord.status === 'COMPLETED') status = 'PAID';            // real money confirmed by the signed webhook
      else if (status === 'PENDING_PAYMENT' && r.expires_at && Date.parse(r.expires_at) < now) status = 'EXPIRED';
    }
    const [label, tone] = INVOICE_LABEL[status] || [status, 'gray'];
    out.push({ id: r.id, number: r.number, label: r.label, campaign_id: r.campaign_id, amount_vnd: r.amount_vnd,
      status, status_label: label, tone, sandbox: status === 'SANDBOX_PAID', order_id: r.order_id || null,
      order_code: r.order_code || null, memo: r.memo || null, issued_at: r.issued_at || r.created_at,
      expires_at: r.expires_at || null, is_demo: r.is_demo,
      qr: status === 'PENDING_PAYMENT' && r.qr_payload ? { payload: r.qr_payload, image: qrSvgDataUrl(r.qr_payload),
        bank_name: r.bank_name, bank_bin: r.bank_bin, account_number: r.account_number, account_holder: r.account_holder,
        amount_vnd: r.amount_vnd, memo: r.memo, expires_at: r.expires_at } : null });
  }
  return out.sort((a, b) => String(b.issued_at).localeCompare(String(a.issued_at)));
}
const sandboxCredit = (invoices, cmpId) =>
  invoices.filter(i => i.status === 'SANDBOX_PAID' && (!cmpId || i.campaign_id === cmpId)).reduce((s, i) => s + Number(i.amount_vnd || 0), 0);

function pubCampaign(c, L, invoices = []) {
  const m = L.meta[c.id] || {}, s = L.stat[c.id], d = L.dish[c.dish_id] || {}, p = L.place[c.place_id] || {};
  const menu = (p.menu || []).find(x => x.dish_id === c.dish_id);
  const slots = (m.meal_slots || []).map(k => MEAL_SLOTS.find(x => x.key === k)).filter(Boolean);
  const weather = (m.weather || []).map(k => WEATHER.find(x => x.key === k)).filter(Boolean);
  const plan = PLANS[m.plan] || null;
  const [label, tone] = STATUS_LABEL[c.status] || [c.status, 'gray'];
  const impressions = Number(c.impressions || 0), clicks = Number(c.clicks || 0);
  const { created_by: _by, ...core } = c;
  return { ...core,
    title: c.title || c.package_name || d.name || c.id,
    dish_name: menu?.name || d.name || c.dish_id, place_name: p.name || c.place_id, img_key: d.img_key || null,
    price_vnd: menu?.price ?? d.ref_price ?? null, allergen_tags: Array.isArray(d.allergen_tags) ? d.allergen_tags : null,
    status_label: label, tone, radius_m: Number(c.radius_m || RADIUS.default),
    meal_slots: slots.map(x => x.key), slot_labels: slots.map(x => `${x.label} ${x.hours}`), slot_hours: slots.map(x => x.hours),
    weather: weather.map(x => x.key), weather_label: weather.map(x => x.short).join(', '),
    plan: plan?.key || null, plan_name: plan?.name || c.package_name || null, days: m.days || plan?.days || null,
    daily_budget_vnd: m.daily_budget_vnd ?? null,
    impressions, clicks, ctr_pct: pct(clicks, impressions), conversions: Number(c.conversions || 0),
    filtered_fraud_clicks: Number(c.filtered_fraud_clicks || 0),
    balance_vnd: realBalance(c), sandbox_credit_vnd: sandboxCredit(invoices, c.id),
    spend_vnd_30d: s ? s.spend_vnd_30d : Number(c.spent_vnd || 0), revenue_vnd_30d: s ? s.revenue_vnd_30d : 0,
    can_pause: c.status === 'active', can_resume: c.status === 'paused' && m.paused_by === 'merchant',
    is_demo: !!(s?.is_demo || m.is_demo)
  };
}
function placeSummary(p) {
  if (!p) return null;
  const st = getPlaceOpenStatus(p);
  return { id: p.id, name: p.name, address: p.address, is_verified: p.is_verified === true, img_key: p.img_key || null,
    open_status: st.status, open_label: st.label };
}

/** Dishes this account may promote: on the menu, available, public, allergy tags declared, place verified. */
async function eligibleDishes(ctx, acc, L) {
  const out = [];
  for (const pid of acc.place_ids || []) {
    const p = L.place[pid];
    if (!p) continue;
    for (const item of p.menu || []) {
      const d = await ctx.repo.getDish(item.dish_id);   // public (safety/CMS) dishes only
      let reason = null;
      if (!d) reason = 'Món chưa được duyệt công khai';
      else if (!Array.isArray(d.allergen_tags)) reason = 'Món chưa khai báo đủ tag dị ứng';
      else if (d.safety_status === 'rejected') reason = 'Thông tin an toàn món bị từ chối';
      else if (item.available === false) reason = 'Món đang hết trong thực đơn';
      else if (p.is_verified !== true) reason = 'Quán chưa được xác minh';
      else if (p.is_paused === true || p.is_open_override === false) reason = 'Quán đang tạm dừng';
      const slots = (d?.meal_slots || []).map(k => MEAL_SLOTS.find(x => x.key === (k === 'snack' ? 'afternoon' : k))?.label).filter(Boolean);
      out.push({ dish_id: item.dish_id, place_id: pid, place_name: p.name, name: item.name || d?.name || item.dish_id,
        dish_name: d?.name || item.name, price_vnd: item.price ?? null, img_key: d?.img_key || p.img_key || null,
        allergen_tags: Array.isArray(d?.allergen_tags) ? d.allergen_tags : null, weather_fit: d?.weather_fit || [],
        meal_slots: d?.meal_slots || [], fit: slots.length ? `Khớp với ${slots.join(', ').toLowerCase()}` : '',
        eligible: !reason, reason });
    }
  }
  return out;
}

function quote(draft, stats) {
  const plan = PLANS[draft.plan];
  if (!plan) return null;
  if (plan.key === 'ctx30') return { plan: plan.key, total_vnd: plan.price_vnd, days: plan.days, daily_budget_vnd: null };
  const daily = draft.daily_budget_vnd || plan.daily_budget_vnd, days = draft.days || 30;
  // Reference CPA from this account's own recorded spend/conversions, when there is any.
  const cpa = stats.conversions > 0 && stats.spend > 0 ? Math.round(stats.spend / stats.conversions) : null;
  return { plan: plan.key, total_vnd: daily * days, days, daily_budget_vnd: daily, ref_cpa_vnd: cpa,
    est_actions_per_day: cpa ? Math.floor(daily / cpa) : null };
}

function validateDraft(ctx, body, cur, dishes) {
  const { cleanText, cleanNumber, cleanList } = ctx.util;
  const next = { ...cur };
  if (body.dish_id !== undefined || body.place_id !== undefined) {
    const dishId = cleanText(body.dish_id ?? cur.dish_id, 40), placeId = cleanText(body.place_id ?? cur.place_id, 40);
    const hit = dishes.find(x => x.dish_id === dishId && (!placeId || x.place_id === placeId));
    if (!hit) return { error: 'Món không thuộc thực đơn của quán' };
    if (!hit.eligible) return { error: hit.reason };
    next.dish_id = hit.dish_id; next.place_id = hit.place_id;
  }
  if (body.radius_m !== undefined) {
    const r = Number(body.radius_m);
    if (!Number.isFinite(r)) return { error: 'Bán kính không hợp lệ' };
    next.radius_m = Math.round(cleanNumber(r, RADIUS.min, RADIUS.max, RADIUS.default) / 100) * 100;
  }
  if (body.meal_slots !== undefined) {
    const slots = cleanList(body.meal_slots, 5, 20).filter(k => MEAL_SLOTS.some(s => s.key === k));
    if (!slots.length) return { error: 'Chọn ít nhất một khung giờ bữa ăn' };
    next.meal_slots = MEAL_SLOTS.map(s => s.key).filter(k => slots.includes(k));
  }
  if (body.weather !== undefined) {
    let w = cleanList(body.weather, 3, 20).filter(k => WEATHER.some(s => s.key === k));
    if (!w.length) return { error: 'Chọn ngữ cảnh thời tiết' };
    if (w.includes('any')) w = ['any'];
    next.weather = w;
  }
  if (body.plan !== undefined) {
    if (!PLANS[body.plan]) return { error: 'Gói không hợp lệ' };
    next.plan = body.plan;
  }
  if (body.days !== undefined) next.days = Math.round(cleanNumber(body.days, 7, 30, 30));
  if (body.daily_budget_vnd !== undefined) next.daily_budget_vnd = Math.round(cleanNumber(body.daily_budget_vnd, 20000, 1000000, 50000) / 1000) * 1000;
  if (body.title !== undefined) next.title = cleanText(body.title, 80);
  if (body.step !== undefined) next.step = cleanText(body.step, 12);
  return { draft: next };
}

function checks(draft, dish, L) {
  const p = L.place[draft.place_id];
  const st = p ? getPlaceOpenStatus(p) : null;
  const allergens = dish?.allergen_tags;
  return [
    { key: 'badge', ok: true, label: 'Luôn gắn nhãn "Tài trợ" rõ ràng trên thẻ món' },
    { key: 'slot_cap', ok: true, label: 'Tối đa 1/3 slot gợi ý (hệ thống áp dụng khi xếp hạng)' },
    { key: 'allergy', ok: Array.isArray(allergens), label: Array.isArray(allergens)
      ? (allergens.length ? `Tự ẩn với người dị ứng: ${allergens.join(', ')}` : 'Món không có tag dị ứng đã khai báo · vẫn qua bộ lọc cứng')
      : 'Món chưa khai báo tag dị ứng' },
    { key: 'open', ok: true, label: st ? `Chỉ hiện khi quán mở · hiện tại: ${st.label}` : 'Chỉ hiện khi quán mở' },
    { key: 'targeting', ok: !!(draft.meal_slots?.length && draft.weather?.length && draft.radius_m), label: 'Đã chọn bán kính, khung giờ và thời tiết' },
    { key: 'plan', ok: !!PLANS[draft.plan], label: 'Đã chọn gói ngân sách' }
  ];
}

async function accountStats(L) {
  let spend = 0, revenue = 0, conversions = 0;
  for (const c of L.campaigns) {
    const s = L.stat[c.id];
    spend += s ? s.spend_vnd_30d : Number(c.spent_vnd || 0);
    revenue += s ? s.revenue_vnd_30d : 0;
    conversions += Number(c.conversions || 0);
  }
  return { spend, revenue, conversions };
}

async function builder(ctx) {
  const L = await load(ctx);
  const draftId = `M7-DRAFT-${ctx.userId}`;
  const rec = await ctx.ms.get(draftId);
  const dishes = await eligibleDishes(ctx, L.acc, L);
  const first = dishes.find(d => d.eligible);
  const draft = { place_id: first?.place_id || null, dish_id: first?.dish_id || null, radius_m: RADIUS.default,
    meal_slots: ['lunch', 'dinner'], weather: ['rain_cool'], plan: 'ctx30', days: 30, daily_budget_vnd: PLANS.cpa_daily.daily_budget_vnd,
    title: '', ...(rec || {}) };
  const dish = dishes.find(d => d.dish_id === draft.dish_id && d.place_id === draft.place_id) || null;
  const p = L.place[draft.place_id];
  const st = p ? getPlaceOpenStatus(p) : null;
  const ck = checks(draft, dish, L);
  const stats = await accountStats(L);
  return { draftId, rec, L, dishes, dish, draft, payload: {
    saved: !!rec, draft: { place_id: draft.place_id, dish_id: draft.dish_id, radius_m: draft.radius_m, meal_slots: draft.meal_slots,
      weather: draft.weather, plan: draft.plan, days: draft.days, daily_budget_vnd: draft.daily_budget_vnd, title: draft.title },
    dishes, options: { radius: RADIUS, meal_slots: MEAL_SLOTS, weather: WEATHER, plans: Object.values(PLANS) },
    quote: quote(draft, stats),
    preview: dish ? { title: draft.title || dish.name, dish_name: dish.name, place_name: dish.place_name, price_vnd: dish.price_vnd,
      img_key: dish.img_key, badge_label: 'Tài trợ', open_label: st?.label || null, open_status: st?.status || null,
      radius_km: Number((draft.radius_m / 1000).toFixed(1)), slot: '3/3',
      context_label: [...(draft.meal_slots || []).map(k => MEAL_SLOTS.find(s => s.key === k)?.short),
        (draft.weather || []).map(k => WEATHER.find(s => s.key === k)?.short).join('/')].filter(Boolean).join(' · ') } : null,
    checks: ck, ready: !!dish && ck.every(c => c.ok),
    account: { id: L.acc.id, name: L.acc.name, is_demo: !!L.acc.is_demo }, is_demo: !!L.acc.is_demo } };
}

async function createPending(ctx, L, draft, dish, stats) {
  const q = quote(draft, stats);
  const id = `CMP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const slots = draft.meal_slots.map(k => MEAL_SLOTS.find(s => s.key === k)?.short).join('/');
  const cmp = await ctx.repo.createCampaign({
    id, place_id: draft.place_id, dish_id: draft.dish_id, title: draft.title || `${dish.name} · ${slots}`,
    package_name: `${PLANS[draft.plan].name}${draft.plan === 'cpa_daily' ? ` (${q.days} ngày)` : ''}`,
    radius_m: draft.radius_m, budget_vnd: q.total_vnd, spent_vnd: 0, impressions: 0, clicks: 0,
    status: 'pending_review', badge_label: 'Tài trợ', created_by: ctx.userId
  });
  await ctx.ms.insert({ module: M, kind: 'campaign', id: `M7-CMP-${id}`, data: {
    campaign_id: id, account_id: L.acc.id, meal_slots: draft.meal_slots, weather: draft.weather, plan: draft.plan,
    days: q.days, daily_budget_vnd: q.daily_budget_vnd, submitted_at: new Date().toISOString() } });
  return { cmp, q };
}

async function campaignFor(ctx, id) {
  const L = await load(ctx);
  const c = L.all.find(x => x.id === id);
  if (!c) return { res: ctx.util.notFound('Không tìm thấy chiến dịch') };
  if (!owns(ctx, L.acc, c)) return { res: ctx.util.forbidden('Chiến dịch không thuộc quán của bạn') };
  return { L, c };
}

async function setPaused(ctx, id, pause) {
  const { L, c, res } = await campaignFor(ctx, id);
  if (res) return res;
  const metaId = `M7-CMP-${c.id}`;
  const meta = await ctx.ms.get(metaId);
  if (pause) {
    if (c.status !== 'active') return err(409, 'Chỉ tạm dừng được chiến dịch đang chạy', { status_now: c.status });
  } else {
    if (c.status !== 'paused') return err(409, 'Chiến dịch không ở trạng thái tạm dừng', { status_now: c.status });
    if (meta?.paused_by !== 'merchant') return err(409, 'Chiến dịch do quản trị tạm dừng; chỉ quản trị mở lại được (M9-S07)');
    const inv = await invoicesFor(ctx, L.acc, new Set([c.id]));
    if (realBalance(c) + sandboxCredit(inv, c.id) <= 0) return err(409, 'Số dư chiến dịch đã hết. Hãy nạp thêm (M7-S08).');
  }
  const after = await ctx.repo.updateCampaign(c.id, { status: pause ? 'paused' : 'active' });
  const patch = { paused_by: pause ? 'merchant' : null, [pause ? 'paused_at' : 'resumed_at']: new Date().toISOString() };
  if (meta) await ctx.ms.update(metaId, patch);
  else await ctx.ms.insert({ module: M, kind: 'campaign', id: metaId, data: { campaign_id: c.id, account_id: L.acc.id, ...patch } });
  const L2 = await load(ctx);
  return { status: 200, data: { campaign: pubCampaign(after, L2, await invoicesFor(ctx, L2.acc)) } };
}

async function topup(ctx) {
  const { cleanText, cleanNumber } = ctx.util;
  const cmpId = cleanText(ctx.body.campaign_id, 32);
  if (!cmpId) return ctx.util.bad('Thiếu campaign_id');
  const amount = Number(ctx.body.amount_vnd);
  if (!Number.isFinite(amount) || amount < 10000 || amount > 100000000) return ctx.util.bad('Số tiền nạp từ 10.000đ đến 100.000.000đ');
  const { L, c, res } = await campaignFor(ctx, cmpId);
  if (res) return res;
  if (c.status === 'rejected') return err(409, 'Chiến dịch bị từ chối, không nạp được');
  const amountVnd = Math.round(cleanNumber(amount, 10000, 100000000, 500000) / 1000) * 1000;
  // Same as core POST /ads/payments/vietqr/create: real pending order that only the signed PayOS webhook credits.
  const inv = generateVietQrInvoice({ campaignId: c.id, amountVnd, merchantName: L.acc.name });
  const memo = asciiMemo(inv.transfer_memo, 25);
  await ctx.repo.createPaymentOrder({ order_id: inv.order_id, order_code: inv.order_code, campaign_id: c.id,
    amount_vnd: amountVnd, status: 'PENDING_PAYMENT', created_by: ctx.userId, created_at: inv.created_at });
  const d = new Date(inv.created_at);
  const number = `TOV-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(inv.order_code).slice(-4)}`;
  const title = c.title || c.package_name || c.id;
  const payload = vietQrPayload({ bin: inv.bank_bin, accountNumber: inv.account_number, amountVnd, memo });
  const rec = await ctx.ms.insert({ module: M, kind: 'invoice', id: `M7-INV-${inv.order_id}`, data: {
    account_id: L.acc.id, campaign_id: c.id, number, label: `Nạp quảng bá · ${title}`, amount_vnd: amountVnd,
    status: 'PENDING_PAYMENT', order_id: inv.order_id, order_code: String(inv.order_code), memo,
    issued_at: inv.created_at, expires_at: inv.expires_at, qr_payload: payload, bank_name: inv.bank_name,
    bank_bin: inv.bank_bin, account_number: inv.account_number, account_holder: inv.account_holder } });
  return { status: 201, data: {
    invoice: { id: rec.id, number, label: rec.label, campaign_id: c.id, amount_vnd: amountVnd, status: 'PENDING_PAYMENT',
      status_label: INVOICE_LABEL.PENDING_PAYMENT[0], order_id: inv.order_id, order_code: String(inv.order_code), memo,
      issued_at: inv.created_at, expires_at: inv.expires_at },
    qr: { payload, image: qrSvgDataUrl(payload), standard: 'EMVCo · VietQR NAPAS 247', bank_name: inv.bank_name,
      bank_bin: inv.bank_bin, account_number: inv.account_number, account_holder: inv.account_holder,
      amount_vnd: amountVnd, memo, expires_at: inv.expires_at },
    payos_configured: payosConfigured(), sandbox_available: sandboxEnabled(), money_moved: false,
    note: payosConfigured()
      ? 'Quét mã bằng app ngân hàng. Số dư chỉ cộng khi PayOS gửi webhook có chữ ký xác nhận đã nhận tiền.'
      : 'Webhook PayOS chưa được cấu hình: chưa thể xác nhận tiền thật. Có thể dùng nút xác nhận Sandbox để thử luồng (không có tiền thật).'
  } };
}

async function sandboxConfirm(ctx, invId) {
  if (!sandboxEnabled()) return ctx.util.forbidden('Chế độ sandbox thanh toán đã tắt (PAYMENTS_SANDBOX=false)');
  const rec = await ctx.ms.get(invId);
  if (!rec || rec.module !== M || rec.kind !== 'invoice') return ctx.util.notFound('Không tìm thấy hoá đơn');
  const acc = await account(ctx);
  if (!isAdmin(ctx.authUser) && rec.account_id !== acc.id) return ctx.util.forbidden('Hoá đơn không thuộc quán của bạn');
  const [cur] = await invoicesFor(ctx, { id: rec.account_id }, new Set([rec.campaign_id])).then(r => r.filter(i => i.id === invId));
  if (!cur || cur.status !== 'PENDING_PAYMENT') return err(409, cur?.status === 'PAID'
    ? 'Hoá đơn đã được thanh toán thật qua PayOS' : 'Hoá đơn không còn chờ thanh toán', { status_now: cur?.status });
  let won = false;   // row-locked in Postgres: only one confirmation wins
  await ctx.ms.update(invId, cur2 => {
    if (cur2.status !== 'PENDING_PAYMENT') return cur2;
    won = true;
    return { ...cur2, status: 'SANDBOX_PAID', sandbox: true, sandbox_confirmed_at: new Date().toISOString() };
  });
  if (!won) return err(409, 'Hoá đơn đã được xử lý');
  const L = await load(ctx);
  const inv = await invoicesFor(ctx, L.acc);
  const c = L.all.find(x => x.id === rec.campaign_id);
  return { status: 200, data: {
    sandbox: true, money_moved: false, credited_real_balance: false,
    message: 'SANDBOX: đã ghi nhận xác nhận thử. Không có tiền thật được chuyển; số dư thật của chiến dịch không đổi.',
    invoice: inv.find(i => i.id === invId), campaign: c ? pubCampaign(c, L, inv) : null, balance: balanceOf(L, inv)
  } };
}

function balanceOf(L, inv) {
  const real = L.campaigns.reduce((s, c) => s + realBalance(c), 0);
  const sandbox = sandboxCredit(inv.filter(i => L.campaigns.some(c => c.id === i.campaign_id)));
  return { real_vnd: real, sandbox_vnd: sandbox, total_vnd: real + sandbox };
}

async function overview(ctx) {
  const L = await load(ctx);
  const inv = await invoicesFor(ctx, L.acc);
  const camps = L.campaigns.map(c => pubCampaign(c, L, inv));
  const st = await accountStats(L);
  const imp = camps.reduce((s, c) => s + c.impressions, 0), clk = camps.reduce((s, c) => s + c.clicks, 0);
  // Daily series and slot/weather breakdowns come from the recorded stats rows (demo for now).
  const byDate = {};
  for (const c of L.campaigns) for (const d of L.stat[c.id]?.daily || []) {
    const r = (byDate[d.date] ||= { date: d.date, impressions: 0, clicks: 0 });
    r.impressions += d.impressions; r.clicks += d.clicks;
  }
  const series = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  const agg = (key, k) => L.campaigns.reduce((a, c) => {
    const v = L.stat[c.id]?.[key]?.[k];
    return v ? [a[0] + v[0], a[1] + v[1]] : a;
  }, [0, 0]);
  const raw = [...MEAL_SLOTS.map(s => ({ key: s.key, label: s.short, kind: 'slot', v: agg('by_slot', s.key) })),
    ...WEATHER.filter(w => w.key !== 'any').map(w => ({ key: w.key, label: w.short, kind: 'weather', v: agg('by_weather', w.key) }))];
  const ctrs = raw.map(r => pct(r.v[1], r.v[0]));
  const maxCtr = Math.max(0, ...ctrs);
  const performance = raw.map((r, i) => ({ key: r.key, label: r.label, kind: r.kind, impressions: r.v[0], clicks: r.v[1],
    ctr_pct: ctrs[i], index: maxCtr > 0 ? Math.round((ctrs[i] / maxCtr) * 100) : 0 }));
  const best = performance.reduce((b, x) => (x.index > (b?.index ?? -1) ? x : b), null);
  const isDemo = !!L.acc.is_demo || camps.some(c => c.is_demo);
  return { status: 200, data: {
    account: { id: L.acc.id, name: L.acc.name, is_demo: !!L.acc.is_demo },
    kpis: { roas: st.spend > 0 ? Number((st.revenue / st.spend).toFixed(1)) : null, cvr_pct: pct(st.conversions, clk),
      revenue_vnd_30d: st.revenue, spend_vnd_30d: st.spend, impressions: imp, clicks: clk, ctr_pct: pct(clk, imp),
      conversions: st.conversions },
    series, performance, best_slot: best && best.index > 0 ? best.key : null,
    counts: { total: camps.length, active: camps.filter(c => c.status === 'active').length,
      pending_review: camps.filter(c => c.status === 'pending_review').length },
    balance: balanceOf(L, inv),
    policy: { max_sponsored_ratio: '1/3', badge_required: 'Tài trợ', hard_allergy_enforced: true },
    is_demo: isDemo } };
}

async function analytics(ctx, id) {
  const { L, c, res } = await campaignFor(ctx, id);
  if (res) return res;
  const inv = await invoicesFor(ctx, L.acc, new Set([c.id]));
  const pc = pubCampaign(c, L, inv);
  const daily = L.stat[c.id]?.daily || [];
  const last7 = daily.slice(-7).reduce((s, d) => s + d.impressions, 0), prev7 = daily.slice(-14, -7).reduce((s, d) => s + d.impressions, 0);
  const cpa = pc.conversions > 0 && pc.spend_vnd_30d > 0 ? Math.round(pc.spend_vnd_30d / pc.conversions) : null;
  return { status: 200, data: {
    campaign: pc,
    metrics: { impressions: pc.impressions, impressions_change_pct: prev7 > 0 ? Number((((last7 - prev7) / prev7) * 100).toFixed(1)) : null,
      ctr_pct: pc.ctr_pct, conversions: pc.conversions, cpa_vnd: cpa, filtered_fraud_clicks: pc.filtered_fraud_clicks,
      spend_vnd_30d: pc.spend_vnd_30d, revenue_vnd_30d: pc.revenue_vnd_30d },
    daily,
    anti_fraud: { cooldown_window_seconds: 60, rule: 'Click lặp lại từ cùng thiết bị trong 60 giây không bị tính phí',
      filtered_fraud_clicks: pc.filtered_fraud_clicks, valid_clicks: pc.clicks },
    campaigns: L.campaigns.map(x => ({ id: x.id, title: x.title || x.package_name || x.id, status: x.status })),
    account: { id: L.acc.id, name: L.acc.name, is_demo: !!L.acc.is_demo },
    is_demo: pc.is_demo || !!L.acc.is_demo } };
}

export default {
  id: M,
  seed,
  personalKinds: ['draft'],

  // Early: take over the core paths that need merchant ownership (core answers them for any merchant).
  async routeEarly(ctx) {
    const { method, pathname } = ctx;
    if (!pathname.startsWith('/api/v1/ads/')) return null;

    if (pathname === '/api/v1/ads/campaigns' && method === 'GET') {
      const g = guard(ctx); if (g) return g;
      const L = await load(ctx);
      const inv = await invoicesFor(ctx, L.acc);
      const items = L.campaigns.map(c => pubCampaign(c, L, inv));
      return { status: 200, data: {
        policy: { max_sponsored_ratio: '1/3', badge_required: 'Tài trợ', hard_allergy_enforced: true },
        account: { id: L.acc.id, name: L.acc.name, is_demo: !!L.acc.is_demo }, items, total: items.length,
        is_demo: !!L.acc.is_demo || items.some(c => c.is_demo) } };
    }

    // Merchants create campaigns for their own places only, and they start in review (admins keep the core route).
    if (pathname === '/api/v1/ads/campaigns' && method === 'POST' && ctx.authUser && !isAdmin(ctx.authUser)) {
      const g = guard(ctx); if (g) return g;
      const L = await load(ctx);
      const dishes = await eligibleDishes(ctx, L.acc, L);
      const base = { radius_m: RADIUS.default, meal_slots: ['lunch', 'dinner'], weather: ['any'], plan: 'ctx30', days: 30 };
      const v = validateDraft(ctx, { dish_id: ctx.body.dish_id, place_id: ctx.body.place_id, radius_m: ctx.body.radius_m,
        meal_slots: ctx.body.meal_slots, weather: ctx.body.weather, plan: ctx.body.plan, title: ctx.body.title ?? ctx.body.package_name },
      base, dishes);
      if (v.error) return ctx.util.bad(v.error);
      if (!v.draft.dish_id) return ctx.util.bad('Thiếu dish_id');
      const dish = dishes.find(d => d.dish_id === v.draft.dish_id && d.place_id === v.draft.place_id);
      const { cmp } = await createPending(ctx, L, v.draft, dish, await accountStats(L));
      return { status: 201, data: cmp };
    }

    const patch = pathname.match(/^\/api\/v1\/ads\/campaigns\/([^/]+)$/);
    if (patch && (method === 'PATCH' || method === 'PUT') && ctx.authUser && !isAdmin(ctx.authUser)) {
      const g = guard(ctx); if (g) return g;
      const { c, res } = await campaignFor(ctx, patch[1]);
      if (res) return res;
      const b = ctx.body;
      if (b.status !== undefined) {
        const s = ctx.util.cleanText(b.status, 32);
        if (s === 'paused' && c.status !== 'paused') { const r = await setPaused(ctx, c.id, true); if (r.status !== 200) return r; }
        else if (s === 'active' && c.status !== 'active') { const r = await setPaused(ctx, c.id, false); if (r.status !== 200) return r; }
        else if (s !== c.status) return ctx.util.forbidden('Trạng thái này do quản trị duyệt (M9-S07)');
      }
      const p = {};
      if (b.budget_vnd !== undefined) p.budget_vnd = ctx.util.cleanNumber(b.budget_vnd, 0, 1e10, 0);
      if (b.radius_m !== undefined) p.radius_m = Math.round(ctx.util.cleanNumber(b.radius_m, RADIUS.min, RADIUS.max, RADIUS.default) / 100) * 100;
      const after = await ctx.repo.updateCampaign(c.id, p);
      return { status: 200, data: after };
    }

    // Core VietQR creation: a merchant may only create an order for its own campaign.
    if ((pathname === '/api/v1/ads/payments/vietqr' || pathname === '/api/v1/ads/payments/vietqr/create') && method === 'POST'
      && ctx.authUser && !isAdmin(ctx.authUser)) {
      const g = guard(ctx); if (g) return g;
      const { res } = await campaignFor(ctx, ctx.util.cleanText(ctx.body.campaign_id, 32) || 'CMP-701');
      return res || null;
    }
    return null;
  },

  async route(ctx) {
    const { method, pathname } = ctx;
    const mine = pathname === '/api/v1/ads/overview' || pathname === '/api/v1/ads/account'
      || pathname.startsWith('/api/v1/ads/campaigns/') || pathname.startsWith('/api/v1/ads/payments/');
    if (!mine) return null;
    if (/^\/api\/v1\/ads\/campaigns\/[^/]+\/click$/.test(pathname)) return null;
    const g = guard(ctx); if (g) return g;

    if (pathname === '/api/v1/ads/overview' && method === 'GET') return overview(ctx);

    if (pathname === '/api/v1/ads/account' && method === 'GET') {
      const L = await load(ctx);
      const inv = await invoicesFor(ctx, L.acc);
      const camps = L.campaigns.map(c => pubCampaign(c, L, inv));
      return { status: 200, data: {
        account: { id: L.acc.id, name: L.acc.name, legal_name: L.acc.legal_name || null, is_demo: !!L.acc.is_demo },
        places: (L.acc.place_ids || []).map(id => placeSummary(L.place[id])).filter(Boolean),
        balance: balanceOf(L, inv), campaigns: camps, invoices: inv.slice(0, 5),
        default_campaign_id: (camps.find(c => c.status === 'active') || camps[0])?.id || null,
        anti_fraud: { cooldown_window_seconds: 60, filtered_fraud_clicks: camps.reduce((s, c) => s + c.filtered_fraud_clicks, 0) },
        payos_configured: payosConfigured(), sandbox_available: sandboxEnabled(),
        is_demo: !!L.acc.is_demo || camps.some(c => c.is_demo) } };
    }

    if (pathname === '/api/v1/ads/campaigns/builder') {
      if (method === 'GET') return { status: 200, data: (await builder(ctx)).payload };
      if (method === 'POST') {
        const b = await builder(ctx);
        const v = validateDraft(ctx, ctx.body, b.draft, b.dishes);
        if (v.error) return ctx.util.bad(v.error);
        const data = { ...v.draft, account_id: b.L.acc.id };
        if (b.rec) await ctx.ms.update(b.draftId, data);
        else await ctx.ms.insert({ module: M, kind: 'draft', id: b.draftId, ownerId: ctx.userId, data });
        return { status: 200, data: (await builder(ctx)).payload };
      }
      if (method === 'DELETE') {
        await ctx.ms.remove(`M7-DRAFT-${ctx.userId}`);
        return { status: 200, data: (await builder(ctx)).payload };
      }
    }

    if (pathname === '/api/v1/ads/campaigns/builder/submit' && method === 'POST') {
      const b = await builder(ctx);
      const v = validateDraft(ctx, ctx.body || {}, b.draft, b.dishes);
      if (v.error) return ctx.util.bad(v.error);
      const draft = v.draft;
      const dish = b.dishes.find(d => d.dish_id === draft.dish_id && d.place_id === draft.place_id);
      if (!dish || !dish.eligible) return ctx.util.bad(dish?.reason || 'Chưa chọn món quảng bá');
      const failed = checks(draft, dish, b.L).filter(c => !c.ok);
      if (failed.length) return ctx.util.bad(failed[0].label);
      const { cmp, q } = await createPending(ctx, b.L, draft, dish, await accountStats(b.L));
      await ctx.ms.remove(b.draftId);
      const L = await load(ctx);
      return { status: 201, data: { campaign: pubCampaign(cmp, L, []), amount_due_vnd: q.total_vnd,
        next: 'M7-S08', review: 'Chiến dịch chờ quản trị duyệt (M9-S07) trước khi được hiển thị.' } };
    }

    const sub = pathname.match(/^\/api\/v1\/ads\/campaigns\/([^/]+)\/(analytics|pause|resume)$/);
    if (sub) {
      if (sub[2] === 'analytics' && method === 'GET') return analytics(ctx, sub[1]);
      if (sub[2] !== 'analytics' && method === 'POST') return setPaused(ctx, sub[1], sub[2] === 'pause');
    }

    if (pathname === '/api/v1/ads/payments/invoices' && method === 'GET') {
      const L = await load(ctx);
      const inv = await invoicesFor(ctx, L.acc);
      const cmp = ctx.util.cleanText(ctx.searchParams.get('campaign_id'), 32);
      const items = cmp ? inv.filter(i => i.campaign_id === cmp) : inv;
      return { status: 200, data: { items, total: items.length, balance: balanceOf(L, inv),
        account: { id: L.acc.id, name: L.acc.name, is_demo: !!L.acc.is_demo },
        campaigns: L.campaigns.map(c => pubCampaign(c, L, inv)), payos_configured: payosConfigured(),
        sandbox_available: sandboxEnabled(), is_demo: !!L.acc.is_demo || items.some(i => i.is_demo) } };
    }
    if (pathname === '/api/v1/ads/payments/topup' && method === 'POST') return topup(ctx);
    const sb = pathname.match(/^\/api\/v1\/ads\/payments\/invoices\/([^/]+)\/sandbox-confirm$/);
    if (sb && method === 'POST') return sandboxConfirm(ctx, sb[1]);
    return null;
  }
};
