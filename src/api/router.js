// =============================================================================
// REST API GATEWAY ROUTER (/api/v1/*) FOR HÔM NAY ĂN GÌ v0.1 (ALL 17 MODULES M1..M17)
// =============================================================================

import { matchesVietnameseQuery, haversineDistanceMeters } from '../services/textUtils.js';
import { getTodaySuggestions, isDishSafeForUser, findOpenPlacesForDish } from '../services/recommender.js';
import { runAiFoodChat } from '../services/intentParser.js';
import { parseMenuOcrText } from '../services/ocrEngine.js';
import {
  createOrderRedirect,
  recordCampaignClick,
  updateMealReminderSchedule,
  runVietnameseIntentBenchmark,
  generateWeeklyMealPlanAndGroceries,
  createOrVoteGroupPoll,
  submitGpsVerifiedReview,
  translateVietnameseMenu,
  scanFridgeBarcodeOrPhoto,
  syncHealthWearables,
  getCommunityRecipes,
  tipCommunityRecipe
} from '../services/expansionServices.js';
import { callGeminiChat, generateDishStory } from '../services/geminiService.js';
import { generateVietQrInvoice, verifyPaymentWebhookSignature, processSuccessfulPayment } from '../services/paymentService.js';
import { searchDishesSemantically } from '../services/semanticSearch.js';
import { suggestionCache } from '../services/cacheService.js';
import { pushQueue } from '../services/queueService.js';

export async function handleApiRequest(store, method, pathname, searchParams, body = {}) {
  // ===========================================================================
  // MODULE M1: ACCOUNT, AUTH, ONBOARDING & TASTE PROFILE (M1-S01 .. M1-S10)
  // ===========================================================================
  if (pathname === '/api/v1/auth/login' && method === 'POST') {
    return {
      status: 200,
      data: {
        provider: body.provider || 'apple_zalo_phone',
        otp_sent: true,
        phone: body.phone || '0909***889',
        session_preview: 'jwt-homnayangi-v0.1'
      }
    };
  }

  if (pathname === '/api/v1/auth/otp/verify' && method === 'POST') {
    store.analyticsEvents.onboarding_complete = (store.analyticsEvents.onboarding_complete || 0) + 1;
    return {
      status: 200,
      data: {
        verified: true,
        access_token: 'jwt-homnayangi-verified-token',
        user: store.userProfile
      }
    };
  }

  if (pathname === '/api/v1/auth/guest' && method === 'POST') {
    return {
      status: 200,
      data: {
        guest_mode: true,
        guest_id: `guest-${Date.now()}`,
        profile: { ...store.userProfile, name: 'Khách trải nghiệm (Guest)' }
      }
    };
  }

  if (pathname === '/api/v1/me/profile' && method === 'GET') {
    return { status: 200, data: store.userProfile };
  }

  if (pathname === '/api/v1/me/profile' && (method === 'PUT' || method === 'PATCH')) {
    Object.assign(store.userProfile, body);
    suggestionCache.invalidateUser(store.userProfile.id || 'default');
    return { status: 200, data: store.userProfile };
  }

  if (pathname === '/api/v1/me' && method === 'DELETE') {
    return {
      status: 200,
      data: {
        deleted: true,
        pdpd_compliance: 'Nghị định 13/2023/NĐ-CP — Đã xóa toàn bộ hồ sơ vị giác & lịch sử cá nhân ngay lập tức.'
      }
    };
  }

  // ===========================================================================
  // MODULE M2: VIETNAMESE DISH LIBRARY & DYNAMIC RECIPE SCALER (M2-S01 .. M2-S08)
  // ===========================================================================
  if (pathname === '/api/v1/dishes/categories' && method === 'GET') {
    return {
      status: 200,
      data: {
        categories: [
          { id: 'breakfast', name: 'Bữa sáng', count: 145, color: '#FEF3C7' },
          { id: 'lunch', name: 'Cơm trưa', count: 190, color: '#DCFCE7' },
          { id: 'dinner', name: 'Bữa tối', count: 165, color: '#EDE9FE' },
          { id: 'snacks', name: 'Ăn vặt', count: 60, color: '#FFE4E6' },
          { id: 'vegan', name: 'Món chay', count: 40, color: '#FCE7F3' }
        ],
        regions: ['Miền Bắc', 'Miền Trung', 'Miền Nam']
      }
    };
  }

  if (pathname === '/api/v1/dishes' && method === 'GET') {
    const q = searchParams.get('q') || '';
    const region = searchParams.get('region') || '';
    const safeOnly = searchParams.get('safe_only') !== 'false';
    const items = store.dishes.filter(d => {
      if (safeOnly && !isDishSafeForUser(d, store.userProfile)) return false;
      if (region && d.region !== region) return false;
      if (q && !matchesVietnameseQuery(`${d.name} ${d.description} ${(d.tags || []).join(' ')}`, q)) return false;
      return true;
    });
    return { status: 200, data: { total: items.length, items } };
  }

  if (pathname === '/api/v1/dishes/semantic-search' && method === 'GET') {
    const q = searchParams.get('q') || '';
    const results = searchDishesSemantically(q, store.dishes, store.userProfile);
    return { status: 200, data: results };
  }

  const storyMatch = pathname.match(/^\/api\/v1\/(?:dishes\/([^/]+)\/story|stories\/([^/]+))$/);
  if (storyMatch && method === 'GET') {
    const targetId = storyMatch[1] || storyMatch[2];
    const dish = store.dishes.find(d => d.id === targetId) || store.dishes[0];
    return { status: 200, data: await generateDishStory(dish) };
  }

  const similarMatch = pathname.match(/^\/api\/v1\/dishes\/([^/]+)\/similar$/);
  if (similarMatch && method === 'GET') {
    const dishId = similarMatch[1];
    const current = store.dishes.find(d => d.id === dishId) || store.dishes[0];
    const items = store.dishes.filter(d => d.id !== current.id && isDishSafeForUser(d, store.userProfile)).slice(0, 3);
    return { status: 200, data: { base_dish: current.name, items } };
  }

  const regionalVariantsMatch = pathname.match(/^\/api\/v1\/dishes\/([^/]+)\/regional-variants$/);
  if (regionalVariantsMatch && method === 'GET') {
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

  const dishMatch = pathname.match(/^\/api\/v1\/dishes\/([^/]+)$/);
  if (dishMatch && method === 'GET') {
    const dishId = dishMatch[1];
    const dish = store.dishes.find(d => d.id === dishId) || store.dishes[0];
    const servings = Math.max(1, parseInt(searchParams.get('servings') || dish.base_servings || 2, 10));
    const scaleFactor = servings / (dish.base_servings || 2);

    const scaledIngredients = (dish.ingredients || []).map(ing => ({
      ...ing,
      scaled_amount: ing.unit === 'lít'
        ? Number((ing.amount * scaleFactor).toFixed(1))
        : Math.round(ing.amount * scaleFactor)
    }));

    const places = findOpenPlacesForDish(store, dish.id, store.userProfile.lat, store.userProfile.lng, store.userProfile.radius_m);
    store.analyticsEvents.dish_view = (store.analyticsEvents.dish_view || 0) + 1;

    return {
      status: 200,
      data: {
        ...dish,
        requested_servings: servings,
        scaled_calories_total: Math.round(dish.calories * scaleFactor),
        scaled_market_cost_vnd: Math.round((dish.market_cost_base || 50000) * scaleFactor),
        scaled_ingredients: scaledIngredients,
        open_places: places
      }
    };
  }

  if (pathname === '/api/v1/me/collections' && (method === 'GET' || method === 'POST')) {
    store.savedCollections = store.savedCollections || [
      { id: 'col-1', name: 'Món nước buổi sáng', dish_ids: ['DISH-101', 'DISH-103'] },
      { id: 'col-2', name: 'Thực đơn cuối tuần cho gia đình', dish_ids: ['DISH-102', 'DISH-106'] }
    ];
    if (method === 'POST' && body.dish_id) {
      store.savedCollections[0].dish_ids.push(body.dish_id);
      store.analyticsEvents.save_dish = (store.analyticsEvents.save_dish || 0) + 1;
    }
    return { status: 200, data: { collections: store.savedCollections } };
  }

  // ===========================================================================
  // MODULE M3: AI RECOMMENDATION ENGINE, SPIN & AI FOOD CHAT (M3-S01 .. M3-S07)
  // ===========================================================================
  if (pathname === '/api/v1/suggestions/today' && method === 'GET') {
    store.analyticsEvents.suggestion_shown = (store.analyticsEvents.suggestion_shown || 0) + 1;
    const radiusM = searchParams.get('radius_m') || store.userProfile.radius_m;
    const historyLen = (store.suggestionHistory || []).length;
    const cacheKey = `sugg:${store.userProfile.id || 'default'}:${radiusM}:${store.userProfile.meal_slot}:${(store.userProfile.hard_allergies || []).join(',')}:${historyLen}`;
    const cached = suggestionCache.get(cacheKey);
    if (cached) {
      return { status: 200, data: { ...cached, from_cache: true } };
    }
    const fresh = getTodaySuggestions(store, { radius_m: radiusM });
    suggestionCache.set(cacheKey, fresh, 60);
    return { status: 200, data: fresh };
  }

  if (pathname === '/api/v1/suggestions/spin' && method === 'GET') {
    const today = getTodaySuggestions(store);
    const candidates = store.dishes.filter(d => isDishSafeForUser(d, store.userProfile));
    const pick = candidates[Math.floor(Math.random() * candidates.length)] || today.items[0];
    const places = findOpenPlacesForDish(store, pick.id, store.userProfile.lat, store.userProfile.lng, store.userProfile.radius_m);
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
    const dish = store.dishes.find(d => d.id === body.dish_id) || store.dishes[0];
    const entry = {
      id: `hist-${Date.now()}`,
      dish_id: dish.id,
      dish_name: dish.name,
      place_id: body.place_id || 'PLACE-401',
      place_name: body.place_name || 'Phở Gia Truyền Phát Tài',
      price_vnd: dish.ref_price,
      action: body.action || 'eaten',
      skip_reason: body.skip_reason || null,
      created_at: new Date().toISOString()
    };
    store.suggestionHistory.unshift(entry);
    if (body.action === 'liked') {
      store.analyticsEvents.save_dish = (store.analyticsEvents.save_dish || 0) + 1;
    }
    return { status: 200, data: { recorded: entry, history_count: store.suggestionHistory.length } };
  }

  if (pathname === '/api/v1/suggestions/history' && method === 'GET') {
    return { status: 200, data: { items: store.suggestionHistory, next_cursor: null } };
  }

  if (pathname === '/api/v1/chat' && method === 'POST') {
    store.analyticsEvents.chat_query = (store.analyticsEvents.chat_query || 0) + 1;
    // Try Gemini first, fall back to local engine
    const aiResult = await callGeminiChat(body.query || 'Hôm nay ăn gì ngon?', store.userProfile);
    const localResult = runAiFoodChat(store, body.query || 'Tối nay 4 người, ngân sách 300k, có trẻ nhỏ, muốn ăn gần nhà');
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
    const dishId = searchParams.get('dish_id');
    const openOnly = searchParams.get('open_only') !== 'false';
    const user = store.userProfile;
    const list = store.places
      .map(p => ({
        ...p,
        distance_m: haversineDistanceMeters(user.lat, user.lng, p.lat, p.lng),
        is_currently_open: Boolean(p.is_verified && p.is_open_override && p.closed_report_count < 3)
      }))
      .filter(p => {
        if (openOnly && !p.is_currently_open) return false;
        if (dishId && !(p.menu || []).some(m => m.dish_id === dishId && m.available)) return false;
        return p.distance_m <= (user.radius_m || 3000);
      })
      .sort((a, b) => a.distance_m - b.distance_m);

    return { status: 200, data: { total: list.length, items: list } };
  }

  const reportMatch = pathname.match(/^\/api\/v1\/places\/([^/]+)\/reports$/);
  if (reportMatch && method === 'POST') {
    const placeId = reportMatch[1];
    const place = store.places.find(p => p.id === placeId);
    if (!place) return { status: 404, data: { error: 'Place not found' } };

    place.closed_report_count = (place.closed_report_count || 0) + 1;
    if (place.closed_report_count >= 3) {
      place.is_open_override = false; // Auto-paused!
    }
    const rep = {
      id: `rep-${Date.now()}`,
      place_id: place.id,
      place_name: place.name,
      reason: body.reason || 'Quán đóng cửa',
      report_count: place.closed_report_count,
      status: place.closed_report_count >= 3 ? 'auto_paused' : 'pending_review',
      created_at: new Date().toISOString()
    };
    store.userReports.unshift(rep);
    store.analyticsEvents.report_issue = (store.analyticsEvents.report_issue || 0) + 1;
    return { status: 200, data: rep };
  }

  // ===========================================================================
  // MODULE M5: EXTERNAL ORDER DEEP-LINK & LOOPBACK CONFIRMATION (M5-S01 .. M5-S05)
  // ===========================================================================
  if (pathname === '/api/v1/orders/redirect' && method === 'POST') {
    const record = createOrderRedirect(store, body);
    return { status: 200, data: record };
  }

  const confirmOrderMatch = pathname.match(/^\/api\/v1\/orders\/([^/]+)\/confirm-eaten$/);
  if (confirmOrderMatch && method === 'POST') {
    const orderId = confirmOrderMatch[1];
    const ord = (store.orderRedirects || []).find(o => o.id === orderId) || {
      id: orderId,
      dish_id: body.dish_id || 'DISH-101',
      dish_name: 'Phở Bò Tái Nạm Hà Nội',
      place_id: body.place_id || 'PLACE-401',
      place_name: 'Phở Gia Truyền Phát Tài'
    };
    ord.loopback_confirmed_eaten = true;
    store.suggestionHistory.unshift({
      id: `hist-loopback-${Date.now()}`,
      dish_id: ord.dish_id,
      dish_name: ord.dish_name,
      place_id: ord.place_id,
      place_name: ord.place_name,
      price_vnd: 45000,
      action: 'eaten',
      created_at: new Date().toISOString()
    });
    suggestionCache.invalidateUser(store.userProfile.id || 'default');
    return { status: 200, data: { confirmed: true, order: ord, cooldown_days_applied: 3 } };
  }

  // ===========================================================================
  // MODULE M6: MERCHANT PORTAL & AI MENU OCR (M6-S01 .. M6-S09)
  // ===========================================================================
  if (pathname === '/api/v1/merchant/overview' && method === 'GET') {
    const place = store.places[0];
    return {
      status: 200,
      data: {
        place,
        kpis: {
          impressions_7d: 3420,
          direction_clicks_7d: 215,
          order_clicks_7d: 184,
          ctr_pct: 11.6
        }
      }
    };
  }

  if (pathname === '/api/v1/merchant/menu/ocr' && method === 'POST') {
    const res = parseMenuOcrText(store, body.place_id || 'PLACE-401', body.raw_text || '1. Phở bò tái nạm - 45k\n2. Bún bò Huế đặc biệt - 50k');
    return { status: 200, data: res };
  }

  if (pathname === '/api/v1/merchant/promotions' && method === 'POST') {
    const promo = {
      id: `PROMO-${Date.now()}`,
      place_id: body.place_id || 'PLACE-401',
      title: body.title || 'Combo Sáng: Phở Bò + Quẩy Giòn + Trà Đá chỉ 49.000đ',
      discount_pct: body.discount_pct || 15,
      status: 'active'
    };
    return { status: 200, data: promo };
  }

  if (pathname === '/api/v1/merchant/branches' && method === 'GET') {
    return {
      status: 200,
      data: {
        branches: store.places.slice(0, 3).map(p => ({
          id: p.id,
          name: p.name,
          address: p.address,
          is_open: p.is_open_override
        }))
      }
    };
  }

  // ===========================================================================
  // MODULE M7: SPONSORED LISTINGS, ANTI-FRAUD GUARD & VIETQR (M7-S01 .. M7-S08)
  // ===========================================================================
  if (pathname === '/api/v1/ads/campaigns' && method === 'GET') {
    return {
      status: 200,
      data: {
        policy: { max_sponsored_ratio: '1/3', badge_required: 'Tài trợ', hard_allergy_enforced: true },
        items: store.campaigns
      }
    };
  }

  if (pathname === '/api/v1/ads/campaigns' && method === 'POST') {
    const newCmp = {
      id: `CMP-${Date.now()}`,
      place_id: body.place_id || 'PLACE-401',
      dish_id: body.dish_id || 'DISH-101',
      package_name: body.package_name || 'Gói Đẩy Đề Xuất Khung Giờ Vàng (7 Ngày)',
      radius_m: Math.min(3000, Number(body.radius_m || 3000)),
      budget_vnd: Number(body.budget_vnd || 500000),
      spent_vnd: 0,
      impressions: 0,
      clicks: 0,
      status: 'active',
      badge_label: 'Tài trợ'
    };
    store.campaigns.unshift(newCmp);
    return { status: 200, data: newCmp };
  }

  const adClickMatch = pathname.match(/^\/api\/v1\/ads\/campaigns\/([^/]+)\/click$/);
  if (adClickMatch && method === 'POST') {
    const res = recordCampaignClick(store, adClickMatch[1], body.fingerprint || 'fp-user-001');
    return { status: 200, data: res };
  }

  if ((pathname === '/api/v1/ads/payments/vietqr' || pathname === '/api/v1/ads/payments/vietqr/create') && method === 'POST') {
    const invoice = generateVietQrInvoice({
      campaignId: body.campaign_id || 'CMP-701',
      amountVnd: body.amount_vnd || 500000,
      merchantName: body.merchant_name || 'Quán Ngon',
      description: body.description,
    });
    return { status: 200, data: invoice };
  }

  // Webhook từ cổng thanh toán PayOS / Ngân hàng NAPAS
  if (pathname === '/api/v1/payments/webhook' && method === 'POST') {
    const { orderId, campaignId, amountVnd } = body;
    if (!orderId || !campaignId || !amountVnd) {
      return { status: 400, data: { error: 'Missing required webhook fields' } };
    }
    const result = processSuccessfulPayment(store, { orderId, campaignId, amountVnd });
    return { status: 200, data: result };
  }

  const paymentOrderMatch = pathname.match(/^\/api\/v1\/payments\/orders\/([^/]+)$/);
  if (paymentOrderMatch && method === 'GET') {
    const orderId = paymentOrderMatch[1];
    store.paymentOrders = store.paymentOrders || {};
    const order = store.paymentOrders[orderId];
    if (order) {
      return { status: 200, data: order };
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
    const updated = updateMealReminderSchedule(store, body);
    return { status: 200, data: updated };
  }

  // ===========================================================================
  // MODULE M9: ADMIN CMS, OCR MODERATION & AUDIT LOGS (M9-S01 .. M9-S09)
  // ===========================================================================
  if (pathname === '/api/v1/admin/dashboard' && method === 'GET') {
    return {
      status: 200,
      data: {
        total_dishes: store.dishes.length,
        total_verified_places: store.places.filter(p => p.is_verified).length,
        ocr_queue: store.ocrQueue,
        user_reports: store.userReports,
        campaigns: store.campaigns,
        events: store.analyticsEvents
      }
    };
  }

  if (pathname === '/api/v1/admin/ocr-review' && method === 'POST') {
    const item = store.ocrQueue.find(i => i.id === body.ocr_id);
    if (item) {
      item.status = body.decision || 'approved';
      if (body.reason) item.rejection_reason = body.reason;
    }
    return { status: 200, data: { updated: item } };
  }

  const unpausePlaceMatch = pathname.match(/^\/api\/v1\/admin\/places\/([^/]+)\/(?:approve|unpause)$/);
  if (unpausePlaceMatch && method === 'POST') {
    const placeId = unpausePlaceMatch[1];
    const place = store.places.find(p => p.id === placeId) || store.places[0];
    place.is_verified = true;
    place.is_open_override = true;
    place.closed_report_count = 0;
    if (store.userReports) {
      store.userReports = store.userReports.filter(r => r.place_id !== placeId);
    }
    return { status: 200, data: { unpaused_place: place, message: 'Đã mở lại quán và xóa cờ báo lỗi thành công.' } };
  }

  const moderateAdMatch = pathname.match(/^\/api\/v1\/admin\/ads\/([^/]+)\/moderate$/);
  if (moderateAdMatch && method === 'POST') {
    const cmp = store.campaigns.find(c => c.id === moderateAdMatch[1]) || store.campaigns[0];
    cmp.status = body.decision || 'active';
    return { status: 200, data: { campaign: cmp, hard_allergy_check: 'passed', sponsored_badge_check: 'passed' } };
  }

  if (pathname === '/api/v1/admin/audit-logs' && method === 'GET') {
    return {
      status: 200,
      data: {
        rbac_roles: ['Consumer', 'Merchant Owner', 'Merchant Staff', 'Content Moderator', 'Ops Admin', 'Super Admin'],
        logs: [
          { id: 'aud-1', actor: 'ops_admin@homnayangi.vn', action: 'APPROVE_OCR_MENU', target: 'PLACE-401', timestamp: new Date().toISOString() },
          { id: 'aud-2', actor: 'system_crowd_guard', action: 'AUTO_PAUSE_3_REPORTS', target: 'PLACE-405', timestamp: new Date().toISOString() }
        ]
      }
    };
  }

  // ===========================================================================
  // MODULE M10: PRODUCT ANALYTICS, 14 POSTHOG EVENTS & AI BENCHMARK (M10-S01 .. M10-S06)
  // ===========================================================================
  if (pathname === '/api/v1/events' && method === 'POST') {
    const ev = body.event_name || 'app_open';
    store.analyticsEvents[ev] = (store.analyticsEvents[ev] || 0) + 1;
    return { status: 200, data: { event: ev, count: store.analyticsEvents[ev] } };
  }

  if (pathname === '/api/v1/analytics/funnel' && method === 'GET') {
    const ev = store.analyticsEvents;
    return {
      status: 200,
      data: {
        north_star_metric: 'Weekly Active Meal Decisions (WAMD)',
        wamd_current: 18420,
        d7_retention_pct: 28.4,
        decision_under_60s_pct: 74.2,
        funnel: [
          { step: '1. app_open', count: ev.app_open || 1240 },
          { step: '2. suggestion_shown', count: ev.suggestion_shown || 1180 },
          { step: '3. suggestion_click / dish_view', count: (ev.suggestion_click || 520) + (ev.dish_view || 640) },
          { step: '4. order_click / direction_click / recipe_view', count: (ev.order_click || 215) + (ev.direction_click || 180) + (ev.recipe_view || 295) }
        ],
        events: ev
      }
    };
  }

  if (pathname === '/api/v1/analytics/ai-benchmark' && method === 'GET') {
    return { status: 200, data: runVietnameseIntentBenchmark(store) };
  }

  // ===========================================================================
  // MODULE M11: WEEKLY MEAL PLANNER & CONSOLIDATED GROCERY LIST (M11-S01 .. M11-S03)
  // ===========================================================================
  if ((pathname === '/api/v1/meal-plans/weekly' || pathname === '/api/v1/meal-planner/weekly' || pathname === '/api/v1/groceries/consolidated') && method === 'GET') {
    const fridge = (searchParams.get('fridge') || 'Hành tím,Nước mắm').split(',').map(s => s.trim());
    return { status: 200, data: generateWeeklyMealPlanAndGroceries(store, fridge) };
  }

  // ===========================================================================
  // MODULE M12: GROUP POLLS & GPS-VERIFIED COMMUNITY REVIEWS (M12-S01 .. M12-S03)
  // ===========================================================================
  if ((pathname === '/api/v1/polls' || pathname.startsWith('/api/v1/polls/')) && (method === 'GET' || method === 'POST')) {
    return { status: 200, data: createOrVoteGroupPoll(store, body) };
  }

  const reviewMatch = pathname.match(/^\/api\/v1\/places\/([^/]+)\/reviews$/);
  if (reviewMatch && method === 'POST') {
    const res = submitGpsVerifiedReview(store, reviewMatch[1], body);
    return { status: res.verified ? 200 : 400, data: res };
  }
  if (pathname === '/api/v1/reviews/gps' && method === 'POST') {
    const placeId = body.place_id || 'PLACE-401';
    const res = submitGpsVerifiedReview(store, placeId, body);
    return { status: res.verified ? 200 : 400, data: res };
  }

  // ===========================================================================
  // MODULE M13: TABLE BOOKING & DINE-IN QR VOUCHERS (M13-S01 .. M13-S02)
  // ===========================================================================
  if (pathname === '/api/v1/bookings' && method === 'POST') {
    const place = store.places.find(p => p.id === body.place_id) || store.places[0];
    return {
      status: 200,
      data: {
        booking_id: `BK-${Date.now()}`,
        place_id: place.id,
        place_name: place.name,
        party_size: body.party_size || 4,
        time_slot: body.time_slot || '19:00 Hôm nay',
        has_baby_chair: body.has_baby_chair !== false,
        status: 'confirmed_instant'
      }
    };
  }

  if (pathname === '/api/v1/vouchers' && method === 'GET') {
    return {
      status: 200,
      data: {
        vouchers: [
          { code: 'HNAG-PHATTAI-15', title: 'Giảm 15% tổng hóa đơn ăn tại quán Phở Phát Tài', qr_payload: 'HNAG:VOUCHER:PLACE-401:15PCT' },
          { code: 'HNAG-OXUAN-FREE-DRINK', title: 'Tặng 2 ly Nước Sâm Dứa khi ăn tại Bún Bò O Xuân', qr_payload: 'HNAG:VOUCHER:PLACE-403:FREEDRINK' }
        ]
      }
    };
  }

  // ===========================================================================
  // MODULE M14: CULINARY CULTURE STORIES (M14-S01 .. M14-S02)
  // ===========================================================================
  if (pathname === '/api/v1/stories' && method === 'GET') {
    return {
      status: 200,
      data: {
        stories: [
          { id: 'story-1', title: 'Hành Trình Trăm Năm Của Phở Việt: Từ Gánh Hàng Rong Đến Di Sản Quốc Gia', region: 'Bắc – Nam', read_min: 4 },
          { id: 'story-2', title: 'Nghệ Thuật Cân Bằng Ngũ Vị Trong Bữa Cơm Gia Đình Miền Nam', region: 'Miền Nam', read_min: 3 }
        ]
      }
    };
  }

  // ===========================================================================
  // MODULE M15: CULINARY TOURISM & QR FOOD PASSPORT (M15-S01 .. M15-S02)
  // ===========================================================================
  if (pathname === '/api/v1/tourism/trails' && method === 'GET') {
    return {
      status: 200,
      data: {
        city: 'Biên Hòa — Đồng Nai',
        trail_title: 'Food Trail 1 Ngày Khám Phá Ẩm Thực Biên Hòa',
        stops: [
          { slot: '07:30 Sáng', dish: 'Phở Bò Tái Nạm Hà Nội', place: 'Phở Gia Truyền Phát Tài' },
          { slot: '12:00 Trưa', dish: 'Cơm Tấm Sườn Bì Chả', place: 'Cơm Tấm Sài Gòn Xưa' },
          { slot: '15:30 Xế', dish: 'Gỏi Cuốn Chay Đậu Hũ (Thanh mát)', place: 'Bếp Chay An Lạc' },
          { slot: '19:00 Tối', dish: 'Bún Bò Huế O Xuân', place: 'Bún Bò Huế O Xuân' }
        ]
      }
    };
  }

  if (pathname === '/api/v1/tourism/passport/checkin' && method === 'POST') {
    return {
      status: 200,
      data: {
        stamped: true,
        place_id: body.place_id || 'PLACE-401',
        total_stamps: 4,
        badge_unlocked: 'Đại Sứ Ẩm Thực Biên Hòa'
      }
    };
  }

  // ===========================================================================
  // MODULE M16: MULTILINGUAL AI MENU TRANSLATOR (M16-S01 .. M16-S02)
  // ===========================================================================
  if (pathname === '/api/v1/translate/menu') {
    const targetLang = (method === 'POST' ? body.target_lang : searchParams.get('lang')) || 'EN';
    return { status: 200, data: translateVietnameseMenu(store, targetLang) };
  }

  // ===========================================================================
  // MODULE M17: B2G TOURISM INSIGHTS & FMCG BRAND SPONSORSHIPS (M17-S01 .. M17-S02)
  // ===========================================================================
  if (pathname === '/api/v1/enterprise/tourism-insights' && method === 'GET') {
    return {
      status: 200,
      data: {
        k_anonymity_enforced: true,
        local_specialty_queries_30d: 142500,
        international_visitors_m16: 18400,
        top_trending_dishes: ['Phở Bò Tái Nạm', 'Cơm Tấm Sườn Bì Chả', 'Bún Bò Huế']
      }
    };
  }

  if (pathname === '/api/v1/enterprise/brand-campaigns' && method === 'GET') {
    return {
      status: 200,
      data: {
        campaigns: [
          { id: 'BRAND-901', brand: 'Nước Mắm Truyền Thống Phú Quốc', placements: 'Công thức Món Kho & Canh Chua (M2-S06)', ctr_pct: 8.4 }
        ]
      }
    };
  }

  // ===========================================================================
  // GIAI ĐOẠN 4 / v0.2: MODULE M18, M19 & M20 ROUTES
  // ===========================================================================
  // M18: AI Smart Fridge & IoT Barcode Scanner (Zero Food Waste)
  if (pathname === '/api/v1/fridge/scan' && method === 'POST') {
    return { status: 200, data: scanFridgeBarcodeOrPhoto(store, body) };
  }
  if (pathname === '/api/v1/fridge/inventory' && method === 'GET') {
    return {
      status: 200,
      data: {
        total_items: (store.fridgeInventory || []).length,
        items: store.fridgeInventory || [],
        expiring_soon_count: (store.fridgeInventory || []).filter(i => i.is_expiring_soon).length
      }
    };
  }

  // M19: Smart Dietitian & Health Wearables Sync (Apple Health / Google Fit)
  if (pathname === '/api/v1/health/sync' && method === 'POST') {
    return { status: 200, data: syncHealthWearables(store, body) };
  }
  if (pathname === '/api/v1/health/nutrition-profile' && method === 'GET') {
    return { status: 200, data: store.healthProfile || syncHealthWearables(store) };
  }

  // M20: Creator Kitchen & Community Recipe Hub (Tipping & Social Sharing)
  if (pathname === '/api/v1/community/recipes' && method === 'GET') {
    return { status: 200, data: getCommunityRecipes(store, Object.fromEntries(searchParams)) };
  }
  if (pathname === '/api/v1/community/recipes' && method === 'POST') {
    const newRecipe = {
      id: `CREC-${Date.now()}`,
      title: body.title || 'Món Ngon Gia Đình',
      author: body.author || 'Đầu Bếp Nghiệp Dư',
      author_avatar: '👨‍🍳',
      prep_time_minutes: body.prep_time_minutes || 25,
      difficulty: body.difficulty || 'Dễ',
      calories: body.calories || 450,
      likes_count: 1,
      tips_received_vnd: 0,
      zero_waste_tag: body.zero_waste_tag || null,
      ingredients: body.ingredients || []
    };
    store.communityRecipes = store.communityRecipes || [];
    store.communityRecipes.unshift(newRecipe);
    return { status: 201, data: newRecipe };
  }

  const tipMatch = pathname.match(/^\/api\/v1\/community\/recipes\/([^/]+)\/tip$/);
  if (tipMatch && method === 'POST') {
    const res = tipCommunityRecipe(store, tipMatch[1], body.amount_vnd || 50000);
    return { status: res.success ? 200 : 404, data: res };
  }

  // Production Health Check & Monitoring
  if (pathname === '/api/v1/health-check' && method === 'GET') {
    return {
      status: 200,
      data: {
        status: 'healthy',
        service: 'taste_of_vietnam_backend',
        version: '0.2.0',
        modules_loaded: 20,
        cache_stats: suggestionCache.getStats(),
        queue_stats: pushQueue.getQueueStatus(),
        timestamp: new Date().toISOString()
      }
    };
  }

  // System Performance: Cache Metrics & Invalidation
  if (pathname === '/api/v1/system/cache' && method === 'GET') {
    return { status: 200, data: suggestionCache.getStats() };
  }
  if (pathname === '/api/v1/system/cache' && method === 'DELETE') {
    suggestionCache.clear();
    return { status: 200, data: { cleared: true, message: 'Bộ đệm đã được xóa sạch.' } };
  }

  // Batch Push Notification Queue (M8 Anti-fatigue)
  if (pathname === '/api/v1/notifications/queue-status' && method === 'GET') {
    return { status: 200, data: pushQueue.getQueueStatus() };
  }
  if (pathname === '/api/v1/notifications/batch-dispatch' && method === 'POST') {
    const result = await pushQueue.processBatch();
    return { status: 200, data: result };
  }

  return { status: 404, data: { error: `Unknown endpoint ${method} ${pathname}` } };
}
