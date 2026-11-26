// M16 — Dịch menu cho du khách (M16-S01 translator, M16-S02 pronunciation/ordering card).
// No LLM is available, so translation is a built-in glossary: every catalogue dish has a
// hand-written EN/KO/JA/ZH title + note, plus a dictionary of common menu words. A line
// that matches a catalogue dish gets the dish translation and the catalogue allergen
// tags; a line made only of known words gets a word-by-word gloss marked 'partial'; a
// line with no known word is returned as 'chưa dịch được' — nothing is ever invented.
// The Vietnamese name is always kept. Each request is logged (counts only, no menu text)
// for the anonymised M17 insights.
const M = 'M16';
export const LANGS = ['EN', 'KO', 'JA', 'ZH'];
const LANG_LABEL = { EN: 'English', KO: '한국어', JA: '日本語', ZH: '中文' };
const UNTRANSLATED = 'chưa dịch được';

// ---------------------------------------------------------------- dish glossary
// aliases: lowercase Vietnamese phrases a menu line may use for this dish.
export const DISH_GLOSSARY = {
  'DISH-101': { aliases: ['phở bò tái nạm', 'phở tái nạm', 'phở bò tái', 'phở bò', 'phở hà nội'], container: 'tô',
    EN: ['Hanoi beef pho (rare & flank)', 'Rice noodle soup in a clear beef-bone broth with star anise and charred ginger.'],
    KO: ['하노이식 소고기 쌀국수 (타이·남)', '팔각과 구운 생강을 넣어 맑게 우린 사골 육수 쌀국수.'],
    JA: ['ハノイ風牛肉フォー（レア＆バラ）', '八角と焼き生姜で香りづけした澄んだ牛骨スープの米麺。'],
    ZH: ['河内生熟牛肉粉', '八角与烤姜慢熬的清澈牛骨汤米粉。'] },
  'DISH-102': { aliases: ['cơm tấm sườn bì chả', 'cơm tấm sườn', 'cơm tấm'], container: 'dĩa',
    EN: ['Broken rice with grilled pork chop, shredded pork skin & egg meatloaf', 'Saigon classic: honey-marinated chop grilled over charcoal, pickles and sweet fish sauce.'],
    KO: ['껌땀 (숯불 돼지갈비·껍데기·계란찜 덮밥)', '꿀에 재운 돼지갈비 숯불구이, 절임채소와 새콤달콤한 피시소스.'],
    JA: ['コムタム（炭火焼き豚・豚皮・卵蒸しの砕き米ご飯）', 'はちみつ漬け豚の炭火焼き、なます、甘酸っぱいヌックマム。'],
    ZH: ['碎米饭配炭烤猪排、猪皮丝与蛋肉饼', '蜂蜜腌猪排炭火烤，配腌菜与酸甜鱼露。'] },
  'DISH-103': { aliases: ['bún bò huế', 'bún bò'], container: 'tô',
    EN: ['Hue spicy beef noodle soup (bún bò Huế)', 'Thick rice noodles in a lemongrass and fermented shrimp-paste beef broth.'],
    KO: ['분보후에 (후에식 매콤 소고기 쌀국수)', '레몬그라스와 새우젓으로 맛을 낸 소고기 육수의 굵은 쌀국수.'],
    JA: ['ブンボーフエ（フエ風ピリ辛牛肉麺）', 'レモングラスと発酵エビペーストの牛骨スープに太い米麺。'],
    ZH: ['顺化辣味牛肉米线', '香茅与虾酱调味的牛骨汤配粗米线。'] },
  'DISH-104': { aliases: ['bánh mì thịt nướng', 'bánh mì thịt', 'bánh mì'], container: 'ổ',
    EN: ['Bánh mì with grilled lemongrass pork', 'Crispy baguette with grilled pork, pickled carrot & radish, cucumber and coriander.'],
    KO: ['반미 (레몬그라스 돼지고기구이 샌드위치)', '바삭한 바게트에 돼지고기구이, 당근·무 절임, 오이, 고수.'],
    JA: ['バインミー（レモングラス焼き豚）', 'カリカリのバゲットに焼き豚、なます、きゅうり、パクチー。'],
    ZH: ['越式烤肉法棍（香茅烤猪肉）', '酥脆法棍夹香茅烤猪肉、腌萝卜胡萝卜、黄瓜与香菜。'] },
  'DISH-105': { aliases: ['canh chua cá lóc miền tây', 'canh chua cá lóc', 'canh chua cá', 'canh chua'], container: 'tô',
    EN: ['Mekong sour soup with snakehead fish', 'Tamarind and pineapple broth with freshwater fish, okra, bean sprouts and elephant-ear stem.'],
    KO: ['메콩식 가물치 새콤 수프 (깐쭈어)', '타마린드와 파인애플 국물에 민물고기, 오크라, 숙주.'],
    JA: ['メコン風ライギョの甘酸っぱいスープ', 'タマリンドとパイナップルのスープに川魚、オクラ、もやし。'],
    ZH: ['湄公河酸汤黑鱼', '罗望子与菠萝酸汤配淡水黑鱼、秋葵与豆芽。'] },
  'DISH-106': { aliases: ['bún riêu cua tôm giò', 'bún riêu cua', 'bún riêu'], container: 'tô',
    EN: ['Crab & shrimp noodle soup with pork roll (bún riêu)', 'Tomato broth with field-crab paste, shrimp, tofu and rice vermicelli.'],
    KO: ['분리에우 (게·새우 토마토 쌀국수)', '논게 살과 새우, 두부를 넣은 토마토 육수 쌀국수.'],
    JA: ['ブンリエウ（カニ・エビのトマト麺）', '田ガニのすり身、エビ、豆腐入りトマトスープの米麺。'],
    ZH: ['蟹膏虾肉番茄米线', '番茄汤底配田蟹膏、虾、豆腐与米线。'] },
  'DISH-107': { aliases: ['gỏi cuốn tôm thịt', 'gỏi cuốn'], container: 'phần',
    EN: ['Fresh spring rolls with shrimp & pork, peanut sauce', 'Rice-paper rolls with herbs and vermicelli, dipped in peanut hoisin sauce.'],
    KO: ['고이꾸온 (새우·돼지고기 월남쌈, 땅콩소스)', '허브와 쌀국수를 넣은 라이스페이퍼 롤, 땅콩 해선장 소스.'],
    JA: ['生春巻き（エビ・豚肉、ピーナッツソース）', '香草とビーフンを巻いたライスペーパー、ピーナッツ味噌だれ。'],
    ZH: ['鲜虾猪肉米纸卷配花生酱', '米纸包香草与米线，蘸花生海鲜酱。'] },
  'DISH-108': { aliases: ['bò hầm rau củ', 'bò kho bánh mì', 'bò hầm', 'combo phở & bò hầm'], container: 'phần',
    EN: ['Beef stew with vegetables & bread', 'Slow-braised beef with potato and carrot, mild and not spicy.'],
    KO: ['소고기 채소 스튜와 빵', '감자와 당근을 넣고 푹 끓인 순한 소고기 스튜.'],
    JA: ['牛肉と野菜の煮込み＆パン', 'じゃがいもと人参でじっくり煮込んだ辛くない牛肉シチュー。'],
    ZH: ['蔬菜炖牛肉配面包', '土豆胡萝卜慢炖牛肉，不辣。'] },
  'DISH-109': { aliases: ['bánh xèo miền trung', 'bánh xèo'], container: 'phần',
    EN: ['Crispy Vietnamese pancake with shrimp & pork (bánh xèo)', 'Turmeric rice-batter crêpe with bean sprouts, wrapped in herbs and dipped in fish sauce.'],
    KO: ['반쎄오 (새우·돼지고기 베트남식 부침개)', '강황 쌀반죽 부침에 숙주, 허브에 싸서 피시소스에 찍어 먹어요.'],
    JA: ['バインセオ（エビ・豚肉入りベトナム風お好み焼き）', 'ターメリック入り米粉の生地にもやし、香草で包みヌックマムで。'],
    ZH: ['越式煎饼（虾仁猪肉）', '姜黄米浆煎饼夹豆芽，包香草蘸鱼露。'] },
  'DISH-110': { aliases: ['canh chua cá lóc bông điên điển', 'canh chua bông điên điển'], container: 'tô',
    EN: ['Sour snakehead fish soup with sesbania flowers', 'Young-tamarind broth with snakehead fish, tomato and yellow sesbania flowers.'],
    KO: ['세스바니아꽃 가물치 새콤 수프', '어린 타마린드 국물에 가물치, 토마토, 노란 세스바니아꽃.'],
    JA: ['ディエンディエンの花入りライギョの酸味スープ', '若いタマリンドのスープにライギョ、トマト、黄色い花。'],
    ZH: ['田菁花酸汤黑鱼', '嫩罗望子汤底配黑鱼、番茄与黄色田菁花。'] },
  'DISH-111': { aliases: ['mì quảng gà ta trứng cút', 'mì quảng gà', 'mì quảng'], container: 'tô',
    EN: ['Quang-style turmeric noodles with chicken & quail eggs', 'Yellow rice noodles with a little rich broth, toasted sesame rice cracker and roasted peanuts.'],
    KO: ['미꽝 (닭고기·메추리알 꽝남식 국수)', '진한 육수를 자작하게 부은 노란 쌀국수, 참깨 라이스크래커와 볶은 땅콩.'],
    JA: ['ミークアン（鶏肉・うずら卵のクアンナム麺）', '少なめの濃厚スープに黄色い米麺、ごませんべいと炒りピーナッツ。'],
    ZH: ['广南鸡肉鹌鹑蛋米粉（广面）', '少量浓汤配黄色米粉、芝麻米饼与烤花生。'] },
  'DISH-112': { aliases: ['chả giò nấm hạt sen chay', 'chả giò chay', 'chả giò nấm'], container: 'phần',
    EN: ['Vegetarian fried spring rolls with mushroom & lotus seed', 'Crispy rolls filled with mushrooms, taro, lotus seeds and glass noodles (vegetarian).'],
    KO: ['채식 짜조 (버섯·연밥 튀김 춘권)', '버섯, 토란, 연밥, 당면을 넣은 바삭한 채식 튀김 춘권.'],
    JA: ['精進揚げ春巻き（きのこ・蓮の実）', 'きのこ、タロイモ、蓮の実、春雨入りのベジタリアン揚げ春巻き。'],
    ZH: ['素炸春卷（蘑菇莲子）', '蘑菇、芋头、莲子与粉丝馅的素食炸春卷。'] }
};

// ---------------------------------------------------------------- word glossary
// [vi, EN, KO, JA, ZH]; multi-word entries are matched first (longest match wins).
const WORDS = [
  ['bánh mì', 'baguette sandwich', '반미', 'バインミー', '法棍'], ['bánh xèo', 'crispy pancake', '반쎄오', 'バインセオ', '越式煎饼'],
  ['bánh canh', 'thick noodle soup', '반깐', 'バインカイン', '粗粉汤'], ['bánh cuốn', 'steamed rice rolls', '반꾸온', 'バインクオン', '越式粉卷'],
  ['chả giò', 'fried spring rolls', '짜조', '揚げ春巻き', '炸春卷'], ['gỏi cuốn', 'fresh spring rolls', '월남쌈', '生春巻き', '米纸卷'],
  ['cơm tấm', 'broken rice', '껌땀', 'コムタム', '碎米饭'], ['hủ tiếu', 'clear noodle soup', '후띠우', 'フーティウ', '粿条'],
  ['canh chua', 'sour soup', '새콤한 수프', '酸味スープ', '酸汤'], ['nước mắm', 'fish sauce', '피시소스', 'ヌックマム', '鱼露'],
  ['đậu phộng', 'peanuts', '땅콩', 'ピーナッツ', '花生'], ['đậu hũ', 'tofu', '두부', '豆腐', '豆腐'], ['tàu hũ', 'tofu', '두부', '豆腐', '豆腐'],
  ['hải sản', 'seafood', '해산물', '海鮮', '海鲜'], ['thịt heo', 'pork', '돼지고기', '豚肉', '猪肉'], ['thịt bò', 'beef', '소고기', '牛肉', '牛肉'],
  ['thịt gà', 'chicken', '닭고기', '鶏肉', '鸡肉'], ['trứng cút', 'quail eggs', '메추리알', 'うずらの卵', '鹌鹑蛋'],
  ['rau muống', 'water spinach', '모닝글로리', '空芯菜', '空心菜'], ['cá lóc', 'snakehead fish', '가물치', 'ライギョ', '黑鱼'],
  ['cà phê sữa', 'coffee with condensed milk', '연유 커피', '練乳コーヒー', '炼乳咖啡'], ['cà phê', 'coffee', '커피', 'コーヒー', '咖啡'],
  ['trà đá', 'iced tea', '아이스티', '冷たいお茶', '冰茶'], ['nước dừa', 'coconut water', '코코넛 워터', 'ココナッツジュース', '椰子水'],
  ['sinh tố', 'smoothie', '스무디', 'スムージー', '奶昔'], ['nước ngọt', 'soft drink', '탄산음료', 'ソフトドリンク', '汽水'],
  ['đặc biệt', 'special (all toppings)', '스페셜', 'スペシャル', '特别'], ['thập cẩm', 'mixed', '모둠', 'ミックス', '什锦'],
  ['mì quảng', 'Quang noodles', '미꽝', 'ミークアン', '广面'], ['bún bò', 'beef noodle soup', '소고기 쌀국수', '牛肉麺', '牛肉米线'],
  ['bún chả', 'grilled pork with noodles', '분짜', 'ブンチャー', '烤肉米线'], ['bún riêu', 'crab noodle soup', '분리에우', 'カニ麺', '蟹汤米线'],
  ['lẩu', 'hot pot', '훠궈', '鍋', '火锅'], ['cháo', 'rice porridge', '죽', 'お粥', '粥'], ['xôi', 'sticky rice', '찹쌀밥', 'おこわ', '糯米饭'],
  ['phở', 'pho (rice noodle soup)', '쌀국수', 'フォー', '河粉'], ['bún', 'rice vermicelli', '분(쌀국수면)', 'ブン（米麺）', '米线'],
  ['cơm', 'rice', '밥', 'ご飯', '米饭'], ['mì', 'noodles', '면', '麺', '面'], ['miến', 'glass noodles', '당면', '春雨', '粉丝'],
  ['bò', 'beef', '소고기', '牛肉', '牛肉'], ['gà', 'chicken', '닭고기', '鶏肉', '鸡肉'], ['heo', 'pork', '돼지고기', '豚肉', '猪肉'],
  ['vịt', 'duck', '오리', '鴨', '鸭'], ['sườn', 'pork ribs', '돼지갈비', 'スペアリブ', '排骨'], ['tôm', 'shrimp', '새우', 'エビ', '虾'],
  ['cua', 'crab', '게', 'カニ', '蟹'], ['mực', 'squid', '오징어', 'イカ', '鱿鱼'], ['cá', 'fish', '생선', '魚', '鱼'],
  ['ốc', 'sea snails', '고둥', '巻貝', '螺'], ['nghêu', 'clams', '조개', 'アサリ', '蛤蜊'], ['trứng', 'egg', '달걀', '卵', '鸡蛋'],
  ['chay', 'vegetarian', '채식', 'ベジタリアン', '素食'], ['nướng', 'grilled', '구이', '焼き', '烤'], ['chiên', 'fried', '튀김', '揚げ', '炸'],
  ['xào', 'stir-fried', '볶음', '炒め', '炒'], ['luộc', 'boiled', '삶은', '茹で', '水煮'], ['hấp', 'steamed', '찜', '蒸し', '蒸'],
  ['kho', 'braised', '조림', '煮込み', '红烧'], ['quay', 'roasted', '로스트', 'ロースト', '烧'], ['tái', 'rare beef', '레어 소고기', 'レア牛肉', '生牛肉'],
  ['nạm', 'beef flank', '양지', '牛バラ', '牛腩'], ['gầu', 'fatty brisket', '차돌양지', '牛バラ脂身', '肥牛腩'], ['gân', 'beef tendon', '힘줄', '牛すじ', '牛筋'],
  ['sả', 'lemongrass', '레몬그라스', 'レモングラス', '香茅'], ['ớt', 'chili', '고추', '唐辛子', '辣椒'], ['tỏi', 'garlic', '마늘', 'にんにく', '大蒜'],
  ['rau', 'vegetables / herbs', '채소', '野菜', '蔬菜'], ['nấm', 'mushroom', '버섯', 'きのこ', '蘑菇'], ['đậu', 'beans', '콩', '豆', '豆'],
  ['gỏi', 'salad', '샐러드', 'サラダ', '凉拌'], ['canh', 'soup', '국', 'スープ', '汤'], ['chả', 'pork meatloaf', '짜(어묵·햄)', 'チャー（練り物）', '肉饼'],
  ['nem', 'spring roll / cured pork', '넴', 'ネム', '越南肉卷'], ['bì', 'shredded pork skin', '돼지껍데기', '豚皮', '猪皮丝'],
  ['sữa', 'milk', '우유', '牛乳', '牛奶'], ['đá', 'ice', '얼음', '氷', '冰'], ['dừa', 'coconut', '코코넛', 'ココナッツ', '椰子'],
  ['chè', 'sweet dessert soup', '쩨(디저트)', 'チェー（甘味）', '甜汤'], ['bánh', 'cake / rice cake', '반(떡·빵)', 'バイン（餅・パン）', '糕点']
].map(([vi, ...t]) => ({ vi, t: Object.fromEntries(LANGS.map((l, i) => [l, t[i]])) }))
  .sort((a, b) => b.vi.length - a.vi.length);
// Words that carry no dish meaning on a menu line (portion/container/connectors).
const FILLER = new Set(['và', 'với', 'kèm', 'phần', 'tô', 'dĩa', 'đĩa', 'ly', 'suất', 'cái', 'chén', 'nhỏ', 'lớn', 'vừa', 'món', 'size', 'thêm', 'không', '&', '+', '-', '/', '(', ')', ',']);

// Allergen words found in a line or in a dish description → catalogue allergen tag.
const ALLERGEN_WORDS = [['mắm tôm', 'shrimp_paste'], ['mắm ruốc', 'shrimp_paste'], ['đậu phộng', 'peanut'], ['lạc', 'peanut'], ['tôm', 'shrimp'],
  ['cua', 'shellfish'], ['nghêu', 'shellfish'], ['ốc', 'shellfish'], ['hải sản', 'shellfish'], ['mực', 'shellfish'], ['trứng', 'egg'], ['cá', 'fish'],
  ['nước mắm', 'fish'], ['bánh mì', 'gluten'], ['bột mì', 'gluten'], ['sữa', 'dairy'], ['đậu nành', 'soy'], ['đậu hũ', 'soy'], ['tàu hũ', 'soy']];

export const ALLERGEN_LABEL = {
  shrimp: { VI: 'tôm', EN: 'shrimp', KO: '새우', JA: 'エビ', ZH: '虾' },
  peanut: { VI: 'đậu phộng', EN: 'peanuts', KO: '땅콩', JA: 'ピーナッツ', ZH: '花生' },
  egg: { VI: 'trứng', EN: 'egg', KO: '달걀', JA: '卵', ZH: '鸡蛋' },
  gluten: { VI: 'gluten (lúa mì)', EN: 'gluten (wheat)', KO: '글루텐(밀)', JA: 'グルテン（小麦）', ZH: '麸质（小麦）' },
  fish: { VI: 'cá', EN: 'fish', KO: '생선', JA: '魚', ZH: '鱼' },
  shellfish: { VI: 'hải sản có vỏ', EN: 'shellfish', KO: '갑각류·조개류', JA: '甲殻類・貝類', ZH: '贝类海鲜' },
  shrimp_paste: { VI: 'mắm tôm/mắm ruốc', EN: 'fermented shrimp paste', KO: '새우젓', JA: 'エビの発酵ペースト', ZH: '虾酱' },
  dairy: { VI: 'sữa', EN: 'milk / dairy', KO: '유제품', JA: '乳製品', ZH: '乳制品' },
  soy: { VI: 'đậu nành', EN: 'soy', KO: '대두', JA: '大豆', ZH: '大豆' }
};
const CONTAINS = { EN: (x) => `Contains ${x}. Please confirm with the restaurant.`, KO: (x) => `${x} 포함. 식당에 꼭 확인하세요.`,
  JA: (x) => `${x}を含みます。お店に確認してください。`, ZH: (x) => `含有${x}。请向餐厅确认。` };
const MAY_CONTAIN = { EN: (x) => `May contain ${x} (from the recipe description).`, KO: (x) => `${x}이(가) 들어갈 수 있어요 (레시피 설명 기준).`,
  JA: (x) => `${x}が入っている可能性があります（レシピ説明より）。`, ZH: (x) => `可能含有${x}（根据菜品说明）。` };
const SEP = { EN: ', ', KO: ', ', JA: '、', ZH: '、' };
const ORDER = { EN: t => `One ${t}, please.`, KO: t => `${t} 하나 주세요.`, JA: t => `${t}を一つください。`, ZH: t => `请给我一份${t}。` };

// Fixed ordering/allergy phrases for the pronunciation card (M16-S02).
const PHRASES = [
  { id: 'no-onion', kind: 'order', vi: 'Cho tôi không hành', EN: 'No green onions, please.', KO: '파는 빼 주세요.', JA: 'ネギ抜きでお願いします。', ZH: '请不要放葱。' },
  { id: 'not-spicy', kind: 'allergy', vi: 'Làm ơn không cay', EN: 'Not spicy, please.', KO: '안 맵게 해 주세요.', JA: '辛くしないでください。', ZH: '请不要辣。' },
  { id: 'no-peanut', kind: 'allergy', vi: 'Làm ơn không cho đậu phộng', EN: 'No peanuts, please.', KO: '땅콩은 빼 주세요.', JA: 'ピーナッツ抜きでお願いします。', ZH: '请不要放花生。' },
  { id: 'no-seafood', kind: 'allergy', vi: 'Làm ơn không cho hải sản', EN: 'No seafood, please.', KO: '해산물은 빼 주세요.', JA: '海鮮抜きでお願いします。', ZH: '请不要放海鲜。' },
  { id: 'allergy-shrimp-peanut', kind: 'allergy', vi: 'Tôi bị dị ứng tôm và đậu phộng', EN: 'I am allergic to shrimp and peanuts.', KO: '저는 새우와 땅콩 알레르기가 있어요.', JA: '私はエビとピーナッツのアレルギーがあります。', ZH: '我对虾和花生过敏。' },
  { id: 'ask-shrimp', kind: 'allergy', vi: 'Món này có tôm không?', EN: 'Does this dish contain shrimp?', KO: '이 음식에 새우가 들어가나요?', JA: 'この料理にエビは入っていますか？', ZH: '这道菜有虾吗？' },
  { id: 'bill', kind: 'order', vi: 'Tính tiền giúp tôi', EN: 'The bill, please.', KO: '계산해 주세요.', JA: 'お会計お願いします。', ZH: '请结账。' }
];
const ALLERGIC_TO = { EN: x => `I am allergic to ${x}.`, KO: x => `저는 ${x} 알레르기가 있어요.`, JA: x => `私は${x}のアレルギーがあります。`, ZH: x => `我对${x}过敏。` };
const AND = { VI: ' và ', EN: ' and ', KO: '와(과) ', JA: 'と', ZH: '和' };

const seed = () => [
  // Reference exchange rates for the price hint. Demo values, replaced by a real feed later.
  { kind: 'fx', id: 'M16-FX-REF', data: { base: 'VND', as_of: '2026-11-01', source: 'Tỷ giá tham khảo (demo)',
    rates: { USD: 25400, KRW: 18.2, JPY: 168, CNY: 3500 } } }
];
const FX_CUR = { EN: ['USD', v => `$${v.toFixed(2)}`], KO: ['KRW', v => `₩${Math.round(v).toLocaleString('en-US')}`],
  JA: ['JPY', v => `¥${Math.round(v).toLocaleString('en-US')}`], ZH: ['CNY', v => `¥${v.toFixed(1)}`] };

// ---------------------------------------------------------------- helpers
const norm = s => String(s || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const plain = s => norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const lang = v => (LANGS.includes(String(v || '').toUpperCase()) ? String(v).toUpperCase() : null);

/** Strip a trailing/leading price ("45.000đ", "45k", "45,000 VND") and return it. */
export function splitPrice(line) {
  let price = null;
  const re = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|đ|d|vnd|vnđ|₫)?(?=\s|$|\))/gi;
  const name = line.replace(re, (m, num, unit) => {
    let v = Number(num.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
    if (!Number.isFinite(v)) return m;
    if (unit && /^(k|nghìn|ngàn)$/i.test(unit)) v *= 1000;
    if (v >= 1000 && v <= 50_000_000) { price = Math.round(v); return ' '; }
    return m;
  }).replace(/\s+/g, ' ').replace(/^[\s\-–:·.]+|[\s\-–:·.]+$/g, '').trim();
  return { name, price };
}

function matchDish(name, dishes) {
  const n = norm(name), p = plain(name);
  let best = null;
  for (const d of dishes) {
    const g = DISH_GLOSSARY[d.id];
    const aliases = [norm(d.name), ...(g?.aliases || [])];
    for (const a of aliases) {
      const hit = (n.includes(a) && 2) || (a.split(' ').length >= 2 && p.includes(plain(a)) && 1);
      if (hit && (!best || a.length * 10 + hit > best.score)) best = { dish: d, score: a.length * 10 + hit, exact: hit === 2 };
    }
  }
  return best;
}

function gloss(name, L) {
  let rest = ` ${norm(name).replace(/[(),/&+]/g, ' ')} `;
  const found = [];
  for (const w of WORDS) {
    const key = ` ${w.vi} `;
    let i;
    while ((i = rest.indexOf(key)) >= 0) { found.push({ at: i, vi: w.vi, t: w.t[L] }); rest = rest.slice(0, i) + ' ' + '\u0000'.repeat(w.vi.length) + ' ' + rest.slice(i + key.length); }
  }
  const unknown = rest.split(' ').filter(x => x && !/^\u0000+$/.test(x) && !FILLER.has(x) && !/^\d+$/.test(x));
  found.sort((a, b) => a.at - b.at);
  return { words: found, unknown };
}

function allergensFromText(text) {
  const n = ` ${norm(text)} `, out = new Set();
  let rest = n;
  for (const [w, tag] of [...ALLERGEN_WORDS].sort((a, b) => b[0].length - a[0].length)) {
    if (rest.includes(` ${w} `) || rest.includes(` ${w},`) || rest.includes(` ${w}.`)) { out.add(tag); rest = rest.split(w).join(' '); }
  }
  return [...out];
}

const label = (tags, L) => tags.map(t => ALLERGEN_LABEL[t]?.[L] || t).join(SEP[L]);

function priceHint(price, L, fx) {
  if (!price || !fx?.rates) return null;
  const [cur, fmt] = FX_CUR[L];
  const rate = fx.rates[cur];
  return rate ? { currency: cur, amount: fmt(price / rate), note: fx.source } : null;
}

export function translateLine(raw, L, dishes, fx) {
  const line = String(raw).slice(0, 160);
  const { name, price } = splitPrice(line);
  const base = { line, original_vietnamese_name: name || line, price_vnd: price, price_hint: priceHint(price, L, fx) };
  const hit = name ? matchDish(name, dishes) : null;
  const dish = hit?.dish;
  if (dish) {
    const g = DISH_GLOSSARY[dish.id];
    const [title, note] = g?.[L] || [null, null];
    const tags = dish.allergen_tags || [];
    const extra = allergensFromText([dish.name, dish.description, ...(dish.ingredients || []).map(i => i.name)].join(' , '))
      .filter(t => !tags.includes(t) && !(t === 'shellfish' && tags.includes('shrimp')));
    const phraseVi = `Cho tôi một ${g?.container || 'phần'} ${hit.exact ? name : dish.name}`;
    return { ...base, status: title ? 'translated' : 'untranslated', status_label: title ? 'Đã dịch theo từ điển món' : UNTRANSLATED,
      matched_dish_id: dish.id, catalogue_name: dish.name, translated_title: title, cultural_note: note,
      allergen_tags: tags, possible_allergen_tags: extra,
      allergen_warning: tags.length ? CONTAINS[L](label(tags, L)) : null,
      allergen_warning_vi: tags.length ? `Có ${label(tags, 'VI')} — hãy xác nhận lại với quán.` : null,
      possible_allergen_warning: extra.length ? MAY_CONTAIN[L](label(extra, L)) : null,
      ordering_phrase_vi: phraseVi, ordering_phrase: title ? ORDER[L](title) : null,
      price_vnd: price ?? null };
  }
  const { words, unknown } = gloss(name || line, L);
  const tags = allergensFromText(name || line);
  const warn = tags.length ? CONTAINS[L](label(tags, L)) : null;
  const syl = s => s.split(' ').length;
  const known = words.reduce((a, w) => a + syl(w.vi), 0);
  // Mostly unknown words: a gloss of one word would mislead, so it stays untranslated.
  if (!words.length || known < unknown.length) {
    return { ...base, status: 'untranslated', status_label: UNTRANSLATED, matched_dish_id: null, translated_title: null,
      cultural_note: null, unknown_words: unknown, known_words: words.map(w => w.vi), allergen_tags: tags, possible_allergen_tags: [], allergen_warning: warn,
      allergen_warning_vi: tags.length ? `Có thể có ${label(tags, 'VI')} — hãy hỏi quán.` : null,
      ordering_phrase_vi: name ? `Cho tôi một phần ${name}` : null, ordering_phrase: null };
  }
  const title = words.map(w => w.t).join(' · ');
  return { ...base, status: 'partial', status_label: unknown.length ? `Dịch từng từ — còn từ ${UNTRANSLATED}` : 'Dịch từng từ theo từ điển',
    matched_dish_id: null, translated_title: title, word_gloss: words.map(w => ({ vi: w.vi, t: w.t })), unknown_words: unknown,
    cultural_note: null, allergen_tags: tags, possible_allergen_tags: [], allergen_warning: warn,
    allergen_warning_vi: tags.length ? `Có thể có ${label(tags, 'VI')} — hãy hỏi quán.` : null,
    ordering_phrase_vi: `Cho tôi một phần ${name}`, ordering_phrase: ORDER[L](title) };
}

function phraseCards(L, dishes, profile) {
  const cards = [];
  const allergies = (profile?.hard_allergies || []).filter(t => ALLERGEN_LABEL[t]);
  if (allergies.length) {
    const vi = 'Tôi bị dị ứng ' + allergies.map(t => ALLERGEN_LABEL[t].VI).join(AND.VI);
    cards.push({ id: 'my-allergies', kind: 'allergy', vi, translation: ALLERGIC_TO[L](allergies.map(t => ALLERGEN_LABEL[t][L]).join(AND[L])), from_profile: true });
  }
  for (const d of dishes) {
    const g = DISH_GLOSSARY[d.id];
    if (!g?.[L]) continue;
    const vi = `Cho tôi một ${g.container} ${d.name}`;
    cards.push({ id: 'order-' + d.id, kind: 'order', dish_id: d.id, vi, translation: ORDER[L](g[L][0]),
      allergen_tags: d.allergen_tags || [] });
  }
  for (const p of PHRASES) cards.push({ id: p.id, kind: p.kind, vi: p.vi, translation: p[L] });
  return cards;
}

async function fxRef(ms) { return (await ms.list(M, 'fx'))[0] || null; }

export default {
  id: M,
  personalKinds: ['request'],
  seed,
  async route({ repo, ms, userId, profile, method, pathname, searchParams, body, util }) {
    if (pathname === '/api/v1/translate/menu') {
      if (method !== 'POST' && method !== 'GET') return null;
      const src = method === 'POST' ? body : Object.fromEntries(searchParams);
      const L = lang(src.target_lang ?? src.lang ?? 'EN');
      if (!L) return util.bad('Ngôn ngữ đích phải là EN, KO, JA hoặc ZH');
      const dishes = await repo.listDishes();
      let lines = src.lines ?? src.text ?? null, source = 'input', place = null;
      if (typeof lines === 'string') lines = lines.split(/\r?\n/);
      if (lines !== null && !Array.isArray(lines)) return util.bad('lines phải là danh sách dòng thực đơn');
      if (lines) {
        lines = lines.map(l => util.cleanText(l, 160)).filter(Boolean);
        if (!lines.length) return util.bad('Thực đơn trống');
        if (lines.length > 60) return util.bad('Tối đa 60 dòng mỗi lần dịch');
      } else if (src.place_id) {
        place = await repo.getPlace(util.cleanText(src.place_id, 80));
        if (!place) return util.notFound('Không tìm thấy quán');
        lines = (place.menu || []).filter(m => m.available === true).map(m => `${m.name} ${m.price}`);
        source = 'place_menu';
      } else {
        // No menu given: the published catalogue dishes as a sample menu.
        lines = dishes.map(d => `${d.name} ${d.ref_price}`);
        source = 'catalogue';
      }
      const fx = await fxRef(ms);
      const items = lines.map(l => translateLine(l, L, dishes, fx));
      const counts = { translated: 0, partial: 0, untranslated: 0 };
      items.forEach(i => counts[i.status]++);
      // Usage log for anonymised M17 insights: counts only, never the menu text.
      await ms.insert({ module: M, kind: 'request', ownerId: userId || null, data: { lang: L, source, lines: items.length, ...counts,
        matched_dish_ids: [...new Set(items.map(i => i.matched_dish_id).filter(Boolean))], at: new Date().toISOString() } });
      return { status: 200, data: {
        language: L, language_label: LANG_LABEL[L], engine: 'glossary', llm: false, source,
        place_id: place?.id || null, place_name: place?.name || null,
        preserved_original_names: true, counts, items,
        fx_note: fx ? `${fx.source}, cập nhật ${fx.as_of}` : null, fx_is_demo: !!fx?.is_demo,
        // Legacy desktop loader shape.
        translated_items: items.map(i => ({ name_vi: i.original_vietnamese_name, translation: i.translated_title || UNTRANSLATED,
          cultural_note: i.cultural_note || '', allergen_warning: i.allergen_warning, order_audio_phrase_vi: i.ordering_phrase_vi, status: i.status }))
      } };
    }
    if (pathname === '/api/v1/translate/phrases' && method === 'GET') {
      const L = lang(searchParams.get('lang') || 'EN');
      if (!L) return util.bad('Ngôn ngữ phải là EN, KO, JA hoặc ZH');
      const dishes = await repo.listDishes();
      const want = util.cleanText(searchParams.get('dish_id') || '', 80);
      const list = want ? dishes.filter(d => d.id === want) : dishes.slice(0, 4);
      if (want && !list.length) return util.notFound('Không tìm thấy món');
      const items = phraseCards(L, list, userId ? profile : null);
      return { status: 200, data: { language: L, language_label: LANG_LABEL[L], speech_lang: 'vi-VN', audio: 'client_speech_synthesis', total: items.length, items } };
    }
    return null;
  }
};
