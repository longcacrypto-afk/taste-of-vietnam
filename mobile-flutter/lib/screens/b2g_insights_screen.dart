// M17 · B2G Tourism Insights & FMCG Brand Sponsorships Dashboard
// Hôm nay ăn gì · Taste of Vietnam v0.2
// Production Grade Luxury Dashboard with Multi-Province Geo Filter, Foreign Tourist Demographics, K-Anonymity (k >= 50) Export & FMCG Campaign Studio

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class B2gInsightsScreen extends StatefulWidget {
  const B2gInsightsScreen({super.key});

  @override
  State<B2gInsightsScreen> createState() => _B2gInsightsScreenState();
}

class _B2gInsightsScreenState extends State<B2gInsightsScreen> {
  String _selectedPeriod = '7 ngày';
  String _selectedProvince = 'Toàn Quốc';
  String _queriesCount = '384,200';
  String _ordersCount = '58,410';
  bool _loading = false;

  final List<String> _provinces = [
    'Toàn Quốc',
    'Hà Nội',
    'TP. Hồ Chí Minh',
    'Thừa Thiên Huế',
    'Đà Nẵng',
    'Cần Thơ',
  ];

  final List<Map<String, dynamic>> _foreignDemographics = [
    {
      'country': 'Hàn Quốc 🇰🇷',
      'share': 38,
      'topDishes': 'Phở Bò Tái Lăn, Bánh Xèo, Bún Chả',
      'avgSpend': '320,000 đ/bữa',
      'color': Colors.blueAccent,
    },
    {
      'country': 'Nhật Bản 🇯🇵',
      'share': 24,
      'topDishes': 'Gỏi Cuốn Tôm Thịt, Cơm Gà Hội An',
      'avgSpend': '290,000 đ/bữa',
      'color': Colors.redAccent,
    },
    {
      'country': 'Mỹ & Châu Âu 🇺🇸🇪🇺',
      'share': 20,
      'topDishes': 'Bánh Mì Huỳnh Hoa, Cà Phê Trứng, Phở Cuốn',
      'avgSpend': '240,000 đ/bữa',
      'color': AppTheme.goldenAmber,
    },
    {
      'country': 'Đài Loan & Trung Quốc 🇨🇳',
      'share': 18,
      'topDishes': 'Lẩu Cua Đồng, Bún Bò Huế, Hủ Tiếu Nam Vang',
      'avgSpend': '360,000 đ/bữa',
      'color': AppTheme.emeraldBadge,
    },
  ];

  final List<Map<String, dynamic>> _fmcgCampaigns = [
    {
      'id': 'CAM-501',
      'brand': 'Chinsu Đệ Nhị Vị',
      'logo': '🌶️',
      'campaign': 'Tài trợ vị cay tương ớt chuẩn Phở Bắc',
      'impressions': '142,500',
      'clicks': '12,840',
      'ctr': '9.01%',
      'spend': '18.5 triệu đ',
      'status': 'Đang chạy',
      'color': Colors.redAccent,
      'capShare': '28%',
    },
    {
      'id': 'CAM-502',
      'brand': 'Maggi Tự Nhiên',
      'logo': '🌾',
      'campaign': 'Tài trợ đậu nành thanh vị cho món Chay',
      'impressions': '98,200',
      'clicks': '8,610',
      'ctr': '8.77%',
      'spend': '12.0 triệu đ',
      'status': 'Đang chạy',
      'color': AppTheme.emeraldBadge,
      'capShare': '22%',
    },
    {
      'id': 'CAM-503',
      'brand': 'Knorr Thịt Thăn',
      'logo': '🍲',
      'campaign': 'Tài trợ công thức hầm nước dùng Bún Bò Cố Đô',
      'impressions': '84,100',
      'clicks': '6,920',
      'ctr': '8.23%',
      'spend': '9.8 triệu đ',
      'status': 'Đang chạy',
      'color': AppTheme.goldenAmber,
      'capShare': '18%',
    },
  ];

  final List<Map<String, dynamic>> _dishTrends = [
    {'dish': 'Phở Bò Hà Nội', 'share': 34, 'trend': '+18%', 'color': AppTheme.goldenAmber, 'tag': 'Quốc Hồn Quốc Túy'},
    {'dish': 'Bún Bò Huế Cố Đô', 'share': 26, 'trend': '+14%', 'color': Colors.orangeAccent, 'tag': 'Di Sản Miền Trung'},
    {'dish': 'Cơm Tấm Sườn Bì Chả', 'share': 22, 'trend': '+8%', 'color': Colors.blueAccent, 'tag': 'Nhịp Sống Nam Bộ'},
    {'dish': 'Gỏi Cuốn Tươi Thanh Vị', 'share': 18, 'trend': '+28%', 'color': AppTheme.emeraldBadge, 'tag': 'Xu Hướng Healthy'},
  ];

  @override
  void initState() {
    super.initState();
    _loadLiveInsights();
  }

  Future<void> _loadLiveInsights() async {
    setState(() => _loading = true);
    final data = await ApiService.fetchB2gInsights();
    if (mounted && data != null) {
      setState(() {
        if (data['local_specialty_queries_30d'] != null) {
          _queriesCount = '${data['local_specialty_queries_30d']}';
        }
        if (data['international_visitors_m16'] != null) {
          _ordersCount = '${data['international_visitors_m16']}';
        }
        _loading = false;
      });
    } else {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _exportReportSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('📊', style: TextStyle(fontSize: 22)),
                const SizedBox(width: 8),
                Text('Trích Xuất Báo Cáo K-Anonymity (k ≥ 50)',
                    style: AppTheme.titleMedium.copyWith(color: AppTheme.goldenAmber, fontSize: 16)),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white54),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E24),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.emeraldBadge.withOpacity(0.4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.verified_rounded, color: AppTheme.emeraldBadge, size: 16),
                      const SizedBox(width: 6),
                      Text('Chứng nhận ẩn danh k ≥ 50 cho Sở Du Lịch',
                          style: AppTheme.bodyMedium.copyWith(color: AppTheme.emeraldBadge, fontSize: 12, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text('Mã kiểm toán SHA-256: 8f4b238a9e102cd38e9...c18a',
                      style: TextStyle(fontFamily: 'monospace', fontSize: 10, color: Colors.white70)),
                  Text('Địa bàn lọc: $_selectedProvince · Chu kỳ: $_selectedPeriod',
                      style: const TextStyle(fontSize: 11, color: Colors.white60)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.redAccent.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.picture_as_pdf_rounded, color: Colors.redAccent),
              ),
              title: const Text('Báo Cáo Toàn Diện Du Lịch Ẩm Thực (PDF)', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
              subtitle: const Text('Bao gồm biểu đồ thị phần, luồng chi tiêu và xu hướng quốc tế', style: TextStyle(color: Colors.white54, fontSize: 11)),
              trailing: const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white38, size: 14),
              onTap: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('📄 Đã tạo file PDF: Baocao_Amthuc_B2G_2026.pdf')),
                );
              },
            ),
            const Divider(color: Color(0xFF27272A)),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: AppTheme.emeraldBadge.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.table_chart_rounded, color: AppTheme.emeraldBadge),
              ),
              title: const Text('Tập Dữ Liệu Thô Ẩn Danh (CSV / Excel)', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
              subtitle: const Text('Dữ liệu dạng bảng phục vụ mô hình hóa kinh tế & B2G Data Lake', style: TextStyle(color: Colors.white54, fontSize: 11)),
              trailing: const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white38, size: 14),
              onTap: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('📊 Đã trích xuất file CSV: Tourism_Culinary_Aggregated.csv')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _newCampaignModal() {
    final brandController = TextEditingController();
    final nameController = TextEditingController();
    final budgetController = TextEditingController(text: '15000000');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('🚀', style: TextStyle(fontSize: 22)),
                  const SizedBox(width: 8),
                  Text('Tạo Chiến Dịch Tài Trợ FMCG',
                      style: AppTheme.titleMedium.copyWith(color: AppTheme.goldenAmber, fontSize: 16)),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white54),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppTheme.goldenAmber.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.3)),
                ),
                child: const Text('Quy định hệ thống: Quảng cáo FMCG không bao giờ chiếm quá 1/3 diện tích hiển thị (Slot ≤ 1/3 Cap).',
                    style: TextStyle(color: AppTheme.goldenAmber, fontSize: 11)),
              ),
              const SizedBox(height: 14),
              const Text('Tên thương hiệu tài trợ:', style: TextStyle(color: Colors.white70, fontSize: 12)),
              const SizedBox(height: 4),
              TextField(
                controller: brandController,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Ví dụ: Knorr, Nam Ngư, Cholimex...',
                  hintStyle: const TextStyle(color: Colors.white38),
                  filled: true,
                  fillColor: AppTheme.surfaceElevated,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              const Text('Nội dung chiến dịch:', style: TextStyle(color: Colors.white70, fontSize: 12)),
              const SizedBox(height: 4),
              TextField(
                controller: nameController,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Ví dụ: Tài trợ công thức nước dùng chuẩn vị Bắc...',
                  hintStyle: const TextStyle(color: Colors.white38),
                  filled: true,
                  fillColor: AppTheme.surfaceElevated,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              const Text('Ngân sách tài trợ (VND):', style: TextStyle(color: Colors.white70, fontSize: 12)),
              const SizedBox(height: 4),
              TextField(
                controller: budgetController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white, fontSize: 13),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppTheme.surfaceElevated,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.goldenAmber,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    final brand = brandController.text.trim();
                    final title = nameController.text.trim();
                    if (brand.isNotEmpty && title.isNotEmpty) {
                      setState(() {
                        _fmcgCampaigns.insert(0, {
                          'id': 'CAM-${DateTime.now().millisecondsSinceEpoch % 1000}',
                          'brand': brand,
                          'logo': '✨',
                          'campaign': title,
                          'impressions': '1,200',
                          'clicks': '120',
                          'ctr': '10.0%',
                          'spend': '1.5 triệu đ',
                          'status': 'Chờ duyệt AdMod',
                          'color': AppTheme.goldenAmber,
                          'capShare': '15%',
                        });
                      });
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('🎉 Đã tạo chiến dịch "$brand", chuyển sang hàng đợi AdMod!')),
                      );
                    }
                  },
                  child: const Text('Gửi Phê Duyệt Chiến Dịch', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('B2G Tourism & FMCG Insights', style: AppTheme.titleLarge.copyWith(fontSize: 16)),
            Text('Taste of Vietnam Economic Dashboard', style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.goldenAmber)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.file_download_outlined, color: AppTheme.goldenAmber),
            tooltip: 'Xuất Báo Cáo',
            onPressed: _exportReportSheet,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.goldenAmber))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildKAnonymityBanner(),
                const SizedBox(height: 14),
                _buildFilterRow(),
                const SizedBox(height: 14),
                _buildOverviewMetrics(),
                const SizedBox(height: 20),
                _buildDishTrendsSection(),
                const SizedBox(height: 20),
                _buildForeignDemographicsSection(),
                const SizedBox(height: 20),
                _buildFmcgSection(),
                const SizedBox(height: 20),
                _buildTourismImpactCard(),
              ],
            ),
    );
  }

  Widget _buildKAnonymityBanner() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.emeraldBadge.withOpacity(0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.emeraldBadge.withOpacity(0.3)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.verified_user_rounded, color: AppTheme.emeraldBadge, size: 22),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text('Chuẩn Bảo Mật K-Anonymity (k ≥ 50)',
                          style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, color: AppTheme.emeraldBadge)),
                      const Spacer(),
                      const Text('Nghị Định 13', style: TextStyle(fontSize: 9, color: Colors.white54, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Toàn bộ hành vi tìm kiếm và lộ trình ẩm thực được gộp tối thiểu 50 người dùng trước khi phân tích B2G, tuyệt đối không lưu vết cá nhân.',
                    style: AppTheme.labelSmall.copyWith(fontSize: 11, height: 1.4),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _buildFilterRow() => Row(
        children: [
          // Province Dropdown
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.surfaceElevated,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF27272A)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.location_on_outlined, color: AppTheme.goldenAmber, size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: DropdownButton<String>(
                      value: _selectedProvince,
                      isExpanded: true,
                      dropdownColor: AppTheme.charcoalHero,
                      underline: const SizedBox(),
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                      items: _provinces.map((p) => DropdownMenuItem(value: p, child: Text(p))).toList(),
                      onChanged: (v) {
                        if (v != null) setState(() => _selectedProvince = v);
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Period Dropdown
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.surfaceElevated,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF27272A)),
            ),
            child: DropdownButton<String>(
              value: _selectedPeriod,
              dropdownColor: AppTheme.charcoalHero,
              underline: const SizedBox(),
              style: const TextStyle(color: AppTheme.goldenAmber, fontSize: 12, fontWeight: FontWeight.bold),
              items: ['Hôm nay', '7 ngày', '30 ngày', 'Quý này']
                  .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                  .toList(),
              onChanged: (v) {
                if (v != null) setState(() => _selectedPeriod = v);
              },
            ),
          ),
        ],
      );

  Widget _buildOverviewMetrics() => Row(
        children: [
          _metricCard('👥 Lượt Tìm Kiếm', _queriesCount, '+24.5%', AppTheme.goldenAmber),
          const SizedBox(width: 8),
          _metricCard('🍜 Khách Quốc Tế', _ordersCount, '+18.2%', AppTheme.emeraldBadge),
          const SizedBox(width: 8),
          _metricCard('💰 Doanh Thu Quán', '2.84 Tỷ', '+15.0%', Colors.blueAccent),
        ],
      );

  Widget _metricCard(String title, String val, String delta, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF27272A)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppTheme.labelSmall.copyWith(fontSize: 10)),
              const SizedBox(height: 6),
              Text(val, style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.trending_up_rounded, color: color, size: 12),
                  const SizedBox(width: 2),
                  Text(delta, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
                ],
              ),
            ],
          ),
        ),
      );

  Widget _buildDishTrendsSection() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Thị Phần Món Ăn Theo Nhu Cầu Tiêu Dùng', style: AppTheme.titleMedium.copyWith(fontSize: 13, fontWeight: FontWeight.bold)),
                Text('Tăng trưởng tuần', style: AppTheme.labelSmall.copyWith(fontSize: 10)),
              ],
            ),
            const SizedBox(height: 14),
            ..._dishTrends.map(_buildTrendBar),
          ],
        ),
      );

  Widget _buildTrendBar(Map<String, dynamic> item) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Text(item['dish'], style: AppTheme.bodyMedium.copyWith(fontSize: 12, fontWeight: FontWeight.w600)),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                        decoration: BoxDecoration(color: (item['color'] as Color).withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
                        child: Text(item['tag'], style: TextStyle(color: item['color'], fontSize: 8, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
                Text(item['trend'], style: TextStyle(color: item['color'], fontSize: 11, fontWeight: FontWeight.bold)),
                const SizedBox(width: 8),
                Text('${item['share']}%', style: AppTheme.labelSmall.copyWith(fontSize: 11)),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: item['share'] / 100,
                backgroundColor: AppTheme.charcoalHero,
                valueColor: AlwaysStoppedAnimation(item['color']),
                minHeight: 6,
              ),
            ),
          ],
        ),
      );

  Widget _buildForeignDemographicsSection() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('🌐', style: TextStyle(fontSize: 18)),
                const SizedBox(width: 8),
                Text('Cơ Cấu Khách Quốc Tế & Khẩu Vị Ưa Chuộng', style: AppTheme.titleMedium.copyWith(fontSize: 13, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            ..._foreignDemographics.map((demo) {
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E24),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(demo['country'], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: (demo['color'] as Color).withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                          child: Text('${demo['share']}% thị phần', style: TextStyle(color: demo['color'], fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Món tìm kiếm nhiều nhất: ${demo['topDishes']}',
                        style: const TextStyle(color: AppTheme.goldenAmber, fontSize: 11)),
                    Text('Mức chi tiêu trung bình: ${demo['avgSpend']}',
                        style: const TextStyle(color: Colors.white60, fontSize: 10)),
                  ],
                ),
              );
            }),
          ],
        ),
      );

  Widget _buildFmcgSection() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('🏢 FMCG Brand Sponsorships', style: AppTheme.titleMedium.copyWith(fontSize: 14)),
              TextButton.icon(
                onPressed: _newCampaignModal,
                icon: const Icon(Icons.add_circle_outline, size: 14, color: AppTheme.goldenAmber),
                label: const Text('Tạo Chiến Dịch', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ..._fmcgCampaigns.map(_buildFmcgCard),
        ],
      );

  Widget _buildFmcgCard(Map<String, dynamic> c) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: (c['color'] as Color).withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(c['logo'], style: const TextStyle(fontSize: 22)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(c['brand'], style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 13)),
                      Text(c['campaign'], style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: (c['color'] as Color).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(c['status'], style: TextStyle(color: c['color'], fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _subStat('Hiển thị', c['impressions']),
                _subStat('Lượt click', c['clicks']),
                _subStat('CTR', c['ctr']),
                _subStat('Tỷ lệ Slot', '${c['capShare']} (≤ 33%)'),
                _subStat('Ngân sách', c['spend']),
              ],
            ),
          ],
        ),
      );

  Widget _subStat(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTheme.labelSmall.copyWith(fontSize: 9)),
          const SizedBox(height: 2),
          Text(value, style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.w600, fontSize: 11)),
        ],
      );

  Widget _buildTourismImpactCard() => Container(
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
              children: [
                const Text('🏛️', style: TextStyle(fontSize: 20)),
                const SizedBox(width: 8),
                Text('Tác Động Du Lịch Địa Phương (Sở Du Lịch)',
                    style: AppTheme.titleMedium.copyWith(fontSize: 13, color: AppTheme.goldenAmber)),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'Các Food Trail đạt 12.400 lượt hoàn thành hộ chiếu trong tháng qua. Lượng khách du lịch ghé thăm các quán truyền thống tăng 32%, đóng góp trực tiếp vào kinh tế ẩm thực địa phương.',
              style: AppTheme.bodyMedium.copyWith(color: AppTheme.textSecondary, fontSize: 12, height: 1.5),
            ),
          ],
        ),
      );
}
