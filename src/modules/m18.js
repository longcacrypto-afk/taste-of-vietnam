// M18 — Tủ lạnh thông minh & quét mã vạch (M18-S01 inventory, M18-S02 EAN-13 scan).
// Shared contract: fridge items are module 'M18', kind 'item', owner_id = user id,
// data { name, quantity, unit, compartment, expires_at (ISO), barcode|null }.
// M11-S03 reads them with ms.list('M18', 'item', { ownerId }).
//
// Demo data: 'template' rows (a starter fridge) are copied once into a user's fridge the
// first time they open it (flagged is_demo), and 'product' rows are a demo barcode table
// (GS1 prefix 893 = Việt Nam). Camera decoding / OCR is not available: the user types
// (or a scanner app pastes) the 13 digits; the server validates the check digit.
import { isDishSafeForUser } from '../services/recommender.js';
import { removeVietnameseTones } from '../services/textUtils.js';

const M = 'M18';
const DAY = 86400000;
const SOON_MS = 48 * 3600000;
export const COMPARTMENTS = { chill: 'Ngăn mát', freeze: 'Ngăn đông', door: 'Cánh tủ', vegetable: 'Ngăn rau củ' };
const UNITS = ['quả', 'miếng', 'g', 'kg', 'ml', 'lít', 'hộp', 'chai', 'gói', 'lốc', 'bó', 'phần', 'túi', 'con', 'khay', 'cây'];

// GS1 country prefixes we name on the scan screen (3-digit ranges).
const GS1 = [[893, 893, 'Việt Nam'], [885, 885, 'Thái Lan'], [880, 880, 'Hàn Quốc'], [690, 699, 'Trung Quốc'],
  [450, 459, 'Nhật Bản'], [490, 499, 'Nhật Bản'], [888, 888, 'Singapore'], [899, 899, 'Indonesia'], [955, 955, 'Malaysia'],
  [0, 139, 'Mỹ / Canada'], [400, 440, 'Đức'], [300, 379, 'Pháp']];

/** EAN-13: 13 digits, last one = check digit (weights 1,3 alternating). */
export function ean13Valid(code) {
  if (!/^\d{13}$/.test(code)) return false;
  let t = 0;
  for (let i = 0; i < 12; i++) t += Number(code[i]) * (i % 2 ? 3 : 1);
  return (10 - (t % 10)) % 10 === Number(code[12]);
}
export function gs1Country(code) {
  const p = Number(String(code).slice(0, 3));
  const hit = GS1.find(([a, b]) => p >= a && p <= b);
  return hit ? hit[2] : 'Không xác định';
}

const tpl = (n, name, quantity, unit, compartment, days, emoji) =>
  ({ kind: 'template', id: `M18-TPL-0${n}`, data: { name, quantity, unit, compartment, expires_in_days: days, emoji, barcode: null } });
const product = (ean, name, brand, compartment, shelf, quantity, unit, emoji) =>
  ({ kind: 'product', id: `M18-EAN-${ean}`, data: { ean, name, brand, compartment, shelf_life_days: shelf, quantity, unit, emoji } });

const seed = () => [
  tpl(1, 'Trứng gà ta', 6, 'quả', 'door', 2, '🥚'),
  tpl(2, 'Đậu hũ non', 2, 'miếng', 'chill', 1, '🧈'),
  tpl(3, 'Thịt bò phi lê', 300, 'g', 'freeze', 14, '🥩'),
  tpl(4, 'Cà chua Đà Lạt', 4, 'quả', 'vegetable', 3, '🍅'),
  tpl(5, 'Cá lóc đồng phi lê', 500, 'g', 'chill', 2, '🐟'),
  tpl(6, 'Bạc hà (dọc mùng)', 1, 'bó', 'vegetable', 4, '🥬'),
  // Demo barcode table — codes are demo GTINs with valid check digits, not real products' codes.
  product('8934567890120', 'Sữa chua uống men sống Probi', 'Vinamilk', 'chill', 5, 5, 'chai', '🥛'),
  product('8935000123454', 'Sữa tươi tiệt trùng ít đường 1L', 'Vinamilk', 'door', 7, 1, 'hộp', '🥛'),
  product('8934601234019', 'Đậu hũ non hộp 300g', 'Đậu hũ Biên Hòa', 'chill', 3, 1, 'hộp', '🧈'),
  product('8938612004524', 'Trứng gà sạch hộp 10 quả', 'Ba Huân', 'door', 14, 10, 'quả', '🥚'),
  product('8935202010101', 'Xúc xích heo tiệt trùng', 'Vissan', 'chill', 30, 1, 'gói', '🌭'),
  product('8936123007775', 'Bánh phở tươi 500g', 'Lò bánh phở Tân Mai', 'chill', 2, 500, 'g', '🍜'),
  product('8937055003187', 'Rau cải ngọt VietGAP 300g', 'HTX rau Long Thành', 'vegetable', 3, 300, 'g', '🥬'),
  product('8935018880219', 'Cá lóc phi lê cấp đông 500g', 'Thủy sản Đồng Nai', 'freeze', 60, 500, 'g', '🐟'),
  product('8936241005530', 'Bò viên gân 500g', 'Bò viên Biên Hòa', 'freeze', 30, 500, 'g', '🍢'),
  product('8850000001468', 'Nước cốt dừa 400ml', 'Nhập khẩu Thái Lan', 'door', 3, 400, 'ml', '🥥')
];

const norm = s => removeVietnameseTones(s);
// Words too generic to match on their own ("thịt", "cá"...): we need the next word too.
const GENERIC = new Set(['thit', 'ca', 'rau', 'nuoc', 'banh', 'hanh', 'sua', 'mi', 'bun', 'la', 'hat', 'bot', 'dau', 'trai', 'cu', 'nam', 'xuc', 'bo', 'cha', 'gio', 'pho', 'com']);
function itemKeys(name) {
  const w = norm(name).split(' ').filter(Boolean);
  const keys = [];
  if (w.length >= 2) keys.push(w[0] + ' ' + w[1]);
  if (w[0] && !GENERIC.has(w[0])) keys.push(w[0]);
  return keys;
}
const hasWords = (text, key) => (' ' + norm(text) + ' ').includes(' ' + key + ' ');

/** Item as returned to the UI: contract fields + computed expiry fields. */
function view(r, now = Date.now()) {
  const left = Date.parse(r.expires_at) - now;
  const days = Math.ceil(left / DAY);
  return {
    id: r.id, name: r.name, quantity: r.quantity, unit: r.unit, compartment: r.compartment,
    compartment_label: COMPARTMENTS[r.compartment] || r.compartment, expires_at: r.expires_at, barcode: r.barcode ?? null,
    emoji: r.emoji || null, quantity_label: `${r.quantity} ${r.unit}`.trim(),
    expires_in_days: days, hours_left: Math.round(left / 3600000),
    is_expired: left < 0, is_expiring_soon: left <= SOON_MS, is_demo: r.is_demo, created_at: r.created_at, updated_at: r.updated_at
  };
}

// "500g" / "6 quả" / 2 → { quantity, unit }
function parseQty(q, unit, util) {
  let n = q, u = unit;
  if (typeof q === 'string') {
    const m = q.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
    if (m) { n = Number(m[1].replace(',', '.')); u = u || m[2]; } else n = NaN;
  }
  n = Number(n);
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return { quantity: Math.round(n * 100) / 100, unit: util.cleanText(u, 12) || 'phần' };
}
function expiryFrom(body, fallbackDays = null) {
  if (body.expires_at !== undefined && body.expires_at !== null && body.expires_at !== '') {
    const t = Date.parse(body.expires_at);
    if (!Number.isFinite(t)) return { error: 'Hạn sử dụng không hợp lệ (ISO date)' };
    return { value: new Date(t).toISOString() };
  }
  const d = body.expires_in_days !== undefined && body.expires_in_days !== '' ? Number(body.expires_in_days) : fallbackDays;
  if (d === null) return { error: 'Cần hạn sử dụng (expires_at hoặc expires_in_days)' };
  if (!Number.isFinite(d) || d < -30 || d > 3650) return { error: 'Số ngày hết hạn phải từ -30 đến 3650' };
  return { value: new Date(Date.now() + d * DAY).toISOString() };
}

/** Copy the demo starter fridge into this user's fridge once. */
async function ensureFridge(ms, userId) {
  const marker = `M18-STATE-${userId}`;
  if (await ms.get(marker)) return;
  try { await ms.insert({ module: M, kind: 'state', id: marker, ownerId: userId, data: { initialized_at: new Date().toISOString() } }); }
  catch (e) { if (e.status === 409) return; throw e; }
  for (const t of await ms.list(M, 'template')) {
    await ms.insert({ module: M, kind: 'item', ownerId: userId, isDemo: true, data: {
      name: t.name, quantity: t.quantity, unit: t.unit, compartment: t.compartment, emoji: t.emoji,
      expires_at: new Date(Date.now() + t.expires_in_days * DAY).toISOString(), barcode: null, template_id: t.id } });
  }
}

/** Catalogue dishes whose ingredients use fridge items, allergy-safe, expiring items first. */
async function suggest(repo, profile, items, limit = 3) {
  const dishes = (await repo.listDishes()).filter(d => isDishSafeForUser(d, profile || {}));
  const live = items.filter(i => !i.is_expired);
  const out = [];
  for (const d of dishes) {
    const ings = (d.ingredients || []).map(i => (typeof i === 'string' ? i : i.name)).filter(Boolean);
    const matched = live.filter(it => itemKeys(it.name).some(k => ings.some(g => hasWords(g, k))));
    if (!matched.length) continue;
    const soon = matched.filter(m => m.is_expiring_soon);
    out.push({ dish_id: d.id, name: d.name, img_key: d.img_key || null, calories: d.calories ?? null, prep_minutes: d.prep_minutes ?? null,
      matched: matched.map(m => m.name), uses_expiring: soon.map(m => m.name), missing_count: Math.max(0, ings.length - matched.length),
      score: soon.length * 2 + matched.length });
  }
  out.sort((a, b) => b.score - a.score || a.missing_count - b.missing_count || a.dish_id.localeCompare(b.dish_id));
  return out.slice(0, limit);
}

async function inventory(ctx) {
  const { ms, userId } = ctx;
  await ensureFridge(ms, userId);
  const now = Date.now();
  const all = (await ms.list(M, 'item', { ownerId: userId })).map(r => view(r, now))
    .sort((a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at));
  return all;
}

async function lookup(ms, code) {
  const p = await ms.get(`M18-EAN-${code}`);
  return p && p.module === M && p.kind === 'product' ? p : null;
}

export default {
  id: M,
  personalKinds: ['item', 'state'],
  seed,
  async route(ctx) {
    const { ms, repo, method, pathname, searchParams, body, userId, profile, util } = ctx;
    if (!pathname.startsWith('/api/v1/fridge/')) return null;
    if (!userId) return util.unauthorized();

    if (pathname === '/api/v1/fridge/inventory' && method === 'GET') {
      const all = await inventory(ctx);
      const comp = searchParams.get('compartment');
      if (comp && comp !== 'all' && !COMPARTMENTS[comp]) return util.bad('Ngăn không hợp lệ (chill, freeze, door, vegetable)');
      const items = comp && comp !== 'all' ? all.filter(i => i.compartment === comp) : all;
      const expiring = all.filter(i => i.is_expiring_soon);
      const suggestions = await suggest(repo, profile, all);
      return { status: 200, data: {
        total_items: all.length, items, inventory: items, expiring_soon_count: expiring.length,
        expiring: expiring.map(i => ({ id: i.id, name: i.name, expires_in_days: i.expires_in_days, hours_left: i.hours_left, is_expired: i.is_expired })),
        by_compartment: Object.fromEntries(Object.keys(COMPARTMENTS).map(k => [k, all.filter(i => i.compartment === k).length])),
        compartments: COMPARTMENTS, soon_threshold_hours: 48, suggestion: suggestions[0] || null,
        applied_allergies: [...(profile?.hard_allergies || [])], is_demo: all.some(i => i.is_demo) } };
    }

    if (pathname === '/api/v1/fridge/suggestions' && method === 'GET') {
      const all = await inventory(ctx);
      const items = await suggest(repo, profile, all, searchParams.has('limit') ? util.cleanNumber(searchParams.get('limit'), 1, 12, 5) : 5);
      return { status: 200, data: { total: items.length, items, applied_allergies: [...(profile?.hard_allergies || [])],
        based_on: all.filter(i => !i.is_expired).length } };
    }

    const bc = pathname.match(/^\/api\/v1\/fridge\/barcode\/([^/]+)$/);
    if (bc && method === 'GET') {
      const code = decodeURIComponent(bc[1]).replace(/\s+/g, '');
      if (!ean13Valid(code)) return util.bad('Mã EAN-13 không hợp lệ (13 chữ số, sai số kiểm tra)');
      const p = await lookup(ms, code);
      return { status: 200, data: { ean: code, valid: true, gs1_country: gs1Country(code), is_vietnam: code.startsWith('893'),
        found: !!p, needs_name: !p,
        product: p ? { name: p.name, brand: p.brand, compartment: p.compartment, compartment_label: COMPARTMENTS[p.compartment],
          shelf_life_days: p.shelf_life_days, quantity: p.quantity, unit: p.unit, emoji: p.emoji, is_demo: p.is_demo } : null } };
    }

    if (pathname === '/api/v1/fridge/scan' && method === 'POST') {
      const code = String(body.barcode ?? '').replace(/\s+/g, '');
      if (!ean13Valid(code)) return util.bad('Mã EAN-13 không hợp lệ (13 chữ số, sai số kiểm tra)');
      const p = await lookup(ms, code);
      const name = util.cleanText(body.item_name ?? body.name, 80) || p?.name || '';
      if (name.length < 2) return { status: 422, data: { error: 'Mã chưa có trong danh mục, hãy đặt tên cho nguyên liệu', ean: code, found: false, needs_name: true, gs1_country: gs1Country(code) } };
      const compartment = body.compartment || p?.compartment || 'chill';
      if (!COMPARTMENTS[compartment]) return util.bad('Ngăn không hợp lệ (chill, freeze, door, vegetable)');
      const qty = body.quantity !== undefined && body.quantity !== '' ? parseQty(body.quantity, body.unit, util) : { quantity: p?.quantity || 1, unit: p?.unit || util.cleanText(body.unit, 12) || 'phần' };
      if (!qty) return util.bad('Số lượng không hợp lệ');
      const exp = expiryFrom(body, p?.shelf_life_days ?? null);
      if (exp.error) return util.bad(exp.error);
      await ensureFridge(ms, userId);
      const rec = await ms.insert({ module: M, kind: 'item', ownerId: userId, data: {
        name, ...qty, compartment, expires_at: exp.value, barcode: code, emoji: p?.emoji || null, scanned_at: new Date().toISOString() } });
      const all = await inventory(ctx);
      const s = await suggest(repo, profile, all);
      const item = view(rec);
      return { status: 200, data: { scanned_item: item, found: !!p, gs1_country: gs1Country(code), total_fridge_items: all.length,
        zero_waste_suggestion: s[0] ? { recommended_dish: s[0].name, dish_id: s[0].dish_id, prep_time_minutes: s[0].prep_minutes,
          message: s[0].uses_expiring.length ? `Tận dụng ${s[0].uses_expiring.slice(0, 2).join(' & ')} sắp hết hạn` : `Dùng ${s[0].matched.slice(0, 2).join(' & ')} có sẵn` } : null } };
    }

    if (pathname === '/api/v1/fridge/inventory' && method === 'POST') {
      const name = util.cleanText(body.name, 80);
      if (name.length < 2) return util.bad('Tên nguyên liệu 2–80 ký tự');
      const compartment = body.compartment || 'chill';
      if (!COMPARTMENTS[compartment]) return util.bad('Ngăn không hợp lệ (chill, freeze, door, vegetable)');
      const qty = parseQty(body.quantity ?? 1, body.unit, util);
      if (!qty) return util.bad('Số lượng không hợp lệ');
      const exp = expiryFrom(body, 3);
      if (exp.error) return util.bad(exp.error);
      let barcode = null;
      if (body.barcode) {
        barcode = String(body.barcode).replace(/\s+/g, '');
        if (!ean13Valid(barcode)) return util.bad('Mã EAN-13 không hợp lệ');
      }
      await ensureFridge(ms, userId);
      const rec = await ms.insert({ module: M, kind: 'item', ownerId: userId, data: { name, ...qty, compartment, expires_at: exp.value, barcode } });
      return { status: 201, data: view(rec) };
    }

    const one = pathname.match(/^\/api\/v1\/fridge\/inventory\/([^/]+?)(\/consume)?$/);
    if (one) {
      const cur = await ms.get(decodeURIComponent(one[1]));
      if (!cur || cur.module !== M || cur.kind !== 'item') return util.notFound('Không tìm thấy nguyên liệu');
      if (cur.owner_id !== userId) return util.forbidden('Nguyên liệu không thuộc tủ lạnh của bạn');

      if (one[2] && method === 'POST') {
        const amount = body.amount === undefined || body.amount === 'all' ? cur.quantity : Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) return util.bad('Lượng dùng phải lớn hơn 0');
        const left = Math.round((cur.quantity - amount) * 100) / 100;
        if (left <= 0) {
          await ms.remove(cur.id);
          return { status: 200, data: { id: cur.id, consumed: cur.quantity, remaining: 0, removed: true, name: cur.name } };
        }
        const upd = await ms.update(cur.id, r => ({ ...r, quantity: Math.round((r.quantity - amount) * 100) / 100 }));
        return { status: 200, data: { id: cur.id, consumed: amount, remaining: upd.quantity, removed: false, item: view(upd) } };
      }
      if (!one[2] && (method === 'PUT' || method === 'PATCH')) {
        const patch = {};
        if (body.name !== undefined) { const n = util.cleanText(body.name, 80); if (n.length < 2) return util.bad('Tên nguyên liệu 2–80 ký tự'); patch.name = n; }
        if (body.compartment !== undefined) { if (!COMPARTMENTS[body.compartment]) return util.bad('Ngăn không hợp lệ'); patch.compartment = body.compartment; }
        if (body.quantity !== undefined) { const q = parseQty(body.quantity, body.unit ?? (typeof body.quantity === 'string' ? undefined : cur.unit), util); if (!q) return util.bad('Số lượng không hợp lệ'); Object.assign(patch, q); }
        else if (body.unit !== undefined) patch.unit = util.cleanText(body.unit, 12) || cur.unit;
        if (body.expires_at !== undefined || body.expires_in_days !== undefined) { const e = expiryFrom(body); if (e.error) return util.bad(e.error); patch.expires_at = e.value; }
        const upd = await ms.update(cur.id, patch);
        return { status: 200, data: view(upd) };
      }
      if (!one[2] && method === 'DELETE') {
        await ms.remove(cur.id);
        return { status: 200, data: { deleted: true, id: cur.id } };
      }
    }
    return null;
  }
};

export { UNITS };
