// M11 · Meal Plan Screen — 7-Day Planner + Shopping Cart
// Hôm nay ăn gì · Taste of Vietnam v0.1

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class MealPlanScreen extends StatefulWidget {
  const MealPlanScreen({super.key});
  @override
  State<MealPlanScreen> createState() => _MealPlanScreenState();
}

class _MealPlanScreenState extends State<MealPlanScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;

  final List<_DayMeal> _week = [
    _DayMeal('Thứ 2', 'Phở Bò Tái Nạm Hà Nội', 480, 55000, '🍜', null, false),
    _DayMeal('Thứ 3', 'Cơm Tấm Sườn Bì Chả', 620, 50000, '🍚', null, false),
    _DayMeal('Thứ 4 🌿', 'Gỏi Cuốn Chay Đậu Hũ', 310, 40000, '🥗', 'vegan', false),
    _DayMeal('Thứ 5', 'Bún Bò Huế O Xuân', 520, 60000, '🍲', null, false),
    _DayMeal('Thứ 6', 'Cá Lóc Kho Tộ', 380, 45000, '🐟', null, false),
    _DayMeal('Thứ 7', 'Bánh Mì Thịt Nướng', 420, 25000, '🥖', null, false),
    _DayMeal('CN ⚠️', 'Lẩu Thái Hải Sản', 450, 90000, '🦐', 'allergy', false),
  ];

  final List<_GroceryItem> _fridge = [
    _GroceryItem('Hành tím', '5 củ', true),
    _GroceryItem('Nước mắm', '1 chai', true),
  ];

  final List<_GroceryItem> _toBuy = [
    _GroceryItem('Xương bò', '500g', false),
    _GroceryItem('Bánh phở tươi', '300g', false),
    _GroceryItem('Thịt sườn heo', '400g', false),
    _GroceryItem('Bún tươi', '400g', false),
    _GroceryItem('Đậu hũ non', '200g', false),
    _GroceryItem('Rau sống', '1 bó', false),
    _GroceryItem('Cá lóc', '600g', false),
    _GroceryItem('Thịt ba chỉ', '300g', false),
    _GroceryItem('Bánh mì', '4 ổ', false),
    _GroceryItem('Tôm tươi', '500g', false),
    _GroceryItem('Mực', '300g', false),
    _GroceryItem('Nghêu', '500g', false),
    _GroceryItem('Sả', '5 cây', false),
    _GroceryItem('Lá chanh', '10 lá', false),
    _GroceryItem('Ớt tươi', '5 trái', false),
    _GroceryItem('Tỏi', '1 củ', false),
    _GroceryItem('Gừng', '50g', false),
    _GroceryItem('Rau thơm', '2 bó', false),
  ];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  int get _totalBudget => _week.fold(0, (s, m) => s + m.price);

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
        title: Text('Thực Đơn Tuần', style: AppTheme.titleLarge),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh_rounded, color: AppTheme.goldenAmber),
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('🤖 Lá đang tạo thực đơn mới...')),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tab,
          indicatorColor: AppTheme.goldenAmber,
          labelColor: AppTheme.goldenAmber,
          unselectedLabelColor: AppTheme.textSecondary,
          tabs: const [
            Tab(text: '📅 Thực Đơn 7 Ngày'),
            Tab(text: '🛒 Giỏ Đi Chợ'),
          ],
        ),
      ),
      body: TabBarView(
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
          '🌿 Lá',
          'Thực đơn tuần này cân bằng 2200–2400 kcal/ngày. '
          'Thứ 4 là ngày Mùng 1 — món chay nhẹ nhàng, tốt cho cơ thể!',
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
        color: AppTheme.charcoalHero,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Ngân sách tuần', style: AppTheme.labelSmall),
                const SizedBox(height: 4),
                Text(
                  '${_fmt(_totalBudget)}đ',
                  style: AppTheme.titleLarge
                      .copyWith(color: AppTheme.goldenAmber, fontSize: 24),
                ),
                const SizedBox(height: 2),
                Text('≈ ${_fmt(_totalBudget ~/ 7)}đ / ngày',
                    style: AppTheme.labelSmall),
              ],
            ),
          ),
          Column(
            children: [
              _calChip(
                  '${_week.fold(0, (s, m) => s + m.cal)}', 'kcal/tuần'),
              const SizedBox(height: 8),
              _calChip('${(_week.fold(0, (s, m) => s + m.cal) / 7).round()}',
                  'kcal/ngày'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _calChip(String val, String label) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
                    fontSize: 15)),
            Text(label, style: AppTheme.labelSmall.copyWith(fontSize: 10)),
          ],
        ),
      );

  Widget _buildDayCard(_DayMeal m) {
    Color borderColor = AppTheme.surfaceElevated;
    Widget? badge;
    if (m.tag == 'vegan') {
      borderColor = AppTheme.emeraldBadge;
      badge = _tagPill('🌿 Chay', AppTheme.emeraldBadge);
    } else if (m.tag == 'allergy') {
      borderColor = Colors.redAccent;
      badge = _tagPill('⚠️ Dị ứng', Colors.redAccent);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor, width: 1.5),
      ),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AppTheme.charcoalHero,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
              child: Text(m.emoji, style: const TextStyle(fontSize: 24))),
        ),
        title: Text(
          m.day,
          style: AppTheme.labelSmall.copyWith(color: AppTheme.goldenAmber),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(m.name,
                style: AppTheme.bodyMedium
                    .copyWith(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(height: 4),
            Row(children: [
              _infoChip('🔥 ${m.cal}kcal'),
              const SizedBox(width: 6),
              _infoChip('💰 ${_fmt(m.price)}đ'),
              if (badge != null) ...[const SizedBox(width: 6), badge],
            ]),
          ],
        ),
        trailing: IconButton(
          icon: const Icon(Icons.swap_horiz_rounded, size: 20),
          color: AppTheme.textSecondary,
          onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('🔄 Đổi món ${m.day}...')),
          ),
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
          '🛒 Bếp',
          'Đã kiểm tra tủ lạnh của bạn! Có sẵn 2 nguyên liệu, '
          'còn ${_toBuy.length} thứ cần mua. Tổng ước tính: ~${_fmt(185000)}đ.',
          AppTheme.goldenAmber,
        ),
        const SizedBox(height: 16),
        _sectionHeader('✅ Có sẵn trong tủ lạnh', AppTheme.emeraldBadge),
        const SizedBox(height: 8),
        ..._fridge.map(_buildGroceryRow),
        const SizedBox(height: 16),
        _sectionHeader('🛍️ Cần mua (${_toBuy.length} món)', AppTheme.goldenAmber),
        const SizedBox(height: 8),
        ..._toBuy.map(_buildGroceryRow),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('📤 Đã sao chép danh sách đi chợ!')),
          ),
          icon: const Icon(Icons.share_rounded, size: 18),
          label: const Text('Chia sẻ danh sách'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.goldenAmber,
            foregroundColor: Colors.black,
            minimumSize: const Size.fromHeight(48),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
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
      ),
      child: Row(
        children: [
          Icon(
            item.inFridge ? Icons.check_circle : Icons.radio_button_unchecked,
            color: item.inFridge ? AppTheme.emeraldBadge : AppTheme.textSecondary,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(item.name,
                style: AppTheme.bodyMedium.copyWith(fontSize: 13)),
          ),
          Text(item.qty, style: AppTheme.labelSmall),
          if (item.inFridge) ...[
            const SizedBox(width: 6),
            _tagPill('Có sẵn', AppTheme.emeraldBadge),
          ],
        ],
      ),
    );
  }

  // ─── Shared helpers ───────────────────────────────────────────────
  Widget _buildMascotTip(String name, String msg, Color accent) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: accent.withOpacity(0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: accent.withOpacity(0.3)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name,
                style: TextStyle(
                    color: accent,
                    fontWeight: FontWeight.bold,
                    fontSize: 13)),
            const SizedBox(width: 10),
            Expanded(
                child: Text(msg,
                    style: AppTheme.bodyMedium
                        .copyWith(fontSize: 12, height: 1.4))),
          ],
        ),
      );

  Widget _sectionHeader(String title, Color color) => Text(
        title,
        style: AppTheme.titleMedium.copyWith(color: color, fontSize: 14),
      );

  Widget _infoChip(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(text, style: AppTheme.labelSmall.copyWith(fontSize: 10)),
      );

  Widget _tagPill(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withOpacity(0.15),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(text,
            style: TextStyle(
                color: color, fontSize: 10, fontWeight: FontWeight.w600)),
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
  const _DayMeal(
      this.day, this.name, this.cal, this.price, this.emoji, this.tag, this.done);
}

class _GroceryItem {
  final String name, qty;
  final bool inFridge;
  const _GroceryItem(this.name, this.qty, this.inFridge);
}
