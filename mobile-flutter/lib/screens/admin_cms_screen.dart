// M9 · Admin CMS & Governance Screen
// Hôm nay ăn gì · Taste of Vietnam v0.2
// Production Grade Luxury CMS with RBAC 6-Role Switcher, OCR Bounding Box Inspector, Auto-Pause Resolution & Audit Log

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class AdminCmsScreen extends StatefulWidget {
  const AdminCmsScreen({super.key});

  @override
  State<AdminCmsScreen> createState() => _AdminCmsScreenState();
}

class _AdminCmsScreenState extends State<AdminCmsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;

  String _currentRole = 'SuperAdmin';
  final List<String> _roles = [
    'SuperAdmin',
    'ContentMod',
    'AdMod',
    'MerchantOps',
    'DataAnalyst',
    'SupportAgent',
  ];

  final Map<String, String> _roleDescriptions = {
    'SuperAdmin': 'Toàn quyền cấu hình hệ thống, PDPD xóa dữ liệu, duyệt quy trình cấp cao',
    'ContentMod': 'Kiểm duyệt thực đơn, chuẩn hóa tên món, kiểm tra dị ứng & dinh dưỡng',
    'AdMod': 'Phê duyệt chiến dịch tài trợ FMCG, kiểm soát trần hiển thị 1/3 vị trí',
    'MerchantOps': 'Quản lý đối tác quán ăn, xử lý vi phạm, mở lại quán bị tự động tạm dừng',
    'DataAnalyst': 'Xem báo cáo du lịch B2G k-anonymity (k >= 50), chỉ số xu hướng tiêu dùng',
    'SupportAgent': 'Hỗ trợ thực khách, giải quyết tranh chấp đặt bàn và hoàn cọc',
  };

  final List<Map<String, dynamic>> _ocrQueue = [
    {
      'id': 'QUEUE-801',
      'place': 'Cơm Niêu Đồng Quê',
      'dish': 'Cá Kèo Kho Rau Răm',
      'category': 'Món Mặn Miền Nam',
      'rawText': 'Ca keo kho rau ram - 65k (kho to dat)',
      'suggestedPrice': 65000,
      'confidence': 88.5,
      'allergens': ['Nước mắm', 'Ớt cay'],
      'status': 'Chờ duyệt',
      'matched': 'DISH-108',
      'dishScore': 94.0,
      'priceScore': 87.5,
    },
    {
      'id': 'QUEUE-802',
      'place': 'Lẩu Cua Đồng Bà Ba',
      'dish': 'Lẩu Cua Đồng Bắp Bò',
      'category': 'Món Nước / Lẩu',
      'rawText': 'Lau cua dong bap bo 180k / noi 2-3 nguoi',
      'suggestedPrice': 180000,
      'confidence': 91.2,
      'allergens': ['Cua đồng', 'Hải sản / Giáp xác'],
      'status': 'Chờ duyệt',
      'matched': 'DISH-105',
      'dishScore': 92.8,
      'priceScore': 93.0,
    },
    {
      'id': 'QUEUE-803',
      'place': 'Bún Bò O Phượng',
      'dish': 'Bún Bò Gân Chả Cua Cố Đô',
      'category': 'Đặc Sản Miền Trung',
      'rawText': 'Bun bo gan cha cua dac biet 55,000d',
      'suggestedPrice': 55000,
      'confidence': 96.0,
      'allergens': ['Mắm ruốc Huế', 'Chả cua'],
      'status': 'Chờ duyệt',
      'matched': 'DISH-103',
      'dishScore': 98.0,
      'priceScore': 95.0,
    },
  ];

  final List<Map<String, dynamic>> _pausedPlaces = [
    {
      'id': 'PLACE-404',
      'name': 'Quán Ốc Đêm Bờ Sông',
      'address': '124 Bờ Kè Kênh Nhiêu Lộc, Q.3, TP.HCM',
      'reason': '3 báo cáo người dùng: Quán tạm nghỉ sửa chữa mặt bằng',
      'reports': 3,
      'pausedAt': '14:20 hôm nay',
      'status': 'Tự động tạm dừng (Auto-paused)',
      'riskLevel': 'Trung bình',
      'phone': '0903 881 229',
    },
    {
      'id': 'PLACE-512',
      'name': 'Bánh Mì Chảo Xóm Chợ',
      'address': '45 Tạ Hiện, Hoàn Kiếm, Hà Nội',
      'reason': '1 báo cáo chủ quán đổi địa điểm sang số 82 Hàng Bông',
      'reports': 1,
      'pausedAt': '09:10 hôm nay',
      'status': 'Chờ xác minh địa chỉ mới',
      'riskLevel': 'Thấp',
      'phone': '0912 345 678',
    },
  ];

  final List<Map<String, dynamic>> _auditLogs = [
    {
      'time': '16:42:10',
      'role': 'AdMod',
      'actor': 'mod_nguyen@tastevietnam.vn',
      'action': 'Phê duyệt chiến dịch tài trợ #CAM-502 (Chinsu Đệ Nhị Vị)',
      'ip': '113.161.42.18',
      'status': 'SUCCESS',
    },
    {
      'time': '15:20:05',
      'role': 'ContentMod',
      'actor': 'mod_tran@tastevietnam.vn',
      'action': 'Sửa thông tin dị ứng món DISH-103 (Thêm Đậu phộng & Mắm ruốc)',
      'ip': '118.69.182.9',
      'status': 'SUCCESS',
    },
    {
      'time': '14:10:45',
      'role': 'MerchantOps',
      'actor': 'ops_le@tastevietnam.vn',
      'action': 'Gửi cảnh báo vệ sinh an toàn thực phẩm cho Quán PLACE-209',
      'ip': '14.161.12.90',
      'status': 'SUCCESS',
    },
    {
      'time': '11:20:05',
      'role': 'SuperAdmin',
      'actor': 'admin_long@tastevietnam.vn',
      'action': 'Kích hoạt chính sách xóa tài khoản tức thì PDPD (Nghị định 13)',
      'ip': '14.232.208.5',
      'status': 'CRITICAL',
    },
    {
      'time': '09:05:32',
      'role': 'DataAnalyst',
      'actor': 'analyst_mai@tastevietnam.vn',
      'action': 'Xuất báo cáo lưu lượng ẩm thực B2G Thừa Thiên Huế (k >= 50)',
      'ip': '125.235.4.11',
      'status': 'SUCCESS',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
    _syncAdminMetadata();
  }

  Future<void> _syncAdminMetadata() async {
    await ApiService.fetchRbacRoles();
    await ApiService.fetchAbTestResults();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  void _switchRoleModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('🛡️', style: TextStyle(fontSize: 22)),
                  const SizedBox(width: 8),
                  Text('Chọn Vai Trò Quản Trị (RBAC)',
                      style: AppTheme.titleMedium.copyWith(color: AppTheme.goldenAmber, fontSize: 16)),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white54),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Chuyển đổi vai trò để kiểm thử phân quyền 6 cấp trong hệ thống hôm nay ăn gì.',
                style: AppTheme.labelSmall.copyWith(color: Colors.white70, fontSize: 11),
              ),
              const SizedBox(height: 16),
              ..._roles.map((role) {
                final isSelected = _currentRole == role;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? AppTheme.goldenAmber.withOpacity(0.12) : AppTheme.surfaceElevated,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? AppTheme.goldenAmber : const Color(0xFF27272A),
                    ),
                  ),
                  child: ListTile(
                    dense: true,
                    title: Text(role,
                        style: TextStyle(
                          color: isSelected ? AppTheme.goldenAmber : Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        )),
                    subtitle: Text(
                      _roleDescriptions[role] ?? '',
                      style: const TextStyle(color: Colors.white60, fontSize: 10),
                    ),
                    trailing: isSelected
                        ? const Icon(Icons.check_circle_rounded, color: AppTheme.goldenAmber, size: 20)
                        : null,
                    onTap: () {
                      setState(() => _currentRole = role);
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('🔑 Đã chuyển sang vai trò: $role'),
                          backgroundColor: AppTheme.charcoalHero,
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    },
                  ),
                );
              }),
            ],
          ),
        ),
      ),
    );
  }

  void _inspectOcrItem(Map<String, dynamic> item) {
    final dishController = TextEditingController(text: item['dish']);
    final priceController = TextEditingController(text: '${item['suggestedPrice']}');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.charcoalHero,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
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
                  const Text('🔍', style: TextStyle(fontSize: 22)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('Chi Tiết Bounding Box & OCR (${item['id']})',
                        style: AppTheme.titleMedium.copyWith(color: AppTheme.goldenAmber, fontSize: 15)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white54),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // Simulated Bounding Box Frame
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E24),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.amber.withOpacity(0.5)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.crop_free_rounded, color: Colors.amber, size: 16),
                        const SizedBox(width: 6),
                        Text('VÙNG NHẬN DIỆN ẢNH MENU (BOUNDING BOX)',
                            style: AppTheme.labelSmall.copyWith(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold)),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: Colors.amber.withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                          child: Text('Khớp ${item['confidence']}%', style: const TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: Colors.black38, borderRadius: BorderRadius.circular(8)),
                      child: Text('Text gốc: "${item['rawText']}"',
                          style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontSize: 12)),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Tên món khớp: ${item['dishScore']}%', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                        Text('Giá tiền khớp: ${item['priceScore']}%', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text('Chỉnh sửa tên món chuẩn hóa:', style: TextStyle(color: Colors.white70, fontSize: 12)),
              const SizedBox(height: 6),
              TextField(
                controller: dishController,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppTheme.surfaceElevated,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              const Text('Giá niêm yết (VND):', style: TextStyle(color: Colors.white70, fontSize: 12)),
              const SizedBox(height: 6),
              TextField(
                controller: priceController,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppTheme.surfaceElevated,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: (item['allergens'] as List<String>).map((alg) {
                  return Chip(
                    label: Text(alg, style: const TextStyle(fontSize: 10, color: Colors.white)),
                    backgroundColor: Colors.redAccent.withOpacity(0.2),
                    side: const BorderSide(color: Colors.redAccent, width: 0.8),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.redAccent,
                        side: const BorderSide(color: Colors.redAccent),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        _rejectOcrItem(item);
                      },
                      child: const Text('Từ chối dòng OCR'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.emeraldBadge,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () {
                        final newDish = dishController.text.trim();
                        final newPrice = int.tryParse(priceController.text.trim()) ?? item['suggestedPrice'];
                        Navigator.pop(ctx);
                        setState(() {
                          _ocrQueue.removeWhere((q) => q['id'] == item['id']);
                        });
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('✅ Đã chuẩn hóa & phê duyệt "$newDish" ($newPrice đ)!'),
                            backgroundColor: AppTheme.charcoalHero,
                          ),
                        );
                      },
                      child: const Text('Lưu & Phê Duyệt'),
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

  void _rejectOcrItem(Map<String, dynamic> item) {
    final reasonController = TextEditingController(text: 'Ảnh chụp mờ, giá tiền không xác định rõ ràng');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.charcoalHero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Từ chối OCR: ${item['id']}',
            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Lý do phản hồi tự động gửi tới chủ quán:',
                style: TextStyle(color: Colors.white70, fontSize: 12)),
            const SizedBox(height: 8),
            TextField(
              controller: reasonController,
              maxLines: 2,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF27272A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                _ocrQueue.removeWhere((q) => q['id'] == item['id']);
              });
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('❌ Đã từ chối dòng OCR ${item['id']}'),
                  backgroundColor: AppTheme.charcoalHero,
                ),
              );
            },
            child: const Text('Xác nhận từ chối'),
          ),
        ],
      ),
    );
  }

  void _unpausePlaceModal(Map<String, dynamic> place) {
    final noteController = TextEditingController(text: 'Đã gọi điện xác minh quán mở cửa bình thường.');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.charcoalHero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Phục hồi quán: ${place['name']}',
            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Địa chỉ: ${place['address']}', style: const TextStyle(color: Colors.white70, fontSize: 11)),
            Text('Số điện thoại: ${place['phone']}', style: const TextStyle(color: AppTheme.goldenAmber, fontSize: 11)),
            const SizedBox(height: 12),
            const Text('Ghi chú xác minh vận hành:', style: TextStyle(color: Colors.white70, fontSize: 12)),
            const SizedBox(height: 6),
            TextField(
              controller: noteController,
              maxLines: 2,
              style: const TextStyle(color: Colors.white, fontSize: 12),
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF27272A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Đóng', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.goldenAmber,
              foregroundColor: Colors.black,
            ),
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                _pausedPlaces.removeWhere((p) => p['id'] == place['id']);
                _auditLogs.insert(0, {
                  'time': 'Vừa xong',
                  'role': _currentRole,
                  'actor': 'current_user@tastevietnam.vn',
                  'action': 'Mở lại hoạt động quán ${place['name']} sau xác minh',
                  'ip': '127.0.0.1',
                  'status': 'SUCCESS',
                });
              });
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('✅ Đã mở lại hoạt động cho "${place['name']}" trên bản đồ!'),
                  backgroundColor: AppTheme.charcoalHero,
                ),
              );
            },
            child: const Text('Xác nhận & Mở Quán', style: TextStyle(fontWeight: FontWeight.bold)),
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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Admin CMS & Governance', style: AppTheme.titleLarge.copyWith(fontSize: 16)),
            Text('Taste of Vietnam Control Center', style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.goldenAmber)),
          ],
        ),
        actions: [
          TextButton.icon(
            style: TextButton.styleFrom(
              backgroundColor: AppTheme.goldenAmber.withOpacity(0.15),
              foregroundColor: AppTheme.goldenAmber,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
            onPressed: _switchRoleModal,
            icon: const Icon(Icons.shield_outlined, size: 14),
            label: Text(_currentRole, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 8),
        ],
        bottom: TabBar(
          controller: _tab,
          indicatorColor: AppTheme.goldenAmber,
          labelColor: AppTheme.goldenAmber,
          unselectedLabelColor: AppTheme.textSecondary,
          tabs: [
            Tab(text: '📋 Duyệt OCR (${_ocrQueue.length})'),
            Tab(text: '⏸️ Tạm Dừng (${_pausedPlaces.length})'),
            Tab(text: '🛡️ Audit Log (${_auditLogs.length})'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          _buildOcrQueueTab(),
          _buildPausedPlacesTab(),
          _buildAuditLogTab(),
        ],
      ),
    );
  }

  // ─── TAB 1: OCR QUEUE REVIEW ────────────────────────────────────
  Widget _buildOcrQueueTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildInfoBox('Hàng đợi duyệt thủ công cho các dòng OCR có độ tin cậy < 95% nhằm đảm bảo 100% dữ liệu món, dị ứng và giá cả chính xác.'),
        const SizedBox(height: 16),
        if (_ocrQueue.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            alignment: Alignment.center,
            child: Column(
              children: [
                const Icon(Icons.check_circle_outline_rounded, color: AppTheme.emeraldBadge, size: 48),
                const SizedBox(height: 12),
                Text('Tuyệt vời! Hàng đợi OCR đã được duyệt sạch sẽ.',
                    style: AppTheme.bodyMedium.copyWith(color: AppTheme.emeraldBadge, fontWeight: FontWeight.bold)),
              ],
            ),
          )
        else
          ..._ocrQueue.map(_buildQueueCard),
      ],
    );
  }

  Widget _buildQueueCard(Map<String, dynamic> item) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.amber.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(item['place'],
                      style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 14)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: Colors.amber.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
                  child: Text('Độ tin cậy: ${item['confidence']}%',
                      style: const TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: const Color(0xFF1E1E24), borderRadius: BorderRadius.circular(8)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text('Món nhận diện: ', style: TextStyle(color: Colors.white54, fontSize: 11)),
                      Text(item['dish'], style: const TextStyle(color: AppTheme.goldenAmber, fontSize: 12, fontWeight: FontWeight.bold)),
                      const Spacer(),
                      Text('${item['suggestedPrice']} đ', style: const TextStyle(color: AppTheme.emeraldBadge, fontSize: 12, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('Dòng ảnh gốc: "${item['rawText']}"',
                      style: AppTheme.labelSmall.copyWith(fontSize: 10, fontFamily: 'monospace')),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              children: (item['allergens'] as List<String>).map((a) {
                return Text('⚠️ $a', style: const TextStyle(color: Colors.redAccent, fontSize: 10));
              }).toList(),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _inspectOcrItem(item),
                    icon: const Icon(Icons.manage_search_rounded, size: 14),
                    label: const Text('Soi Bounding Box', style: TextStyle(fontSize: 11)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.goldenAmber,
                      side: const BorderSide(color: AppTheme.goldenAmber),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.redAccent, size: 20),
                  tooltip: 'Từ chối',
                  onPressed: () => _rejectOcrItem(item),
                ),
                IconButton(
                  icon: const Icon(Icons.check_circle_rounded, color: AppTheme.emeraldBadge, size: 22),
                  tooltip: 'Phê duyệt nhanh',
                  onPressed: () {
                    setState(() => _ocrQueue.removeWhere((q) => q['id'] == item['id']));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('✅ Đã phê duyệt nhanh món "${item['dish']}"')),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      );

  // ─── TAB 2: PAUSED PLACES ───────────────────────────────────────
  Widget _buildPausedPlacesTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildInfoBox('Cơ chế Auto-Pause bảo vệ cộng đồng: Khi quán nhận đủ 3 báo cáo đóng cửa từ người dùng hoặc vi phạm nghiêm trọng, hệ thống tự động ẩn khỏi bản đồ M4 và M1.'),
        const SizedBox(height: 16),
        if (_pausedPlaces.isEmpty)
          Container(
            padding: const EdgeInsets.all(32),
            alignment: Alignment.center,
            child: Column(
              children: [
                const Icon(Icons.verified_rounded, color: AppTheme.emeraldBadge, size: 48),
                const SizedBox(height: 12),
                Text('Tất cả đối tác quán ăn đang hoạt động ổn định.',
                    style: AppTheme.bodyMedium.copyWith(color: AppTheme.emeraldBadge, fontWeight: FontWeight.bold)),
              ],
            ),
          )
        else
          ..._pausedPlaces.map(_buildPausedPlaceCard),
      ],
    );
  }

  Widget _buildPausedPlaceCard(Map<String, dynamic> place) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(place['name'],
                      style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 14)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: Colors.redAccent.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
                  child: Text('${place['reports']} báo cáo',
                      style: const TextStyle(color: Colors.redAccent, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('📍 ${place['address']}', style: AppTheme.labelSmall.copyWith(fontSize: 11, color: Colors.white70)),
            const SizedBox(height: 4),
            Text('⚠️ Lý do: ${place['reason']}', style: AppTheme.labelSmall.copyWith(fontSize: 11, color: Colors.orangeAccent)),
            Text('🕒 Thời gian tạm dừng: ${place['pausedAt']}', style: AppTheme.labelSmall.copyWith(fontSize: 10)),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _unpausePlaceModal(place),
                icon: const Icon(Icons.check_circle_outline, size: 16),
                label: const Text('Xác Minh Đối Tác & Mở Lại Quán'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.goldenAmber,
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ),
          ],
        ),
      );

  // ─── TAB 3: RBAC AUDIT LOGS ─────────────────────────────────────
  Widget _buildAuditLogTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildInfoBox('Nhật ký kiểm toán bất biến (Immutable Audit Log) với 6 vai trò quản trị. Tuân thủ tiêu chuẩn an toàn thông tin & Nghị định 13/2023/NĐ-CP.'),
        const SizedBox(height: 16),
        ..._auditLogs.map(_buildAuditLogRow),
      ],
    );
  }

  Widget _buildAuditLogRow(Map<String, dynamic> log) {
    final isCritical = log['status'] == 'CRITICAL';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(10),
        border: isCritical ? Border.all(color: Colors.redAccent.withOpacity(0.4)) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: log['role'] == 'SuperAdmin' ? Colors.redAccent.withOpacity(0.2) : AppTheme.goldenAmber.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(log['role'],
                    style: TextStyle(
                      color: log['role'] == 'SuperAdmin' ? Colors.redAccent : AppTheme.goldenAmber,
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                    )),
              ),
              const SizedBox(width: 8),
              Text(log['time'], style: AppTheme.labelSmall.copyWith(fontSize: 11)),
              const Spacer(),
              Text('IP: ${log['ip']}', style: AppTheme.labelSmall.copyWith(fontSize: 10, color: const Color(0xFF71717A))),
            ],
          ),
          const SizedBox(height: 6),
          Text(log['action'], style: AppTheme.bodyMedium.copyWith(fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Text(log['actor'], style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.emeraldBadge)),
        ],
      ),
    );
  }

  Widget _buildInfoBox(String text) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFF2A2A2E)),
        ),
        child: Text(text, style: AppTheme.labelSmall.copyWith(fontSize: 11, height: 1.4)),
      );
}
