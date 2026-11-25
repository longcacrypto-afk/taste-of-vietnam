// M20 · Creator Kitchen & Community Recipe Hub Screen
// Hôm nay ăn gì · Taste of Vietnam v0.2
// Production Grade Luxury Dark Theme with Creator Leaderboard, Step-by-Step Recipe Publisher & VietQR 24/7 1-Click Tipping

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class CommunityRecipesScreen extends StatefulWidget {
  const CommunityRecipesScreen({super.key});

  @override
  State<CommunityRecipesScreen> createState() => _CommunityRecipesScreenState();
}

class _CommunityRecipesScreenState extends State<CommunityRecipesScreen> {
  bool _isLoading = true;
  String _selectedTag = 'all';
  List<dynamic> _recipes = [];

  final List<String> _tags = ['all', 'Zero-Waste', 'Eat Clean', 'Nhanh dưới 15p', 'Món chay'];

  @override
  void initState() {
    super.initState();
    _loadRecipes();
  }

  Future<void> _loadRecipes() async {
    setState(() => _isLoading = true);
    final data = await ApiService.fetchCommunityRecipes(
      tag: _selectedTag == 'all' ? null : _selectedTag,
    );
    if (mounted) {
      setState(() {
        _isLoading = false;
        if (data != null && data['recipes'] != null) {
          _recipes = data['recipes'] as List<dynamic>;
        } else {
          // Fallback realistic creator recipes
          _recipes = [
            {
              'id': 'CREC-01',
              'title': 'Cơm Chiên Kim Chi Bò Tơ Áp Chảo',
              'author': 'Chef Hưng (Biên Hòa Foodie)',
              'author_tier': 'Bếp Trưởng Vàng 🌟',
              'author_avatar': '🍳',
              'prep_time_minutes': 20,
              'difficulty': 'Dễ',
              'calories': 520,
              'likes_count': 342,
              'tips_received_vnd': 350000,
              'zero_waste_tag': 'Tận dụng cơm nguội & thịt bò',
              'ingredients': ['Cơm nguội 2 chén', 'Thịt bò 150g', 'Kim chi 100g', 'Trứng gà 1 quả'],
              'steps': [
                'Đập trứng vào tô cơm nguội bóp đều để hạt cơm tơi xốp và bọc lớp vàng óng.',
                'Áp chảo thịt bò phi lê với tỏi đập dập trên lửa lớn 2 phút.',
                'Phi thơm hành, đảo cơm vàng giòn rồi trộn đều cùng kim chi chua ngọt.'
              ],
            },
            {
              'id': 'CREC-02',
              'title': 'Canh Đậu Hũ Non Nấu Cà Chua Thanh Mát',
              'author': 'Lá Healthy Kitchen',
              'author_tier': 'Đại Sứ Eat Clean 🥗',
              'author_avatar': '🌿',
              'prep_time_minutes': 15,
              'difficulty': 'Rất dễ',
              'calories': 180,
              'likes_count': 512,
              'tips_received_vnd': 480000,
              'zero_waste_tag': 'Thanh lọc cơ thể, giải nhiệt mùa nóng',
              'ingredients': ['Đậu hũ non 2 miếng', 'Cà chua 2 quả', 'Hành ngò gai', 'Nấm rơm 50g'],
              'steps': [
                'Cà chua xào sơ cùng chút dầu hào để ra màu đỏ tự nhiên đẹp mắt.',
                'Cho 600ml nước lọc đun sôi, thả nấm rơm và đậu hũ non cắt quân cờ.',
                'Nêm 1 thìa nước mắm ngon, rắc tiêu và hành ngò tắt bếp ngay.'
              ],
            },
            {
              'id': 'CREC-03',
              'title': 'Gà Nướng Muối Ớt Lá Chanh Nồi Chiên Không Dầu',
              'author': 'Mẹ Bon Cơm Nhà',
              'author_tier': 'Nghệ Nhân Bếp Gia Đình 🏡',
              'author_avatar': '🍗',
              'prep_time_minutes': 30,
              'difficulty': 'Vừa',
              'calories': 460,
              'likes_count': 628,
              'tips_received_vnd': 620000,
              'zero_waste_tag': 'Ăn sạch không dầu mỡ',
              'ingredients': ['Đùi gà góc tư 2 cái', 'Muối hạt', 'Ớt hiểm 3 trái', 'Lá chanh non'],
              'steps': [
                'Khía nhẹ mặt thịt, giã muối ớt lá chanh ướp đều 20 phút.',
                'Nướng nhiệt độ 180°C trong 20 phút, lật mặt quét mật ong nướng thêm 5 phút da giòn tan.'
              ],
            },
          ];
        }
      });
    }
  }

  void _showTipDialog(BuildContext context, Map<String, dynamic> recipe) {
    int selectedAmount = 20000;
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('💸', style: TextStyle(fontSize: 26)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Tặng Thưởng Tác Giả (VietQR Napas 24/7)',
                            style: AppTheme.titleMedium.copyWith(color: AppTheme.goldenAmber, fontSize: 15)),
                        Text('Người nhận: ${recipe['author']}', style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white54),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const Text('Chọn mức tiền ủng hộ (100% về ví tác giả không khấu trừ):',
                  style: TextStyle(fontSize: 12, color: Colors.white70)),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [10000, 20000, 50000, 100000].map((amt) {
                  final isSelected = selectedAmount == amt;
                  return GestureDetector(
                    onTap: () => setModalState(() => selectedAmount = amt),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: isSelected ? AppTheme.goldenAmber.withOpacity(0.2) : AppTheme.surfaceElevated,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isSelected ? AppTheme.goldenAmber : const Color(0xFF27272A)),
                      ),
                      child: Text(
                        '${(amt / 1000).toStringAsFixed(0)}k đ',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: isSelected ? AppTheme.goldenAmber : Colors.white70,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              // Simulated QR code
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E24),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white12),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
                      child: const Icon(Icons.qr_code_2_rounded, color: Colors.black, size: 36),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('VietQR Napas 24/7 · MBBank / VCB / MoMo',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)),
                          const SizedBox(height: 2),
                          Text('Quét mã mở app ngân hàng tự động điền STK & số tiền $selectedAmount đ.',
                              style: AppTheme.labelSmall.copyWith(fontSize: 10)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.goldenAmber,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () async {
                    Navigator.pop(ctx);
                    await ApiService.tipCommunityRecipe(recipe['id'], selectedAmount);
                    if (mounted) {
                      setState(() {
                        recipe['tips_received_vnd'] = (recipe['tips_received_vnd'] ?? 0) + selectedAmount;
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('🎉 Cảm ơn bạn! Đã gửi tip $selectedAmount đ tới ${recipe['author']}!'),
                          backgroundColor: AppTheme.charcoalHero,
                        ),
                      );
                    }
                  },
                  child: Text('Xác Nhận Tip $selectedAmount đ Ngay', style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCreateRecipeDialog() {
    final titleController = TextEditingController();
    final ingController = TextEditingController();
    final timeController = TextEditingController(text: '20');
    final tagController = TextEditingController(text: 'Zero-Waste cơm nhà');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          left: 20,
          right: 20,
          top: 24,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('🍳', style: TextStyle(fontSize: 22)),
                  const SizedBox(width: 8),
                  Text('Đăng Công Thức Món Ăn Mới',
                      style: AppTheme.titleMedium.copyWith(color: AppTheme.goldenAmber, fontSize: 16)),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white54),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text('Chia sẻ bí quyết nấu nướng & nhận tiền tip trực tiếp từ cộng đồng người yêu ẩm thực.',
                  style: AppTheme.labelSmall.copyWith(fontSize: 11)),
              const SizedBox(height: 16),
              const Text('Tên món ăn:', style: TextStyle(color: Colors.white70, fontSize: 12)),
              const SizedBox(height: 4),
              TextField(
                controller: titleController,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Ví dụ: Bún sườn chua sấu giòn tan',
                  hintStyle: const TextStyle(color: Colors.white38),
                  filled: true,
                  fillColor: AppTheme.surfaceElevated,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              const Text('Nguyên liệu chính (ngăn cách bằng dấu phẩy):', style: TextStyle(color: Colors.white70, fontSize: 12)),
              const SizedBox(height: 4),
              TextField(
                controller: ingController,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Sườn non 400g, Quả sấu 5 quả, Cà chua 2 quả...',
                  hintStyle: const TextStyle(color: Colors.white38),
                  filled: true,
                  fillColor: AppTheme.surfaceElevated,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Thời gian nấu (phút):', style: TextStyle(color: Colors.white70, fontSize: 12)),
                        const SizedBox(height: 4),
                        TextField(
                          controller: timeController,
                          keyboardType: TextInputType.number,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          decoration: InputDecoration(
                            filled: true,
                            fillColor: AppTheme.surfaceElevated,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Thẻ Zero-Waste:', style: TextStyle(color: Colors.white70, fontSize: 12)),
                        const SizedBox(height: 4),
                        TextField(
                          controller: tagController,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          decoration: InputDecoration(
                            filled: true,
                            fillColor: AppTheme.surfaceElevated,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.goldenAmber,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    final t = titleController.text.trim();
                    if (t.isNotEmpty) {
                      final prepMins = int.tryParse(timeController.text) ?? 20;
                      final tagText = tagController.text.trim();
                      ApiService.createCommunityRecipe(
                        title: t,
                        author: 'Bạn (Đầu Bếp Nhà)',
                        prepTimeMinutes: prepMins,
                        calories: 380,
                        zeroWasteTag: tagText.isNotEmpty ? tagText : null,
                      );
                      setState(() {
                        _recipes.insert(0, {
                          'id': 'CREC-${DateTime.now().millisecondsSinceEpoch % 1000}',
                          'title': t,
                          'author': 'Bạn (Đầu Bếp Nhà)',
                          'author_tier': 'Tác Giả Mới ✨',
                          'author_avatar': '👨‍🍳',
                          'prep_time_minutes': prepMins,
                          'difficulty': 'Dễ',
                          'calories': 380,
                          'likes_count': 1,
                          'tips_received_vnd': 0,
                          'zero_waste_tag': tagText,
                          'ingredients': ingController.text.split(',').map((e) => e.trim()).toList(),
                          'steps': ['Sơ chế nguyên liệu tươi sạch.', 'Chế biến theo công thức gia truyền.'],
                        });
                      });
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('🎉 Công thức "$t" đã đăng thành công lên Bếp Sáng Tạo!')),
                      );
                    }
                  },
                  child: const Text('Đăng Công Thức Lên Cộng Đồng', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
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
            Text('Bếp Sáng Tạo & Tipping (M20)', style: AppTheme.titleLarge.copyWith(fontSize: 16)),
            Text('VietQR Napas 24/7 Creator Hub', style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.goldenAmber)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline_rounded, color: AppTheme.goldenAmber),
            tooltip: 'Đăng công thức',
            onPressed: _showCreateRecipeDialog,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.goldenAmber))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Hero Banner ──
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceElevated,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.3)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: AppTheme.goldenAmber.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                              child: const Text('CREATOR KITCHEN',
                                  style: TextStyle(color: AppTheme.goldenAmber, fontSize: 10, fontWeight: FontWeight.bold)),
                            ),
                            const Spacer(),
                            const Text('VietQR 1-Click Tipping 💸',
                                style: TextStyle(color: AppTheme.emeraldBadge, fontSize: 11, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Text('Cộng Đồng Đầu Bếp Gia Đình Việt Nam',
                            style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text(
                          'Khám phá công thức nấu món Việt từ các đầu bếp gia đình, học mẹo Zero-Waste và ủng hộ tác giả tức thì qua VietQR.',
                          style: AppTheme.labelSmall.copyWith(fontSize: 11, height: 1.4),
                        ),
                        const SizedBox(height: 14),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.goldenAmber,
                            foregroundColor: Colors.black,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          ),
                          icon: const Icon(Icons.edit_note_rounded, size: 18),
                          label: const Text('Đăng công thức của bạn', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                          onPressed: _showCreateRecipeDialog,
                        ),
                      ],
                    ),
                  ),

                  // ── Category Tag Chips ──
                  const SizedBox(height: 16),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: _tags.map((tag) {
                        final isSelected = _selectedTag == tag;
                        final label = tag == 'all' ? 'Tất cả món' : tag;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(label),
                            selected: isSelected,
                            selectedColor: AppTheme.goldenAmber.withOpacity(0.2),
                            labelStyle: TextStyle(
                              fontSize: 11,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                              color: isSelected ? AppTheme.goldenAmber : Colors.white70,
                            ),
                            backgroundColor: AppTheme.surfaceElevated,
                            side: BorderSide(
                              color: isSelected ? AppTheme.goldenAmber : const Color(0xFF27272A),
                            ),
                            onSelected: (selected) {
                              if (selected) {
                                setState(() => _selectedTag = tag);
                                _loadRecipes();
                              }
                            },
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                  // ── Recipe Feed ──
                  const SizedBox(height: 16),
                  ..._recipes.map((recipe) {
                    final ingredients = (recipe['ingredients'] as List<dynamic>?) ?? [];
                    final steps = (recipe['steps'] as List<dynamic>?) ?? [];
                    final likes = recipe['likes_count'] ?? 0;
                    final tips = (recipe['tips_received_vnd'] ?? 0) as int;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceElevated,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFF27272A)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Author Header
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 18,
                                  backgroundColor: AppTheme.goldenAmber.withOpacity(0.15),
                                  child: Text(recipe['author_avatar'] ?? '👨‍🍳', style: const TextStyle(fontSize: 18)),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(recipe['author'] ?? '',
                                          style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 13)),
                                      Text(recipe['author_tier'] ?? 'Đầu bếp cộng đồng',
                                          style: const TextStyle(fontSize: 10, color: AppTheme.goldenAmber)),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(color: AppTheme.emeraldBadge.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
                                  child: Text('Đã nhận ${(tips / 1000).toStringAsFixed(0)}k đ Tip',
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.emeraldBadge)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            // Recipe Title & Zero-Waste Tag
                            Text(recipe['title'] ?? '',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white)),
                            const SizedBox(height: 6),
                            if (recipe['zero_waste_tag'] != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(color: AppTheme.goldenAmber.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
                                child: Text('♻️ ${recipe['zero_waste_tag']}',
                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.goldenAmber)),
                              ),

                            const SizedBox(height: 12),
                            // Meta: Time, Difficulty, Calories
                            Row(
                              children: [
                                const Icon(Icons.timer_outlined, size: 14, color: Colors.white54),
                                const SizedBox(width: 4),
                                Text('${recipe['prep_time_minutes']} phút', style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                                const SizedBox(width: 12),
                                const Icon(Icons.fitness_center_rounded, size: 14, color: Colors.white54),
                                const SizedBox(width: 4),
                                Text('${recipe['difficulty']}', style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                                const SizedBox(width: 12),
                                const Icon(Icons.local_fire_department_rounded, size: 14, color: Colors.deepOrangeAccent),
                                const SizedBox(width: 4),
                                Text('${recipe['calories']} kcal', style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                              ],
                            ),

                            const SizedBox(height: 12),
                            // Ingredients Wrap
                            const Text('Nguyên liệu chính:', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              children: ingredients.map((ing) {
                                return Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(color: const Color(0xFF1E1E24), borderRadius: BorderRadius.circular(6)),
                                  child: Text('$ing', style: const TextStyle(color: Colors.white70, fontSize: 10)),
                                );
                              }).toList(),
                            ),

                            if (steps.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              const Text('Các bước chế biến:', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 6),
                              ...steps.asMap().entries.map((step) {
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 4),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('${step.key + 1}. ', style: const TextStyle(color: AppTheme.goldenAmber, fontSize: 11, fontWeight: FontWeight.bold)),
                                      Expanded(
                                        child: Text('${step.value}', style: AppTheme.labelSmall.copyWith(fontSize: 11, color: Colors.white60)),
                                      ),
                                    ],
                                  ),
                                );
                              }),
                            ],

                            const SizedBox(height: 14),
                            // Actions Row: Like, Delete & VietQR Tip
                            Row(
                              children: [
                                InkWell(
                                  borderRadius: BorderRadius.circular(8),
                                  onTap: () async {
                                    setState(() {
                                      recipe['likes_count'] = ((recipe['likes_count'] as int?) ?? 0) + 1;
                                    });
                                    await ApiService.likeCommunityRecipe((recipe['id'] as String?) ?? '');
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.favorite, color: Colors.redAccent, size: 18),
                                        const SizedBox(width: 4),
                                        Text('$likes', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Colors.white38),
                                  tooltip: 'Xóa công thức',
                                  onPressed: () async {
                                    final id = (recipe['id'] as String?) ?? '';
                                    setState(() => _recipes.removeWhere((r) => r['id'] == id));
                                    if (id.isNotEmpty) await ApiService.deleteCommunityRecipe(id);
                                  },
                                ),
                                const Spacer(),
                                ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppTheme.goldenAmber,
                                    foregroundColor: Colors.black,
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  icon: const Icon(Icons.qr_code_2_rounded, size: 16),
                                  label: const Text('Tip Tác Giả (VietQR)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                                  onPressed: () => _showTipDialog(context, recipe),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
    );
  }
}
