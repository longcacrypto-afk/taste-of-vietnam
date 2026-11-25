// M6 · Merchant Portal & AI Menu OCR Screen
// Hôm nay ăn gì · Taste of Vietnam v0.1

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class MerchantPortalScreen extends StatefulWidget {
  const MerchantPortalScreen({super.key});

  @override
  State<MerchantPortalScreen> createState() => _MerchantPortalScreenState();
}

class _MerchantPortalScreenState extends State<MerchantPortalScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  bool _wsConnected = true;
  bool _isOcrScanning = false;
  bool _ocrSuccess = false;

  final List<Map<String, dynamic>> _ocrExtractedDishes = [
    {'name': 'Phở Bò Tái Nạm', 'priceRaw': '55k', 'priceVnd': 55000, 'confidence': 98.4, 'matched': 'DISH-101'},
    {'name': 'Phở Gà Ta Lá Chanh', 'priceRaw': '50,000', 'priceVnd': 50000, 'confidence': 97.2, 'matched': 'DISH-104'},
    {'name': 'Quẩy Giòn Giòn', 'priceRaw': '10k', 'priceVnd': 10000, 'confidence': 99.1, 'matched': 'SIDE-201'},
    {'name': 'Trứng Chần Nước Béo', 'priceRaw': '15.000đ', 'priceVnd': 15000, 'confidence': 96.5, 'matched': 'SIDE-202'},
  ];

  final List<Map<String, dynamic>> _manualMenu = [
    {'id': 'MENU-01', 'name': 'Phở Bò Tái Nạm', 'price_vnd': 55000, 'available': true, 'special': true},
    {'id': 'MENU-02', 'name': 'Phở Gà Ta Lá Chanh', 'price_vnd': 50000, 'available': true, 'special': false},
    {'id': 'MENU-03', 'name': 'Quẩy Giòn', 'price_vnd': 10000, 'available': true, 'special': false},
  ];

  final List<Map<String, dynamic>> _campaigns = [
    {'id': 'CMP-701', 'name': 'Ưu tiên gợi ý bữa trưa (Bán kính 3km)', 'cpc': '4.500đ / click', 'clicks': '128 clicks', 'total': '576.000đ', 'active': true},
    {'id': 'CMP-702', 'name': 'Tài trợ vị trí món Phở Bò Tái', 'cpc': '3.800đ / click', 'clicks': '94 clicks', 'total': '357.200đ', 'active': true},
    {'id': 'CMP-703', 'name': 'Flash Sale 15:00 - 17:00 Xế chiều', 'cpc': '2.500đ / click', 'clicks': '0 clicks', 'total': 'Tạm dừng', 'active': false},
  ];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
    _syncMerchantExtras();
  }

  Future<void> _syncMerchantExtras() async {
    await ApiService.fetchDailySpecial();
    await ApiService.fetchFraudLogs();
  }

  Future<void> _triggerOcrScan() async {
    setState(() {
      _isOcrScanning = true;
      _ocrSuccess = false;
    });
    await ApiService.scanMenuOcr(
      'PLACE-401',
      'Phở Bò Tái Nạm - 55k\nPhở Gà Ta Lá Chanh - 50,000\nQuẩy Giòn - 10k',
    );
    if (!mounted) return;
    setState(() {
      _isOcrScanning = false;
      _ocrSuccess = true;
    });
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  void _showVietQrTopupSheet() async {
    int selectedAmount = 500000;
    bool isGenerating = true;
    Map<String, dynamic>? invoiceData;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            if (isGenerating && invoiceData == null) {
              ApiService.createVietQrInvoice(
                campaignId: 'CMP-701',
                amountVnd: selectedAmount,
              ).then((inv) {
                setModalState(() {
                  invoiceData = inv;
                  isGenerating = false;
                });
              });
            }

            return Padding(
              padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text('Nạp Ngân Sách Tài Trợ VietQR',
                      style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  const Text('Chuẩn NAPAS 24/7 · Tự động kích hoạt sau 3 giây',
                      style: TextStyle(color: Colors.white54, fontSize: 12)),
                  const SizedBox(height: 16),

                  // Quick amount selector
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [200000, 500000, 1000000].map((amt) {
                      final isSel = selectedAmount == amt;
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: ChoiceChip(
                          label: Text('${amt ~/ 1000}k'),
                          selected: isSel,
                          selectedColor: AppTheme.goldenAmber,
                          labelStyle: TextStyle(
                            color: isSel ? Colors.black : Colors.white70,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                          onSelected: (val) {
                            if (val) {
                              setModalState(() {
                                selectedAmount = amt;
                                isGenerating = true;
                                invoiceData = null;
                              });
                            }
                          },
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),

                  if (isGenerating)
                    const Padding(
                      padding: EdgeInsets.all(32),
                      child: CircularProgressIndicator(color: AppTheme.goldenAmber),
                    )
                  else if (invoiceData != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Image.network(
                        invoiceData!['qr_image_url'] ?? '',
                        width: 200,
                        height: 200,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => const Icon(Icons.qr_code_2_rounded, size: 180, color: Colors.black87),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceElevated,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          _invoiceRow('Ngân hàng', invoiceData!['bank_name'] ?? 'Vietcombank'),
                          _invoiceRow('Số tài khoản', invoiceData!['account_number'] ?? '0121000889999'),
                          _invoiceRow('Chủ tài khoản', invoiceData!['account_holder'] ?? 'CONG TY HOM NAY AN GI'),
                          _invoiceRow('Số tiền', '${_fmt(invoiceData!['amount_vnd'] ?? selectedAmount)}đ', isHighlight: true),
                          _invoiceRow('Nội dung CK', invoiceData!['transfer_memo'] ?? 'HNAG CMP-701', isCopyable: true),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('✅ Đã xác nhận! Hệ thống đang chờ tín hiệu webhook từ Napas.'),
                          backgroundColor: Color(0xFF22C55E),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.goldenAmber,
                      foregroundColor: Colors.black,
                      minimumSize: const Size(double.infinity, 44),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Tôi Đã Chuyển Khoản', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _invoiceRow(String label, String value, {bool isHighlight = false, bool isCopyable = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11)),
          Row(
            children: [
              Text(
                value,
                style: TextStyle(
                  color: isHighlight ? AppTheme.goldenAmber : Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 11,
                ),
              ),
              if (isCopyable) ...[
                const SizedBox(width: 4),
                const Icon(Icons.copy_rounded, color: AppTheme.goldenAmber, size: 12),
              ],
            ],
          ),
        ],
      ),
    );
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
        title: Row(
          children: [
            Text('Quản Lý Quán (M6)', style: AppTheme.titleLarge),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: _wsConnected ? AppTheme.emeraldBadge.withOpacity(0.15) : Colors.redAccent.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: _wsConnected ? AppTheme.emeraldBadge : Colors.redAccent,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(_wsConnected ? 'WS LIVE' : 'OFFLINE',
                      style: TextStyle(
                        color: _wsConnected ? AppTheme.emeraldBadge : Colors.redAccent,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                      )),
                ],
              ),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tab,
          indicatorColor: AppTheme.goldenAmber,
          labelColor: AppTheme.goldenAmber,
          unselectedLabelColor: AppTheme.textSecondary,
          tabs: const [
            Tab(text: '📊 Doanh Thu'),
            Tab(text: '📷 AI Menu OCR'),
            Tab(text: '🎯 Tài Trợ Ad'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          _buildMetricsTab(),
          _buildOcrTab(),
          _buildAdsTab(),
        ],
      ),
    );
  }

  // ─── TAB 1: DOANH THU & ĐƠN HÀNG ────────────────────────────────
  Widget _buildMetricsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildRestaurantHeaderCard(),
        const SizedBox(height: 16),
        Row(
          children: [
            _kpiCard('Đơn Hôm Nay', '48 đơn', '+12%', AppTheme.goldenAmber),
            const SizedBox(width: 10),
            _kpiCard('Doanh Thu Ngày', '2.85 Tr đ', '+15%', AppTheme.emeraldBadge),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            _kpiCard('Lượt Khám Phá', '1,240', '+22%', Colors.blueAccent),
            const SizedBox(width: 10),
            _kpiCard('Đánh Giá Quán', '4.9 ⭐', '186 reviews', AppTheme.goldenAmber),
          ],
        ),
        const SizedBox(height: 20),
        _buildLiveOrdersSection(),
      ],
    );
  }

  Widget _buildRestaurantHeaderCard() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF2A2A2E)),
        ),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: AppTheme.bgPage,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(child: Text('🍜', style: TextStyle(fontSize: 26))),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Phở Gia Truyền Phát Tài', style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text('📍 128 Nguyễn Ái Quốc, P. Tân Tiến, Biên Hòa', style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: AppTheme.emeraldBadge.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
                        child: const Text('Đang mở cửa', style: TextStyle(color: AppTheme.emeraldBadge, fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 6),
                      Text('06:00 – 21:30', style: AppTheme.labelSmall.copyWith(fontSize: 10)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _kpiCard(String title, String val, String sub, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppTheme.labelSmall.copyWith(fontSize: 11)),
              const SizedBox(height: 6),
              Text(val, style: AppTheme.titleMedium.copyWith(fontSize: 17, fontWeight: FontWeight.bold)),
              const SizedBox(height: 2),
              Text(sub, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      );

  Widget _buildLiveOrdersSection() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Đơn Đặt Chỗ & Deep-link Mới Nhất', style: AppTheme.titleMedium.copyWith(fontSize: 14)),
              Text('Cập nhật realtime 5s', style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.goldenAmber)),
            ],
          ),
          const SizedBox(height: 12),
          _orderRow('Bàn #04 · 2 người', '12:30 hôm nay', '55.000đ', 'Đã xác nhận', AppTheme.emeraldBadge),
          _orderRow('GrabFood Deep-link', '12:15 hôm nay', '110.000đ', 'Hoàn tất', Colors.blueAccent),
          _orderRow('Bàn #02 · 4 người', '18:30 hôm nay', '240.000đ', 'Chờ khách đến', AppTheme.goldenAmber),
        ],
      );

  Widget _orderRow(String title, String time, String amount, String status, Color col) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.w600, fontSize: 13)),
                  Text(time, style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(amount, style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 13)),
                Text(status, style: TextStyle(color: col, fontSize: 10, fontWeight: FontWeight.bold)),
              ],
            ),
          ],
        ),
      );

  // ─── TAB 2: AI MENU OCR & MANUAL MENU CRUD (M6-S04..S07) ─────────
  Widget _buildOcrTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildOcrUploadCard(),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Thực Đơn Quán (${_manualMenu.length} món)', style: AppTheme.titleMedium.copyWith(fontSize: 14)),
            TextButton.icon(
              onPressed: () => _openMenuItemModal(),
              icon: const Icon(Icons.add_circle_outline_rounded, size: 16, color: AppTheme.goldenAmber),
              label: const Text('Thêm Món', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ..._manualMenu.map((m) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.surfaceElevated,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(m['name'] as String, style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.w700, fontSize: 13)),
                            if (m['special'] == true) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: AppTheme.goldenAmber.withOpacity(0.2), borderRadius: BorderRadius.circular(6)),
                                child: const Text('⭐ Đặc biệt', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 9, fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ],
                        ),
                        Text('${_fmt((m['price_vnd'] as num).toInt())}đ · ${m['available'] == true ? 'Còn món' : 'Tạm hết'}',
                            style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Icon(Icons.star_rounded, size: 18, color: m['special'] == true ? AppTheme.goldenAmber : Colors.white38),
                    tooltip: 'Gắn Món Đặc Biệt Hôm Nay',
                    onPressed: () async {
                      setState(() => m['special'] = !(m['special'] == true));
                      await ApiService.tagDailySpecial(dishId: m['id'] as String, label: 'Món đặc biệt hôm nay');
                    },
                  ),
                  IconButton(
                    icon: const Icon(Icons.edit_outlined, size: 17, color: Colors.white70),
                    onPressed: () => _openMenuItemModal(existing: m),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, size: 17, color: Colors.redAccent),
                    onPressed: () async {
                      final id = m['id'] as String;
                      setState(() => _manualMenu.removeWhere((x) => x['id'] == id));
                      await ApiService.deleteMerchantMenuItem(id);
                    },
                  ),
                ],
              ),
            )),
        const SizedBox(height: 12),
        if (_isOcrScanning)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppTheme.surfaceElevated,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Column(
              children: [
                CircularProgressIndicator(color: AppTheme.goldenAmber),
                SizedBox(height: 12),
                Text('🔍 AI đang phân tích hình ảnh thực đơn...', style: TextStyle(color: Colors.white70)),
                SizedBox(height: 4),
                Text('Chuẩn hóa giá (45k -> 45.000đ) & Khớp Thư Viện M2', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 11)),
              ],
            ),
          ),
        if (_ocrSuccess) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Kết Quả Quét OCR (${_ocrExtractedDishes.length} món)', style: AppTheme.titleMedium.copyWith(fontSize: 14)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: AppTheme.emeraldBadge.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
                child: const Text('Độ tin cậy ≥95% · Tự duyệt', style: TextStyle(color: AppTheme.emeraldBadge, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ..._ocrExtractedDishes.map(_buildOcrDishRow),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('✅ Đã cập nhật 4 món mới vào Thực đơn quán!')),
            ),
            icon: const Icon(Icons.check_rounded, size: 18),
            label: const Text('Lưu Vào Thực Đơn Của Quán'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.goldenAmber,
              foregroundColor: Colors.black,
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildOcrUploadCard() => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            const Icon(Icons.document_scanner_rounded, size: 48, color: AppTheme.goldenAmber),
            const SizedBox(height: 12),
            Text('Tự Động Số Hóa Thực Đơn Giấy', style: AppTheme.titleMedium.copyWith(fontSize: 15)),
            const SizedBox(height: 4),
            Text(
              'Chụp ảnh hoặc tải lên menu của quán. AI OCR sẽ tự động nhận diện tên món, giá tiền và phân loại nguyên liệu.',
              textAlign: TextAlign.center,
              style: AppTheme.labelSmall.copyWith(fontSize: 11, height: 1.4),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _isOcrScanning ? null : _triggerOcrScan,
              icon: const Icon(Icons.camera_alt_rounded, size: 18),
              label: const Text('Chụp / Tải Lên Thực Đơn'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.goldenAmber,
                foregroundColor: Colors.black,
                minimumSize: const Size(200, 44),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      );

  Widget _buildOcrDishRow(Map<String, dynamic> dish) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(dish['name'], style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.w600, fontSize: 13)),
                  Text('Gốc: ${dish['priceRaw']} ➔ Chuẩn: ${_fmt(dish['priceVnd'])}đ',
                      style: AppTheme.labelSmall.copyWith(color: AppTheme.goldenAmber, fontSize: 11)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('${dish['confidence']}%',
                    style: const TextStyle(color: AppTheme.emeraldBadge, fontWeight: FontWeight.bold, fontSize: 12)),
                Text(dish['matched'], style: AppTheme.labelSmall.copyWith(fontSize: 10)),
              ],
            ),
          ],
        ),
      );

  // ─── TAB 3: SPONSORED ADS ───────────────────────────────────────
  Widget _buildAdsTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildAdBalanceCard(),
        const SizedBox(height: 16),
        _buildAntiFraudNotice(),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Chiến Dịch (${_campaigns.length})', style: AppTheme.titleMedium.copyWith(fontSize: 14)),
            TextButton.icon(
              onPressed: _showCreateCampaignModal,
              icon: const Icon(Icons.add_circle_outline_rounded, size: 16, color: AppTheme.goldenAmber),
              label: const Text('Tạo Chiến Dịch', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ..._campaigns.map((c) => _buildCampaignItem(c)),
      ],
    );
  }

  void _showCreateCampaignModal() {
    final nameCtrl = TextEditingController(text: 'Đẩy Top Bữa Trưa Phở Bò');
    final budgetCtrl = TextEditingController(text: '500000');
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('🎯 Tạo Chiến Dịch Tài Trợ Mới (M7)', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            TextField(
              controller: nameCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                labelText: 'Tên chiến dịch / Món quảng bá',
                labelStyle: const TextStyle(color: Colors.white54),
                filled: true,
                fillColor: const Color(0xFF27272A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: budgetCtrl,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                labelText: 'Ngân sách (VNĐ)',
                labelStyle: const TextStyle(color: Colors.white54),
                filled: true,
                fillColor: const Color(0xFF27272A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldenAmber, foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: () async {
                  final title = nameCtrl.text.trim();
                  final budget = int.tryParse(budgetCtrl.text.trim()) ?? 500000;
                  if (title.isEmpty) return;
                  Navigator.pop(ctx);
                  final created = await ApiService.createAdCampaign(placeId: 'PLACE-401', dishId: 'DISH-101', budgetVnd: budget);
                  if (!mounted) return;
                  setState(() {
                    _campaigns.insert(0, {
                      'id': (created?['id'] as String?) ?? 'CMP-${DateTime.now().millisecondsSinceEpoch % 1000}',
                      'name': title,
                      'cpc': '3.500đ / click',
                      'clicks': '0 clicks',
                      'total': '${_fmt(budget)}đ',
                      'active': true,
                    });
                  });
                },
                child: const Text('Kích Hoạt Chiến Dịch', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAdBalanceCard() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF2A2A2E)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Số Dư Quảng Cáo (VietQR)', style: AppTheme.labelSmall),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: AppTheme.emeraldBadge.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
                  child: const Text('Đang hoạt động', style: TextStyle(color: AppTheme.emeraldBadge, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text('1.840.000đ', style: AppTheme.titleLarge.copyWith(color: AppTheme.goldenAmber, fontSize: 26)),
            const SizedBox(height: 12),
            Row(
              children: [
                ElevatedButton.icon(
                  onPressed: _showVietQrTopupSheet,
                  icon: const Icon(Icons.qr_code_2_rounded, size: 16),
                  label: const Text('Nạp Thêm Tiền'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.goldenAmber,
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(width: 10),
                OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white70,
                    side: const BorderSide(color: Color(0xFF3F3F46)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Lịch sử nạp'),
                ),
              ],
            ),
          ],
        ),
      );

  Widget _buildAntiFraudNotice() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.emeraldBadge.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.emeraldBadge.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            const Icon(Icons.shield_outlined, color: AppTheme.emeraldBadge, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Bảo vệ chống click tặc tự động (Cửa sổ 60s): Các click lặp lại từ cùng một IP/thiết bị trong 60 giây hoàn toàn không bị tính phí.',
                style: AppTheme.bodyMedium.copyWith(fontSize: 11, color: Colors.white70, height: 1.4),
              ),
            ),
          ],
        ),
      );

  Widget _buildCampaignItem(Map<String, dynamic> c) {
    final bool active = c['active'] == true;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(c['name'] as String, style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 2),
                Text('CPC: ${c['cpc']} · Lượt click: ${c['clicks']} · ${c['total']}',
                    style: AppTheme.labelSmall.copyWith(fontSize: 11)),
              ],
            ),
          ),
          Switch(
            value: active,
            activeColor: AppTheme.emeraldBadge,
            onChanged: (val) async {
              setState(() => c['active'] = val);
              await ApiService.toggleCampaignStatus(c['id'] as String, val ? 'active' : 'paused');
            },
          ),
        ],
      ),
    );
  }

  String _fmt(int n) {
    final s = n.toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    return buf.toString();
  }

  void _openMenuItemModal({Map<String, dynamic>? existing}) {
    final nameCtrl = TextEditingController(text: existing?['name'] as String? ?? '');
    final priceCtrl = TextEditingController(text: '${existing?['price_vnd'] ?? 50000}');
    bool available = existing?['available'] != false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setMState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(existing == null ? '➕ Thêm Món Vào Thực Đơn' : '✏️ Chỉnh Sửa Món',
                  style: const TextStyle(color: AppTheme.goldenAmber, fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              TextField(
                controller: nameCtrl,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  labelText: 'Tên món ăn',
                  labelStyle: const TextStyle(color: Colors.white54),
                  filled: true,
                  fillColor: const Color(0xFF27272A),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: priceCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  labelText: 'Giá bán (VNĐ)',
                  labelStyle: const TextStyle(color: Colors.white54),
                  filled: true,
                  fillColor: const Color(0xFF27272A),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Đang còn món tại quán', style: TextStyle(color: Colors.white, fontSize: 13)),
                value: available,
                activeColor: AppTheme.emeraldBadge,
                onChanged: (v) => setMState(() => available = v),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.goldenAmber, foregroundColor: Colors.black, padding: const EdgeInsets.symmetric(vertical: 14)),
                  onPressed: () async {
                    final n = nameCtrl.text.trim();
                    final p = int.tryParse(priceCtrl.text.trim()) ?? 50000;
                    if (n.isEmpty) return;
                    Navigator.pop(ctx);
                    final saved = await ApiService.upsertMerchantMenuItem(
                      id: existing?['id'] as String?,
                      name: n,
                      priceVnd: p,
                      available: available,
                    );
                    if (!mounted) return;
                    setState(() {
                      if (existing == null) {
                        _manualMenu.insert(0, {
                          'id': (saved?['id'] as String?) ?? 'MENU-${DateTime.now().millisecondsSinceEpoch % 1000}',
                          'name': n,
                          'price_vnd': p,
                          'available': available,
                          'special': false,
                        });
                      } else {
                        existing['name'] = n;
                        existing['price_vnd'] = p;
                        existing['available'] = available;
                      }
                    });
                  },
                  child: Text(existing == null ? 'Thêm Món' : 'Lưu Thay Đổi', style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
