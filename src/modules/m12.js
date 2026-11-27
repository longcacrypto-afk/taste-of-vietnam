// M12 — Bình chọn nhóm, streak & đánh giá GPS
//   M12-S01 group poll: room with a share code, members join, vote, results. The options are
//           hard-filtered against the COMBINED allergies of every member (a dish stays votable
//           only when it is safe for all of them); a member joining with a new allergy blocks
//           the options that conflict, and their votes stop counting.
//   M12-S02 streak & badges computed from the user's real meal history (repo.listHistory,
//           action 'eaten'); earned badges are kept with their first earned date.
//   M12-S03 GPS-verified review: accepted only within 500 m of the place (haversine), stored
//           and listed per place.
import crypto from 'node:crypto';
import { buildCandidates } from '../services/candidatePipeline.js';
import { publicPlace } from '../services/dataEntry.js';
import { haversineDistanceMeters } from '../services/textUtils.js';
import { localDate, addDays, dayDiff, ALLERGY_VI } from './m11m13_shared.js';

const M = 'M12';
const MAX_REVIEW_DISTANCE_M = 500;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
const allergyLabels = tags => tags.map(t => ({ tag: t, label: ALLERGY_VI[t] || t }));
const inDays = n => new Date(Date.now() + n * 86400000).toISOString();

const seed = () => [
  { kind: 'poll', id: 'POLL-DEMO-BH01', data: {
    code: 'BH2611', title: 'Trưa thứ 6 team mình ăn gì?', meal_slot: 'lunch', status: 'open',
    created_by: 'demo-member-1', deadline_at: inDays(3),
    members: [
      { user_id: 'demo-member-1', name: 'Chị Hạnh', allergies: ['peanut'], joined_at: inDays(-1) },
      { user_id: 'demo-member-2', name: 'Anh Tuấn', allergies: [], joined_at: inDays(-1) },
      { user_id: 'demo-member-3', name: 'Minh Thư', allergies: ['shrimp'], joined_at: inDays(-1) },
      { user_id: 'demo-member-4', name: 'Quốc Bảo', allergies: [], joined_at: inDays(-1) }
    ],
    options: [
      { id: 'OPT-1', dish_id: 'DISH-101', name: 'Phở Bò Tái Nạm Hà Nội', img_key: '298', allergen_tags: [], place_id: 'PLACE-401', place_name: 'Phở Gia Truyền Phát Tài' },
      { id: 'OPT-2', dish_id: 'DISH-103', name: 'Bún Bò Huế O Xuân', img_key: '310', allergen_tags: [], place_id: 'PLACE-403', place_name: 'Bún Bò Huế O Xuân' },
      { id: 'OPT-3', dish_id: 'DISH-112', name: 'Chả Giò Nấm Hạt Sen Chay', img_key: '034', allergen_tags: ['gluten'], place_id: 'PLACE-407', place_name: 'Quán Cơm Chay An Lành' }
    ],
    votes: { 'demo-member-1': 'OPT-1', 'demo-member-2': 'OPT-1', 'demo-member-3': 'OPT-2' } } },
  { kind: 'review', id: 'REV-DEMO-401A', data: { place_id: 'PLACE-401', place_name: 'Phở Gia Truyền Phát Tài', author_name: 'Thu Trang',
    rating: 5, text: 'Nước dùng trong và ngọt thanh, thịt bò tái mềm, quán sạch sẽ có máy lạnh mát.', distance_m: 18, verified: true, img_key: '298', visited_at: inDays(-2) } },
  { kind: 'review', id: 'REV-DEMO-401B', data: { place_id: 'PLACE-401', place_name: 'Phở Gia Truyền Phát Tài', author_name: 'Hoàng Nam',
    rating: 4, text: 'Phở ngon, bánh mềm. Giờ trưa hơi đông, nên đến trước 11h30.', distance_m: 42, verified: true, img_key: '298', visited_at: inDays(-5) } },
  { kind: 'review', id: 'REV-DEMO-403A', data: { place_id: 'PLACE-403', place_name: 'Bún Bò Huế O Xuân', author_name: 'Lan Phương',
    rating: 5, text: 'Bún bò đậm vị mắm ruốc, chả cua thơm, cay vừa phải. Có ghế cho em bé.', distance_m: 25, verified: true, img_key: '310', visited_at: inDays(-3) } },
  { kind: 'review', id: 'REV-DEMO-407A', data: { place_id: 'PLACE-407', place_name: 'Quán Cơm Chay An Lành', author_name: 'Đức Huy',
    rating: 4, text: 'Chả giò chay giòn, nhiều món chay ngày rằm, giá dễ chịu.', distance_m: 60, verified: true, img_key: '034', visited_at: inDays(-6) } }
];

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------
const memberName = (user, n) => String(user?.profile?.name || '').trim().slice(0, 40) || `Thành viên ${n}`;
const unionAllergies = members => [...new Set(members.flatMap(m => m.allergies || []))].sort();
const conflicts = (opt, allergies) => allergies.length > 0 && (!Array.isArray(opt.allergen_tags) || opt.allergen_tags.some(t => allergies.includes(t)));

function presentPoll(p, userId) {
  const combined = unionAllergies(p.members || []);
  const options = (p.options || []).map(o => {
    const bad = conflicts(o, combined);
    const hit = bad && Array.isArray(o.allergen_tags) ? o.allergen_tags.filter(t => combined.includes(t)) : [];
    return { ...o, blocked: bad, blocked_reason: bad ? (hit.length ? 'Chứa ' + hit.map(t => ALLERGY_VI[t] || t).join(', ') + ' (dị ứng của thành viên)' : 'Thiếu nhãn dị ứng') : null };
  });
  const valid = new Set(options.filter(o => !o.blocked).map(o => o.id));
  const counts = {};
  for (const [, opt] of Object.entries(p.votes || {})) if (valid.has(opt)) counts[opt] = (counts[opt] || 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const myVote = userId ? (p.votes || {})[userId] || null : null;
  const out = options.map(o => ({ ...o, votes: counts[o.id] || 0, pct: total ? Math.round((counts[o.id] || 0) / total * 100) : 0, is_my_vote: myVote === o.id }))
    .sort((a, b) => Number(a.blocked) - Number(b.blocked));
  const ranked = out.filter(o => !o.blocked).sort((a, b) => b.votes - a.votes);
  const leader = ranked[0] && ranked[0].votes > 0 && (!ranked[1] || ranked[1].votes < ranked[0].votes) ? ranked[0] : null;
  const isOpen = p.status === 'open' && !(p.deadline_at && Date.parse(p.deadline_at) <= Date.now());
  const { members = [] } = p;
  return { id: p.id, code: p.code, title: p.title, meal_slot: p.meal_slot, status: isOpen ? 'open' : 'closed', is_open: isOpen,
    deadline_at: p.deadline_at || null, created_by_me: !!userId && p.created_by === userId,
    is_member: !!userId && members.some(m => m.user_id === userId),
    members_count: members.length, voted_count: Object.keys(p.votes || {}).filter(u => valid.has(p.votes[u])).length,
    members: members.map(m => ({ name: m.name, voted: valid.has((p.votes || {})[m.user_id]), is_me: m.user_id === userId })),
    combined_allergies: allergyLabels(combined), options: out, total_votes: total, leader, tie: !leader && total > 0,
    my_vote: myVote && valid.has(myVote) ? myVote : null,
    share_text: `Vào "Hôm nay ăn gì" → Vote nhóm, nhập mã ${p.code} để chọn "${p.title}"`,
    is_demo: !!p.is_demo, created_at: p.created_at };
}

async function pollCandidates(ctx, allergies, mealSlot) {
  const view = await ctx.view();
  const profile = { ...(view.userProfile || {}), hard_allergies: allergies };
  const r = buildCandidates({ ...view, userProfile: profile, suggestionHistory: [] },
    { mode: 'both', meal_slot: mealSlot, budget_min: 0, budget_max: 100000000 });
  return { ...r, items: r.candidates.map(c => ({ dish_id: c.dish_id, name: c.dish.name, img_key: c.dish.img_key || null,
    allergen_tags: c.dish.allergen_tags, place_id: c.nearest_place?.place_id || null, place_name: c.nearest_place?.place_name || null,
    distance_m: c.nearest_place?.distance_m ?? null, price_vnd: c.price_vnd, option_type: c.option_type })) };
}

const myAllergies = ctx => (Array.isArray(ctx.profile?.hard_allergies) ? ctx.profile.hard_allergies.filter(t => typeof t === 'string') : []);

async function pollRoutes(ctx) {
  const { method, pathname, body, util, userId, ms, searchParams } = ctx;
  if (!pathname.startsWith('/api/v1/polls')) return null;
  if (!userId) return util.unauthorized();
  const all = () => ms.list(M, 'poll');

  if (pathname === '/api/v1/polls' && method === 'GET') {
    const items = (await all()).filter(p => p.is_demo || (p.members || []).some(m => m.user_id === userId))
      .map(p => presentPoll(p, userId)).sort((a, b) => Number(b.is_member) - Number(a.is_member) || String(b.created_at).localeCompare(String(a.created_at)));
    return { status: 200, data: { total: items.length, items } };
  }

  if (pathname === '/api/v1/polls/candidates' && method === 'GET') {
    const slot = searchParams.get('meal_slot') || 'lunch';
    const r = await pollCandidates(ctx, myAllergies(ctx), slot);
    if (!r.context.valid) return util.bad('meal_slot không hợp lệ');
    return { status: 200, data: { total: r.items.length, items: r.items, applied_allergies: allergyLabels(myAllergies(ctx)) } };
  }

  if (pathname === '/api/v1/polls' && method === 'POST') {
    const title = util.cleanText(body.title, 80);
    if (!title) return util.bad('Tên phòng vote (title) là bắt buộc');
    const slot = body.meal_slot === undefined ? 'lunch' : String(body.meal_slot);
    if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(slot)) return util.bad('meal_slot không hợp lệ');
    const minutes = body.deadline_minutes === undefined ? 180 : Number(body.deadline_minutes);
    if (!Number.isInteger(minutes) || minutes < 10 || minutes > 7 * 1440) return util.bad('deadline_minutes 10–10080');
    const mine = myAllergies(ctx);
    const pool = await pollCandidates(ctx, mine, slot);
    let chosen;
    if (body.dish_ids !== undefined) {
      if (!Array.isArray(body.dish_ids) || body.dish_ids.length < 2 || body.dish_ids.length > 6) return util.bad('dish_ids: 2–6 món');
      const ids = [...new Set(body.dish_ids.map(x => util.cleanText(x, 32)))];
      chosen = [];
      for (const id of ids) {
        const c = pool.items.find(x => x.dish_id === id);
        if (!c) return { status: 422, data: { error: 'Món không an toàn hoặc không phù hợp bữa đã chọn', dish_id: id } };
        chosen.push(c);
      }
      if (chosen.length < 2) return util.bad('dish_ids: ít nhất 2 món khác nhau');
    } else {
      chosen = pool.items.slice(0, 3);
      if (chosen.length < 2) return { status: 422, data: { error: 'Không đủ món an toàn để tạo phòng vote', reasons: pool.reasons } };
    }
    const all0 = await all();
    let code;
    do code = newCode(); while (all0.some(p => p.code === code));
    const p = await ms.insert({ module: M, kind: 'poll', ownerId: userId, data: {
      code, title, meal_slot: slot, status: 'open', created_by: userId, deadline_at: new Date(Date.now() + minutes * 60000).toISOString(),
      members: [{ user_id: userId, name: memberName(ctx.authUser, 1), allergies: mine, joined_at: new Date().toISOString() }],
      options: chosen.map((c, i) => ({ id: `OPT-${i + 1}`, dish_id: c.dish_id, name: c.name, img_key: c.img_key, allergen_tags: c.allergen_tags,
        place_id: c.place_id, place_name: c.place_name, distance_m: c.distance_m })),
      votes: {} } });
    return { status: 201, data: presentPoll(p, userId) };
  }

  if (pathname === '/api/v1/polls/join' && method === 'POST') {
    const code = util.cleanText(body.code, 12).toUpperCase().replace(/\s/g, '');
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return util.bad('Mã phòng không hợp lệ');
    const p = (await all()).find(x => x.code === code);
    if (!p) return util.notFound('Không tìm thấy phòng vote với mã này');
    if (presentPoll(p, userId).status !== 'open') return { status: 409, data: { error: 'Phòng vote đã đóng' } };
    const mine = myAllergies(ctx);
    const next = await ms.update(p.id, cur => {
      const members = cur.members || [];
      const i = members.findIndex(m => m.user_id === userId);
      if (i >= 0) { members[i] = { ...members[i], allergies: mine }; return { ...cur, members }; }
      if (members.length >= 50) return null;
      return { ...cur, members: [...members, { user_id: userId, name: memberName(ctx.authUser, members.length + 1), allergies: mine, joined_at: new Date().toISOString() }] };
    });
    if (!(next.members || []).some(m => m.user_id === userId)) return { status: 409, data: { error: 'Phòng đã đủ 50 người' } };
    return { status: 200, data: presentPoll(next, userId) };
  }

  const one = pathname.match(/^\/api\/v1\/polls\/([^/]+)(?:\/(vote|close))?$/);
  if (!one) return null;
  const p = await ms.get(one[1]);
  if (!p || p.module !== M || p.kind !== 'poll') return util.notFound('Không tìm thấy phòng vote');
  const member = (p.members || []).some(m => m.user_id === userId);
  if (!one[2] && method === 'GET') {
    if (!member && !p.is_demo) return util.forbidden('Hãy nhập mã phòng để tham gia');
    return { status: 200, data: presentPoll(p, userId) };
  }
  if (one[2] === 'vote' && method === 'POST') {
    if (!member) return util.forbidden('Hãy nhập mã phòng để tham gia trước khi vote');
    const view = presentPoll(p, userId);
    if (!view.is_open) return { status: 409, data: { error: 'Phòng vote đã đóng' } };
    const optId = util.cleanText(body.option_id, 16) || view.options.find(o => o.dish_id === body.dish_id)?.id;
    const opt = view.options.find(o => o.id === optId);
    if (!opt) return util.bad('option_id không thuộc phòng vote này');
    if (opt.blocked) return { status: 409, data: { error: 'Món này đã bị loại vì trùng dị ứng của thành viên', option_id: opt.id } };
    const next = await ms.update(p.id, cur => ({ ...cur, votes: { ...(cur.votes || {}), [userId]: opt.id } }));
    return { status: 200, data: presentPoll(next, userId) };
  }
  if (one[2] === 'close' && method === 'POST') {
    if (p.created_by !== userId) return util.forbidden('Chỉ người tạo phòng được chốt');
    const next = await ms.update(p.id, cur => ({ ...cur, status: 'closed', closed_at: new Date().toISOString() }));
    return { status: 200, data: presentPoll(next, userId) };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Streak & badges (from the real eaten history)
// ---------------------------------------------------------------------------
const BADGES = [
  { id: 'pho-bac', icon: '🏆', name: 'Vua Phở Bắc', goal: 3, rule: 'Ăn 3 bữa phở miền Bắc' },
  { id: 'eat-clean-7d', icon: '🌿', name: 'Eat Clean 7d', goal: 7, rule: '7 ngày liền, mỗi ngày có 1 bữa ≤ 500 kcal' },
  { id: 'tho-dia-bien-hoa', icon: '🗺️', name: 'Thổ Địa Biên Hòa', goal: 5, rule: 'Ăn tại 5 quán khác nhau ở Biên Hòa' },
  { id: 'streak-7', icon: '🔥', name: 'Chuỗi 7 ngày', goal: 7, rule: 'Ghi bữa ăn 7 ngày liên tiếp' },
  { id: 'ba-mien', icon: '🍲', name: 'Đủ vị 3 miền', goal: 3, rule: 'Ăn món của cả 3 miền Bắc – Trung – Nam' }
];
const LEVELS = ['Thực khách mới', 'Thực khách sành ăn', 'Tín đồ ẩm thực', 'Thổ địa ẩm thực'];

function longestRun(dates) {
  const s = [...new Set(dates)].sort();
  let best = 0, run = 0, prev = null;
  for (const d of s) { run = prev && dayDiff(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

async function gamification(ctx) {
  const { repo, userId, ms } = ctx;
  const [history, dishes, places] = await Promise.all([repo.listHistory(userId), repo.listDishes(), repo.listPlaces()]);
  const dish = new Map(dishes.map(d => [d.id, d]));
  const place = new Map(places.map(p => [p.id, p]));
  const eaten = (history || []).filter(h => h.action === 'eaten' && Number.isFinite(Date.parse(h.created_at)))
    .map(h => ({ ...h, date: localDate(Date.parse(h.created_at)), dish: dish.get(h.dish_id) || null }));
  const today = localDate();
  const days = new Set(eaten.map(e => e.date));
  let start = days.has(today) ? today : days.has(addDays(today, -1)) ? addDays(today, -1) : null;
  let current = 0;
  while (start && days.has(start)) { current++; start = addDays(start, -1); }
  const longest = longestRun([...days]);
  const pho = eaten.filter(e => e.dish?.region === 'bac' && /phở/i.test(e.dish?.name || e.dish_name || '')).length;
  const clean = longestRun(eaten.filter(e => e.dish && Number(e.dish.calories) > 0 && Number(e.dish.calories) <= 500).map(e => e.date));
  const bhPlaces = new Set(eaten.filter(e => e.place_id && /Biên Hòa/i.test(place.get(e.place_id)?.address || '')).map(e => e.place_id)).size;
  const regions = new Set(eaten.map(e => e.dish?.region).filter(r => ['bac', 'trung', 'nam'].includes(r))).size;
  const progress = { 'pho-bac': pho, 'eat-clean-7d': clean, 'tho-dia-bien-hoa': bhPlaces, 'streak-7': longest, 'ba-mien': regions };

  const stored = await ms.list(M, 'badge', { ownerId: userId });
  const earnedAt = Object.fromEntries(stored.map(b => [b.badge_id, b.earned_at]));
  const badges = [];
  for (const b of BADGES) {
    const p = Math.min(progress[b.id], b.goal), earned = progress[b.id] >= b.goal || !!earnedAt[b.id];
    if (earned && !earnedAt[b.id]) {
      earnedAt[b.id] = new Date().toISOString();
      try { await ms.insert({ module: M, kind: 'badge', ownerId: userId, id: `BADGE-${b.id}-${userId}`.slice(0, 120), data: { badge_id: b.id, earned_at: earnedAt[b.id] } }); }
      catch (e) { if (e.status !== 409) throw e; }
    }
    badges.push({ ...b, progress: earned ? b.goal : p, earned, earned_at: earnedAt[b.id] || null });
  }
  const week = eaten.filter(e => dayDiff(e.date, today) < 7);
  const level = 1 + Math.floor(eaten.length / 5);
  return { current_streak_days: current, longest_streak_days: longest, streak_alive_today: days.has(today),
    total_meals: eaten.length, distinct_dishes: new Set(eaten.map(e => e.dish_id)).size,
    level, level_title: `${LEVELS[Math.min(level - 1, LEVELS.length - 1)]} cấp ${level}`, next_level_in: 5 - (eaten.length % 5),
    week: { meals: week.length, spent_vnd: week.reduce((s, e) => s + (Number(e.price_vnd) || 0), 0) },
    badges, earned_count: badges.filter(b => b.earned).length, source: 'Lịch sử bữa đã ăn (Đã ăn)' };
}

// ---------------------------------------------------------------------------
// GPS-verified reviews
// ---------------------------------------------------------------------------
const pubReview = (r, userId) => ({ id: r.id, place_id: r.place_id, place_name: r.place_name, author_name: r.author_name,
  rating: r.rating, text: r.text, dish_id: r.dish_id || null, distance_m: r.distance_m, verified: !!r.verified,
  badge: '✔ Đã ghé quán (GPS)', img_key: r.img_key || null, visited_at: r.visited_at || r.created_at,
  is_mine: !!userId && r.owner_id === userId, is_demo: !!r.is_demo });

async function reviewStats(ms, placeId, userId) {
  const items = (await ms.list(M, 'review')).filter(r => r.place_id === placeId)
    .sort((a, b) => String(b.visited_at || b.created_at).localeCompare(String(a.visited_at || a.created_at))).map(r => pubReview(r, userId));
  return { items, total: items.length, avg_rating: items.length ? Math.round(items.reduce((s, r) => s + r.rating, 0) / items.length * 10) / 10 : null };
}

async function submitReview(ctx, placeId) {
  const { body, util, userId, ms, repo } = ctx;
  if (!userId) return util.unauthorized();
  const place = placeId ? await repo.getPlace(placeId) : null;
  if (!place || !publicPlace(place)) return util.notFound('Không tìm thấy quán');
  const lat = Number(body.lat), lng = Number(body.lng);
  const given = v => v !== undefined && v !== null && v !== '';
  if (!given(body.lat) || !given(body.lng) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return { status: 400, data: { verified: false, status: 'location_required', error: 'Cần vị trí GPS hiện tại (lat, lng) để xác minh đã ghé quán' } };
  const distance = haversineDistanceMeters(lat, lng, Number(place.lat), Number(place.lng));
  if (!(distance <= MAX_REVIEW_DISTANCE_M))
    return { status: 400, data: { verified: false, status: 'rejected_distance', distance_m: distance, max_distance_m: MAX_REVIEW_DISTANCE_M,
      error: `Cần ở trong bán kính ${MAX_REVIEW_DISTANCE_M}m quanh quán để đánh giá (hiện cách ${distance}m).`,
      message: `Cần ở trong bán kính ${MAX_REVIEW_DISTANCE_M}m quanh quán để đánh giá xác thực GPS (Hiện cách ${distance}m).` } };
  if (given(body.accuracy_m) && !(Number(body.accuracy_m) >= 0 && Number(body.accuracy_m) <= MAX_REVIEW_DISTANCE_M))
    return { status: 400, data: { verified: false, status: 'low_accuracy', error: 'Tín hiệu GPS chưa đủ chính xác, hãy thử lại ngoài trời' } };
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { status: 400, data: { verified: false, error: 'rating phải là số nguyên 1–5' } };
  const text = util.cleanText(body.text ?? body.comment, 500);
  if (text.length < 3) return { status: 400, data: { verified: false, error: 'Nội dung đánh giá (text) ít nhất 3 ký tự' } };
  const dishId = util.cleanText(body.dish_id, 32) || null;
  if (dishId && !(place.menu || []).some(m => m.dish_id === dishId)) return util.bad('Món không có trong thực đơn của quán');
  const today = localDate();
  const dup = (await ms.list(M, 'review', { ownerId: userId })).find(r => r.place_id === place.id && localDate(Date.parse(r.created_at)) === today);
  if (dup) return { status: 409, data: { verified: true, error: 'Bạn đã đánh giá quán này hôm nay', review_id: dup.id } };
  const rec = await ms.insert({ module: M, kind: 'review', ownerId: userId, data: {
    place_id: place.id, place_name: place.name, author_name: memberName(ctx.authUser, 1), rating, text, dish_id: dishId,
    distance_m: distance, verified: true, img_key: place.img_key || null, visited_at: new Date().toISOString() } });
  const stats = await reviewStats(ms, place.id, userId);
  return { status: 200, data: { ...pubReview(rec, userId), status: 'published', comment: text,
    place_avg_rating: stats.avg_rating, place_review_count: stats.total } };
}

export default {
  id: M,
  personalKinds: ['poll', 'review', 'badge'],
  seed,
  async route(ctx) {
    const { method, pathname, util, userId, ms, body } = ctx;
    const polls = await pollRoutes(ctx);
    if (polls) return polls;

    if (pathname === '/api/v1/me/gamification' && method === 'GET') {
      if (!userId) return util.unauthorized();
      return { status: 200, data: await gamification(ctx) };
    }

    const rv = pathname.match(/^\/api\/v1\/places\/([^/]+)\/reviews$/);
    if (rv && method === 'GET') {
      const place = await ctx.repo.getPlace(rv[1]);
      if (!place || !publicPlace(place)) return util.notFound('Không tìm thấy quán');
      return { status: 200, data: { place_id: place.id, place_name: place.name, img_key: place.img_key || null, max_distance_m: MAX_REVIEW_DISTANCE_M, ...(await reviewStats(ms, place.id, userId)) } };
    }
    if (rv && method === 'POST') return submitReview(ctx, rv[1]);
    if (pathname === '/api/v1/reviews/gps' && method === 'POST') return submitReview(ctx, ctx.util.cleanText(body.place_id, 32));
    if (pathname === '/api/v1/reviews/mine' && method === 'GET') {
      if (!userId) return util.unauthorized();
      const items = (await ms.list(M, 'review', { ownerId: userId })).reverse().map(r => pubReview(r, userId));
      return { status: 200, data: { total: items.length, items } };
    }
    const del = pathname.match(/^\/api\/v1\/reviews\/([^/]+)$/);
    if (del && method === 'DELETE') {
      if (!userId) return util.unauthorized();
      const r = await ms.get(del[1]);
      if (!r || r.module !== M || r.kind !== 'review') return util.notFound('Không tìm thấy đánh giá');
      if (r.owner_id !== userId) return util.forbidden('Chỉ xoá được đánh giá của bạn');
      await ms.remove(r.id);
      return { status: 200, data: { deleted: true, id: r.id } };
    }
    return null;
  }
};
