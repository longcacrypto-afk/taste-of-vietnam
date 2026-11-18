// M13 · Booking Screen — Instant Confirm + QR Voucher
// Hôm nay ăn gì · Taste of Vietnam v0.1

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
  int _guests = 2;
  String _note = '';

  // Booking state
  bool _submitted = false;
  bool _loading = false;
  String _bookingCode = '';

  late AnimationController _successAnim;
  late Animation<double> _scaleAnim;

  final _times = ['11:00', '11:30', '12:00', '12:30', '13:00', '18:00', '18:30', '19:00', '19:30', '20:00'];
  final _noteCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _successAnim = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
    _scaleAnim = CurvedAnimation(parent: _successAnim, curve: Curves.elasticOut);
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
      'place_name': widget.placeName ?? 'Quán Ngon',
      'party_size': _guests,
      'time_slot': '$_time ngày ${_date.day}/${_date.month}',
      'note': _noteCtrl.text,
      'has_baby_chair': true,
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
        title: Text('Đặt Bàn', style: AppTheme.titleLarge),
        actions: [
          if (!_submitted)
            TextButton(
              onPressed: () {},
              child: Text('Lịch sử',
                  style: TextStyle(color: AppTheme.goldenAmber, fontSize: 13)),
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
        const SizedBox(height: 20),
        _buildDatePicker(),
        const SizedBox(height: 16),
        _buildTimePicker(),
        const SizedBox(height: 16),
        _buildGuestCounter(),
        const SizedBox(height: 16),
        _buildNoteField(),
        const SizedBox(height: 20),
        _buildPolicySummary(),
        const SizedBox(height: 20),
        _buildSubmitButton(),
        const SizedBox(height: 8),
        Center(
          child: Text('Miễn phí đặt bàn · Hủy trước 2 tiếng',
              style: AppTheme.labelSmall.copyWith(fontSize: 11)),
        ),
      ],
    );
  }

  Widget _buildPlaceCard() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppTheme.bgPage,
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
                    style: AppTheme.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  const SizedBox(height: 4),
                  Text('📍 Hoàn Kiếm, Hà Nội',
                      style: AppTheme.labelSmall),
                  const SizedBox(height: 6),
                  Row(children: [
                    _infoBadge('⭐ 4.9', AppTheme.goldenAmber),
                    const SizedBox(width: 6),
                    _infoBadge('✅ Xác minh', AppTheme.emeraldBadge),
                  ]),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _buildDatePicker() => _formSection(
        '📅 Chọn ngày',
        Row(
          children: List.generate(5, (i) {
            final d = DateTime.now().add(Duration(days: i));
            final isSelected = _date.day == d.day &&
                _date.month == d.month;
            return Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _date = d),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppTheme.goldenAmber
                        : AppTheme.surfaceElevated,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    children: [
                      Text(
                        _weekday(d.weekday),
                        style: TextStyle(
                          color: isSelected ? Colors.black : AppTheme.textSecondary,
                          fontSize: 10,
                        ),
                      ),
                      const SizedBox(height: 2),
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
        '🕐 Chọn giờ',
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
                ),
                child: Text(
                  t,
                  style: TextStyle(
                    color: isSelected ? Colors.black : Colors.white,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    fontSize: 13,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      );

  Widget _buildGuestCounter() => _formSection(
        '👥 Số khách',
        Row(
          children: [
            _scalerBtn(
              icon: Icons.remove,
              onTap: () { if (_guests > 1) setState(() => _guests--); },
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
                  Text('$_guests',
                      style: AppTheme.titleLarge.copyWith(fontSize: 28)),
                  Text('người', style: AppTheme.labelSmall),
                ],
              ),
            ),
            _scalerBtn(
              icon: Icons.add,
              onTap: () { if (_guests < 20) setState(() => _guests++); },
            ),
            const Spacer(),
            Text('Tối đa 20 người',
                style: AppTheme.labelSmall.copyWith(fontSize: 11)),
          ],
        ),
      );

  Widget _buildNoteField() => _formSection(
        '📝 Yêu cầu đặc biệt (tùy chọn)',
        TextField(
          controller: _noteCtrl,
          onChanged: (v) => _note = v,
          maxLines: 2,
          decoration: InputDecoration(
            hintText: 'VD: Bàn ven cửa sổ, ghế cao cho trẻ em...',
            hintStyle: AppTheme.labelSmall,
            filled: true,
            fillColor: AppTheme.bgPage,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.all(12),
          ),
          style: AppTheme.bodyMedium.copyWith(fontSize: 13),
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
            Text('📋 Tóm tắt đặt bàn',
                style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            _summaryRow('📅 Ngày', '${_date.day}/${_date.month}/${_date.year}'),
            _summaryRow('🕐 Giờ', _time),
            _summaryRow('👥 Khách', '$_guests người'),
            _summaryRow('💰 Phí đặt chỗ', 'Miễn phí'),
            if (_note.isNotEmpty) _summaryRow('📝 Ghi chú', _note),
          ],
        ),
      );

  Widget _summaryRow(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          children: [
            Text(label, style: AppTheme.labelSmall.copyWith(fontSize: 12)),
            const Spacer(),
            Text(value,
                style: AppTheme.bodyMedium.copyWith(
                    fontWeight: FontWeight.w500, fontSize: 12)),
          ],
        ),
      );

  Widget _buildSubmitButton() => ElevatedButton(
        onPressed: _loading ? null : _submitBooking,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppTheme.goldenAmber,
          foregroundColor: Colors.black,
          minimumSize: const Size.fromHeight(52),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: _loading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                    color: Colors.black, strokeWidth: 2),
              )
            : const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('🎉', style: TextStyle(fontSize: 18)),
                  SizedBox(width: 8),
                  Text('Xác Nhận Đặt Bàn',
                      style: TextStyle(
                          fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
      );

  // ─── Success / QR View ────────────────────────────────────────────
  Widget _buildSuccessView() {
    return ScaleTransition(
      scale: _scaleAnim,
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 20),
          _buildSuccessBanner(),
          const SizedBox(height: 24),
          _buildQrCard(),
          const SizedBox(height: 24),
          _buildBookingDetails(),
          const SizedBox(height: 24),
          _buildActionButtons(),
        ],
      ),
    );
  }

  Widget _buildSuccessBanner() => Column(
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppTheme.emeraldBadge.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Text('🎉', style: TextStyle(fontSize: 40)),
            ),
          ),
          const SizedBox(height: 16),
          Text('Đặt Bàn Thành Công!',
              style: AppTheme.titleLarge.copyWith(
                  color: AppTheme.emeraldBadge, fontSize: 22)),
          const SizedBox(height: 8),
          Text(
            'Nhà hàng sẽ liên hệ xác nhận trong vòng 15 phút.',
            style: AppTheme.bodyMedium.copyWith(
                fontSize: 13,
                color: AppTheme.textSecondary,
                height: 1.4),
            textAlign: TextAlign.center,
          ),
        ],
      );

  Widget _buildQrCard() => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            // QR Code (simulated with grid pattern)
            Container(
              width: 180,
              height: 180,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: CustomPaint(
                painter: _QrPainter(),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Mã Voucher: $_bookingCode',
              style: AppTheme.titleMedium.copyWith(
                  color: AppTheme.goldenAmber,
                  fontSize: 16,
                  letterSpacing: 1.5),
            ),
            const SizedBox(height: 6),
            Text('Xuất trình tại quầy để xác nhận chỗ ngồi',
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
            const Divider(color: Color(0xFF2A2A2E), height: 16),
            _detailRow('📅', '${_date.day}/${_date.month}/${_date.year} · $_time'),
            _detailRow('👥', '$_guests khách'),
            if (_note.isNotEmpty) _detailRow('📝', _note),
            const Divider(color: Color(0xFF2A2A2E), height: 16),
            _detailRow('⏰', 'Hủy miễn phí trước 2 tiếng'),
          ],
        ),
      );

  Widget _detailRow(String emoji, String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 18)),
            const SizedBox(width: 10),
            Expanded(
                child: Text(text,
                    style: AppTheme.bodyMedium.copyWith(fontSize: 13))),
          ],
        ),
      );

  Widget _buildActionButtons() => Column(
        children: [
          ElevatedButton.icon(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('📤 Đã sao chép mã đặt bàn!')),
            ),
            icon: const Icon(Icons.share_rounded, size: 18),
            label: const Text('Chia sẻ xác nhận'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.goldenAmber,
              foregroundColor: Colors.black,
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
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
            icon: Icon(Icons.calendar_today_rounded,
                size: 16, color: AppTheme.textSecondary),
            label: Text('Đặt bàn khác',
                style: TextStyle(color: AppTheme.textSecondary)),
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: AppTheme.surfaceElevated),
              minimumSize: const Size.fromHeight(44),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ],
      );

  // ─── Helpers ──────────────────────────────────────────────────────
  Widget _formSection(String title, Widget content) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppTheme.titleMedium.copyWith(fontSize: 14)),
          const SizedBox(height: 10),
          content,
        ],
      );

  Widget _scalerBtn({required IconData icon, required VoidCallback onTap}) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppTheme.goldenAmber,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: Colors.black, size: 22),
        ),
      );

  Widget _infoBadge(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withOpacity(0.15),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(text,
            style: TextStyle(
                color: color, fontSize: 10, fontWeight: FontWeight.w600)),
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

    // Simulated QR pattern
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
            Rect.fromLTWH(
                c * cellSize, r * cellSize, cellSize - 1, cellSize - 1),
            paint,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
