// M14 · Cultural Story & Regional Variants Screen
// Hôm nay ăn gì · Taste of Vietnam v0.1

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class CulturalStoryScreen extends StatefulWidget {
  final String? storyId;
  const CulturalStoryScreen({super.key, this.storyId});

  @override
  State<CulturalStoryScreen> createState() => _CulturalStoryScreenState();
}

class _CulturalStoryScreenState extends State<CulturalStoryScreen> {
  int _selectedRegion = 0; // 0: Bắc, 1: Trung, 2: Nam
  bool _isPlayingAudio = false;

  final List<Map<String, dynamic>> _regions = [
    {
      'name': 'Miền Bắc',
      'dish': 'Phở Bò Hà Nội',
      'broth': 'Thanh trong, ninh từ xương bò với gừng nướng, quế, hoa hồi.',
      'noodle': 'Bánh phở dẹp, mềm mướt, trần vừa tới.',
      'herbs': 'Hành hoa, ngò gai, giấm tỏi ớt ngâm. Tuyệt đối không dùng tương đen hay rau húng quế.',
      'quote': '“Ăn phở Bắc là thưởng thức cái tinh tế của nước dùng trong vắt, đậm vị tủy ngọt thanh.”',
    },
    {
      'name': 'Miền Trung',
      'dish': 'Bún Bò Huế',
      'broth': 'Đậm đà cay nồng mùi sả, ớt chưng sa tế và mắm ruốc chuẩn Huế.',
      'noodle': 'Sợi bún to tròn, dai giòn đặc trưng cố đô.',
      'herbs': 'Bắp chuối bào, rau muống chẻ, giá sống, chanh ớt chỉ thiên.',
      'quote': '“Vị cay nồng ấm bụng giữa những ngày mưa xứ Huế, đậm đà khó quên.”',
    },
    {
      'name': 'Miền Nam',
      'dish': 'Phở Nam & Hủ Tiếu',
      'broth': 'Ngọt đậm đà từ xương ống, đường phèn, kèm bò viên giòn sần sật.',
      'noodle': 'Sợi phở dai vừa, ăn kèm đĩa rau sống ngập tràn.',
      'herbs': 'Tương đen ngọt, tương ớt đỏ, ngò gai, húng quế, giá trụng.',
      'quote': '“Hào sảng, phong phú và đầy ắp rau tươi như tính cách người phương Nam.”',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final cur = _regions[_selectedRegion];

    return Scaffold(
      backgroundColor: AppTheme.bgPage,
      body: CustomScrollView(
        slivers: [
          _buildHeroAppBar(),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _buildAudioPlayerCard(),
                const SizedBox(height: 20),
                _buildStoryArticle(),
                const SizedBox(height: 24),
                _buildRegionalVariantsSection(cur),
                const SizedBox(height: 24),
                _buildMascotReflection(),
                const SizedBox(height: 32),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroAppBar() => SliverAppBar(
        expandedHeight: 220,
        pinned: true,
        backgroundColor: AppTheme.charcoalHero,
        leading: GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Container(
            margin: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.black38,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 18),
          ),
        ),
        flexibleSpace: FlexibleSpaceBar(
          title: Text(
            'Chuyện Ẩm Thực',
            style: AppTheme.titleMedium.copyWith(color: Colors.white, fontSize: 16),
          ),
          background: Stack(
            fit: StackFit.expand,
            children: [
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF2E1A0E), Color(0xFF18181B)],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
                child: const Center(
                  child: Text('🍲 📖 🇻🇳', style: TextStyle(fontSize: 48)),
                ),
              ),
              Positioned(
                bottom: 16,
                left: 16,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.goldenAmber,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'Di sản ẩm thực · 4 phút đọc',
                    style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 11),
                  ),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _buildAudioPlayerCard() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            GestureDetector(
              onTap: () {
                setState(() => _isPlayingAudio = !_isPlayingAudio);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(_isPlayingAudio
                        ? '🔊 Đang phát podcast kể chuyện ẩm thực...'
                        : '⏸️ Đã tạm dừng podcast.'),
                    duration: const Duration(seconds: 2),
                  ),
                );
              },
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppTheme.goldenAmber,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _isPlayingAudio ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  color: Colors.black,
                  size: 26,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Nghe Podcast Văn Hóa Bếp Việt',
                      style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(height: 2),
                  Text(_isPlayingAudio ? '01:24 / 04:30 · Giọng đọc Trầm Ấm' : 'Thời lượng: 4 phút 30 giây',
                      style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                ],
              ),
            ),
            const Text('🎧', style: TextStyle(fontSize: 20)),
          ],
        ),
      );

  Widget _buildStoryArticle() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Hành Trình Trăm Năm Của Phở Việt: Từ Gánh Hàng Rong Đến Di Sản Quốc Gia',
            style: AppTheme.titleLarge.copyWith(fontSize: 19, height: 1.3),
          ),
          const SizedBox(height: 12),
          Text(
            'Ra đời vào đầu thế kỷ 20 bên bờ sông Hồng, phở khởi nguồn từ những gánh hàng rong cất tiếng rao sớm khắp phố cổ Hà Nội. Nồi nước dùng luôn bốc khói nghi ngút trên đôi quang gánh tre là hình ảnh thân thương nuôi dưỡng bao thế hệ người Việt.',
            style: AppTheme.bodyMedium.copyWith(color: AppTheme.textSecondary, height: 1.6, fontSize: 14),
          ),
          const SizedBox(height: 10),
          Text(
            'Theo năm tháng di cư vào phương Nam, bát phở dần tiếp nhận thêm hương vị hào sảng của đất phương Nam: nhiều rau thơm, tương đen ngọt, và thịt bắp nạm đậm đà. Mỗi vùng miền một phong vị, nhưng cái hồn tủy bò và sự ấm áp sum vầy vẫn nguyên vẹn.',
            style: AppTheme.bodyMedium.copyWith(color: AppTheme.textSecondary, height: 1.6, fontSize: 14),
          ),
        ],
      );

  Widget _buildRegionalVariantsSection(Map<String, dynamic> cur) => Container(
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
                const Text('🗺️', style: TextStyle(fontSize: 18)),
                const SizedBox(width: 8),
                Text('Bản Đồ Biến Thể 3 Miền',
                    style: AppTheme.titleMedium.copyWith(fontSize: 15, color: AppTheme.goldenAmber)),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: List.generate(3, (i) {
                final isSel = _selectedRegion == i;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedRegion = i),
                    child: Container(
                      margin: EdgeInsets.only(right: i < 2 ? 8 : 0),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: isSel ? AppTheme.goldenAmber : AppTheme.surfaceElevated,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Center(
                        child: Text(
                          _regions[i]['name'],
                          style: TextStyle(
                            color: isSel ? Colors.black : Colors.white70,
                            fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 16),
            Text('Món đại diện: ${cur['dish']}',
                style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, color: AppTheme.emeraldBadge)),
            const SizedBox(height: 8),
            _variantRow('🥣 Nước dùng', cur['broth']),
            _variantRow('🍜 Sợi bánh', cur['noodle']),
            _variantRow('🌿 Rau & Gia vị', cur['herbs']),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.bgPage,
                borderRadius: BorderRadius.circular(10),
                border: Border(left: BorderSide(color: AppTheme.goldenAmber, width: 3)),
              ),
              child: Text(
                cur['quote'],
                style: const TextStyle(fontStyle: FontStyle.italic, color: Colors.white70, fontSize: 12),
              ),
            ),
          ],
        ),
      );

  Widget _variantRow(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 100,
              child: Text(label, style: AppTheme.labelSmall.copyWith(fontSize: 11)),
            ),
            Expanded(
              child: Text(value, style: AppTheme.bodyMedium.copyWith(fontSize: 12, height: 1.4)),
            ),
          ],
        ),
      );

  Widget _buildMascotReflection() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.emeraldBadge.withOpacity(0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.emeraldBadge.withOpacity(0.2)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('🐱 Miu Explorer',
                style: TextStyle(color: AppTheme.emeraldBadge, fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                '“Mỗi lần ghé thăm một vùng đất mới, hãy thử bát nước phở đầu tiên để cảm nhận trọn vẹn văn hóa và con người nơi đó nhé bạn ơi!”',
                style: AppTheme.bodyMedium.copyWith(fontSize: 12, height: 1.4),
              ),
            ),
          ],
        ),
      );
}
