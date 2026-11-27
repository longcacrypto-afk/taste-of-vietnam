/* M8 live wiring — Nhắc bữa & Thông báo.
 * M8-S01 inbox (GET /notifications), M8-S02 detail (GET /notifications/:id), M8-S03 preferences
 * (PUT /me/notification-settings), M8-S04 schedule (PUT /me/meal-schedule), "Gửi thử"
 * (POST /notifications/test). Desktop tab "notifications" replaces loadLiveNotifications /
 * saveLiveNotifications / simulateTestNotification. Web Push is sandbox (in-app only). */
(function () {
  let current = null; // notification id opened on M8-S02
  const SLOT = { lunch: "Bữa trưa", dinner: "Bữa tối", test: "Gửi thử" };
  const ON = "bg-[#DCFCE7] text-[#15803D]", OFF = "bg-[#F1F5F9] text-[#64748B]";
  const hhmm = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }); };
  const dm = (ds) => (ds ? ds.slice(8, 10) + "/" + ds.slice(5, 7) : "");
  const dist = (m) => (m == null ? "" : m < 1000 ? Math.round(m) + "m" : (m / 1000).toFixed(1) + "km");
  // Raw call that keeps the server's error text (429 cap, 400 validation).
  // The app's fetch wrapper turns a failed write into an Error with .status; map the two
  // expected refusals (anti-fatigue cap, invalid time) to readable messages.
  const REFUSED = { 429: "Đã đạt giới hạn 2 thông báo/ngày (chống làm phiền). Thử lại vào ngày mai.", 400: "Giá trị chưa hợp lệ (giờ HH:MM, bữa trưa phải sớm hơn bữa tối)." };
  async function send(path, method, body) {
    let r;
    try { r = await fetch("/api/v1" + path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }); }
    catch (e) { if (REFUSED[e.status]) return { ok: false, status: e.status, data: { error: REFUSED[e.status] } }; throw e; }
    let data = {};
    try { data = JSON.parse(await r.text()); } catch (_) {}
    if (!r.ok && r.status !== 429 && r.status !== 400) throw Object.assign(new Error(data.error || "HTTP " + r.status), { status: r.status });
    return { ok: r.ok, status: r.status, data };
  }
  const pillText = (it) => `${SLOT[it.slot] || "Thông báo"} · ${it.status === "delivered" && it.slot === "test" ? hhmm(it.delivered_at) : it.slot_time || hhmm(it.delivered_at)}`;
  const stateText = (it) => (it.status === "scheduled" ? (it.active ? "Lên lịch" + (it.local_date ? " " + dm(it.local_date) : "") : "Đang tắt") : it.read_at ? "Đã đọc" : "Mới");
  function setPill(el, on) {
    if (!el) return;
    el.className = el.className.replace(/bg-\[#[0-9A-Fa-f]+\]/g, "").replace(/text-\[#[0-9A-Fa-f]+\]/g, "").trim() + " " + (on ? ON : OFF);
    el.textContent = on ? "Đang bật" : "Đang tắt";
  }
  function toast(title, body, icon) {
    if (typeof window.showFloatingToast === "function") window.showFloatingToast(title, body, icon || "🔔", 6000);
  }

  window.TOV_LIVE.register("M8", {
    screens: {
      "M8-S01": {
        load: (ctx) => ctx.api("/notifications"),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const card = ctx.$('div[onclick*="M8-S02"]', root);
          const btn = ctx.$('button[onclick*="M8-S03"]', root);
          const items = d.items || [];
          items.forEach((it) => {
            const n = card.cloneNode(true);
            n.setAttribute("onclick", `P2.live.M8.open('${ctx.J(it.id)}')`);
            n.setAttribute("role", "button");
            const spans = ctx.$$(":scope > .flex > span", n);
            if (spans[0]) spans[0].textContent = pillText(it);
            if (spans[1]) { spans[1].textContent = stateText(it); if (it.status !== "delivered" || it.read_at) spans[1].className = "text-[10px] font-bold text-[#64748B]"; }
            if (it.status !== "delivered" || it.read_at) n.className = n.className.replace("bg-[#EFF6FF]", "bg-[#F8FAFC]").replace("border-[#DBEAFE]", "border-[#E2E8F0]");
            ctx.text(ctx.$(".font-extrabold", n), it.title);
            ctx.$(".font-extrabold", n).insertAdjacentHTML("afterend", `<div class="text-[11px] text-[#475569] leading-snug">${ctx.H(it.body || "")}</div>`);
            btn.before(n);
          });
          card.remove();
          if (!items.length) btn.insertAdjacentHTML("beforebegin", `<div class="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B]">Chưa có thông báo. Bật "Gợi ý món ăn theo bữa" ở phần Tuỳ chỉnh để Măm nhắc bữa.</div>`);
          const head = root.firstElementChild;
          head.insertAdjacentHTML("afterend",
            `<div class="flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B]" data-m8-stats>${d.is_demo ? ctx.demoPill() : ""}<span>Hôm nay đã gửi <b>${ctx.H(d.sent_today)}/${ctx.H(d.max_push_per_day)}</b> · chưa đọc <b>${ctx.H(d.unread_count)}</b></span><span>Web Push: sandbox (chỉ trong ứng dụng)</span></div>` +
            `<div class="flex gap-2"><button type="button" onclick="P2.live.M8.test()" class="flex-1 py-2 rounded-full bg-[#18181B] text-white font-bold">🔔 Gửi thử</button>${d.unread_count ? `<button type="button" onclick="P2.live.M8.readAll()" class="flex-1 py-2 rounded-full bg-white border border-[#E2E8F0] font-bold">✓ Đánh dấu đã đọc hết</button>` : ""}</div>`);
          return root;
        },
      },
      "M8-S02": {
        key: () => current || "first",
        async load(ctx) {
          let id = current;
          if (!id) { const s = await ctx.api("/notifications"); id = s.items?.[0]?.id; }
          return id ? ctx.api("/notifications/" + encodeURIComponent(id)) : {};
        },
        bind(html, n, ctx) {
          if (!n || !n.id) return ctx.stateHtml("M8-S02", "empty");
          const root = ctx.dom(html);
          const t = ctx.$(".font-extrabold.text-xs", root), m = ctx.$(".text-\\[\\#334155\\]", root);
          ctx.text(t, n.status === "delivered" ? n.tip_title || n.title : n.title);
          ctx.text(m, n.body);
          const dishes = n.dishes || [];
          const extra = [];
          extra.push(`<div class="flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B]">${n.is_demo ? ctx.demoPill() : ""}<span class="px-2 py-0.5 rounded-full bg-[#F1F5F9] font-bold">${ctx.H(pillText(n))}</span>${n.weather ? `<span>${ctx.H(n.weather.emoji)} ${ctx.H(n.weather.label)} · ${ctx.H(n.weather.source)}</span>` : n.status === "delivered" ? "<span>Không có dữ liệu thời tiết cho khu vực của bạn</span>" : ""}${n.lunar ? `<span>🪷 Ngày ${n.lunar.day === 1 ? "mùng 1" : "rằm"} tháng ${ctx.H(n.lunar.month)} âm lịch</span>` : ""}</div>`);
          if (n.status === "delivered" && n.title) extra.push(`<div class="p-3 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE] font-extrabold">${ctx.H(n.title)}</div>`);
          if (dishes.length) extra.push(`<div class="space-y-1.5">${dishes.map((x, i) => `<div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2"><span class="font-bold">${i + 1}. ${ctx.H(x.name)}${x.is_sponsored ? ' <span class="px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-[9px]">Tài trợ</span>' : ""}</span><span class="text-[10px] text-[#64748B] text-right">${x.nearest_place ? ctx.H(x.nearest_place.place_name) + " · " + dist(x.nearest_place.distance_m) : "Tự nấu"}${x.price_vnd ? " · " + ctx.money(x.price_vnd) : ""}</span></div>`).join("")}</div>`);
          if (n.status === "delivered") extra.push(`<div class="text-[10px] text-[#64748B]">Gửi lúc ${ctx.H(hhmm(n.delivered_at))} ${ctx.H(dm(n.local_date))} · ${n.read_at ? "đã đọc" : "chưa đọc"} · ${ctx.H(n.push?.note || "")}</div>`);
          const tip = root.children[1];
          tip.insertAdjacentHTML("afterend", extra.join(""));
          const go = ctx.$('button[onclick*="M3-S01"]', root);
          if (go && dishes.length) go.textContent = `Xem ngay ${dishes.length} món gợi ý hôm nay →`;
          else if (go && n.status !== "delivered") go.textContent = "Xem gợi ý hôm nay →";
          return root;
        },
      },
      "M8-S03": {
        load: (ctx) => ctx.api("/notifications"),
        bind(html, d, ctx) {
          const root = ctx.dom(html), s = d.settings || {};
          const rows = ctx.$$(".bg-\\[\\#F8FAFC\\] > .flex", root);
          const keys = ["meal_suggestions", "weather_aware", "lunar_vegan_reminder"];
          rows.forEach((row, i) => {
            const k = keys[i];
            if (!k) return;
            row.setAttribute("role", "switch");
            row.setAttribute("aria-checked", s[k] ? "true" : "false");
            row.setAttribute("onclick", `P2.live.M8.toggle('${k}')`);
            row.classList.add("cursor-pointer");
            setPill(ctx.$("span", row), !!s[k]);
          });
          const note = {
            0: s.meal_suggestions ? `Tối đa ${s.max_per_day}/${s.hard_cap_per_day} thông báo/ngày · hôm nay đã gửi ${d.sent_today}` : "Đang tắt: Măm không gửi nhắc bữa.",
            1: s.weather_aware ? "Dùng thời tiết thật tại khu vực bạn đã chọn ở Hồ sơ (Open-Meteo)." : "Đang tắt: lời nhắc không dựa vào thời tiết.",
            2: `Hôm nay ${d.lunar_today?.label || ""}${d.lunar_today?.next_vegetarian_day ? " · ngày chay tới: " + d.lunar_today.next_vegetarian_day.label + " (" + dm(d.lunar_today.next_vegetarian_day.date) + ")" : ""}`,
          };
          rows.forEach((row, i) => { if (note[i]) row.insertAdjacentHTML("afterend", `<div class="text-[10px] text-[#64748B] -mt-2">${ctx.H(note[i])}</div>`); });
          return root;
        },
      },
      "M8-S04": {
        load: (ctx) => ctx.api("/notifications"),
        bind(html, d, ctx) {
          const root = ctx.dom(html), s = d.settings || {};
          const rows = ctx.$$(":scope > .p-3\\.5", root);
          ["lunch", "dinner"].forEach((slot, i) => {
            const row = rows[i];
            if (!row) return;
            ctx.text(ctx.$(".font-mono", row), s[slot]);
            const up = (d.upcoming || []).find((u) => u.slot === slot);
            const on = s[slot + "_enabled"];
            row.insertAdjacentHTML("afterend",
              `<div class="flex items-center justify-between gap-2 -mt-1.5 px-1 text-[10px] text-[#64748B]"><label class="flex items-center gap-1.5">Đổi giờ <input type="time" value="${ctx.H(s[slot])}" aria-label="Giờ nhắc ${SLOT[slot]}" onchange="P2.live.M8.setTime('${slot}', this.value)" class="px-2 py-1 rounded-lg border border-[#E2E8F0] font-mono text-[11px] text-[#0F172A]"></label>` +
              `<button type="button" role="switch" aria-checked="${on ? "true" : "false"}" onclick="P2.live.M8.toggle('${slot}_enabled')" class="px-2.5 py-0.5 rounded-full font-bold ${on ? ON : OFF}">${on ? "Đang bật" : "Đang tắt"}</button></div>` +
              (up && on ? `<div class="-mt-2 px-1 text-[10px] text-[#64748B]">Lần nhắc tới: ${ctx.H(up.slot_time)} ${ctx.H(dm(up.local_date))}${up.active ? "" : " · nhắc bữa đang tắt"}</div>` : ""));
          });
          root.insertAdjacentHTML("beforeend", `<div class="flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B]"><span>Giờ Việt Nam (${ctx.H(s.timezone || "")}) · tối đa ${ctx.H(s.hard_cap_per_day)} thông báo/ngày</span></div>`);
          return root;
        },
      },
    },
    actions: {
      open(ctx, id) {
        current = id;
        if (!String(id).startsWith("upcoming-")) send("/notifications/" + encodeURIComponent(id) + "/read", "POST").catch(() => {});
        ctx.goScreen("M8-S02");
        setTimeout(() => ctx.reload("M8-S01"), 0);
      },
      test(ctx) {
        ctx.action(() => send("/notifications/test", "POST"), (r) => {
          if (!r.ok) return ctx.status(r.data.error || "Chưa gửi được.");
          const n = r.data.notification;
          current = n.id;
          toast(n.title, n.body, "🔔");
          ctx.status(`Đã tạo thông báo trong ứng dụng (${r.data.sent_today}/2 hôm nay). Web Push: sandbox, chưa gửi ra thiết bị.`);
          ctx.reload("M8-S01");
        });
      },
      readAll(ctx) { ctx.action(() => send("/notifications/read-all", "POST"), () => ctx.reload("M8-S01")); },
      toggle(ctx, key) {
        const isSlot = /_enabled$/.test(key);
        ctx.action(async () => {
          const s = await ctx.api("/me/notification-settings");
          return send(isSlot ? "/me/meal-schedule" : "/me/notification-settings", "PUT", { [key]: !s[key] });
        }, (r) => {
          if (!r.ok) return ctx.status(r.data.error || "Chưa lưu được.");
          ctx.reload("M8-S03"); ctx.reload("M8-S04"); ctx.reload("M8-S01");
        });
      },
      setTime(ctx, slot, value) {
        ctx.action(() => send("/me/meal-schedule", "PUT", { [slot]: value }), (r) => {
          if (!r.ok) { ctx.status(r.data.error || "Giờ không hợp lệ."); return ctx.reload("M8-S04"); }
          ctx.status(`Đã lưu: ${SLOT[slot]} nhắc lúc ${r.data[slot]}.`);
          ctx.reload("M8-S04");
        });
      },
    },
    fns: {
      async loadLiveNotifications(ctx) {
        const c = document.getElementById("live-notifications-content");
        if (!c) return;
        c.innerHTML = '<div class="text-center py-12 text-xs text-[var(--text-muted)]">⏳ Đang tải cấu hình thông báo &amp; lịch nhắc giờ ăn...</div>';
        let d;
        try { d = await ctx.api("/notifications"); }
        catch (e) {
          if ((e.status === 401 || e.status === 403) && window.TOV_AUTH) return window.TOV_AUTH.renderLoginRequired(c, e.status, window.loadLiveNotifications);
          c.innerHTML = '<div class="text-center py-10 text-xs text-red-500">Lỗi kết nối cấu hình thông báo.</div>';
          return;
        }
        const s = d.settings || {}, H = ctx.H;
        const toggle = (id, on) => `<label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="${id}" ${on ? "checked" : ""} class="sr-only peer"><div class="w-9 h-5 bg-[#CBD5E1] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#22C55E]"></div></label>`;
        const slotCard = (slot, icon, label, hint, hintColor) => `
              <div class="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-3">
                <div class="flex items-center justify-between">
                  <div class="font-extrabold text-xs flex items-center gap-2 text-[var(--text-main)]"><span>${icon}</span> ${label}</div>
                  ${toggle("notif-" + slot + "-enabled", s[slot + "_enabled"])}
                </div>
                <div class="text-xs text-[var(--text-muted)]">Thời gian nhắc (mặc định ${slot === "lunch" ? "10:30" : "17:00"}):</div>
                <input type="time" id="notif-${slot}-time" value="${H(s[slot])}" class="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-main)] font-mono focus:border-[#FBBF24] outline-none" />
                <div class="text-[11px] ${hintColor}">${hint}</div>
              </div>`;
        const row = (it) => `
                <div class="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                  <div class="space-y-1 min-w-0">
                    <div class="font-extrabold text-xs flex flex-wrap items-center gap-2">
                      <span class="px-2 py-0.5 rounded-full bg-[#FBBF24]/15 font-mono text-[10px] text-[#B45309]">${H(pillText(it))}</span>
                      <span class="text-[var(--text-main)]">${H(it.title)}</span>
                      <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${it.status === "delivered" && !it.read_at ? "bg-[#22C55E]/20 text-[#22C55E]" : "bg-[var(--bg-card)] text-[var(--text-muted)]"}">${H(stateText(it))}</span>
                    </div>
                    <div class="text-[11px] text-[var(--text-muted)]">${H(it.body)}</div>
                  </div>
                  ${it.status === "delivered" && !it.read_at ? `<button onclick="P2.live.M8.deskRead('${ctx.J(it.id)}')" class="px-3.5 py-1.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-main)] font-extrabold text-xs hover:border-[#FBBF24] transition shrink-0">✓ Đã đọc</button>` : ""}
                </div>`;
        c.innerHTML = `
          <div class="genui-card p-6 rounded-3xl space-y-5 border border-[var(--border-subtle)]">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-black text-base flex items-center gap-2"><span>⏰</span> Lịch Nhắc Giờ Ăn Thông Minh (Smart Meal Reminders)</h3>
                <p class="text-xs text-[var(--text-muted)]">Gợi ý món đúng giờ đã hẹn, kèm thời tiết thật tại khu vực đã chọn và quán đang mở gần bạn</p>
              </div>
              <span class="px-3 py-1 rounded-full text-[10px] font-bold bg-[#22C55E]/20 text-[#15803D]">Tối đa ${H(d.max_push_per_day)} thông báo/ngày</span>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-xs">
              <span class="font-extrabold">Gợi ý món ăn theo bữa</span>${toggle("notif-master-enabled", s.meal_suggestions)}
              <span class="text-[var(--text-muted)]">Hôm nay đã gửi ${H(d.sent_today)}/${H(d.max_push_per_day)} · ${H(d.lunar_today?.label || "")}</span>
              ${d.is_demo ? ctx.demoPill() : ""}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${slotCard("lunch", "🍜", "Khung Giờ Bữa Trưa", s.weather_aware ? "🌤️ Ngữ cảnh: dùng thời tiết thật lúc nhắc (mưa/mát → món nước, nắng → món thanh mát)." : "🌤️ Gợi ý theo thời tiết đang tắt.", "text-[#FBBF24]")}
              ${slotCard("dinner", "🍲", "Khung Giờ Bữa Tối", "🏡 Ngữ cảnh: món hợp khẩu vị, đã lọc dị ứng, quán còn mở gần bạn.", "text-[#22C55E]")}
            </div>
            <div class="pt-2">
              <button onclick="saveLiveNotifications()" class="px-5 py-2.5 rounded-2xl bg-[#FBBF24] text-[#0F172A] font-extrabold text-xs hover:bg-[#F59E0B] transition flex items-center gap-2"><span>💾</span> Lưu Lịch Nhắc Nhở</button>
            </div>
          </div>
          <div class="genui-card p-6 rounded-3xl space-y-4 border border-[var(--border-subtle)]">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="font-black text-sm flex items-center gap-2"><span>📱</span> Mô Phỏng &amp; Bắn Thử Thông Báo (Live Push Simulator)</h3>
                <p class="text-[11px] text-[var(--text-muted)]">Bắn thử tạo thông báo thật trong hộp thư ứng dụng (tính vào giới hạn 2/ngày). Web Push chưa cấu hình: sandbox.</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FBBF24]/20 text-[#B45309]">Web Push: sandbox</span>
                <button onclick="simulateTestNotification()" ${d.remaining_today > 0 ? "" : "disabled"} class="px-3.5 py-1.5 rounded-xl bg-[#22C55E] text-white font-extrabold text-xs hover:bg-[#16A34A] transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"><span>🔔</span> Bắn Thử Ngay</button>
              </div>
            </div>
            <div class="space-y-3">
              ${(d.items || []).map(row).join("") || '<div class="text-xs text-[var(--text-muted)]">Chưa có thông báo nào.</div>'}
            </div>
          </div>`;
      },
      saveLiveNotifications(ctx) {
        const v = (id) => document.getElementById(id);
        const body = {
          lunch: v("notif-lunch-time")?.value, dinner: v("notif-dinner-time")?.value,
          lunch_enabled: !!v("notif-lunch-enabled")?.checked, dinner_enabled: !!v("notif-dinner-enabled")?.checked,
          max_per_day: v("notif-master-enabled")?.checked ? 2 : 0,
        };
        ctx.action(() => send("/me/meal-schedule", "PUT", body), (r) => {
          if (!r.ok) return toast("Lỗi Lưu Lịch", r.data.error || "Không thể cập nhật máy chủ.", "⚠️");
          const s = r.data;
          toast("Lịch Nhắc Đã Lưu", s.meal_suggestions ? `Nhắc bữa trưa ${s.lunch_enabled ? s.lunch : "(tắt)"} & bữa tối ${s.dinner_enabled ? s.dinner : "(tắt)"}, tối đa ${s.max_per_day} lần/ngày.` : "Đã tắt nhắc bữa.", "⏰");
          window.loadLiveNotifications();
        });
      },
      simulateTestNotification(ctx) {
        ctx.action(() => send("/notifications/test", "POST"), (r) => {
          if (!r.ok) { toast("Đã đạt giới hạn", r.data.error || "Chưa gửi được.", "⚠️"); return window.loadLiveNotifications(); }
          const n = r.data.notification;
          toast(n.title, n.body + " (trong ứng dụng · Web Push sandbox)", n.slot === "dinner" ? "🍲" : "🍜");
          window.loadLiveNotifications();
        });
      },
    },
  });
  // Desktop-only helper exposed through actions (needs the live ctx).
  window.TOV_LIVE.modules.M8.actions.deskRead = (ctx, id) =>
    ctx.action(() => send("/notifications/" + encodeURIComponent(id) + "/read", "POST"), () => window.loadLiveNotifications());
})();
