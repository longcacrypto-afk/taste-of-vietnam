// =============================================================================
// M4 & M5 SCREEN: 3KM OPEN PLACES MAP, DEEP-LINK REDIRECT & REPORT AUTO-PAUSE
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class MapPlacesScreen extends StatefulWidget {
  const MapPlacesScreen({super.key});

  @override
  State<MapPlacesScreen> createState() => _MapPlacesScreenState();
}

class _MapPlacesScreenState extends State<MapPlacesScreen> {
  bool _openOnly = true;
  String? _activeOrderBanner;

  final List<Map<String, dynamic>> _places = [
    {
      'id': 'PLACE-401',
      'name': 'Phở Gia Truyền Phát Tài',
      'dish': 'Phở Bò Tái Nạm Hà Nội',
      'distance': '680m',
      'price': '45.000đ',
      'rating': 4.8,
      'isOpen': true,
      'sponsored': true,
      'reports': 0,
    },
    {
      'id': 'PLACE-402',
      'name': 'Cơm Tấm Sài Gòn Xưa',
      'dish': 'Cơm Tấm Sườn Bì Chả',
      'distance': '1.2km',
      'price': '40.000đ',
      'rating': 4.7,
      'isOpen': true,
      'sponsored': false,
      'reports': 0,
    },
    {
      'id': 'PLACE-403',
      'name': 'Bún Bò Huế O Xuân',
      'dish': 'Bún Bò Huế Giò Heo',
      'distance': '1.5km',
      'price': '50.000đ',
      'rating': 4.9,
      'isOpen': true,
      'sponsored': false,
      'reports': 1,
    },
  ];

  void _triggerDeepLink(String placeName, String partner) {
    setState(() {
      _activeOrderBanner = 'Đã mở $partner cho "$placeName" (UTM Tracked). Bấm xác nhận nếu anh đã đặt món!';
    });
  }

  void _reportClosed(int idx) {
    setState(() {
      _places[idx]['reports'] = (_places[idx]['reports'] as int) + 1;
      if ((_places[idx]['reports'] as int) >= 3) {
        _places[idx]['isOpen'] = false;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final visiblePlaces = _places.where((p) => !_openOnly || p['isOpen'] == true).toList();

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Quán Ngon Quanh Bạn (3km)', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                Text('M4 Bản đồ PostGIS · M5 Đặt món Deep-link', style: TextStyle(fontSize: 12, color: AppTheme.slateMuted)),
              ],
            ),
            FilterChip(
              label: const Text('Đang mở cửa', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
              selected: _openOnly,
              selectedColor: const Color(0xFFDCFCE7),
              onSelected: (v) => setState(() => _openOnly = v),
            ),
          ],
        ),
        const SizedBox(height: 14),

        if (_activeOrderBanner != null)
          Container(
            margin: const EdgeInsets.only(bottom: 14),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppTheme.goldenAmber),
            ),
            child: Row(
              children: [
                Expanded(child: Text(_activeOrderBanner!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.charcoalHero, foregroundColor: Colors.white),
                  onPressed: () => setState(() => _activeOrderBanner = null),
                  child: const Text('Đã ăn (Cooldown 3 ngày)', style: TextStyle(fontSize: 11)),
                ),
              ],
            ),
          ),

        ...visiblePlaces.asMap().entries.map((entry) {
          final idx = entry.key;
          final p = entry.value;
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.surfaceElevated,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(p['name'] as String, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                    ),
                    if (p['sponsored'] == true)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(99)),
                        child: const Text('Tài trợ', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFFB45309))),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text('${p['dish']} · ${p['price']} · Cách ${p['distance']} · ⭐ ${p['rating']}',
                    style: const TextStyle(fontSize: 12, color: AppTheme.slateMuted)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.goldenAmber,
                          foregroundColor: AppTheme.slateDark,
                          elevation: 0,
                          shape: const StadiumBorder(),
                        ),
                        onPressed: () => _triggerDeepLink(p['name'] as String, 'GrabFood'),
                        child: const Text('GrabFood / ShopeeFood', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      onPressed: () => _reportClosed(idx),
                      child: Text('Báo đóng cửa (${p['reports']}/3)', style: const TextStyle(fontSize: 11)),
                    ),
                  ],
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
