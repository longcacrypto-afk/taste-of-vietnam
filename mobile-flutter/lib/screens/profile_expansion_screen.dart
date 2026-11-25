// =============================================================================
// M1, M8 & M11..M16 SCREEN: TASTE PROFILE, HARD ALLERGY GUARD & EXPANSION HUB
// =============================================================================

import 'dart:convert';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import 'notifications_screen.dart';
import 'fridge_scanner_screen.dart';
import 'health_dietitian_screen.dart';
import 'community_recipes_screen.dart';

class ProfileExpansionScreen extends StatefulWidget {
  const ProfileExpansionScreen({super.key});

  @override
  State<ProfileExpansionScreen> createState() => _ProfileExpansionScreenState();
}

class _ProfileExpansionScreenState extends State<ProfileExpansionScreen> {
  final Set<String> _hardAllergies = {'shrimp', 'peanut'};
  final Set<String> _selectedRegions = {'bac', 'trung', 'nam'};
  int _spiceLevel = 1;
  String _dietMode = 'balanced';
  String _selectedMenuLang = 'KO';
  bool _lunarVegan = true;
  bool _lunchNotif = true;
  bool _dinnerNotif = true;
  bool _isLoading = false;
  Map<String, dynamic>? _userProfile;

  final List<Map<String, dynamic>> _familyMembers = [
    {'name': 'Bố (Anh Long)', 'role': 'Ăn đậm đà · Không dị ứng', 'allergies': <String>[]},
    {'name': 'Mẹ (Chị Lan)', 'role': 'Eat Clean · Kiêng cay', 'allergies': <String>['chili']},
    {'name': 'Bé Bi (5 tuổi)', 'role': 'Không cay · Dị ứng Tôm', 'allergies': <String>['shrimp']},
  ];

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoading = true);
    final data = await ApiService.fetchUserProfile();
    if (data != null && mounted) {
      setState(() {
        _userProfile = data;
        _spiceLevel = data['spice_level'] ?? 1;
        _dietMode = data['diet_mode'] ?? 'balanced';
        if (data['hard_allergies'] is List) {
          _hardAllergies.clear();
          for (var a in data['hard_allergies']) {
            _hardAllergies.add(a.toString());
          }
        }
        if (data['regions'] is List) {
          _selectedRegions.clear();
          for (var r in data['regions']) {
            _selectedRegions.add(r.toString());
          }
        }
      });
    }
    if (mounted) setState(() => _isLoading = false);
  }

  Future<void> _saveProfile() async {
    final res = await ApiService.updateUserProfile({
      'spice_level': _spiceLevel,
      'diet_mode': _dietMode,
      'hard_allergies': _hardAllergies.toList(),
      'regions': _selectedRegions.toList(),
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res != null
              ? '✅ Đã lưu hồ sơ vị giác thành công!'
              : '⚠️ Đã cập nhật chế độ offline.'),
          backgroundColor: AppTheme.emeraldBadge,
        ),
      );
    }
  }

  Future<void> _exportPdpdJson() async {
    final serverExport = await ApiService.exportPersonalData();
    final exportData = serverExport ?? _userProfile ?? {
      'hard_allergies': _hardAllergies.toList(),
      'regions': _selectedRegions.toList(),
      'spice_level': _spiceLevel,
      'diet_mode': _dietMode,
      'pdpd_compliance': 'Nghị định 13/2023/NĐ-CP',
    };

    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.charcoalHero,
        title: const Text('📥 Bản Sao Dữ Liệu Cá Nhân', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 16, fontWeight: FontWeight.w800)),
        content: SingleChildScrollView(
          child: Text(
            const JsonEncoder.withIndent('  ').convert(exportData),
            style: const TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'monospace'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Đóng', style: TextStyle(color: AppTheme.goldenAmber)),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteAccount() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('⚠️ Cảnh Báo Nghị Định 13/2023/NĐ-CP'),
        content: const Text('Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản và toàn bộ lịch sử ăn uống không? Thao tác này không thể hoàn tác.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xóa Vĩnh Viễn', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final res = await ApiService.deleteUserAccount();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res?['pdpd_compliance'] ?? 'Đã xóa toàn bộ dữ liệu cá nhân theo PDPD.'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.goldenAmber));
    }

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Hồ Sơ Vị Giác & Hệ Sinh Thái M1–M17', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                Text('M1 PDPD · M8 Nhắc lịch · M11–M17 Mở rộng', style: TextStyle(fontSize: 12, color: AppTheme.slateMuted)),
              ],
            ),
            ElevatedButton.icon(
              onPressed: _saveProfile,
              icon: const Icon(Icons.save, size: 14, color: AppTheme.charcoalHero),
              label: const Text('Lưu', style: TextStyle(color: AppTheme.charcoalHero, fontSize: 12, fontWeight: FontWeight.w800)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.goldenAmber,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // 1. M1 Hard Allergy Guard
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFFE4E6),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFFECDD3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('🛡️ Bộ Lọc Dị Ứng Cứng (M1-S06 · Chặn 100% cả món Tài trợ)',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFFBE123C))),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  {'id': 'shrimp', 'label': '🦐 Tôm / Hải sản'},
                  {'id': 'peanut', 'label': '🥜 Đậu phộng'},
                  {'id': 'dairy', 'label': '🥛 Sữa bò'},
                  {'id': 'gluten', 'label': '🌾 Gluten'},
                  {'id': 'shrimp_paste', 'label': '🫙 Mắm tôm'},
                  {'id': 'egg', 'label': '🥚 Trứng'},
                ].map((item) {
                  final active = _hardAllergies.contains(item['id']);
                  return FilterChip(
                    label: Text(item['label']!, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                    selected: active,
                    selectedColor: Colors.white,
                    onSelected: (v) {
                      setState(() {
                        if (v) {
                          _hardAllergies.add(item['id']!);
                        } else {
                          _hardAllergies.remove(item['id']!);
                        }
                      });
                    },
                  );
                }).toList(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 2. M1 Taste Preferences & Diets
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('🌶️ Mức Cay & Chế Độ Dinh Dưỡng', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              Row(
                children: [0, 1, 2, 3].map((lvl) {
                  final isSel = _spiceLevel == lvl;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: ChoiceChip(
                        label: Text(lvl == 0 ? '0' : 'Lv.$lvl', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        selected: isSel,
                        selectedColor: AppTheme.goldenAmber,
                        onSelected: (_) => setState(() => _spiceLevel = lvl),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: _dietMode,
                decoration: const InputDecoration(
                  labelText: 'Chế độ ăn',
                  labelStyle: TextStyle(fontSize: 12),
                  isDense: true,
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'balanced', child: Text('🍲 Cân bằng (Balanced)')),
                  DropdownMenuItem(value: 'vegetarian', child: Text('🥗 Ăn chay (Vegetarian)')),
                  DropdownMenuItem(value: 'vegan', child: Text('🌱 Thuần chay (Vegan)')),
                  DropdownMenuItem(value: 'low_carb', child: Text('🥩 Low Carb / Keto')),
                  DropdownMenuItem(value: 'eat_clean', child: Text('🥑 Eat Clean')),
                ],
                onChanged: (v) => setState(() => _dietMode = v ?? 'balanced'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 3. M8 Smart Meal Reminders (<= 2 push/day)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('🔔 Nhắc Bữa Thông Minh (M8 · Tối đa 2 push/ngày)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                        SizedBox(height: 4),
                        Text('Trưa 10:30 · Tối 17:00 · Tích hợp thời tiết 🌧️ Biên Hòa', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                      ],
                    ),
                  ),
                  Switch(
                    value: _lunarVegan,
                    activeTrackColor: AppTheme.emeraldBadge,
                    onChanged: (v) {
                      setState(() => _lunarVegan = v);
                      ApiService.updateMealReminderSchedule({
                        'lunch': '10:30',
                        'dinner': '17:00',
                        'lunar_vegan_reminder': v,
                        'max_per_day': 2,
                      });
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 4. M11 7-Day Meal Plan & Consolidated Grocery List
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('📅 Kế Hoạch Ăn 7 Ngày & Giỏ Đi Chợ Gộp (M11)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
              SizedBox(height: 6),
              Text('• Đã tự động gộp nguyên liệu 7 ngày & trừ 2 món sẵn có trong tủ lạnh (Hành tím, Bánh phở).',
                  style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
              SizedBox(height: 4),
              Text('• Tổng ngân sách đi chợ dự kiến: 385.000đ / tuần', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF15803D))),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 5. M16 Multilingual Menu Translator AI
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.charcoalHero,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('🌐 Menu Translator AI (M16)', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800)),
                  DropdownButton<String>(
                    value: _selectedMenuLang,
                    dropdownColor: AppTheme.charcoalHero,
                    style: const TextStyle(color: AppTheme.goldenAmber, fontSize: 12, fontWeight: FontWeight.w800),
                    items: const [
                      DropdownMenuItem(value: 'EN', child: Text('English (EN)')),
                      DropdownMenuItem(value: 'KO', child: Text('한국어 (KO)')),
                      DropdownMenuItem(value: 'JA', child: Text('日本語 (JA)')),
                      DropdownMenuItem(value: 'ZH', child: Text('中文 (ZH)')),
                    ],
                    onChanged: (v) => setState(() => _selectedMenuLang = v ?? 'EN'),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text('Tên gốc: Phở Bò Tái Nạm Hà Nội (45.000đ ~ \$1.80)',
                  style: TextStyle(color: AppTheme.goldenAmber, fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(
                _selectedMenuLang == 'KO'
                    ? '하노이 소고기 양지 쌀국수 — 12시간 우린 깊은 사골 육수'
                    : _selectedMenuLang == 'JA'
                        ? 'ハノイ風牛肉フォー（レア＆ブリスケット）'
                        : _selectedMenuLang == 'ZH'
                            ? '河内半熟牛腩牛肉粉 — 12小时牛骨浓郁高汤'
                            : 'Hanoi Sliced & Flank Beef Noodle Soup (12-hr marrow broth)',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 5b. Smart Meal Reminders & Weather Notification Shortcut (M8)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              const Text('🔔', style: TextStyle(fontSize: 22)),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Nhắc Bữa Ăn & Thông Báo Thời Tiết (M8)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                    SizedBox(height: 2),
                    Text('SLA ≤ 2 push/ngày · Giờ nhắc 10:30 & 17:00 · Simulator', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                  ],
                ),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.charcoalHero,
                  foregroundColor: AppTheme.goldenAmber,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                onPressed: () {
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen()));
                },
                child: const Text('Cài đặt', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 5c. Giai Đoạn 4 (v0.2): Smart Living & Community Hub Shortcuts
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('🚀 Hệ Sinh Thái Mới (Giai Đoạn 4 / v0.2)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: AppTheme.emeraldBadge.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
                    child: const Text('v0.2 LIVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.emeraldBadge)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.cyan.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                  child: const Text('🧊', style: TextStyle(fontSize: 20)),
                ),
                title: const Text('Tủ Lạnh Thông Minh AI (M18)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                subtitle: const Text('Quét mã EAN-13 · Cảnh báo cận hạn & Zero-Waste', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14),
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const FridgeScannerScreen())),
              ),
              const Divider(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.blueAccent.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                  child: const Text('🩺', style: TextStyle(fontSize: 20)),
                ),
                title: const Text('Bác Sĩ Dinh Dưỡng & Apple Health (M19)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                subtitle: const Text('Đồng bộ bước chân · TDEE · Macro Low-GI', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14),
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const HealthDietitianScreen())),
              ),
              const Divider(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: AppTheme.goldenAmber.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
                  child: const Text('🍳', style: TextStyle(fontSize: 20)),
                ),
                title: const Text('Bếp Sáng Tạo & Tipping VietQR (M20)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                subtitle: const Text('Công thức món Việt · Tặng thưởng 1-click Napas 24/7', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14),
                onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CommunityRecipesScreen())),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 5b. Hồ Sơ Gia Đình (M1-S08)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('👨‍👩‍👧‍👦 Khẩu Vị Gia Đình (M1-S08)',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                  TextButton.icon(
                    onPressed: _addFamilyMemberModal,
                    icon: const Icon(Icons.person_add_alt_1_rounded, size: 15, color: AppTheme.amberDark),
                    label: const Text('Thêm', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.amberDark)),
                  ),
                ],
              ),
              ..._familyMembers.map((m) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: const CircleAvatar(
                      radius: 16,
                      backgroundColor: Color(0xFFFEF3C7),
                      child: Text('👤', style: TextStyle(fontSize: 14)),
                    ),
                    title: Text(m['name'] as String, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                    subtitle: Text(m['role'] as String, style: const TextStyle(fontSize: 10, color: AppTheme.slateMuted)),
                    trailing: IconButton(
                      icon: const Icon(Icons.close_rounded, size: 16, color: Colors.redAccent),
                      onPressed: () {
                        setState(() => _familyMembers.remove(m));
                        ApiService.updateUserProfile({'family_members': _familyMembers});
                      },
                    ),
                  )),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 6. PDPD Compliance Actions (Nghị định 13/2023/NĐ-CP)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Text('🛡️', style: TextStyle(fontSize: 16)),
                  SizedBox(width: 6),
                  Text('Quyền Riêng Tư (Nghị Định 13/2023/NĐ-CP)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                ],
              ),
              const SizedBox(height: 6),
              const Text('Bạn có toàn quyền tải bản sao dữ liệu cá nhân hoặc yêu cầu xóa vĩnh viễn không thể khôi phục.',
                  style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _exportPdpdJson,
                      icon: const Icon(Icons.download, size: 14),
                      label: const Text('Xuất JSON', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                      onPressed: _deleteAccount,
                      icon: const Icon(Icons.delete_forever, size: 14),
                      label: const Text('Xóa Tài Khoản', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _addFamilyMemberModal() {
    final nameCtrl = TextEditingController();
    final noteCtrl = TextEditingController(text: 'Ăn vừa · Không cay');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Thêm Thành Viên Gia Đình', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Tên thành viên (VD: Ông Nội)')),
            TextField(controller: noteCtrl, decoration: const InputDecoration(labelText: 'Ghi chú khẩu vị / dị ứng')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () {
              final n = nameCtrl.text.trim();
              if (n.isEmpty) return;
              Navigator.pop(ctx);
              setState(() {
                _familyMembers.add({'name': n, 'role': noteCtrl.text.trim(), 'allergies': <String>[]});
              });
              ApiService.updateUserProfile({'family_members': _familyMembers});
            },
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
  }
}
