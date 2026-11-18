# UI/UX Design Specification — Hôm nay ăn gì · Taste of Vietnam

Tài liệu đặc tả hệ thống thiết kế (**Design System**), luồng trải nghiệm người dùng (**UX Flows**), và cấu trúc giao diện chi tiết (**Screen Specifications**) cho 4 nền tảng: **Consumer Mobile App**, **Consumer Web/PWA**, **Merchant Portal**, và **Admin CMS**.

---

## 1. Design Tokens & Visual Foundation (Phase A)

### 1.1. Bảng màu (Color Palette — Light & Dark Mode)

| Token Name | CSS Variable | Light Mode (Default) | Dark Mode | Mục đích sử dụng |
| :--- | :--- | :---: | :---: | :--- |
| **Primary** | `--color-primary` | `#E87935` | `#F08A4B` | Nút hành động chính (CTA), trạng thái Active, điểm nhấn thương hiệu |
| **Primary Dark** | `--color-primary-dark` | `#C65C24` | `#D96B27` | Trạng thái Hover, Pressed của Primary |
| **Primary Soft** | `--color-primary-soft` | `#FFF0E5` | `#3A2418` | Nền chip đang chọn, nền khu vực AI Assistant |
| **Background** | `--color-bg` | `#FFF9F2` | `#161513` | Nền tổng thể toàn ứng dụng (Kem ấm ấm áp) |
| **Surface** | `--color-surface` | `#FFFFFF` | `#22201D` | Nền thẻ món ăn (Card), Bottom Sheet, Modal, Header |
| **Surface Elevated** | `--color-surface-elevated` | `#F7EFE6` | `#2D2A26` | Nền ô tìm kiếm (Search input), Tag phụ, Skeleton |
| **Text Primary** | `--color-text-primary` | `#292722` | `#F5F2EB` | Tiêu đề, tên món ăn, giá tiền, nội dung chính |
| **Text Secondary** | `--color-text-secondary` | `#89847D` | `#A6A098` | Mô tả phụ, khoảng cách quán, thời gian nấu |
| **Vegetable / Healthy** | `--color-vegetable` | `#8AA66A` | `#9BB87A` | Nhãn dinh dưỡng, chế độ ăn lành mạnh, mascot **Lá** |
| **Success** | `--color-success` | `#4D956A` | `#5EAE7E` | Trạng thái "Quán đang mở", xác nhận thành công |
| **Warning** | `--color-warning` | `#E5A13B` | `#F0B24C` | Cảnh báo nhẹ, sắp đóng cửa, nhãn Tài trợ (`Sponsored`) |
| **Error** | `--color-error` | `#D65A50` | `#E56B61` | Cảnh báo dị ứng, lỗi kết nối, quán đóng cửa |
| **Border / Divider** | `--color-border` | `#EFE6DC` | `#33302B` | Đường viền mảnh phân tách Card và danh sách |

---

### 1.2. Typography (`Be Vietnam Pro`)

Sử dụng bộ font **Be Vietnam Pro** (Google Fonts) được thiết kế chuyên biệt cho dấu tiếng Việt thoáng, rõ ràng:

| Style | Size / Line-Height | Weight | Letter Spacing | Ứng dụng |
| :--- | :---: | :---: | :---: | :--- |
| **Display Hero** | `28px / 36px` | `800 (ExtraBold)` | `-0.02em` | Lời chào màn hình chính ("Để em chọn món nhé! 🍜") |
| **H1 — Screen Title** | `22px / 30px` | `700 (Bold)` | `-0.01em` | Tiêu đề trang, tên món trên trang Chi tiết |
| **H2 — Section Title** | `18px / 26px` | `700 (Bold)` | `-0.01em` | Tiêu đề cụm ("Gợi ý hôm nay", "Quán ngon gần bạn") |
| **H3 — Card Title** | `16px / 22px` | `600 (SemiBold)` | `0` | Tên món ăn trên `FoodCard`, tên quán trên `RestaurantCard` |
| **Body Regular** | `14px / 21px` | `400 (Regular)` | `0` | Nội dung mô tả, bước nấu ăn, tin nhắn chat AI |
| **Body Medium** | `14px / 21px` | `500 (Medium)` | `0` | Lý do gợi ý của AI, nhãn nút bấm phụ |
| **Caption / Tag** | `12px / 16px` | `500 (Medium)` | `+0.01em` | Khoảng cách (`400m`), thời gian (`15 phút`), badge `Tài trợ` |
| **Micro Badge** | `10px / 14px` | `700 (Bold)` | `+0.04em` | Nhãn chữ hoa nhỏ (`AI CHỌN`, `ĐANG MỞ`, `KHẨU VỊ`) |

---

### 1.3. Bo góc, Đổ bóng & Lưới (Radius, Elevation & Grid)

- **Border Radius:**
  - `--radius-xl: 22px` — Hero Card, AI Recommendation Showcase, Bottom Sheet.
  - `--radius-lg: 18px` — `FoodCard`, `RestaurantCard`, `RecipeCard`, Modal.
  - `--radius-md: 14px` — Nút bấm (Button), Ô nhập liệu (Input), Chat Bubble.
  - `--radius-pill: 999px` — Chip bộ lọc, Tag ngữ cảnh, Avatar Mascot.
- **Shadow (Elevation):**
  - `--shadow-card: 0 8px 24px -4px rgba(41, 39, 34, 0.06), 0 2px 6px -1px rgba(41, 39, 34, 0.03)`
  - `--shadow-floating: 0 16px 36px -6px rgba(232, 121, 53, 0.22)` (Nút CTA nổi / AI Floating Action)
- **Layout Grid:**
  - **Mobile (375px–430px):** Padding lề `16px`, khoảng cách giữa các card `14px`, Bottom Navigation cao `68px` (+ Safe Area).
  - **Tablet (768px–1024px):** 2 cột (`gap: 16px`), Navigation dạng Rail bên trái.
  - **Desktop (1280px+):** Max-width `1280px`, 12 cột (`gap: 24px`).

---

## 2. Hệ thống Nhân vật (Mascot Visual Guidelines)

| Mascot | Hình tượng & Biểu cảm | Màu chủ đạo | Vị trí xuất hiện trên UI |
| :--- | :--- | :--- | :--- |
| **Măm** *(AI Food Assistant)* | Hạt cơm trắng tròn ấm áp đội mũ đầu bếp cam đất, má hồng, mắt sáng thân thiện | `#E87935` & `#FFF9F2` | Header `Today Home`, Avatar trong `AI Food Chat`, Onboarding khẩu vị |
| **Miu** *(Food Explorer)* | Mèo mướp vàng đeo khăn quàng cam và kính lúp khám phá phố phường | `#E5A13B` & `#E87935` | Màn hình Bản đồ (`M4`), Trạng thái trống (`EmptyState`), Gợi ý quán mới |
| **Lá** *(Healthy Guide)* | Mầm rau thơm xanh mát tươi tắn, đeo tạp dề nhỏ | `#8AA66A` & `#4D956A` | Cảnh báo dị ứng, Bộ lọc Chay/Healthy, Phân tích Calo & Dinh dưỡng |
| **Bếp** *(Cooking Guide)* | Nồi đất nung truyền thống Việt Nam tỏa khói thơm ấm cúng | `#C65C24` & `#E87935` | Trang công thức nấu ăn (`M2-S05`), Bộ quy đổi khẩu phần, Bước nấu |

> **Quy tắc tiết chế:** Mỗi màn hình chỉ xuất hiện **tối đa 1 mascot** tại vị trí có tính tương tác hoặc dẫn dắt cảm xúc (không lặp lại mascot ở mọi thẻ món ăn gây rối thị giác).

---

## 3. Đặc tả Component Dùng Chung (Component Specifications)

### 3.1. `FoodCard` (Thẻ món ăn trung tâm)
- **Tỷ lệ ảnh:** `16:10` (trên danh sách) hoặc `4:3` (trên thẻ Hero), ảnh món ăn chiếm **60% diện tích thẻ**.
- **Lớp phủ trên ảnh (Overlay Badges):**
  - Góc trái trên: Lý do ngữ cảnh ngắn gọn (VD: `🌧️ Hợp trời mát`, `⚡ Ăn nhanh 15p`, `🌿 Thanh đạm`).
  - Góc phải trên: Nút Yêu thích (`Heart Icon`) + Nhãn `Tài trợ` (`SponsoredBadge`) nếu là slot quảng cáo.
- **Thông tin thân thẻ:**
  - Hàng 1: Tên món (`H3 16px SemiBold`) + Giá tham khảo (`15px Bold`, màu `#E87935`, VD: `45.000đ`).
  - Hàng 2: Lý do đề xuất của AI (`13px`, màu `#89847D`, kèm icon **Măm AI** nhỏ) + Khoảng cách quán gần nhất (`📍 Cách 400m · 4.8★`).
  - Hàng 3 (Quick Actions):
    - Primary CTA: `Đi ăn (3 quán)` hoặc `Đặt món`
    - Secondary CTA: `Tự nấu (25p)`

### 3.2. `RestaurantCard` (Thẻ quán ăn thực tế)
- **Thông tin hiển thị:** Ảnh đại diện quán (`72x72px`, bo góc `14px`), Tên quán + dấu tích xanh nếu đã xác minh (`Verified Merchant`), Địa chỉ ngắn, Khoảng cách (`400m`), Trạng thái (`Đang mở · Đóng lúc 22:00` màu `#4D956A`), Giá món tại quán (`Phở tái nạm: 45.000đ`).
- **Hành động nhanh:** `Chỉ đường` (Google/Apple Maps), `Đặt qua App` (GrabFood, ShopeeFood, beFood, Xanh SM Ngon), `Gọi điện`.

### 3.3. `AIChatBubble` & `AIResultCard` (Trong `M3-S04` & `M3-S05`)
- Khi người dùng nhập câu hỏi tự nhiên, hệ thống hiển thị **thanh Chip thông số đã nhận diện** (Intent Extraction Pills) ngay dưới câu hỏi để người dùng kiểm chứng và bấm sửa nhanh:
  - VD: `[👥 4 người]` `[💰 Ngân sách: 300.000đ]` `[👶 Có trẻ nhỏ]` `[📍 Bán kính < 2km]` `[🚫 Không cay]`
- Phản hồi của **Măm AI** luôn đi kèm **đúng 3 phương án thực tế**, mỗi phương án tính sẵn **tổng chi phí ước tính cho cả nhóm** (VD: *Phương án 1: Lẩu gà lá é + Khoai tây chiên cho bé — Tổng ~280.000đ tại Quán Tao Ngộ cách 650m*).

---

## 4. Đặc tả Chi tiết Các Màn Hình Trọng Tâm (Screen Specs)

### 4.1. Onboarding Khẩu vị 5 Bước < 45 giây (`M1-S03` → `M1-S07`)
- Thiết kế dạng **Bottom Sheet / Full-screen Card Stack** có thanh tiến trình `1/5 → 5/5` và nút `Bỏ qua (Dùng chế độ khách)`:
  1. **Vùng miền yêu thích:** Hương vị Bắc / Trung / Nam / Đa dạng (Chọn nhiều).
  2. **Độ ăn cay:** Thanh trượt 4 mức (`0: Không ăn cay` → `1: Cay nhẹ` → `2: Cay vừa` → `3: Siêu cay`).
  3. **Dị ứng thực phẩm (Bộ lọc cứng — Hard Filter):** Hải sản có vỏ, Đậu phộng, Sữa/Lactose, Gluten, Trứng... *(Cam kết bằng mascot **Lá**: "Hệ thống tuyệt đối ẩn mọi món chứa thành phần này")*.
  4. **Chế độ ăn:** Bình thường, Ăn chay (Thuần chay / Chay kỳ), Eat Clean / Giảm cân, Giàu đạm (Gym).
  5. **Ngân sách mỗi bữa:** `< 35.000đ` (Bình dân) · `35.000đ – 60.000đ` (Phổ thông) · `60.000đ – 120.000đ` (Thoải mái) · `> 120.000đ` (Thưởng thức).

### 4.2. Màn hình Trung tâm `Today Home` (`M3-S01`)
- **Top Bar:** Chọn vị trí hiện tại (`📍 Phường Bửu Long, Biên Hòa ▾`), Thời tiết thời gian thực (`🌧️ 26°C · Trời mát`), Nút Thông báo (`🔔`).
- **Hero AI Banner:** Mascot **Măm** chào theo buổi (Sáng / Trưa / Chiều / Tối), kèm thanh nhập nhanh `"Hỏi Măm: Tối nay 4 người 300k ăn gì?..."` và nút `🎲 Quay món`.
- **Cụm 3 Gợi ý Hôm nay (`3 Cards`):**
  - Hiển thị 3 món phù hợp nhất với thời tiết + giờ hiện tại + khẩu vị.
  - Tối đa 1 thẻ có nhãn `Tài trợ` (nằm ở vị trí số 3, vẫn phải vượt qua bộ lọc dị ứng và ngân sách).
  - Nút `🔄 Đổi 3 món khác` (Ghi nhận lý do nếu người dùng muốn lọc nhanh: *Đang ngán món nước / Muốn ăn khô / Muốn tự nấu nhanh*).

### 4.3. Màn hình Chi tiết Món & Công thức Có Scale Khẩu phần (`M2-S04` & `M2-S05`)
- Chuyển đổi mượt mà giữa 2 chế độ bằng Segmented Control ở đầu trang:
  - **Tab `[🛵 Đi ăn / Đặt ngoài]`:** Danh sách các quán gần nhất có bán món này (tích hợp `M4` & `M5`).
  - **Tab `[👩‍🍳 Tự nấu tại nhà]`:**
    - Bộ chọn khẩu phần (`[ - ] 2 người [ + ]`): Khi tăng/giảm số người ăn, **toàn bộ định lượng nguyên liệu (gram, ml, muỗng) và tổng calo/chi phí đi chợ tự động nhân chia theo thời gian thực**.
    - Chế độ `Bắt đầu nấu từng bước` (Step-by-step Mode) có đồng hồ bấm giờ (Timer) ngay trong từng bước.

### 4.4. Giao diện Merchant Portal & AI Menu OCR (`M6-S05` & `M6-S06`)
- Chủ quán chụp ảnh thực đơn giấy hoặc bảng giá treo tường → Hệ thống **AI Menu OCR** hiển thị khung quét trực quan:
  - Cột trái: Ảnh thực đơn gốc có đóng khung vùng nhận diện (Bounding boxes).
  - Cột phải: Bảng dữ liệu đã bóc tách tự động (`Tên món trên menu` → `Giá bán` → `Gợi ý ghép với Thư viện món chuẩn M2` + Độ tự tin AI `98%`).
  - Chủ quán chỉ cần bấm `Xác nhận & Đăng thực đơn`.
