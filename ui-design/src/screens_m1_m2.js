// =============================================================================
// MODULE M1 (10 SCREENS: M1-S01..S10) & MODULE M2 (8 SCREENS: M2-S01..S08) — AI CHEF STYLE
// =============================================================================

window.SCREENS_M1_M2 = {
  // ---------------------------------------------------------------------------
  // M1: TÀI KHOẢN & HỒ SƠ KHẨU VỊ (10 MÀN HÌNH)
  // ---------------------------------------------------------------------------
  'M1-S01': {
    id: 'M1-S01',
    module: 'M1 · Tài khoản & Khẩu vị',
    platform: 'mobile',
    title: 'Welcome & Login',
    subtitle: 'Đăng nhập đa kênh (OTP, Zalo, Apple, Google) hoặc dùng ngay chế độ Khách',
    api: 'POST /v1/auth/login · POST /v1/auth/guest',
    ac: ['Dark Hero Card với Mascot Măm 3D + Nút vàng #FBBF24 + Guest Mode'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-4 bg-white text-[#0F172A] text-xs">
          <!-- Dark Hero Banner with 3D Mascot & Circular Bowl -->
          <div class="rounded-3xl bg-[#18181B] text-white p-4 relative overflow-hidden shadow-xl min-h-[180px] flex flex-col justify-between">
            <div class="space-y-1.5 max-w-[195px] z-10">
              <span class="px-2.5 py-0.5 rounded-full bg-[#22C55E] text-white text-[10px] font-bold inline-flex items-center gap-1">
                ${k.icon('sparkles', 'w-3 h-3')} <span>Taste of Vietnam</span>
              </span>
              <h2 class="text-lg font-extrabold leading-tight">Hôm Nay Ăn Gì?</h2>
              <p class="text-[10px] text-gray-300 leading-relaxed">Trợ lý AI khám phá món ngon, công thức chuẩn & quán thực tế quanh bạn.</p>
            </div>
            <img data-img="034" class="w-28 h-28 rounded-full object-cover border-4 border-[#27272A] absolute -top-2 -right-2 shadow-2xl" />
            <div class="absolute -bottom-1 right-1 z-10">${k.mascotSVG('mam', 'w-20 h-20')}</div>
          </div>

          <!-- Phone Input Card -->
          <div class="bg-[#F8FAFC] rounded-3xl p-4 border border-[#E2E8F0] space-y-3">
            <div class="font-extrabold text-xs text-[#0F172A]">Đăng nhập nhanh bằng Số điện thoại</div>
            <div class="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-[#E2E8F0]">
              <span class="font-extrabold text-[#0F172A] pr-2 border-r border-[#E2E8F0]">+84</span>
              <input type="text" value="0912 345 678" class="bg-transparent font-bold w-full focus:outline-none" readonly />
            </div>
            <button onclick="goScreen('M1-S02')" class="w-full py-3 rounded-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#0F172A] font-extrabold shadow-md flex items-center justify-center gap-1.5">
              ${k.icon('sparkles', 'w-4 h-4')}
              <span>Nhận mã xác thực OTP →</span>
            </button>
          </div>

          <!-- Social Login Row -->
          <div class="space-y-2">
            <div class="text-center text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Hoặc tiếp tục với</div>
            <div class="grid grid-cols-3 gap-2 font-extrabold">
              <button onclick="goScreen('M1-S03')" class="py-2.5 rounded-2xl bg-[#0068FF] text-white shadow-sm">Zalo</button>
              <button onclick="goScreen('M1-S03')" class="py-2.5 rounded-2xl bg-[#18181B] text-white shadow-sm">Apple</button>
              <button onclick="goScreen('M1-S03')" class="py-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A]">Google</button>
            </div>
          </div>

          <button onclick="goScreen('M3-S01')" class="w-full py-2.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#334155] font-bold">
            Khám phá ngay không cần tài khoản (Guest Mode)
          </button>
        </div>
      `;
    }
  },

  'M1-S02': {
    id: 'M1-S02',
    module: 'M1 · Tài khoản & Khẩu vị',
    platform: 'mobile',
    title: 'OTP Verification',
    subtitle: 'Xác thực mã OTP 6 số gửi qua Zalo / SMS',
    api: 'POST /v1/auth/otp/verify',
    ac: ['6 ô số rõ ràng + Đếm ngược 45s + Chuyển thẳng vào Onboarding khẩu vị'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-4 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Xác Thực OTP', 'M1-S02 · Bảo mật 2 lớp', 'M1-S01')}
          ${k.mascotTip('mam', 'Mã OTP đã gửi tới Zalo của anh!', 'Nhập 6 chữ số được gửi tới +84 912 345 678 để đồng bộ hồ sơ khẩu vị.')}

          <div class="grid grid-cols-6 gap-2 text-center">
            ${['4','8','2','9','1','0'].map((d, i) => `
              <div class="h-12 rounded-2xl ${i===5?'bg-[#FEF3C7] border-2 border-[#F59E0B] text-[#B45309]':'bg-[#F8FAFC] border-2 border-[#E2E8F0]'} flex items-center justify-center text-base font-extrabold">${d}</div>
            `).join('')}
          </div>

          <div class="flex justify-between items-center px-3 py-2.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span class="text-[#64748B]">Chưa nhận được mã?</span>
            <span class="font-extrabold text-[#B45309]">Gửi lại SMS (00:38s)</span>
          </div>

          <button onclick="goScreen('M1-S03')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">
            ✨ Xác nhận & Thiết lập Khẩu vị (45s) →
          </button>
        </div>
      `;
    }
  },

  'M1-S03': {
    id: 'M1-S03',
    module: 'M1 · Tài khoản & Khẩu vị',
    platform: 'mobile',
    title: 'Food Region Selection (Bước 1/5)',
    subtitle: 'Chọn hương vị vùng miền yêu thích (Hoàn thành < 45 giây)',
    api: 'PATCH /v1/me/profile (regions)',
    ac: ['Chọn nhiều vùng miền với hình ảnh trực quan + Thanh tiến trình 1/5'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Bước 1/5 · Vùng Miền', 'Onboarding Khẩu vị < 45 giây', 'M1-S02')}
          <div class="w-full h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden"><div class="h-full bg-[#FBBF24]" style="width:20%"></div></div>

          <div class="space-y-2.5">
            <div class="p-3 rounded-2xl bg-white border-2 border-[#FBBF24] flex items-center gap-3 shadow-sm">
              <img data-img="298" class="w-14 h-14 rounded-xl object-cover shrink-0" />
              <div class="flex-1"><div class="flex justify-between font-extrabold"><span>Hương vị Miền Bắc</span>${k.tagPill('Đã chọn ✓', 'yellow')}</div><p class="text-[10px] text-[#64748B] mt-0.5">Thanh tao, dịu nhẹ · Phở bò, Bún chả, Bún thang</p></div>
            </div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-3">
              <img data-img="310" class="w-14 h-14 rounded-xl object-cover shrink-0" />
              <div class="flex-1"><div class="font-extrabold">Đậm đà Miền Trung</div><p class="text-[10px] text-[#64748B] mt-0.5">Cay nồng, thơm sả ruốc · Bún bò Huế, Mì Quảng</p></div>
            </div>
            <div class="p-3 rounded-2xl bg-white border-2 border-[#FBBF24] flex items-center gap-3 shadow-sm">
              <img data-img="304" class="w-14 h-14 rounded-xl object-cover shrink-0" />
              <div class="flex-1"><div class="flex justify-between font-extrabold"><span>Phóng khoáng Miền Nam</span>${k.tagPill('Đã chọn ✓', 'yellow')}</div><p class="text-[10px] text-[#64748B] mt-0.5">Hài hòa chua ngọt · Cơm tấm, Canh chua, Hủ tiếu</p></div>
            </div>
          </div>

          <button onclick="goScreen('M1-S04')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">
            Tiếp theo: Độ ăn cay (Bước 2/5) →
          </button>
        </div>
      `;
    }
  },

  'M1-S04': {
    id: 'M1-S04',
    module: 'M1 · Tài khoản & Khẩu vị',
    platform: 'mobile',
    title: 'Spice Level Selection (Bước 2/5)',
    subtitle: 'Thiết lập thang độ ăn cay từ 0 đến 3',
    api: 'PATCH /v1/me/profile (spice_level)',
    ac: ['4 mức độ cay trực quan kèm nhãn Pastel'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Bước 2/5 · Độ Ăn Cay', 'Thang độ cay 0 – 3', 'M1-S03')}
          <div class="w-full h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden"><div class="h-full bg-[#FBBF24]" style="width:40%"></div></div>

          <div class="space-y-2">
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center"><div><b>Mức 0 · Không ăn cay</b><div class="text-[10px] text-[#64748B]">Hoàn toàn không ớt, hợp trẻ nhỏ</div></div>${k.tagPill('0/3', 'blue')}</div>
            <div class="p-3 rounded-2xl bg-white border-2 border-[#FBBF24] flex justify-between items-center shadow-sm"><div><b>Mức 1 · Cay nhẹ the mát ✓</b><div class="text-[10px] text-[#64748B]">Một chút tiêu hoặc vài lát ớt sừng</div></div>${k.tagPill('Đang chọn', 'yellow')}</div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center"><div><b>Mức 2 · Cay vừa đậm vị</b><div class="text-[10px] text-[#64748B]">Chuẩn vị Bún bò Huế, Lẩu Thái</div></div>${k.tagPill('2/3', 'orange')}</div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center"><div><b>Mức 3 · Siêu cay thách thức</b><div class="text-[10px] text-[#64748B]">Ớt hiểm, sa tế cay nồng</div></div>${k.tagPill('3/3', 'rose')}</div>
          </div>

          <button onclick="goScreen('M1-S05')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">
            Tiếp theo: Dị ứng thực phẩm (Bước 3/5) →
          </button>
        </div>
      `;
    }
  },

  'M1-S05': {
    id: 'M1-S05',
    module: 'M1 · Tài khoản & Khẩu vị',
    platform: 'mobile',
    title: 'Allergy Hard-Filter (Bước 3/5)',
    subtitle: 'Bộ lọc cứng về dị ứng thực phẩm cùng Mascot Lá 3D',
    api: 'PATCH /v1/me/profile (allergies)',
    ac: ['Hard filter: Tuyệt đối ẩn 100% món chứa chất dị ứng trong cả gợi ý tự nhiên lẫn quảng cáo'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Bước 3/5 · Bộ Lọc Dị Ứng', 'Hard Filter · Chặn tuyệt đối 100%', 'M1-S04')}
          <div class="w-full h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden"><div class="h-full bg-[#22C55E]" style="width:60%"></div></div>

          ${k.mascotTip('la', 'Mascot Lá bảo vệ sức khỏe!', 'Mọi thành phần anh đánh dấu dưới đây sẽ bị chặn cứng 100%, kể cả trong slot Tài trợ.', 'bg-[#DCFCE7] border-[#BBF7D0]')}

          <div class="grid grid-cols-2 gap-2.5">
            <div class="p-3 rounded-2xl bg-[#FFE4E6] border-2 border-[#F43F5E] text-[#BE123C] font-extrabold flex justify-between items-center"><span>Tôm / Hải sản</span><span>🚫</span></div>
            <div class="p-3 rounded-2xl bg-[#FFE4E6] border-2 border-[#F43F5E] text-[#BE123C] font-extrabold flex justify-between items-center"><span>Đậu phộng (Lạc)</span><span>🚫</span></div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] font-semibold flex justify-between items-center"><span>Sữa / Lactose</span><span>+</span></div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] font-semibold flex justify-between items-center"><span>Gluten / Bột mì</span><span>+</span></div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] font-semibold flex justify-between items-center"><span>Trứng gia cầm</span><span>+</span></div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] font-semibold flex justify-between items-center"><span>Đậu nành</span><span>+</span></div>
          </div>

          <button onclick="goScreen('M1-S06')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">
            Tiếp theo: Chế độ dinh dưỡng (Bước 4/5) →
          </button>
        </div>
      `;
    }
  },

  'M1-S06': {
    id: 'M1-S06',
    module: 'M1 · Tài khoản & Khẩu vị',
    platform: 'mobile',
    title: 'Diet Preferences (Bước 4/5)',
    subtitle: 'Chọn chế độ ăn bằng vòng tròn Pastel (Cân bằng, Chay, Eat Clean, Giàu đạm)',
    api: 'PATCH /v1/me/profile (diet_mode)',
    ac: ['Vòng tròn Pastel đồng bộ với phong cách AI Chef & hỗ trợ nhắc ăn Chay âm lịch'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Bước 4/5 · Chế Độ Ăn', 'Cá nhân hóa dinh dưỡng & Kcal', 'M1-S05')}
          <div class="w-full h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden"><div class="h-full bg-[#FBBF24]" style="width:80%"></div></div>

          <div class="grid grid-cols-3 gap-3 text-center py-2">
            <div class="p-3 rounded-2xl bg-[#FEF3C7] border-2 border-[#F59E0B] flex flex-col items-center gap-1.5"><span class="text-[#B45309]">${k.icon('utensils', 'w-6 h-6')}</span><b class="text-[#B45309]">Cân bằng ✓</b></div>
            <div class="p-3 rounded-2xl bg-[#DCFCE7] flex flex-col items-center gap-1.5"><span class="text-[#15803D]">${k.icon('leaf', 'w-6 h-6')}</span><b class="text-[#15803D]">Ăn Chay kỳ</b></div>
            <div class="p-3 rounded-2xl bg-[#DBEAFE] flex flex-col items-center gap-1.5"><span class="text-[#1D4ED8]">${k.icon('flame', 'w-6 h-6')}</span><b class="text-[#1D4ED8]">Eat Clean</b></div>
            <div class="p-3 rounded-2xl bg-[#EDE9FE] flex flex-col items-center gap-1.5"><span class="text-[#6D28D9]">${k.icon('sparkles', 'w-6 h-6')}</span><b class="text-[#6D28D9]">Giàu Đạm</b></div>
            <div class="p-3 rounded-2xl bg-[#FCE7F3] flex flex-col items-center gap-1.5"><span class="text-[#DB2777]">${k.icon('heart', 'w-6 h-6')}</span><b class="text-[#DB2777]">Ít dầu mỡ</b></div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col items-center gap-1.5"><span class="text-[#475569]">${k.icon('sun', 'w-6 h-6')}</span><b>Low Carb</b></div>
          </div>

          <button onclick="goScreen('M1-S07')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">
            Tiếp theo: Ngân sách bữa ăn (Bước 5/5) →
          </button>
        </div>
      `;
    }
  },

  'M1-S07': {
    id: 'M1-S07',
    module: 'M1 · Tài khoản & Khẩu vị',
    platform: 'mobile',
    title: 'Budget Selection (Bước 5/5)',
    subtitle: 'Chọn mức ngân sách trung bình mỗi bữa ăn cá nhân',
    api: 'PATCH /v1/me/profile (budget_range)',
    ac: ['Hoàn thành toàn bộ 5 câu dưới 45 giây'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Bước 5/5 · Ngân Sách', 'Hoàn tất trong 38 giây!', 'M1-S06')}
          <div class="w-full h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden"><div class="h-full bg-[#22C55E]" style="width:100%"></div></div>

          <div class="space-y-2">
            <div class="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center"><div><b>Tiết kiệm · Bình dân</b><div class="text-[10px] text-[#64748B]">Bánh mì, Xôi, Bún riêu</div></div><b>&lt; 35.000đ</b></div>
            <div class="p-3.5 rounded-2xl bg-white border-2 border-[#FBBF24] flex justify-between items-center shadow-sm"><div><b class="text-[#B45309]">Phổ thông hằng ngày ✓</b><div class="text-[10px] text-[#64748B]">Phở bò, Cơm tấm, Bún bò Huế</div></div>${k.tagPill('35k – 60k', 'yellow')}</div>
            <div class="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center"><div><b>Thoải mái · Quán máy lạnh</b><div class="text-[10px] text-[#64748B]">Cơm niêu, Bò bít tết</div></div><b>60k – 120k</b></div>
          </div>

          <button onclick="goScreen('M1-S08')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">
            ✨ Hoàn tất & Chọn vị trí gần bạn →
          </button>
        </div>
      `;
    }
  },

  'M1-S08': {
    id: 'M1-S08',
    module: 'M1 · Tài khoản & Khẩu vị',
    platform: 'mobile',
    title: 'Location Permission & Area Picker',
    subtitle: 'Cấp quyền GPS hoặc chọn khu vực thủ công (Biên Hòa / Quy Nhơn / TP.HCM)',
    api: 'PUT /v1/me/location',
    ac: ['Hỗ trợ chọn vị trí thủ công khi từ chối GPS, đồng hành cùng Mascot Miu'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Vị Trí Của Bạn', 'M1-S08 · Bán kính PostGIS 3km', 'M1-S07')}
          ${k.mascotTip('miu', 'Miu tìm quán đang mở quanh anh!', 'Bật định vị hoặc chọn phường/xã thủ công để Miu đo khoảng cách chính xác.')}

          <button onclick="goScreen('M3-S01')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md flex items-center justify-center gap-1.5">
            ${k.icon('pin', 'w-4 h-4')}
            <span>Cho phép định vị GPS tự động</span>
          </button>

          <div class="space-y-2 pt-1">
            <div class="text-[10px] font-bold uppercase text-[#64748B]">Hoặc chọn khu vực thủ công:</div>
            <button onclick="goScreen('M3-S01')" class="w-full p-3 rounded-2xl bg-[#FEF3C7] border border-[#F59E0B] flex justify-between items-center font-extrabold text-[#B45309]"><span>📍 P. Bửu Long, TP. Biên Hòa</span><span>✓</span></button>
            <button onclick="goScreen('M3-S01')" class="w-full p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center font-semibold"><span>📍 TP. Quy Nhơn, Bình Định</span><span>→</span></button>
          </div>
        </div>
      `;
    }
  },

  'M1-S09': {
    id: 'M1-S09',
    module: 'M1 · Tài khoản & Khẩu vị',
    platform: 'mobile',
    title: 'Taste Profile Summary',
    subtitle: 'Hộ chiếu khẩu vị cá nhân, bộ lọc dị ứng cứng & danh sách món tạm ẩn',
    api: 'GET /v1/me/profile · PUT /v1/me/profile',
    ac: ['Hiển thị đầy đủ các tag khẩu vị Pastel và nút chuyển sang Cài đặt M1-S10'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Hồ Sơ Khẩu Vị', 'M1-S09 · Cá nhân hóa Măm AI', 'M3-S01')}

          <div class="p-4 rounded-3xl bg-[#18181B] text-white flex items-center gap-3.5 shadow-lg">
            ${k.mascotSVG('mam', 'w-16 h-18')}
            <div>
              ${k.tagPill('Độ khớp AI 94%', 'green')}
              <div class="text-base font-extrabold mt-1">Anh Long · Biên Hòa</div>
              <div class="text-[10px] text-gray-300">Ngân sách 35k–60k · Vị Bắc & Nam</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div class="p-3 rounded-2xl bg-[#FFE4E6] text-[#BE123C]"><div class="text-[10px] font-bold">🚫 Dị ứng (Chặn cứng)</div><b class="mt-0.5 block">Tôm, Cua, Đậu phộng</b></div>
            <div class="p-3 rounded-2xl bg-[#FEF3C7] text-[#B45309]"><div class="text-[10px] font-bold">🌶️ Độ cay & Chế độ</div><b class="mt-0.5 block">Cay nhẹ (1/3) · Cân bằng</b></div>
          </div>

          <button onclick="goScreen('M1-S10')" class="w-full py-3 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] font-extrabold">
            ⚙️ Cài đặt Tài khoản & Quyền riêng tư (M1-S10) →
          </button>
        </div>
      `;
    }
  },

  'M1-S10': {
    id: 'M1-S10',
    module: 'M1 · Tài khoản & Khẩu vị',
    platform: 'mobile',
    title: 'Account Settings & Data Privacy',
    subtitle: 'Quản lý sự đồng ý xử lý dữ liệu (PDPD), lịch thông báo & xóa tài khoản',
    api: 'DELETE /v1/me · PUT /v1/me/consent',
    ac: ['Tuân thủ Nghị định 13/2023/NĐ-CP (PDPD) và quy định xóa tài khoản App Store'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Cài Đặt & Dữ Liệu', 'M1-S10 · Bảo mật & PDPD', 'M1-S09')}

          <div class="bg-[#F8FAFC] rounded-3xl p-4 border border-[#E2E8F0] divide-y divide-[#E2E8F0] space-y-3">
            <div class="flex justify-between items-center pt-1"><div><b>Đồng ý cá nhân hóa bằng AI</b><div class="text-[10px] text-[#64748B]">Sử dụng khẩu vị & vị trí gợi ý món</div></div>${k.tagPill('Đang bật', 'green')}</div>
            <div class="flex justify-between items-center pt-3"><div><b>Lịch nhắc bữa ăn (10:30 & 17:00)</b><div class="text-[10px] text-[#64748B]">Tối đa 2 thông báo/ngày</div></div><button onclick="goScreen('M8-S04')" class="font-bold text-[#F59E0B]">Sửa →</button></div>
            <div class="flex justify-between items-center pt-3"><div><b>Tải xuống dữ liệu cá nhân</b><div class="text-[10px] text-[#64748B]">Định dạng JSON chuẩn PDPD</div></div><span class="font-bold text-[#1D4ED8]">Tải về</span></div>
          </div>

          <button onclick="alert('Đã gửi yêu cầu xóa tài khoản & toàn bộ dữ liệu!')" class="w-full py-3 rounded-full bg-[#FFE4E6] text-[#BE123C] font-extrabold">
            Xóa tài khoản & toàn bộ dữ liệu vĩnh viễn
          </button>
        </div>
      `;
    }
  },

  // ---------------------------------------------------------------------------
  // M2: THƯ VIỆN MÓN & CÔNG THỨC (8 MÀN HÌNH: M2-S01..S08)
  // ---------------------------------------------------------------------------
  'M2-S01': {
    id: 'M2-S01',
    module: 'M2 · Thư viện Món & Công thức',
    platform: 'mobile',
    title: 'Dish Discovery Feed',
    subtitle: 'Khám phá kho 500+ món Việt với 5 vòng tròn danh mục Pastel & thẻ ảnh lớn',
    api: 'GET /v1/dishes?featured=true',
    ac: ['Đồng bộ 5 vòng tròn Pastel và thẻ Popular Recipes từ mẫu AI Chef'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Khám Phá Món Ngon', 'M2-S01 · 542 món Việt & Công thức', 'M3-S01')}
          ${k.categoryRow()}

          <div onclick="goScreen('M2-S04')" class="bg-[#F8FAFC] rounded-3xl p-3 border border-[#E2E8F0] space-y-2.5 cursor-pointer hover:border-[#FBBF24]">
            <div class="relative h-36 rounded-2xl overflow-hidden">
              <img data-img="298" class="w-full h-full object-cover" />
              <span class="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-[#22C55E] text-white text-[10px] font-bold">✨ Món ngon ngày mát</span>
            </div>
            <div class="flex justify-between items-baseline"><b class="text-sm">Phở Bò Tái Nạm Hà Nội</b><b class="text-[#D97736] text-sm">45.000đ</b></div>
            <div class="flex gap-1.5">${k.tagPill('25 phút', 'yellow')}${k.tagPill('480 kcal', 'blue')}${k.tagPill('Dễ nấu', 'green')}</div>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div onclick="goScreen('M2-S04')" class="bg-[#F8FAFC] p-2.5 rounded-2xl border border-[#E2E8F0] space-y-1.5 cursor-pointer"><img data-img="304" class="w-full h-24 rounded-xl object-cover"/><b>Cơm Tấm Sườn Bì</b><div class="text-[10px] text-[#64748B]">40.000đ · 620 kcal</div></div>
            <div onclick="goScreen('M2-S04')" class="bg-[#F8FAFC] p-2.5 rounded-2xl border border-[#E2E8F0] space-y-1.5 cursor-pointer"><img data-img="470" class="w-full h-24 rounded-xl object-cover"/><b>Bánh Mì Thịt Nướng</b><div class="text-[10px] text-[#64748B]">25.000đ · 390 kcal</div></div>
          </div>
        </div>
      `;
    }
  },

  'M2-S02': {
    id: 'M2-S02',
    module: 'M2 · Thư viện Món & Công thức',
    platform: 'mobile',
    title: 'Dish Search & Multi-Filter',
    subtitle: 'Tìm kiếm tiếng Việt có dấu / không dấu & lọc theo nhãn Pastel',
    api: 'GET /v1/dishes?q=bun+bo&budget_max=50000',
    ac: ['Tìm chính xác cả "bun bo" không dấu lẫn "bún bò" có dấu'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Tìm Kiếm Món & Quán', 'M2-S02 · Hỗ trợ tiếng Việt không dấu', 'M2-S01')}
          <div class="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#F8FAFC] border-2 border-[#FBBF24]">
            <span class="font-extrabold">🔍 bun bo hue</span>
            <span class="text-[#64748B]">✕</span>
          </div>
          <div class="flex flex-wrap gap-1.5">${k.tagPill('Dưới 55k ✓', 'yellow')}${k.tagPill('Món nước ✓', 'blue')}${k.tagPill('🚫 Ẩn Hải sản', 'rose')}</div>
          <div onclick="goScreen('M2-S04')" class="bg-white p-3 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center gap-3 cursor-pointer">
            <img data-img="310" class="w-16 h-16 rounded-xl object-cover" />
            <div class="flex-1"><div class="font-extrabold text-sm">Bún Bò Huế O Xuân</div><div class="text-[10px] text-[#64748B]">520 kcal · 8 quán gần bạn</div><div class="font-extrabold text-[#D97736] mt-0.5">50.000đ</div></div>
            ${k.icon('arrowRight', 'w-4 h-4 text-[#94A3B8]')}
          </div>
        </div>
      `;
    }
  },

  'M2-S03': {
    id: 'M2-S03',
    module: 'M2 · Thư viện Món & Công thức',
    platform: 'mobile',
    title: 'Category & Region Explorer',
    subtitle: 'Bản đồ ẩm thực Bắc – Trung – Nam & Phân nhóm món ăn',
    api: 'GET /v1/dishes/categories',
    ac: ['Thẻ vùng miền giàu hình ảnh kèm số lượng món & công thức'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Vùng Miền & Danh Mục', 'M2-S03 · Tinh hoa 3 Miền', 'M2-S01')}
          <div onclick="goScreen('M2-S04')" class="relative h-28 rounded-2xl overflow-hidden cursor-pointer"><img data-img="034" class="w-full h-full object-cover"/><div class="absolute inset-0 bg-black/50 p-3.5 flex flex-col justify-end text-white">${k.tagPill('142 món', 'yellow')}<b class="text-base mt-1">Ẩm Thực Miền Bắc</b></div></div>
          <div onclick="goScreen('M2-S04')" class="relative h-28 rounded-2xl overflow-hidden cursor-pointer"><img data-img="310" class="w-full h-full object-cover"/><div class="absolute inset-0 bg-black/50 p-3.5 flex flex-col justify-end text-white">${k.tagPill('118 món', 'orange')}<b class="text-base mt-1">Hương Vị Miền Trung</b></div></div>
          <div onclick="goScreen('M2-S04')" class="relative h-28 rounded-2xl overflow-hidden cursor-pointer"><img data-img="304" class="w-full h-full object-cover"/><div class="absolute inset-0 bg-black/50 p-3.5 flex flex-col justify-end text-white">${k.tagPill('195 món', 'green')}<b class="text-base mt-1">Món Ngon Miền Nam</b></div></div>
        </div>
      `;
    }
  },

  'M2-S04': {
    id: 'M2-S04',
    module: 'M2 · Thư viện Món & Công thức',
    platform: 'mobile',
    title: 'Dish & Recipe Detail (Benchmark Screen 2)',
    subtitle: 'Ảnh món tràn viền + 3 chỉ số (Rating/Servings/Kcal) + 4 thẻ Nguyên liệu ảnh tròn + Step by Step + Nút Vàng Start Cooking',
    api: 'GET /v1/dishes/{id} · GET /v1/dishes/{id}/similar',
    ac: ['Bám sát 100% bố cục Screen 2 trong ảnh mẫu AI Chef', '4 thẻ nguyên liệu có ảnh tròn trực quan + Nút vàng ✨ Start Cooking'],
    render: () => {
      const s = window.appState.servings || 2;
      const f = s / 2;
      const k = window.UI_KIT;
      return `
        <div class="bg-white text-[#0F172A] text-xs pb-4">
          <div class="relative h-52 w-full">
            <img data-img="034" class="w-full h-full object-cover" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20"></div>
            <div class="absolute top-3 inset-x-3 flex items-center justify-between">
              <button onclick="goScreen('M3-S01')" class="w-9 h-9 rounded-full bg-white/95 text-[#0F172A] flex items-center justify-center shadow-md">${k.icon('arrowLeft', 'w-4 h-4')}</button>
              <div class="flex items-center gap-2">
                <button onclick="goScreen('M2-S08')" class="w-9 h-9 rounded-full bg-white/95 text-[#0F172A] flex items-center justify-center shadow-md">${k.icon('bookmark', 'w-4 h-4')}</button>
                <button onclick="goScreen('M4-S01')" class="w-9 h-9 rounded-full bg-white/95 text-[#0F172A] flex items-center justify-center shadow-md font-extrabold">⋮</button>
              </div>
            </div>
            <div class="absolute bottom-7 left-3.5 flex items-center gap-2">
              <span class="px-2.5 py-1 rounded-full bg-white/95 text-[#0F172A] text-[10px] font-extrabold inline-flex items-center gap-1 shadow">${k.icon('clock', 'w-3 h-3')} <span>25 phút</span></span>
              <span class="px-2.5 py-1 rounded-full bg-white/95 text-[#0F172A] text-[10px] font-extrabold inline-flex items-center gap-1 shadow">${k.icon('chefHat', 'w-3 h-3')} <span>Dễ nấu</span></span>
            </div>
          </div>

          <div class="rounded-t-3xl -mt-5 bg-white px-4 pt-4 space-y-3.5 relative z-10">
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-extrabold text-[#0F172A]">Phở Bò Tái Nạm Hà Nội</h3>
                <button class="text-[#0F172A] hover:text-[#EF4444]">${k.icon('heart', 'w-5 h-5')}</button>
              </div>
              <p class="text-[11px] text-[#64748B] leading-relaxed">Nước dùng xương bò ninh thảo quả thơm dịu, thịt bò thăn mềm ngọt chuẩn vị truyền thống cho mọi bữa ăn.</p>
            </div>

            <div class="grid grid-cols-3 divide-x divide-[#E2E8F0] bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl py-2.5 px-2 text-center">
              <div class="flex items-center justify-center gap-1.5">
                ${k.icon('star', 'w-4 h-4')}
                <div class="text-left"><div class="font-extrabold text-xs">4.8</div><div class="text-[9px] text-[#64748B]">(1.2k reviews)</div></div>
              </div>
              <div onclick="changeServings(1)" class="flex items-center justify-center gap-1.5 cursor-pointer">
                <span class="text-[#334155]">${k.icon('utensils', 'w-4 h-4')}</span>
                <div class="text-left"><div class="font-extrabold text-xs">${s} Người</div><div class="text-[9px] text-[#F59E0B] font-bold">Đổi +/-</div></div>
              </div>
              <div onclick="goScreen('M2-S05')" class="flex items-center justify-center gap-1.5 cursor-pointer">
                <span class="text-[#F97316]">${k.icon('flame', 'w-4 h-4')}</span>
                <div class="text-left"><div class="font-extrabold text-xs">${Math.round(480 * f)} kcal</div><div class="text-[9px] text-[#64748B]">Chi tiết</div></div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h4 class="font-extrabold text-xs">Ingredients (Nguyên liệu)</h4>
                <button onclick="goScreen('M2-S06')" class="text-[10px] font-bold text-[#64748B] flex items-center gap-0.5"><span>Xem tất cả</span>${k.icon('arrowRight', 'w-3 h-3')}</button>
              </div>
              <div class="grid grid-cols-4 gap-2 text-center">
                <div class="bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl p-2 space-y-1"><img data-img="034" class="w-10 h-10 rounded-full mx-auto object-cover border border-white shadow-sm"/><div class="font-extrabold text-[10px] truncate">Bánh phở</div><div class="text-[9px] text-[#64748B]">${Math.round(350 * f)}g</div></div>
                <div class="bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl p-2 space-y-1"><img data-img="298" class="w-10 h-10 rounded-full mx-auto object-cover border border-white shadow-sm"/><div class="font-extrabold text-[10px] truncate">Thịt bò</div><div class="text-[9px] text-[#64748B]">${Math.round(250 * f)}g</div></div>
                <div class="bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl p-2 space-y-1"><img data-img="304" class="w-10 h-10 rounded-full mx-auto object-cover border border-white shadow-sm"/><div class="font-extrabold text-[10px] truncate">Gừng & Tỏi</div><div class="text-[9px] text-[#64748B]">${Math.round(4 * f)} củ</div></div>
                <div class="bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl p-2 space-y-1"><img data-img="310" class="w-10 h-10 rounded-full mx-auto object-cover border border-white shadow-sm"/><div class="font-extrabold text-[10px] truncate">Nước dùng</div><div class="text-[9px] text-[#64748B]">${(1.0 * f).toFixed(1)} lít</div></div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h4 class="font-extrabold text-xs">Step by Step</h4>
                <button onclick="goScreen('M2-S07')" class="text-[10px] font-bold text-[#64748B] flex items-center gap-0.5"><span>Xem tất cả</span>${k.icon('arrowRight', 'w-3 h-3')}</button>
              </div>
              <div onclick="goScreen('M2-S07')" class="bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl p-2.5 flex items-center gap-2.5 cursor-pointer">
                <span class="w-6 h-6 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold text-[11px] flex items-center justify-center shrink-0">1</span>
                <div class="flex-1 min-w-0">
                  <div class="font-extrabold text-xs">Chần bánh phở & Chan nước dùng</div>
                  <p class="text-[10px] text-[#64748B] truncate">Trụng bánh phở trong nước sôi, xếp thịt bò và chan nước dùng.</p>
                  <span class="text-[9px] text-[#64748B] inline-flex items-center gap-0.5 mt-0.5">${k.icon('clock', 'w-2.5 h-2.5')} 5 phút</span>
                </div>
                <img data-img="298" class="w-12 h-12 rounded-xl object-cover shrink-0" />
              </div>
            </div>

            <button onclick="goScreen('M2-S07')" class="w-full py-3 rounded-full bg-[#FBBF24] hover:bg-[#F59E0B] text-[#0F172A] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md">
              ${k.icon('sparkles', 'w-4 h-4')}
              <span>Start Cooking (Bắt đầu nấu)</span>
            </button>
          </div>
        </div>
      `;
    }
  },

  'M2-S05': {
    id: 'M2-S05',
    module: 'M2 · Thư viện Món & Công thức',
    platform: 'mobile',
    title: 'Recipe Nutrition & Macro Ring',
    subtitle: 'Vòng tròn Kcal & Macro dinh dưỡng C/F/P cùng Mascot Lá 3D',
    api: 'GET /v1/dishes/{id}/recipe',
    ac: ['Vòng tròn Kcal trực quan kết hợp nhận xét dinh dưỡng của Mascot Lá'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Phân Tích Dinh Dưỡng', 'M2-S05 · Macro & Kcal Ring', 'M2-S04')}

          <div class="bg-[#F8FAFC] rounded-3xl p-4 border border-[#E2E8F0] text-center space-y-3">
            <div class="w-28 h-28 rounded-full border-8 border-[#22C55E] bg-white mx-auto flex flex-col items-center justify-center shadow-sm">
              <span class="text-[10px] text-[#64748B] font-bold">Kcal / Tô</span>
              <span class="text-2xl font-extrabold">480</span>
              <span class="text-[9px] text-[#16A34A] font-bold">C:59 | F:18 | P:32</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="p-2 rounded-xl bg-white border border-[#E2E8F0]"><div class="text-[10px] text-[#64748B]">Carbs</div><b>59g</b></div>
              <div class="p-2 rounded-xl bg-white border border-[#E2E8F0]"><div class="text-[10px] text-[#64748B]">Protein</div><b class="text-[#16A34A]">32g</b></div>
              <div class="p-2 rounded-xl bg-white border border-[#E2E8F0]"><div class="text-[10px] text-[#64748B]">Fat</div><b>18g</b></div>
            </div>
          </div>

          ${k.mascotTip('la', 'Lá đánh giá: Rất cân bằng!', 'Giàu đạm sắt từ thịt bò thăn, ít chất béo bão hòa nếu hớt bọt nước dùng.', 'bg-[#DCFCE7] border-[#BBF7D0]')}

          <button onclick="goScreen('M2-S06')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">
            Xem Định lượng & Scale khẩu phần (M2-S06) →
          </button>
        </div>
      `;
    }
  },

  'M2-S06': {
    id: 'M2-S06',
    module: 'M2 · Thư viện Món & Công thức',
    platform: 'mobile',
    title: 'Ingredients & Dynamic Portion Scaler',
    subtitle: 'Tự động nhân chia định lượng nguyên liệu (gram/ml) theo số người ăn',
    api: 'GET /v1/dishes/{id}/ingredients?servings=2',
    ac: ['Bấm +/- đổi số người ăn, tự động tính lại gram và chi phí đi chợ'],
    render: () => {
      const s = window.appState.servings || 2;
      const f = s / 2;
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Quy Đổi Khẩu Phần', 'M2-S06 · Tự động nhân chia định lượng', 'M2-S04')}

          <div class="p-3.5 rounded-3xl bg-[#18181B] text-white flex items-center justify-between shadow-lg">
            <div>
              <div class="font-extrabold text-sm text-[#FBBF24]">Số người ăn</div>
              <div class="text-[10px] text-gray-300">Chi phí đi chợ: <b>${(55000 * f).toLocaleString('vi-VN')}đ</b></div>
            </div>
            <div class="flex items-center gap-2.5">
              <button onclick="changeServings(-1)" class="w-8 h-8 rounded-full bg-white/15 font-extrabold text-sm">-</button>
              <span class="font-extrabold text-sm min-w-[56px] text-center">${s} người</span>
              <button onclick="changeServings(1)" class="w-8 h-8 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold text-sm">+</button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2.5"><img data-img="034" class="w-11 h-11 rounded-full object-cover"/><div><b>Bánh phở tươi</b><div class="text-[#B45309] font-extrabold">${Math.round(350 * f)}g</div></div></div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2.5"><img data-img="298" class="w-11 h-11 rounded-full object-cover"/><div><b>Thịt bò thăn</b><div class="text-[#B45309] font-extrabold">${Math.round(250 * f)}g</div></div></div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2.5"><img data-img="304" class="w-11 h-11 rounded-full object-cover"/><div><b>Gừng & Thảo quả</b><div class="text-[#B45309] font-extrabold">${Math.round(40 * f)}g</div></div></div>
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2.5"><img data-img="310" class="w-11 h-11 rounded-full object-cover"/><div><b>Nước dùng xương</b><div class="text-[#B45309] font-extrabold">${(1.0 * f).toFixed(1)} lít</div></div></div>
          </div>

          <button onclick="goScreen('M2-S07')" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold shadow-md">
            ✨ Chuyển sang Các bước nấu (M2-S07) →
          </button>
        </div>
      `;
    }
  },

  'M2-S07': {
    id: 'M2-S07',
    module: 'M2 · Thư viện Món & Công thức',
    platform: 'mobile',
    title: 'Step-by-Step Cooking Mode',
    subtitle: 'Hướng dẫn nấu từng bước cùng Mascot Bếp 3D, ảnh minh họa & đồng hồ bấm giờ',
    api: 'GET /v1/dishes/{id}/steps',
    ac: ['Số thứ tự tròn vàng #FBBF24 + Ảnh bước nấu bên phải + Timer đếm ngược'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Step by Step Cooking', 'M2-S07 · Hướng dẫn nấu từng bước', 'M2-S04')}
          ${k.mascotTip('bep', 'Bếp đồng hành cùng anh!', 'Bấm vào đồng hồ ở từng bước để hẹn giờ báo khi nước dùng sôi nhé!')}

          <div class="space-y-2.5">
            <div class="bg-[#F8FAFC] border-2 border-[#FBBF24] rounded-2xl p-3 flex items-center gap-2.5">
              <span class="w-6 h-6 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold flex items-center justify-center shrink-0">1</span>
              <div class="flex-1"><div class="font-extrabold">Nướng gừng & Đun nước dùng</div><p class="text-[10px] text-[#64748B]">Nướng thơm gừng, hành tím, thảo quả rồi thả vào nồi nước dùng.</p>${k.tagPill('⏱️ 05:00 Đang đếm', 'yellow')}</div>
              <img data-img="034" class="w-12 h-12 rounded-xl object-cover shrink-0" />
            </div>
            <div class="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-3 flex items-center gap-2.5">
              <span class="w-6 h-6 rounded-full bg-[#E2E8F0] text-[#0F172A] font-extrabold flex items-center justify-center shrink-0">2</span>
              <div class="flex-1"><div class="font-extrabold">Trụng bánh phở & Xếp thịt bò</div><p class="text-[10px] text-[#64748B]">Chần bánh phở 15 giây, xếp thịt bò thái mỏng lên trên.</p></div>
              <img data-img="298" class="w-12 h-12 rounded-xl object-cover shrink-0" />
            </div>
          </div>

          <button onclick="goScreen('M3-S06')" class="w-full py-3 rounded-full bg-[#22C55E] text-white font-extrabold shadow-md">
            ✓ Hoàn thành nấu & Lưu vào Đã ăn hôm nay
          </button>
        </div>
      `;
    }
  },

  'M2-S08': {
    id: 'M2-S08',
    module: 'M2 · Thư viện Món & Công thức',
    platform: 'mobile',
    title: 'Favorite Collections (Đã lưu)',
    subtitle: 'Quản lý món ăn yêu thích & Bộ sưu tập cá nhân',
    api: 'GET /v1/me/favorites · POST /v1/me/collections',
    ac: ['Hiển thị bộ sưu tập theo chủ đề kèm nhãn Pastel'],
    render: () => {
      const k = window.UI_KIT;
      return `
        <div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">
          ${k.mobileHeader('Món Ngon Đã Lưu', 'M2-S08 · Bộ sưu tập cá nhân', 'M3-S01')}
          <div class="grid grid-cols-2 gap-2.5">
            <div onclick="goScreen('M2-S04')" class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 cursor-pointer"><img data-img="298" class="w-full h-24 rounded-xl object-cover"/>${k.tagPill('6 món', 'blue')}<div class="font-extrabold">Món Ấm Ngày Mưa</div></div>
            <div onclick="goScreen('M2-S04')" class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 cursor-pointer"><img data-img="304" class="w-full h-24 rounded-xl object-cover"/>${k.tagPill('8 món', 'yellow')}<div class="font-extrabold">Bữa Trưa 40k Nhanh</div></div>
          </div>
        </div>
      `;
    }
  }
};
