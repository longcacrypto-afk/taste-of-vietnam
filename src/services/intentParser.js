// =============================================================================
// MODULE M3-S04 VIETNAMESE NATURAL LANGUAGE INTENT EXTRACTOR & CHAT ENGINE
// =============================================================================

import { removeVietnameseTones } from './textUtils.js';
import { buildCandidates } from './candidatePipeline.js';

export function extractVietnameseIntent(queryText = '', userProfile = {}) {
  const norm = removeVietnameseTones(queryText);

  // Keep "." and "," for amounts ("1.5 triệu", "1,5 triệu", "1.500.000đ"): the plain
  // normaliser turns them into spaces, which made "1.5 triệu" read as "5 triệu".
  const numNorm = String(queryText).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9\s.,]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. People: adults, children, total party size
  //    "4 người", "nhóm 6 người", "hai vợ chồng", "2 người lớn 1 bé", "có 2 bé", "4 người trong đó 2 trẻ nhỏ"
  const NUM = '(\\d+|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)';
  const WORD_NUM = { mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 };
  const toNum = t => (/^\d+$/.test(t) ? parseInt(t, 10) : WORD_NUM[t]);
  const kidsMatch = norm.match(new RegExp(`\\b${NUM}\\s*(be|chau|em be|tre|tre nho|tre em|dua tre|dua nho|con nho|nhoc|con(?=\\s*(?:$|\\d|va\\b|voi\\b|nua\\b|di\\b|an\\b|nho\\b)))\\b`));
  const kidsCount = kidsMatch ? Math.max(0, toNum(kidsMatch[1]) || 0) : 0;
  const adultsMatch = norm.match(new RegExp(`\\b${NUM}\\s*nguoi lon\\b`));
  let adults = adultsMatch ? toNum(adultsMatch[1]) : null;
  if (adults == null && /\b(vo chong|cap doi|hai dua minh|2 dua minh)\b/.test(norm)) adults = 2;
  if (adults == null && /\b(mot minh|1 minh)\b/.test(norm)) adults = 1;

  let partySize = 1;
  const peopleMatch = norm.match(new RegExp(`\\b${NUM}\\s*(nguoi(?! lon)|khach|suat|phan|to)\\b`));
  if (peopleMatch) {
    partySize = Math.max(1, toNum(peopleMatch[1]) || 1);
  } else if (adults != null) {
    partySize = adults + kidsCount;
  } else if (norm.includes('gia dinh') || norm.includes('nhom') || norm.includes('ca nha')) {
    partySize = Math.max(4, kidsCount + 1);
  } else if (kidsCount > 0) {
    partySize = kidsCount + 1; // at least one adult with the children
  }
  partySize = Math.max(1, partySize);

  // 2. Total budget in VND ("300k", "300 ngàn", "1 triệu", "1.5 triệu", "1,5 triệu", "1tr5", "1 triệu rưỡi", "200.000đ")
  let totalBudgetVnd = userProfile.budget_max ? userProfile.budget_max * partySize : 60000 * partySize;
  const dec = t => parseFloat(String(t).replace(',', '.'));
  const trMatch = numNorm.match(/(\d+(?:[.,]\d+)?)\s*(?:trieu|tr)\b(?:\s*(ruoi\b|\d(?!\d|\s*[a-z])))?/) || numNorm.match(/(\d+)\s*tr(\d)\b/);
  const kMatch = numNorm.match(/(\d+(?:[.,]\d+)?)\s*(?:k|ngan|nghin)\b/);
  const fullMatch = numNorm.match(/\b(\d{1,3}(?:[.,]\d{3})+)\s*(?:d|dong|vnd)?\b/) || numNorm.match(/\b(\d{4,})\s*(?:d|dong|vnd)\b/);
  if (trMatch) {
    let millions = dec(trMatch[1]);
    if (trMatch[2] === 'ruoi') millions += 0.5;
    else if (trMatch[2] && !/[.,]/.test(trMatch[1])) millions += parseInt(trMatch[2], 10) / 10; // "1tr5", "1 triệu 5"
    totalBudgetVnd = Math.round(millions * 1000000);
  } else if (kMatch) {
    totalBudgetVnd = Math.round(dec(kMatch[1]) * 1000);
  } else if (fullMatch) {
    totalBudgetVnd = parseInt(fullMatch[1].replace(/[.,]/g, ''), 10);
  }

  // 3. Kids / Spice constraint
  const hasKids = kidsCount > 0 || /\b(co|cho|em|be) be\b|\bbe nho\b/.test(norm) || norm.includes('tre nho') || norm.includes('tre em') || norm.includes('em be') || norm.includes('con nho') || norm.includes('cho be');
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
    adults: adults ?? Math.max(1, partySize - kidsCount),
    kids_count: kidsCount,
    total_budget_vnd: totalBudgetVnd,
    per_person_budget_vnd: Math.floor(totalBudgetVnd / partySize),
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
