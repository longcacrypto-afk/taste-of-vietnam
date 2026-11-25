# Kế hoạch hoàn tất 6 module lõi — Taste of Vietnam

Ứng dụng đã lưu dữ liệu thật, nhưng các luồng sử dụng chưa đủ để ra mắt; cần hoàn tất trên giao diện có sẵn.

## Tóm tắt cho anh

| Module | Ước lượng hoàn tất | Đã có | Khoảng trống lớn nhất |
| --- | ---: | --- | --- |
| M1 Tài khoản, khẩu vị | 45% | Khách, mã OTP, hồ sơ riêng, lưu DB, xóa | Đăng nhập thật, GPS, đồng ý dữ liệu, nối onboarding |
| M2 Món và công thức | 45% | Tìm không dấu, chi tiết, chia khẩu phần, lưu | Nội dung có quyền sử dụng, các màn còn mẫu, hợp đồng API lệch |
| M3 Gợi ý và Măm | 35% | Bộ lọc dị ứng, 3 gợi ý, phản hồi, lịch sử | Chế độ ăn/bữa ăn chưa áp dụng đủ; AI và trò chơi không cùng bộ lọc |
| M4 Quán và bản đồ | 30% | Tìm gần bằng PostGIS, báo sai, tạm ẩn | Quán thật, GPS, giờ mở cửa thật, bản đồ và chi tiết |
| M5 Đặt ngoài, chỉ đường | 35% | Lưu lượt chuyển tiếp, xác nhận đã ăn | Nút UI chưa đi qua API; link mẫu, gọi điện sai định dạng |
| M9 Quản trị | 30% | Chặn quyền, món CRUD, duyệt cơ bản, audit DB | Quản trị công thức/quán, phân quyền thật, giữ lịch sử xử lý |

**Đây là ước lượng kỹ thuật theo các luồng bắt buộc dưới đây, không phải tỷ lệ test đạt, số màn đã vẽ hay cam kết tiến độ.** Mỗi module chấm 5 mặt ngang trọng số: UI thao tác thật, quy tắc nghiệp vụ, dữ liệu bền vững, dữ liệu vận hành thật, an toàn/kiểm thử; làm tròn 5%. Chỉ 100% khi tất cả tiêu chí nghiệm thu bắt buộc đạt. Không cộng công việc PR #3 chưa gộp.

> **Anh cần quyết khi bắt đầu nhập dữ liệu và đăng nhập:** thành phố mở đầu; nguồn/quyền món–quán–ảnh; SMS OTP hay Google/Zalo; người được quyền quản trị. Đề xuất: một thành phố, kho nội dung nhỏ được xác minh, một cách đăng nhập trước. Chưa bật thanh toán hoặc quảng cáo.

- [x] Đọc thiết kế, API, lưu trữ và test của 6 module; giữ nguyên bố cục Live App và các màn trong repo.
- [x] Chạy lại 69/69 test bộ nhớ và 13/13 test PostgreSQL trên máy riêng.
- [ ] Chưa chứng minh toàn bộ luồng bằng trình duyệt với PostgreSQL và nhà cung cấp thật.

```mermaid
flowchart LR
  A[M1 hồ sơ và vị trí] --> B[M9 nhập dữ liệu có kiểm duyệt]
  B --> C[M2 món và M4 quán]
  C --> D[M3 gợi ý đúng]
  D --> E[M5 chuyển tiếp và xác nhận]
```

## 0. Phạm vi, bằng chứng và cách đọc

- Mốc đọc: `main` **9adf9e0**, ngày 25–26/11/2026. Mọi nhận xét “hiện có” dưới đây là ở mốc này, không phải toàn bộ sản phẩm đã chạy thật.
- Chỉ M1–M5 và M9, web/PWA trước. M6–M8, M10–M20 và Flutter đóng băng; M9-S07 phụ thuộc quảng cáo M7 chỉ giữ ẩn/chỉ đọc, không mở kinh doanh. Các cơ chế bảo vệ tài trợ hiện có vẫn phải đúng nếu còn dữ liệu cũ.
- Nguồn nội bộ đã đối chiếu: `docs/PRODUCT_SPEC_v0.1.md`, `docs/UI_UX_DESIGN_SPEC.md`, `docs/TECHNICAL_HANDOFF_SPEC.md`, `docs/DELIVERY_TRACKER.md`; `ui-design/src/app_shell.html`, `screens_m1_m2.js`, `screens_m3_m4_m5_m8.js`, `screens_m9_m10_expansion.js`; `server.js`, `src/api/router.js`, `accessPolicy.js`, `src/services/*`, `src/db/{postgresRepository,memoryRepository,repository}.js`, migrations và tests.
- **Tracker “20/20 hoàn thành”, “99 màn chạy thật”, “100% NLU” không phải bằng chứng.** Test “E2E Full Loop” hiện chủ yếu gọi router, không bấm UI và không đi sang Grab/ShopeeFood.
- Kho mẫu có **12 món, 8 quán** khi seed DB trống. Con số hiển thị trên prod có thể khác vì dữ liệu được giữ lại; không suy ra số bản ghi prod từ seed. Thành phố, thời tiết và nhiều link vẫn mẫu.
- Lưu trữ đã thật: khi có `DATABASE_URL`, server dùng repository PostgreSQL, không âm thầm rơi về bộ nhớ; users, OTP, hồ sơ, collections, history, redirects, món, quán, reports và audit có bảng thật. Không có nghĩa là dữ liệu mẫu đã được xác minh.
- Thiết kế ưu tiên **mã render trong `screens_*.js` và Live App**, vì bảng mã trong PRODUCT_SPEC tự mâu thuẫn: M1-S08 thực tế là vị trí; M2-S05 dinh dưỡng, S06 chia khẩu phần, S07 bước nấu, S08 đã lưu; M4-S01 danh sách/S02 bản đồ; M5-S02 chọn đối tác/S03 chỉ đường/S04 gọi điện; M9-S03 công thức/S04 duyệt quán/S05 OCR/S06 báo sai. Dùng các mã này trong kế hoạch, không đổi thiết kế để khớp bảng sai.
- API dưới đây có tiền tố `/api/v1`. Không tạo thêm endpoint chỉ vì nhãn `api:` trên mockup ghi như vậy: ưu tiên dùng endpoint đang có; phần mới phải ghi rõ là **đề xuất**.
- Cỡ: **S** ≤1 ngày, **M** 2–4 ngày, **L** 1–2 tuần, cho một người triển khai; L cần chia thành PR nhỏ. Đây không phải lịch giao. Mỗi dòng gồm màn, API/logic, dữ liệu và cách kiểm.
- **P2 / PR #3:** đọc lần đầu ở `079014cb1724caf1bc26abfbde2af82f91daef65` (shell mới bị từ chối), sau đó fetch và đọc lại head **`8237a43c0f9e4e46104e4a3192452cffb50a37f7`**. Bản mới bỏ product shell, thêm `ui-design/src/product_runtime.js` gắn vào màn có sẵn. Phần “hiện chạy” từng module vẫn mô tả **main**, không nhầm với PR chưa gộp. Những dòng **P2** là phần UI do PR này phụ trách, không tạo việc trùng; API/logic/dữ liệu trong cùng dòng vẫn phải nghiệm thu riêng.

### PR #3 đang bao phủ gì ở head 8237a43c

| Module / việc trong kế hoạch | Đã thấy trong mã PR, chưa tính hoàn tất | Còn ngoài phạm vi hoặc cần kiểm |
| --- | --- | --- |
| M1-1; một phần M1-4/6 | Bind onboarding/profile, OTP, GPS browser, export gọi API, xóa dọn token/cache | Picker thủ công chưa thật; consent/schema/guest merge/provider thật chưa có; GPS lỗi chỉ dùng vị trí đã lưu |
| M2-1 và UI M2-3 | Tìm/lọc vùng, bind dish id/detail/scaled ingredients/saved vào mẫu | API budget/count/404/servings chưa sửa; runtime còn cho 1–20 thay vì mục tiêu 1–10; chưa CMS nội dung |
| M3-2/5 phần trình bày | Feedback/history/cache UI, chat results, spin gọi API | Invalidate cache server và pipeline backend vẫn thiếu; không được coi mọi mini-game đã an toàn chỉ vì spin đổi API |
| M4-1 | Danh sách đọc `distance_m`, chi tiết/menu/report bind dữ liệu | Nền bản đồ có nhãn minh họa, chưa map thật; giờ mở/guard reports/dữ liệu vẫn chưa hoàn tất |
| M5-1/3 phần UI | order→redirect id→nút mở bên ngoài→confirm; nút phone riêng | order chỉ nằm trong state RAM trình duyệt; call không tạo redirect row; idempotency/link validation server chưa sửa; các anchor Live App cũ còn cần kiểm đủ |
| M9-1 và món CRUD cơ bản | Dashboard/queue/reports, form tên–giá–calo, review/unpause | Form đặt ở S03 hiện chỉnh món cơ bản, **chưa phải quản lý công thức**; S08/S09 chưa được triển khai đầy đủ; OCR publish/role/audit atomic chưa có |

Đây là rà soát mã, không chứng nhận trình duyệt của head mới. Phần Live App cũ vẫn dùng handler gốc ở nhiều chỗ, nên cần kiểm cả Live App desktop lẫn bộ màn `/app`, không chỉ một bề mặt. Header/title/body PR tại lần kiểm có thể còn mô tả cũ; lấy diff/head làm chuẩn.

## 1. M1 — Tài khoản, vị trí và khẩu vị (45%)

### Ý định và màn giữ lại

`screens_m1_m2.js`: S01 chào/đăng nhập/khách; S02 OTP; S03 vùng; S04 cay; S05 dị ứng; S06 chế độ ăn; S07 ngân sách; S08 GPS/chọn khu vực; S09 hồ sơ; S10 cài đặt/xuất/xóa. Live App có `lpanel-profile`, `loadLiveProfile`, `saveLiveProfile`, `exportPdpdData`, `deleteAccountPdpd`. Mục tiêu onboarding dưới 45 giây là yêu cầu thiết kế, chưa được đo.

### Hiện chạy được và còn giả

- API `/auth/guest`, `/auth/otp/request`, `/auth/otp/verify`, `/auth/me`, `/me/profile` GET/PUT/PATCH, `/me/export`, DELETE `/me` có thật. JWT có hạn, OTP ngẫu nhiên/hash/giới hạn thử; DB giữ tài khoản, OTP, hồ sơ qua khởi động lại. Guest cũng có tài khoản riêng.
- Live App tự xin guest token, sửa và lưu hồ sơ tới DB được theo đường mã. Các nút social và onboarding trong bộ màn thiết kế chủ yếu `goScreen`, không thực hiện đăng nhập hay lưu từng bước.
- Production thiếu eSMS thì OTP trả 503, không phát mã giả. Chưa thử SMS thật. Không có Google/Apple/Zalo dù mockup vẽ nút.
- Không thấy `navigator.geolocation` trong Live App. `/me/location`, `/me/consent` ghi ở mockup chưa có route. Hồ sơ mới sao chép Biên Hòa, dị ứng mẫu và `pdpd_consent: true`: không phải người dùng đã tự chọn/đồng ý.
- API nhận gần như toàn bộ trường JSON hồ sơ (ngoại trừ id/phone/role), thiếu schema kiểu dữ liệu, miền giá trị; có thể làm recommender lỗi. UI xuất JSON chỉ xuất biến hồ sơ, không gọi `/me/export`; API export chỉ lấy tối đa 50 lịch sử và analytics tổng dùng chung trong RAM. Không nên tuyên bố “toàn bộ dữ liệu/tuân thủ pháp luật” từ kết quả này.
- Guest → đăng nhập tạo/dùng tài khoản điện thoại khác, chưa chuyển collections/history/khẩu vị của khách. Cần xử lý hết hạn token, đăng xuất và lưu cache riêng tư; xóa DB đã có nhưng giao diện chưa dọn token chắc chắn.

### Nghiên cứu dùng để hoàn thiện

eSMS yêu cầu đăng ký Brandname trước; API GENCODE còn yêu cầu template. Có key chưa đảm bảo gửi được SMS [R1]. Đề xuất giữ cách OTP hiện có cho bản đầu **nếu** có tài khoản/Brandname đã duyệt; không mở cả 4 cách đăng nhập cùng lúc. Dị ứng là dữ liệu cần thận trọng; Cookpad cũng phân biệt thông tin dị ứng trong chính sách riêng tư [R3]. Chính sách pháp lý cần rà soát văn bản hiện hành, không chỉ lặp nhãn NĐ 13/2023 cũ.

### Việc theo thứ tự

| ID / cỡ | Màn có sẵn | Logic/API + dữ liệu phải làm | Nghiệm thu / phụ thuộc |
| --- | --- | --- | --- |
| M1-1 M **P2** | S01–S07, S09 | Nối nút/field thật vào auth/profile; lưu draft onboarding; dùng `regions`, `hard_allergies`, `budget_min/max` đúng trường; bỏ nút social chưa hỗ trợ, bỏ nhãn bảo mật 2 lớp sai | 2 người lưu khác nhau, tải lại/khởi động lại vẫn đúng; không toast thành công khi 4xx/5xx |
| M1-2 M | S03–S09 | Schema profile, enum vùng/chế độ ăn/allergen, số hữu hạn/cay 0–3/ngân sách hợp lệ/lat ±90/lng ±180; mặc định trung tính, chưa hỏi không được gán dị ứng hoặc đồng ý | Payload sai trả 400, không ghi DB; fixture null/mảng sai không làm API 500 |
| M1-3 M | S01–S02 | Chốt một provider; nếu SMS: kiểm template, timeout/retry có chủ ý, per-IP/per-phone/per-device rate limit và hạn mức chi phí; không log OTP/token ở prod | Đúng/sai/hết hạn/gửi lại/nhà mạng lỗi; không trả dev_code ở prod. **Cần chọn cách đăng nhập + key/Brandname; không gửi tin trả phí khi chưa duyệt** |
| M1-4 M | S08 | GPS có xin quyền, timeout/denied → picker khu vực; lưu lat/lng/khu vực/độ chính xác bằng `/me/profile`; không cần route location riêng | Cho phép/từ chối/máy không GPS đều đi tiếp; vị trí thay đổi làm M4 khác. **Cần thành phố + danh mục khu vực hợp lệ** |
| M1-5 M | S01–S02, S08–S10 | Gộp dữ liệu guest vào tài khoản khi login bằng transaction và quy tắc chống trùng; logout/expiry dọn token, không tự replay lệnh ghi | Khách lưu món → login vẫn còn; không trộn người khác, 401 không phát lệnh hai lần |
| M1-6 M | S10 | Đồng ý theo mục đích/version/thời điểm, tối thiểu hóa vị trí; UI gọi export thật, phân trang đủ lịch sử, bỏ analytics chung; xóa/dọn cache/token, mô tả rõ dữ liệu tài chính giữ nhưng bỏ liên kết | Export chỉ dữ liệu mình và đủ >50 lịch sử; xóa xong token cũ 401; mở offline không lộ hồ sơ trước. **Cần nội dung chính sách/chủ thể chịu trách nhiệm dữ liệu** |

## 2. M2 — Món, công thức, bộ sưu tập (45%)

### Ý định và màn giữ lại

S01 khám phá; S02 tìm/lọc; S03 danh mục/vùng; S04 chi tiết; S05 dinh dưỡng; S06 nguyên liệu/khẩu phần; S07 từng bước nấu; S08 đã lưu. Live App có `lpanel-explore`, `lpanel-recipe`; dùng chính card/ảnh/thành phần đó, không làm shell mới. Mục tiêu kho lớn 200–600 món là hướng đi cũ, không phải dữ liệu sẵn có hoặc điều kiện bắt buộc nhập hàng loạt trước thử nghiệm.

### Hiện chạy được và còn giả

- `/dishes?q=&region=&safe_only=`, `/dishes/:id?servings=`, `/dishes/categories`, `/dishes/semantic-search`, `/dishes/:id/similar`, `/me/collections` GET/POST và DELETE `/me/collections/:dishId` có thật. Danh sách/chi tiết/nguyên liệu/bước nấu lấy DB, bộ sưu tập theo người.
- API chi tiết trả cả nguyên liệu đã scale, bước nấu, quán đang bán. Không có `/recipe`, `/ingredients`, `/steps`, `/me/favorites` riêng như nhãn trên mockup; UI nên đọc cùng đối tượng chi tiết.
- Danh mục vẫn số cứng 145/190/165/60/40. Danh sách chỉ lọc q/region/an toàn, không thực thi `featured`, `budget_max`, loại bữa như mẫu. Tìm kiếm semantic là logic cục bộ, không phải pgvector được chứng minh.
- ID món sai ở chi tiết/similar/story bị thay bằng món đầu tiên thay vì 404. `servings` chưa chặn NaN, số vô hạn/lớn, chưa giới hạn 1–10; cách làm tròn mọi đơn vị trừ lít dễ sai gia vị. Calo/macro chưa có quy ước rõ theo người hay cả công thức.
- Collections có một nhóm mặc định; chưa CRUD nhiều nhóm, chưa kiểm món tồn tại trước lưu, chưa lưu quán. Màn mẫu còn dữ liệu viết sẵn; không coi click chuyển màn là đọc dữ liệu thật.
- Ảnh base64/`img_key` có thể chỉ minh họa, không bảo đảm đúng món/quyền ảnh. Dị ứng chưa có trạng thái “chưa xác minh”; thiếu nhãn bị hiểu như an toàn.

### Nghiên cứu dùng để hoàn thiện

Cookpad công khai rằng công thức có thể không chính xác/an toàn; ảnh và công thức không mặc nhiên được lấy lại [R2]. Áp dụng: lưu nguồn/quyền của từng nội dung, có người duyệt thành phần và cảnh báo kiểm tra với quán; không hứa “an toàn dị ứng 100%” từ nhãn thiếu. Không sao chép kho công thức bên ngoài để đủ con số.

### Việc theo thứ tự

| ID / cỡ | Màn có sẵn | Logic/API + dữ liệu phải làm | Nghiệm thu / phụ thuộc |
| --- | --- | --- | --- |
| M2-1 M **P2** | S01–S04, S08 | Nối q/region/id thật, lưu/bỏ lưu bằng collections; S05–S07 đọc chi tiết chung, giữ selection khi chuyển màn; loading/rỗng/lỗi/thử lại | “bun bo hue” và “bún bò huế” cùng kết quả; bấm 3 món khác nhau mở đúng id; DB restart vẫn lưu; không còn số 542 giả |
| M2-2 M | S01–S04 | Hợp đồng tìm/lọc rõ: enum vùng bac/trung/nam, meal_slot, diet, giá; count tính DB; phân trang, 404 thật, không lấy món đầu thay id sai | q không có → rỗng; id sai → 404; bộ lọc UI và tổng số đúng sau admin thêm/xóa |
| M2-3 M | S04–S07 | Validate servings nguyên 1–10; đơn vị/độ chính xác/rounding; xác định macro/calo mỗi suất; bước nấu theo id và timer local có thể tiếp tục | 1/2/4/10 suất đúng; 0/-1/abc/1e9 trả 400; unit g/ml/thìa không mất lượng nhỏ; tạm dừng/tiếp tục timer không nhảy món |
| M2-4 L | S03–S07 + M9-S02/S03 | Schema nội dung: tác giả/nguồn/license ảnh, định lượng, công thức, diet/allergen đã duyệt, published/version; importer có dry-run/chống trùng | Nhập thử bộ nhỏ, báo lỗi từng dòng; chỉ published được gợi ý; mọi món có ảnh đúng hoặc placeholder trung thực. **Cần nguồn dữ liệu và quyền sử dụng** |
| M2-5 M | S08 | Kiểm dishId tồn tại; nếu giữ nhiều bộ sưu tập như mẫu: API đề xuất CRUD collections theo id, chống lost update, xử lý món bị gỡ | Hai tab lưu cùng lúc không mất món; không đọc/sửa nhóm người khác; xóa món không để link hỏng; nếu MVP chỉ 1 nhóm phải ghi rõ UI |
| M2-6 M | S04–S07 | Cache chỉ nội dung công khai gần nhất; trạng thái offline/read-only; xuất bản URL chi tiết ổn định, meta/ảnh chia sẻ cho P3 | Offline đọc được công thức đã mở, không trả dữ liệu riêng người cũ; deep link reload đúng món; kiểm 360/768/1440 và phím/bộ đọc màn hình |

## 3. M3 — Gợi ý, Măm AI và quyết định bữa ăn (35%)

### Ý định và màn giữ lại

S01 ba món; S02 lý do; S03 Decision Hub (quay/rút quẻ/túi mù); S04 chat; S05 kết quả; S06 phản hồi; S07 lịch sử. Giữ Today, chat, game của Live App, không thay bằng giao diện mới; sửa đầu vào/dữ liệu của các thành phần đó.

### Hiện chạy được và còn giả

- `/suggestions/today`, `/suggestions/spin`, POST `/chat`, POST `/suggestions/feedback`, GET `/suggestions/history` dùng catalogue/hồ sơ/history từ repository. Today loại nhãn dị ứng trùng tuyệt đối, disliked, món đã ăn 72 giờ; ưu tiên vùng/cay/thời tiết/quán gần. Quán của gợi ý dùng view DB nhưng khoảng cách ở recommender được tính Haversine, không phải truy vấn PostGIS cho từng lần Today.
- Bộ lọc chỉ hiểu mã dị ứng đã gắn sẵn; không hiểu tên đồng nghĩa hoặc nguyên liệu thiếu. `diet_mode`, `meal_slots`, `budget_min` chưa được dùng làm điều kiện Today; spice chỉ cộng điểm. Giá tự nhiên được nới 25%; slot tài trợ không kiểm đủ ngân sách, có thể dùng bán kính campaign rộng hơn người dùng.
- Tối đa một slot tài trợ theo số tuyệt đối, nhưng khi chỉ còn một món tài trợ và ít món tự nhiên thì tỷ lệ có thể vượt 1/3. M7 đóng băng nên cần tắt phân phối tài trợ cho MVP hoặc sửa chặt mẫu số, không mở chiến dịch.
- Thời tiết luôn từ `seed.js`: 26°C/rain_cool/Biên Hòa. Lý do câu chữ cũng luôn “dịu mát”, không phản ánh trạng thái thật.
- Gemini hardcode `gemini-2.0-flash`, key trên query URL, không timeout chat. Chat trả `intent` từ Gemini nhưng `options` lại tính riêng bằng regex; hai kết quả có thể mâu thuẫn. `mode`, `meal_slot`, `spice_max`, nguyên liệu và cooldown chưa được áp dụng đầy đủ cho options; câu “có ghế trẻ em & không cay” không kiểm ghế thực tế.
- Spin API chỉ lọc safety/disliked, không cùng cooldown/ngân sách/bữa ăn Today. Live App còn `foodFortunes`, `blindBoxLoots` và voucher viết sẵn: không đi qua lọc dị ứng; không được giữ như kết quả món thật.
- Feedback có thể báo thành công dù HTTP lỗi trong UI; skipped chưa thay đổi candidate/disliked và cache chưa bị xóa ở route feedback nên đổi món có thể hiện y nguyên, eaten có thể vẫn hiện do cache. History chỉ có phản hồi, không lưu đủ lần hiển thị/lý do theo spec; `next_cursor: null`.

### Nghiên cứu dùng để hoàn thiện

Tài liệu Gemini đã liệt kê dòng 2.0 Flash ngừng cung cấp [R4]; không chỉ đổi badge. Chọn model còn hỗ trợ tại lúc triển khai, cấu hình qua env và smoke test có hạn mức. Thời tiết cần nguồn có phép dùng thương mại: Open-Meteo phân biệt giấy phép dữ liệu và quyền dùng hosted API thương mại [R5]. Đề xuất chưa mua dịch vụ: có adapter/cache và trạng thái “chưa có thời tiết”, không giả là quan trắc thật.

### Việc theo thứ tự

| ID / cỡ | Màn có sẵn | Logic/API + dữ liệu phải làm | Nghiệm thu / phụ thuộc |
| --- | --- | --- | --- |
| M3-1 M | S01–S05 | Một pipeline candidate dùng chung Today/chat/spin/game: safety đã duyệt, diet, meal, spice khi là ràng buộc, budget, cooldown; eat_out chỉ quán đủ điều kiện, cook chỉ công thức | Matrix dị ứng × chay × ngân sách × giờ ăn × đã ăn; không đủ 3 thì trả 0–2 + lý do, không tự nới an toàn |
| M3-2 M **P2 phần UI** | S01–S03, S06–S07 | Feedback kiểm id/action; invalidate cache theo người và context/version; skipped loại khỏi lần đổi; lưu suggestion id/lý do/context và phân trang history | Bấm đổi ra món khác hoặc báo hết lựa chọn; eaten ẩn ngay và qua restart; 72 giờ hết hạn thì quay lại; không bịa tên quán mặc định |
| M3-3 M | S04–S05 | Parse/validate intent một lần rồi chạy pipeline; lời AI chỉ từ kết quả thật, không thêm quán/tiện ích; timeout/abort/circuit breaker; model config, key header, không lộ log | “4 người 300k không cay ăn chay gần đây” đúng tổng tiền và tất cả điều kiện; provider lỗi/JSON sai về fallback có nhãn; prompt injection không bỏ safety. **Cần key để xác minh AI thật** |
| M3-4 M | S01–S02 | Weather adapter theo GPS/thành phố/timezone, TTL và observed_at/source; fallback trung thực; lý do lấy đúng dữ liệu | Giả lập nắng/mưa/mất nguồn bằng fixture; không ghi “26°C thật” khi thiếu nguồn. **Cần chọn nguồn/duyệt chi phí nếu thương mại** |
| M3-5 M **P2 phần UI** | S03 | Giữ animation 3 game, nhận dishId từ API pipeline an toàn; bỏ loot/voucher giả; không đưa quảng cáo M7 vào lại | Dị ứng tôm không bao giờ quay/rút/mở ra món tôm; response rỗng dừng animation; giảm chuyển động có hiệu lực; không có voucher không tồn tại |
| M3-6 M | S01–S07 | Tắt tài trợ MVP bằng cấu hình; vẫn test ≤1/3 trên kết quả thực và budget/radius khi bật lại; benchmark NLU bộ câu thật đã gán nhãn; đo p95 gồm DB/network thay vì một lần tính trong RAM | Test 0/1/2/3 candidate, campaign phạm vi rộng, nhiều người; đo phân vị và timeout; báo tỷ lệ thực, không dùng số 100% hardcode |

## 4. M4 — Quán, vị trí và bản đồ (30%)

### Ý định và màn giữ lại

S01 danh sách gần món; S02 bản đồ; S03 chi tiết quán; S04 menu/giá; S05 còn món; S06 báo sai. Live App `lpanel-places`, `loadLivePlaces`, bộ lọc all/ac/kids/high_rating đã có; tiếp tục dùng card/bộ lọc đó.

### Hiện chạy được và còn giả

- GET `/places?dish_id=&open_only=` gọi PostGIS ST_DWithin/ST_Distance theo tọa độ/bán kính trong **hồ sơ**, trả `distance_m`; chỉ hiển thị verified, không paused, report_count <3 khi open_only. Query `lat/lng/radius` trên URL mẫu không được route đọc.
- “Đang mở” hiện thực chất là verified/not paused, **không tính lịch giờ mở cửa**, ngày nghỉ, qua nửa đêm; thiếu xác minh lại sau 90 ngày theo handoff.
- Live App đọc `distance_meters || 500` trong khi API trả `distance_m`: nhiều card luôn 500m. Số review/rating/giờ có giá trị thay thế giả. Các tiện ích ac/kids/≥4.8 có lọc trong UI nhưng dữ liệu chưa được xác minh.
- Không có API GET `/places/:id`, `/places/map`, `/places/:id/menu`, `/availability`, `/dishes/:id/places` như nhãn màn; `/places` đã trả dữ liệu menu và chi tiết đủ cho bước đầu. Bản đồ trong bộ màn là mock, chưa có map tương tác thật.
- POST `/places/:id/reports` ghi DB thật và tạm dừng khi đếm đủ 3. Nhưng **mọi lý do đều tăng đếm đóng cửa, cùng một người gửi 3 lần cũng tạm dừng, không có cửa sổ thời gian/chống spam**. Admin mở lại xóa reports, mất bằng chứng xử lý.

### Nghiên cứu dùng để hoàn thiện

GrabFood yêu cầu địa chỉ để xác định các quán giao được tới đó [R6]; bán kính thẳng 3 km của ta chỉ là “gần bạn”, không chứng minh đối tác nhận giao hoặc còn món. Google Maps URLs cho phép mở chỉ đường đa nền tảng không cần nhúng map có phí [R7]. Chưa chọn nhà cung cấp tile/geocoding: không gọi tile công khai hàng loạt hoặc coi API Maps trả phí là miễn phí.

### Việc theo thứ tự

| ID / cỡ | Màn có sẵn | Logic/API + dữ liệu phải làm | Nghiệm thu / phụ thuộc |
| --- | --- | --- | --- |
| M4-1 M **P2 phần UI** | S01, S03–S05 | Dùng tọa độ M1, truyền dishId xuyên luồng; render `distance_m`, null thật; dùng data `/places` trước, thêm GET `/places/:id` đề xuất nếu cần deep link | Đổi vị trí đổi kết quả; 2.99km vào/3.01km ra; card không còn 500m mặc định; món đã chọn chỉ hiện quán có bán |
| M4-2 L | S03–S05 + M9-S04 | Nhập quán có nguồn/quyền: tọa độ, menu mapping, giá, phone/link, tiện ích, giờ mở, ngày nghỉ, verified_at/by, status; thêm CRUD admin (xem M9) | Chọn mẫu quán và kiểm chéo thực địa/nguồn được phép; biết ai xác nhận lúc nào; không dùng địa chỉ/giá mẫu. **Cần thành phố + nguồn/quyền dữ liệu** |
| M4-3 M | S01–S05 | Hàm giờ mở timezone Asia/Ho_Chi_Minh, giờ qua đêm/ngày nghỉ/override; staleness 90 ngày thành trạng thái cảnh báo/tạm loại theo chính sách; cùng predicate với M3 | Trước/sau đóng cửa, qua 00:00, nghỉ lễ, stale/paused không được nói “đang mở”; không có giờ → “chưa rõ”, không tự bịa |
| M4-4 M | S02 | Gắn map tương tác vào khung sẵn, list↔marker, vị trí thủ công, attribution; adapter tile/geocoder và cấu hình khóa/hạn mức nếu có | Pan/zoom/chọn marker mở đúng S03; GPS bị từ chối vẫn dùng được; map lỗi có list. **Cần chọn nguồn map và duyệt phí nếu phát sinh** |
| M4-5 M | S06 + M9-S06 | Enum lý do, dedupe user/place/time window, chỉ lý do đóng cửa tăng guard; chống guest tạo nhiều tài khoản; transaction/unique constraint; giữ evidence và trạng thái xử lý | 1 người gửi 3 lần không khóa; 3 người đủ điều kiện trong cửa sổ mới tạm ẩn; sai giá không khóa; admin phục hồi không xóa lịch sử. **Đề xuất cửa sổ 24 giờ, là thay đổi cần chủ sản phẩm duyệt** |
| M4-6 S | S04–S05 | Availability có updated_at, stale label; M6 đóng băng thì admin cập nhật, không hứa realtime; quán không có món phù hợp có trạng thái rỗng | Hết món → không vào M3/redirect món đó; API/UI nhất quán sau refresh; ghi rõ lần cập nhật |

## 5. M5 — Chuyển sang đặt món, chỉ đường, gọi điện (35%)

### Ý định và màn giữ lại

S01 hub bốn hành động; S02 chọn GrabFood/ShopeeFood; S03 bản đồ/chỉ đường; S04 gọi; S05 xác nhận đã ăn. M5 là **chuyển sang ứng dụng ngoài**, không phải hệ thống giỏ hàng/thanh toán/giao vận. beFood/Xanh SM chỉ hiện khi có link hợp lệ được kiểm, không tự mở rộng tích hợp.

### Hiện chạy được và còn giả

- POST `/orders/redirect` ghi user/place/dish/partner/link vào `order_redirects`; POST `/orders/:id/confirm-eaten` kiểm quyền người sở hữu, ghi history và áp cooldown, cache bị invalidate. Đã có test DB.
- Live App hiện bấm anchor đối tác trực tiếp; không gọi `/orders/redirect`, không giữ redirect id, không có vòng quay về đúng đơn. Các màn thiết kế S02–S05 chủ yếu `goScreen`. Vì vậy API tốt hơn luồng UI thực tế.
- ID quán/món sai bị thay bằng bản ghi đầu tiên. Partner chỉ kiểm regex, không allowlist; không kiểm món thuộc menu/còn bán/quán mở. Link thiếu thì tự thay bằng Maps rồi vẫn đếm order_click.
- Route nối `?utm_...` vào mọi `baseLink`, có thể phá `tel:`; phone lấy từ `place.phone` chưa được xử lý riêng. Link mẫu chỉ là trang chủ/search hoặc link minh họa, không chứng minh mở đúng cửa hàng.
- Confirm lại nhiều lần thêm nhiều history; id redirect không tồn tại cũng tạo log từ body hoặc món/quán mặc định. Thiếu idempotency và sự phân biệt “tôi tự xác nhận đã ăn” với “đơn được đối tác xác nhận”.
- Counters order/direction/call vẫn ở RAM toàn cục; row redirect là bền vững. Không có quyền truy cập trạng thái đơn thật của đối tác.

### Nghiên cứu dùng để hoàn thiện

Grab có hướng dẫn link bán hàng rút gọn của quán, nhưng bài hướng dẫn là từ 2022, không phải API/affiliate contract hiện hành [R8]. Đề xuất lưu link được chủ quán cung cấp rồi thử trên thiết bị, không tự ghép scheme không công bố. Trong tìm kiếm này chưa xác minh được hợp đồng public deep-link/affiliate hiện hành của ShopeeFood; điều khoản merchant không trao quyền tự lấy dữ liệu [R9]. Google Maps hỗ trợ URL `https://www.google.com/maps/dir/?api=1&destination=lat,lng` [R7]. Không cần key thanh toán để hoàn tất M5.

### Việc theo thứ tự

| ID / cỡ | Màn có sẵn | Logic/API + dữ liệu phải làm | Nghiệm thu / phụ thuộc |
| --- | --- | --- | --- |
| M5-1 M **P2 phần UI** | S01–S04 | Cùng action handler cho card Today/quán/chi tiết: gọi redirect với id thật, giữ redirectId theo user, sau thành công mới mở link; popup-block có nút tiếp tục | Bấm mỗi hành động tạo đúng 1 row, mở đúng quán/món; API lỗi không giả thành công; không tự mở tab ngoài trong test tự động |
| M5-2 M | S01–S04 | Builder theo partner allowlist: HTTPS đối tác được duyệt, maps URL chuẩn, `tel:` chỉ số; encode query đúng; id sai 404, menu/availability/status validate | Javascript/data URL bị chặn; unknown partner 400; phone không UTM; không chuyển Maps giả làm Grab. **Cần link cửa hàng xác minh/quyền đối tác** |
| M5-3 M **P2 phần UI** | S05 | Return/resume chỉ hỏi “Bạn đã ăn món này chưa?” theo redirect đang pending; xác nhận server idempotent/transaction; bỏ fallback id tùy ý, self-report riêng qua feedback | Reload/xác nhận 2 lần/concurrent chỉ 1 history; người B không xác nhận đơn A; đóng app rồi mở vẫn đúng món; không khẳng định đơn giao thành công |
| M5-4 M | S01–S05 | Test hợp đồng với fixture + thử link thực Android/iOS/desktop có/không app; thiếu app → web fallback; link chết → báo lỗi, có gọi/chỉ đường thay | Mỗi đối tác ít nhất một link quán thật mở đúng trên ma trận máy; không test đặt/mua thật khi chưa xin phép; thiếu link thì ẩn/khóa nút có giải thích |
| M5-5 S | S01–S05 + M9-S01 | Sự kiện tối thiểu của luồng từ redirect row, có action_type/clicked_at/confirmed_at và chống trùng; chỉ báo click và self-report, không doanh thu/đơn đối tác | Restart không mất số liệu, 3 hành động không lẫn; không gửi phone/GPS thô sang UTM; M10 đầy đủ vẫn đóng băng |

## 6. M9 — Quản trị và chất lượng dữ liệu (30%)

### Ý định và màn giữ lại

`screens_m9_m10_expansion.js`: S01 dashboard; S02 món/allergen; S03 công thức/scale; S04 xác minh quán; S05 ghép OCR; S06 reports/mở lại; S07 duyệt ads; S08 người dùng/quyền; S09 audit/cấu hình. Giữ adminShell và `lpanel-admin`. Không kích hoạt lại merchant/OCR ingestion/quảng cáo chỉ để lấp đủ chín màn: khả năng duyệt nội dung nhập tay vẫn cần.

### Hiện chạy được và còn giả

- `/admin/dashboard` lấy counts món/quán, OCR queue, reports, campaigns từ DB; phần events RAM. Live App có đăng nhập admin, xem dashboard/duyệt cơ bản, nhưng chưa CMS đầy đủ.
- POST `/admin/dishes`, PATCH/PUT/DELETE `/admin/dishes/:id` thật, audit thật. Fields được whitelist nhưng chưa CRUD nguyên liệu/steps/macros/ảnh/diet/meal đầy đủ. GET `/admin/dishes` mà mockup ghi chưa có riêng; có thể tái dùng `/dishes` nhưng cần xem cả draft trong admin.
- POST `/admin/ocr-review` hiện sửa status/rejection_reason; **không xuất bản menu mapping/revision** sau duyệt. Không route có path `ocr-review/:id` như mockup. Chấp thuận thiếu decision tự thành approved; lý do từ chối chưa bắt buộc.
- POST `/admin/places/:id/approve|unpause` cùng gọi `unpausePlace`: vừa đặt verified vừa clear pause vừa xóa reports. Xác minh quán mới và mở lại quán vi phạm chưa tách nghiệp vụ.
- `/admin/audit-logs` đọc DB; chưa filter/pagination đầy đủ, event và thay đổi chưa cùng transaction. API `/admin/rbac/roles` trả sáu vai trò mẫu; `/admin/rbac/users` trả người mẫu, POST chỉ echo “updated” không lưu. **Quyền thực tế chỉ user/merchant/admin, cấp bằng env số điện thoại**, không phải RBAC 6 vai trò.
- Chưa API quản lý công thức chuẩn/quán mới/menu/giá đầy đủ; `/admin/reports` và `/admin/config` trong mockup chưa có. Không tính PUT community recipes M20 là CMS công thức M2.
- Audit có thật không có nghĩa bất biến: chưa chứng minh DB role/retention/chống sửa; log chứa IP cần chính sách. M9-S07 ads có API moderation nhưng nằm ngoài phạm vi mở kinh doanh.

### Nghiên cứu dùng để hoàn thiện

OWASP khuyến nghị mặc định từ chối và kiểm quyền trên mọi request [R10]; danh sách role vẽ trên UI không phải hệ thống quyền. Áp dụng deny-by-default, kiểm test theo vai trò và giữ audit quyết định. Cookpad Community Guidelines là ví dụ chính sách nội dung nêu rõ nội dung được phép [R2]; kho của ta cần quy tắc nguồn/ảnh/an toàn/dị ứng và trạng thái duyệt trước xuất bản, không chỉ nút approve.

### Việc theo thứ tự

| ID / cỡ | Màn có sẵn | Logic/API + dữ liệu phải làm | Nghiệm thu / phụ thuộc |
| --- | --- | --- | --- |
| M9-1 M **P2 phần UI** | S01–S02, S05–S06, S09 | Nối dashboard thật, role denied/login, mutation lỗi không báo thành công; bỏ KPI/chart giả; ẩn S07 và cấu hình chưa hỗ trợ | Guest/user 401/403; admin có số 0 thật khi DB rỗng; loading/rỗng/lỗi/thử lại; không gọi module đóng băng |
| M9-2 L | S02–S03 | CRUD món/công thức chuẩn: draft/published/archived, ingredient/unit/allergen/diet/macro, ảnh nguồn/license; thêm API đề xuất `/admin/recipes/:id` hoặc nested dish recipe nhất quán | Tạo → preview → duyệt → xuất hiện M2/M3; chưa xác minh allergen không publish; rollback version; API và UI dùng cùng schema M2 |
| M9-3 L | S04 | CRUD quán/menu/giờ/availability (API admin đề xuất), nhập CSV có dry-run/dedupe; workflow pending→verified, evidence/link/license/verified_at; tách approve/unpause | Quán mới chưa duyệt không có M4; duyệt đúng vị trí/menu; chỉnh giá cập nhật M3/M5; import lỗi không ghi dở. **Cần nguồn quán và người được quyền xác minh** |
| M9-4 M | S05 | Review chọn dishId chuẩn, price, reason bắt buộc khi reject; optimistic concurrency/version; transaction status+mapping+menu_revision+audit; M6 ingestion vẫn tắt | Hai admin duyệt cùng bản chỉ một thành công; reject không publish; approved vào menu đúng quán và giữ giá cũ trong revision; fixture được, chưa cần AI key |
| M9-5 M | S06 | Hàng đợi reports filter/status, bằng chứng, resolve/reject/unpause có reason; không xóa reports; tích hợp anti-abuse M4-5 | Báo cáo đã xử lý còn tìm/audit được; mở lại không đổi nhầm verification; quán đủ điều kiện trở lại M4 sau refresh |
| M9-6 M | S08 | Bản đầu dùng admin đơn giản thật, không giả sáu role; danh sách admin được duyệt qua env; nếu cần nhiều người, phase riêng quyền granular + API user/role lưu DB, phòng tự khóa admin cuối | Tất cả admin routes test user/guest/merchant/admin; role đổi có hiệu lực, không chỉ echo. **Cần chủ sở hữu chọn người quản trị; đề xuất chưa xây 6 role** |
| M9-7 M | S09 | Audit cùng transaction thay đổi, actor/target/before-after/reason/requestId, lọc/phân trang; quyền DB hạn chế app xóa log, backup/retention; cấu hình có whitelist/version | Ghi lỗi rollback cả dữ liệu và audit; không sửa/xóa log qua API; export không lộ secret; drill restore DB. **Cần chính sách lưu IP/log và backup được duyệt** |

## 7. Thứ tự bàn giao và cổng nghiệm thu chung

1. **Chốt hợp đồng màn/API và bảo vệ đầu vào:** M1-2, M2-2/3, M3-1/2, M4-5, M5-2/3. Đây là lỗi đúng/sai dữ liệu, không chờ nhập kho lớn.
2. **P2 hoàn tất giao diện cũ:** tiếp nhận các dòng đánh dấu P2, đối chiếu head mới của PR #3. PR này chỉ chịu phần wiring/UI; không tự nhận đã sửa backend của dòng đó. Một control phải có một handler, không có product shell thứ hai.
3. **M9 nhập/duyệt và M1 vị trí/đăng nhập:** làm nền cho dữ liệu có quyền tại thành phố đã chọn; M2/M4 sau đó mới có nội dung vận hành.
4. **M3 hoàn thiện lựa chọn/AI/thời tiết**, tiếp theo **M5 thử mở đối tác và quay lại**. Không cần SMS/payment để kiểm phần lớn logic bằng fixture.
5. **Trước mở công khai:** test trình duyệt + PostgreSQL qua control thực, dữ liệu chuẩn nhỏ; giới hạn tần suất, CORS allowlist, giới hạn payload, session/cache riêng tư; kiểm đường WebSocket merchant chưa xác thực — tắt trong MVP hoặc xác thực, không mở lại M6. Có backup/restore, giám sát lỗi, chính sách dữ liệu; đổi DB trước hạn miễn phí **21/12/2026**. Render/prod/thay gói trả phí đều xin duyệt riêng.

### Bộ kiểm không được bỏ

| Cổng | Cách kiểm | Điều kiện qua |
| --- | --- | --- |
| M1 → M2 | Trình duyệt + DB: khách → onboarding → lưu món → login → reload/restart → export/delete | Không mất/trộn hồ sơ; đồng ý do người dùng chọn; token/cache bị thu hồi đúng |
| M2 → M4 | Bấm món → scale → quán đúng món; GPS cho/từ chối | ID giữ đúng; khoảng cách thật; không bịa quán gần, count, ảnh hay giờ |
| M3 | Cùng dataset cho Today/chat/3 game, thiếu ứng viên, dị ứng/chay/đã ăn/slot tài trợ | Không lách an toàn; ít món nói rõ; cache đổi ngay sau feedback/admin |
| M4 → M9 | 1 người spam, 3 người hợp lệ, sai giá, mở lại | Guard đúng lý do/cửa sổ; lịch sử còn; không xuất bản quán ngoài giờ |
| M5 | Redirect→external→resume→confirm 2 lần/concurrent, tài khoản khác | Link đúng; một record/history; chỉ “tự xác nhận đã ăn”, không giả trạng thái giao hàng |
| M9 | Tạo/sửa/duyệt/gỡ món và quán, 2 admin cùng sửa | DB+audit atomic; nội dung chưa duyệt không hiện; denied không đụng dữ liệu |
| UI/PWA | 360/768/1440; keyboard; slow/offline; 401/403/404/429/500; giảm chuyển động | Không tràn, có nhãn/focus/lỗi rõ và retry; không cache API cá nhân; không tự replay ghi |
| Độ bền | `npm test`, `npm run test:db`, `npm run build:ui`, restart/restore | 0 fail/0 skip DB suite; bundle cùng source; test mới cho từng hành vi thay đổi |

## 8. Các quyết định còn mở và đề xuất

| Khi cần | Quyết định | Đề xuất mặc định, chưa phải phê duyệt |
| --- | --- | --- |
| Trước M1-4/M4-2 | Thành phố mở đầu | Một thành phố; Biên Hòa chỉ vì kho mẫu ở đó, không coi đã được chọn |
| Trước M2-4/M9-3 | Nguồn món/quán/ảnh và quyền dùng | Tự nhập/được chủ nguồn cho phép; thử kho nhỏ có bằng chứng; không scrape Grab/ShopeeFood/Cookpad để đủ số |
| Trước M1-3 | SMS OTP hay Google/Zalo; chi phí/provider | Chọn một; giữ OTP nếu đã có eSMS Brandname/template hợp lệ; khách tiếp tục dùng phần công khai |
| Trước mở admin | Số điện thoại/người quản trị, chính sách duyệt | Admin đơn giản, tối thiểu quyền; chưa hứa 6 role/2FA cho đến khi làm thật |
| Trước bật guard mới | Báo đóng cửa: thời gian và điều kiện tài khoản | 3 tài khoản đủ điều kiện khác nhau/24h; chống guest spam; không tăng đếm khi sai giá |
| Trước AI/weather/map thật | Provider/model, quyền thương mại, hạn mức | Model được hỗ trợ theo docs tại lúc triển khai; adapter/fallback; xin duyệt mọi phát sinh tiền |
| Trước M5 link thật | Link từng quán/đối tác, có hợp đồng affiliate không | Chỉ link đã thử; chưa tuyên bố affiliate, đồng bộ menu hay đơn đối tác |
| Trước bật thanh toán | Chủ thể nhận tiền + tài khoản VietQR + keys/hợp đồng | **Chưa bật**; số Vietcombank mẫu không được dùng. Thanh toán M7 không phải điều kiện hoàn tất M5 |
| Trước ra mắt | Chính sách đồng ý/xuất/xóa/retention; DB và backup sau 21/12 | Xác nhận chủ thể chịu trách nhiệm; backup/restore trước nâng gói/chuyển DB; không tuyên bố pháp lý từ nhãn code |

### Key và truy cập: tên thôi, không đưa giá trị vào GitHub/chat

- `GEMINI_API_KEY`: xác minh AI thật; thêm biến model theo implementation. Không cần key để chạy fallback/tests fixture.
- `SMS_API_KEY`, `SMS_SECRET_KEY`, `SMS_BRANDNAME`: thử OTP thật sau duyệt template và phí; `JWT_SECRET`: khóa phiên ổn định; `ADMIN_PHONES`: cấp admin theo phương án hiện tại.
- `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`: **chỉ khi mở lại M7 được phê duyệt**; không chặn core handoff.
- `DATABASE_URL` cho môi trường app; `TEST_DATABASE_URL` **chỉ DB test rỗng dùng riêng** vì suite xóa schema; `DB_AUTO_MIGRATE=true` theo kế hoạch deploy được duyệt. Có thể tạo key giả cục bộ cho JWT/checksum fixture, không gọi dịch vụ thật.

## 9. Bằng chứng kiểm lại và giới hạn

- Worker riêng nhánh docs từ main 9adf9e0; setup `npm ci`. Baseline `npm test`: **69 pass, 0 fail, 0 skip**; `npm run build:ui` thành công (99 màn, 2.89 MB). Không có lint/typecheck script.
- PostgreSQL 15 + PostGIS 3, DB dùng một lần `tov_core_review`: `TEST_DATABASE_URL=postgres://tov:tov@127.0.0.1:5432/tov_core_review npm run test:db` → **13 pass, 0 fail, 0 skip**, bao gồm migrations, SQL thật, restart, scope từng người, reports/unpause, audit. Thông tin đăng nhập này là fixture local trong test repo, không phải prod.
- Các suite DB gọi router và có bài restart server; **không phải kiểm trình duyệt qua toàn bộ các màn**. Những chỗ “UI → DB” nêu trên dựa vào đọc handler + kiểm route/repository, không gắn nhãn đã nghiệm thu E2E.
- Đã đọc PR #3 ở 079014cb và fetch lại 8237a43c để phân ranh trách nhiệm; evidence cũ 160 browser checks thuộc product shell bị loại, không chuyển thành bằng chứng cho runtime mới dùng Live App.
- Không ghi dữ liệu prod, không deploy, không mua dịch vụ, không gửi SMS/đặt món/thanh toán thật; chưa kiểm khóa AI/đối tác, thiết bị thật/Firefox/WebKit, screen reader, performance tải thật hoặc chính sách pháp lý hiện hành.
- Thay đổi của PR tài liệu này chỉ là `docs/COMPLETION_PLAN_CORE.md`. Các lỗi và API đề xuất phía trên là **kế hoạch**, không có nghĩa mã đã được sửa.

## 10. Nguồn nghiên cứu bên ngoài

Tra cứu ngày 25–26/11/2026; dùng hướng dẫn chính thức, không dùng số quảng cáo làm bằng chứng hiệu năng của ứng dụng.

- **[R1] eSMS:** [OTP/CSKH](https://developers.esms.vn/esms-api/ham-gui-tin/tin-nhan-sms-otp-cskh) và [GENCODE](https://developers.esms.vn/esms-api/ham-gui-tin/tin-gencode-tu-dong-sms). Brandname phải đăng ký; GENCODE có yêu cầu template. Áp dụng M1.
- **[R2] Cookpad:** [Terms](https://cookpad.com/us/terms), [Community guidelines](https://cookpad.com/us/community). Nội dung có thể sai/không an toàn, có quy tắc nội dung và quyền tác giả; đây là tham khảo quản trị, không phải giấy phép lấy công thức. Áp dụng M2/M9.
- **[R3] Cookpad:** [Privacy](https://cookpad.com/us/privacy). Xử lý thông tin dị ứng trong nhóm thông tin cần thận trọng; không thay tư vấn pháp luật Việt Nam. Áp dụng M1.
- **[R4] Google AI:** [Deprecations](https://ai.google.dev/gemini-api/docs/deprecations), [Models](https://ai.google.dev/gemini-api/docs/models). Dòng 2.0 Flash đã được liệt kê ngừng cung cấp; phải kiểm model còn hỗ trợ khi cấu hình, không chốt một alias mới chỉ từ search snippet. Áp dụng M3.
- **[R5] Open-Meteo:** [Terms](https://open-meteo.com/en/terms), [Pricing](https://open-meteo.com/en/pricing), [Data license](https://open-meteo.com/en/license). Dữ liệu CC BY 4.0 và quyền hosted API thương mại là hai vấn đề khác nhau. Áp dụng M3.
- **[R6] Grab:** [GrabFood Việt Nam](https://www.grab.com/vn/food/). Địa chỉ người dùng quyết định danh sách quán có thể giao; “gần 3km” không bằng “có giao”. Áp dụng M4.
- **[R7] Google Maps:** [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started). URL đa nền tảng, `api=1`, destination, không cần API key cho Maps URLs; không nhầm với Maps Embed/Places có mô hình tính phí riêng. Áp dụng M4/M5.
- **[R8] Grab:** [Rút gọn đường dẫn bán hàng](https://www.grab.com/vn/merchant-blog/rutgonlink/) (24/03/2022). Bằng chứng có link quán do đối tác hỗ trợ, **không xác minh chương trình đó còn mở hoặc cấp quyền affiliate hôm nay**. Áp dụng M5.
- **[R9] ShopeeFood:** [Điều khoản merchant](https://resource.foody.vn/web/merchant-private-policy.html). Không suy ra quyền tái phân phối dữ liệu hoặc API đặt hàng từ trang công khai; tìm kiếm này chưa xác minh được hợp đồng deep-link/affiliate public hiện hành. Áp dụng M4/M5.
- **[R10] OWASP:** [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Deny by default, validate permissions on every request; áp dụng M9 và mọi route ghi.
