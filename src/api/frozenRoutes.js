// =============================================================================
// FROZEN & SYSTEM ROUTES — modules outside the launch scope (M6 merchant portal,
// M10 analytics, M11–M19) plus cache/queue/vision utilities.
// Moved out of router.js unchanged in P1. They still work on the in-memory store
// shape: in Postgres mode they receive a per-request view whose dishes / places /
// campaigns / profile come from the database, but anything they write lives only
// in process memory (lost on restart) until each module is un-frozen and given
// its own tables. Returns null when no route matches.
// =============================================================================

import { parseMenuOcrText } from '../services/ocrEngine.js';
import {
  runVietnameseIntentBenchmark,
  generateWeeklyMealPlanAndGroceries,
  createOrVoteGroupPoll,
  submitGpsVerifiedReview,
  translateVietnameseMenu,
  scanFridgeBarcodeOrPhoto,
  syncHealthWearables
} from '../services/expansionServices.js';
import { analyzeFoodImageWithGemini } from '../services/geminiService.js';
import { suggestionCache } from '../services/cacheService.js';
import { pushQueue } from '../services/queueService.js';

export async function handleFrozenRoute(store, method, pathname, searchParams, body = {}) {
  // ===========================================================================
  // MODULE M6: MERCHANT PORTAL & AI MENU OCR (M6-S01 .. M6-S09)
  // ===========================================================================
  // M6-S07: Món đặc biệt hôm nay (Daily Special Tagging)
  if (pathname === '/api/v1/merchant/daily-special' && method === 'GET') {
    return {
      status: 200,
      data: {
        daily_special: store.dishes.filter(d => d.is_special_today || false).slice(0, 3),
        message: 'Danh sách món đặc biệt hôm nay'
      }
    };
  }

  if (pathname === '/api/v1/merchant/daily-special' && method === 'POST') {
    const dish = store.dishes.find(d => d.id === body.dish_id);
    if (dish) {
      dish.is_special_today = true;
      dish.special_price = body.special_price || dish.price;
      dish.special_label = body.label || 'Món đặc biệt hôm nay';
    }
    return { status: 200, data: { tagged: true, dish_id: body.dish_id, label: body.label || 'Món đặc biệt hôm nay' } };
  }

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

  // M6-S04: Quản lý Thực đơn thủ công (GET / POST / PUT / DELETE)
  if (pathname === '/api/v1/merchant/menu' && method === 'GET') {
    store.merchantMenu = store.merchantMenu || [
      { id: 'MENU-01', name: 'Phở Bò Tái Nạm', price_vnd: 55000, available: true, category: 'Món nước' },
      { id: 'MENU-02', name: 'Phở Gà Ta Lá Chanh', price_vnd: 50000, available: true, category: 'Món nước' },
      { id: 'MENU-03', name: 'Quẩy Giòn', price_vnd: 10000, available: true, category: 'Món thêm' }
    ];
    return { status: 200, data: { items: store.merchantMenu } };
  }

  if (pathname === '/api/v1/merchant/menu' && method === 'POST') {
    store.merchantMenu = store.merchantMenu || [];
    const newItem = {
      id: `MENU-${Date.now()}`,
      name: body.name || 'Món mới',
      price_vnd: Number(body.price_vnd || 45000),
      available: body.available !== false,
      category: body.category || 'Món chính'
    };
    store.merchantMenu.unshift(newItem);
    return { status: 201, data: newItem };
  }

  const merchantMenuItemMatch = pathname.match(/^\/api\/v1\/merchant\/menu\/([^/]+)$/);
  if (merchantMenuItemMatch && (method === 'PUT' || method === 'PATCH')) {
    store.merchantMenu = store.merchantMenu || [];
    const item = store.merchantMenu.find(i => i.id === merchantMenuItemMatch[1]);
    if (!item) return { status: 404, data: { error: 'Menu item not found' } };
    if (body.name !== undefined) item.name = body.name;
    if (body.price_vnd !== undefined) item.price_vnd = Number(body.price_vnd);
    if (body.available !== undefined) item.available = Boolean(body.available);
    if (body.category !== undefined) item.category = body.category;
    return { status: 200, data: item };
  }

  if (merchantMenuItemMatch && method === 'DELETE') {
    store.merchantMenu = (store.merchantMenu || []).filter(i => i.id !== merchantMenuItemMatch[1]);
    return { status: 200, data: { deleted: true, id: merchantMenuItemMatch[1] } };
  }

  if (pathname === '/api/v1/merchant/menu/ocr' && method === 'POST') {
    const res = parseMenuOcrText(store, body.place_id || 'PLACE-401', body.raw_text || '1. Phở bò tái nạm - 45k\n2. Bún bò Huế đặc biệt - 50k');
    return { status: 200, data: res };
  }

  if (pathname === '/api/v1/merchant/promotions' && method === 'GET') {
    store.merchantPromotions = store.merchantPromotions || [
      { id: 'PROMO-101', place_id: 'PLACE-401', title: 'Combo Sáng: Phở Bò + Quẩy + Trà Đá', discount_pct: 15, status: 'active' }
    ];
    return { status: 200, data: { promotions: store.merchantPromotions } };
  }

  if (pathname === '/api/v1/merchant/promotions' && method === 'POST') {
    store.merchantPromotions = store.merchantPromotions || [];
    const promo = {
      id: `PROMO-${Date.now()}`,
      place_id: body.place_id || 'PLACE-401',
      title: body.title || 'Combo Sáng: Phở Bò + Quẩy Giòn + Trà Đá chỉ 49.000đ',
      discount_pct: Number(body.discount_pct || 15),
      status: 'active'
    };
    store.merchantPromotions.unshift(promo);
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
    const familySize = Number(searchParams.get('family_size') || 2);
    const mealsPerDay = Number(searchParams.get('meals_per_day') || 3);
    if (store.customMealPlan && !searchParams.get('family_size') && !searchParams.get('meals_per_day')) {
      return { status: 200, data: store.customMealPlan };
    }
    return {
      status: 200,
      data: generateWeeklyMealPlanAndGroceries(store, fridge, { family_size: familySize, meals_per_day: mealsPerDay })
    };
  }

  if (pathname === '/api/v1/meal-plans/weekly' && (method === 'PUT' || method === 'POST')) {
    store.customMealPlan = {
      ...(store.customMealPlan || generateWeeklyMealPlanAndGroceries(store)),
      days: body.days || (store.customMealPlan ? store.customMealPlan.days : []),
      updated_at: new Date().toISOString()
    };
    return { status: 200, data: store.customMealPlan };
  }

  if (pathname === '/api/v1/groceries/items' && method === 'POST') {
    store.customGroceries = store.customGroceries || [];
    const item = { id: `GROC-${Date.now()}`, name: body.name || 'Nguyên liệu mới', amount: body.amount || '1 gói', bought: false };
    store.customGroceries.unshift(item);
    return { status: 201, data: item };
  }

  const grocMatch = pathname.match(/^\/api\/v1\/groceries\/items\/([^/]+)$/);
  if (grocMatch && method === 'PATCH') {
    store.customGroceries = store.customGroceries || [];
    const item = store.customGroceries.find(g => g.id === grocMatch[1]);
    if (item && body.bought !== undefined) item.bought = Boolean(body.bought);
    return { status: 200, data: item || { id: grocMatch[1], bought: Boolean(body.bought) } };
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
  if (pathname === '/api/v1/bookings' && method === 'GET') {
    store.bookings = store.bookings || [];
    return { status: 200, data: { bookings: store.bookings } };
  }

  if (pathname === '/api/v1/bookings' && method === 'POST') {
    store.bookings = store.bookings || [];
    const place = store.places.find(p => p.id === body.place_id) || store.places[0];
    const booking = {
      booking_id: `BK-${Date.now()}`,
      place_id: place.id,
      place_name: place.name,
      party_size: body.party_size || 4,
      time_slot: body.time_slot || '19:00 Hôm nay',
      has_baby_chair: body.has_baby_chair !== false,
      note: body.note || '',
      status: 'confirmed_instant'
    };
    store.bookings.unshift(booking);
    return { status: 200, data: booking };
  }

  const bookingMatch = pathname.match(/^\/api\/v1\/bookings\/([^/]+)$/);
  if (bookingMatch && (method === 'PATCH' || method === 'PUT')) {
    store.bookings = store.bookings || [];
    const bk = store.bookings.find(b => b.booking_id === bookingMatch[1]);
    if (!bk) return { status: 404, data: { error: 'Booking not found' } };
    if (body.party_size !== undefined) bk.party_size = Number(body.party_size);
    if (body.time_slot !== undefined) bk.time_slot = body.time_slot;
    if (body.status !== undefined) bk.status = body.status;
    return { status: 200, data: bk };
  }

  if (bookingMatch && method === 'DELETE') {
    store.bookings = store.bookings || [];
    const bk = store.bookings.find(b => b.booking_id === bookingMatch[1]);
    if (bk) bk.status = 'cancelled';
    return { status: 200, data: { cancelled: true, booking_id: bookingMatch[1] } };
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

  if (pathname === '/api/v1/fridge/inventory' && method === 'POST') {
    store.fridgeInventory = store.fridgeInventory || [];
    const days = Number(body.expires_in_days ?? 3);
    const newItem = {
      id: `FRIDGE-${Date.now()}`,
      name: body.name || 'Nguyên liệu mới',
      quantity: body.quantity || '1 phần',
      compartment: body.compartment || 'chill',
      expires_in_days: days,
      is_expiring_soon: days <= 2,
      category: body.category || 'Tươi sống'
    };
    store.fridgeInventory.unshift(newItem);
    return { status: 201, data: newItem };
  }

  const fridgeItemMatch = pathname.match(/^\/api\/v1\/fridge\/inventory\/([^/]+)$/);
  if (fridgeItemMatch && (method === 'PUT' || method === 'PATCH')) {
    store.fridgeInventory = store.fridgeInventory || [];
    const item = store.fridgeInventory.find(i => i.id === fridgeItemMatch[1]);
    if (!item) return { status: 404, data: { error: 'Fridge item not found' } };
    if (body.name !== undefined) item.name = body.name;
    if (body.quantity !== undefined) item.quantity = body.quantity;
    if (body.compartment !== undefined) item.compartment = body.compartment;
    if (body.expires_in_days !== undefined) {
      item.expires_in_days = Number(body.expires_in_days);
      item.is_expiring_soon = item.expires_in_days <= 2;
    }
    return { status: 200, data: item };
  }

  if (fridgeItemMatch && method === 'DELETE') {
    store.fridgeInventory = (store.fridgeInventory || []).filter(i => i.id !== fridgeItemMatch[1]);
    return { status: 200, data: { deleted: true, id: fridgeItemMatch[1] } };
  }

  // M19: Smart Dietitian & Health Wearables Sync (Apple Health / Google Fit)
  if (pathname === '/api/v1/health/sync' && method === 'POST') {
    return { status: 200, data: syncHealthWearables(store, body) };
  }
  if (pathname === '/api/v1/health/nutrition-profile' && method === 'GET') {
    return { status: 200, data: store.healthProfile || syncHealthWearables(store) };
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

  // Gemini 2.0 Multimodal Vision (M18 Fridge Scanner & M6 Menu OCR)
  if (pathname === '/api/v1/vision/analyze' && method === 'POST') {
    const context = body.context || 'fridge';
    const result = await analyzeFoodImageWithGemini(body.image_base64 || '', body.mime_type || 'image/jpeg', context);
    return { status: 200, data: result };
  }

  return null;
}
