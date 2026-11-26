/* M15 live wiring — M15-S01 Food Trail, M15-S02 passport check-in (GET /tourism/trails,
 * GET /tourism/passport, POST /tourism/passport/checkin) + desktop tab "stories" (shared
 * with M14: stories list from /stories, trail + passport from M15). */
(function () {
  let current = null; // trail id chosen on M15-S01 / desktop
  let ver = 0; // bumped after a check-in so cached trail/passport reload
  const fail = (d) => d && d.error && !d.items && !d.stops;
  async function get(ctx, path) {
    const d = await ctx.api(path);
    if (fail(d)) throw Object.assign(new Error(d.error), { status: 403 });
    return d;
  }
  const hours = (s) => (s.open_hour != null && s.close_hour != null ? `${s.open_hour}h–${s.close_hour}h` : "");
  const openPill = (s, ctx) => !s.available
    ? '<span class="px-1.5 py-0.5 rounded-full bg-[#FFE4E6] text-[#BE123C] text-[9px] font-extrabold">Tạm ngưng</span>'
    : s.open_now
      ? `<span class="px-1.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[9px] font-extrabold">Đang mở · ${ctx.H(hours(s))}</span>`
      : `<span class="px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] text-[9px] font-extrabold">Đóng cửa lúc này · ${ctx.H(hours(s))}</span>`;
  const ALG = { shrimp: "tôm", peanut: "đậu phộng", egg: "trứng", gluten: "gluten", fish: "cá", shellfish: "hải sản có vỏ", shrimp_paste: "mắm tôm", dairy: "sữa", soy: "đậu nành" };
  const algText = (tags) => (tags || []).map((t) => ALG[t] || t).join(", ");
  const km = (m) => (m == null ? "" : m >= 1000 ? (m / 1000).toFixed(1).replace(".", ",") + " km" : m + " m");

  async function checkin(ctx, code, useGps, done) {
    code = String(code || "").trim();
    if (!code) return ctx.status("Nhập mã QR in tại quán (ví dụ trên tấm thẻ ở quầy).", true);
    const body = { qr_token: code };
    if (current) body.trail_id = current;
    if (useGps) {
      if (!navigator.geolocation) return ctx.status("Thiết bị không hỗ trợ định vị — bỏ chọn GPS rồi thử lại.", true);
      try {
        const pos = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { timeout: 8000, maximumAge: 60000 }));
        body.lat = pos.coords.latitude; body.lng = pos.coords.longitude;
      } catch (_) { return ctx.status("Chưa lấy được vị trí. Cho phép định vị hoặc bỏ chọn GPS.", true); }
    }
    ctx.status("Đang đóng dấu…");
    let d;
    try { d = await ctx.api("/tourism/passport/checkin", "POST", body); }
    catch (e) {
      // The app fetch wrapper hides the server body on errors; map the status to the server's meaning.
      const why = { 400: "Mã QR không khớp với trạm đã chọn hoặc toạ độ không hợp lệ.", 401: "Cần đăng nhập để đóng dấu hộ chiếu.",
        403: "Bạn đang ở xa quán hơn 500 m — tới quán rồi đóng dấu, hoặc bỏ chọn GPS.", 404: "Mã QR không thuộc trạm nào của Food Trail. Kiểm tra lại mã in tại quầy.",
        409: "Quán của trạm này đang tạm ngưng, chưa thể đóng dấu." }[e.status];
      return ctx.status(why || "Chưa đóng dấu được. Kiểm tra mạng rồi thử lại.", true);
    }
    if (fail(d) || d.error) return ctx.status(d.error || "Chưa đóng dấu được.", true);
    ver++;
    current = d.trail_id || current;
    ["m15-qr", "m15-desk-qr"].forEach((i) => { const el = document.getElementById(i); if (el) el.value = ""; });
    ctx.status(d.already_stamped ? `Trạm ${d.place_name} đã được đóng dấu trước đó (${d.stamped_count}/${d.total_stops}).`
      : d.completed ? `🎉 Hoàn thành ${d.total_stops}/${d.total_stops} trạm — mở khoá danh hiệu "${d.badge_unlocked}"!`
        : `✅ Đã đóng dấu ${d.place_name}${d.gps_verified ? " (GPS " + d.distance_m + " m)" : ""} · ${d.stamped_count}/${d.total_stops} trạm.`);
    done && done(d);
  }

  window.TOV_LIVE.register("M15", {
    screens: {
      "M15-S01": {
        key: () => (current || "first") + ":" + ver,
        async load(ctx) {
          const list = await get(ctx, "/tourism/trails");
          const t = list.items.find((x) => x.id === current) || list.items[0] || null;
          return { items: list.items, trail: t };
        },
        bind(html, d, ctx) {
          if (!d.trail) return ctx.stateHtml("M15-S01", "empty");
          const root = ctx.dom(html), t = d.trail;
          const msg = ctx.$(".text-\\[\\#334155\\]", root);
          ctx.text(msg, `Hành trình ${t.total_stops} trạm ăn ngon chuẩn bản địa${t.total_distance_m != null ? ` · tổng quãng đường khoảng ${km(t.total_distance_m)}` : ""}.`);
          const im = ctx.$("img[data-img]", root);
          if (im && t.img_key) im.setAttribute("data-img", t.img_key);
          const chips = d.items.length > 1 ? `<div class="flex gap-1.5 overflow-x-auto pb-1">${d.items.map((it) => `<button type="button" onclick="P2.live.M15.pick('${ctx.J(it.id)}')" class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full border text-[10px] font-bold ${it.id === t.id ? "bg-[#18181B] text-white border-[#18181B]" : "bg-white border-[#E2E8F0]"}">${ctx.H(it.title)}</button>`).join("")}</div>` : "";
          const stops = t.stops.map((s, i) => `
            <div class="p-2.5 rounded-2xl border ${s.stamped ? "bg-[#F0FDF4] border-[#86EFAC]" : "bg-[#F8FAFC] border-[#E2E8F0]"} flex gap-2.5">
              <div class="w-7 h-7 rounded-full bg-[#FBBF24] text-[#0F172A] font-black text-[11px] flex items-center justify-center shrink-0">${i + 1}</div>
              <div class="min-w-0 flex-1 space-y-0.5">
                <div class="flex items-center justify-between gap-2"><b class="text-[11px]">${ctx.H(s.time)} ${ctx.H(s.slot_label)} · ${ctx.H(s.dish_name || "")}</b>${s.stamped ? '<span class="text-[10px] font-extrabold text-[#15803D] shrink-0">💮 Đã đóng dấu</span>' : ""}</div>
                <div class="text-[10px] text-[#334155]">${ctx.H(s.place_name || "Quán không còn trong danh mục")}${s.price_vnd ? " · " + ctx.H(ctx.money(s.price_vnd)) : ""}</div>
                <div class="text-[10px] text-[#64748B] truncate">${ctx.H(s.address || "")}</div>
                <div class="flex flex-wrap gap-1 items-center">${openPill(s, ctx)}${s.allergen_tags?.length ? `<span class="px-1.5 py-0.5 rounded-full bg-[#FFE4E6] text-[#BE123C] text-[9px] font-extrabold">Có ${ctx.H(algText(s.allergen_tags))}</span>` : ""}${i > 0 && t.legs_m?.[i - 1] != null ? `<span class="text-[9px] text-[#64748B]">↦ ${ctx.H(km(t.legs_m[i - 1]))} từ trạm trước</span>` : ""}</div>
                ${s.note ? `<div class="text-[10px] text-[#475569] leading-snug">${ctx.H(s.note)}</div>` : ""}
              </div>
            </div>`).join("");
          const prog = t.progress ? `<div class="text-[10px] font-bold text-[#15803D]">Hộ chiếu: đã đóng dấu ${t.progress.stamped}/${t.progress.total} trạm${t.progress.completed ? ` · 🎖️ ${ctx.H(t.badge)}` : ""}</div>` : "";
          im?.insertAdjacentHTML("afterend", `${chips}<div class="space-y-1"><div class="flex flex-wrap items-center gap-1.5">${t.is_demo ? ctx.demoPill() : ""}<span class="text-[10px] text-[#64748B]">📍 ${ctx.H(t.city || "")}</span></div><h4 class="font-extrabold text-sm leading-snug">${ctx.H(t.title)}</h4><p class="text-[11px] text-[#64748B]">${ctx.H(t.subtitle || "")}</p>${prog}</div><div class="space-y-2" data-trail-stops>${stops}</div>`);
          return root;
        },
      },
      "M15-S02": {
        key: () => (current || "first") + ":" + ver,
        async load(ctx) {
          return get(ctx, "/tourism/passport" + (current ? "?trail_id=" + encodeURIComponent(current) : ""));
        },
        bind(html, d, ctx) {
          if (!d.stops?.length) return ctx.stateHtml("M15-S02", "empty");
          const root = ctx.dom(html);
          const sub = ctx.$(".text-\\[10px\\].text-\\[\\#64748B\\]", root.firstElementChild);
          ctx.text(sub, `M15-S02 · Đã đóng dấu ${d.stamped_count}/${d.total_stops} trạm`);
          const grid = ctx.$(".grid", root), tpl = grid.firstElementChild;
          grid.innerHTML = "";
          d.stops.forEach((s) => {
            const n = tpl.cloneNode(true);
            if (!s.stamped) n.className = "p-3 rounded-2xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1] font-extrabold text-[#94A3B8]";
            n.firstChild.textContent = s.stamped ? "💮" : "⚪";
            ctx.text(n.lastElementChild, s.place_name || s.dish_name || "");
            n.insertAdjacentHTML("beforeend", `<div class="text-[9px] font-bold ${s.stamped ? "text-[#15803D]" : "text-[#94A3B8]"}">${ctx.H(s.time)} ${ctx.H(s.slot_label)}</div>`);
            grid.append(n);
          });
          const pct = d.progress_pct || 0;
          grid.insertAdjacentHTML("afterend", `
            <div class="space-y-1"><div class="h-2 rounded-full bg-[#E2E8F0] overflow-hidden"><div class="h-full bg-[#22C55E]" style="width:${pct}%"></div></div>
              <div class="flex justify-between text-[10px] text-[#64748B]"><span>${ctx.H(d.trail_title)}</span><b class="text-[#0F172A]">${d.stamped_count}/${d.total_stops}</b></div></div>
            ${d.completed ? `<div class="p-3 rounded-2xl bg-[#18181B] text-white font-extrabold text-center">🎖️ Đã mở khoá danh hiệu: <span class="text-[#FBBF24]">${ctx.H(d.badge_unlocked)}</span></div>` : `<div class="text-[10px] text-[#64748B]">Hoàn thành ${d.total_stops} trạm để nhận danh hiệu <b>${ctx.H(d.badge)}</b>.</div>`}
            <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <label class="block text-[10px] font-bold text-[#334155]" for="m15-qr">Mã QR in tại quầy của quán</label>
              <input id="m15-qr" autocomplete="off" placeholder="Nhập mã in dưới QR" class="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] bg-white text-xs uppercase" />
              <label class="flex items-center gap-2 text-[10px] text-[#334155]"><input id="m15-gps" type="checkbox" /> Xác minh vị trí GPS (trong bán kính 500 m)</label>
              <button type="button" onclick="P2.live.M15.checkin()" class="w-full py-2.5 rounded-full bg-[#22C55E] text-white font-extrabold">Đóng dấu trạm này</button>
              <div class="text-[9px] text-[#94A3B8]">Chưa mở camera quét QR trong bản này — nhập mã in kèm QR. Mỗi trạm đóng dấu 1 lần.</div>
            </div>
            ${d.is_demo ? `<div>${ctx.demoPill()}</div>` : ""}`);
          return root;
        },
      },
    },
    actions: {
      pick(ctx, id) { current = id; ctx.reload("M15-S01"); },
      checkin(ctx) {
        const code = document.getElementById("m15-qr")?.value;
        const gps = !!document.getElementById("m15-gps")?.checked;
        return checkin(ctx, code, gps, () => ctx.reload("M15-S02"));
      },
      deskPick(ctx, id) { current = id; window.loadLiveStories(); },
    },
    fns: {
      // Desktop Live App tab "stories": M14 stories + M15 trail & passport (replaces the legacy loader).
      async loadLiveStories(ctx) {
        const sList = document.getElementById("live-stories-list");
        const tStops = document.getElementById("live-trail-stops");
        const panel = document.getElementById("lpanel-stories");
        try {
          const s = await ctx.api("/stories");
          if (sList) {
            const items = s.items || [];
            sList.innerHTML = items.length ? items.map((x, i) => `
              <div class="genui-card p-5 rounded-3xl space-y-2 border border-[var(--border-subtle)]">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FBBF24]/20 text-[#B45309]">${ctx.H(x.region || "")}</span>
                  <span class="text-[11px] text-[var(--text-muted)]">⏱️ ${ctx.H(x.read_min || 0)} phút đọc</span>
                  ${x.tag ? `<span class="text-[11px] text-[var(--text-muted)]">· ${ctx.H(x.tag)}</span>` : ""}
                  ${i === 0 && items.some((y) => y.is_demo) ? ctx.demoPill() : ""}
                </div>
                <h3 class="font-black text-sm text-[var(--text-main)]">${ctx.H(x.title)}</h3>
                <p class="text-xs text-[var(--text-muted)] leading-relaxed">${ctx.H(x.summary || "")}</p>
              </div>`).join("") : '<div class="p-4 rounded-2xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)]">Chưa có câu chuyện nào.</div>';
          }
        } catch (e) { if (sList) sList.innerHTML = '<div class="text-xs text-red-500">Chưa tải được câu chuyện.</div>'; }
        try {
          const list = await get(ctx, "/tourism/trails");
          const t = list.items.find((x) => x.id === current) || list.items[0];
          if (!t || !tStops) return;
          current = t.id;
          const card = tStops.parentElement;
          const head = card.children[0], info = card.children[1];
          ctx.text(head?.lastElementChild, "📍 " + (t.city || ""));
          ctx.text(info?.querySelector("h3"), t.title);
          ctx.text(info?.querySelector("p"), t.subtitle || "");
          if (head && panel && !panel.querySelector("[data-demo-pill]") && t.is_demo) head.firstElementChild.insertAdjacentHTML("afterend", ctx.demoPill());
          let pick = card.querySelector("[data-trail-pick]");
          if (list.items.length > 1) {
            const opts = list.items.map((x) => `<button type="button" onclick="P2.live.M15.deskPick('${ctx.J(x.id)}')" class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${x.id === t.id ? "bg-[#18181B] text-white border-[#18181B]" : "border-[var(--border-subtle)] text-[var(--text-muted)]"}">${ctx.H(x.title)}</button>`).join("");
            if (!pick) { info.insertAdjacentHTML("afterend", '<div data-trail-pick class="flex flex-wrap gap-1.5"></div>'); pick = card.querySelector("[data-trail-pick]"); }
            pick.innerHTML = opts;
          }
          tStops.innerHTML = t.stops.map((st, idx) => `
            <div class="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-5 h-5 rounded-full bg-[#FBBF24] text-[#0F172A] font-black text-[10px] flex items-center justify-center shrink-0">${idx + 1}</span>
                <div class="min-w-0">
                  <div class="font-bold text-[11px]">${ctx.H(st.dish_name || "")}</div>
                  <div class="text-[10px] text-[var(--text-muted)]">${ctx.H(st.place_name || "")} · ${ctx.H(st.time)} ${ctx.H(st.slot_label)}${st.available ? (st.open_now ? " · đang mở" : " · đóng cửa lúc này") : " · tạm ngưng"}</div>
                </div>
              </div>
              <span class="text-xs shrink-0 ${st.stamped ? "text-[#22C55E] font-bold" : "text-[var(--text-muted)]"}">${st.stamped ? "🟢 Đã đóng dấu" : "⚪ Chưa đi"}</span>
            </div>`).join("");
          const counter = document.getElementById("passport-stamp-counter");
          const p = t.progress || { stamped: 0, total: t.total_stops };
          ctx.text(counter, `${p.stamped}/${p.total} Trạm Đã Đóng Dấu${p.completed ? " · " + t.badge : ""}`);
          const box = document.getElementById("live-passport-box");
          if (box && !box.querySelector("#m15-desk-qr")) {
            box.querySelector("button")?.insertAdjacentHTML("beforebegin",
              '<input id="m15-desk-qr" autocomplete="off" placeholder="Nhập mã in dưới QR tại quán" class="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white uppercase placeholder:text-white/40" /><label class="flex items-center gap-2 text-[10px] text-white/70"><input id="m15-desk-gps" type="checkbox" /> Xác minh GPS (≤ 500 m)</label>');
          }
        } catch (e) {
          if (tStops) tStops.innerHTML = '<div class="text-xs text-red-500">Chưa tải được Food Trail.</div>';
        }
        if (panel) ctx.polish?.(panel);
      },
      stampPassport(ctx) {
        const code = document.getElementById("m15-desk-qr")?.value;
        const gps = !!document.getElementById("m15-desk-gps")?.checked;
        return checkin(ctx, code, gps, () => window.loadLiveStories());
      },
    },
  });
})();
