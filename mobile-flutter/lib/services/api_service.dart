// =============================================================================
// API SERVICE — LIVE BACKEND CLIENT FOR FLUTTER APP
// Hôm nay ăn gì · Taste of Vietnam v0.1
// Kết nối trực tiếp Render Cloud API & Local Development Gateway
// =============================================================================

import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Đường dẫn Production Render (Singapore) & Local Gateway
  static const String liveBaseUrl = 'https://taste-of-vietnam.onrender.com/api/v1';
  static const String localBaseUrl = 'http://127.0.0.1:3000/api/v1';

  static String baseUrl = liveBaseUrl;

  /// Đổi giữa Live Cloud và Local Development
  static void setUseLocal(bool useLocal) {
    baseUrl = useLocal ? localBaseUrl : liveBaseUrl;
  }

  // ─── 1. M3: GỢI Ý HÔM NAY (TODAY SUGGESTIONS) ───────────────────────────
  static Future<Map<String, dynamic>?> fetchTodaySuggestions({
    String? city,
    String? dietMode,
    List<String>? hardAllergies,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/suggestions/today').replace(queryParameters: {
        if (city != null) 'city': city,
        if (dietMode != null) 'diet': dietMode,
        if (hardAllergies != null && hardAllergies.isNotEmpty)
          'allergies': hardAllergies.join(','),
      });

      final res = await http.get(uri).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {
      // Fallback an toàn nếu offline
    }
    return null;
  }

  // ─── 2. M3: CHAT VỚI AI CHEF MĂM (GEMINI 2.0 FLASH / NLU) ────────────────
  static Future<Map<String, dynamic>?> sendAiChefChat(String message) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/chat'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'query': message}),
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

  // ─── 3. M4: DANH SÁCH QUÁN ĂN BÁN KÍNH 3KM (POSTGIS SPATIAL) ───────────
  static Future<List<dynamic>?> fetchNearbyPlaces({
    double lat = 10.9574,
    double lng = 106.8226,
    int radiusMeters = 3000,
  }) async {
    try {
      final uri = Uri.parse('$baseUrl/places').replace(queryParameters: {
        'lat': lat.toString(),
        'lng': lng.toString(),
        'radius': radiusMeters.toString(),
      });

      final res = await http.get(uri).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final data = jsonDecode(utf8.decode(res.bodyBytes));
        return data['places'] as List<dynamic>?;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

  // ─── 4. M11: THỰC ĐƠN 7 NGÀY & GIỎ ĐI CHỢ ───────────────────────────────
  static Future<Map<String, dynamic>?> fetchWeeklyMealPlan() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/meal-planner/weekly'),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

  // ─── 5. M12: BÌNH CHỌN ĂN NHÓM & XÁC MINH GPS 500M ─────────────────────
  static Future<Map<String, dynamic>?> voteGroupPoll(String pollId, String optionId) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/polls/$pollId/vote'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'option_id': optionId}),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

  static Future<Map<String, dynamic>?> submitGpsReview({
    required String placeId,
    required double lat,
    required double lng,
    required int rating,
    required String comment,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/reviews/gps'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'place_id': placeId,
          'lat': lat,
          'lng': lng,
          'rating': rating,
          'comment': comment,
        }),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

  // ─── 6. M13: ĐẶT BÀN VÀ XÁC NHẬN TỨC THÌ ───────────────────────────────
  static Future<Map<String, dynamic>?> createBooking(Map<String, dynamic> bookingData) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/bookings'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(bookingData),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200 || res.statusCode == 201) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

  // ─── 7. M16: DỊCH THỰC ĐƠN ĐA NGÔN NGỮ (AI MENU TRANSLATOR) ───────────
  static Future<Map<String, dynamic>?> translateMenu(String targetLang) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/translate/menu'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'target_lang': targetLang}),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

  // ─── 8. M17: BÁO CÁO DU LỊCH B2G (K-ANONYMITY INSIGHTS) ────────────────
  static Future<Map<String, dynamic>?> fetchB2gInsights() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/enterprise/tourism-insights'),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }
}
