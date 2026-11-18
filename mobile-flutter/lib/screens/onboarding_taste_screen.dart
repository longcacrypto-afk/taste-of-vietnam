// =============================================================================
// M1-S01..S06: ONBOARDING & TASTE PROFILE SCREEN — FLUTTER (AI Chef Benchmark Style)
// =============================================================================
// Màn hình Onboarding 6 bước:
//   S01: Splash + Mascot Măm chào đón
//   S02: Đăng nhập Zalo/Apple/SĐT + Guest Mode
//   S03: Chọn vùng ẩm thực (Bắc/Trung/Nam/Tất cả)
//   S04: Chọn khẩu vị & mức cay (0–3)
//   S05: Chọn chế độ ăn (Thường / Ăn sạch / Chay Lunar / High Protein)
//   S06: Bộ Lọc Dị Ứng Cứng (shrimp, peanut, dairy, gluten, egg)
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class OnboardingTasteScreen extends StatefulWidget {
  final VoidCallback onComplete;
  const OnboardingTasteScreen({super.key, required this.onComplete});

  @override
  State<OnboardingTasteScreen> createState() => _OnboardingTasteScreenState();
}

class _OnboardingTasteScreenState extends State<OnboardingTasteScreen> {
  final PageController _ctrl = PageController();
  int _step = 0;

  // Taste profile state
  final Set<String> _regions = {'bac', 'nam'};
  int _spice = 1;
  String _diet = 'balanced';
  final Set<String> _allergies = {};

  static const int _totalSteps = 6;

  void _next() {
    if (_step < _totalSteps - 1) {
      _ctrl.nextPage(duration: const Duration(milliseconds: 350), curve: Curves.easeInOut);
      setState(() => _step++);
    } else {
      widget.onComplete();
    }
  }

  void _back() {
    if (_step > 0) {
      _ctrl.previousPage(duration: const Duration(milliseconds: 350), curve: Curves.easeInOut);
      setState(() => _step--);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgPage,
      body: SafeArea(
        child: Column(
          children: [
            // Progress bar (Steps 2–6 only, Step 1 is splash)
            if (_step > 0)
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        GestureDetector(
                          onTap: _back,
                          child: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: AppTheme.slateMuted),
                        ),
                        Text('Bước ${_step} / ${_totalSteps - 1}',
                            style: const TextStyle(fontSize: 12, color: AppTheme.slateMuted, fontWeight: FontWeight.w600)),
                        const SizedBox(width: 18),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: _step / (_totalSteps - 1),
                        minHeight: 5,
                        backgroundColor: const Color(0xFFE2E8F0),
                        color: AppTheme.goldenAmber,
                      ),
                    ),
                  ],
                ),
              ),

            Expanded(
              child: PageView(
                controller: _ctrl,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _buildSplash(),
                  _buildAuthStep(),
                  _buildRegionsStep(),
                  _buildSpiceStep(),
                  _buildDietStep(),
                  _buildAllergyStep(),
                ],
              ),
            ),

            // CTA Button
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
              child: SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.goldenAmber,
                    foregroundColor: AppTheme.slateDark,
                    elevation: 0,
                    shape: const StadiumBorder(),
                  ),
                  onPressed: _next,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _step == 0 ? 'Bắt đầu khám phá ✨' :
                        _step < _totalSteps - 1 ? 'Tiếp theo →' : '🎉 Hoàn tất – Vào xem gợi ý hôm nay!',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── STEP 0: Splash + Mascot Mam ─────────────────────────────────────────
  Widget _buildSplash() {
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Mascot Mam (SVG-style using Flutter Widgets)
          Container(
            width: 160,
            height: 180,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF9F2),
              shape: BoxShape.circle,
              boxShadow: [BoxShadow(color: AppTheme.goldenAmber.withOpacity(0.25), blurRadius: 40, spreadRadius: 10)],
            ),
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('🧑‍🍳', style: TextStyle(fontSize: 72)),
                SizedBox(height: 4),
                Text('Măm', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: AppTheme.amberDark)),
              ],
            ),
          ),
          const SizedBox(height: 32),
          const Text('Hôm nay ăn gì?', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Text(
              '👋 Xin chào anh! Mình là Măm — trợ lý ẩm thực AI của anh.\nChỉ 1 phút thiết lập vị giác để mình gợi ý đúng hơn nhé!',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, height: 1.5, fontWeight: FontWeight.w500, color: AppTheme.slateDark),
            ),
          ),
          const SizedBox(height: 24),
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _FeaturePill(icon: '🛡️', label: 'Lọc cứng Dị ứng'),
              SizedBox(width: 8),
              _FeaturePill(icon: '⏱️', label: 'Gợi ý < 60 giây'),
              SizedBox(width: 8),
              _FeaturePill(icon: '🔒', label: 'PDPD Tuân thủ'),
            ],
          ),
        ],
      ),
    );
  }

  // ─── STEP 1: Auth (Zalo / Apple / Phone OTP / Guest) ─────────────────────
  Widget _buildAuthStep() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 0),
      child: Column(
        children: [
          const Text('Đăng nhập', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          const Text('Chọn cách đăng nhập để lưu hồ sơ vị giác của anh', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: AppTheme.slateMuted)),
          const SizedBox(height: 32),
          _AuthBtn(icon: '💙', label: 'Tiếp tục với Zalo', bg: const Color(0xFF0068FF), fg: Colors.white, onTap: _next),
          const SizedBox(height: 10),
          _AuthBtn(icon: '🍎', label: 'Tiếp tục với Apple', bg: AppTheme.charcoalHero, fg: Colors.white, onTap: _next),
          const SizedBox(height: 10),
          _AuthBtn(icon: '📱', label: 'Đăng ký / Đăng nhập bằng Số điện thoại', bg: AppTheme.surfaceElevated, fg: AppTheme.slateDark, onTap: _next),
          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: _next,
            child: const Text('Tiếp tục với tư cách Khách (Guest mode — không lưu lịch sử)',
                style: TextStyle(fontSize: 13, color: AppTheme.slateMuted, decoration: TextDecoration.underline), textAlign: TextAlign.center),
          ),
        ],
      ),
    );
  }

  // ─── STEP 2: Vùng ẩm thực ────────────────────────────────────────────────
  Widget _buildRegionsStep() {
    final options = [
      {'id': 'bac', 'label': '🌿 Miền Bắc', 'sub': 'Phở Hà Nội, Bún chả, Chả cá'},
      {'id': 'trung', 'label': '🌶️ Miền Trung', 'sub': 'Bún bò Huế, Mì Quảng, Bánh xèo'},
      {'id': 'nam', 'label': '🌴 Miền Nam', 'sub': 'Cơm tấm, Hủ tiếu, Bánh mì Sài Gòn'},
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        children: [
          const Text('Anh thích ẩm thực vùng nào?', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          const Text('Có thể chọn nhiều (Mặc định tất cả)', style: TextStyle(fontSize: 13, color: AppTheme.slateMuted)),
          const SizedBox(height: 24),
          ...options.map((opt) {
            final active = _regions.contains(opt['id']);
            return GestureDetector(
              onTap: () => setState(() {
                if (active) {
                  _regions.remove(opt['id']);
                } else {
                  _regions.add(opt['id']!);
                }
              }),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                decoration: BoxDecoration(
                  color: active ? const Color(0xFFFFF3CD) : AppTheme.surfaceElevated,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: active ? AppTheme.goldenAmber : const Color(0xFFE2E8F0), width: active ? 2 : 1),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(opt['label']!, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: active ? AppTheme.amberDark : AppTheme.slateDark)),
                          Text(opt['sub']!, style: const TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                        ],
                      ),
                    ),
                    if (active) const Icon(Icons.check_circle_rounded, color: AppTheme.goldenAmber),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  // ─── STEP 3: Mức cay ──────────────────────────────────────────────────────
  Widget _buildSpiceStep() {
    final levels = ['😴 Không cay', '🌶️ Nhẹ nhàng', '🌶️🌶️ Vừa phải', '🔥 Cay đã!'];
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        children: [
          const Text('Anh chịu được cay đến đâu?', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          const Text('Dùng để lọc gợi ý phù hợp khẩu vị', style: TextStyle(fontSize: 13, color: AppTheme.slateMuted)),
          const SizedBox(height: 32),
          Text(levels[_spice], style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: _spice == 0 ? AppTheme.slateMuted : AppTheme.amberDark)),
          const SizedBox(height: 24),
          Slider(
            value: _spice.toDouble(),
            min: 0,
            max: 3,
            divisions: 3,
            activeColor: AppTheme.goldenAmber,
            inactiveColor: const Color(0xFFE2E8F0),
            onChanged: (v) => setState(() => _spice = v.round()),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: ['Không cay', 'Nhẹ', 'Vừa', 'Cay'].map((l) => Text(l, style: const TextStyle(fontSize: 11, color: AppTheme.slateMuted))).toList(),
          ),
          if (_spice == 0) ...[
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Text('💡 Chế độ Không cay sẽ ưu tiên gợi ý món có trẻ nhỏ ăn được.', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            ),
          ],
        ],
      ),
    );
  }

  // ─── STEP 4: Chế độ ăn ───────────────────────────────────────────────────
  Widget _buildDietStep() {
    final modes = [
      {'id': 'balanced', 'label': '⚖️ Thường (Balanced)', 'sub': 'Ăn đa dạng, không giới hạn món'},
      {'id': 'eat_clean', 'label': '🥗 Ăn sạch (Eat Clean)', 'sub': 'Ưu tiên món luộc/hấp, ít dầu mỡ, nhiều rau'},
      {'id': 'vegan_lunar', 'label': '🌿 Ăn chay Mùng 1 & Rằm', 'sub': 'Nhắc tự động trước ngày âm lịch'},
      {'id': 'high_protein', 'label': '💪 High Protein', 'sub': 'Ưu tiên thịt nạc, trứng, đậu hũ, hải sản'},
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        children: [
          const Text('Anh đang theo chế độ ăn nào?', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
          const SizedBox(height: 20),
          ...modes.map((m) {
            final active = _diet == m['id'];
            return GestureDetector(
              onTap: () => setState(() => _diet = m['id']!),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                decoration: BoxDecoration(
                  color: active ? const Color(0xFFF0FDF4) : AppTheme.surfaceElevated,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: active ? AppTheme.emeraldBadge : const Color(0xFFE2E8F0), width: active ? 2 : 1),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(m['label']!, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: active ? AppTheme.emeraldBadge : AppTheme.slateDark)),
                          Text(m['sub']!, style: const TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                        ],
                      ),
                    ),
                    if (active) const Icon(Icons.check_circle_rounded, color: AppTheme.emeraldBadge),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  // ─── STEP 5: Dị ứng cứng ─────────────────────────────────────────────────
  Widget _buildAllergyStep() {
    final tags = [
      {'id': 'shrimp', 'label': '🦐 Tôm / Hải sản'},
      {'id': 'peanut', 'label': '🥜 Đậu phộng'},
      {'id': 'dairy', 'label': '🥛 Sữa bò'},
      {'id': 'gluten', 'label': '🌾 Gluten / Lúa mì'},
      {'id': 'egg', 'label': '🥚 Trứng'},
      {'id': 'sesame', 'label': '🫘 Mè / Vừng'},
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
      child: Column(
        children: [
          const Text('Anh có dị ứng thực phẩm không?', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          const Text('Những thành phần này sẽ bị loại bỏ 100% khỏi mọi gợi ý (kể cả món Tài trợ).',
              textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: AppTheme.slateMuted)),
          const SizedBox(height: 20),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: tags.map((t) {
              final active = _allergies.contains(t['id']);
              return GestureDetector(
                onTap: () => setState(() {
                  if (active) {
                    _allergies.remove(t['id']);
                  } else {
                    _allergies.add(t['id']!);
                  }
                }),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: active ? const Color(0xFFFFE4E6) : AppTheme.surfaceElevated,
                    borderRadius: BorderRadius.circular(99),
                    border: Border.all(color: active ? const Color(0xFFFECDD3) : const Color(0xFFE2E8F0), width: active ? 2 : 1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(t['label']!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: active ? const Color(0xFFBE123C) : AppTheme.slateDark)),
                      if (active) ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.close_rounded, size: 14, color: Color(0xFFBE123C)),
                      ],
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          if (_allergies.isEmpty) ...[
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(14)),
              child: const Text('✅ Không có dị ứng — Măm sẽ gợi ý toàn bộ thực đơn Việt!', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.emeraldBadge)),
            ),
          ],
          if (_allergies.isNotEmpty) ...[
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFFFE4E6), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFFECDD3))),
              child: Text('🛡️ Đã kích hoạt bộ lọc cứng cho: ${_allergies.join(", ")} — Tuyệt đối không lọt qua bất kỳ gợi ý nào.',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFBE123C))),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Helper Widgets ────────────────────────────────────────────────────────────
class _FeaturePill extends StatelessWidget {
  final String icon;
  final String label;
  const _FeaturePill({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(icon, style: const TextStyle(fontSize: 11)),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.slateDark)),
        ],
      ),
    );
  }
}

class _AuthBtn extends StatelessWidget {
  final String icon;
  final String label;
  final Color bg;
  final Color fg;
  final VoidCallback onTap;

  const _AuthBtn({required this.icon, required this.label, required this.bg, required this.fg, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: bg,
          foregroundColor: fg,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: BorderSide(color: const Color(0xFFE2E8F0).withOpacity(bg.opacity > 0.5 ? 0 : 1))),
        ),
        onPressed: onTap,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(icon, style: const TextStyle(fontSize: 18)),
            const SizedBox(width: 10),
            Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: fg)),
          ],
        ),
      ),
    );
  }
}
