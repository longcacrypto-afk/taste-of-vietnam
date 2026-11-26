# M9 — nhập dữ liệu ngay trên các màn quản trị hiện có

Theo quyết định ngày 26/11/2026: thêm ô nhập trong màn cũ, không tạo màn hay bộ giao diện mới. Dùng lại `UI_KIT.adminShell`, card, màu, khoảng cách, nút và trường nhập hiện có. `/studio` giữ nguyên hành vi cũ; các form chỉ gắn trên `/` và `/app`.

## Cách đi đến và sử dụng

- Đăng nhập bằng tài khoản đã được cấp `content_moderator`, `ops_admin` hoặc `super_admin`. Trên Home/Hồ sơ PWA, nút quản trị được lấy lại từ nút điều hướng cũ đang ẩn. Thanh quản trị cũ có các mục đúng quyền và nút quay về Trang chủ. Không cần gõ URL hoặc gọi API.
- **S02 — Thư viện món:** chọn món cũ hoặc Món mới, nhập thông tin, nguồn/quyền ảnh/công thức; lưu bản nháp. Có bản xem trước đã lưu, lịch sử, khôi phục thành bản nháp và xác nhận lưu trữ.
- **S03 — Công thức:** chọn món, nhập từng nguyên liệu/định lượng/đơn vị, từng bước/thời gian; thêm/xóa/đổi thứ tự dòng. Macro và kcal là mỗi suất; nguyên liệu/chi phí cho khẩu phần gốc. Lưu trước, xác nhận kiểm tra cả dị ứng và chế độ ăn với bằng chứng; xuất bản là thao tác riêng sau xác minh.
- **S04 — Quán:** chọn hồ sơ cũ hoặc tạo mới; nhập tên/địa chỉ/tọa độ/nguồn/bằng chứng, chọn món trong menu và giá/còn món, lịch 7 ngày và ngày ngoại lệ. Không có khoảng giờ là đóng cửa; `00:00–24:00` cả ngày; `22:00–02:00` qua đêm. Lưu xong mới duyệt hồ sơ. Thay đổi giá/menu/giờ cần duyệt lại; đổi còn/hết món qua form riêng giữ xác minh. Có lưu trữ kèm lý do.
- **CSV trong S04:** chọn tệp UTF-8 theo `docs/templates/bien-hoa-restaurants.csv`, chạy thử, xem số dòng/lỗi, rồi bấm xác nhận nhập. Chạy thử không ghi; tệp/lý do đổi làm mất hiệu lực bản xem trước; không cho nhập khi còn lỗi. Không đưa dòng mẫu vào vận hành.
- **S05 — Menu:** chọn món chuẩn công khai và giá nguyên VND, xác nhận ghép hoặc từ chối với lý do. OCR ingestion M6 vẫn tắt; form này chỉ duyệt các mục đã có.
- **S06 — Báo cáo:** lọc trạng thái/loại/quán; tải thêm nếu quá 50 kết quả. Xác nhận xử lý hoặc bác bỏ cần lý do; mở lại quán là thao tác riêng chỉ ops/super. Lịch sử và bằng chứng vẫn giữ, không tự xác minh quán.

## Quyền và bảo vệ dữ liệu

| Vai trò | S02/S03/S05 | S04 | S06 xử lý | Mở lại |
| --- | --- | --- | --- | --- |
| content_moderator | Có | Không | Có | Không |
| ops_admin | Không | Có | Có | Có |
| super_admin | Có | Có | Có | Có |
| consumer/merchant_owner/merchant_staff/guest | Không | Không | Không | Không |

Lối vào dùng `/auth/me` có Bearer token và role đang lưu ở máy chủ, không tin `tov_role` trong localStorage. Quyền thật vẫn được API kiểm lại trong giao dịch. Sửa món/quán gửi đúng version đang xem (kể cả version0 legacy); 409 giữ dữ liệu nhập, chỉ cho tải bản mới chứ không tự gửi lại. 400 hiện lỗi máy chủ tại form; 503/mất mạng không báo thành công, không xóa nội dung. Chặn bấm gửi kép; giữ hồ sơ được chọn sau khi lưu/xác minh/xuất bản. Sửa chưa lưu phải được lưu hoặc xác nhận bỏ trước khi chuyển hồ sơ; không dùng nội dung chưa lưu để duyệt.

Không thay schema, backend policy, quy tắc ba tài khoản khác nhau báo đóng cửa trong 24h hoặc dữ liệu thật. Nút cũ “Yêu cầu bổ sung” vẫn vô hiệu vì chưa có API riêng; dùng ô lý do khi sửa hồ sơ, không giả vờ đã gửi yêu cầu. Không có upload ảnh mới: nhập mã ảnh/nguồn theo API hiện có. Không tự xác nhận món/quán mẫu là hợp lệ.

## Kiểm chứng và chạy lại

- Base `feat/m9-review-reports` `87cc891`: Node223/223, PG148/148. Main hiện tại `4d6841c`: Node191/191, PG113/113.
- Nhánh form: `npm test` 234/234 (11 kiểm thử mới), `npm run test:db` 148/148 trên Node20/PostgreSQL15/PostGIS3, không bỏ qua. CI dùng Node20/PG16. Không có script lint/typecheck riêng; `git diff --check` sạch, `npm run build:ui` đồng bộ bundle.
- Playwright Chromium: toàn bộ thao tác tạo/sửa/xác minh/xuất bản/khôi phục/lưu trữ, menu/giờ/availability, CSV chạy thử/lỗi/nhập, menu chọn món/giá/từ chối, báo cáo lọc/phân trang/xử lý/bác bỏ/mở lại; cùng luồng chạy với HTTP thật trên memory và PostgreSQL riêng. Fixture và token thử cục bộ; không phải đăng nhập Google thật.
- Ảnh trước/sau từng S02–S06 tại 1440 và360; 10 kiểm tra axe WCAG2A/AA/2.1AA không vi phạm, không tràn trang/lỗi JavaScript trong phạm vi quét. Không thay bố cục để chụp ảnh: chỉ cuộn bình thường đến form.
- Công cụ kiểm trình duyệt và log lưu ngoài repo trong bằng chứng kèm báo cáo. Không thêm dependency production hoặc công cụ tạm vào repository. Flutter lỗi có sẵn, đang đóng băng.
- Lệnh tương đương CI trên worker: `PATH=/workspace/tool/node_modules/node/bin:$PATH npm test`; `TEST_DATABASE_URL=postgres://tov:tov@127.0.0.1:5432/tov_test PATH=/workspace/tool/node_modules/node/bin:$PATH npm run test:db`. DB này dùng một lần và bị xóa schema; tuyệt đối không dùng URL production.

Chưa kiểm Google thật, dữ liệu thực tế, production, Firefox/WebKit hoặc trình đọc màn hình. Không merge, deploy, đổi Render/env hay gọi nhà cung cấp trả phí.
