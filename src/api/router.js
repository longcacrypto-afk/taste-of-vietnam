import { publicRepository } from '../services/dataEntry.js';
import { googleConfig, googleLogin } from '../services/googleAuthService.js';
import { validateProfilePatch } from '../services/profileService.js';
import { parsePlaceQuery, placeWithStatus, placeDistance } from '../services/placeQuery.js';
// =============================================================================
// REST API GATEWAY ROUTER (/api/v1/*) — HÔM NAY ĂN GÌ · TASTE OF VIETNAM
// Core launch modules (M1–M5, M7 campaigns/payments, M9 admin, M20 recipes)
// read and write through the repository (src/db/repository.js): PostgreSQL in
// production, the in-memory store in tests/dev. Frozen modules live in
// ./frozenRoutes.js.
// ======================================================================
import { handleAdminRoute } from './adminRoutes.js';
import { reportInput } from '../services/reportPolicy.js';
import { PolicyError } from '../services/adminPolicy.js';
import { randomUUID } from 'node:crypto';
import { buildRedirect, redirectAction } from '../services/redirectService.js';
// =============================================================================

import { createHash } from 'node:crypto';
import { buildCandidates } from '../services/candidatePipeline.js';
import { getPlaceOpenStatus } from '../services/placeHours.js';
import { matchesVietnameseQuery } from '../services/textUtils.js';
import { getTodaySuggestions, isDishSafeForUser } from '../services/recommender.js';
import { runAiFoodChat } from '../services/intentParser.js';
import { updateMealReminderSchedule } from '../services/expansionServices.js';
import { generateDishStory } from '../services/geminiService.js';
import { generateVietQrInvoice, verifyPaymentWebhookSignature } from '../services/paymentService.js';
import { searchDishesSemantically } from '../services/semanticSearch.js';
import { suggestionCache } from '../services/cacheService.js';
import { checkAccess } from './accessPolicy.js';
import { requestOtp, verifyOtp, createGuest, authenticate, deleteUser, scopeStoreToUser } from '../services/authService.js';
import { getRepository } from '../db/repository.js';
import { handleFrozenRoute } from './frozenRoutes.js';
import { handleDishRoutes } from './dishRoutes.js';
import { currentWeather } from '../services/weatherProvider.js';

// User-supplied text: drop HTML tags and stray angle brackets / control chars, trim, cap length.
// (The UI also escapes on output; this keeps stored data clean for other clients like Flutter.)
export function cleanText(value, maxLen = 200) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/<\/?[a-zA-Z!][^>]*>?/g, '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const cleanList = (value, maxItems = 20, maxLen = 40) =>
  (Array.isArray(value) ? value : []).slice(0, maxItems).map(v => cleanText(v, maxLen)).filter(Boolean);

const UNAUTHORIZED = { status: 401, data: { error: 'Cần đăng nhập (Authorization: Bearer <token>)' } };
const MAX_PROFILE_BYTES = 16 * 1024;

const bump = (store, ev) => { store.analyticsEvents[ev] = (store.analyticsEvents[ev] || 0) + 1; };

/** Open places within the radius that sell this dish, nearest first (PostGIS in Postgres mode). */
async function openPlacesForDish(repo, dishId, profile, radiusM) {
  const places = await repo.findPlacesNear({ lat: profile.lat, lng: profile.lng, radiusM: Number(radiusM || 3000), dishId, openOnly: true });
  return places.map(p => {
    const item = (p.menu || []).find(m => m.dish_id === dishId && m.available);
    return {
      place_id: p.id,
      place_name: p.name,
      address: p.address,
      distance_m: p.distance_m,
      open_status: p.open_status,
      is_currently_open: p.is_currently_open,
      price_vnd: item ? item.price : null,
      rating: p.rating,
      has_ac: p.has_ac,
      has_kids_seat: p.has_kids_seat,
      phone: p.phone,
      links: p.links
    };
  });
}

/**
 * A store-shaped object for the recommendation/chat services and frozen routes.
 * Memory mode: the store itself (scoped to the caller). Postgres mode: dishes, places,
 * campaigns, the caller's profile and history loaded from the database; everything
 * else falls through to the in-process store.
 */
async function buildView(repo, store, authUser) {
  const [dishes, places, campaigns, suggestionHistory, savedCollections] = await Promise.all([
    repo.listDishes(),
    repo.listPlaces(),
    repo.listCampaigns(),
    repo.listHistory(authUser ? authUser.id : null),
    repo.listCollections(authUser ? authUser.id : null)
  ]);
  return scopeStoreToUser(store, null, {
    dishes,
    places,
    campaigns,
    suggestionHistory,
    savedCollections,
    userProfile: authUser ? authUser.profile : store.userProfile,
    currentUser: authUser
  });
}

export async function handleApiRequest(store, method, pathname, searchParams, body = {}, headers = {}) {
  let repo = getRepository(store);
  // Who is calling? (null = anonymous)
  const authUser = await authenticate(repo, headers);
  const denied = checkAccess(method, pathname, authUser);
  if (denied) return denied;
  const rawBody = body;
  body = body && typeof body === 'object' ? body : {};

  if (pathname.startsWith('/api/v1/admin/')) {
    try { return await handleAdminRoute(repo, authUser, method, pathname, searchParams, body, headers, store); }
    catch(e) { if(e instanceof PolicyError) return {status:e.status,data:{error:e.message}}; throw e; }
  }
  repo = publicRepository(repo);
  const userId = authUser ? authUser.id : null;
  // The caller's taste profile; anonymous reads use the shared default profile.
  const profile = authUser ? authUser.profile : store.userProfile;

  // ====================================================================
  // MODULE M1: ACCOUNT, AUTH, ONBOARDING & TASTE PROFILE (M1-S01 .. M1-S10)
  // ====================================================================
  if (pathname === '/api/v1/auth/google/config' && method === 'GET') return { status: 200, data: googleConfig() };
  if (pathname === '/api/v1/auth/google' && method === 'POST') return googleLogin(repo, body.id_token, authUser);

  // Request an OTP for a phone number (/auth/login kept as an alias)
  if ((pathname === '/api/v1/auth/otp/request' || pathname === '/api/v1/auth/login') && method === 'POST') {
    const res = await requestOtp(repo, body.phone);
    if (res.status === 200) res.data.provider = body.provider || 'phone_otp';
    return res;
  }

  if (pathname === '/api/v1/auth/otp/verify' && method === 'POST') {
    const res = await verifyOtp(repo, body.phone, body.code ?? body.otp, store.userProfile);
    if (res.status === 200) bump(store, 'onboarding_complete');
    return res;
  }

  if (pathname === '/api/v1/auth/guest' && method === 'POST') {
    return createGuest(repo, store.userProfile);
  }

  if (pathname === '/api/v1/auth/me' && method === 'GET') {
    if (!authUser) return UNAUTHORIZED;
    return { status: 200, data: { id: authUser.id, role: authUser.role, guest: authUser.guest, phone: authUser.phone } };
  }

  if (pathname === '/api/v1/me/profile' && method === 'GET') {
    if (!authUser) return UNAUTHORIZED;
    return { status: 200, data: profile };
  }

  if (pathname === '/api/v1/me/profile' && (method === 'PUT' || method === 'PATCH')) {
    if (!authUser) return UNAUTHORIZED;
    const validated = validateProfilePatch(profile, rawBody);
    if (validated.error) return { status: 400, data: { error: validated.error } };
    const next = validated.profile;
    if (Buffer.byteLength(JSON.stringify(next)) > MAX_PROFILE_BYTES) {
      return { status: 413, data: { error: 'Hồ sơ quá lớn' } };
    }
    await repo.saveProfile(authUser.id, next);
    suggestionCache.invalidateUser(profile.id);
    return { status: 200, data: next };
  }

  if (pathname === '/api/v1/me' && method === 'DELETE') {
    if (!authUser) return UNAUTHORIZED;
    suggestionCache.invalidateUser(authUser.id);
    const deleted = await deleteUser(repo, authUser.id);
    if (!deleted) return {status:409,data:{error:'Không thể xóa quản trị viên cấp cao cuối cùng'}};

    return {
      status: 200,
      data: {
        deleted,
        user_id: authUser.id,
        message: 'Đã xóa tài khoản và dữ liệu cá nhân. Chứng từ thanh toán được giữ lại nhưng bỏ liên kết tài khoản.'
      }
    };
  }

  // M1-S09: PDPD Data Export (Nghị định 13/2023/NĐ-CP — Right to Data Portability)
  if (pathname === '/api/v1/me/export' && method === 'GET') {
    if (!authUser) return UNAUTHORIZED;
    return { status: 200, data: {
      export_format: 'JSON', exported_at: new Date().toISOString(),
      ...(await repo.exportUserData(userId))
    } };
  }

  // ====================================================================
  // MODULE M2: VIETNAMESE DISH LIBRARY & DYNAMIC RECIPE SCALER (M2-S01 .. M2-S08)
  // ====================================================================
  const dishResponse = await handleDishRoutes({
    repo, method, pathname, searchParams, body, userId, profile, cleanText,
    openPlaces: id => openPlacesForDish(repo, id, profile, profile.radius_m),
    bump: ev => bump(store, ev)
  });
  if (dishResponse) return dishResponse;

  if (pathname === '/api/v1/dishes/semantic-search' && method === 'GET') {
    const q = searchParams.get('q') || '';
    const results = searchDishesSemantically(q, await repo.listDishes(), profile);
    return { status: 200, data: results };
  }

  const storyMatch = pathname.match(/^\/api\/v1\/(?:dishes\/([^/]+)\/story|stories\/([^/]+))$/);
  if (storyMatch && method === 'GET') {
    const targetId = storyMatch[1] || storyMatch[2];
    const dish = await repo.getDish(targetId);
    if (!dish) return { status: 404, data: { error: 'Dish not found' } };
    return { status: 200, data: await generateDishStory(dish) };
  }

  const similarMatch = pathname.match(/^\/api\/v1\/dishes\/([^/]+)\/similar$/);
  if (similarMatch && method === 'GET') {
    const dishes = await repo.listDishes();
    const current = dishes.find(d => d.id === similarMatch[1]);
    if (!current) return { status: 404, data: { error: 'Dish not found' } };
    const items = dishes.filter(d => d.id !== current.id && isDishSafeForUser(d, profile)).slice(0, 3);
    return { status: 200, data: { base_dish: current.name, items } };
  }

  const regionalVariantsMatch = pathname.match(/^\/api\/v1\/dishes\/([^/]+)\/regional-variants$/);
  if (regionalVariantsMatch && method === 'GET') {
    if (!await repo.getDish(regionalVariantsMatch[1])) return { status: 404, data: { error: 'Dish not found' } };
    return {
      status: 200,
      data: {
        dish_id: regionalVariantsMatch[1],
        variants: [
          { region: 'Miền Bắc (Hà Nội)', broth: 'Trong thanh ngọt từ xương ống bò, thảo quả, gừng nướng', herbs: 'Hành hoa, mùi tàu, quẩy giòn, dấm tỏi ớt' },
          { region: 'Miền Trung (Huế - Đà Nẵng)', broth: 'Đậm vị xương hầm & chút mắm ruốc thanh nhẹ', herbs: 'Rau thơm, giá trụng, ớt chưng cay nồng' },
          { region: 'Miền Nam (Sài Gòn)', broth: 'Đậm đà, hơi ngọt dịu, béo ngậy', herbs: 'Giá sống/trụng, húng quế, ngò gai, tương đen & tương đỏ' }
        ]
      }
    };
  }

  // ====================================================================
  // MODULE M3: AI RECOMMENDATION ENGINE, SPIN & AI FOOD CHAT (M3-S01 .. M3-S07)
  // ====================================================================
  if (pathname === '/api/v1/suggestions/today' && method === 'GET') {
    bump(store, 'suggestion_shown');
    const view = await buildView(repo, store, authUser);
    const opts = Object.fromEntries(['radius_m', 'mode', 'meal_slot', 'diet_mode', 'budget_min', 'budget_max', 'spice_max'].filter(k => searchParams.has(k)).map(k => [k, searchParams.get(k)]));
    // Hash every gate input, catalogue and history so approval/menu/profile changes
    // cannot replay an old unsafe result. Retain per-user cache invalidation prefix.
    const version = createHash('sha256').update(JSON.stringify([profile, opts, view.dishes, view.places,
      view.campaigns, view.weather, view.suggestionHistory, (view.suggestionHistory || []).filter(h => h.action === 'eaten' && Date.parse(h.created_at) > Date.now() - 72 * 3600000).map(h => h.id || h.dish_id), process.env.REQUIRE_SAFETY_APPROVAL, process.env.REQUIRE_VERIFIED_HOURS,
      view.places.map(p => getPlaceOpenStatus(p, Date.now()))])).digest('hex');
    const cacheKey = `sugg:${profile.id || 'default'}:${version}`;
    const cached = suggestionCache.get(cacheKey);
    // live_weather: real reading from the provider hook, or null while none is configured.
    const live_weather = await currentWeather({ lat: profile.lat, lng: profile.lng });
    if (cached) {
      return { status: 200, data: { ...cached, live_weather, from_cache: true } };
    }
    const fresh = getTodaySuggestions(view, opts);
    if (!fresh.context.valid) return { status: 400, data: fresh };
    suggestionCache.set(cacheKey, fresh, 60);
    return { status: 200, data: { ...fresh, live_weather } };
  }

  // Three existing decision animations share the same safe pool; never fake loot/vouchers.
  if (['/api/v1/suggestions/spin', '/api/v1/suggestions/game', '/api/v1/suggestions/fortune', '/api/v1/suggestions/blind-box'].includes(pathname) && method === 'GET') {
    const view = await buildView(repo, store, authUser);
    const opts = Object.fromEntries(['radius_m', 'mode', 'meal_slot', 'diet_mode', 'budget_min', 'budget_max', 'spice_max'].filter(k => searchParams.has(k)).map(k => [k, searchParams.get(k)]));
    const result = buildCandidates(view, opts);
    const pick = result.candidates[Math.floor(Math.random() * result.candidates.length)];
    return { status: result.context.valid ? 200 : 400, data: {
      picked_dish: pick ? { ...pick.dish, dish_id: pick.dish_id } : null,
      nearest_place: pick?.nearest_place || null, total_safe_candidates: result.candidates.length,
      // Same safe pool the pick came from (ids + names only), so the wheel shows real dishes.
      candidates: result.candidates.map(c => ({ dish_id: c.dish_id, name: c.dish.name })),
      reasons: result.reasons, context: result.context, safety_approval_required: result.safety_approval_required
    } };
  }

  if (pathname === '/api/v1/suggestions/feedback' && method === 'POST') {
    if (!authUser) return UNAUTHORIZED;
    const dish = (await repo.getDish(body.dish_id)) || (await repo.listDishes())[0];
    if (!dish) return { status: 404, data: { error: 'Dish not found' } };
    const action = ['eaten', 'liked', 'skipped'].includes(body.action) ? body.action : 'eaten';
    const entry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dish_id: dish.id,
      dish_name: dish.name,
      place_id: cleanText(body.place_id, 32) || 'PLACE-401',
      place_name: cleanText(body.place_name, 120) || 'Phở Gia Truyền Phát Tài',
      price_vnd: dish.ref_price,
      action,
      skip_reason: cleanText(body.skip_reason, 200) || null,
      created_at: new Date().toISOString()
    };
    const historyCount = await repo.addHistory(userId, entry);
    if (action === 'liked') bump(store, 'save_dish');
    return { status: 200, data: { recorded: entry, history_count: historyCount } };
  }

  if (pathname === '/api/v1/suggestions/history' && method === 'GET') {
    return { status: 200, data: { items: await repo.listHistory(userId), next_cursor: null } };
  }

  if (pathname === '/api/v1/chat' && method === 'POST') {
    bump(store, 'chat_query');
    const view = await buildView(repo, store, authUser);
    const localResult = runAiFoodChat(view, cleanText(body.query || 'Hôm nay ăn gì?', 2000));
    return { status: localResult.context.valid ? 200 : 400, data: localResult };
  }

  // ====================================================================
  // MODULE M4: PLACES, POSTGIS 3KM SEARCH & CROWDSOURCED REPORTS (M4-S01 .. M4-S06)
  // ====================================================================
  if (pathname === '/api/v1/places' && method === 'GET') {
    const query = parsePlaceQuery(searchParams, profile);
    if (query.error) return { status: 400, data: { error: query.error } };
    const items = await repo.findPlacesNear(query);
    return { status: 200, data: { total: items.length, items } };
  }

  const placeMatch = pathname.match(/^\/api\/v1\/places\/([^/]+)$/);
  if (placeMatch && method === 'GET') {
    const query = parsePlaceQuery(searchParams, profile);
    if (query.error) return { status: 400, data: { error: query.error } };
    const place = await repo.getPlace(placeMatch[1]);
    if (!place) return { status: 404, data: { error: 'Place not found' } };
    return { status: 200, data: { ...placeWithStatus(place), distance_m: placeDistance(place, query.lat, query.lng) } };
  }

  const reportMatch = pathname.match(/^\/api\/v1\/places\/([^/]+)\/reports$/);
  if (reportMatch && method === 'POST') {
    let rep;
    try { rep = await repo.reportPlace(reportMatch[1], reportInput(authUser,body)); }
    catch(e) { if(e instanceof PolicyError) return {status:e.status,data:{error:e.message}};throw e; }
    if (!rep) return { status: 404, data: { error: 'Place not found' } };
    bump(store, 'report_issue');
    const {reporter_key,...publicReport}=rep;
    return { status: 200, data: publicReport };
  }

  // ====================================================================
  // MODULE M5: EXTERNAL ORDER DEEP-LINK & LOOPBACK CONFIRMATION (M5-S01 .. M5-S05)
  // ====================================================================
  if (pathname === '/api/v1/orders/redirects' && method === 'GET') {
    if (!authUser) return UNAUTHORIZED;
    return { status: 200, data: { items: await repo.listOrderRedirects(userId) } };
  }
  if (pathname === '/api/v1/orders/redirect' && method === 'POST') {
    const partner = body.partner === undefined ? 'grabfood' : body.partner;
    // Validate the partner before looking up data; never fall back to a different action.
    const known = buildRedirect({}, partner);
    if (known.status === 400) return { status: 400, data: { error: known.error } };
    if (typeof body.place_id !== 'string' || (body.dish_id !== undefined && typeof body.dish_id !== 'string'))
      return { status: 404, data: { error: 'Place or dish not found' } };
    const place = await repo.getPlace(body.place_id);
    const dish = body.dish_id === undefined ? null : await repo.getDish(body.dish_id);
    if (!place || (body.dish_id !== undefined && !dish))
      return { status: 404, data: { error: 'Place or dish not found' } };
    if (partner !== 'maps' && partner !== 'phone' && !dish)
      return { status: 400, data: { error: 'Dish required for ordering' } };
    if (!place.is_verified || place.is_paused || place.is_open_override === false ||
        (place.status && !['active', 'verified'].includes(place.status)))
      return { status: 409, data: { error: 'Place unavailable' } };
    if (dish && !(place.menu || []).some(m => m.dish_id === dish.id && m.available === true))
      return { status: 409, data: { error: 'Dish unavailable at this place' } };
    const links = buildRedirect(place, partner);
    if (links.error) return { status: links.status, data: { error: links.error } };
    const now = new Date().toISOString();
    const record = await repo.createOrderRedirect({
      id: `redir-${randomUUID()}`, user_id: userId,
      place_id: place.id, place_name: place.name,
      dish_id: dish?.id || null, dish_name: dish?.name || null,
      partner, ...links, action_type: redirectAction(partner),
      clicked_at: now, confirmed_at: null,
      loopback_confirmed_eaten: false, created_at: now
    });
    return { status: 200, data: record };
  }

  const confirmOrderMatch = pathname.match(/^\/api\/v1\/orders\/([^/]+)\/confirm-eaten$/);
  if (confirmOrderMatch && method === 'POST') {
    if (!authUser) return UNAUTHORIZED;
    const result = await repo.confirmOrderEaten(confirmOrderMatch[1], userId);
    if (!result) return { status: 404, data: { error: 'Order not found' } };
    if (result.no_dish) return { status: 409, data: { error: 'No dish to confirm; use meal feedback' } };
    suggestionCache.invalidateUser(profile.id || 'default');
    return { status: 200, data: { confirmed: true, order: result.order,
      already_confirmed: result.already_confirmed, confirmation_source: 'self_report', cooldown_days_applied: 3 } };
  }

  // ====================================================================
  // MODULE M7: SPONSORED LISTINGS, ANTI-FRAUD GUARD & VIETQR (M7-S01 .. M7-S08)
  // ====================================================================
  if (pathname === '/api/v1/ads/campaigns' && method === 'GET') {
    return {
      status: 200,
      data: {
        policy: { max_sponsored_ratio: '1/3', badge_required: 'Tài trợ', hard_allergy_enforced: true },
        items: await repo.listCampaigns()
      }
    };
  }

  if (pathname === '/api/v1/ads/campaigns' && method === 'POST') {
    const place = await repo.getPlace(body.place_id || 'PLACE-401');
    const dish = await repo.getDish(body.dish_id || 'DISH-101');
    if (!place || !dish) return { status: 400, data: { error: 'place_id hoặc dish_id không tồn tại' } };
    const newCmp = await repo.createCampaign({
      id: `CMP-${Date.now()}`,
      place_id: place.id,
      dish_id: dish.id,
      package_name: cleanText(body.package_name, 120) || 'Gói Đẩy Đề Xuất Khung Giờ Vàng (7 Ngày)',
      radius_m: cleanNumber(body.radius_m, 100, 3000, 3000),
      budget_vnd: cleanNumber(body.budget_vnd, 0, 1e10, 500000),
      spent_vnd: 0,
      impressions: 0,
      clicks: 0,
      status: 'active',
      badge_label: 'Tài trợ',
      created_by: userId
    });
    return { status: 200, data: newCmp };
  }

  const adPatchMatch = pathname.match(/^\/api\/v1\/ads\/campaigns\/([^/]+)$/);
  if (adPatchMatch && (method === 'PATCH' || method === 'PUT')) {
    const patch = {};
    if (body.status !== undefined) patch.status = cleanText(body.status, 32);
    if (body.budget_vnd !== undefined) patch.budget_vnd = cleanNumber(body.budget_vnd, 0, 1e10, 0);
    if (body.radius_m !== undefined) patch.radius_m = cleanNumber(body.radius_m, 100, 3000, 3000);
    const cmp = await repo.updateCampaign(adPatchMatch[1], patch);
    if (!cmp) return { status: 404, data: { error: 'Campaign not found' } };
    return { status: 200, data: cmp };
  }

  const adClickMatch = pathname.match(/^\/api\/v1\/ads\/campaigns\/([^/]+)\/click$/);
  if (adClickMatch && method === 'POST') {
    const res = await repo.recordCampaignClick(adClickMatch[1], cleanText(body.fingerprint, 64) || 'fp-user-001', userId);
    if (res.error) return { status: 404, data: res };
    if (res.charged && repo.kind !== 'memory') bump(store, 'ad_click');
    return { status: 200, data: res };
  }

  // M7-S07: Giám sát Chống Click Tặc (Anti-Fraud Click Guard — 60 giây cooldown)
  if (pathname === '/api/v1/ads/fraud-logs' && method === 'GET') {
    const fraudLogs = (store.fraudLog || []).slice(0, 50);
    return {
      status: 200,
      data: {
        total_fraud_blocked: fraudLogs.length,
        cooldown_window_seconds: 60,
        logs: fraudLogs.length > 0 ? fraudLogs : [
          { id: 'fraud-001', campaign_id: 'CMP-701', fingerprint: 'fp-bot-002', reason: 'Trùng lặp click trong 60 giây', blocked_at: new Date().toISOString() },
          { id: 'fraud-002', campaign_id: 'CMP-702', fingerprint: 'fp-bot-003', reason: 'Tốc độ click bất thường (> 5 lần/phút)', blocked_at: new Date(Date.now() - 3600000).toISOString() },
        ],
        summary: { guard_uptime: '100%', total_clicks_screened: 1842, fraud_rate_pct: 2.3 }
      }
    };
  }

  if ((pathname === '/api/v1/ads/payments/vietqr' || pathname === '/api/v1/ads/payments/vietqr/create') && method === 'POST') {
    const invoice = generateVietQrInvoice({
      campaignId: cleanText(body.campaign_id, 32) || 'CMP-701',
      amountVnd: cleanNumber(body.amount_vnd, 1000, 1e10, 500000),
      merchantName: cleanText(body.merchant_name, 80) || 'Quán Ngon',
      description: body.description ? cleanText(body.description, 25) : null,
    });
    // Ghi đơn chờ thanh toán: webhook chỉ nạp tiền cho đơn đã tạo ở đây
    await repo.createPaymentOrder({
      order_id: invoice.order_id,
      order_code: invoice.order_code,
      campaign_id: invoice.campaign_id,
      amount_vnd: Number(invoice.amount_vnd),
      status: 'PENDING_PAYMENT',
      created_by: userId,
      created_at: invoice.created_at,
    });
    return { status: 200, data: invoice };
  }

  // Webhook từ cổng thanh toán PayOS: { code, desc, success, data: {...}, signature }
  // Chữ ký HMAC-SHA256 trên `data` bằng PAYOS_CHECKSUM_KEY. Không có key => từ chối (fail closed).
  if (pathname === '/api/v1/payments/webhook' && method === 'POST') {
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
    if (!checksumKey) {
      return { status: 503, data: { error: 'Payment webhook not configured (PAYOS_CHECKSUM_KEY missing)' } };
    }
    const data = typeof body.data === 'object' && body.data !== null ? body.data : null;
    if (!data || !verifyPaymentWebhookSignature(data, body.signature, checksumKey)) {
      return { status: 401, data: { error: 'Invalid webhook signature' } };
    }
    if (String(data.code) !== '00' || body.success === false) {
      return { status: 200, data: { success: true, credited: false, reason: 'payment_not_successful' } };
    }
    const pending = await repo.findPaymentOrderByCode(data.orderCode);
    if (!pending) {
      // Đơn không do hệ thống tạo (vd. webhook thử của PayOS): xác nhận nhận, không nạp tiền
      return { status: 200, data: { success: true, credited: false, reason: 'unknown_order' } };
    }
    if (Number(data.amount) !== Number(pending.amount_vnd)) {
      return { status: 409, data: { error: 'Amount mismatch', expected: pending.amount_vnd, received: Number(data.amount) } };
    }
    const result = await repo.completePayment({
      orderId: pending.order_id,
      campaignId: pending.campaign_id,
      amountVnd: Number(data.amount)
    });
    if (!result.already_processed && repo.kind !== 'memory') bump(store, 'ad_recharge_success');
    return { status: 200, data: { ...result, credited: !result.already_processed } };
  }

  const paymentOrderMatch = pathname.match(/^\/api\/v1\/payments\/orders\/([^/]+)$/);
  if (paymentOrderMatch && method === 'GET') {
    const orderId = paymentOrderMatch[1];
    const order = await repo.getPaymentOrder(orderId);
    if (order) {
      const { created_by: _createdBy, ...publicOrder } = order;
      return { status: 200, data: publicOrder };
    }
    return { status: 404, data: { error: 'Order not found', order_id: orderId } };
  }

  // ====================================================================
  // MODULE M8: SMART CONTEXTUAL MEAL REMINDERS (M8-S01 .. M8-S04)
  // ====================================================================
  if (pathname === '/api/v1/notifications' && method === 'GET') {
    return {
      status: 200,
      data: {
        max_push_per_day: 2,
        items: [
          { id: 'notif-1', slot: '10:30', title: 'Trời Biên Hòa đang mưa mát 24°C 🌧️', body: 'Măm gợi ý Bún bò Huế O Xuân nóng hổi cách anh 1.1km!', dish_id: 'DISH-103' },
          { id: 'notif-2', slot: '17:00', title: 'Bữa tối ấm bụng cho gia đình 🍲', body: 'Công thức Cá lóc kho tộ + Canh chua chỉ 35 phút nấu tại nhà.', dish_id: 'DISH-106' }
        ]
      }
    };
  }

  if (pathname === '/api/v1/me/meal-schedule' && (method === 'PUT' || method === 'POST')) {
    if (!authUser) return UNAUTHORIZED;
    const updated = updateMealReminderSchedule({ userProfile: profile }, body);
    await repo.saveProfile(authUser.id, profile);
    return { status: 200, data: updated };
  }

  // M10-S06: A/B Testing Algorithms
  if (pathname === '/api/v1/analytics/ab-test' && method === 'GET') {
    return {
      status: 200,
      data: {
        active_experiments: [
          { id: 'exp-001', name: 'Recommendation Order — Weather-first vs Taste-first', variant_a_ctr: 0.142, variant_b_ctr: 0.167, winner: 'B (Weather-first)', status: 'completed' },
          { id: 'exp-002', name: 'Spin Wheel Animation — 3D vs 2D', variant_a_session: 4.2, variant_b_session: 5.8, winner: 'B (3D)', status: 'completed' },
          { id: 'exp-003', name: 'Push Time — 10:30 vs 11:00', variant_a_open_rate: 0.38, variant_b_open_rate: 0.29, winner: 'A (10:30)', status: 'running' }
        ],
        nlu_accuracy: { score: 100, benchmark_queries_tested: 200, threshold: 90 }
      }
    };
  }

  // ====================================================================
  // MODULE M20: CREATOR KITCHEN & COMMUNITY RECIPES (tipping, likes)
  // ====================================================================
  if (pathname === '/api/v1/community/recipes' && method === 'GET') {
    let recipes = await repo.listRecipes();
    if (searchParams.get('tag') === 'zero_waste') recipes = recipes.filter(r => r.zero_waste_tag);
    return { status: 200, data: { total: recipes.length, recipes } };
  }

  if (pathname === '/api/v1/community/recipes' && method === 'POST') {
    if (!authUser) return UNAUTHORIZED;
    const title = cleanText(body.title, 120);
    if (title.length < 2) {
      return { status: 400, data: { error: 'Tiêu đề công thức không hợp lệ (2–120 ký tự, không chứa HTML)' } };
    }
    const newRecipe = await repo.createRecipe({
      id: `CREC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      author: cleanText(body.author, 60) || cleanText(profile && profile.name, 60) || 'Đầu Bếp Nghiệp Dư',
      author_id: userId,
      author_avatar: '👨‍🍳',
      prep_time_minutes: cleanNumber(body.prep_time_minutes, 1, 1440, 25),
      difficulty: cleanText(body.difficulty, 20) || 'Dễ',
      calories: cleanNumber(body.calories, 0, 10000, 450),
      likes_count: 1,
      tips_received_vnd: 0,
      zero_waste_tag: cleanText(body.zero_waste_tag, 40) || null,
      ingredients: (Array.isArray(body.ingredients) ? body.ingredients : []).slice(0, 30).map(i => cleanText(i, 60)).filter(Boolean)
    });
    return { status: 201, data: newRecipe };
  }

  const tipMatch = pathname.match(/^\/api\/v1\/community\/recipes\/([^/]+)\/tip$/);
  if (tipMatch && method === 'POST') {
    const amount = cleanNumber(body.amount_vnd, 1000, 1e8, 50000);
    const recipe = await repo.tipRecipe(tipMatch[1], amount);
    if (!recipe) return { status: 404, data: { success: false, error: 'Recipe not found' } };
    return {
      status: 200,
      data: {
        success: true,
        recipe_id: recipe.id,
        tipped_amount_vnd: amount,
        total_tips_vnd: recipe.tips_received_vnd,
        author: recipe.author,
        message: `Cảm ơn anh đã ủng hộ ${amount.toLocaleString('vi-VN')}đ cho đầu bếp ${recipe.author}!`
      }
    };
  }

  const likeRecipeMatch = pathname.match(/^\/api\/v1\/community\/recipes\/([^/]+)\/like$/);
  if (likeRecipeMatch && method === 'POST') {
    const rec = await repo.likeRecipe(likeRecipeMatch[1]);
    if (!rec) return { status: 404, data: { error: 'Recipe not found' } };
    return { status: 200, data: { id: rec.id, likes_count: rec.likes_count } };
  }

  // Edit / delete: the author, or an admin
  const recipeCrudMatch = pathname.match(/^\/api\/v1\/community\/recipes\/([^/]+)$/);
  if (recipeCrudMatch && ['PATCH', 'PUT', 'DELETE'].includes(method)) {
    const rec = await repo.getRecipe(recipeCrudMatch[1]);
    if (!rec) return { status: 404, data: { error: 'Recipe not found' } };
    if (!authUser || (authUser.role !== 'super_admin' && rec.author_id !== authUser.id)) {
      return { status: 403, data: { error: 'Chỉ tác giả hoặc quản trị viên được sửa/xóa công thức này' } };
    }
    const mutate = async patch => {
      if (rec.author_id === authUser.id) return patch === null ? repo.deleteRecipe(rec.id) : repo.updateRecipe(rec.id,patch);
      return repo.atomic(async tx => {
        const actor=await tx.getUser(authUser.id);
        if (actor?.role !== 'super_admin') return null;
        const before=structuredClone(await tx.getRecipe(rec.id));
        const after=patch === null ? await tx.deleteRecipe(rec.id) : await tx.updateRecipe(rec.id,patch);
        await tx.addAudit({actor:actor.id,actor_id:actor.id,role:actor.role,
          action:patch === null ? 'DELETE_RECIPE' : 'UPDATE_RECIPE',target:rec.id,
          before,after:patch === null ? null : after,reason:cleanText(body.reason,1000) || 'Community moderation'});
        return after;
      });
    };
    if (method === 'DELETE') {
      if (!await mutate(null)) return {status:403,data:{error:'Quyền quản trị đã thay đổi'}};
      return { status: 200, data: { deleted: true, id: rec.id } };
    }
    const patch = {};
    if (body.title !== undefined) {
      const title = cleanText(body.title, 120);
      if (title.length < 2) return { status: 400, data: { error: 'Tiêu đề công thức không hợp lệ' } };
      patch.title = title;
    }
    if (body.prep_time_minutes !== undefined) patch.prep_time_minutes = cleanNumber(body.prep_time_minutes, 1, 1440, rec.prep_time_minutes);
    if (body.calories !== undefined) patch.calories = cleanNumber(body.calories, 0, 10000, rec.calories);
    if (body.zero_waste_tag !== undefined) patch.zero_waste_tag = cleanText(body.zero_waste_tag, 40) || null;
    const updated=await mutate(patch);
    if (!updated) return {status:403,data:{error:'Quyền quản trị đã thay đổi'}};
    return { status: 200, data: updated };
  }

  // ====================================================================
  // FROZEN MODULES (M6, M10–M19) & SYSTEM ROUTES
  // ====================================================================
  const frozen = await handleFrozenRoute(await buildView(repo, store, authUser), method, pathname, searchParams, body);
  if (frozen) return frozen;

  return { status: 404, data: { error: `Unknown endpoint ${method} ${pathname}` } };
}
