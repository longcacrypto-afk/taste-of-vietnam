// M14 — Văn hoá & Câu chuyện món (M14-S01 story, M14-S02 regional variants).
// Reference module for the live-module kit (src/modules/index.js).
const M = 'M14';

const seed = () => [
  { kind: 'story', id: 'STORY-PHO', data: {
    slug: 'hanh-trinh-pho-viet', dish_id: 'DISH-101', title: 'Hành Trình Trăm Năm Của Phở Việt',
    tag: 'Di sản Văn hóa Phi vật thể', region: 'Bắc – Nam', read_min: 4, img_key: '760',
    summary: 'Khám phá sự khác biệt tinh tế giữa nước dùng thanh trong của Phở Bắc và đĩa rau thơm, tương đen phóng khoáng của Phở Nam.',
    body: ['Phở ra đời ở vùng Nam Định – Hà Nội đầu thế kỷ 20, từ gánh hàng rong buổi sớm.',
      'Sau 1954, phở theo người di cư vào Nam và được thêm giá, rau húng, tương đen, tương đỏ.',
      'Năm 2024 nghề phở Nam Định và phở Hà Nội được ghi danh Di sản văn hoá phi vật thể quốc gia.'],
    variants: [
      { region: 'bac', name: 'Phở Hà Nội (Miền Bắc)', description: 'Bánh phở bản to, nước dùng trong thanh ngọt từ xương, ăn kèm quẩy giòn và dấm tỏi ớt.' },
      { region: 'nam', name: 'Phở Sài Gòn (Miền Nam)', description: 'Nước dùng đậm đà hơi ngọt nhẹ, ăn kèm giá trụng, húng quế, ngò gai, tương đen & tương đỏ.' }
    ] } },
  { kind: 'story', id: 'STORY-COM-TAM', data: {
    slug: 'com-tam-sai-gon', dish_id: 'DISH-102', title: 'Cơm Tấm: Từ Hạt Gạo Vỡ Đến Món Ăn Biểu Tượng Sài Gòn',
    tag: 'Ẩm thực đường phố', region: 'Miền Nam', read_min: 3, img_key: '304',
    summary: 'Hạt gạo tấm từng là phần bỏ đi của nhà nông, nay thành đĩa cơm sườn bì chả không thể thiếu mỗi sáng Sài Gòn.',
    body: ['Gạo tấm là hạt gạo vỡ khi xay xát, xưa dành cho người nghèo.',
      'Người Sài Gòn thêm sườn nướng than, bì, chả trứng và mỡ hành để thành món đặc trưng.'],
    variants: [
      { region: 'nam', name: 'Cơm tấm Sài Gòn', description: 'Sườn cốt lết nướng mật ong, bì thính, chả trứng, nước mắm chua ngọt.' },
      { region: 'trung', name: 'Cơm tấm Phan Rang', description: 'Ăn kèm cá, chả cá và nước mắm cay, ít ngọt hơn kiểu Sài Gòn.' }
    ] } },
  { kind: 'story', id: 'STORY-BUN-BO', data: {
    slug: 'bun-bo-hue', dish_id: 'DISH-103', title: 'Bún Bò Huế Và Vị Mắm Ruốc Của Cố Đô',
    tag: 'Đặc sản Cố đô', region: 'Miền Trung', read_min: 3, img_key: '310',
    summary: 'Nồi nước dùng sả, mắm ruốc và ớt sa tế làm nên tô bún đậm đà nhất của miền Trung.',
    body: ['Bún bò Huế dùng sợi bún to, nước dùng hầm xương bò, giò heo, nêm mắm ruốc.',
      'Khi vào Nam, món được bớt cay, thêm rau sống và giá.'],
    variants: [
      { region: 'trung', name: 'Bún bò Huế gốc', description: 'Cay nồng, mắm ruốc rõ vị, ăn với rau muống chẻ, bắp chuối bào.' },
      { region: 'nam', name: 'Bún bò kiểu Sài Gòn', description: 'Bớt cay, nhiều topping, ăn kèm giá, rau thơm và chanh.' }
    ] } }
];

const pub = s => ({ id: s.id, slug: s.slug, dish_id: s.dish_id, title: s.title, tag: s.tag, region: s.region,
  read_min: s.read_min, img_key: s.img_key, summary: s.summary, is_demo: s.is_demo });

export default {
  id: M,
  seed,
  // Early: core router answers /stories/:dishId with a generated dish story; M14 owns /stories/*.
  async routeEarly({ ms, method, pathname, searchParams, util }) {
    if (pathname === '/api/v1/stories' && method === 'GET') {
      const dish = searchParams.get('dish_id');
      const items = (await ms.list(M, 'story')).filter(s => !dish || s.dish_id === dish).map(pub);
      return { status: 200, data: { total: items.length, items, stories: items } };
    }
    const one = pathname.match(/^\/api\/v1\/stories\/([^/]+)(\/variants)?$/);
    if (one && method === 'GET') {
      const all = await ms.list(M, 'story');
      const s = all.find(x => x.id === one[1] || x.slug === one[1]);
      // Unknown id: fall through to the core /stories/:dishId generated story.
      if (!s) return one[2] ? util.notFound('Không tìm thấy câu chuyện') : null;
      if (one[2]) return { status: 200, data: { story_id: s.id, dish_id: s.dish_id, title: s.title, items: s.variants || [], is_demo: s.is_demo } };
      return { status: 200, data: { ...pub(s), body: s.body || [], variants: s.variants || [] } };
    }
    return null;
  }
};
