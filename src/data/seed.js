// =============================================================================
// SEED DATABASE FOR "HÔM NAY ĂN GÌ · TASTE OF VIETNAM v0.1"
// =============================================================================

export function createInitialStore() {
  return {
    weather: {
      city: 'P. Bửu Long, TP. Biên Hòa',
      temp_c: 26,
      condition: 'rain_cool',
      label: '🌧️ 26°C · Trời dịu mát'
    },

    userProfile: {
      id: 'usr-long-01',
      name: 'Anh Long',
      phone: '+84912345678',
      lat: 10.9574,
      lng: 106.8426,
      radius_m: 3000,
      regions: ['bac', 'nam', 'trung'],
      spice_level: 1,
      hard_allergies: ['shrimp', 'peanut'], // Chặn cứng Tôm/Hải sản & Đậu phộng
      diet_mode: 'balanced',
      budget_min: 30000,
      budget_max: 65000,
      disliked_dish_ids: [],
      pdpd_consent: true,
      meal_reminders: { lunch: '10:30', dinner: '17:00', max_per_day: 2 }
    },

    dishes: [
      {
        id: 'DISH-101',
        name: 'Phở Bò Tái Nạm Hà Nội',
        region: 'bac',
        meal_slots: ['breakfast', 'lunch', 'dinner'],
        ref_price: 45000,
        calories: 480,
        macros: { carbs: 59, protein: 32, fat: 18 },
        prep_minutes: 25,
        difficulty: 'Dễ nấu',
        spice_level: 1,
        allergen_tags: [], // Safe!
        weather_fit: ['rain_cool', 'any'],
        tags: ['Nhanh 15p', 'Healthy'],
        img_key: '298',
        description: 'Nước dùng xương bò ninh thảo quả thơm dịu, thịt bò thăn mềm ngọt chuẩn vị truyền thống.',
        base_servings: 2,
        market_cost_base: 55000,
        ingredients: [
          { name: 'Bánh phở tươi', amount: 350, unit: 'g', img_key: '034' },
          { name: 'Thịt bò tái & nạm', amount: 250, unit: 'g', img_key: '298' },
          { name: 'Gừng & Hành tím nướng', amount: 40, unit: 'g', img_key: '304' },
          { name: 'Nước dùng xương bò', amount: 1.0, unit: 'lít', img_key: '310' }
        ],
        steps: [
          { step: 1, title: 'Nướng gia vị & Đun nước dùng', duration_min: 5, text: 'Nướng thơm gừng, hành tím, thảo quả rồi thả vào nồi nước dùng xương bò đun sôi lăn tăn.' },
          { step: 2, title: 'Chần bánh phở & Xếp thịt bò', duration_min: 3, text: 'Trụng bánh phở qua nước sôi 15 giây, xếp thịt bò thái mỏng lên trên và chan nước dùng đang sôi.' }
        ]
      },
      {
        id: 'DISH-102',
        name: 'Cơm Tấm Sườn Bì Chả',
        region: 'nam',
        meal_slots: ['breakfast', 'lunch', 'dinner'],
        ref_price: 40000,
        calories: 620,
        macros: { carbs: 68, protein: 34, fat: 22 },
        prep_minutes: 30,
        difficulty: 'Trung bình',
        spice_level: 0,
        allergen_tags: ['egg'],
        weather_fit: ['any', 'hot_sunny'],
        tags: ['Phổ biến', 'Chắc bụng'],
        img_key: '304',
        description: 'Sườn cốt lết ướp mật ong nướng than hoa thơm lừng, ăn kèm bì thính, chả trứng và đồ chua.',
        base_servings: 2,
        market_cost_base: 50000,
        ingredients: [
          { name: 'Gạo tấm thơm', amount: 300, unit: 'g', img_key: '304' },
          { name: 'Sườn cốt lết heo', amount: 300, unit: 'g', img_key: '298' },
          { name: 'Chả trứng hấp', amount: 120, unit: 'g', img_key: '034' },
          { name: 'Đồ chua & Nước mắm', amount: 60, unit: 'ml', img_key: '310' }
        ],
        steps: [
          { step: 1, title: 'Ướp & Nướng sườn cốt lết', duration_min: 15, text: 'Ướp sườn với sả băm, tỏi, mật ong, nước mắm 20 phút rồi nướng vàng hai mặt.' },
          { step: 2, title: 'Bày cơm tấm & Mỡ hành', duration_min: 5, text: 'Xới cơm tấm nóng ra dĩa, xếp sườn, bì, chả trứng và rưới mỡ hành.' }
        ]
      },
      {
        id: 'DISH-103',
        name: 'Bún Bò Huế O Xuân',
        region: 'trung',
        meal_slots: ['breakfast', 'lunch', 'dinner'],
        ref_price: 50000,
        calories: 520,
        macros: { carbs: 58, protein: 35, fat: 16 },
        prep_minutes: 35,
        difficulty: 'Trung bình',
        spice_level: 1,
        allergen_tags: [], // Safe!
        weather_fit: ['rain_cool', 'any'],
        tags: ['Giàu Đạm', 'Đậm đà'],
        img_key: '310',
        description: 'Nước dùng dậy mùi sả và mắm ruốc Huế dịu nhẹ, bắp bò giòn ngọt và chả cua bò.',
        base_servings: 2,
        market_cost_base: 65000,
        ingredients: [
          { name: 'Bún sợi to Huế', amount: 400, unit: 'g', img_key: '310' },
          { name: 'Bắp bò & Giò heo', amount: 300, unit: 'g', img_key: '298' },
          { name: 'Sả cây & Hành tây', amount: 50, unit: 'g', img_key: '034' },
          { name: 'Nước dùng hầm xương', amount: 1.2, unit: 'lít', img_key: '304' }
        ],
        steps: [
          { step: 1, title: 'Hầm bắp bò với sả đập dập', duration_min: 20, text: 'Hầm bắp bò cùng 4 cây sả đập dập cho mềm thơm.' },
          { step: 2, title: 'Trụng bún & Chan nước dùng', duration_min: 5, text: 'Trụng bún sợi to, xếp thịt bắp bò thái lát và chan nước dùng nóng.' }
        ]
      },
      {
        id: 'DISH-104',
        name: 'Bánh Mì Thịt Nướng Sài Gòn',
        region: 'nam',
        meal_slots: ['breakfast', 'lunch', 'snack'],
        ref_price: 25000,
        calories: 390,
        macros: { carbs: 44, protein: 21, fat: 14 },
        prep_minutes: 15,
        difficulty: 'Dễ nấu',
        spice_level: 1,
        allergen_tags: ['gluten'],
        weather_fit: ['any'],
        tags: ['Ăn nhanh 10p', 'Tiết kiệm'],
        img_key: '470',
        description: 'Bánh mì vỏ giòn rụm kẹp thịt nướng sả thơm lừng, đồ chua, dưa leo và ngò rí.',
        base_servings: 2,
        market_cost_base: 32000,
        ingredients: [
          { name: 'Ổ bánh mì giòn', amount: 2, unit: 'ổ', img_key: '470' },
          { name: 'Thịt heo nướng sả', amount: 180, unit: 'g', img_key: '304' },
          { name: 'Đồ chua cà rốt củ cải', amount: 60, unit: 'g', img_key: '034' },
          { name: 'Ngò rí & Dưa leo', amount: 40, unit: 'g', img_key: '310' }
        ],
        steps: [
          { step: 1, title: 'Nướng giòn bánh mì & Thịt', duration_min: 5, text: 'Làm nóng giòn vỏ bánh mì, xếp thịt nướng, đồ chua và rưới nước sốt.' }
        ]
      },
      {
        id: 'DISH-105',
        name: 'Canh Chua Cá Lóc Miền Tây',
        region: 'nam',
        meal_slots: ['lunch', 'dinner'],
        ref_price: 45000,
        calories: 340,
        macros: { carbs: 28, protein: 30, fat: 11 },
        prep_minutes: 25,
        difficulty: 'Dễ nấu',
        spice_level: 1,
        allergen_tags: [], // Cá đồng nước ngọt (không phải Tôm/Giáp xác)
        weather_fit: ['rain_cool', 'hot_sunny', 'any'],
        tags: ['Cơm gia đình', 'Ít béo'],
        img_key: '592',
        description: 'Vị chua thanh từ me chín và thơm (dứa), cá lóc đồng chắc thịt cùng bạc hà, đậu bắp, giá đỗ.',
        base_servings: 2,
        market_cost_base: 55000,
        ingredients: [
          { name: 'Cá lóc đồng làm sạch', amount: 400, unit: 'g', img_key: '592' },
          { name: 'Thơm (dứa) & Cà chua', amount: 200, unit: 'g', img_key: '304' },
          { name: 'Bạc hà, Đậu bắp, Giá', amount: 180, unit: 'g', img_key: '034' },
          { name: 'Me vắt & Ngò ôm', amount: 40, unit: 'g', img_key: '310' }
        ],
        steps: [
          { step: 1, title: 'Nấu nước cốt me & Cá lóc', duration_min: 10, text: 'Đun sôi nước cốt me với thơm và cà chua, thả cá lóc vào nấu chín.' },
          { step: 2, title: 'Cho rau canh chua & Nêm nếm', duration_min: 5, text: 'Thả đậu bắp, bạc hà, giá đỗ và rắc ngò ôm, tỏi phi thơm.' }
        ]
      },
      {
        id: 'DISH-106',
        name: 'Bún Riêu Cua Tôm Giò',
        region: 'bac',
        meal_slots: ['breakfast', 'lunch'],
        ref_price: 45000,
        calories: 470,
        macros: { carbs: 52, protein: 29, fat: 15 },
        prep_minutes: 30,
        difficulty: 'Trung bình',
        spice_level: 1,
        allergen_tags: ['shrimp'], // Chứa Tôm/Cua -> Phải bị chặn bởi Hard Filter!
        weather_fit: ['rain_cool', 'any'],
        tags: ['Truyền thống', 'Hải sản'],
        img_key: '310',
        description: 'Món chứa tôm và cua đồng (dùng để kiểm thử bộ lọc cứng dị ứng QA-10).',
        base_servings: 2,
        market_cost_base: 60000,
        ingredients: [
          { name: 'Tôm tươi & Cua đồng', amount: 300, unit: 'g', img_key: '310' },
          { name: 'Bún rối & Đậu hũ', amount: 350, unit: 'g', img_key: '034' }
        ],
        steps: [{ step: 1, title: 'Nấu riêu cua tôm', duration_min: 15, text: 'Lọc riêu cua và nấu cùng cà chua.' }]
      },
      {
        id: 'DISH-107',
        name: 'Gỏi Cuốn Tôm Thịt Sốt Đậu Phộng',
        region: 'nam',
        meal_slots: ['lunch', 'snack'],
        ref_price: 35000,
        calories: 290,
        macros: { carbs: 36, protein: 18, fat: 8 },
        prep_minutes: 15,
        difficulty: 'Dễ nấu',
        spice_level: 0,
        allergen_tags: ['shrimp', 'peanut'], // Chứa cả Tôm & Đậu phộng -> Phải bị chặn!
        weather_fit: ['hot_sunny'],
        tags: ['Thanh mát', 'Low Calorie'],
        img_key: '034',
        description: 'Món chứa tôm và đậu phộng (dùng để kiểm thử bộ lọc cứng dị ứng QA-10).',
        base_servings: 2,
        market_cost_base: 40000,
        ingredients: [],
        steps: []
      },
      {
        id: 'DISH-108',
        name: 'Bò Hầm Rau Củ & Bánh Mì (Trẻ Nhỏ Mê)',
        region: 'nam',
        meal_slots: ['lunch', 'dinner'],
        ref_price: 55000,
        calories: 510,
        macros: { carbs: 48, protein: 36, fat: 16 },
        prep_minutes: 30,
        difficulty: 'Dễ nấu',
        spice_level: 0, // Không cay, hợp trẻ nhỏ!
        allergen_tags: [],
        weather_fit: ['rain_cool', 'any'],
        tags: ['Gia đình & Bé', 'Giàu Đạm'],
        img_key: '034',
        description: 'Thịt bò hầm mềm ngọt cùng khoai tây, cà rốt, hoàn toàn không cay, rất hợp gia đình có trẻ nhỏ.',
        base_servings: 4,
        market_cost_base: 160000,
        ingredients: [
          { name: 'Thịt bò bắp hoa', amount: 500, unit: 'g', img_key: '298' },
          { name: 'Khoai tây & Cà rốt', amount: 400, unit: 'g', img_key: '304' },
          { name: 'Cà chua & Hành tây', amount: 200, unit: 'g', img_key: '034' }
        ],
        steps: [
          { step: 1, title: 'Hầm mềm thịt bò với cà rốt khoai tây', duration_min: 25, text: 'Hầm lửa nhỏ cho thịt bò và rau củ mềm ngọt tự nhiên.' }
        ]
      }
    ],

    places: [
      {
        id: 'PLACE-401',
        name: 'Phở Gia Truyền Phát Tài',
        address: '128 Huỳnh Văn Nghệ, P. Bửu Long, Biên Hòa',
        lat: 10.9598,
        lng: 106.8452, // ~400m from user
        open_hour: 6,
        close_hour: 22,
        is_open_override: true,
        is_verified: true,
        rating: 4.8,
        review_count: 150,
        has_ac: true,
        has_kids_seat: true,
        closed_report_count: 0,
        phone: '02513845999',
        img_key: '477',
        links: {
          grabfood: 'https://food.grab.com/vn/vi/restaurant/pho-phat-tai',
          shopeefood: 'https://shopeefood.vn/bien-hoa/pho-phat-tai',
          befood: 'https://be.com.vn/befood/pho-phat-tai',
          xanhsm: 'https://xanhsm.com/ngon/pho-phat-tai',
          maps: 'https://maps.google.com/?q=10.9598,106.8452'
        },
        menu: [
          { dish_id: 'DISH-101', name: 'Phở bò tái nạm', price: 45000, available: true },
          { dish_id: 'DISH-108', name: 'Combo Phở & Bò hầm gia đình 4 người', price: 240000, available: true }
        ]
      },
      {
        id: 'PLACE-402',
        name: 'Cơm Tấm Bụi Sài Gòn',
        address: '82 Nguyễn Ái Quốc, P. Tân Tiến, Biên Hòa',
        lat: 10.9612,
        lng: 106.8460, // ~550m from user
        open_hour: 6,
        close_hour: 21,
        is_open_override: true,
        is_verified: true,
        rating: 4.7,
        review_count: 210,
        has_ac: true,
        has_kids_seat: true,
        closed_report_count: 0,
        phone: '02513888222',
        img_key: '304',
        links: {
          grabfood: 'https://food.grab.com/vn/vi/restaurant/com-tam-bui',
          shopeefood: 'https://shopeefood.vn/bien-hoa/com-tam-bui',
          befood: 'https://be.com.vn/befood/com-tam-bui',
          xanhsm: 'https://xanhsm.com/ngon/com-tam-bui',
          maps: 'https://maps.google.com/?q=10.9612,106.8460'
        },
        menu: [
          { dish_id: 'DISH-102', name: 'Cơm tấm sườn bì chả', price: 40000, available: true },
          { dish_id: 'DISH-105', name: 'Set Cơm gia đình Canh chua cá lóc (4 người)', price: 265000, available: true }
        ]
      },
      {
        id: 'PLACE-403',
        name: 'Bún Bò Huế O Xuân',
        address: '45 Võ Thị Sáu, P. Quyết Thắng, Biên Hòa',
        lat: 10.9530,
        lng: 106.8390, // ~650m from user
        open_hour: 6,
        close_hour: 22,
        is_open_override: true,
        is_verified: true,
        rating: 4.9,
        review_count: 185,
        has_ac: false,
        has_kids_seat: true,
        closed_report_count: 0,
        phone: '02513999111',
        img_key: '310',
        links: {
          grabfood: 'https://food.grab.com/vn/vi/restaurant/bun-bo-o-xuan',
          shopeefood: 'https://shopeefood.vn/bien-hoa/bun-bo-o-xuan',
          befood: 'https://be.com.vn/befood/bun-bo-o-xuan',
          xanhsm: 'https://xanhsm.com/ngon/bun-bo-o-xuan',
          maps: 'https://maps.google.com/?q=10.9530,106.8390'
        },
        menu: [
          { dish_id: 'DISH-103', name: 'Bún bò Huế đặc biệt', price: 50000, available: true }
        ]
      },
      {
        id: 'PLACE-404',
        name: 'Tiệm Bánh Mì Cô Ba',
        address: '19 Cách Mạng Tháng 8, Biên Hòa',
        lat: 10.9560,
        lng: 106.8410, // ~320m from user
        open_hour: 6,
        close_hour: 21,
        is_open_override: true,
        is_verified: true,
        rating: 4.8,
        review_count: 98,
        has_ac: false,
        has_kids_seat: false,
        closed_report_count: 0,
        phone: '02513777333',
        img_key: '470',
        links: {
          grabfood: 'https://food.grab.com/vn/vi/restaurant/banh-mi-co-ba',
          maps: 'https://maps.google.com/?q=10.9560,106.8410'
        },
        menu: [
          { dish_id: 'DISH-104', name: 'Bánh mì thịt nướng Sài Gòn', price: 25000, available: true }
        ]
      },
      {
        id: 'PLACE-405',
        name: 'Bánh Canh Cua Cô Ba (Nghỉ Bán Tối)',
        address: '99 Phạm Văn Thuận, P. Tân Hiệp, Biên Hòa',
        lat: 10.9585,
        lng: 106.8440,
        open_hour: 6,
        close_hour: 14,
        is_open_override: false, // Đã đóng cửa -> Phải bị lọc bởi QA-09!
        is_verified: true,
        rating: 4.5,
        review_count: 64,
        has_ac: false,
        has_kids_seat: false,
        closed_report_count: 3, // >= 3 báo cáo đóng cửa!
        phone: '02513666444',
        img_key: '477',
        links: {},
        menu: [
          { dish_id: 'DISH-101', name: 'Phở bò tái', price: 45000, available: false }
        ]
      }
    ],

    campaigns: [
      {
        id: 'CMP-701',
        place_id: 'PLACE-403',
        dish_id: 'DISH-103', // Bún bò Huế O Xuân (Safe, no shrimp/peanut)
        title: 'Bún Bò Huế Ngày Mưa Mát',
        badge_label: 'Tài trợ',
        radius_m: 3000,
        budget_monthly_vnd: 1500000,
        impressions: 18420,
        clicks: 1252,
        conversions: 412,
        roas: 7.0,
        status: 'active'
      },
      {
        id: 'CMP-702',
        place_id: 'PLACE-401',
        dish_id: 'DISH-106', // Bún Riêu Cua Tôm (Chứa 'shrimp' -> Phải bị chặn khi user dị ứng shrimp!)
        title: 'Bún Riêu Tôm Cua Đồng',
        badge_label: 'Tài trợ',
        radius_m: 3000,
        budget_monthly_vnd: 1200000,
        impressions: 5400,
        clicks: 310,
        conversions: 85,
        roas: 4.5,
        status: 'active'
      }
    ],

    suggestionHistory: [
      {
        id: 'hist-01',
        dish_id: 'DISH-102',
        dish_name: 'Cơm Tấm Sườn Bì Chả',
        place_id: 'PLACE-402',
        place_name: 'Cơm Tấm Bụi Sài Gòn',
        price_vnd: 40000,
        action: 'liked',
        created_at: new Date(Date.now() - 86400000 * 4).toISOString() // 4 ngày trước
      }
    ],

    ocrQueue: [
      {
        id: 'ocr-901',
        place_id: 'PLACE-401',
        place_name: 'Phở Gia Truyền Phát Tài',
        raw_text: 'Phở tái lăn gầu giòn 55K',
        extracted_name: 'Phở tái lăn gầu giòn',
        extracted_price: 55000,
        matched_dish_id: 'DISH-101',
        matched_dish_name: 'Phở Bò Tái Nạm Hà Nội',
        confidence: 0.92,
        status: 'pending_review'
      },
      {
        id: 'ocr-902',
        place_id: 'PLACE-402',
        place_name: 'Cơm Tấm Bụi Sài Gòn',
        raw_text: 'Cơm sườn trứng ốp la 42K',
        extracted_name: 'Cơm sườn trứng ốp la',
        extracted_price: 42000,
        matched_dish_id: 'DISH-102',
        matched_dish_name: 'Cơm Tấm Sườn Bì Chả',
        confidence: 0.94,
        status: 'pending_review'
      }
    ],

    userReports: [
      {
        id: 'rep-501',
        place_id: 'PLACE-405',
        place_name: 'Bánh Canh Cua Cô Ba (Nghỉ Bán Tối)',
        reason: 'Quán hiện đang đóng cửa / Nghỉ bán buổi tối',
        report_count: 3,
        status: 'auto_paused',
        created_at: new Date().toISOString()
      }
    ],

    analyticsEvents: {
      app_open: 48200,
      suggestion_shown: 48200,
      suggestion_swiped: 12400,
      dish_view: 30944,
      recipe_view: 11240,
      place_view: 20147,
      order_click: 4820,
      direction_click: 4554,
      call_click: 1471,
      chat_query: 9420,
      save_dish: 6810,
      ad_impression: 18420,
      ad_click: 1252,
      report_issue: 84
    }
  };
}
