// M9-S07 — pre-checks an admin sees before letting an M7 campaign run in the "Tài trợ" slot.
// Every check is computed from stored data (campaign row, catalogue dish, place menu); nothing
// is assumed. The 1/3 sponsored-slot cap and the allergy hard filter are enforced at serving
// time by the recommender for every user (src/services/recommender.js), so they are reported as
// serving rules, not as something this campaign could pass or fail.
export const SPONSOR_LABEL = 'Tài trợ';
export const MODERATION_DECISIONS = ['active', 'rejected', 'paused'];

const ALLERGEN_VI = { shrimp: 'tôm', peanut: 'đậu phộng', milk: 'sữa', gluten: 'gluten', egg: 'trứng', soy: 'đậu nành', fish: 'cá', crab: 'cua', shellfish: 'hải sản có vỏ' };

export function moderationChecks(campaign, dish, place) {
  const menu = (place?.menu || []).find(m => m.dish_id === campaign?.dish_id) || null;
  const tags = Array.isArray(dish?.allergen_tags) ? dish.allergen_tags : null;
  const spice = Number.isFinite(Number(dish?.spice_level)) && dish?.spice_level !== null && dish?.spice_level !== undefined ? Number(dish.spice_level) : null;
  const price = Number.isSafeInteger(Number(menu?.price)) && Number(menu.price) > 0 ? Number(menu.price) : null;
  const checks = [
    { key: 'sponsor_label', ok: campaign?.badge_label === SPONSOR_LABEL,
      label: campaign?.badge_label === SPONSOR_LABEL ? 'Có nhãn Tài trợ' : 'Thiếu nhãn "Tài trợ"' },
    { key: 'allergens_declared', ok: !!dish && tags !== null && spice !== null,
      label: !dish ? 'Món không có trong thư viện' : tags === null ? 'Chưa khai báo dị ứng'
        : spice === null ? 'Chưa khai báo độ cay'
        : `Đã khai báo dị ứng (${tags.length ? tags.map(t => ALLERGEN_VI[t] || t).join(', ') : 'không có'}) & độ cay ${spice}/3` },
    { key: 'menu_price', ok: !!place && price !== null,
      label: !place ? 'Quán không tồn tại' : price === null ? 'Món chưa có giá trên thực đơn quán' : 'Giá có trên thực đơn quán' }
  ];
  return {
    checks,
    ready: checks.every(c => c.ok),
    price_vnd: price,
    serving_rules: { max_sponsored_ratio: '1/3', badge_label: SPONSOR_LABEL, hard_allergy_filter: true,
      note: 'Trần ≤ 1/3 slot và bộ lọc dị ứng cứng được áp khi phân phối cho từng người dùng.' }
  };
}
