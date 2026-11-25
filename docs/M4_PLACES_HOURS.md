# M4 — Quán, khoảng cách và giờ mở

Chỉ thay phần máy chủ; không sửa giao diện hoặc cách xử lý báo sai/đóng quán.

## Hợp đồng dùng chung M3

`src/services/placeHours.js` xuất hai hàm thuần:

- `getPlaceOpenStatus(place, now)` trả `{status, reason, label, timezone, is_currently_open}`. Status: `open`, `closed`, `unknown`, `stale`. Chỉ `open` mới có `is_currently_open=true` và nhãn `Đang mở`.
- `isPlaceEligible(place, now, {requireVerifiedHours=false})`: chính sách danh sách/gợi ý. Khi false: chỉ quán đã duyệt, không tạm ẩn, và không đóng theo lịch mới được liệt kê. `unknown`/`stale` vẫn có thể liệt kê nhưng KHÔNG có nghĩa đang mở. Khi true: chỉ nhận `open`.

API truyền `REQUIRE_VERIFIED_HOURS === 'true'` vào chính sách. Mặc định false để dữ liệu mẫu chưa có lịch không làm danh sách rỗng. Không bật env hoặc triển khai trong thay đổi này. M3 phải dùng cùng chính sách; không tự suy diễn từ `is_open_override`, trường này chỉ là cờ tạm ẩn tương thích với dữ liệu cũ.

```json
{
  "is_verified": true,
  "verified_at": "2026-11-26T03:00:00Z",
  "opening_hours": {
    "weekly": {
      "0": [], "1": [["08:00", "12:00"], ["17:00", "22:00"]],
      "2": [["20:00", "02:00"]], "3": [], "4": [], "5": [], "6": []
    },
    "overrides": {"2027-01-01": []}
  }
}
```

- `0`=Chủ nhật, `6`=Thứ bảy. Mọi thời điểm theo `Asia/Ho_Chi_Minh`, không theo múi giờ máy chủ. `now` truyền riêng để kiểm thử.
- Khoảng [bắt đầu, kết thúc): đúng giờ mở là mở, đúng giờ đóng là đóng. Kết thúc nhỏ hơn bắt đầu nghĩa ca qua nửa đêm. `00:00–24:00` mở trọn ngày; hai đầu bằng nhau không hợp lệ.
- Mảng rỗng = ngày nghỉ; thiếu ngày hoặc lịch sai = chưa rõ. Có thể có nhiều ca. Ca hôm trước có thể kéo sang ngày kế tiếp nếu ngày đó có lịch hợp lệ; ghi rõ đầy đủ 7 ngày.
- Override theo ngày thay cả ngày, chặn cả phần qua đêm từ hôm trước. Ca qua đêm trong override vẫn kéo sang ngày kế tiếp nếu ngày kế tiếp không có override riêng.
- Quá hoặc đúng 90×24 giờ kể từ `verified_at` = `stale`. Ngày xác minh thiếu/sai/ở tương lai = chưa rõ. Tạm ẩn luôn đóng; chưa duyệt không bao giờ mở. Không tự xác minh giờ mẫu cũ (`open_time`, `open_hour`).

## Đọc dữ liệu

`GET /api/v1/places?lat=10.95&lng=106.82&radius=3000&dish_id=DISH-101&open_only=true`

- `lat/lng` phải đủ cặp và hữu hạn, trong [-90,90]/[-180,180]. Ghi đè cả cặp tọa độ hồ sơ; không trộn một nửa. Không truyền thì dùng hồ sơ như trước.
- `radius` tính bằng mét, 1–50000; không truyền thì dùng bán kính hồ sơ hoặc 3000. Sai đầu vào trả 400, không âm thầm dùng vị trí khác. `open_only` chỉ nhận true/false, mặc định true.
- `distance_m` là số mét hoặc null nếu không biết; 0 không bị thay bằng 500. Có tâm tìm kiếm thì quán thiếu tọa độ không qua được bộ lọc bán kính; không có tâm thì không tự đoán vị trí, trả khoảng cách null. Tối đa 100 kết quả, gần trước; lọc giờ trước giới hạn.
- PostgreSQL dùng PostGIS geography/ST_DWithin/ST_Distance (ellipsoid WGS84); bộ nhớ dùng Haversine (xấp xỉ cầu), có thể lệch nhẹ gần ranh giới. Kiểm thử cùng điểm WGS84 cách 2.99km và 3.01km: vào/ra đúng.
- `dish_id` chỉ giữ quán đang bán món với `available=true`.
- `open_only=false` cho phép đọc cả quán đóng/tạm ẩn, luôn có trạng thái thật, không đổi chính sách đóng quán.
- `GET /api/v1/places/:id` là chi tiết công khai cho liên kết trực tiếp; 404 nếu không tồn tại. Có cùng tọa độ tùy chọn để tính khoảng cách; không áp dụng bán kính/giờ để xóa mất chi tiết quán đóng. `open_status` cũng được đưa vào `open_places` của chi tiết món để không đánh đồng đủ điều kiện với đang mở.

## Lưu dữ liệu và tích hợp

Migration `008_m4_places_hours.sql` thêm `opening_hours`, `verified_at`; cho phép `geom` null, không đổi seed, không bịa ngày xác minh. Chưa có màn nhập giờ hoặc CRUD quán trong phạm vi này (M4-2/M9 làm sau).

Base `9adf9e0`; các nhánh chờ gộp có migration 003–007, giữ nguyên số 008. Cần giải xung đột theo ý nghĩa ở imports/router/MemoryRepository/PostgresRepository và danh sách migration trong test sau khi gộp M1/M2/M3/M5/M9. Giữ toàn bộ reportPlace/unpausePlace/phân quyền của M9 #5; tuyệt đối không lấy lại bản logic cũ từ nhánh này. M3 thay bộ gợi ý riêng, nối hai hàm giờ chung sau khi gộp.

## Kiểm tra

Base: `npm test` 69/69; `TEST_DATABASE_URL=postgres://tov:tov@127.0.0.1:5432/tov_test npm run test:db` 13/13.
Thêm test giờ Việt Nam/giây ranh giới/qua đêm/tuần/ngày nghỉ/override/90 ngày/lịch thiếu, và cùng hợp đồng API hai bộ lưu dữ liệu. PostgreSQL có kiểm tra lưu qua kết nối mới. Test chỉ dùng dữ liệu giả và DB cục bộ bỏ được.
Không có lệnh lint/typecheck trong package.json. Flutter đóng băng. Không xác minh dữ liệu quán thật, GPS trên thiết bị, giao diện với dữ liệu mới hoặc môi trường đang phục vụ người dùng.
