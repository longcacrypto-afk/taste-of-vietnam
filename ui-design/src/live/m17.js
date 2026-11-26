/* M17 live wiring (admin only) — M17-S01 B2G tourism insights (GET /enterprise/tourism-insights,
 * k-anonymity k ≥ 50), M17-S02 FMCG brand campaigns (GET /enterprise/brand-campaigns,
 * POST /enterprise/brand-campaigns/:id/status), desktop tab "insights". */
(function () {
  let ver = 0;
  const fail = (d) => d && d.error && !d.kpis && !d.items;
  async function get(ctx, path) {
    const d = await ctx.api(path);
    if (fail(d)) throw Object.assign(new Error(d.error), { status: 403 });
    return d;
  }
  // Screens: a 401/403 is drawn inside the original admin shell (the shared state card has
  // no header for desktop modules); other errors still go to the shared error state.
  async function screenLoad(ctx, path) {
    try { return await get(ctx, path); }
    catch (e) { if (e.status === 401 || e.status === 403) return { denied: true }; throw e; }
  }
  function deniedView(root, ctx) {
    const ws = cleanShell(root, ctx, null);
    [...ws.children].slice(1).forEach((n) => n.remove());
    ws.insertAdjacentHTML("beforeend", `<div class="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm text-center space-y-3"><div class="font-extrabold text-sm">Mục này chỉ dành cho quản trị viên cấp cao</div><div class="text-[11px] text-[#64748B]">Đăng nhập bằng tài khoản đã được cấp quyền để xem số liệu tổng hợp ẩn danh.</div><button type="button" onclick="goScreen('M1-S01')" class="px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Đăng nhập</button></div>`);
    return root;
  }
  const num = (n) => (n == null ? "—" : Number(n).toLocaleString("vi-VN"));
  const short = (n) => (n == null ? "—" : n >= 1000 ? (n / 1000).toFixed(1).replace(".", ",") + "k" : String(n));
  const sign = (p) => (p == null ? "—" : (p > 0 ? "+" : "") + String(p).replace(".", ",") + "%");
  const COLORS = ["#FBBF24", "#22C55E", "#3B82F6", "#F97316"];

  // Like the M9 admin shell (admin_forms.js): at desktop widths the admin grid is not squeezed
  // into the 480px phone preview, and its sidebar is shown; phones keep the original layout.
  function widen() {
    const run = () => {
      const r = document.querySelector("#stage-container [data-m17-shell]");
      if (!r || (document.body.classList.contains("pwa-mobile-mode") && window.innerWidth <= 768) || window.innerWidth <= 768) return;
      r.closest(".phone-frame")?.style.setProperty("max-width", "100%", "important");
      r.querySelector("aside")?.style.setProperty("display", "flex", "important");
    };
    setTimeout(run, 0); setTimeout(run, 120);
  }
  // Shared admin shell: drop the sample counts/badges/latency that have no source on this screen.
  function cleanShell(root, ctx, d) {
    root.setAttribute("data-m17-shell", "");
    widen();
    ctx.$$("aside nav button", root).forEach((b) => {
      const label = [...ctx.$$("span", b)].reverse().find((x) => !x.children.length);
      if (label) label.textContent = label.textContent.replace(/\s*\([^)]*\d[^)]*\)/g, "");
      const badge = b.lastElementChild;
      if (badge?.tagName === "SPAN" && badge !== b.firstElementChild) badge.remove();
    });
    const guard = ctx.$("aside > div:last-child > div:last-child", root);
    if (guard) guard.innerHTML = '<b class="text-[#4ADE80] block">Lá Safety Guard</b>Chỉ hiển thị số liệu tổng hợp ẩn danh — không có dữ liệu cá nhân.';
    const ws = root.lastElementChild;
    ctx.$$("span", ws.firstElementChild).filter((n) => /LiteLLM/.test(n.textContent)).forEach((n) => {
      n.textContent = d?.k_anonymity ? `● K-anonymity k ≥ ${d.k_anonymity.k}` : "● Dữ liệu tổng hợp";
    });
    return ws;
  }

  function linePath(values) {
    const pts = values.map((v, i) => [values.length > 1 ? Math.round((i * 320) / (values.length - 1)) : 160, v]);
    const shown = pts.filter((p) => p[1] != null);
    if (!shown.length) return null;
    const max = Math.max(...shown.map((p) => p[1])), min = Math.min(...shown.map((p) => p[1]));
    const y = (v) => (max === min ? 40 : Math.round(72 - ((v - min) / (max - min)) * 60));
    const xy = shown.map(([x, v]) => [x, y(v)]);
    return { line: "M" + xy.map((p) => p.join(",")).join(" L"), area: "M" + xy.map((p) => p.join(",")).join(" L") + ` L${xy.at(-1)[0]},85 L${xy[0][0]},85 Z`, xy };
  }

  window.TOV_LIVE.register("M17", {
    screens: {
      "M17-S01": {
        key: () => String(ver),
        load: (ctx) => screenLoad(ctx, "/enterprise/tourism-insights"),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          if (d.denied) return deniedView(root, ctx);
          const ws = cleanShell(root, ctx, d);
          const k = d.kpis || {};
          const kpi = ws.children[1];
          const vals = [
            [short(k.local_specialty_queries), k.local_specialty_queries_change_pct == null ? "" : sign(k.local_specialty_queries_change_pct) + " tuần"],
            [short(k.international_visitors), (k.top_languages || []).join("/") || ""],
            [`${num(k.checkin_places)} quán`, `${num(k.trail_checkins)} lượt QR`],
            [`k ≥ ${d.k_anonymity?.k ?? 50}`, `${d.k_anonymity?.suppressed_cells ?? 0} ô ẩn`],
          ];
          [...(kpi?.children || [])].forEach((c, i) => {
            const v = ctx.$(".text-base > span", c);
            ctx.text(v, vals[i]?.[0]);
            if (v?.nextElementSibling) ctx.text(v.nextElementSibling, vals[i]?.[1]);
          });
          const content = ws.lastElementChild, grid = content.firstElementChild;
          const [left, right] = grid.children;
          // Line chart: 4 weekly points from the API (hidden weeks are left out).
          const chart = left.lastElementChild, svg = ctx.$("svg", chart);
          ctx.text(ctx.$(".flex.justify-between > span:last-child", chart), `${sign(d.trend_change_pct)} 4 tuần`);
          const p = linePath((d.trend || []).map((t) => t.value));
          if (svg && p) {
            const stroke = "#3B82F6";
            [...svg.querySelectorAll("path, circle")].forEach((n) => n.remove());
            svg.insertAdjacentHTML("beforeend", `<path d="${p.area}" fill="url(#lineGrad)"/><path d="${p.line}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
              p.xy.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === p.xy.length - 1 ? 5 : 4}" fill="${i === p.xy.length - 1 ? stroke : "#FFFFFF"}" stroke="${i === p.xy.length - 1 ? "#FFFFFF" : stroke}" stroke-width="2.5"/>`).join(""));
          }
          chart.insertAdjacentHTML("beforeend", `<div class="flex justify-between text-[9px] text-[#64748B]">${(d.trend || []).map((t) => `<span>${ctx.H(t.week_label)}: <b>${t.suppressed ? "ẩn" : num(t.value)}</b></span>`).join("")}</div>`);
          // Donut: share of translator sessions by language (suppressed languages listed as hidden).
          const donut = right.lastElementChild;
          const langs = d.languages || [];
          let off = 0;
          const circles = [...donut.querySelectorAll("svg circle")];
          circles.slice(1).forEach((c) => c.remove());
          const ring = donut.querySelector("svg");
          langs.filter((l) => !l.suppressed && l.pct).forEach((l, i) => {
            ring?.insertAdjacentHTML("beforeend", `<circle cx="18" cy="18" r="14" fill="none" stroke="${COLORS[i % 4]}" stroke-width="4.5" pathLength="100" stroke-dasharray="${l.pct} ${100 - l.pct}" stroke-dashoffset="${-off}"/>`);
            off += l.pct;
          });
          const center = donut.querySelector(".absolute");
          ctx.text(center?.lastElementChild, short(k.international_visitors));
          const legend = donut.lastElementChild, row = legend.firstElementChild;
          legend.innerHTML = "";
          let ci = 0;
          langs.forEach((l) => {
            const n = row.cloneNode(true);
            const dot = n.querySelector(".rounded-full");
            if (dot) dot.style.background = l.suppressed ? "#CBD5E1" : COLORS[ci++ % 4];
            ctx.text(n.querySelector("span > span:last-child"), l.label);
            ctx.text(n.querySelector("b"), l.suppressed ? "ẩn (<50)" : l.pct + "%");
            legend.append(n);
          });
          const areas = d.areas || [];
          const max = Math.max(1, ...areas.map((a) => a.value || 0));
          content.insertAdjacentHTML("beforeend", `
            <div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-2 shadow-sm">
              <div class="flex flex-wrap items-center justify-between gap-2"><div class="font-extrabold">Bản đồ nhiệt hoạt động ẩm thực theo phường (${ctx.H(d.period_days)} ngày)</div>${d.is_demo ? ctx.demoPill() : ""}</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">${areas.map((a) => `
                <div class="flex items-center gap-2"><span class="w-28 shrink-0 truncate">${ctx.H(a.label)}</span>
                  <div class="flex-1 h-3 rounded-full bg-[#F1F5F9] overflow-hidden">${a.suppressed ? "" : `<div class="h-full rounded-full" style="width:${Math.max(4, Math.round((a.value / max) * 100))}%;background:${a.value / max > 0.66 ? "#EF4444" : a.value / max > 0.33 ? "#F97316" : "#FBBF24"}"></div>`}</div>
                  <b class="w-20 text-right shrink-0 ${a.suppressed ? "text-[#94A3B8]" : ""}">${a.suppressed ? "ẩn (<50)" : num(a.value)}</b></div>`).join("")}</div>
              <div class="text-[10px] text-[#64748B]">${ctx.H(d.k_anonymity?.rule || "")} Nguồn: ${num(d.sources?.demo_cells)} ô dữ liệu demo + sự kiện thật (${num(d.sources?.real_events?.passport_stamps)} dấu hộ chiếu, ${num(d.sources?.real_events?.translator_requests)} lượt dịch menu, ${num(d.sources?.real_events?.order_redirects)} lượt chuyển đặt món).</div>
            </div>`);
          return root;
        },
      },
      "M17-S02": {
        key: () => String(ver),
        load: (ctx) => screenLoad(ctx, "/enterprise/brand-campaigns"),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          if (d.denied) return deniedView(root, ctx);
          const ws = cleanShell(root, ctx, null);
          const content = ws.lastElementChild, tpl = content.firstElementChild;
          tpl.remove();
          if (!d.items?.length) { content.innerHTML = ctx.stateHtml("M17-S02", "empty"); return root; }
          const s = d.summary || {};
          content.insertAdjacentHTML("beforeend", `<div class="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">${d.items.some((c) => c.is_demo) ? ctx.demoPill() : ""}<span>${num(s.active)} chiến dịch đang chạy · ${num(s.impressions)} lượt hiển thị · CTR chung ${s.ctr_pct == null ? "—" : String(s.ctr_pct).replace(".", ",") + "%"} · Gợi ý tài trợ luôn gắn nhãn "Tài trợ", tối đa 1/3 vị trí.</span></div>`);
          d.items.forEach((c) => {
            const n = tpl.cloneNode(true);
            n.classList.add("gap-4");
            ctx.text(ctx.$("b", n), "Chiến dịch: " + c.title);
            const pill = ctx.$("b + span", n);
            if (pill) {
              pill.textContent = c.status === "active" ? "Active Brand Partner" : c.status === "paused" ? "Tạm dừng" : c.status;
              if (c.status !== "active") pill.className = pill.className.replace("bg-[#DCFCE7] text-[#15803D]", "bg-[#FFEDD5] text-[#C2410C]");
            }
            ctx.text(ctx.$(".text-\\[11px\\]", n), `${c.brand} · Hiển thị tại ${c.recipes_count} công thức (${c.dishes.map((x) => x.name).join(", ")}) · ${c.placements} · ${num(c.add_to_cart)} lượt thêm vào giỏ đi chợ · ${num(c.impressions)} lượt hiển thị · ${c.start} → ${c.end}`);
            const right = n.lastElementChild;
            ctx.text(right, c.ctr_pct == null ? "CTR —" : `CTR ${String(c.ctr_pct).replace(".", ",")}%`);
            const next = c.status === "active" ? "paused" : "active";
            right.insertAdjacentHTML("afterend", `<button type="button" onclick="P2.live.M17.setStatus('${ctx.J(c.id)}','${next}')" class="ml-3 px-3 py-1.5 rounded-full border border-[#E2E8F0] bg-white text-[11px] font-bold shrink-0">${next === "paused" ? "Tạm dừng" : "Chạy lại"}</button>`);
            const wrap = document.createElement("div");
            wrap.className = "flex items-center shrink-0";
            right.before(wrap);
            wrap.append(right, n.lastElementChild);
            content.append(n);
          });
          return root;
        },
      },
    },
    actions: {
      async setStatus(ctx, id, status) {
        ctx.status("Đang cập nhật…");
        let d;
        try { d = await ctx.api("/enterprise/brand-campaigns/" + encodeURIComponent(id) + "/status", "POST", { status }); }
        catch (e) { return ctx.status(e.status === 403 || e.status === 401 ? "Chỉ quản trị viên cấp cao được đổi trạng thái chiến dịch." : "Chưa cập nhật được. Thử lại sau.", true); }
        if (d?.error) return ctx.status(d.error, true);
        ver++;
        ctx.status(status === "paused" ? "Đã tạm dừng chiến dịch." : "Đã chạy lại chiến dịch.");
        ctx.reload("M17-S02");
      },
    },
    fns: {
      async loadLiveInsights(ctx) {
        const panel = document.getElementById("lpanel-insights");
        if (!panel) return;
        const qEl = document.getElementById("insight-queries"), vEl = document.getElementById("insight-visitors");
        const cards = [qEl?.parentElement, vEl?.parentElement, panel.querySelectorAll(".genui-card")[2]];
        const tBox = document.getElementById("insight-trending-dishes"), bBox = document.getElementById("insight-brand-campaigns");
        const deny = (box, e) => { if (box) box.innerHTML = `<div class="p-2.5 rounded-xl border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)]">${e?.status === 401 || e?.status === 403 ? "Mục này chỉ dành cho quản trị viên cấp cao — hãy đăng nhập bằng tài khoản được cấp quyền." : "Chưa tải được. Kiểm tra mạng rồi thử lại."}</div>`; };
        try {
          const d = await get(ctx, "/enterprise/tourism-insights");
          const k = d.kpis || {};
          [...panel.querySelectorAll("span")].filter((n) => /Dữ liệu \d+ ngày/.test(n.textContent)).forEach((n) => ctx.text(n, `Dữ liệu ${d.period_days} ngày tổng hợp · ẩn ô < ${d.k_anonymity?.k} người`));
          ctx.text(qEl, num(k.local_specialty_queries));
          ctx.text(cards[0]?.lastElementChild, k.local_specialty_queries_change_pct == null ? "" : `${k.local_specialty_queries_change_pct >= 0 ? "▲" : "▼"} ${sign(k.local_specialty_queries_change_pct)} so với tuần trước`);
          ctx.text(vEl, num(k.international_visitors));
          ctx.text(cards[1]?.lastElementChild, (d.languages || []).filter((l) => !l.suppressed).slice(0, 2).map((l) => `${l.label} ${l.pct}%`).join(" · ") + ` · k ≥ ${d.k_anonymity?.k}`);
          if (tBox) tBox.innerHTML = (d.top_dishes || []).slice(0, 3).map((x, i) => `
            <div class="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between">
              <span class="font-bold">#${i + 1} ${ctx.H(x.suppressed ? "Ô bị ẩn (< 50 người)" : x.label)}</span>
              <span class="text-[10px] font-bold text-[#22C55E]">${x.suppressed ? "ẩn" : num(x.value) + " lượt"}</span>
            </div>`).join("") + (d.is_demo ? `<div>${ctx.demoPill()}</div>` : "");
        } catch (e) {
          ctx.text(qEl, "—"); ctx.text(vEl, "—");
          ctx.text(cards[0]?.lastElementChild, ""); ctx.text(cards[1]?.lastElementChild, "");
          deny(tBox, e);
        }
        try {
          const b = await get(ctx, "/enterprise/brand-campaigns");
          const s = b.summary || {};
          const big = cards[2]?.children[1];
          ctx.text(big, s.ctr_pct == null ? "—" : `${String(s.ctr_pct).replace(".", ",")}% CTR`);
          ctx.text(cards[2]?.lastElementChild, `${num(s.active)} chiến dịch đang chạy · ${num(s.impressions)} lượt hiển thị`);
          if (bBox) bBox.innerHTML = b.items.map((c) => `
            <div class="p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
              <div class="flex items-center justify-between gap-2"><span class="font-bold text-xs">${ctx.H(c.brand)}</span><span class="text-[10px] font-bold ${c.status === "active" ? "text-[#22C55E]" : "text-[#F97316]"}">${c.status === "active" ? "Đang chạy" : "Tạm dừng"}</span></div>
              <div class="text-[10px] text-[var(--text-muted)]">${ctx.H(c.placements)}</div>
              <div class="text-[10px] text-[#22C55E] font-bold">Tỷ lệ tương tác: ${c.ctr_pct == null ? "—" : String(c.ctr_pct).replace(".", ",")}% CTR · ${num(c.add_to_cart)} lượt thêm vào giỏ</div>
            </div>`).join("");
        } catch (e) {
          ctx.text(cards[2]?.children[1], "—"); ctx.text(cards[2]?.lastElementChild, "");
          deny(bBox, e);
        }
      },
    },
  });
})();
