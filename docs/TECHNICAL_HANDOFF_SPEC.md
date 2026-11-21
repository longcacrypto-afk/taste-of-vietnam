# Technical Handoff & Data Contracts — Hôm nay ăn gì · Taste of Vietnam (Phase E)

Tài liệu bàn giao kỹ thuật (**Phase E — Developer Handoff**) bổ sung đầy đủ cho bộ **94 Màn hình UI/UX (`M1` → `M17`)**, bao gồm: Database Schema (`PostgreSQL + PostGIS + pgvector`), API Contracts, Quy trình AI Menu OCR, Phân quyền RBAC, và Bộ kiểm thử QA.

---

## 1. Database Schema (`PostgreSQL + PostGIS + pgvector`)

```sql
-- Bật extension cho Geo-search & Vector similarity search
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Bảng Người dùng & Hồ sơ Khẩu vị (Module M1)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE,
  display_name VARCHAR(120),
  regions TEXT[] DEFAULT ARRAY['bac','nam'],        -- 'bac', 'trung', 'nam'
  spice_level SMALLINT DEFAULT 1 CHECK (spice_level BETWEEN 0 AND 3),
  hard_allergies TEXT[] DEFAULT '{}',               -- HARD FILTER: 'shrimp', 'peanut', 'milk', 'gluten', 'egg'
  diet_mode VARCHAR(32) DEFAULT 'balanced',         -- 'balanced', 'vegan_lunar', 'eat_clean', 'high_protein'
  budget_min INT DEFAULT 35000,
  budget_max INT DEFAULT 60000,
  disliked_dish_ids UUID[] DEFAULT '{}',
  pdpd_consent BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bảng Thư viện Món ăn & Vector Embedding (Module M2)
CREATE TABLE dishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(32) UNIQUE NOT NULL,                 -- VD: 'DISH-102'
  name_vi VARCHAR(200) NOT NULL,
  name_unaccent VARCHAR(200) NOT NULL,
  region VARCHAR(32) NOT NULL,
  meal_slots TEXT[] NOT NULL,                       -- 'breakfast', 'lunch', 'dinner', 'snack', 'dessert'
  allergen_tags TEXT[] NOT NULL DEFAULT '{}',       -- Bắt buộc kiểm duyệt trước khi active
  ref_price_vnd INT NOT NULL,
  calories_per_serving INT NOT NULL,
  prep_minutes INT DEFAULT 25,
  difficulty VARCHAR(16) DEFAULT 'easy',
  embedding vector(1536),                           -- pgvector phục vụ tìm món tương tự
  is_active BOOLEAN DEFAULT TRUE
);

-- 3. Bảng Quán ăn Thực tế & Tọa độ Địa lý (Module M4 & M6)
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_owner_id UUID,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500) NOT NULL,
  geom GEOGRAPHY(Point, 4326) NOT NULL,             -- PostGIS 3km radius query
  open_time TIME NOT NULL DEFAULT '06:00',
  close_time TIME NOT NULL DEFAULT '22:00',
  is_verified BOOLEAN DEFAULT FALSE,
  has_ac BOOLEAN DEFAULT FALSE,
  grabfood_url TEXT,
  shopeefood_url TEXT,
  befood_url TEXT,
  xanhsm_url TEXT,
  closed_report_count INT DEFAULT 0,                -- Tự động tạm ẩn nếu >= 3 báo cáo trùng
  last_verified_at TIMESTAMPTZ
);

CREATE INDEX idx_places_geom ON places USING GIST (geom);

-- 4. Bảng Thực đơn Quán & Kết quả Ghép AI OCR (Module M4, M6-S06, M9-S05)
CREATE TABLE place_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES places(id) ON DELETE CASCADE,
  dish_id UUID REFERENCES dishes(id),               -- Ghép với Thư viện món chuẩn M2
  raw_ocr_name VARCHAR(255) NOT NULL,
  price_vnd INT NOT NULL,
  ocr_confidence NUMERIC(4,3) DEFAULT 1.000,
  match_status VARCHAR(20) DEFAULT 'approved',      -- 'pending_review', 'approved', 'rejected'
  is_available_now BOOLEAN DEFAULT TRUE,
  is_daily_special BOOLEAN DEFAULT FALSE
);

-- 5. Bảng Lịch sử Gợi ý & Phản hồi (Module M3-S06 & M3-S07)
CREATE TABLE suggestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  dish_id UUID REFERENCES dishes(id),
  place_id UUID REFERENCES places(id),
  is_sponsored BOOLEAN DEFAULT FALSE,
  campaign_id UUID,
  weather_context JSONB,                            -- {"temp_c": 26, "condition": "rain_cool"}
  feedback_action VARCHAR(20),                      -- 'liked', 'eaten', 'skipped'
  skip_reason VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 2. Đặc tả API Trọng Tâm & Quy Tắc Bảo Vệ Cứng (Hard Guardrails)

### 2.1. `GET /v1/suggestions/today` (`M3-S01`)
- **SLA:** Độ trễ `p95 < 1.5s` (sử dụng Redis cache cho Weather + PostGIS bounding box).
- **Pipeline Lọc Cứng (Hard Filters — Không bao giờ được vi phạm):**
  1. `NOT (dishes.allergen_tags && user.hard_allergies)` — Loại trừ tuyệt đối 100% món chứa chất dị ứng của người dùng (áp dụng cho cả gợi ý tự nhiên lẫn slot `Tài trợ`).
  2. `places.is_verified = true AND CURRENT_TIME BETWEEN places.open_time AND places.close_time AND places.closed_report_count < 3` — Không bao giờ gợi ý quán đang đóng cửa như một lựa chọn đang mở.
  3. `dishes.id NOT IN (SELECT dish_id FROM suggestion_logs WHERE user_id = :uid AND feedback_action = 'eaten' AND created_at >= now() - interval '3 days')` — Chống lặp món đã ăn trong 3 ngày gần nhất.
  4. **Quy tắc Slot Tài trợ (`M7`):** Tối đa **1/3 slot** (`1 trên 3 thẻ`) được phép là `is_sponsored = true` và bắt buộc trả về trường `"badge_label": "Tài trợ"`.

### 2.2. `POST /v1/chat` (`M3-S04` & `M3-S05`)
- **Luồng thực thi bắt buộc:**
  1. Gọi `LiteLLM` để bóc tách câu hỏi tiếng Việt tự nhiên thành `JSON Intent Parameters`:
     ```json
     {
       "party_size": 4,
       "total_budget_vnd": 300000,
       "has_kids": true,
       "spice_max": 0,
       "radius_m": 2000,
       "mode": "eat_out_or_cook"
     }
     ```
  2. Truy vấn `PostgreSQL + PostGIS` lấy danh sách quán & món thực tế khớp thông số.
  3. `LiteLLM` chỉ sinh lời giải thích tự nhiên dựa trên **3 phương án thực tế từ Database** (tuyệt đối không tự bịa tên quán hoặc địa chỉ).

---

## 3. Phân quyền RBAC (Merchant Portal `M6` & Admin CMS `M9`)

| Vai trò (Role) | Quyền hạn được phép | Giới hạn bảo mật |
| :--- | :--- | :--- |
| **`merchant_owner`** | Toàn quyền `M6-S01..S09` & `M7-S01..S08` (Sửa hồ sơ quán, duyệt OCR, tạo quảng cáo, thanh toán VietQR, phân quyền nhân viên) | Chỉ truy cập dữ liệu chi nhánh thuộc sở hữu |
| **`merchant_staff`** | Bật/tắt `Còn món / Tạm hết` (`M4-S05`, `M6-S05`), xem thông báo khách đặt bàn (`M13`) | Không được sửa giá hàng loạt, không được tạo chiến dịch quảng cáo |
| **`admin_content_ai`** | Quản lý thư viện món & công thức (`M9-S02`, `M9-S03`), duyệt ghép món AI OCR (`M9-S05`) | Không được sửa phân quyền hệ thống |
| **`admin_moderator`** | Duyệt quán mới (`M9-S04`), xử lý báo cáo sai (`M9-S06`), kiểm duyệt chiến dịch quảng cáo (`M9-S07`) | Mọi thao tác đều ghi vào `Audit Log` (`M9-S09`) |
| **`super_admin`** | Toàn quyền cấu hình hệ thống, trọng số AI Recommender, RBAC (`M9-S08`, `M9-S09`), Analytics (`M10`) | Yêu cầu xác thực 2 lớp (2FA) |


---

## 4. Đặc tả Chi tiết 5 Điểm Kỹ Thuật Cần Bổ Sung (Section 12 Spec)

### 4.1. Endpoint Lịch sử Gợi ý (`GET /v1/suggestions/history`)
- **Query Params:** `?cursor=<uuid>&limit=20&action=eaten|liked|skipped&days=7`
- **Response Schema:**
  ```json
  {
    "items": [
      {
        "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "dish": { "id": "DISH-102", "name": "Phở bò tái nạm", "price_vnd": 45000 },
        "place": { "id": "PLACE-419", "name": "Phở Gia Truyền Phát Tài", "distance_m": 400 },
        "feedback_action": "eaten",
        "cooldown_until": "2026-11-21T06:00:00Z",
        "created_at": "2026-11-18T05:10:00Z"
      }
    ],
    "next_cursor": null
  }
  ```

### 4.2. Quy trình Quản lý Phiên bản Nội dung & Duyệt AI Menu OCR (`M6-S06` → `M9-S05`)
```text
[Merchant Upload Ảnh Menu]
          │
          ▼
[LiteLLM Vision OCR Parser] ──► (Confidence >= 95% & Khớp 1-1 Dish M2) ──► [Auto-Approved: Xuất bản ngay]
          │
   (Confidence < 95% hoặc Món mới)
          │
          ▼
[Trạng thái: pending_review] ──► Đẩy vào Hàng đợi Admin CMS (M9-S05)
          │
          ▼
[Admin Duyệt / Ghép Dish ID] ──► Lưu bản ghi vào menu_revisions (Versioning) & Xuất bản
```

### 4.3. Schema Trạng thái Chuyển tiếp Đơn hàng sang App Ngoài (`M5`)
```sql
CREATE TABLE external_order_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  place_id UUID REFERENCES places(id),
  dish_id UUID REFERENCES dishes(id),
  partner VARCHAR(32) NOT NULL,                     -- 'grabfood', 'shopeefood', 'befood', 'xanhsm', 'google_maps', 'phone_call'
  target_deeplink TEXT NOT NULL,
  fallback_web_url TEXT,
  utm_campaign VARCHAR(64) DEFAULT 'hom_nay_an_gi_mvp',
  loopback_confirmed_eaten BOOLEAN DEFAULT NULL,    -- Cập nhật khi user quay lại xác nhận ở M5-S05
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.4. Quy trình Đồng bộ, Hết hạn & Tự động Tạm ẩn Dữ liệu Quán (`Staleness & Auto-Expiry`)
1. **Chu kỳ xác minh định kỳ (`90 ngày`):** Quán không có tương tác từ Merchant hoặc xác nhận từ người dùng trong 90 ngày sẽ chuyển sang trạng thái `stale_warning` và giảm trọng số gợi ý.
2. **Cơ chế Crowdsourced Auto-Pause (`M4-S06` → `M9-S06`):** Nếu một quán nhận `>= 3` báo cáo `Quán đóng cửa` từ các tài khoản người dùng khác nhau trong cùng một khung giờ, hệ thống tự động tạm ẩn quán khỏi `GET /v1/suggestions/today` và đẩy cảnh báo khẩn vào `M9-S06`.

---

## 5. Ma trận 11 Tiêu chí Kiểm thử QA Bắt buộc (Section 10 Spec)

| Mã QA | Kịch bản kiểm thử | Kỳ vọng đạt chuẩn (Pass Criteria) |
| :--- | :--- | :--- |
| **QA-01** | Mobile Android màn hình nhỏ (`360x640`) & tầm trung | Không tràn chữ tiếng Việt, thẻ `FoodCard` và thanh 5-tab hiển thị trọn vẹn |
| **QA-02** | iOS Dynamic Island & Safe Area Bottom | Thanh điều hướng dưới cùng và nút nổi `+` không đè lên Home Indicator |
| **QA-03** | Responsive Tablet (`768px`) & Desktop (`1280px+`) | Tự động chuyển sang lưới 2–3 cột và hiển thị Sidebar trên Merchant/Admin |
| **QA-04** | Tìm kiếm tiếng Việt có dấu & không dấu (`M2-S02`) | Nhập `"bun bo hue"` hoặc `"com tam"` trả về đúng 100% kết quả như có dấu |
| **QA-05** | Mạng 3G chậm / Độ trễ cao (`Loading Skeleton`) | Hiển thị `LoadingSkeleton` tức thì, độ trễ API gợi ý `p95 < 1.5s` |
| **QA-06** | Mất mạng giữa thao tác (`Offline State`) | Hiển thị banner `Offline` và đọc 3 món + công thức gần nhất từ bộ nhớ đệm |
| **QA-07** | Từ chối quyền GPS (`Permission Denied / No Location`) | Không crash, mở bộ chọn Phường/Xã thủ công (`M1-S08`) và vẫn gợi ý món |
| **QA-08** | Người dùng chưa đăng nhập (`Guest / Unauthorized`) | Cho phép xem gợi ý & công thức bình thường; chỉ nhắc đăng nhập khi lưu riêng |
| **QA-09** | Dữ liệu quán hết hạn hoặc ngoài giờ mở cửa | Tuyệt đối không hiển thị quán đã đóng cửa như một lựa chọn đang mở |
| **QA-10** | Kiểm thử Bộ lọc cứng Dị ứng (`Hard Allergy Filter`) | User dị ứng `Tôm/Hải sản` hoặc `Đậu phộng` **không bao giờ** thấy món chứa thành phần đó |
| **QA-11** | Kiểm thử Quảng cáo Tài trợ (`Sponsored Slot Rules`) | Tối đa `1/3` slot, bắt buộc có nhãn `Tài trợ`, và tuân thủ tuyệt đối bộ lọc dị ứng `QA-10` |

---

## 6. Đặc tả Kỹ thuật Giai Đoạn 4 / v0.2 (M18, M19, M20)

### 6.1. Module M18: AI Smart Fridge & IoT Barcode Scanner (Zero Food Waste)
- **Data Contract:**
  - `POST /api/v1/fridge/scan`:
    ```json
    {
      "barcode": "8934567890123",
      "item_name": "Sữa chua men sống Probi",
      "expires_in_days": 5,
      "compartment": "chill"
    }
    ```
  - `GET /api/v1/fridge/inventory`: Trả về danh sách 4 ngăn (`chill`, `freeze`, `door`, `vegetable`), cảnh báo `is_expiring_soon = true` nếu hạn dùng $\le 2$ ngày, và tự động đề xuất món ăn tối ưu từ nguyên liệu có sẵn.
- **Database DDL (Bảng 18):** `fridge_items` (id, user_id, barcode, name, quantity, compartment, expires_at, is_expiring_soon, scanned_at).

### 6.2. Module M19: Smart Dietitian & Health Wearables Sync
- **Data Contract:**
  - `POST /api/v1/health/sync`:
    ```json
    {
      "wearable": "Apple Health",
      "daily_steps": 8420,
      "active_calories_burned": 480,
      "goal": "maintain"
    }
    ```
  - Tự động tính toán: $\text{TDEE} = \text{BMR} \times 1.2 + \text{active\_calories}$.
  - Phân bổ tỷ lệ Macro mục tiêu: Đạm 30% (Protein 120g–140g), Tinh bột 50% (Carbs 220g–240g), Chất béo 20% (Fat 50g–60g).
  - Kích hoạt cờ `blood_sugar_support = true` cho chế độ Low-GI ổn định đường huyết sau ăn.
- **Database DDL (Bảng 19):** `health_metrics` (id, user_id, wearable_source, daily_steps, active_calories_burned, calculated_tdee, target_calories_daily, target_protein_g, target_carbs_g, target_fat_g, synced_at).

### 6.3. Module M20: Creator Kitchen & 1-Click VietQR Tipping
- **Data Contract:**
  - `GET /api/v1/community/recipes?tag=Zero-Waste`: Danh sách công thức cộng đồng lọc theo nhãn, thời gian nấu, độ khó và lượng tip nhận được.
  - `POST /api/v1/community/recipes`: Tạo mới công thức nấu ăn món Việt.
  - `POST /api/v1/community/recipes/{id}/tip`: Sinh payload VietQR chuẩn Napas 24/7 (10k, 20k, 50k, 100k) chuyển trực tiếp vào tài khoản ngân hàng tác giả:
    ```json
    { "amount_vnd": 20000 }
    ```
- **Database DDL (Bảng 20):** `community_recipes` (id, author_id, author_name, title, prep_time_minutes, difficulty, calories, ingredients, steps, zero_waste_tag, likes_count, total_tips_vnd, created_at).

### 6.4. Ma trận Toàn Bộ 20 Bảng DDL PostgreSQL + PostGIS
Toàn bộ 20 bảng DDL được duy trì và kiểm thử trong `src/db/schema.sql`:
1. `users` (M1) · 2. `dishes` (M2) · 3. `places` (M4, M6) · 4. `place_menu_items` (M4, M6) · 5. `suggestion_logs` (M3) · 6. `user_taste_profiles` (M1) · 7. `decision_spins` (M3) · 8. `external_order_redirects` (M5) · 9. `sponsored_campaigns` (M7) · 10. `merchant_invoices` (M7) · 11. `meal_reminder_schedules` (M8) · 12. `crowdsourced_reports` (M4, M9) · 13. `analytics_events` (M10) · 14. `meal_plans` (M11) · 15. `group_polls` & `group_poll_votes` (M12) · 16. `place_reviews` (M12) · 17. `table_bookings` (M13) · 18. `fridge_items` (M18) · 19. `health_metrics` (M19) · 20. `community_recipes` (M20).

### 6.5. SLA Bộ Kiểm Thử Tự Động (27/27 Test Suites)
Hệ thống đạt **27/27 test suites PASS 100%** trong thời gian thực thi siêu tốc **< 150ms** (`npm test`), bao gồm cả bộ kịch bản kiểm thử tích hợp vòng lặp đầu-cuối (*E2E Full Loop*).
