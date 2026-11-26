// =============================================================================
// M6 — Merchant Portal (Cổng Quán) · screens M6-S01..M6-S09
//
// Who sees what: a 'membership' record links a merchant (by phone, then by user id
// at first login) to the catalogue places it owns, with a role per membership:
//   owner   : everything for its places, incl. staff management
//   manager : profile, menu, OCR, specials/promotions, statistics
//   staff   : read the menu + toggle "Còn món / Tạm hết" only
// super_admin acts as owner on every place. Merchants without a membership can only
// read /merchant/me and file a claim (POST /merchant/claim, pending M9 verification).
//
// Records (module 'M6'): membership, menu_item, promotion, ocr_scan, profile, claim,
// stat (demo per-dish counters). KPIs = real order_redirects rows (M5 directions,
// partner orders, calls) + demo counters; impressions exist only as demo counters
// (the core logs no impressions yet). Every response says which part is demo.
//
// Core sync (src/db repository, same path as the M9 menu review): menu availability
// and price of items already on the reviewed catalogue menu, amenities, partner links
// and the merchant's own pause. Name / address / opening hours are stored as a pending
// change for M9 verification and never shown as verified hours.
// OCR: the text parser of src/services/ocrEngine.js runs on a sandbox copy of the
// place; low-confidence lines stay 'pending_review' in this module (the repository
// has no insert for the M9 ocr_review_queue). Image OCR is not connected: an image
// name alone returns a labelled sandbox fixture.
// =============================================================================
import { getRepository } from '../db/repository.js';
import { PostgresRepository } from '../db/postgresRepository.js';
import { parseMenuOcrText } from '../services/ocrEngine.js';
import { computeStringSimilarity } from '../services/textUtils.js';
import { normalizePhone } from '../services/authService.js';
import { getPlaceOpenStatus } from '../services/placeHours.js';
import { redirectAction } from '../services/redirectService.js';

const M = 'M6';
const DAY = 86400000;
const VN = 7 * 3600000;
const dayKey = (t = Date.now()) => new Date(new Date(t).getTime() + VN).toISOString().slice(0, 10);
const lastDays = (n, end = Date.now()) => Array.from({ length: n }, (_, i) => dayKey(end - (n - 1 - i) * DAY));
const WEEKDAY = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const weekdayOf = key => WEEKDAY[new Date(key + 'T00:00:00Z').getUTCDay()];

// ── demo data ────────────────────────────────────────────────────────────────
const SERIES = 30; // demo counters: the last 30 days, index SERIES-1 = today (rolling)
const WAVE = [0.84, 0.9, 0.87, 0.96, 1.05, 1.22, 1.16];
const series = (base, salt) => Array.from({ length: SERIES }, (_, i) =>
  Math.max(0, Math.round(base * WAVE[(i + salt) % 7] * (0.9 + 0.006 * i))));
const stat = (place, item, dish, name, imp, dir, ord, call, salt) => ({
  kind: 'stat', id: `M6-STAT-${item}`, data: { place_id: place, menu_item_id: `M6-MENU-${item}`, dish_id: dish, name,
    impressions: series(imp, salt), directions: series(dir, salt + 1), orders: series(ord, salt + 2), calls: series(call, salt + 3),
    order_partners: { grabfood: 0.58, shopeefood: 0.27, xanhsm: 0.15 } } });
const item = (id, place, dish, name, price, extra = {}) => ({ kind: 'menu_item', id: `M6-MENU-${id}`, data: {
  place_id: place, dish_id: dish, name, price_vnd: price, available: true, category: 'Món nước', img_key: null,
  core_synced: false, status: 'published', source: 'catalogue', ...extra } });

const seed = () => {
  const today = dayKey();
  return [
    { kind: 'membership', id: 'M6-MEM-TAI', data: { phone: '+84900000002', name: 'Nguyễn Văn Tài', title: 'Chủ quán', role: 'owner',
      place_ids: ['PLACE-401', 'PLACE-405'], user_id: null } },
    { kind: 'membership', id: 'M6-MEM-MAI', data: { phone: '+84900000003', name: 'Trần Thị Mai', title: 'Thu ngân Cơ sở 1', role: 'staff',
      place_ids: ['PLACE-401'], user_id: null } },
    { kind: 'membership', id: 'M6-MEM-NAM', data: { phone: '+84900000004', name: 'Lê Hoàng Nam', title: 'Quản lý Cơ sở 2', role: 'manager',
      place_ids: ['PLACE-405'], user_id: null } },
    item('401-101', 'PLACE-401', 'DISH-101', 'Phở bò tái nạm', 45000, { core_synced: true, img_key: '298' }),
    item('401-DB', 'PLACE-401', 'DISH-101', 'Phở bò đặc biệt', 60000, { img_key: '034' }),
    item('401-BBH', 'PLACE-401', 'DISH-103', 'Bún bò Huế gân', 50000, { img_key: '310' }),
    item('401-108', 'PLACE-401', 'DISH-108', 'Combo Phở & Bò hầm gia đình 4 người', 240000, { core_synced: true, category: 'Combo' }),
    item('401-QUAY', 'PLACE-401', null, 'Quẩy giòn', 10000, { category: 'Món thêm', allergen_note: 'Có gluten / bột mì' }),
    item('405-101', 'PLACE-405', 'DISH-101', 'Phở bò tái', 45000, { core_synced: true, available: false }),
    item('405-BC', 'PLACE-405', null, 'Bánh canh cua đồng', 50000, { allergen_note: 'Có cua (giáp xác)' }),
    stat('PLACE-401', '401-101', 'DISH-101', 'Phở bò tái nạm', 640, 19, 12, 4, 0),
    stat('PLACE-401', '401-DB', 'DISH-101', 'Phở bò đặc biệt', 280, 7, 5, 1, 2),
    stat('PLACE-401', '401-BBH', 'DISH-103', 'Bún bò Huế gân', 190, 3, 3, 1, 4),
    stat('PLACE-401', '401-108', 'DISH-108', 'Combo Phở & Bò hầm gia đình 4 người', 110, 2, 3, 2, 1),
    { kind: 'promotion', id: 'M6-PROMO-SPECIAL', data: { place_id: 'PLACE-401', type: 'daily_special', menu_item_id: 'M6-MENU-401-DB',
      dish_id: 'DISH-101', title: 'Phở Sườn Bò Hầm Mềm', detail: 'Tặng 1 đĩa quẩy giòn khung giờ 11:00 – 13:00',
      start_time: '11:00', end_time: '13:00', discount_pct: 0, valid_date: today, active: true, img_key: '298' } },
    { kind: 'promotion', id: 'M6-PROMO-FAMILY', data: { place_id: 'PLACE-401', type: 'promotion', menu_item_id: 'M6-MENU-401-108',
      dish_id: 'DISH-108', tag: 'Combo Gia đình 4 người', title: 'Giảm 15% tổng hóa đơn buổi tối',
      detail: 'Áp dụng 17:00 – 21:00 cho bàn từ 4 người', start_time: '17:00', end_time: '21:00', discount_pct: 15,
      valid_date: null, active: true, img_key: '304' } },
    { kind: 'ocr_scan', id: 'M6-OCR-DEMO', data: { place_id: 'PLACE-401', source: 'image', image_name: 'bang-gia-pho-phat-tai.jpg',
      sandbox: true, status: 'draft', created_by: null, raw_text: '1. Phở bò tái nạm 45k\n2. Phở bò đặc biệt 60.000đ\n3. Quẩy giòn ăn kèm 10k',
      items: [
        { id: 'M6-OCR-DEMO-1', raw_text: '1. Phở bò tái nạm 45k', name: 'Phở bò tái nạm', price_vnd: 45000, dish_id: 'DISH-101',
          dish_name: 'Phở Bò Tái Nạm Hà Nội', confidence: 0.99, status: 'ready', allergen_tags: [], calories: 480, dish_tags: ['Nhanh 15p', 'Healthy'] },
        { id: 'M6-OCR-DEMO-2', raw_text: '2. Phở bò đặc biệt 60.000đ', name: 'Phở bò đặc biệt', price_vnd: 60000, dish_id: 'DISH-101',
          dish_name: 'Phở Bò Tái Nạm Hà Nội', confidence: 0.97, status: 'ready', allergen_tags: [], calories: 480, dish_tags: ['Nhanh 15p', 'Healthy'] },
        { id: 'M6-OCR-DEMO-3', raw_text: '3. Quẩy giòn ăn kèm 10k', name: 'Quẩy giòn ăn kèm', price_vnd: 10000, dish_id: null,
          dish_name: null, confidence: 0.86, status: 'pending_review', allergen_tags: [], calories: null, dish_tags: [] }
      ] } }
  ];
};

// ── roles & access ──────────────────────────────────────────────────────────
const PERMS = {
  owner: ['read', 'stats', 'profile', 'menu', 'availability', 'promo', 'ocr', 'staff'],
  manager: ['read', 'stats', 'profile', 'menu', 'availability', 'promo', 'ocr'],
  staff: ['read', 'availability']
};
const RANK = { staff: 1, manager: 2, owner: 3 };
const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', staff: 'Staff' };
const ROLE_RIGHTS = {
  owner: 'Toàn quyền quản lý thực đơn, chi nhánh, nhân viên & chiến dịch quảng bá M7',
  manager: 'Quản lý hồ sơ, thực đơn, món đặc biệt & xem thống kê chi nhánh được giao',
  staff: 'Quyền bật/tắt Còn món / Tạm hết tại quầy'
};
const fail = (status, error, extra = {}) => ({ status, data: { error, ...extra } });
const raw = ctx => getRepository(ctx.store);

async function access(ctx) {
  const u = ctx.authUser;
  if (u?.role === 'super_admin') {
    const places = new Map((await raw(ctx).listPlaces()).map(p => [p.id, 'owner']));
    return { admin: true, places, memberships: [] };
  }
  const phone = normalizePhone(u?.phone || '') || null;
  let mine = await ctx.ms.list(M, 'membership', { where: m => m.user_id === u.id || (!m.user_id && phone && m.phone === phone) });
  // First login: bind the phone-matched memberships to this user id.
  for (const m of mine.filter(x => !x.user_id)) {
    await ctx.ms.update(m.id, cur => (cur.user_id ? null : { ...cur, user_id: u.id, linked_at: new Date().toISOString() }));
  }
  mine = mine.filter(m => !m.user_id || m.user_id === u.id);
  const places = new Map();
  for (const m of mine) for (const p of m.place_ids || []) {
    if (!places.has(p) || RANK[m.role] > RANK[places.get(p)]) places.set(p, m.role);
  }
  return { admin: false, places, memberships: mine };
}

/** The place this request works on, checked against the caller's role. */
async function placeFor(ctx, acc, perm) {
  const asked = ctx.util.cleanText(ctx.searchParams.get('place_id') || ctx.body.place_id || '', 40);
  let id = asked;
  if (!id) {
    const ids = [...acc.places.keys()];
    id = acc.admin && acc.places.has('PLACE-401') ? 'PLACE-401' : ids.find(p => PERMS[acc.places.get(p)].includes(perm)) || ids[0];
  }
  if (!id) return { error: fail(403, 'Tài khoản chưa được gán quán nào. Gửi yêu cầu nhận quán ở màn đăng nhập (M6-S01).', { code: 'NO_MEMBERSHIP' }) };
  const role = acc.places.get(id);
  if (!role) return { error: asked && acc.admin ? fail(404, 'Không tìm thấy quán') : fail(403, 'Bạn không quản lý quán này') };
  if (!PERMS[role].includes(perm)) return { error: fail(403, `Vai trò ${ROLE_LABEL[role]} không được thực hiện thao tác này`) };
  const place = await raw(ctx).getPlace(id);
  if (!place) return { error: fail(404, 'Không tìm thấy quán') };
  return { placeId: id, role, place };
}

/** Change the catalogue place through the repository (locked, versioned like M9). */
async function syncCore(ctx, placeId, mutate) {
  return raw(ctx).atomic(async tx => {
    await tx.lockPlace(placeId);
    const p = structuredClone(await tx.getPlace(placeId));
    if (!p) return { changed: false, place: null };
    const next = mutate(structuredClone(p));
    if (!next) return { changed: false, place: p };
    next.cms = { ...(p.cms || { status: p.is_verified ? 'verified' : 'pending' }), version: (p.cms?.version || 0) + 1 };
    await tx.savePlace(next);
    await tx.saveContentVersion('place', next.id, next.cms.version, await tx.getPlace(next.id));
    return { changed: true, place: next };
  });
}

const openStatus = p => {
  const s = getPlaceOpenStatus(p);
  return { status: s.status, label: s.label, reason: s.reason, is_currently_open: s.is_currently_open };
};
const fmtHour = h => (Number.isFinite(h) ? String(h).padStart(2, '0') + ':00' : null);
function hoursText(p) {
  const w = p.opening_hours?.weekly;
  if (w && Array.isArray(w[1]) && w[1][0]) return `${w[1][0][0]} – ${w[1][0][1]}`;
  if (Number.isFinite(p.open_hour) && Number.isFinite(p.close_hour)) return `${fmtHour(p.open_hour)} – ${fmtHour(p.close_hour)}`;
  return '';
}

// ── dishes & menu ───────────────────────────────────────────────────────────
async function dishMap(ctx) { return new Map((await ctx.repo.listDishes()).map(d => [d.id, d])); }
async function campaignDishes(ctx, placeId) {
  return new Set((await ctx.repo.listCampaigns()).filter(c => c.place_id === placeId && c.status === 'active').map(c => c.dish_id));
}
function menuOut(it, dishes, running) {
  const d = it.dish_id ? dishes.get(it.dish_id) : null;
  return {
    id: it.id, place_id: it.place_id, name: it.name, price_vnd: it.price_vnd, available: it.available !== false,
    category: it.category || 'Món chính', dish_id: it.dish_id || null, dish_name: d?.name || null,
    allergen_tags: d?.allergen_tags || [], allergen_note: it.allergen_note || null, calories: d?.calories ?? null,
    img_key: it.img_key || d?.img_key || null, status: it.status || 'published', source: it.source || 'manual',
    on_recommendations: !!it.core_synced, campaign_active: !!(it.dish_id && running.has(it.dish_id)), is_demo: it.is_demo
  };
}
async function menuList(ctx, placeId) {
  const [items, dishes, running] = await Promise.all([ctx.ms.list(M, 'menu_item', { where: i => i.place_id === placeId }), dishMap(ctx), campaignDishes(ctx, placeId)]);
  return items.map(i => menuOut(i, dishes, running));
}
async function syncMenuItem(ctx, it) {
  if (!it.core_synced || !it.dish_id) return false;
  const out = await syncCore(ctx, it.place_id, p => {
    const i = (p.menu || []).findIndex(m => m.dish_id === it.dish_id);
    if (i < 0) return null;
    const cur = p.menu[i];
    if (cur.available === (it.available !== false) && cur.price === it.price_vnd) return null;
    p.menu[i] = { ...cur, available: it.available !== false, price: it.price_vnd };
    return p;
  });
  return out.changed;
}

// ── statistics ──────────────────────────────────────────────────────────────
async function realRedirects(ctx, placeIds, sinceMs) {
  const r = raw(ctx);
  if (r instanceof PostgresRepository) {
    const q = r.q ? r.q.bind(r) : (t, p) => r.pool.query(t, p);
    return (await q(`SELECT place_id, dish_id, action_type, partner, created_at FROM order_redirects
      WHERE place_id = ANY($1) AND created_at >= $2 ORDER BY created_at DESC LIMIT 20000`, [placeIds, new Date(sinceMs)])).rows
      .map(x => ({ ...x, created_at: new Date(x.created_at).toISOString() }));
  }
  return (ctx.store.orderRedirects || []).filter(o => placeIds.includes(o.place_id) && Date.parse(o.created_at) >= sinceMs);
}
const actionOf = o => o.action_type || redirectAction(o.partner);

/** Per-day totals and per-item rows for one place over the last `days` days (+ the window before). */
async function stats(ctx, placeId, days) {
  const keys = lastDays(days * 2);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const blank = () => keys.map(() => 0);
  const tot = { impressions: { real: blank(), demo: blank() }, directions: { real: blank(), demo: blank() },
    orders: { real: blank(), demo: blank() }, calls: { real: blank(), demo: blank() } };
  const partners = { maps: 0, grab_shopee: 0, xanhsm: 0, call: 0 };
  const items = await menuList(ctx, placeId);
  const rows = new Map(items.map(i => [i.id, { id: i.id, name: i.name, price_vnd: i.price_vnd, img_key: i.img_key, dish_id: i.dish_id,
    impressions: 0, directions: 0, orders: 0, calls: 0, real: 0, demo: 0 }]));
  const cur = i => i >= days; // second half = current window
  const counters = await ctx.ms.list(M, 'stat', { where: s => s.place_id === placeId });
  for (const s of counters) {
    const row = rows.get(s.menu_item_id);
    for (const [metric, key] of [['impressions', 'impressions'], ['directions', 'directions'], ['orders', 'orders'], ['calls', 'calls']]) {
      const arr = s[key] || [];
      keys.forEach((k, i) => {
        const v = arr[SERIES - keys.length + i] || 0;
        tot[metric].demo[i] += v;
        if (cur(i)) {
          if (row) { row[metric] += v; row.demo += v; }
          if (metric === 'directions') partners.maps += v;
          if (metric === 'calls') partners.call += v;
          if (metric === 'orders') {
            const sh = s.order_partners || {};
            partners.grab_shopee += Math.round(v * ((sh.grabfood || 0) + (sh.shopeefood || 0)));
            partners.xanhsm += Math.round(v * (sh.xanhsm || 0));
          }
        }
      });
    }
  }
  const real = await realRedirects(ctx, [placeId], Date.parse(keys[0] + 'T00:00:00+07:00'));
  const byDish = new Map();
  for (const i of items) if (i.dish_id && (!byDish.has(i.dish_id) || i.on_recommendations)) byDish.set(i.dish_id, i.id);
  for (const o of real) {
    const i = idx.get(dayKey(o.created_at));
    if (i === undefined) continue;
    const a = actionOf(o), metric = a === 'direction' ? 'directions' : a === 'call' ? 'calls' : 'orders';
    tot[metric].real[i] += 1;
    if (!cur(i)) continue;
    const row = rows.get(byDish.get(o.dish_id));
    if (row) { row[metric] += 1; row.real += 1; }
    if (a === 'direction') partners.maps += 1;
    else if (a === 'call') partners.call += 1;
    else if (o.partner === 'xanhsm') partners.xanhsm += 1;
    else partners.grab_shopee += 1;
  }
  const sum = (arr, from, to) => arr.slice(from, to).reduce((a, b) => a + b, 0);
  const kpi = metric => {
    const t = tot[metric];
    const realCur = sum(t.real, days), demoCur = sum(t.demo, days);
    const prev = sum(t.real, 0, days) + sum(t.demo, 0, days), value = realCur + demoCur;
    return { value, real: realCur, demo: demoCur, prev, delta_pct: prev ? Math.round(((value - prev) / prev) * 1000) / 10 : null,
      source: metric === 'impressions' ? 'demo_counter' : (demoCur ? 'order_redirects + demo_counter' : 'order_redirects') };
  };
  const daily = keys.slice(days).map((k, j) => {
    const i = days + j;
    return { date: k, label: weekdayOf(k), directions: tot.directions.real[i] + tot.directions.demo[i], orders: tot.orders.real[i] + tot.orders.demo[i] };
  });
  return { keys: keys.slice(days), kpis: { impressions: kpi('impressions'), directions: kpi('directions'), orders: kpi('orders'), calls: kpi('calls') },
    daily, partners, rows: [...rows.values()], real_redirects: real.filter(o => idx.get(dayKey(o.created_at)) >= days).length,
    is_demo: counters.length > 0 };
}
const cvr = r => (r.impressions ? Math.round(((r.directions + r.orders) / r.impressions) * 1000) / 10 : null);

// ── OCR ─────────────────────────────────────────────────────────────────────
const PRICE_RE = /(\d{2,3})(?:[.,](\d{3}))?\s*(k|ngan|d|đ|vnd)?\b/i;
const SANDBOX_MENU = '1. Phở bò tái nạm 45k\n2. Phở bò đặc biệt 60.000đ\n3. Quẩy giòn ăn kèm 10k';
async function parseScan(ctx, place, lines) {
  const dishes = await ctx.repo.listDishes();
  const sandbox = { places: [{ ...structuredClone(place), menu: [] }], dishes, ocrQueue: [] }; // engine mutates its copy only
  const parsed = parseMenuOcrText(sandbox, place.id, lines.join('\n'));
  const byId = new Map(dishes.map(d => [d.id, d]));
  return parsed.items.map((p, i) => {
    const hasPrice = PRICE_RE.test(p.raw_text);
    const sim = computeStringSimilarity(p.extracted_name, p.matched_dish_name || '');
    const d = sim > 0 ? byId.get(p.matched_dish_id) : null;
    const confidence = d ? p.confidence : 0.5;
    return { idx: i + 1, raw_text: p.raw_text, name: ctx.util.cleanText(p.extracted_name, 80), price_vnd: hasPrice ? p.extracted_price : null,
      dish_id: d?.id || null, dish_name: d?.name || null, confidence, allergen_tags: d?.allergen_tags || [],
      calories: d?.calories ?? null, dish_tags: (d?.tags || []).slice(0, 2),
      status: d && hasPrice && confidence >= 0.95 ? 'ready' : 'pending_review' };
  });
}
const scanOut = s => ({ ...s, total_extracted: s.items.length, auto_approved_count: s.items.filter(i => i.status === 'ready').length,
  queued_for_admin_count: s.items.filter(i => i.status === 'pending_review').length,
  review_queue: 'module', note: 'Món độ tin cậy thấp ở trạng thái chờ duyệt trong Cổng Quán; chưa đưa vào hàng chờ M9-S05.' });

// ── profile ─────────────────────────────────────────────────────────────────
const LINK_HOSTS = { grabfood: ['food.grab.com', 'r.grab.com'], shopeefood: ['shopeefood.vn', 'www.shopeefood.vn'],
  xanhsm: ['xanhsm.com', 'www.xanhsm.com'], befood: ['be.com.vn', 'www.be.com.vn'] };
function cleanLink(partner, v) {
  if (v === '' || v === null) return '';
  if (typeof v !== 'string' || v.length > 300 || /[\s\\]/.test(v)) return undefined;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !LINK_HOSTS[partner].includes(u.hostname)) return undefined;
    return u.href;
  } catch { return undefined; }
}
async function profileOf(ctx, placeId) {
  return (await ctx.ms.list(M, 'profile', { where: p => p.place_id === placeId }))[0] || null;
}
async function placeOut(ctx, place, role) {
  const prof = await profileOf(ctx, place.id);
  const menu = (await ctx.ms.list(M, 'menu_item', { where: i => i.place_id === place.id }));
  return {
    id: place.id, name: place.name, address: place.address, phone: place.phone || '', rating: place.rating ?? null,
    review_count: place.review_count ?? null, img_key: place.img_key || null, lat: place.lat, lng: place.lng,
    is_verified: place.is_verified === true, is_open: place.is_open_override !== false, open_status: openStatus(place),
    hours_text: hoursText(place), hours_verified: !!place.opening_hours?.weekly && !!place.verified_at,
    amenities: { has_ac: !!place.has_ac, has_kids_seat: !!place.has_kids_seat, has_parking: !!prof?.has_parking },
    links: { grabfood: place.links?.grabfood || '', shopeefood: place.links?.shopeefood || '', xanhsm: place.links?.xanhsm || '' },
    paused_by_merchant: !!prof?.paused_by_merchant, pending_change: prof?.pending || null,
    menu_count: menu.length, menu_available: menu.filter(i => i.available !== false && i.status !== 'pending_review').length,
    role, role_label: ROLE_LABEL[role]
  };
}
function parseHours(text) {
  const m = String(text || '').match(/(\d{1,2})[:h](\d{2})\s*[–—-]\s*(\d{1,2})[:h](\d{2})/);
  if (!m) return null;
  const hh = (h, mm) => (Number(h) <= 24 && Number(mm) < 60 ? `${String(h).padStart(2, '0')}:${mm}` : null);
  const a = hh(m[1], m[2]), b = hh(m[3], m[4]);
  if (!a || !b || a === b || (b > '24:00')) return null;
  return { open: a, close: b, weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(d => [d, [[a, b]]])) };
}

// ── staff ───────────────────────────────────────────────────────────────────
const staffOut = m => ({ id: m.id, name: m.name, title: m.title || '', phone_masked: m.phone ? m.phone.replace(/^(\+84)(\d{2})\d{4}(\d{3})$/, '0$2****$3') : '',
  role: m.role, role_label: ROLE_LABEL[m.role], rights: ROLE_RIGHTS[m.role], place_ids: m.place_ids || [],
  linked: !!m.user_id, is_demo: m.is_demo });

// ── route ───────────────────────────────────────────────────────────────────
async function route(ctx) {
  const { method, pathname, body, util, ms } = ctx;
  if (!pathname.startsWith('/api/v1/merchant/')) return null;
  const sub = pathname.slice('/api/v1/merchant'.length);
  if (!ctx.authUser) return util.unauthorized();
  const acc = await access(ctx);
  const isDemo = (...lists) => lists.flat().some(x => x && x.is_demo);

  // M6-S01 — who am I, which places; claim a place.
  if (sub === '/me' && method === 'GET') {
    const places = [];
    for (const [id, role] of acc.places) {
      const p = await raw(ctx).getPlace(id);
      if (p) places.push({ id, name: p.name, address: p.address, role, role_label: ROLE_LABEL[role], open_status: openStatus(p) });
    }
    const claims = await ms.list(M, 'claim', { ownerId: ctx.userId });
    const claimable = acc.admin || places.length ? [] : (await ctx.repo.listPlaces()).map(p => ({ id: p.id, name: p.name, address: p.address }));
    return { status: 200, data: { user: { id: ctx.authUser.id, role: ctx.authUser.role }, admin: acc.admin, places: acc.admin ? places.slice(0, 20) : places,
      memberships: acc.memberships.map(staffOut), claims, claimable, is_demo: isDemo(acc.memberships) } };
  }
  if (sub === '/claim' && method === 'POST') {
    const placeId = util.cleanText(body.place_id, 40);
    const note = util.cleanText(body.note, 300);
    if (!placeId) return util.bad('Cần chọn quán (place_id)');
    const place = await ctx.repo.getPlace(placeId);
    if (!place) return util.notFound('Không tìm thấy quán');
    if (acc.places.has(placeId)) return fail(409, 'Bạn đã quản lý quán này');
    const dup = await ms.list(M, 'claim', { ownerId: ctx.userId, where: c => c.place_id === placeId && c.status === 'pending_review' });
    if (dup.length) return fail(409, 'Yêu cầu nhận quán này đang chờ xác minh');
    const claim = await ms.insert({ module: M, kind: 'claim', ownerId: ctx.userId, data: { place_id: placeId, place_name: place.name, note,
      status: 'pending_review', verification: 'Chờ đội vận hành xác minh giấy tờ (M9). Chưa cấp quyền quản lý quán.' } });
    return { status: 201, data: claim };
  }

  // M6-S02 — overview KPIs (legacy shape: place + kpis.*_7d + ctr_pct).
  if (sub === '/overview' && method === 'GET') {
    const t = await placeFor(ctx, acc, 'stats'); if (t.error) return t.error;
    const s = await stats(ctx, t.placeId, 7);
    const k = s.kpis;
    const conv = k.directions.value + k.orders.value + k.calls.value;
    const chTotal = Object.values(s.partners).reduce((a, b) => a + b, 0);
    const pct = v => (chTotal ? Math.round((v / chTotal) * 100) : 0);
    const top = [...s.rows].sort((a, b) => b.impressions - a.impressions).slice(0, 3);
    return { status: 200, data: {
      place: await placeOut(ctx, t.place, t.role),
      kpis: { impressions_7d: k.impressions.value, direction_clicks_7d: k.directions.value, order_clicks_7d: k.orders.value,
        call_clicks_7d: k.calls.value, ctr_pct: k.impressions.value ? Math.round((conv / k.impressions.value) * 1000) / 10 : 0 },
      cards: [
        { key: 'impressions', label: 'Hiển thị trong Gợi ý AI', ...k.impressions },
        { key: 'directions', label: 'Bấm Chỉ đường (Maps)', ...k.directions },
        { key: 'orders', label: 'Click Đặt món (Grab/Shopee/Xanh SM)', ...k.orders },
        { key: 'calls', label: 'Cuộc gọi đặt trước', ...k.calls }
      ],
      chart: { days: s.daily, delta_pct: (() => { const c = k.directions.value + k.orders.value, p = k.directions.prev + k.orders.prev; return p ? Math.round(((c - p) / p) * 1000) / 10 : null; })() },
      channels: { total: conv, items: [
        { key: 'maps', label: 'Chỉ đường Google Maps', count: s.partners.maps, pct: pct(s.partners.maps) },
        { key: 'grab_shopee', label: 'Đặt qua GrabFood / Shopee', count: s.partners.grab_shopee, pct: pct(s.partners.grab_shopee) },
        { key: 'xanhsm', label: 'Đặt qua Xanh SM Ngon', count: s.partners.xanhsm, pct: pct(s.partners.xanhsm) },
        { key: 'call', label: 'Gọi điện đặt trước', count: s.partners.call, pct: pct(s.partners.call) }] },
      top_dishes: top.map(r => ({ ...r, cvr_pct: cvr(r) })),
      real_redirects_7d: s.real_redirects, is_demo: s.is_demo,
      sources: { real: 'order_redirects (M5: chỉ đường, đặt món, gọi điện)', demo: 'Bộ đếm demo theo món; lượt hiển thị chỉ có số demo (chưa ghi log hiển thị)' }
    } };
  }

  // M6-S08 — per-dish analytics.
  if (sub === '/analytics' && method === 'GET') {
    const t = await placeFor(ctx, acc, 'stats'); if (t.error) return t.error;
    const days = ctx.searchParams.get('days') === '30' ? 30 : 7;
    const s = await stats(ctx, t.placeId, days);
    const rows = s.rows.map(r => ({ ...r, cvr_pct: cvr(r) })).sort((a, b) => b.impressions - a.impressions || b.orders - a.orders);
    return { status: 200, data: { place_id: t.placeId, place_name: t.place.name, days, rows, totals: s.kpis, real_redirects: s.real_redirects, is_demo: s.is_demo } };
  }

  // M6-S04 — branches (legacy shape: branches[].is_open).
  if (sub === '/branches' && method === 'GET') {
    const branches = [];
    for (const [id, role] of acc.places) {
      if (acc.admin && branches.length >= 20) break;
      const p = await raw(ctx).getPlace(id);
      if (p) branches.push(await placeOut(ctx, p, role));
    }
    return { status: 200, data: { branches, total: branches.length, is_demo: isDemo(acc.memberships) } };
  }

  // M6-S03 — place profile.
  const placeM = sub.match(/^\/places\/([^/]+)$/);
  if (placeM && method === 'GET') {
    ctx.body.place_id = decodeURIComponent(placeM[1]);
    const t = await placeFor(ctx, acc, 'read'); if (t.error) return t.error;
    return { status: 200, data: await placeOut(ctx, t.place, t.role) };
  }
  if (placeM && (method === 'PUT' || method === 'PATCH')) {
    const placeId = decodeURIComponent(placeM[1]);
    const t = await placeFor({ ...ctx, body: { place_id: placeId }, searchParams: new URLSearchParams() }, acc, 'profile'); if (t.error) return t.error;
    const p = t.place, prof = await profileOf(ctx, placeId);
    // Validate everything first.
    const links = {};
    if (body.links !== undefined) {
      if (!body.links || typeof body.links !== 'object') return util.bad('links không hợp lệ');
      for (const k of ['grabfood', 'shopeefood', 'xanhsm', 'befood']) {
        if (body.links[k] === undefined) continue;
        const v = cleanLink(k, body.links[k]);
        if (v === undefined) return util.bad(`Link ${k} phải là https trên tên miền chính thức (${LINK_HOSTS[k].join(', ')})`);
        links[k] = v;
      }
    }
    const pending = {};
    if (body.name !== undefined) {
      const n = util.cleanText(body.name, 120);
      if (n.length < 2) return util.bad('Tên quán cần ít nhất 2 ký tự');
      if (n !== p.name) pending.name = n;
    }
    if (body.address !== undefined) {
      const a = util.cleanText(body.address, 200);
      if (a.length < 5) return util.bad('Địa chỉ quá ngắn');
      if (a !== p.address) pending.address = a;
    }
    if (body.hours_text !== undefined) {
      const h = parseHours(body.hours_text);
      if (!h) return util.bad('Giờ mở cửa dạng "06:00 – 22:00"');
      if (`${h.open} – ${h.close}` !== hoursText(p)) pending.opening_hours = { weekly: h.weekly }, pending.hours_text = `${h.open} – ${h.close}`;
    }
    const bool = v => (v === undefined ? undefined : v === true || v === 'true');
    const am = body.amenities || {};
    const hasAc = bool(am.has_ac), hasKids = bool(am.has_kids_seat), hasParking = bool(am.has_parking), paused = bool(body.paused);
    if (paused === false && p.is_open_override === false && !prof?.paused_by_merchant)
      return fail(409, 'Quán đang tạm ẩn do báo cáo/kiểm duyệt (M9), chủ quán không tự mở lại được', { code: 'PAUSED_BY_MODERATION' });
    const coreChange = Object.keys(links).length || hasAc !== undefined || hasKids !== undefined || paused !== undefined;
    let synced = false;
    if (coreChange) {
      const out = await syncCore(ctx, placeId, q => {
        let changed = false;
        const set = (k, v) => { if (v !== undefined && q[k] !== v) { q[k] = v; changed = true; } };
        set('has_ac', hasAc); set('has_kids_seat', hasKids);
        if (paused === true) set('is_open_override', false);
        if (paused === false && prof?.paused_by_merchant) set('is_open_override', true);
        if (Object.keys(links).length) {
          const next = { ...(q.links || {}) };
          for (const [k, v] of Object.entries(links)) { if (v) next[k] = v; else delete next[k]; }
          if (JSON.stringify(next) !== JSON.stringify(q.links || {})) { q.links = next; changed = true; }
        }
        return changed ? q : null;
      });
      synced = out.changed;
    }
    const now = new Date().toISOString();
    const nextProf = { place_id: placeId,
      has_parking: hasParking ?? prof?.has_parking ?? false,
      paused_by_merchant: paused === true ? true : paused === false ? false : !!prof?.paused_by_merchant,
      pending: Object.keys(pending).length ? { ...(prof?.pending || {}), ...pending, status: 'pending_review', requested_by: ctx.userId, requested_at: now,
        note: 'Chờ M9 xác minh trước khi hiển thị trên gợi ý; giờ mở cửa chưa xác minh không bao giờ hiện là Đang mở.' } : (prof?.pending || null),
      updated_by: ctx.userId };
    if (prof) await ms.update(prof.id, nextProf);
    else await ms.insert({ module: M, kind: 'profile', data: nextProf });
    const fresh = await raw(ctx).getPlace(placeId);
    return { status: 200, data: { ...(await placeOut(ctx, fresh, t.role)), synced_to_catalogue: synced, pending_fields: Object.keys(pending) } };
  }

  // M6-S05 — menu (legacy shape: items[] with id, name, price_vnd, available, category).
  if (sub === '/menu' && method === 'GET') {
    const t = await placeFor(ctx, acc, 'read'); if (t.error) return t.error;
    const items = await menuList(ctx, t.placeId);
    return { status: 200, data: { place_id: t.placeId, place_name: t.place.name, role: t.role, items, total: items.length, is_demo: isDemo(items) } };
  }
  if (sub === '/menu' && method === 'POST') {
    const t = await placeFor(ctx, acc, 'menu'); if (t.error) return t.error;
    const name = util.cleanText(body.name, 80);
    const price = Number(body.price_vnd);
    if (name.length < 2) return util.bad('Cần tên món (ít nhất 2 ký tự)');
    if (!Number.isSafeInteger(price) || price < 0 || price > 10000000) return util.bad('Giá phải là số nguyên từ 0 đến 10.000.000đ');
    let dishId = null;
    if (body.dish_id) {
      dishId = util.cleanText(body.dish_id, 40);
      if (!(await ctx.repo.getDish(dishId))) return util.bad('dish_id không có trong Thư viện món M2');
    }
    const rec = await ms.insert({ module: M, kind: 'menu_item', data: { place_id: t.placeId, dish_id: dishId, name, price_vnd: price,
      available: body.available !== false, category: util.cleanText(body.category, 40) || 'Món chính', img_key: null,
      core_synced: false, status: 'published', source: 'manual', created_by: ctx.userId } });
    return { status: 201, data: menuOut(rec, await dishMap(ctx), await campaignDishes(ctx, t.placeId)) };
  }
  const menuM = sub.match(/^\/menu\/([^/]+)$/);
  if (menuM && menuM[1] !== 'ocr' && ['PUT', 'PATCH', 'DELETE'].includes(method)) {
    const it = await ms.get(decodeURIComponent(menuM[1]));
    if (!it || it.module !== M || it.kind !== 'menu_item') return util.notFound('Không tìm thấy món');
    const role = acc.places.get(it.place_id);
    if (!role) return fail(403, 'Bạn không quản lý quán này');
    if (method === 'DELETE') {
      if (!PERMS[role].includes('menu')) return fail(403, `Vai trò ${ROLE_LABEL[role]} không được xoá món`);
      await ms.remove(it.id);
      // A reviewed catalogue entry is never removed from here; it is only marked "Tạm hết".
      if (it.core_synced) await syncMenuItem(ctx, { ...it, available: false });
      return { status: 200, data: { deleted: true, id: it.id } };
    }
    const keys = Object.keys(body).filter(k => ['name', 'price_vnd', 'available', 'category'].includes(k));
    if (!keys.length) return util.bad('Không có thay đổi');
    if (keys.some(k => k !== 'available') && !PERMS[role].includes('menu'))
      return fail(403, 'Nhân viên chỉ được bật/tắt Còn món / Tạm hết');
    const patch = {};
    if (body.name !== undefined) { const n = util.cleanText(body.name, 80); if (n.length < 2) return util.bad('Tên món quá ngắn'); patch.name = n; }
    if (body.price_vnd !== undefined) {
      const pr = Number(body.price_vnd);
      if (!Number.isSafeInteger(pr) || pr < 0 || pr > 10000000) return util.bad('Giá phải là số nguyên từ 0 đến 10.000.000đ');
      patch.price_vnd = pr;
    }
    if (body.available !== undefined) {
      if (typeof body.available !== 'boolean') return util.bad('available phải là true/false');
      if (body.available && it.status === 'pending_review') return fail(409, 'Món đang chờ duyệt, chưa bật bán được');
      patch.available = body.available;
    }
    if (body.category !== undefined) patch.category = util.cleanText(body.category, 40) || 'Món chính';
    const next = await ms.update(it.id, { ...patch, updated_by: ctx.userId });
    const synced = await syncMenuItem(ctx, next);
    return { status: 200, data: { ...menuOut(next, await dishMap(ctx), await campaignDishes(ctx, it.place_id)), synced_to_catalogue: synced } };
  }

  // M6-S06 — AI menu OCR.
  if (sub === '/menu/ocr' && method === 'GET') {
    const t = await placeFor(ctx, acc, 'ocr'); if (t.error) return t.error;
    const scans = (await ms.list(M, 'ocr_scan', { where: s => s.place_id === t.placeId })).reverse();
    return { status: 200, data: { place_id: t.placeId, place_name: t.place.name, scans: scans.slice(0, 10).map(scanOut), latest: scans[0] ? scanOut(scans[0]) : null, is_demo: isDemo(scans.slice(0, 1)) } };
  }
  if (sub === '/menu/ocr' && method === 'POST') {
    const t = await placeFor(ctx, acc, 'ocr'); if (t.error) return t.error;
    const text = typeof body.raw_text === 'string' ? body.raw_text.slice(0, 4000) : '';
    let lines = text.split(/\r?\n/).map(l => util.cleanText(l, 120)).filter(l => l.length >= 2).slice(0, 40);
    const image = util.cleanText(body.image_name, 120);
    let sandbox = false;
    if (!lines.length && image) { lines = SANDBOX_MENU.split('\n'); sandbox = true; }
    if (!lines.length) return util.bad('Cần dán chữ trên bảng giá (raw_text) hoặc chọn ảnh thực đơn');
    const items = await parseScan(ctx, t.place, lines);
    const rec = await ms.insert({ module: M, kind: 'ocr_scan', data: { place_id: t.placeId, source: sandbox ? 'image' : 'text', image_name: image || null,
      sandbox, sandbox_note: sandbox ? 'OCR ảnh chưa kết nối: đây là kết quả mẫu, không phải chữ đọc từ ảnh của bạn.' : null,
      status: 'draft', created_by: ctx.userId, raw_text: lines.join('\n'),
      items: items.map(({ idx, ...i }) => ({ id: null, ...i })) } });
    const withIds = await ms.update(rec.id, cur => ({ ...cur, items: cur.items.map((i, n) => ({ ...i, id: `${rec.id}-${n + 1}` })) }));
    return { status: 201, data: scanOut(withIds) };
  }
  const pubM = sub.match(/^\/menu\/ocr\/([^/]+)\/publish$/);
  if (pubM && method === 'POST') {
    const scan = await ms.get(decodeURIComponent(pubM[1]));
    if (!scan || scan.module !== M || scan.kind !== 'ocr_scan') return util.notFound('Không tìm thấy lượt quét');
    const role = acc.places.get(scan.place_id);
    if (!role) return fail(403, 'Bạn không quản lý quán này');
    if (!PERMS[role].includes('ocr')) return fail(403, `Vai trò ${ROLE_LABEL[role]} không được xuất bản thực đơn`);
    let won = false;
    await ms.update(scan.id, cur => { if (cur.status !== 'draft') return null; won = true; return { ...cur, status: 'published', published_by: ctx.userId, published_at: new Date().toISOString() }; });
    if (!won) return fail(409, 'Lượt quét này đã được xuất bản');
    const created = [];
    for (const i of scan.items) {
      const pending = i.status !== 'ready';
      created.push(await ms.insert({ module: M, kind: 'menu_item', data: { place_id: scan.place_id, dish_id: i.dish_id, name: i.name,
        price_vnd: i.price_vnd ?? 0, available: !pending, category: 'Món chính', img_key: null, core_synced: false,
        status: pending ? 'pending_review' : 'published', source: 'ocr', ocr_item_id: i.id, ocr_confidence: i.confidence, created_by: ctx.userId } }));
    }
    return { status: 200, data: { scan_id: scan.id, published: created.filter(c => c.status === 'published').length,
      pending_review: created.filter(c => c.status === 'pending_review').length, items: created.map(c => c.id),
      note: 'Món mới vào Thực đơn Quán; chỉ lên gợi ý M3 sau khi M9 ghép món chuẩn.' } };
  }

  // M6-S07 — daily special & promotions (legacy shapes: promotions[], daily_special[]).
  const promoOut = (p, dishes) => ({ ...p, img_key: p.img_key || dishes.get(p.dish_id)?.img_key || null,
    is_today: p.type === 'daily_special' ? p.valid_date === dayKey() : true });
  const listPromos = async placeId => {
    const dishes = await dishMap(ctx);
    return (await ms.list(M, 'promotion', { where: p => p.place_id === placeId })).map(p => promoOut(p, dishes)).reverse();
  };
  const dailyOut = list => list.filter(p => p.type === 'daily_special' && p.active && p.is_today)
    .map(p => ({ ...p, id: p.dish_id || p.id, special_id: p.id, name: p.title, special_label: p.detail || 'Món đặc biệt hôm nay' }));
  if ((sub === '/promotions' || sub === '/daily-special') && method === 'GET') {
    const t = await placeFor(ctx, acc, 'read'); if (t.error) return t.error;
    const all = await listPromos(t.placeId);
    const daily = dailyOut(all);
    return { status: 200, data: { place_id: t.placeId, place_name: t.place.name, promotions: all.filter(p => p.type !== 'daily_special'),
      daily_special: daily, specials: all.filter(p => p.type === 'daily_special'), is_demo: isDemo(all),
      message: 'Danh sách món đặc biệt hôm nay', signal_note: 'Lưu ở Cổng Quán; bộ máy gợi ý M3 chưa đọc tín hiệu này.' } };
  }
  if ((sub === '/promotions' || sub === '/daily-special') && method === 'POST') {
    const t = await placeFor(ctx, acc, 'promo'); if (t.error) return t.error;
    const type = sub === '/daily-special' || body.type === 'daily_special' ? 'daily_special' : 'promotion';
    const items = await ms.list(M, 'menu_item', { where: i => i.place_id === t.placeId });
    let menuItem = null;
    if (body.menu_item_id) menuItem = items.find(i => i.id === body.menu_item_id) || null;
    else if (body.dish_id) menuItem = items.find(i => i.dish_id === body.dish_id && i.core_synced) || items.find(i => i.dish_id === body.dish_id) || null;
    if ((body.menu_item_id || (type === 'daily_special' && body.dish_id)) && !menuItem) return util.bad('Món không có trong thực đơn quán');
    if (type === 'daily_special' && !menuItem) return util.bad('Chọn một món trong thực đơn (menu_item_id)');
    const title = util.cleanText(body.title, 120) || (type === 'daily_special' ? menuItem.name : '');
    if (title.length < 2) return util.bad('Cần tiêu đề khuyến mãi');
    const detail = util.cleanText(body.detail ?? body.label, 200);
    const discount = body.discount_pct === undefined || body.discount_pct === '' ? 0 : Number(body.discount_pct);
    if (!Number.isFinite(discount) || discount < 0 || discount > 90) return util.bad('Giảm giá từ 0 đến 90%');
    const hm = v => (v === undefined || v === '' ? null : /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : false);
    const st = hm(body.start_time), en = hm(body.end_time);
    if (st === false || en === false) return util.bad('Giờ dạng HH:MM');
    if (type === 'daily_special') {
      // One special per place per day: the new one replaces today's.
      for (const p of await ms.list(M, 'promotion', { where: p => p.place_id === t.placeId && p.type === 'daily_special' && p.active }))
        await ms.update(p.id, { active: false });
    }
    const rec = await ms.insert({ module: M, kind: 'promotion', data: { place_id: t.placeId, type, menu_item_id: menuItem?.id || null,
      dish_id: menuItem?.dish_id || null, tag: util.cleanText(body.tag, 60) || null, title, detail, start_time: st, end_time: en,
      discount_pct: Math.round(discount), valid_date: type === 'daily_special' ? dayKey() : null, active: true,
      img_key: menuItem?.img_key || null, created_by: ctx.userId } });
    const out = promoOut(rec, await dishMap(ctx));
    if (sub === '/daily-special') return { status: 200, data: { tagged: true, dish_id: out.dish_id, label: out.detail || 'Món đặc biệt hôm nay', special: out } };
    return { status: 200, data: { ...out, status: 'active' } };
  }
  const promoM = sub.match(/^\/promotions\/([^/]+)$/);
  if (promoM && ['PATCH', 'PUT', 'DELETE'].includes(method)) {
    const p = await ms.get(decodeURIComponent(promoM[1]));
    if (!p || p.module !== M || p.kind !== 'promotion') return util.notFound('Không tìm thấy khuyến mãi');
    const role = acc.places.get(p.place_id);
    if (!role) return fail(403, 'Bạn không quản lý quán này');
    if (!PERMS[role].includes('promo')) return fail(403, `Vai trò ${ROLE_LABEL[role]} không được sửa khuyến mãi`);
    if (method === 'DELETE') { await ms.remove(p.id); return { status: 200, data: { deleted: true, id: p.id } }; }
    if (typeof body.active !== 'boolean') return util.bad('active phải là true/false');
    const next = await ms.update(p.id, { active: body.active, updated_by: ctx.userId });
    return { status: 200, data: promoOut(next, await dishMap(ctx)) };
  }

  // M6-S09 — staff & roles.
  if (sub === '/staff' && method === 'GET') {
    const t = await placeFor(ctx, acc, 'read'); if (t.error) return t.error;
    const staff = (await ms.list(M, 'membership', { where: m => (m.place_ids || []).includes(t.placeId) }))
      .sort((a, b) => RANK[b.role] - RANK[a.role]).map(staffOut);
    return { status: 200, data: { place_id: t.placeId, place_name: t.place.name, my_role: t.role, can_manage: PERMS[t.role].includes('staff'), staff, is_demo: isDemo(staff) } };
  }
  if (sub === '/staff' && method === 'POST') {
    const t = await placeFor(ctx, acc, 'staff'); if (t.error) return t.error;
    const name = util.cleanText(body.name, 80);
    const phone = normalizePhone(String(body.phone || ''));
    const role = body.role === 'manager' ? 'manager' : body.role === 'staff' ? 'staff' : null;
    if (name.length < 2) return util.bad('Cần họ tên nhân viên');
    if (!phone) return util.bad('Số điện thoại không hợp lệ');
    if (!role) return util.bad('Vai trò chỉ có thể là manager hoặc staff');
    const exists = await ms.list(M, 'membership', { where: m => m.phone === phone && (m.place_ids || []).includes(t.placeId) });
    if (exists.length) return fail(409, 'Số điện thoại này đã có trong danh sách nhân viên quán');
    const rec = await ms.insert({ module: M, kind: 'membership', data: { phone, name, title: util.cleanText(body.title, 60) || (role === 'manager' ? 'Quản lý' : 'Nhân viên'),
      role, place_ids: [t.placeId], user_id: null, invited_by: ctx.userId } });
    return { status: 201, data: { ...staffOut(rec), invite: { sent: false, sandbox: true,
      note: 'Chưa gửi SMS mời (sandbox). Nhân viên đăng nhập bằng số này khi số đã được cấp quyền chủ quán.' } } };
  }
  const staffM = sub.match(/^\/staff\/([^/]+)$/);
  if (staffM && ['PATCH', 'PUT', 'DELETE'].includes(method)) {
    const m = await ms.get(decodeURIComponent(staffM[1]));
    if (!m || m.module !== M || m.kind !== 'membership') return util.notFound('Không tìm thấy nhân viên');
    const shared = (m.place_ids || []).filter(p => PERMS[acc.places.get(p)]?.includes('staff'));
    if (!shared.length) return fail(403, 'Chỉ chủ quán được quản lý nhân viên');
    if (m.role === 'owner') return fail(409, 'Không đổi hoặc xoá quyền chủ quán tại đây');
    if (method === 'DELETE') { await ms.remove(m.id); return { status: 200, data: { deleted: true, id: m.id } }; }
    const role = body.role === 'manager' ? 'manager' : body.role === 'staff' ? 'staff' : null;
    if (!role) return util.bad('Vai trò chỉ có thể là manager hoặc staff');
    const next = await ms.update(m.id, { role, updated_by: ctx.userId });
    return { status: 200, data: staffOut(next) };
  }
  return null;
}

export default { id: M, personalKinds: ['claim'], seed, route };
