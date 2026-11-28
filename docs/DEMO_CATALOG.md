# Demo catalogue — 106 món + 40 đồ uống (dữ liệu DEMO, gỡ được)

Bộ dữ liệu demo để app có nhiều món khi chạy thử. **Không phải dữ liệu thật**: mọi dòng có
`is_demo = TRUE` và bị xoá trọn vẹn khi nạp dữ liệu thật.

| | Số lượng | Bắc | Trung | Nam | Toàn quốc |
|---|---|---|---|---|---|
| Món (`category = 'dish'`, `DISH-D001…D106`) | 106 | 29 | 28 | 32 | 17 |
| Đồ uống (`category = 'drink'`, `DISH-DR001…DR040`) | 40 | 5 | 2 | 16 | 17 |

Gồm món đường phố, cơm, bún/phở/mì, món nước (26), ăn vặt, chè/tráng miệng (13), món chay
(8 món chay thuần + chè thuần chay) và đồ uống (cà phê sữa đá, bạc xỉu, trà đá, nước mía,
sinh tố, trà sữa, nước dừa, sữa đậu nành, rau má…). Không trùng 12 món gốc DISH-101…112.

## File
- `docs/data/demo-catalog-dishes-drinks.csv` — bản để duyệt: một dòng/món, đủ trường +
  `price_basis`, `price_source_url`, `source_url`, `source_title`, `is_demo=true`.
- `src/data/demoCatalogData.js` — cùng dữ liệu cho code (test `tests/demo-catalog.test.js`
  bắt buộc hai file giống nhau).
- `src/data/demoCatalog.js` — bật/tắt, các liên kết menu demo, nạp/gỡ cho chế độ memory.
- `src/db/migrations/014_catalog_demo_flag.sql` — cột mới.

## Nguồn & độ tin cậy
- Nghiên cứu bằng Exa (11/2026): mỗi món 1 truy vấn công thức + 1 truy vấn giá, 3 kết quả
  mỗi truy vấn, đọc toàn văn. Nguồn chính: vnexpress.net (27), vietnamnet.vn (12),
  huongnghiepaau.com, dienmayxanh.com, bachhoaxanh.com, các trang du lịch/văn hoá nhà nước
  (vietnamtourism, scov.gov.vn, svhttdl.hue.gov.vn, hoianworldheritage.org.vn)… `source_url`
  từng dòng.
- **Dị ứng (thận trọng)**: ghi nhãn khi công thức chuẩn trong nguồn có nguyên liệu đó —
  nước mắm/mắm nêm/cá/lươn → `fish`; tôm/tép → `shrimp` + `shellfish`; mắm tôm/mắm ruốc →
  `shrimp_paste` + `shrimp` + `shellfish`; cua/mực/hến/ốc/dầu hào → `shellfish`; nước
  tương/xì dầu → `soy` + `gluten`; bột mì/bánh mì/quẩy → `gluten`; sữa/bơ/kem → `dairy`;
  trứng → `egg`; đậu phộng/lạc → `peanut`. Từ vựng = `hard_allergies` của hồ sơ. Mè/vừng,
  hạt cây (hạnh nhân) không có trong từ vựng nên không được gắn nhãn.
- `diet_flags`: `vegan`(+`vegetarian`) / `vegetarian` chỉ khi công thức chuẩn như vậy.
- `calories`: **ước tính** (cột `calories_is_estimate=true`).
- Giá VND: `price_basis=source` = khoảng giá khớp giá được nêu ở `price_source_url`
  (96 dòng); `estimate` = ước tính, không tìm được báo giá dùng được (50 dòng).
  `estimated_price_vnd` = giữa khoảng.
- Không bịa công thức: chỉ có tên nguyên liệu chính (không định lượng), không có bước nấu,
  không có giá đi chợ → các món demo **không** được gợi ý dạng "tự nấu"; UI hiện
  "Chưa có cách nấu / Chưa có giá đi chợ".

## Hành vi trong app
- Đồ uống tìm được ở M2 (tìm kiếm có/không dấu), nhưng **không bao giờ** là gợi ý bữa ăn
  (cổng chung `buildCandidates` loại `category = 'drink'`).
- 23 liên kết menu demo (`place_dishes.is_demo = TRUE`) tới 8 quán demo có sẵn, chỉ khi
  loại quán hợp lý (vd. quán cơm chay PLACE-407 → 6 món chay, quán bánh mì PLACE-404 →
  bánh mì chảo, cà phê sữa đá), giá nằm trong khoảng đã nghiên cứu. Nhờ đó món demo có thể
  xuất hiện trong Gợi ý hôm nay.
- API trả `is_demo: true` (và `category`) chỉ cho dòng demo; UI hiện pill "Dữ liệu demo"
  cạnh tên món (danh sách M2-S01/S02/S08, thẻ M3-S01, chi tiết món M2-S04/M3-S02, W-S03).
- Lọc dị ứng cứng giữ nguyên (khớp nhãn chính xác); test chạy mọi nhãn + tổ hợp trên cả
  memory và PostgreSQL.

## Bật / tắt / gỡ
- `SEED_DEMO_CATALOG` mặc định bật; chỉ `SEED_DEMO_CATALOG=false` tắt.
  - Memory: `server.js` nạp lúc khởi động.
  - PostgreSQL: `npm run db:seed` (hoặc DB trống + `DB_AUTO_MIGRATE=true`) chèn thêm,
    idempotent (`ON CONFLICT DO NOTHING`); `npm run db:seed -- --update` chỉ làm mới các
    dòng còn `is_demo`.
- **Gỡ demo khi nạp dữ liệu thật** (PostgreSQL):
  ```sql
  DELETE FROM place_dishes WHERE is_demo;
  DELETE FROM dishes WHERE is_demo;
  ```
  và đặt `SEED_DEMO_CATALOG=false` để lần seed sau không chèn lại. (Xoá `dishes` cũng
  cascade các liên kết menu tới món demo.) Muốn giữ một món demo làm dữ liệu thật: sửa
  dữ liệu rồi `UPDATE dishes SET is_demo = FALSE WHERE id = …` trước khi chạy lệnh xoá.
