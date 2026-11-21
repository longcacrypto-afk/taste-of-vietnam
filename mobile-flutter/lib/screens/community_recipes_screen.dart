// M20 · Creator Kitchen & Community Recipe Hub Screen
// Hôm nay ăn gì · Taste of Vietnam v0.2

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
          // Fallback demo data
          _recipes = [
            {
              'id': 'CREC-01',
              'title': 'Cơm Chiên Kim Chi Bò Áp Chảo',
              'author': 'Chef Hưng (Biên Hòa Foodie)',
              'author_avatar': '🍳',
              'prep_time_minutes': 20,
              'difficulty': 'Dễ',
              'calories': 520,
              'likes_count': 342,
              'tips_received_vnd': 250000,
              'zero_waste_tag': 'Tận dụng cơm nguội & bò thừa',
              'ingredients': ['Cơm nguội 2 chén', 'Thịt bò 150g', 'Kim chi 100g', 'Trứng gà 1 quả']
            },
            {
              'id': 'CREC-02',
              'title': 'Canh Đậu Hũ Non Nấu Cà Chua Thanh Mát',
              'author': 'Lá Healthy Kitchen',
              'author_avatar': '🌿',
              'prep_time_minutes': 15,
              'difficulty': 'Rất dễ',
              'calories': 180,
              'likes_count': 512,
              'tips_received_vnd': 420000,
              'zero_waste_tag': 'Thanh lọc cơ thể, giải nhiệt mùa nóng',
              'ingredients': ['Đậu hũ non 2 miếng', 'Cà chua 2 quả', 'Hành ngò', 'Nấm rơm 50g']
            }
          ];
        }
      });
    }
  }

  void _showTipDialog(BuildContext context, Map<String, dynamic> recipe) {
    int selectedAmount = 20000;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: const EdgeInsets.all(24),
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
                        Text('Tặng Thưởng Tác Giả (VietQR)', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                        Text('Người nhận: ${recipe['author']}', style: const TextStyle(fontSize: 12, color: AppTheme.slateMuted)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text('Chọn mức tiền ủng hộ (100% về tác giả):', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
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
                        color: isSelected ? AppTheme.goldenAmber.withOpacity(0.15) : AppTheme.slateLight,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isSelected ? AppTheme.amberDark : AppTheme.slateBorder),
                      ),
                      child: Text(
                        '${(amt / 1000).toStringAsFixed(0)}k đ',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                          color: isSelected ? AppTheme.amberDark : AppTheme.slateDark,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.slateLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.qr_code_2_rounded, color: AppTheme.slateDark, size: 32),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('VietQR Chuẩn Napas 24/7', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                          Text('Chuyển khoản tức thì qua mọi app Ngân hàng / MoMo', style: const TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.amberDark,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () async {
                    Navigator.pop(ctx);
                    final tipRes = await ApiService.tipCommunityRecipe(recipe['id'], selectedAmount);
                    if (mounted) {
                      setState(() {
                        recipe['tips_received_vnd'] = (recipe['tips_received_vnd'] ?? 0) + selectedAmount;
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('🎉 Đã tạo mã VietQR Tip ${selectedAmount.toString()}đ thành công cho ${recipe['author']}!'),
                          backgroundColor: AppTheme.emeraldBadge,
                        ),
                      );
                    }
                  },
                  child: Text('Tạo Mã VietQR Tip ${selectedAmount.toString()}đ', style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCreateRecipeDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          left: 20,
          right: 20,
          top: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('🍳 Đăng Công Thức Món Ăn Mới', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            const Text('Chia sẻ bí quyết nấu nướng & nhận tiền tip trực tiếp từ cộng đồng.', style: TextStyle(fontSize: 12, color: AppTheme.slateMuted)),
            const SizedBox(height: 16),
            TextField(
              decoration: InputDecoration(
                labelText: 'Tên món ăn',
                hintText: 'Ví dụ: Bún sườn chua nấu sấu giòn tan',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: InputDecoration(
                labelText: 'Nguyên liệu chính (ngăn cách bằng dấu phẩy)',
                hintText: 'Sườn non 400g, Quả sấu 5 quả, Cà chua 2 quả...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Thời gian nấu (phút)',
                      hintText: '25',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    decoration: InputDecoration(
                      labelText: 'Gắn thẻ Zero-Waste',
                      hintText: 'Tận dụng đồ chua',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.amberDark,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('✅ Công thức của bạn đã được đăng thành công lên Bếp Sáng Tạo!'),
                      backgroundColor: AppTheme.emeraldBadge,
                    ),
                  );
                },
                child: const Text('Đăng Công Thức', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
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
      backgroundColor: AppTheme.slateLight,
      appBar: AppBar(
        title: const Text('🍳 Bếp Sáng Tạo & Tipping (M20)', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.slateDark,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline_rounded, color: AppTheme.amberDark),
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
                      gradient: const LinearGradient(
                        colors: [AppTheme.charcoalHero, Color(0xFF3F3F46)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(color: AppTheme.goldenAmber, borderRadius: BorderRadius.circular(99)),
                              child: const Text('CREATOR KITCHEN', style: TextStyle(color: AppTheme.slateDark, fontSize: 10, fontWeight: FontWeight.w900)),
                            ),
                            const Spacer(),
                            const Text('VietQR 1-Click Tipping 💸', style: TextStyle(color: Colors.white70, fontSize: 11)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Text('Cộng Đồng Nấu Ăn & Chia Sẻ Công Thức', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
                        const SizedBox(height: 6),
                        const Text(
                          'Khám phá hàng ngàn công thức nấu món Việt từ các đầu bếp gia đình, học mẹo Zero-Waste và ủng hộ trực tiếp qua VietQR.',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                        const SizedBox(height: 14),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.goldenAmber,
                            foregroundColor: AppTheme.slateDark,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          ),
                          icon: const Icon(Icons.edit_note_rounded, size: 18),
                          label: const Text('Đăng công thức của bạn', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
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
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                              color: isSelected ? AppTheme.amberDark : AppTheme.slateDark,
                            ),
                            backgroundColor: Colors.white,
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
                    final likes = recipe['likes_count'] ?? 0;
                    final tips = (recipe['tips_received_vnd'] ?? 0) as int;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.slateBorder),
                        boxShadow: [
                          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2)),
                        ],
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
                                      Text(recipe['author'] ?? '', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                                      const Text('Đầu bếp sáng tạo cộng đồng', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(color: AppTheme.emeraldBadge.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                                  child: Text('Đã nhận ${(tips / 1000).toStringAsFixed(0)}k đ Tip', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.emeraldBadge)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            // Recipe Title & Zero-Waste Tag
                            Text(recipe['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppTheme.slateDark)),
                            const SizedBox(height: 6),
                            if (recipe['zero_waste_tag'] != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(6)),
                                child: Text('♻️ ${recipe['zero_waste_tag']}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.amberDark)),
                              ),

                            const SizedBox(height: 12),
                            // Meta: Time, Difficulty, Calories
                            Row(
                              children: [
                                const Icon(Icons.timer_outlined, size: 15, color: AppTheme.slateMuted),
                                const SizedBox(width: 4),
                                Text('${recipe['prep_time_minutes']} phút', style: const TextStyle(fontSize: 11, color: AppTheme.slateMuted, fontWeight: FontWeight.w600)),
                                const SizedBox(width: 12),
                                const Icon(Icons.fitness_center_rounded, size: 15, color: AppTheme.slateMuted),
                                const SizedBox(width: 4),
                                Text('${recipe['difficulty']}', style: const TextStyle(fontSize: 11, color: AppTheme.slateMuted, fontWeight: FontWeight.w600)),
                                const SizedBox(width: 12),
                                const Icon(Icons.local_fire_department_outlined, size: 15, color: AppTheme.slateMuted),
                                const SizedBox(width: 4),
                                Text('${recipe['calories']} kcal', style: const TextStyle(fontSize: 11, color: AppTheme.slateMuted, fontWeight: FontWeight.w600)),
                              ],
                            ),

                            // Ingredients chips
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: ingredients.map((ing) {
                                return Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(color: AppTheme.slateLight, borderRadius: BorderRadius.circular(8)),
                                  child: Text(ing.toString(), style: const TextStyle(fontSize: 11, color: AppTheme.slateDark)),
                                );
                              }).toList(),
                            ),

                            const Divider(height: 24),
                            // Actions: Like & VietQR Tip
                            Row(
                              children: [
                                OutlinedButton.icon(
                                  style: OutlinedButton.styleFrom(
                                    side: const BorderSide(color: AppTheme.slateBorder),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  ),
                                  icon: const Icon(Icons.thumb_up_alt_outlined, size: 16, color: AppTheme.slateDark),
                                  label: Text('$likes Thích', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.slateDark)),
                                  onPressed: () {
                                    setState(() {
                                      recipe['likes_count'] = likes + 1;
                                    });
                                  },
                                ),
                                const Spacer(),
                                ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppTheme.goldenAmber,
                                    foregroundColor: AppTheme.slateDark,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                  ),
                                  icon: const Icon(Icons.redeem_rounded, size: 16),
                                  label: const Text('Tip VietQR', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                  onPressed: () => _showTipDialog(context, recipe),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ],
              ),
            ),
    );
  }
}
