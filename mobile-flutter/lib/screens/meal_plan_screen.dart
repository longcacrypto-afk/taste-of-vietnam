// M11 · Meal Plan Screen — 7-Day x 3-Meal Family Planner + Editable Smart Grocery Cart
// Hôm nay ăn gì · Taste of Vietnam v0.2
// Hỗ trợ tùy chỉnh số thành viên gia đình (1-8 người), số bữa/ngày (Sáng/Trưa/Tối), đổi món từng bữa & giỏ đi chợ chỉnh sửa được

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

  int _familySize = 4;
  bool _includeBreakfast = true;
  bool _includeLunch = true;
  bool _includeDinner = true;

  int get _mealsPerDay =>
      (_includeBreakfast ? 1 : 0) + (_includeLunch ? 1 : 0) + (_includeDinner ? 1 : 0);

  late List<_DayPlan> _week;

  final List<_GroceryItem> _fridge = [
    _GroceryItem('Hành tím & tỏi cô đơn', '100g', true, true),
    _GroceryItem('Nước mắm cá cơm truyền thống', '1 chai', true, true),
    _GroceryItem('Trứng gà ta (từ M18)', '6 quả', true, true),
    _GroceryItem('Đậu hũ non (từ M18)', '2 miếng', true, true),
  ];

  List<_GroceryItem> _toBuy = [
    _GroceryItem('Bắp bò hoa & gầu giòn', '500g', false, false),
    _GroceryItem('Bánh phở tươi Hà Nội', '400g', false, false),
    _GroceryItem('Sườn cốt lết heo tươi', '500g', false, false),
    _GroceryItem('Gạo tấm thơm ST25', '1 kg', false, false),
    _GroceryItem('Cá lóc đồng làm sạch', '700g', false, false),
    _GroceryItem('Bạc hà, đậu bắp, cà chua', '500g', false, false),
    _GroceryItem('Cua đồng xay lọc sẵn', '400g', false, false),
    _GroceryItem('Rau muống chẻ & hoa chuối', '1 túi', false, false),
  ];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _week = _defaultWeek();
    _loadLiveMealPlan();
  }

  List<_DayPlan> _defaultWeek() => [
        _DayPlan('Thứ 2', null,
            breakfast: _MealSlot('Sáng', 'Phở Bò Tái Nạm Hà Nội', 450, 45000, '🍜'),
            lunch: _MealSlot('Trưa', 'Cơm Tấm Sườn Bì Chả', 620, 55000, '🍚'),
            dinner: _MealSlot('Tối', 'Canh Chua Cá Lóc & Thịt Kho', 510, 65000, '🐟')),
        _DayPlan('Thứ 3', null,
            breakfast: _MealSlot('Sáng', 'Bánh Mì Chảo Thập Cẩm', 420, 35000, '🥖'),
            lunch: _MealSlot('Trưa', 'Bún Chả Hà Nội Than Hoa', 540, 50000, '🍖'),
            dinner: _MealSlot('Tối', 'Sườn Xào Chua Ngọt & Rau Muống', 560, 60000, '🥩')),
        _DayPlan('Thứ 4 (Mùng 1)', 'vegan',
            breakfast: _MealSlot('Sáng', 'Bún Riêu Chay Đậu Hũ', 360, 35000, '🥗'),
            lunch: _MealSlot('Trưa', 'Gỏi Cuốn Chay & Cơm Sen', 390, 45000, '🌿'),
            dinner: _MealSlot('Tối', 'Lẩu Nấm Chay Thanh Đạm', 440, 75000, '🍄')),
        _DayPlan('Thứ 5', null,
            breakfast: _MealSlot('Sáng', 'Hủ Tiếu Nam Vang', 430, 45000, '🍜'),
            lunch: _MealSlot('Trưa', 'Mì Quảng Tôm Thịt Trứng Cút', 490, 50000, '🍲'),
            dinner: _MealSlot('Tối', 'Cá Thu Sốt Cà & Canh Bí Đỏ', 500, 65000, '🐟')),
        _DayPlan('Thứ 6', null,
            breakfast: _MealSlot('Sáng', 'Xôi Gà Xé Phay Hành Phi', 460, 35000, '🍚'),
            lunch: _MealSlot('Trưa', 'Bún Bò Huế Gân Chả Cua', 550, 55000, '🍲'),
            dinner: _MealSlot('Tối', 'Thịt Kho Tàu Trứng Cút & Dưa Giá', 580, 60000, '🥚')),
        _DayPlan('Thứ 7', null,
            breakfast: _MealSlot('Sáng', 'Bánh Cuốn Nóng Chả Lụa', 380, 40000, '🥟'),
            lunch: _MealSlot('Trưa', 'Cơm Gà Xối Mỡ Da Giòn', 610, 55000, '🍗'),
            dinner: _MealSlot('Tối', 'Bò Lúc Lắc Khoai Tây & Salad', 620, 85000, '🥩')),
        _DayPlan('Chủ Nhật', null,
            breakfast: _MealSlot('Sáng', 'Phở Gà Ta Lá Chanh', 420, 45000, '🍜'),
            lunch: _MealSlot('Trưa', 'Bánh Xèo Miền Tây Tôm Thịt', 560, 60000, '🥞'),
            dinner: _MealSlot('Tối', 'Lẩu Cua Đồng Bắp Bò Gia Đình', 640, 95000, '🍲')),
      ];

  Future<void> _loadLiveMealPlan() async {
    setState(() => _isLoading = true);
    final data = await ApiService.fetchWeeklyMealPlan(
      familySize: _familySize,
      mealsPerDay: _mealsPerDay == 0 ? 1 : _mealsPerDay,
    );
    if (mounted && data != null) {
      setState(() {
        if (data['days'] is List && (data['days'] as List).isNotEmpty) {
          final list = data['days'] as List;
          _week = list.asMap().entries.map((entry) {
            final idx = entry.key;
            final item = entry.value as Map<String, dynamic>;
            final dayStr = (item['day'] ?? 'Ngày').toString();
            final isVegan = dayStr.contains('Mùng 1');
            final mealsMap = item['meals'] as Map<String, dynamic>?;
            final fallbackDay = _defaultWeek()[idx % 7];

            _MealSlot parseSlot(String key, String label, _MealSlot fb) {
              final m = mealsMap?[key] as Map<String, dynamic>?;
              if (m == null) return fb;
              return _MealSlot(
                label,
                (m['dish_name'] ?? fb.name).toString(),
                (m['calories'] as num?)?.toInt() ?? fb.cal,
                (m['est_market_cost_vnd'] as num?)?.toInt() ?? fb.price,
                isVegan ? '🥗' : fb.emoji,
              );
            }

            return _DayPlan(
              dayStr,
              isVegan ? 'vegan' : null,
              breakfast: parseSlot('breakfast', 'Sáng', fallbackDay.breakfast),
              lunch: parseSlot('lunch', 'Trưa', fallbackDay.lunch),
              dinner: parseSlot('dinner', 'Tối', fallbackDay.dinner),
            );
          }).toList();
        }
        if (data['consolidated_groceries'] is List) {
          final gList = data['consolidated_groceries'] as List;
          _toBuy = gList
              .where((g) => g['in_fridge'] != true)
              .map((g) => _GroceryItem(
                    (g['name'] ?? '').toString(),
                    '${g['amount']} ${g['unit']}',
                    false,
                    false,
                  ))
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

  List<_MealSlot> _activeSlotsOf(_DayPlan d) => [
        if (_includeBreakfast) d.breakfast,
        if (_includeLunch) d.lunch,
        if (_includeDinner) d.dinner,
      ];

  int get _totalBudget => _week.fold(
      0,
      (s, d) =>
          s +
          _activeSlotsOf(d)
              .fold(0, (ms, m) => ms + (m.price * _familySize / 2).round()));

  int get _totalCaloriesPerPerson =>
      _week.fold(0, (s, d) => s + _activeSlotsOf(d).fold(0, (ms, m) => ms + m.cal));

  void _swapMealModal(_DayPlan dayPlan, String slotKey, _MealSlot currentMeal) {
    final options = [
      ('Bún Chả Hà Nội Nướng Than Hoa', 510, 50000, '🍖'),
      ('Mì Quảng Tôm Thịt Trứng Cút', 470, 45000, '🍜'),
      ('Cơm Gà Xé Phay Hội An', 490, 50000, '🍗'),
      ('Phở Bò Tái Nạm Hà Nội', 480, 55000, '🍜'),
      ('Canh Chua Cá Lóc & Bông Điển Điển', 420, 60000, '🐟'),
      ('Gỏi Cuốn Chay Đậu Hũ & Nấm', 310, 40000, '🥗'),
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('🔄', style: TextStyle(fontSize: 22)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('Đổi Bữa ${currentMeal.slot} · ${dayPlan.day}',
                        style: AppTheme.titleMedium.copyWith(color: AppTheme.goldenAmber, fontSize: 16)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white54),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text('Chọn món thay thế (nhân tự động cho $_familySize thành viên gia đình):',
                  style: AppTheme.labelSmall.copyWith(fontSize: 11)),
              const SizedBox(height: 12),
              ...options.map((opt) {
                final (name, cal, price, emoji) = opt;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceElevated,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF27272A)),
                  ),
                  child: ListTile(
                    leading: Text(emoji, style: const TextStyle(fontSize: 22)),
                    title: Text(name, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
                    subtitle: Text('🔥 $cal kcal/người · 💰 ${_fmt((price * _familySize / 2).round())} đ/$_familySize người',
                        style: const TextStyle(color: Colors.white60, fontSize: 11)),
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
                        Navigator.pop(ctx);
                        setState(() {
                          final newSlot = _MealSlot(currentMeal.slot, name, cal, price, emoji);
                          if (slotKey == 'breakfast') dayPlan.breakfast = newSlot;
                          if (slotKey == 'lunch') dayPlan.lunch = newSlot;
                          if (slotKey == 'dinner') dayPlan.dinner = newSlot;
                        });
                        ApiService.saveWeeklyMealPlan(_week
                            .map((d) => {
                                  'day': d.day,
                                  'dish_name': d.lunch.name,
                                  'meals': {
                                    'breakfast': {'dish_name': d.breakfast.name, 'calories': d.breakfast.cal},
                                    'lunch': {'dish_name': d.lunch.name, 'calories': d.lunch.cal},
                                    'dinner': {'dish_name': d.dinner.name, 'calories': d.dinner.cal},
                                  }
                                })
                            .toList());
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('✅ Đã đổi bữa ${currentMeal.slot} ${dayPlan.day} sang "$name"')),
                        );
                      },
                      child: const Text('Chọn', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                  ),
                );
              }),
            ],
          ),
        ),
      ),
    );
  }

  void _addGroceryItemModal() {
    final nameCtrl = TextEditingController();
    final qtyCtrl = TextEditingController(text: '500g');
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('🛒 Thêm Nguyên Liệu Cần Mua', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              controller: nameCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                labelText: 'Tên nguyên liệu',
                labelStyle: const TextStyle(color: Colors.white54),
                filled: true,
                fillColor: const Color(0xFF27272A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: qtyCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                labelText: 'Định lượng (VD: 500g, 2 bó)',
                labelStyle: const TextStyle(color: Colors.white54),
                filled: true,
                fillColor: const Color(0xFF27272A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldenAmber, foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: () {
                  final n = nameCtrl.text.trim();
                  if (n.isEmpty) return;
                  Navigator.pop(ctx);
                  setState(() => _toBuy.insert(0, _GroceryItem(n, qtyCtrl.text.trim(), false, false)));
                },
                child: const Text('Thêm Vào Giỏ Đi Chợ', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
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
            Text('Thực Đơn Gia Đình 7 Ngày (M11)', style: AppTheme.titleLarge.copyWith(fontSize: 15)),
            Text('$_familySize người · $_mealsPerDay bữa/ngày · Sáng/Trưa/Tối',
                style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.goldenAmber)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync_rounded, color: AppTheme.goldenAmber),
            tooltip: 'Đồng bộ AI Cloud',
            onPressed: _loadLiveMealPlan,
          ),
        ],
        bottom: TabBar(
          controller: _tab,
          indicatorColor: AppTheme.goldenAmber,
          labelColor: AppTheme.goldenAmber,
          unselectedLabelColor: AppTheme.textSecondary,
          tabs: [
            const Tab(text: '📅 Thực Đơn 7 Ngày'),
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

  Widget _buildWeekTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildFamilyConfigCard(),
        const SizedBox(height: 12),
        _buildBudgetCard(),
        const SizedBox(height: 14),
        ..._week.map(_buildDayCard),
      ],
    );
  }

  Widget _buildFamilyConfigCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.charcoalHero,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('👨‍👩‍👧‍👦 Quy Mô Gia Đình:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.remove_circle_outline, color: AppTheme.goldenAmber, size: 22),
                onPressed: _familySize > 1 ? () => setState(() => _familySize--) : null,
              ),
              Text('$_familySize người', style: const TextStyle(color: AppTheme.goldenAmber, fontWeight: FontWeight.bold, fontSize: 14)),
              IconButton(
                icon: const Icon(Icons.add_circle_outline, color: AppTheme.goldenAmber, size: 22),
                onPressed: _familySize < 10 ? () => setState(() => _familySize++) : null,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            children: [
              FilterChip(
                label: const Text('☀️ Sáng', style: TextStyle(fontSize: 11)),
                selected: _includeBreakfast,
                selectedColor: AppTheme.goldenAmber.withOpacity(0.25),
                onSelected: (v) {
                  if (!v && !_includeLunch && !_includeDinner) return;
                  setState(() => _includeBreakfast = v);
                },
              ),
              FilterChip(
                label: const Text('🥢 Trưa', style: TextStyle(fontSize: 11)),
                selected: _includeLunch,
                selectedColor: AppTheme.goldenAmber.withOpacity(0.25),
                onSelected: (v) {
                  if (!v && !_includeBreakfast && !_includeDinner) return;
                  setState(() => _includeLunch = v);
                },
              ),
              FilterChip(
                label: const Text('🌙 Tối', style: TextStyle(fontSize: 11)),
                selected: _includeDinner,
                selectedColor: AppTheme.goldenAmber.withOpacity(0.25),
                onSelected: (v) {
                  if (!v && !_includeBreakfast && !_includeLunch) return;
                  setState(() => _includeDinner = v);
                },
              ),
            ],
          ),
        ],
      ),
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
                Text('Ngân sách đi chợ ($_familySize người · $_mealsPerDay bữa/ngày)',
                    style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                const SizedBox(height: 4),
                Text(
                  '${_fmt(_totalBudget)} đ',
                  style: AppTheme.titleLarge.copyWith(color: AppTheme.goldenAmber, fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 2),
                Text('≈ ${_fmt(_totalBudget ~/ 7)} đ/ngày cho cả nhà',
                    style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.emeraldBadge)),
              ],
            ),
          ),
          Column(
            children: [
              _calChip('${(_totalCaloriesPerPerson / 7).round()}', 'kcal/người'),
              const SizedBox(height: 6),
              _calChip('${_mealsPerDay * 7}', 'bữa/tuần'),
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
            Text(val, style: const TextStyle(color: AppTheme.goldenAmber, fontWeight: FontWeight.bold, fontSize: 13)),
            Text(label, style: AppTheme.labelSmall.copyWith(fontSize: 9)),
          ],
        ),
      );

  Widget _buildDayCard(_DayPlan dayPlan) {
    final isVegan = dayPlan.tag == 'vegan';
    final dayCost = _activeSlotsOf(dayPlan)
        .fold(0, (s, m) => s + (m.price * _familySize / 2).round());

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isVegan ? AppTheme.emeraldBadge.withOpacity(0.5) : const Color(0xFF27272A),
          width: 1.2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(dayPlan.day,
                  style: AppTheme.titleMedium.copyWith(color: AppTheme.goldenAmber, fontSize: 14, fontWeight: FontWeight.bold)),
              if (isVegan) ...[
                const SizedBox(width: 8),
                _tagPill('🌿 Ngày Chay', AppTheme.emeraldBadge),
              ],
              const Spacer(),
              Text('💰 ${_fmt(dayCost)} đ',
                  style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 10),
          if (_includeBreakfast) _buildMealSlotRow(dayPlan, 'breakfast', dayPlan.breakfast, '☀️'),
          if (_includeLunch) _buildMealSlotRow(dayPlan, 'lunch', dayPlan.lunch, '🥢'),
          if (_includeDinner) _buildMealSlotRow(dayPlan, 'dinner', dayPlan.dinner, '🌙'),
        ],
      ),
    );
  }

  Widget _buildMealSlotRow(_DayPlan dayPlan, String slotKey, _MealSlot meal, String slotIcon) {
    final scaledPrice = (meal.price * _familySize / 2).round();
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E24),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Text(meal.emoji, style: const TextStyle(fontSize: 20)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$slotIcon Bữa ${meal.slot} · ${meal.name}',
                    style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text('🔥 ${meal.cal} kcal/người · 💰 ${_fmt(scaledPrice)} đ/$_familySize người',
                    style: const TextStyle(color: Colors.white54, fontSize: 10)),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.swap_horiz_rounded, size: 19, color: AppTheme.goldenAmber),
            tooltip: 'Đổi món bữa ${meal.slot}',
            onPressed: () => _swapMealModal(dayPlan, slotKey, meal),
          ),
        ],
      ),
    );
  }

  Widget _buildGroceryTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildMascotTip(
          '🛒 Trợ Lý Đi Chợ Thông Minh',
          'Đã tự động nhân định lượng cho $_familySize người × $_mealsPerDay bữa/ngày và khấu trừ ${_fridge.length} món có sẵn trong Tủ Lạnh (M18).',
          AppTheme.goldenAmber,
        ),
        const SizedBox(height: 14),
        _sectionHeader('✅ Có sẵn trong tủ lạnh (Đã khấu trừ)', AppTheme.emeraldBadge),
        const SizedBox(height: 8),
        ..._fridge.map((g) => _buildGroceryRow(g, canEdit: false)),
        const SizedBox(height: 14),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _sectionHeader('🛍️ Cần mua (${_toBuy.length} món)', AppTheme.goldenAmber),
            TextButton.icon(
              onPressed: _addGroceryItemModal,
              icon: const Icon(Icons.add_circle_outline, size: 16, color: AppTheme.goldenAmber),
              label: const Text('Thêm món', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ..._toBuy.map((g) => _buildGroceryRow(g, canEdit: true)),
      ],
    );
  }

  Widget _buildGroceryRow(_GroceryItem item, {required bool canEdit}) {
    return InkWell(
      onTap: canEdit ? () => setState(() => item.bought = !item.bought) : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF27272A)),
        ),
        child: Row(
          children: [
            Icon(
              (item.inFridge || item.bought) ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
              color: (item.inFridge || item.bought) ? AppTheme.emeraldBadge : Colors.white38,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                item.name,
                style: AppTheme.bodyMedium.copyWith(
                  fontSize: 13,
                  decoration: item.bought && !item.inFridge ? TextDecoration.lineThrough : null,
                ),
              ),
            ),
            Text(item.qty, style: AppTheme.labelSmall.copyWith(color: AppTheme.goldenAmber, fontWeight: FontWeight.bold)),
            if (canEdit)
              IconButton(
                icon: const Icon(Icons.delete_outline, size: 16, color: Colors.redAccent),
                onPressed: () => setState(() => _toBuy.remove(item)),
              ),
          ],
        ),
      ),
    );
  }

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
            Expanded(child: Text(msg, style: AppTheme.labelSmall.copyWith(fontSize: 11, height: 1.4))),
          ],
        ),
      );

  Widget _sectionHeader(String title, Color color) => Text(
        title,
        style: AppTheme.titleMedium.copyWith(color: color, fontSize: 13, fontWeight: FontWeight.bold),
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

class _DayPlan {
  final String day;
  final String? tag;
  _MealSlot breakfast;
  _MealSlot lunch;
  _MealSlot dinner;
  _DayPlan(this.day, this.tag, {required this.breakfast, required this.lunch, required this.dinner});
}

class _MealSlot {
  final String slot, name, emoji;
  final int cal, price;
  const _MealSlot(this.slot, this.name, this.cal, this.price, this.emoji);
}

class _GroceryItem {
  final String name, qty;
  final bool inFridge;
  bool bought;
  _GroceryItem(this.name, this.qty, this.inFridge, this.bought);
}
