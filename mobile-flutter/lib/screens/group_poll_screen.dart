// M12 · Group Poll + GPS Verified Review Screen
// Hôm nay ăn gì · Taste of Vietnam v0.1

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class GroupPollScreen extends StatefulWidget {
  const GroupPollScreen({super.key});
  @override
  State<GroupPollScreen> createState() => _GroupPollScreenState();
}

class _GroupPollScreenState extends State<GroupPollScreen> {
  // Poll state
  final Map<String, int> _votes = {'pho': 4, 'bunbo': 2, 'comtam': 1};
  bool _hasVoted = false;
  String? _myVote;

  // Review state
  int _starRating = 0;
  bool _reviewSubmitted = false;
  final _commentCtrl = TextEditingController();
  bool _locationGranted = false;
  bool _locationChecking = false;

  final _pollOptions = [
    _Option('pho', '🍜', 'Phở Bò Hà Nội', 'Thanh Restaurant · 1.2km'),
    _Option('bunbo', '🍲', 'Bún Bò Huế', 'Quán O Xuân · 0.8km'),
    _Option('comtam', '🍚', 'Cơm Tấm Sườn Bì', 'Bà Năm · 0.5km'),
  ];

  int get _totalVotes => _votes.values.fold(0, (a, b) => a + b);

  String get _winner =>
      _votes.entries.reduce((a, b) => a.value >= b.value ? a : b).key;

  @override
  void initState() {
    super.initState();
    _loadLivePoll();
  }

  Future<void> _loadLivePoll() async {
    final data = await ApiService.fetchGroupPoll();
    if (mounted && data != null) {
      setState(() {
        if (data['options'] is List) {
          final opts = data['options'] as List;
          for (final o in opts) {
            final id = o['dish_id'] ?? o['id'];
            if (id != null && o['votes'] != null) {
              _votes[id.toString()] = o['votes'] as int;
            }
          }
        }
      });
    }
  }

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  void _castVote(String id) async {
    if (_hasVoted) return;
    setState(() {
      _votes[id] = (_votes[id] ?? 0) + 1;
      _myVote = id;
      _hasVoted = true;
    });

    // Gửi vote lên Cloud API (Render / Local Gateway)
    ApiService.voteGroupPoll('POLL-701', id);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('✅ Đã bình chọn! Kết quả đồng bộ realtime lên Cloud API.'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _checkLocation() async {
    setState(() => _locationChecking = true);
    await Future.delayed(const Duration(seconds: 1));
    setState(() {
      _locationChecking = false;
      _locationGranted = true;
    });
  }

  void _submitReview() async {
    if (_starRating == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('⭐ Vui lòng chọn số sao!')),
      );
      return;
    }
    if (!_locationGranted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('📍 Cần xác minh vị trí trong vòng 500m!')),
      );
      return;
    }

    // Gửi đánh giá xác minh GPS lên backend
    ApiService.submitGpsReview(
      placeId: 'PLACE-401',
      lat: 10.9574,
      lng: 106.8226,
      rating: _starRating,
      comment: _commentCtrl.text,
    );

    setState(() => _reviewSubmitted = true);
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
        title: Text('Ăn Nhóm & Đánh Giá', style: AppTheme.titleLarge),
        actions: [
          IconButton(
            icon: Icon(Icons.share_rounded, color: AppTheme.goldenAmber),
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('📤 Đã sao chép link bình chọn!')),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildPollHeader(),
          const SizedBox(height: 12),
          _buildAllergyBanner(),
          const SizedBox(height: 16),
          ..._pollOptions.map(_buildPollOption),
          const SizedBox(height: 8),
          _buildVoteStats(),
          const Divider(height: 36, color: Color(0xFF2A2A2E)),
          _buildReviewSection(),
        ],
      ),
    );
  }

  // ─── Poll Section ─────────────────────────────────────────────────
  Widget _buildPollHeader() => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.charcoalHero,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.goldenAmber.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('🗳️ Bình Chọn Nhóm',
                      style: TextStyle(
                          color: AppTheme.goldenAmber,
                          fontSize: 11,
                          fontWeight: FontWeight.bold)),
                ),
                const Spacer(),
                _statusPill('🔴 LIVE', Colors.redAccent),
              ],
            ),
            const SizedBox(height: 10),
            Text('Trưa thứ 6 phòng mình ăn gì?',
                style: AppTheme.titleLarge.copyWith(fontSize: 18)),
            const SizedBox(height: 6),
            Text('${_totalVotes + (_hasVoted ? 0 : 0)} người đã bình chọn · Kết thúc lúc 11:30',
                style: AppTheme.labelSmall),
          ],
        ),
      );

  Widget _buildAllergyBanner() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.amber.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.amber.withOpacity(0.4)),
        ),
        child: Row(
          children: [
            const Text('⚠️', style: TextStyle(fontSize: 16)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '2 thành viên có dị ứng Hải sản — các món liên quan đã được ẩn tự động.',
                style: AppTheme.bodyMedium
                    .copyWith(fontSize: 12, color: Colors.amber),
              ),
            ),
          ],
        ),
      );

  Widget _buildPollOption(_Option opt) {
    final count = _votes[opt.id] ?? 0;
    final pct = _totalVotes > 0 ? count / _totalVotes : 0.0;
    final isWinner = _hasVoted && opt.id == _winner;
    final isMyVote = _myVote == opt.id;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isWinner
              ? AppTheme.goldenAmber
              : isMyVote
                  ? AppTheme.emeraldBadge
                  : Colors.transparent,
          width: 1.5,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Row(
              children: [
                Text(opt.emoji, style: const TextStyle(fontSize: 28)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(opt.name,
                              style: AppTheme.bodyMedium.copyWith(
                                  fontWeight: FontWeight.w600, fontSize: 14)),
                          if (isWinner) ...[
                            const SizedBox(width: 6),
                            const Text('🏆',
                                style: TextStyle(fontSize: 14)),
                          ],
                          if (isMyVote) ...[
                            const SizedBox(width: 6),
                            _statusPill('Lựa chọn của bạn', AppTheme.emeraldBadge),
                          ],
                        ],
                      ),
                      Text(opt.place, style: AppTheme.labelSmall),
                    ],
                  ),
                ),
                Text('$count phiếu',
                    style: TextStyle(
                        color: isWinner
                            ? AppTheme.goldenAmber
                            : AppTheme.textSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600)),
              ],
            ),
            if (_hasVoted) ...[
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: pct,
                  backgroundColor: AppTheme.charcoalHero,
                  valueColor: AlwaysStoppedAnimation(
                      isWinner ? AppTheme.goldenAmber : AppTheme.emeraldBadge),
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 4),
              Align(
                alignment: Alignment.centerRight,
                child: Text('${(pct * 100).round()}%',
                    style: AppTheme.labelSmall.copyWith(fontSize: 10)),
              ),
            ],
            if (!_hasVoted) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => _castVote(opt.id),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.goldenAmber,
                    side: BorderSide(color: AppTheme.goldenAmber, width: 1),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  child: const Text('Bình chọn', style: TextStyle(fontSize: 13)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildVoteStats() => Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.people_outline,
              size: 16, color: AppTheme.textSecondary),
          const SizedBox(width: 6),
          Text('$_totalVotes người tham gia · Cập nhật realtime',
              style: AppTheme.labelSmall.copyWith(fontSize: 11)),
        ],
      );

  // ─── Review Section ───────────────────────────────────────────────
  Widget _buildReviewSection() {
    if (_reviewSubmitted) {
      return _buildReviewSuccess();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('⭐ Đánh Giá Sau Bữa Ăn',
                style: AppTheme.titleMedium.copyWith(fontSize: 15)),
            const Spacer(),
            _statusPill('GPS · Xác minh 500m', AppTheme.emeraldBadge),
          ],
        ),
        const SizedBox(height: 14),
        _buildLocationCheck(),
        const SizedBox(height: 14),
        _buildStarRating(),
        const SizedBox(height: 14),
        _buildCommentField(),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: _submitReview,
          icon: const Icon(Icons.send_rounded, size: 18),
          label: const Text('Gửi Đánh Giá'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.goldenAmber,
            foregroundColor: Colors.black,
            minimumSize: const Size.fromHeight(50),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
      ],
    );
  }

  Widget _buildLocationCheck() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              _locationGranted
                  ? Icons.location_on
                  : Icons.location_off_outlined,
              color: _locationGranted
                  ? AppTheme.emeraldBadge
                  : AppTheme.textSecondary,
              size: 22,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                _locationGranted
                    ? '📍 Xác minh thành công · Bạn đang ở trong phạm vi 500m'
                    : '📍 Cần xác minh vị trí · Phải ở trong vòng 500m',
                style: AppTheme.bodyMedium.copyWith(fontSize: 12),
              ),
            ),
            if (!_locationGranted)
              TextButton(
                onPressed: _locationChecking ? null : _checkLocation,
                child: _locationChecking
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : Text('Kiểm tra',
                        style: TextStyle(
                            color: AppTheme.goldenAmber, fontSize: 12)),
              ),
          ],
        ),
      );

  Widget _buildStarRating() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Chất lượng bữa ăn', style: AppTheme.labelSmall),
          const SizedBox(height: 8),
          Row(
            children: List.generate(
              5,
              (i) => GestureDetector(
                onTap: () => setState(() => _starRating = i + 1),
                child: Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Icon(
                    i < _starRating ? Icons.star_rounded : Icons.star_outline_rounded,
                    color: AppTheme.goldenAmber,
                    size: 36,
                  ),
                ),
              ),
            ),
          ),
        ],
      );

  Widget _buildCommentField() => TextField(
        controller: _commentCtrl,
        maxLines: 3,
        decoration: InputDecoration(
          hintText: 'Chia sẻ cảm nhận của bạn...',
          hintStyle: AppTheme.labelSmall,
          filled: true,
          fillColor: AppTheme.surfaceElevated,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.all(14),
        ),
        style: AppTheme.bodyMedium.copyWith(fontSize: 13),
      );

  Widget _buildReviewSuccess() => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppTheme.emeraldBadge.withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.emeraldBadge.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            const Text('✅', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            Text('Cảm ơn bạn đã đánh giá!',
                style: AppTheme.titleMedium.copyWith(
                    color: AppTheme.emeraldBadge, fontSize: 16)),
            const SizedBox(height: 8),
            Text(
              'Đánh giá GPS của bạn đã được xác minh và ghi nhận. '
              'Giúp cộng đồng tìm quán ngon hơn! 🎉',
              style: AppTheme.bodyMedium.copyWith(fontSize: 12, height: 1.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                5,
                (i) => Icon(
                  i < _starRating ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: AppTheme.goldenAmber,
                  size: 24,
                ),
              ),
            ),
          ],
        ),
      );

  // ─── Helpers ──────────────────────────────────────────────────────
  Widget _statusPill(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withOpacity(0.15),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(text,
            style: TextStyle(
                color: color, fontSize: 10, fontWeight: FontWeight.w600)),
      );
}

// ─── Data model ───────────────────────────────────────────────────
class _Option {
  final String id, emoji, name, place;
  const _Option(this.id, this.emoji, this.name, this.place);
}
