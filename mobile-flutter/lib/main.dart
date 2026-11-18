// =============================================================================
// FLUTTER CONSUMER MOBILE APP — HÔM NAY ĂN GÌ · TASTE OF VIETNAM v0.1
// 5-Tab Shell + Onboarding + M11–M13 Meal Plan, Group Poll, Booking
// =============================================================================

import 'package:flutter/material.dart';
import 'theme/app_theme.dart';
import 'screens/onboarding_taste_screen.dart';
import 'screens/today_home_screen.dart';
import 'screens/dish_detail_screen.dart';
import 'screens/mam_ai_chef_screen.dart';
import 'screens/map_places_screen.dart';
import 'screens/meal_plan_screen.dart';
import 'screens/group_poll_screen.dart';
import 'screens/booking_screen.dart';
import 'screens/cultural_story_screen.dart';
import 'screens/food_trail_screen.dart';
import 'screens/menu_translator_screen.dart';
import 'screens/b2g_insights_screen.dart';
import 'screens/merchant_portal_screen.dart';
import 'screens/admin_cms_screen.dart';
import 'screens/profile_expansion_screen.dart';

void main() {
  runApp(const TasteOfVietnamApp());
}

class TasteOfVietnamApp extends StatefulWidget {
  const TasteOfVietnamApp({super.key});

  @override
  State<TasteOfVietnamApp> createState() => _TasteOfVietnamAppState();
}

class _TasteOfVietnamAppState extends State<TasteOfVietnamApp> {
  bool _onboardingDone = false;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hôm nay ăn gì · Taste of Vietnam',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      home: _onboardingDone
          ? const MainShellScreen()
          : OnboardingTasteScreen(
              onComplete: () => setState(() => _onboardingDone = true),
            ),
    );
  }
}

// ─── Main Navigation Shell ────────────────────────────────────────────────────
class MainShellScreen extends StatefulWidget {
  const MainShellScreen({super.key});

  @override
  State<MainShellScreen> createState() => _MainShellScreenState();
}

class _MainShellScreenState extends State<MainShellScreen> {
  int _selectedIndex = 0;

  static const _navItems = [
    (Icons.home_rounded, 'Home'),
    (Icons.explore_outlined, 'Explore'),
    (Icons.add_circle_outline, ''), // FAB placeholder
    (Icons.place_outlined, 'Quán 3km'),
    (Icons.person_outline_rounded, 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    final screens = <Widget>[
      // 0 ─ M3-S01: Today Home (AI Chef Benchmark Screen 1)
      TodayHomeScreen(
        onOpenRecipe: () => setState(() => _selectedIndex = 1),
        onOpenAiChef: () => setState(() => _selectedIndex = 2),
      ),
      // 1 ─ M2-S04: Dish & Recipe Detail (AI Chef Benchmark Screen 2)
      const DishDetailScreen(),
      // 2 ─ M3-S04: Măm AI Chef Chat (Benchmark Screen 3) — via golden FAB
      const MamAiChefScreen(),
      // 3 ─ M4+M5: Map 3km + Deep-link Order + Report Auto-pause
      const MapPlacesScreen(),
      // 4 ─ M1+M8+M11-M16: Profile, Reminders, Expansion Hub
      const ProfileExpansionScreen(),
    ];

    return Scaffold(
      body: SafeArea(child: screens[_selectedIndex]),

      // ── Golden floating center + (Benchmark Screen 1) ──────────────────────
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppTheme.goldenAmber,
        foregroundColor: AppTheme.slateDark,
        elevation: 8,
        shape: const CircleBorder(),
        tooltip: 'Mở Măm AI Chef',
        onPressed: () => setState(() => _selectedIndex = 2),
        child: const Icon(Icons.add_rounded, size: 30),
      ),

      // ── Bottom App Bar (BottomAppBar + FAB notch) ──────────────────────────
      bottomNavigationBar: BottomAppBar(
        height: 64,
        padding: EdgeInsets.zero,
        notchMargin: 8,
        shape: const CircularNotchedRectangle(),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _NavBtn(icon: Icons.home_rounded, label: 'Home', idx: 0, cur: _selectedIndex, onTap: (i) => setState(() => _selectedIndex = i)),
            _NavBtn(icon: Icons.explore_outlined, label: 'Explore', idx: 1, cur: _selectedIndex, onTap: (i) => setState(() => _selectedIndex = i)),
            const SizedBox(width: 56), // Golden FAB space
            _NavBtn(icon: Icons.place_outlined, label: 'Quán 3km', idx: 3, cur: _selectedIndex, onTap: (i) => setState(() => _selectedIndex = i)),
            _NavBtn(icon: Icons.person_outline_rounded, label: 'Profile', idx: 4, cur: _selectedIndex, onTap: (i) => setState(() => _selectedIndex = i)),
          ],
        ),
      ),

      // ── Persistent bottom sheet shortcuts (Meal Plan & Group Poll) ─────────
      drawer: _buildDrawer(context),
    );
  }

  Drawer _buildDrawer(BuildContext context) {
    return Drawer(
      child: Column(
        children: [
          DrawerHeader(
            decoration: const BoxDecoration(color: AppTheme.charcoalHero),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                const Text('🧑‍🍳 Hôm nay ăn gì?', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppTheme.goldenAmber, borderRadius: BorderRadius.circular(99)),
                  child: const Text('Taste of Vietnam v0.1', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.slateDark)),
                ),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.calendar_today_rounded, color: AppTheme.amberDark),
            title: const Text('📅 Kế Hoạch 7 Ngày (M11)', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('Thực đơn & Giỏ đi chợ gộp', style: TextStyle(fontSize: 11)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const MealPlanScreen()));
            },
          ),
          ListTile(
            leading: const Icon(Icons.how_to_vote_rounded, color: AppTheme.emeraldBadge),
            title: const Text('🗳️ Bình Chọn Nhóm (M12)', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('Poll & Đánh giá GPS Verified', style: TextStyle(fontSize: 11)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const GroupPollScreen()));
            },
          ),
          ListTile(
            leading: const Icon(Icons.event_seat_rounded, color: AppTheme.goldenAmber),
            title: const Text('🎉 Đặt Bàn QR Voucher (M13)', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('Instant confirm · QR tại quầy', style: TextStyle(fontSize: 11)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const BookingScreen()));
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.menu_book_rounded, color: AppTheme.goldenAmber),
            title: const Text('📖 Chuyện Ẩm Thực & 3 Miền (M14)', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('Podcast di sản & Bản đồ biến thể', style: TextStyle(fontSize: 11)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const CulturalStoryScreen()));
            },
          ),
          ListTile(
            leading: const Icon(Icons.explore_rounded, color: AppTheme.emeraldBadge),
            title: const Text('🗺️ Food Trail & Hộ Chiếu QR (M15)', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('Hành trình ẩm thực 4 trạm', style: TextStyle(fontSize: 11)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const FoodTrailScreen()));
            },
          ),
          ListTile(
            leading: const Icon(Icons.language, color: Colors.blueAccent),
            title: const Text('🌐 Menu Translator AI (M16)', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('EN / KO / JA — Giữ tên tiếng Việt', style: TextStyle(fontSize: 11)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const MenuTranslatorScreen()));
            },
          ),
          ListTile(
            leading: const Icon(Icons.insights_rounded, color: Colors.purpleAccent),
            title: const Text('📊 B2G Insights & FMCG Brands (M17)', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('K-Anonymity k≥50 & Tài trợ nhãn hàng', style: TextStyle(fontSize: 11)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const B2gInsightsScreen()));
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.storefront_rounded, color: AppTheme.goldenAmber),
            title: const Text('🏪 Cổng Quán Ăn (M6)', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('AI Menu OCR · Đơn Live · Tài trợ Ads', style: TextStyle(fontSize: 11)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const MerchantPortalScreen()));
            },
          ),
          ListTile(
            leading: const Icon(Icons.admin_panel_settings_rounded, color: Colors.redAccent),
            title: const Text('🛡️ Quản Trị Hệ Thống (M9)', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: const Text('Duyệt OCR <95% · Auto-pause · Audit', style: TextStyle(fontSize: 11)),
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AdminCmsScreen()));
            },
          ),
          const Spacer(),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('API: http://127.0.0.1:3000/api/v1\nWS: ws://127.0.0.1:3000/ws/merchant',
                style: TextStyle(fontSize: 10, color: AppTheme.slateMuted), textAlign: TextAlign.center),
          ),
        ],
      ),
    );
  }
}

// ─── Bottom Nav Button ────────────────────────────────────────────────────────
class _NavBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final int idx;
  final int cur;
  final ValueChanged<int> onTap;

  const _NavBtn({required this.icon, required this.label, required this.idx, required this.cur, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final active = idx == cur;
    return GestureDetector(
      onTap: () => onTap(idx),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 72,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22, color: active ? AppTheme.amberDark : AppTheme.slateMuted),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: active ? FontWeight.w800 : FontWeight.w500,
                color: active ? AppTheme.amberDark : AppTheme.slateMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
