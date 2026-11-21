// M9 · Admin CMS & Governance Screen
// Hôm nay ăn gì · Taste of Vietnam v0.1

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class AdminCmsScreen extends StatefulWidget {
  const AdminCmsScreen({super.key});

  @override
  State<AdminCmsScreen> createState() => _AdminCmsScreenState();
}

class _AdminCmsScreenState extends State<AdminCmsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;

  final List<Map<String, dynamic>> _ocrQueue = [
    {
      'id': 'QUEUE-801',
      'place': 'Cơm Niêu Đồng Quê',
      'dish': 'Cá Kèo Kho Rau Răm',
      'rawText': 'Ca keo kho rau ram - 65k',
      'confidence': 88.5,
      'status': 'Chờ duyệt',
      'matched': 'DISH-108',
    },
    {
      'id': 'QUEUE-802',
      'place': 'Lẩu Cua Đồng Bà Ba',
      'dish': 'Lẩu Cua Đồng Bắp Bò',
      'rawText': 'Lau cua dong bap bo 180k',
      'confidence': 91.2,
      'status': 'Chờ duyệt',
      'matched': 'DISH-105',
    },
  ];

  final List<Map<String, dynamic>> _pausedPlaces = [
    {
      'id': 'PLACE-404',
      'name': 'Quán Ốc Đêm Bờ Sông',
      'reason': '3 báo cáo người dùng: Quán tạm nghỉ sửa chữa',
      'reports': 3,
      'pausedAt': '14:20 hôm nay',
      'status': 'Tự động tạm dừng (Auto-paused)',
    },
  ];

  final List<Map<String, dynamic>> _auditLogs = [
    {
      'time': '14:15:20',
      'role': 'AdMod',
      'actor': 'mod_nguyen@tastevietnam.vn',
      'action': 'Phê duyệt chiến dịch tài trợ #CAM-502 (Chinsu)',
      'ip': '113.161.42.18',
    },
    {
      'time': '13:48:10',
      'role': 'ContentMod',
      'actor': 'mod_tran@tastevietnam.vn',
      'action': 'Sửa thông tin dị ứng món DISH-103 (Thêm Đậu phộng)',
      'ip': '118.69.182.9',
    },
    {
      'time': '11:20:05',
      'role': 'SuperAdmin',
      'actor': 'admin_long@tastevietnam.vn',
      'action': 'Kích hoạt chính sách xóa tài khoản tức thì (PDPD)',
      'ip': '14.232.208.5',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
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
        title: Text('Admin CMS (M9)', style: AppTheme.titleLarge),
        bottom: TabBar(
          controller: _tab,
          indicatorColor: AppTheme.goldenAmber,
          labelColor: AppTheme.goldenAmber,
          unselectedLabelColor: AppTheme.textSecondary,
          tabs: const [
            Tab(text: '📋 Duyệt OCR'),
            Tab(text: '⏸️ Quán Tạm Dừng'),
            Tab(text: '🛡️ Audit Log (6 Roles)'),
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
        _buildInfoBox('Hàng đợi duyệt thủ công cho các dòng OCR có độ tin cậy < 95% nhằm đảm bảo 100% dữ liệu món chính xác.'),
        const SizedBox(height: 16),
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
                Text(item['place'], style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 13)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: Colors.amber.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
                  child: Text('Độ tin cậy: ${item['confidence']}%',
                      style: const TextStyle(color: Colors.amber, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('Nhận diện: ${item['dish']}', style: AppTheme.bodyMedium.copyWith(fontSize: 13, color: AppTheme.goldenAmber)),
            Text('Dòng ảnh gốc: "${item['rawText']}"', style: AppTheme.labelSmall.copyWith(fontSize: 11)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _rejectOcrItem(item),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.redAccent,
                      side: const BorderSide(color: Colors.redAccent),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Từ chối', style: TextStyle(fontSize: 12)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => _approveOcrItem(item),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.emeraldBadge,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Phê duyệt', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ],
        ),
      );

  void _rejectOcrItem(Map<String, dynamic> item) {
    final reasonController = TextEditingController(text: 'Ảnh chụp bị nhòe và giá tiền không rõ');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.charcoalHero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Từ chối dòng OCR: ${item['id']}', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Nhập lý do từ chối để phản hồi cho chủ quán:', style: TextStyle(color: Colors.white70, fontSize: 12)),
            const SizedBox(height: 8),
            TextField(
              controller: reasonController,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFF27272A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                hintText: 'Lý do từ chối...',
                hintStyle: const TextStyle(color: Colors.white38),
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
              final reason = reasonController.text;
              Navigator.pop(ctx);
              setState(() {
                _ocrQueue.removeWhere((q) => q['id'] == item['id']);
              });
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('❌ Đã từ chối dòng OCR ${item['id']}: "$reason"'),
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

  void _approveOcrItem(Map<String, dynamic> item) {
    setState(() {
      _ocrQueue.removeWhere((q) => q['id'] == item['id']);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('✅ Đã phê duyệt món "${item['dish']}" vào menu chính thức!'),
        backgroundColor: AppTheme.charcoalHero,
      ),
    );
  }

  void _unpausePlace(Map<String, dynamic> place) {
    setState(() {
      _pausedPlaces.removeWhere((p) => p['id'] == place['id']);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('✅ Đã xác minh & phục hồi hoạt động cho "${place['name']}"!'),
        backgroundColor: AppTheme.charcoalHero,
      ),
    );
  }

  // ─── TAB 2: PAUSED PLACES ───────────────────────────────────────
  Widget _buildPausedPlacesTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildInfoBox('Cơ chế Auto-Pause bảo vệ trải nghiệm: Khi quán nhận đủ 3 báo cáo đóng cửa từ cộng đồng, quán sẽ tự động bị ẩn khỏi bản đồ.'),
        const SizedBox(height: 16),
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
                Text(place['name'], style: AppTheme.bodyMedium.copyWith(fontWeight: FontWeight.bold, fontSize: 14)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: Colors.redAccent.withOpacity(0.15), borderRadius: BorderRadius.circular(4)),
                  child: Text('${place['reports']} báo cáo', style: const TextStyle(color: Colors.redAccent, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(place['reason'], style: AppTheme.labelSmall.copyWith(fontSize: 11, color: Colors.white70)),
            Text('Thời gian tạm dừng: ${place['pausedAt']}', style: AppTheme.labelSmall.copyWith(fontSize: 10)),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => _unpausePlace(place),
                icon: const Icon(Icons.check_circle_outline, size: 16),
                label: const Text('Xác Minh & Mở Lại Quán'),
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
        _buildInfoBox('Nhật ký hành động bất biến (Immutable Audit Log) với 6 vai trò: SuperAdmin, ContentMod, AdMod, MerchantOps, DataAnalyst, SupportAgent.'),
        const SizedBox(height: 16),
        ..._auditLogs.map(_buildAuditLogRow),
      ],
    );
  }

  Widget _buildAuditLogRow(Map<String, dynamic> log) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(10),
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
                Text(log['ip'], style: AppTheme.labelSmall.copyWith(fontSize: 10, color: const Color(0xFF71717A))),
              ],
            ),
            const SizedBox(height: 6),
            Text(log['action'], style: AppTheme.bodyMedium.copyWith(fontSize: 12, fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(log['actor'], style: AppTheme.labelSmall.copyWith(fontSize: 10, color: AppTheme.emeraldBadge)),
          ],
        ),
      );

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
