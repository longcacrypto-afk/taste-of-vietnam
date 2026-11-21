// =============================================================================
// AUTOMATED QA & ACCEPTANCE CRITERIA TEST SUITE (QA-01..QA-11 & ALL 17 MODULES M1..M17)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';

test('M1 (Auth & PDPD Compliance): OTP verify, Guest Mode, and Instant Account Deletion (Nghị định 13/2023/NĐ-CP)', async () => {
  const store = createInitialStore();
  const otpRes = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/verify', new URLSearchParams(), { code: '123456' });
  assert.equal(otpRes.status, 200);
  assert.equal(otpRes.data.verified, true);

  const guestRes = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', new URLSearchParams());
  assert.equal(guestRes.status, 200);
  assert.equal(guestRes.data.guest_mode, true);

  const delRes = await handleApiRequest(store, 'DELETE', '/api/v1/me', new URLSearchParams());
  assert.equal(delRes.status, 200);
  assert.equal(delRes.data.deleted, true);
});

test('QA-05 & M3-S01: GET /api/v1/suggestions/today returns 3 items under p95 < 1500ms', async () => {
  const store = createInitialStore();
  const res = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  assert.equal(res.status, 200);
  assert.equal(res.data.items.length, 3);
  assert.ok(res.data.latency_ms < 1500, `Expected latency < 1500ms, got ${res.data.latency_ms}ms`);
});

test('QA-10 & QA-11: Hard Allergy Filter blocks allergens in BOTH natural and Sponsored slots, and Sponsored <= 1/3', async () => {
  const store = createInitialStore();
  // User is allergic to shrimp and peanut
  const res = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  for (const item of res.data.items) {
    assert.ok(!item.allergen_tags.includes('shrimp'), `Dish ${item.name} violated shrimp allergy filter`);
    assert.ok(!item.allergen_tags.includes('peanut'), `Dish ${item.name} violated peanut allergy filter`);
  }
  const sponsoredCount = res.data.items.filter(i => i.is_sponsored).length;
  assert.ok(sponsoredCount <= 1, `Expected at most 1/3 sponsored slots, got ${sponsoredCount}`);
  if (sponsoredCount === 1) {
    const sp = res.data.items.find(i => i.is_sponsored);
    assert.equal(sp.badge_label, 'Tài trợ');
  }
});

test('M3-S06 & M3-S07: 3-Day Non-Repeat Cooldown excludes recently eaten dish', async () => {
  const store = createInitialStore();
  await handleApiRequest(store, 'POST', '/api/v1/suggestions/feedback', new URLSearchParams(), {
    dish_id: 'DISH-101',
    action: 'eaten'
  });

  const res = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  const ids = res.data.items.map(i => i.dish_id);
  assert.ok(!ids.includes('DISH-101'), 'Recently eaten DISH-101 must not repeat within 3 days');
});

test('QA-04 & M2-S02: Unaccented Vietnamese Search matches accented dishes ("bun bo hue", "com tam")', async () => {
  const store = createInitialStore();
  const res1 = await handleApiRequest(store, 'GET', '/api/v1/dishes', new URLSearchParams({ q: 'bun bo hue' }));
  assert.equal(res1.status, 200);
  assert.ok(res1.data.items.some(d => d.id === 'DISH-103'));

  const res2 = await handleApiRequest(store, 'GET', '/api/v1/dishes', new URLSearchParams({ q: 'com tam suon' }));
  assert.ok(res2.data.items.some(d => d.id === 'DISH-102'));
});

test('M2-S06: Recipe Dynamic Portion Scaler scales ingredient grams and calories accurately', async () => {
  const store = createInitialStore();
  const res = await handleApiRequest(store, 'GET', '/api/v1/dishes/DISH-101', new URLSearchParams({ servings: '6' }));
  assert.equal(res.status, 200);
  assert.equal(res.data.requested_servings, 6);
  const banhPho = res.data.scaled_ingredients.find(i => i.name.includes('Bánh phở'));
  assert.equal(banhPho.scaled_amount, 1050);
  assert.equal(res.data.scaled_calories_total, 480 * 3);
});

test('M3-S04 & M3-S05: Vietnamese Natural Language Chat extracts party size, budget, kids & returns verified options', async () => {
  const store = createInitialStore();
  const res = await handleApiRequest(store, 'POST', '/api/v1/chat', new URLSearchParams(), {
    query: 'Tối nay 4 người, ngân sách 300k, có trẻ nhỏ, muốn ăn gần nhà'
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.intent.party_size, 4);
  assert.equal(res.data.intent.total_budget_vnd, 300000);
  assert.equal(res.data.intent.has_kids, true);
  assert.equal(res.data.intent.spice_max, 0);
  assert.ok(res.data.options.length > 0);
});

test('QA-09, M4-S06 & M9-S06: Closed places are excluded and 3 user reports auto-pause a restaurant', async () => {
  const store = createInitialStore();
  const openRes = await handleApiRequest(store, 'GET', '/api/v1/places', new URLSearchParams({ open_only: 'true' }));
  assert.ok(!openRes.data.items.some(p => p.id === 'PLACE-405'));

  await handleApiRequest(store, 'POST', '/api/v1/places/PLACE-404/reports', new URLSearchParams(), { reason: 'Đóng cửa' });
  await handleApiRequest(store, 'POST', '/api/v1/places/PLACE-404/reports', new URLSearchParams(), { reason: 'Đóng cửa' });
  const third = await handleApiRequest(store, 'POST', '/api/v1/places/PLACE-404/reports', new URLSearchParams(), { reason: 'Đóng cửa' });
  assert.equal(third.data.status, 'auto_paused');
});

test('M5-S01 & M5-S05: Order Deep-Link Redirect logs UTM tracking & Loopback Confirmation updates 3-day cooldown', async () => {
  const store = createInitialStore();
  const redir = await handleApiRequest(store, 'POST', '/api/v1/orders/redirect', new URLSearchParams(), {
    place_id: 'PLACE-401',
    dish_id: 'DISH-101',
    partner: 'grabfood'
  });
  assert.equal(redir.status, 200);
  assert.ok(redir.data.target_deeplink.includes('utm_source=hom_nay_an_gi'));

  const conf = await handleApiRequest(store, 'POST', `/api/v1/orders/${redir.data.id}/confirm-eaten`, new URLSearchParams());
  assert.equal(conf.status, 200);
  assert.equal(conf.data.confirmed, true);
  assert.equal(conf.data.cooldown_days_applied, 3);
});

test('M6-S06 & M9-S05: AI Menu OCR parses Vietnamese menu lines, normalizes VND prices & matches M2 Dish Library', async () => {
  const store = createInitialStore();
  const res = await handleApiRequest(store, 'POST', '/api/v1/merchant/menu/ocr', new URLSearchParams(), {
    place_id: 'PLACE-401',
    raw_text: '1. Phở Bò Tái Nạm Hà Nội - 45k\n2. Cơm Tấm Sườn Bì Chả 40.000đ'
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.total_extracted, 2);
  assert.equal(res.data.items[0].extracted_price, 45000);
  assert.equal(res.data.items[0].matched_dish_id, 'DISH-101');
  assert.equal(res.data.items[1].extracted_price, 40000);
  assert.equal(res.data.items[1].matched_dish_id, 'DISH-102');
});

test('M7-S05: Anti-Fraud Sponsored Click Guard deduplicates repeated clicks within 60 seconds', async () => {
  const store = createInitialStore();
  const firstClick = await handleApiRequest(store, 'POST', '/api/v1/ads/campaigns/CMP-701/click', new URLSearchParams(), {
    fingerprint: 'device-test-99'
  });
  assert.equal(firstClick.status, 200);
  assert.equal(firstClick.data.charged, true);
  assert.equal(firstClick.data.fraud_filtered, false);

  const duplicateClick = await handleApiRequest(store, 'POST', '/api/v1/ads/campaigns/CMP-701/click', new URLSearchParams(), {
    fingerprint: 'device-test-99'
  });
  assert.equal(duplicateClick.status, 200);
  assert.equal(duplicateClick.data.charged, false);
  assert.equal(duplicateClick.data.fraud_filtered, true);
});

test('M8-S01: Smart Meal Reminder Scheduler strictly enforces <= 2 push notifications per day', async () => {
  const store = createInitialStore();
  const res = await handleApiRequest(store, 'PUT', '/api/v1/me/meal-schedule', new URLSearchParams(), {
    lunch: '10:30',
    dinner: '17:00',
    max_per_day: 9 // Requesting 9 -> must be capped at 2!
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.max_per_day, 2);
});

test('M10-S04: Vietnamese Natural Language Intent Benchmark achieves >= 90% accuracy SLA', async () => {
  const store = createInitialStore();
  const res = await handleApiRequest(store, 'GET', '/api/v1/analytics/ai-benchmark', new URLSearchParams());
  assert.equal(res.status, 200);
  assert.ok(res.data.accuracy_pct >= 90.0);
  assert.equal(res.data.passed_sla, true);
});

test('M11-S01 & M11-S02: 7-Day Meal Plan & Consolidated Grocery Merger deducts existing fridge ingredients', async () => {
  const store = createInitialStore();
  const res = await handleApiRequest(store, 'GET', '/api/v1/meal-plans/weekly', new URLSearchParams({ fridge: 'Hành tím,Bánh phở' }));
  assert.equal(res.status, 200);
  assert.equal(res.data.days.length, 7);
  const banhPhoItem = res.data.consolidated_groceries.find(g => g.name.includes('Bánh phở'));
  assert.equal(banhPhoItem.in_fridge, true);
});

test('M12-S03: GPS-Verified Review accepts reviews <= 500m and rejects reviews > 500m away', async () => {
  const store = createInitialStore();
  // PLACE-401 is at (10.9582, 106.8431). Nearby review (within 50m):
  const validRes = await handleApiRequest(store, 'POST', '/api/v1/places/PLACE-401/reviews', new URLSearchParams(), {
    lat: 10.9583,
    lng: 106.8432,
    rating: 5,
    comment: 'Phở bò rất ngon!'
  });
  assert.equal(validRes.status, 200);
  assert.equal(validRes.data.verified, true);

  // Far review (~5km away):
  const farRes = await handleApiRequest(store, 'POST', '/api/v1/places/PLACE-401/reviews', new URLSearchParams(), {
    lat: 11.005,
    lng: 106.890,
    rating: 1
  });
  assert.equal(farRes.status, 400);
  assert.equal(farRes.data.verified, false);
});

test('M13, M14, M15, M16 & M17: Expansion modules (Bookings, Cultural Stories, Food Trail, Multilingual Menu AI & B2G Insights)', async () => {
  const store = createInitialStore();
  // M13 Booking
  const bk = await handleApiRequest(store, 'POST', '/api/v1/bookings', new URLSearchParams(), { place_id: 'PLACE-401', party_size: 4 });
  assert.equal(bk.status, 200);
  assert.equal(bk.data.status, 'confirmed_instant');

  // M15 Food Trail
  const trail = await handleApiRequest(store, 'GET', '/api/v1/tourism/trails', new URLSearchParams());
  assert.equal(trail.status, 200);
  assert.equal(trail.data.stops.length, 4);

  // M16 Multilingual Menu Translator preserves original Vietnamese name
  const trans = await handleApiRequest(store, 'POST', '/api/v1/translate/menu', new URLSearchParams(), { target_lang: 'KO' });
  assert.equal(trans.status, 200);
  assert.equal(trans.data.preserved_original_names, true);
  assert.equal(trans.data.items[0].original_vietnamese_name, 'Phở Bò Tái Nạm Hà Nội');

  const transZh = await handleApiRequest(store, 'POST', '/api/v1/translate/menu', new URLSearchParams(), { target_lang: 'ZH' });
  assert.equal(transZh.status, 200);
  assert.equal(transZh.data.language, 'ZH');
  assert.ok(transZh.data.items[0].translated_title.includes('牛肉粉'));

  // M17 B2G Tourism Insights enforces K-Anonymity
  const b2g = await handleApiRequest(store, 'GET', '/api/v1/enterprise/tourism-insights', new URLSearchParams());
  assert.equal(b2g.status, 200);
  assert.equal(b2g.data.k_anonymity_enforced, true);

  // Flutter Route Aliases (/reviews/gps, /meal-planner/weekly)
  const gpsRev = await handleApiRequest(store, 'POST', '/api/v1/reviews/gps', new URLSearchParams(), {
    place_id: 'PLACE-401',
    lat: 10.9583,
    lng: 106.8432,
    rating: 5,
    comment: 'Tuyệt vời!'
  });
  assert.equal(gpsRev.status, 200);
  assert.equal(gpsRev.data.verified, true);

  const mealPlannerRes = await handleApiRequest(store, 'GET', '/api/v1/meal-planner/weekly', new URLSearchParams());
  assert.equal(mealPlannerRes.status, 200);
  assert.equal(mealPlannerRes.data.days.length, 7);
});

test('M7 (VietQR & PayOS Webhook): Invoice generation, EMVCo payload, webhook top-up & idempotency', async () => {
  const store = createInitialStore();

  // 1. Generate VietQR invoice
  const invRes = await handleApiRequest(store, 'POST', '/api/v1/ads/payments/vietqr/create', new URLSearchParams(), {
    campaign_id: 'CMP-701',
    amount_vnd: 200000
  });
  assert.equal(invRes.status, 200);
  assert.equal(invRes.data.amount_vnd, 200000);
  assert.ok(invRes.data.qr_image_url.includes('vietqr.io'));
  assert.ok(invRes.data.qr_emvco_raw.startsWith('000201'));

  const orderId = invRes.data.order_id;
  const campaignsList = store.campaigns || store.ad_campaigns;
  const initialBalance = campaignsList.find(c => c.id === 'CMP-701').budget_monthly_vnd || 0;

  // 2. Webhook triggers successful payment
  const webhookRes = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', new URLSearchParams(), {
    orderId,
    campaignId: 'CMP-701',
    amountVnd: 200000
  });
  assert.equal(webhookRes.status, 200);
  assert.equal(webhookRes.data.success, true);
  assert.equal(webhookRes.data.already_processed, false);

  const updatedBalance = campaignsList.find(c => c.id === 'CMP-701').balance_vnd;
  assert.equal(updatedBalance, initialBalance + 200000);

  // 3. Webhook idempotency test (duplicate delivery doesn't double-charge)
  const dupWebhookRes = await handleApiRequest(store, 'POST', '/api/v1/payments/webhook', new URLSearchParams(), {
    orderId,
    campaignId: 'CMP-701',
    amountVnd: 200000
  });
  assert.equal(dupWebhookRes.status, 200);
  assert.equal(dupWebhookRes.data.already_processed, true);
  assert.equal(campaignsList.find(c => c.id === 'CMP-701').balance_vnd, updatedBalance);

  // 4. Order status query
  const statusRes = await handleApiRequest(store, 'GET', `/api/v1/payments/orders/${orderId}`, new URLSearchParams());
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.data.status, 'COMPLETED');
});

test('M2/M3 (Semantic Dish Search): Concept matching, allergy safety, and similarity scoring', async () => {
  const store = createInitialStore();

  // Query: món nước ấm bụng trời mưa
  const searchRes = await handleApiRequest(store, 'GET', '/api/v1/dishes/semantic-search', new URLSearchParams({ q: 'mon nuoc am bung troi mua' }));
  assert.equal(searchRes.status, 200);
  assert.ok(searchRes.data.results.length > 0);
  assert.ok(searchRes.data.detected_concepts.includes('warm_soup'));
  
  // Verify top result has high similarity and reasons
  const top = searchRes.data.results[0];
  assert.ok(top.similarity_pct >= 70);
  assert.ok(top.match_reasons.length > 0);

  // Hard allergy block verification: User allergic to shrimp shouldn't get dishes with shrimp allergen
  for (const r of searchRes.data.results) {
    assert.ok(!(r.allergen_tags || []).includes('shrimp'), `Dish ${r.name} should not contain shrimp`);
  }
});

test('M1: Taste Profile Customization & PDPD export verification', async () => {
  const store = createInitialStore();

  // 1. Update user taste preferences
  const updateRes = await handleApiRequest(store, 'PUT', '/api/v1/me/profile', new URLSearchParams(), {
    spice_level: 2,
    diet_mode: 'vegan',
    hard_allergies: ['shrimp', 'peanut', 'dairy'],
    budget_min: 35000,
    budget_max: 80000
  });
  assert.equal(updateRes.status, 200);
  assert.equal(store.userProfile.spice_level, 2);
  assert.equal(store.userProfile.diet_mode, 'vegan');
  assert.deepEqual(store.userProfile.hard_allergies, ['shrimp', 'peanut', 'dairy']);
  assert.equal(store.userProfile.budget_max, 80000);

  // 2. Fetch updated profile
  const getRes = await handleApiRequest(store, 'GET', '/api/v1/me/profile', new URLSearchParams());
  assert.equal(getRes.status, 200);
  assert.equal(getRes.data.diet_mode, 'vegan');
});

test('M9: Admin OCR Review rejection with reason & Restaurant Un-pause auto-recovery', async () => {
  const store = createInitialStore();

  // 1. Admin rejects OCR item with reason
  const rejectRes = await handleApiRequest(store, 'POST', '/api/v1/admin/ocr-review', new URLSearchParams(), {
    ocr_id: 'ocr-901',
    decision: 'rejected',
    reason: 'Ảnh chụp bị nhòe và giá tiền không rõ'
  });
  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.data.updated.status, 'rejected');
  assert.equal(rejectRes.data.updated.rejection_reason, 'Ảnh chụp bị nhòe và giá tiền không rõ');

  // 2. Verify PLACE-405 is initially in userReports (auto_paused)
  assert.ok(store.userReports.some(r => r.place_id === 'PLACE-405'));

  // 3. Admin un-pauses restaurant PLACE-405
  const unpauseRes = await handleApiRequest(store, 'POST', '/api/v1/admin/places/PLACE-405/unpause', new URLSearchParams());
  assert.equal(unpauseRes.status, 200);
  assert.equal(unpauseRes.data.unpaused_place.is_open_override, true);
  assert.equal(unpauseRes.data.unpaused_place.closed_report_count, 0);

  // 4. Verify userReports no longer contains PLACE-405
  assert.ok(!store.userReports.some(r => r.place_id === 'PLACE-405'));
});

test('M8 & M3-S06: Notification Queue API & Suggestion Feedback actions (liked, skipped, eaten)', async () => {
  const store = createInitialStore();

  // 1. Fetch notifications
  const notifRes = await handleApiRequest(store, 'GET', '/api/v1/notifications', new URLSearchParams());
  assert.equal(notifRes.status, 200);
  assert.equal(notifRes.data.max_push_per_day, 2);
  assert.ok(Array.isArray(notifRes.data.items));
  assert.ok(notifRes.data.items.length >= 2);

  // 2. Feedback 'liked'
  const likeRes = await handleApiRequest(store, 'POST', '/api/v1/suggestions/feedback', new URLSearchParams(), {
    dish_id: 'DISH-102',
    action: 'liked'
  });
  assert.equal(likeRes.status, 200);
  assert.equal(likeRes.data.recorded.action, 'liked');

  // 3. Feedback 'skipped'
  const skipRes = await handleApiRequest(store, 'POST', '/api/v1/suggestions/feedback', new URLSearchParams(), {
    dish_id: 'DISH-103',
    action: 'skipped',
    skip_reason: 'Ngán món nước'
  });
  assert.equal(skipRes.status, 200);
  assert.equal(skipRes.data.recorded.action, 'skipped');
  assert.equal(skipRes.data.recorded.skip_reason, 'Ngán món nước');

  // 4. Feedback 'eaten'
  const eatenRes = await handleApiRequest(store, 'POST', '/api/v1/suggestions/feedback', new URLSearchParams(), {
    dish_id: 'DISH-104',
    action: 'eaten'
  });
  assert.equal(eatenRes.status, 200);
  assert.equal(eatenRes.data.recorded.action, 'eaten');
  assert.ok(eatenRes.data.history_count > 0);
});

test('Giai đoạn 4 / v0.2 (M18, M19, M20): Smart Fridge Scan, Health Wearables Sync & Community Recipe Hub', async () => {
  const store = createInitialStore();

  // 1. M18: Scan barcode into fridge & get Zero-Waste suggestion
  const scanRes = await handleApiRequest(store, 'POST', '/api/v1/fridge/scan', new URLSearchParams(), {
    barcode: '8934567890999',
    item_name: 'Sữa chua men sống Probi',
    expires_in_days: 1,
    compartment: 'door'
  });
  assert.equal(scanRes.status, 200);
  assert.equal(scanRes.data.scanned_item.name, 'Sữa chua men sống Probi');
  assert.equal(scanRes.data.scanned_item.is_expiring_soon, true);
  assert.ok(scanRes.data.zero_waste_suggestion.recommended_dish);

  // Fetch fridge inventory
  const invRes = await handleApiRequest(store, 'GET', '/api/v1/fridge/inventory', new URLSearchParams());
  assert.equal(invRes.status, 200);
  assert.ok(invRes.data.total_items >= 5);
  assert.ok(invRes.data.expiring_soon_count >= 2);

  // 2. M19: Health Wearables Sync & Nutrition Profiling
  const healthRes = await handleApiRequest(store, 'POST', '/api/v1/health/sync', new URLSearchParams(), {
    wearable: 'Apple Health',
    daily_steps: 10450,
    active_calories_burned: 620,
    goal: 'cut'
  });
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.data.daily_steps, 10450);
  assert.ok(healthRes.data.tdee > 2000);
  assert.ok(healthRes.data.macro_targets_g.protein >= 135);

  const getHealth = await handleApiRequest(store, 'GET', '/api/v1/health/nutrition-profile', new URLSearchParams());
  assert.equal(getHealth.status, 200);
  assert.equal(getHealth.data.daily_steps, 10450);

  // 3. M20: Community Recipe list, create & tipping
  const crecList = await handleApiRequest(store, 'GET', '/api/v1/community/recipes', new URLSearchParams());
  assert.equal(crecList.status, 200);
  assert.ok(crecList.data.recipes.length >= 2);

  // Tip author 20,000 VND
  const tipRes = await handleApiRequest(store, 'POST', '/api/v1/community/recipes/CREC-01/tip', new URLSearchParams(), {
    amount_vnd: 20000
  });
  assert.equal(tipRes.status, 200);
  assert.equal(tipRes.data.success, true);
  assert.equal(tipRes.data.tipped_amount_vnd, 20000);
  assert.equal(tipRes.data.total_tips_vnd, 270000);
});
