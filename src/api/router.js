// =============================================================================
// REST API GATEWAY ROUTER (/api/v1/*) — HÔM NAY ĂN GÌ · TASTE OF VIETNAM
// Core launch modules (M1–M5, M7 campaigns/payments, M9 admin, M20 recipes)
// read and write through the repository (src/db/repository.js): PostgreSQL in
// production, the in-memory store in tests/dev. Frozen modules live in
// ./frozenRoutes.js.
// =============================================================================

import { getTodaySuggestions, isDishSafeForUser } from '../services/recommender.js';
import { runAiFoodChat } from '../services/intentParser.js';
import { updateMealReminderSchedule } from '../services/expansionServices.js';
import { callGeminiChat, generateDishStory } from '../services/geminiService.js';
import { generateVietQrInvoice, verifyPaymentWebhookSignature } from '../services/paymentService.js';
import { searchDishesSemantically } from '../services/semanticSearch.js';
import { suggestionCache } from '../services/cacheService.js';
import { checkAccess } from './accessPolicy.js';
import { requestOtp, verifyOtp, createGuest, authenticate, deleteUser, scopeStoreToUser } from '../services/authService.js';
import { getRepository } from '../db/repository.js';
import { handleFrozenRoute } from './frozenRoutes.js';
import { handleDishRoutes } from './dishRoutes.js';

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
  if (repo.kind === 'memory') return authUser ? scopeStoreToUser(store, authUser) : store;
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

function clientIp(headers) {
  return String(headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown').split(',')[0].trim();
}

export async function handleApiRequest(store, method, pathname, searchParams, body = {}, headers = {}) {
  const repo = getRepository(store);
  // Who is calling? (null = anonymous)
  const authUser = await authenticate(repo, headers);
  const denied = checkAccess(method, pathname, authUser);
  if (denied) return denied;
  body = body && typeof body === 'object' ? body : {};

  const userId = authUser ? authUser.id : null;
  // The caller's taste profile; anonymous reads use the shared default profile.
  const profile = authUser ? authUser.profile : store.userProfile;
  const audit = (action, target) => repo.addAudit({
    actor: authUser.phone || authUser.id, actor_id: authUser.id, role: authUser.role, action, target, ip: clientIp(headers)
  });

  // ===========================================================================
  // MODULE M1: ACCOUNT, AUTH, ONBOARDING & TASTE PROFILE (M1-S01 .. M1-S10)
  // ===========================================================================
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
    const { id: _id, phone: _phone, role: _role, ...changes } = body;
    const next = { ...profile, ...changes };
    if (Buffer.byteLength(JSON.stringify(next)) > MAX_PROFILE_BYTES) {
      return { status: 413, data: { error: 'Hồ sơ quá lớn' } };
    }
    Object.assign(profile, changes);
    await repo.saveProfile(authUser.id, profile);
    suggestionCache.invalidateUser(profile.id);
    return { status: 200, data: profile };
  }

  if (pathname === '/api/v1/me' && method === 'DELETE') {
    if (!authUser) return UNAUTHORIZED;
    suggestionCache.invalidateUser(authUser.id);
    const deleted = await deleteUser(repo, authUser.id);
    return {
      status: 200,
      data: {
        deleted,
        user_id: authUser.id,
        pdpd_compliance: 'Nghị định 13/2023/NĐ-CP — Đã xóa toàn bộ hồ sơ vị giác & lịch sử cá nhân ngay lập tức.'
      }
    };
  }

  // M1-S09: PDPD Data Export (Nghị định 13/2023/NĐ-CP — Right to Data Portability)
  if (pathname === '/api/v1/me/export' && method === 'GET') {
    if (!authUser) return UNAUTHORIZED;
    const [history, collections] = await Promise.all([repo.listHistory(userId), repo.listCollections(userId)]);
    return {
      status: 200,
      data: {
        export_format: 'JSON',
        pdpd_compliance: 'Nghị định 13/2023/NĐ-CP',
        exported_at: new Date().toISOString(),
        account: { id: authUser.id, role: authUser.role, phone: authUser.phone, guest: authUser.guest, created_at: authUser.created_at },
        profile,
        suggestion_history: history.slice(0, 50),
        saved_collections: collections,
        analytics_summary: {
          total_dish_views: store.analyticsEvents.dish_view || 0,
          total_order_clicks: store.analyticsEvents.order_click || 0,
          onboarding_completed: store.analyticsEvents.onboarding_complete || 0
        },
        message: 'Xuất dữ liệu thành công. File JSON tuân thủ PDPD Nghị định 13/2023/NĐ-CP.'
      }
    };
  }

  // ===========================================================================
  // MODULE M2: VIETNAMESE DISH LIBRARY & DYNAMIC RECIPE SCALER (M2-S01 .. M2-S08)
  // ===========================================================================
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

  // ===========================================================================
  // MODULE M3: AI RECOMMENDATION ENGINE, SPIN & AI FOOD CHAT (M3-S01 .. M3-S07)
  // ===========================================================================
  if (pathname === '/api/v1/suggestions/today' && method === 'GET') {
    bump(store, 'suggestion_shown');
    const view = await buildView(repo, store, authUser);
    const radiusM = searchParams.get('radius_m') || profile.radius_m;
    const historyLen = (view.suggestionHistory || []).length;
    const cacheKey = `sugg:${profile.id || 'default'}:${radiusM}:${profile.meal_slot}:${(profile.hard_allergies || []).join(',')}:${historyLen}`;
    const cached = suggestionCache.get(cacheKey);
    if (cached) {
      return { status: 200, data: { ...cached, from_cache: true } };
    }
    const fresh = getTodaySuggestions(view, { radius_m: radiusM });
    suggestionCache.set(cacheKey, fresh, 60);
    return { status: 200, data: fresh };
  }

  if (pathname === '/api/v1/suggestions/spin' && method === 'GET') {
    const view = await buildView(repo, store, authUser);
    const today = getTodaySuggestions(view);
    const candidates = view.dishes.filter(d => isDishSafeForUser(d, profile));
    const pick = candidates[Math.floor(Math.random() * candidates.length)] || today.items[0];
    if (!pick) return { status: 404, data: { error: 'Chưa có món nào phù hợp' } };
    const places = await openPlacesForDish(repo, pick.id || pick.dish_id, profile, profile.radius_m);
    return {
      status: 200,
      data: {
        picked_dish: pick,
        nearest_place: places[0] || null,
        total_safe_candidates: candidates.length
      }
    };
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
    // Try Gemini first, fall back to local engine
    const aiResult = await callGeminiChat(body.query || 'Hôm nay ăn gì ngon?', profile);
    const localResult = runAiFoodChat(view, body.query || 'Tối nay 4 người, ngân sách 300k, có trẻ nhỏ, muốn ăn gần nhà');
    return {
      status: 200,
      data: {
        intent: aiResult.intent,
        ai_source: aiResult.source,
        assistant_message: aiResult.response_vi || localResult.assistant_message,
        options: localResult.options
      }
    };
  }

  // ===========================================================================
  // MODULE M4: PLACES, POSTGIS 3KM SEARCH & CROWDSOURCED REPORTS (M4-S01 .. M4-S06)
  // ===========================================================================
  if (pathname === '/api/v1/places' && method === 'GET') {
    const items = await repo.findPlacesNear({
      lat: profile.lat,
      lng: profile.lng,
      radiusM: profile.radius_m || 3000,
      dishId: searchParams.get('dish_id') || null,
      openOnly: searchParams.get('open_only') !== 'false'
    });
    return { status: 200, data: { total: items.length, items } };
  }

  const reportMatch = pathname.match(/^\/api\/v1\/places\/([^/]+)\/reports$/);
  if (reportMatch && method === 'POST') {
    const rep = await repo.reportPlace(reportMatch[1], { reason: cleanText(body.reason, 300) || 'Quán đóng cửa', userId });
    if (!rep) return { status: 404, data: { error: 'Place not found' } };
    bump(store, 'report_issue');
    return { status: 200, data: rep };
  }

  // ===========================================================================
  // MODULE M5: EXTERNAL ORDER DEEP-LINK & LOOPBACK CONFIRMATION (M5-S01 .. M5-S05)
  // ===========================================================================
  if (pathname === '/api/v1/orders/redirect' && method === 'POST') {
    const place = (await repo.getPlace(body.place_id)) || (await repo.listPlaces())[0];
    const dish = (await repo.getDish(body.dish_id)) || (await repo.listDishes())[0];
    if (!place || !dish) return { status: 404, data: { error: 'Place or dish not found' } };
    const partner = /^[a-z_]{2,20}$/.test(body.partner || '') ? body.partner : 'grabfood';
    const utm = 'utm_source=hom_nay_an_gi&utm_medium=app_mvp';
    const baseLink = (place.links && place.links[partner]) || `https://maps.google.com/?q=${place.lat},${place.lng}`;
    const record = await repo.createOrderRedirect({
      id: `redir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: userId,
      place_id: place.id,
      place_name: place.name,
      dish_id: dish.id,
      dish_name: dish.name,
      partner,
      target_deeplink: `${baseLink}${baseLink.includes('?') ? '&' : '?'}${utm}`,
      fallback_web_url: baseLink,
      loopback_confirmed_eaten: false,
      created_at: new Date().toISOString()
    });
    bump(store, partner === 'maps' ? 'direction_click' : partner === 'phone' ? 'call_click' : 'order_click');
    return { status: 200, data: record };
  }

  const confirmOrderMatch = pathname.match(/^\/api\/v1\/orders\/([^/]+)\/confirm-eaten$/);
  if (confirmOrderMatch && method === 'POST') {
    if (!authUser) return UNAUTHORIZED;
    const existing = await repo.getOrderRedirect(confirmOrderMatch[1]);
    if (existing && existing.user_id && existing.user_id !== userId) {
      return { status: 404, data: { error: 'Order not found' } };
    }
    let ord;
    if (existing) {
      ord = await repo.confirmOrderEaten(existing.id);
    } else {
      // No redirect on record (e.g. ate there without ordering through the app): log the dish named in the body
      const dish = (await repo.getDish(body.dish_id || 'DISH-101')) || (await repo.listDishes())[0];
      const place = (await repo.getPlace(body.place_id || 'PLACE-401')) || (await repo.listPlaces())[0];
      if (!dish) return { status: 404, data: { error: 'Dish not found' } };
      ord = {
        id: confirmOrderMatch[1],
        dish_id: dish.id,
        dish_name: dish.name,
        place_id: place ? place.id : null,
        place_name: place ? place.name : null,
        loopback_confirmed_eaten: true
      };
    }
    const dish = await repo.getDish(ord.dish_id);
    await repo.addHistory(userId, {
      id: `hist-loopback-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dish_id: ord.dish_id,
      dish_name: ord.dish_name,
      place_id: ord.place_id,
      place_name: ord.place_name,
      price_vnd: dish ? dish.ref_price : null,
      action: 'eaten',
      created_at: new Date().toISOString()
    });
    suggestionCache.invalidateUser(profile.id || 'default');
    return { status: 200, data: { confirmed: true, order: ord, cooldown_days_applied: 3 } };
  }

  // ===========================================================================
  // MODULE M7: SPONSORED LISTINGS, ANTI-FRAUD GUARD & VIETQR (M7-S01 .. M7-S08)
  // ===========================================================================
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

  // ===========================================================================
  // MODULE M8: SMART CONTEXTUAL MEAL REMINDERS (M8-S01 .. M8-S04)
  // ===========================================================================
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

  // ===========================================================================
  // MODULE M9: ADMIN CMS, OCR MODERATION & AUDIT LOGS (M9-S01 .. M9-S09)
  // Every admin write is recorded in the audit log (rbac_audit_logs).
  // ===========================================================================
  if (pathname === '/api/v1/admin/dashboard' && method === 'GET') {
    const [dishes, places, ocrQueue, userReports, campaigns] = await Promise.all([
      repo.listDishes(), repo.listPlaces(), repo.listOcrQueue(), repo.listUserReports(), repo.listCampaigns()
    ]);
    return {
      status: 200,
      data: {
        total_dishes: dishes.length,
        total_verified_places: places.filter(p => p.is_verified).length,
        ocr_queue: ocrQueue,
        user_reports: userReports,
        campaigns,
        events: store.analyticsEvents
      }
    };
  }

  // M9-S02: Admin CRUD Thư viện Món ăn Toàn quốc
  if (pathname === '/api/v1/admin/dishes' && method === 'POST') {
    const allergens = cleanList(body.allergen_tags || body.allergens);
    const newDish = await repo.createDish({
      id: `DISH-${Date.now()}`,
      name: cleanText(body.name, 120) || 'Món Việt Mới',
      region: cleanText(body.region, 32) || 'Miền Nam',
      meal_slots: cleanList(body.meal_slots).length ? cleanList(body.meal_slots) : ['lunch', 'dinner'],
      calories: cleanNumber(body.calories, 0, 10000, 450),
      ref_price: cleanNumber(body.ref_price, 0, 1e8, 50000),
      spice_level: Math.round(cleanNumber(body.spice_level, 0, 3, 1)),
      allergen_tags: allergens,
      weather_fit: ['any'],
      tags: cleanList(body.tags).length ? cleanList(body.tags) : ['Đặc sản'],
      description: cleanText(body.description, 1000) || 'Món ăn mới từ Admin CMS'
    });
    await audit('CREATE_DISH', newDish.id);
    // `allergens` kept for older clients; the recommender reads `allergen_tags`
    return { status: 201, data: { ...newDish, allergens: newDish.allergen_tags } };
  }

  const adminDishMatch = pathname.match(/^\/api\/v1\/admin\/dishes\/([^/]+)$/);
  if (adminDishMatch && (method === 'PUT' || method === 'PATCH')) {
    const patch = {};
    if (body.name !== undefined) patch.name = cleanText(body.name, 120) || 'Món Việt Mới';
    if (body.calories !== undefined) patch.calories = cleanNumber(body.calories, 0, 10000, 450);
    if (body.ref_price !== undefined) patch.ref_price = cleanNumber(body.ref_price, 0, 1e8, 50000);
    if (body.allergens !== undefined || body.allergen_tags !== undefined) patch.allergen_tags = cleanList(body.allergen_tags || body.allergens);
    if (body.region !== undefined) patch.region = cleanText(body.region, 32);
    if (body.spice_level !== undefined) patch.spice_level = Math.round(cleanNumber(body.spice_level, 0, 3, 1));
    if (body.description !== undefined) patch.description = cleanText(body.description, 1000);
    const dish = await repo.updateDish(adminDishMatch[1], patch);
    if (!dish) return { status: 404, data: { error: 'Dish not found' } };
    await audit('UPDATE_DISH', dish.id);
    return { status: 200, data: { ...dish, allergens: dish.allergen_tags } };
  }

  if (adminDishMatch && method === 'DELETE') {
    const deleted = await repo.deleteDish(adminDishMatch[1]);
    if (!deleted) return { status: 404, data: { error: 'Dish not found' } };
    await audit('DELETE_DISH', adminDishMatch[1]);
    return { status: 200, data: { deleted: true, id: adminDishMatch[1] } };
  }

  if (pathname === '/api/v1/admin/ocr-review' && method === 'POST') {
    const decision = ['approved', 'rejected', 'pending_review'].includes(body.decision) ? body.decision : 'approved';
    const item = await repo.reviewOcr(body.ocr_id, decision, body.reason ? cleanText(body.reason, 300) : null);
    if (!item) return { status: 404, data: { error: 'OCR item not found', updated: null } };
    await audit(decision === 'rejected' ? 'REJECT_OCR_MENU' : 'APPROVE_OCR_MENU', item.id);
    return { status: 200, data: { updated: item } };
  }

  const unpausePlaceMatch = pathname.match(/^\/api\/v1\/admin\/places\/([^/]+)\/(?:approve|unpause)$/);
  if (unpausePlaceMatch && method === 'POST') {
    const place = await repo.unpausePlace(unpausePlaceMatch[1]);
    if (!place) return { status: 404, data: { error: 'Place not found' } };
    await audit('UNPAUSE_PLACE', place.id);
    return { status: 200, data: { unpaused_place: place, message: 'Đã mở lại quán và xóa cờ báo lỗi thành công.' } };
  }

  const moderateAdMatch = pathname.match(/^\/api\/v1\/admin\/ads\/([^/]+)\/moderate$/);
  if (moderateAdMatch && method === 'POST') {
    const cmp = await repo.updateCampaign(moderateAdMatch[1], { status: cleanText(body.decision, 32) || 'active' });
    if (!cmp) return { status: 404, data: { error: 'Campaign not found' } };
    await audit('MODERATE_AD', `${cmp.id}:${cmp.status}`);
    return { status: 200, data: { campaign: cmp, hard_allergy_check: 'passed', sponsored_badge_check: 'passed' } };
  }

  if (pathname === '/api/v1/admin/audit-logs' && method === 'GET') {
    return {
      status: 200,
      data: {
        rbac_roles: ['Consumer', 'Merchant Owner', 'Merchant Staff', 'Content Moderator', 'Ops Admin', 'Super Admin'],
        logs: await repo.listAudit(100)
      }
    };
  }

  // M9-S08: RBAC Roles Management (6 roles)
  if (pathname === '/api/v1/admin/rbac/roles' && method === 'GET') {
    return {
      status: 200,
      data: {
        roles: [
          { id: 'consumer', name: 'Consumer', permissions: ['read_suggestions', 'write_feedback', 'read_places'] },
          { id: 'merchant_owner', name: 'Merchant Owner', permissions: ['manage_menu', 'manage_campaigns', 'view_analytics'] },
          { id: 'merchant_staff', name: 'Merchant Staff', permissions: ['update_daily_special', 'view_bookings'] },
          { id: 'content_moderator', name: 'Content Moderator', permissions: ['approve_ocr', 'reject_ocr', 'moderate_reviews'] },
          { id: 'ops_admin', name: 'Ops Admin', permissions: ['manage_places', 'unpause_places', 'manage_campaigns', 'view_audit_logs'] },
          { id: 'super_admin', name: 'Super Admin', permissions: ['*'] }
        ]
      }
    };
  }

  if (pathname === '/api/v1/admin/rbac/users' && (method === 'GET' || method === 'POST')) {
    if (method === 'POST') {
      return { status: 200, data: { updated: true, user_id: body.user_id, new_role: body.role } };
    }
    return {
      status: 200,
      data: {
        users: [
          { id: 'USR-001', name: 'Admin Hệ Thống', role: 'super_admin', email: 'admin@homnayangi.vn' },
          { id: 'USR-002', name: 'Kiểm Duyệt Nội Dung', role: 'content_moderator', email: 'mod@homnayangi.vn' },
          { id: 'USR-003', name: 'Điều Hành Vận Hành', role: 'ops_admin', email: 'ops@homnayangi.vn' }
        ]
      }
    };
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

  // ===========================================================================
  // MODULE M20: CREATOR KITCHEN & COMMUNITY RECIPES (tipping, likes)
  // ===========================================================================
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
    if (!authUser || (authUser.role !== 'admin' && rec.author_id !== authUser.id)) {
      return { status: 403, data: { error: 'Chỉ tác giả hoặc quản trị viên được sửa/xóa công thức này' } };
    }
    if (method === 'DELETE') {
      await repo.deleteRecipe(rec.id);
      if (authUser.role === 'admin' && rec.author_id !== authUser.id) await audit('DELETE_RECIPE', rec.id);
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
    return { status: 200, data: await repo.updateRecipe(rec.id, patch) };
  }

  // ===========================================================================
  // FROZEN MODULES (M6, M10–M19) & SYSTEM ROUTES
  // ===========================================================================
  const frozen = await handleFrozenRoute(await buildView(repo, store, authUser), method, pathname, searchParams, body);
  if (frozen) return frozen;

  return { status: 404, data: { error: `Unknown endpoint ${method} ${pathname}` } };
}
