// W — Consumer Web / PWA (W-S01..W-S05). The desktop web screens reuse the core
// endpoints (suggestions, dishes, places, orders, auth). The only path the core does
// not answer is the public curated collections of W-S05: GET /api/v1/collections/public.
// Curated collections are demo records (module_records, is_demo) that point at the
// existing catalogue ids; each read applies the caller's hard allergy filter.
import { isDishSafeForUser } from '../services/recommender.js';

const M = 'W';

const seed = () => [
  { kind: 'collection', id: 'W-COL-NUOC-AM', data: {
    slug: 'mon-nuoc-am-bung-ngay-mua', title: 'Top Món Nước Ấm Bụng Ngày Mưa',
    tags: ['Ngày mưa'], region: 'toan_quoc', img_key: '310', sort: 1,
    description: 'Những tô nước dùng nóng hổi cho chiều mưa Biên Hòa: phở, bún bò, canh chua, mì Quảng.',
    dish_ids: ['DISH-101', 'DISH-103', 'DISH-106', 'DISH-105', 'DISH-111'], story_id: null } },
  { kind: 'collection', id: 'W-COL-COM-NHA-NAM', data: {
    slug: 'mam-com-gia-dinh-mien-nam', title: 'Mâm Cơm Gia Đình Miền Nam',
    tags: ['Cơm nhà'], region: 'nam', img_key: '304', sort: 2,
    description: 'Cơm tấm, canh chua cá lóc, bò hầm rau củ — mâm cơm quen thuộc của người miền Nam.',
    dish_ids: ['DISH-102', 'DISH-105', 'DISH-108', 'DISH-110'], story_id: 'STORY-COM-TAM' } },
  { kind: 'collection', id: 'W-COL-PHO-BUN', data: {
    slug: 'hanh-trinh-pho-bun-viet-nam', title: 'Hành Trình Phở & Bún Việt Nam',
    tags: ['Di sản', '3 Miền'], region: 'toan_quoc', img_key: '298', sort: 3,
    description: 'Từ phở Hà Nội, bún riêu, bún bò Huế đến mì Quảng: sợi bánh và nước dùng qua ba miền.',
    dish_ids: ['DISH-101', 'DISH-106', 'DISH-103', 'DISH-111'], story_id: 'STORY-PHO' } }
];

const dishCard = d => ({ id: d.id, name: d.name, region: d.region, ref_price: d.ref_price, calories: d.calories,
  prep_minutes: d.prep_minutes, tags: d.tags || [], img_key: d.img_key, allergen_tags: d.allergen_tags || [] });

/** Resolve a collection against the live catalogue: safe dishes shown, unsafe only counted. */
function resolve(c, byId, profile) {
  const dishes = (c.dish_ids || []).map(id => byId.get(id)).filter(Boolean);
  const safe = dishes.filter(d => isDishSafeForUser(d, profile));
  const prices = safe.map(d => Number(d.ref_price)).filter(Number.isFinite);
  return {
    id: c.id, slug: c.slug, title: c.title, description: c.description, region: c.region,
    tags: c.tags || [], img_key: c.img_key, story_id: c.story_id || null,
    dish_count: safe.length, hidden_by_allergy: dishes.length - safe.length,
    max_price: prices.length ? Math.max(...prices) : null,
    is_demo: c.is_demo === true,
    dishes: safe.map(dishCard)
  };
}

export default {
  id: M,
  seed,
  async route({ ms, repo, method, pathname, profile, util }) {
    if (!pathname.startsWith('/api/v1/collections/public')) return null;
    if (method !== 'GET') return { status: 405, data: { error: 'Chỉ hỗ trợ GET' } };
    const all = (await ms.list(M, 'collection')).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const byId = new Map((await repo.listDishes()).map(d => [d.id, d]));
    if (pathname === '/api/v1/collections/public') {
      const items = all.map(c => resolve(c, byId, profile));
      return { status: 200, data: { total: items.length, items, is_demo: items.some(i => i.is_demo),
        applied_allergies: [...(profile?.hard_allergies || [])] } };
    }
    const one = pathname.match(/^\/api\/v1\/collections\/public\/([^/]+)$/);
    if (!one) return util.notFound();
    const key = util.cleanText(decodeURIComponent(one[1]), 80);
    const c = all.find(x => x.id === key || x.slug === key);
    if (!c) return util.notFound('Không tìm thấy bộ sưu tập');
    return { status: 200, data: { ...resolve(c, byId, profile), applied_allergies: [...(profile?.hard_allergies || [])] } };
  }
};
