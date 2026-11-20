// =============================================================================
// M3-S03 DECISION MINI-GAMES SCREEN (ĐẤU TRƯỜNG QUYẾT ĐỊNH BỮA ĂN)
// 1. Vòng Quay 3D (Calibrated Precision + Metallic Bezel)
// 2. Rút Quẻ Ẩm Thực (Lucky Bamboo Lot Sticks + Traditional Poems)
// 3. Mở Túi Mù / Hộp Bí Mật (Blind Box Mystery Unboxing + Vouchers)
// =============================================================================

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class SpinWheelScreen extends StatefulWidget {
  const SpinWheelScreen({super.key});

  @override
  State<SpinWheelScreen> createState() => _SpinWheelScreenState();
}

class _SpinWheelScreenState extends State<SpinWheelScreen>
    with TickerProviderStateMixin {
  int _selectedTab = 0; // 0: Wheel, 1: Fortune, 2: Blind Box

  // ─── WHEEL CONTROLLER ─────────────────────────────────────────────
  late AnimationController _spinCtrl;
  late Animation<double> _spinAnim;
  double _currentAngle = 0.0;
  bool _isSpinning = false;
  Map<String, dynamic>? _selectedDish;

  // ─── FORTUNE CONTROLLER ───────────────────────────────────────────
  late AnimationController _fortuneShakeCtrl;
  bool _isShakingFortune = false;
  Map<String, dynamic>? _currentFortune;

  // ─── BLIND BOX CONTROLLER ─────────────────────────────────────────
  late AnimationController _boxShakeCtrl;
  int? _selectedBoxIndex;
  Map<String, dynamic>? _currentLoot;

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

  final List<Map<String, dynamic>> _fortuneList = [
    {
      'num': '01',
      'rank': 'Thượng Thượng Cát',
      'dish': 'Phở Bò Tái Nạm Hà Nội',
      'price': '55.000đ',
      'cal': 480,
      'poem': 'Sương mai bảng lảng gió heo may,\nPhở nóng trao tay ấm cả ngày.\nNước dùng trong ngọt hồi quế thảo,\nQuẻ lành mang đến phúc tràn đầy!',
      'divination': 'Khí vận hanh thông, công việc suôn sẻ như dòng nước phở thanh khiết.',
    },
    {
      'num': '02',
      'rank': 'Đại Cát Đại Lợi',
      'dish': 'Cơm Tấm Sườn Bì Chả Sài Gòn',
      'price': '50.000đ',
      'cal': 620,
      'poem': 'Sườn nướng than hoa đượm sắc vàng,\nHương thơm nức mũi khắp xóm làng.\nChả trứng bì bùi chan mắm ớt,\nĂn xong đón lộc bước thênh thang!',
      'divination': 'Chắc bụng no say, tài lộc đầy túi, làm việc gì cũng vững vàng.',
    },
    {
      'num': '03',
      'rank': 'Thượng Cát',
      'dish': 'Bún Bò Cố Đô Huế O Xuân',
      'price': '60.000đ',
      'cal': 520,
      'poem': 'Hương sả nồng nàn cay dịu êm,\nNước dùng đậm vị ấm môi mềm.\nChả cua huyết mịn hòa phong sắc,\nXua tan mưa lạnh bước êm đềm!',
      'divination': 'Xua tan vận u ám, đón sinh khí ấm áp tràn đầy nhiệt huyết.',
    },
    {
      'num': '04',
      'rank': 'Thượng Cát',
      'dish': 'Bún Chả Nem Cua Bể Hà Thành',
      'price': '50.000đ',
      'cal': 540,
      'poem': 'Than hồng quạt khói chả vàng mơ,\nNước chấm thanh tao vị ngẩn ngơ.\nNem cua giòn rụm thêm duyên thắm,\nTri kỷ tương phùng đẹp ý thơ!',
      'divination': 'Gặp quý nhân phù trợ, đối tác hài lòng, nhân duyên nở rộ.',
    },
  ];

  final List<Map<String, dynamic>> _blindBoxLoots = [
    {
      'rarity': 'SSR SIÊU PHẨM',
      'dish': 'Cơm Tấm Sườn Cây Khổng Lồ Ốp La',
      'price': '65.000đ',
      'emoji': '🍱',
      'voucher': 'TUIMU-MAM-25K',
      'discount': 'Giảm 25.000đ',
      'desc': 'Sườn cây nướng than thơm lừng mỡ hành, trứng ốp la lòng đào béo ngậy kèm tóp mỡ giòn tan.',
    },
    {
      'rarity': 'SSR SIÊU PHẨM',
      'dish': 'Lẩu Bò Nhúng Dấm Ba Toa Đặc Biệt',
      'price': '180.000đ',
      'emoji': '🍲',
      'voucher': 'TUIMU-MAM-30K',
      'discount': 'Giảm 30.000đ',
      'desc': 'Bắp bò giòn sần sật nhúng dấm chua thanh bốc khói, chấm mắm nêm đậm đà Đà Lạt.',
    },
    {
      'rarity': 'SR HOÀNG GIA',
      'dish': 'Bún Riêu Cua Bắp Bò Giò Heo',
      'price': '55.000đ',
      'emoji': '🍜',
      'voucher': 'TUIMU-MAM-15K',
      'discount': 'Giảm 15.000đ',
      'desc': 'Tô đầy ú ụ riêu cua đồng béo ngậy, bắp bò tươi ngọt và giò heo giòn sần sật.',
    },
    {
      'rarity': 'RARE MAY MẮN',
      'dish': 'Bánh Mì Chảo Xíu Mại Trứng Muối',
      'price': '38.000đ',
      'emoji': '🍳',
      'voucher': 'TUIMU-MAM-10K',
      'discount': 'Giảm 10.000đ',
      'desc': 'Chảo gang xèo xèo sốt cà chua sánh béo ngậy viên xíu mại trứng muối đậm đà.',
    },
  ];

  @override
  void initState() {
    super.initState();
    _spinCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4200),
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

    _fortuneShakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _boxShakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
  }

  @override
  void dispose() {
    _spinCtrl.dispose();
    _fortuneShakeCtrl.dispose();
    _boxShakeCtrl.dispose();
    super.dispose();
  }

  void _spinWheel() {
    if (_isSpinning) return;

    setState(() {
      _isSpinning = true;
      _selectedDish = null;
    });

    final randomTargetIndex = math.Random().nextInt(_wheelItems.length);
    final segmentAngle = (2 * math.pi) / _wheelItems.length;

    // Con trỏ đặt ở đỉnh 12h (270 độ hoặc 3*pi/2).
    // Để tâm ô targetIndex dừng ngay dưới con trỏ:
    // targetAngle phải xoay sao cho góc trung tâm của ô chuyển đúng về 3*pi/2
    final extraSpins = (5 + math.Random().nextInt(3)) * 2 * math.pi;
    final targetSegmentCenter = (randomTargetIndex * segmentAngle) + (segmentAngle / 2);
    final targetRotation = (3 * math.pi / 2 - targetSegmentCenter) % (2 * math.pi);
    final positiveTarget = targetRotation < 0 ? targetRotation + 2 * math.pi : targetRotation;

    final currentNormalized = _currentAngle % (2 * math.pi);
    var forwardDiff = (positiveTarget - currentNormalized) % (2 * math.pi);
    if (forwardDiff < 0) forwardDiff += 2 * math.pi;

    _spinAnim = Tween<double>(
      begin: _currentAngle,
      end: _currentAngle + extraSpins + forwardDiff,
    ).animate(CurvedAnimation(parent: _spinCtrl, curve: Curves.easeOutCubic));

    _spinCtrl.reset();
    _spinCtrl.forward();
  }

  void _determineWinner() {
    final segmentAngle = (2 * math.pi) / _wheelItems.length;
    final normalizedAngle = (_currentAngle) % (2 * math.pi);
    final pointerAngle = (3 * math.pi / 2 - normalizedAngle) % (2 * math.pi);
    final positivePointer = pointerAngle < 0 ? pointerAngle + 2 * math.pi : pointerAngle;
    final winningIndex = (positivePointer / segmentAngle).floor() % _wheelItems.length;

    _selectedDish = _wheelItems[winningIndex];
    _showWinningDialog(_selectedDish!);
  }

  void _drawFortune() {
    if (_isShakingFortune) return;

    setState(() {
      _isShakingFortune = true;
      _currentFortune = null;
    });

    _fortuneShakeCtrl.repeat(reverse: true);

    Future.delayed(const Duration(milliseconds: 1600), () {
      _fortuneShakeCtrl.stop();
      _fortuneShakeCtrl.reset();

      final wonFortune = _fortuneList[math.Random().nextInt(_fortuneList.length)];
      setState(() {
        _isShakingFortune = false;
        _currentFortune = wonFortune;
      });

      _showFortuneDialog(wonFortune);
    });
  }

  void _openBox(int index) {
    setState(() {
      _selectedBoxIndex = index;
    });

    _boxShakeCtrl.repeat(reverse: true);

    Future.delayed(const Duration(milliseconds: 900), () {
      _boxShakeCtrl.stop();
      _boxShakeCtrl.reset();

      final loot = _blindBoxLoots[math.Random().nextInt(_blindBoxLoots.length)];
      setState(() {
        _currentLoot = loot;
      });

      _showLootDialog(loot);
    });
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
              const Text('🎉 VÒNG QUAY CHỌN MÓN!',
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
                      onPressed: () => Navigator.pop(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.goldenAmber,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: const Text('Chốt Món Này', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
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

  void _showFortuneDialog(Map<String, dynamic> fortune) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: const Color(0xFF1C1917),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: const BorderSide(color: Color(0xFFD97706), width: 2)),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF991B1B),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text('🎋 QUẺ SỐ ${fortune['num']} · ${fortune['rank']}',
                    style: const TextStyle(color: Color(0xFFFEF3C7), fontSize: 12, fontWeight: FontWeight.w900)),
              ),
              const SizedBox(height: 14),
              Text(fortune['dish'],
                  style: const TextStyle(color: Color(0xFFFBBF24), fontSize: 18, fontWeight: FontWeight.w900),
                  textAlign: TextAlign.center),
              const SizedBox(height: 4),
              Text('Giá tham khảo: ${fortune['price']} · 🔥 ${fortune['cal']} kcal',
                  style: const TextStyle(color: Colors.white70, fontSize: 11)),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF292524),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF78350F)),
                ),
                child: Text(
                  fortune['poem'],
                  style: const TextStyle(color: Color(0xFFFEF3C7), fontStyle: FontStyle.italic, fontSize: 12, height: 1.5),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 12),
              Text('Luận quẻ: ${fortune['divination']}',
                  style: const TextStyle(color: Colors.white60, fontSize: 11),
                  textAlign: TextAlign.center),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        _drawFortune();
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white70,
                        side: const BorderSide(color: Color(0xFF78350F)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Xóc Quẻ Khác', style: TextStyle(fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF22C55E),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Ăn Theo Quẻ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
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

  void _showLootDialog(Map<String, dynamic> loot) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: AppTheme.charcoalHero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: const BorderSide(color: AppTheme.goldenAmber, width: 2)),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.goldenAmber,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text('✨ ${loot['rarity']}',
                    style: const TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.w900)),
              ),
              const SizedBox(height: 14),
              Text(loot['emoji'], style: const TextStyle(fontSize: 48)),
              const SizedBox(height: 8),
              Text(loot['dish'],
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
                  textAlign: TextAlign.center),
              const SizedBox(height: 4),
              Text(loot['desc'],
                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                  textAlign: TextAlign.center),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.4)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('MÃ VOUCHER BÍ MẬT', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 9, fontWeight: FontWeight.bold)),
                          Text(loot['voucher'], style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w900, letterSpacing: 1.2)),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: loot['voucher']));
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Đã chép mã voucher!')));
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.goldenAmber,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      ),
                      child: const Text('Chép', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00B14F),
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(44),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Đặt Món Áp Mã', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
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
        title: Text('Mini-Game Ẩm Thực 🎲', style: AppTheme.titleLarge),
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline_rounded, color: Colors.white70),
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('🛡️ Tất cả món ăn đã qua bộ lọc dị ứng & cooldown 3 ngày!')),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // ─── 3 MINI-GAMES SEGMENTED SWITCHER ──────────────────────
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: AppTheme.surfaceElevated,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white10),
            ),
            child: Row(
              children: [
                _subGameTab(0, '🎡 Vòng Quay 3D'),
                _subGameTab(1, '🎋 Rút Quẻ'),
                _subGameTab(2, '🎁 Túi Mù (Blind Box)'),
              ],
            ),
          ),

          // ─── HARD ALLERGY & COOLDOWN BADGE ────────────────────────
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: AppTheme.emeraldBadge.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.emeraldBadge.withOpacity(0.3)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shield_rounded, color: AppTheme.emeraldBadge, size: 14),
                SizedBox(width: 6),
                Text(
                  'Đã loại 100% món dị ứng & món đã ăn 3 ngày qua',
                  style: TextStyle(color: AppTheme.emeraldBadge, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

          Expanded(
            child: _selectedTab == 0
                ? _buildWheelView()
                : _selectedTab == 1
                    ? _buildFortuneView()
                    : _buildBlindBoxView(),
          ),
        ],
      ),
    );
  }

  Widget _subGameTab(int idx, String label) {
    final active = _selectedTab == idx;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedTab = idx),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: active ? AppTheme.goldenAmber : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: active ? Colors.black : Colors.white70,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }

  Widget _buildWheelView() {
    return Column(
      children: [
        const Spacer(),
        Center(
          child: SizedBox(
            width: 320,
            height: 320,
            child: Stack(
              alignment: Alignment.center,
              children: [
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
                Transform.rotate(
                  angle: _currentAngle,
                  child: CustomPaint(
                    size: const Size(310, 310),
                    painter: _LuxuryWheelPainter(items: _wheelItems),
                  ),
                ),
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
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          child: ElevatedButton.icon(
            onPressed: _isSpinning ? null : _spinWheel,
            icon: const Text('🎯', style: TextStyle(fontSize: 18)),
            label: Text(
              _isSpinning ? 'Đang quay...' : 'Quay Chọn Món Ngay',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.goldenAmber,
              foregroundColor: Colors.black,
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              elevation: 4,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFortuneView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Text('🎋 Ống Xăm Ẩm Thực Cổ Truyền',
            style: TextStyle(color: Color(0xFFFBBF24), fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text('Lắc ống tre để xin quẻ may mắn cho bữa ăn hôm nay',
            style: TextStyle(color: Colors.white70, fontSize: 11)),
        const SizedBox(height: 30),
        AnimatedBuilder(
          animation: _fortuneShakeCtrl,
          builder: (_, child) {
            final offset = _isShakingFortune ? math.sin(_fortuneShakeCtrl.value * math.pi * 4) * 8 : 0.0;
            return Transform.translate(
              offset: Offset(offset, 0),
              child: child,
            );
          },
          child: Container(
            width: 140,
            height: 190,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF92400E), Color(0xFFB45309), Color(0xFF78350F)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFFDE68A), width: 3),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.5),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('🥢', style: TextStyle(fontSize: 40)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  color: const Color(0xFF991B1B),
                  child: const Text('ẨM THỰC',
                      style: TextStyle(color: Color(0xFFFEF3C7), fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 2)),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 36),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: ElevatedButton.icon(
            onPressed: _isShakingFortune ? null : _drawFortune,
            icon: const Text('🎋', style: TextStyle(fontSize: 18)),
            label: Text(
              _isShakingFortune ? 'Đang lắc ống xăm...' : 'Lắc Ống Xăm (Xin Quẻ)',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBlindBoxView() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Text('🎁 Trend Xé Túi Mù Ẩm Thực',
            style: TextStyle(color: Color(0xFFFBBF24), fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        const Text('Chọn 1 túi may mắn để mở món ăn + voucher bí mật',
            style: TextStyle(color: Colors.white70, fontSize: 11)),
        const SizedBox(height: 28),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _boxTile(0, 'Tài Lộc', '🧧', const Color(0xFFEF4444)),
            const SizedBox(width: 14),
            _boxTile(1, 'Hoàng Kim', '✨', const Color(0xFFFBBF24)),
            const SizedBox(width: 14),
            _boxTile(2, 'Ngọc Bích', '🍀', const Color(0xFF22C55E)),
          ],
        ),
        const SizedBox(height: 30),
        const Text('Chạm vào túi bất kỳ để xé ngay ✂️',
            style: TextStyle(color: Colors.white54, fontSize: 11, fontStyle: FontStyle.italic)),
      ],
    );
  }

  Widget _boxTile(int index, String title, String emoji, Color col) {
    return GestureDetector(
      onTap: () => _openBox(index),
      child: AnimatedBuilder(
        animation: _boxShakeCtrl,
        builder: (_, child) {
          final isTarget = _selectedBoxIndex == index;
          final offset = isTarget ? math.sin(_boxShakeCtrl.value * math.pi * 4) * 6 : 0.0;
          return Transform.translate(offset: Offset(0, offset), child: child);
        },
        child: Container(
          width: 96,
          height: 130,
          decoration: BoxDecoration(
            color: col.withOpacity(0.2),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: col, width: 2),
            boxShadow: [
              BoxShadow(
                color: col.withOpacity(0.3),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(emoji, style: const TextStyle(fontSize: 34)),
              const SizedBox(height: 8),
              Text(title, style: TextStyle(color: col, fontSize: 11, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              const Text('Xé túi ✂️', style: TextStyle(color: Colors.white54, fontSize: 9)),
            ],
          ),
        ),
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
    }

    // Draw Emoji and Text along segment center line
    for (int i = 0; i < items.length; i++) {
      final startAngle = i * segmentAngle;
      final item = items[i];
      final midAngle = startAngle + segmentAngle / 2;
      canvas.save();
      canvas.translate(center.dx, center.dy);
      canvas.rotate(midAngle);

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
