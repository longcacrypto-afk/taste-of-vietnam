// =============================================================================
// M3-S01 TODAY HOME SCREEN — FULL AI CHEF BENCHMARK SCREEN 1 IN FLUTTER
// Tương tác trực tiếp Cloud API: GET /api/v1/suggestions/today
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import 'spin_wheel_screen.dart';

class TodayHomeScreen extends StatefulWidget {
  final VoidCallback onOpenRecipe;
  final VoidCallback onOpenAiChef;

  const TodayHomeScreen({
    super.key,
    required this.onOpenRecipe,
    required this.onOpenAiChef,
  });

  @override
  State<TodayHomeScreen> createState() => _TodayHomeScreenState();
}

class _TodayHomeScreenState extends State<TodayHomeScreen> {
  bool _isLoading = true;
  String _weatherText = '🌧️ 26°C · Biên Hòa · Trời dịu mát';
  List<Map<String, dynamic>> _suggestions = [];
  int _selectedCategory = 0;

  final List<Map<String, dynamic>> _categories = [
    {'name': 'Breakfast', 'vn': 'Sáng', 'icon': '☀️', 'color': Color(0xFFFEF3C7)},
    {'name': 'Lunch', 'vn': 'Trưa', 'icon': '🥢', 'color': Color(0xFFDCFCE7)},
    {'name': 'Dinner', 'vn': 'Tối', 'icon': '🌙', 'color': Color(0xFFF3E8FF)},
    {'name': 'Snacks', 'vn': 'Xế', 'icon': '🍿', 'color': Color(0xFFFCE7F3)},
    {'name': 'Desserts', 'vn': 'Tráng miệng', 'icon': '🍰', 'color': Color(0xFFFFEDD5)},
  ];

  @override
  void initState() {
    super.initState();
    _loadTodaySuggestions();
  }

  Future<void> _loadTodaySuggestions() async {
    setState(() => _isLoading = true);
    final data = await ApiService.fetchTodaySuggestions();

    if (mounted) {
      setState(() {
        _isLoading = false;
        if (data != null) {
          if (data['weather'] != null) {
            _weatherText = data['weather']['label'] ?? _weatherText;
          }
          if (data['suggestions'] != null) {
            _suggestions = (data['suggestions'] as List).map((s) => {
              'id': s['id'] ?? 'DISH-101',
              'name': s['name'] ?? 'Phở Bò Tái Nạm Hà Nội',
              'desc': s['reason'] ?? 'Hạp thời tiết dịu mát hôm nay',
              'time': '25 min',
              'difficulty': 'Medium',
              'calories': s['calories'] ?? 480,
              'price': s['price'] ?? 55000,
              'emoji': s['emoji'] ?? '🍜',
              'isSponsored': s['is_sponsored'] ?? false,
            }).toList();
          }
        }

        // Dữ liệu mẫu nếu offline
        if (_suggestions.isEmpty) {
          _suggestions = [
            {
              'id': 'DISH-101',
              'name': 'Phở Bò Tái Nạm Hà Nội',
              'desc': 'Trời mát 26°C · Quán cách 400m',
              'time': '25 min',
              'difficulty': 'Medium',
              'calories': 480,
              'price': 55000,
              'emoji': '🍜',
              'isSponsored': false,
            },
            {
              'id': 'DISH-102',
              'name': 'Cơm Tấm Sườn Bì Chả',
              'desc': 'Đậm đà chuẩn vị Sài Gòn xưa',
              'time': '30 min',
              'difficulty': 'Easy',
              'calories': 620,
              'price': 50000,
              'emoji': '🍚',
              'isSponsored': true,
            },
            {
              'id': 'DISH-103',
              'name': 'Gỏi Cuốn Chay Đậu Hũ',
              'desc': 'Thanh đạm · Nhiều rau xanh tươi',
              'time': '15 min',
              'difficulty': 'Easy',
              'calories': 310,
              'price': 40000,
              'emoji': '🥗',
              'isSponsored': false,
            },
          ];
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadTodaySuggestions,
      color: AppTheme.goldenAmber,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── 1. GREETING HEADER (BENCHMARK SCREEN 1) ─────────────
            _buildGreetingHeader(),
            const SizedBox(height: 14),

            // ─── 2. SEARCH BAR WITH FILTER TOGGLE ────────────────────
            _buildSearchBar(),
            const SizedBox(height: 16),

            // ─── 3. WEATHER BANNER ───────────────────────────────────
            _buildWeatherBanner(),
            const SizedBox(height: 16),

            // ─── 4. DARK CHARCOAL HERO CARD ──────────────────────────
            _buildHeroCard(),
            const SizedBox(height: 20),

            // ─── 5. 5 PASTEL CATEGORY CIRCLES ────────────────────────
            _buildCategoriesBar(),
            const SizedBox(height: 24),

            // ─── 6. POPULAR RECIPES / TODAY SUGGESTIONS ──────────────
            _buildPopularSectionHeader(),
            const SizedBox(height: 12),

            if (_isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(color: AppTheme.goldenAmber),
                ),
              )
            else
              ..._suggestions.map(_buildDishCard),

            const SizedBox(height: 16),
            // ─── 7. RANDOM SPIN SHORTCUT ─────────────────────────────
            _buildSpinShortcutBanner(),
          ],
        ),
      ),
    );
  }

  Widget _buildGreetingHeader() => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Good Morning,', style: TextStyle(fontSize: 12, color: AppTheme.slateMuted)),
              SizedBox(height: 2),
              Row(
                children: [
                  Text('Anh Long', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
                  SizedBox(width: 6),
                  Text('👨‍🍳', style: TextStyle(fontSize: 18)),
                ],
              ),
              Text('Hôm nay anh muốn ăn hay nấu món gì?', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
            ],
          ),
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(
                  color: AppTheme.goldenAmber,
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Text('L', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.black)),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppTheme.surfaceElevated,
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF2A2A2E)),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    const Icon(Icons.notifications_none_rounded, size: 20, color: Colors.white70),
                    Positioned(
                      top: 10,
                      right: 10,
                      child: Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: AppTheme.goldenAmber,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      );

  Widget _buildSearchBar() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF2A2A2E)),
        ),
        child: Row(
          children: [
            const Icon(Icons.search_rounded, color: Colors.white54, size: 22),
            const SizedBox(width: 10),
            const Expanded(
              child: TextField(
                style: TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Tìm món ăn, nguyên liệu, quán gần bạn...',
                  hintStyle: TextStyle(color: Colors.white38, fontSize: 12),
                  border: BorderSide.none,
                  isDense: true,
                  contentPadding: EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
            Container(
              width: 1,
              height: 20,
              color: const Color(0xFF3F3F46),
            ),
            IconButton(
              icon: const Icon(Icons.tune_rounded, color: AppTheme.goldenAmber, size: 18),
              onPressed: () {},
            ),
          ],
        ),
      );

  Widget _buildWeatherBanner() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF2A2A2E)),
        ),
        child: Row(
          children: [
            Text(_weatherText, style: const TextStyle(fontSize: 12, color: Colors.white70, fontWeight: FontWeight.w500)),
            const Spacer(),
            const Text('Gợi ý thời gian thực', style: TextStyle(fontSize: 10, color: AppTheme.emeraldBadge, fontWeight: FontWeight.bold)),
          ],
        ),
      );

  Widget _buildHeroCard() => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0xFF2A2A2E)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.emeraldBadge,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Text('✨ AI Powered', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'AI Suggests\nYour Perfect Meal',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800, height: 1.25),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Tell us what you have at home and let AI create a delicious recipe for you!',
                    style: TextStyle(color: Colors.white60, fontSize: 11, height: 1.3),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton(
                    onPressed: widget.onOpenAiChef,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.goldenAmber,
                      foregroundColor: Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Try AI Chef', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        SizedBox(width: 4),
                        Icon(Icons.arrow_forward_ios_rounded, size: 11),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: AppTheme.bgPage,
                shape: BoxShape.circle,
                border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.4), width: 2),
              ),
              child: const Center(
                child: Text('🤖', style: TextStyle(fontSize: 50)),
              ),
            ),
          ],
        ),
      );

  Widget _buildCategoriesBar() => SizedBox(
        height: 80,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: _categories.length,
          separatorBuilder: (_, __) => const SizedBox(width: 14),
          itemBuilder: (_, i) {
            final cat = _categories[i];
            final isSel = _selectedCategory == i;

            return GestureDetector(
              onTap: () => setState(() => _selectedCategory = i),
              child: Column(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: cat['color'] as Color,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isSel ? AppTheme.goldenAmber : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: Center(
                      child: Text(cat['icon'] as String, style: const TextStyle(fontSize: 22)),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    cat['name'] as String,
                    style: TextStyle(
                      fontSize: 10,
                      color: isSel ? AppTheme.goldenAmber : Colors.white70,
                      fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      );

  Widget _buildPopularSectionHeader() => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text('Popular Recipes & Today AI', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
          GestureDetector(
            onTap: widget.onOpenRecipe,
            child: const Text('See All >', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 12, fontWeight: FontWeight.w600)),
          ),
        ],
      );

  Widget _buildDishCard(Map<String, dynamic> dish) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF2A2A2E)),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppTheme.charcoalHero,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(child: Text(dish['emoji'], style: const TextStyle(fontSize: 30))),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          dish['name'],
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                        ),
                      ),
                      if (dish['isSponsored'] == true)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.goldenAmber.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('Tài trợ', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 9, fontWeight: FontWeight.bold)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(dish['desc'], style: const TextStyle(fontSize: 11, color: Colors.white60)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text('⏱ ${dish['time']}', style: const TextStyle(fontSize: 11, color: Colors.white70)),
                      const SizedBox(width: 10),
                      Text('👨‍🍳 ${dish['difficulty']}', style: const TextStyle(fontSize: 11, color: Colors.white70)),
                      const Spacer(),
                      Text(
                        '${_fmt(dish['price'])}đ',
                        style: const TextStyle(color: AppTheme.goldenAmber, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _buildSpinShortcutBanner() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            const Text('🎲', style: TextStyle(fontSize: 26)),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Đang phân vân không biết ăn gì?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white)),
                  Text('Quay vòng xoay ẩm thực lọc theo vị giác & dị ứng!', style: TextStyle(fontSize: 10, color: Colors.white60)),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SpinWheelScreen()),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.goldenAmber,
                foregroundColor: Colors.black,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              ),
              child: const Text('Quay Ngay', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );

  String _fmt(int n) {
    final s = n.toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    return buf.toString();
  }
}
