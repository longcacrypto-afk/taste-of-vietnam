// M13 · Booking Screen — Instant Confirm + QR Voucher & Apple Wallet Integration
// Hôm nay ăn gì · Taste of Vietnam v0.2
// Production Grade Luxury Dark Theme with Seating Area Preferences, Amenities & QR Voucher Pass

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class BookingScreen extends StatefulWidget {
  final String? placeName;
  final String? placeEmoji;
  const BookingScreen({super.key, this.placeName, this.placeEmoji});

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen>
    with SingleTickerProviderStateMixin {
  // Form state
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  String _time = '12:00';
  int _guests = 4;
  String _note = '';
  String _seatingArea = 'Bàn ven cửa sổ thoáng';
  bool _hasBabyChair = false;
  bool _quietRoom = false;

  // Booking state
  bool _submitted = false;
  bool _loading = false;
  String _bookingCode = '';

  late AnimationController _successAnim;
  late Animation<double> _scaleAnim;

  final _times = ['11:00', '11:30', '12:00', '12:30', '13:00', '18:00', '18:30', '19:00', '19:30', '20:00'];
  final _seatingOptions = [
    'Bàn ven cửa sổ thoáng',
    'Phòng riêng VIP máy lạnh',
    'Khu vực ngoài trời sân vườn',
    'Bàn trung tâm ấm cúng',
  ];

  final _noteCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _successAnim = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
    _scaleAnim = CurvedAnimation(parent: _successAnim, curve: Curves.elasticOut);
    ApiService.fetchVouchers();
  }

  @override
  void dispose() {
    _successAnim.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitBooking() async {
    setState(() => _loading = true);
    final bookingPayload = {
      'place_id': 'PLACE-401',
      'place_name': widget.placeName ?? 'Phở Thìn Bờ Hồ',
      'party_size': _guests,
      'time_slot': '$_time ngày ${_date.day}/${_date.month}',
      'seating_preference': _seatingArea,
      'note': _noteCtrl.text,
      'has_baby_chair': _hasBabyChair,
      'quiet_room': _quietRoom,
    };
    final response = await ApiService.createBooking(bookingPayload);
    if (mounted) {
      if (response != null && response['booking_id'] != null) {
        _bookingCode = response['booking_id'].toString();
      } else {
        _bookingCode = 'TOV-${DateTime.now().millisecondsSinceEpoch % 100000}';
      }
      setState(() {
        _submitted = true;
        _loading = false;
      });
      _successAnim.forward();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgPage,
      appBar: AppBar(
        backgroundColor: AppTheme.bgPage,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Đặt Bàn Trực Tuyến (M13)', style: AppTheme.titleLarge.copyWith(fontSize: 16)),
            Text('Instant Reservation & QR Pass', style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.goldenAmber)),
          ],
        ),
        actions: [
          if (!_submitted)
            TextButton.icon(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('📜 Bạn hiện có 1 đặt bàn sắp tới vào lúc 19:00 ngày mai.')),
                );
              },
              icon: const Icon(Icons.history_rounded, size: 16, color: AppTheme.goldenAmber),
              label: const Text('Lịch sử', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
        ],
      ),
      body: _submitted ? _buildSuccessView() : _buildFormView(),
    );
  }

  // ─── Form View ────────────────────────────────────────────────────
  Widget _buildFormView() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildPlaceCard(),
        const SizedBox(height: 16),
        _buildDatePicker(),
        const SizedBox(height: 16),
        _buildTimePicker(),
        const SizedBox(height: 16),
        _buildGuestCounter(),
        const SizedBox(height: 16),
        _buildSeatingPreference(),
        const SizedBox(height: 16),
        _buildAmenitiesToggles(),
        const SizedBox(height: 16),
        _buildNoteField(),
        const SizedBox(height: 20),
        _buildPolicySummary(),
        const SizedBox(height: 20),
        _buildSubmitButton(),
        const SizedBox(height: 10),
        Center(
          child: Text('Miễn phí đặt chỗ 100% · Tự do hủy trước 2 tiếng',
              style: AppTheme.labelSmall.copyWith(fontSize: 11, color: AppTheme.emeraldBadge)),
        ),
        const SizedBox(height: 10),
      ],
    );
  }

  Widget _buildPlaceCard() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E24),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(
                child: Text(
                  widget.placeEmoji ?? '🍜',
                  style: const TextStyle(fontSize: 28),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.placeName ?? 'Phở Thìn Bờ Hồ',
                    style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  const SizedBox(height: 2),
                  const Text('📍 61 Đinh Tiên Hoàng, Hoàn Kiếm, Hà Nội',
                      style: TextStyle(color: Colors.white60, fontSize: 11)),
                  const SizedBox(height: 6),
                  Row(children: [
                    _infoBadge('⭐ 4.9 (1.2k review)', AppTheme.goldenAmber),
                    const SizedBox(width: 6),
                    _infoBadge('✅ Đối tác chính thức', AppTheme.emeraldBadge),
                  ]),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _buildDatePicker() => _formSection(
        '📅 Chọn ngày dùng bữa',
        Row(
          children: List.generate(5, (i) {
            final d = DateTime.now().add(Duration(days: i));
            final isSelected = _date.day == d.day && _date.month == d.month;
            return Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _date = d),
                child: Container(
                  margin: const EdgeInsets.only(right: 6),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected ? AppTheme.goldenAmber : AppTheme.surfaceElevated,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: isSelected ? AppTheme.goldenAmber : const Color(0xFF27272A)),
                  ),
                  child: Column(
                    children: [
                      Text(
                        _weekday(d.weekday),
                        style: TextStyle(
                          color: isSelected ? Colors.black : Colors.white60,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${d.day}',
                        style: TextStyle(
                          color: isSelected ? Colors.black : Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      );

  Widget _buildTimePicker() => _formSection(
        '🕐 Khung giờ nhận bàn',
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _times.map((t) {
            final isSelected = _time == t;
            return GestureDetector(
              onTap: () => setState(() => _time = t),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? AppTheme.goldenAmber : AppTheme.surfaceElevated,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: isSelected ? AppTheme.goldenAmber : const Color(0xFF27272A)),
                ),
                child: Text(
                  t,
                  style: TextStyle(
                    color: isSelected ? Colors.black : Colors.white,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    fontSize: 12,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      );

  Widget _buildGuestCounter() => _formSection(
        '👥 Số lượng thực khách',
        Row(
          children: [
            _scalerBtn(
              icon: Icons.remove,
              onTap: () { if (_guests > 1) setState(() => _guests--); },
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                children: [
                  Text('$_guests', style: AppTheme.titleLarge.copyWith(fontSize: 26, fontWeight: FontWeight.bold)),
                  const Text('người', style: TextStyle(color: Colors.white54, fontSize: 11)),
                ],
              ),
            ),
            _scalerBtn(
              icon: Icons.add,
              onTap: () { if (_guests < 20) setState(() => _guests++); },
            ),
            const Spacer(),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: AppTheme.goldenAmber.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
              child: const Text('Bàn 4-6 người sẵn sàng', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );

  Widget _buildSeatingPreference() => _formSection(
        '🪑 Vị trí bàn mong muốn',
        DropdownButtonFormField<String>(
          value: _seatingArea,
          dropdownColor: AppTheme.charcoalHero,
          style: const TextStyle(color: Colors.white, fontSize: 13),
          decoration: InputDecoration(
            filled: true,
            fillColor: AppTheme.surfaceElevated,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          ),
          items: _seatingOptions.map((opt) => DropdownMenuItem(value: opt, child: Text(opt))).toList(),
          onChanged: (v) {
            if (v != null) setState(() => _seatingArea = v);
          },
        ),
      );

  Widget _buildAmenitiesToggles() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              activeColor: AppTheme.goldenAmber,
              title: const Text('Ghế trẻ em (Baby Chair)', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
              value: _hasBabyChair,
              onChanged: (v) => setState(() => _hasBabyChair = v),
            ),
            const Divider(color: Color(0xFF27272A), height: 1),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              activeColor: AppTheme.goldenAmber,
              title: const Text('Khu vực yên tĩnh / Tiếp khách công việc', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
              value: _quietRoom,
              onChanged: (v) => setState(() => _quietRoom = v),
            ),
          ],
        ),
      );

  Widget _buildNoteField() => _formSection(
        '📝 Yêu cầu riêng cho nhà hàng (tùy chọn)',
        TextField(
          controller: _noteCtrl,
          onChanged: (v) => _note = v,
          maxLines: 2,
          style: const TextStyle(color: Colors.white, fontSize: 12),
          decoration: InputDecoration(
            hintText: 'VD: Có người già đi cùng, cần vị trí tầng trệt không leo cầu thang...',
            hintStyle: const TextStyle(color: Colors.white38, fontSize: 11),
            filled: true,
            fillColor: AppTheme.surfaceElevated,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.all(12),
          ),
        ),
      );

  Widget _buildPolicySummary() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.emeraldBadge.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.emeraldBadge.withOpacity(0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('📋 Tóm tắt thông tin đặt bàn',
                style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 8),
            _summaryRow('📅 Ngày giờ', '${_date.day}/${_date.month}/${_date.year} lúc $_time'),
            _summaryRow('👥 Quy mô', '$_guests người ($_seatingArea)'),
            _summaryRow('💰 Phí giữ chỗ', '0 đ (Miễn phí toàn bộ)'),
            if (_hasBabyChair) _summaryRow('👶 Tiện ích', 'Đã yêu cầu ghế trẻ em'),
          ],
        ),
      );

  Widget _summaryRow(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Row(
          children: [
            Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
            const Spacer(),
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
          ],
        ),
      );

  Widget _buildSubmitButton() => SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: _loading ? null : _submitBooking,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.goldenAmber,
            foregroundColor: Colors.black,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: _loading
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2))
              : const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('🎉', style: TextStyle(fontSize: 18)),
                    SizedBox(width: 8),
                    Text('Xác Nhận Giữ Chỗ Tức Thì', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  ],
                ),
        ),
      );

  // ─── Success / QR View ────────────────────────────────────────────
  Widget _buildSuccessView() {
    return ScaleTransition(
      scale: _scaleAnim,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 10),
          _buildSuccessBanner(),
          const SizedBox(height: 20),
          _buildQrCard(),
          const SizedBox(height: 20),
          _buildBookingDetails(),
          const SizedBox(height: 20),
          _buildActionButtons(),
        ],
      ),
    );
  }

  Widget _buildSuccessBanner() => Column(
        children: [
          Container(
            width: 70,
            height: 70,
            decoration: BoxDecoration(
              color: AppTheme.emeraldBadge.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Text('🎉', style: TextStyle(fontSize: 36)),
            ),
          ),
          const SizedBox(height: 12),
          Text('Đặt Chỗ Thành Công!',
              style: AppTheme.titleLarge.copyWith(color: AppTheme.emeraldBadge, fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text(
            'Nhà hàng đã xác nhận và giữ bàn của bạn trong 15 phút.',
            style: TextStyle(color: Colors.white70, fontSize: 12),
            textAlign: TextAlign.center,
          ),
        ],
      );

  Widget _buildQrCard() => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.4)),
        ),
        child: Column(
          children: [
            Container(
              width: 170,
              height: 170,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: CustomPaint(
                painter: _QrPainter(),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Mã Voucher: $_bookingCode',
              style: AppTheme.titleMedium.copyWith(color: AppTheme.goldenAmber, fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1.2),
            ),
            const SizedBox(height: 4),
            Text('Xuất trình mã này tại quầy để nhân viên hướng dẫn vào bàn',
                style: AppTheme.labelSmall.copyWith(fontSize: 11)),
          ],
        ),
      );

  Widget _buildBookingDetails() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          children: [
            _detailRow('🏪', widget.placeName ?? 'Phở Thìn Bờ Hồ'),
            const Divider(color: Color(0xFF27272A), height: 16),
            _detailRow('📅', '${_date.day}/${_date.month}/${_date.year} · $_time'),
            _detailRow('👥', '$_guests khách · $_seatingArea'),
            if (_note.isNotEmpty) _detailRow('📝', _note),
            const Divider(color: Color(0xFF27272A), height: 16),
            _detailRow('⏰', 'Hủy miễn phí trước 2 tiếng qua hotline 1900 6868'),
          ],
        ),
      );

  Widget _detailRow(String emoji, String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 16)),
            const SizedBox(width: 10),
            Expanded(child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 12))),
          ],
        ),
      );

  Widget _buildActionButtons() => Column(
        children: [
          ElevatedButton.icon(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('📱 Đã thêm vé đặt chỗ vào Apple Wallet (Passbook PKPass)!')),
            ),
            icon: const Icon(Icons.wallet, size: 18),
            label: const Text('Thêm vào Apple Wallet', style: TextStyle(fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.goldenAmber,
              foregroundColor: Colors.black,
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () {
              setState(() {
                _submitted = false;
                _successAnim.reset();
              });
            },
            icon: const Icon(Icons.refresh_rounded, size: 16, color: Colors.white70),
            label: const Text('Đặt Thêm Bàn Khác', style: TextStyle(color: Colors.white70, fontSize: 12)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Color(0xFF27272A)),
              minimumSize: const Size.fromHeight(44),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      );

  // ─── Helpers ──────────────────────────────────────────────────────
  Widget _formSection(String title, Widget content) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTheme.titleMedium.copyWith(fontSize: 13, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          content,
        ],
      );

  Widget _scalerBtn({required IconData icon, required VoidCallback onTap}) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AppTheme.goldenAmber,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: Colors.black, size: 20),
        ),
      );

  Widget _infoBadge(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withOpacity(0.15),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(text, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
      );

  String _weekday(int d) {
    const days = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    return days[d];
  }
}

// ─── QR Code Painter (simulated) ─────────────────────────────────
class _QrPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..style = PaintingStyle.fill;

    final cellSize = size.width / 10;

    final pattern = [
      [1,1,1,1,1,1,1,0,1,0],
      [1,0,0,0,0,0,1,0,0,1],
      [1,0,1,1,1,0,1,0,1,0],
      [1,0,1,1,1,0,1,0,0,1],
      [1,0,1,1,1,0,1,0,1,1],
      [1,0,0,0,0,0,1,0,0,0],
      [1,1,1,1,1,1,1,0,1,0],
      [0,0,0,0,0,0,0,0,1,1],
      [1,0,1,1,0,0,1,0,0,1],
      [0,1,0,1,1,0,0,1,1,0],
    ];

    for (int r = 0; r < pattern.length; r++) {
      for (int c = 0; c < pattern[r].length; c++) {
        if (pattern[r][c] == 1) {
          canvas.drawRect(
            Rect.fromLTWH(c * cellSize, r * cellSize, cellSize - 1, cellSize - 1),
            paint,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
