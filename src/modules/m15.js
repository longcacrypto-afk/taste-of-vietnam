// M15 — Du lịch Ẩm thực: Food Trail (M15-S01) & Hộ chiếu ẩm thực check-in QR (M15-S02).
// Trails are demo records that point at real catalogue places/dishes (Biên Hòa); every
// stop is enriched from the catalogue on read (name, address, hours, price, allergens).
// A passport stamp is one module record per (user, stop) with a deterministic id, so a
// second check-in at the same stop can never create a second stamp (also under races).
const M = 'M15';
const GPS_RADIUS_M = 500;
const TZ = 'Asia/Ho_Chi_Minh';

const SLOT_LABEL = { sang: 'Sáng', trua: 'Trưa', xe: 'Xế', toi: 'Tối' };

const seed = () => [
  { kind: 'trail', id: 'TRAIL-BH-1NGAY', data: {
    slug: 'bien-hoa-1-ngay', city: 'Biên Hòa — Đồng Nai', img_key: '764',
    title: 'Food Trail 1 Ngày Khám Phá Ẩm Thực Biên Hòa',
    subtitle: 'Hành trình 4 trạm trải nghiệm trọn vẹn phong vị Đông Nam Bộ',
    badge: 'Đại Sứ Ẩm Thực Biên Hòa',
    stops: [
      { id: 'STOP-BH1-SANG', slot: 'sang', time: '07:30', place_id: 'PLACE-401', dish_id: 'DISH-101', qr_token: 'BH1-SANG-7Q2K',
        note: 'Mở hàng từ 6h, nước dùng xương bò ninh đêm — nên tới trước 8h để kịp mẻ đầu.' },
      { id: 'STOP-BH1-TRUA', slot: 'trua', time: '12:00', place_id: 'PLACE-402', dish_id: 'DISH-102', qr_token: 'BH1-TRUA-4MZ8',
        note: 'Sườn nướng than tại chỗ, có máy lạnh — điểm nghỉ trưa của dân văn phòng Tân Tiến.' },
      { id: 'STOP-BH1-XE', slot: 'xe', time: '15:30', place_id: 'PLACE-404', dish_id: 'DISH-104', qr_token: 'BH1-XE-9TC3',
        note: 'Ổ bánh mì nướng giòn ăn xế, mang theo được khi đi dạo bờ sông Đồng Nai.' },
      { id: 'STOP-BH1-TOI', slot: 'toi', time: '19:00', place_id: 'PLACE-403', dish_id: 'DISH-103', qr_token: 'BH1-TOI-2HV6',
        note: 'Kết thúc ngày bằng tô bún bò Huế đậm vị mắm ruốc, quán mở tới 22h.' }
    ] } },
  { kind: 'trail', id: 'TRAIL-BH-CHAY-MIENTRUNG', data: {
    slug: 'bien-hoa-mien-trung-chay', city: 'Biên Hòa — Đồng Nai', img_key: '764',
    title: 'Food Trail Vị Miền Trung & Món Chay Biên Hòa',
    subtitle: 'Mì Quảng buổi sáng, cơm chay buổi trưa, bánh xèo buổi xế và bữa tối gia đình',
    badge: 'Lữ Khách Ba Miền',
    stops: [
      { id: 'STOP-BH2-SANG', slot: 'sang', time: '07:00', place_id: 'PLACE-408', dish_id: 'DISH-111', qr_token: 'BH2-SANG-6PW1',
        note: 'Sợi mì Quảng vàng, gà ta rút xương và trứng cút — ăn kèm bánh tráng mè.' },
      { id: 'STOP-BH2-TRUA', slot: 'trua', time: '11:30', place_id: 'PLACE-407', dish_id: 'DISH-112', qr_token: 'BH2-TRUA-8KD5',
        note: 'Quán chay thanh tịnh, chả giò nấm hạt sen chiên giòn.' },
      { id: 'STOP-BH2-XE', slot: 'xe', time: '15:00', place_id: 'PLACE-406', dish_id: 'DISH-109', qr_token: 'BH2-XE-3RB7',
        note: 'Bánh xèo đổ khuôn nóng giòn — có tôm và trứng, người dị ứng nên hỏi quán.' },
      { id: 'STOP-BH2-TOI', slot: 'toi', time: '18:30', place_id: 'PLACE-401', dish_id: 'DISH-108', qr_token: 'BH2-TOI-5NA4',
        note: 'Combo phở & bò hầm cho cả nhà khép lại hành trình.' }
    ] } }
];

const toRad = d => (d * Math.PI) / 180;
export function distanceM(a, b) {
  if (![a?.lat, a?.lng, b?.lat, b?.lng].every(Number.isFinite)) return null;
  const R = 6371000, dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function hourNow(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const h = Number(p.find(x => x.type === 'hour').value) % 24, m = Number(p.find(x => x.type === 'minute').value);
  return h + m / 60;
}

/** A stop with its catalogue place/dish; a place that is not public or paused is never "open". */
async function enrichStop(repo, stop, stamped) {
  const [place, dish] = await Promise.all([repo.getPlace(stop.place_id), repo.getDish(stop.dish_id)]);
  const item = (place?.menu || []).find(m => m.dish_id === stop.dish_id);
  const usable = !!place && !place.is_paused && place.is_open_override !== false &&
    (!place.status || ['active', 'verified'].includes(place.status));
  const h = hourNow();
  const open = usable && Number.isFinite(place.open_hour) && Number.isFinite(place.close_hour) &&
    h >= place.open_hour && h < place.close_hour;
  return {
    id: stop.id, slot: stop.slot, slot_label: SLOT_LABEL[stop.slot] || stop.slot, time: stop.time, note: stop.note,
    place_id: stop.place_id, place_name: place?.name || null, address: place?.address || null,
    lat: place?.lat ?? null, lng: place?.lng ?? null, img_key: place?.img_key || dish?.img_key || null,
    open_hour: place?.open_hour ?? null, close_hour: place?.close_hour ?? null,
    available: usable, open_now: !!open,
    dish_id: stop.dish_id, dish_name: item?.name || dish?.name || null,
    price_vnd: item?.price ?? dish?.ref_price ?? null, dish_available: item ? item.available === true : false,
    allergen_tags: dish?.allergen_tags || [],
    stamped: !!stamped, stamped_at: stamped?.stamped_at || null
  };
}

async function stampsOf(ms, userId, trailId) {
  if (!userId) return [];
  return ms.list(M, 'stamp', { ownerId: userId, where: s => !trailId || s.trail_id === trailId });
}

async function shapeTrail(repo, ms, t, userId) {
  const stamps = await stampsOf(ms, userId, t.id);
  const byStop = new Map(stamps.map(s => [s.stop_id, s]));
  const stops = [];
  for (const s of t.stops || []) stops.push(await enrichStop(repo, s, byStop.get(s.id)));
  const legs = stops.slice(1).map((s, i) => distanceM(stops[i], s));
  const total = legs.every(Number.isFinite) ? legs.reduce((a, b) => a + b, 0) : null;
  const done = stops.filter(s => s.stamped).length;
  return {
    id: t.id, slug: t.slug, city: t.city, title: t.title, subtitle: t.subtitle, img_key: t.img_key, badge: t.badge,
    total_stops: stops.length, total_distance_m: total, legs_m: legs, stops,
    progress: userId ? { stamped: done, total: stops.length, completed: stops.length > 0 && done === stops.length } : null,
    is_demo: t.is_demo
  };
}

function passportOf(trail) {
  const done = trail.stops.filter(s => s.stamped);
  const completed = trail.stops.length > 0 && done.length === trail.stops.length;
  return {
    trail_id: trail.id, trail_title: trail.title, city: trail.city,
    stamped_count: done.length, total_stops: trail.stops.length,
    progress_pct: trail.stops.length ? Math.round((done.length / trail.stops.length) * 100) : 0,
    completed, badge: trail.badge, badge_unlocked: completed ? trail.badge : null,
    stops: trail.stops.map(s => ({ stop_id: s.id, slot: s.slot, slot_label: s.slot_label, time: s.time,
      place_id: s.place_id, place_name: s.place_name, dish_name: s.dish_name, available: s.available,
      stamped: s.stamped, stamped_at: s.stamped_at })),
    is_demo: trail.is_demo
  };
}

const findTrail = (all, key) => all.find(t => t.id === key || t.slug === key);
const legacyStops = t => t.stops.map(s => ({ slot: `${s.time} ${s.slot_label}`, dish: s.dish_name, place: s.place_name }));

export default {
  id: M,
  personalKinds: ['stamp'],
  seed,
  async route({ repo, ms, authUser, userId, method, pathname, searchParams, body, util }) {
    if (!pathname.startsWith('/api/v1/tourism/')) return null;

    if (pathname === '/api/v1/tourism/trails' && method === 'GET') {
      const all = await ms.list(M, 'trail');
      const items = [];
      for (const t of all) items.push(await shapeTrail(repo, ms, t, userId));
      const first = items[0];
      // city / trail_title / stops kept at top level for the legacy desktop loader shape.
      return { status: 200, data: { total: items.length, items,
        city: first?.city || null, trail_title: first?.title || null, stops: first ? legacyStops(first) : [] } };
    }

    const one = pathname.match(/^\/api\/v1\/tourism\/trails\/([^/]+)(\/qr-codes)?$/);
    if (one && method === 'GET') {
      const t = findTrail(await ms.list(M, 'trail'), one[1]);
      if (!t) return util.notFound('Không tìm thấy hành trình');
      if (one[2]) {
        // Printable QR tokens for the shops on the trail: staff only, never shown to diners.
        if (!authUser) return util.unauthorized();
        if (!['super_admin', 'merchant', 'merchant_owner', 'merchant_staff'].includes(authUser.role)) return util.forbidden('Chỉ chủ quán hoặc quản trị viên xem mã QR trạm');
        return { status: 200, data: { trail_id: t.id, items: t.stops.map(s => ({ stop_id: s.id, place_id: s.place_id,
          qr_token: s.qr_token, qr_payload: `tov://passport/checkin?trail=${t.id}&stop=${s.id}&code=${s.qr_token}` })) } };
      }
      return { status: 200, data: await shapeTrail(repo, ms, t, userId) };
    }

    if (pathname === '/api/v1/tourism/passport' && method === 'GET') {
      if (!userId) return util.unauthorized();
      const all = await ms.list(M, 'trail');
      const key = util.cleanText(searchParams.get('trail_id') || '', 80);
      const t = key ? findTrail(all, key) : all[0];
      if (!t) return util.notFound('Không tìm thấy hành trình');
      return { status: 200, data: passportOf(await shapeTrail(repo, ms, t, userId)) };
    }

    if (pathname === '/api/v1/tourism/passport/checkin' && method === 'POST') {
      if (!userId) return util.unauthorized();
      const code = util.cleanText(body.qr_token ?? body.code ?? '', 40).toUpperCase();
      if (!code) return util.bad('Cần mã QR của trạm (qr_token)');
      const all = await ms.list(M, 'trail');
      let trail = null, stop = null;
      for (const t of all) { const s = (t.stops || []).find(x => x.qr_token === code); if (s) { trail = t; stop = s; break; } }
      if (!stop) return util.notFound('Mã QR không thuộc trạm nào của Food Trail');
      const wantTrail = util.cleanText(body.trail_id ?? '', 80), wantStop = util.cleanText(body.stop_id ?? '', 80);
      if ((wantTrail && wantTrail !== trail.id && wantTrail !== trail.slug) || (wantStop && wantStop !== stop.id))
        return util.bad('Mã QR không khớp với trạm đã chọn');
      const hasLat = body.lat !== undefined && body.lat !== null && body.lat !== '';
      const hasLng = body.lng !== undefined && body.lng !== null && body.lng !== '';
      if (hasLat !== hasLng) return util.bad('Cần cả lat và lng');
      const place = await repo.getPlace(stop.place_id);
      if (!place || place.is_paused || place.is_open_override === false || (place.status && !['active', 'verified'].includes(place.status)))
        return { status: 409, data: { error: 'Quán của trạm này đang tạm ngưng, chưa thể đóng dấu' } };
      let distance = null;
      if (hasLat) {
        const lat = Number(body.lat), lng = Number(body.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return util.bad('Toạ độ không hợp lệ');
        distance = distanceM({ lat, lng }, place);
        if (distance !== null && distance > GPS_RADIUS_M)
          return { status: 403, data: { error: `Bạn đang cách ${place.name} khoảng ${distance} m — cần ở trong ${GPS_RADIUS_M} m để đóng dấu`, distance_m: distance, max_distance_m: GPS_RADIUS_M } };
      }
      let already = false;
      try {
        await ms.insert({ module: M, kind: 'stamp', ownerId: userId, id: `M15-STAMP-${userId}-${stop.id}`,
          data: { trail_id: trail.id, stop_id: stop.id, place_id: stop.place_id, dish_id: stop.dish_id,
            method: hasLat ? 'qr+gps' : 'qr', distance_m: distance, stamped_at: new Date().toISOString() } });
      } catch (e) { if (e.status !== 409) throw e; already = true; }
      const passport = passportOf(await shapeTrail(repo, ms, trail, userId));
      return { status: 200, data: { stamped: !already, already_stamped: already, stop_id: stop.id, place_id: stop.place_id,
        place_name: place.name, gps_verified: distance !== null, distance_m: distance,
        total_stamps: passport.stamped_count, ...passport } };
    }
    return null;
  }
};
