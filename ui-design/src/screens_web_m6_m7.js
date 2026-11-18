// =============================================================================
// CONSUMER WEB (W-S01..05), MERCHANT PORTAL M6 (M6-S01..09), ADS M7 (M7-S01..08)
// =============================================================================

window.SCREENS_WEB_M6_M7 = {
  // ---------------------------------------------------------------------------
  // CONSUMER WEB / PWA (5 MÀN HÌNH DESKTOP: W-S01..W-S05 — AI CHEF + VELORA STYLE)
  // ---------------------------------------------------------------------------
  'W-S01': {
    id: 'W-S01',
    module: '02. Consumer Web / PWA',
    platform: 'desktop',
    title: 'Web Home & AI Chef Discovery',
    subtitle: 'Trang chủ Web/PWA kết hợp Dark Hero AI Chef, 5 vòng tròn danh mục Pastel & lưới món ăn 3 cột',
    api: 'GET /v1/suggestions/today · GET /v1/dishes/trending',
    ac: ['Đồng bộ 100% ngôn ngữ thiết kế AI Chef lên Desktop', 'Tối ưu SEO SSR Next.js'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="bg-white text-[#0F172A] rounded-3xl overflow-hidden border border-[#E2E8F0] shadow-xl">
          <!-- Web Top Navbar -->
          <div class="px-6 py-4 bg-white border-b border-[#F1F5F9] flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-6">
              <div class="flex items-center gap-2.5 font-extrabold text-base text-[#0F172A]">
                <span class="w-9 h-9 rounded-xl bg-[#FBBF24] text-[#0F172A] flex items-center justify-center shadow-sm">${k.icon('chefHat', 'w-5 h-5')}</span>
                <span>Hôm nay ăn gì · <span class="text-[#F59E0B]">Taste of Vietnam</span></span>
              </div>
              <nav class="hidden md:flex items-center gap-5 text-xs font-bold text-[#64748B]">
                <span class="text-[#0F172A]">Khám phá AI</span>
                <button onclick="goScreen('W-S02')" class="hover:text-[#0F172A]">Tìm Món & Quán</button>
                <button onclick="goScreen('W-S03')" class="hover:text-[#0F172A]">Công thức nấu</button>
                <button onclick="goScreen('W-S05')" class="hover:text-[#0F172A]">Bộ sưu tập 3 Miền</button>
              </nav>
            </div>
            <div class="flex items-center gap-2.5 text-xs">
              <span class="px-3 py-1.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] font-semibold">📍 Biên Hòa · 🌧️ 26°C</span>
              <button onclick="goScreen('M3-S04')" class="px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold flex items-center gap-1 shadow-sm">
                ${k.icon('sparkles', 'w-3.5 h-3.5')}
                <span>Hỏi Măm AI Chef</span>
              </button>
            </div>
          </div>

          <!-- Dark Charcoal Hero Section (Desktop Expansion of Screen 1) -->
          <div class="m-6 p-8 rounded-3xl bg-[#18181B] text-white grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative overflow-hidden shadow-xl">
            <div class="lg:col-span-7 space-y-3 z-10">
              <span class="px-3 py-1 rounded-full bg-[#22C55E] text-white text-xs font-bold inline-flex items-center gap-1.5">
                ${k.icon('sparkles', 'w-3.5 h-3.5')}
                <span>AI Powered · Trợ lý Ẩm thực Việt Nam</span>
              </span>
              <h1 class="text-2xl lg:text-3xl font-extrabold leading-tight">Măm AI Gợi Ý Bữa Ngon<br/>Chuẩn Khẩu Vị Của Riêng Bạn</h1>
              <p class="text-xs text-gray-300 max-w-xl leading-relaxed">Kết nối từ nguyên liệu sẵn có trong bếp hoặc câu hỏi tự nhiên ("Tối nay 4 người 300k ăn gì?") đến 500+ công thức và quán ngon xác minh quanh bạn.</p>
              <div class="flex flex-wrap gap-2.5 pt-2">
                <button onclick="goScreen('W-S02')" class="px-5 py-2.5 rounded-full bg-[#FBBF24] text-[#0F172A] text-xs font-extrabold inline-flex items-center gap-1.5 shadow-md">
                  <span>Thử Măm AI Chef ngay</span>
                  ${k.icon('arrowRight', 'w-4 h-4')}
                </button>
                <button onclick="goScreen('W-S03')" class="px-5 py-2.5 rounded-full bg-white/10 text-white text-xs font-bold hover:bg-white/15">
                  Xem Công thức Phở Bò (480 kcal)
                </button>
              </div>
            </div>
            <div class="lg:col-span-5 flex items-center justify-end gap-4 z-10">
              ${k.mascotSVG('mam', 'w-28 h-32')}
              <img data-img="034" class="w-40 h-40 rounded-full object-cover border-4 border-[#27272A] shadow-2xl" />
            </div>
          </div>

          <!-- 5 Pastel Category Circles + 3-Column Dish Grid -->
          <div class="px-6 pb-6 space-y-6">
            <div class="max-w-lg mx-auto">
              ${k.categoryRow()}
            </div>

            <div class="space-y-3">
              <div class="flex justify-between items-center">
                <h3 class="font-extrabold text-base">3 Gợi ý Hôm nay từ Măm AI (Desktop 3-Column Grid)</h3>
                <span class="text-xs text-[#64748B]">Đã lọc cứng dị ứng Tôm/Hải sản · Ngân sách 35k–60k</span>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div onclick="goScreen('W-S03')" class="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0] space-y-2.5 cursor-pointer hover:border-[#FBBF24] transition">
                  <img data-img="298" class="w-full h-36 rounded-xl object-cover" />
                  <div class="flex gap-1.5">${k.tagPill('Nhanh 15p', 'yellow')}${k.tagPill('Healthy 480 kcal', 'blue')}</div>
                  <div class="flex justify-between items-baseline"><b class="text-sm">Phở Bò Tái Nạm</b><b class="text-[#D97736] text-sm">45.000đ</b></div>
                  <p class="text-[#64748B]">Nước dùng ấm nóng hợp trời mát 26°C · 14 quán cách &lt; 3km</p>
                </div>
                <div onclick="goScreen('W-S03')" class="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0] space-y-2.5 cursor-pointer hover:border-[#FBBF24] transition">
                  <img data-img="304" class="w-full h-36 rounded-xl object-cover" />
                  <div class="flex gap-1.5">${k.tagPill('Bữa trưa', 'green')}${k.tagPill('Đậm đà', 'purple')}</div>
                  <div class="flex justify-between items-baseline"><b class="text-sm">Cơm Tấm Sườn Bì Chả</b><b class="text-[#D97736] text-sm">40.000đ</b></div>
                  <p class="text-[#64748B]">Sườn nướng than hoa thơm lừng · Quán mở cách 550m</p>
                </div>
                <div onclick="goScreen('W-S04')" class="bg-[#F8FAFC] p-3.5 rounded-2xl border-2 border-[#FBBF24] space-y-2.5 cursor-pointer">
                  <img data-img="310" class="w-full h-36 rounded-xl object-cover" />
                  <div class="flex gap-1.5">${k.tagPill('Giàu Đạm', 'mint')}${k.tagPill('Tài trợ (1/3)', 'orange')}</div>
                  <div class="flex justify-between items-baseline"><b class="text-sm">Bún Bò Huế O Xuân</b><b class="text-[#D97736] text-sm">50.000đ</b></div>
                  <p class="text-[#64748B]">Hợp khẩu vị cay nhẹ · Quán đang mở cách 650m</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  },

  'W-S02': {
    id: 'W-S02',
    module: '02. Consumer Web / PWA',
    platform: 'desktop',
    title: 'Web Search & Multi-Filter Directory',
    subtitle: 'Tìm kiếm món ăn & quán ăn kết hợp bộ lọc Sidebar và nhãn Pastel',
    api: 'GET /v1/search?q=pho&region=bac',
    ac: ['Sidebar bộ lọc bên trái + Grid kết quả bên phải chuẩn Responsive'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="bg-[#F8FAFC] text-[#0F172A] rounded-3xl p-6 border border-[#E2E8F0] grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs shadow-lg">
          <div class="lg:col-span-4 bg-white p-5 rounded-2xl border border-[#E2E8F0] space-y-4">
            <div class="flex items-center justify-between">
              <span class="font-extrabold text-sm flex items-center gap-1.5">${k.icon('sliders', 'w-4 h-4 text-[#F59E0B]')} Bộ lọc Khám phá</span>
              <span class="text-[11px] text-[#64748B]">Đặt lại</span>
            </div>
            <div><div class="font-bold text-[#64748B] mb-1.5">Bữa ăn</div><div class="flex flex-wrap gap-1.5">${k.tagPill('Bữa trưa ✓', 'yellow')}${k.tagPill('Bữa sáng', 'blue')}${k.tagPill('Bữa tối', 'purple')}</div></div>
            <div><div class="font-bold text-[#64748B] mb-1.5">Ngân sách</div><div class="flex flex-wrap gap-1.5">${k.tagPill('35k – 60k ✓', 'green')}${k.tagPill('< 35k', 'mint')}</div></div>
            <div class="p-3 rounded-2xl bg-[#FFE4E6] text-[#BE123C] font-bold flex items-center gap-2">
              ${k.icon('shield', 'w-4 h-4')}
              <span>Đã chặn cứng: Tôm, Cua, Đậu phộng</span>
            </div>
            ${k.mascotTip('la', 'Lá Healthy', 'Mọi kết quả bên phải đều an toàn 100% với hồ sơ dị ứng của anh!')}
          </div>
          <div class="lg:col-span-8 space-y-4">
            <div class="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] flex items-center justify-between">
              <span class="font-extrabold">🔍 24 món khớp bộ lọc "Bữa trưa · 35k–60k · Không hải sản"</span>
              <button onclick="goScreen('W-S01')" class="px-3 py-1.5 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">← Trang chủ Web</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onclick="goScreen('W-S03')" class="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] flex gap-3.5 items-center cursor-pointer hover:border-[#FBBF24]">
                <img data-img="298" class="w-20 h-20 rounded-xl object-cover" />
                <div class="space-y-1"><div class="font-extrabold text-sm">Phở Bò Tái Nạm</div><div class="flex gap-1">${k.tagPill('20 phút', 'yellow')}${k.tagPill('480 kcal', 'blue')}</div><div class="font-extrabold text-[#D97736]">45.000đ · 14 quán</div></div>
              </div>
              <div onclick="goScreen('W-S03')" class="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] flex gap-3.5 items-center cursor-pointer hover:border-[#FBBF24]">
                <img data-img="470" class="w-20 h-20 rounded-xl object-cover" />
                <div class="space-y-1"><div class="font-extrabold text-sm">Bánh Mì Thịt Nướng</div><div class="flex gap-1">${k.tagPill('Nhanh 10p', 'green')}${k.tagPill('390 kcal', 'purple')}</div><div class="font-extrabold text-[#D97736]">25.000đ · 22 quán</div></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  },

  'W-S03': {
    id: 'W-S03',
    module: '02. Consumer Web / PWA',
    platform: 'desktop',
    title: 'Web Dish & Recipe SEO Detail Page',
    subtitle: 'Trang chi tiết công thức chuẩn Schema.org/Recipe với 4 thẻ nguyên liệu tròn & Mascot Bếp',
    api: 'GET /v1/dishes/{slug}',
    ac: ['Hiển thị 4 thẻ nguyên liệu ảnh tròn + Step by step + Quán gần bạn trên cùng 1 màn hình rộng'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="bg-[#F8FAFC] text-[#0F172A] rounded-3xl p-6 border border-[#E2E8F0] grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs shadow-lg">
          <div class="lg:col-span-7 bg-white p-5 rounded-3xl border border-[#E2E8F0] space-y-4">
            <div class="flex items-center gap-4">
              <img data-img="034" class="w-24 h-24 rounded-full object-cover border-4 border-[#FEF3C7] shadow-md" />
              <div class="space-y-1">
                <div class="flex gap-1.5">${k.tagPill('Schema.org/Recipe', 'green')}${k.tagPill('Miền Bắc', 'yellow')}</div>
                <h2 class="text-xl font-extrabold">Phở Bò Tái Nạm Hà Nội</h2>
                <p class="text-[#64748B]">⭐ 4.8 (1.2k reviews) · 🍴 2 Khẩu phần · 🔥 480 kcal</p>
              </div>
            </div>
            <div class="grid grid-cols-4 gap-2.5 text-center">
              <div class="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9]"><img data-img="034" class="w-12 h-12 rounded-full mx-auto object-cover mb-1"/><b>Bánh phở</b><div class="text-[#64748B]">350g</div></div>
              <div class="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9]"><img data-img="298" class="w-12 h-12 rounded-full mx-auto object-cover mb-1"/><b>Thịt bò</b><div class="text-[#64748B]">250g</div></div>
              <div class="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9]"><img data-img="304" class="w-12 h-12 rounded-full mx-auto object-cover mb-1"/><b>Gừng & Tỏi</b><div class="text-[#64748B]">4 củ</div></div>
              <div class="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9]"><img data-img="310" class="w-12 h-12 rounded-full mx-auto object-cover mb-1"/><b>Nước dùng</b><div class="text-[#64748B]">1.0 lít</div></div>
            </div>
            ${k.mascotTip('bep', 'Bếp Hướng dẫn Step-by-Step', 'Bước 1 (5p): Nướng thơm gừng & thảo quả. Bước 2 (3p): Chần bánh phở, xếp thịt bò thái mỏng và chan nước dùng thật sôi!')}
          </div>
          <div class="lg:col-span-5 bg-white p-5 rounded-3xl border border-[#E2E8F0] space-y-3">
            <h4 class="font-extrabold text-sm">Muốn đi ăn ngay? 14 quán đang mở gần bạn:</h4>
            <div onclick="goScreen('W-S04')" class="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3 cursor-pointer hover:border-[#FBBF24]">
              <img data-img="477" class="w-14 h-14 rounded-xl object-cover" />
              <div class="flex-1"><div class="font-extrabold">Phở Gia Truyền Phát Tài ✔</div><div class="text-[#64748B]">Cách 400m · 06:00–22:00</div></div>
              <span class="font-extrabold text-[#D97736]">45.000đ</span>
            </div>
            <button onclick="goScreen('W-S04')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-sm">
              ✨ Xem Bản đồ Quán & Đặt giao tận nơi
            </button>
          </div>
        </div>
      `;
    }
  },

  'W-S04': {
    id: 'W-S04',
    module: '02. Consumer Web / PWA',
    platform: 'desktop',
    title: 'Web Restaurant Detail & Split Map',
    subtitle: 'Trang chi tiết quán ăn xác minh kết hợp bản đồ tương tác PostGIS 3km',
    api: 'GET /v1/places/{slug}',
    ac: ['Bố cục 2 cột + Bản đồ trực quan trên Desktop'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="bg-[#F8FAFC] text-[#0F172A] rounded-3xl p-6 border border-[#E2E8F0] grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs shadow-lg">
          <div class="lg:col-span-7 bg-white p-5 rounded-3xl border border-[#E2E8F0] space-y-4">
            <div class="flex items-start gap-4">
              <img data-img="477" class="w-24 h-24 rounded-2xl object-cover shadow" />
              <div class="space-y-1">
                ${k.tagPill('● Đang mở cửa · 06:00–22:00', 'green')}
                <h3 class="text-lg font-extrabold">Phở Gia Truyền Phát Tài</h3>
                <p class="text-[#64748B]">📍 128 Huỳnh Văn Nghệ, P. Bửu Long, Biên Hòa (Cách 400m)</p>
                <div class="flex flex-wrap gap-2 pt-2">
                  <button onclick="goScreen('M5-S02')" class="px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">🛵 Đặt Xanh SM / GrabFood</button>
                  <button onclick="goScreen('M5-S03')" class="px-4 py-2 rounded-full bg-[#18181B] text-white font-bold">🧭 Chỉ đường Google Maps</button>
                </div>
              </div>
            </div>
          </div>
          <div class="lg:col-span-5 rounded-3xl overflow-hidden border border-[#E2E8F0] h-52 relative">
            <img data-img="622" class="w-full h-full object-cover" />
            <div class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full bg-[#18181B] text-[#FBBF24] font-extrabold shadow">📍 Bán kính 3km · PostGIS Geo</div>
          </div>
        </div>
      `;
    }
  },

  'W-S05': {
    id: 'W-S05',
    module: '02. Consumer Web / PWA',
    platform: 'desktop',
    title: 'Web Regional Collections & Heritage',
    subtitle: 'Bộ sưu tập ẩm thực 3 miền Bắc – Trung – Nam & Gợi ý theo mùa',
    api: 'GET /v1/collections/public',
    ac: ['Landing page chuẩn SEO thu hút người dùng khám phá ẩm thực Việt'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="bg-white text-[#0F172A] rounded-3xl p-6 border border-[#E2E8F0] space-y-4 text-xs shadow-lg">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-3">
              ${k.mascotSVG('miu', 'w-14 h-16')}
              <div><h3 class="text-lg font-extrabold">Bộ Sưu Tập Ẩm Thực 3 Miền cùng Miu Explorer</h3><p class="text-[#64748B]">Tuyển chọn công thức chuẩn vị & quán ngon lâu năm</p></div>
            </div>
            <button onclick="goScreen('W-S01')" class="px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">← Trang chủ Web</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div onclick="goScreen('W-S03')" class="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0] space-y-2 cursor-pointer"><img data-img="093" class="w-full h-32 rounded-xl object-cover"/><div class="flex gap-1">${k.tagPill('Ngày mưa', 'blue')}${k.tagPill('15 món', 'yellow')}</div><div class="font-extrabold text-sm">Top 15 Món Nước Ấm Bụng</div></div>
            <div onclick="goScreen('W-S03')" class="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0] space-y-2 cursor-pointer"><img data-img="592" class="w-full h-32 rounded-xl object-cover"/><div class="flex gap-1">${k.tagPill('Cơm nhà', 'green')}${k.tagPill('< 100k', 'purple')}</div><div class="font-extrabold text-sm">Mâm Cơm Gia Đình Miền Nam</div></div>
            <div onclick="goScreen('W-S03')" class="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0] space-y-2 cursor-pointer"><img data-img="760" class="w-full h-32 rounded-xl object-cover"/><div class="flex gap-1">${k.tagPill('Di sản', 'orange')}${k.tagPill('3 Miền', 'mint')}</div><div class="font-extrabold text-sm">Hành Trình Phở & Bún Việt Nam</div></div>
          </div>
        </div>
      `;
    }
  },

  // ---------------------------------------------------------------------------
  // M6: MERCHANT PORTAL (9 MÀN HÌNH: M6-S01..S09 — FULL SIDEBAR PANEL SHELL)
  // ---------------------------------------------------------------------------
  'M6-S01': {
    id: 'M6-S01',
    module: 'M6 · Merchant Portal (Cổng Quán)',
    platform: 'desktop',
    title: 'Merchant Login & Verification Onboarding',
    subtitle: 'Đăng nhập & Đăng ký xác minh chủ quán cùng trợ lý Bếp AI',
    api: 'POST /v1/merchant/auth/login · POST /v1/merchant/claim',
    ac: ['Xác minh quán nhanh gọn, hỗ trợ quét thực đơn bằng AI OCR ngay khi đăng ký'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="bg-[#18181B] text-white rounded-3xl p-6 border border-[#27272A] grid grid-cols-1 md:grid-cols-12 gap-6 items-center text-xs shadow-xl">
          <div class="md:col-span-6 space-y-3">
            <span class="px-3 py-1 rounded-full bg-[#22C55E] text-white font-bold text-[10px] inline-flex items-center gap-1">${k.icon('sparkles', 'w-3 h-3')} Cổng Đối Tác Quán Ăn · M6-S01</span>
            <h2 class="text-2xl font-extrabold leading-tight">Đưa quán của bạn đến đúng thực khách đang thèm món</h2>
            <p class="text-gray-300">Tiếp cận hàng chục ngàn người dùng hỏi "Hôm nay ăn gì?" trong bán kính 3km quanh quán mỗi ngày.</p>
            <div class="flex items-center gap-3 pt-2">
              ${k.mascotSVG('bep', 'w-16 h-20')}
              <div class="p-3 rounded-2xl bg-white/10 text-[11px] text-gray-200">
                <b class="text-[#FBBF24] block">Bếp AI OCR tự động 100%</b>
                Chỉ cần chụp ảnh bảng giá tại quán, AI sẽ tự tách món và giá trong 5 giây!
              </div>
            </div>
          </div>
          <div class="md:col-span-6 bg-white text-[#0F172A] p-6 rounded-3xl space-y-3.5 shadow-xl">
            <h3 class="font-extrabold text-base">Đăng nhập Quản lý Quán (Merchant Portal)</h3>
            <div><label class="text-[11px] font-bold text-[#64748B]">Email / Số điện thoại chủ quán</label><input type="text" value="phophattai.bienhoa@gmail.com" class="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-bold mt-1" readonly /></div>
            <div><label class="text-[11px] font-bold text-[#64748B]">Mật khẩu</label><input type="password" value="••••••••••••" class="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-bold mt-1" readonly /></div>
            <button onclick="goScreen('M6-S02')" class="w-full py-3 rounded-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#0F172A] font-extrabold shadow-md">
              ✨ Vào Bảng Điều Khiển Quán (M6-S02) →
            </button>
          </div>
        </div>
      `;
    }
  },

  'M6-S02': {
    id: 'M6-S02',
    module: 'M6 · Merchant Portal (Cổng Quán)',
    platform: 'desktop',
    title: 'Merchant Overview Dashboard',
    subtitle: 'Tổng quan lượt hiển thị AI, lượt xem quán, chỉ đường, đặt món & doanh thu ước tính',
    api: 'GET /v1/merchant/overview',
    ac: ['Full Sidebar Management Panel + 4 KPI Cards + Biểu đồ chuyển đổi trực quan'],
    render: () => window.UI_KIT.merchantShell(
      'M6-S02',
      'Tổng Quan Hiệu Quả Quán Ăn',
      'Dữ liệu thời gian thực từ gợi ý Măm AI trong bán kính 3km quanh P. Bửu Long',
      [
        { label: 'Hiển thị trong Gợi ý AI', value: '48,652', delta: '+15.8%', icon: 'sparkles', bg: 'bg-[#FEF3C7] text-[#F59E0B]' },
        { label: 'Bấm Chỉ đường (Maps)', value: '1,248', delta: '+22.4%', icon: 'pin', bg: 'bg-[#DCFCE7] text-[#16A34A]' },
        { label: 'Click Đặt món (Grab/XanhSM)', value: '864', delta: '+18.1%', icon: 'utensils', bg: 'bg-[#DBEAFE] text-[#1D4ED8]' },
        { label: 'Cuộc gọi đặt trước', value: '195', delta: '+9.5%', icon: 'phone', bg: 'bg-[#FCE7F3] text-[#DB2777]' }
      ],
      `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div class="md:col-span-7 bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2 shadow-sm">
            <div class="flex justify-between items-center">
              <span class="font-extrabold">Biểu đồ Chuyển đổi Khách hàng 7 Ngày Qua (Chỉ đường & Đặt món)</span>
              ${window.UI_KIT.tagPill('+22.4% tuần này', 'green')}
            </div>
            ${window.UI_KIT.barChart([52, 64, 58, 79, 85, 96, 91], ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'], '#FBBF24', 5)}
            ${window.UI_KIT.donutChart('Chuyển đổi', '2,307', [
              { label: 'Chỉ đường Google Maps', pct: '54%', color: '#FBBF24' },
              { label: 'Đặt qua GrabFood / Shopee', pct: '26%', color: '#22C55E' },
              { label: 'Đặt qua Xanh SM Ngon', pct: '12%', color: '#3B82F6' },
              { label: 'Gọi điện đặt trước', pct: '8%', color: '#F97316' }
            ])}
          </div>
          <div class="md:col-span-5 bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-3 shadow-sm">
            <div class="font-extrabold">Top Món Được AI Gợi Ý Nhiều Nhất</div>
            <div class="flex items-center gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <img data-img="298" class="w-12 h-12 rounded-xl object-cover" />
              <div class="flex-1"><div class="font-extrabold">1. Phở bò tái nạm</div><div class="text-[10px] text-[#64748B]">28,400 hiển thị · 820 chỉ đường</div></div>
              <span class="font-extrabold text-[#D97736]">45.000đ</span>
            </div>
            <div class="flex items-center gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <img data-img="034" class="w-12 h-12 rounded-xl object-cover" />
              <div class="flex-1"><div class="font-extrabold">2. Phở bò đặc biệt</div><div class="text-[10px] text-[#64748B]">12,150 hiển thị · 310 chỉ đường</div></div>
              <span class="font-extrabold text-[#D97736]">60.000đ</span>
            </div>
            <div class="flex items-center gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <img data-img="310" class="w-12 h-12 rounded-xl object-cover" />
              <div class="flex-1"><div class="font-extrabold">3. Bún bò Huế gân</div><div class="text-[10px] text-[#64748B]">8,102 hiển thị · 118 chỉ đường</div></div>
              <span class="font-extrabold text-[#D97736]">50.000đ</span>
            </div>
          </div>
        </div>
      `
    )
  },

  'M6-S03': {
    id: 'M6-S03',
    module: 'M6 · Merchant Portal (Cổng Quán)',
    platform: 'desktop',
    title: 'Restaurant Profile & Opening Hours',
    subtitle: 'Quản lý thông tin quán, giờ mở cửa, tiện ích & liên kết ứng dụng giao hàng',
    api: 'PUT /v1/merchant/places/{id}',
    ac: ['Không bao giờ đề xuất quán đang đóng cửa như một lựa chọn đang mở'],
    render: () => window.UI_KIT.merchantShell(
      'M6-S03',
      'Hồ Sơ Quán & Giờ Hoạt Động',
      'Đồng bộ tức thì trạng thái Đang mở / Đóng cửa sang bộ máy gợi ý AI M3',
      [],
      `
        <div class="bg-white p-5 rounded-2xl border border-[#E2E8F0] grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-3">
            <div><label class="font-bold text-[#64748B]">Tên quán hiển thị</label><input type="text" value="Phở Gia Truyền Phát Tài" class="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-bold mt-1" readonly/></div>
            <div><label class="font-bold text-[#64748B]">Khung giờ mở cửa hằng ngày</label><input type="text" value="06:00 – 22:00 (Thứ 2 – Chủ Nhật)" class="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-bold mt-1" readonly/></div>
            <div class="flex flex-wrap gap-1.5 pt-1">
              ${window.UI_KIT.tagPill('✔ Có máy lạnh', 'blue')}
              ${window.UI_KIT.tagPill('✔ Đậu xe miễn phí', 'green')}
              ${window.UI_KIT.tagPill('✔ Ghế trẻ em', 'yellow')}
            </div>
          </div>
          <div class="space-y-3">
            <div><label class="font-bold text-[#64748B]">Deep-link GrabFood / ShopeeFood / Xanh SM Ngon</label><input type="text" value="https://food.grab.com/vn/vi/restaurant/pho-phat-tai" class="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] mt-1" readonly/></div>
            <button class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-sm mt-2">Lưu & Đồng bộ Hồ sơ Quán</button>
          </div>
        </div>
      `
    )
  },

  'M6-S04': {
    id: 'M6-S04',
    module: 'M6 · Merchant Portal (Cổng Quán)',
    platform: 'desktop',
    title: 'Branch Management',
    subtitle: 'Quản lý danh sách chi nhánh, tọa độ PostGIS và trạng thái đóng/mở từng cơ sở',
    api: 'GET /v1/merchant/branches',
    ac: ['Hỗ trợ chuỗi nhiều chi nhánh với menu và trạng thái mở cửa độc lập'],
    render: () => window.UI_KIT.merchantShell(
      'M6-S04',
      'Quản Lý Chuỗi Chi Nhánh (2 Cơ sở)',
      'Định vị chính xác từng chi nhánh trên bản đồ PostGIS bán kính 3km',
      [],
      `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white p-4 rounded-2xl border-2 border-[#22C55E] space-y-2">
            <div class="flex justify-between items-center"><b class="text-sm">Cơ sở 1: P. Bửu Long, Biên Hòa</b>${window.UI_KIT.tagPill('● Đang mở', 'green')}</div>
            <p class="text-[#64748B]">128 Huỳnh Văn Nghệ · 18 món đang phục vụ · 4.8★</p>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2">
            <div class="flex justify-between items-center"><b class="text-sm">Cơ sở 2: P. Tân Tiến, Biên Hòa</b>${window.UI_KIT.tagPill('● Đang mở', 'green')}</div>
            <p class="text-[#64748B]">45 Phạm Văn Thuận · 16 món đang phục vụ · 4.7★</p>
          </div>
        </div>
      `
    )
  },

  'M6-S05': {
    id: 'M6-S05',
    module: 'M6 · Merchant Portal (Cổng Quán)',
    platform: 'desktop',
    title: 'Structured Menu Management',
    subtitle: 'Quản lý thực đơn có cấu trúc, giá bán, tag dị ứng & trạng thái còn/hết món',
    api: 'GET /v1/merchant/menu · PATCH /v1/merchant/menu/{itemId}',
    ac: ['Bám sát mẫu Reztro Menu Grid (uid_105) kết hợp nhãn Pastel AI Chef'],
    render: () => window.UI_KIT.merchantShell(
      'M6-S05',
      'Quản Lý Thực Đơn & Giá Bán',
      'Mọi món ăn đều được ánh xạ chuẩn với Thư viện món M2 và kiểm tra dị ứng tự động',
      [],
      `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] space-y-2.5 shadow-sm">
            <img data-img="298" class="w-full h-32 rounded-xl object-cover" />
            <div class="flex gap-1">${window.UI_KIT.tagPill('Còn món', 'green')}${window.UI_KIT.tagPill('Dish #102', 'blue')}</div>
            <div class="flex justify-between items-baseline font-extrabold"><span class="text-sm">Phở bò tái nạm</span><span class="text-[#D97736]">45.000đ</span></div>
            <button class="w-full py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Chỉnh sửa giá / Tạm hết</button>
          </div>
          <div class="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] space-y-2.5 shadow-sm">
            <img data-img="034" class="w-full h-32 rounded-xl object-cover" />
            <div class="flex gap-1">${window.UI_KIT.tagPill('Còn món', 'green')}${window.UI_KIT.tagPill('Dish #105', 'blue')}</div>
            <div class="flex justify-between items-baseline font-extrabold"><span class="text-sm">Phở bò đặc biệt</span><span class="text-[#D97736]">60.000đ</span></div>
            <button class="w-full py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Chỉnh sửa giá / Tạm hết</button>
          </div>
          <div class="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] space-y-2.5 shadow-sm">
            <img data-img="310" class="w-full h-32 rounded-xl object-cover" />
            <div class="flex gap-1">${window.UI_KIT.tagPill('Đang chạy M7', 'orange')}${window.UI_KIT.tagPill('Dish #118', 'blue')}</div>
            <div class="flex justify-between items-baseline font-extrabold"><span class="text-sm">Bún bò Huế gân</span><span class="text-[#D97736]">50.000đ</span></div>
            <button class="w-full py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Chỉnh sửa giá / Tạm hết</button>
          </div>
        </div>
      `
    )
  },

  'M6-S06': {
    id: 'M6-S06',
    module: 'M6 · Merchant Portal (Cổng Quán)',
    platform: 'desktop',
    title: 'AI Menu OCR Scanner',
    subtitle: 'Upload ảnh chụp thực đơn giấy → AI Vision OCR tự tách tên món, giá bán & ghép Thư viện M2',
    api: 'POST /v1/merchant/menu/ocr',
    ac: ['Hiển thị khung quét OCR trực quan + độ tự tin AI + tự động gán tag dị ứng từ món gốc M2'],
    render: () => window.UI_KIT.merchantShell(
      'M6-S06',
      'AI Menu OCR — Bóc Tách Thực Đơn Tự Động',
      'Chụp ảnh bảng giá tại quán, LiteLLM Vision tự động chuyển thành thực đơn số trong 5 giây',
      [],
      `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div class="md:col-span-5 bg-[#18181B] p-3 rounded-2xl border-2 border-dashed border-[#FBBF24] relative">
            <img data-img="768" class="w-full h-56 rounded-xl object-cover" />
            <span class="absolute top-5 left-5 px-2.5 py-1 rounded-full bg-[#22C55E] text-white text-[10px] font-bold shadow">✨ AI Vision Bounding Boxes</span>
          </div>
          <div class="md:col-span-7 space-y-2.5">
            <div class="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] flex justify-between items-center shadow-sm">
              <div>
                <div class="flex items-center gap-2"><b>1. Phở bò tái nạm</b>${window.UI_KIT.tagPill('Khớp 99% · M2 #102', 'green')}</div>
                <div class="text-[10px] text-[#64748B] mt-0.5">Tự động kế thừa tag: Món nước · Không hải sản · 480 kcal</div>
              </div>
              <span class="font-extrabold text-sm text-[#D97736]">45.000đ</span>
            </div>
            <div class="bg-white p-3.5 rounded-2xl border border-[#E2E8F0] flex justify-between items-center shadow-sm">
              <div>
                <div class="flex items-center gap-2"><b>2. Phở bò đặc biệt</b>${window.UI_KIT.tagPill('Khớp 97% · M2 #105', 'green')}</div>
                <div class="text-[10px] text-[#64748B] mt-0.5">Tự động kế thừa tag: Giàu đạm · Không hải sản · 590 kcal</div>
              </div>
              <span class="font-extrabold text-sm text-[#D97736]">60.000đ</span>
            </div>
            <div class="bg-white p-3.5 rounded-2xl border border-[#FBBF24] flex justify-between items-center shadow-sm">
              <div>
                <div class="flex items-center gap-2"><b>3. Quẩy giòn ăn kèm</b>${window.UI_KIT.tagPill('Chờ duyệt M9-S05 (91%)', 'yellow')}</div>
                <div class="text-[10px] text-[#64748B] mt-0.5">Cảnh báo tự động: Có chứa Gluten / Bột mì</div>
              </div>
              <span class="font-extrabold text-sm text-[#D97736]">10.000đ</span>
            </div>
            <button onclick="goScreen('M6-S05')" class="w-full py-3 rounded-full bg-[#22C55E] text-white font-extrabold shadow-md">
              ✓ Xác nhận & Xuất bản 3 món vào Thực đơn Quán
            </button>
          </div>
        </div>
      `
    )
  },

  'M6-S07': {
    id: 'M6-S07',
    module: 'M6 · Merchant Portal (Cổng Quán)',
    platform: 'desktop',
    title: 'Daily Specials & Promotions',
    subtitle: 'Thiết lập "Món đặc biệt hôm nay" và ưu đãi khung giờ thấp điểm',
    api: 'POST /v1/merchant/promotions',
    ac: ['Đẩy tín hiệu Món đặc biệt hôm nay vào bộ máy gợi ý M3 trong bán kính 3km'],
    render: () => window.UI_KIT.merchantShell(
      'M6-S07',
      'Món Đặc Biệt Hôm Nay & Khuyến Mãi',
      'Tăng tỷ lệ người dùng chọn "Đi ăn" tại quán nhờ ưu đãi trực tiếp',
      [],
      `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white p-4 rounded-2xl border-2 border-[#FBBF24] flex gap-3.5 items-center shadow-sm">
            <img data-img="298" class="w-16 h-16 rounded-xl object-cover" />
            <div class="space-y-1">
              ${window.UI_KIT.tagPill('🔥 Món đặc biệt hôm nay', 'yellow')}
              <div class="font-extrabold text-sm">Phở Sườn Bò Hầm Mềm</div>
              <div class="text-[11px] text-[#15803D] font-bold">Tặng 1 đĩa quẩy giòn khung giờ 11:00 – 13:00</div>
            </div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] flex gap-3.5 items-center shadow-sm">
            <img data-img="304" class="w-16 h-16 rounded-xl object-cover" />
            <div class="space-y-1">
              ${window.UI_KIT.tagPill('Combo Gia đình 4 người', 'green')}
              <div class="font-extrabold text-sm">Giảm 15% tổng hóa đơn buổi tối</div>
              <div class="text-[11px] text-[#64748B]">Khớp tự động với truy vấn "4 người 300k" trên Măm AI</div>
            </div>
          </div>
        </div>
      `
    )
  },

  'M6-S08': {
    id: 'M6-S08',
    module: 'M6 · Merchant Portal (Cổng Quán)',
    platform: 'desktop',
    title: 'Merchant Performance Analytics',
    subtitle: 'Phân tích chi tiết lượt hiển thị, xem quán, chỉ đường, đặt món và gọi điện theo từng món',
    api: 'GET /v1/merchant/analytics',
    ac: ['Thống kê minh bạch hiệu quả chuyển đổi thực tế theo từng món trong menu'],
    render: () => window.UI_KIT.merchantShell(
      'M6-S08',
      'Báo Cáo Chuyển Đổi Chi Tiết Theo Món',
      'Theo dõi hành trình từ lúc món xuất hiện trên M3 Today Home đến lúc khách tới quán',
      [],
      `
        <div class="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
          <table class="w-full text-left">
            <thead class="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
              <tr><th class="p-3.5">Món ăn</th><th class="p-3.5">Hiển thị AI</th><th class="p-3.5">Chỉ đường (Maps)</th><th class="p-3.5">Đặt giao hàng</th><th class="p-3.5">Tỷ lệ CVR</th></tr>
            </thead>
            <tbody class="divide-y divide-[#F1F5F9]">
              <tr><td class="p-3.5 font-extrabold">Phở bò tái nạm (45k)</td><td class="p-3.5">28,400</td><td class="p-3.5 font-bold text-[#F59E0B]">820</td><td class="p-3.5">540</td><td class="p-3.5">${window.UI_KIT.tagPill('4.8% CVR', 'green')}</td></tr>
              <tr><td class="p-3.5 font-extrabold">Phở bò đặc biệt (60k)</td><td class="p-3.5">12,150</td><td class="p-3.5 font-bold text-[#F59E0B]">310</td><td class="p-3.5">215</td><td class="p-3.5">${window.UI_KIT.tagPill('4.3% CVR', 'green')}</td></tr>
              <tr><td class="p-3.5 font-extrabold">Bún bò Huế gân (50k)</td><td class="p-3.5">8,102</td><td class="p-3.5 font-bold text-[#F59E0B]">118</td><td class="p-3.5">109</td><td class="p-3.5">${window.UI_KIT.tagPill('2.8% CVR', 'yellow')}</td></tr>
            </tbody>
          </table>
        </div>
      `
    )
  },

  'M6-S09': {
    id: 'M6-S09',
    module: 'M6 · Merchant Portal (Cổng Quán)',
    platform: 'desktop',
    title: 'Staff & Role Management',
    subtitle: 'Phân quyền Chủ quán (Owner), Quản lý chi nhánh (Manager) và Thu ngân (Staff)',
    api: 'GET /v1/merchant/staff · POST /v1/merchant/staff',
    ac: ['Phân quyền rõ ràng: Nhân viên chỉ được báo Hết món, Chủ quán quản lý Quảng cáo & Thanh toán'],
    render: () => window.UI_KIT.merchantShell(
      'M6-S09',
      'Quản Lý Nhân Viên & Phân Quyền Quán',
      'Cấp quyền cập nhật tình trạng còn/hết món nhanh tại quầy thu ngân',
      [],
      `
        <div class="bg-white rounded-2xl p-4 border border-[#E2E8F0] space-y-3 shadow-sm">
          <div class="flex justify-between items-center p-3 rounded-xl bg-[#F8FAFC]">
            <div><b class="text-sm">Nguyễn Văn Tài (Chủ quán)</b><div class="text-[11px] text-[#64748B]">Toàn quyền quản lý thực đơn, chi nhánh & chiến dịch quảng bá M7</div></div>
            ${window.UI_KIT.tagPill('Owner', 'dark')}
          </div>
          <div class="flex justify-between items-center p-3 rounded-xl bg-[#F8FAFC]">
            <div><b class="text-sm">Trần Thị Mai (Thu ngân Cơ sở 1)</b><div class="text-[11px] text-[#64748B]">Quyền bật/tắt Hết món tạm thời (M4-S05) & nhận thông báo khách đặt trước</div></div>
            ${window.UI_KIT.tagPill('Staff', 'blue')}
          </div>
        </div>
      `
    )
  },

  // ---------------------------------------------------------------------------
  // M7: QUẢNG BÁ & CHIẾN DỊCH (8 MÀN HÌNH: M7-S01..S08 — SPONSORED LISTINGS PANEL)
  // ---------------------------------------------------------------------------
  'M7-S01': {
    id: 'M7-S01',
    module: 'M7 · Quảng bá & Chiến dịch',
    platform: 'desktop',
    title: 'Advertising Overview (ROAS & Sponsored Listings)',
    subtitle: 'Tổng quan hiệu quả quảng cáo ngữ cảnh AI: ROAS 7x, CTR, CPA (uid_697)',
    api: 'GET /v1/ads/overview',
    ac: ['Bám sát mẫu Sponsored Listings (uid_697)', 'Tuân thủ 3 quy tắc cứng: Nhãn Tài trợ, tối đa 1/3 slot, không vượt bộ lọc dị ứng'],
    render: () => window.UI_KIT.merchantShell(
      'M7-S01',
      'Tổng Quan Quảng Bá Món Ăn (Sponsored Listings)',
      'Đưa món ăn của quán vào đúng 1/3 slot Tài trợ khi thực khách quanh 3km đang tìm món hợp thời tiết',
      [
        { label: 'ROAS (Hiệu quả chi phí)', value: '7.0x', delta: 'Tốt', icon: 'flame', bg: 'bg-[#DCFCE7] text-[#16A34A]' },
        { label: 'Tỷ lệ Chuyển đổi (CVR)', value: '25.0%', delta: '+4.2%', icon: 'sparkles', bg: 'bg-[#FEF3C7] text-[#F59E0B]' },
        { label: 'Doanh thu từ Quảng cáo', value: '12.4tr', delta: '30 ngày', icon: 'chart', bg: 'bg-[#DBEAFE] text-[#1D4ED8]' },
        { label: 'Chi phí đã sử dụng', value: '1.75tr', delta: 'VietQR', icon: 'shield', bg: 'bg-[#FCE7F3] text-[#DB2777]' }
      ],
      `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div class="md:col-span-7 bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-3 shadow-sm">
            <div class="flex justify-between items-center">
              <span class="font-extrabold">Biểu đồ Tăng trưởng Lượt Hiển thị & Chuyển đổi Tài trợ</span>
              <button onclick="goScreen('M7-S03')" class="px-4 py-1.5 rounded-full bg-[#22C55E] text-white font-extrabold">+ Tạo Chiến dịch mới</button>
            </div>
            ${window.UI_KIT.lineChart('Impressions & Clicks theo Ngữ cảnh Thời tiết', 'ROAS 7.0x', '#22C55E')}
          </div>
          <div class="md:col-span-5 bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2 shadow-sm">
            <div class="font-extrabold">Hiệu suất theo Khung giờ Bữa ăn</div>
            ${window.UI_KIT.barChart([48, 92, 35, 88, 60, 95, 84], ['Sáng', 'Trưa', 'Chiều', 'Tối', 'Đêm', 'Mưa', 'Mát'], '#FBBF24', 1)}
          </div>
        </div>
      `
    )
  },

  'M7-S02': {
    id: 'M7-S02',
    module: 'M7 · Quảng bá & Chiến dịch',
    platform: 'desktop',
    title: 'Campaign List',
    subtitle: 'Danh sách các chiến dịch Đang chạy, Chờ duyệt M9-S07 và Đã hoàn tất',
    api: 'GET /v1/ads/campaigns',
    ac: ['Hiển thị minh bạch trạng thái duyệt và ngân sách từng chiến dịch'],
    render: () => window.UI_KIT.merchantShell(
      'M7-S02',
      'Danh Sách Chiến Dịch Quảng Bá',
      'Quản lý trạng thái hoạt động và hiệu suất từng món tài trợ',
      [],
      `
        <div class="space-y-3">
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] flex justify-between items-center shadow-sm">
            <div class="flex items-center gap-3.5">
              <img data-img="310" class="w-14 h-14 rounded-xl object-cover" />
              <div>
                <div class="flex items-center gap-2"><b class="text-sm">Bún bò Huế ngày mưa mát</b>${window.UI_KIT.tagPill('● Active', 'green')}</div>
                <div class="text-[11px] text-[#64748B] mt-0.5">Bán kính 3km · Khung giờ 10:30–13:30 & 17:00–20:00 · CTR 6.8%</div>
              </div>
            </div>
            <button onclick="goScreen('M7-S07')" class="px-3.5 py-2 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] font-bold">Xem Báo cáo →</button>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] flex justify-between items-center shadow-sm">
            <div class="flex items-center gap-3.5">
              <img data-img="298" class="w-14 h-14 rounded-xl object-cover" />
              <div>
                <div class="flex items-center gap-2"><b class="text-sm">Phở sáng nạp năng lượng</b>${window.UI_KIT.tagPill('⏳ Chờ duyệt M9-S07', 'yellow')}</div>
                <div class="text-[11px] text-[#64748B] mt-0.5">Bán kính 2km · Khung giờ 06:00–09:30</div>
              </div>
            </div>
            <button onclick="goScreen('M7-S06')" class="px-3.5 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Xem Preview</button>
          </div>
        </div>
      `
    )
  },

  'M7-S03': {
    id: 'M7-S03',
    module: 'M7 · Quảng bá & Chiến dịch',
    platform: 'desktop',
    title: 'Create Campaign (Step 1: Dish Selection)',
    subtitle: 'Chọn món ăn chủ lực từ thực đơn quán để đưa vào slot gợi ý Tài trợ',
    api: 'POST /v1/ads/campaigns (dish_id)',
    ac: ['Chỉ cho phép quảng bá món đã khai báo đầy đủ tag dị ứng để bảo vệ người dùng'],
    render: () => window.UI_KIT.merchantShell(
      'M7-S03',
      'Tạo Chiến Dịch — Bước 1: Chọn Món Quảng Bá',
      'Món được chọn phải thuộc thực đơn đã xác minh và còn hàng trong khung giờ chạy',
      [],
      `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white p-4 rounded-2xl border-2 border-[#FBBF24] flex items-center gap-3.5 shadow-sm">
            <img data-img="310" class="w-16 h-16 rounded-xl object-cover" />
            <div class="flex-1">
              ${window.UI_KIT.tagPill('✓ Đang chọn', 'yellow')}
              <div class="font-extrabold text-sm mt-1">Bún bò Huế O Xuân (50.000đ)</div>
              <div class="text-[10px] text-[#15803D] font-bold">✔ Đã kiểm tra an toàn tag dị ứng</div>
            </div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] flex items-center gap-3.5">
            <img data-img="298" class="w-16 h-16 rounded-xl object-cover" />
            <div class="flex-1">
              <div class="font-extrabold text-sm">Phở bò tái nạm (45.000đ)</div>
              <div class="text-[10px] text-[#64748B]">Khớp tốt với bữa sáng & trưa</div>
            </div>
          </div>
        </div>
        <button onclick="goScreen('M7-S04')" class="px-6 py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">
          Tiếp theo: Nhắm mục tiêu Thời tiết & Bán kính (M7-S04) →
        </button>
      `
    )
  },

  'M7-S04': {
    id: 'M7-S04',
    module: 'M7 · Quảng bá & Chiến dịch',
    platform: 'desktop',
    title: 'Context, Weather & Geo Targeting',
    subtitle: 'Nhắm mục tiêu theo Bán kính (1–5km), Khung giờ bữa ăn & Thời tiết thực tế',
    api: 'POST /v1/ads/campaigns (targeting)',
    ac: ['Nhắm đúng ngữ cảnh: Trời mát/mưa ưu tiên món nước nóng, trời nắng ưu tiên món thanh mát'],
    render: () => window.UI_KIT.merchantShell(
      'M7-S04',
      'Tạo Chiến Dịch — Bước 2: Nhắm Mục Tiêu Ngữ Cảnh AI',
      'Tối ưu tỷ lệ chuyển đổi bằng cách chỉ hiển thị khi thời tiết và giờ ăn phù hợp nhất',
      [],
      `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2">
            <div class="font-extrabold text-[#64748B]">1. Bán kính địa lý (PostGIS)</div>
            <div class="p-3 rounded-xl bg-[#FEF3C7] text-[#B45309] font-extrabold">📍 Trong vòng 3.0 km quanh quán</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2">
            <div class="font-extrabold text-[#64748B]">2. Khung giờ bữa ăn</div>
            <div class="p-3 rounded-xl bg-[#DCFCE7] text-[#15803D] font-extrabold">☀️ Bữa trưa (10:30–13:30) & Tối</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2">
            <div class="font-extrabold text-[#64748B]">3. Ngữ cảnh thời tiết</div>
            <div class="p-3 rounded-xl bg-[#DBEAFE] text-[#1D4ED8] font-extrabold">🌧️ Trời mát / Mưa (&lt; 29°C)</div>
          </div>
        </div>
        <button onclick="goScreen('M7-S05')" class="px-6 py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">
          Tiếp theo: Thiết lập Ngân sách & Lịch chạy (M7-S05) →
        </button>
      `
    )
  },

  'M7-S05': {
    id: 'M7-S05',
    module: 'M7 · Quảng bá & Chiến dịch',
    platform: 'desktop',
    title: 'Budget & Schedule Setup',
    subtitle: 'Chọn gói tài trợ theo tháng (MVP) hoặc ngân sách CPC/CPA theo ngày',
    api: 'POST /v1/ads/campaigns (budget)',
    ac: ['Minh bạch chi phí và ước tính số lượt hiển thị / hành động'],
    render: () => window.UI_KIT.merchantShell(
      'M7-S05',
      'Tạo Chiến Dịch — Bước 3: Ngân Sách & Lịch Chạy',
      'Linh hoạt giữa gói cố định hằng tháng hoặc tính phí theo lượt chuyển đổi thực tế',
      [],
      `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white p-5 rounded-2xl border-2 border-[#FBBF24] space-y-2 shadow-sm">
            ${window.UI_KIT.tagPill('Gói MVP Khuyên dùng', 'yellow')}
            <div class="text-lg font-extrabold">Gói Ngữ Cảnh 30 Ngày · 1.500.000đ</div>
            <p class="text-[#64748B]">Cam kết tối thiểu 15.000 lượt hiển thị đúng khách hàng mục tiêu trong bán kính 3km.</p>
          </div>
          <div class="bg-white p-5 rounded-2xl border border-[#E2E8F0] space-y-2">
            ${window.UI_KIT.tagPill('Giai đoạn mở rộng (CPA)', 'blue')}
            <div class="text-lg font-extrabold">Theo Lượt Chuyển Đổi · 50.000đ / ngày</div>
            <p class="text-[#64748B]">Chỉ tính phí khi người dùng bấm Chỉ đường hoặc Đặt món.</p>
          </div>
        </div>
        <button onclick="goScreen('M7-S06')" class="px-6 py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">
          Xem trước Thẻ Tài Trợ trên App (M7-S06) →
        </button>
      `
    )
  },

  'M7-S06': {
    id: 'M7-S06',
    module: 'M7 · Quảng bá & Chiến dịch',
    platform: 'desktop',
    title: 'Campaign Preview & Hard-Filter Compliance',
    subtitle: 'Xem trước thẻ món gắn nhãn Tài trợ & kiểm chứng 3 quy tắc bảo vệ người dùng',
    api: 'POST /v1/ads/campaigns/preview',
    ac: ['Nhãn Tài trợ rõ ràng, tối đa 1/3 slot, không bao giờ vượt qua bộ lọc cứng về dị ứng'],
    render: () => window.UI_KIT.merchantShell(
      'M7-S06',
      'Xem Trước Thẻ Tài Trợ & Quy Tắc Bảo Vệ Người Dùng',
      'Hiển thị chính xác cách món ăn xuất hiện tại vị trí số 3/3 trên màn hình M3-S01 Today Home',
      [],
      `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div class="md:col-span-6 bg-white p-4 rounded-2xl border-2 border-[#FBBF24] flex items-center gap-3.5 shadow-md">
            <img data-img="310" class="w-16 h-16 rounded-xl object-cover" />
            <div class="flex-1">
              <div class="flex items-center gap-1.5"><b class="text-sm">Bún Bò Huế O Xuân</b>${window.UI_KIT.tagPill('Tài trợ', 'orange')}</div>
              <div class="text-[11px] text-[#64748B] mt-0.5">Cách 650m · Đang mở · Hợp khẩu vị cay nhẹ</div>
              <div class="font-extrabold text-[#D97736] mt-0.5">50.000đ</div>
            </div>
          </div>
          <div class="md:col-span-6 space-y-3">
            ${window.UI_KIT.mascotTip('la', '3 Quy tắc Bắt buộc (Hard Rules)', '1. Luôn hiển thị nhãn Tài trợ rõ ràng. 2. Tối đa 1/3 slot gợi ý. 3. Tuyệt đối không vượt qua bộ lọc dị ứng/ăn chay của người dùng!', 'bg-[#DCFCE7] border-[#BBF7D0]')}
            <button onclick="goScreen('M7-S08')" class="w-full py-3 rounded-full bg-[#22C55E] text-white font-extrabold shadow-md">
              Thanh toán VietQR & Gửi duyệt Chiến dịch (M7-S08) →
            </button>
          </div>
        </div>
      `
    )
  },

  'M7-S07': {
    id: 'M7-S07',
    module: 'M7 · Quảng bá & Chiến dịch',
    platform: 'desktop',
    title: 'Campaign Analytics & Click-Fraud Protection',
    subtitle: 'Báo cáo Impression, CTR, CPA & Hệ thống chống click bất thường tự động',
    api: 'GET /v1/ads/campaigns/{id}/analytics',
    ac: ['Tự động hoàn tiền / không tính phí các lượt click trùng lặp bất thường'],
    render: () => window.UI_KIT.merchantShell(
      'M7-S07',
      'Phân Tích Hiệu Quả Chiến Dịch & Chống Click Ảo',
      'Báo cáo minh bạch từng lượt hiển thị đến hành động thực tế của khách hàng',
      [
        { label: 'Impressions', value: '18,420', delta: '+12%', icon: 'sparkles', bg: 'bg-[#FEF3C7] text-[#F59E0B]' },
        { label: 'Tỷ lệ Click (CTR)', value: '6.8%', delta: 'Cao', icon: 'chart', bg: 'bg-[#DCFCE7] text-[#16A34A]' },
        { label: 'Chuyển đổi (Đặt/Maps)', value: '412', delta: '3.600đ/action', icon: 'pin', bg: 'bg-[#DBEAFE] text-[#1D4ED8]' },
        { label: 'Click ảo đã loại trừ', value: '34', delta: 'Miễn phí', icon: 'shield', bg: 'bg-[#FFE4E6] text-[#BE123C]' }
      ],
      `<div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] text-[#64748B]">Hệ thống Anti-Fraud tự động lọc các truy cập lặp lại trong 60 giây từ cùng một thiết bị/IP.</div>`
    )
  },

  'M7-S08': {
    id: 'M7-S08',
    module: 'M7 · Quảng bá & Chiến dịch',
    platform: 'desktop',
    title: 'VietQR Payment & Billing History',
    subtitle: 'Thanh toán chiến dịch tự động qua mã VietQR Napas 247 & lịch sử hóa đơn',
    api: 'POST /v1/ads/payments/vietqr',
    ac: ['Xác nhận thanh toán tự động qua webhook ngân hàng trong 5 giây'],
    render: () => window.UI_KIT.merchantShell(
      'M7-S08',
      'Thanh Toán VietQR & Lịch Sử Giao Dịch',
      'Quét mã QR bằng bất kỳ ứng dụng Ngân hàng hoặc MoMo/ZaloPay để kích hoạt ngay',
      [],
      `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div class="md:col-span-5 bg-white p-5 rounded-2xl border border-[#E2E8F0] text-center space-y-2 shadow-sm">
            <div class="font-extrabold text-sm">Mã VietQR Tự Động</div>
            <div class="w-36 h-36 mx-auto rounded-2xl bg-[#18181B] text-white flex flex-col items-center justify-center font-mono text-[10px] p-3 shadow-inner">
              <span class="text-[#FBBF24] font-bold">[VIETQR NAPAS]</span>
              <span class="text-[#4ADE80] font-extrabold text-xs mt-1">1.500.000đ</span>
              <span class="text-gray-400 mt-1">TOV ADS 1024</span>
            </div>
            ${window.UI_KIT.tagPill('● Tự động gạch nợ sau 5 giây', 'green')}
          </div>
          <div class="md:col-span-7 bg-white p-5 rounded-2xl border border-[#E2E8F0] space-y-3 shadow-sm">
            <div class="font-extrabold text-sm">Lịch sử Hóa đơn Quảng bá</div>
            <div class="flex justify-between items-center py-2 border-b border-[#F1F5F9]"><span>#TOV-2026-11 · Gói 30 ngày Bún bò Huế</span>${window.UI_KIT.tagPill('1.500.000đ · Đã TT', 'green')}</div>
            <div class="flex justify-between items-center py-2"><span>#TOV-2026-10 · Gói Khai trương Cơ sở 2</span>${window.UI_KIT.tagPill('1.000.000đ · Đã TT', 'green')}</div>
          </div>
        </div>
      `
    )
  }
};
