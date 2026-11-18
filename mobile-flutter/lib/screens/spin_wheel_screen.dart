// =============================================================================
// M3-S03 LUCKY FOOD SPIN WHEEL SCREEN (VÒNG QUAY ẨM THỰC CAO CẤP)
// Thiết kế 3D Metallic Bezel + Physics Deceleration + Hard Allergy Guard
// =============================================================================

import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class SpinWheelScreen extends StatefulWidget {
  const SpinWheelScreen({super.key});

  @override
  State<SpinWheelScreen> createState() => _SpinWheelScreenState();
}

class _SpinWheelScreenState extends State<SpinWheelScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _spinCtrl;
  late Animation<double> _spinAnim;

  double _currentAngle = 0.0;
  bool _isSpinning = false;
  Map<String, dynamic>? _selectedDish;

  // 8 Món ăn tiêu biểu đã qua bộ lọc dị ứng & cooldown 3 ngày
  final List<Map<String, dynamic>> _wheelItems = [
    {'name': 'Phở Bò Tái', 'emoji': '🍜', 'color1': Color(0xFFF59E0B), 'color2': Color(0xFFD97706), 'cal': 480, 'price': '55.000đ', 'place': 'Phở Gia Truyền Phát Tài · 400m'},
    {'name': 'Cơm Tấm Sườn', 'emoji': '🍚', 'color1': Color(0xFF10B981), 'color2': Color(0xFF059669), 'cal': 620, 'price': '50.000đ', 'place': 'Cơm Tấm Sài Gòn Xưa · 550m'},
    {'name': 'Bún Bò Huế', 'emoji': '🍲', 'color1': Color(0xFFEF4444), 'color2': Color(0xFFDC2626), 'cal': 520, 'price': '60.000đ', 'place': 'Quán O Xuân · 800m'},
    {'name': 'Gỏi Cuốn Chay', 'emoji': '🥗', 'color1': Color(0xFF06B6D4), 'color2': Color(0xFF0891B2), 'cal': 310, 'price': '40.000đ', 'place': 'Bếp Chay An Lạc · 1.2km'},
    {'name': 'Bánh Mì Thịt', 'emoji': '🥖', 'color1': Color(0xFF8B5CF6), 'color2': Color(0xFF7C3AED), 'cal': 420, 'price': '25.000đ', 'place': 'Bánh Mì Bảy Hổ · 300m'},
    {'name': 'Cá Lóc Kho', 'emoji': '🐟', 'color1': Color(0xFFF97316), 'color2': Color(0xFFEA580C), 'cal': 380, 'price': '45.000đ', 'place': 'Cơm Niêu Đồng Quê · 1.5km'},
    {'name': 'Bún Chả Hà Nội', 'emoji': '🥓', 'color1': Color(0xFFEC4899), 'color2': Color(0xFFDB2777), 'cal': 540, 'price': '50.000đ', 'place': 'Bún Chả Phố Cổ · 950m'},
    {'name': 'Cháo Sườn Sụn', 'emoji': '🥣', 'color1': Color(0xFF14B8A6), 'color2': Color(0xFF0D9488), 'cal': 350, 'price': '35.000đ', 'place': 'Cháo Sườn Cô Giang · 600m'},
  ];

  @override
  void initState() {
    super.initState();
    _spinCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4500),
    );

    _spinAnim = CurvedAnimation(
      parent: _spinCtrl,
      curve: Curves.easeOutCubic,
    );

    _spinCtrl.addListener(() {
      setState(() {
        _currentAngle = _spinAnim.value;
      });
    });

    _spinCtrl.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        setState(() {
          _isSpinning = false;
          _determineWinner();
        });
      }
    });
  }

  @override
  void dispose() {
    _spinCtrl.dispose();
    super.dispose();
  }

  void _spinWheel() {
    if (_isSpinning) return;

    setState(() {
      _isSpinning = true;
      _selectedDish = null;
    });

    // Quay ngẫu nhiên từ 5 đến 8 vòng đầy đủ + góc phụ
    final randomExtraTurns = 5 + math.Random().nextInt(4);
    final randomTargetIndex = math.Random().nextInt(_wheelItems.length);
    final segmentAngle = (2 * math.pi) / _wheelItems.length;

    // Vị trí con trỏ ở đỉnh (top = 3*pi/2 hoặc 270 độ)
    final targetAngle = (randomExtraTurns * 2 * math.pi) +
        (randomTargetIndex * segmentAngle) +
        (segmentAngle / 2);

    _spinAnim = Tween<double>(
      begin: _currentAngle % (2 * math.pi),
      end: _currentAngle + targetAngle,
    ).animate(CurvedAnimation(parent: _spinCtrl, curve: Curves.easeOutCubic));

    _spinCtrl.reset();
    _spinCtrl.forward();
  }

  void _determineWinner() {
    // Góc chuẩn hóa
    final normalizedAngle = (_currentAngle) % (2 * math.pi);
    final segmentAngle = (2 * math.pi) / _wheelItems.length;

    // Con trỏ đặt ở đỉnh 12h (270 độ = 3*pi/2)
    final pointerAngle = (3 * math.pi / 2 - normalizedAngle) % (2 * math.pi);
    final positivePointer = pointerAngle < 0 ? pointerAngle + 2 * math.pi : pointerAngle;
    final winningIndex = (positivePointer / segmentAngle).floor() % _wheelItems.length;

    _selectedDish = _wheelItems[winningIndex];

    _showWinningDialog(_selectedDish!);
  }

  void _showWinningDialog(Map<String, dynamic> dish) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: AppTheme.charcoalHero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: AppTheme.goldenAmber.withOpacity(0.15),
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.goldenAmber, width: 2),
                ),
                child: Center(
                  child: Text(dish['emoji'], style: const TextStyle(fontSize: 42)),
                ),
              ),
              const SizedBox(height: 14),
              const Text('🎉 MĂM CHỌN CHO BẠN!',
                  style: TextStyle(color: AppTheme.goldenAmber, fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
              const SizedBox(height: 6),
              Text(
                dish['name'],
                style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _chip('🔥 ${dish['cal']} kcal', AppTheme.goldenAmber),
                  const SizedBox(width: 8),
                  _chip('💰 ${dish['price']}', AppTheme.emeraldBadge),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceElevated,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.location_on_rounded, color: AppTheme.goldenAmber, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        dish['place'],
                        style: const TextStyle(fontSize: 11, color: Colors.white70),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        _spinWheel();
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white70,
                        side: const BorderSide(color: Color(0xFF3F3F46)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: const Text('Quay Lại', style: TextStyle(fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        Navigator.pop(context); // Quay về xem chi tiết
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.goldenAmber,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: const Text('Ăn Món Này', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, Color col) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: col.withOpacity(0.15),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: col.withOpacity(0.3)),
        ),
        child: Text(label, style: TextStyle(color: col, fontSize: 11, fontWeight: FontWeight.bold)),
      );

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
        title: Text('Vòng Quay Ẩm Thực', style: AppTheme.titleLarge),
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline_rounded, color: Colors.white70),
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('🛡️ Tất cả 8 món trên vòng quay đã qua bộ lọc dị ứng & cooldown 3 ngày!')),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // ─── BỘ LỌC BẢO VỆ DỊ ỨNG & COOLDOWN ─────────────────────
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: AppTheme.emeraldBadge.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.emeraldBadge.withOpacity(0.3)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shield_rounded, color: AppTheme.emeraldBadge, size: 16),
                SizedBox(width: 8),
                Text(
                  'Đã loại 100% món dị ứng & món đã ăn 3 ngày qua',
                  style: TextStyle(color: AppTheme.emeraldBadge, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

          const Spacer(),

          // ─── VÒNG QUAY 3D CUSTOM PAINTER ─────────────────────────
          Center(
            child: SizedBox(
              width: 320,
              height: 320,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Outer Golden Bezel Glow Shadow
                  Container(
                    width: 316,
                    height: 316,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.goldenAmber.withOpacity(0.25),
                          blurRadius: 32,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                  ),

                  // The Spinning Wheel
                  Transform.rotate(
                    angle: _currentAngle,
                    child: CustomPaint(
                      size: const Size(310, 310),
                      painter: _LuxuryWheelPainter(items: _wheelItems),
                    ),
                  ),

                  // Center Hub Button (Embossed Metallic "QUAY")
                  GestureDetector(
                    onTap: _isSpinning ? null : _spinWheel,
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFDE68A), Color(0xFFFBBF24), Color(0xFFD97706)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.5),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                        border: Border.all(color: Colors.white, width: 2.5),
                      ),
                      child: Center(
                        child: Text(
                          _isSpinning ? '...' : 'QUAY',
                          style: const TextStyle(
                            color: Color(0xFF18181B),
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Top Pointer Indicator (12 o'clock downward arrow)
                  Positioned(
                    top: -2,
                    child: CustomPaint(
                      size: const Size(28, 36),
                      painter: _WheelPointerPainter(),
                    ),
                  ),
                ],
              ),
            ),
          ),

          const Spacer(),

          // ─── CTA NÚT BẤM DƯỚI CÙNG ──────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
            child: ElevatedButton.icon(
              onPressed: _isSpinning ? null : _spinWheel,
              icon: const Text('✨', style: TextStyle(fontSize: 18)),
              label: Text(
                _isSpinning ? 'Đang quay...' : 'Quay Chọn Món Ngay',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.goldenAmber,
                foregroundColor: Colors.black,
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── CUSTOM PAINTER: LUXURY 8-SEGMENT WHEEL ──────────────────────────────────
class _LuxuryWheelPainter extends CustomPainter {
  final List<Map<String, dynamic>> items;

  _LuxuryWheelPainter({required this.items});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    final segmentAngle = (2 * math.pi) / items.length;

    // 1. Draw outer metallic rim
    final rimPaint = Paint()
      ..shader = const SweepGradient(
        colors: [
          Color(0xFFF59E0B),
          Color(0xFFFEF3C7),
          Color(0xFFD97706),
          Color(0xFFF59E0B),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10;

    canvas.drawCircle(center, radius - 5, rimPaint);

    // Inner rim line
    final innerRimPaint = Paint()
      ..color = const Color(0xFF18181B)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawCircle(center, radius - 10, innerRimPaint);

    // 2. Draw 8 radial segments
    final sliceRadius = radius - 10;
    for (int i = 0; i < items.length; i++) {
      final startAngle = i * segmentAngle;
      final item = items[i];

      final segmentPaint = Paint()
        ..shader = RadialGradient(
          colors: [item['color1'] as Color, item['color2'] as Color],
          center: Alignment.center,
          radius: 0.9,
        ).createShader(Rect.fromCircle(center: center, radius: sliceRadius))
        ..style = PaintingStyle.fill;

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: sliceRadius),
        startAngle,
        segmentAngle,
        true,
        segmentPaint,
      );

      // Segment separator line
      final linePaint = Paint()
        ..color = Colors.white.withOpacity(0.3)
        ..strokeWidth = 1.5;
      final x = center.dx + sliceRadius * math.cos(startAngle);
      final y = center.dy + sliceRadius * math.sin(startAngle);
      canvas.drawLine(center, Offset(x, y), linePaint);

      // Draw Emoji and Text along segment center line
      final midAngle = startAngle + segmentAngle / 2;
      canvas.save();
      canvas.translate(center.dx, center.dy);
      canvas.rotate(midAngle);

      // Emoji at radius * 0.72
      final textPainter = TextPainter(
        text: TextSpan(
          text: '${item['emoji']}\n${item['name']}',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            height: 1.2,
            shadows: [Shadow(color: Colors.black54, blurRadius: 4, offset: Offset(0, 1))],
          ),
        ),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
      );
      textPainter.layout();
      textPainter.paint(
        canvas,
        Offset(sliceRadius * 0.58 - textPainter.width / 2, -textPainter.height / 2),
      );

      canvas.restore();
    }

    // 3. Draw 16 golden decorative rivets around the outer rim
    final rivetPaint = Paint()..color = const Color(0xFFFEF3C7);
    for (int i = 0; i < 16; i++) {
      final angle = i * (2 * math.pi / 16);
      final rx = center.dx + (radius - 5) * math.cos(angle);
      final ry = center.dy + (radius - 5) * math.sin(angle);
      canvas.drawCircle(Offset(rx, ry), 2.5, rivetPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ─── POINTER ARROW PAINTER (TOP 12 O'CLOCK) ──────────────────────────────────
class _WheelPointerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width / 2, size.height) // Bottom point of arrow
      ..lineTo(0, 0) // Top left
      ..lineTo(size.width, 0) // Top right
      ..close();

    final paint = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFFFEF08A), Color(0xFFF59E0B), Color(0xFFB45309)],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height))
      ..style = PaintingStyle.fill;

    // Drop shadow
    canvas.drawShadow(path, Colors.black, 4, true);
    canvas.drawPath(path, paint);

    // Glowing center gem on top of arrow
    final gemPaint = Paint()..color = const Color(0xFFEF4444);
    canvas.drawCircle(Offset(size.width / 2, 8), 3.5, gemPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
