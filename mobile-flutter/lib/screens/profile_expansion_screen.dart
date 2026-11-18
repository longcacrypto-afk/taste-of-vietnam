// =============================================================================
// M1, M8 & M11..M16 SCREEN: TASTE PROFILE, HARD ALLERGY GUARD & EXPANSION HUB
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class ProfileExpansionScreen extends StatefulWidget {
  const ProfileExpansionScreen({super.key});

  @override
  State<ProfileExpansionScreen> createState() => _ProfileExpansionScreenState();
}

class _ProfileExpansionScreenState extends State<ProfileExpansionScreen> {
  final Set<String> _hardAllergies = {'shrimp', 'peanut'};
  String _selectedMenuLang = 'KO';
  bool _lunarVegan = true;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('Hồ Sơ Vị Giác & Hệ Sinh Thái M1–M16', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const Text('M1 Hard Allergy Guard · M8 Nhắc lịch <=2/ngày · M11–M16 Mở rộng', style: TextStyle(fontSize: 12, color: AppTheme.slateMuted)),
        const SizedBox(height: 16),

        // 1. M1 Hard Allergy Guard
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFFE4E6),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFFECDD3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('🛡️ Bộ Lọc Dị Ứng Cứng (M1-S06 · Chặn 100% cả món Tài trợ)',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFFBE123C))),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  {'id': 'shrimp', 'label': '🦐 Tôm / Hải sản'},
                  {'id': 'peanut', 'label': '🥜 Đậu phộng'},
                  {'id': 'dairy', 'label': '🥛 Sữa bò'},
                  {'id': 'gluten', 'label': '🌾 Gluten'},
                ].map((item) {
                  final active = _hardAllergies.contains(item['id']);
                  return FilterChip(
                    label: Text(item['label']!, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                    selected: active,
                    selectedColor: Colors.white,
                    onSelected: (v) {
                      setState(() {
                        if (v) {
                          _hardAllergies.add(item['id']!);
                        } else {
                          _hardAllergies.remove(item['id']!);
                        }
                      });
                    },
                  );
                }).toList(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 2. M8 Smart Meal Reminders (<= 2 push/day)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('🔔 Nhắc Bữa Thông Minh (M8 · Tối đa 2 thông báo/ngày)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    SizedBox(height: 4),
                    Text('Trưa 10:30 · Tối 17:00 · Tự động nhắc ăn chay Mùng 1 & Rằm', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                  ],
                ),
              ),
              Switch(
                value: _lunarVegan,
                activeTrackColor: AppTheme.emeraldBadge,
                onChanged: (v) => setState(() => _lunarVegan = v),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 3. M11 7-Day Meal Plan & Consolidated Grocery List
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('📅 Kế Hoạch Ăn 7 Ngày & Giỏ Đi Chợ Gộp (M11-S01..S03)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
              SizedBox(height: 6),
              Text('• Đã tự động gộp nguyên liệu 7 ngày & trừ 2 món sẵn có trong tủ lạnh (Hành tím, Nước mắm).',
                  style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
              SizedBox(height: 4),
              Text('• Tổng ngân sách đi chợ dự kiến: 385.000đ / tuần', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF15803D))),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 4. M16 Multilingual Menu Translator AI
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.charcoalHero,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('🌐 Menu Translator AI (M16)', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800)),
                  DropdownButton<String>(
                    value: _selectedMenuLang,
                    dropdownColor: AppTheme.charcoalHero,
                    style: const TextStyle(color: AppTheme.goldenAmber, fontSize: 12, fontWeight: FontWeight.w800),
                    items: const [
                      DropdownMenuItem(value: 'EN', child: Text('English (EN)')),
                      DropdownMenuItem(value: 'KO', child: Text('한국어 (KO)')),
                      DropdownMenuItem(value: 'JA', child: Text('日本語 (JA)')),
                    ],
                    onChanged: (v) => setState(() => _selectedMenuLang = v ?? 'EN'),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text('Tên gốc: Phở Bò Tái Nạm Hà Nội (45.000đ ~ \$1.80)',
                  style: TextStyle(color: AppTheme.goldenAmber, fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(
                _selectedMenuLang == 'KO'
                    ? '하노이 소고기 양지 쌀국수 — 12시간 우린 깊은 사골 육수'
                    : _selectedMenuLang == 'JA'
                        ? 'ハノイ風牛肉フォー（レア＆ブリスケット）'
                        : 'Hanoi Sliced & Flank Beef Noodle Soup (12-hr marrow broth)',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
