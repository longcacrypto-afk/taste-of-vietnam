# M9 — nhập và xác minh dữ liệu Biên Hòa

Phạm vi: dữ liệu nhỏ tự nhập có kiểm tra; không lấy dữ liệu tự động từ website.
Các API dùng cùng món/công thức M2, quán/giờ M4 và quyền 6 vai trò M9. Mỗi
thay đổi, bản chụp phiên bản và audit cùng một transaction. Không có lệnh deploy.

## Giao diện có gì và còn thiếu gì

- **S02:** bảng món chỉ đọc, đã lấy cả bản nháp từ dashboard quản trị.
- **S03:** ba thẻ công thức chỉ đọc, hiển thị đúng trạng thái và khẩu phần.
- **S04:** danh sách hồ sơ quán chờ thật và nút **Duyệt & Cấp tích xanh**
  hoạt động dựa trên bằng chứng đã lưu. Không tự mở lại quán đang tạm dừng.
  Nút **Yêu cầu bổ sung** bị vô hiệu hóa vì màn gốc không có ô nhập lý do.
- **Thiếu trong thiết kế gốc:** ô thêm/sửa món/nguyên liệu/bước nấu, nguồn/quyền
  ảnh, xác nhận dị ứng/chế độ ăn, preview/version/khôi phục/xuất bản, nhập
  quán/menu/giờ và chọn CSV/dry-run. Không tạo màn mới hoặc giả lập việc lưu.
  Hiện nhập liệu qua API bằng công cụ HTTP; không khẳng định người không biết
  API có thể tự nhập đầy đủ trên web.

## Quyền và quy ước

Tất cả đường dẫn dưới đây bắt đầu `/api/v1`, nhận `Authorization: Bearer …`.
Consumer, guest, merchant_owner, merchant_staff không có quyền CMS.
`content_moderator` quản lý món/công thức; `ops_admin` quản lý quán;
`super_admin` có cả hai. Không tin role trong token; kiểm lại DB trong transaction.

`version` trong body là phiên bản người sửa đang xem. Nếu gửi và không còn đúng,
API trả 409, không ghi dở. Client cũ có thể bỏ version; nên luôn gửi từ client mới.
`reason` là ghi chú audit, không phải bằng chứng xác minh. Không gửi token/key vào
source/evidence/reason. API không truy cập URL bằng chứng hoặc tự công nhận URL đó đúng.

## Món và công thức

| Method | Path | Dùng để |
| --- | --- | --- |
| GET/POST | `/admin/dishes` | Liệt kê mọi trạng thái / tạo draft |
| GET/PATCH/PUT/DELETE | `/admin/dishes/:id` | Preview, sửa, xóa thật (dọn collections) |
| GET/PATCH/PUT | `/admin/recipes/:id` | Alias cùng schema món, không là kho M20 |
| POST | `/admin/dishes/:id/verify` | Xác minh safety, chưa xuất bản |
| POST | `/admin/dishes/:id/publish` | Chỉ xuất bản bản đã xác minh |
| POST | `/admin/dishes/:id/archive` | Ẩn, giữ bản ghi |
| GET | `/admin/dishes/:id/versions` | Snapshot theo version giảm dần |
| POST | `/admin/dishes/:id/restore` | `restore_version`; tạo draft mới cần duyệt lại |

Các thao tác verify/publish/archive/restore cũng dùng được dưới `/admin/recipes`.
Nguồn công thức bắt buộc trước verify. Có `img_key` thì cần nguồn ảnh riêng.
Không có ảnh: client tiếp tục dùng placeholder/ảnh minh họa có nhãn, không phải
ảnh được xác nhận đúng món. Calories/macros **mỗi suất**, ingredient amount và
market_cost_base cho **base_servings** như M2; servings 1–10.

Ví dụ JSON tạo món (fixture, không phải công thức dinh dưỡng thật):

```json
{
  "name": "MÓN VÍ DỤ — KHÔNG PHẢI DỮ LIỆU THẬT",
  "region": "nam",
  "meal_slots": ["lunch", "dinner"],
  "allergen_tags": ["soy"],
  "diet_flags": ["vegan"],
  "base_servings": 2,
  "market_cost_base": 40000,
  "calories": 450,
  "macros": {"protein": 15, "carbs": 60, "fat": 10},
  "ingredients": [{"name": "Đậu ví dụ", "amount": 200, "unit": "g"}],
  "steps": [{"title": "Bước ví dụ", "text": "Không dùng làm công thức thật", "duration_min": 5}],
  "source": {"author": "Người tự nhập", "url": "", "license": "Tự biên soạn; chưa dùng cho vận hành"}
}
```

Sau khi tự kiểm tra thành phần và diet bằng nguồn hợp lệ, gửi verify:

```json
{"version":1,"allergen_verified":true,"diet_verified":true,"evidence":"Mô tả ai kiểm, kiểm gì, nguồn nào; không ghi giả"}
```

Verify lưu `cms.verified_at`, `cms.verified_by` từ đồng hồ/server và tài khoản
thật, `cms.evidence`, `safety_status=approved`. Sau đó publish với version mới.
Không chấp nhận `cms`/`safety_status` do client tự cấp. Mọi sửa nội dung qua CMS,
kể cả tên/giá/nguồn, quay lại draft và xóa approval. Restore cũng vậy.

Legacy demo giữ `cms=null`, theo chế độ tương thích hiện tại
`REQUIRE_SAFETY_APPROVAL=false`; **không được coi là đã xác minh**.
Khi bật gate true, M3 chỉ dùng safety approved. Món đã vào CMS luôn bắt buộc
published và approved, bất kể cờ; draft/archived không lộ qua M2, M3, M4 menu,
M5 hoặc lưu mới vào collection.

## Quán, menu, giờ, availability

| Method | Path | Dùng để |
| --- | --- | --- |
| GET/POST | `/admin/places` | Mọi trạng thái / tạo pending |
| GET/PATCH/PUT/DELETE | `/admin/places/:id` | Xem, sửa, archive mềm |
| PATCH/PUT | `/admin/places/:id/menu` | `{menu:[{dish_id,name?,price,available}]}` thay toàn menu |
| PATCH/PUT | `/admin/places/:id/hours` | `{opening_hours:{weekly,overrides?}}` |
| PATCH/PUT | `/admin/places/:id/availability` | `{dish_id,available,version?}` |
| POST | `/admin/places/:id/approve` | evidence + reason; không unpause |
| POST | `/admin/places/:id/archive` | Ẩn mềm, giữ reports/snapshots |
| POST | `/admin/places/:id/unpause` | Ops xử lý pause; reason bắt buộc; không xác minh |
| GET | `/admin/places/:id/versions` | Lịch sử nội dung |

Món menu phải tồn tại và không trùng, giá nguyên VND ≥0, available boolean.
Menu có món draft vẫn lưu nội bộ nhưng món draft không xuất hiện ở menu công khai.
Thông tin quán: name/address, lat [-90,90], lng [-180,180], phone,
has_ac/has_kids_seat boolean, source, evidence, opening_hours.
Không tự chuyển tên địa chỉ thành tọa độ; không gọi geocoder.

Giờ dùng schema M4 `weekly` với khóa `"0"` Chủ nhật … `"6"` thứ Bảy, đủ 7 ngày.
`[]` đóng cửa, `[["00:00","24:00"]]` cả ngày, `[["22:00","02:00"]]` qua đêm.
`overrides` có khóa ngày ISO và cùng định dạng khoảng giờ. Múi giờ Việt Nam.
Approve yêu cầu tọa độ, menu, lịch hợp lệ, nguồn/quyền và evidence; ghi
`verified_at`, `cms.verified_by` từ server. Không tự làm mới sau 90 ngày:
M4 trả trạng thái stale như trước, `REQUIRE_VERIFIED_HOURS=true` chặn gợi ý.

Sửa vị trí/menu/giá/giờ/nguồn đưa quán về pending, cần duyệt lại.
**Ngoại lệ vận hành:** availability chỉ bật/tắt tồn món đã có, không đổi giá/vị trí
hay tự approve; giữ trạng thái duyệt hiện tại. Quán pending vẫn pending.
Chỉnh metadata không xóa pause hoặc report_count. Approve không xóa báo cáo.
Unpause không đổi verification. Quán chưa xác minh/archived không xuất hiện,
kể cả gọi `open_only=false` hoặc biết URL trực tiếp.

## CSV: chạy thử trước, không nhập ví dụ

Mẫu: [`templates/bien-hoa-restaurants.csv`](templates/bien-hoa-restaurants.csv).
Chỉ header + **1 dòng giả**, `is_example=true` luôn bị bỏ qua khi import.
Thay bằng dữ liệu thật tự nhập, đã có quyền dùng; để `is_example=false`.
Các ô opening_hours/menu là JSON, phải quote CSV và nhân đôi dấu `"` bên trong.
Không tự lấy dữ liệu từ Google/Grab/ShopeeFood hoặc bất kỳ danh bạ nào.

```http
POST /api/v1/admin/places/import
Content-Type: application/json

{"csv":"<nội dung UTF-8 đúng mẫu>","dry_run":true,"reason":"Kiểm tra bộ dữ liệu Biên Hòa"}
```

Kiểm tra errors/duplicates/examples/would_create rồi gửi cùng nội dung với
`dry_run=false`. dry-run không ghi catalogue, version hay audit. Tối đa 500 dòng,
500 KB, BOM/CRLF/ô quote/dòng mới trong quote được hỗ trợ. Header phải đúng mẫu.
Dedupe theo tên+địa chỉ đã bỏ dấu, viết thường, gộp khoảng trắng, trong file và
DB; dòng trùng bị bỏ qua, không tự ghi đè. Tên/địa chỉ đổi phải tự đối chiếu.
Một dòng sai → trả 400 với số dòng và **không ghi bất kỳ dòng nào**. Import thật
vẫn tạo pending, không lấy evidence trong CSV làm quyết định approve tự động.
Audit lỗi → rollback cả batch và snapshot.

## Migration và kiểm thử

Migration `009_m9_data_entry.sql`: cms nullable trong bảng hiện có và
`content_versions`. Không backfill an toàn hoặc tọa độ cho demo. Safety trigger
SQL giữ việc thu hồi khi sửa ingredient/allergen/diet/steps trực tiếp ngoài CMS.
Không có API sửa/xóa audit hay sửa snapshot.

```sh
npm ci
npm run build:ui
npm test
# Chỉ DB local dùng một lần: suite XÓA schema public.
TEST_DATABASE_URL=postgres://tov:tov@127.0.0.1:5432/tov_test npm run test:db
```

Không có lint/typecheck script. Flutter đóng băng. Không dùng Google OAuth thật,
không kiểm nội dung/dị ứng/quán thật, không gọi thanh toán/SMS/đối tác, không
ghi production hoặc deploy. Tài khoản fixture không phải quyền của người vận hành.
