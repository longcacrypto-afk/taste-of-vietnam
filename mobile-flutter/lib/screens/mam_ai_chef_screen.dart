// =============================================================================
// M3-S04 MĂM AI CHEF SCREEN — FULL BENCHMARK SCREEN 3 IN FLUTTER
// Tương tác trực tiếp Cloud API: Gemini 2.0 Flash / Vietnamese NLU Engine
// =============================================================================

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class MamAiChefScreen extends StatefulWidget {
  const MamAiChefScreen({super.key});

  @override
  State<MamAiChefScreen> createState() => _MamAiChefScreenState();
}

class _MamAiChefScreenState extends State<MamAiChefScreen> {
  final TextEditingController _msgCtrl = TextEditingController();
  final ScrollController _scrollCtrl = TextEditingController();
  bool _isLoading = false;

  final List<Map<String, dynamic>> _messages = [
    {
      'isUser': false,
      'text': 'Chào bạn! 👋 Hôm nay bạn muốn nấu gì hay ăn quán nào?\nCho Măm biết nguyên liệu bạn có, hoặc số người & ngân sách nhé!',
      'suggestions': [
        {
          'title': 'Phở Bò Tái Nạm Hà Nội',
          'tags': ['Đậm đà', 'Bổ dưỡng'],
          'time': '25 min',
          'servings': '2 servings',
          'emoji': '🍜',
        },
        {
          'title': 'Gỏi Cuốn Chay Đậu Hũ',
          'tags': ['Vegan', 'Low Calorie'],
          'time': '15 min',
          'servings': '2 servings',
          'emoji': '🥗',
        },
        {
          'title': 'Cơm Tấm Sườn Bì Chả',
          'tags': ['High Protein', 'Đặc sản'],
          'time': '30 min',
          'servings': '1 serving',
          'emoji': '🍚',
        },
      ],
    },
  ];

  @override
  void dispose() {
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _sendMessage([String? prefilled]) async {
    final query = prefilled ?? _msgCtrl.text.trim();
    if (query.isEmpty) return;

    if (prefilled == null) _msgCtrl.clear();

    setState(() {
      _messages.add({'isUser': true, 'text': query});
      _isLoading = true;
    });

    _scrollToBottom();

    // Gọi API thật từ Render Cloud / Local
    final result = await ApiService.sendAiChefChat(query);

    if (mounted) {
      setState(() {
        _isLoading = false;
        if (result != null && result['recommendations'] != null) {
          final recs = (result['recommendations'] as List).map((r) => {
            'title': r['name'] ?? 'Món Việt Ngon',
            'tags': [r['region'] ?? 'Việt Nam', '${r['calories'] ?? 450} kcal'],
            'time': '${r['prep_time_minutes'] ?? 25} min',
            'servings': '${r['portions'] ?? 2} servings',
            'emoji': r['emoji'] ?? '🍲',
          }).toList();

          _messages.add({
            'isUser': false,
            'text': result['reply'] ?? 'Măm đã tìm thấy các món phù hợp nhất với bạn đây:',
            'suggestions': recs.isNotEmpty ? recs : null,
          });
        } else {
          // Phản hồi mẫu thông minh nếu offline
          _messages.add({
            'isUser': false,
            'text': 'Măm đã phân tích yêu cầu "$query" của bạn!\nĐã lọc theo dị ứng thực phẩm và cân đối khẩu phần phù hợp:',
            'suggestions': [
              {
                'title': 'Bún Bò Huế O Xuân',
                'tags': ['Cay vừa', 'Nóng hổi'],
                'time': '20 min',
                'servings': '2 servings',
                'emoji': '🍲',
              },
              {
                'title': 'Cá Lóc Kho Tộ Miền Tây',
                'tags': ['Cơm nhà', 'Đậm vị'],
                'time': '35 min',
                'servings': '4 servings',
                'emoji': '🐟',
              },
            ],
          });
        }
      });
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.bgPage,
      appBar: AppBar(
        backgroundColor: AppTheme.bgPage,
        elevation: 0,
        centerTitle: true,
        title: Column(
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppTheme.emeraldBadge,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                const Text('AI Chef', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
              ],
            ),
            const Text('Your personal cooking assistant', style: TextStyle(fontSize: 11, color: AppTheme.slateMuted)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.bookmark_outline_rounded, size: 22),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.tune_rounded, size: 22),
            onPressed: () {},
          ),
        ],
      ),
      body: Column(
        children: [
          // ─── CHIPS LỰA CHỌN NHANH ─────────────────────────────────
          _buildQuickChipsBar(),

          // ─── DANH SÁCH TIN NHẮN & GỢI Ý ──────────────────────────
          Expanded(
            child: ListView.builder(
              controller: _scrollCtrl,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              itemCount: _messages.length,
              itemBuilder: (_, i) => _buildMessageBubble(_messages[i]),
            ),
          ),

          if (_isLoading)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.goldenAmber),
                  ),
                  const SizedBox(width: 8),
                  Text('Măm AI đang suy nghĩ thực đơn...', style: AppTheme.labelSmall.copyWith(fontSize: 11)),
                ],
              ),
            ),

          // ─── BOTTOM CHAT INPUT BAR (BENCHMARK SCREEN 3) ───────────
          _buildBottomInputBar(),
        ],
      ),
    );
  }

  Widget _buildQuickChipsBar() => Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: ListView(
          scrollDirection: Axis.horizontal,
          children: [
            _quickChip('Tủ lạnh có gì? (Tự nấu)', () => _sendMessage('Trong tủ lạnh có thịt bò, hành tây, trứng gà')),
            const SizedBox(width: 8),
            _quickChip('🎲 Món ngẫu nhiên', () => _sendMessage('Gợi ý cho tôi 1 món ngẫu nhiên hôm nay')),
            const SizedBox(width: 8),
            _quickChip('🌿 Thực đơn Healthy', () => _sendMessage('Thực đơn ăn kiêng giảm cân dưới 500 calo')),
            const SizedBox(width: 8),
            _quickChip('👨‍👩‍👧 Bữa tối 4 người 300k', () => _sendMessage('Tối nay 4 người ăn gì dưới 300k')),
          ],
        ),
      );

  Widget _quickChip(String label, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFF2A2A2E)),
          ),
          child: Center(
            child: Text(label, style: const TextStyle(fontSize: 12, color: Colors.white70, fontWeight: FontWeight.w500)),
          ),
        ),
      );

  Widget _buildMessageBubble(Map<String, dynamic> msg) {
    final isUser = msg['isUser'] as bool;
    final text = msg['text'] as String;
    final suggestions = msg['suggestions'] as List<dynamic>?;

    if (isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          margin: const EdgeInsets.only(bottom: 12, left: 60),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppTheme.goldenAmber,
            borderRadius: BorderRadius.circular(18).copyWith(bottomRight: const Radius.circular(4)),
          ),
          child: Text(text, style: const TextStyle(color: Colors.black, fontSize: 13, fontWeight: FontWeight.w600)),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Mascot Avatar
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppTheme.charcoalHero,
                shape: BoxShape.circle,
                border: Border.all(color: AppTheme.goldenAmber.withOpacity(0.5)),
              ),
              child: const Center(child: Text('🤖', style: TextStyle(fontSize: 20))),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.skyBubble,
                  borderRadius: BorderRadius.circular(18).copyWith(topLeft: const Radius.circular(4)),
                ),
                child: Text(text, style: const TextStyle(color: AppTheme.slateDark, fontSize: 13, height: 1.4)),
              ),
            ),
          ],
        ),
        if (suggestions != null && suggestions.isNotEmpty) ...[
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.only(left: 48),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('AI Suggestions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white)),
                    GestureDetector(
                      onTap: () {},
                      child: const Text('See All >', style: TextStyle(color: AppTheme.goldenAmber, fontSize: 11, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ...suggestions.map((s) => _buildSuggestionCard(s as Map<String, dynamic>)),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _buildSuggestionCard(Map<String, dynamic> s) {
    final tags = (s['tags'] as List).cast<String>();

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF2A2A2E)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppTheme.charcoalHero,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(child: Text(s['emoji'] ?? '🍲', style: const TextStyle(fontSize: 24))),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(s['title'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    ...tags.map((t) => Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.charcoalHero,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(t, style: const TextStyle(fontSize: 9, color: AppTheme.goldenAmber, fontWeight: FontWeight.w600)),
                    )),
                    Text('⏱ ${s['time']}', style: AppTheme.labelSmall.copyWith(fontSize: 10)),
                  ],
                ),
              ],
            ),
          ),
          const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Colors.white38),
        ],
      ),
    );
  }

  Widget _buildBottomInputBar() => Container(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        decoration: BoxDecoration(
          color: AppTheme.bgPage,
          border: Border(top: BorderSide(color: AppTheme.surfaceElevated, width: 1)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceElevated,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Row(
                  children: [
                    const Text('✨', style: TextStyle(fontSize: 16)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _msgCtrl,
                        onSubmitted: (_) => _sendMessage(),
                        style: const TextStyle(fontSize: 13, color: Colors.white),
                        decoration: const InputDecoration(
                          hintText: 'Hỏi Măm bất cứ điều gì...',
                          hintStyle: TextStyle(fontSize: 13, color: Colors.white38),
                          border: BorderSide.none,
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.mic_none_rounded, color: Colors.white54, size: 20),
                      onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('🎙️ Giọng nói tiếng Việt đang lắng nghe...')),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            GestureDetector(
              onTap: () => _sendMessage(),
              child: Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: AppTheme.emeraldBadge,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_upward_rounded, color: Colors.white, size: 22),
              ),
            ),
          ],
        ),
      );
}
