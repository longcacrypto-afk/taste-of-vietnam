// M18 · AI Smart Fridge & IoT Barcode Scanner Screen (Zero Food Waste)
// Hôm nay ăn gì · Taste of Vietnam v0.2

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class FridgeScannerScreen extends StatefulWidget {
  const FridgeScannerScreen({super.key});

  @override
  State<FridgeScannerScreen> createState() => _FridgeScannerScreenState();
}

class _FridgeScannerScreenState extends State<FridgeScannerScreen> {
  bool _isLoading = true;
  String _selectedCompartment = 'all';
  List<dynamic> _inventory = [];
  Map<String, dynamic>? _lastScanResult;

  final Map<String, String> _compartmentLabels = {
    'all': 'Tất cả ngăn',
    'chill': 'Ngăn mát ❄️',
    'freeze': 'Ngăn đông 🧊',
    'door': 'Cánh tủ 🚪',
    'vegetable': 'Ngăn rau quả 🥦',
  };

  @override
  void initState() {
    super.initState();
    _loadInventory();
  }

  Future<void> _loadInventory() async {
    setState(() => _isLoading = true);
    final data = await ApiService.fetchFridgeInventory();
    if (mounted) {
      setState(() {
        _isLoading = false;
        if (data != null && data['inventory'] != null) {
          _inventory = data['inventory'] as List<dynamic>;
        } else {
          // Fallback demo data
          _inventory = [
            {'id': 'FRIDGE-01', 'name': 'Trứng gà ta', 'quantity': '6 quả', 'compartment': 'door', 'expires_in_days': 2, 'is_expiring_soon': true},
            {'id': 'FRIDGE-02', 'name': 'Đậu hũ non', 'quantity': '2 miếng', 'compartment': 'chill', 'expires_in_days': 1, 'is_expiring_soon': true},
            {'id': 'FRIDGE-03', 'name': 'Thịt bò phi lê', 'quantity': '300g', 'compartment': 'freeze', 'expires_in_days': 14, 'is_expiring_soon': false},
            {'id': 'FRIDGE-04', 'name': 'Cà chua Đà Lạt', 'quantity': '4 quả', 'compartment': 'vegetable', 'expires_in_days': 3, 'is_expiring_soon': false},
          ];
        }
      });
    }
  }

  Future<void> _simulateBarcodeScan() async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(
        child: Card(
          color: AppTheme.charcoalHero,
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(color: AppTheme.goldenAmber),
                SizedBox(height: 16),
                Text('Đang quét mã vạch EAN-13 & AI OCR...', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
        ),
      ),
    );

    final res = await ApiService.scanFridgeItem(
      barcode: '8934567890123',
      itemName: 'Sữa chua men sống Probi',
      expiresInDays: 5,
      compartment: 'chill',
    );

    if (mounted) {
      Navigator.pop(context); // Close loading dialog
      setState(() {
        _lastScanResult = res;
      });
      _loadInventory();

      showModalBottomSheet(
        context: context,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        builder: (ctx) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: AppTheme.emeraldBadge.withOpacity(0.15), shape: BoxShape.circle),
                    child: const Icon(Icons.check_circle_rounded, color: AppTheme.emeraldBadge, size: 28),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Đã nhận diện sản phẩm!', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                        Text('Mã vạch chuẩn GS1 Việt Nam (893...)', style: TextStyle(fontSize: 12, color: AppTheme.slateMuted)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: AppTheme.slateLight, borderRadius: BorderRadius.circular(16)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(res?['scanned_item']?['name'] ?? 'Sữa chua men sống Probi', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    const SizedBox(height: 4),
                    Text('Vị trí lưu: ${res?['scanned_item']?['compartment'] ?? 'Ngăn mát'} · Hạn dùng còn: ${res?['scanned_item']?['expires_in_days'] ?? 5} ngày',
                        style: const TextStyle(fontSize: 12, color: AppTheme.slateMuted)),
                    if (res?['suggested_zero_waste_recipe'] != null) ...[
                      const Divider(height: 20),
                      Row(
                        children: [
                          const Text('💡', style: TextStyle(fontSize: 16)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Gợi ý Zero-Waste: ${res?['suggested_zero_waste_recipe']}',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.amberDark),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.amberDark,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Đã thêm vào Tủ Lạnh', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final expiringItems = _inventory.where((it) => it['is_expiring_soon'] == true).toList();
    final filteredItems = _selectedCompartment == 'all'
        ? _inventory
        : _inventory.where((it) => it['compartment'] == _selectedCompartment).toList();

    return Scaffold(
      backgroundColor: AppTheme.slateLight,
      appBar: AppBar(
        title: const Text('🧊 Tủ Lạnh Thông Minh AI (M18)', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.slateDark,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Làm mới kho tủ lạnh',
            onPressed: _loadInventory,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.goldenAmber))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Hero Banner: Zero Food Waste ──
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppTheme.charcoalHero, Color(0xFF27272A)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppTheme.emeraldBadge,
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: const Text('ZERO FOOD WASTE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900)),
                            ),
                            const Spacer(),
                            const Text('IoT Sensor: Online 🟢', style: TextStyle(color: Colors.white70, fontSize: 11)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Quản Lý Kho Nguyên Liệu Thông Minh',
                          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Tự động quét mã EAN-13, cảnh báo hạn dùng và gợi ý món ăn chuẩn vị từ đồ thừa trong tủ lạnh.',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.goldenAmber,
                            foregroundColor: AppTheme.slateDark,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          ),
                          icon: const Icon(Icons.qr_code_scanner_rounded, size: 20),
                          label: const Text('Quét mã vạch / Chụp ảnh nguyên liệu', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                          onPressed: _simulateBarcodeScan,
                        ),
                      ],
                    ),
                  ),

                  // ── Expiry Alert Banner ──
                  if (expiringItems.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Cảnh báo: ${expiringItems.length} nguyên liệu sắp hết hạn!',
                                  style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w800, fontSize: 13),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${expiringItems.map((e) => e['name']).join(', ')} cần dùng trong 24-48 giờ.',
                                  style: const TextStyle(fontSize: 11, color: AppTheme.slateDark),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // ── Filter Chips: Compartments ──
                  const SizedBox(height: 20),
                  const Text('Chọn khu vực tủ lạnh', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 10),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: _compartmentLabels.entries.map((entry) {
                        final isSelected = _selectedCompartment == entry.key;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(entry.value),
                            selected: isSelected,
                            selectedColor: AppTheme.goldenAmber.withOpacity(0.2),
                            labelStyle: TextStyle(
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                              color: isSelected ? AppTheme.amberDark : AppTheme.slateDark,
                            ),
                            backgroundColor: Colors.white,
                            onSelected: (selected) {
                              if (selected) setState(() => _selectedCompartment = entry.key);
                            },
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                  // ── Inventory List ──
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Danh sách nguyên liệu (${filteredItems.length})', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
                      TextButton.icon(
                        icon: const Icon(Icons.auto_awesome, size: 16, color: AppTheme.amberDark),
                        label: const Text('Gợi ý nấu ăn ngay', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppTheme.amberDark)),
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('🍳 Mẹ AI gợi ý: Canh đậu hũ non cà chua & Trứng chiên hành lá!'),
                              backgroundColor: AppTheme.charcoalHero,
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  if (filteredItems.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      alignment: Alignment.center,
                      child: const Text('Không có nguyên liệu nào trong ngăn này.', style: TextStyle(color: AppTheme.slateMuted)),
                    )
                  else
                    ...filteredItems.map((item) {
                      final isExpiring = item['is_expiring_soon'] == true;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: isExpiring ? Colors.redAccent.withOpacity(0.3) : AppTheme.slateBorder),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: isExpiring ? Colors.redAccent.withOpacity(0.1) : AppTheme.goldenAmber.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                item['compartment'] == 'freeze' ? '🧊' : (item['compartment'] == 'vegetable' ? '🥦' : '🥚'),
                                style: const TextStyle(fontSize: 22),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                                  const SizedBox(height: 2),
                                  Text('Số lượng: ${item['quantity'] ?? ''} · Ngăn: ${_compartmentLabels[item['compartment']] ?? item['compartment']}',
                                      style: const TextStyle(fontSize: 12, color: AppTheme.slateMuted)),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: isExpiring ? Colors.redAccent.withOpacity(0.1) : AppTheme.emeraldBadge.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                isExpiring ? 'Còn ${item['expires_in_days']} ngày!' : 'Còn ${item['expires_in_days']} ngày',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: isExpiring ? Colors.redAccent : AppTheme.emeraldBadge,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                ],
              ),
            ),
    );
  }
}
