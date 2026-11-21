# Hôm nay ăn gì · Taste of Vietnam v0.2 — Delivery Tracker (20/20 Modules Hoàn Thành)

> Cập nhật: 2026-11-21 20:20 +07:00 · **33/33 Automated Tests PASS** · **CI/CD Dual-Job PASS (Run 44908313991)** · **PostgreSQL 16 + PostGIS + pgvector (Render Singapore) CONNECTED & SEEDED** · **LRU In-Memory Caching & Push Queue Scheduler Live** · **Flutter Android & Web Scaffolds Ready** · **20 Modules (M1 → M20) Mobile & Web Parity** · **E2E Full Loop & Health Check (/health: postgres_connected: true)**  
> 🌐 **Production URL (Render Singapore):** **https://taste-of-vietnam.onrender.com**  
> 💻 **GitHub Repo:** **https://github.com/longcacrypto-afk/taste-of-vietnam** (Commit `8b97d99`)  
> 📊 **Render Dashboard:** [dashboard.render.com/web/srv-dbur1uom7kps73d88690](https://dashboard.render.com/web/srv-dbur1uom7kps73d88690) | **DB:** `taste-of-vietnam-db`

---

## 🚀 Toàn Diện 20/20 Module & Ma Trận 99 Màn Hình (v0.1 + v0.2 Giai Đoạn 4)

### Cụm 1: Consumer Mobile MVP (M1 → M5 — 40 màn hình)
1. **👤 M1 (Hồ Sơ Khẩu Vị & Tuân Thủ PDPD):** Bộ lọc 3 miền, chỉnh mức cay (0–3), chế độ ăn, lọc cứng dị ứng 100%, xuất dữ liệu JSON cá nhân & xóa tài khoản tức thì (*Right to be Forgotten*) theo Nghị định 13/2023/NĐ-CP.
2. **🔎 M2 (Khám Phá Món Ăn & Công Thức):** Tìm kiếm tiếng Việt có/không dấu, Dynamic Portion Scaler tự động nhân chia định lượng 1–10 người ăn.
3. **🍜 M3 (Gợi Ý Bữa Ăn Hôm Nay & Mini-Games):** Cá nhân hóa 3 món theo thời tiết (26°C), chặn 100% dị ứng, tối đa 1/3 vị trí tài trợ (`Sponsored`), Cooldown 3 ngày. Decision Hub 3-in-1 (Vòng quay 3D, Rút quẻ dân gian, Xé túi mù Blind Box).
4. **📍 M4 (Quán Ngon Bán Kính 3km):** Truy vấn PostGIS không gian thực, bộ lọc thông minh (Tất cả, Máy lạnh, Ghế trẻ em, Đánh giá cao ≥4.8), cơ chế Auto-Pause khi nhận đủ 3 báo cáo đóng cửa.
5. **🛵 M5 (4-Action Hub & Đặt Món):** Hub 4 nút thao tác: GrabFood ↗, ShopeeFood ↗, Chỉ đường Google Maps & Gọi điện hotline; ghi nhận UTM Click Tracking và hoàn tất đơn kích hoạt Cooldown.

### Cụm 2: B2B Merchant & Monetization (M6 → M7 — 17 màn hình)
6. **🏪 M6 (Cổng Quán Quản Lý Thực Đơn & AI OCR):** Cổng quản lý quán ăn đối tác, bóc tách thực đơn bằng AI Menu OCR (ảnh chụp thực đơn -> tên món + giá), quản lý món đặc biệt hôm nay và khuyến mãi.
7. **💳 M7 (Quảng Bá & Nạp Tiền VietQR):** Tạo chiến dịch tài trợ theo món, bán kính, thời tiết; nạp ngân sách qua VietQR chuẩn EMVCo (NAPAS 24/7); chống click tặc 60 giây.

### Cụm 3: Vận Hành, Tăng Trưởng & Phân Tích (M8 → M10 — 19 màn hình)
8. **🔔 M8 (Nhắc Bữa Ăn & Thông Báo Thời Tiết):** Khung giờ nhắc trưa (10:30) & tối (17:00), giới hạn tối đa 2 push/ngày (Anti-fatigue SLA), tự động tích hợp thời tiết thực, kèm Push Simulator.
9. **⚙️ M9 (Quản Trị CMS & Kiểm Duyệt Tự Động):** Hàng đợi duyệt ghép món AI OCR (độ tin cậy <95%), từ chối OCR kèm lý do, xử lý quán tạm ẩn và nút *Mở lại quán*, kiểm duyệt ads, kiểm toán RBAC 6 roles.
10. **📊 M10 (Phễu Chuyển Đổi & NLU Benchmark):** Phễu 4 bước PostHog (App Open ➔ Order Click), chỉ số North Star WAMD (18.420 quyết định/tuần), bộ benchmark NLU 200 câu kiểm thử đạt 100% SLA (yêu cầu ≥90%).

### Cụm 4: Tăng Trưởng & Hệ Sinh Thái Mở Rộng (M11 → M17 — 16 màn hình)
11. **📅 M11 (Thực Đơn Tuần 7 Ngày):** Lên thực đơn trưa/tối 7 ngày (2200–2400 kcal), giỏ đi chợ gộp tự động khấu trừ nguyên liệu có sẵn trong tủ lạnh (`in_fridge = true`).
12. **🗳️ M12 (Bình Chọn Ăn Nhóm & Đánh Giá GPS):** Giao thoa dị ứng cứng giữa các thành viên, bỏ phiếu thời gian thực, đánh giá GPS xác thực `≤ 500m`.
13. **🎫 M13 (Đặt Bàn & Voucher Tại Quán):** Đặt bàn giữ chỗ tức thì (Instant Confirmed), sinh mã QR Voucher ăn tại quán.
14. **📖 M14 (Văn Hóa & Chuyện Món Ăn):** Cội nguồn ẩm thực 3 miền, bản đồ biến thể vùng miền Bắc - Trung - Nam.
15. **🗺️ M15 (Lộ Trình Food Trail & Hộ Chiếu Ẩm Thực):** Lộ trình Food Trail theo chủ đề & Hộ chiếu số tích dấu QR.
16. **🌐 M16 (AI Menu Translator):** Dịch thực đơn 4 ngôn ngữ (Anh, Hàn, Nhật, Trung Quốc), giữ nguyên tên món gốc tiếng Việt, hỗ trợ phát âm Audio chuẩn bản xứ.
17. **📈 M17 (B2G Tourism & FMCG Insights):** Báo cáo xu hướng ẩm thực địa phương, phân tích lượng khách quốc tế, chiến dịch đồng tiếp thị tài trợ thương hiệu.

### Cụm 5: Giai Đoạn 4 / v0.2 — Smart Living & Social Health (M18 → M20 — 6 màn hình)
18. **🧊 M18 (AI Smart Fridge & IoT Barcode Scanner — M18-S01..S02):**
    - Flutter Screen: `mobile-flutter/lib/screens/fridge_scanner_screen.dart` (Phân loại 4 ngăn tủ lạnh, tính ngày hết hạn, cảnh báo đồ sắp hết hạn trong 48h, quét mã vạch EAN-13 và gợi ý công thức Zero Food Waste).
    - Web Studio Live Panel: `#lpanel-fridge` tích hợp bộ mô phỏng máy quét mã vạch, kho đồ và công thức chống lãng phí.
    - API: `POST /api/v1/fridge/scan`, `GET /api/v1/fridge/inventory`.
19. **🏃 M19 (Smart Dietitian & Health Wearables Sync — M19-S01..S02):**
    - Flutter Screen: `mobile-flutter/lib/screens/health_dietitian_screen.dart` (Đồng bộ Apple Health / Google Fit, đo bước chân, calo đốt, tự động tính TDEE, BMR, Macro Protein 120g/Carb 230g/Fat 55g và chế độ Low-GI ổn định đường huyết).
    - Web Studio Live Panel: `#lpanel-health` với biểu đồ thanh calo, thẻ phân bổ Macro và lời khuyên chuẩn y khoa từ Bác sĩ AI.
    - API: `POST /api/v1/health/sync`, `GET /api/v1/health/nutrition-profile`.
20. **🍳 M20 (Creator Kitchen & Community Recipe Hub — M20-S01..S02):**
    - Flutter Screen: `mobile-flutter/lib/screens/community_recipes_screen.dart` (Bảng tin công thức cộng đồng, gắn thẻ Zero-Waste, thả tim, form đăng công thức mới và modal tặng thưởng đầu bếp 1-click VietQR Napas 24/7).
    - Web Studio Live Panel: `#lpanel-community` hỗ trợ xem công thức, gắn thẻ và sinh lệnh thanh toán VietQR Tip tức thì.
    - API: `GET/POST /api/v1/community/recipes`, `POST /api/v1/community/recipes/:id/tip`.
21. **💻 Web Core (Nền Tảng Consumer Web/PWA — 5 screens: `WEB-S01` → `WEB-S05`):** Trang chủ Responsive, Khám phá món & bản đồ toàn màn hình, Công thức chuẩn SEO, Trung tâm Studio 20 Panels, Trang cài đặt & chính sách PDPD.

---

## 🛠️ Trạng Thái Hạ Tầng & Triển Khai
- **Production Web & PWA:** `https://taste-of-vietnam.onrender.com`
- **Cloud Load Balancer Health Endpoint:** `GET /health` & `GET /api/v1/health-check` (200 OK, version 0.2.0, 20 modules loaded).
- **CI/CD Automation:** GitHub Actions Pipeline 2 luồng: `backend-qa` (Node 20, 28 tests) & `flutter-mobile` (Flutter SDK stable, lint & syntax check).
- **Flutter Multi-Tab App:** Cập nhật `main.dart` với Drawer 20 Module mượt mà, `IndexedStack` giữ nguyên trạng thái giữa các tab, 19 màn hình đầy đủ.
- **Service Worker:** `hnag-v7` hỗ trợ Pre-caching toàn diện (`/`, `/manifest.json`, `/assets/tailwindcss.min.js`, ảnh mascot và món ăn).
- **Database DDL:** 20 Bảng DDL PostgreSQL + PostGIS + pgvector trong `src/db/schema.sql`.
- **Test Automation:** 28/28 test suites vượt qua 100% (`npm test`).
