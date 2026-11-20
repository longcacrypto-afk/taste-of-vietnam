# Hôm nay ăn gì · Taste of Vietnam (v0.1)
> **Tài liệu Thiết kế Sản phẩm, Kiến trúc UI/UX & Functional Specification**  
> Nguồn: Bản thiết kế tổng thể từ `Spec-Hom-nay-an-gi-v0.1.docx` (ChatGPT Share)

---

## 1. Định hướng thiết kế sản phẩm

- **Tên sản phẩm:** Hôm nay ăn gì · Taste of Vietnam
- **Định vị:** AI-powered food discovery platform — Trợ lý khám phá món ăn Việt Nam, kết nối người dùng với món ăn, công thức và quán ăn thực tế gần họ.
- **Nguyên tắc cốt lõi:** Ảnh món ăn phải là yếu tố thị giác chính. Giao diện không nên giống một ứng dụng giao hàng truyền thống; sản phẩm phải tạo cảm giác một trợ lý khám phá ẩm thực.

### Định hướng Visual (Modern Vietnamese Food Discovery)

| Thành phần | Định hướng | Giá trị / Chi tiết |
| :--- | :--- | :--- |
| **Primary** | Cam đất / Tangerine | `#E87935` (Hover/Pressed: `#C65C24`) |
| **Background** | Kem ấm / Ivory | `#FFF9F2` |
| **Surface** | Trắng | `#FFFFFF` |
| **Text Primary** | Charcoal | `#292722` |
| **Text Secondary** | Warm Gray | `#89847D` |
| **Accent / Vegetable** | Xanh lá rau thơm | `#8AA66A` |
| **Semantic Colors** | Success / Warning / Error | `#4D956A` / `#E5A13B` / `#D65A50` |
| **Typography** | Be Vietnam Pro | Hỗ trợ tiếng Việt tối ưu, hiện đại, thân thiện |
| **Border radius** | 14–22px | Bo góc mềm mại, hiện đại |
| **Card style** | Ảnh món ăn lớn, thông tin rõ | Tối ưu thị giác ẩm thực |
| **Icon** | Rounded outline, thống nhất | Độ dày nét 1.75px–2px |
| **Motion** | Nhẹ, nhanh, tự nhiên | Micro-interactions mượt mà (200–300ms) |

---

## 2. Kiến trúc giao diện toàn ứng dụng

Sản phẩm gồm **4 giao diện chính**, dùng chung một Design System thống nhất:

1. **Consumer Mobile App (MVP — iOS & Android):**
   - Gợi ý món ăn bằng AI (`Hôm nay ăn gì?`).
   - Khám phá món, công thức và quán ăn.
   - Bản đồ, đặt món (deep-link), chỉ đường.
   - Hồ sơ khẩu vị, yêu thích và thông báo.
2. **Consumer Web / PWA (MVP):**
   - Trang khám phá món ăn, tìm kiếm món và quán.
   - Trang chi tiết món, công thức, trang chi tiết quán.
   - Tối ưu SEO cho món ăn và địa điểm.
3. **Merchant Portal (MVP cơ bản):**
   - Quản lý thông tin quán, chi nhánh, menu và giá.
   - Upload ảnh menu, bóc tách tự động bằng **AI Menu OCR**.
   - Quản lý khuyến mãi, món đặc biệt hôm nay, chiến dịch quảng bá.
   - Thống kê lượt xem, gọi điện, chỉ đường, đặt món.
4. **Admin CMS (MVP):**
   - Quản lý món ăn, công thức, quán và menu.
   - Duyệt dữ liệu AI & ghép món (Menu Matching Review).
   - Quản lý quảng cáo, báo cáo sai dữ liệu từ người dùng.
   - Quản lý người dùng, phân quyền, analytics và audit log.

---

## 3. Sơ đồ 17 Module và Phạm vi triển khai

| Nhóm | Module | Giai đoạn |
| :--- | :--- | :---: |
| **Người dùng** | **M1.** Tài khoản & khẩu vị | 1 (MVP) |
| **Nội dung** | **M2.** Thư viện món & công thức | 1 (MVP) |
| **AI Core** | **M3.** Gợi ý AI hằng ngày | 1 (MVP) |
| **Địa điểm** | **M4.** Quán & bản đồ | 1 (MVP) |
| **Conversion** | **M5.** Đặt món / Chỉ đường | 1 (MVP) |
| **B2B** | **M6.** Cổng Quán (Merchant Portal) | 1–2 |
| **Monetization** | **M7.** Quảng bá & chiến dịch | 1–2 |
| **Engagement** | **M8.** Thông báo | 1 (MVP) |
| **Operations** | **M9.** Admin CMS | 1 (MVP) |
| **Analytics** | **M10.** Analytics & Event | 1 (MVP) |
| **Planning** | **M11.** Kế hoạch bữa & Đi chợ | 2 (Tăng trưởng) |
| **Community** | **M12.** Xã hội & Gamification | 2 (Tăng trưởng) |
| **Commerce** | **M13.** Đặt bàn & Voucher | 2 (Tăng trưởng) |
| **Culture** | **M14.** Văn hóa & Câu chuyện món | 3 (Mở rộng) |
| **Tourism** | **M15.** Du lịch ẩm thực | 3 (Mở rộng) |
| **Localization** | **M16.** Đa ngôn ngữ (EN, KO, ZH, JA) | 3 (Mở rộng) |
| **Enterprise** | **M17.** B2G / Brand | 3 (Mở rộng) |

### 3.1. Cấu trúc điều hướng Mobile (5 Tabs)
1. **Hôm nay (`Today`):** Trung tâm của ứng dụng (AI gợi ý 3 món, Quay món, Chat với Măm AI).
2. **Khám phá (`Explore`):** Tìm kiếm chủ động món ăn, vùng miền, công thức nấu ăn.
3. **Bản đồ (`Map`):** Chuyển đổi từ món sang quán thực tế xung quanh (bán kính 3km).
4. **Đã lưu (`Saved`):** Quản lý món yêu thích, bộ sưu tập, quán đã lưu.
5. **Cá nhân (`Profile`):** Quản lý hồ sơ khẩu vị, ngân sách, dị ứng, thông báo và cài đặt.

---

## 4. Thiết kế chi tiết Module M3 — Gợi ý AI hằng ngày (Core Module)

### 4.1. Danh sách màn hình
- **M3-S01 (`Today Home`):** 3 món gợi ý hằng ngày theo ngữ cảnh (thời tiết, bữa ăn, khẩu vị, vị trí).
- **M3-S02 (`Dish Recommendation`):** Xem chi tiết món gợi ý & lý do phù hợp.
- **M3-S03 (`Spin to Choose`):** Vòng quay chọn món ngẫu nhiên (đã qua bộ lọc cứng).
- **M3-S04 (`AI Food Chat`):** Chat tiếng Việt tự nhiên với trợ lý Măm AI.
- **M3-S05 (`AI Result`):** 3 phương án AI đề xuất kèm quán thực tế đã xác minh.
- **M3-S06 (`Recommendation Feedback`):** Thích, bỏ qua, đã ăn hôm nay.
- **M3-S07 (`Recommendation History`):** Lịch sử các món đã gợi ý.

### 4.2. Luồng xử lý AI Food Chat (`M3-S04`)
```text
User nhập câu hỏi (VD: "Tối nay 4 người, ngân sách 300k, có trẻ nhỏ, muốn ăn gần nhà")
       │
       ▼
LLM Intent Extraction ──► JSON Parameters (people=4, budget=300000, kids=true, radius=3km)
       │
       ▼
Recommendation Engine (Search Dishes + Search Places + Weather + User Taste Profile)
       │
       ▼
3 phương án thực tế (LLM tạo lời giải thích tự nhiên, KHÔNG tự bịa ra quán ăn)
```

### 4.3. Acceptance Criteria (Module M3)
- Tải 3 gợi ý với độ trễ `p95 < 1.5s`.
- **Tuyệt đối không** đề xuất món vi phạm dị ứng / chế độ ăn cứng của người dùng.
- Không đề xuất quán đang đóng cửa như một lựa chọn đang mở.
- Không lặp lại món trong vòng 3 ngày (nếu đủ dữ liệu).
- Tối đa **1/3 slot** là tài trợ (`Sponsored`) và bắt buộc có nhãn **Tài trợ** rõ ràng.
- Nhận diện ý định tiếng Việt đạt độ chính xác `>= 90%` trên bộ 200 câu kiểm thử.

---

## 5. Hệ thống Nhân vật (Mascot System)

| Mascot | Vai trò | Ngữ cảnh xuất hiện |
| :--- | :--- | :--- |
| **Măm** | AI Food Assistant (Nhân vật chính) | Onboarding khẩu vị, Today Home giới thiệu món, AI Food Chat |
| **Miu** | Food Explorer | Empty State, Bản đồ khám phá quán mới, Food Trail |
| **Lá** | Healthy Guide | Hồ sơ dinh dưỡng, cảnh báo dị ứng, gợi ý món lành mạnh/chay |
| **Bếp** | Cooking Guide | Trang công thức nấu ăn, định lượng nguyên liệu, hướng dẫn từng bước |

---

## 6. Chi tiết các Module MVP khác (M1, M2, M4–M10)

### M1 — Tài khoản & Hồ sơ khẩu vị
- **10 màn hình (`M1-S01` → `M1-S10`):** Đăng nhập OTP/Google/Apple/Zalo, chế độ Guest, Onboarding 5 bước hoàn thành dưới 45 giây (Vùng miền Bắc/Trung/Nam, Độ cay 0–3, Dị ứng, Chế độ ăn, Ngân sách bữa).
- **API:** `/v1/auth/*`, `/v1/me/profile`.

### M2 — Thư viện món & Công thức
- **8 màn hình (`M2-S01` → `M2-S08`):** Khám phá món, Tìm kiếm tiếng Việt có dấu/không dấu, Danh mục vùng miền, Chi tiết món, Chi tiết công thức có **tự động scale khẩu phần**, Hướng dẫn nấu từng bước, Bộ sưu tập yêu thích.
- **API:** `/v1/dishes`, `/v1/dishes/{id}`.

### M4 — Quán & Bản đồ
- **6 màn hình (`M4-S01` → `M4-S06`):** Quán gần bạn (bán kính mặc định 3km), Bản đồ quán, Chi tiết quán, Menu cấu trúc + giá, Trạng thái còn món, Báo cáo sai dữ liệu (địa chỉ, giá, đóng cửa).
- **API:** `/v1/dishes/{id}/places`, `/v1/places/{id}`, `/v1/places/{id}/reports`.

### M5 — Đặt món / Chỉ đường
- **5 màn hình (`M5-S01` → `M5-S05`):** Mở deep-link sang GrabFood, ShopeeFood, beFood, Xanh SM Ngon (hoặc web fallback), Chỉ đường Google Maps / Apple Maps, Gọi điện trực tiếp. Ghi nhận sự kiện `order_click`, `direction_click`, `call_click`.

### M6 — Merchant Portal
- **9 màn hình (`M6-S01` → `M6-S09`):** Đăng ký/xác minh quán, Quản lý hồ sơ & chi nhánh, Quản lý thực đơn thủ công & **AI Menu OCR** (chụp ảnh thực đơn tự tách tên món + giá), Món đặc biệt hôm nay, Khuyến mãi, Analytics hiệu quả.

### M7 — Quảng bá & Chiến dịch
- **8 màn hình (`M7-S01` → `M7-S08`):** Tạo chiến dịch quảng bá theo món, bán kính, khung giờ, thời tiết; thanh toán VietQR; báo cáo Impression, CTR, CPA. Tuân thủ nghiêm ngặt quy tắc nhãn `Tài trợ` và không vượt bộ lọc dị ứng.

### M8 — Thông báo & Tái kích hoạt
- **4 màn hình (`M8-S01` → `M8-S04`):** Push mặc định lúc `10:30` (bữa trưa) và `17:00` (bữa tối), tối đa 2 thông báo/ngày, cá nhân hóa theo thời tiết.

### M9 — Admin CMS & Kiểm duyệt
- **9 màn hình (`M9-S01` → `M9-S09`):** Quản lý món, công thức, duyệt quán, duyệt ghép món AI OCR (`Menu Matching Review`), xử lý báo cáo sai từ người dùng, kiểm duyệt chiến dịch quảng cáo, phân quyền & Audit Log.

### M10 — Analytics & Event
- **6 màn hình (`M10-S01` → `M10-S06`):** Theo dõi toàn bộ phễu chuyển đổi từ `app_open` → `suggestion_shown` → `dish_view` / `place_view` → `order_click` / `direction_click` / `call_click`.
- **API:** `/v1/events`, `/v1/analytics/funnel`, `/v1/analytics/ai-benchmark`.

### M11 — Kế hoạch bữa & Đi chợ thông minh (Meal Planning & Smart Grocery)
- **3 màn hình (`M11-S01` → `M11-S03`):** Lập thực đơn tuần 7 ngày theo khẩu vị gia đình, tự động cân đối calo & ngân sách; Giỏ đi chợ gộp thông minh tự động cộng dồn nguyên liệu và **khấu trừ nguyên liệu có sẵn trong tủ lạnh** (`in_fridge = true`); Quản lý kho tủ lạnh gia đình.
- **API:** `/v1/meal-plans/weekly`.

### M12 — Xã hội, Bình chọn ăn nhóm & Đánh giá GPS (Group Dining & GPS Reviews)
- **3 màn hình (`M12-S01` → `M12-S03`):** Tạo phòng bình chọn ăn nhóm theo mã PIN/QR, tự động tính **giao thoa dị ứng cứng** giữa tất cả thành viên trong nhóm; Bảng theo dõi kết quả biểu quyết thời gian thực; Đánh giá quán ăn có **xác thực GPS bán kính ≤ 500m** chống review ảo.
- **API:** `/v1/polls`, `/v1/polls/{id}/vote`, `/v1/places/{id}/reviews`.

### M13 — Đặt bàn trực tiếp & Voucher tại quán (Table Booking & In-Store Vouchers)
- **2 màn hình (`M13-S01` → `M13-S02`):** Đặt bàn giữ chỗ tức thì (Instant Confirmed) chọn số người, khung giờ và yêu cầu đặc biệt (ghế trẻ em, máy lạnh); Sinh mã QR Voucher điện tử độc quyền để quét trừ tiền trực tiếp tại quầy thu ngân của quán.
- **API:** `/v1/bookings`, `/v1/vouchers`.

### M14 — Văn hóa ẩm thực & Câu chuyện cội nguồn (Culinary Culture & Origin Stories)
- **2 màn hình (`M14-S01` → `M14-S02`):** Kho tư liệu lịch sử, sự tích văn hóa và giai thoại dân gian về từng món ăn truyền thống 3 miền; Bản đồ biến thể vùng miền (so sánh Phở Bắc vs Phở Nam, Bún Bò Huế gốc vs Bún Bò Sài Gòn).
- **API:** `/v1/dishes/{id}/story`, `/v1/dishes/{id}/regional-variants`.

### M15 — Lộ trình Food Trail & Hộ chiếu du lịch ẩm thực (Curated Food Trails & Digital Passport)
- **2 màn hình (`M15-S01` → `M15-S02`):** Các tuyến food tour ẩm thực tuyển chọn (Phố Bún Sài Gòn, Ẩm thực Chợ Đêm, Tuyến Trà Chiều Thảo Mộc); Hộ chiếu ẩm thực số tích dấu QR khi ghé thăm từng quán trên lộ trình để đổi huy hiệu & phần thưởng đặc biệt.
- **API:** `/v1/tourism/trails`, `/v1/tourism/passport/stamp`.

### M16 — Đa ngôn ngữ du khách quốc tế & Audio phát âm (Multilingual Tourist Menu AI)
- **2 màn hình (`M16-S01` → `M16-S02`):** Dịch thuật ngữ ẩm thực Việt Nam chuẩn xác sang 4 thứ tiếng (Tiếng Anh EN, Hàn KO, Trung ZH, Nhật JA), giữ nguyên tên món gốc kèm mô tả nguyên liệu chi tiết; Tích hợp audio phát âm chuẩn giọng người bản xứ và hướng dẫn cách ăn chuẩn vị (VD: ăn kèm rau sống nào, cách pha nước chấm).
- **API:** `/v1/translate/menu`.

### M17 — B2G / Brand Enterprise Insights (Regional Tourism & Co-Marketing)
- **2 màn hình (`M17-S01` → `M17-S02`):** Cổng dữ liệu phân tích vĩ mô dành cho Sở Du lịch / Ban Quản lý văn hóa địa phương (báo cáo món ăn được quan tâm nhất, bản đồ nhiệt ẩm thực, lưu lượng khách quốc tế); Bảng quản trị chiến dịch đồng tiếp thị dành cho nhãn hàng F&B / FMCG (tài trợ hiển thị gia vị, đồ uống dùng kèm chuẩn vị).
- **API:** `/v1/enterprise/insights/regional`, `/v1/enterprise/brand-campaigns`.

---

## 7. Ma trận 93 Màn hình Toàn Ứng Dụng (M1 → M17)

| Nhóm Nền Tảng | Mã Module | Số lượng Màn hình | Ghi chú & Phạm vi |
| :--- | :--- | :---: | :--- |
| **Consumer Mobile MVP** | M1 → M5 | **40 Màn hình** | Onboarding, Gợi ý 3 món AI hằng ngày, Vòng quay 3D & Mini-game, Chat AI Măm, Bản đồ quán 3km, Chi tiết quán & Đặt món. |
| **Consumer Web & PWA** | Web Core | **5 Màn hình** | Trang chủ Responsive, Khám phá món & quán, Chi tiết công thức nấu ăn, Thư viện ẩm thực SEO. |
| **Merchant & Quảng Cáo** | M6 → M7 | **17 Màn hình** | Đăng ký quán, Quản lý thực đơn thủ công & AI Menu OCR, Tạo chiến dịch quảng cáo, Cổng thanh toán VietQR Napas247. |
| **Quản Trị & Phân Tích** | M9 → M10 | **15 Màn hình** | Admin CMS, Hàng đợi duyệt ghép món OCR, Xử lý quán tự động tạm dừng, Phân quyền RBAC 6 roles, Phễu PostHog & AI Benchmark. |
| **Tăng Trưởng & Mở Rộng**| M11 → M17 | **16 Màn hình** | Thực đơn tuần & Giỏ đi chợ, Bình chọn nhóm & Đánh giá GPS, Đặt bàn & Voucher, Chuyện văn hóa, Food Trail, Dịch menu AI, B2G Insights. |
| **TỔNG CỘNG** | **M1 → M17** | **93 Màn hình** | **Hoàn chỉnh 100% trên cả Web Runtime (Live) và Flutter Mobile Screens.** |

---

## 8. Kiến trúc Kỹ thuật & Tiêu chuẩn Nghiệm thu (SLAs)

### 8.1. Tech Stack Hoàn Chỉnh
- **Mobile Client:** Flutter 3.x (Dart) — Kiến trúc Clean Architecture với Riverpod / Provider.
- **Web Runtime:** HTML5, Tailwind CSS v3 tự lưu trữ tại chỗ (`/assets/tailwindcss.min.js`), Service Worker PWA `hnag-v7` (Pre-caching offline toàn diện cho App Shell, Icons, Mascots và Dishes).
- **Backend Gateway:** Node.js HTTP/2 REST Gateway (Modular Services Architecture), hỗ trợ High-Speed In-Memory Store & PostgreSQL fallback.
- **Database:** PostgreSQL + PostGIS (tìm kiếm không gian bán kính 3km) + pgvector (tìm kiếm tương đồng ngữ nghĩa món ăn).
- **AI Core:** Gemini 2.0 Flash (Chat ẩm thực thông minh, giải thích lý do gợi ý) + Regex Intent Parser tốc độ cao.
- **Thanh toán:** VietQR chuẩn EMVCo (NAPAS 24/7) + PayOS Webhook xác thực chữ ký HMAC-SHA256 & kiểm tra Idempotency.

### 8.2. Tiêu chí Nghiệm thu Hệ thống (Quality SLAs)
1. **Độ trễ gợi ý (Daily Recommendation Latency):** Phản hồi `GET /api/v1/suggestions/today` đạt `p95 < 1500ms`.
2. **Nguyên tắc an toàn dị ứng tuyệt đối (Zero Allergy Tolerance):** $100\%$ không bao giờ đề xuất món chứa chất gây dị ứng đã khai báo của người dùng trên cả gợi ý tự nhiên lẫn vị trí tài trợ.
3. **Giới hạn vị trí tài trợ (Sponsored Cap):** Tối đa $1/3$ tổng số món gợi ý là vị trí tài trợ (`Sponsored`) và bắt buộc hiển thị nhãn nhận diện rõ ràng.
4. **Chu kỳ làm mới món (3-Day Non-Repeat Cooldown):** Không gợi ý lại các món người dùng đã ăn hoặc đã xem trong vòng 3 ngày gần nhất.
5. **Độ chính xác NLU tiếng Việt (Vietnamese Intent SLA):** Đạt độ chính xác $\ge 90\%$ trên bộ kiểm thử 200 câu hỏi tiếng Việt tự nhiên phức tạp (đạt $100\%$ trong bộ benchmark thực tế).
6. **Bảo vệ người dùng khỏi quán đóng cửa (Auto-Pause Guard):** Tự động tạm ẩn quán khỏi kết quả gợi ý khi nhận $\ge 3$ phản ánh đóng cửa trong ngày.
7. **Chống làm phiền thông báo (Anti-Fatigue Push Rule):** Nghiêm ngặt giới hạn $\le 2$ thông báo đẩy mỗi ngày vào khung giờ trưa (10:30) và tối (17:00).
8. **Tuân thủ Nghị định 13/2023/NĐ-CP (PDPD Compliance):** Cho phép người dùng xuất toàn bộ dữ liệu cá nhân dạng JSON và hỗ trợ xóa sạch dữ liệu tức thì (*Right to be Forgotten*).

---

### 8.3. Lộ trình Mở rộng Microservices & Mở Rộng Hạ Tầng (>100k MAU)
- **Modular Monolith hiện tại:** Đạt hiệu năng cực cao, đáp ứng từ 0 đến 100k người dùng hoạt động hằng tháng (MAU) với chi phí vận hành tối ưu trên cụm Render Singapore.
- **Microservices Tương lai (> 100k MAU):**
  - Tách `Recommender & Vector Search Service` (FastAPI / pgvector / Redis).
  - Tách `Notification & Meal Scheduler Queue` (BullMQ / Redis Cluster).
  - Multi-region DB Replication (Hà Nội, Đà Nẵng, TP.HCM & Singapore) cho độ trễ < 50ms khắp cả nước.
