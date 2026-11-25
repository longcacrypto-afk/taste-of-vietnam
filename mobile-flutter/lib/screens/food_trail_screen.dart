// =============================================================================
// M15 · FOOD TRAIL & CULINARY PASSPORT WITH QR CHECK-IN STAMPS
// Hôm nay ăn gì · Taste of Vietnam v0.2
// Multi-City Trails (Hà Nội, Sài Gòn, Huế) & Digital Badge Collection
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import 'map_places_screen.dart';

class FoodTrailScreen extends StatefulWidget {
  const FoodTrailScreen({super.key});

  @override
  State<FoodTrailScreen> createState() => _FoodTrailScreenState();
}

class _FoodTrailScreenState extends State<FoodTrailScreen> with SingleTickerProviderStateMixin {
  int _selectedTrailIndex = 0;
  late AnimationController _laserCtrl;

  final List<Map<String, dynamic>> _trails = [
    {
      'id': 'TRAIL-HN',
      'city': 'Hà Nội',
      'title': 'Phố Cổ Hà Nội — 100 Năm Vị Xưa',
      'badge_name': 'Đại Sứ Ẩm Thực Phố Cổ',
      'badge_emoji': '🎖️',
      'badge_color': Color(0xFFF59E0B),
      'voucher_reward': 'VOUCHER GIẢM 50.000Đ TẠI QUÁN',
      'total_dist': '3.2 km',
      'est_time': '45 phút đi bộ',
      'desc': 'Khám phá 4 di sản ẩm thực nghìn năm văn hiến giữa 36 phố phường Hà Nội.',
      'stops': [
        {
          'slot': '07:30 Sáng',
          'dish': 'Phở Bò Tái Nạm Bát Đàn',
          'place': 'Phở Gia Truyền Bát Đàn',
          'address': '49 Bát Đàn, Q. Hoàn Kiếm',
          'price': '55.000đ',
          'must_try': 'Nước dùng trong vắt tủy bò, quẩy giòn tự chiên.',
          'dist': '0.6 km',
          'emoji': '🍜',
          'stamped': true,
          'stamp_time': '07:45 Sáng',
        },
        {
          'slot': '09:30 Sáng',
          'dish': 'Cà Phê Trứng Giảng',
          'place': 'Giảng Cafe Hàng Gai',
          'address': '39 Nguyễn Hữu Huân, Q. Hoàn Kiếm',
          'price': '35.000đ',
          'must_try': 'Lớp kem trứng đánh bông béo ngậy trên nền cà phê phin đậm đà.',
          'dist': '1.2 km',
          'emoji': '☕',
          'stamped': true,
          'stamp_time': '09:50 Sáng',
        },
        {
          'slot': '12:30 Trưa',
          'dish': 'Bún Chả Nem Cua Bể',
          'place': 'Bún Chả Đắc Kim Hàng Mành',
          'address': 'Số 1 Hàng Mành, Q. Hoàn Kiếm',
          'price': '65.000đ',
          'must_try': 'Chả miếng nướng kẹp que tre thơm lừng than hoa, nem cua bể giòn rụm.',
          'dist': '2.0 km',
          'emoji': '🥗',
          'stamped': false,
          'stamp_time': null,
        },
        {
          'slot': '18:30 Tối',
          'dish': 'Chả Cá Lã Vọng',
          'place': 'Chả Cá Thăng Long',
          'address': '21 Đường Thành, Q. Hoàn Kiếm',
          'price': '150.000đ',
          'must_try': 'Cá lăng xào thì là hành hoa tại bàn ăn kèm mắm tôm bùi béo.',
          'dist': '3.2 km',
          'emoji': '🐟',
          'stamped': false,
          'stamp_time': null,
        },
      ]
    },
    {
      'id': 'TRAIL-SG',
      'city': 'TP. Hồ Chí Minh',
      'title': 'Sài Gòn Chợ Lớn — Hồn Ẩm Thực Hoa - Việt',
      'badge_name': 'Bậc Thầy Ẩm Thực Sài Gòn',
      'badge_emoji': '👑',
      'badge_color': Color(0xFFEF4444),
      'voucher_reward': 'VOUCHER GIẢM 60.000Đ GRABFOOD',
      'total_dist': '4.5 km',
      'est_time': '1 giờ di chuyển',
      'desc': 'Chuyến food tour giao thoa văn hóa ẩm thực rực rỡ từ Quận 1 đến Chợ Lớn Quận 5.',
      'stops': [
        {
          'slot': '08:00 Sáng',
          'dish': 'Cơm Tấm Sườn Bì Chả',
          'place': 'Cơm Tấm Ba Ghiền',
          'address': '84 Đặng Văn Ngữ, Q. Phú Nhuận',
          'price': '75.000đ',
          'must_try': 'Miếng sườn khổng lồ che kín đĩa cơm tấm mỡ hành.',
          'dist': '1.0 km',
          'emoji': '🍚',
          'stamped': true,
          'stamp_time': '08:20 Sáng',
        },
        {
          'slot': '12:00 Trưa',
          'dish': 'Sủi Cảo Tôm Tươi Thập Cẩm',
          'place': 'Sủi Cảo Thiên Thiên',
          'address': '197 Hà Tôn Quyền, Quận 11',
          'price': '60.000đ',
          'must_try': 'Viên sủi cảo nhân nguyên con tôm tươi giòn ngọt chấm nước tương giấm đỏ.',
          'dist': '2.8 km',
          'emoji': '🥟',
          'stamped': false,
          'stamp_time': null,
        },
        {
          'slot': '16:00 Xế',
          'dish': 'Bánh Mì Huỳnh Hoa',
          'place': 'Bánh Mì Huỳnh Hoa',
          'address': '26 Lê Thị Riêng, Quận 1',
          'price': '65.000đ',
          'must_try': 'Ổ bánh mì nặng nửa ký ngập tràn pate béo ngậy và 6 loại giăm bông chả lụa.',
          'dist': '3.7 km',
          'emoji': '🥖',
          'stamped': false,
          'stamp_time': null,
        },
        {
          'slot': '20:00 Tối',
          'dish': 'Chè Thảo Mộc Hà Ký',
          'place': 'Quán Chè Hà Ký Chợ Lớn',
          'address': '138 Châu Văn Liêm, Quận 5',
          'price': '35.000đ',
          'must_try': 'Chè mè đen nóng và quy linh cao thanh nhiệt giải độc.',
          'dist': '4.5 km',
          'emoji': '🍧',
          'stamped': false,
          'stamp_time': null,
        },
      ]
    },
    {
      'id': 'TRAIL-HUE',
      'city': 'Thừa Thiên Huế',
      'title': 'Cố Đô Huế — Hương Vị Cung Đình & Thảo Dược',
      'badge_name': 'Tinh Hoa Ẩm Thực Cung Đình',
      'badge_emoji': '🏺',
      'badge_color': Color(0xFF10B981),
      'voucher_reward': 'VOUCHER GIẢM 40.000Đ TẠI QUÁN',
      'total_dist': '2.9 km',
      'est_time': '35 phút đi bộ',
      'desc': 'Trải nghiệm nét cung đình tinh tế hòa cùng hương vị cay nồng xứ Cố Đô.',
      'stops': [
        {
          'slot': '07:00 Sáng',
          'dish': 'Bún Bò Huế Mụ Rơi',
          'place': 'Bún Bò Mụ Rơi',
          'address': '40 Nguyễn Chí Diểu, TP. Huế',
          'price': '45.000đ',
          'must_try': 'Nước dùng sả ruốc Huế đậm đà ăn kèm chả cua quết mịn màng.',
          'dist': '0.5 km',
          'emoji': '🍲',
          'stamped': true,
          'stamp_time': '07:15 Sáng',
        },
        {
          'slot': '11:30 Trưa',
          'dish': 'Mâm Bánh Bèo - Nậm - Lọc',
          'place': 'Bánh Bà Đỏ Xứ Huế',
          'address': '8 Nguyễn Bỉnh Khiêm, TP. Huế',
          'price': '50.000đ',
          'must_try': 'Tôm cháy vàng ươm trên chén bánh bèo mềm mướt chan nước mắm ruốc ngọt cay.',
          'dist': '1.6 km',
          'emoji': '🥣',
          'stamped': false,
          'stamp_time': null,
        },
        {
          'slot': '15:00 Xế',
          'dish': 'Cơm Hến Cồn Hến',
          'place': 'Quán Hoa Đông Cồn Hến',
          'address': '64 Kiệt 7 Ưng Bình, Vỹ Dạ, TP. Huế',
          'price': '25.000đ',
          'must_try': 'Thịt hến xào đậm đà, tóp mỡ giòn rụm và tô nước hến nóng bốc khói.',
          'dist': '2.3 km',
          'emoji': '🐚',
          'stamped': false,
          'stamp_time': null,
        },
        {
          'slot': '19:30 Tối',
          'dish': 'Chè Hẻm 20 Món Cố Đô',
          'place': 'Chè Hẻm Hùng Vương',
          'address': 'Kiệt 29 Hùng Vương, TP. Huế',
          'price': '18.000đ',
          'must_try': 'Chè bột lọc bọc heo quay mặn ngọt lạ miệng trứ danh xứ Huế.',
          'dist': '2.9 km',
          'emoji': '🍮',
          'stamped': false,
          'stamp_time': null,
        },
      ]
    }
  ];

  @override
  void initState() {
    super.initState();
    _laserCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _syncTrailsFromServer();
  }

  Future<void> _syncTrailsFromServer() async {
    await ApiService.fetchFoodTrails();
  }

  @override
  void dispose() {
    _laserCtrl.dispose();
    super.dispose();
  }

  Map<String, dynamic> get _curTrail => _trails[_selectedTrailIndex];
  List<Map<String, dynamic>> get _curStops => _curTrail['stops'] as List<Map<String, dynamic>>;
  int get _stampedCount => _curStops.where((s) => s['stamped'] == true).length;

  void _checkinStop(int index) {
    if (_curStops[index]['stamped']) return;
    setState(() {
      _curStops[index]['stamped'] = true;
      _curStops[index]['stamp_time'] = 'Vừa đóng dấu';
    });
    ApiService.stampFoodPassport(
      (_curTrail['id'] as String?) ?? 'TRAIL-HN',
      'STOP-${index + 1}',
    );

    final bool allDone = _stampedCount == _curStops.length;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('🎉 Quét QR thành công! Đã đóng dấu trạm: ${_curStops[index]['dish']}'),
        backgroundColor: const Color(0xFF22C55E),
      ),
    );

    if (allDone) {
      _showBadgeUnlockModal(context, _curTrail);
    }
  }

  void _showScanModal(BuildContext context, int stopIdx) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Container(
        height: 480,
        decoration: const BoxDecoration(
          color: Color(0xFF18181B),
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.qr_code_scanner_rounded, color: AppTheme.goldenAmber, size: 22),
                const SizedBox(width: 8),
                Text('Quét Mã QR Trạm Food Trail', style: AppTheme.titleMedium.copyWith(color: Colors.white)),
              ],
            ),
            const SizedBox(height: 6),
            Text('Đang hướng camera về mã QR tại ${_curStops[stopIdx]['place']}',
                style: const TextStyle(color: AppTheme.slateMuted, fontSize: 12), textAlign: TextAlign.center),
            const SizedBox(height: 20),

            // Camera Viewfinder Simulation
            Expanded(
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 240,
                    height: 240,
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppTheme.goldenAmber, width: 2),
                    ),
                    child: const Center(
                      child: Icon(Icons.qr_code_2_rounded, color: Colors.white24, size: 120),
                    ),
                  ),

                  // Animated Scanning Laser Bar
                  AnimatedBuilder(
                    animation: _laserCtrl,
                    builder: (context, child) {
                      return Positioned(
                        top: 20 + _laserCtrl.value * 200,
                        child: Container(
                          width: 220,
                          height: 3,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Colors.transparent, Colors.redAccent, Colors.transparent],
                            ),
                            boxShadow: [
                              BoxShadow(color: Colors.redAccent.withOpacity(0.8), blurRadius: 6),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.goldenAmber,
                foregroundColor: Colors.black,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: () {
                Navigator.pop(context);
                _checkinStop(stopIdx);
              },
              child: const Text('Mô phỏng Đóng Dấu Thành Công', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  void _showBadgeUnlockModal(BuildContext context, Map<String, dynamic> trail) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF18181B),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: trail['badge_color'] as Color, width: 2),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(trail['badge_emoji'], style: const TextStyle(fontSize: 64)),
            const SizedBox(height: 12),
            const Text('CHÚC MỪNG HOÀN THÀNH TUYẾN!',
                style: TextStyle(color: Colors.amberAccent, fontSize: 13, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Text(trail['badge_name'],
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Text(
              'Bạn đã check-in xuất sắc cả 4 trạm ẩm thực tại ${trail['city']}. Huy hiệu số đã được ghi nhận vào Hộ Chiếu Ẩm Thực của bạn!',
              style: const TextStyle(color: Colors.white70, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: (trail['badge_color'] as Color).withOpacity(0.2),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: trail['badge_color'] as Color),
              ),
              child: Text(
                trail['voucher_reward'],
                style: TextStyle(color: trail['badge_color'] as Color, fontWeight: FontWeight.bold, fontSize: 11),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng', style: TextStyle(color: Colors.white70)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.goldenAmber,
              foregroundColor: Colors.black,
            ),
            onPressed: () {
              Navigator.pop(context);
            },
            child: const Text('Nhận Voucher Ngay'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final progress = _stampedCount / _curStops.length;

    return Scaffold(
      backgroundColor: AppTheme.bgPage,
      appBar: AppBar(
        backgroundColor: AppTheme.bgPage,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Food Trail & Hộ Chiếu Ẩm Thực', style: AppTheme.titleLarge),
        actions: [
          IconButton(
            icon: Icon(Icons.map_rounded, color: AppTheme.goldenAmber),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const MapPlacesScreen()),
              );
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildCitySelectorChips(),
          const SizedBox(height: 16),
          _buildPassportCard(progress),
          const SizedBox(height: 20),
          _buildTrailOverviewHeader(),
          const SizedBox(height: 16),
          ..._curStops.asMap().entries.map((e) => _buildStopTimelineItem(e.key, e.value)),
          const SizedBox(height: 24),
          _buildBadgeShowcaseShelf(),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildCitySelectorChips() => SizedBox(
        height: 40,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: _trails.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (context, idx) {
            final trail = _trails[idx];
            final active = idx == _selectedTrailIndex;
            return GestureDetector(
              onTap: () => setState(() => _selectedTrailIndex = idx),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: active ? AppTheme.goldenAmber : AppTheme.surfaceElevated,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: active ? AppTheme.goldenAmber : Colors.white12),
                ),
                child: Row(
                  children: [
                    Text(trail['badge_emoji'], style: const TextStyle(fontSize: 14)),
                    const SizedBox(width: 6),
                    Text(
                      trail['city'],
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: active ? FontWeight.bold : FontWeight.w500,
                        color: active ? Colors.black : Colors.white70,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      );

  Widget _buildPassportCard(double progress) {
    final trail = _curTrail;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.charcoalHero,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: (trail['badge_color'] as Color).withOpacity(0.5)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.4), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: (trail['badge_color'] as Color).withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.verified_user_rounded, color: AppTheme.goldenAmber, size: 14),
                    const SizedBox(width: 4),
                    Text('HỘ CHIẾU SỐ: ${_curTrail['city'].toString().toUpperCase()}',
                        style: const TextStyle(
                            color: AppTheme.goldenAmber, fontSize: 10, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              const Spacer(),
              Text('$_stampedCount / ${_curStops.length} Trạm',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 12),
          Text(trail['title'], style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Text(trail['desc'], style: const TextStyle(color: AppTheme.slateMuted, fontSize: 11, height: 1.4)),
          const SizedBox(height: 14),

          // Progress Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: Colors.white12,
              valueColor: AlwaysStoppedAnimation<Color>(trail['badge_color'] as Color),
              minHeight: 8,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTrailOverviewHeader() {
    final trail = _curTrail;
    return Row(
      children: [
        _buildStatBadge(Icons.route_rounded, 'Tổng cự ly', trail['total_dist']),
        const SizedBox(width: 10),
        _buildStatBadge(Icons.timer_rounded, 'Ước tính', trail['est_time']),
        const SizedBox(width: 10),
        _buildStatBadge(Icons.emoji_events_rounded, 'Huy hiệu', trail['badge_emoji']),
      ],
    );
  }

  Widget _buildStatBadge(IconData icon, String label, String val) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white10),
          ),
          child: Column(
            children: [
              Icon(icon, size: 18, color: AppTheme.goldenAmber),
              const SizedBox(height: 4),
              Text(label, style: const TextStyle(fontSize: 10, color: AppTheme.slateMuted)),
              const SizedBox(height: 2),
              Text(val,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      );

  Widget _buildStopTimelineItem(int idx, Map<String, dynamic> stop) {
    final bool isStamped = stop['stamped'] == true;
    final bool isLast = idx == _curStops.length - 1;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Timeline Dot & Line
        Column(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isStamped ? AppTheme.emeraldBadge : const Color(0xFF27272A),
                border: Border.all(
                  color: isStamped ? Colors.white : AppTheme.goldenAmber.withOpacity(0.5),
                  width: 2,
                ),
              ),
              child: Center(
                child: isStamped
                    ? const Icon(Icons.check_rounded, color: Colors.black, size: 18)
                    : Text('${idx + 1}',
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 90,
                color: isStamped ? AppTheme.emeraldBadge.withOpacity(0.5) : Colors.white12,
              ),
          ],
        ),
        const SizedBox(width: 14),

        // Stop Card
        Expanded(
          child: Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.surfaceElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isStamped ? AppTheme.emeraldBadge.withOpacity(0.35) : Colors.white10,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(stop['emoji'], style: const TextStyle(fontSize: 20)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(stop['dish'],
                              style: const TextStyle(
                                  color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                          Text(stop['place'],
                              style: TextStyle(
                                  color: AppTheme.goldenAmber.withOpacity(0.9), fontSize: 11)),
                        ],
                      ),
                    ),
                    Text(stop['price'],
                        style: const TextStyle(
                            color: AppTheme.emeraldBadge, fontWeight: FontWeight.bold, fontSize: 12)),
                  ],
                ),
                const SizedBox(height: 8),
                Text('📍 ${stop['address']}', style: const TextStyle(color: AppTheme.slateMuted, fontSize: 10)),
                const SizedBox(height: 4),
                Text('⭐ Món gợi ý: ${stop['must_try']}',
                    style: const TextStyle(color: Colors.white70, fontSize: 11, fontStyle: FontStyle.italic)),
                const SizedBox(height: 12),

                // Check-in or Stamped Status Button
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(stop['slot'],
                          style: const TextStyle(color: AppTheme.slateMuted, fontSize: 10)),
                    ),
                    const Spacer(),
                    if (isStamped)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.emeraldBadge.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.verified_rounded, color: AppTheme.emeraldBadge, size: 14),
                            const SizedBox(width: 4),
                            Text('Đã đóng dấu (${stop['stamp_time']})',
                                style: const TextStyle(
                                    color: AppTheme.emeraldBadge, fontSize: 10, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      )
                    else
                      ElevatedButton.icon(
                        icon: const Icon(Icons.qr_code_scanner_rounded, size: 14),
                        label: const Text('Quét QR Check-in', style: TextStyle(fontSize: 11)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.goldenAmber,
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () => _showScanModal(context, idx),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBadgeShowcaseShelf() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B).withOpacity(0.5),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.workspace_premium_rounded, color: AppTheme.goldenAmber, size: 20),
                SizedBox(width: 8),
                Text('Kệ Huy Hiệu Hộ Chiếu Ẩm Thực Của Bạn',
                    style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: _trails.map((t) {
                return Column(
                  children: [
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: (t['badge_color'] as Color).withOpacity(0.2),
                        border: Border.all(color: t['badge_color'] as Color, width: 2),
                      ),
                      child: Center(child: Text(t['badge_emoji'], style: const TextStyle(fontSize: 26))),
                    ),
                    const SizedBox(height: 6),
                    Text(t['city'],
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                    Text(t['badge_name'].toString().split(' ')[0] + ' ' + t['badge_name'].toString().split(' ')[1],
                        style: const TextStyle(color: AppTheme.slateMuted, fontSize: 9)),
                  ],
                );
              }).toList(),
            ),
          ],
        ),
      );
}
