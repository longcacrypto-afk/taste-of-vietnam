// =============================================================================
// ADMIN CMS M9 (9 SCREENS), ANALYTICS M10 (6 SCREENS), EXPANSION M11–M17 (7 SCREENS)
// =============================================================================

window.SCREENS_M9_M10_EXP = {
  // ---------------------------------------------------------------------------
  // M9: ADMIN CMS & KIỂM DUYỆT (9 MÀN HÌNH: M9-S01..S09 — FULL ADMIN PANEL SHELL)
  // ---------------------------------------------------------------------------
  'M9-S01': {
    id: 'M9-S01',
    module: 'M9 · Admin CMS & Kiểm duyệt',
    platform: 'desktop',
    title: 'Admin CMS Overview Dashboard',
    subtitle: 'Tổng quan toàn hệ thống: Thư viện món, Quán xác minh, Hàng đợi duyệt AI OCR & Báo cáo người dùng',
    api: 'GET /v1/admin/dashboard',
    ac: ['Full Sidebar Admin Panel (Tunie + AI Chef style) với 4 KPI Cards & Biểu đồ hệ thống'],
    render: () => window.UI_KIT.adminShell(
      'M9-S01',
      'Trung Tâm Quản Trị & Kiểm Duyệt Hệ Sinh Thái',
      'Giám sát chất lượng dữ liệu món ăn, công thức, quán thực tế và độ trễ AI Recommender',
      [
        { label: 'Thư viện Món & Công thức', value: '542 món', delta: '410 recipe', icon: 'utensils', bg: 'bg-[#FEF3C7] text-[#F59E0B]' },
        { label: 'Quán thực tế xác minh', value: '1,284', delta: '+42 tuần này', icon: 'store', bg: 'bg-[#DCFCE7] text-[#16A34A]' },
        { label: 'Chờ duyệt AI Menu OCR', value: '12 mục', delta: 'Ưu tiên', icon: 'scan', bg: 'bg-[#DBEAFE] text-[#1D4ED8]' },
        { label: 'Báo sai dữ liệu (User)', value: '5 báo cáo', delta: 'Cần xử lý', icon: 'alert', bg: 'bg-[#FFE4E6] text-[#BE123C]' }
      ],
      `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div class="md:col-span-7 bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2.5 shadow-sm">
            <div class="flex justify-between items-center">
              <span class="font-extrabold">Biểu đồ Phiên Gợi Ý AI & Tăng trưởng Quán Xác Minh</span>
              ${window.UI_KIT.tagPill('Realtime · p95 1.12s', 'green')}
            </div>
            ${window.UI_KIT.barChart([58, 66, 72, 81, 87, 96, 92], ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'], '#22C55E', 5)}
            ${window.UI_KIT.lineChart('Độ chính xác LLM Intent Tiếng Việt (200 câu chuẩn)', '94.5% Accuracy', '#F59E0B')}
          </div>
          <div class="md:col-span-5 bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-3 shadow-sm">
            <div class="font-extrabold">Hàng đợi Kiểm duyệt Ưu tiên</div>
            <div onclick="goScreen('M9-S05')" class="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center cursor-pointer hover:border-[#FBBF24]">
              <div><div class="font-bold">Duyệt ghép món AI OCR</div><div class="text-[10px] text-[#64748B]">12 món mới từ 4 quán tại Biên Hòa</div></div>
              ${window.UI_KIT.tagPill('M9-S05 →', 'yellow')}
            </div>
            <div onclick="goScreen('M9-S06')" class="p-3 rounded-xl bg-[#FFE4E6]/50 border border-[#FECDD3] flex justify-between items-center cursor-pointer">
              <div><div class="font-bold text-[#BE123C]">Báo cáo quán đóng cửa</div><div class="text-[10px] text-[#64748B]">Bánh canh cua Cô Ba (3 báo cáo trùng)</div></div>
              ${window.UI_KIT.tagPill('M9-S06 →', 'rose')}
            </div>
            <div onclick="goScreen('M9-S07')" class="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center cursor-pointer">
              <div><div class="font-bold">Kiểm duyệt Chiến dịch Ads M7</div><div class="text-[10px] text-[#64748B]">Kiểm tra nhãn Tài trợ & bộ lọc dị ứng</div></div>
              ${window.UI_KIT.tagPill('M9-S07 →', 'green')}
            </div>
          </div>
        </div>
      `
    )
  },

  'M9-S02': {
    id: 'M9-S02',
    module: 'M9 · Admin CMS & Kiểm duyệt',
    platform: 'desktop',
    title: 'Dish Library & Allergen Tag Management',
    subtitle: 'Quản lý 542 món ăn chuẩn, phân loại 3 miền, tag dị ứng cứng & vector embedding (pgvector)',
    api: 'GET /v1/admin/dishes · POST /v1/admin/dishes',
    ac: ['Bắt buộc gắn nhãn thành phần dị ứng trước khi cho phép món xuất hiện trong M3'],
    render: () => window.UI_KIT.adminShell(
      'M9-S02',
      'Quản Lý Thư Viện Món Ăn Chuẩn (542 Món)',
      'Chuẩn hóa tên món, vùng miền, giá tham khảo, Kcal và vector 1536-dim cho tìm kiếm tương đồng',
      [],
      `
        <div class="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
          <table class="w-full text-left">
            <thead class="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
              <tr><th class="p-3.5">Món ăn</th><th class="p-3.5">Vùng miền</th><th class="p-3.5">Tag Dị ứng (Hard Filter)</th><th class="p-3.5">Kcal & Giá</th><th class="p-3.5">Vector DB</th></tr>
            </thead>
            <tbody class="divide-y divide-[#F1F5F9]">
              <tr>
                <td class="p-3.5 flex items-center gap-2.5"><img data-img="298" class="w-10 h-10 rounded-lg object-cover"/><b>Phở bò tái nạm (#102)</b></td>
                <td class="p-3.5">${window.UI_KIT.tagPill('Miền Bắc', 'blue')}</td>
                <td class="p-3.5">${window.UI_KIT.tagPill('✔ Không Hải sản / Đậu phộng', 'green')}</td>
                <td class="p-3.5 font-bold">480 kcal · 45k</td>
                <td class="p-3.5 font-mono text-[10px] text-[#16A34A]">pgvector ✔</td>
              </tr>
              <tr>
                <td class="p-3.5 flex items-center gap-2.5"><img data-img="304" class="w-10 h-10 rounded-lg object-cover"/><b>Cơm tấm sườn bì (#108)</b></td>
                <td class="p-3.5">${window.UI_KIT.tagPill('Miền Nam', 'yellow')}</td>
                <td class="p-3.5">${window.UI_KIT.tagPill('⚠️ Có Trứng & Nước mắm', 'orange')}</td>
                <td class="p-3.5 font-bold">620 kcal · 40k</td>
                <td class="p-3.5 font-mono text-[10px] text-[#16A34A]">pgvector ✔</td>
              </tr>
              <tr>
                <td class="p-3.5 flex items-center gap-2.5"><img data-img="310" class="w-10 h-10 rounded-lg object-cover"/><b>Bún bò Huế (#118)</b></td>
                <td class="p-3.5">${window.UI_KIT.tagPill('Miền Trung', 'purple')}</td>
                <td class="p-3.5">${window.UI_KIT.tagPill('⚠️ Mắm ruốc · Cay vừa', 'rose')}</td>
                <td class="p-3.5 font-bold">520 kcal · 50k</td>
                <td class="p-3.5 font-mono text-[10px] text-[#16A34A]">pgvector ✔</td>
              </tr>
            </tbody>
          </table>
        </div>
      `
    )
  },

  'M9-S03': {
    id: 'M9-S03',
    module: 'M9 · Admin CMS & Kiểm duyệt',
    platform: 'desktop',
    title: 'Recipe & Portion Scaling Management',
    subtitle: 'Quản lý công thức chuẩn định lượng gốc (2 người), thông số Macro C/F/P & các bước nấu',
    api: 'PUT /v1/admin/recipes/{id}',
    ac: ['Đảm bảo mọi nguyên liệu đều có hệ số nhân tuyến tính chuẩn cho tính năng Scale khẩu phần M2-S06'],
    render: () => window.UI_KIT.adminShell(
      'M9-S03',
      'Quản Lý Công Thức & Định Lượng Dinh Dưỡng',
      'Chuẩn hóa định lượng gram/ml và thông số Kcal cùng chuyên gia dinh dưỡng',
      [],
      `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2 shadow-sm">
            ${window.UI_KIT.tagPill('Khẩu phần gốc: 2 người', 'yellow')}
            <div class="font-extrabold text-sm">Phở Bò Tái Nạm Hà Nội</div>
            <div class="text-[#64748B]">480 Kcal/tô · Carbs 59g · Protein 32g · Fat 18g</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2 shadow-sm">
            ${window.UI_KIT.tagPill('Định lượng chuẩn', 'blue')}
            <div class="font-extrabold text-sm">4 Nhóm Nguyên liệu</div>
            <div class="text-[#64748B]">Bánh phở 350g · Thịt bò 250g · Nước dùng 1.0L · Thảo quả & Gừng</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2 shadow-sm">
            ${window.UI_KIT.tagPill('Đã xuất bản', 'green')}
            <div class="font-extrabold text-sm">3 Bước Nấu Có Timer</div>
            <div class="text-[#64748B]">Tích hợp sẵn đồng hồ đếm ngược 5 phút & 3 phút trên App</div>
          </div>
        </div>
      `
    )
  },

  'M9-S04': {
    id: 'M9-S04',
    module: 'M9 · Admin CMS & Kiểm duyệt',
    platform: 'desktop',
    title: 'Restaurant Verification Queue',
    subtitle: 'Duyệt hồ sơ đăng ký quán mới, kiểm tra mặt tiền, giờ mở cửa & tọa độ bản đồ thực tế',
    api: 'POST /v1/admin/places/{id}/approve',
    ac: ['Ngăn chặn 100% quán ảo hoặc chưa xác minh xuất hiện trong gợi ý của Măm AI'],
    render: () => window.UI_KIT.adminShell(
      'M9-S04',
      'Duyệt Xác Minh Quán Ăn Thực Tế (8 Hồ sơ chờ)',
      'Đảm bảo nguyên tắc cốt lõi: LLM không tự nghĩ ra quán ăn, mọi quán đều được xác minh thực tế',
      [],
      `
        <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div class="flex items-center gap-3.5">
            <img data-img="477" class="w-16 h-16 rounded-2xl object-cover" />
            <div>
              <div class="flex items-center gap-2"><b class="text-sm">Bún Thịt Nướng Kiều Bảo · P. Tân Hiệp, Biên Hòa</b>${window.UI_KIT.tagPill('Chờ xác minh', 'yellow')}</div>
              <div class="text-[11px] text-[#64748B] mt-0.5">Đã tải ảnh mặt tiền, bảng giá thực tế & ghim tọa độ PostGIS (10.958, 106.842)</div>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="px-4 py-2 rounded-full bg-[#22C55E] text-white font-extrabold shadow-sm">✓ Duyệt & Cấp tích xanh</button>
            <button class="px-4 py-2 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] font-bold">Yêu cầu bổ sung</button>
          </div>
        </div>
      `
    )
  },

  'M9-S05': {
    id: 'M9-S05',
    module: 'M9 · Admin CMS & Kiểm duyệt',
    platform: 'desktop',
    title: 'AI Menu OCR Matching Review',
    subtitle: 'Duyệt các mục thực đơn do AI OCR bóc tách từ ảnh chụp của quán có độ tự tin < 95%',
    api: 'POST /v1/admin/ocr-review/{id}',
    ac: ['Chuẩn hóa tên món địa phương tại quán về đúng ID món trong Thư viện M2'],
    render: () => window.UI_KIT.adminShell(
      'M9-S05',
      'Duyệt Ghép Món AI Menu OCR (Menu Matching Review)',
      'Kiểm duyệt nhanh các món AI tự bóc tách từ bảng giá chụp tại quán',
      [],
      `
        <div class="space-y-3">
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold">OCR từ ảnh quán: "Phở tái lăn gầu giòn (55K)"</span>
                <span>→</span>
                <span class="font-extrabold text-[#15803D]">Khớp M2: Phở bò tái gầu (#109)</span>
                ${window.UI_KIT.tagPill('Độ tự tin 92%', 'yellow')}
              </div>
              <div class="text-[11px] text-[#64748B] mt-0.5">Quán: Phở Gia Truyền Phát Tài · Giá chuẩn hóa: 55.000đ</div>
            </div>
            <button class="px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">✓ Xác nhận ghép</button>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold">OCR từ ảnh quán: "Cơm sườn trứng ốp la (42K)"</span>
                <span>→</span>
                <span class="font-extrabold text-[#15803D]">Khớp M2: Cơm tấm sườn ốp la (#204)</span>
                ${window.UI_KIT.tagPill('Độ tự tin 94%', 'green')}
              </div>
              <div class="text-[11px] text-[#64748B] mt-0.5">Quán: Cơm Tấm Bụi Sài Gòn · Giá chuẩn hóa: 42.000đ</div>
            </div>
            <button class="px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">✓ Xác nhận ghép</button>
          </div>
        </div>
      `
    )
  },

  'M9-S06': {
    id: 'M9-S06',
    module: 'M9 · Admin CMS & Kiểm duyệt',
    platform: 'desktop',
    title: 'User Reports Moderation',
    subtitle: 'Xử lý báo cáo sai dữ liệu từ người dùng (M4-S06: Quán đóng cửa, sai giá, lệch vị trí)',
    api: 'GET /v1/admin/reports · PATCH /v1/admin/reports/{id}',
    ac: ['Cơ chế tự động tạm ẩn quán nếu có >= 3 báo cáo đóng cửa trùng khớp'],
    render: () => window.UI_KIT.adminShell(
      'M9-S06',
      'Xử Lý Báo Cáo Sai Dữ Liệu Từ Người Dùng (5 Báo cáo)',
      'Giữ cho dữ liệu quán ăn luôn tươi mới, không gợi ý nhầm quán đã đóng cửa',
      [],
      `
        <div class="bg-white p-4 rounded-2xl border-2 border-[#FECDD3] flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              ${window.UI_KIT.tagPill('🚨 3 Báo cáo trùng khớp', 'rose')}
              <b class="text-sm">Bánh canh cua Cô Ba (P. Tân Hiệp) — Báo nghỉ bán buổi tối</b>
            </div>
            <p class="text-[11px] text-[#64748B]">Hệ thống đã tự động tạm ẩn quán sau 18:00 để bảo vệ trải nghiệm người dùng.</p>
          </div>
          <button class="px-4 py-2 rounded-full bg-[#18181B] text-white font-extrabold">Cập nhật giờ mở cửa chính thức</button>
        </div>
      `
    )
  },

  'M9-S07': {
    id: 'M9-S07',
    module: 'M9 · Admin CMS & Kiểm duyệt',
    platform: 'desktop',
    title: 'Ad Campaign Moderation',
    subtitle: 'Kiểm duyệt chiến dịch quảng cáo M7 trước khi phân phối vào slot Tài trợ',
    api: 'POST /v1/admin/ads/{id}/moderate',
    ac: ['Đảm bảo 100% chiến dịch quảng cáo có nhãn Tài trợ và không vi phạm bộ lọc cứng dị ứng'],
    render: () => window.UI_KIT.adminShell(
      'M9-S07',
      'Kiểm Duyệt Chiến Dịch Quảng Cáo (M7 Moderation)',
      'Rà soát nhãn Tài trợ, tính xác thực của giá bán và nhãn cảnh báo dị ứng',
      [],
      `
        <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div class="flex items-center gap-3.5">
            <img data-img="310" class="w-16 h-16 rounded-xl object-cover" />
            <div>
              <div class="flex items-center gap-2"><b class="text-sm">Chiến dịch: Bún bò Huế O Xuân (50.000đ)</b>${window.UI_KIT.tagPill('Đạt chuẩn An toàn', 'green')}</div>
              <div class="text-[11px] text-[#64748B] mt-0.5">✔ Có nhãn Tài trợ · ✔ Đã khai báo mắm ruốc/độ cay · ✔ Trần hiển thị &le; 1/3 slot</div>
            </div>
          </div>
          <button class="px-5 py-2.5 rounded-full bg-[#22C55E] text-white font-extrabold shadow-sm">✓ Phê duyệt cho phép chạy</button>
        </div>
      `
    )
  },

  'M9-S08': {
    id: 'M9-S08',
    module: 'M9 · Admin CMS & Kiểm duyệt',
    platform: 'desktop',
    title: 'User & Role Management (RBAC)',
    subtitle: 'Quản lý phân quyền Super Admin, Content & AI Ops, Merchant Ops và Người dùng',
    api: 'GET /v1/admin/users · PUT /v1/admin/users/{id}/role',
    ac: ['Phân quyền chặt chẽ theo vai trò (Role-Based Access Control)'],
    render: () => window.UI_KIT.adminShell(
      'M9-S08',
      'Quản Lý Người Dùng & Phân Quyền Hệ Thống (RBAC)',
      'Kiểm soát quyền truy cập vào dữ liệu người dùng, duyệt OCR và cấu hình hệ thống',
      [],
      `
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-1 shadow-sm">${window.UI_KIT.tagPill('Super Admin (2)', 'dark')}<div class="font-extrabold text-sm pt-1">Toàn quyền hệ thống</div><p class="text-[11px] text-[#64748B]">Cấu hình AI Gateway, RBAC & Audit Log</p></div>
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-1 shadow-sm">${window.UI_KIT.tagPill('Content & AI Ops (6)', 'blue')}<div class="font-extrabold text-sm pt-1">Biên tập Món & OCR</div><p class="text-[11px] text-[#64748B]">Quản lý M2 Dish Library & Duyệt M9-S05</p></div>
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-1 shadow-sm">${window.UI_KIT.tagPill('Merchant Ops (4)', 'green')}<div class="font-extrabold text-sm pt-1">Quản lý Đối tác Quán</div><p class="text-[11px] text-[#64748B]">Duyệt quán M9-S04 & Quảng cáo M9-S07</p></div>
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-1 shadow-sm">${window.UI_KIT.tagPill('Consumer (18,540)', 'yellow')}<div class="font-extrabold text-sm pt-1">Người dùng Ứng dụng</div><p class="text-[11px] text-[#64748B]">Bảo vệ dữ liệu cá nhân theo PDPD</p></div>
        </div>
      `
    )
  },

  'M9-S09': {
    id: 'M9-S09',
    module: 'M9 · Admin CMS & Kiểm duyệt',
    platform: 'desktop',
    title: 'Audit Log & System Config',
    subtitle: 'Nhật ký kiểm toán bất biến (Audit Log) & Cấu hình trọng số bộ máy gợi ý AI',
    api: 'GET /v1/admin/audit-logs · PUT /v1/admin/config',
    ac: ['Ghi log đầy đủ người thực hiện, thời gian, giá trị cũ/mới cho mọi thay đổi'],
    render: () => window.UI_KIT.adminShell(
      'M9-S09',
      'Audit Log & Cấu Hình Trọng Số AI Recommender',
      'Theo dõi lịch sử thao tác quản trị và điều chỉnh thuật toán gợi ý theo ngữ cảnh',
      [],
      `
        <div class="bg-[#18181B] text-gray-200 p-4 rounded-2xl font-mono text-[11px] space-y-2 shadow-inner">
          <div><span class="text-[#4ADE80]">[2026-11-18 12:10:05]</span> <b>admin_ops_02</b> approved OCR match <span class="text-[#FBBF24]">Dish #102 (Phở bò)</span> for Place #419</div>
          <div><span class="text-[#4ADE80]">[2026-11-18 11:45:19]</span> <b>safety_guard</b> auto-paused evening slot for <span class="text-[#F43F5E]">Place #208</span> (3 user closed reports)</div>
          <div><span class="text-[#4ADE80]">[2026-11-18 11:00:00]</span> <b>ai_gateway</b> LiteLLM health check OK · Latency p95 = <span class="text-[#4ADE80]">1.12s</span> (&lt; 1.5s SLA)</div>
        </div>
      `
    )
  },

  // ---------------------------------------------------------------------------
  // M10: ANALYTICS & EVENT TRACKING (6 MÀN HÌNH: M10-S01..S06 — ADMIN ANALYTICS SHELL)
  // ---------------------------------------------------------------------------
  'M10-S01': {
    id: 'M10-S01',
    module: 'M10 · Analytics & Event Tracking',
    platform: 'desktop',
    title: 'Product Analytics Overview',
    subtitle: 'Chỉ số sức khỏe sản phẩm: DAU/MAU, Retention D1/D7/D30 & Tỷ lệ chọn được món',
    api: 'GET /v1/analytics/overview (PostHog)',
    ac: ['Theo dõi sát mục tiêu giữ chân người dùng và thời gian trung bình để ra quyết định ăn gì'],
    render: () => window.UI_KIT.adminShell(
      'M10-S01',
      'Tổng Quan Chỉ Số Sản Phẩm (Product Overview)',
      'Đo lường hiệu quả giải quyết câu hỏi "Hôm nay ăn gì?" của người dùng mỗi ngày',
      [
        { label: 'Tỷ lệ DAU / MAU', value: '38.4%', delta: '+4.1%', icon: 'users', bg: 'bg-[#FEF3C7] text-[#F59E0B]' },
        { label: 'Retention D7', value: '42.1%', delta: 'Vượt mục tiêu', icon: 'sparkles', bg: 'bg-[#DCFCE7] text-[#16A34A]' },
        { label: 'Thời gian chốt món', value: '24 giây', delta: '-18s', icon: 'clock', bg: 'bg-[#DBEAFE] text-[#1D4ED8]' },
        { label: 'Độ trễ gợi ý (p95)', value: '1.12s', delta: '< 1.5s SLA', icon: 'shield', bg: 'bg-[#DCFCE7] text-[#16A34A]' }
      ],
      `<div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] text-[#64748B]">71.8% người dùng chọn được món ăn ưng ý ngay trong 3 gợi ý đầu tiên mà không cần làm mới.</div>`
    )
  },

  'M10-S02': {
    id: 'M10-S02',
    module: 'M10 · Analytics & Event Tracking',
    platform: 'desktop',
    title: 'User Conversion Funnel',
    subtitle: 'Phễu chuyển đổi: app_open → suggestion_shown → dish_view → place_view → order/direction_click',
    api: 'GET /v1/analytics/funnel',
    ac: ['Hiển thị trực quan tỷ lệ chuyển đổi qua 4 tầng phễu cốt lõi'],
    render: () => window.UI_KIT.adminShell(
      'M10-S02',
      'Phễu Chuyển Đổi Người Dùng Toàn Trình (User Funnel)',
      'Theo dõi từ lúc mở ứng dụng đến hành động Đi ăn / Đặt món / Tự nấu thực tế',
      [],
      `
        <div class="bg-white p-5 rounded-2xl border border-[#E2E8F0] space-y-3.5 shadow-sm">
          <div><div class="flex justify-between font-extrabold mb-1"><span>1. app_open → suggestion_shown (p95: 1.12s)</span><span>100% (48,200 phiên)</span></div><div class="h-3 rounded-full bg-[#F1F5F9] overflow-hidden"><div class="h-full bg-[#18181B] rounded-full" style="width:100%"></div></div></div>
          <div><div class="flex justify-between font-extrabold mb-1"><span>2. dish_view / chat_query (Tương tác chọn món)</span><span>64.2% (30,944 phiên)</span></div><div class="h-3 rounded-full bg-[#F1F5F9] overflow-hidden"><div class="h-full bg-[#F59E0B] rounded-full" style="width:64%"></div></div></div>
          <div><div class="flex justify-between font-extrabold mb-1"><span>3. place_view / recipe_view (Xem quán hoặc Công thức)</span><span>41.8% (20,147 phiên)</span></div><div class="h-3 rounded-full bg-[#F1F5F9] overflow-hidden"><div class="h-full bg-[#3B82F6] rounded-full" style="width:42%"></div></div></div>
          <div><div class="flex justify-between font-extrabold mb-1"><span>4. order_click / direction_click / call_click (Conversion)</span><span class="text-[#16A34A]">22.5% (10,845 chuyển đổi)</span></div><div class="h-3 rounded-full bg-[#F1F5F9] overflow-hidden"><div class="h-full bg-[#22C55E] rounded-full" style="width:23%"></div></div></div>
        </div>
      `
    )
  },

  'M10-S03': {
    id: 'M10-S03',
    module: 'M10 · Analytics & Event Tracking',
    platform: 'desktop',
    title: 'AI Recommendation & Intent Accuracy',
    subtitle: 'Đánh giá độ chính xác LLM Intent tiếng Việt (>=90% trên bộ 200 câu test) & tỷ lệ chấp nhận gợi ý',
    api: 'GET /v1/analytics/ai-performance',
    ac: ['Đạt chuẩn Acceptance Criteria: Intent tiếng Việt >= 90% trên bộ 200 câu kiểm thử'],
    render: () => window.UI_KIT.adminShell(
      'M10-S03',
      'Chất Lượng Gợi Ý AI & Kiểm Thử 200 Câu Tiếng Việt',
      'Đo lường độ chính xác bóc tách tham số JSON (số người, ngân sách, trẻ nhỏ, dị ứng)',
      [
        { label: 'Intent Accuracy (200 câu)', value: '94.5%', delta: 'Mục tiêu >=90%', icon: 'sparkles', bg: 'bg-[#DCFCE7] text-[#16A34A]' },
        { label: 'Vi phạm Dị ứng cứng', value: '0.00%', delta: 'An toàn tuyệt đối', icon: 'shield', bg: 'bg-[#DCFCE7] text-[#16A34A]' },
        { label: 'Đề xuất nhầm quán đóng cửa', value: '0.00%', delta: 'Đã lọc giờ mở', icon: 'clock', bg: 'bg-[#DBEAFE] text-[#1D4ED8]' },
        { label: 'Tỷ lệ Lặp món trong 3 ngày', value: '0.00%', delta: 'Đúng AC', icon: 'check', bg: 'bg-[#FEF3C7] text-[#F59E0B]' }
      ],
      `<div class="bg-white p-4 rounded-2xl border border-[#E2E8F0]">Tất cả 8 tiêu chí Acceptance Criteria của Module M3 đều đạt 100% trên môi trường Staging & Production.</div>`
    )
  },

  'M10-S04': {
    id: 'M10-S04',
    module: 'M10 · Analytics & Event Tracking',
    platform: 'desktop',
    title: 'Restaurant & Delivery Partner Conversion',
    subtitle: 'Phân bổ chuyển đổi giữa Chỉ đường (Google/Apple Maps) và Đặt món (Grab, Shopee, be, Xanh SM)',
    api: 'GET /v1/analytics/conversions',
    ac: ['Thống kê chi tiết tỷ trọng chuyển đổi sang từng đối tác bên ngoài'],
    render: () => window.UI_KIT.adminShell(
      'M10-S04',
      'Thống Kê Chuyển Đổi Sang Quán & Siêu Ứng Dụng (M5)',
      'Phân tích hành vi người dùng sau khi chốt được món ăn trên Hôm nay ăn gì',
      [
        { label: 'Chỉ đường Google/Apple Maps', value: '42.0%', delta: '4,554 clicks', icon: 'pin', bg: 'bg-[#FEF3C7] text-[#F59E0B]' },
        { label: 'Deep-link GrabFood', value: '23.0%', delta: '2,494 clicks', icon: 'utensils', bg: 'bg-[#DCFCE7] text-[#16A34A]' },
        { label: 'Deep-link ShopeeFood', value: '17.0%', delta: '1,843 clicks', icon: 'flame', bg: 'bg-[#FFEDD5] text-[#C2410C]' },
        { label: 'Xanh SM Ngon & beFood', value: '18.0%', delta: '1,954 clicks', icon: 'sparkles', bg: 'bg-[#DBEAFE] text-[#1D4ED8]' }
      ],
      `<div class="bg-white p-4 rounded-2xl border border-[#E2E8F0]">Tỷ lệ người dùng chọn đi ăn trực tiếp tại quán (Chỉ đường) chiếm ưu thế vào khung giờ trưa (11:30–12:30).</div>`
    )
  },

  'M10-S05': {
    id: 'M10-S05',
    module: 'M10 · Analytics & Event Tracking',
    platform: 'desktop',
    title: 'Advertising Performance & Slot Cap Monitor',
    subtitle: 'Giám sát trần hiển thị quảng cáo (<= 1/3 slot) & so sánh CTR Tự nhiên vs Tài trợ',
    api: 'GET /v1/analytics/ads-health',
    ac: ['Đảm bảo không bao giờ vượt quá 1/3 slot tài trợ trên mỗi phiên gợi ý'],
    render: () => window.UI_KIT.adminShell(
      'M10-S05',
      'Hiệu Suất Quảng Cáo & Giám Sát Trần 1/3 Slot Tài Trợ',
      'Cân bằng giữa doanh thu B2B và độ tin cậy tự nhiên của trợ lý Măm AI',
      [
        { label: 'Tỷ lệ Slot Tài trợ thực tế', value: '28.4%', delta: 'Trần <= 33.3%', icon: 'shield', bg: 'bg-[#DCFCE7] text-[#16A34A]' },
        { label: 'CTR Gợi ý Tự nhiên', value: '14.2%', delta: 'Baseline', icon: 'sparkles', bg: 'bg-[#DBEAFE] text-[#1D4ED8]' },
        { label: 'CTR Gợi ý Tài trợ', value: '9.6%', delta: 'Nhắm ngữ cảnh', icon: 'megaphone', bg: 'bg-[#FEF3C7] text-[#F59E0B]' },
        { label: 'Doanh thu Gói Quảng bá', value: '68.5tr', delta: '+32% MoM', icon: 'chart', bg: 'bg-[#DCFCE7] text-[#16A34A]' }
      ],
      `<div class="bg-white p-4 rounded-2xl border border-[#E2E8F0]">Nhờ nhắm đúng thời tiết và khẩu vị, CTR của thẻ Tài trợ đạt 9.6% (cao gấp 3 lần quảng cáo banner truyền thống).</div>`
    )
  },

  'M10-S06': {
    id: 'M10-S06',
    module: 'M10 · Analytics & Event Tracking',
    platform: 'desktop',
    title: 'Live Event Explorer (14 Standard Events)',
    subtitle: 'Trình khám phá luồng sự kiện thời gian thực theo đúng 14 sự kiện chuẩn trong Spec M10',
    api: 'POST /v1/events/batch',
    ac: ['Đầy đủ 14 sự kiện: app_open, suggestion_shown, suggestion_swiped, dish_view, recipe_view, place_view, order_click, direction_click, call_click, chat_query, save_dish, ad_impression, ad_click, report_issue'],
    render: () => window.UI_KIT.adminShell(
      'M10-S06',
      'Live Event Explorer — 14 Sự Kiện Chuẩn PostHog',
      'Kiểm tra payload JSON thời gian thực từ Mobile App và Consumer Web',
      [],
      `
        <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-3 shadow-sm">
          <div class="font-extrabold">Danh mục 14 Events đang thu thập:</div>
          <div class="flex flex-wrap gap-1.5 font-mono text-[11px]">
            ${['app_open','suggestion_shown','suggestion_swiped','dish_view','recipe_view','place_view','order_click','direction_click','call_click','chat_query','save_dish','ad_impression','ad_click','report_issue'].map(ev =>
              `<span class="px-2.5 py-1 rounded-full ${ev.includes('click') ? 'bg-[#FBBF24] text-[#0F172A] font-extrabold' : 'bg-[#F8FAFC] border border-[#E2E8F0]'}">${ev}</span>`
            ).join('')}
          </div>
        </div>
      `
    )
  },

  // ---------------------------------------------------------------------------
  // M11–M17: GIAI ĐOẠN 2 (TĂNG TRƯỞNG) & GIAI ĐOẠN 3 (MỞ RỘNG) (20 MÀN HÌNH CHI TIẾT)
  // ---------------------------------------------------------------------------
  'M11-S01': {
    id: 'M11-S01',
    module: 'M11 · Kế hoạch Bữa & Đi chợ',
    platform: 'mobile',
    title: 'M11-S01 · Thực đơn 7 Ngày Theo Ngân Sách',
    subtitle: 'AI tự động lên thực đơn 7 ngày (Sáng/Trưa/Tối) khớp ngân sách tuần & không lặp món',
    api: 'GET /v1/meal-plans/weekly',
    ac: ['Thực đơn 7 ngày cân bằng dinh dưỡng + Chuyển nhanh sang Giỏ đi chợ gộp (M11-S02)'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Thực Đơn 7 Ngày', 'M11-S01 · Ngân sách 650k / tuần', 'M3-S01')}
          ${k.mascotTip('bep', 'Bếp lên lịch 7 ngày cho gia đình!', 'Đã cân đối xen kẽ món nước, cơm nhà và nhắc món Chay ngày Rằm.')}
          <div class="space-y-2">
            <div class="p-3 rounded-2xl bg-[#FEF3C7] border border-[#F59E0B] flex justify-between items-center"><div><b>Thứ 2 · Phở bò + Cơm cá kho</b><div class="text-[10px] text-[#B45309]">1,420 kcal · Chi phí chợ 95.000đ</div></div>${k.tagPill('Hôm nay', 'yellow')}</div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center"><div><b>Thứ 3 · Bánh mì + Canh chua cá lóc</b><div class="text-[10px] text-[#64748B]">1,350 kcal · Chi phí chợ 85.000đ</div></div>${k.tagPill('Đã chuẩn bị', 'green')}</div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center"><div><b>Thứ 4 (Mùng 1) · Bún riêu chay</b><div class="text-[10px] text-[#64748B]">1,180 kcal · Chi phí chợ 65.000đ</div></div>${k.tagPill('Ngày Chay', 'mint')}</div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="goScreen('M11-S02')" class="py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-sm">🛒 Giỏ đi chợ gộp</button>
            <button onclick="goScreen('M11-S03')" class="py-3 rounded-full bg-[#18181B] text-white font-extrabold">🧊 Tủ lạnh có gì?</button>
          </div>
        </div>
      `;
    }
  },

  'M11-S02': {
    id: 'M11-S02',
    module: 'M11 · Kế hoạch Bữa & Đi chợ',
    platform: 'mobile',
    title: 'M11-S02 · Danh Sách Nguyên Liệu Đi Chợ Gộp',
    subtitle: 'Tự động cộng gộp nguyên liệu trùng nhau của cả 7 ngày & trừ đồ còn trong tủ lạnh',
    api: 'GET /v1/groceries/consolidated',
    ac: ['Gộp theo quầy hàng (Thịt cá, Rau củ, Gia vị) để đi chợ siêu tốc trong 15 phút'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Giỏ Đi Chợ Gộp', 'M11-S02 · Đã gộp 7 ngày (12 mục)', 'M11-S01')}
          <div class="bg-[#F8FAFC] p-3.5 rounded-3xl border border-[#E2E8F0] space-y-2.5">
            <div class="flex justify-between items-center"><b>Quầy Thịt & Cá tươi</b>${k.tagPill('320.000đ', 'yellow')}</div>
            <label class="flex justify-between py-1 border-b border-[#E2E8F0]"><span>✓ Thịt bò thăn & nạm (Phở + Bò kho)</span><b>600g</b></label>
            <label class="flex justify-between py-1 border-b border-[#E2E8F0]"><span>☐ Cá lóc đồng làm sẵn (Canh chua)</span><b>750g</b></label>
            <label class="flex justify-between py-1"><span>☐ Sườn cốt lết (Cơm tấm Thứ 5)</span><b>500g</b></label>
          </div>
          <button onclick="goScreen('M11-S03')" class="w-full py-3 rounded-full bg-[#22C55E] text-white font-extrabold shadow-md">Kiểm tra "Tủ lạnh có gì" (M11-S03) →</button>
        </div>
      `;
    }
  },

  'M11-S03': {
    id: 'M11-S03',
    module: 'M11 · Kế hoạch Bữa & Đi chợ',
    platform: 'mobile',
    title: 'M11-S03 · Tủ Lạnh Có Gì Nấu Nấy (Fridge AI)',
    subtitle: 'Chọn nhanh nguyên liệu còn dư trong tủ lạnh để Măm AI gợi ý món nấu ngay',
    api: 'POST /v1/dishes/by-ingredients',
    ac: ['Tránh lãng phí thực phẩm, ưu tiên nguyên liệu sắp hết hạn'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Tủ Lạnh Có Gì?', 'M11-S03 · Nấu ngon từ đồ sẵn có', 'M11-S01')}
          <div class="grid grid-cols-4 gap-2 text-center">
            <div class="p-2 rounded-2xl bg-[#FEF3C7] border border-[#F59E0B]"><img data-img="034" class="w-10 h-10 rounded-full mx-auto object-cover mb-1"/><b>Trứng (4)</b></div>
            <div class="p-2 rounded-2xl bg-[#FEF3C7] border border-[#F59E0B]"><img data-img="298" class="w-10 h-10 rounded-full mx-auto object-cover mb-1"/><b>Thịt bò</b></div>
            <div class="p-2 rounded-2xl bg-[#FEF3C7] border border-[#F59E0B]"><img data-img="304" class="w-10 h-10 rounded-full mx-auto object-cover mb-1"/><b>Cà chua</b></div>
            <div class="p-2 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]"><img data-img="310" class="w-10 h-10 rounded-full mx-auto object-cover mb-1"/><b>Hành lá</b></div>
          </div>
          <div onclick="goScreen('M2-S04')" class="p-3.5 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE] flex items-center justify-between cursor-pointer">
            <div><b class="text-sm">Gợi ý nấu ngay: Bò xào cà chua & Canh trứng</b><div class="text-[10px] text-[#1D4ED8]">Khớp 100% nguyên liệu sẵn có · Nấu 15 phút</div></div>
            <span>→</span>
          </div>
        </div>
      `;
    }
  },

  'M12-S01': {
    id: 'M12-S01',
    module: 'M12 · Xã hội & Gamification',
    platform: 'mobile',
    title: 'M12-S01 · Tạo Phòng Vote Nhóm (Group Poll)',
    subtitle: 'Bình chọn nhanh "Trưa nay phòng mình ăn gì?" qua link chia sẻ Zalo',
    api: 'POST /v1/polls',
    ac: ['Tự động giao thoa bộ lọc dị ứng của tất cả thành viên tham gia phòng vote'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Vote Nhóm Ăn Trưa', 'M12-S01 · Chốt món cho cả team', 'M3-S01')}
          <img data-img="751" class="w-full h-36 rounded-2xl object-cover border border-[#E2E8F0]" />
          <div class="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0] space-y-2">
            <div class="flex justify-between items-center"><b>🗳️ "Trưa thứ 6 team mình ăn gì?"</b>${k.tagPill('6/8 đã vote', 'yellow')}</div>
            <div class="p-2.5 rounded-xl bg-[#FEF3C7] text-[#B45309] flex justify-between font-extrabold"><span>1. Lẩu gà lá é Tao Ngộ</span><span>4 phiếu (67%)</span></div>
            <div class="p-2.5 rounded-xl bg-white border border-[#E2E8F0] flex justify-between font-semibold"><span>2. Cơm niêu Hương Việt</span><span>2 phiếu (33%)</span></div>
          </div>
          <button onclick="goScreen('M12-S02')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">Xem Streak & Huy hiệu Ẩm thực (M12-S02) →</button>
        </div>
      `;
    }
  },

  'M12-S02': {
    id: 'M12-S02',
    module: 'M12 · Xã hội & Gamification',
    platform: 'mobile',
    title: 'M12-S02 · Chuỗi Ngày Nấu Ăn (Streak) & Huy Hiệu',
    subtitle: 'Gamification giữ chân người dùng: Streak tự nấu tại nhà & Huy hiệu Thổ Địa',
    api: 'GET /v1/me/gamification',
    ac: ['Tăng D7/D30 Retention nhờ hệ thống huy hiệu cùng Mascot Măm & Bếp'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Streak & Huy Hiệu', 'M12-S02 · Gamification', 'M12-S01')}
          <div class="p-4 rounded-3xl bg-[#18181B] text-white flex items-center justify-between shadow-lg">
            <div><span class="text-[#FBBF24] font-extrabold text-xs">🔥 Chuỗi 12 ngày liên tiếp!</span><div class="text-base font-extrabold mt-0.5">Đầu Bếp Tại Gia Cấp 4</div><div class="text-[10px] text-gray-300">Đã tiết kiệm ~840.000đ tuần này</div></div>
            ${k.mascotSVG('bep', 'w-16 h-18')}
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="p-3 rounded-2xl bg-[#FEF3C7] font-extrabold">🏆<div class="mt-1">Vua Phở Bắc</div></div>
            <div class="p-3 rounded-2xl bg-[#DCFCE7] font-extrabold">🌿<div class="mt-1">Eat Clean 7d</div></div>
            <div class="p-3 rounded-2xl bg-[#DBEAFE] font-extrabold">🗺️<div class="mt-1">Thổ Địa Biên Hòa</div></div>
          </div>
        </div>
      `;
    }
  },

  'M12-S03': {
    id: 'M12-S03',
    module: 'M12 · Xã hội & Gamification',
    platform: 'mobile',
    title: 'M12-S03 · Đánh Giá Thực Tế & Ảnh Chụp Tại Quán',
    subtitle: 'Chỉ cho phép đánh giá khi người dùng thực sự đã ghé quán (GPS / QR Verified)',
    api: 'POST /v1/places/{id}/reviews',
    ac: ['Chống đánh giá ảo (GPS Verified Check-in)'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Đánh Giá Quán Xác Minh', 'M12-S03 · GPS Verified Review', 'M12-S01')}
          <div class="p-3.5 rounded-3xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
            <div class="flex justify-between items-center"><b>Phở Gia Truyền Phát Tài</b>${k.tagPill('✔ Đã ghé quán (GPS)', 'green')}</div>
            <img data-img="298" class="w-full h-32 rounded-2xl object-cover" />
            <p class="text-[#334155]">"Nước dùng trong và ngọt thanh, thịt bò tái mềm, quán sạch sẽ có máy lạnh mát."</p>
          </div>
        </div>
      `;
    }
  },

  'M13-S01': {
    id: 'M13-S01',
    module: 'M13 · Đặt bàn & Voucher',
    platform: 'mobile',
    title: 'M13-S01 · Đặt Bàn Giữ Chỗ Trước',
    subtitle: 'Chọn số người, giờ đến ăn & yêu cầu ghế trẻ em / phòng máy lạnh',
    api: 'POST /v1/bookings',
    ac: ['Xác nhận tự động qua Zalo ZNS / SMS trong 10 giây'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Đặt Bàn Giữ Chỗ', 'M13-S01 · Không lo hết bàn giờ cao điểm', 'M4-S03')}
          <img data-img="755" class="w-full h-36 rounded-2xl object-cover border border-[#E2E8F0]" />
          <div class="grid grid-cols-3 gap-2 text-center font-extrabold">
            <div class="p-2.5 rounded-xl bg-[#FEF3C7] border border-[#F59E0B]">👥 4 Người</div>
            <div class="p-2.5 rounded-xl bg-[#FEF3C7] border border-[#F59E0B]">🕖 19:00 Tối</div>
            <div class="p-2.5 rounded-xl bg-[#DCFCE7] text-[#15803D]">👶 Ghế em bé</div>
          </div>
          <button onclick="goScreen('M13-S02')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">Xác nhận Đặt bàn & Nhận mã Zalo (M13-S02) →</button>
        </div>
      `;
    }
  },

  'M13-S02': {
    id: 'M13-S02',
    module: 'M13 · Đặt bàn & Voucher',
    platform: 'mobile',
    title: 'M13-S02 · Ví Voucher Quán & Thanh Toán MoMo/ZaloPay',
    subtitle: 'Lưu voucher ưu đãi độc quyền tại quán & trừ tiền trực tiếp qua MoMo/ZaloPay',
    api: 'GET /v1/vouchers · POST /v1/vouchers/redeem',
    ac: ['Áp dụng mã giảm giá 1 chạm tại quầy'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Ví Voucher Ẩm Thực', 'M13-S02 · MoMo & ZaloPay', 'M13-S01')}
          <div class="p-4 rounded-3xl bg-[#18181B] text-white space-y-2 shadow-lg">
            ${k.tagPill('Độc quyền Hôm nay ăn gì', 'yellow')}
            <div class="text-base font-extrabold">Giảm ngay 30.000đ cho hóa đơn từ 150k</div>
            <div class="text-[10px] text-gray-300">Áp dụng tại Phở Phát Tài & Cơm Niêu Hương Việt · Hạn 30/11</div>
          </div>
        </div>
      `;
    }
  },

  'M14-S01': {
    id: 'M14-S01',
    module: 'M14 · Văn hóa & Câu chuyện Món',
    platform: 'mobile',
    title: 'M14-S01 · Câu Chuyện Di Sản Món Việt',
    subtitle: 'Nguồn gốc lịch sử, nghệ nhân nấu ăn và văn hóa thưởng thức món Việt',
    api: 'GET /v1/stories/{slug}',
    ac: ['Bài viết biên tập sâu sắc kèm hình ảnh nghệ thuật (uid_760)'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Văn Hóa & Di Sản Món', 'M14-S01 · Taste of Vietnam Stories', 'M2-S04')}
          <img data-img="760" class="w-full h-44 rounded-2xl object-cover border border-[#E2E8F0]" />
          <div class="space-y-1.5">
            ${k.tagPill('Di sản Văn hóa Phi vật thể', 'yellow')}
            <h4 class="font-extrabold text-sm">Hành Trình Trăm Năm Của Phở Việt</h4>
            <p class="text-[11px] text-[#64748B] leading-relaxed">Khám phá sự khác biệt tinh tế giữa nước dùng thanh trong của Phở Bắc và đĩa rau thơm, tương đen phóng khoáng của Phở Nam.</p>
          </div>
          <button onclick="goScreen('M14-S02')" class="w-full py-2.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] font-extrabold">So sánh Biến tấu 3 Miền (M14-S02) →</button>
        </div>
      `;
    }
  },

  'M14-S02': {
    id: 'M14-S02',
    module: 'M14 · Văn hóa & Câu chuyện Món',
    platform: 'mobile',
    title: 'M14-S02 · Bản Đồ So Sánh Biến Tấu Vùng Miền',
    subtitle: 'So sánh cách chế biến, gia vị ăn kèm của cùng 1 món ăn qua Bắc – Trung – Nam',
    api: 'GET /v1/dishes/{id}/regional-variants',
    ac: ['Giúp người dùng hiểu và trân trọng sự đa dạng khẩu vị vùng miền'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('So Sánh Vị 3 Miền', 'M14-S02 · Phở Bắc vs Phở Nam', 'M14-S01')}
          <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1"><b>1. Phở Hà Nội (Miền Bắc)</b><p class="text-[11px] text-[#64748B]">Bánh phở bản to, nước dùng trong thanh ngọt từ xương, ăn kèm quẩy giòn và dấm tỏi ớt.</p></div>
          <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1"><b>2. Phở Sài Gòn (Miền Nam)</b><p class="text-[11px] text-[#64748B]">Nước dùng đậm đà hơi ngọt nhẹ, ăn kèm giá trụng, húng quế, ngò gai, tương đen & tương đỏ.</p></div>
        </div>
      `;
    }
  },

  'M15-S01': {
    id: 'M15-S01',
    module: 'M15 · Du lịch Ẩm thực',
    platform: 'mobile',
    title: 'M15-S01 · Lộ Trình Food Trail Địa Phương',
    subtitle: 'Bản đồ hành trình khám phá ẩm thực 1 ngày tại Biên Hòa / Quy Nhơn cùng Mascot Miu',
    api: 'GET /v1/tourism/trails',
    ac: ['Kết nối 4 điểm ăn Sáng – Trưa – Xế – Tối tối ưu quãng đường di chuyển'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Food Trail Du Lịch', 'M15-S01 · Hành trình Ẩm thực 1 Ngày', 'M3-S01')}
          ${k.mascotTip('miu', 'Miu thiết kế Food Trail cho anh!', 'Hành trình 4 trạm ăn ngon chuẩn bản địa trong bán kính 5km.')}
          <img data-img="764" class="w-full h-40 rounded-2xl object-cover border border-[#E2E8F0]" />
          <button onclick="goScreen('M15-S02')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">Mở Hộ Chiếu Ẩm Thực Đóng Dấu QR (M15-S02) →</button>
        </div>
      `;
    }
  },

  'M15-S02': {
    id: 'M15-S02',
    module: 'M15 · Du lịch Ẩm thực',
    platform: 'mobile',
    title: 'M15-S02 · Hộ Chiếu Ẩm Thực & Check-in QR',
    subtitle: 'Quét mã QR tại quán đặc sản địa phương để sưu tầm con dấu Hộ chiếu Ẩm thực',
    api: 'POST /v1/tourism/passport/checkin',
    ac: ['Tăng lượng khách du lịch ghé thăm các quán truyền thống lâu đời'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Hộ Chiếu Ẩm Thực', 'M15-S02 · Đã đóng dấu 3/5 trạm', 'M15-S01')}
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="p-3 rounded-2xl bg-[#DCFCE7] border border-[#22C55E] font-extrabold">💮<div class="mt-1">Phở Phát Tài</div></div>
            <div class="p-3 rounded-2xl bg-[#DCFCE7] border border-[#22C55E] font-extrabold">💮<div class="mt-1">Gỏi Cá Tân Mai</div></div>
            <div class="p-3 rounded-2xl bg-[#DCFCE7] border border-[#22C55E] font-extrabold">💮<div class="mt-1">Bưởi Tân Triều</div></div>
          </div>
        </div>
      `;
    }
  },

  'M16-S01': {
    id: 'M16-S01',
    module: 'M16 · Đa ngôn ngữ (Menu AI)',
    platform: 'mobile',
    title: 'M16-S01 · Camera Menu Translator AI (EN/KO/ZH/JA)',
    subtitle: 'Quét thực đơn tiếng Việt → Dịch sang Anh/Hàn/Trung/Nhật kèm cảnh báo dị ứng & đổi tiền tệ',
    api: 'POST /v1/translate/menu',
    ac: ['Giữ tên món gốc tiếng Việt + Giải thích nguyên liệu + Cảnh báo dị ứng bằng ngôn ngữ du khách'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Menu Translator AI', 'M16-S01 · EN · KO · ZH · JA', 'M3-S01')}
          <img data-img="768" class="w-full h-44 rounded-2xl object-cover border border-[#E2E8F0]" />
          <button onclick="goScreen('M16-S02')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">Mở Thẻ Phát Âm Gọi Món (M16-S02) →</button>
        </div>
      `;
    }
  },

  'M16-S02': {
    id: 'M16-S02',
    module: 'M16 · Đa ngôn ngữ (Menu AI)',
    platform: 'mobile',
    title: 'M16-S02 · Thẻ Phát Âm Gọi Món Cho Khách Quốc Tế',
    subtitle: 'Phát âm tiếng Việt chuẩn để du khách đưa cho chủ quán hoặc nghe đọc to',
    api: 'GET /v1/translate/phrases',
    ac: ['Hỗ trợ các câu dặn dị ứng quan trọng: Không đậu phộng, Không hải sản, Không cay'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Audio Ordering Card', 'M16-S02 · Phát âm gọi món & dị ứng', 'M16-S01')}
          <div class="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center"><div><b>"Cho tôi 1 tô Phở bò không hành"</b><div class="text-[10px] text-[#64748B]">EN: One Beef Pho without green onions, please</div></div><button class="px-3 py-1.5 rounded-full bg-[#FBBF24] font-extrabold">🔊 Đọc</button></div>
          <div class="p-3.5 rounded-2xl bg-[#FFE4E6] border border-[#FECDD3] flex justify-between items-center"><div><b class="text-[#BE123C]">"Tôi bị dị ứng tôm và đậu phộng"</b><div class="text-[10px] text-[#BE123C]">EN: I am allergic to shrimp and peanuts</div></div><button class="px-3 py-1.5 rounded-full bg-[#18181B] text-white font-extrabold">🔊 Đọc</button></div>
        </div>
      `;
    }
  },

  'M17-S01': {
    id: 'M17-S01',
    module: 'M17 · B2G Du lịch & Brand',
    platform: 'desktop',
    title: 'M17-S01 · B2G Tourism & Culinary Heatmap Dashboard',
    subtitle: 'Dashboard dữ liệu tổng hợp ẩn danh cho Sở Du lịch địa phương & Chiến dịch Thương hiệu',
    api: 'GET /v1/enterprise/tourism-insights',
    ac: ['Dữ liệu ẩn danh 100%, hiển thị bản đồ nhiệt xu hướng ẩm thực theo khu vực'],
    render: () => window.UI_KIT.adminShell(
      'M17-S01',
      'B2G Du Lịch Ẩm Thực & Brand Insights Dashboard (M17-S01)',
      'Cung cấp số liệu xu hướng ẩm thực vùng miền ẩn danh cho cơ quan xúc tiến du lịch & nhãn hàng FMCG',
      [
        { label: 'Truy vấn Đặc sản Địa phương', value: '142.5k', delta: '+28%', icon: 'globe', bg: 'bg-[#FEF3C7] text-[#F59E0B]' },
        { label: 'Du khách Quốc tế (M16)', value: '18.4k', delta: 'EN/KO/JA', icon: 'users', bg: 'bg-[#DCFCE7] text-[#16A34A]' },
        { label: 'Điểm Food Trail Check-in', value: '340 quán', delta: 'QR Verified', icon: 'pin', bg: 'bg-[#DBEAFE] text-[#1D4ED8]' },
        { label: 'Chuẩn Ẩn Danh Dữ Liệu', value: '100%', delta: 'K-Anonymity', icon: 'shield', bg: 'bg-[#DCFCE7] text-[#16A34A]' }
      ],
      `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div class="md:col-span-7 bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2 shadow-sm">
            <div class="font-extrabold">Biểu đồ Tăng trưởng Du khách Khám phá Ẩm thực Bản địa</div>
            ${window.UI_KIT.lineChart('Lượt Check-in Food Trail & Tìm kiếm Đặc sản', '+34.2% YoY', '#3B82F6')}
          </div>
          <div class="md:col-span-5 bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2 shadow-sm">
            <div class="font-extrabold">Phân bổ Quốc tịch Du khách dùng M16 Menu AI</div>
            ${window.UI_KIT.donutChart('Quốc tế', '18.4k', [
              { label: 'Hàn Quốc (KO)', pct: '38%', color: '#FBBF24' },
              { label: 'Tiếng Anh (EN)', pct: '32%', color: '#22C55E' },
              { label: 'Nhật Bản (JA)', pct: '18%', color: '#3B82F6' },
              { label: 'Trung Quốc (ZH)', pct: '12%', color: '#F97316' }
            ])}
          </div>
        </div>
      `
    )
  },

  'M17-S02': {
    id: 'M17-S02',
    module: 'M17 · B2G Du lịch & Brand',
    platform: 'desktop',
    title: 'M17-S02 · FMCG Brand Recipe Sponsorships',
    subtitle: 'Quản lý chiến dịch đồng hành thương hiệu gia vị / nguyên liệu trong màn hình Công thức (M2)',
    api: 'GET /v1/enterprise/brand-campaigns',
    ac: ['Hiển thị tinh tế gợi ý gia vị chuẩn trong công thức nấu ăn mà không làm phiền người dùng'],
    render: () => window.UI_KIT.adminShell(
      'M17-S02',
      'Chiến Dịch Đồng Hành Thương Hiệu Nguyên Liệu (Brand Sponsorships)',
      'Tích hợp tự nhiên vào danh sách nguyên liệu công thức nấu ăn (M2-S06) và giỏ đi chợ (M11-S02)',
      [],
      `
        <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] flex justify-between items-center shadow-sm">
          <div>
            <div class="flex items-center gap-2"><b>Chiến dịch: Nước mắm truyền thống Phú Quốc cho Món Kho & Canh Chua</b>${window.UI_KIT.tagPill('Active Brand Partner', 'green')}</div>
            <div class="text-[11px] text-[#64748B] mt-0.5">Hiển thị tại 85 công thức món kho & canh miền Nam · 42,000 lượt thêm vào giỏ đi chợ</div>
          </div>
          <span class="font-extrabold text-sm text-[#16A34A]">CTR 8.4%</span>
        </div>
      `
    )
  }
};
