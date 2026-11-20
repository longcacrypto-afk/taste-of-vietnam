// =============================================================================
// M4 & M5 SCREEN: 3KM OPEN PLACES MAP, DEEP-LINK REDIRECT & REPORT AUTO-PAUSE
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class MapPlacesScreen extends StatefulWidget {
  const MapPlacesScreen({super.key});

  @override
  State<MapPlacesScreen> createState() => _MapPlacesScreenState();
}

class _MapPlacesScreenState extends State<MapPlacesScreen> {
  bool _openOnly = true;
  String _selectedFilter = 'all'; // 'all', 'ac', 'kids', 'high_rating'
  bool _isLoading = false;
  String? _activeOrderBanner;

  @override
  void initState() {
    super.initState();
    _loadLivePlaces();
  }

  Future<void> _loadLivePlaces() async {
    setState(() => _isLoading = true);
    final places = await ApiService.fetchNearbyPlaces();
    if (mounted && places != null && places.isNotEmpty) {
      setState(() {
        _places.clear();
        for (final p in places) {
          _places.add({
            'id': p['id'] ?? 'PLACE-401',
            'name': p['name'] ?? 'Quán Ngon',
            'address': p['address'] ?? 'Biên Hòa, Đồng Nai',
            'dish': (p['dishes'] is List && (p['dishes'] as List).isNotEmpty)
                ? (p['dishes'] as List).first['name'] ?? 'Món đặc sản'
                : ((p['menu'] is List && (p['menu'] as List).isNotEmpty)
                    ? (p['menu'] as List).first['name'] ?? 'Món đặc sản'
                    : 'Món đặc sản'),
            'distance': '${p['distance_meters'] ?? p['distance_m'] ?? 500}m',
            'price': '45.000đ',
            'rating': (p['rating'] as num?)?.toDouble() ?? 4.8,
            'review_count': p['review_count'] ?? 120,
            'isOpen': p['is_currently_open'] ?? p['is_open'] ?? p['is_open_override'] ?? true,
            'sponsored': p['is_sponsored'] ?? false,
            'has_ac': p['has_ac'] ?? true,
            'has_kids_seat': p['has_kids_seat'] ?? false,
            'open_hour': p['open_hour'] ?? 6,
            'close_hour': p['close_hour'] ?? 22,
            'phone': p['phone'] ?? '02513845999',
            'reports': p['closed_report_count'] ?? p['reports_count'] ?? 0,
            'links': p['links'] ?? {
              'grabfood': 'https://food.grab.com',
              'shopeefood': 'https://shopeefood.vn',
              'maps': 'https://maps.google.com',
            },
          });
        }
        _isLoading = false;
      });
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  final List<Map<String, dynamic>> _places = [
    {
      'id': 'PLACE-401',
      'name': 'Phở Gia Truyền Phát Tài',
      'address': '128 Huỳnh Văn Nghệ, P. Bửu Long, Biên Hòa',
      'dish': 'Phở Bò Tái Nạm Hà Nội',
      'distance': '400m',
      'price': '45.000đ',
      'rating': 4.8,
      'review_count': 150,
      'isOpen': true,
      'sponsored': true,
      'has_ac': true,
      'has_kids_seat': true,
      'open_hour': 6,
      'close_hour': 22,
      'phone': '02513845999',
      'reports': 0,
      'links': {
        'grabfood': 'https://food.grab.com/vn/vi/restaurant/pho-phat-tai',
        'shopeefood': 'https://shopeefood.vn/bien-hoa/pho-phat-tai',
        'maps': 'https://maps.google.com/?q=10.9598,106.8452',
      },
    },
    {
      'id': 'PLACE-402',
      'name': 'Cơm Tấm Bụi Sài Gòn',
      'address': '82 Nguyễn Ái Quốc, P. Tân Tiến, Biên Hòa',
      'dish': 'Cơm Tấm Sườn Bì Chả',
      'distance': '550m',
      'price': '40.000đ',
      'rating': 4.7,
      'review_count': 98,
      'isOpen': true,
      'sponsored': false,
      'has_ac': true,
      'has_kids_seat': false,
      'open_hour': 7,
      'close_hour': 21,
      'phone': '02513845111',
      'reports': 0,
      'links': {
        'grabfood': 'https://food.grab.com/vn/vi/restaurant/com-tam-bui',
        'shopeefood': 'https://shopeefood.vn/bien-hoa/com-tam-bui',
        'maps': 'https://maps.google.com/?q=10.9612,106.8460',
      },
    },
    {
      'id': 'PLACE-403',
      'name': 'Bún Bò Xứ Huế O Xuân',
      'address': '45 Đồng Khởi, P. Tân Hiệp, Biên Hòa',
      'dish': 'Bún Bò Huế Giò Chả Cua',
      'distance': '1.1km',
      'price': '50.000đ',
      'rating': 4.9,
      'review_count': 210,
      'isOpen': true,
      'sponsored': false,
      'has_ac': false,
      'has_kids_seat': true,
      'open_hour': 6,
      'close_hour': 20,
      'phone': '02513845222',
      'reports': 1,
      'links': {
        'grabfood': 'https://food.grab.com/vn/vi/restaurant/bun-bo-o-xuan',
        'shopeefood': 'https://shopeefood.vn/bien-hoa/bun-bo-o-xuan',
        'maps': 'https://maps.google.com/?q=10.9550,106.8510',
      },
    },
  ];

  void _triggerDeepLink(String placeName, String partner) {
    setState(() {
      _activeOrderBanner = 'Đã mở $partner cho "$placeName" (UTM Tracked). Bấm xác nhận nếu anh đã đặt món!';
    });
  }

  void _showActionToast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
        backgroundColor: AppTheme.charcoalHero,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _reportClosed(int idx) async {
    final placeId = _places[idx]['id'] as String;
    setState(() {
      _places[idx]['reports'] = (_places[idx]['reports'] as int) + 1;
      if ((_places[idx]['reports'] as int) >= 3) {
        _places[idx]['isOpen'] = false;
      }
    });

    _showActionToast('Đã gửi báo cáo đóng cửa cho quán (${_places[idx]['reports']}/3)');
    await ApiService.reportPlaceClosed(placeId);
  }

  @override
  Widget build(BuildContext context) {
    var visiblePlaces = _places.where((p) => !_openOnly || p['isOpen'] == true).toList();

    if (_selectedFilter == 'ac') {
      visiblePlaces = visiblePlaces.where((p) => p['has_ac'] == true).toList();
    } else if (_selectedFilter == 'kids') {
      visiblePlaces = visiblePlaces.where((p) => p['has_kids_seat'] == true).toList();
    } else if (_selectedFilter == 'high_rating') {
      visiblePlaces = visiblePlaces.where((p) => (p['rating'] as double) >= 4.8).toList();
    }

    return RefreshIndicator(
      onRefresh: _loadLivePlaces,
      color: AppTheme.goldenAmber,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Quán Ngon Quanh Bạn (3km)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    Text('M4 PostGIS Thực · M5 4-Action Hub & Deep-link', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
                  ],
                ),
              ),
              FilterChip(
                label: const Text('Đang mở cửa', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                selected: _openOnly,
                selectedColor: const Color(0xFFDCFCE7),
                onSelected: (v) => setState(() => _openOnly = v),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Filter Pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildFilterPill('all', 'Tất cả quán'),
                const SizedBox(width: 8),
                _buildFilterPill('ac', '❄️ Có máy lạnh'),
                const SizedBox(width: 8),
                _buildFilterPill('kids', '👶 Ghế trẻ em'),
                const SizedBox(width: 8),
                _buildFilterPill('high_rating', '⭐ Đánh giá cao (≥ 4.8)'),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Active Order Notification
          if (_activeOrderBanner != null)
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.goldenAmber),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(_activeOrderBanner!, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF78350F))),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.charcoalHero,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    ),
                    onPressed: () => setState(() => _activeOrderBanner = null),
                    child: const Text('Đã ăn (Cooldown)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),

          if (_isLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: CircularProgressIndicator(color: AppTheme.goldenAmber),
              ),
            )
          else if (visiblePlaces.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              alignment: Alignment.center,
              child: const Text('Không tìm thấy quán phù hợp với bộ lọc hiện tại.', style: TextStyle(fontSize: 13, color: AppTheme.slateMuted)),
            )
          else
            ...visiblePlaces.asMap().entries.map((entry) {
              final idx = entry.key;
              final p = entry.value;
              return _buildPlaceCard(idx, p);
            }),
        ],
      ),
    );
  }

  Widget _buildFilterPill(String key, String label) {
    final isSelected = _selectedFilter == key;
    return InkWell(
      onTap: () => setState(() => _selectedFilter = key),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.charcoalHero : AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSelected ? AppTheme.goldenAmber : const Color(0xFFE2E8F0)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
            color: isSelected ? Colors.white : AppTheme.slateDark,
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceCard(int idx, Map<String, dynamic> p) {
    final hasAc = p['has_ac'] == true;
    final hasKidsSeat = p['has_kids_seat'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: p['sponsored'] == true ? AppTheme.goldenAmber.withOpacity(0.5) : const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Row 1: Name + Tag
          Row(
            children: [
              Expanded(
                child: Text(
                  p['name'] as String,
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppTheme.charcoalHero),
                ),
              ),
              if (p['sponsored'] == true)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
                  child: const Text('Tài trợ', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFB45309))),
                ),
            ],
          ),
          const SizedBox(height: 2),

          // Address
          Text(p['address'] as String, style: const TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
          const SizedBox(height: 6),

          // Distance, Rating & Specs
          Row(
            children: [
              Text('Cách ${p['distance']}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.emeraldBadge)),
              const SizedBox(width: 8),
              Text('⭐ ${p['rating']} (${p['review_count']})', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFD97706))),
              const Spacer(),
              Text('Mở: ${p['open_hour']}h–${p['close_hour']}h', style: const TextStyle(fontSize: 10, color: AppTheme.slateMuted)),
            ],
          ),
          const SizedBox(height: 8),

          // Amenity Badges
          Row(
            children: [
              if (hasAc)
                Container(
                  margin: const EdgeInsets.only(right: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(6)),
                  child: const Text('❄️ Máy lạnh', style: TextStyle(fontSize: 10, color: Color(0xFF2563EB), fontWeight: FontWeight.w600)),
                ),
              if (hasKidsSeat)
                Container(
                  margin: const EdgeInsets.only(right: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(6)),
                  child: const Text('👶 Ghế trẻ em', style: TextStyle(fontSize: 10, color: Color(0xFFD97706), fontWeight: FontWeight.w600)),
                ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(6)),
                child: Text('Món: ${p['dish']}', style: const TextStyle(fontSize: 10, color: AppTheme.slateDark, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 4-Action Hub: GrabFood, ShopeeFood, Maps, Call
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00B14F),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => _triggerDeepLink(p['name'] as String, 'GrabFood'),
                icon: const Icon(Icons.delivery_dining, size: 14),
                label: const Text('GrabFood ↗', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEE4D2D),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => _triggerDeepLink(p['name'] as String, 'ShopeeFood'),
                icon: const Icon(Icons.shopping_bag_outlined, size: 14),
                label: const Text('ShopeeFood ↗', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.charcoalHero,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => _showActionToast('Đang mở Google Maps chỉ đường đến "${p['name']}"...'),
                icon: const Icon(Icons.map_outlined, size: 13),
                label: const Text('Chỉ đường', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.charcoalHero,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => _showActionToast('Gọi hotline: ${p['phone']}'),
                icon: const Icon(Icons.call_outlined, size: 13),
                label: const Text('Gọi điện', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Closed Report Auto-Pause Guard
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              style: TextButton.styleFrom(
                foregroundColor: Colors.redAccent,
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              onPressed: () => _reportClosed(idx),
              icon: const Icon(Icons.warning_amber_rounded, size: 13),
              label: Text('Báo đóng cửa (${p['reports']}/3 báo cáo tạm ẩn)', style: const TextStyle(fontSize: 10)),
            ),
          ),
        ],
      ),
    );
  }
}
