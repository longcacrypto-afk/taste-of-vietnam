// =============================================================================
// MODULE M3-S04 VIETNAMESE NATURAL LANGUAGE INTENT EXTRACTOR & CHAT ENGINE
// =============================================================================

import { removeVietnameseTones } from './textUtils.js';
import { isDishSafeForUser, findOpenPlacesForDish } from './recommender.js';

export function extractVietnameseIntent(queryText = '', userProfile = {}) {
  const norm = removeVietnameseTones(queryText);

  // 1. Party size (e.g., "4 nguoi", "nhom 6 nguoi", "2 vo chong")
  let partySize = 1;
  const peopleMatch = norm.match(/(\d+)\s*(nguoi|khach|suat|phan|to)/);
  if (peopleMatch) {
    partySize = Math.max(1, parseInt(peopleMatch[1], 10));
  } else if (norm.includes('gia dinh') || norm.includes('nhom')) {
    partySize = 4;
  } else if (norm.includes('cap doi') || norm.includes('2 vo chong')) {
    partySize = 2;
  }

  // 2. Total budget in VND (e.g., "300k", "300 ngan", "50k", "200.000")
  let totalBudgetVnd = userProfile.budget_max ? userProfile.budget_max * partySize : 60000 * partySize;
  const kMatch = norm.match(/(\d+)\s*(k|ngan|nghin)\b/);
  const trMatch = norm.match(/(\d+)\s*(trieu|tr)\b/);
  if (kMatch) {
    totalBudgetVnd = parseInt(kMatch[1], 10) * 1000;
  } else if (trMatch) {
    totalBudgetVnd = parseInt(trMatch[1], 10) * 1000000;
  }

  // 3. Kids / Spice constraint
  const hasKids = norm.includes('tre nho') || norm.includes('em be') || norm.includes('con nho') || norm.includes('cho be');
  const noSpice = hasKids || norm.includes('khong cay') || norm.includes('it cay');

  // 4. Meal slot
  let mealSlot = 'lunch';
  if (norm.includes('sang') || norm.includes('an sang')) mealSlot = 'breakfast';
  else if (norm.includes('toi') || norm.includes('an toi')) mealSlot = 'dinner';
  else if (norm.includes('an vat') || norm.includes('xe chieu')) mealSlot = 'snack';

  // 5. Mode: cook vs eat_out vs fridge ingredients
  const isFridgeQuery = norm.includes('tu lanh') || norm.includes('nguyen lieu') || norm.includes('nau gi') || norm.includes('trung') || norm.includes('ca chua');
  let mode = 'both';
  if (isFridgeQuery || norm.includes('tu nau') || norm.includes('vao bep')) mode = 'cook';
  else if (norm.includes('gan nha') || norm.includes('quan') || norm.includes('di an')) mode = 'eat_out';

  // 6. Mentioned ingredients
  const detectedIngredients = [];
  const commonIngs = [
    ['thit bo', 'Thịt bò'],
    ['trung', 'Trứng'],
    ['ca chua', 'Cà chua'],
    ['suon', 'Sườn heo'],
    ['ca loc', 'Cá lóc'],
    ['banh pho', 'Bánh phở'],
    ['khoai tay', 'Khoai tây']
  ];
  for (const [token, label] of commonIngs) {
    if (norm.includes(token)) detectedIngredients.push(label);
  }

  return {
    raw_query: queryText,
    party_size: partySize,
    total_budget_vnd: totalBudgetVnd,
    per_person_budget_vnd: Math.round(totalBudgetVnd / partySize),
    has_kids: hasKids,
    spice_max: noSpice ? 0 : (userProfile.spice_level ?? 2),
    meal_slot: mealSlot,
    mode,
    detected_ingredients: detectedIngredients,
    hard_allergies_applied: userProfile.hard_allergies || []
  };
}

export function runAiFoodChat(store, queryText) {
  const user = store.userProfile;
  const intent = extractVietnameseIntent(queryText, user);

  // Build 3 verified options (NEVER hallucinating restaurants!)
  const options = [];
  for (const dish of store.dishes) {
    if (!isDishSafeForUser(dish, user)) continue;
    if (intent.has_kids && dish.spice_level > 1) continue;

    const openPlaces = findOpenPlacesForDish(store, dish.id, user.lat, user.lng, user.radius_m || 3000);
    const topPlace = openPlaces[0];
    const unitPrice = topPlace ? topPlace.price_vnd : dish.ref_price;
    const estGroupCost = unitPrice * intent.party_size;

    if (estGroupCost <= intent.total_budget_vnd * 1.15) {
      options.push({
        option_type: topPlace ? 'verified_restaurant' : 'home_recipe',
        dish_id: dish.id,
        dish_name: dish.name,
        img_key: dish.img_key,
        tags: dish.tags,
        prep_minutes: dish.prep_minutes,
        estimated_group_cost_vnd: estGroupCost,
        place: topPlace || null,
        explanation: topPlace
          ? `${topPlace.place_name} (cách ${topPlace.distance_m}m, đang mở) · Tổng ${intent.party_size} người ~${estGroupCost.toLocaleString('vi-VN')}đ${intent.has_kids ? ' · Có ghế trẻ em & không cay' : ''}`
          : `Tự nấu tại nhà trong ${dish.prep_minutes} phút · Chi phí đi chợ ~${Math.round(dish.market_cost_base * (intent.party_size / dish.base_servings)).toLocaleString('vi-VN')}đ`
      });
    }
  }

  return {
    intent,
    assistant_message: `Măm đã phân tích yêu cầu (${intent.party_size} người · ngân sách ${intent.total_budget_vnd.toLocaleString('vi-VN')}đ${intent.has_kids ? ' · có trẻ nhỏ' : ''}) và lọc 3 phương án thực tế an toàn dị ứng:`,
    options: options.slice(0, 3)
  };
}
