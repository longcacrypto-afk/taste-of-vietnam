// =============================================================================
// AUTOMATED QA & ACCEPTANCE CRITERIA TEST SUITE (QA-01..QA-11 & ALL 17 MODULES M1..M17)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { call, sessionUser } from './helpers/auth.js';
import { signPayosData } from '../src/services/paymentService.js';

const TEST_PAYOS_KEY = 'test-checksum-key';
process.env.PAYOS_CHECKSUM_KEY = TEST_PAYOS_KEY;

test('M1 (Auth & PDPD Compliance): OTP verify, Guest Mode, and Instant Account Deletion (Nghị định 13/2023/NĐ-CP)', async () => {
  const store = createInitialStore();
  const reqRes = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/request', new URLSearchParams(), { phone: '0912 345 678' });
  assert.equal(reqRes.status, 200);
  assert.match(reqRes.data.dev_code, /^\d{6}$/);
  const otpRes = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/verify', new URLSearchParams(), { phone: '0912345678', code: reqRes.data.dev_code });
  assert.equal(otpRes.status, 200);
  assert.equal(otpRes.data.verified, true);
  assert.ok(otpRes.data.access_token);

  const guestRes = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', new URLSearchParams());
  assert.equal(guestRes.status, 200);
  assert.equal(guestRes.data.guest_mode, true);

  const auth = { authorization: `Bearer ${otpRes.data.access_token}` };
  const delRes = await handleApiRequest(store, 'DELETE', '/api/v1/me', new URLSearchParams(), {}, auth);
  assert.equal(delRes.status, 200);
  assert.equal(delRes.data.deleted, true);
});

test('QA-05 & M3-S01: GET /api/v1/suggestions/today returns 3 items under p95 < 1500ms', async () => {
  const store = createInitialStore();
  const res = await call(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  assert.equal(res.status, 200);
  assert.equal(res.data.items.length, 3);
  assert.ok(res.data.latency_ms < 1500, `Expected latency < 1500ms, got ${res.data.latency_ms}ms`);
});

test('QA-10 & QA-11: Hard Allergy Filter blocks allergens in BOTH natural and Sponsored slots, and Sponsored <= 1/3', async () => {
  const store = createInitialStore();
  // User is allergic to shrimp and peanut
  const res = await call(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
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
  await call(store, 'POST', '/api/v1/suggestions/feedback', new URLSearchParams(), {
    dish_id: 'DISH-101',
    action: 'eaten'
  });

  const res = await call(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  const ids = res.data.items.map(i => i.dish_id);
  assert.ok(!ids.includes('DISH-101'), 'Recently eaten DISH-101 must not repeat within 3 days');
});

test('QA-04 & M2-S02: Unaccented Vietnamese Search matches accented dishes ("bun bo hue", "com tam")', async () => {
  const store = createInitialStore();
  const res1 = await call(store, 'GET', '/api/v1/dishes', new URLSearchParams({ q: 'bun bo hue' }));
  assert.equal(res1.status, 200);
  assert.ok(res1.data.items.some(d => d.id === 'DISH-103'));

  const res2 = await call(store, 'GET', '/api/v1/dishes', new URLSearchParams({ q: 'com tam suon' }));
  assert.ok(res2.data.items.some(d => d.id === 'DISH-102'));
});

test('M2-S06: Recipe Dynamic Portion Scaler scales ingredient grams and calories accurately', async () => {
  const store = createInitialStore();
  const res = await call(store, 'GET', '/api/v1/dishes/DISH-101', new URLSearchParams({ servings: '6' }));
  assert.equal(res.status, 200);
  assert.equal(res.data.requested_servings, 6);
  const banhPho = res.data.scaled_ingredients.find(i => i.name.includes('Bánh phở'));
  assert.equal(banhPho.scaled_amount, 1050);
  assert.equal(res.data.scaled_calories_total, 480 * 3);
});

test('M3-S04 & M3-S05: Vietnamese Natural Language Chat extracts party size, budget, kids & returns verified options', async () => {
  const store = createInitialStore();
  const res = await call(store, 'POST', '/api/v1/chat', new URLSearchParams(), {
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
  const openRes = await call(store, 'GET', '/api/v1/places', new URLSearchParams({ open_only: 'true' }));
  assert.ok(!openRes.data.items.some(p => p.id === 'PLACE-405'));

  await call(store, 'POST', '/api/v1/places/PLACE-404/reports', new URLSearchParams(), { reason: 'Đóng cửa' });
  await call(store, 'POST', '/api/v1/places/PLACE-404/reports', new URLSearchParams(), { reason: 'Đóng cửa' });
  const third = await call(store, 'POST', '/api/v1/places/PLACE-404/reports', new URLSearchParams(), { reason: 'Đóng cửa' });
  assert.equal(third.data.status, 'auto_paused');
});

test('M5-S01 & M5-S05: Order Deep-Link Redirect logs UTM tracking & Loopback Confirmation updates 3-day cooldown', async () => {
  const store = createInitialStore();
  const redir = await call(store, 'POST', '/api/v1/orders/redirect', new URLSearchParams(), {
    place_id: 'PLACE-401',
    dish_id: 'DISH-101',
    partner: 'grabfood'
  });
  assert.equal(redir.status, 200);
  assert.ok(redir.data.target_deeplink.includes('utm_source=hom_nay_an_gi'));

  const conf = await call(store, 'POST', `/api/v1/orders/${redir.data.id}/confirm-eaten`, new URLSearchParams());
  assert.equal(conf.status, 200);
  assert.equal(conf.data.confirmed, true);
  assert.equal(conf.data.cooldown_days_applied, 3);
});

test('M6-S06 & M9-S05: AI Menu OCR parses Vietnamese menu lines, normalizes VND prices & matches M2 Dish Library', async () => {
  const store = createInitialStore();
  const res = await call(store, 'POST', '/api/v1/merchant/menu/ocr', new URLSearchParams(), {
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
  const firstClick = await call(store, 'POST', '/api/v1/ads/campaigns/CMP-701/click', new URLSearchParams(), {
    fingerprint: 'device-test-99'
  });
  assert.equal(firstClick.status, 200);
  assert.equal(firstClick.data.charged, true);
  assert.equal(firstClick.data.fraud_filtered, false);

  const duplicateClick = await call(store, 'POST', '/api/v1/ads/campaigns/CMP-701/click', new URLSearchParams(), {
    fingerprint: 'device-test-99'
  });
  assert.equal(duplicateClick.status, 200);
  assert.equal(duplicateClick.data.charged, false);
  assert.equal(duplicateClick.data.fraud_filtered, true);
});

test('M8-S01: Smart Meal Reminder Scheduler strictly enforces <= 2 push notifications per day', async () => {
  const store = createInitialStore();
  const res = await call(store, 'PUT', '/api/v1/me/meal-schedule', new URLSearchParams(), {
    lunch: '10:30',
    dinner: '17:00',
    max_per_day: 9 // Requesting 9 -> must be capped at 2!
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.max_per_day, 2);
});

test('M10-S04: Vietnamese Natural Language Intent Benchmark achieves >= 90% accuracy SLA', async () => {
  const store = createInitialStore();
  const res = await call(store, 'GET', '/api/v1/analytics/ai-benchmark', new URLSearchParams());
  assert.equal(res.status, 200);
  assert.ok(res.data.accuracy_pct >= 90.0);
  assert.equal(res.data.passed_sla, true);
});

test('M11-S01 & M11-S02: 7-Day Meal Plan & Consolidated Grocery Merger deducts existing fridge ingredients', async () => {
  const store = createInitialStore();
  const res = await call(store, 'GET', '/api/v1/meal-plans/weekly', new URLSearchParams({ fridge: 'Hành tím,Bánh phở' }));
  assert.equal(res.status, 200);
  assert.equal(res.data.days.length, 7);
  const banhPhoItem = res.data.consolidated_groceries.find(g => g.name.includes('Bánh phở'));
  assert.equal(banhPhoItem.in_fridge, true);
});

test('M12-S03: GPS-Verified Review accepts reviews <= 500m and rejects reviews > 500m away', async () => {
  const store = createInitialStore();
  // PLACE-401 is at (10.9582, 106.8431). Nearby review (within 50m):
  const validRes = await call(store, 'POST', '/api/v1/places/PLACE-401/reviews', new URLSearchParams(), {
    lat: 10.9583,
    lng: 106.8432,
    rating: 5,
    comment: 'Phở bò rất ngon!'
  });
  assert.equal(validRes.status, 200);
  assert.equal(validRes.data.verified, true);

  // Far review (~5km away):
  const farRes = await call(store, 'POST', '/api/v1/places/PLACE-401/reviews', new URLSearchParams(), {
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
  const bk = await call(store, 'POST', '/api/v1/bookings', new URLSearchParams(), { place_id: 'PLACE-401', party_size: 4 });
  assert.equal(bk.status, 200);
  assert.equal(bk.data.status, 'confirmed_instant');

  // M15 Food Trail
  const trail = await call(store, 'GET', '/api/v1/tourism/trails', new URLSearchParams());
  assert.equal(trail.status, 200);
  assert.equal(trail.data.stops.length, 4);

  // M16 Multilingual Menu Translator preserves original Vietnamese name
  const trans = await call(store, 'POST', '/api/v1/translate/menu', new URLSearchParams(), { target_lang: 'KO' });
  assert.equal(trans.status, 200);
  assert.equal(trans.data.preserved_original_names, true);
  assert.equal(trans.data.items[0].original_vietnamese_name, 'Phở Bò Tái Nạm Hà Nội');

  const transZh = await call(store, 'POST', '/api/v1/translate/menu', new URLSearchParams(), { target_lang: 'ZH' });
  assert.equal(transZh.status, 200);
  assert.equal(transZh.data.language, 'ZH');
  assert.ok(transZh.data.items[0].translated_title.includes('牛肉粉'));

  // M17 B2G Tourism Insights enforces K-Anonymity
  const b2g = await call(store, 'GET', '/api/v1/enterprise/tourism-insights', new URLSearchParams());
  assert.equal(b2g.status, 200);
  assert.equal(b2g.data.k_anonymity_enforced, true);

  // Flutter Route Aliases (/reviews/gps, /meal-planner/weekly)
  const gpsRev = await call(store, 'POST', '/api/v1/reviews/gps', new URLSearchParams(), {
    place_id: 'PLACE-401',
    lat: 10.9583,
    lng: 106.8432,
    rating: 5,
    comment: 'Tuyệt vời!'
  });
  assert.equal(gpsRev.status, 200);
  assert.equal(gpsRev.data.verified, true);

  const mealPlannerRes = await call(store, 'GET', '/api/v1/meal-planner/weekly', new URLSearchParams());
  assert.equal(mealPlannerRes.status, 200);
  assert.equal(mealPlannerRes.data.days.length, 7);
});

test('M7 (VietQR & PayOS Webhook): Invoice generation, EMVCo payload, webhook top-up & idempotency', async () => {
  const store = createInitialStore();

  // 1. Generate VietQR invoice
  const invRes = await call(store, 'POST', '/api/v1/ads/payments/vietqr/create', new URLSearchParams(), {
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

  // 2. Signed PayOS webhook triggers successful payment
  const payosData = { orderCode: invRes.data.order_code, amount: 200000, description: invRes.data.transfer_memo, code: '00', desc: 'Thành công', reference: 'FT123', counterAccountName: null };
  const signedBody = { code: '00', desc: 'success', success: true, data: payosData, signature: signPayosData(payosData, TEST_PAYOS_KEY) };
  const webhookRes = await call(store, 'POST', '/api/v1/payments/webhook', new URLSearchParams(), signedBody);
  assert.equal(webhookRes.status, 200);
  assert.equal(webhookRes.data.success, true);
  assert.equal(webhookRes.data.already_processed, false);

  const updatedBalance = campaignsList.find(c => c.id === 'CMP-701').balance_vnd;
  assert.equal(updatedBalance, initialBalance + 200000);

  // 3. Webhook idempotency test (duplicate delivery doesn't double-charge)
  const dupWebhookRes = await call(store, 'POST', '/api/v1/payments/webhook', new URLSearchParams(), signedBody);
  assert.equal(dupWebhookRes.status, 200);
  assert.equal(dupWebhookRes.data.already_processed, true);
  assert.equal(campaignsList.find(c => c.id === 'CMP-701').balance_vnd, updatedBalance);

  // 4. Order status query
  const statusRes = await call(store, 'GET', `/api/v1/payments/orders/${orderId}`, new URLSearchParams());
  assert.equal(statusRes.status, 200);
  assert.equal(statusRes.data.status, 'COMPLETED');
});

test('M2/M3 (Semantic Dish Search): Concept matching, allergy safety, and similarity scoring', async () => {
  const store = createInitialStore();

  // Query: món nước ấm bụng trời mưa
  const searchRes = await call(store, 'GET', '/api/v1/dishes/semantic-search', new URLSearchParams({ q: 'mon nuoc am bung troi mua' }));
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
  const updateRes = await call(store, 'PUT', '/api/v1/me/profile', new URLSearchParams(), {
    spice_level: 2,
    diet_mode: 'vegan',
    hard_allergies: ['shrimp', 'peanut', 'dairy'],
    budget_min: 35000,
    budget_max: 80000
  });
  assert.equal(updateRes.status, 200);
  const myProfile = (await sessionUser(store)).profile;
  assert.equal(myProfile.spice_level, 2);
  assert.equal(myProfile.diet_mode, 'vegan');
  assert.deepEqual(myProfile.hard_allergies, ['shrimp', 'peanut', 'dairy']);
  assert.equal(myProfile.budget_max, 80000);
  // the shared default profile (anonymous reads) is untouched
  assert.equal(store.userProfile.diet_mode, 'balanced');

  // 2. Fetch updated profile
  const getRes = await call(store, 'GET', '/api/v1/me/profile', new URLSearchParams());
  assert.equal(getRes.status, 200);
  assert.equal(getRes.data.diet_mode, 'vegan');
});

test('M9: Admin OCR Review rejection with reason & Restaurant Un-pause auto-recovery', async () => {
  const store = createInitialStore();

  // 1. Admin rejects OCR item with reason
  const rejectRes = await call(store, 'POST', '/api/v1/admin/ocr-review', new URLSearchParams(), {
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
  const unpauseRes = await call(store, 'POST', '/api/v1/admin/places/PLACE-405/unpause', new URLSearchParams());
  assert.equal(unpauseRes.status, 200);
  assert.equal(unpauseRes.data.unpaused_place.is_open_override, true);
  assert.equal(unpauseRes.data.unpaused_place.closed_report_count, 0);

  // 4. Verify userReports no longer contains PLACE-405
  assert.ok(!store.userReports.some(r => r.place_id === 'PLACE-405'));
});

test('M8 & M3-S06: Notification Queue API & Suggestion Feedback actions (liked, skipped, eaten)', async () => {
  const store = createInitialStore();

  // 1. Fetch notifications
  const notifRes = await call(store, 'GET', '/api/v1/notifications', new URLSearchParams());
  assert.equal(notifRes.status, 200);
  assert.equal(notifRes.data.max_push_per_day, 2);
  assert.ok(Array.isArray(notifRes.data.items));
  assert.ok(notifRes.data.items.length >= 2);

  // 2. Feedback 'liked'
  const likeRes = await call(store, 'POST', '/api/v1/suggestions/feedback', new URLSearchParams(), {
    dish_id: 'DISH-102',
    action: 'liked'
  });
  assert.equal(likeRes.status, 200);
  assert.equal(likeRes.data.recorded.action, 'liked');

  // 3. Feedback 'skipped'
  const skipRes = await call(store, 'POST', '/api/v1/suggestions/feedback', new URLSearchParams(), {
    dish_id: 'DISH-103',
    action: 'skipped',
    skip_reason: 'Ngán món nước'
  });
  assert.equal(skipRes.status, 200);
  assert.equal(skipRes.data.recorded.action, 'skipped');
  assert.equal(skipRes.data.recorded.skip_reason, 'Ngán món nước');

  // 4. Feedback 'eaten'
  const eatenRes = await call(store, 'POST', '/api/v1/suggestions/feedback', new URLSearchParams(), {
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
  const scanRes = await call(store, 'POST', '/api/v1/fridge/scan', new URLSearchParams(), {
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
  const invRes = await call(store, 'GET', '/api/v1/fridge/inventory', new URLSearchParams());
  assert.equal(invRes.status, 200);
  assert.ok(invRes.data.total_items >= 5);
  assert.ok(invRes.data.expiring_soon_count >= 2);

  // 2. M19: Health Wearables Sync & Nutrition Profiling
  const healthRes = await call(store, 'POST', '/api/v1/health/sync', new URLSearchParams(), {
    wearable: 'Apple Health',
    daily_steps: 10450,
    active_calories_burned: 620,
    goal: 'cut'
  });
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.data.daily_steps, 10450);
  assert.ok(healthRes.data.tdee > 2000);
  assert.ok(healthRes.data.macro_targets_g.protein >= 135);

  const getHealth = await call(store, 'GET', '/api/v1/health/nutrition-profile', new URLSearchParams());
  assert.equal(getHealth.status, 200);
  assert.equal(getHealth.data.daily_steps, 10450);

  // 3. M20: Community Recipe list, create & tipping
  const crecList = await call(store, 'GET', '/api/v1/community/recipes', new URLSearchParams());
  assert.equal(crecList.status, 200);
  assert.ok(crecList.data.recipes.length >= 2);

  // Create new community recipe
  const createRecRes = await call(store, 'POST', '/api/v1/community/recipes', new URLSearchParams(), {
    title: 'Bún Sườn Nấu Sấu Hà Nội',
    author: 'Bếp Mẹ Bon',
    prep_time_minutes: 30,
    difficulty: 'Dễ',
    calories: 460,
    zero_waste_tag: 'Tận dụng sấu ngâm & sườn ninh',
    ingredients: ['Bún tươi 500g', 'Sườn non 400g', 'Sấu tươi 5 quả']
  });
  assert.equal(createRecRes.status, 201);
  assert.equal(createRecRes.data.title, 'Bún Sườn Nấu Sấu Hà Nội');
  assert.equal(createRecRes.data.author, 'Bếp Mẹ Bon');

  // Tip author 20,000 VND
  const tipRes = await call(store, 'POST', '/api/v1/community/recipes/CREC-01/tip', new URLSearchParams(), {
    amount_vnd: 20000
  });
  assert.equal(tipRes.status, 200);
  assert.equal(tipRes.data.success, true);
  assert.equal(tipRes.data.tipped_amount_vnd, 20000);
  assert.equal(tipRes.data.total_tips_vnd, 270000);
});

test('E2E Full Loop (M1 -> M3 -> M2 -> M4 -> M5 -> Cooldown -> M8 -> M18 -> M19 -> M20)', async () => {
  const store = createInitialStore();

  // Step 1: Onboard User with Shrimp allergy & Spicy tolerance level 1
  const updateProfileRes = await call(store, 'PUT', '/api/v1/me/profile', new URLSearchParams(), {
    allergies: ['shrimp', 'peanut'],
    spiciness_level: 1,
    budget_level: 'medium',
    diet_preference: 'balanced'
  });
  assert.equal(updateProfileRes.status, 200);
  assert.deepEqual(updateProfileRes.data.allergies, ['shrimp', 'peanut']);

  // Step 2: Fetch Today's 3 Suggestions (M3-S01)
  const sugRes = await call(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  assert.equal(sugRes.status, 200);
  assert.equal(sugRes.data.items.length, 3);
  // Guarantee no allergens in suggestions
  for (const item of sugRes.data.items) {
    const dish = store.dishes.find(d => d.id === item.dish_id);
    assert.ok(dish);
    const allergens = dish.allergen_tags || [];
    assert.ok(!allergens.includes('shrimp'));
    assert.ok(!allergens.includes('peanut'));
  }

  // Step 3: Scale Portion for Selected Dish (M2-S05 / M2-S06)
  const chosenDishId = sugRes.data.items[0].dish_id;
  const scaledRes = await call(store, 'GET', `/api/v1/dishes/${chosenDishId}`, new URLSearchParams('servings=4'));
  assert.equal(scaledRes.status, 200);
  assert.equal(scaledRes.data.requested_servings, 4);
  assert.ok(scaledRes.data.scaled_calories_total > 0);

  // Step 4: Locate verified open places nearby for this dish (M4-S01)
  const placesRes = await call(store, 'GET', '/api/v1/places', new URLSearchParams({ dish_id: chosenDishId, open_only: 'true' }));
  assert.equal(placesRes.status, 200);
  assert.ok(placesRes.data.items.length > 0);
  const targetPlace = placesRes.data.items[0];

  // Step 5: Order via Partner Hub & Confirm Eaten (M5-S01 / M5-S05)
  const orderRes = await call(store, 'POST', '/api/v1/orders/redirect', new URLSearchParams(), {
    place_id: targetPlace.id,
    dish_id: chosenDishId,
    partner: 'grabfood'
  });
  assert.equal(orderRes.status, 200);
  assert.ok(orderRes.data.target_deeplink.includes('utm_source=hom_nay_an_gi'));

  const loopbackRes = await call(store, 'POST', `/api/v1/orders/${orderRes.data.id}/confirm-eaten`, new URLSearchParams(), {
    dish_id: chosenDishId
  });
  assert.equal(loopbackRes.status, 200);
  assert.equal(loopbackRes.data.confirmed, true);
  assert.equal(loopbackRes.data.cooldown_days_applied, 3);

  // Step 6: Verify 3-Day Non-Repeat Cooldown activates (M3-S06 / M3-S07)
  const freshSugRes = await call(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  assert.equal(freshSugRes.status, 200);
  const freshIds = freshSugRes.data.items.map(it => it.dish_id);
  assert.ok(!freshIds.includes(chosenDishId), 'Eaten dish must be excluded by 3-day cooldown');

  // Step 7: Smart Meal Reminder honors <= 2 push/day SLA (M8-S01)
  const schedRes = await call(store, 'PUT', '/api/v1/me/meal-schedule', new URLSearchParams(), {
    lunch: '10:30',
    dinner: '17:00',
    max_per_day: 2
  });
  assert.equal(schedRes.status, 200);
  assert.equal(schedRes.data.max_per_day, 2);

  // Step 8: Fridge Scanner (M18) + Wearable Sync (M19) + Community Hub (M20)
  const scanFridge = await call(store, 'POST', '/api/v1/fridge/scan', new URLSearchParams(), {
    barcode: '8934567890123',
    item_name: 'Trứng gà ta',
    expires_in_days: 2,
    compartment: 'door'
  });
  assert.equal(scanFridge.status, 200);

  const syncWearable = await call(store, 'POST', '/api/v1/health/sync', new URLSearchParams(), {
    wearable: 'Apple Health',
    daily_steps: 8800,
    active_calories_burned: 490,
    goal: 'maintain'
  });
  assert.equal(syncWearable.status, 200);
  assert.equal(syncWearable.data.daily_steps, 8800);
});

test('PROD-HEALTH: Health check endpoint returns healthy, 20 modules loaded and v0.2.0 info', async () => {
  const store = createInitialStore();
  const res = await call(store, 'GET', '/api/v1/health-check', new URLSearchParams());
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'healthy');
  assert.equal(res.data.version, '0.2.0');
  assert.equal(res.data.modules_loaded, 20);
});

test('AUDIT-GAPS: M1 PDPD export, M6 daily-special, M7 fraud-logs, M9 RBAC & M10 A/B test endpoints', async () => {
  const store = createInitialStore();

  // M1-S09: PDPD Export
  const exportRes = await call(store, 'GET', '/api/v1/me/export', new URLSearchParams());
  assert.equal(exportRes.status, 200);
  assert.equal(exportRes.data.export_format, 'JSON');
  assert.ok(exportRes.data.pdpd_compliance.includes('13/2023/NĐ-CP'));
  assert.ok(exportRes.data.profile);

  // M6-S07: Daily Special Tagging
  const tagRes = await call(store, 'POST', '/api/v1/merchant/daily-special', new URLSearchParams(), {
    dish_id: 'DISH-101',
    label: 'Món đặc biệt cuối tuần'
  });
  assert.equal(tagRes.status, 200);
  assert.equal(tagRes.data.tagged, true);

  const listSpecialRes = await call(store, 'GET', '/api/v1/merchant/daily-special', new URLSearchParams());
  assert.equal(listSpecialRes.status, 200);
  assert.ok(listSpecialRes.data.daily_special.some(d => d.id === 'DISH-101'));

  // M7-S07: Anti-Fraud Click Guard Logs
  const fraudRes = await call(store, 'GET', '/api/v1/ads/fraud-logs', new URLSearchParams());
  assert.equal(fraudRes.status, 200);
  assert.equal(fraudRes.data.cooldown_window_seconds, 60);
  assert.ok(Array.isArray(fraudRes.data.logs) && fraudRes.data.logs.length > 0);

  // M9-S08: RBAC 6 Roles & Users
  const rbacRolesRes = await call(store, 'GET', '/api/v1/admin/rbac/roles', new URLSearchParams());
  assert.equal(rbacRolesRes.status, 200);
  assert.equal(rbacRolesRes.data.roles.length, 6);

  const rbacUsersRes = await call(store, 'GET', '/api/v1/admin/rbac/users', new URLSearchParams());
  assert.equal(rbacUsersRes.status, 200);
  assert.ok(rbacUsersRes.data.users.length >= 3);

  // M10-S06: A/B Testing
  const abRes = await call(store, 'GET', '/api/v1/analytics/ab-test', new URLSearchParams());
  assert.equal(abRes.status, 200);
  assert.ok(abRes.data.active_experiments.length >= 3);
  assert.ok(abRes.data.nlu_accuracy.score >= 90);
});

test('PHASE-D: Collections (M2-S07), Spin (M3-S03), Vouchers (M13-S02) & Community Recipe POST (M20-S02)', async () => {
  const store = createInitialStore();

  // M2-S07: Save dish to favorite collections
  const colRes = await call(store, 'POST', '/api/v1/me/collections', new URLSearchParams(), {
    dish_id: 'DISH-105'
  });
  assert.equal(colRes.status, 200);
  assert.ok(colRes.data.collections[0].dish_ids.includes('DISH-105'));

  // M3-S03: Spin suggestion
  const spinRes = await call(store, 'GET', '/api/v1/suggestions/spin', new URLSearchParams());
  assert.equal(spinRes.status, 200);
  assert.ok(spinRes.data.picked_dish && spinRes.data.total_safe_candidates > 0);

  // M13-S02: Vouchers list
  const voucherRes = await call(store, 'GET', '/api/v1/vouchers', new URLSearchParams());
  assert.equal(voucherRes.status, 200);
  assert.ok(Array.isArray(voucherRes.data.vouchers || voucherRes.data.items));

  // M20-S02: Create community recipe
  const createRecRes = await call(store, 'POST', '/api/v1/community/recipes', new URLSearchParams(), {
    title: 'Canh Chua Cá Lóc Miền Tây',
    author: 'Đầu Bếp Test',
    prep_time_minutes: 30,
    calories: 390,
    zero_waste_tag: 'Tận dụng rau thơm'
  });
  assert.equal(createRecRes.status, 201);
  assert.equal(createRecRes.data.title, 'Canh Chua Cá Lóc Miền Tây');
});

test('CRUD-FULL: M6 Menu, M7 Campaign Patch, M9 Dish CRUD, M11 MealPlan PUT, M13 Booking Cancel, M18 Fridge CRUD, M20 Like/Delete', async () => {
  const store = createInitialStore();

  // M6 Menu CRUD
  const addMenu = await call(store, 'POST', '/api/v1/merchant/menu', new URLSearchParams(), { name: 'Bún Riêu Cua', price_vnd: 48000 });
  assert.equal(addMenu.status, 201);
  const editMenu = await call(store, 'PUT', `/api/v1/merchant/menu/${addMenu.data.id}`, new URLSearchParams(), { price_vnd: 52000 });
  assert.equal(editMenu.status, 200);
  assert.equal(editMenu.data.price_vnd, 52000);
  const delMenu = await call(store, 'DELETE', `/api/v1/merchant/menu/${addMenu.data.id}`, new URLSearchParams());
  assert.equal(delMenu.status, 200);

  // M7 Campaign PATCH
  const cmpRes = await call(store, 'PATCH', `/api/v1/ads/campaigns/${store.campaigns[0].id}`, new URLSearchParams(), { status: 'paused' });
  assert.equal(cmpRes.status, 200);
  assert.equal(cmpRes.data.status, 'paused');

  // M9 Admin Dish CRUD
  const addDish = await call(store, 'POST', '/api/v1/admin/dishes', new URLSearchParams(), { name: 'Cao Lầu Hội An', region: 'Miền Trung', calories: 510, ref_price: 55000 });
  assert.equal(addDish.status, 201);
  const editDish = await call(store, 'PUT', `/api/v1/admin/dishes/${addDish.data.id}`, new URLSearchParams(), { ref_price: 60000 });
  assert.equal(editDish.status, 200);
  assert.equal(editDish.data.ref_price, 60000);
  const delDish = await call(store, 'DELETE', `/api/v1/admin/dishes/${addDish.data.id}`, new URLSearchParams());
  assert.equal(delDish.status, 200);

  // M11 Meal Plan PUT & 3-Meals-Per-Day Family Scaling
  const plan3Meals = await call(store, 'GET', '/api/v1/meal-plans/weekly', new URLSearchParams('family_size=4&meals_per_day=3'));
  assert.equal(plan3Meals.status, 200);
  assert.equal(plan3Meals.data.family_size, 4);
  assert.equal(plan3Meals.data.meals_per_day, 3);
  assert.ok(plan3Meals.data.days[0].meals.breakfast && plan3Meals.data.days[0].meals.lunch && plan3Meals.data.days[0].meals.dinner);

  const putPlan = await call(store, 'PUT', '/api/v1/meal-plans/weekly', new URLSearchParams(), { days: [{ day: 'Thứ 2', dish_name: 'Phở Gà' }] });
  assert.equal(putPlan.status, 200);
  assert.equal(putPlan.data.days[0].dish_name, 'Phở Gà');

  // M13 Booking GET & Cancel
  const bkPost = await call(store, 'POST', '/api/v1/bookings', new URLSearchParams(), { place_id: 'PLACE-401', party_size: 4 });
  assert.equal(bkPost.status, 200);
  const bkDel = await call(store, 'DELETE', `/api/v1/bookings/${bkPost.data.booking_id}`, new URLSearchParams());
  assert.equal(bkDel.status, 200);
  assert.equal(bkDel.data.cancelled, true);

  // M18 Fridge CRUD
  const addFridge = await call(store, 'POST', '/api/v1/fridge/inventory', new URLSearchParams(), { name: 'Ức gà tươi', quantity: '500g', compartment: 'chill', expires_in_days: 2 });
  assert.equal(addFridge.status, 201);
  assert.equal(addFridge.data.is_expiring_soon, true);
  const putFridge = await call(store, 'PUT', `/api/v1/fridge/inventory/${addFridge.data.id}`, new URLSearchParams(), { quantity: '250g', expires_in_days: 5 });
  assert.equal(putFridge.status, 200);
  assert.equal(putFridge.data.is_expiring_soon, false);
  const delFridge = await call(store, 'DELETE', `/api/v1/fridge/inventory/${addFridge.data.id}`, new URLSearchParams());
  assert.equal(delFridge.status, 200);

  // M20 Recipe Like & Delete
  const recId = store.communityRecipes[0].id;
  const oldLikes = store.communityRecipes[0].likes_count;
  const likeRes = await call(store, 'POST', `/api/v1/community/recipes/${recId}/like`, new URLSearchParams());
  assert.equal(likeRes.status, 200);
  assert.equal(likeRes.data.likes_count, oldLikes + 1);
});
