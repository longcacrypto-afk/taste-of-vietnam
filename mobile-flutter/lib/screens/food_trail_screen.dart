// M15 · Food Trail 4-Stop & Culinary Passport with QR Stamps
// Hôm nay ăn gì · Taste of Vietnam v0.1

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class FoodTrailScreen extends StatefulWidget {
  const FoodTrailScreen({super.key});

  @override
  State<FoodTrailScreen> createState() => _FoodTrailScreenState();
}

class _FoodTrailScreenState extends State<FoodTrailScreen> {
  final List<Map<String, dynamic>> _stops = [
    {
      'slot': '07:30 Sáng',
      'dish': 'Phở Bò Tái Nạm Hà Nội',
      'place': 'Phở Gia Truyền Phát Tài',
      'dist': '0.8 km',
      'emoji': '🍜',
      'stamped': true,
      'stampTime': '07:45',
    },
    {
      'slot': '12:00 Trưa',
      'dish': 'Cơm Tấm Sườn Bì Chả',
      'place': 'Cơm Tấm Sài Gòn Xưa',
      'dist': '1.5 km',
      'emoji': '🍚',
      'stamped': true,
      'stampTime': '12:15',
    },
    {
      'slot': '15:30 Xế',
      'dish': 'Gỏi Cuốn Chay Đậu Hũ',
      'place': 'Bếp Chay An Lạc',
      'dist': '2.1 km',
      'emoji': '🥗',
      'stamped': false,
      'stampTime': null,
    },
    {
      'slot': '19:00 Tối',
      'dish': 'Bún Bò Huế O Xuân',
      'place': 'Bún Bò Huế O Xuân',
      'dist': '3.0 km',
      'emoji': '🍲',
      'stamped': false,
      'stampTime': null,
    },
  ];

  int get _stampedCount => _stops.where((s) => s['stamped'] == true).length;

  void _checkinStop(int index) {
    if (_stops[index]['stamped']) return;
    setState(() {
      _stops[index]['stamped'] = true;
      _stops[index]['stampTime'] = 'Vừa xong';
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('🎉 Quét QR thành công! Đã đóng dấu trạm ${_stops[index]['dish']}'),
        backgroundColor: const Color(0xFF22C55E),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final progress = _stampedCount / _stops.length;

    return Scaffold(
      backgroundColor: AppTheme.bgPage,
      appBar: AppBar(
        backgroundColor: AppTheme.bgPage,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Food Trail & Hộ Chiếu', style: AppTheme.titleLarge),
        actions: [
          IconButton(
            icon: Icon(Icons.qr_code_scanner_rounded, color: AppTheme.goldenAmber),
            onPressed: () => _showScanModal(context),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildPassportCard(progress),
          const SizedBox(height: 20),
          _buildTrailHeader(),
          const SizedBox(height: 14),
          ..._stops.asMap().entries.map((e) => _buildStopTimelineItem(e.key, e.value)),
          const SizedBox(height: 24),
          _buildRewardBanner(),
        ],
      ),
    );
  }

  Widget _buildPassportCard(double progress) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.4)),
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.goldenAmber.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text('🛂 HỘ CHIẾU ẨM THỰC',
                      style: TextStyle(color: AppTheme.goldenAmber, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
                const Spacer(),
                Text('$_stampedCount / ${_stops.length} Dấu',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: List.generate(_stops.length, (i) {
                final isDone = _stops[i]['stamped'];
                return Expanded(
                  child: Container(
                    margin: EdgeInsets.only(right: i < _stops.length - 1 ? 8 : 0),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: isDone ? AppTheme.emeraldBadge.withOpacity(0.15) : AppTheme.surfaceElevated,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isDone ? AppTheme.emeraldBadge : Colors.transparent,
                        width: 1.5,
                      ),
                    ),
                    child: Column(
                      children: [
                        Text(isDone ? '💮' : '⭕', style: const TextStyle(fontSize: 22)),
                        const SizedBox(height: 4),
                        Text('Trạm ${i + 1}',
                            style: TextStyle(
                              color: isDone ? AppTheme.emeraldBadge : AppTheme.textSecondary,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            )),
                      ],
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: AppTheme.surfaceElevated,
                valueColor: const AlwaysStoppedAnimation(AppTheme.goldenAmber),
                minHeight: 6,
              ),
            ),
          ],
        ),
      );

  Widget _buildTrailHeader() => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('📍 Hành Trình 4 Trạm Trong Ngày', style: AppTheme.titleMedium.copyWith(fontSize: 15)),
          Text('Biên Hòa · 1 Ngày', style: AppTheme.labelSmall.copyWith(color: AppTheme.goldenAmber)),
        ],
      );

  Widget _buildStopTimelineItem(int idx, Map<String, dynamic> stop) {
    final isDone = stop['stamped'];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDone ? AppTheme.emeraldBadge.withOpacity(0.3) : Colors.transparent),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: isDone ? AppTheme.emeraldBadge.withOpacity(0.15) : AppTheme.charcoalHero,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(child: Text(stop['emoji'], style: const TextStyle(fontSize: 24))),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(stop['slot'], style: TextStyle(color: AppTheme.goldenAmber, fontSize: 11, fontWeight: FontWeight.bold)),
                    const SizedBox(width: 8),
                    Text('•  ${stop['dist']}', style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                  ],
                ),
                const SizedBox(height: 2),
                Text(stop['dish'], style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.w600, fontSize: 13)),
                Text(stop['place'], style: AppTheme.labelSmall.copyWith(fontSize: 11)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (isDone)
            Column(
              children: [
                const Icon(Icons.check_circle_rounded, color: AppTheme.emeraldBadge, size: 22),
                const SizedBox(height: 2),
                Text('Đã check-in', style: TextStyle(color: AppTheme.emeraldBadge, fontSize: 9)),
              ],
            )
          else
            ElevatedButton(
              onPressed: () => _checkinStop(idx),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.goldenAmber,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                minimumSize: const Size(0, 32),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Quét QR', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
            ),
        ],
      ),
    );
  }

  Widget _buildRewardBanner() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.goldenAmber.withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            const Text('🏆', style: TextStyle(fontSize: 32)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Huy Hiệu: Đại Sứ Ẩm Thực', style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text('Hoàn thành cả 4 trạm để nhận voucher giảm 20% và huy hiệu danh dự!',
                      style: AppTheme.labelSmall.copyWith(fontSize: 11, height: 1.4)),
                ],
              ),
            ),
          ],
        ),
      );

  void _showScanModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.qr_code_scanner_rounded, size: 64, color: AppTheme.goldenAmber),
            const SizedBox(height: 14),
            Text('Quét Mã QR Tại Quán', style: AppTheme.titleMedium),
            const SizedBox(height: 6),
            Text('Hướng camera vào mã QR đặt trên bàn để nhận tem đóng dấu tự động.',
                textAlign: TextAlign.center, style: AppTheme.labelSmall),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                _checkinStop(2); // check-in trạm tiếp theo
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.goldenAmber,
                foregroundColor: Colors.black,
                minimumSize: const Size.fromHeight(46),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Mô Phỏng Quét QR Thành Công'),
            ),
          ],
        ),
      ),
    );
  }
}
