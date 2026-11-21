// M19 · Smart Dietitian & Health Wearables Sync Screen
// Hôm nay ăn gì · Taste of Vietnam v0.2

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class HealthDietitianScreen extends StatefulWidget {
  const HealthDietitianScreen({super.key});

  @override
  State<HealthDietitianScreen> createState() => _HealthDietitianScreenState();
}

class _HealthDietitianScreenState extends State<HealthDietitianScreen> {
  bool _isLoading = true;
  bool _isSyncing = false;
  Map<String, dynamic>? _profile;

  @override
  void initState() {
    super.initState();
    _loadHealthProfile();
  }

  Future<void> _loadHealthProfile() async {
    setState(() => _isLoading = true);
    final data = await ApiService.fetchHealthProfile();
    if (mounted) {
      setState(() {
        _isLoading = false;
        if (data != null && data['health_profile'] != null) {
          _profile = data['health_profile'] as Map<String, dynamic>;
        } else {
          // Demo fallback
          _profile = {
            'user_id': 'usr_me',
            'connected_wearable': 'Apple Health',
            'last_synced_at': DateTime.now().toIso8601String(),
            'daily_steps': 8420,
            'active_calories_burned': 480,
            'target_calories_daily': 2150,
            'tdee': 2280,
            'macro_targets_g': {'protein': 120, 'carbs': 230, 'fat': 55},
            'blood_sugar_support': true,
          };
        }
      });
    }
  }

  Future<void> _syncWearables() async {
    setState(() => _isSyncing = true);
    final res = await ApiService.syncHealthWearable(
      wearable: 'Apple Health',
      dailySteps: 9150,
      activeCalories: 520,
      goal: 'maintain',
    );
    if (mounted) {
      setState(() {
        _isSyncing = false;
        if (res != null && res['synced_data'] != null) {
          _profile = res['synced_data'] as Map<String, dynamic>;
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ Đã đồng bộ 9,150 bước & 520 kcal từ Apple Health! TDEE cập nhật: 2,320 kcal'),
          backgroundColor: AppTheme.emeraldBadge,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final steps = _profile?['daily_steps'] ?? 8420;
    final activeBurn = _profile?['active_calories_burned'] ?? 480;
    final targetKcal = _profile?['target_calories_daily'] ?? 2150;
    final tdee = _profile?['tdee'] ?? 2280;
    final macros = (_profile?['macro_targets_g'] as Map<String, dynamic>?) ?? {'protein': 120, 'carbs': 230, 'fat': 55};
    final wearable = _profile?['connected_wearable'] ?? 'Apple Health';

    return Scaffold(
      backgroundColor: AppTheme.slateLight,
      appBar: AppBar(
        title: const Text('🩺 Bác Sĩ Dinh Dưỡng AI (M19)', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.slateDark,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Cập nhật chỉ số',
            onPressed: _loadHealthProfile,
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
                  // ── Device Sync Header ──
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
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
                              decoration: BoxDecoration(
                                color: Colors.blueAccent,
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: Text('ĐỒNG BỘ: $wearable', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900)),
                            ),
                            const Spacer(),
                            const Icon(Icons.watch_rounded, color: Colors.white70, size: 18),
                            const SizedBox(width: 4),
                            const Text('Vừa đồng bộ', style: TextStyle(color: Colors.white70, fontSize: 11)),
                          ],
                        ),
                        const SizedBox(height: 14),
                        const Text('Cá Nhân Hóa Bữa Ăn Theo Thể Trạng', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
                        const SizedBox(height: 6),
                        const Text(
                          'Tự động tính TDEE, lượng calo đốt và cân bằng Đạm/Carb/Béo cho từng bữa ăn truyền thống Việt Nam.',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.goldenAmber,
                            foregroundColor: AppTheme.slateDark,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          ),
                          icon: _isSyncing
                              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.slateDark))
                              : const Icon(Icons.sync_rounded, size: 20),
                          label: Text(_isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu tức thì', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                          onPressed: _isSyncing ? null : _syncWearables,
                        ),
                      ],
                    ),
                  ),

                  // ── Realtime Metrics Dashboard ──
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppTheme.slateBorder),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Row(
                                children: [
                                  Icon(Icons.directions_walk_rounded, color: Colors.blueAccent, size: 18),
                                  SizedBox(width: 6),
                                  Text('Số bước hôm nay', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted, fontWeight: FontWeight.w700)),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text('$steps', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.slateDark)),
                              const SizedBox(height: 2),
                              const Text('Mục tiêu 10.000 (84%)', style: TextStyle(fontSize: 10, color: AppTheme.emeraldBadge, fontWeight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppTheme.slateBorder),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Row(
                                children: [
                                  Icon(Icons.local_fire_department_rounded, color: Colors.deepOrangeAccent, size: 18),
                                  SizedBox(width: 6),
                                  Text('Calo tiêu hao', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted, fontWeight: FontWeight.w700)),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text('$activeBurn kcal', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.slateDark)),
                              const SizedBox(height: 2),
                              Text('TDEE: $tdee kcal', style: const TextStyle(fontSize: 10, color: AppTheme.amberDark, fontWeight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),

                  // ── Target Calories Bar ──
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.slateBorder),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Mục tiêu nạp calo', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                            Text('$targetKcal kcal / ngày', style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.amberDark)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(
                            value: (targetKcal / tdee).clamp(0.0, 1.0),
                            minHeight: 8,
                            backgroundColor: AppTheme.slateLight,
                            valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.emeraldBadge),
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text('Thâm hụt nhẹ 130 kcal hỗ trợ duy trì vóc dáng săn chắc.', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                      ],
                    ),
                  ),

                  // ── Macro Distribution Cards ──
                  const SizedBox(height: 20),
                  const Text('Tỷ lệ dinh dưỡng đa lượng (Macronutrients)', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      _buildMacroCard('Đạm (Protein)', '${macros['protein']}g', '30%', Colors.blueAccent),
                      const SizedBox(width: 8),
                      _buildMacroCard('Tinh bột (Carb)', '${macros['carbs']}g', '50%', Colors.orangeAccent),
                      const SizedBox(width: 8),
                      _buildMacroCard('Chất béo (Fat)', '${macros['fat']}g', '20%', Colors.pinkAccent),
                    ],
                  ),

                  // ── Blood Sugar & Low GI Badge ──
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFF86EFAC)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.health_and_safety_rounded, color: AppTheme.emeraldBadge, size: 28),
                        SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Chế độ Low-GI & Cân Bằng Đường Huyết: BẬT', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppTheme.slateDark)),
                              SizedBox(height: 2),
                              Text('Ưu tiên gạo lứt, bún gạo lứt, rau xanh cuộn và hạn chế đường tinh luyện trong nước mắm.', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ── Clinical AI Recommendation ──
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.slateBorder),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Text('🥗', style: TextStyle(fontSize: 20)),
                            SizedBox(width: 8),
                            Text('Gợi ý bữa trưa lý tưởng hôm nay', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Phở Bò Tái Nạm (nước trong, ít bánh, thêm giá trụng) hoặc Cơm Gạo Lứt Ức Gà Nướng Sả. Đạt chuẩn 42g protein và dưới 550 kcal.',
                          style: TextStyle(fontSize: 13, height: 1.4, color: AppTheme.slateDark),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: AppTheme.amberDark),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: const Icon(Icons.restaurant_menu, size: 18, color: AppTheme.amberDark),
                            label: const Text('Tìm quán đạt chuẩn dinh dưỡng gần bạn', style: TextStyle(fontWeight: FontWeight.w800, color: AppTheme.amberDark)),
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('📍 Đang lọc các quán phở tái nạc & cơm eat clean quanh 3km...'),
                                  backgroundColor: AppTheme.charcoalHero,
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildMacroCard(String title, String grams, String percent, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.slateBorder),
        ),
        child: Column(
          children: [
            Text(title, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.slateMuted), textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(grams, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: color)),
            const SizedBox(height: 2),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(6)),
              child: Text(percent, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color)),
            ),
          ],
        ),
      ),
    );
  }
}
