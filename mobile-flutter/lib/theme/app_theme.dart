import 'package:flutter/material.dart';

class AppTheme {
  // Design Tokens (AI Chef Benchmark + Taste of Vietnam)
  static const Color primaryTangerine = Color(0xFFE87935);
  static const Color goldenAmber = Color(0xFFFBBF24);
  static const Color amberDark = Color(0xFFF59E0B);
  static const Color emeraldAi = Color(0xFF22C55E);
  static const Color emeraldBadge = Color(0xFF22C55E);
  static const Color heroCharcoal = Color(0xFF18181B);
  static const Color charcoalHero = Color(0xFF18181B);
  static const Color slateDark = Color(0xFF0F172A);
  static const Color slateMuted = Color(0xFF64748B);
  static const Color surfaceLight = Color(0xFFF8FAFC);
  static const Color surfaceElevated = Color(0xFFF8FAFC);
  static const Color bgPage = Color(0xFFF4F6F9);
  static const Color skyBubble = Color(0xFFEFF6FF);

  static ThemeData get lightTheme => ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: Colors.white,
        colorScheme: ColorScheme.fromSeed(
          seedColor: goldenAmber,
          primary: goldenAmber,
          secondary: emeraldAi,
          surface: Colors.white,
        ),
        fontFamily: 'Be Vietnam Pro',
      );

  static ThemeData get darkTheme => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0D0D0D),
        colorScheme: ColorScheme.fromSeed(
          seedColor: goldenAmber,
          brightness: Brightness.dark,
        ),
        fontFamily: 'Be Vietnam Pro',
      );
}
