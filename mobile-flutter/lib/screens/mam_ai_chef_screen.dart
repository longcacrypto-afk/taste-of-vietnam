// =============================================================================
// M3-S04 MĂM AI CHEF SCREEN (AI CHEF BENCHMARK SCREEN 3 IN FLUTTER)
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class MamAiChefScreen extends StatelessWidget {
  const MamAiChefScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Center(
            child: Column(
              children: [
                Text('✨ Măm AI Chef', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                Text('Trợ lý ẩm thực & quán ngon của riêng bạn', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.skyBubble,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFDBEAFE)),
            ),
            child: const Text(
              'Chào anh Long! 👋\nNhà mình đang có nguyên liệu gì, hay tối nay 4 người ngân sách 300k muốn ăn gần nhà? Măm tạo thực đơn ngay nhé!',
              style: TextStyle(fontSize: 12, height: 1.4, color: AppTheme.slateDark),
            ),
          ),
        ],
      ),
    );
  }
}
