// =============================================================================
// M16 · MULTILINGUAL AI MENU TRANSLATOR & CULTURAL AUDIO PRONUNCIATION
// Hôm nay ăn gì · Taste of Vietnam v0.2
// 4 Languages (EN, KO, JA, ZH) · AR Viewfinder OCR · Phonetic Audio Guide
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class MenuTranslatorScreen extends StatefulWidget {
  const MenuTranslatorScreen({super.key});

  @override
  State<MenuTranslatorScreen> createState() => _MenuTranslatorScreenState();
}

class _MenuTranslatorScreenState extends State<MenuTranslatorScreen> {
  String _selectedLang = 'EN';
  bool _isCameraMode = false;
  final TextEditingController _customQueryCtrl = TextEditingController();

  final Map<String, Map<String, dynamic>> _languages = {
    'EN': {'name': 'English', 'flag': '🇬🇧'},
    'KO': {'name': '한국어', 'flag': '🇰🇷'},
    'JA': {'name': '日本語', 'flag': '🇯🇵'},
    'ZH': {'name': '中文', 'flag': '🇨🇳'},
  };

  final Map<String, List<Map<String, dynamic>>> _translations = {
    'EN': [
      {
        'vn': 'Phở Bò Tái Nạm Hà Nội',
        'trans': 'Hanoi Beef Noodle Soup with Rare & Flank Beef',
        'pronounce': 'fuh baw tie nahm',
        'desc': 'Traditional 14-hour bone broth scented with star anise and roasted ginger. Served with flat rice noodles and tender beef.',
        'diet': 'Contains: Beef. Gluten-free naturally.',
        'etiquette': 'Sip the pure broth first. Add pickled garlic and chili, avoid hoisin sauce for true Hanoi flavor.',
        'spice': 'Non-spicy',
        'price': '55.000đ',
        'emoji': '🍜'
      },
      {
        'vn': 'Cơm Tấm Sườn Bì Chả',
        'trans': 'Saigon Broken Rice with Charcoal Grilled Pork Chop, Shredded Pork Skin & Steamed Egg Meatloaf',
        'pronounce': 'kuhm tuhm suhn bee chah',
        'desc': 'Signature southern broken rice dish topped with scallion oil, accompanied by sweet garlic fish sauce and pickled daikon.',
        'diet': 'Contains: Pork, Egg, Fish sauce.',
        'etiquette': 'Drizzle sweet fish sauce over the rice and pork. Cut meat using fork and spoon like a local.',
        'spice': 'Mild',
        'price': '65.000đ',
        'emoji': '🍚'
      },
      {
        'vn': 'Bún Bò Huế O Xuân',
        'trans': 'Hue Royal Spicy Lemongrass Beef & Pork Hock Noodle Soup',
        'pronounce': 'boon baw hway',
        'desc': 'Deeply aromatic spicy broth infused with crushed lemongrass, fermented shrimp paste, chili oil, and tender pork knuckle.',
        'diet': 'Contains: Beef, Pork, Shrimp paste. Spicy (Level 2).',
        'etiquette': 'Submerge fresh banana blossom and morning glory shreds into the piping hot soup before eating.',
        'spice': 'Spicy 🔥🔥',
        'price': '50.000đ',
        'emoji': '🍲'
      },
      {
        'vn': 'Bánh Mì Chảo Thập Cẩm',
        'trans': 'Sizzling Pan Bread with Pâté, Fried Egg, Meatballs & Rich Tomato Sauce',
        'pronounce': 'bahn mee chow',
        'desc': 'Hot skillet served with crispy baguette. Dip bread directly into the runny egg yolk and savory tomato gravy.',
        'diet': 'Contains: Gluten, Pork, Egg, Dairy.',
        'etiquette': 'Tear small pieces of crispy baguette and dip generously into the sizzling sauce.',
        'spice': 'Non-spicy',
        'price': '45.000đ',
        'emoji': '🍳'
      },
      {
        'vn': 'Gỏi Cuốn Tôm Thịt & Chay Đậu Hũ',
        'trans': 'Fresh Rice Paper Summer Rolls with Shrimp, Pork / Tofu & Herbs',
        'pronounce': 'goy kwohn tohm teet',
        'desc': 'Refreshing rice paper wraps filled with fresh herbs, vermicelli, and poached shrimp, served with rich peanut hoisin dip.',
        'diet': 'Contains: Shellfish (meat version) or 100% Vegan (tofu version). Contains Peanuts in sauce.',
        'etiquette': 'Dip roll halfway into peanut sauce and eat by hand in two to three bites.',
        'spice': 'Non-spicy',
        'price': '40.000đ',
        'emoji': '🥗'
      },
    ],
    'KO': [
      {
        'vn': 'Phở Bò Tái Nạm Hà Nội',
        'trans': '하노이 소고기 쌀국수 (생고기 & 양지머리)',
        'pronounce': '퍼 보 따이 남',
        'desc': '14시간 동안 우려낸 맑고 깊은 사골 육수에 팔각과 구운 생강 향이 어우러진 전통 쌀국수.',
        'diet': '소고기 포함. 글루텐 프리.',
        'etiquette': '국물을 먼저 한 모금 맛보고, 식초 마늘과 고추를 곁들여 드세요. 해선장은 넣지 않는 것이 하노이 정통 방식입니다.',
        'spice': '안 매움',
        'price': '55.000đ',
        'emoji': '🍜'
      },
      {
        'vn': 'Cơm Tấm Sườn Bì Chả',
        'trans': '사이공 숯불 돼지갈비 덮밥 (껌떰 수언)',
        'pronounce': '껌 떰 수언 비 차',
        'desc': '숯불 향이 가득 밴 큼직한 돼지갈비, 계란 찜, 돼지껍질 채를 얹은 남부 대표 덮밥.',
        'diet': '돼지고기, 달걀, 피시소스 포함.',
        'etiquette': '달콤짭조름한 느억맘(피시소스)을 밥 위에 골고루 뿌려 비벼 드세요.',
        'spice': '순한맛',
        'price': '65.000đ',
        'emoji': '🍚'
      },
      {
        'vn': 'Bún Bò Huế O Xuân',
        'trans': '후에 왕실 매운 레몬그라스 쌀국수 (분보후에)',
        'pronounce': '분 보 후에',
        'desc': '레몬그라스의 깊은 풍미와 새우 발효장, 고추기름으로 매콤 칼칼하게 끓여낸 후에 지방 대표 국수.',
        'diet': '소고기, 돼지고기, 새우젓 포함. 매콤함 (2단계).',
        'etiquette': '채 썬 바나나꽃과 모닝글로리를 뜨거운 국물 속에 푹 담가 살짝 익혀 드세요.',
        'spice': '매움 🔥🔥',
        'price': '50.000đ',
        'emoji': '🍲'
      },
      {
        'vn': 'Bánh Mì Chảo Thập Cẩm',
        'trans': '사이공 팬 반미 (달걀 프라이 & 파테 & 미트볼 토마토 소스)',
        'pronounce': '반 미 차오',
        'desc': '뜨겁게 달군 철판에 달걀 프라이, 파테, 소시지를 올리고 바삭한 바게트를 찍어 먹는 요리.',
        'diet': '밀가루, 돼지고기, 달걀 포함.',
        'etiquette': '바게트를 손으로 뜯어 반숙 달걀노른자와 토마토 소스에 듬뿍 찍어 드세요.',
        'spice': '안 매움',
        'price': '45.000đ',
        'emoji': '🍳'
      },
      {
        'vn': 'Gỏi Cuốn Tôm Thịt & Chay Đậu Hũ',
        'trans': '신선한 새우 & 돼지고기 월남쌈 (고이꾸온)',
        'pronounce': '고이 꾸온 똠 팃',
        'desc': '라이스페이퍼에 삶은 새우, 신선한 야채, 쌀국수를 돌돌 말아 고소한 땅콩소스에 찍어 먹는 건강식.',
        'diet': '새우, 돼지고기 또는 두부. 땅콩 소스 알레르기 주의.',
        'etiquette': '손으로 집어 땅콩소스에 반쯤 담근 뒤 한 입 가득 베어 무세요.',
        'spice': '안 매움',
        'price': '40.000đ',
        'emoji': '🥗'
      },
    ],
    'JA': [
      {
        'vn': 'Phở Bò Tái Nạm Hà Nội',
        'trans': 'ハノイ本場 牛骨フォー（半生牛肉＆牛バラ肉のせ）',
        'pronounce': 'フォー・ボー・タイ・ナム',
        'desc': '牛骨をじっくり14時間煮込んだ澄んだ琥珀色のスープに、香り豊かな八角とショウガを効かせた一杯。',
        'diet': '牛肉使用。グルテンフリー。',
        'etiquette': 'まずは調味料を入れずにスープの旨みを味わい、ニンニク酢と唐辛子で味変するのがハノイ流。',
        'spice': '辛くない',
        'price': '55.000đ',
        'emoji': '🍜'
      },
      {
        'vn': 'Cơm Tấm Sườn Bì Chả',
        'trans': 'サイゴン名物 炭火焼き豚リブのせ砕き米ご飯（コムタム）',
        'pronounce': 'コム・タム・スオン・ビー・チャー',
        'desc': '香ばしく焼き上げた秘伝タレ漬け豚肉と卵スフレをのせた、ホーチミン庶民に愛される名物料理。',
        'diet': '豚肉・卵・魚醤（ヌックマム）使用。',
        'etiquette': '特製甘酸っぱいヌックマムたれを全体に回しかけ、スプーンとフォークでお召し上がりください。',
        'spice': 'マイルド',
        'price': '65.000đ',
        'emoji': '🍚'
      },
      {
        'vn': 'Bún Bò Huế O Xuân',
        'trans': '古都フエ名物 ピリ辛レモングラス牛肉うどん（ブンボーフエ）',
        'pronounce': 'ブン・ボー・フエ',
        'desc': 'レモングラスと小エビ発酵だれの芳醇な香りに、ピリ辛ラー油が効いた奥深いコクの宮廷スープ。',
        'diet': '牛肉・豚肉・エビペースト使用。辛口（レベル2）。',
        'etiquette': 'バナナの花の千切りと空心菜を熱々スープに沈めて、シャキシャキの食感をお楽しみください。',
        'spice': '中辛 🔥🔥',
        'price': '50.000đ',
        'emoji': '🍲'
      },
      {
        'vn': 'Bánh Mì Chảo Thập Cẩm',
        'trans': '鉄板焼きバインミー（目玉焼き・パテ・ミートボールのトマト煮）',
        'pronounce': 'バイン・ミー・チャオ',
        'desc': '熱々のスキレットで提供される具材に、焼きたてフランスパンをちぎってディップする朝食の定番。',
        'diet': '小麦・豚肉・卵使用。',
        'etiquette': 'カリカリのパンを手でちぎり、半熟卵と濃厚トマトソースをたっぷり絡めてどうぞ。',
        'spice': '辛くない',
        'price': '45.000đ',
        'emoji': '🍳'
      },
      {
        'vn': 'Gỏi Cuốn Tôm Thịt & Chay Đậu Hũ',
        'trans': '海老と豚肉の生春巻き（ゴイクオン）',
        'pronounce': 'ゴイ・クオン・トム・ティット',
        'desc': '極薄ライスペーパーで茹で海老、豚肉、ハーブを巻いたヘルシー料理。特製ピーナッツだれ付き。',
        'diet': '海老・豚肉・ピーナッツ使用（ヴィーガン対応可能）。',
        'etiquette': '手で持ち、濃厚なタレをたっぷりつけて2〜3口で召し上がるのが本場流です。',
        'spice': '辛くない',
        'price': '40.000đ',
        'emoji': '🥗'
      },
    ],
    'ZH': [
      {
        'vn': 'Phở Bò Tái Nạm Hà Nội',
        'trans': '河内经典牛骨高汤生熟牛肉河粉',
        'pronounce': 'fěn bō dài nán',
        'desc': '14小时牛筒骨慢火精炖，散发八角与烤姜清香，配爽滑米粉与鲜嫩牛肉。',
        'diet': '含牛肉。纯天然无麸质。',
        'etiquette': '先品原汤鲜甜，再依个人喜好加入蒜醋和鲜辣椒，地道河内人不加甜海鲜酱。',
        'spice': '不辣',
        'price': '55.000đ',
        'emoji': '🍜'
      },
      {
        'vn': 'Cơm Tấm Sườn Bì Chả',
        'trans': '西贡炭烤猪排碎米饭（三宝饭）',
        'pronounce': 'fàn tǎn suān bì zhǎ',
        'desc': '金黄焦香的炭烤大猪排，搭配蒸蛋肉饼与猪皮丝，淋上葱油与秘制甜鱼露。',
        'diet': '含猪肉、鸡蛋、鱼露。',
        'etiquette': '将甘甜蒜辣鱼露浇淋在碎米饭与猪排上，以匙叉拌食。',
        'spice': '微甜微辣',
        'price': '65.000đ',
        'emoji': '🍚'
      },
      {
        'vn': 'Bún Bò Huế O Xuân',
        'trans': '顺化皇廷香茅辣牛肉圆粉',
        'pronounce': 'bèn bō huì',
        'desc': '浓郁香茅与顺化发酵虾酱交织出的鲜辣汤底，搭配粗圆米粉与弹牙牛展肉。',
        'diet': '含牛肉、猪肉、虾酱。辣度2级。',
        'etiquette': '趁热将新鲜芭蕉花丝与空心菜丝压入滚烫红汤中烫熟食用。',
        'spice': '微辣 🔥🔥',
        'price': '50.000đ',
        'emoji': '🍲'
      },
      {
        'vn': 'Bánh Mì Chảo Thập Cẩm',
        'trans': '越式铁板法棍拼盘（太阳蛋·肝酱·肉丸·番茄浓汁）',
        'pronounce': 'bān mǐ chǎo',
        'desc': '热气腾腾的铁盘盛装流心蛋与法式肝酱，撕开香脆法棍蘸取浓稠酱汁。',
        'diet': '含麸质、猪肉、蛋类。',
        'etiquette': '手撕酥脆法棍，蘸裹蛋黄与番茄肉丸浓汁食用。',
        'spice': '不辣',
        'price': '45.000đ',
        'emoji': '🍳'
      },
      {
        'vn': 'Gỏi Cuốn Tôm Thịt & Chay Đậu Hũ',
        'trans': '越南招牌鲜虾猪肉夏日米纸春卷',
        'pronounce': 'guǒ juǎn dōng tì',
        'desc': '轻透薄米纸包裹鲜虾、薄荷香草与米线，蘸浓郁花生海鲜酱，清新健康。',
        'diet': '含虾仁、猪肉或豆腐。蘸酱含花生。',
        'etiquette': '用手持取，蘸半边花生酱，趁新鲜两三口食用最佳。',
        'spice': '不辣',
        'price': '40.000đ',
        'emoji': '🥗'
      },
    ]
  };

  void _speakPronunciation(String dishVn, String phonetic) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.volume_up_rounded, color: AppTheme.goldenAmber),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '🔊 Phát âm: "$dishVn" [ $phonetic ] (Giọng chuẩn bản xứ)',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF1E293B),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final list = _translations[_selectedLang] ?? _translations['EN']!;

    return Scaffold(
      backgroundColor: AppTheme.bgPage,
      appBar: AppBar(
        backgroundColor: AppTheme.bgPage,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Dịch Menu Đa Ngữ AI', style: AppTheme.titleLarge),
        actions: [
          IconButton(
            icon: Icon(_isCameraMode ? Icons.list_rounded : Icons.camera_alt_rounded,
                color: AppTheme.goldenAmber),
            onPressed: () => setState(() => _isCameraMode = !_isCameraMode),
          ),
        ],
      ),
      body: _isCameraMode ? _buildCameraArOverlayView() : _buildTranslationListView(list),
    );
  }

  Widget _buildCameraArOverlayView() => Stack(
        children: [
          // Simulated Camera Feed (Dark luxury with realistic food menu texture)
          Container(
            color: Colors.black,
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.camera_enhance_rounded, color: Colors.white24, size: 72),
                  const SizedBox(height: 12),
                  const Text('CAMERA SCANNER AR ĐANG HOẠT ĐỘNG',
                      style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  const Text('Hướng camera vào menu tiếng Việt để dịch trực tiếp trên trang',
                      style: TextStyle(color: AppTheme.slateMuted, fontSize: 11)),
                ],
              ),
            ),
          ),

          // AR Translation Bounding Box 1
          Positioned(
            top: 140,
            left: 30,
            right: 30,
            child: _buildArBoundingTag(
              'Phở Bò Tái Nạm — 55.000đ',
              _selectedLang == 'EN'
                  ? 'Rare & Flank Beef Noodle Soup'
                  : _selectedLang == 'KO'
                      ? '하노이 소고기 쌀국수'
                      : _selectedLang == 'JA'
                          ? 'ハノイ名物 牛肉のフォー'
                          : '河内牛骨牛肉河粉',
            ),
          ),

          // AR Translation Bounding Box 2
          Positioned(
            top: 240,
            left: 30,
            right: 30,
            child: _buildArBoundingTag(
              'Cơm Tấm Sườn Bì — 65.000đ',
              _selectedLang == 'EN'
                  ? 'Saigon Broken Rice with Pork Chop'
                  : _selectedLang == 'KO'
                      ? '사이공 숯불 돼지갈비 덮밥'
                      : _selectedLang == 'JA'
                          ? '炭火焼き豚リブのせコムタム'
                          : '西贡炭烤猪排碎米饭',
            ),
          ),

          // Top Language Selector & Close Camera
          Positioned(
            top: 20,
            left: 16,
            right: 16,
            child: Row(
              children: [
                _buildLanguageSelectorChips(),
                const Spacer(),
                GestureDetector(
                  onTap: () => setState(() => _isCameraMode = false),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.close_rounded, color: Colors.white, size: 16),
                        SizedBox(width: 4),
                        Text('Đóng AR', style: TextStyle(color: Colors.white, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      );

  Widget _buildArBoundingTag(String vnOriginal, String translated) => Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.85),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.goldenAmber, width: 1.5),
          boxShadow: [
            BoxShadow(color: AppTheme.goldenAmber.withOpacity(0.4), blurRadius: 10),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.goldenAmber,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text('AI DETECTED', style: TextStyle(color: Colors.black, fontSize: 9, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 8),
                Text(vnOriginal, style: const TextStyle(color: Colors.white70, fontSize: 11, decoration: TextDecoration.lineThrough)),
              ],
            ),
            const SizedBox(height: 4),
            Text(translated,
                style: const TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold, fontSize: 14)),
          ],
        ),
      );

  Widget _buildTranslationListView(List<Map<String, dynamic>> list) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildLanguageSelectorChips(),
          const SizedBox(height: 14),
          _buildInstantSearchInput(),
          const SizedBox(height: 16),
          _buildTouristTipBanner(),
          const SizedBox(height: 16),
          ...list.map((item) => _buildDishTranslationCard(item)),
          const SizedBox(height: 32),
        ],
      );

  Widget _buildLanguageSelectorChips() => SizedBox(
        height: 40,
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: _languages.entries.map((e) {
            final active = e.key == _selectedLang;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => setState(() => _selectedLang = e.key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: active ? AppTheme.goldenAmber : AppTheme.surfaceElevated,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: active ? AppTheme.goldenAmber : Colors.white12),
                  ),
                  child: Row(
                    children: [
                      Text(e.value['flag'], style: const TextStyle(fontSize: 16)),
                      const SizedBox(width: 6),
                      Text(
                        e.value['name'],
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: active ? FontWeight.bold : FontWeight.w500,
                          color: active ? Colors.black : Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      );

  Widget _buildInstantSearchInput() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white12),
        ),
        child: TextField(
          controller: _customQueryCtrl,
          style: const TextStyle(color: Colors.white, fontSize: 13),
          decoration: InputDecoration(
            icon: const Icon(Icons.search_rounded, color: AppTheme.goldenAmber, size: 20),
            hintText: 'Nhập tên món tiếng Việt để dịch (VD: Bánh xèo, Cao lầu)...',
            hintStyle: const TextStyle(color: AppTheme.slateMuted, fontSize: 12),
            border: InputBorder.none,
            suffixIcon: IconButton(
              icon: const Icon(Icons.camera_alt_outlined, color: AppTheme.goldenAmber, size: 20),
              onPressed: () => setState(() => _isCameraMode = true),
            ),
          ),
          onSubmitted: (query) {
            if (query.trim().isNotEmpty) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('🌐 AI đang dịch món "$query" sang ${_languages[_selectedLang]!['name']}...'),
                  backgroundColor: AppTheme.emeraldBadge,
                ),
              );
            }
          },
        ),
      );

  Widget _buildTouristTipBanner() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B).withOpacity(0.5),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.blueAccent.withOpacity(0.3)),
        ),
        child: const Row(
          children: [
            Icon(Icons.tips_and_updates_rounded, color: Colors.amberAccent, size: 20),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Mẹo bản xứ: Bấm biểu tượng 🔊 để nghe phát âm tiếng Việt chuẩn giúp bạn gọi món tự tin với người bán!',
                style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
              ),
            ),
          ],
        ),
      );

  Widget _buildDishTranslationCard(Map<String, dynamic> item) => Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Original VN Name & Audio Pronunciation Button
            Row(
              children: [
                Text(item['emoji'], style: const TextStyle(fontSize: 24)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item['vn'],
                          style: const TextStyle(
                              color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                      Text('/ ${item['pronounce']} /',
                          style: TextStyle(
                              color: AppTheme.goldenAmber.withOpacity(0.9),
                              fontSize: 11,
                              fontStyle: FontStyle.italic)),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => _speakPronunciation(item['vn'], item['pronounce']),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.goldenAmber.withOpacity(0.15),
                      shape: BoxShape.circle,
                      border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.5)),
                    ),
                    child: const Icon(Icons.volume_up_rounded, color: AppTheme.goldenAmber, size: 18),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Translated Name in Selected Language
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.04),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  Text(_languages[_selectedLang]!['flag'], style: const TextStyle(fontSize: 16)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      item['trans'],
                      style: const TextStyle(
                        color: Colors.amberAccent,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),

            // Description in Target Language
            Text(item['desc'],
                style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 11, height: 1.5)),
            const SizedBox(height: 10),

            // Allergy & Dietary Warnings
            Row(
              children: [
                const Icon(Icons.shield_outlined, color: AppTheme.emeraldBadge, size: 14),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(item['diet'],
                      style: const TextStyle(color: AppTheme.emeraldBadge, fontSize: 10, fontWeight: FontWeight.w600)),
                ),
                Text(item['spice'],
                    style: const TextStyle(color: Colors.orangeAccent, fontSize: 10, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 8),

            // Cultural Etiquette Tip
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('🥢 ', style: TextStyle(fontSize: 12)),
                  Expanded(
                    child: Text(
                      'Cách ăn chuẩn bản xứ: ${item['etiquette']}',
                      style: const TextStyle(color: AppTheme.slateMuted, fontSize: 10, height: 1.35),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}
