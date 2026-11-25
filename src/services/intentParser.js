// =============================================================================
// MODULE M3-S04 VIETNAMESE NATURAL LANGUAGE INTENT EXTRACTOR & CHAT ENGINE
// =============================================================================

import { removeVietnameseTones } from './textUtils.js';
import { buildCandidates } from './candidatePipeline.js';

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
  let mealSlot = userProfile.meal_slot || 'lunch';
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
    spice_max: noSpice ? 0 : userProfile.spice_max,
    diet_mode: norm.includes('thuan chay') || norm.includes('vegan') ? 'vegan' : norm.includes('chay') ? 'vegetarian' : userProfile.diet_mode,
    meal_slot: mealSlot,
    mode,
    detected_ingredients: detectedIngredients,
    hard_allergies_applied: userProfile.hard_allergies || []
  };
}

export function runAiFoodChat(store, queryText, opts = {}) {
  const intent = extractVietnameseIntent(queryText, store.userProfile);
  const result = buildCandidates(store, {
    ...opts, mode: intent.mode, meal_slot: intent.meal_slot, diet_mode: intent.diet_mode,
    spice_max: intent.spice_max, party_size: intent.party_size,
    budget_max: Math.min(Number(store.userProfile.budget_max ?? Infinity), intent.per_person_budget_vnd)
  });
  const options = result.candidates.slice(0, 3).map(c => ({
    option_type: c.option_type, dish_id: c.dish_id, dish_name: c.dish.name,
    img_key: c.dish.img_key, tags: c.dish.tags, prep_minutes: c.dish.prep_minutes,
    estimated_group_cost_vnd: c.price_vnd * intent.party_size, place: c.nearest_place,
    explanation: `${c.nearest_place ? c.nearest_place.place_name : 'Có công thức tự nấu'} · Tổng ${intent.party_size} người ~${Math.round(c.price_vnd * intent.party_size).toLocaleString('vi-VN')}đ`
  }));
  return { intent, context: result.context, reasons: result.reasons,
    safety_approval_required: result.safety_approval_required, ai_source: 'local',
    assistant_message: `Tìm được ${options.length} phương án phù hợp các điều kiện đã chọn. Kiểm tra thành phần với quán trước khi ăn.`, options };
}
