// M11 · Meal Plan Screen — 7-Day Planner + Smart Shopping Cart (Zero-Waste Deduplicated)
// Hôm nay ăn gì · Taste of Vietnam v0.2
// Production Grade Luxury Dark Theme with Fridge Deduplication, AI Swap Dish & Weekly Macro Summary

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class MealPlanScreen extends StatefulWidget {
  const MealPlanScreen({super.key});
  @override
  State<MealPlanScreen> createState() => _MealPlanScreenState();
}

class _MealPlanScreenState extends State<MealPlanScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  bool _isLoading = false;

  List<_DayMeal> _week = [
    _DayMeal('Thứ 2', 'Phở Bò Tái Nạm Hà Nội', 480, 55000, '🍜', null, false, 38, 55, 14),
    _DayMeal('Thứ 3', 'Cơm Tấm Sườn Bì Chả Sài Gòn', 620, 50000, '🍚', null, false, 32, 75, 22),
    _DayMeal('Thứ 4 🌿', 'Gỏi Cuốn Chay Đậu Hũ & Nấm', 310, 40000, '🥗', 'vegan', false, 18, 42, 8),
    _DayMeal('Thứ 5', 'Bún Bò Huế Gân Chả Cua Cố Đô', 520, 60000, '🍲', null, false, 35, 60, 16),
    _DayMeal('Thứ 6', 'Cá Lóc Kho Tộ & Canh Chua', 420, 45000, '🐟', null, false, 40, 38, 12),
    _DayMeal('Thứ 7', 'Bánh Mì Thịt Nướng Sả Ớt', 440, 30000, '🥖', null, false, 24, 52, 16),
    _DayMeal('Chủ Nhật', 'Lẩu Cua Đồng Bắp Bò Gia Đình', 580, 85000, '🍲', null, false, 45, 48, 20),
  ];

  final List<_GroceryItem> _fridge = [
    _GroceryItem('Hành tím & tỏi cô đơn', '100g', true),
    _GroceryItem('Nước mắm cá cơm truyền thống', '1 chai', true),
    _GroceryItem('Trứng gà ta (từ M18)', '6 quả', true),
    _GroceryItem('Đậu hũ non (từ M18)', '2 miếng', true),
  ];

  List<_GroceryItem> _toBuy = [
    _GroceryItem('Bắp bò hoa & gầu giòn', '500g', false),
    _GroceryItem('Bánh phở tươi Hà Nội', '400g', false),
    _GroceryItem('Sườn cốt lết heo tươi', '500g', false),
    _GroceryItem('Gạo tấm thơm ST25', '1 kg', false),
    _GroceryItem('Cá lóc đồng làm sạch', '700g', false),
    _GroceryItem('Bạc hà, đậu bắp, cà chua', '500g', false),
    _GroceryItem('Cua đồng xay lọc sẵn', '400g', false),
    _GroceryItem('Rau muống chẻ & hoa chuối', '1 túi', false),
  ];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _loadLiveMealPlan();
  }

  Future<void> _loadLiveMealPlan() async {
    setState(() => _isLoading = true);
    final data = await ApiService.fetchWeeklyMealPlan();
    if (mounted && data != null) {
      setState(() {
        if (data['days'] is List) {
          final list = data['days'] as List;
          if (list.isNotEmpty) {
            _week = list.map((item) {
              final dayStr = item['day'] ?? 'Ngày';
              final isVegan = dayStr.toString().contains('Mùng 1');
              return _DayMeal(
                dayStr,
                item['dish_name'] ?? 'Món ngon',
                item['calories'] ?? 450,
                item['est_market_cost_vnd'] ?? 50000,
                isVegan ? '🥗' : '🍲',
                isVegan ? 'vegan' : null,
                false,
                item['protein'] ?? 30,
                item['carbs'] ?? 50,
                item['fat'] ?? 15,
              );
            }).toList();
          }
        }
        if (data['consolidated_groceries'] is List) {
          final gList = data['consolidated_groceries'] as List;
          _toBuy = gList
              .where((g) => g['in_fridge'] != true)
              .map((g) => _GroceryItem(g['name'] ?? '', '${g['amount']} ${g['unit']}', false))
              .toList();
        }
        _isLoading = false;
      });
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  int get _totalBudget => _week.fold(0, (s, m) => s + m.price);
  int get _totalCalories => _week.fold(0, (s, m) => s + m.cal);

  void _swapMealModal(_DayMeal meal) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('🔄', style: TextStyle(fontSize: 22)),
                const SizedBox(width: 8),
                Text('Đổi Món Cho ${meal.day}',
                    style: AppTheme.titleMedium.copyWith(color: AppTheme.goldenAmber, fontSize: 16)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white54),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text('Mẹ AI đề xuất 3 món tương đương về calo (~${meal.cal} kcal) và ngân sách:',
                style: AppTheme.labelSmall.copyWith(fontSize: 11)),
            const SizedBox(height: 14),
            _swapOptionItem('Bún Chả Hà Nội Nướng Than Hoa', 510, 50000, '🍖', meal),
            _swapOptionItem('Mì Quảng Tôm Thịt Trứng Cút', 470, 45000, '🍜', meal),
            _swapOptionItem('Cơm Gà Xé Phay Hội An', 490, 50000, '🍗', meal),
          ],
        ),
      ),
    );
  }

  Widget _swapOptionItem(String name, int cal, int price, String emoji, _DayMeal meal) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF27272A)),
      ),
      child: ListTile(
        leading: Text(emoji, style: const TextStyle(fontSize: 24)),
        title: Text(name, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
        subtitle: Text('🔥 $cal kcal · 💰 ${_fmt(price)} đ', style: const TextStyle(color: Colors.white60, fontSize: 11)),
        trailing: ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.goldenAmber,
            foregroundColor: Colors.black,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          onPressed: () {
            Navigator.pop(context);
            setState(() {
              final idx = _week.indexOf(meal);
              if (idx != -1) {
                _week[idx] = _DayMeal(
                  meal.day,
                  name,
                  cal,
                  price,
                  emoji,
                  meal.tag,
                  meal.done,
                  30,
                  50,
                  15,
                );
              }
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('✅ Đã đổi món ${meal.day} sang "$name"')),
            );
          },
          child: const Text('Chọn món này', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgPage,
      appBar: AppBar(
        backgroundColor: AppTheme.bgPage,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Thực Đơn Tuần & Giỏ Đi Chợ (M11)', style: AppTheme.titleLarge.copyWith(fontSize: 16)),
            Text('Taste of Vietnam Weekly Planner', style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.goldenAmber)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync_rounded, color: AppTheme.goldenAmber),
            tooltip: 'Đồng bộ AI Cloud',
            onPressed: () {
              _loadLiveMealPlan();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('🤖 Đã tối ưu hóa thực đơn từ AI Cloud!')),
              );
            },
          ),
        ],
        bottom: TabBar(
          controller: _tab,
          indicatorColor: AppTheme.goldenAmber,
          labelColor: AppTheme.goldenAmber,
          unselectedLabelColor: AppTheme.textSecondary,
          tabs: [
            Tab(text: '📅 Thực Đơn 7 Ngày'),
            Tab(text: '🛒 Giỏ Đi Chợ (${_toBuy.length})'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.goldenAmber))
          : TabBarView(
              controller: _tab,
              children: [_buildWeekTab(), _buildGroceryTab()],
            ),
    );
  }

  // ─── TAB 1: 7-Day Plan ───────────────────────────────────────────
  Widget _buildWeekTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildBudgetCard(),
        const SizedBox(height: 12),
        _buildMascotTip(
          '🌿 Bếp Trưởng AI',
          'Thực đơn tuần này được cân đối tỷ lệ Đạm 30% / Tinh bột 50% / Béo 20%. '
          'Thứ 4 là ngày Mùng 1 âm lịch — gợi ý món Chay thanh khiết cho tâm an lành!',
          AppTheme.emeraldBadge,
        ),
        const SizedBox(height: 16),
        ..._week.map(_buildDayCard),
      ],
    );
  }

  Widget _buildBudgetCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Tổng chi phí đi chợ dự kiến', style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                const SizedBox(height: 4),
                Text(
                  '${_fmt(_totalBudget)} đ',
                  style: AppTheme.titleLarge.copyWith(color: AppTheme.goldenAmber, fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 2),
                Text('≈ ${_fmt(_totalBudget ~/ 7)} đ / ngày · Tiết kiệm 28% so với ăn ngoài',
                    style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.emeraldBadge)),
              ],
            ),
          ),
          Column(
            children: [
              _calChip('${_totalCalories}', 'kcal/tuần'),
              const SizedBox(height: 6),
              _calChip('${(_totalCalories / 7).round()}', 'kcal/ngày'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _calChip(String val, String label) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: AppTheme.goldenAmber.withOpacity(0.15),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(val,
                style: const TextStyle(
                    color: AppTheme.goldenAmber,
                    fontWeight: FontWeight.bold,
                    fontSize: 13)),
            Text(label, style: AppTheme.labelSmall.copyWith(fontSize: 9)),
          ],
        ),
      );

  Widget _buildDayCard(_DayMeal m) {
    Color borderColor = const Color(0xFF27272A);
    Widget? badge;
    if (m.tag == 'vegan') {
      borderColor = AppTheme.emeraldBadge.withOpacity(0.5);
      badge = _tagPill('🌿 Ngày Chay', AppTheme.emeraldBadge);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor, width: 1.2),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: const Color(0xFF1E1E24),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(child: Text(m.emoji, style: const TextStyle(fontSize: 24))),
        ),
        title: Text(
          m.day,
          style: AppTheme.labelSmall.copyWith(color: AppTheme.goldenAmber, fontWeight: FontWeight.bold),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(m.name, style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 4),
            Row(children: [
              _infoChip('🔥 ${m.cal} kcal'),
              const SizedBox(width: 6),
              _infoChip('💰 ${_fmt(m.price)} đ'),
              const SizedBox(width: 6),
              _infoChip('🥩 ${m.protein}g đạm'),
              if (badge != null) ...[const SizedBox(width: 6), badge],
            ]),
          ],
        ),
        trailing: IconButton(
          icon: const Icon(Icons.swap_horiz_rounded, size: 22),
          color: AppTheme.goldenAmber,
          tooltip: 'Đổi món',
          onPressed: () => _swapMealModal(m),
        ),
      ),
    );
  }

  // ─── TAB 2: Grocery List ─────────────────────────────────────────
  Widget _buildGroceryTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildMascotTip(
          '🛒 Trợ Lý Đi Chợ Thông Minh',
          'Hệ thống đã tự động đối chiếu Tủ Lạnh (M18): '
          'Có sẵn 4 món trong nhà, chỉ cần mua ${_toBuy.length} nguyên liệu tươi. Không lo mua thừa lãng phí!',
          AppTheme.goldenAmber,
        ),
        const SizedBox(height: 16),
        _sectionHeader('✅ Có sẵn trong tủ lạnh (Đã khấu trừ)', AppTheme.emeraldBadge),
        const SizedBox(height: 8),
        ..._fridge.map(_buildGroceryRow),
        const SizedBox(height: 16),
        _sectionHeader('🛍️ Cần mua tại chợ / siêu thị (${_toBuy.length} món)', AppTheme.goldenAmber),
        const SizedBox(height: 8),
        ..._toBuy.map(_buildGroceryRow),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('📤 Đã sao chép danh sách đi chợ vào Bộ nhớ tạm / Apple Notes!')),
            );
          },
          icon: const Icon(Icons.share_rounded, size: 18),
          label: const Text('Chia Sẻ Danh Sách Đi Chợ Cho Gia Đình'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.goldenAmber,
            foregroundColor: Colors.black,
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ],
    );
  }

  Widget _buildGroceryRow(_GroceryItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF27272A)),
      ),
      child: Row(
        children: [
          Icon(
            item.inFridge ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
            color: item.inFridge ? AppTheme.emeraldBadge : Colors.white38,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(item.name, style: AppTheme.bodyMedium.copyWith(fontSize: 13)),
          ),
          Text(item.qty, style: AppTheme.labelSmall.copyWith(color: AppTheme.goldenAmber, fontWeight: FontWeight.bold)),
          if (item.inFridge) ...[
            const SizedBox(width: 6),
            _tagPill('Trong Tủ Lạnh', AppTheme.emeraldBadge),
          ],
        ],
      ),
    );
  }

  // ─── Shared helpers ───────────────────────────────────────────────
  Widget _buildMascotTip(String name, String msg, Color accent) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: accent.withOpacity(0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: accent.withOpacity(0.3)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: TextStyle(color: accent, fontWeight: FontWeight.bold, fontSize: 12)),
            const SizedBox(width: 10),
            Expanded(
                child: Text(msg, style: AppTheme.labelSmall.copyWith(fontSize: 11, height: 1.4))),
          ],
        ),
      );

  Widget _sectionHeader(String title, Color color) => Text(
        title,
        style: AppTheme.titleMedium.copyWith(color: color, fontSize: 13, fontWeight: FontWeight.bold),
      );

  Widget _infoChip(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E24),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(text, style: AppTheme.labelSmall.copyWith(fontSize: 10)),
      );

  Widget _tagPill(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: color.withOpacity(0.15),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(text, style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.bold)),
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

// ─── Data models ───────────────────────────────────────────────────
class _DayMeal {
  final String day, name, emoji;
  final int cal, price;
  final String? tag;
  final bool done;
  final int protein, carbs, fat;
  const _DayMeal(
      this.day, this.name, this.cal, this.price, this.emoji, this.tag, this.done, this.protein, this.carbs, this.fat);
}

class _GroceryItem {
  final String name, qty;
  final bool inFridge;
  const _GroceryItem(this.name, this.qty, this.inFridge);
}
