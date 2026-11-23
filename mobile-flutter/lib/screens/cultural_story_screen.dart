// =============================================================================
// M14 · CULTURAL STORY & REGIONAL VARIANTS SCREEN (HERITAGE & ETÝMOLOGY)
// Hôm nay ăn gì · Taste of Vietnam v0.2
// AI Chef Luxury Styling · Multi-dish & 3-Accent Audio Narrator
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'dish_detail_screen.dart';
import 'map_places_screen.dart';

class CulturalStoryScreen extends StatefulWidget {
  final String? storyId;
  const CulturalStoryScreen({super.key, this.storyId});

  @override
  State<CulturalStoryScreen> createState() => _CulturalStoryScreenState();
}

class _CulturalStoryScreenState extends State<CulturalStoryScreen> with SingleTickerProviderStateMixin {
  int _selectedDishIndex = 0;
  int _selectedRegionVariant = 0; // 0: Bắc, 1: Trung, 2: Nam
  bool _isPlayingAudio = false;
  double _audioProgress = 0.35;
  String _selectedVoice = 'Giọng Bắc (Thanh lịch)'; // 'Giọng Bắc', 'Giọng Huế', 'Giọng Nam'

  late AnimationController _waveAnimCtrl;

  final List<Map<String, dynamic>> _heritageDishes = [
    {
      'id': 'STORY-PHO',
      'title': 'Nguồn Gốc & Hồn Cốt Của Phở Việt',
      'dish_name': 'Phở Bò Tái Nạm',
      'emoji': '🍜',
      'era': 'Đầu thế kỷ 20',
      'unesco_status': 'Di sản văn hóa phi vật thể Quốc gia (Đang đệ trình UNESCO)',
      'audio_duration': '4 phút 25 giây',
      'origin_history':
          'Phở ra đời vào đầu thế kỷ 20 tại vùng đồng bằng Bắc Bộ (Nam Định và Hà Nội), là sự giao thoa kỳ diệu giữa món xáo trâu dân gian Việt Nam, kỹ nghệ nấu nước dùng bò của Pháp ("pot-au-feu") và sợi bánh làm từ hạt gạo truyền thống. Mỗi bát phở là sự kết tinh của triết lý ngũ hành: Nước dùng trong vắt thanh ngọt tủy xương (Thủy), hoa hồi quế thảo quả nướng thơm ấm (Hỏa), bánh phở gạo mềm mướt (Thổ), thịt bò tươi mềm (Kim) và hành hoa ngò gai xanh mát (Mộc).',
      'timeline': [
        {'year': '1900 - 1910', 'event': 'Những gánh phở rong đầu tiên xuất hiện tại phố cổ Hà Nội và bến đò Nam Định.'},
        {'year': '1954 - 1975', 'event': 'Phở theo chân đồng bào di cư vào Sài Gòn, đón nhận phong vị miền Nam với rau thơm và tương đen.'},
        {'year': '2000 - Nay', 'event': 'Phở trở thành đại sứ văn hóa ẩm thực Việt Nam trên bản đồ ẩm thực toàn cầu (CNN, Michelin).'}
      ],
      'variants': [
        {
          'region': 'Miền Bắc (Gốc Hà Nội)',
          'broth': 'Thanh trong vắt, ngọt sâu từ tủy xương bò ninh 14 tiếng, thoang thoảng gừng nướng, quế chi và thảo quả.',
          'noodles': 'Bánh phở dẹp bản to vừa, mềm nhưng không nát, trần qua nước sôi giữ độ dai tự nhiên.',
          'herbs': 'Hành hoa tỉa tía, đầu hành chần, ngò gai thái nhỏ. Ăn kèm quẩy giòn và giấm tỏi ớt ngâm chua.',
          'etiquette': 'Tuyệt đối không dùng tương đen ngọt hay giá đỗ sống vì sẽ phá vỡ vị ngọt thanh của nước dùng gốc.'
        },
        {
          'region': 'Miền Trung (Biến tấu)',
          'broth': 'Đậm màu hơn, thoảng nhẹ vị sa tế tỏi ớt và tiêu rừng cay nồng ấm bụng chống cái lạnh miền Trung.',
          'noodles': 'Sợi phở dày dai, thấm đẫm vị nước dùng đậm đà.',
          'herbs': 'Húng quế, chanh ớt chỉ thiên cay xé lưỡi, hành ngâm giấm giòn sần sật.',
          'etiquette': 'Thường ăn kèm ớt chưng tự nấu và tép mỡ thơm giòn rụm.'
        },
        {
          'region': 'Miền Nam (Sài Gòn Hào Sảng)',
          'broth': 'Ngọt đậm đà ninh cùng xương ống và đường phèn, nước béo ngậy kèm bò viên giòn dai sần sật.',
          'noodles': 'Sợi phở mảnh hơn, dai dai như sợi hủ tiếu.',
          'herbs': 'Đĩa rau sống ngập tràn: Ngò ôm, ngò gai, húng quế, giá trụng sơ hoặc giá sống.',
          'etiquette': 'Xịt tương đen (Hoisin) và tương ớt đỏ trực tiếp vào chén chấm hoặc vào tô, vắt chanh nhiều.'
        }
      ],
      'etiquette_guide': [
        'Húp một thìa nước dùng đầu tiên khi chưa nêm gia vị để cảm nhận trọn vẹn vị ngọt tủy tự nhiên.',
        'Ăn phở phải ăn lúc đang bốc khói nghi ngút, vừa thổi vừa ăn để cảm nhận vị ngậy béo thơm lừng.',
        'Bánh phở không nên cắn đứt khúc mà gắp cùng lát thịt bò mềm và nhánh hành hoa đưa trọn vào miệng.'
      ]
    },
    {
      'id': 'STORY-BUNBO',
      'title': 'Bún Bò Xứ Huế — Hương Vị Cung Đình & Thảo Dược',
      'dish_name': 'Bún Bò Huế Cố Đô',
      'emoji': '🍲',
      'era': 'Thời Chúa Nguyễn (Thế kỷ 16)',
      'unesco_status': 'Top 50 món súp ngon nhất thế giới',
      'audio_duration': '3 phút 50 giây',
      'origin_history':
          'Tương truyền món bún bò xuất phát từ làng Vân Cù (Hương Trà, Thừa Thiên Huế) dưới thời chúa Nguyễn Hoàng. Người phụ nữ tài hoa tên Cô Bún đã kết hợp sợi bún gạo vắt tay to tròn với nước hầm xương bò, tạo nên món tiến vua trứ danh. Điểm linh hồn của bún bò xứ Huế nằm ở mắm ruốc chưng cùng củ sả đập dập và ớt đỏ — tạo nên sự cân bằng kỳ diệu giữa vị béo ngậy của thịt bắp giò heo và vị cay nồng thấu gan ruột.',
      'timeline': [
        {'year': 'Thế kỷ 16', 'event': 'Bà chúa nghề bún làng Vân Cù sáng tạo ra phương pháp quết bún sợi to nấu bún bò tiến cung.'},
        {'year': 'Thế kỷ 19', 'event': 'Định hình công thức hoàn chỉnh: Nước hầm xương bò, ruốc Huế khử tanh, sả tươi và ớt chưng sa tế.'},
        {'year': 'Hiện đại', 'event': 'Lan tỏa khắp ba miền, được đầu bếp huyền thoại Anthony Bourdain ca ngợi là món súp ngon nhất thế giới.'}
      ],
      'variants': [
        {
          'region': 'Xứ Huế Cổ Đô',
          'broth': 'Nước dùng trong nhưng ánh đỏ sa tế, thơm nồng mùi sả cây, đậm mùi ruốc ngấu thanh tao không tanh.',
          'noodles': 'Sợi bún to tròn đặc trưng, trần vừa tới giữ độ dai nảy.',
          'herbs': 'Bắp chuối sứ bào mỏng tanh, rau muống chẻ tăm, giá sống, hành ngâm giấm.',
          'etiquette': 'Ăn cùng ớt chưng cay nồng xé lưỡi, một lát chanh tươi và đĩa chả cua quết mịn màng.'
        },
        {
          'region': 'Biến tấu Sài Gòn',
          'broth': 'Hầm nhiều xương ống và thịt giò, nước dùng béo ngọt đường phèn hơn, bớt mùi ruốc để hợp vị đại chúng.',
          'noodles': 'Sợi bún to vừa, đầy đặn bắp bò hoa, chả lụa và tiết luộc mềm mướt.',
          'herbs': 'Giá trụng chín, rau thơm, bắp chuối, rau thơm các loại.',
          'etiquette': 'Khách thoải mái xin thêm chén mỡ nổi, nước béo hành trần thơm lừng.'
        },
        {
          'region': 'Biến thể Hà Nội',
          'broth': 'Nước dùng giảm vị ngọt, nhấn mạnh độ thanh xương bò và hương sả thơm, lượng ớt gia giảm vừa phải.',
          'noodles': 'Sợi bún tròn to vừa, ăn kèm quẩy giòn và giấm tỏi ớt.',
          'herbs': 'Hành tây thái lát mỏng ngâm đá giòn ngọt, rau ngò, húng quế.',
          'etiquette': 'Thường ăn kèm móng giò rút xương hoặc giò nạc thơm bùi.'
        }
      ],
      'etiquette_guide': [
        'Vắt chanh và thêm ớt sa tế tự làm trước khi nếm ngụm nước dùng sả cay bốc khói.',
        'Nhúng ngập bắp chuối bào vào đáy tô nước dùng nóng hổi để bắp chuối chín tái giòn ngọt.',
        'Thưởng thức từng miếng chả cua quết thơm mùi tiêu hột giòn ngọt đậm đà.'
      ]
    },
    {
      'id': 'STORY-COMTAM',
      'title': 'Cơm Tấm Sài Gòn — Từ Hạt Gạo Nghèo Đến Biểu Tượng Nam Bộ',
      'dish_name': 'Cơm Tấm Sườn Bì Chả',
      'emoji': '🍚',
      'era': 'Thập niên 1920',
      'unesco_status': 'Kỷ lục Ẩm thực Châu Á (2012)',
      'audio_duration': '3 phút 15 giây',
      'origin_history':
          'Cơm tấm thuở ban đầu là món ăn cứu đói của người lao động nghèo đất Nam Kỳ. Những hạt gạo vỡ (tấm) trong quá trình xay xát không thể bán được giá cao đã được người dân nấu thành cơm ăn dè. Dần dà, qua sự sáng tạo tài hoa của những người phụ nữ Sài Gòn, đĩa cơm tấm được nâng tầm với sườn nướng than hoa thơm lừng mỡ hành, sợi bì giòn trộn thính gạo, chả trứng hấp béo ngậy và bát nước mắm chua ngọt sánh dẻo như mật.',
      'timeline': [
        {'year': '1930s', 'event': 'Cơm tấm gánh rong phục vụ công nhân bến cảng Ba Son và phu xe Chợ Lớn.'},
        {'year': '1960s', 'event': 'Sự du nhập của dao dĩa phương Tây: Đĩa cơm tấm tròn ăn bằng muỗng nĩa ra đời.'},
        {'year': '2012', 'event': 'Tổ chức Kỷ lục Châu Á chính thức vinh danh Cơm tấm Sài Gòn là Giá trị Ẩm thực Châu Á.'}
      ],
      'variants': [
        {
          'region': 'Sài Gòn Truyền Thống',
          'broth': 'Ăn kèm chén canh khổ qua dồn thịt thanh mát giải nhiệt sau đĩa cơm tấm đậm đà.',
          'noodles': 'Hạt tấm khô ráo tơi xốp, ngọt thơm mùi lúa mới.',
          'herbs': 'Đồ chua củ cải trắng và cà rốt ngâm giấm đường, dưa leo thái lát, cà chua.',
          'etiquette': 'Rưới muỗng nước mắm ớt sánh dẻo kẹo lên khắp bề mặt sườn và cơm rồi xúc trọn từng muỗng.'
        },
        {
          'region': 'Long Xuyên (An Giang)',
          'broth': 'Canh cải ngồng hoặc canh súp xương ngọt thanh tao.',
          'noodles': 'Hạt tấm nhỏ mịn như hạt cát, nấu mềm dẻo đặc trưng miền Tây.',
          'herbs': 'Thịt sườn khìa xắt sợi nhỏ tăm tắp thay vì để nguyên cây sườn nướng lớn.',
          'etiquette': 'Trứng vịt kho lòng đào dầm nát béo ngậy hòa quyện cùng nước mắm kẹo miền Tây.'
        },
        {
          'region': 'Phan Thiết & Miền Trung',
          'broth': 'Canh nghêu nấu thì là hoặc canh súp bò.',
          'noodles': 'Cơm tấm dẻo hạt vừa, sườn ướp mật ong đậm vị mặn ngọt.',
          'herbs': 'Thêm chả cá hấp hoặc chả cá chiên đặc sản miền biển.',
          'etiquette': 'Nước mắm kẹo đậm đà với ớt hiểm xay nhuyễn đỏ au cay xè.'
        }
      ],
      'etiquette_guide': [
        'Dùng nĩa giữ miếng sườn và dùng muỗng xắn miếng thịt mềm ngập khói than hoa.',
        'Trộn đều mỡ hành thơm ngậy cùng tóp mỡ giòn rụm vào từng hạt cơm tấm tơi xốp.',
        'Xắn một góc chả trứng thịt mộc nhĩ hấp kèm miếng dưa leo giòn rụm chấm ngập nước mắm tỏi ớt.'
      ]
    }
  ];

  @override
  void initState() {
    super.initState();
    _waveAnimCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _waveAnimCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final curDish = _heritageDishes[_selectedDishIndex];
    final curVariant = (curDish['variants'] as List<Map<String, dynamic>>)[_selectedRegionVariant];

    return Scaffold(
      backgroundColor: AppTheme.bgPage,
      body: CustomScrollView(
        slivers: [
          _buildHeroSliverAppBar(curDish),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _buildDishSelectorTabs(),
                const SizedBox(height: 16),
                _buildInteractiveAudioPodcastCard(curDish),
                const SizedBox(height: 20),
                _buildOriginStoryArticle(curDish),
                const SizedBox(height: 24),
                _buildChronicleTimeline(curDish),
                const SizedBox(height: 28),
                _buildRegionalVariantMatrix(curDish, curVariant),
                const SizedBox(height: 24),
                _buildEtiquetteGoldenRules(curDish),
                const SizedBox(height: 28),
                _buildExploreActionHub(curDish),
                const SizedBox(height: 36),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroSliverAppBar(Map<String, dynamic> dish) => SliverAppBar(
        expandedHeight: 240,
        pinned: true,
        backgroundColor: AppTheme.charcoalHero,
        leading: GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Container(
            margin: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.black45,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white24),
            ),
            child: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 18),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_rounded, color: Colors.white),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('🔗 Đã sao chép liên kết câu chuyện di sản "${dish['title']}"!'),
                  backgroundColor: AppTheme.emeraldBadge,
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.bookmark_border_rounded, color: AppTheme.goldenAmber),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('⭐ Đã lưu câu chuyện vào Bộ Sưu Tập Văn Hóa Ẩm Thực của bạn!'),
                  backgroundColor: AppTheme.goldenAmber,
                ),
              );
            },
          ),
        ],
        flexibleSpace: FlexibleSpaceBar(
          title: Text(
            dish['dish_name'],
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 16,
              shadows: [Shadow(color: Colors.black89, blurRadius: 8)],
            ),
          ),
          background: Stack(
            fit: StackFit.expand,
            children: [
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF3B1E08), Color(0xFF1E1B18), Color(0xFF18181B)],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(dish['emoji'], style: const TextStyle(fontSize: 60)),
                      const SizedBox(height: 6),
                      Text(
                        dish['era'],
                        style: TextStyle(color: AppTheme.goldenAmber, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
              Positioned(
                bottom: 12,
                left: 16,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.goldenAmber,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.verified_rounded, color: Colors.black, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        dish['unesco_status'],
                        style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w800, fontSize: 10),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _buildDishSelectorTabs() => SizedBox(
        height: 44,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: _heritageDishes.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (context, idx) {
            final d = _heritageDishes[idx];
            final active = idx == _selectedDishIndex;
            return GestureDetector(
              onTap: () {
                setState(() {
                  _selectedDishIndex = idx;
                  _selectedRegionVariant = 0;
                  _isPlayingAudio = false;
                });
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: active ? AppTheme.goldenAmber : AppTheme.surfaceElevated,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: active ? AppTheme.goldenAmber : Colors.white12,
                  ),
                ),
                child: Row(
                  children: [
                    Text(d['emoji'], style: const TextStyle(fontSize: 16)),
                    const SizedBox(width: 6),
                    Text(
                      d['dish_name'],
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: active ? FontWeight.w800 : FontWeight.w500,
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

  Widget _buildInteractiveAudioPodcastCard(Map<String, dynamic> dish) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.35)),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 4)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                GestureDetector(
                  onTap: () {
                    setState(() => _isPlayingAudio = !_isPlayingAudio);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(_isPlayingAudio
                            ? '🔊 Đang phát: ${dish['title']} ($_selectedVoice)...'
                            : '⏸️ Đã tạm dừng phát thanh di sản.'),
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  },
                  child: Container(
                    width: 50,
                    height: 50,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: _isPlayingAudio
                            ? [AppTheme.emeraldBadge, const Color(0xFF10B981)]
                            : [AppTheme.goldenAmber, const Color(0xFFD97706)],
                      ),
                    ),
                    child: Icon(
                      _isPlayingAudio ? Icons.pause_rounded : Icons.play_arrow_rounded,
                      color: Colors.black,
                      size: 28,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppTheme.goldenAmber.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text('PODCAST DI SẢN',
                                style: TextStyle(
                                    color: AppTheme.goldenAmber, fontSize: 9, fontWeight: FontWeight.w800)),
                          ),
                          const Spacer(),
                          Text(dish['audio_duration'],
                              style: const TextStyle(color: AppTheme.slateMuted, fontSize: 11)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        dish['title'],
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Sound Waveform Animation Bar
            Row(
              children: [
                Text(
                  _isPlayingAudio ? '01:34' : '00:00',
                  style: const TextStyle(fontSize: 10, color: AppTheme.slateMuted),
                ),
                Expanded(
                  child: Slider(
                    value: _audioProgress,
                    onChanged: (v) => setState(() => _audioProgress = v),
                    activeColor: AppTheme.goldenAmber,
                    inactiveColor: Colors.white12,
                  ),
                ),
                Text(
                  dish['audio_duration'].toString().split(' ')[0] + ':00',
                  style: const TextStyle(fontSize: 10, color: AppTheme.slateMuted),
                ),
              ],
            ),

            // Voice Selector Chips
            Row(
              children: [
                const Text('Giọng đọc: ', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                const SizedBox(width: 6),
                ...['Giọng Bắc (Thanh lịch)', 'Giọng Huế (Trầm ấm)', 'Giọng Nam (Hào sảng)'].map((voice) {
                  final active = _selectedVoice == voice;
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedVoice = voice),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: active ? AppTheme.goldenAmber.withOpacity(0.25) : Colors.transparent,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: active ? AppTheme.goldenAmber : Colors.white24,
                          ),
                        ),
                        child: Text(
                          voice.split(' ')[0] + ' ' + voice.split(' ')[1],
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: active ? FontWeight.bold : FontWeight.normal,
                            color: active ? AppTheme.goldenAmber : AppTheme.slateMuted,
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          ],
        ),
      );

  Widget _buildOriginStoryArticle(Map<String, dynamic> dish) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.menu_book_rounded, color: AppTheme.goldenAmber, size: 20),
                const SizedBox(width: 8),
                Text('Cội Nguồn & Triết Lý Ẩm Thực',
                    style: AppTheme.titleMedium.copyWith(color: Colors.white, fontSize: 15)),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              dish['origin_history'],
              style: const TextStyle(
                fontSize: 13,
                height: 1.65,
                color: Color(0xFFE2E8F0),
              ),
            ),
          ],
        ),
      );

  Widget _buildChronicleTimeline(Map<String, dynamic> dish) {
    final timeline = dish['timeline'] as List<Map<String, dynamic>>;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.history_edu_rounded, color: AppTheme.goldenAmber, size: 20),
            const SizedBox(width: 8),
            Text('Dòng Chảy Lịch Sử Qua Các Thời Kỳ',
                style: AppTheme.titleMedium.copyWith(color: Colors.white, fontSize: 15)),
          ],
        ),
        const SizedBox(height: 14),
        ...timeline.map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.goldenAmber.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.4)),
                    ),
                    child: Text(
                      item['year'],
                      style: const TextStyle(
                          color: AppTheme.goldenAmber, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      item['event'],
                      style: const TextStyle(fontSize: 12, height: 1.45, color: Colors.white70),
                    ),
                  ),
                ],
              ),
            )),
      ],
    );
  }

  Widget _buildRegionalVariantMatrix(Map<String, dynamic> dish, Map<String, dynamic> variant) {
    final variants = dish['variants'] as List<Map<String, dynamic>>;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.compare_arrows_rounded, color: AppTheme.goldenAmber, size: 20),
              const SizedBox(width: 8),
              Text('Bản Đồ Biến Thể 3 Miền Bắc · Trung · Nam',
                  style: AppTheme.titleMedium.copyWith(color: Colors.white, fontSize: 15)),
            ],
          ),
          const SizedBox(height: 14),

          // Region Switcher Tabs
          Row(
            children: List.generate(variants.length, (i) {
              final active = i == _selectedRegionVariant;
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _selectedRegionVariant = i),
                  child: Container(
                    margin: EdgeInsets.only(right: i < variants.length - 1 ? 6 : 0),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: active ? AppTheme.goldenAmber : Colors.white.withOpacity(0.06),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text(
                        variants[i]['region'].toString().split(' ')[0] + ' ' + variants[i]['region'].toString().split(' ')[1],
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: active ? FontWeight.w800 : FontWeight.w500,
                          color: active ? Colors.black : Colors.white70,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 18),

          _buildVariantAttribute('Nước dùng / Nước lèo', variant['broth'], Icons.soup_kitchen_rounded),
          _buildVariantAttribute('Sợi bánh / Bún', variant['noodles'], Icons.dining_rounded),
          _buildVariantAttribute('Rau thơm & Gia vị', variant['herbs'], Icons.eco_rounded),
          _buildVariantAttribute('Nghệ thuật thưởng thức', variant['etiquette'], Icons.lightbulb_rounded, isHighlight: true),
        ],
      ),
    );
  }

  Widget _buildVariantAttribute(String label, String value, IconData icon, {bool isHighlight = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: isHighlight ? AppTheme.emeraldBadge : AppTheme.goldenAmber),
            const SizedBox(width: 10),
            Expanded(
              child: RichText(
                text: TextSpan(
                  children: [
                    TextSpan(
                      text: '$label: ',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: isHighlight ? AppTheme.emeraldBadge : AppTheme.goldenAmber,
                      ),
                    ),
                    TextSpan(
                      text: value,
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.45,
                        color: isHighlight ? Colors.white : Colors.white70,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );

  Widget _buildEtiquetteGoldenRules(Map<String, dynamic> dish) {
    final rules = dish['etiquette_guide'] as List<String>;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B).withOpacity(0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.blueAccent.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: Colors.amberAccent, size: 18),
              SizedBox(width: 8),
              Text('3 Quy Tắc Thưởng Thức Chuẩn Sành Điệu',
                  style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 10),
          ...rules.asMap().entries.map((entry) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${entry.key + 1}. ',
                        style: const TextStyle(
                            color: Colors.amberAccent, fontWeight: FontWeight.bold, fontSize: 12)),
                    Expanded(
                      child: Text(
                        entry.value,
                        style: const TextStyle(fontSize: 12, color: Colors.white70, height: 1.4),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildExploreActionHub(Map<String, dynamic> dish) => Row(
        children: [
          Expanded(
            child: ElevatedButton.icon(
              icon: const Icon(Icons.storefront_rounded, size: 18),
              label: const Text('Tìm quán chuẩn vị quanh đây', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.goldenAmber,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const MapPlacesScreen()),
                );
              },
            ),
          ),
          const SizedBox(width: 10),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.surfaceElevated,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: const BorderSide(color: Colors.white24),
              ),
            ),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const DishDetailScreen(dishId: 'DISH-101')),
              );
            },
            child: const Row(
              children: [
                Icon(Icons.menu_book_rounded, size: 16, color: AppTheme.goldenAmber),
                SizedBox(width: 6),
                Text('Công thức', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      );
}
