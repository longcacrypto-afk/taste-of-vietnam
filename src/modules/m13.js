// M13 — Đặt bàn & voucher (M13-S01 table booking, M13-S02 voucher wallet + MoMo/ZaloPay).
//   Booking: per-place slot config (demo, module 'M13' kind 'config'), slots generated from the
//   place's serving hours, capacity enforced with a row-locked counter per slot, instant
//   confirmation, edit and cancel by the owner. The Zalo ZNS/SMS confirmation is NOT sent
//   (no provider): the response says so (sandbox: true, sent: false).
//   Vouchers: demo offers (kind 'voucher'), the user's wallet (kind 'wallet') with a signed QR
//   payload, redeem at the counter; MoMo/ZaloPay are sandbox only — no money moves.
import crypto from 'node:crypto';
import { publicPlace } from '../services/dataEntry.js';
import { getPlaceOpenStatus } from '../services/placeHours.js';
import { localDate, localTime, addDays, isDate, dayDiff, weekdayLabel, shortDate, vnInstant, money } from './m11m13_shared.js';

const M = 'M13';
const DAYS_AHEAD = 14;
const WINDOWS = [['10:30', '13:30'], ['17:00', '20:30']];
const endOfDayIn = days => `${addDays(localDate(), days)}T23:59:00+07:00`;

const seed = () => [
  ...[['PLACE-401', 6, 12], ['PLACE-402', 5, 10], ['PLACE-403', 4, 8], ['PLACE-406', 5, 10], ['PLACE-407', 6, 12], ['PLACE-408', 4, 8]]
    .map(([place_id, tables_per_slot, max_party]) => ({ kind: 'config', id: `M13-CFG-${place_id}`, data: { place_id, tables_per_slot, max_party, lead_minutes: 30 } })),
  { kind: 'voucher', id: 'VC-PHATTAI-30K', data: { code: 'PHATTAI30K', title: 'Giảm ngay 30.000đ cho hóa đơn từ 150k',
    description: 'Ăn tại quán, áp dụng 1 lần cho mỗi tài khoản.', place_ids: ['PLACE-401', 'PLACE-402'], discount_type: 'amount',
    discount_vnd: 30000, min_bill_vnd: 150000, expires_at: endOfDayIn(30) } },
  { kind: 'voucher', id: 'VC-BANHXEO-15', data: { code: 'BANHXEO15', title: 'Giảm 15% (tối đa 40.000đ) hóa đơn từ 120k',
    description: 'Áp dụng cho bàn từ 2 người tại Bánh Xèo Phương Nam.', place_ids: ['PLACE-406'], discount_type: 'percent',
    percent: 15, max_discount_vnd: 40000, min_bill_vnd: 120000, expires_at: endOfDayIn(21) } },
  { kind: 'voucher', id: 'VC-OXUAN-DRINK', data: { code: 'OXUANSAMDUA', title: 'Tặng 2 ly nước sâm dứa cho hóa đơn từ 100k',
    description: 'Quà tặng kèm khi ăn tại Bún Bò Huế O Xuân.', place_ids: ['PLACE-403'], discount_type: 'gift', gift: '2 ly nước sâm dứa',
    discount_vnd: 0, min_bill_vnd: 100000, expires_at: endOfDayIn(14) } },
  { kind: 'voucher', id: 'VC-ANLANH-20K', data: { code: 'ANLANH20K', title: 'Giảm 20.000đ món chay hóa đơn từ 100k',
    description: 'Áp dụng mọi ngày tại Quán Cơm Chay An Lành.', place_ids: ['PLACE-407'], discount_type: 'amount',
    discount_vnd: 20000, min_bill_vnd: 100000, expires_at: endOfDayIn(45) } }
];

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------
const toMin = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const toTime = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const slotLabel = (date, time) => `${time} · ${weekdayLabel(date)} ${shortDate(date)}`;
const bookable = p => p && publicPlace(p) && p.is_paused !== true && p.is_open_override !== false;

async function configs(ms) {
  return new Map((await ms.list(M, 'config')).map(c => [c.place_id, c]));
}

function slotTimes(place, cfg, date, now = Date.now()) {
  const open = Number.isFinite(Number(place.open_hour)) ? Number(place.open_hour) * 60 : 0;
  const close = Number.isFinite(Number(place.close_hour)) ? Number(place.close_hour) * 60 : 1440;
  const out = [];
  for (const [a, b] of WINDOWS) for (let m = toMin(a); m <= toMin(b); m += 30) {
    if (m < open || m + 60 > close) continue;
    const time = toTime(m), at = vnInstant(date, time);
    if (at < now + (cfg.lead_minutes || 30) * 60000) continue;
    if (getPlaceOpenStatus(place, at).status === 'closed') continue;
    out.push(time);
  }
  return out;
}

const counterId = (placeId, date, time) => `M13-CNT-${placeId}-${date}-${time.replace(':', '')}`;
async function slotCount(ms, id) { return (await ms.get(id))?.n || 0; }
async function reserve(ms, placeId, date, time, cap) {
  const id = counterId(placeId, date, time);
  try { await ms.insert({ module: M, kind: 'slotcount', id, data: { place_id: placeId, date, time, n: 0 } }); }
  catch (e) { if (e.status !== 409) throw e; }
  let ok = false;
  await ms.update(id, cur => { if ((cur.n || 0) >= cap) return null; ok = true; return { ...cur, n: (cur.n || 0) + 1 }; });
  return ok;
}
async function release(ms, placeId, date, time) {
  await ms.update(counterId(placeId, date, time), cur => ({ ...cur, n: Math.max(0, (cur.n || 0) - 1) }));
}

const pubBooking = b => ({ id: b.id, booking_id: b.id, code: b.code, place_id: b.place_id, place_name: b.place_name, place_address: b.place_address,
  place_phone: b.place_phone || null, img_key: b.img_key || null, date: b.date, time: b.time, time_slot: slotLabel(b.date, b.time),
  party_size: b.party_size, has_baby_chair: !!b.has_baby_chair, ac_room: !!b.ac_room, note: b.note || '', status: b.status,
  is_upcoming: b.status === 'confirmed_instant' && vnInstant(b.date, b.time) > Date.now(),
  confirmation: { mode: 'instant', channel: 'zalo_zns', sandbox: true, sent: false,
    note: 'Bản demo: chưa gửi Zalo ZNS/SMS thật. Mã đặt chỗ hiển thị trong ứng dụng.' },
  created_at: b.created_at, cancelled_at: b.cancelled_at || null });

function readBooking(body, util, base = {}) {
  const party = body.party_size === undefined ? base.party_size : Number(body.party_size);
  const date = body.date === undefined ? base.date : String(body.date);
  const time = body.time === undefined ? base.time : String(body.time);
  if (!Number.isInteger(party) || party < 1 || party > 50) return { error: 'party_size phải là số nguyên 1–50' };
  if (!isDate(date)) return { error: 'date (YYYY-MM-DD) là bắt buộc' };
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[03]0$/.test(time)) return { error: 'time (HH:MM, mỗi 30 phút) là bắt buộc' };
  const bool = (v, d) => (v === undefined ? d : v === true);
  return { party_size: party, date, time, has_baby_chair: bool(body.has_baby_chair, !!base.has_baby_chair),
    ac_room: bool(body.ac_room, !!base.ac_room), note: body.note === undefined ? base.note || '' : util.cleanText(body.note, 200) };
}

async function validateSlot(ctx, place, cfg, b) {
  if (b.party_size > cfg.max_party) return { status: 400, data: { error: `Quán nhận đặt tối đa ${cfg.max_party} khách / bàn qua ứng dụng` } };
  if (b.has_baby_chair && !place.has_kids_seat) return { status: 400, data: { error: 'Quán chưa có ghế em bé' } };
  if (b.ac_room && !place.has_ac) return { status: 400, data: { error: 'Quán chưa có phòng máy lạnh' } };
  const today = localDate();
  if (b.date < today || dayDiff(today, b.date) > DAYS_AHEAD) return { status: 400, data: { error: `Chỉ đặt được trong ${DAYS_AHEAD} ngày tới` } };
  if (!slotTimes(place, cfg, b.date).includes(b.time)) return { status: 409, data: { error: 'Khung giờ này không nhận đặt (đã qua, ngoài giờ phục vụ hoặc quán nghỉ)' } };
  return null;
}

async function bookingRoutes(ctx) {
  const { method, pathname, searchParams, body, util, userId, ms, repo } = ctx;
  if (!pathname.startsWith('/api/v1/bookings')) return null;
  if (!userId) return util.unauthorized();
  const cfgs = await configs(ms);

  if (pathname === '/api/v1/bookings/places' && method === 'GET') {
    const items = [];
    for (const [placeId, cfg] of cfgs) {
      const p = await repo.getPlace(placeId);
      if (!bookable(p)) continue;
      items.push({ place_id: p.id, name: p.name, address: p.address, img_key: p.img_key || null, rating: p.rating ?? null,
        has_kids_seat: !!p.has_kids_seat, has_ac: !!p.has_ac, max_party: cfg.max_party, is_demo: !!cfg.is_demo });
    }
    return { status: 200, data: { total: items.length, items, days_ahead: DAYS_AHEAD } };
  }

  if (pathname === '/api/v1/bookings/slots' && method === 'GET') {
    const placeId = util.cleanText(searchParams.get('place_id'), 32);
    const cfg = cfgs.get(placeId);
    const place = cfg ? await repo.getPlace(placeId) : null;
    if (!cfg || !bookable(place)) return util.notFound('Quán chưa nhận đặt bàn qua ứng dụng');
    const date = searchParams.get('date') || localDate();
    const today = localDate();
    if (!isDate(date) || date < today || dayDiff(today, date) > DAYS_AHEAD) return util.bad(`date phải trong ${DAYS_AHEAD} ngày tới (YYYY-MM-DD)`);
    const party = searchParams.has('party_size') ? Number(searchParams.get('party_size')) : 2;
    if (!Number.isInteger(party) || party < 1 || party > 50) return util.bad('party_size phải là số nguyên 1–50');
    const slots = [];
    for (const time of slotTimes(place, cfg, date)) {
      const remaining = Math.max(0, cfg.tables_per_slot - await slotCount(ms, counterId(placeId, date, time)));
      slots.push({ time, label: slotLabel(date, time), remaining_tables: remaining, available: remaining > 0 && party <= cfg.max_party });
    }
    const dates = Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i); return { date: d, label: i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : `${weekdayLabel(d)} ${shortDate(d)}` }; });
    return { status: 200, data: { place_id: place.id, place_name: place.name, date, party_size: party, max_party: cfg.max_party,
      has_kids_seat: !!place.has_kids_seat, has_ac: !!place.has_ac, slots, dates, now_local: localTime(), is_demo: !!cfg.is_demo } };
  }

  if (pathname === '/api/v1/bookings' && method === 'GET') {
    const rows = (await ms.list(M, 'booking', { ownerId: userId })).map(pubBooking)
      .sort((a, b) => Number(b.is_upcoming) - Number(a.is_upcoming) || (a.is_upcoming ? (a.date + a.time).localeCompare(b.date + b.time) : (b.date + b.time).localeCompare(a.date + a.time)));
    return { status: 200, data: { total: rows.length, bookings: rows, items: rows, upcoming: rows.filter(b => b.is_upcoming) } };
  }

  if (pathname === '/api/v1/bookings' && method === 'POST') {
    const placeId = util.cleanText(body.place_id, 32);
    const cfg = cfgs.get(placeId);
    const place = cfg ? await repo.getPlace(placeId) : null;
    if (!cfg || !bookable(place)) return util.notFound('Quán chưa nhận đặt bàn qua ứng dụng');
    const b = readBooking(body, util);
    if (b.error) return util.bad(b.error);
    const bad = await validateSlot(ctx, place, cfg, b);
    if (bad) return bad;
    const mine = await ms.list(M, 'booking', { ownerId: userId });
    if (mine.some(x => x.status === 'confirmed_instant' && x.place_id === placeId && x.date === b.date && x.time === b.time))
      return { status: 409, data: { error: 'Bạn đã có bàn ở quán này vào giờ này' } };
    if (!(await reserve(ms, placeId, b.date, b.time, cfg.tables_per_slot))) return { status: 409, data: { error: 'Khung giờ đã hết bàn, hãy chọn giờ khác' } };
    const code = 'BK-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const rec = await ms.insert({ module: M, kind: 'booking', ownerId: userId, id: code, data: {
      code, place_id: place.id, place_name: place.name, place_address: place.address, place_phone: place.phone || null, img_key: place.img_key || null,
      ...b, status: 'confirmed_instant' } });
    return { status: 200, data: pubBooking(rec) };
  }

  const one = pathname.match(/^\/api\/v1\/bookings\/([^/]+)$/);
  if (one && ['GET', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const bk = await ms.get(one[1]);
    if (!bk || bk.module !== M || bk.kind !== 'booking') return util.notFound('Không tìm thấy lượt đặt bàn');
    if (bk.owner_id !== userId) return util.forbidden('Đây không phải lượt đặt bàn của bạn');
    if (method === 'GET') return { status: 200, data: pubBooking(bk) };
    if (bk.status !== 'confirmed_instant') return { status: 409, data: { error: 'Lượt đặt đã huỷ' } };
    if (vnInstant(bk.date, bk.time) <= Date.now()) return { status: 409, data: { error: 'Giờ hẹn đã qua, không sửa/huỷ được' } };
    if (method === 'DELETE') {
      const next = await ms.update(bk.id, cur => ({ ...cur, status: 'cancelled', cancelled_at: new Date().toISOString() }));
      await release(ms, bk.place_id, bk.date, bk.time);
      return { status: 200, data: { cancelled: true, ...pubBooking(next) } };
    }
    const cfg = cfgs.get(bk.place_id);
    const place = cfg ? await repo.getPlace(bk.place_id) : null;
    if (!cfg || !bookable(place)) return { status: 409, data: { error: 'Quán tạm ngưng nhận đặt bàn' } };
    const b = readBooking(body, util, bk);
    if (b.error) return util.bad(b.error);
    const moved = b.date !== bk.date || b.time !== bk.time;
    if (moved || b.party_size !== bk.party_size || b.has_baby_chair !== bk.has_baby_chair || b.ac_room !== bk.ac_room) {
      const bad = moved ? await validateSlot(ctx, place, cfg, b) : (b.party_size > cfg.max_party ? { status: 400, data: { error: `Tối đa ${cfg.max_party} khách` } }
        : b.has_baby_chair && !place.has_kids_seat ? { status: 400, data: { error: 'Quán chưa có ghế em bé' } }
        : b.ac_room && !place.has_ac ? { status: 400, data: { error: 'Quán chưa có phòng máy lạnh' } } : null);
      if (bad) return bad;
    }
    if (moved) {
      if (!(await reserve(ms, bk.place_id, b.date, b.time, cfg.tables_per_slot))) return { status: 409, data: { error: 'Khung giờ mới đã hết bàn' } };
      await release(ms, bk.place_id, bk.date, bk.time);
    }
    const next = await ms.update(bk.id, cur => ({ ...cur, ...b, updated_by_user_at: new Date().toISOString() }));
    return { status: 200, data: pubBooking(next) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Vouchers
// ---------------------------------------------------------------------------
const qrSecret = () => process.env.VOUCHER_QR_SECRET || process.env.JWT_SECRET || 'tov-dev-voucher-qr';
const sign = (walletId, code, userId) => crypto.createHmac('sha256', qrSecret()).update(`${walletId}:${code}:${userId}`).digest('hex').slice(0, 12).toUpperCase();
const qrPayload = (w, v) => `TOV1:VC:${w.id}:${v.code}:${sign(w.id, v.code, w.owner_id)}`;
const expired = v => v.expires_at && Date.parse(v.expires_at) <= Date.now();
const expiresLabel = iso => { const d = localDate(Date.parse(iso)); return `${d.slice(8, 10)}/${d.slice(5, 7)}`; };

function discountOf(v, bill) {
  if (v.discount_type === 'percent') return Math.min(Math.round(bill * v.percent / 100 / 1000) * 1000, v.max_discount_vnd || Infinity);
  if (v.discount_type === 'amount') return Math.min(v.discount_vnd || 0, bill);
  return 0;
}

async function presentVoucher(v, w, repo) {
  const names = [];
  for (const id of v.place_ids || []) { const p = await repo.getPlace(id); if (p) names.push(p.name); }
  return { id: v.id, voucher_id: v.id, code: v.code, title: v.title, description: v.description || '', place_ids: v.place_ids || [], place_names: names,
    discount_type: v.discount_type, discount_vnd: v.discount_vnd || 0, percent: v.percent || null, max_discount_vnd: v.max_discount_vnd || null,
    gift: v.gift || null, min_bill_vnd: v.min_bill_vnd || 0, expires_at: v.expires_at, expires_label: expiresLabel(v.expires_at), expired: !!expired(v),
    saved: !!w, wallet_id: w?.id || null, wallet_status: w?.status || null, used_at: w?.used_at || null,
    qr_payload: w && w.status === 'saved' ? qrPayload(w, v) : null, is_demo: !!v.is_demo };
}

async function voucherRoutes(ctx) {
  const { method, pathname, body, util, userId, ms, repo, authUser } = ctx;
  if (!pathname.startsWith('/api/v1/vouchers')) return null;
  const vouchers = await ms.list(M, 'voucher');

  if (pathname === '/api/v1/vouchers' && method === 'GET') {
    const wallet = userId ? await ms.list(M, 'wallet', { ownerId: userId }) : [];
    const byV = new Map(wallet.map(w => [w.voucher_id, w]));
    const items = [];
    for (const v of vouchers) { const w = byV.get(v.id); if (!expired(v) || w) items.push(await presentVoucher(v, w, repo)); }
    const mine = items.filter(i => i.saved);
    return { status: 200, data: { total: items.length, vouchers: items, items, wallet: mine, wallet_count: mine.filter(i => i.wallet_status === 'saved').length,
      signed_in: !!userId, payment_note: 'MoMo/ZaloPay đang ở chế độ thử nghiệm (sandbox): không có tiền thật được trừ.' } };
  }

  const save = pathname.match(/^\/api\/v1\/vouchers\/([^/]+)\/save$/);
  if (save && method === 'POST') {
    if (!userId) return util.unauthorized();
    const v = vouchers.find(x => x.id === save[1]);
    if (!v) return util.notFound('Không tìm thấy voucher');
    if (expired(v)) return { status: 409, data: { error: 'Voucher đã hết hạn' } };
    const existing = (await ms.list(M, 'wallet', { ownerId: userId })).find(w => w.voucher_id === v.id);
    if (existing) return { status: 200, data: { already_saved: true, ...(await presentVoucher(v, existing, repo)) } };
    const w = await ms.insert({ module: M, kind: 'wallet', ownerId: userId, id: `VW-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      data: { voucher_id: v.id, status: 'saved', saved_at: new Date().toISOString() } });
    return { status: 201, data: await presentVoucher(v, w, repo) };
  }

  if (pathname === '/api/v1/vouchers/redeem' && method === 'POST') {
    if (!userId) return util.unauthorized();
    const w = await ms.get(util.cleanText(body.wallet_id, 40));
    if (!w || w.module !== M || w.kind !== 'wallet') return util.notFound('Không tìm thấy voucher trong ví');
    if (w.owner_id !== userId) return util.forbidden('Voucher không thuộc ví của bạn');
    const v = vouchers.find(x => x.id === w.voucher_id);
    if (!v) return util.notFound('Voucher không còn hiệu lực');
    if (w.status !== 'saved') return { status: 409, data: { error: 'Voucher đã được dùng' } };
    if (expired(v)) return { status: 409, data: { error: 'Voucher đã hết hạn' } };
    const placeId = util.cleanText(body.place_id, 32) || (v.place_ids || [])[0];
    if (!(v.place_ids || []).includes(placeId)) return util.bad('Voucher không áp dụng tại quán này');
    const bill = Number(body.bill_vnd);
    if (!Number.isInteger(bill) || bill <= 0 || bill > 50000000) return util.bad('bill_vnd (số tiền hóa đơn) là bắt buộc');
    if (bill < (v.min_bill_vnd || 0)) return util.bad(`Hóa đơn tối thiểu ${money(v.min_bill_vnd)}`);
    const methodPay = body.method === undefined ? 'cash' : String(body.method);
    if (!['momo', 'zalopay', 'cash'].includes(methodPay)) return util.bad('method: momo | zalopay | cash');
    const discount = discountOf(v, bill), payable = bill - discount;
    let used = false;
    const next = await ms.update(w.id, cur => { if (cur.status !== 'saved') return null; used = true; return { ...cur, status: 'used', used_at: new Date().toISOString(), place_id: placeId, bill_vnd: bill, discount_vnd: discount }; });
    if (!used) return { status: 409, data: { error: 'Voucher đã được dùng' } };
    let payment = null;
    if (methodPay !== 'cash') {
      payment = await ms.insert({ module: M, kind: 'payment', ownerId: userId, id: `SBX-${crypto.randomBytes(5).toString('hex').toUpperCase()}`, data: {
        provider: methodPay, wallet_id: w.id, voucher_id: v.id, place_id: placeId, amount_vnd: payable,
        sandbox: true, money_moved: false, status: 'sandbox_approved' } });
      payment = { id: payment.id, reference: payment.id, provider: methodPay, provider_label: methodPay === 'momo' ? 'MoMo' : 'ZaloPay',
        amount_vnd: payable, sandbox: true, money_moved: false, status: 'sandbox_approved',
        message: `Thanh toán thử nghiệm ${methodPay === 'momo' ? 'MoMo' : 'ZaloPay'} (sandbox): KHÔNG có tiền thật được trừ. Vui lòng thanh toán thật tại quầy.` };
    }
    return { status: 200, data: { redeemed: true, wallet_id: w.id, voucher_id: v.id, code: v.code, place_id: placeId, bill_vnd: bill,
      discount_vnd: discount, gift: v.gift || null, payable_vnd: payable, method: methodPay, payment, used_at: next.used_at } };
  }

  // Counter staff check a scanned QR payload (merchant or admin).
  if (pathname === '/api/v1/vouchers/verify' && method === 'POST') {
    if (!userId) return util.unauthorized();
    if (!['merchant', 'merchant_owner', 'merchant_staff', 'super_admin'].includes(authUser?.role)) return util.forbidden('Chỉ quán hoặc quản trị viên được quét voucher');
    const m = String(body.qr_payload || '').match(/^TOV1:VC:([A-Z0-9-]{4,40}):([A-Z0-9]{3,32}):([A-F0-9]{12})$/);
    if (!m) return { status: 400, data: { valid: false, error: 'Mã QR không đúng định dạng' } };
    const w = await ms.get(m[1]);
    const v = w && vouchers.find(x => x.id === w.voucher_id);
    const ok = !!(w && v && v.code === m[2] && sign(w.id, v.code, w.owner_id) === m[3]);
    if (!ok) return { status: 200, data: { valid: false, reason: 'Chữ ký không khớp' } };
    return { status: 200, data: { valid: w.status === 'saved' && !expired(v), status: expired(v) ? 'expired' : w.status, code: v.code, title: v.title,
      min_bill_vnd: v.min_bill_vnd || 0, place_ids: v.place_ids } };
  }
  return null;
}

export default {
  id: M,
  personalKinds: ['booking', 'wallet', 'payment'],
  seed,
  async route(ctx) {
    return (await bookingRoutes(ctx)) || (await voucherRoutes(ctx));
  }
};
