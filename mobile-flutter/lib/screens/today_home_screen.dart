// =============================================================================
// M3-S01 TODAY HOME SCREEN (AI CHEF BENCHMARK SCREEN 1 IN FLUTTER)
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class TodayHomeScreen extends StatelessWidget {
  final VoidCallback onOpenRecipe;
  final VoidCallback onOpenAiChef;

  const TodayHomeScreen({
    super.key,
    required this.onOpenRecipe,
    required this.onOpenAiChef,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Greeting Header + Avatar & Notification Bell
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Chào buổi sáng,', style: TextStyle(fontSize: 13, color: AppTheme.slateMuted)),
                  SizedBox(height: 2),
                  Row(
                    children: [
                      Text('Anh Long', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.slateDark)),
                      SizedBox(width: 6),
                      Icon(Icons.restaurant_menu_rounded, size: 20, color: AppTheme.slateDark),
                    ],
                  ),
                  Text('Hôm nay anh muốn ăn hay nấu món gì?', style: TextStyle(fontSize: 12, color: AppTheme.slateMuted)),
                ],
              ),
              Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: AppTheme.goldenAmber,
                    child: const Text('L', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.slateDark)),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceLight,
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Icon(Icons.notifications_none_rounded, size: 18),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),

          // 2. Dark Charcoal Hero Card (AI Suggests Your Perfect Meal)
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppTheme.heroCharcoal,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.emeraldAi,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text('✨ AI Powered', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Măm AI Gợi Ý\nBữa Ngon Hoàn Hảo',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800, height: 1.25),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Cho Măm biết tủ lạnh nhà mình có gì, hoặc khám phá 3 món ngon quanh bạn!',
                  style: TextStyle(color: Colors.white70, fontSize: 11),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.goldenAmber,
                    foregroundColor: AppTheme.slateDark,
                    shape: const StadiumBorder(),
                  ),
                  onPressed: onOpenAiChef,
                  child: const Text('Thử Măm AI Chef ›', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // 3. Popular / Today AI Recommendations
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Gợi ý Hôm nay (3 món AI)', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
              TextButton(onPressed: onOpenRecipe, child: const Text('Xem tất cả ›')),
            ],
          ),
          ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFE2E8F0))),
            title: const Text('Phở Bò Tái Nạm Hà Nội', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            subtitle: const Text('Trời mát 26°C · Quán cách 400m · 480 kcal', style: TextStyle(fontSize: 12)),
            trailing: const Text('45.000đ', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFD97736))),
            onTap: onOpenRecipe,
          ),
        ],
      ),
    );
  }
}
