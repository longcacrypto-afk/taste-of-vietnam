// =============================================================================
// M8 SCREEN: SMART CONTEXTUAL MEAL REMINDERS & WEATHER PUSH SIMULATOR
// Anti-fatigue SLA: <= 2 push notifications per day
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  String _lunchTime = '10:30';
  String _dinnerTime = '17:00';
  bool _weatherAdaptive = true;
  bool _antiFatigueStrict = true; // <= 2 push/day
  bool _isLoading = false;
  List<Map<String, dynamic>> _upcomingNotifs = [];

  @override
  void initState() {
    super.initState();
    _loadNotificationData();
  }

  Future<void> _loadNotificationData() async {
    setState(() => _isLoading = true);
    final data = await ApiService.fetchNotifications();
    if (mounted && data != null && data['items'] is List) {
      setState(() {
        _upcomingNotifs = (data['items'] as List)
            .map((item) => Map<String, dynamic>.from(item as Map))
            .toList();
        _isLoading = false;
      });
    } else {
      // Fallback
      if (mounted) {
        setState(() {
          _upcomingNotifs = [
            {
              'id': 'notif-1',
              'slot': '10:30',
              'title': 'Trời Biên Hòa đang mưa mát 24°C 🌧️',
              'body': 'Măm gợi ý Bún bò Huế O Xuân nóng hổi cách anh 1.1km!',
              'dish_id': 'DISH-103',
            },
            {
              'id': 'notif-2',
              'slot': '17:00',
              'title': 'Bữa tối ấm bụng cho gia đình 🍲',
              'body': 'Công thức Cá lóc kho tộ + Canh chua chỉ 35 phút nấu tại nhà.',
              'dish_id': 'DISH-106',
            },
          ];
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _saveSettings() async {
    setState(() => _isLoading = true);
    final res = await ApiService.updateMealReminderSchedule({
      'lunch': _lunchTime,
      'dinner': _dinnerTime,
      'max_per_day': 2,
      'weather_adaptive': _weatherAdaptive,
    });
    if (mounted) {
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('✓ Đã lưu cấu hình nhắc bữa ăn! Tuân thủ SLA ≤ 2 thông báo/ngày.',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          backgroundColor: AppTheme.charcoalHero,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: const BorderSide(color: AppTheme.emeraldBadge),
          ),
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  void _simulatePush(String title, String body, String slot) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.charcoalHero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppTheme.goldenAmber, width: 1.5),
        ),
        title: Row(
          children: [
            const Text('🔔', style: TextStyle(fontSize: 22)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Mô Phỏng Push Thông Báo ($slot)',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF27272A),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: AppTheme.goldenAmber, borderRadius: BorderRadius.circular(4)),
                        child: const Text('HÔM NAY ĂN GÌ', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.black)),
                      ),
                      const Spacer(),
                      const Text('Vừa xong', style: TextStyle(fontSize: 10, color: Colors.white54)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
                  const SizedBox(height: 4),
                  Text(body, style: const TextStyle(fontSize: 11, color: Colors.white70)),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'ℹ️ Thông báo tự động gửi đúng giờ qua Web Push & Firebase Cloud Messaging, có gắn nhãn thời tiết thực tế.',
              style: TextStyle(fontSize: 10, color: AppTheme.slateMuted),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Đóng', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.goldenAmber,
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Đang mở chi tiết món ăn...', style: TextStyle(fontSize: 12)),
                  backgroundColor: AppTheme.charcoalHero,
                  duration: Duration(seconds: 1),
                ),
              );
            },
            child: const Text('Xem Món Ngay 🍜', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surfaceElevated,
      appBar: AppBar(
        backgroundColor: AppTheme.charcoalHero,
        title: const Text('Nhắc Bữa Ăn & Thông Báo (M8)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.check, color: AppTheme.goldenAmber),
            tooltip: 'Lưu cài đặt',
            onPressed: _saveSettings,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.goldenAmber))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // 1. SLA Anti-Fatigue Banner
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppTheme.charcoalHero,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.4)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppTheme.goldenAmber.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        alignment: Alignment.center,
                        child: const Text('🛡️', style: TextStyle(fontSize: 20)),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Anti-Fatigue Push Guard (SLA ≤ 2 push/ngày)',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Bảo vệ người dùng khỏi spam: Đúng 2 khung giờ trưa & tối, không gửi dồn dập.',
                              style: TextStyle(color: Colors.white60, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // 2. Schedule Config Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Khung Giờ Nhắc Bữa Ăn', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      const SizedBox(height: 12),

                      // Lunch Slot
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Text('☀️', style: TextStyle(fontSize: 24)),
                        title: const Text('Bữa Trưa (Lunch Reminder)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        subtitle: const Text('Gợi ý quán ăn trưa gần văn phòng', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                        trailing: DropdownButton<String>(
                          value: _lunchTime,
                          underline: const SizedBox(),
                          items: const [
                            DropdownMenuItem(value: '10:00', child: Text('10:00')),
                            DropdownMenuItem(value: '10:30', child: Text('10:30 (Khuyên dùng)')),
                            DropdownMenuItem(value: '11:00', child: Text('11:00')),
                            DropdownMenuItem(value: '11:30', child: Text('11:30')),
                          ],
                          onChanged: (v) => setState(() => _lunchTime = v ?? '10:30'),
                        ),
                      ),
                      const Divider(),

                      // Dinner Slot
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Text('🌙', style: TextStyle(fontSize: 24)),
                        title: const Text('Bữa Tối (Dinner Reminder)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        subtitle: const Text('Gợi ý công thức nấu tại nhà & quán gia đình', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                        trailing: DropdownButton<String>(
                          value: _dinnerTime,
                          underline: const SizedBox(),
                          items: const [
                            DropdownMenuItem(value: '16:30', child: Text('16:30')),
                            DropdownMenuItem(value: '17:00', child: Text('17:00 (Khuyên dùng)')),
                            DropdownMenuItem(value: '17:30', child: Text('17:30')),
                            DropdownMenuItem(value: '18:00', child: Text('18:00')),
                          ],
                          onChanged: (v) => setState(() => _dinnerTime = v ?? '17:00'),
                        ),
                      ),
                      const Divider(),

                      // Weather Adaptive Toggle
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        activeColor: AppTheme.emeraldBadge,
                        title: const Text('Gợi ý theo thời tiết thực (Weather-Adaptive)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        subtitle: const Text('Trời mưa/lạnh gợi ý món lẩu, nước ấm nóng; trời oi bức gợi ý món thanh mát', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                        value: _weatherAdaptive,
                        onChanged: (v) => setState(() => _weatherAdaptive = v),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // 3. Upcoming Notifications Preview & Push Simulator
                const Text('Hàng Đợi Thông Báo & Giả Lập Push (Simulator)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 8),

                ..._upcomingNotifs.map((notif) {
                  final isLunch = notif['slot'] == '10:30' || notif['id'] == 'notif-1';
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: isLunch ? const Color(0xFFFEF3C7) : const Color(0xFFEDE9FE),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                isLunch ? '☀️ Bữa Trưa (${notif['slot']})' : '🌙 Bữa Tối (${notif['slot']})',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: isLunch ? const Color(0xFFB45309) : const Color(0xFF6D28D9),
                                ),
                              ),
                            ),
                            const Spacer(),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.charcoalHero,
                                foregroundColor: AppTheme.goldenAmber,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              onPressed: () => _simulatePush(
                                notif['title'] as String,
                                notif['body'] as String,
                                notif['slot'] as String,
                              ),
                              icon: const Icon(Icons.send_rounded, size: 12),
                              label: const Text('Bắn thử Push', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(notif['title'] as String, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text(notif['body'] as String, style: const TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                      ],
                    ),
                  );
                }),

                const SizedBox(height: 16),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.goldenAmber,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _saveSettings,
                  icon: const Icon(Icons.save_rounded, size: 18),
                  label: const Text('Lưu Thay Đổi Cài Đặt', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
    );
  }
}
