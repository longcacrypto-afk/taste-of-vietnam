// =============================================================================
// MODULE M3 (7 SCREENS), MODULE M4 (6 SCREENS), MODULE M5 (5 SCREENS), MODULE M8 (4 SCREENS)
// =============================================================================

window.SCREENS_M3_M4_M5_M8 = {
  // ---------------------------------------------------------------------------
  // M3: GỢI Ý AI HẰNG NGÀY — CORE MODULE (7 MÀN HÌNH: M3-S01..S07)
  // ---------------------------------------------------------------------------
  'M3-S01': {
    id: 'M3-S01',
    module: 'M3 · Gợi ý AI Hằng ngày (Core)',
    platform: 'mobile',
    title: 'Today Home (3 Món Gợi Ý AI)',
    subtitle: 'Màn hình trung tâm kết hợp GenUI Section 3.1 & Section 4.2 trên ChatGPT',
    api: 'GET /v1/suggestions/today · GET /v1/me/profile',
    ac: [
      'Tải 3 gợi ý p95 < 1.5s',
      'Tuyệt đối không đề xuất món vi phạm dị ứng cứng',
      'Tối đa 1/3 slot Tài trợ có nhãn rõ ràng',
      'Hỗ trợ đủ 10 trạng thái (Initial, Loading, Success, Empty, Error, Offline, No location, No restaurants, Sponsored, Refreshing)'
    ],
    render: () => {
      const st = window.appState.m3State || 'success';
      const k = window.UI_KIT;
      if (st === 'initial') {
        return `
          <div class="p-4 space-y-4 bg-white text-[#0F172A] text-xs text-center">
            ${k.mascotTip('mam', 'State: Initial · Chào mừng lần đầu!', 'Măm đang đọc hồ sơ khẩu vị vừa thiết lập của anh để chuẩn bị 3 gợi ý đầu tiên...')}
            <div class="p-6 rounded-3xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <div class="w-10 h-10 rounded-full border-4 border-[#FBBF24] border-t-transparent animate-spin mx-auto"></div>
              <div class="font-extrabold">Đang khởi tạo bộ máy gợi ý AI...</div>
              <div class="text-[10px] text-[#64748B]">Đồng bộ thời tiết Biên Hòa 26°C & bán kính 3km</div>
            </div>
            <button onclick="setM3State('success')" class="w-full py-2.5 rounded-full bg-[#FBBF24] font-extrabold">Chuyển sang Success →</button>
          </div>
        `;
      }
      if (st === 'loading') {
        return `
          <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
            <div class="flex justify-between items-center">
              ${k.tagPill('⏳ State: Loading Skeleton (p95 < 1.5s)', 'yellow')}
              <button onclick="setM3State('success')" class="underline font-bold">Xem Success</button>
            </div>
            <div class="h-36 rounded-3xl bg-[#F1F5F9] animate-pulse"></div>
            <div class="grid grid-cols-5 gap-2"><div class="h-12 rounded-full bg-[#F1F5F9] animate-pulse"></div><div class="h-12 rounded-full bg-[#F1F5F9] animate-pulse"></div><div class="h-12 rounded-full bg-[#F1F5F9] animate-pulse"></div><div class="h-12 rounded-full bg-[#F1F5F9] animate-pulse"></div><div class="h-12 rounded-full bg-[#F1F5F9] animate-pulse"></div></div>
            <div class="grid grid-cols-2 gap-3"><div class="h-32 rounded-2xl bg-[#F1F5F9] animate-pulse"></div><div class="h-32 rounded-2xl bg-[#F1F5F9] animate-pulse"></div></div>
            <div class="h-20 rounded-2xl bg-[#F1F5F9] animate-pulse"></div>
          </div>
        `;
      }
      if (st === 'refreshing') {
        return `
          <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
            <div class="p-3 rounded-2xl bg-[#FEF3C7] text-[#B45309] font-extrabold flex items-center justify-between">
              <span>🔄 State: Refreshing · Đang đổi 3 món mới...</span>
              <button onclick="setM3State('success')" class="underline">Xong</button>
            </div>
            <div class="opacity-50 pointer-events-none space-y-3">
              <div class="h-32 rounded-3xl bg-[#18181B]"></div>
              <div class="grid grid-cols-2 gap-3"><div class="h-28 rounded-2xl bg-[#F1F5F9]"></div><div class="h-28 rounded-2xl bg-[#F1F5F9]"></div></div>
            </div>
          </div>
        `;
      }
      if (st === 'empty') {
        return `
          <div class="p-4 space-y-4 bg-white text-[#0F172A] text-center text-xs">
            <div class="flex justify-center">${k.mascotSVG('miu', 'w-24 h-28')}</div>
            ${k.tagPill('State: Empty · Mascot Miu hỗ trợ', 'yellow')}
            <h3 class="text-base font-extrabold">Chưa có món phù hợp bộ lọc hiện tại</h3>
            <p class="text-[#64748B]">Do ngân sách &lt;25k và bán kính 300m đang quá hẹp. Miu giúp anh nới bán kính lên 3km nhé?</p>
            <button onclick="setM3State('success')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">Nới bộ lọc & Xem 3 món gợi ý</button>
          </div>
        `;
      }
      if (st === 'offline') {
        return `
          <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
            <div class="p-3 rounded-2xl bg-[#FEF3C7] border border-[#F59E0B] flex items-center justify-between">
              <div><b class="text-[#B45309]">📡 State: Offline Cache</b><div class="text-[10px] text-[#B45309]">Mất kết nối mạng — Đang hiển thị 3 món & công thức lưu trong máy.</div></div>
              <button onclick="setM3State('success')" class="px-2.5 py-1 rounded-lg bg-[#18181B] text-white font-bold">Kết nối lại</button>
            </div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3">
              <img data-img="298" class="w-14 h-14 rounded-xl object-cover" />
              <div><b>Phở bò tái nạm (Đã lưu Offline)</b><div class="text-[10px] text-[#64748B]">Xem công thức tự nấu không cần mạng</div></div>
            </div>
          </div>
        `;
      }
      if (st === 'noloc') {
        return `
          <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
            ${k.mascotTip('miu', 'State: No Location (Chưa bật GPS)', 'Anh vẫn xem được gợi ý món & công thức, hoặc chọn Phường/Xã thủ công bên dưới!')}
            <button onclick="goScreen('M1-S08')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">📍 Chọn khu vực thủ công (Biên Hòa / Quy Nhơn)</button>
            <button onclick="setM3State('success')" class="w-full py-2.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] font-bold">Xem gợi ý mặc định</button>
          </div>
        `;
      }
      if (st === 'norest') {
        return `
          <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
            ${k.mascotTip('bep', 'State: No Restaurants (Partial Data)', 'Chưa có quán mở cửa trong 1km lúc 23:30 đêm, nhưng Bếp có sẵn 3 công thức nấu nhanh 15 phút tại nhà!')}
            <div class="grid grid-cols-2 gap-2">
              <button onclick="setM3State('success')" class="py-2.5 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Tăng bán kính lên 5km</button>
              <button onclick="goScreen('M2-S04')" class="py-2.5 rounded-full bg-[#18181B] text-white font-extrabold">Xem công thức tự nấu</button>
            </div>
          </div>
        `;
      }
      if (st === 'unauth') {
        return `
          <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs text-center">
            <div class="flex justify-center">${k.mascotSVG('mam', 'w-20 h-24')}</div>
            ${k.tagPill('State: Unauthorized / Guest Prompt', 'purple')}
            <h3 class="text-base font-extrabold">Đăng nhập để lưu Bộ sưu tập & الدị ứng</h3>
            <p class="text-[#64748B]">Bạn đang dùng chế độ Khách. Đăng nhập bằng OTP trong 10 giây để đồng bộ khẩu vị trên mọi thiết bị!</p>
            <button onclick="goScreen('M1-S01')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">Đăng nhập ngay (M1-S01) →</button>
          </div>
        `;
      }
      if (st === 'error') {
        return `
          <div class="p-4 space-y-4 bg-white text-[#0F172A] text-center text-xs">
            <div class="w-16 h-16 rounded-2xl bg-[#FFE4E6] text-[#BE123C] mx-auto flex items-center justify-center text-2xl font-bold">!</div>
            <h3 class="text-base font-extrabold">State: Error · Không thể tải gợi ý mới</h3>
            <p class="text-[#64748B]">Kết nối máy chủ AI bị gián đoạn tạm thời (ERR_TIMEOUT). Vui lòng thử lại.</p>
            <button onclick="setM3State('success')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Thử lại ngay (Retry)</button>
          </div>
        `;
      }
      return `
        <div class="p-4 space-y-4 bg-white text-[#0F172A]">
          <!-- Top Header: Greeting + Chef Hat Icon + Avatar & Notification Bell (Benchmark Screen 1) -->
          <div class="flex items-start justify-between">
            <div>
              <div class="text-xs font-medium text-[#64748B]">Chào buổi sáng,</div>
              <div class="text-lg font-extrabold text-[#0F172A] flex items-center gap-1.5 mt-0.5">
                <span>Anh Long</span>
                <span class="text-[#0F172A]">${window.UI_KIT.icon('chefHat', 'w-5 h-5')}</span>
              </div>
              <div class="text-[11px] text-[#64748B] mt-0.5">Hôm nay anh muốn ăn hay nấu món gì?</div>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="goScreen('M1-S09')" class="w-9 h-9 rounded-full overflow-hidden border-2 border-[#FBBF24] shadow-sm">
                <img data-img="402" class="w-full h-full object-cover" />
              </button>
              <button onclick="goScreen('M8-S01')" class="w-9 h-9 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#334155] relative">
                ${window.UI_KIT.icon('bell', 'w-4 h-4')}
                <span class="w-2 h-2 rounded-full bg-[#EF4444] absolute top-1.5 right-1.5"></span>
              </button>
            </div>
          </div>

          <!-- Search Bar with Filter Sliders Icon -->
          <div onclick="goScreen('M2-S02')" class="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B] cursor-pointer">
            <div class="flex items-center gap-2">
              ${window.UI_KIT.icon('search', 'w-4 h-4 text-[#64748B]')}
              <span>Tìm món ăn, nguyên liệu, quán ngon...</span>
            </div>
            <span class="text-[#334155]">${window.UI_KIT.icon('sliders', 'w-4 h-4')}</span>
          </div>

          <!-- Dark Charcoal AI Hero Card with Emerald Badge, Golden CTA, Circular Food Bowl & 3D Mascot (Benchmark Screen 1) -->
          <div class="rounded-3xl bg-[#18181B] text-white p-4 relative overflow-hidden shadow-xl min-h-[176px] flex flex-col justify-between">
            <div class="relative z-10 space-y-2 max-w-[195px]">
              <span class="px-2.5 py-1 rounded-full bg-[#22C55E] text-white text-[10px] font-bold inline-flex items-center gap-1 shadow-sm">
                ${window.UI_KIT.icon('sparkles', 'w-3 h-3')}
                <span>AI Powered</span>
              </span>
              <h3 class="text-base font-extrabold leading-tight">Măm AI Gợi Ý Bữa Ngon Hoàn Hảo</h3>
              <p class="text-[10px] text-gray-300 leading-relaxed">Cho Măm biết nguyên liệu sẵn có hoặc khám phá 3 món ngon quanh bạn!</p>
              <div class="pt-1">
                <button onclick="goScreen('M3-S04')" class="px-4 py-2 rounded-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#0F172A] text-[11px] font-extrabold inline-flex items-center gap-1 shadow-md transition">
                  <span>Thử Măm AI Chef</span>
                  ${window.UI_KIT.icon('arrowRight', 'w-3.5 h-3.5')}
                </button>
              </div>
            </div>

            <!-- Top-right Circular Food Bowl -->
            <img data-img="034" class="w-28 h-28 rounded-full object-cover border-4 border-[#27272A] shadow-2xl absolute -top-2 -right-2" />

            <!-- Bottom-right Die-cut 3D Mascot with Sparkles -->
            <div onclick="goScreen('M3-S04')" class="absolute -bottom-1 right-1 z-10 cursor-pointer hover:scale-105 transition">
              ${window.UI_KIT.mascotSVG('mam', 'w-20 h-20')}
            </div>
          </div>

          <!-- 5 Pastel Circular Category Icons Row (Breakfast, Lunch, Dinner, Snacks, Desserts) -->
          ${window.UI_KIT.categoryRow()}

          <!-- Popular / Today AI Recommendations (2-Column Photo Cards + Sponsored Slot) -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <h4 class="font-extrabold text-sm text-[#0F172A]">Gợi ý Hôm nay (3 món AI)</h4>
              <button onclick="goScreen('M2-S01')" class="text-[11px] font-bold text-[#64748B] flex items-center gap-0.5 hover:text-[#0F172A]">
                <span>Xem tất cả</span>
                ${window.UI_KIT.icon('arrowRight', 'w-3 h-3')}
              </button>
            </div>

            <div class="grid grid-cols-2 gap-3 text-xs">
              ${(() => {
                const liveItems = (window.appState.liveToday && window.appState.liveToday.items) || [];
                const c1 = liveItems[0] || { dish_id: 'DISH-101', dish_name: 'Phở Bò Tái Nạm', ref_price: 45000, calories: 480 };
                const c2 = liveItems[1] || { dish_id: 'DISH-102', dish_name: 'Cơm Tấm Sườn Bì', ref_price: 40000, calories: 580 };
                return `
                  <!-- Card 1 -->
                  <div class="bg-white rounded-2xl p-2 border border-[#F1F5F9] shadow-sm space-y-2 group">
                    <div onclick="goScreen('M2-S04')" class="relative h-24 rounded-xl overflow-hidden cursor-pointer">
                      <img data-img="298" class="w-full h-full object-cover group-hover:scale-105 transition" />
                      <span class="w-6 h-6 rounded-full bg-white/90 text-[#0F172A] flex items-center justify-center absolute top-1.5 right-1.5 shadow">
                        ${window.UI_KIT.icon('heart', 'w-3.5 h-3.5')}
                      </span>
                    </div>
                    <div class="px-1 space-y-1">
                      <div onclick="goScreen('M2-S04')" class="font-extrabold text-xs text-[#0F172A] truncate cursor-pointer">${c1.dish_name}</div>
                      <div class="flex items-center justify-between text-[10px] text-[#64748B]">
                        <span class="inline-flex items-center gap-1">${window.UI_KIT.icon('clock', 'w-3 h-3')} ${c1.calories || 480} kcal</span>
                        <span class="font-extrabold text-[#D97736]">${Number(c1.ref_price || 45000).toLocaleString('vi-VN')}đ</span>
                      </div>
                      <button onclick="window.LIVE_APP && LIVE_APP.markDishEaten('${c1.dish_id}','${(c1.dish_name||'').replace(/'/g,'')}')" class="w-full py-1 rounded-lg bg-[#FEF3C7] text-[#B45309] text-[10px] font-extrabold hover:bg-[#FBBF24] hover:text-[#0F172A]">✅ Đã ăn</button>
                    </div>
                  </div>

                  <!-- Card 2 -->
                  <div class="bg-white rounded-2xl p-2 border border-[#F1F5F9] shadow-sm space-y-2 group">
                    <div onclick="goScreen('M2-S04')" class="relative h-24 rounded-xl overflow-hidden cursor-pointer">
                      <img data-img="304" class="w-full h-full object-cover group-hover:scale-105 transition" />
                      <span class="w-6 h-6 rounded-full bg-white/90 text-[#0F172A] flex items-center justify-center absolute top-1.5 right-1.5 shadow">
                        ${window.UI_KIT.icon('heart', 'w-3.5 h-3.5')}
                      </span>
                    </div>
                    <div class="px-1 space-y-1">
                      <div onclick="goScreen('M2-S04')" class="font-extrabold text-xs text-[#0F172A] truncate cursor-pointer">${c2.dish_name}</div>
                      <div class="flex items-center justify-between text-[10px] text-[#64748B]">
                        <span class="inline-flex items-center gap-1">${window.UI_KIT.icon('clock', 'w-3 h-3')} ${c2.calories || 580} kcal</span>
                        <span class="font-extrabold text-[#D97736]">${Number(c2.ref_price || 40000).toLocaleString('vi-VN')}đ</span>
                      </div>
                      <button onclick="window.LIVE_APP && LIVE_APP.markDishEaten('${c2.dish_id}','${(c2.dish_name||'').replace(/'/g,'')}')" class="w-full py-1 rounded-lg bg-[#FEF3C7] text-[#B45309] text-[10px] font-extrabold hover:bg-[#FBBF24] hover:text-[#0F172A]">✅ Đã ăn</button>
                    </div>
                  </div>
                `;
              })()}
            </div>

            <!-- Card 3: Sponsored 1/3 Slot Horizontal Card -->
            ${(() => {
              const liveItems = (window.appState.liveToday && window.appState.liveToday.items) || [];
              const c3 = liveItems[2] || { dish_id: 'DISH-103', dish_name: 'Bún Bò Huế O Xuân', ref_price: 50000, is_sponsored: true, reason: 'Cách 650m · Đang mở · Hợp khẩu vị cay nhẹ' };
              return `
                <div onclick="goScreen('M4-S03')" class="bg-[#F8FAFC] rounded-2xl p-2.5 border border-[#E2E8F0] flex items-center gap-3 cursor-pointer hover:border-[#FBBF24] transition">
                  <img data-img="310" class="w-14 h-14 rounded-xl object-cover shrink-0" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-extrabold text-xs text-[#0F172A] truncate">${c3.dish_name}</span>
                      ${c3.is_sponsored !== false ? window.UI_KIT.tagPill('Tài trợ', 'orange') : ''}
                    </div>
                    <div class="text-[10px] text-[#64748B] mt-0.5 truncate">${c3.reason || 'Cách 650m · Đang mở · Hợp khẩu vị cay nhẹ'}</div>
                    <div class="text-xs font-extrabold text-[#D97736] mt-0.5">${Number(c3.ref_price || 50000).toLocaleString('vi-VN')}đ</div>
                  </div>
                  <span class="text-[#64748B]">${window.UI_KIT.icon('arrowRight', 'w-4 h-4')}</span>
                </div>
              `;
            })()}
          </div>
        </div>
      `;
    }
  },

  'M3-S02': {
    id: 'M3-S02',
    module: 'M3 · Gợi ý AI Hằng ngày (Core)',
    platform: 'mobile',
    title: 'Dish Recommendation Detail',
    subtitle: 'Giải thích lý do Măm AI chọn món này hôm nay & nút Đi ăn / Tự nấu',
    api: 'GET /v1/suggestions/{id}/explain',
    ac: ['Giải thích minh bạch 4 yếu tố: Thời tiết, Khẩu vị, Ngân sách, Khoảng cách quán'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Chi Tiết Gợi Ý AI', 'M3-S02 · Vì sao Măm chọn món này?', 'M3-S01')}
          ${k.mascotTip('mam', 'Độ khớp khẩu vị: 98%!', 'Trời Biên Hòa đang mát 26°C, một tô Phở bò nóng cách 400m rất hợp ngân sách 45.000đ của anh.')}

          <div class="bg-[#F8FAFC] rounded-3xl p-3.5 border border-[#E2E8F0] space-y-2.5">
            <img data-img="298" class="w-full h-32 rounded-2xl object-cover" />
            <div class="flex justify-between items-baseline"><b class="text-sm">Phở Bò Tái Nạm Hà Nội</b><b class="text-sm text-[#D97736]">45.000đ</b></div>
            <div class="flex flex-wrap gap-1.5">
              ${k.tagPill('🌧️ Hợp trời 26°C', 'blue')}
              ${k.tagPill('📍 Cách 400m', 'green')}
              ${k.tagPill('🚫 0% Hải sản', 'mint')}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button onclick="goScreen('M4-S03')" class="py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-sm">🛵 Đi ăn (400m)</button>
            <button onclick="goScreen('M2-S04')" class="py-3 rounded-full bg-[#18181B] text-white font-extrabold shadow-sm">👩‍🍳 Tự nấu (25p)</button>
          </div>
        </div>
      `;
    }
  },

  'M3-S03': {
    id: 'M3-S03',
    module: 'M3 · Gợi ý AI Hằng ngày (Core)',
    platform: 'mobile',
    title: 'Spin to Choose (Vòng Quay Món)',
    subtitle: 'Quay ngẫu nhiên các món vượt qua bộ lọc khẩu vị & chưa ăn 3 ngày qua',
    api: 'GET /v1/suggestions/spin',
    ac: ['Bám sát mẫu Lucky Wheel (uid_342)', 'Loại trừ món vi phạm dị ứng và món đã ăn gần đây'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 text-center space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Lucky Food Spin · Vòng Quay Ẩm Thực', 'M3-S03 · Đã lọc 100% dị ứng & Cooldown 3 ngày', 'M3-S01')}

          <!-- Hard Allergy Guard Badge -->
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px]">
            <span>🛡️</span>
            <span>Bộ lọc AI: 0% Dị ứng · 0% Lặp món 3 ngày qua</span>
          </div>

          <!-- Luxury 8-Segment 3D Spin Wheel -->
          <div class="relative w-64 h-64 mx-auto my-2">
            <!-- Top Pointer Indicator (12 o'clock downward arrow with golden gradient & ruby gem) -->
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 z-30 filter drop-shadow-md">
              <svg width="24" height="28" viewBox="0 0 24 28">
                <polygon points="12,28 0,0 24,0" fill="#FBBF24" stroke="#B45309" stroke-width="1.5"/>
                <circle cx="12" cy="7" r="3" fill="#EF4444"/>
              </svg>
            </div>

            <!-- Outer Metallic Golden Bezel with Glow -->
            <div class="absolute inset-0 rounded-full border-4 border-[#FBBF24] shadow-[0_0_25px_rgba(251,191,36,0.35)] pointer-events-none z-10"></div>

            <svg id="m3-wheel-svg" viewBox="0 0 200 200" class="w-full h-full rounded-full transition-transform duration-[4500ms] ease-out shadow-2xl">
              <!-- Outer Decorative Metallic Ring -->
              <circle cx="100" cy="100" r="98" fill="#18181B" stroke="#F59E0B" stroke-width="3"/>

              <!-- 8 Radial Segments (45 deg each) -->
              <!-- 1. Phở Bò (315° - 360°) -->
              <path d="M100,100 L163.64,36.36 A90,90 0 0,1 190,100 Z" fill="#F59E0B"/>
              <!-- 2. Cơm Tấm (0° - 45°) -->
              <path d="M100,100 L190,100 A90,90 0 0,1 163.64,163.64 Z" fill="#10B981"/>
              <!-- 3. Bún Bò (45° - 90°) -->
              <path d="M100,100 L163.64,163.64 A90,90 0 0,1 100,190 Z" fill="#EF4444"/>
              <!-- 4. Gỏi Cuốn (90° - 135°) -->
              <path d="M100,100 L100,190 A90,90 0 0,1 36.36,163.64 Z" fill="#06B6D4"/>
              <!-- 5. Bánh Mì (135° - 180°) -->
              <path d="M100,100 L36.36,163.64 A90,90 0 0,1 10,100 Z" fill="#8B5CF6"/>
              <!-- 6. Cá Lóc Kho (180° - 225°) -->
              <path d="M100,100 L10,100 A90,90 0 0,1 36.36,36.36 Z" fill="#F97316"/>
              <!-- 7. Bún Chả (225° - 270°) -->
              <path d="M100,100 L36.36,36.36 A90,90 0 0,1 100,10 Z" fill="#EC4899"/>
              <!-- 8. Cháo Sườn (270° - 315°) -->
              <path d="M100,100 L100,10 A90,90 0 0,1 163.64,36.36 Z" fill="#14B8A6"/>

              <!-- Segment Separator Lines -->
              <line x1="100" y1="100" x2="190" y2="100" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1.5"/>
              <line x1="100" y1="100" x2="163.64" y2="163.64" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1.5"/>
              <line x1="100" y1="100" x2="100" y2="190" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1.5"/>
              <line x1="100" y1="100" x2="36.36" y2="163.64" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1.5"/>
              <line x1="100" y1="100" x2="10" y2="100" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1.5"/>
              <line x1="100" y1="100" x2="36.36" y2="36.36" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1.5"/>
              <line x1="100" y1="100" x2="100" y2="10" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1.5"/>
              <line x1="100" y1="100" x2="163.64" y2="36.36" stroke="#FFFFFF" stroke-opacity="0.4" stroke-width="1.5"/>

              <!-- Labels & Emojis -->
              <text x="145" y="70" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">🍜 Phở Bò</text>
              <text x="148" y="130" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">🍚 Cơm Tấm</text>
              <text x="125" y="160" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">🍲 Bún Bò</text>
              <text x="70" y="160" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">🥗 Gỏi Cuốn</text>
              <text x="48" y="130" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">🥖 Bánh Mì</text>
              <text x="48" y="70" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">🐟 Cá Lóc</text>
              <text x="70" y="42" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">🥓 Bún Chả</text>
              <text x="125" y="42" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">🥣 Cháo Sườn</text>

              <!-- Golden Rivets (16 dots) -->
              <circle cx="100" cy="5" r="2" fill="#FDE68A"/>
              <circle cx="136" cy="12" r="2" fill="#FDE68A"/>
              <circle cx="167" cy="33" r="2" fill="#FDE68A"/>
              <circle cx="188" cy="64" r="2" fill="#FDE68A"/>
              <circle cx="195" cy="100" r="2" fill="#FDE68A"/>
              <circle cx="188" cy="136" r="2" fill="#FDE68A"/>
              <circle cx="167" cy="167" r="2" fill="#FDE68A"/>
              <circle cx="136" cy="188" r="2" fill="#FDE68A"/>
              <circle cx="100" cy="195" r="2" fill="#FDE68A"/>
              <circle cx="64" cy="188" r="2" fill="#FDE68A"/>
              <circle cx="33" cy="167" r="2" fill="#FDE68A"/>
              <circle cx="12" cy="136" r="2" fill="#FDE68A"/>
              <circle cx="5" cy="100" r="2" fill="#FDE68A"/>
              <circle cx="12" cy="64" r="2" fill="#FDE68A"/>
              <circle cx="33" cy="33" r="2" fill="#FDE68A"/>
              <circle cx="64" cy="12" r="2" fill="#FDE68A"/>

              <!-- 3D Center Embossed Button -->
              <circle cx="100" cy="100" r="26" fill="#18181B" stroke="#FBBF24" stroke-width="3"/>
              <circle cx="100" cy="100" r="20" fill="#FBBF24"/>
              <text x="100" y="104" font-size="10" font-weight="900" fill="#18181B" text-anchor="middle" letter-spacing="1">QUAY</text>
            </svg>
          </div>

          <!-- Result Card (Selected Dish) -->
          <div class="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] flex items-center gap-3 text-left shadow-sm">
            <div class="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-2xl" id="m3-spin-emoji">🍜</div>
            <div class="flex-1">
              <div id="m3-spin-title" class="font-extrabold text-[#0F172A]">Phở Bò Tái Nạm (55.000đ)</div>
              <div id="m3-spin-sub" class="text-[10px] text-[#64748B]">Phở Gia Truyền Phát Tài · Cách 400m · Đang mở cửa</div>
            </div>
            <button onclick="goScreen('M4-S03')" class="px-3 py-1.5 rounded-full bg-[#18181B] text-white font-bold hover:bg-[#FBBF24] hover:text-black transition-colors">Xem quán</button>
          </div>

          <!-- Spin Action Button -->
          <button onclick="spinM3Wheel()" class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FBBF24] to-[#F59E0B] text-[#0F172A] font-extrabold shadow-lg hover:shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-2">
            <span>🎲</span>
            <span>BẤM ĐỂ QUAY MÓN NGẪU NHIÊN</span>
          </button>
        </div>
      `;
    }
  },

  'M3-S04': {
    id: 'M3-S04',
    module: 'M3 · Gợi ý AI Hằng ngày (Core)',
    platform: 'mobile',
    title: 'Măm AI Chef (Personal Assistant)',
    subtitle: 'Trợ lý Măm AI 3D + Bong bóng chào màu xanh dịu + Gợi ý gắn nhãn Pastel (Benchmark Screen 3)',
    api: 'POST /v1/chat (Intent Extraction >= 90% accuracy)',
    ac: ['Bám sát 100% mẫu AI Chef (Screen 3)', 'Mascot 3D cầm muỗng gỗ + Speech bubble xanh nhạt + Tag pills Pastel + Chat bar dưới cùng'],
    render: () => `
      <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
        <!-- Top Header: Back + ✨ Măm AI Chef + Actions -->
        <div class="flex items-center justify-between">
          <button onclick="goScreen('M3-S01')" class="w-8 h-8 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#334155]">
            ${window.UI_KIT.icon('arrowLeft', 'w-4 h-4')}
          </button>
          <div class="text-center">
            <div class="font-extrabold text-sm flex items-center justify-center gap-1">
              <span class="text-[#F59E0B]">${window.UI_KIT.icon('sparkles', 'w-4 h-4')}</span>
              <span>Măm AI Chef</span>
            </div>
            <div class="text-[10px] text-[#64748B]">Trợ lý ẩm thực & quán ngon của riêng bạn</div>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="goScreen('M3-S05')" class="w-8 h-8 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#334155]">
              ${window.UI_KIT.icon('sliders', 'w-3.5 h-3.5')}
            </button>
          </div>
        </div>

        <!-- 3D Mascot Standing Left + Soft Sky-Blue Speech Bubble Right (Benchmark Screen 3) -->
        <div class="flex items-center gap-2">
          <div class="shrink-0 -ml-1">
            ${window.UI_KIT.mascotSVG('mam', 'w-20 h-24')}
          </div>
          <div class="flex-1 bg-[#EFF6FF] border border-[#DBEAFE] rounded-2xl rounded-bl-sm p-3 text-[11px] text-[#1E293B] leading-relaxed shadow-sm">
            <div class="font-extrabold text-xs mb-0.5">${window.appState.liveChatQuery ? 'Măm AI trả lời:' : 'Chào anh Long! 👋'}</div>
            ${window.appState.liveChatReply || 'Nhà mình đang có nguyên liệu gì, hay tối nay 4 người ngân sách 300k muốn ăn gần nhà? Măm tạo thực đơn ngay nhé!'}
          </div>
        </div>

        <!-- Tell Me What Ingredients / Live Prompt Card -->
        <div class="bg-white rounded-3xl p-3.5 border border-[#E2E8F0] shadow-sm space-y-2.5">
          <div class="text-[11px] font-bold text-[#334155]">Nhập nguyên liệu sẵn có hoặc nhu cầu bữa ăn...</div>
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <input id="mam-chat-inp" value="${window.appState.liveChatQuery || ''}" placeholder="VD: 4 người 300k, có trẻ nhỏ..." onkeydown="if(event.key==='Enter') window.LIVE_APP && LIVE_APP.sendMamChat()" class="flex-1 bg-transparent text-[11px] text-[#0F172A] focus:outline-none" />
            <button onclick="window.LIVE_APP && LIVE_APP.sendMamChat()" class="px-2.5 py-1 rounded-lg bg-[#FBBF24] text-[#0F172A] font-extrabold text-[10px]">Gửi</button>
          </div>
          <div class="flex flex-wrap gap-1.5 justify-center pt-0.5">
            <button onclick="window.LIVE_APP && LIVE_APP.sendMamChat('Tối nay 4 người ngân sách 300k có trẻ nhỏ')" class="px-3 py-1.5 rounded-full border border-[#E2E8F0] hover:border-[#FBBF24] text-[10px] font-bold text-[#1E293B] bg-white">
              4 người 300k
            </button>
            <button onclick="goScreen('M3-S03')" class="px-3 py-1.5 rounded-full border border-[#E2E8F0] hover:border-[#FBBF24] text-[10px] font-bold text-[#1E293B] bg-white">
              Quay món ngẫu nhiên
            </button>
            <button onclick="window.LIVE_APP && LIVE_APP.sendMamChat('Món chay thanh đạm')" class="px-3 py-1.5 rounded-full border border-[#E2E8F0] hover:border-[#22C55E] text-[10px] font-bold text-[#15803D] bg-white inline-flex items-center gap-1">
              ${window.UI_KIT.icon('leaf', 'w-3 h-3')}
              <span>Món Healthy</span>
            </button>
          </div>
        </div>

        <!-- AI Suggestions List with Pastel Tag Pills (Benchmark Screen 3) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="font-extrabold text-xs text-[#0F172A]">AI Suggestions (Đề xuất thực tế)</h4>
            <button onclick="goScreen('M3-S05')" class="text-[10px] font-bold text-[#64748B] flex items-center gap-0.5">
              <span>Xem tất cả</span>
              ${window.UI_KIT.icon('arrowRight', 'w-3 h-3')}
            </button>
          </div>

          <div class="space-y-2">
            <!-- Suggestion 1 -->
            <div onclick="goScreen('M2-S04')" class="bg-white p-2.5 rounded-2xl border border-[#F1F5F9] shadow-sm flex items-center gap-3 cursor-pointer hover:border-[#FBBF24] transition">
              <img data-img="298" class="w-14 h-14 rounded-xl object-cover shrink-0" />
              <div class="flex-1 min-w-0 space-y-1">
                <div class="font-extrabold text-xs text-[#0F172A] truncate">Phở Bò Tái Nạm</div>
                <div class="flex gap-1">
                  ${window.UI_KIT.tagPill('Nhanh', 'yellow')}
                  ${window.UI_KIT.tagPill('Healthy', 'blue')}
                </div>
                <div class="text-[10px] text-[#64748B] flex items-center gap-2">
                  <span class="inline-flex items-center gap-0.5">${window.UI_KIT.icon('clock', 'w-3 h-3')} 20 phút</span>
                  <span>• 2 người · 45.000đ</span>
                </div>
              </div>
              <span class="text-[#94A3B8]">${window.UI_KIT.icon('arrowRight', 'w-4 h-4')}</span>
            </div>

            <!-- Suggestion 2 -->
            <div onclick="goScreen('M2-S04')" class="bg-white p-2.5 rounded-2xl border border-[#F1F5F9] shadow-sm flex items-center gap-3 cursor-pointer hover:border-[#FBBF24] transition">
              <img data-img="304" class="w-14 h-14 rounded-xl object-cover shrink-0" />
              <div class="flex-1 min-w-0 space-y-1">
                <div class="font-extrabold text-xs text-[#0F172A] truncate">Cơm Tấm Sườn Nướng</div>
                <div class="flex gap-1">
                  ${window.UI_KIT.tagPill('Đậm đà', 'green')}
                  ${window.UI_KIT.tagPill('40.000đ', 'purple')}
                </div>
                <div class="text-[10px] text-[#64748B] flex items-center gap-2">
                  <span class="inline-flex items-center gap-0.5">${window.UI_KIT.icon('clock', 'w-3 h-3')} 15 phút</span>
                  <span>• Cách 550m</span>
                </div>
              </div>
              <span class="text-[#94A3B8]">${window.UI_KIT.icon('arrowRight', 'w-4 h-4')}</span>
            </div>

            <!-- Suggestion 3 -->
            <div onclick="goScreen('M3-S05')" class="bg-white p-2.5 rounded-2xl border border-[#F1F5F9] shadow-sm flex items-center gap-3 cursor-pointer hover:border-[#FBBF24] transition">
              <img data-img="310" class="w-14 h-14 rounded-xl object-cover shrink-0" />
              <div class="flex-1 min-w-0 space-y-1">
                <div class="font-extrabold text-xs text-[#0F172A] truncate">Bún Bò Huế O Xuân</div>
                <div class="flex gap-1">
                  ${window.UI_KIT.tagPill('Giàu Đạm', 'mint')}
                  ${window.UI_KIT.tagPill('Tài trợ', 'orange')}
                </div>
                <div class="text-[10px] text-[#64748B] flex items-center gap-2">
                  <span class="inline-flex items-center gap-0.5">${window.UI_KIT.icon('clock', 'w-3 h-3')} 18 phút</span>
                  <span>• Cách 650m · 50.000đ</span>
                </div>
              </div>
              <span class="text-[#94A3B8]">${window.UI_KIT.icon('arrowRight', 'w-4 h-4')}</span>
            </div>
          </div>
        </div>

        <!-- Bottom Sticky Ask Me Anything Bar with Emerald Send Button -->
        <div class="flex items-center gap-2 px-3 py-2 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] shadow-inner">
          <span class="text-[#F59E0B]">${window.UI_KIT.icon('sparkles', 'w-4 h-4')}</span>
          <span class="flex-1 text-[11px] text-[#64748B]">Hỏi Măm bất cứ điều gì...</span>
          <button onclick="goScreen('M3-S05')" class="w-7 h-7 rounded-full bg-[#22C55E] text-white flex items-center justify-center shadow">
            ${window.UI_KIT.icon('send', 'w-3.5 h-3.5')}
          </button>
        </div>
      </div>
    `
  },

  'M3-S05': {
    id: 'M3-S05',
    module: 'M3 · Gợi ý AI Hằng ngày (Core)',
    platform: 'mobile',
    title: 'AI Result (3 Phương Án Xác Minh)',
    subtitle: '3 phương án kết hợp món & quán thực tế (LLM không tự bịa quán ăn)',
    api: 'POST /v1/chat -> Recommender Engine',
    ac: ['Trả về đúng 3 phương án thực tế từ DB quán đã xác minh', 'Tính rõ tổng chi phí ước tính cho cả nhóm 4 người'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('3 Phương Án AI Đề Xuất', 'M3-S05 · 4 người · Ngân sách <= 300k', 'M3-S04')}

          <div onclick="goScreen('M4-S03')" class="bg-[#F8FAFC] p-3 rounded-2xl border-2 border-[#FBBF24] space-y-2 cursor-pointer shadow-sm">
            <div class="flex justify-between items-center">${k.tagPill('Phương án 1 · Gần nhất', 'yellow')}<b class="text-[#D97736]">Tổng ~240.000đ</b></div>
            <div class="flex items-center gap-2.5"><img data-img="298" class="w-12 h-12 rounded-xl object-cover shrink-0"/><div><div class="font-extrabold">Phở Gia Truyền Phát Tài (400m)</div><div class="text-[10px] text-[#64748B]">3 Phở bò lớn + 1 Phở nạm nhỏ cho bé + Quẩy</div></div></div>
          </div>

          <div onclick="goScreen('M4-S03')" class="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] space-y-2 cursor-pointer">
            <div class="flex justify-between items-center">${k.tagPill('Phương án 2 · Máy lạnh', 'blue')}<b class="text-[#D97736]">Tổng ~280.000đ</b></div>
            <div class="flex items-center gap-2.5"><img data-img="304" class="w-12 h-12 rounded-xl object-cover shrink-0"/><div><div class="font-extrabold">Tiệm Cơm Niêu Hương Việt (750m)</div><div class="text-[10px] text-[#64748B]">Thịt kho trứng + Canh chua + Rau xào (Ghế trẻ em)</div></div></div>
          </div>

          <div onclick="goScreen('M2-S06')" class="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] space-y-2 cursor-pointer">
            <div class="flex justify-between items-center">${k.tagPill('Phương án 3 · Tự nấu 30p', 'green')}<b class="text-[#16A34A]">Tổng ~165.000đ</b></div>
            <div class="flex items-center gap-2.5"><img data-img="034" class="w-12 h-12 rounded-xl object-cover shrink-0"/><div><div class="font-extrabold">Bò hầm khoai tây cà rốt + Bánh mì</div><div class="text-[10px] text-[#64748B]">Mềm ngọt hợp trẻ nhỏ · Tiết kiệm 45% ngân sách</div></div></div>
          </div>
        </div>
      `;
    }
  },

  'M3-S06': {
    id: 'M3-S06',
    module: 'M3 · Gợi ý AI Hằng ngày (Core)',
    platform: 'mobile',
    title: 'Recommendation Feedback',
    subtitle: 'Ghi nhận phản hồi Thích / Đã ăn / Bỏ qua để huấn luyện Măm AI',
    api: 'POST /v1/suggestions/feedback',
    ac: ['Cập nhật ngay vào lịch sử để không lặp lại món trong 3 ngày tới'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Phản Hồi Gợi Ý', 'M3-S06 · Huấn luyện khẩu vị AI', 'M3-S02')}
          ${k.mascotTip('mam', 'Anh thấy gợi ý hôm nay thế nào?', 'Măm sẽ ghi nhớ để không gợi ý trùng món đã ăn trong 3 ngày tới!')}

          <div class="grid grid-cols-3 gap-2 text-center">
            <button onclick="goScreen('M3-S07')" class="p-3 rounded-2xl bg-[#22C55E] text-white font-extrabold flex flex-col items-center gap-1 shadow-sm">${k.icon('check', 'w-5 h-5')}<span>Đã ăn</span></button>
            <button onclick="goScreen('M2-S08')" class="p-3 rounded-2xl bg-[#FEF3C7] text-[#B45309] font-extrabold flex flex-col items-center gap-1 border border-[#F59E0B]">${k.icon('heart', 'w-5 h-5')}<span>Yêu thích</span></button>
            <button onclick="goScreen('M3-S01')" class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] font-bold flex flex-col items-center gap-1">${k.icon('arrowRight', 'w-5 h-5')}<span>Bỏ qua</span></button>
          </div>
        </div>
      `;
    }
  },

  'M3-S07': {
    id: 'M3-S07',
    module: 'M3 · Gợi ý AI Hằng ngày (Core)',
    platform: 'mobile',
    title: 'Recommendation History',
    subtitle: 'Lịch sử các món AI đã gợi ý & trạng thái Đã ăn (Chống lặp 3 ngày)',
    api: 'GET /v1/suggestions/history',
    ac: ['Đảm bảo quy tắc không lặp lại món đã ăn trong vòng 3 ngày'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Lịch Sử Gợi Ý AI', 'M3-S07 · Chống lặp món 3 ngày', 'M3-S01')}
          <div class="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] flex items-center gap-3"><img data-img="298" class="w-12 h-12 rounded-xl object-cover"/><div class="flex-1"><div class="text-[10px] text-[#64748B]">Hôm nay · Bữa trưa</div><div class="font-extrabold">Phở bò tái nạm (45k)</div></div>${k.tagPill('✓ Đã ăn', 'green')}</div>
          <div class="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] flex items-center gap-3"><img data-img="304" class="w-12 h-12 rounded-xl object-cover"/><div class="flex-1"><div class="text-[10px] text-[#64748B]">Hôm qua · Bữa trưa</div><div class="font-extrabold">Cơm tấm sườn bì (40k)</div></div>${k.tagPill('✓ Đã ăn', 'green')}</div>
          <div class="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] flex items-center gap-3"><img data-img="470" class="w-12 h-12 rounded-xl object-cover"/><div class="flex-1"><div class="text-[10px] text-[#64748B]">2 ngày trước · Bữa sáng</div><div class="font-extrabold">Bánh mì thịt nướng (25k)</div></div>${k.tagPill('Đã lưu', 'yellow')}</div>
        </div>
      `;
    }
  },

  // ---------------------------------------------------------------------------
  // M4: QUÁN & BẢN ĐỒ (6 MÀN HÌNH: M4-S01..S06)
  // ---------------------------------------------------------------------------
  'M4-S01': {
    id: 'M4-S01',
    module: 'M4 · Quán & Bản đồ',
    platform: 'mobile',
    title: 'Nearby Restaurants List',
    subtitle: 'Danh sách quán bán món đang chọn trong bán kính 3km cùng Mascot Miu',
    api: 'GET /v1/dishes/{id}/places?radius=3000',
    ac: ['Bán kính mặc định 3km + Lọc Đang mở, Giá <50k, Máy lạnh, Giao hàng'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Quán Ngon Quanh Bạn', 'M4-S01 · Bán kính PostGIS 3km', 'M3-S01')}
          <div class="flex gap-1.5 overflow-x-auto no-scrollbar">${k.tagPill('● Đang mở (14)', 'green')}${k.tagPill('Dưới 50k', 'yellow')}${k.tagPill('Máy lạnh', 'blue')}${k.tagPill('Giao hàng', 'purple')}</div>
          <div onclick="goScreen('M4-S03')" class="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] flex items-center gap-3 cursor-pointer hover:border-[#FBBF24]">
            <img data-img="477" class="w-16 h-16 rounded-xl object-cover shrink-0" />
            <div class="flex-1"><div class="font-extrabold">Phở Gia Truyền Phát Tài ✔</div><div class="text-[10px] text-[#64748B]">Cách 400m · 06:00–22:00 · ⭐ 4.8</div><div class="font-extrabold text-[#D97736] mt-0.5">45.000đ</div></div>
            ${k.icon('arrowRight', 'w-4 h-4 text-[#94A3B8]')}
          </div>
          <button onclick="goScreen('M4-S02')" class="w-full py-3 rounded-full bg-[#18181B] text-white font-extrabold shadow-md">🗺️ Xem trên Bản đồ tương tác (M4-S02) →</button>
        </div>
      `;
    }
  },

  'M4-S02': {
    id: 'M4-S02',
    module: 'M4 · Quán & Bản đồ',
    platform: 'mobile',
    title: 'Interactive Restaurant Map',
    subtitle: 'Bản đồ trực quan với Pin giá món & khoảng cách thực tế (uid_622)',
    api: 'GET /v1/places/map?lat=10.95&lng=106.82&radius=3000',
    ac: ['Marker hiển thị giá món + Thẻ xem nhanh quán bên dưới'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Bản Đồ Quán 3km', 'M4-S02 · PostGIS Geo Search', 'M4-S01')}
          <div class="relative h-56 rounded-3xl overflow-hidden border border-[#E2E8F0]">
            <img data-img="622" class="w-full h-full object-cover" />
            <button onclick="goScreen('M4-S03')" class="absolute top-6 left-5 px-3 py-1.5 rounded-full bg-[#18181B] text-[#FBBF24] font-extrabold shadow-lg">🍜 Phở Phát Tài · 45k (400m)</button>
            <button onclick="goScreen('M4-S03')" class="absolute bottom-8 right-5 px-3 py-1.5 rounded-full bg-white text-[#0F172A] font-extrabold shadow-lg">🍛 Cơm Tấm Bụi · 40k (550m)</button>
          </div>
          <div onclick="goScreen('M4-S03')" class="bg-[#F8FAFC] p-3 rounded-2xl border-2 border-[#FBBF24] flex items-center gap-3 cursor-pointer">
            <img data-img="477" class="w-12 h-12 rounded-xl object-cover" />
            <div class="flex-1"><div class="font-extrabold">Phở Gia Truyền Phát Tài</div><div class="text-[10px] text-[#64748B]">Cách 400m · Đang mở · 45.000đ</div></div>
            <span class="px-3 py-1.5 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Chi tiết</span>
          </div>
        </div>
      `;
    }
  },

  'M4-S03': {
    id: 'M4-S03',
    module: 'M4 · Quán & Bản đồ',
    platform: 'mobile',
    title: 'Restaurant Detail',
    subtitle: 'Thông tin chi tiết quán, giờ hoạt động, tiện ích & nút chuyển đổi M5',
    api: 'GET /v1/places/{id}',
    ac: ['Hiển thị rõ trạng thái xác minh, giờ mở cửa, khoảng cách và nút Báo sai dữ liệu'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Chi Tiết Quán Ăn', 'M4-S03 · Verified Merchant', 'M4-S01')}
          <img data-img="477" class="w-full h-36 rounded-2xl object-cover border border-[#E2E8F0]" />
          <div class="space-y-2">
            <div class="flex justify-between items-center">${k.tagPill('✔ Đang mở · 06:00–22:00', 'green')}<span class="font-extrabold">⭐ 4.8 (150)</span></div>
            <h3 class="text-base font-extrabold">Phở Gia Truyền Phát Tài</h3>
            <p class="text-[11px] text-[#64748B]">📍 128 Huỳnh Văn Nghệ, P. Bửu Long (Cách 400m)</p>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button onclick="goScreen('M4-S04')" class="py-2.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] font-extrabold">📋 Xem Menu</button>
              <button onclick="goScreen('M5-S01')" class="py-2.5 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-sm">🛵 Đặt món / Maps</button>
            </div>
            <div class="flex justify-between pt-2 text-[10px] text-[#64748B]">
              <button onclick="goScreen('M4-S05')" class="font-bold text-[#16A34A]">● Kiểm tra còn món (M4-S05)</button>
              <button onclick="goScreen('M4-S06')" class="underline">⚠️ Báo sai dữ liệu (M4-S06)</button>
            </div>
          </div>
        </div>
      `;
    }
  },

  'M4-S04': {
    id: 'M4-S04',
    module: 'M4 · Quán & Bản đồ',
    platform: 'mobile',
    title: 'Structured Restaurant Menu',
    subtitle: 'Thực đơn có cấu trúc món & giá đã ghép với Thư viện món M2',
    api: 'GET /v1/places/{id}/menu',
    ac: ['Hiển thị giá rõ ràng từng món, đánh dấu món khớp khẩu vị người dùng'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Thực Đơn Tại Quán', 'M4-S04 · Chuẩn hóa bởi AI OCR', 'M4-S03')}
          <div onclick="goScreen('M5-S01')" class="bg-[#F8FAFC] p-3 rounded-2xl border-2 border-[#FBBF24] flex items-center gap-3 cursor-pointer"><img data-img="298" class="w-14 h-14 rounded-xl object-cover"/><div class="flex-1">${k.tagPill('Hợp ngân sách', 'yellow')}<div class="font-extrabold mt-0.5">Phở bò tái nạm</div><div class="font-extrabold text-[#D97736]">45.000đ</div></div><span class="px-3 py-1.5 rounded-full bg-[#FBBF24] font-extrabold">Chọn</span></div>
          <div onclick="goScreen('M5-S01')" class="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] flex items-center gap-3 cursor-pointer"><img data-img="034" class="w-14 h-14 rounded-xl object-cover"/><div class="flex-1"><div class="font-extrabold">Phở bò đặc biệt</div><div class="font-extrabold text-[#D97736]">60.000đ</div></div><span class="px-3 py-1.5 rounded-full bg-white border border-[#E2E8F0] font-bold">Chọn</span></div>
        </div>
      `;
    }
  },

  'M4-S05': {
    id: 'M4-S05',
    module: 'M4 · Quán & Bản đồ',
    platform: 'mobile',
    title: 'Dish Availability & Daily Specials',
    subtitle: 'Trạng thái còn món theo khung giờ & Món đặc biệt hôm nay của quán',
    api: 'GET /v1/places/{id}/availability',
    ac: ['Không đề xuất món đã hết trong khung giờ hiện tại'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Tình Trạng Còn Món', 'M4-S05 · Cập nhật thời gian thực', 'M4-S03')}
          <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center"><div><b>Phở bò tái nạm (45k)</b><div class="text-[10px] text-[#64748B]">Bán cả ngày (06:00–22:00)</div></div>${k.tagPill('● Còn món', 'green')}</div>
          <div class="p-3 rounded-2xl bg-[#FEF3C7] border border-[#F59E0B] flex justify-between items-center"><div><b>Phở sườn bò hầm (Đặc biệt)</b><div class="text-[10px] text-[#B45309]">Chỉ còn 8 phần trưa nay</div></div>${k.tagPill('Sắp hết', 'yellow')}</div>
        </div>
      `;
    }
  },

  'M4-S06': {
    id: 'M4-S06',
    module: 'M4 · Quán & Bản đồ',
    platform: 'mobile',
    title: 'Report Incorrect Place Data',
    subtitle: 'Người dùng báo sai địa chỉ, giá bán hoặc trạng thái đóng/mở cửa',
    api: 'POST /v1/places/{id}/reports',
    ac: ['Gửi thẳng vào hàng đợi kiểm duyệt Admin CMS (M9-S06)'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Báo Sai Dữ Liệu', 'M4-S06 · Gửi về Admin M9-S06', 'M4-S03')}
          <div class="space-y-2">
            <label class="flex items-center gap-2 p-3 rounded-2xl bg-[#FEF3C7] border border-[#F59E0B] font-bold"><input type="radio" name="r" checked/> Quán hiện đang đóng cửa / Nghỉ bán</label>
            <label class="flex items-center gap-2 p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]"><input type="radio" name="r"/> Giá món thực tế chênh lệch</label>
            <label class="flex items-center gap-2 p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]"><input type="radio" name="r"/> Vị trí ghim bản đồ bị lệch</label>
          </div>
          <button onclick="goScreen('M5-S05')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">Gửi báo cáo xác minh</button>
        </div>
      `;
    }
  },

  // ---------------------------------------------------------------------------
  // M5: ĐẶT MÓN / CHỈ ĐƯỜNG (5 MÀN HÌNH: M5-S01..S05)
  // ---------------------------------------------------------------------------
  'M5-S01': {
    id: 'M5-S01',
    module: 'M5 · Đặt món & Chỉ đường',
    platform: 'mobile',
    title: 'Order & Conversion Options',
    subtitle: 'Tùy chọn hành động: Đặt giao hàng, Chỉ đường đến quán hoặc Gọi điện',
    api: 'POST /v1/events (order_click / direction_click)',
    ac: ['Chuyển tiếp thông minh sang ứng dụng giao hàng hoặc bản đồ'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Tuỳ Chọn Thưởng Thức', 'M5-S01 · Đặt món / Chỉ đường', 'M4-S03')}
          <img data-img="652" class="w-full h-36 rounded-2xl object-cover object-top border border-[#E2E8F0]" />
          <div class="space-y-2">
            <button onclick="goScreen('M5-S02')" class="w-full p-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold flex justify-between items-center shadow-sm px-4"><span>🛵 Đặt giao tận nơi (Grab / Shopee / Xanh SM)</span><span>→</span></button>
            <button onclick="goScreen('M5-S03')" class="w-full p-3 rounded-full bg-[#18181B] text-white font-extrabold flex justify-between items-center px-4"><span>🧭 Chỉ đường đến quán (400m · 3 phút)</span><span>→</span></button>
            <button onclick="goScreen('M5-S04')" class="w-full p-3 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] font-bold flex justify-between items-center px-4"><span>📞 Gọi điện cho quán dặn trước</span><span>→</span></button>
          </div>
        </div>
      `;
    }
  },

  'M5-S02': {
    id: 'M5-S02',
    module: 'M5 · Đặt món & Chỉ đường',
    platform: 'mobile',
    title: 'Delivery Platform Deep-link Selector',
    subtitle: 'Mở trực tiếp GrabFood, ShopeeFood, beFood, Xanh SM Ngon (kèm Web Fallback)',
    api: 'POST /v1/events/order_click',
    ac: ['Mở deep-link app hoặc fallback sang web + Gắn UTM tracking'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Chọn Ứng Dụng Giao Hàng', 'M5-S02 · Deep-link Siêu ứng dụng', 'M5-S01')}
          <div onclick="goScreen('M5-S05')" class="p-3 rounded-2xl bg-[#F8FAFC] border-2 border-[#00A8B5] flex justify-between items-center cursor-pointer"><div><b>Xanh SM Ngon</b><div class="text-[10px] text-[#64748B]">Giao xe điện · Ưu đãi 15k</div></div>${k.tagPill('Mở App →', 'blue')}</div>
          <div onclick="goScreen('M5-S05')" class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center cursor-pointer"><div><b>GrabFood</b><div class="text-[10px] text-[#64748B]">Giao 15 phút · 45.000đ</div></div>${k.tagPill('Mở App →', 'green')}</div>
          <div onclick="goScreen('M5-S05')" class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center cursor-pointer"><div><b>ShopeeFood</b><div class="text-[10px] text-[#64748B]">Mã Freeship · 45.000đ</div></div>${k.tagPill('Mở App →', 'orange')}</div>
          <div onclick="goScreen('M5-S05')" class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center cursor-pointer"><div><b>beFood</b><div class="text-[10px] text-[#64748B]">Giao 18 phút · 45.000đ</div></div>${k.tagPill('Mở App →', 'yellow')}</div>
        </div>
      `;
    }
  },

  'M5-S03': {
    id: 'M5-S03',
    module: 'M5 · Đặt món & Chỉ đường',
    platform: 'mobile',
    title: 'Directions & Map Navigation',
    subtitle: 'Lộ trình di chuyển 400m đến quán & mở Google Maps / Apple Maps',
    api: 'POST /v1/events/direction_click',
    ac: ['Ghi nhận sự kiện direction_click + Hỗ trợ cả Google Maps & Apple Maps'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Chỉ Đường Đến Quán', 'M5-S03 · Cách 400m (3 phút)', 'M5-S01')}
          <img data-img="652" class="w-full h-44 rounded-2xl object-cover object-right border border-[#E2E8F0]" />
          <div class="grid grid-cols-2 gap-2">
            <button onclick="goScreen('M5-S05')" class="py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">🗺️ Google Maps</button>
            <button onclick="goScreen('M5-S05')" class="py-3 rounded-full bg-[#18181B] text-white font-extrabold"> Apple Maps</button>
          </div>
        </div>
      `;
    }
  },

  'M5-S04': {
    id: 'M5-S04',
    module: 'M5 · Đặt món & Chỉ đường',
    platform: 'mobile',
    title: 'Call Restaurant Directly',
    subtitle: 'Gọi điện xác nhận còn món / đặt chỗ trước & ghi nhận call_click',
    api: 'POST /v1/events/call_click',
    ac: ['Hiển thị số điện thoại quán và gợi ý câu hỏi nhanh'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs text-center">
          ${k.mobileHeader('Gọi Điện Cho Quán', 'M5-S04 · Ghi nhận call_click', 'M5-S01')}
          <div class="bg-[#F8FAFC] p-5 rounded-3xl border border-[#E2E8F0] space-y-2.5">
            <img data-img="477" class="w-16 h-16 rounded-full mx-auto object-cover" />
            <div class="font-extrabold text-sm">Phở Gia Truyền Phát Tài</div>
            <div class="text-lg font-mono font-extrabold text-[#B45309]">0251 3845 999</div>
            <button onclick="goScreen('M5-S05')" class="w-full py-3 rounded-full bg-[#22C55E] text-white font-extrabold shadow-md">📞 Gọi ngay bây giờ</button>
          </div>
        </div>
      `;
    }
  },

  'M5-S05': {
    id: 'M5-S05',
    module: 'M5 · Đặt món & Chỉ đường',
    platform: 'mobile',
    title: 'Action Confirmation & Loopback',
    subtitle: 'Xác nhận chuyển đổi thành công & cập nhật trạng thái "Đã ăn hôm nay"',
    api: 'POST /v1/suggestions/feedback (eaten=true)',
    ac: ['Khép kín vòng lặp dữ liệu: từ Đặt món/Chỉ đường quay về cập nhật Lịch sử M3'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs text-center">
          ${k.mobileHeader('Xác Nhận Thành Công', 'M5-S05 · Khép kín vòng lặp AI', 'M3-S01')}
          ${k.mascotTip('mam', 'Chúc anh ngon miệng nhé!', 'Đánh dấu Đã ăn hôm nay để Măm không gợi ý trùng món Phở bò trong 3 ngày tới!')}
          <button onclick="goScreen('M3-S07')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">✓ Đánh dấu Đã ăn & Xem lịch sử</button>
        </div>
      `;
    }
  },

  // ---------------------------------------------------------------------------
  // M8: THÔNG BÁO & TÁI KÍCH HOẠT (4 MÀN HÌNH: M8-S01..S04)
  // ---------------------------------------------------------------------------
  'M8-S01': {
    id: 'M8-S01',
    module: 'M8 · Thông báo & Nhắc bữa',
    platform: 'mobile',
    title: 'Notification Center',
    subtitle: 'Trung tâm thông báo gợi ý bữa trưa (10:30) và bữa tối (17:00) theo thời tiết',
    api: 'GET /v1/notifications',
    ac: ['Mặc định 10:30 và 17:00, tối đa 2 push/ngày tránh làm phiền'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Trung Tâm Thông Báo', 'M8-S01 · Nhắc bữa thông minh', 'M3-S01')}
          <div onclick="goScreen('M8-S02')" class="p-3.5 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE] space-y-1 cursor-pointer">
            <div class="flex justify-between">${k.tagPill('Bữa trưa · 10:30', 'blue')}<span class="text-[10px] font-bold text-[#1D4ED8]">Mới</span></div>
            <div class="font-extrabold">🌧️ Trưa nay trời mát 26°C, ăn Phở bò hay Cơm tấm?</div>
          </div>
          <button onclick="goScreen('M8-S03')" class="w-full py-2.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] font-bold">⚙️ Tuỳ chỉnh Thông báo (M8-S03) →</button>
        </div>
      `;
    }
  },

  'M8-S02': {
    id: 'M8-S02',
    module: 'M8 · Thông báo & Nhắc bữa',
    platform: 'mobile',
    title: 'Notification Context Detail',
    subtitle: 'Chi tiết thông báo ngữ cảnh thời tiết dẫn thẳng vào 3 món gợi ý',
    api: 'GET /v1/notifications/{id}',
    ac: ['Deep-link trực tiếp từ Push Notification vào M3-S01'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Chi Tiết Thông Báo', 'M8-S02 · Ngữ cảnh Thời tiết', 'M8-S01')}
          ${k.mascotTip('mam', 'Bữa trưa ấm bụng ngày mưa nhẹ!', 'Biên Hòa vừa giảm nhiệt còn 26°C. Măm chọn sẵn 3 quán nước nóng cách anh dưới 500m.')}
          <button onclick="goScreen('M3-S01')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">Xem ngay 3 món gợi ý hôm nay →</button>
        </div>
      `;
    }
  },

  'M8-S03': {
    id: 'M8-S03',
    module: 'M8 · Thông báo & Nhắc bữa',
    platform: 'mobile',
    title: 'Notification Preferences',
    subtitle: 'Tùy chỉnh loại thông báo muốn nhận (Cam kết tối đa 2 thông báo/ngày)',
    api: 'PUT /v1/me/notification-settings',
    ac: ['Giới hạn cứng tối đa 2 push/ngày'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Tuỳ Chỉnh Thông Báo', 'M8-S03 · Tối đa 2 push/ngày', 'M8-S01')}
          <div class="bg-[#F8FAFC] p-4 rounded-3xl border border-[#E2E8F0] space-y-3">
            <div class="flex justify-between items-center"><b>Gợi ý món ăn theo bữa</b>${k.tagPill('Đang bật', 'green')}</div>
            <div class="flex justify-between items-center"><b>Gợi ý theo thời tiết</b>${k.tagPill('Đang bật', 'green')}</div>
            <div class="flex justify-between items-center"><b>Nhắc ngày ăn Chay âm lịch</b>${k.tagPill('Đang bật', 'green')}</div>
          </div>
          <button onclick="goScreen('M8-S04')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">Đặt khung giờ nhắc bữa (M8-S04) →</button>
        </div>
      `;
    }
  },

  'M8-S04': {
    id: 'M8-S04',
    module: 'M8 · Thông báo & Nhắc bữa',
    platform: 'mobile',
    title: 'Meal Reminder Schedule',
    subtitle: 'Hẹn khung giờ nhận gợi ý bữa trưa (mặc định 10:30) và bữa tối (17:00)',
    api: 'PUT /v1/me/meal-schedule',
    ac: ['Mặc định 10:30 và 17:00 đúng theo đặc tả M8'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Lịch Nhắc Bữa Ăn', 'M8-S04 · Mặc định 10:30 & 17:00', 'M8-S03')}
          <div class="p-3.5 rounded-2xl bg-[#FEF3C7] border border-[#F59E0B] flex justify-between items-center"><span class="font-extrabold">☀️ Nhắc chọn món Bữa Trưa</span><span class="font-mono font-extrabold text-sm text-[#B45309]">10:30</span></div>
          <div class="p-3.5 rounded-2xl bg-[#EDE9FE] border border-[#8B5CF6] flex justify-between items-center"><span class="font-extrabold">🌙 Nhắc chọn món Bữa Tối</span><span class="font-mono font-extrabold text-sm text-[#6D28D9]">17:00</span></div>
        </div>
      `;
    }
  }
};

