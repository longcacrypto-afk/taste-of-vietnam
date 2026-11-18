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

---

## 7. Kiến trúc Kỹ thuật đề xuất

- **Mobile:** Flutter (iOS / Android)
- **Web / Merchant / Admin:** Next.js + Tailwind CSS
- **Backend:** NestJS hoặc FastAPI (Modular Monolith trước, tách microservice khi > 100k MAU)
- **Database:** PostgreSQL + PostGIS (Geo search) + pgvector (Vector similarity search)
- **Cache & Queue:** Redis + BullMQ
- **AI Gateway:** LiteLLM (trừu tượng hóa LLM provider)
- **Storage / Analytics / Monitoring:** S3-compatible, PostHog, Sentry, GitHub Actions
