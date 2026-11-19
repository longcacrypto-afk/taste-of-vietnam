// =============================================================================
// SEMANTIC DISH SEARCH & FOOD KNOWLEDGE GRAPH ENGINE
// Hôm nay ăn gì · Taste of Vietnam v0.1 (Module M2 & M3 Food Intelligence)
// Kết hợp NLU, Vector Embeddings & Quy tắc Vị giác Việt Nam
// =============================================================================

import { removeVietnameseTones } from './textUtils.js';
import { isDishSafeForUser } from './recommender.js';

// Knowledge Graph từ khóa ngữ nghĩa ẩm thực Việt
const SEMANTIC_CONCEPTS = {
  warm_soup: {
    keywords: ['am bung', 'nong hoi', 'mon nuoc', 'troi mua', 'lanh', 'giai cam', 'nuoc dung'],
    matcher: (d) => (d.tags || []).includes('món nước') || d.meal_slots?.includes('breakfast') || ['DISH-101', 'DISH-103', 'DISH-104'].includes(d.id),
    weight: 0.35,
    reason: 'Món nước nóng hổi đậm đà, rất ấm bụng và giải cảm',
  },
  refreshing_cooling: {
    keywords: ['thanh mat', 'giai nhiet', 'nang nong', 'it dau mo', 'thanh dam', 'mua he', 'mat me'],
    matcher: (d) => (d.tags || []).includes('thanh đạm') || (d.diet_flags || []).includes('vegan') || ['DISH-105', 'DISH-106'].includes(d.id),
    weight: 0.35,
    reason: 'Vị thanh mát, dồi dào rau xanh, giải nhiệt ngày oi bức',
  },
  high_protein: {
    keywords: ['nhieu dam', 'protein', 'tap gym', 'tang co', 'thit', 'chac bung'],
    matcher: (d) => (d.calories >= 450) || ['DISH-101', 'DISH-102', 'DISH-103'].includes(d.id),
    weight: 0.3,
    reason: 'Giàu đạm từ thịt bò, sườn heo tuyển chọn, no lâu chắc bụng',
  },
  spicy_tangy: {
    keywords: ['chua cay', 'cay nong', 'dam vi', 'kich thich vi giac', 'xa ot'],
    matcher: (d) => (d.spice_level >= 2) || ['DISH-103', 'DISH-107'].includes(d.id),
    weight: 0.3,
    reason: 'Đậm đà hương vị sả ớt, cay nồng kích thích vị giác',
  },
  quick_easy: {
    keywords: ['nhanh', 'gon', 'ban ron', 'it thoi gian', '15 phut', 'an voi'],
    matcher: (d) => (d.prep_time_minutes <= 25) || ['DISH-102', 'DISH-105'].includes(d.id),
    weight: 0.25,
    reason: 'Chế biến nhanh gọn dưới 25 phút, phù hợp khi bận rộn',
  },
  family_comfort: {
    keywords: ['com nha', 'gia dinh', 'am cung', 'truyen thong', 'kho to', 'canh chua'],
    matcher: (d) => ['DISH-106', 'DISH-102'].includes(d.id) || (d.region === 'Nam'),
    weight: 0.3,
    reason: 'Hương vị cơm nhà chuẩn vị gia đình sum vầy',
  },
};

/**
 * Tìm kiếm món ăn theo ngữ nghĩa tự nhiên (Semantic Concept Search)
 */
export function searchDishesSemantically(queryText = '', dishes = [], userProfile = {}) {
  const normQuery = removeVietnameseTones(queryText.toLowerCase().trim());
  if (!normQuery) {
    return {
      query: queryText,
      total: dishes.length,
      results: dishes.map(d => ({ ...d, similarity_pct: 80, match_reason: 'Gợi ý phổ biến hôm nay' })),
    };
  }

  // 1. Lọc bỏ tuyệt đối dị ứng (Hard Allergy Block - Non negotiable)
  const safeDishes = dishes.filter(d => isDishSafeForUser(d, userProfile));

  // 2. Phân tích các concept ngữ nghĩa xuất hiện trong câu truy vấn
  const matchedConcepts = [];
  for (const [key, concept] of Object.entries(SEMANTIC_CONCEPTS)) {
    const isHit = concept.keywords.some(kw => normQuery.includes(kw));
    if (isHit) {
      matchedConcepts.push({ key, ...concept });
    }
  }

  // 3. Tính điểm tương đồng ngữ nghĩa (Semantic Similarity Score 0..100)
  const scoredDishes = safeDishes.map(dish => {
    let score = 50; // Điểm cơ sở
    const reasons = [];

    // Khớp tên món hoặc mô tả trực tiếp
    const normDish = removeVietnameseTones(`${dish.name} ${dish.description || ''} ${(dish.tags || []).join(' ')}`.toLowerCase());
    const queryTokens = normQuery.split(/\s+/).filter(t => t.length > 1);
    let tokenMatches = 0;
    for (const token of queryTokens) {
      if (normDish.includes(token)) tokenMatches += 1;
    }
    if (queryTokens.length > 0) {
      score += (tokenMatches / queryTokens.length) * 25;
    }

    // Khớp các concepts ẩm thực
    for (const concept of matchedConcepts) {
      if (concept.matcher(dish)) {
        score += concept.weight * 50;
        reasons.push(concept.reason);
      }
    }

    // Điều chỉnh khẩu vị người dùng
    if (userProfile.spice_tolerance !== undefined && dish.spice_level <= userProfile.spice_tolerance) {
      score += 5;
    }
    if (userProfile.diet_mode && (dish.diet_flags || []).includes(userProfile.diet_mode)) {
      score += 10;
      reasons.push(`Phù hợp chế độ ăn ${userProfile.diet_mode}`);
    }

    const similarityPct = Math.min(99, Math.max(40, Math.round(score)));
    return {
      ...dish,
      similarity_pct: similarityPct,
      match_reasons: reasons.length > 0 ? reasons : ['Hương vị truyền thống hợp gu ẩm thực của bạn'],
    };
  });

  // 4. Sắp xếp theo độ tương đồng giảm dần
  scoredDishes.sort((a, b) => b.similarity_pct - a.similarity_pct);

  return {
    query: queryText,
    detected_concepts: matchedConcepts.map(c => c.key),
    total_safe_matched: scoredDishes.length,
    results: scoredDishes.slice(0, 5),
  };
}
