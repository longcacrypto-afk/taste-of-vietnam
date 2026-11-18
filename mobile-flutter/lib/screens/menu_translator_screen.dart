// M16 · Multilingual AI Menu Translator Screen
// Hôm nay ăn gì · Taste of Vietnam v0.1

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class MenuTranslatorScreen extends StatefulWidget {
  const MenuTranslatorScreen({super.key});

  @override
  State<MenuTranslatorScreen> createState() => _MenuTranslatorScreenState();
}

class _MenuTranslatorScreenState extends State<MenuTranslatorScreen> {
  String _selectedLang = 'EN';
  bool _scanning = false;

  final Map<String, List<Map<String, String>>> _translations = {
    'EN': [
      {
        'vn': 'Phở Bò Tái Nạm Hà Nội',
        'trans': 'Hanoi Beef Noodle Soup with Rare & Flank Beef',
        'pronounce': 'fuh baw tie nahm',
        'desc': 'Traditional 12-hour bone broth, rice noodles, garnished with herbs & spring onions.',
        'diet': 'Contains: Beef. Gluten-free by default.',
      },
      {
        'vn': 'Cơm Tấm Sườn Bì Chả',
        'trans': 'Broken Rice with Grilled Pork Chop, Shredded Pork Skin & Egg Meatloaf',
        'pronounce': 'kuhm tuhm suhn bee chah',
        'desc': 'Saigon signature dish served with pickled daikon, cucumber & sweet-savory fish sauce.',
        'diet': 'Contains: Pork, Egg, Fish sauce.',
      },
      {
        'vn': 'Bún Bò Huế O Xuân',
        'trans': 'Hue Spicy Lemongrass Beef & Pork Noodle Soup',
        'pronounce': 'boon baw hway',
        'desc': 'Rich spicy broth infused with lemongrass, chili paste & fermented shrimp paste.',
        'diet': 'Contains: Beef, Pork, Shrimp paste. Spicy (Level 2).',
      },
      {
        'vn': 'Gỏi Cuốn Chay Đậu Hũ',
        'trans': 'Fresh Vegetarian Spring Rolls with Tofu',
        'pronounce': 'goy kwohn chai',
        'desc': 'Fresh rice paper rolls packed with fried tofu, lettuce, mint, served with peanut dip.',
        'diet': '100% Vegan. Contains: Peanuts (in dipping sauce).',
      },
    ],
    'KO': [
      {
        'vn': 'Phở Bò Tái Nạm Hà Nội',
        'trans': '하노이 소고기 쌀국수 (생고기 & 양지머리)',
        'pronounce': '퍼 보 따이 남',
        'desc': '12시간 이상 푹 우려낸 맑고 깊은 사골 육수에 신선한 소고기를 얹은 전통 쌀국수.',
        'diet': '소고기 포함. 글루텐 프리.',
      },
      {
        'vn': 'Cơm Tấm Sườn Bì Chả',
        'trans': '사이공 돼지갈비 덮밥 (껌떰)',
        'pronounce': '껌 떰 수언 비 차',
        'desc': '불향 가득 구운 돼지갈비와 계란 찜을 곁들인 베트남 남부 대표 덮밥.',
        'diet': '돼지고기, 달걀, 피시소스 포함.',
      },
      {
        'vn': 'Bún Bò Huế O Xuân',
        'trans': '후에 매운 소고기 쌀국수 (분보후에)',
        'pronounce': '분 보 후에',
        'desc': '레몬그라스와 매콤한 고추 기름, 새우젓으로 감칠맛을 낸 후에 전통 국수.',
        'diet': '소고기, 돼지고기, 새우젓 포함. 매움 (2단계).',
      },
      {
        'vn': 'Gỏi Cuốn Chay Đậu Hũ',
        'trans': '두부 야채 월남쌈 (채식 고이꾸온)',
        'pronounce': '고이 꾸온 차이',
        'desc': '두부와 신선한 허브를 라이스페이퍼에 말아 고소한 땅콩소스에 찍어 먹는 건강식.',
        'diet': '100% 비건. 땅콩 소스 알레르기 주의.',
      },
    ],
    'JA': [
      {
        'vn': 'Phở Bò Tái Nạm Hà Nội',
        'trans': 'ハノイ名物 牛肉のフォー（半生牛肉＆牛バラ肉）',
        'pronounce': 'フォー・ボー・タイ・ナム',
        'desc': '12時間煮込んだ澄んだ牛骨スープに、米粉の平打ち麺を合わせた伝統の一杯。',
        'diet': '牛肉使用。グルテンフリー。',
      },
      {
        'vn': 'Cơm Tấm Sườn Bì Chả',
        'trans': 'サイゴン風 炭火焼き豚リブのせ砕き米ご飯（コムタム）',
        'pronounce': 'コム・タム・スオン・ビー・チャー',
        'desc': '香ばしく焼き上げた豚肉と卵スフレをのせた、ホーチミン庶民の定番料理。',
        'diet': '豚肉・卵・魚醤（ヌックマム）使用。',
      },
      {
        'vn': 'Bún Bò Huế O Xuân',
        'trans': '古都フエのピリ辛レモングラス牛肉うどん（ブンボーフエ）',
        'pronounce': 'ブン・ボー・フエ',
        'desc': 'レモングラスと唐辛子の辛味、アミエビの発酵調味料が効いた奥深いスープ。',
        'diet': '牛肉・豚肉・エビペースト使用。辛口（レベル2）。',
      },
      {
        'vn': 'Gỏi Cuốn Chay Đậu Hũ',
        'trans': '揚げ豆腐と新鮮ハーブの生春巻き（ベジタリアン）',
        'pronounce': 'ゴイ・クオン・チャイ',
        'desc': 'ライスペーパーで豆腐と香草を巻いたさっぱり春巻き。特製ピーナッツだれ付き。',
        'diet': '完全ヴィーガン。ピーナッツ（タレ）使用。',
      },
    ],
  };

  void _speakPronunciation(String vn, String pronounce) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('🔊 Đang phát âm thanh: "$vn" ($pronounce)'),
        backgroundColor: const Color(0xFF22C55E),
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
        title: Text('AI Menu Translator', style: AppTheme.titleLarge),
        actions: [
          IconButton(
            icon: Icon(Icons.camera_alt_outlined, color: AppTheme.goldenAmber),
            onPressed: () async {
              setState(() => _scanning = true);
              final res = await ApiService.translateMenu(_selectedLang);
              if (mounted) {
                setState(() => _scanning = false);
                final count = res != null && res['items'] is List ? (res['items'] as List).length : 4;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('✨ AI OCR đã quét và dịch $count món sang $_selectedLang!')),
                );
              }
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildLanguageSelector(),
          const SizedBox(height: 16),
          _buildInfoBanner(),
          const SizedBox(height: 16),
          if (_scanning)
            Container(
              padding: const EdgeInsets.all(24),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppTheme.surfaceElevated,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Column(
                children: [
                  CircularProgressIndicator(color: AppTheme.goldenAmber),
                  SizedBox(height: 12),
                  Text('📷 AI đang quét thực đơn tiếng Việt...', style: TextStyle(color: Colors.white70)),
                ],
              ),
            ),
          ...list.map(_buildMenuItemCard),
        ],
      ),
    );
  }

  Widget _buildLanguageSelector() => Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            _langBtn('EN', '🇬🇧 English'),
            _langBtn('KO', '🇰🇷 한국어'),
            _langBtn('JA', '🇯🇵 日本語'),
          ],
        ),
      );

  Widget _langBtn(String code, String label) {
    final isSel = _selectedLang == code;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedLang = code),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSel ? AppTheme.goldenAmber : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSel ? Colors.black : Colors.white70,
                fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                fontSize: 12,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoBanner() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.emeraldBadge.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.emeraldBadge.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            const Text('🇻🇳', style: TextStyle(fontSize: 20)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Tên món giữ nguyên tiếng Việt để bạn dễ dàng gọi món trực tiếp với người bán.',
                style: AppTheme.bodyMedium.copyWith(fontSize: 12, color: Colors.white70, height: 1.4),
              ),
            ),
          ],
        ),
      );

  Widget _buildMenuItemCard(Map<String, String> item) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF2A2A2E)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item['vn']!,
                    style: AppTheme.titleMedium.copyWith(fontSize: 15, color: AppTheme.goldenAmber),
                  ),
                ),
                GestureDetector(
                  onTap: () => _speakPronunciation(item['vn']!, item['pronounce']!),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.charcoalHero,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.4)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.volume_up_rounded, color: AppTheme.goldenAmber, size: 14),
                        SizedBox(width: 4),
                        Text('Phát âm', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              'Phiên âm: /${item['pronounce']}/',
              style: AppTheme.labelSmall.copyWith(color: AppTheme.emeraldBadge, fontSize: 11),
            ),
            const SizedBox(height: 6),
            Text(
              item['trans']!,
              style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            const SizedBox(height: 4),
            Text(
              item['desc']!,
              style: AppTheme.bodyMedium.copyWith(color: AppTheme.textSecondary, fontSize: 12, height: 1.4),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.charcoalHero,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                'ℹ️ ${item['diet']}',
                style: AppTheme.labelSmall.copyWith(fontSize: 10, color: Colors.amberAccent),
              ),
            ),
          ],
        ),
      );
}
