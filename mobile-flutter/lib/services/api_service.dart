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

  static Future<Map<String, dynamic>?> sendSuggestionFeedback({
    required String dishId,
    required String action,
    String? skipReason,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/suggestions/feedback'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'dish_id': dishId,
          'action': action,
          if (skipReason != null) 'skip_reason': skipReason,
        }),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
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
        return (data['items'] ?? data['places']) as List<dynamic>?;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

  static Future<bool> reportPlaceClosed(String placeId) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/places/$placeId/reports'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 5));
      return res.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  // ─── 4. M11: THỰC ĐƠN 7 NGÀY (3 BỮA x GIA ĐÌNH) & GIỎ ĐI CHỢ ──────────────
  static Future<Map<String, dynamic>?> fetchWeeklyMealPlan({int familySize = 4, int mealsPerDay = 3}) async {
    try {
      final uri = Uri.parse('$baseUrl/meal-planner/weekly').replace(queryParameters: {
        'family_size': familySize.toString(),
        'meals_per_day': mealsPerDay.toString(),
      });
      final res = await http.get(uri).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

  // ─── 5. M12: BÌNH CHỌN ĂN NHÓM & XÁC MINH GPS 500M ─────────────────────
  static Future<Map<String, dynamic>?> fetchGroupPoll([String? pollId]) async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/polls'),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

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

  // ─── 9. M7: THANH TOÁN VIETQR / PAYOS TỰ ĐỘNG NẠP TIỀN QUẢNG CÁO ─────────
  static Future<Map<String, dynamic>?> createVietQrInvoice({
    required String campaignId,
    required int amountVnd,
    String? description,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/ads/payments/vietqr/create'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'campaign_id': campaignId,
          'amount_vnd': amountVnd,
          'description': description,
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

  // ─── 10. M2: TÌM KIẾM NGỮ NGHĨA SEMANTIC DISH SEARCH (PGVECTOR / NLU) ─────
  static Future<Map<String, dynamic>?> searchDishesSemantically(String query) async {
    try {
      final uri = Uri.parse('$baseUrl/dishes/semantic-search').replace(queryParameters: {'q': query});
      final res = await http.get(uri).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

  // ─── 11. M1: HỒ SƠ KHẨU VỊ & BẢO VỆ DỮ LIỆU PDPD (NGHỊ ĐỊNH 13/2023/NĐ-CP) ──
  static Future<Map<String, dynamic>?> fetchUserProfile() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/me/profile')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> updateUserProfile(Map<String, dynamic> data) async {
    try {
      final res = await http.put(
        Uri.parse('$baseUrl/me/profile'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(data),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> deleteUserAccount() async {
    try {
      final res = await http.delete(Uri.parse('$baseUrl/me')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 12. M8: NHẮC NHỞ BỮA ĂN & THÔNG BÁO THỜI TIẾT ────────────────────────
  static Future<Map<String, dynamic>?> fetchNotifications() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/notifications')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> updateMealReminderSchedule(Map<String, dynamic> schedule) async {
    try {
      final res = await http.put(
        Uri.parse('$baseUrl/me/meal-schedule'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(schedule),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 13. M18: TỦ LẠNH THÔNG MINH & QUÉT MÃ VẠCH IOT ───────────────────────
  static Future<Map<String, dynamic>?> fetchFridgeInventory() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/fridge/inventory')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> scanFridgeItem({
    String barcode = '8934567890123',
    String? itemName,
    int expiresInDays = 3,
    String compartment = 'chill',
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/fridge/scan'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'barcode': barcode,
          if (itemName != null) 'item_name': itemName,
          'expires_in_days': expiresInDays,
          'compartment': compartment,
        }),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 14. M19: TRỢ LÝ DINH DƯỠNG & ĐỒNG BỘ WEARABLES ────────────────────────
  static Future<Map<String, dynamic>?> fetchHealthProfile() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/health/nutrition-profile')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> syncHealthWearable({
    String wearable = 'Apple Health',
    int dailySteps = 8420,
    int activeCalories = 480,
    String goal = 'maintain',
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/health/sync'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'wearable': wearable,
          'daily_steps': dailySteps,
          'active_calories_burned': activeCalories,
          'goal': goal,
        }),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 15. M20: BẾP SÁNG TẠO & MẠNG XÃ HỘI CÔNG THỨC NẤU ĂN ─────────────────
  static Future<Map<String, dynamic>?> fetchCommunityRecipes({String? tag}) async {
    try {
      final uri = Uri.parse('$baseUrl/community/recipes').replace(queryParameters: {
        if (tag != null) 'tag': tag,
      });
      final res = await http.get(uri).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> tipCommunityRecipe(String recipeId, int amountVnd) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/community/recipes/$recipeId/tip'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'amount_vnd': amountVnd}),
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 16. M1-S09: XUẤT DỮ LIỆU PDPD (Nghị định 13/2023/NĐ-CP) ─────────────
  static Future<Map<String, dynamic>?> exportPersonalData() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/me/export'),
      ).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 17. M2: TÌM KIẾM NGỮ NGHĨA SEMANTIC DISH SEARCH ───────────────────────
  static Future<Map<String, dynamic>?> semanticSearchDishes(String query) async {
    try {
      final uri = Uri.parse('$baseUrl/dishes/semantic-search').replace(queryParameters: {'q': query});
      final res = await http.get(uri).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 18. M14: CÂU CHUYỆN MÓN ĂN & BIẾN THỂ VÙNG MIỀN ──────────────────────
  static Future<Map<String, dynamic>?> fetchDishStory(String dishId) async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/dishes/$dishId/story'),
      ).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> fetchRegionalVariants(String dishId) async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/dishes/$dishId/regional-variants'),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 19. M15: FOOD TRAIL & HỘ CHIẾU ẨM THỰC ────────────────────────────────
  static Future<Map<String, dynamic>?> fetchFoodTrails() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/tourism/trails')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> stampFoodPassport(String trailId, String stationId) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/tourism/passport/checkin'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'trail_id': trailId, 'station_id': stationId}),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 20. M17: B2G ENTERPRISE INSIGHTS ──────────────────────────────────────
  static Future<Map<String, dynamic>?> fetchEnterpriseInsights() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/enterprise/tourism-insights')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 21. M7-S07: GIÁM SÁT CHỐNG CLICK TẶC ──────────────────────────────────
  static Future<Map<String, dynamic>?> fetchFraudLogs() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/ads/fraud-logs')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 22. M9: RBAC QUẢN LÝ PHÂN QUYỀN ───────────────────────────────────────
  static Future<Map<String, dynamic>?> fetchRbacRoles() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/admin/rbac/roles')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 23. M6-S07: MÓN ĐẶC BIỆT HÔM NAY ─────────────────────────────────────
  static Future<Map<String, dynamic>?> fetchDailySpecial() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/merchant/daily-special')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> tagDailySpecial({
    required String dishId,
    String? label,
    int? specialPrice,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/merchant/daily-special'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'dish_id': dishId, if (label != null) 'label': label, if (specialPrice != null) 'special_price': specialPrice}),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 24. M10: A/B TESTING ANALYTICS ─────────────────────────────────────────
  static Future<Map<String, dynamic>?> fetchAbTestResults() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/analytics/ab-test')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 25. M1: AUTH OTP & GUEST MODE ──────────────────────────────────────────
  static Future<Map<String, dynamic>?> verifyOtp(String phone, String otp) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/auth/otp/verify'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'phone': phone, 'otp': otp}),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> loginGuest() async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/auth/guest'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 26. M2: CHI TIẾT MÓN, BỘ SƯU TẬP & MÓN TƯƠNG TỰ ───────────────────────
  static Future<Map<String, dynamic>?> fetchDishDetail(String dishId, {int servings = 2}) async {
    try {
      final uri = Uri.parse('$baseUrl/dishes/$dishId').replace(queryParameters: {'servings': servings.toString()});
      final res = await http.get(uri).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> saveToCollection(String dishId) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/me/collections'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'dish_id': dishId}),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> fetchSimilarDishes(String dishId) async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/dishes/$dishId/similar')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 27. M3: VÒNG QUAY GỢI Ý (SPIN) ─────────────────────────────────────────
  static Future<Map<String, dynamic>?> spinSuggestion() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/suggestions/spin')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 28. M5: ĐẶT MÓN DEEP-LINK & LOOPBACK COOLDOWN 3 NGÀY ───────────────────
  static Future<Map<String, dynamic>?> redirectOrder({
    required String placeId,
    required String dishId,
    required String platform,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/orders/redirect'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'place_id': placeId, 'dish_id': dishId, 'platform': platform}),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> confirmOrderEaten(String orderId, String dishId) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/orders/$orderId/confirm-eaten'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'dish_id': dishId}),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 29. M6 & M7: MERCHANT OCR & CHIẾN DỊCH QUẢNG CÁO ──────────────────────
  static Future<Map<String, dynamic>?> scanMenuOcr(String placeId, String rawText) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/merchant/menu/ocr'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'place_id': placeId, 'raw_text': rawText}),
      ).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> createAdCampaign({
    required String placeId,
    required String dishId,
    required int budgetVnd,
    int radiusM = 3000,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/ads/campaigns'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'place_id': placeId,
          'dish_id': dishId,
          'budget_vnd': budgetVnd,
          'radius_m': radiusM,
        }),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 30. M9: ADMIN OCR REVIEW & MỞ LẠI QUÁN ────────────────────────────────
  static Future<Map<String, dynamic>?> reviewOcrQueue({
    required String ocrId,
    required String decision,
    String? reason,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/admin/ocr-review'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'ocr_id': ocrId, 'decision': decision, if (reason != null) 'reason': reason}),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  static Future<Map<String, dynamic>?> unpausePlace(String placeId) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/admin/places/$placeId/unpause'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 31. M13: DANH SÁCH VOUCHER ─────────────────────────────────────────────
  static Future<Map<String, dynamic>?> fetchVouchers() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/vouchers')).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 32. M18: GEMINI VISION PHÂN TÍCH ẢNH TỦ LẠNH / MENU ───────────────────
  static Future<Map<String, dynamic>?> analyzeVisionImage({
    String context = 'fridge',
    String imageBase64 = '',
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/vision/analyze'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'context': context, 'image_base64': imageBase64}),
      ).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }

  // ─── 33. M20: ĐĂNG CÔNG THỨC CỘNG ĐỒNG MỚI ────────────────────────────────
  static Future<Map<String, dynamic>?> createCommunityRecipe({
    required String title,
    String author = 'Đầu Bếp Gia Đình',
    int prepTimeMinutes = 25,
    int calories = 450,
    String? zeroWasteTag,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/community/recipes'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'title': title,
          'author': author,
          'prep_time_minutes': prepTimeMinutes,
          'calories': calories,
          if (zeroWasteTag != null) 'zero_waste_tag': zeroWasteTag,
        }),
      ).timeout(const Duration(seconds: 5));
      if (res.statusCode == 201 || res.statusCode == 200) {
        return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      }
    } catch (e) {}
    return null;
  }
}
