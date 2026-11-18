// M17 · B2G Tourism Insights & FMCG Brand Sponsorships Dashboard
// Hôm nay ăn gì · Taste of Vietnam v0.1

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
  String _queriesCount = '384,200';
  String _ordersCount = '58,410';
  bool _loading = false;

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

  final List<Map<String, dynamic>> _fmcgCampaigns = [
    {
      'brand': 'Chinsu Đệ Nhị Vị',
      'logo': '🌶️',
      'campaign': 'Tài trợ vị cay tương ớt chuẩn Phở Bắc',
      'impressions': '142,500',
      'clicks': '12,840',
      'ctr': '9.01%',
      'spend': '18.5 triệu đ',
      'status': 'Đang chạy',
      'color': Colors.redAccent,
    },
    {
      'brand': 'Maggi Tự Nhiên',
      'logo': '🌾',
      'campaign': 'Tài trợ đậu nành thanh vị cho món Chay',
      'impressions': '98,200',
      'clicks': '8,610',
      'ctr': '8.77%',
      'spend': '12.0 triệu đ',
      'status': 'Đang chạy',
      'color': AppTheme.emeraldBadge,
    },
    {
      'brand': 'Knorr Thịt Thăn',
      'logo': '🍲',
      'campaign': 'Tài trợ công thức hầm nước dùng Bún Bò',
      'impressions': '84,100',
      'clicks': '6,920',
      'ctr': '8.23%',
      'spend': '9.8 triệu đ',
      'status': 'Đang chạy',
      'color': AppTheme.goldenAmber,
    },
  ];

  final List<Map<String, dynamic>> _dishTrends = [
    {'dish': 'Phở Bò Hà Nội', 'share': 34, 'trend': '+18%', 'color': AppTheme.goldenAmber},
    {'dish': 'Bún Bò Huế', 'share': 26, 'trend': '+12%', 'color': Colors.orangeAccent},
    {'dish': 'Cơm Tấm Sườn Bì', 'share': 22, 'trend': '+5%', 'color': Colors.blueAccent},
    {'dish': 'Gỏi Cuốn Chay', 'share': 18, 'trend': '+28%', 'color': AppTheme.emeraldBadge},
  ];

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
        title: Text('B2G Tourism Insights', style: AppTheme.titleLarge),
        actions: [
          IconButton(
            icon: Icon(Icons.file_download_outlined, color: AppTheme.goldenAmber),
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('📊 Đã trích xuất báo cáo dữ liệu định dạng PDF/CSV')),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildKAnonymityBanner(),
          const SizedBox(height: 16),
          _buildPeriodSelector(),
          const SizedBox(height: 16),
          _buildOverviewMetrics(),
          const SizedBox(height: 20),
          _buildDishTrendsSection(),
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
                  Text('Chuẩn Bảo Mật K-Anonymity (k ≥ 50)',
                      style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, color: AppTheme.emeraldBadge)),
                  const SizedBox(height: 2),
                  Text(
                    'Toàn bộ dữ liệu tiêu dùng được gộp ẩn danh theo nhóm tối thiểu 50 người, tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.',
                    style: AppTheme.labelSmall.copyWith(fontSize: 11, height: 1.4),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _buildPeriodSelector() => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('Thống kê tiêu dùng', style: AppTheme.titleMedium.copyWith(fontSize: 15)),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.surfaceElevated,
              borderRadius: BorderRadius.circular(8),
            ),
            child: DropdownButton<String>(
              value: _selectedPeriod,
              dropdownColor: AppTheme.charcoalHero,
              underline: const SizedBox(),
              isDense: true,
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
          const SizedBox(width: 10),
          _metricCard('🍜 Khách Quốc Tế', _ordersCount, '+18.2%', AppTheme.emeraldBadge),
          const SizedBox(width: 10),
          _metricCard('💰 Doanh Thu Quán', '2.84 Tỷ', '+15.0%', Colors.blueAccent),
        ],
      );

  Widget _metricCard(String title, String val, String delta, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppTheme.labelSmall.copyWith(fontSize: 10)),
              const SizedBox(height: 6),
              Text(val, style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 4),
              Text(delta, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
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
                Text('Thị Phần Món Việt Phổ Biến', style: AppTheme.titleMedium.copyWith(fontSize: 14)),
                Text('Tăng trưởng so tuần trước', style: AppTheme.labelSmall.copyWith(fontSize: 10)),
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
                  child: Text(item['dish'], style: AppTheme.bodyMedium.copyWith(fontSize: 12, fontWeight: FontWeight.w600)),
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

  Widget _buildFmcgSection() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('🏢 FMCG Brand Sponsorships', style: AppTheme.titleMedium.copyWith(fontSize: 15)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.goldenAmber.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('Slot ≤ 1/3 Cap', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ..._fmcgCampaigns.map(_buildFmcgCard),
        ],
      );

  Widget _buildFmcgCard(Map<String, dynamic> c) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(14),
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
                    color: c['color'].withOpacity(0.15),
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
                _subStat('Ngân sách', c['spend']),
              ],
            ),
          ],
        ),
      );

  Widget _subStat(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTheme.labelSmall.copyWith(fontSize: 10)),
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
