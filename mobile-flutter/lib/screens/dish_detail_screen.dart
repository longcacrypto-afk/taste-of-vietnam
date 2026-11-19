// M2 · Dish Detail Screen — AI Chef Benchmark Screen 2
// Hôm nay ăn gì · Taste of Vietnam v0.1

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'map_places_screen.dart';

class DishDetailScreen extends StatefulWidget {
  final Map<String, dynamic>? dish;
  const DishDetailScreen({super.key, this.dish});

  @override
  State<DishDetailScreen> createState() => _DishDetailScreenState();
}

class _DishDetailScreenState extends State<DishDetailScreen> {
  int _portions = 2;
  bool _bookmarked = false;
  bool _startedCooking = false;
  int _currentStep = -1; // -1 = not started

  late Map<String, dynamic> _dish;

  @override
  void initState() {
    super.initState();
    _dish = widget.dish ?? _defaultDish;
  }

  static const Map<String, dynamic> _defaultDish = {
    'id': 'DISH-101',
    'emoji': '🍜',
    'name': 'Phở Bò Tái Nạm Hà Nội',
    'desc':
        'Phở bò truyền thống Hà Nội với nước dùng hầm 12 tiếng, thịt tái mềm ngọt, nạm giòn dai.',
    'time': '25 phút',
    'difficulty': 'Trung bình',
    'calories': 480,
    'rating': 4.8,
    'reviews': 1240,
    'region': 'Hà Nội',
    'ingredients': [
      {'emoji': '🍜', 'name': 'Bánh phở', 'base': 200, 'unit': 'g'},
      {'emoji': '🥩', 'name': 'Thịt bò tái', 'base': 100, 'unit': 'g'},
      {'emoji': '🦴', 'name': 'Xương bò', 'base': 500, 'unit': 'g'},
      {'emoji': '🧅', 'name': 'Hành tây nướng', 'base': 1, 'unit': 'củ'},
      {'emoji': '🫚', 'name': 'Nước mắm', 'base': 2, 'unit': 'muỗng'},
      {'emoji': '🌿', 'name': 'Rau thơm', 'base': 30, 'unit': 'g'},
    ],
    'steps': [
      {
        'num': 1,
        'title': 'Hầm nước dùng',
        'duration': '12 tiếng',
        'desc':
            'Hầm xương bò với hành tây nướng, gừng, hồi, quế ở nhiệt độ 90°C. Vớt bọt thường xuyên để nước trong.',
      },
      {
        'num': 2,
        'title': 'Trần bánh phở',
        'duration': '2 phút',
        'desc':
            'Cho bánh phở vào rổ tre, trần qua nước sôi 2 lần cho mềm đều. Để ráo rồi cho vào tô.',
      },
      {
        'num': 3,
        'title': 'Thái thịt & xếp tô',
        'duration': '5 phút',
        'desc':
            'Thái thịt bò tái thật mỏng, xếp lên mặt phở. Chan nước dùng sôi để chin thịt tại chỗ.',
      },
      {
        'num': 4,
        'title': 'Hoàn thiện',
        'duration': '2 phút',
        'desc':
            'Cho hành lá, ngò gai, hành phi lên mặt. Dọn kèm rau giá, chanh, ớt tươi theo sở thích.',
      },
    ],
  };

  String _scaleAmount(num base, String unit) {
    final scaled = (base * _portions / 2);
    final val = scaled == scaled.truncate() ? scaled.toInt() : scaled;
    return '$val $unit';
  }

  @override
  Widget build(BuildContext context) {
    final ingredients = List<Map<String, dynamic>>.from(_dish['ingredients']);
    final steps = List<Map<String, dynamic>>.from(_dish['steps']);

    return Scaffold(
      backgroundColor: AppTheme.bgPage,
      body: CustomScrollView(
        slivers: [
          _buildHeroSliver(context),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _buildInfoRow(),
                const SizedBox(height: 20),
                _buildPortionScaler(),
                const SizedBox(height: 20),
                _buildIngredientsGrid(ingredients),
                const SizedBox(height: 20),
                _buildStepsSection(steps),
                const SizedBox(height: 20),
                _buildNutritionCard(),
              ]),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomBar(),
    );
  }

  // ─── Hero Sliver ──────────────────────────────────────────────────
  Widget _buildHeroSliver(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 240,
      pinned: true,
      backgroundColor: AppTheme.charcoalHero,
      leading: GestureDetector(
        onTap: () => Navigator.pop(context),
        child: Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.black38,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.arrow_back_ios_new,
              color: Colors.white, size: 18),
        ),
      ),
      actions: [
        GestureDetector(
          onTap: () => setState(() => _bookmarked = !_bookmarked),
          child: Container(
            margin: const EdgeInsets.all(8),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.black38,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              _bookmarked ? Icons.bookmark : Icons.bookmark_outline,
              color: _bookmarked ? AppTheme.goldenAmber : Colors.white,
              size: 20,
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.only(right: 8, top: 8, bottom: 8),
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: Colors.black38,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.share_rounded, color: Colors.white, size: 20),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: Stack(
          fit: StackFit.expand,
          children: [
            Container(
              color: AppTheme.charcoalHero,
              child: Center(
                child: Text(_dish['emoji'],
                    style: const TextStyle(fontSize: 100)),
              ),
            ),
            // Gradient overlay at bottom
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                height: 80,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      AppTheme.bgPage,
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            // Chips at bottom
            Positioned(
              bottom: 12,
              left: 16,
              child: Row(
                children: [
                  _heroChip(Icons.access_time_rounded, _dish['time']),
                  const SizedBox(width: 8),
                  _heroChip(Icons.local_fire_department_outlined,
                      _dish['difficulty']),
                  const SizedBox(width: 8),
                  _heroChip(
                      Icons.local_dining_outlined, '${_dish['calories']} kcal'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _heroChip(IconData icon, String label) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.black54,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: Colors.white70),
            const SizedBox(width: 4),
            Text(label,
                style: const TextStyle(
                    color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500)),
          ],
        ),
      );

  // ─── Info Row ─────────────────────────────────────────────────────
  Widget _buildInfoRow() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _dish['name'],
                  style: AppTheme.titleLarge.copyWith(fontSize: 20),
                ),
              ),
              _regionBadge(_dish['region']),
            ],
          ),
          const SizedBox(height: 6),
          Text(_dish['desc'],
              style: AppTheme.bodyMedium
                  .copyWith(fontSize: 13, color: AppTheme.textSecondary, height: 1.4)),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.star_rounded,
                  color: AppTheme.goldenAmber, size: 18),
              const SizedBox(width: 4),
              Text(_dish['rating'].toString(),
                  style: const TextStyle(
                      color: AppTheme.goldenAmber,
                      fontWeight: FontWeight.bold,
                      fontSize: 15)),
              const SizedBox(width: 4),
              Text('(${_fmt(_dish['reviews'])} đánh giá)',
                  style: AppTheme.labelSmall),
              const SizedBox(width: 12),
              Icon(Icons.restaurant_menu,
                  size: 15, color: AppTheme.textSecondary),
              const SizedBox(width: 4),
              Text('$_portions khẩu phần', style: AppTheme.labelSmall),
            ],
          ),
        ],
      );

  Widget _regionBadge(String region) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: AppTheme.emeraldBadge.withOpacity(0.15),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text('📍 $region',
            style: const TextStyle(
                color: AppTheme.emeraldBadge,
                fontSize: 11,
                fontWeight: FontWeight.w600)),
      );

  // ─── Portion Scaler ───────────────────────────────────────────────
  Widget _buildPortionScaler() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Text('Khẩu phần', style: AppTheme.bodyMedium),
            const Spacer(),
            _scalerBtn(
                icon: Icons.remove,
                onTap: () {
                  if (_portions > 1) setState(() => _portions--);
                }),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text('$_portions',
                  style: AppTheme.titleLarge.copyWith(fontSize: 22)),
            ),
            _scalerBtn(
                icon: Icons.add,
                onTap: () {
                  if (_portions < 10) setState(() => _portions++);
                }),
          ],
        ),
      );

  Widget _scalerBtn({required IconData icon, required VoidCallback onTap}) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: AppTheme.goldenAmber,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: Colors.black, size: 20),
        ),
      );

  // ─── Ingredients Grid ─────────────────────────────────────────────
  Widget _buildIngredientsGrid(List<Map<String, dynamic>> ingredients) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Nguyên liệu', style: AppTheme.titleMedium),
              Text('${ingredients.length} món',
                  style: AppTheme.labelSmall
                      .copyWith(color: AppTheme.goldenAmber)),
            ],
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.0,
            ),
            itemCount: ingredients.length,
            itemBuilder: (_, i) {
              final ing = ingredients[i];
              return Container(
                decoration: BoxDecoration(
                  color: AppTheme.surfaceElevated,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(ing['emoji'], style: const TextStyle(fontSize: 28)),
                    const SizedBox(height: 4),
                    Text(ing['name'],
                        style: AppTheme.bodyMedium.copyWith(fontSize: 11),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    Text(
                      _scaleAmount(ing['base'], ing['unit']),
                      style: AppTheme.labelSmall.copyWith(
                          color: AppTheme.goldenAmber, fontSize: 10),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      );

  // ─── Steps ────────────────────────────────────────────────────────
  Widget _buildStepsSection(List<Map<String, dynamic>> steps) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Các bước nấu', style: AppTheme.titleMedium),
              Text('${steps.length} bước', style: AppTheme.labelSmall.copyWith(color: AppTheme.goldenAmber)),
            ],
          ),
          const SizedBox(height: 12),
          ...steps.asMap().entries.map((e) => _buildStepCard(e.value, e.key)),
        ],
      );

  Widget _buildStepCard(Map<String, dynamic> step, int index) {
    final isActive = _currentStep == index;
    final isDone = _currentStep > index;

    return GestureDetector(
      onTap: () => setState(() => _currentStep = index),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: isActive
              ? AppTheme.goldenAmber.withOpacity(0.1)
              : AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isActive
                ? AppTheme.goldenAmber
                : isDone
                    ? AppTheme.emeraldBadge.withOpacity(0.4)
                    : Colors.transparent,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Step number circle
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: isDone
                      ? AppTheme.emeraldBadge
                      : isActive
                          ? AppTheme.goldenAmber
                          : AppTheme.charcoalHero,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: isDone
                      ? const Icon(Icons.check, color: Colors.white, size: 16)
                      : Text(
                          '${step['num']}',
                          style: TextStyle(
                            color: isActive ? Colors.black : Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            step['title'],
                            style: AppTheme.bodyMedium.copyWith(
                                fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.charcoalHero,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '⏱ ${step['duration']}',
                            style: AppTheme.labelSmall.copyWith(fontSize: 10),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      step['desc'],
                      style: AppTheme.bodyMedium.copyWith(
                          fontSize: 12,
                          height: 1.5,
                          color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Nutrition Card ───────────────────────────────────────────────
  Widget _buildNutritionCard() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Thông tin dinh dưỡng', style: AppTheme.titleMedium),
            const SizedBox(height: 12),
            Row(
              children: [
                _nutritionItem('🔥', '${_dish['calories'] * _portions ~/ 2}', 'kcal'),
                _nutritionItem('💪', '${28 * _portions ~/ 2}g', 'Protein'),
                _nutritionItem('🌾', '${65 * _portions ~/ 2}g', 'Carbs'),
                _nutritionItem('🥑', '${12 * _portions ~/ 2}g', 'Chất béo'),
              ],
            ),
          ],
        ),
      );

  Widget _nutritionItem(String emoji, String val, String label) => Expanded(
        child: Column(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 20)),
            const SizedBox(height: 4),
            Text(val,
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14)),
            Text(label, style: AppTheme.labelSmall.copyWith(fontSize: 10)),
          ],
        ),
      );

  // ─── Bottom Bar ───────────────────────────────────────────────────
  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      decoration: BoxDecoration(
        color: AppTheme.bgPage,
        border: Border(
          top: BorderSide(color: AppTheme.surfaceElevated, width: 1),
        ),
      ),
      child: Row(
        children: [
          // Bookmark button
          GestureDetector(
            onTap: () => setState(() => _bookmarked = !_bookmarked),
            child: Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: AppTheme.surfaceElevated,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                _bookmarked ? Icons.bookmark : Icons.bookmark_outline,
                color: _bookmarked ? AppTheme.goldenAmber : AppTheme.textSecondary,
              ),
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton.icon(
            onPressed: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const MapPlacesScreen()));
            },
            icon: const Icon(Icons.place_outlined, size: 16),
            label: const Text('Quán 3km'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.goldenAmber,
              side: const BorderSide(color: AppTheme.goldenAmber),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              minimumSize: const Size(0, 50),
            ),
          ),
          const SizedBox(width: 8),
          // Start Cooking button
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () {
                setState(() {
                  _startedCooking = true;
                  _currentStep = 0;
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('👨‍🍳 Bắt đầu nấu! Làm theo từng bước nhé!'),
                    backgroundColor: Color(0xFF22C55E),
                  ),
                );
              },
              icon: const Text('✨', style: TextStyle(fontSize: 16)),
              label: Text(
                _startedCooking ? 'Đang nấu...' : 'Start Cooking',
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.goldenAmber,
                foregroundColor: Colors.black,
                minimumSize: const Size(0, 50),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _fmt(int n) {
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
    return n.toString();
  }
}
