/* P2 wiring for the repo's existing designs. No replacement product shell.
 * /studio retains the unmodified design-tool behavior. On product routes, bind
 * those same screen templates/components to API data and real user actions.
 */
(function () {
  if (!["/", "/app"].includes(location.pathname)) return;
  document.body.classList.add("product-mode");
  document.title = "Hôm nay ăn gì · Taste of Vietnam";
  const H = window.escHtml,
    J = window.escJs,
    K = window.UI_KIT;
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
  // <m2-real-data> Pure helpers: screen text comes from API data, never invented.
  // Owner rule (26/11): original elements stay in place. A feature that is not live
  // shows a "chưa mở / sắp có" state; flip its flag (or return data from its hook)
  // to switch it on. Flags only enable code paths that already exist below.
  const FEATURES = (window.TOV_FEATURES = {
    placeFilters: false, // M4-S01 chips "Dưới 50k / Máy lạnh / Giao hàng"
    mealReminders: false, // M1-S10 "Lịch nhắc bữa ăn" → M8-S04 (M8 frozen)
    adsModeration: false, // M9-S07 "Kiểm duyệt Ads M7" (M7 frozen)
    adminMetrics: false, // M9 latency/accuracy/safety figures (no metrics source)
    phoneLogin: false, // M1-S01 phone/OTP card + desktop login phone fields (SMS not set up)
    zaloLogin: false, // M1-S01 "Zalo" button (no Zalo login)
    appleLogin: false, // M1-S01 "Apple" button (no Apple login)
    searchFilters: false, // M2-S02 chip row "Dưới 55k / Món nước / Ẩn Hải sản"
    collections: false, // M2-S08 per-card collection chip "N món"
    // M5-S02: partners the server redirect allowlist accepts (src/services/redirectService.js).
    orderPartners: ["grabfood", "shopeefood"],
    // <m5-frozen> Owner decision 26/11 "Mở lại, xem được thiết kế": the 54 out-of-scope
    // screens show their original design as an inert "sắp có" preview. One switch for all
    // (false = the old "chưa mở" block everywhere) plus one per module:
    //   "preview" = design view, no API calls; "off" = old block; "live" = reserved for a
    //   module that has real wiring registered in FROZEN_LIVE (none yet → falls back to preview).
    frozenPreview: true,
    frozenModules: {
      W: "preview", M6: "preview", M7: "preview", M8: "preview", M10: "preview",
      M11: "preview", M12: "preview", M13: "preview", M14: "preview", M15: "preview",
      M16: "preview", M17: "preview", M18: "preview", M19: "preview", M20: "preview",
    },
    ...(window.TOV_FEATURES || {}),
  });
  const SOON = " · sắp có";
  function soon(el, why) {
    // Visible "not live yet" state for an original element; keeps it in the layout.
    if (!el) return;
    el.setAttribute("aria-disabled", "true");
    el.title = why;
    el.style.opacity = "0.6";
    el.removeAttribute("onclick");
    if (el.tagName === "BUTTON") el.disabled = true;
  }
  // Frozen modules with real wiring would register here (module → true). None today.
  const FROZEN_LIVE = {};
  const moduleOf = (id) => String(id).split("-")[0];
  function frozenMode(id) {
    if (/^M[1-59]-/.test(id)) return "core";
    if (!FEATURES.frozenPreview) return "off";
    const m = (FEATURES.frozenModules || {})[moduleOf(id)] || "off";
    return m === "live" && !FROZEN_LIVE[moduleOf(id)] ? "preview" : m;
  }
  // API paths owned by frozen modules (payments, orders, merchant, bookings, ...). The
  // product UI never calls them unless that module is live; previews make no calls at all.
  const FROZEN_API = [
    ["/api/v1/merchant/", "M6"], ["/api/v1/ads/payments/", "M7"], ["/api/v1/ads/campaigns", "M7"],
    ["/api/v1/payments/", "M7"], ["/api/v1/notifications", "M8"], ["/api/v1/me/meal-schedule", "M8"],
    ["/api/v1/analytics/", "M10"], ["/api/v1/meal-plans", "M11"], ["/api/v1/meal-planner", "M11"],
    ["/api/v1/groceries", "M11"], ["/api/v1/polls", "M12"], ["/api/v1/reviews/gps", "M12"],
    ["/api/v1/bookings", "M13"], ["/api/v1/vouchers", "M13"], ["/api/v1/stories", "M14"],
    ["/api/v1/tourism/", "M15"], ["/api/v1/translate/menu", "M16"], ["/api/v1/enterprise/", "M17"],
    ["/api/v1/fridge/", "M18"], ["/api/v1/health/", "M19"], ["/api/v1/community/recipes", "M20"],
  ];
  function frozenApi(pathname) {
    const hit = FROZEN_API.find(([p]) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(p + "/")));
    if (!hit) return null;
    // Only a module switched to "live" with real wiring registered may reach its API.
    return frozenMode(hit[1] + "-S01") === "live" ? null : hit[1];
  }
  // Preview-only content that could mislead a real user is blanked (see notes).
  const FROZEN_BLANK = [
    [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "email-mau@…"],
    [/\b0121000889999\b/g, "•••• (mẫu)"],
  ];
  const NAV_CALL = /^\s*goScreen\('([A-Za-z0-9-]+)'\)\s*;?\s*$/;
  const NOTICE = 'P2.frozenNotice()';
  function frozenInert(html, screens = {}) {
    // String-level so it runs before the markup reaches the DOM (and in tests).
    let out = String(html || "").replace(/\s(on[a-z]+)\s*=\s*("([^"]*)"|'([^']*)')/gi, (all, name, _q, dq, sq) => {
      const v = dq ?? sq ?? "";
      const nav = v.match(NAV_CALL);
      if (name.toLowerCase() === "onclick") return nav && screens[nav[1]] ? ` onclick="goScreen('${nav[1]}')"` : ` onclick="${NOTICE}"`;
      return "";
    });
    out = out.replace(/\s(href|action|formaction|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "")
      .replace(/\s(href|action|formaction)\s*=\s*("[^"]*"|'[^']*')/gi, "")
      .replace(/<a\b(?![^>]*\sonclick=)/gi, `<a onclick="${NOTICE}"`)
      .replace(/<form\b/gi, `<form onsubmit="event.preventDefault();${NOTICE}"`)
      .replace(/\stype\s*=\s*("submit"|'submit')/gi, ' type="button"')
      .replace(/<select\b/gi, "<select disabled")
      .replace(/<textarea\b/gi, "<textarea readonly")
      .replace(/<input\b([^>]*)>/gi, (all, attrs) => {
        const t = (attrs.match(/\stype\s*=\s*["']?(\w+)/i) || [])[1]?.toLowerCase() || "text";
        if (["checkbox", "radio"].includes(t))
          return `<input${attrs.replace(/\sonclick="[^"]*"/i, "")} onclick="event.preventDefault();${NOTICE}">`;
        if (["file", "range", "color", "date", "time"].includes(t)) return `<input disabled${attrs}>`;
        return `<input readonly${attrs}>`;
      });
    for (const [re, to] of FROZEN_BLANK) out = out.replace(re, to);
    return out;
  }
  const FROZEN_LABEL = "Bản xem trước thiết kế · sắp có";
  function frozenBanner(id) {
    return `<div data-frozen-banner="${H(id)}" role="note" style="position:sticky;top:0;z-index:30" class="m-2 p-2.5 rounded-xl bg-[#FEF3C7] border border-[#F59E0B] text-[#92400E] text-[11px] font-extrabold shadow-sm">👁️ ${FROZEN_LABEL}<span class="block font-medium mt-0.5">Số tiền, tên, tài khoản và số liệu trên màn này là mẫu minh hoạ, không phải dữ liệu thật. Các nút chưa hoạt động.</span></div>`;
  }
  function frozenPreviewHtml(id, html, screens) {
    return `<div data-frozen-preview="${H(id)}" data-module="${H(moduleOf(id))}">${frozenBanner(id)}${frozenInert(html, screens)}</div>`;
  }
  // Desktop Live App tabs that belong to frozen modules, and the designs they show.
  const FROZEN_TABS = {
    mealplan: ["M11"], poll: ["M12"], merchant: ["M6", "M7"], booking: ["M13"],
    stories: ["M14", "M15"], translator: ["M16"], insights: ["M17"], analytics: ["M10"],
    notifications: ["M8"], fridge: ["M18"], health: ["M19"], community: ["M20"],
  };
  const tabMode = (tab) => (FROZEN_TABS[tab] || []).some((m) => frozenMode(m + "-S01") === "preview") ? "preview" : "off";
  // </m5-frozen>
  // <m6-wording> Owner decision 26/11 "Sửa cho đúng thực tế": copy that claims more than
  // the code does is reworded (words only, same element/place/style). Allergy copy says
  // what is filtered and asks the user to confirm with the restaurant.
  const ALLERGY_VI = {
    shrimp: "tôm/hải sản", peanut: "đậu phộng", shrimp_paste: "mắm tôm", dairy: "sữa", milk: "sữa",
    egg: "trứng", gluten: "gluten", fish: "cá", soy: "đậu nành", shellfish: "hải sản có vỏ",
  };
  function allergyLine(tags) {
    // From /suggestions/today applied_allergies (the tags the list was really filtered by).
    const list = [...new Set((tags || []).map((t) => ALLERGY_VI[t] || t))];
    return list.length
      ? "Đã lọc món có " + list.join(", ") + " theo thành phần đã ghi, hãy xác nhận lại với quán"
      : "Chưa khai báo dị ứng, chưa lọc món nào";
  }
  const WORDING = [
    // M1-S05 (allergy step): the filter removes dishes whose recorded tags match.
    [/Hard Filter · Chặn tuyệt đối 100%/g, "Hard Filter · Lọc theo thành phần món"],
    [/Mọi thành phần anh đánh dấu dưới đây sẽ bị chặn cứng 100%, kể cả trong slot Tài trợ\./g,
      "Món có thành phần anh đánh dấu dưới đây sẽ không được gợi ý, kể cả slot Tài trợ (theo thành phần đã ghi của món). Hãy xác nhận lại với quán khi gọi món."],
    [/🚫 Dị ứng \(Chặn cứng\)/g, "🚫 Dị ứng (Lọc khỏi gợi ý)"],
    [/Định dạng JSON chuẩn PDPD/g, "Định dạng JSON"],
    [/✨ Món ngon ngày mát/g, "✨ Món ngon hôm nay"],
    [/M3-S03 · Đã lọc 100% dị ứng & Cooldown 3 ngày/g, "M3-S03 · Lọc theo dị ứng đã khai báo & không lặp món 3 ngày"],
    [/Bộ lọc AI: 0% Dị ứng · 0% Lặp món 3 ngày qua/g, "Đã lọc: dị ứng đã khai báo · món đã ăn 3 ngày qua"],
    [/M4-S04 · Chuẩn hóa bởi AI OCR/g, "M4-S04 · Theo thực đơn quán đã nhập"],
    [/M4-S05 · Cập nhật thời gian thực/g, "M4-S05 · Theo thực đơn đã nhập, chưa cập nhật trực tiếp"],
    [/Grab \/ Shopee \/ Xanh SM/g, "Grab / Shopee"],
    [/, Kcal và vector 1536-dim cho tìm kiếm tương đồng/g, ", Kcal; vector tìm kiếm tương đồng sắp có"],
    [/Chuẩn hóa định lượng gram\/ml và thông số Kcal cùng chuyên gia dinh dưỡng/g, "Chuẩn hóa định lượng gram/ml và thông số Kcal"],
    [/LLM không tự nghĩ ra quán ăn, mọi quán đều được xác minh thực tế/g, "LLM không tự nghĩ ra quán ăn, quán chỉ được xác minh khi có bằng chứng thực tế"],
    [/^Đạt chuẩn An toàn$/g, "Chưa kiểm duyệt · sắp có"],
    [/✔ Có nhãn Tài trợ · ✔ Đã khai báo mắm ruốc\/độ cay · ✔ Trần hiển thị ≤ 1\/3 slot/g, "Cần kiểm: nhãn Tài trợ · khai báo mắm ruốc/độ cay · trần hiển thị ≤ 1/3 slot"],
    // Desktop Live App.
    [/Đã loại trừ hải sản & đậu phộng/g, "Lọc theo dị ứng đã khai báo"],
    [/Trợ lý đầu bếp thông minh · Am hiểu 600\+ món ăn Việt Nam/g, "Trợ lý đầu bếp thông minh · Gợi ý từ thư viện món của ứng dụng"],
    [/Thư viện 600\+ món ăn truyền thống/g, "Thư viện món ăn truyền thống"],
    [/Quán ngon đang mở cửa trong bán kính 3km/g, "Quán ngon trong bán kính 3km"],
    [/⭐ [\d.—]+ \([\d—]+ đánh giá\)/g, "Chưa có đánh giá thực tế"],
    [/⭐ [\d.—]+ \(([\d—]+m)\)/g, "📍 $1"],
    [/Cổng Quản Trị CMS & Kiểm Duyệt Tự Động/g, "Cổng Quản Trị CMS & Kiểm Duyệt"],
    [/Quản lý chiến dịch quảng cáo · /g, "Quản lý chiến dịch quảng cáo (sắp có) · "],
    [/chặn 100% dị ứng & tuân thủ nghiêm ngặt Nghị định/g, "lọc theo dị ứng đã khai báo & quyền dữ liệu theo Nghị định"],
    [/\(Hard Allergy Filter — Chặn 100%\):/g, "(Hard Allergy Filter):"],
    [/Tuyệt đối không đề xuất món có dị ứng/g, "Không gợi ý món có thành phần trùng dị ứng đã chọn · hãy xác nhận lại với quán"],
    [/hoặc xóa vĩnh viễn không lưu trữ bản sao/g, "hoặc xóa vĩnh viễn tài khoản (chứng từ thanh toán được giữ lại nhưng bỏ liên kết)"],
    [/^100% Compliant$/g, "Tải về & xóa dữ liệu"],
    [/Tuân Thủ Nghị Định 13\/2023\/NĐ-CP \(PDPD\) Về Dữ Liệu Cá Nhân/g, "Quyền Dữ Liệu Cá Nhân Theo Nghị Định 13/2023/NĐ-CP (PDPD)"],
    [/được bảo mật tuyệt đối, không chia sẻ/g, "được lưu để gợi ý món và quán, không chia sẻ"],
  ];
  const reword = (s) => WORDING.reduce((t, [re, to]) => t.replace(re, to), s);
  // </m6-wording>
  const REGIONS = ["bac", "trung", "nam"];
  // Segment under the pointer after the original 1560deg wheelSpin (4 turns + 120deg).
  const WHEEL_LAND = 4;
  const meters = (m) => (Number.isFinite(m) ? Math.round(m) + "m" : null);
  function wheelLabels(names, picked, slots = 8, land = WHEEL_LAND) {
    const pool = [...new Set((names || []).filter(Boolean))];
    if (picked && !pool.includes(picked)) pool.unshift(picked);
    if (!pool.length) return Array(slots).fill("");
    const start = picked ? pool.indexOf(picked) : 0;
    // The original wheel fits about 10 characters per segment at font-size 8.
    const short = (n) => (n.length > 10 ? n.slice(0, 9).trim() + "…" : n);
    return Array.from({ length: slots }, (_, i) =>
      short(pool[(((start + i - land) % pool.length) + pool.length) % pool.length]),
    );
  }
  function openStatus(p) {
    return p?.open_status?.status || (p?.is_currently_open ? "open" : "unknown");
  }
  function openChipText(items) {
    const st = (items || []).map(openStatus);
    const open = st.filter((s) => s === "open").length,
      unknown = st.filter((s) => s === "unknown" || s === "stale").length;
    return open || !unknown
      ? "● Đang mở (" + open + ")"
      : "● Chưa rõ giờ mở (" + unknown + ")";
  }
  function placeLine(p) {
    const label = {
      open: "Đang mở",
      closed: "Đang đóng",
      stale: "Giờ mở cần xác minh lại",
    }[openStatus(p)] || "Hỏi quán để xác nhận";
    return [meters(p?.distance_m), label].filter(Boolean).join(" · ");
  }
  function menuPrice(menu, dishId) {
    const m = (menu || []).find((x) => x.dish_id === dishId);
    return m ? money(m.price) + (m.name ? " · " + m.name : "") : "Chưa có giá";
  }
  function hoursNote(p) {
    return {
      open: "Quán đang mở theo giờ đã xác minh",
      closed: "Quán đang đóng",
      stale: "Giờ mở cần xác minh lại",
    }[openStatus(p)] || "Giờ mở chưa xác minh";
  }
  function weatherPill(w) {
    // live_weather comes from the server weather hook (null until a provider is set).
    return w?.label ? { text: "🌧️ " + w.label, live: true } : { text: "🌤️ Thời tiết" + SOON, live: false };
  }
  function whyText(d) {
    const s = d?.suggestion,
      place = s?.nearest_place;
    const weather = weatherPill(d?.live_weather);
    if (!s)
      return {
        title: "Món này không có trong gợi ý hôm nay",
        message: d?.description || "",
        price: d?.ref_price,
        pills: [weather.text, "📍 Chưa có quán gợi ý", "🚫 Chưa lọc dị ứng (món ngoài gợi ý)"],
        weather,
      };
    const where = place
      ? [place.place_name, meters(place.distance_m) && "cách " + meters(place.distance_m)].filter(Boolean).join(" · ")
      : "Chưa có quán gần bạn bán món này, có thể tự nấu";
    return {
      title: s.reason || "Hợp điều kiện bữa ăn bạn đã chọn",
      message: where + " · Giá " + money(s.price_vnd ?? d.ref_price) + (s.is_sponsored ? " · Gợi ý có tài trợ" : ""),
      price: s.price_vnd ?? d.ref_price,
      pills: [weather.text, place && meters(place.distance_m) ? "📍 Cách " + meters(place.distance_m) : "📍 Chưa có quán gần", "🚫 Đã lọc theo dị ứng đã khai báo"],
      weather,
      place,
    };
  }
  // </m2-real-data>
  // <m3-controls> Pure helpers for controls added inside existing screens.
  const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.0005;
  function areaRows(areas, profile) {
    const list = (areas || []).map((a) => ({
      ...a,
      selected: near(a.lat, profile?.lat) && near(a.lng, profile?.lng),
    }));
    const saved = Number.isFinite(profile?.lat) && Number.isFinite(profile?.lng) && !list.some((a) => a.selected);
    return { list, saved };
  }
  const AUDIT_ROLES = ["ops_admin", "super_admin"];
  function activityBars(totals, now = new Date()) {
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const max = Math.max(1, ...totals.map((t) => t.count));
    return totals.map((t) => ({
      ...t,
      label: days[new Date(t.day + "T12:00:00+07:00").getUTCDay()],
      height: Math.round((t.count / max) * 100),
    }));
  }
  function vnDays(n = 7, now = new Date()) {
    // Calendar days in Asia/Ho_Chi_Minh (UTC+7, no DST), oldest first.
    const local = new Date(now.getTime() + 7 * 3600000);
    return Array.from({ length: n }, (_, i) =>
      new Date(local.getTime() - (n - 1 - i) * 86400000).toISOString().slice(0, 10),
    );
  }
  // </m3-controls>
  // <m4-restore> Sample-data slots kept as visible empty placeholders (owner rule 26/11).
  function emptySlot(node, title) {
    if (!node) return;
    [node, ...$$("[onclick]", node)].forEach((n) => n.removeAttribute("onclick"));
    $$("button", node).forEach((b) => (b.disabled = true));
    const name = $(".font-extrabold", node);
    text(name, title);
    $$('[class*="D97736"]', node).forEach((n) => text(n, "—"));
    $$("span", node).forEach((n) => {
      if (/kcal/.test(n.textContent)) n.lastChild.textContent = " — kcal";
      if (/^Tài trợ$/.test(n.textContent.trim())) text(n, "Trống");
    });
    const sub = $(".text-\\[10px\\].truncate", node);
    if (sub) text(sub, "Chưa có dữ liệu");
    $$("img", node).forEach((i) => {
      i.style.filter = "grayscale(1)";
      i.style.opacity = "0.35";
      i.alt = "Chưa có món";
    });
    node.setAttribute("aria-disabled", "true");
    node.style.opacity = "0.6";
  }
  const WEATHER_SOON = "🌤️ Thời tiết · sắp có";
  function desktopWeather() {
    // Desktop Live App header + "Cá nhân hóa theo thời tiết …" line: live_weather hook only.
    const w = appState.liveToday?.live_weather;
    const badge = document.getElementById("live-weather-badge");
    const want = w?.label ? "🌧️ " + w.label : WEATHER_SOON;
    if (badge && badge.textContent !== want) {
      badge.textContent = want;
      badge.title = w?.label ? "" : "Chưa có nguồn thời tiết thật.";
      badge.style.opacity = w?.label ? "" : "0.7";
    }
    $$("#lpanel-today p").forEach((n) => {
      if (!/theo thời tiết/.test(n.textContent)) return;
      let next = n.textContent.replace(/theo thời tiết [^·]*·/, "theo thời tiết " + (w?.label || "(sắp có)") + " ·");
      // Second segment: the allergens this list was really filtered by (m6-wording).
      const applied = appState.liveToday?.applied_allergies;
      if (Array.isArray(applied)) {
        const parts = next.split(" · ");
        if (parts.length >= 3) { parts[1] = allergyLine(applied); next = parts.join(" · "); }
      }
      if (next !== n.textContent) n.textContent = next;
    });
  }
  // </m4-restore>
  const img = (el, key) => {
    if (!el) return;
    const k = /^\d+$/.test(key || "") ? key : "298";
    // The original stylesheet shrinks img[data-img="034"] to the 36px logo.
    // A dish photo that uses the same picture must keep its card size.
    if (k === "034" && window.CHATGPT_IMAGES?.[k]) {
      el.removeAttribute("data-img");
      el.src = window.CHATGPT_IMAGES[k];
    } else el.setAttribute("data-img", k);
    el.alt = "Ảnh minh họa";
  };
  const text = (el, v) => {
    if (el) el.textContent = v ?? "";
  };
  const click = (el, code) => {
    if (el) el.setAttribute("onclick", code);
  };
  const state = {
    cache: {},
    dish: null,
    place: null,
    query: "",
    region: "",
    chat: [],
    phone: "",
    otp: "",
    order: null,
  };
  const request = window.fetch.bind(window);
  window.M9_AUTH_FETCH = request;
  let lastButton = null,
    retryWrite = null;
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest("button,[onclick]");
      if (b && !b.closest("#p2-action-status")) lastButton = b;
    },
    true,
  );
  function status(message, retry = false) {
    let box = $("#p2-action-status");
    if (!box) {
      box = document.createElement("div");
      box.id = "p2-action-status";
      box.className = "genui-card p-3 text-xs";
      box.setAttribute("aria-live", "polite");
      document.body.append(box);
    }
    box.innerHTML = `<p>${H(message)}</p>${retry ? '<button type="button" onclick="P2.retryWrite()" class="mt-2 px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Thử lại</button>' : ""}<button type="button" onclick="this.parentElement.remove()" aria-label="Đóng thông báo" class="ml-3 p-2">Đóng</button>`;
  }
  // Preserve the P0 token wrapper. Add bounded requests and truthful HTTP errors.
  // GET auth responses remain available to the repo's login-required renderer.
  window.fetch = async function (input, init = {}) {
    const u = new URL(
      typeof input === "string" ? input : input.url,
      location.href,
    );
    if (u.origin !== location.origin || !u.pathname.startsWith("/api/v1/"))
      return request(input, init);
    // <m5-frozen> Frozen-module APIs (payments, orders, merchant, bookings...) are never
    // called from the product UI while the module is not live.
    if (frozenApi(u.pathname)) {
      const e = new Error("Tính năng này chưa mở trong bản hiện tại.");
      e.status = 423;
      e.frozen = true;
      throw e;
    }
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    const method = (init.method || "GET").toUpperCase(),
      button = method !== "GET" ? lastButton : null;
    if (button) button.disabled = true;
    try {
      const res = await request(input, {
        ...init,
        signal: init.signal || controller.signal,
      });
      const read = res.json.bind(res);
      res.json = async () => {
        if (!res.ok) {
          const e = new Error("Không tải được dữ liệu. Vui lòng thử lại.");
          e.status = res.status;
          throw e;
        }
        return read();
      };
      if (
        !res.ok &&
        method !== "GET" &&
        !u.pathname.startsWith("/api/v1/auth/")
      ) {
        const e = new Error(
          "Chưa lưu được. Kiểm tra kết nối hoặc đăng nhập rồi thử lại.",
        );
        e.status = res.status;
        throw e;
      }
      return res;
    } catch (e) {
      if (method !== "GET" && button) {
        retryWrite = () => button.click();
        status(
          "Chưa thực hiện được. Nội dung đã nhập vẫn được giữ. Kiểm tra kết quả trước khi gửi lại.",
          true,
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
      if (button) button.disabled = false;
    }
  };
  // Existing alerts are feedback, not proof of an API write. Errors have retry.
  window.alert = (message) => status(String(message));
  async function api(path, method = "GET", body) {
    const r = await fetch("/api/v1" + path, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    return r.json();
  }
  const action = async (job, done) => {
    retryWrite = () => action(job, done);
    try {
      status("Đang xử lý…");
      const d = await job();
      $("#p2-action-status")?.remove();
      await done?.(d);
    } catch (e) {
      if(e.status===409) {
        // Reuse the existing retry control to reload, never replay a stale version.
        retryWrite=()=>{$("#p2-action-status")?.remove();P2.reload();};
        status("Bản này đã thay đổi hoặc được xử lý. Bấm Thử lại để tải dữ liệu mới.",true);
        return;
      }
      status(
        e.status === 403
          ? "Tài khoản chưa có quyền. Hãy đăng nhập bằng số đã được cấp quyền."
          : "Chưa thực hiện được. Kiểm tra mạng hoặc phiên đăng nhập rồi thử lại.",
        true,
      );
    }
  };
  function selected() {
    return (
      state.dish || window.appState.liveToday?.items?.[0]?.dish_id || "DISH-101"
    );
  }
  function config(id) {
    if (/^M1-S(0[3-9]|10)$/.test(id))
      return ["profile", () => api("/me/profile")];
    if (id === "M2-S03")
      return [
        "regions",
        async () => {
          // Count per region from the API totals, independent of the active Explore filter.
          const r = await Promise.all(
            REGIONS.map((g) => api("/dishes?limit=1&region=" + g)),
          );
          return { counts: Object.fromEntries(REGIONS.map((g, i) => [g, r[i].total])) };
        },
      ];
    if (id === "M3-S02")
      return [
        "why:" + selected() + ":" + appState.servings,
        async () => {
          const cached = state.cache.today?.status === "success" ? state.cache.today.data : null;
          const [dish, today] = await Promise.all([
            api("/dishes/" + encodeURIComponent(selected()) + "?servings=" + (appState.servings || 2)),
            cached || api("/suggestions/today").catch(() => null),
          ]);
          if (!cached && Array.isArray(today?.items)) {
            state.cache.today = { status: "success", data: today };
            appState.liveToday = today;
          }
          return {
            ...dish,
            suggestion: today?.items?.find((a) => a.dish_id === dish.id) || null,
            live_weather: today?.live_weather ?? null,
          };
        },
      ];
    if (id === "M3-S03") return ["spin-pool", () => api("/suggestions/spin")];
    if (["M2-S01", "M2-S02"].includes(id))
      return [
        "dishes:" + state.query + ":" + state.region,
        () =>
          api(
            "/dishes?q=" +
              encodeURIComponent(state.query) +
              (state.region ? "&region=" + encodeURIComponent(state.region) : ""),
          ),
      ];
    if (/^M2-S0[4-7]$/.test(id) || id === "M3-S06")
      return [
        "dish:" + selected() + ":" + appState.servings,
        () =>
          api(
            "/dishes/" +
              encodeURIComponent(selected()) +
              "?servings=" +
              (appState.servings || 2),
          ),
      ];
    if (id === "M2-S08")
      return [
        "saved",
        async () => {
          const d = await api("/me/collections");
          const ids = [
            ...new Set((d.collections || []).flatMap((c) => c.dish_ids || [])),
          ];
          return {
            items: await Promise.all(
              ids.map((id) => api("/dishes/" + encodeURIComponent(id))),
            ),
          };
        },
      ];
    if (id === "M3-S01") return ["today", () => api("/suggestions/today")];
    if (id === "M3-S07") return ["history", () => api("/suggestions/history")];
    if (/^M[45]-/.test(id))
      return [
        "places:" + selected(),
        () => api("/places?dish_id=" + encodeURIComponent(selected())),
      ];
    if (/^M9-/.test(id))
      return [
        "admin",
        async () => {
          const [d, identity] = await Promise.all([api("/admin/dashboard"), api("/auth/me")]);
          let activity = null;
          if (AUDIT_ROLES.includes(identity.role))
            activity = await Promise.all(
              vnDays(7).map(async (day) => ({
                day,
                count: (await api("/admin/audit-logs?limit=1&from=" + encodeURIComponent(day + "T00:00:00+07:00") +
                  "&to=" + encodeURIComponent(day + "T23:59:59.999+07:00"))).total,
              })),
            );
          return {
            ...d,
            catalog: d.catalog || [],
            actor_role: identity.role,
            activity,
          };
        },
      ];
    return null;
  }
  let originalStage = renderStage,
    originalGo = goScreen;
  function paint() {
    originalStage();
    polish($("#stage-container"));
  }
  async function load(id, force = false) {
    const cfg = config(id);
    if (!cfg) return;
    const [key, get] = cfg;
    if (!force && state.cache[key]) return;
    state.cache[key] = { status: "loading" };
    if (appState.activeScreenId === id) paint();
    try {
      const data = await get();
      if (!data || typeof data !== "object" ||
          (/^(dishes:|places:|today$|saved$|history$)/.test(key) && !Array.isArray(data.items)) ||
          ((key.startsWith("dish:") || key.startsWith("why:")) && !data.id) ||
          (key === "regions" && !REGIONS.every((g) => Number.isInteger(data.counts?.[g]))) ||
          (key === "spin-pool" && !Array.isArray(data.candidates)) ||
          (key === "admin" && !Array.isArray(data.ocr_queue)))
        throw new Error("Dữ liệu chưa hợp lệ. Vui lòng thử lại.");
      state.cache[key] = { status: "success", data };
      if (key === "today") { appState.liveToday = data; desktopWeather(); }
    } catch (e) {
      state.cache[key] = { status: "error", error: e };
    }
    if (config(appState.activeScreenId)?.[0] === key) paint();
  }
  async function loadAreas(force = false) {
    if (!force && state.cache.areas?.status === "success") return;
    state.cache.areas = { status: "loading" };
    try {
      const data = await api("/areas");
      if (!Array.isArray(data?.items)) throw new Error("Dữ liệu chưa hợp lệ.");
      state.cache.areas = { status: "success", data };
    } catch (e) {
      state.cache.areas = { status: "error", error: e };
    }
    if (appState.activeScreenId === "M1-S08") paint();
  }
  const originals = {};
  function stateHtml(id, s, nested = false, err = null) {
    const msg = s === "loading" ? "Đang tải…" : s === "empty" ? "Chưa có kết quả phù hợp" : (err?.status === 401 || err?.status === 403) ? "Mục này cần đăng nhập bằng tài khoản được cấp quyền." : "Chưa tải được. Kiểm tra mạng rồi thử lại.";
    const needsLogin = s === "error" && (err?.status === 401 || err?.status === 403);
    const card = `<div class="p-5 rounded-3xl bg-[#F8FAFC] border border-[#E2E8F0] text-center space-y-3" role="${s === "loading" ? "status" : "alert"}">${K.mascotSVG("mam", "w-20 h-24 mx-auto")}<div class="font-extrabold">${msg}</div>${s === "error" ? `<button onclick="P2.reload()" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Thử lại</button>${needsLogin ? `<button onclick="goScreen('M1-S01')" class="w-full py-2 rounded-full bg-white border border-[#E2E8F0]">Đăng nhập</button>` : ""}` : ""}</div>`;
    if (nested) return card;
    // Reuse the screen's own original header (title, subtitle, back target).
    let header = "";
    try {
      const t = document.createElement("template");
      t.innerHTML = originals[id] ? originals[id]() : "";
      const first = t.content.firstElementChild?.firstElementChild;
      if (first && first.matches(".flex.items-center.justify-between.pb-1")) header = first.outerHTML;
    } catch (_) {}
    if (!header) header = K.mobileHeader(({M1:"Hồ sơ khẩu vị",M2:"Khám phá món ngon",M3:"Gợi ý bữa ăn",M4:"Quán quanh bạn",M5:"Thưởng thức",M9:"Quản trị nội dung"})[id.split("-")[0]], "", "M3-S01");
    return `<div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">${header}${card}</div>`;
  }
  function rows(parent, template, items, bind) {
    parent.innerHTML = "";
    items.forEach((item, i) => {
      const node = template.cloneNode(true);
      bind(node, item, i);
      parent.append(node);
    });
  }
  function clearAfter(root, count) {
    [...root.children].slice(count).forEach((n) => n.remove());
  }
  function cardFill(node, d) {
    img($("img", node), d.img_key);
    text($('b,[class*="font-extrabold"]', node), d.name || d.dish_name);
    click(node, `P2.dish('${J(d.id || d.dish_id)}')`);
  }
  function mobile(id, html, d) {
    const t = document.createElement("template");
    t.innerHTML = html;
    const root = t.content.firstElementChild;
    if (id === "M3-S01") {
      // Keep the repo's two photo cards + horizontal sponsored card intact.
      const items = d.items || [];
      if (!items.length) return stateHtml(id, "empty");
      const cards = $$(".grid-cols-2 > .group", root);
      // Heading count follows the real list ("Gợi ý Hôm nay (3 món AI)" in the design).
      $$("h4", root).forEach((h) => {
        if (/Gợi ý Hôm nay \(\d+ món AI\)/.test(h.textContent))
          h.textContent = h.textContent.replace(/\(\d+ món AI\)/, "(" + items.length + " món AI)");
      });
      cards.forEach((node, i) => {
        const a = items[i];
        if (!a) {
          // Keep the design's 2-column slot; an empty grid cell would change the layout.
          emptySlot(node, "Chưa có thêm món phù hợp");
          return;
        }
        img($("img", node), a.img_key);
        $$('[onclick*="M2-S04"]', node).forEach((n) =>
          click(n, `P2.dish('${J(a.dish_id)}')`),
        );
        const heart = $("span.absolute", node);
        if (heart) click(heart, `event.stopPropagation();P2.save('${J(a.dish_id)}')`);
      });
      const third = $('[onclick*="M4-S03"]', root);
      if (third) {
        const a = items[2];
        if (!a) emptySlot(third, "Chưa có gợi ý thứ ba");
        else {
          img($("img", third), a.img_key);
          click(third, `P2.dish('${J(a.dish_id)}','M4-S01')`);
        }
      }
      text(
        $("div.text-lg > span", root),
        state.cache.profile?.data?.name || "Bạn",
      );
    }
    if (["M2-S01", "M2-S02", "M2-S08"].includes(id)) {
      const items = d.items || [];
      if (id === "M2-S01") {
        const featured = $('[onclick*="M2-S04"]', root),
          small = $(".grid.grid-cols-2", root),
          tpl = small?.firstElementChild?.cloneNode(true);
        if (!items.length) return stateHtml(id, "empty");
        cardFill(featured, items[0]);
        text($("b.text-sm", featured), items[0].name);
        text($('b[class*="D97736"]', featured), money(items[0].ref_price));
        if (small && tpl)
          rows(small, tpl, items.slice(1), (n, a) => {
            cardFill(n, a);
            text(
              $("div.text-\\[10px\\]", n),
              money(a.ref_price) + " · " + a.calories + " kcal",
            );
          });
      }
      if (id === "M2-S02") {
        const bar = root.children[1];
        bar.innerHTML = `<form onsubmit="event.preventDefault();P2.search(this.query.value)" class="flex gap-2 w-full"><label for="p2-search" class="sr-only">Tìm món</label><input id="p2-search" name="query" value="${H(state.query)}" class="bg-transparent min-w-0 flex-1" placeholder="Tìm món, nguyên liệu…"><button class="font-extrabold">Tìm</button></form>`;
        // Original filter chips stay in place, marked "sắp có" (no ✓: nothing is applied).
        const chipRow = root.children[2];
        if (!FEATURES.searchFilters && chipRow)
          $$(":scope > span", chipRow).forEach((chip) => {
            chip.textContent = chip.textContent.replace(/\s*✓\s*$/, "") + SOON;
            soon(chip, "Bộ lọc tìm kiếm chưa hoạt động.");
          });
        const tpl = $('[onclick*="M2-S04"]', root);
        if (tpl) {
          const holder = document.createElement("div");
          holder.className = "space-y-2";
          tpl.replaceWith(holder);
          if (!items.length) holder.innerHTML = stateHtml(id, "empty", true);
          else
            rows(holder, tpl, items, (n, a) => {
              cardFill(n, a);
              text($(".font-extrabold.text-sm", n), a.name);
              text($(".text-\\[10px\\]", n), a.calories + " kcal");
              text($('[class*="D97736"]', n), money(a.ref_price));
            });
        }
      }
      if (id === "M2-S08") {
        const grid = $(".grid", root),
          tpl = grid.firstElementChild.cloneNode(true);
        if (!items.length) grid.outerHTML = stateHtml(id, "empty", true);
        else
          rows(grid, tpl, items, (n, a) => {
            cardFill(n, a);
            text($(".font-extrabold", n), a.name);
            // The design's collection chip ("6 món") stays; collections view is not wired.
            $$("span", n).forEach((x) => {
              if (!/món/.test(x.textContent) || FEATURES.collections) return;
              text(x, "Bộ sưu tập" + SOON);
              soon(x, "Nhóm món theo bộ sưu tập chưa mở.");
            });
          });
      }
    }
    if (id === "M2-S03") {
      // Only the three region cards; the header's buttons are not region cards.
      $$('[onclick*="M2-S04"]', root).forEach((n, i) => {
        const reg = REGIONS[i];
        const overlay=$(".absolute.inset-0",n);if(overlay)overlay.style.backgroundColor="rgba(0,0,0,0.7)";
        click(n, `P2.region('${reg}')`);
        const pill = $("span", n);
        text(pill, (d.counts?.[reg] ?? 0) + " món");
      });
    }
    if (/^M2-S0[4-7]$/.test(id) || id === "M3-S02") {
      const title = $("h3", root);
      text(title, d.name);
      const hero = $("img", root);
      img(hero, d.img_key);
      if (id === "M2-S04") {
        text(
          $("p.text-\\[11px\\]", root),
          d.description || "Chưa có mô tả món.",
        );
        const heroBadges = $$(".absolute.bottom-7 > span > span", root);
        text(heroBadges[0], (d.prep_minutes ?? "—") + " phút");
        text(heroBadges[1], d.difficulty || "Chưa rõ độ khó");
        const meta = $(".grid-cols-3", root);
        if (meta) {
          meta.children[0].innerHTML = `<div><b>${H(d.prep_minutes || "—")} phút</b><div class="text-[9px] text-[#64748B]">Thời gian nấu</div></div>`;
          text(
            $(".font-extrabold", meta.children[2]),
            (d.scaled_calories_total ?? d.calories ?? "—") + " kcal",
          );
        }
        const ingredients = $(".grid-cols-4", root);
        if (ingredients) {
          const tpl = ingredients.firstElementChild.cloneNode(true);
          rows(
            ingredients,
            tpl,
            (d.scaled_ingredients || []).slice(0, 4),
            (n, a) => {
              img($("img", n), a.img_key);
              text($(".font-extrabold", n), a.name);
              text(
                $(".text-\\[9px\\]", n),
                (a.scaled_amount ?? a.amount) + " " + a.unit,
              );
            },
          );
        }
        const step = $('[onclick*="M2-S07"].cursor-pointer', root);
        if (step) {
          const a = (d.steps || [])[0];
          if (a) {
            text($(".flex-1 .font-extrabold", step), a.title);
            text($("p", step), a.text);
            img($("img", step), d.img_key);
            const duration = $(".flex-1 > span", step);
            if (duration) duration.textContent = (a.duration_min ?? "—") + " phút";
          } else step.innerHTML = "<p>Chưa có cách nấu cho món này.</p>";
        }
        $$("button", root).forEach((b) => {
          if (
            (b.getAttribute("onclick") || "").includes("M2-S08") || b.innerHTML.includes("bookmark") ||
            b.querySelector("svg")?.outerHTML.includes("M19 21l-7")
          )
            click(b, `P2.save('${J(d.id)}')`);
        });
        const heart = $("button.hover\\:text-\\[\\#EF4444\\]", root);
        if (heart) click(heart, `P2.save('${J(d.id)}')`);
      }
      if (id === "M2-S05") {
        const tip=$(".bg-\\[\\#DCFCE7\\]",root);
        if(tip){text($(".font-extrabold",tip),d.name);text($(".text-\\[\\#334155\\]",tip),d.description||"");}
        text($(".text-2xl", root), d.calories ?? "—");
        const vals = $$(".grid-cols-3 b", root);
        [d.macros?.carbs, d.macros?.protein, d.macros?.fat].forEach((v, i) =>
          text(vals[i], v == null ? "Chưa rõ" : v + "g"),
        );
        const macro = $(".text-\\[9px\\].font-bold", root);
        text(macro, "Ước tính theo dữ liệu món");
      }
      if (id === "M2-S06") {
        const grid = $(".grid-cols-2", root),
          tpl = grid.firstElementChild.cloneNode(true);
        rows(grid, tpl, d.scaled_ingredients || [], (n, a) => {
          img($("img", n), a.img_key);
          text($("b", n), a.name);
          text(
            $(".font-extrabold", n),
            (a.scaled_amount ?? a.amount) + " " + a.unit,
          );
        });
        text($("b", root), money(d.scaled_market_cost_vnd));
      }
      if (id === "M2-S07") {
        const holder = root.children[2],
          first = holder.firstElementChild.cloneNode(true),
          other = (holder.children[1] || holder.firstElementChild).cloneNode(true);
        holder.innerHTML = "";
        (d.steps || []).forEach((a, i) => {
          const n = (i === 0 ? first : other).cloneNode(true);
          text(n.firstElementChild, i + 1);
          text($(".flex-1 > .font-extrabold", n), a.title);
          text($(".flex-1 > p", n), a.text);
          img($("img", n), d.img_key);
          $$(".flex-1 span", n).forEach((x) => {
            if (x.textContent.includes("Đang đếm"))
              text(x, "⏱️ " + (a.duration_min || 0) + " phút");
          });
          holder.append(n);
        });
        click(root.lastElementChild, `P2.feedback('eaten')`);
      }
      if (id === "M3-S02") {
        const why = whyText(d);
        const photo = $("img", root)?.parentElement;
        text($("b", photo), d.name);
        text($('b[class*="D97736"]', photo), money(why.price));
        const bubble = $(".rounded-bl-sm", root);
        text($(".font-extrabold", bubble), why.title);
        text($(".text-\\[\\#334155\\]", bubble), why.message);
        // All three original chips stay; weather is "sắp có" until the provider hook returns data.
        const pills = $$(".flex-wrap > span", photo);
        pills.forEach((n, i) => text(n, why.pills[i] ?? n.textContent));
        if (!why.weather.live) soon(pills[0], "Chưa có nguồn thời tiết thật; sẽ bật khi nối nhà cung cấp thời tiết.");
        const [go, cook] = $$(".grid-cols-2 > button", root);
        if (go) {
          text(go, why.place ? "🛵 Đi ăn" + (meters(why.place.distance_m) ? " (" + meters(why.place.distance_m) + ")" : "") : "🛵 Tìm quán");
          click(go, why.place ? `P2.place('${J(why.place.place_id)}')` : "goScreen('M4-S01')");
        }
        if (cook) {
          text(cook, "👩‍🍳 Tự nấu" + (d.prep_minutes ? " (" + d.prep_minutes + "p)" : ""));
          click(cook, `P2.dish('${J(d.id)}')`);
        }
      }
    }
    if(id==="M3-S05" && !state.chat.length) return stateHtml(id,"empty");
    if (id === "M3-S04" || id === "M3-S05") {
      const list = $$(".space-y-2", root).find(
        (n) => n.querySelectorAll(':scope > [onclick*="M2-S04"]').length >= 2,
      );
      if (list) {
        const tpl = list.firstElementChild.cloneNode(true);
        if (!state.chat.length)
          list.innerHTML =
            '<p class="p-3 text-[#64748B]">Chưa có đề xuất. Hãy hỏi Măm về bữa ăn của bạn.</p>';
        else
          rows(list, tpl, state.chat, (n, a) => {
            cardFill(n, a);
            text($(".font-extrabold", n), a.dish_name || a.name);
            text($(".text-\\[10px\\]", n), a.explanation || "");
          });
      }
    }
    if (id === "M3-S03") {
      const names = (d.candidates || []).map((c) => c.name);
      const labels = wheelLabels(names, state.spin?.name);
      $$("#m3-wheel-svg text", root)
        .filter((t) => t.textContent.trim() !== "QUAY")
        .forEach((t, i) => text(t, labels[i] || ""));
      text(
        $("#m3-spin-title", root),
        state.spin?.name || "Bấm quay để chọn một món",
      );
      text(
        $("#m3-spin-sub", root),
        state.spin
          ? "Xem công thức hoặc quán bán món này."
          : names.length
            ? names.length + " món hợp điều kiện của bạn"
            : (d.reasons || []).map((r) => r.message).filter(Boolean).join(" ") || "Chưa có món hợp điều kiện của bạn.",
      );
    }
    if (id === "M3-S06") {
      $$("button", root)
        .slice(-3)
        .forEach((b, i) =>
          click(b, `P2.feedback('${["eaten", "liked", "skipped"][i]}')`),
        );
    }
    if (id === "M3-S07") {
      const tpl = root.children[1].cloneNode(true);
      clearAfter(root, 1);
      if (!(d.items || []).length)
        root.insertAdjacentHTML(
          "beforeend",
          '<p class="p-4 text-[#64748B]">Chưa có bữa ăn trong lịch sử.</p>',
        );
      else
        (d.items || []).forEach((a) => {
          const n = tpl.cloneNode(true);
          text($(".font-extrabold", n), a.dish_name);
          text(
            $(".text-\\[10px\\]", n),
            new Date(a.created_at).toLocaleDateString("vi-VN"),
          );
          root.append(n);
        });
    }
    if (/^M4-/.test(id) || /^M5-/.test(id)) bindPlaces(root, id, d.items || []);
    if (/^M1-/.test(id)) bindProfile(root, id, d || {});
    if (/^M9-/.test(id)) return bindAdmin(root, id, d);
    return root.outerHTML;
  }
  function bindProfile(root, id, p) {
    if (id === "M1-S01") {
      // Phone/OTP card stays: no sample number, input and button shown as "sắp có".
      const phone=$("input",root);
      if(phone && !FEATURES.phoneLogin) {
        // Attributes, not properties: this root is serialised to HTML.
        phone.setAttribute("value",""); phone.setAttribute("placeholder","Số điện thoại"); phone.setAttribute("disabled","");
        const card=phone.closest(".space-y-3");
        const send=card && $("button",card);
        if(send){ text($("span",send)||send,"Nhận mã xác thực OTP"+SOON); soon(send,"Đăng nhập bằng SMS chưa mở."); }
      }
      $$("button",root).forEach(b=>{
        const label=b.textContent.trim();
        if(label==="Zalo" || label==="Apple") {
          if(!FEATURES[label==="Zalo"?"zaloLogin":"appleLogin"]) { b.textContent=label+" · Sắp có"; soon(b,"Đăng nhập "+label+" chưa mở."); }
        }
        else if(label==="Google") {
          b.disabled=!(state.google?.enabled && state.google?.ready);
          b.textContent=state.google?.enabled?"Google":"Google · Sắp có";
          click(b,"P2.google()");
        }
      });
    }
    const choices = (holder, values, key, multi = false) => {
      if (!holder) return;
      // The original marks a chosen card with its own pill; reuse that pill
      // for the cards the saved profile actually selects.
      const isPill = (s) => /Đã chọn|Đang chọn|🚫|^\+$/.test(s.textContent.trim());
      const samplePill = $$("span", holder).find(isPill);
      const pillHtml = samplePill ? samplePill.outerHTML : "";
      [...holder.children].forEach((n, i) => {
        const value = values[i];
        const pillParent = $$("span", n).find(isPill)?.parentElement;
        n.querySelectorAll("span").forEach((s) => {
          if (isPill(s)) s.remove();
        });
        const chosen = multi ? (p[key] || []).includes(value) : p[key] === value;
        if (chosen && pillHtml && !/🚫|^\+$/.test(samplePill.textContent.trim()))
          (pillParent || $(".justify-between", n) || n).setAttribute("data-p2-pill", "1");
        n.innerHTML = n.innerHTML.replace(/ ✓/g, "");
        const slot = n.matches("[data-p2-pill]") ? n : $("[data-p2-pill]", n);
        if (slot) { slot.removeAttribute("data-p2-pill"); slot.insertAdjacentHTML("beforeend", pillHtml); }
        click(n, `P2.choose('${key}',${JSON.stringify(value)},${multi})`);
        n.setAttribute(
          "aria-pressed",
          String(multi ? (p[key] || []).includes(value) : p[key] === value),
        );
        n.style.border =
          n.getAttribute("aria-pressed") === "true"
            ? "2px solid #FBBF24"
            : "1px solid #E2E8F0";
      });
    };
    if (id === "M1-S03")
      choices(root.children[2], ["bac", "trung", "nam"], "regions", true);
    if (id === "M1-S04") choices(root.children[2], [0, 1, 2, 3], "spice_level");
    if (id === "M1-S05")
      choices(
        $(".grid-cols-2", root),
        ["shrimp", "peanut", "milk", "gluten", "egg", "soy"],
        "hard_allergies",
        true,
      );
    if (id === "M1-S06")
      choices(
        $(".grid-cols-3", root),
        [
          "balanced",
          "vegetarian",
          "eat_clean",
          "high_protein",
          "low_fat",
          "low_carb",
        ],
        "diet_mode",
      );
    if (id === "M1-S07") {
      const holder = root.children[2];
      [...holder.children].forEach((n, i) => {
        click(n, `P2.budget(${i})`);
        n.style.border =
          i === (p.budget_max <= 35000 ? 0 : p.budget_max <= 65000 ? 1 : 2)
            ? "2px solid #FBBF24"
            : "1px solid #E2E8F0";
      });
    }
    const next = {
      "M1-S03": "M1-S04",
      "M1-S04": "M1-S05",
      "M1-S05": "M1-S06",
      "M1-S06": "M1-S07",
      "M1-S07": "M1-S08",
    }[id];
    if (next) click(root.lastElementChild, `P2.saveProfile('${next}')`);
    if (id === "M1-S08") {
      const buttons = $$("button", root).filter((b) =>
        (b.getAttribute("onclick") || "").includes("M3-S01"),
      );
      click(buttons[0], "P2.locate()");
      // The two original area rows are the templates: amber = chosen, grey = other.
      const chosen = buttons[1], other = buttons[2], holder = chosen?.parentElement;
      if (holder && other) {
        const areas = state.cache.areas;
        const tplOn = chosen.cloneNode(true), tplOff = other.cloneNode(true);
        chosen.remove();
        other.remove();
        const row = (tpl, label, mark, code) => {
          const n = tpl.cloneNode(true);
          const [name, end] = $$("span", n);
          text(name, label);
          text(end, mark);
          click(n, code);
          holder.append(n);
          return n;
        };
        if (areas?.status !== "success") {
          const msg = document.createElement("p");
          msg.className = "text-[10px] text-[#64748B]";
          msg.textContent = areas?.status === "error" ? "Chưa tải được danh sách khu vực." : "Đang tải khu vực có dữ liệu quán…";
          holder.append(msg);
        } else {
          const { list, saved } = areaRows(areas.data.items, p);
          if (saved) row(tplOn, "📍 Vị trí đang lưu", "✓", "P2.saveProfile('M3-S01')");
          list.forEach((a) => {
            const n = row(a.selected ? tplOn : tplOff, "📍 " + a.name + " · " + a.place_count + " quán", a.selected ? "✓" : "→", `P2.area('${J(a.id)}')`);
            n.setAttribute("aria-pressed", String(a.selected));
          });
          // The original second city row stays. It opens once /areas returns an area there.
          const city = $("span", tplOff)?.textContent.replace(/^📍\s*/, "").split(",")[0].replace(/^TP\.\s*/, "").trim();
          if (city && !list.some((a) => a.name.includes(city))) {
            const n = row(tplOff, $("span", tplOff).textContent + SOON, "", "");
            n.removeAttribute("onclick");
            soon(n, "Khu vực này chưa có dữ liệu quán.");
          }
          if (!list.length) {
            const msg = document.createElement("p");
            msg.className = "text-[10px] text-[#64748B]";
            msg.textContent = "Chưa có khu vực nào có quán đã xác minh.";
            holder.append(msg);
          }
        }
      }
    }
    if (id === "M1-S09") {
      text($(".text-base.font-extrabold", root), p.name || "Bạn");
      const summary = $(".text-\\[10px\\].text-gray-300", root);
      text(
        summary,
        "Ngân sách " + money(p.budget_min) + " – " + money(p.budget_max),
      );
      const tags = $$(".grid-cols-2 b", root);
      text(tags[0], (p.hard_allergies || []).map(v => ({shrimp:"Tôm / hải sản",peanut:"Đậu phộng",milk:"Sữa",gluten:"Gluten",egg:"Trứng",soy:"Đậu nành"})[v] || v).join(", ") || "Chưa chọn dị ứng");
      text(tags[1], "Mức cay " + p.spice_level + " · " + ({balanced:"Cân bằng",vegetarian:"Ăn chay",eat_clean:"Ăn sạch",high_protein:"Giàu đạm",low_fat:"Ít béo",low_carb:"Ít tinh bột"}[p.diet_mode] || "Chưa chọn chế độ"));
      const banner = $(".bg-\\[\\#18181B\\] span", root);
      if (banner && banner.textContent.includes("94%"))
        text(banner, "Khẩu vị đã lưu");
      const card=$(".bg-\\[\\#18181B\\]",root);
      if(card) { click(card,"goScreen('M1-S03')");card.setAttribute("aria-label","Chỉnh sửa khẩu vị"); }
    }
    if (id === "M1-S10") {
      // The original status pill becomes the switch itself: same pill, real saved value.
      const consentRow = $$(".flex.justify-between", root).find((n) => /Đồng ý cá nhân hóa/.test(n.textContent));
      const pill = consentRow?.lastElementChild;
      if (pill) {
        const on = p.pdpd_consent === true;
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("role", "switch");
        b.setAttribute("aria-checked", String(on));
        b.setAttribute("aria-label", "Đồng ý cá nhân hóa bằng AI");
        b.className = pill.className.replace(/bg-\[#DCFCE7\] text-\[#15803D\]/, on ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#F1F5F9] text-[#475569]");
        b.textContent = on ? "Đang bật" : "Đang tắt";
        click(b, `P2.consent(${!on})`);
        pill.replaceWith(b);
      }
      const download = $$("span", root).find(
        (n) => n.textContent.trim() === "Tải về",
      );
      if (download)
        download.outerHTML =
          '<button onclick="P2.exportData()" class="font-bold text-[#1D4ED8]">Tải về</button>';
      click(root.lastElementChild, "P2.deleteAccount()");
      // Meal reminders live in the frozen M8 module: keep the row, mark it "sắp có".
      if (!FEATURES.mealReminders)
        $$('[onclick*="M8-"]', root).forEach((n) => {
          text(n, "Sắp có");
          soon(n, "Lịch nhắc bữa ăn chưa mở trong bản này.");
        });
    }
  }
  // <m5-confirm>
  // M5-S05 names only the meal the user really chose (from the redirect record or the
  // catalogue already loaded); with no order it says so instead of showing a sample dish.
  function confirmCopy(order) {
    if (!order?.dish_id)
      return {
        ready: false,
        heading: "Chưa có lượt đặt món",
        title: "Chưa có món để xác nhận",
        text: "Hãy chọn quán rồi đặt món, gọi điện hoặc chỉ đường. Sau khi thực sự dùng bữa, quay lại đây để đánh dấu Đã ăn.",
      };
    const dish = order.dish_name ? "món " + order.dish_name : "món bạn đã chọn";
    const at = order.place_name ? " tại " + order.place_name : "";
    return {
      ready: true,
      heading: "Liên kết đã sẵn sàng",
      title: "Bạn chưa đặt món trong ứng dụng này",
      text: "Mở dịch vụ bên ngoài để xem giá và xác nhận. Chỉ đánh dấu Đã ăn sau khi bạn thực sự dùng bữa " + dish + at + ". Măm sẽ không gợi ý lại món này trong 3 ngày.",
    };
  }
  // </m5-confirm>
  function knownDishName(id) {
    for (const [k, v] of Object.entries(state.cache))
      if (/^(dish|why):/.test(k) && v?.data?.id === id && v.data.name) return v.data.name;
    return (window.appState.liveToday?.items || []).find((a) => a.dish_id === id)?.name || null;
  }
  function bindPlaces(root, id, items) {
    const place = items.find((p) => p.id === state.place) || items[0];
    if (!place) {
      clearAfter(root, 1);
      root.insertAdjacentHTML("beforeend", stateHtml(id, "empty", true));
      return;
    }
    if (id === "M4-S01") {
      const tile = $('[onclick*="M4-S03"]', root),
        holder = document.createElement("div");
      holder.className = "space-y-3";
      tile.replaceWith(holder);
      rows(holder, tile, items, (n, p) => {
        img($("img", n), p.img_key);
        text($(".font-extrabold", n), p.name);
        text($(".text-\\[10px\\]", n), placeLine(p));
        // Price of this dish's own menu row, named, so a combo is not read as a single bowl.
        text($('[class*="D97736"]', n), menuPrice(p.menu, selected()));
        click(n, `P2.place('${J(p.id)}')`);
      });
      const openChip = $(".overflow-x-auto > span", root);
      if (openChip) openChip.textContent = openChipText(items);
      // Longer real labels must not wrap: the original row scrolls sideways.
      $$(".overflow-x-auto > span", root).forEach((chip) => (chip.style.whiteSpace = "nowrap"));
      // The other original filter chips are not wired yet: keep them, marked "sắp có".
      if (!FEATURES.placeFilters)
        $$(".overflow-x-auto > span", root).slice(1).forEach((chip) => {
          if (!chip.textContent.includes(SOON)) chip.textContent += SOON;
          soon(chip, "Bộ lọc này chưa hoạt động.");
        });
    }
    if (id === "M4-S02") {
      const pins = $$("button.absolute", root);
      pins.forEach((n, i) => {
        if (!items[i]) n.remove();
        else {
          text(
            n,
            items[i].name + " · " + Math.round(items[i].distance_m) + "m",
          );
          click(n, `P2.place('${J(items[i].id)}')`);
        }
      });
      // The quick card under the map showed sample text ("Cách 400m · Đang mở · 45.000đ").
      const quick = $('.border-2.border-\\[\\#FBBF24\\]', root);
      if (quick) {
        img($("img", quick), place.img_key);
        text($(".font-extrabold", quick), place.name);
        text($(".text-\\[10px\\]", quick), placeLine(place) + " · " + menuPrice(place.menu, selected()).split(" · ")[0]);
        click(quick, `P2.place('${J(place.id)}')`);
      }
      const note = document.createElement("p");
      note.className = "text-[10px] text-[#64748B]";
      note.textContent =
        "Nền bản đồ minh họa. Chọn chỉ đường để mở vị trí thật trên bản đồ.";
      root.append(note);
    }
    if (id === "M4-S03") {
      img($("img", root), place.img_key);
      text($("h3", root), place.name);
      text(
        $("p", root),
        place.address + " · " + Math.round(place.distance_m) + "m",
      );
      const badges = $$(".space-y-2 > .flex span", root);
      text(
        badges[0],
        place.is_currently_open ? "Đang mở theo dữ liệu" : "Hãy gọi xác nhận",
      );
    }
    if (id === "M4-S05") {
      // Original row styles: plain row = available, amber row = not available now.
      const ok = root.children[1].cloneNode(true),
        out = (root.children[2] || root.children[1]).cloneNode(true);
      clearAfter(root, 1);
      (place.menu || []).forEach((m) => {
        // Stock counts: the API has no per-dish portions yet. If a menu row ever carries
        // remaining_portions, the original amber "Sắp hết / Chỉ còn N phần" row is used.
        const low = m.available && Number.isInteger(m.remaining_portions) && m.remaining_portions <= 10;
        const n = (m.available && !low ? ok : out).cloneNode(true);
        text($("b", n), (m.name || m.dish_id) + " (" + money(m.price) + ")");
        text($(".text-\\[10px\\]", n), low ? "Chỉ còn " + m.remaining_portions + " phần · " + hoursNote(place) : hoursNote(place));
        const pill = $(":scope > span", n);
        // "available" is the menu flag entered by admins, not live stock (m6-wording).
        text(pill, low ? "Sắp hết" : m.available ? "● Đang bán" : "Tạm hết");
        if (pill) pill.style.whiteSpace = "nowrap";
        if (m.available) {
          n.setAttribute("onclick", `P2.dish('${J(m.dish_id)}','M5-S01')`);
          n.classList.add("cursor-pointer");
        } else n.setAttribute("aria-disabled", "true");
        root.append(n);
      });
      if (!(place.menu || []).length)
        root.insertAdjacentHTML("beforeend", "<p>Chưa có thực đơn.</p>");
    }
    if (id === "M4-S04") {
      const tpl = root.children[1].cloneNode(true),
        plain = (root.children[2] || root.children[1]).cloneNode(true);
      clearAfter(root, 1);
      (place.menu || []).forEach((m, i) => {
        const n = (i === 0 ? tpl : plain).cloneNode(true);
        text($(".font-extrabold", n), m.name || m.dish_id);
        text($('[class*="D97736"]', n), money(m.price));
        click(n, `P2.dish('${J(m.dish_id)}','M5-S01')`);
        if (!m.available) {
          n.setAttribute("aria-disabled", "true");
          n.removeAttribute("onclick");
        }
        root.append(n);
      });
      if (!(place.menu || []).length)
        root.insertAdjacentHTML("beforeend", "<p>Chưa có thực đơn.</p>");
    }
    if (id === "M4-S06") click(root.lastElementChild, "P2.report()");
    if (id === "M5-S01") {
      const b = $$('[onclick*="M5-S03"]', root)[0];
      if (b)
        text(b, "Chỉ đường đến quán (" + Math.round(place.distance_m) + "m)");
    }
    if (id === "M5-S02") {
      $$('[onclick*="M5-S05"]', root).forEach((n) => {
        const name = $("b", n)?.textContent || "";
        const partner = { GrabFood: "grabfood", ShopeeFood: "shopeefood", beFood: "befood", "Xanh SM Ngon": "xanhsm" }[name] || null;
        if (!partner || !place.links?.[partner] || !FEATURES.orderPartners.includes(partner)) {
          // Row stays in place: no link for this place, or partner not yet allowed by the server.
          text($(".text-\\[10px\\]", n), place.links?.[partner] ? "Đối tác chưa được kết nối" + SOON : "Quán chưa có liên kết" + SOON);
          const tag = $(":scope > span", n);
          if (tag) text(tag, "Sắp có");
          soon(n, "Chưa mở đặt món qua đối tác này.");
        } else {
          click(n, `P2.order('${partner}')`);
          text(
            $(".text-\\[10px\\]", n),
            "Giá và phí giao hàng do đối tác xác nhận",
          );
        }
      });
    }
    if (id === "M5-S03") {
      text($(".text-\\[10px\\]",root.firstElementChild),Math.round(place.distance_m)+"m");
      $$("button", root)
        .slice(-2)
        .forEach((b) => click(b, "P2.order('maps')"));
    }
    if (id === "M5-S04") {
      text($(".text-sm.font-extrabold", root), place.name);
      text($(".font-mono", root), place.phone || "Chưa có số điện thoại");
      const b = root.lastElementChild?.querySelector("button");
      if (b) {
        b.disabled = !place.phone;
        click(b, "P2.call()");
      }
    }
    if (id === "M5-S05") {
      const copy = confirmCopy(state.order);
      text($("h3", root), copy.heading);
      const tip = root.children[1];
      if (tip) {
        text($(".font-extrabold", tip), copy.title);
        text($("p", tip), copy.text);
      }
      const b = root.lastElementChild;
      if (copy.ready) click(b, "P2.confirmMeal()");
      else soon(b, "Chưa có lượt đặt món, gọi điện hay chỉ đường để xác nhận.");
    }
  }
  function bindAdmin(root, id, d) {
    const workspace=root.lastElementChild, content=workspace.lastElementChild;
    const queue=(d.ocr_queue||[]).filter(a=>a.status==="pending_review");
    const reports=d.user_reports||[];
    $$("aside nav button",root).forEach(b=>{
      const code=b.getAttribute("onclick")||"";
      // Frozen modules (M10, M17) open their design preview (m5-frozen); S08/S09 follow permissions.
      const frozenTarget = (code.match(/goScreen\('((?:M\d+|W)-S\d+)'\)/) || [])[1];
      if (frozenTarget && frozenMode(frozenTarget) === "preview") {
        const label=[...$$("span",b)].reverse().find(x=>!x.children.length);
        // The entry stays as designed; invented counts in its label are dropped here.
        if(label && !label.textContent.includes(SOON)) label.textContent=label.textContent.replace(/\s*\([^)]*\d[^)]*\)/g,"")+SOON;
        b.title=FROZEN_LABEL;
        b.style.opacity="0.75";
        return;
      }
      if (!/M9-S0[1234567]/.test(code) &&
          !(/M9-S08/.test(code) && d.actor_role === "super_admin") &&
          !(/M9-S09/.test(code) && AUDIT_ROLES.includes(d.actor_role))) b.remove();
      if (/M9-S07/.test(code) && !FEATURES.adsModeration) {
        const label=[...$$("span",b)].reverse().find(x=>!x.children.length);
        if(label && !label.textContent.includes(SOON)) label.textContent+=SOON;
        soon(b,"Kiểm duyệt quảng cáo chưa mở (M7 đang đóng băng).");
      }
      const badge=b.lastElementChild;
      if (badge?.tagName==="SPAN" && badge!==b.firstElementChild) {
        if(code.includes("M9-S05")) text(badge,queue.length);
        else if(code.includes("M9-S06")) text(badge,reports.length);
        else if(code.includes("M9-S04")) text(badge,(d.places||[]).filter(p=>!p.is_verified && p.cms?.status!=="archived").length);
        else badge.remove();
      }
      for(const span of $$("span",b)) if(span.children.length===0) span.textContent=span.textContent.replace(/\(542\)/g,"("+(d.total_dishes??0)+")");
    });
    const guard=$("aside > div:last-child > div:last-child",root);
    if(guard && !FEATURES.adminMetrics) guard.innerHTML='<b class="text-[#4ADE80] block">Lá Safety Guard</b>Thống kê vi phạm dị ứng'+SOON;
    const title=$("h3",workspace);
    if(title) title.textContent=title.textContent.replace(/542 Món/g,(d.total_dishes??0)+" Món").replace(/5 Báo cáo/g,reports.length+" Báo cáo");
    $$("span",workspace.firstElementChild).filter(n=>/LiteLLM/.test(n.textContent)).forEach(n=>{
      if(FEATURES.adminMetrics) return;
      n.textContent="● Độ trễ AI p95"+SOON; soon(n,"Chưa đo độ trễ AI thật.");
    });
    if(id==="M9-S01") {
      const kpis=workspace.children[1];
      [...kpis.children].forEach((card,i)=>{
        const value=$(".text-base > span",card);
        text(value,[d.total_dishes??0,d.total_verified_places??0,queue.length,reports.length][i]);
        // Keep the delta slot; numeric sample deltas ("+42 tuần này") have no source yet.
        const delta=value?.nextElementSibling;
        if(delta && /\d/.test(delta.textContent)) text(delta,"Xu hướng"+SOON);
      });
      const chart=content.firstElementChild?.firstElementChild;
      if(chart) {
        const head=chart.firstElementChild;
        text($("span",head),"Thao tác quản trị 7 ngày qua (Audit log)");
        const pill=head.lastElementChild;
        if(pill && pill!==head.firstElementChild && !FEATURES.adminMetrics){text(pill,"Realtime p95"+SOON);soon(pill,"Chưa đo độ trễ thật.");}
        const [oldBars,line]=[...chart.children].slice(1);
        if(line && !FEATURES.adminMetrics){
          const value=$(".flex.justify-between > :last-child",line)||$("span:last-child",line);
          text(value,"Chưa có số liệu"+SOON);
          soon(line,"Chưa có bộ đo độ chính xác LLM.");
        }
        if(!d.activity) {
          // Same slot, honest state: this role cannot read the audit log.
          oldBars?.insertAdjacentHTML("afterend",'<p class="p-4 text-center text-[#64748B]">Vai trò này không xem được audit log.</p>');
          oldBars?.remove();
        } else {
          const bars=activityBars(d.activity);
          oldBars?.insertAdjacentHTML("afterend",K.barChart(bars.map(b=>b.height),bars.map(b=>b.label),"#22C55E",bars.length-1));
          oldBars?.remove(); // replaced in place by the same chart with real counts
          $$(".grid-cols-7 > div",chart).forEach((col,i)=>{
            const v=col.firstElementChild;text(v,bars[i].count);
            col.title=bars[i].day+": "+bars[i].count+" thao tác";
          });
          if(!bars.some(b=>b.count)) line?.insertAdjacentHTML("beforebegin",'<p class="text-[10px] text-[#64748B]">Chưa có thao tác quản trị nào trong 7 ngày qua.</p>');
        }
      }
      const links=$$("[onclick]",content);
      links.forEach(n=>{
        const code=n.getAttribute("onclick")||"";
        if(code.includes("M9-S07")) {
          if(!FEATURES.adsModeration){text($(".text-\\[10px\\]",n),"Chưa mở (M7 đang đóng băng)");soon(n,"Kiểm duyệt quảng cáo chưa mở.");}
        }
        else text($(".text-\\[10px\\]",n),code.includes("M9-S05")?queue.length:reports.length);
      });
    }
    if(id==="M9-S02") {
      const tbody=$("tbody",content), tpl=tbody.firstElementChild.cloneNode(true);
      // "Vector DB" column stays; status shown only from a real has_embedding flag.
      rows(tbody,tpl,d.catalog||[],(n,a)=>{
        const cells=[...n.children];
        img($("img",cells[0]),a.img_key);text($("b",cells[0]),a.name);
        text(cells[1],({bac:"Miền Bắc",trung:"Miền Trung",nam:"Miền Nam"})[a.region]||a.region||"—");
        text(cells[2],(a.allergen_tags||[]).join(", ")||"—");
        text(cells[3],(a.calories??"—")+" kcal · "+money(a.ref_price));
        if(cells[4]) {
          if(a.has_embedding===true) text(cells[4],"pgvector ✔");
          else { text(cells[4],"Chưa có vector"+SOON); cells[4].style.opacity="0.6"; cells[4].title="Chưa tạo vector tìm kiếm cho món này."; }
        }
      });
      if(!(d.catalog||[]).length) content.innerHTML=stateHtml(id,"empty", true);
    }
    if(id==="M9-S03") {
      const a=(d.catalog||[]).find(a=>a.id===selected())||d.catalog?.[0];
      if(!a) content.innerHTML=stateHtml(id,"empty", true);
      else {
        const cards=[...content.firstElementChild.children];
        text($("span",cards[0]),"Khẩu phần gốc: "+(a.base_servings??"—")+" người");
        text($("span",cards[2]),({draft:"Bản nháp",published:"Đã xuất bản",archived:"Đã lưu trữ"})[a.cms?.status]||"Dữ liệu cũ · chưa qua CMS");
        text($(".font-extrabold",cards[0]),a.name);
        text($(".text-\\[\\#64748B\\]",cards[0]),(a.calories??"—")+" kcal");
        text($(".font-extrabold",cards[1]),(a.ingredients||[]).length+" Nhóm Nguyên liệu");
        text($(".text-\\[\\#64748B\\]",cards[1]),(a.ingredients||[]).map(x=>x.name+" "+x.amount+x.unit).join(" · "));
        text($(".font-extrabold",cards[2]),(a.steps||[]).length+" Bước Nấu Có Timer");
        text($(".text-\\[\\#64748B\\]",cards[2]),(a.steps||[]).map(x=>x.title).join(" · "));
      }
    }
    if(id==="M9-S04") {
      const pending=(d.places||[]).filter(p=>!p.is_verified && p.cms?.status!=="archived");
      if(title) text(title,"Duyệt Xác Minh Quán Ăn Thực Tế ("+pending.length+" Hồ sơ chờ)");
      const tpl=content.firstElementChild.cloneNode(true);
      if(!pending.length) content.innerHTML=stateHtml(id,"empty", true);
      else rows(content,tpl,pending,(n,p)=>{
        img($("img",n),p.img_key);text($("b",n),p.name+" · "+p.address);
        text($("[class~='text-[11px]']",n),(p.cms?.evidence||"Chưa có bằng chứng xác minh")+" · "+(p.lat??"—")+", "+(p.lng??"—"));
        const buttons=$$("button",n);
        click(buttons[0],`P2.approvePlace('${J(p.id)}',${p.cms?.version||0})`);
        buttons[0].disabled=!p.cms?.evidence;
        buttons[1].disabled=true;buttons[1].title="Chưa có API yêu cầu bổ sung; sửa hồ sơ và ghi lý do tại biểu mẫu bên dưới.";
      });
    }
    if(id==="M9-S05") {
      const holder=content.firstElementChild,tpl=holder.firstElementChild.cloneNode(true);
      if(!queue.length) holder.innerHTML=stateHtml(id,"empty", true);
      else rows(holder,tpl,queue,(n,a)=>{
        const spans=$$(".flex.items-center.gap-2 > span",n);
        text(spans[0],a.extracted_name);text(spans[2],a.matched_dish_name||a.suggested_dish_id||"—");
        text(spans[3],a.confidence==null?"—":Math.round(a.confidence*100)+"%");
        text($(".text-\\[11px\\]",n),(a.place_name||a.place_id||"")+" · "+money(a.extracted_price));
        const button=$("button",n);
        click(button,`P2.review('${J(a.id)}','approved',${Number(a.version)},'${J(a.matched_dish_id||"")}',${Number(a.extracted_price)})`);
        button.disabled=!a.matched_dish_id||!Number.isSafeInteger(a.extracted_price)||!Number.isSafeInteger(a.version);
        button.title="Xác nhận món và giá đang hiển thị; đổi lựa chọn hoặc từ chối qua API vì màn gốc chưa có ô nhập.";
      });
    }
    if(id==="M9-S06") {
      const tpl=content.firstElementChild.cloneNode(true);
      if(!reports.length) content.innerHTML=stateHtml(id,"empty", true);
      else rows(content,tpl,reports,(n,a)=>{
        text($("b",n),a.place_name||a.place_id);
        const stateLabel=({pending_review:"Chờ xử lý",auto_paused:"Đã tạm ẩn",resolved:"Đã xử lý",rejected:"Đã bác bỏ"})[a.status]||a.status;
        const reasonLabel=({closed:"Báo đóng cửa",wrong_price:"Sai giá",wrong_location:"Sai vị trí",wrong_menu:"Sai thực đơn",other:"Khác"})[a.reason]||a.reason;
        text($("p",n),[reasonLabel,a.evidence,a.resolution_reason,a.resolved_at].filter(Boolean).join(" · "));
        text($("span",n),(a.report_count??1)+" báo cáo · "+stateLabel);
        // No new reason/filter/resolve controls: preserve the original hours button,
        // but don't mislabel it as unpause or allow a write without a reason.
        const button=$("button",n);
        if(button) {
          button.disabled=true;button.removeAttribute("onclick");
          button.title="Màn gốc chưa có ô sửa giờ/lý do xử lý. Lọc, xử lý báo cáo và mở lại qua API.";
        }
      });
    }
    return root.outerHTML;
  }
  function polish(root = document) {
    if (!root) return;
    // Only presented product text is cleaned; Studio templates retain their specs.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        // Frozen previews keep their design text as drawn (they carry the "sắp có" label).
        n.parentElement?.closest("script,style,svg,[data-frozen-preview]")
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    let n;
    while ((n = walker.nextNode())) {
      // Original labels, screen codes and badges stay exactly as designed.
      // Only invented figures/claims that real data cannot back are replaced.
      const next = n.textContent
        .replace(/\bAnti-Fraud Active\b/g, "")
        .replace(/542 món|500\+ món|Hoàn tất trong 38 giây!/g, "")
        .replace(/Chào anh Long/g, "Chào bạn")
        .replace(/Hôm nay Biên Hòa 26°C trời mát lành, em/g, "Em")
        .replace(/Verified Merchant/g,"Thông tin quán")
        .replace(/⭐ 4\.8 \(150\)/g, "Chưa có đánh giá thực tế")
        .replace(/Chặn 100% dị ứng/g,"Lọc theo dị ứng đã khai báo");
      const fixed = reword(next); // <m6-wording>
      if (fixed !== n.textContent) n.textContent = fixed;
    }
    $$("img", root).forEach((i) => {
      if (!i.hasAttribute("alt")) i.alt = "Ảnh minh họa";
      if (!i.src && i.dataset.img && window.CHATGPT_IMAGES?.[i.dataset.img])
        i.src = window.CHATGPT_IMAGES[i.dataset.img];
    });
    $$("input,textarea,select", root).forEach((el, i) => {
      if (!el.labels?.length && !el.getAttribute("aria-label"))
        el.setAttribute(
          "aria-label",
          el.placeholder ||
            {
              tel: "Số điện thoại",
              number: "Số lượng",
              range: "Mức tùy chọn",
              checkbox: "Bật tùy chọn",
            }[el.type] ||
            el.id ||
            "Thông tin " + (i + 1),
        );
    });
    $$("[onclick]:not(button):not(a):not(input)", root).reverse().forEach((el) => {
      if (el.closest("svg") || el.querySelector("button,a,input,[onclick]")) return;
      const b = document.createElement("button");
      for (const a of el.attributes) b.setAttribute(a.name, a.value);
      b.type = "button";
      b.style.textAlign = "inherit";
      if (el.tagName === "DIV" && !el.classList.contains("absolute") && !el.classList.contains("fixed") && ![...el.classList].some(c => /^(w|max-w|min-w)-/.test(c))) b.style.width = "100%";
      b.innerHTML = el.innerHTML;
      el.replaceWith(b);
    });
    $$("button", root).forEach((b) => {
      if (!b.getAttribute("type")) b.type = "button";
      if (!(b.textContent.trim() || b.getAttribute("aria-label"))) {
        const code = b.getAttribute("onclick") || "";
        b.setAttribute(
          "aria-label",
          b.title ||
            (/M3-S01/.test(code)
              ? "Về trang chủ"
              : /M1-S09/.test(code)
                ? "Hồ sơ khẩu vị"
                : /M2-S08|P2.save/.test(code)
                  ? "Lưu món"
                  : "Mở tùy chọn"),
        );
      }
    });
    // Native submit buttons on forms need to keep their submission behavior.
    $$("form", root).forEach((f) => {
      const submit = $('button:not([onclick]):not([type]),button[onclick=""]:not([type])', f);
      if (submit) submit.type = "submit";
    });
    hydrateImages(root);
    window.M9Forms?.mount(root, appState.activeScreenId, state.cache.admin?.data);
  }
  const desktopLoginRequired = TOV_AUTH.renderLoginRequired;
  TOV_AUTH.renderLoginRequired = function(container, status, retry) {
    // Same desktop card the app already uses; phone OTP is replaced by the enabled sign-in.
    desktopLoginRequired.call(TOV_AUTH, container, status, retry);
    // Phone/OTP fields stay (owner rule); disabled and marked until SMS login is on.
    if (!FEATURES.phoneLogin) {
      const phone = container.querySelector('[data-auth="phone"]'), send = container.querySelector('[data-auth="send"]');
      if (phone) { phone.disabled = true; phone.placeholder = "Số điện thoại" + SOON; }
      if (send) { send.textContent = "Gửi mã OTP" + SOON; soon(send, "Đăng nhập bằng SMS chưa mở."); }
      container.querySelectorAll('[data-auth="code"],[data-auth="verify"]').forEach((n) => { n.disabled = true; });
    }
    const box = container.firstElementChild;
    const intro = box?.children[1];
    if (intro) intro.textContent = (status === 403 ? "Tài khoản hiện tại không có quyền xem mục này." : "Mục này cần đăng nhập.") + " Đăng nhập bằng tài khoản đã được cấp quyền.";
    if (box) box.insertAdjacentHTML("beforeend", `<button type="button" onclick="P2.google()" class="w-full py-2 rounded-xl bg-[#FBBF24] text-[#0F172A] font-extrabold" ${state.google?.enabled && state.google?.ready ? "" : "disabled"}>${state.google?.enabled ? "Google" : "Google · Sắp có"}</button>`);
  };
  window.P2 = {
    async google() {
      if(!state.google?.enabled || !window.google?.accounts?.id) return;
      google.accounts.id.prompt(notification=>{
        if(notification.isNotDisplayed?.() || notification.isSkippedMoment?.())
          status("Chưa mở được đăng nhập Google. Kiểm tra cài đặt trình duyệt rồi thử lại.");
      });
    },
    state,
    retryWrite() {
      retryWrite?.();
    },
    reload() {
      if (appState.activeScreenId === "M1-S08") loadAreas(true);
      load(appState.activeScreenId, true);
    },
    async gamePick(kind) {
      if (!["spin", "game", "fortune", "blind-box"].includes(kind)) return null;
      try {
        const result = await api("/suggestions/" + kind);
        state.spin = result.picked_dish || null;
        if (!state.spin) {
          state.dish = null;
          status((result.reasons || []).map(r => r.message).filter(Boolean).join(" ") || "Chưa có món phù hợp. Không tự nới bộ lọc.");
          return null;
        }
        state.dish = state.spin.id || state.spin.dish_id;
        state.place = result.nearest_place?.place_id || null;
        return state.spin;
      } catch (e) {
        state.spin = null;
        state.dish = null;
        status("Chưa tải được món. Kiểm tra kết nối rồi bấm thử lại.");
        return null; // NEVER fall back to a local, unfiltered dish.
      }
    },
    dish(id, target = "M2-S04") {
      state.dish = id;
      if(target !== "M5-S01") state.place = null;
      appState.servings = 2;
      goScreen(target);
    },
    place(id) {
      state.place = id;
      goScreen("M4-S03");
    },
    search(q) {
      state.query = q;
      goScreen("M2-S02");
      load("M2-S02", true);
    },
    region(reg) {
      state.region = reg;
      state.query = "";
      goScreen("M2-S01");
    },
    choose(key, value, multi) {
      const p = state.cache.profile.data;
      if (multi) {
        const a = p[key] || [];
        p[key] = a.includes(value)
          ? a.filter((v) => v !== value)
          : [...a, value];
      } else p[key] = value;
      paint();
    },
    budget(i) {
      const p = state.cache.profile.data;
      [p.budget_min, p.budget_max] = [
        [0, 35000],
        [35000, 65000],
        [60000, 120000],
      ][i];
      paint();
    },
    saveProfile(next) {
      action(
        () => api("/me/profile", "PATCH", state.cache.profile.data),
        (p) => {
          state.cache.profile = { status: "success", data: p };
          delete state.cache.today;
          goScreen(next);
        },
      );
    },
    area(id) {
      const a = state.cache.areas?.data?.items?.find((x) => x.id === id);
      if (!a) return status("Khu vực này không còn trong danh sách. Bấm Thử lại để tải lại.", true);
      Object.assign(state.cache.profile.data, { lat: a.lat, lng: a.lng });
      P2.saveProfile("M3-S01");
    },
    consent(on) {
      action(
        () => api("/me/profile", "PATCH", { pdpd_consent: on === true }),
        (p) => {
          state.cache.profile = { status: "success", data: p };
          delete state.cache.today;
          paint();
          status(p.pdpd_consent ? "Đã bật đồng ý cá nhân hóa." : "Đã tắt đồng ý cá nhân hóa.");
        },
      );
    },
    locate() {
      if (!navigator.geolocation)
        return status(
          "Trình duyệt không hỗ trợ định vị. Bạn vẫn có thể dùng vị trí đã lưu.",
        );
      status("Đang xin quyền định vị…");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          Object.assign(state.cache.profile.data, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          P2.saveProfile("M3-S01");
        },
        () =>
          status(
            "Chưa lấy được vị trí. Kiểm tra quyền trình duyệt hoặc dùng vị trí đang lưu.",
            true,
          ),
        { timeout: 10000 },
      );
    },
    save(id = selected()) {
      action(
        () => api("/me/collections", "POST", { dish_id: id }),
        () => {
          delete state.cache.saved;
          status("Đã lưu món vào bộ sưu tập.");
        },
      );
    },
    feedback(type, id = selected(), place_id = null) {
      action(
        () =>
          api("/suggestions/feedback", "POST", { dish_id: id, action: type, ...(place_id ? { place_id } : {}) }),
        () => {
          delete state.cache.history;
          delete state.cache.today;
          goScreen("M3-S07");
        },
      );
    },
    report() {
      if (!confirm("Xác nhận gửi báo cáo về quán này?")) return;
      const p =
        state.cache["places:" + selected()]?.data.items.find(
          (p) => p.id === state.place,
        ) || state.cache["places:" + selected()]?.data.items[0];
      const radios=$$("#stage-container input[name=r]");
      const reason=["closed","wrong_price","wrong_location"][radios.findIndex(r=>r.checked)]||"other";
      action(
        () =>
          api("/places/" + encodeURIComponent(p.id) + "/reports", "POST", {
            reason,
          }),
        () => status("Đã gửi báo cáo. Cảm ơn bạn!"),
      );
    },
    order(partner) {
      const items = state.cache["places:" + selected()]?.data.items || [],
        p = items.find((p) => p.id === state.place) || items[0];
      if (!p) return status("Chưa chọn được quán.");
      const dishId=selected();
      let tab=window.open("about:blank","_blank");
      if(!tab) return status("Trình duyệt đang chặn mở dịch vụ bên ngoài. Cho phép cửa sổ mới rồi thử lại.");
      tab.opener=null;
      action(
        async()=>{
          if(tab.closed) {
            tab=window.open("about:blank","_blank");
            if(!tab) throw new Error("Trình duyệt đang chặn cửa sổ mới");
            tab.opener=null;
          }
          try {
            const d=await api("/orders/redirect", "POST", {dish_id:dishId,place_id:p.id,partner});
            const u=new URL(d.target_deeplink);
            if(u.protocol!=="https:") throw new Error("Liên kết không hợp lệ");
            return {...d,target_deeplink:u.href};
          } catch(e){tab.close();throw e;}
        },
        (d)=>{state.order=d;tab.location.replace(d.target_deeplink);goScreen("M5-S05");}
      );
    },
    call() {
      const items = state.cache["places:" + selected()]?.data.items || [],
        p = items.find((p) => p.id === state.place) || items[0];
      if (!/^\+?[\d\s-]+$/.test(p?.phone || ""))
        return status("Chưa có số điện thoại hợp lệ.");
      const dishId = selected();
      state.order = {
        target_deeplink: "tel:" + p.phone.replace(/\s/g, ""),
        dish_id: dishId,
        dish_name: knownDishName(dishId),
        place_id: p.id,
        place_name: p.name,
      };
      location.href=state.order.target_deeplink;
      goScreen("M5-S05");
    },
    confirmMeal() {
      if (state.order?.id)
        action(
          () =>
            api(
              "/orders/" +
                encodeURIComponent(state.order.id) +
                "/confirm-eaten",
              "POST",
              {},
            ),
          () => {
            delete state.cache.history;
            delete state.cache.today;
            goScreen("M3-S07");
          },
        );
      // After a call there is no redirect id: record the meal and place the user chose.
      else if (state.order?.dish_id)
        P2.feedback("eaten", state.order.dish_id, state.order.place_id);
      // Nothing was ordered, called or routed: there is no real meal to confirm.
      else status("Chưa có món để xác nhận. Hãy chọn quán rồi đặt món, gọi điện hoặc chỉ đường trước.");
    },
    exportData() {
      action(
        () => api("/me/export"),
        (d) => {
          const u = URL.createObjectURL(
              new Blob([JSON.stringify(d, null, 2)], {
                type: "application/json",
              }),
            ),
            a = document.createElement("a");
          a.href = u;
          a.download = "du-lieu-ca-nhan.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(u), 1000);
          status("Đã tải dữ liệu cá nhân.");
        },
      );
    },
    deleteAccount() {
      if (confirm("Xóa vĩnh viễn tài khoản và dữ liệu? Không thể hoàn tác."))
        action(
          () => api("/me", "DELETE"),
          () => {
            TOV_AUTH.logout();
            window.M9Forms?.syncRole();
            state.cache = {};
            goScreen("M1-S01");
            status("Đã xóa tài khoản.");
          },
        );
    },
    approvePlace(id, version) {
      if(!confirm("Duyệt dựa trên bằng chứng đã lưu? Thao tác này không mở lại quán đang tạm dừng.")) return;
      action(()=>api("/admin/places/"+encodeURIComponent(id)+"/approve","POST",{version,reason:"Duyệt hồ sơ theo bằng chứng đã lưu"}),
        ()=>{delete state.cache.admin;goScreen("M9-S04");});
    },
    review(id, decision, version, dish_id, price) {
      action(
        () => api("/admin/ocr-review", "POST", { ocr_id: id, decision, version, dish_id, price }),
        () => {
          delete state.cache.admin;
          goScreen("M9-S05");
        },
      );
    },
    unpause(id, reason) {
      if(typeof reason!=="string"||!reason.trim()) {
        status("Màn gốc chưa có ô lý do mở lại; hãy dùng API có reason.");
        return;
      }
      if (confirm("Bạn đã xác nhận quán mở lại?"))
        action(
          () =>
            api(
              "/admin/places/" + encodeURIComponent(id) + "/unpause",
              "POST",
              {reason},
            ),
          () => {
            delete state.cache.admin;
            goScreen("M9-S06");
          },
        );
    },
  };
  // <m5-frozen> Frozen screens keep their original templates; on product routes they are
  // shown through an inert preview wrapper (label + no handlers, links or submits).
  window.P2.frozenNotice = () => status("Tính năng này chưa mở trong bản hiện tại. Màn này là bản xem trước thiết kế.");
  Object.entries(ALL_SCREENS).forEach(([id, scr]) => {
    if (/^M[1-59]-/.test(id)) return;
    const original = scr.render;
    scr.render = () => (frozenMode(id) === "preview" ? frozenPreviewHtml(id, original(), ALL_SCREENS) : original());
  });
  // Bind only core designs. The frozen modules keep their templates (preview above).
  Object.entries(ALL_SCREENS).forEach(([id, scr]) => {
    if (!/^M[1-59]-/.test(id)) return;
    const original = scr.render;
    originals[id] = original;
    scr.render = () => {
      const cfg = config(id),
        entry = cfg ? state.cache[cfg[0]] : null;
      if (cfg && entry?.status !== "success")
        return stateHtml(id, entry?.status || "loading", false, entry?.error);
      return mobile(id, original(), entry?.data);
    };
  });
  function widenPreview(id) {
    // Same as the M9 admin shell (admin_forms.js): a desktop design is not squeezed
    // into the 480px phone preview at desktop widths; phones keep the original layout.
    if (ALL_SCREENS[id]?.platform !== "desktop" || window.innerWidth <= 768) return;
    const pv = $("#stage-container [data-frozen-preview]"), frame = pv?.closest(".phone-frame");
    if (frame) frame.style.setProperty("max-width", "100%", "important");
    const aside = pv && $("aside", pv);
    if (aside && $("nav", aside)) aside.style.setProperty("display", "flex", "important");
  }
  goScreen = function (id) {
    if(id==="M1-S02") id="M1-S01";
    if (!/^M[1-59]-/.test(id)) {
      // Design preview of a frozen screen (no data load), or the old block when switched off.
      if (!ALL_SCREENS[id] || frozenMode(id) === "off")
        return status("Tính năng này chưa mở trong bản hiện tại.");
      originalGo(id);
      polish($("#stage-container"));
      widenPreview(id);
      return;
    }
    originalGo(id);
    if (id === "M1-S08") loadAreas();
    load(id);
    polish($("#stage-container"));
  };
  renderStage = function () {
    originalStage();
    polish($("#stage-container"));
    widenPreview(appState.activeScreenId);
  };
  changeServings = function (delta) {
    appState.servings = Math.max(
      1,
      Math.min(10, (appState.servings || 2) + delta),
    );
    load(appState.activeScreenId, true);
  };
  LIVE_APP.loadToday = () => load("M3-S01", true);
  LIVE_APP.markDishEaten = (id) => P2.feedback("eaten", id);
  LIVE_APP.sendMamChat = async function (prefill) {
    const q = (prefill || $("#mam-chat-inp")?.value || "").trim();
    if (!q) return;
    appState.liveChatQuery = q;
    appState.liveChatReply = "Đang tìm món phù hợp…";
    state.chat = [];
    paint();
    try {
      const d = await api("/chat", "POST", { query: q });
      appState.liveChatReply =
        d.assistant_message || "Chưa có câu trả lời. Hãy thử mô tả rõ hơn.";
      state.chat = d.options || [];
      appState.liveChatOptions = state.chat;
    } catch (e) {
      appState.liveChatReply =
        "Chưa gửi được câu hỏi. Kiểm tra mạng rồi thử lại.";
      retryWrite = () => LIVE_APP.sendMamChat(q);
      status(appState.liveChatReply, true);
    }
    if (appState.activeScreenId === "M3-S04") paint();
  };
  spinM3Wheel = () =>
    action(
      () => api("/suggestions/spin"),
      (d) => {
        state.spin = d.picked_dish;
        state.dish = d.picked_dish?.id;
        // Wheel labels come from the same pool the pick came from.
        if (Array.isArray(d.candidates)) state.cache["spin-pool"] = { status: "success", data: d };
        paint();
        const wheel = $("#m3-wheel-svg");
        if (wheel) wheel.classList.add("wheel-spinning");
      },
    );
  // Keep the original blind-box layout, but do not promise a nonexistent voucher.
  text($("#view-subgame-blindbox > div:first-child > div:last-child"),
    "Chọn 1 trong 3 túi để nhận gợi ý món theo điều kiện bữa ăn đã chọn.");
  // Remove design-tool chrome, not the original app UI (frozen tabs: see m5-frozen below).
  document.querySelector("body > header")?.remove();
  $("#main-chatgpt")?.remove();
  $("#main-screens aside")?.remove();
  $("#main-screens section > .genui-card:first-child")?.remove();
  $("#pwa-drawer-btn")?.remove();
  const allowed = [
    "today",
    "explore",
    "recipe",
    "chat",
    "wheel",
    "places",
    "admin",
    "profile",
  ];
  // <m5-frozen> Frozen-module tabs stay (design preview); removed only when switched off.
  $$("[id^=ltab-]").forEach((n) => {
    const tab = n.id.slice(5);
    if (allowed.includes(tab)) return;
    if (tabMode(tab) === "off") n.remove();
    else n.title = FROZEN_LABEL;
  });
  $$("[id^=lpanel-]").forEach((n) => {
    if (!allowed.includes(n.id.slice(7)) && tabMode(n.id.slice(7)) === "off") n.remove();
  });
  // Their original loaders and actions call frozen APIs (vouchers, polls, VietQR...):
  // replaced so nothing is fetched or written; the preview shows the module's designs.
  const frozenNoop = () => {};
  ["loadLiveMealPlan", "renderLivePoll", "loadLiveBooking", "loadLiveStories", "loadLiveTranslator",
   "loadLiveInsights", "loadLiveAnalytics", "loadLiveNotifications", "loadLiveFridge", "loadLiveHealth",
   "loadLiveCommunity"].forEach((f) => { if (typeof window[f] === "function") window[f] = frozenNoop; });
  ["voteLivePoll", "openLiveVietQrModal", "confirmLivePayment", "submitLiveBooking", "stampPassport",
   "scanLiveFridgeItem", "syncLiveWearable", "tipLiveRecipe", "saveLiveNotifications"].forEach((f) => {
    if (typeof window[f] === "function") window[f] = () => window.P2.frozenNotice();
  });
  function previewPanel(tab) {
    const panel = document.getElementById("lpanel-" + tab);
    if (!panel || panel.dataset.frozenPreview) return;
    panel.dataset.frozenPreview = tab;
    panel.innerHTML = frozenInert(panel.innerHTML, {});
    // Containers the original loaders filled from the frozen API stay in place, marked.
    $$("[id^=live-]", panel).forEach((c) => {
      if (!c.children.length && !c.textContent.trim() && !c.closest(".hidden") && c.tagName === "DIV")
        c.innerHTML = '<div class="p-4 rounded-2xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)]">Dữ liệu sẽ hiện khi tính năng mở' + SOON + "</div>";
    });
    const mods = FROZEN_TABS[tab];
    const ids = ORDERED_IDS.filter((id) => mods.includes(moduleOf(id)) && frozenMode(id) === "preview");
    const designs = ids.map((id) => {
      const scr = ALL_SCREENS[id];
      const html = scr.platform === "mobile" ? wrapMobileFrame(scr, scr.render(), true) : scr.render();
      return `<div class="space-y-1 ${scr.platform === "mobile" ? "" : "w-full"}"><div class="text-[10px] font-mono font-bold text-[var(--text-muted)]">${H(id)} · ${H(scr.title)}</div>${frozenInert(html, {})}</div>`;
    }).join("");
    panel.insertAdjacentHTML("afterbegin", frozenBanner(tab));
    panel.insertAdjacentHTML("beforeend", `<div data-frozen-designs="${H(tab)}" class="genui-card p-4 rounded-3xl space-y-3"><div class="text-xs font-extrabold">Thiết kế các màn ${H(mods.join(", "))} · ${FROZEN_LABEL}</div><div class="flex flex-wrap gap-4 justify-center">${designs}</div></div>`);
    hydrateImages(panel);
  }
  if (typeof setLiveAppTab === "function") {
    const originalTab = setLiveAppTab;
    setLiveAppTab = function (tab) {
      if (FROZEN_TABS[tab] && tabMode(tab) === "off") return status("Tính năng này chưa mở trong bản hiện tại.");
      originalTab(tab);
      if (FROZEN_TABS[tab]) previewPanel(tab);
    };
  }
  $$("[data-ai-badge]").forEach((n) => n.remove());
  const style = document.createElement("style");
  style.textContent = `.product-mode #p2-action-status{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:100;max-width:calc(100vw - 24px);width:420px;box-shadow:0 8px 30px #0003}.product-mode :focus-visible{outline:3px solid #B45309;outline-offset:3px}.product-mode input{min-width:0}.product-mode [onclick]{touch-action:manipulation}.product-mode .phone-frame .flex-1{min-width:0}.product-mode .phone-frame{overflow:hidden}.product-mode #main-liveapp{min-width:0}.product-mode [data-p2-layout]{min-width:0}@media(max-width:768px){.product-mode #stage-container .min-w-\\[1100px\\],.product-mode #stage-container .min-w-\\[1000px\\]{min-width:0!important}.product-mode #stage-container table{display:block;max-width:100%;overflow:auto}.product-mode #stage-container aside nav{display:flex;flex-wrap:wrap;max-height:none}.product-mode #stage-container aside nav button{width:auto}.product-mode #stage-container .min-w-0{max-width:100%}}`;
  document.head.append(style);
  window.M9Forms?.syncRole();
  polish(document.body);
  // The original refreshLiveSuggestions() writes the seeded weather label into the
  // badge; re-apply the live_weather hook whenever that happens.
  desktopWeather();
  const weatherBadge = document.getElementById("live-weather-badge");
  if (weatherBadge)
    new MutationObserver(() => desktopWeather()).observe(weatherBadge, { childList: true, characterData: true, subtree: true });
  // Existing dynamic live panels retain their original functions and markup.
  const observed = $("#main-liveapp");
  if (observed) {
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        observer.disconnect();
        polish(observed);
        observer.observe(observed, { childList: true, subtree: true });
      });
    });
    observer.observe(observed, { childList: true, subtree: true });
  }
  (async()=>{
    try {
      const res=await request("/api/v1/auth/google/config");
      state.google=res.ok?await res.json():{enabled:false};
      if(state.google.enabled && state.google.client_id) {
        const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;
        script.onload=()=>{google.accounts.id.initialize({client_id:state.google.client_id,callback:credential=>action(
          async()=>{const r=await TOV_AUTH.google(credential.credential);if(!r.ok)throw Object.assign(new Error("Đăng nhập chưa thành công"),{status:r.status});return r.data;},
          (d)=>{state.cache={};window.M9Forms?.syncRole();if(document.body.classList.contains("pwa-mobile-mode"))goScreen("M1-S03");else setLiveAppTab((d.role||d.user?.role)==="admin"?"admin":"profile");}
        )});state.google.ready=true;$$("[onclick='P2.google()']").forEach(b=>b.disabled=false);};
        script.onerror=()=>status("Chưa tải được đăng nhập Google. Kiểm tra mạng rồi thử lại.");
        document.head.append(script);
      }
    } catch {state.google={enabled:false};}
    if(appState.activeScreenId==="M1-S01")paint();
    $$("[onclick='P2.google()']").forEach(b=>{b.disabled=!(state.google?.enabled && state.google?.ready);b.textContent=state.google?.enabled?"Google":"Google · Sắp có";});
  })();
  load("M1-S09");
  load(appState.activeScreenId);
  window.P2.polish = polish;
})();
