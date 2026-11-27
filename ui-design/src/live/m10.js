/* M10 live wiring — Analytics & Event tracking (admin).
 * M10-S01 overview, S02 funnel, S03 AI performance (real NLU + safety run), S04 partner conversions,
 * S05 ads health, S06 live event explorer; desktop tab "analytics" (loadLiveAnalytics).
 * Also a small client tracker: real user actions in the product UI are sent to POST /api/v1/events
 * (14 standard events), so the metrics are fed by real usage next to the flagged demo events. */
(function () {
  let days = 7, evFilter = "";
  const fmtPct = (v) => (v === null || v === undefined ? "—" : String(v).replace(".", ",") + "%");
  const fmtN = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("vi-VN"));
  const sign = (v, unit = "") => (v === null || v === undefined ? "" : (v > 0 ? "+" : "") + String(v).replace(".", ",") + unit);
  const vnd = (v) => (!v ? "0đ" : v >= 1e6 ? (v / 1e6).toFixed(1).replace(".", ",") + "tr" : Math.round(v / 1000) + "k");
  const hhmm = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }); };
  const q = () => "?days=" + days;

  // Shared admin-shell chrome: KPI cards, sidebar NLU label, safety box, header latency badge.
  function kpis(root, ctx, list) {
    ctx.$$(".grid.grid-cols-2 > div", root).forEach((card, i) => {
      const k = list[i];
      if (!k) return;
      if (k.label) ctx.text(ctx.$(".truncate", card), k.label);
      const spans = ctx.$$(".text-base > span", card);
      ctx.text(spans[0], k.value);
      if (spans[1]) { ctx.text(spans[1], k.delta || ""); if (k.bad) spans[1].className = spans[1].className.replace("text-[#16A34A]", "text-[#DC2626]"); }
    });
  }
  // Like the M9 admin shell: at desktop widths the admin grid is not squeezed into the 480px
  // phone preview and its sidebar shows (product_runtime widens only frozen previews).
  function widen() {
    const run = () => {
      if (window.innerWidth <= 768) return;
      const r = document.querySelector("#stage-container [data-m10-shell]");
      if (!r) return;
      r.closest(".phone-frame")?.style.setProperty("max-width", "100%", "important");
      r.querySelector("aside")?.style.setProperty("display", "flex", "important");
    };
    setTimeout(run, 0); setTimeout(run, 120);
  }
  function chrome(root, ctx, c) {
    root.setAttribute("data-m10-shell", "");
    widen();
    // Sample counts/badges in the shared sidebar have no source here: drop them.
    ctx.$$("aside nav button", root).forEach((b) => {
      const label = b.querySelector("span > span.truncate");
      if (label && !b.matches("[onclick*=\"M10-S06\"]")) label.textContent = label.textContent.replace(/\s*\([^)]*\d[^)]*\)/g, "");
      const badge = b.lastElementChild;
      if (badge?.tagName === "SPAN" && badge !== b.firstElementChild) badge.remove();
    });
    if (!c) return;
    const nav = ctx.$('button[onclick*="M10-S03"] > span > span.truncate', root);
    if (nav) nav.textContent = `Độ chính xác AI (${fmtPct(c.nlu_accuracy_pct)})`;
    const guard = ctx.$("aside > div:last-child > div:last-child", root);
    if (guard && guard.querySelector("b")) guard.innerHTML = `<b class="text-[#4ADE80] block">Lá Safety Guard</b>${ctx.H(fmtPct(c.allergy_violation_pct))} vi phạm dị ứng cứng trên ${ctx.H(fmtN(c.audit_items))} món gợi ý kiểm thử gần nhất.`;
    const badge = ctx.$$("span", root).find((s) => s.textContent.includes("LiteLLM p95"));
    if (badge) badge.textContent = c.suggestion_p95_ms == null ? "● p95 gợi ý: chưa có dữ liệu" : `● p95 gợi ý: ${(c.suggestion_p95_ms / 1000).toFixed(2).replace(".", ",")}s`;
  }
  const main = (root, ctx) => ctx.$(".lg\\:col-span-9 > .space-y-4", root);
  function footer(ctx, d, extra = "") {
    const chips = [7, 30].map((n) => `<button type="button" onclick="P2.live.M10.period(${n})" class="px-2.5 py-1 rounded-full border text-[10px] font-bold ${days === n ? "bg-[#18181B] text-white border-[#18181B]" : "bg-white border-[#E2E8F0]"}">${n} ngày</button>`).join("");
    return `<div class="flex flex-wrap items-center gap-2 text-[10px] text-[#64748B]">${d.is_demo ? ctx.demoPill() : ""}${chips}<span>${fmtN(d.events_counted)} sự kiện (${fmtN(d.real_events)} thật, ${fmtN(d.demo_events)} demo)</span>${extra}</div>`;
  }

  const screens = {
    "M10-S01": {
      key: () => String(days),
      load: (ctx) => ctx.api("/analytics/overview" + q()),
      bind(html, d, ctx) {
        const root = ctx.dom(html);
        chrome(root, ctx, d.chrome);
        const r = d.retention, dt = d.decision_time_s, lat = d.suggestion_latency;
        kpis(root, ctx, [
          { value: fmtPct(d.dau_mau.pct), delta: d.dau_mau.delta_pct_points === null ? "" : sign(d.dau_mau.delta_pct_points, " điểm"), bad: d.dau_mau.delta_pct_points < 0 },
          { value: fmtPct(r.d7.pct), delta: r.d7.cohort ? `${r.d7.retained}/${r.d7.cohort} người` : "Chưa đủ dữ liệu" },
          { value: dt.median === null ? "—" : `${dt.median} giây`, delta: dt.delta_s === null ? "" : sign(dt.delta_s, "s"), bad: dt.delta_s > 0 },
          { value: lat.p95_ms === null ? "—" : (lat.p95_ms / 1000).toFixed(2).replace(".", ",") + "s", delta: lat.within_sla === null ? "" : lat.within_sla ? "< 1.5s SLA" : "Vượt SLA 1.5s", bad: lat.within_sla === false },
        ]);
        const box = main(root, ctx).firstElementChild;
        box.innerHTML = `${d.top3_no_refresh.pct === null ? "Chưa có phiên gợi ý trong kỳ này." : `${ctx.H(fmtPct(d.top3_no_refresh.pct))} phiên chọn được món ưng ý ngay trong 3 gợi ý đầu tiên mà không cần làm mới (${fmtN(d.top3_no_refresh.picked)}/${fmtN(d.top3_no_refresh.sessions)} phiên, ${d.period_days} ngày gần nhất).`}` +
          `<div class="mt-2 text-[11px]">DAU ${ctx.H(String(d.dau_mau.dau).replace(".", ","))} / MAU ${fmtN(d.dau_mau.mau)} · Retention D1 ${fmtPct(r.d1.pct)} · D30 ${r.d30.cohort ? fmtPct(r.d30.pct) : "chưa đủ 30 ngày dữ liệu"} · WAMD ${fmtN(d.wamd.current)} (tuần trước ${fmtN(d.wamd.previous)}) · ${fmtPct(dt.under_60s_pct)} chốt món dưới 60 giây</div>`;
        main(root, ctx).insertAdjacentHTML("beforeend", footer(ctx, d, d.real_redirects_in_period ? `<span>· ${fmtN(d.real_redirects_in_period)} lượt chuyển hướng đặt món/chỉ đường thật</span>` : ""));
        return root;
      },
    },
    "M10-S02": {
      key: () => String(days),
      load: (ctx) => ctx.api("/analytics/funnel" + q()),
      bind(html, d, ctx) {
        const root = ctx.dom(html);
        chrome(root, ctx, d.chrome);
        const rows = ctx.$$(".bg-white.p-5 > div", root);
        const p95 = d.suggestion_p95_ms == null ? "chưa có" : (d.suggestion_p95_ms / 1000).toFixed(2).replace(".", ",") + "s";
        d.stages.forEach((s, i) => {
          const row = rows[i];
          if (!row) return;
          const spans = ctx.$$(":scope > .flex > span", row);
          ctx.text(spans[0], `${i + 1}. ${i === 0 ? `app_open → suggestion_shown (p95: ${p95})` : s.label}`);
          ctx.text(spans[1], `${fmtPct(s.pct)} (${fmtN(s.count)} ${i === 3 ? "chuyển đổi" : "phiên"})`);
          const bar = ctx.$(".h-full", row);
          if (bar) bar.style.width = Math.max(0, Math.min(100, s.pct || 0)) + "%";
        });
        const conv = d.stages[3] || {};
        ctx.$(".bg-white.p-5", root).insertAdjacentHTML("beforeend",
          `<div class="text-[11px] text-[#64748B]">Gốc: ${fmtN(d.base_sessions)} phiên app_open · Chuyển đổi gồm ${fmtN(conv.from_events)} từ sự kiện và ${fmtN(conv.from_redirects)} lượt order_redirects thật · North Star WAMD ${fmtN(d.wamd_current)} (tuần trước ${fmtN(d.wamd_previous)})</div>`);
        main(root, ctx).insertAdjacentHTML("beforeend", footer(ctx, d));
        return root;
      },
    },
    "M10-S03": {
      load: (ctx) => ctx.api("/analytics/ai-performance"),
      bind(html, d, ctx) {
        const root = ctx.dom(html), n = d.nlu, s = d.safety;
        chrome(root, ctx, d.chrome);
        const h3 = ctx.$(".lg\\:col-span-9 h3", root);
        if (h3) h3.textContent = h3.textContent.replace("200", String(n.cases));
        kpis(root, ctx, [
          { label: `Intent Accuracy (${n.cases} câu)`, value: fmtPct(n.accuracy_pct), delta: n.passed_sla ? "Đạt mục tiêu ≥90%" : "Dưới mục tiêu 90%", bad: !n.passed_sla },
          { value: fmtPct(s.allergy_violation_pct), delta: `${s.allergy_violations}/${s.items} món`, bad: s.allergy_violations > 0 },
          { value: fmtPct(s.closed_place_pct), delta: `${s.closed_place_violations} quán tạm dừng/báo đóng`, bad: s.closed_place_violations > 0 },
          { value: fmtPct(s.repeat_3d_pct), delta: `${s.repeat_3d_violations} món lặp`, bad: s.repeat_3d_violations > 0 },
        ]);
        const crit = [n.passed_sla, s.allergy_violations === 0, s.closed_place_violations === 0, s.repeat_3d_violations === 0];
        const fails = (n.details || []).filter((x) => !x.passed);
        const box = main(root, ctx).firstElementChild;
        box.innerHTML = `${crit.filter(Boolean).length}/4 tiêu chí đạt trong lần kiểm thử thật lúc ${ctx.H(hhmm(d.ran_at))}: ${n.passed}/${n.cases} câu tiếng Việt bóc tách đúng; ${s.lists} danh sách gợi ý (${s.items} món) chạy bằng bộ gợi ý thật cho ${s.profiles} hồ sơ kiểm thử dị ứng/bữa/lịch sử ăn.${s.note ? " " + ctx.H(s.note) : ""}${s.closed_now_labelled ? ` ${s.closed_now_labelled} món có quán gần nhất đang ngoài giờ mở — đã ghi rõ trạng thái Đóng cửa.` : ""}` +
          `<div class="mt-3 flex flex-wrap items-center gap-2">${d.is_demo ? ctx.demoPill() : ""}<button type="button" onclick="P2.live.M10.rerun()" class="px-3 py-1.5 rounded-full bg-[#18181B] text-white text-[11px] font-extrabold">🧪 Chạy lại kiểm thử</button><span class="text-[10px] text-[#64748B]">${n.core_cases} câu bộ lõi + ${n.m10_cases} câu bộ M10 (demo)</span></div>` +
          (fails.length ? `<div class="mt-3 space-y-1.5">${fails.map((f) => `<div class="p-2 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[11px]"><b>✗ "${ctx.H(f.query)}"</b><span class="block text-[#991B1B]">Sai: ${ctx.H((f.failed_fields || []).join(", "))}${f.expected ? ` · cần ${ctx.H(JSON.stringify(Object.fromEntries((f.failed_fields || []).map((k) => [k, f.expected[k]]))))}, nhận ${ctx.H(JSON.stringify(Object.fromEntries((f.failed_fields || []).map((k) => [k, f.parsed[k]]))))}` : ""}</span></div>`).join("")}</div>` : "");
        return root;
      },
    },
    "M10-S04": {
      key: () => String(days),
      load: (ctx) => ctx.api("/analytics/conversions" + q()),
      bind(html, d, ctx) {
        const root = ctx.dom(html), b = d.buckets, s = d.share;
        chrome(root, ctx, d.chrome);
        kpis(root, ctx, [
          { value: fmtPct(s.maps), delta: `${fmtN(b.maps)} clicks` },
          { value: fmtPct(s.grabfood), delta: `${fmtN(b.grabfood)} clicks` },
          { value: fmtPct(s.shopeefood), delta: `${fmtN(b.shopeefood)} clicks` },
          { value: fmtPct(s.other), delta: `${fmtN(b.other)} clicks` },
        ]);
        const p = d.direction_peak;
        main(root, ctx).firstElementChild.innerHTML = (d.total ? (p ? `Người dùng chọn đi ăn trực tiếp tại quán (Chỉ đường) nhiều nhất vào khung giờ ${ctx.H(p.from)}–${ctx.H(p.to)} (${fmtPct(p.pct_of_directions)} lượt chỉ đường).` : "Chưa có lượt chỉ đường trong kỳ này.") +
          ` Tổng ${fmtN(d.total)} chuyển đổi, gồm ${fmtN(b.phone)} cuộc gọi quán và ${fmtN(d.real_redirects)} lượt chuyển hướng thật từ order_redirects.` : "Chưa có chuyển đổi trong kỳ này.");
        main(root, ctx).insertAdjacentHTML("beforeend", footer(ctx, d));
        return root;
      },
    },
    "M10-S05": {
      key: () => String(days),
      load: (ctx) => ctx.api("/analytics/ads-health" + q()),
      bind(html, d, ctx) {
        const root = ctx.dom(html), rv = d.revenue;
        chrome(root, ctx, d.chrome);
        const over = d.lists_over_cap + (d.audit?.lists_over_sponsor_cap || 0);
        kpis(root, ctx, [
          { value: fmtPct(d.sponsored_ratio_pct), delta: over ? `${over} lượt vượt trần 33,3%` : "Trần <= 33.3%", bad: over > 0 },
          { value: fmtPct(d.organic_ctr_pct), delta: "Baseline" },
          { value: fmtPct(d.sponsored_ctr_pct), delta: `${fmtN(d.campaign_clicks)}/${fmtN(d.campaign_impressions)} lượt` },
          { value: vnd(rv.this_month_vnd), delta: rv.mom_pct === null ? (rv.completed_payments ? "Tháng này" : "Chưa có thanh toán") : sign(rv.mom_pct, "% MoM"), bad: rv.mom_pct < 0 },
        ]);
        const ratio = d.organic_ctr_pct && d.sponsored_ctr_pct ? (d.sponsored_ctr_pct / d.organic_ctr_pct).toFixed(2).replace(".", ",") : null;
        main(root, ctx).firstElementChild.innerHTML = `CTR thẻ Tài trợ ${ctx.H(fmtPct(d.sponsored_ctr_pct))} (bộ đếm chiến dịch) so với gợi ý tự nhiên ${ctx.H(fmtPct(d.organic_ctr_pct))}${ratio ? ` — bằng ${ratio} lần` : ""}. ${fmtN(d.sponsored_slots)}/${fmtN(d.slots)} slot là Tài trợ trong ${fmtN(d.lists)} lượt gợi ý; kiểm thử bộ gợi ý thật: ${fmtN(d.audit.sponsored_items)}/${fmtN(d.audit.items)} món Tài trợ, ${fmtN(d.audit.lists_over_sponsor_cap)} danh sách vượt trần 1/3. Doanh thu tính từ thanh toán đã hoàn tất (${fmtN(rv.completed_payments)} giao dịch).`;
        main(root, ctx).insertAdjacentHTML("beforeend", footer(ctx, d, `<span>· ${fmtN(d.active_campaigns)} chiến dịch đang chạy</span>`));
        return root;
      },
    },
    "M10-S06": {
      key: () => days + ":" + evFilter,
      load: (ctx) => ctx.api("/analytics/events" + q() + "&limit=20" + (evFilter ? "&name=" + encodeURIComponent(evFilter) : "")),
      bind(html, d, ctx) {
        const root = ctx.dom(html);
        chrome(root, ctx, d.chrome);
        const wrap = ctx.$(".font-mono", root);
        const tpl = { on: "bg-[#FBBF24] text-[#0F172A] font-extrabold", off: "bg-[#F8FAFC] border border-[#E2E8F0]" };
        wrap.innerHTML = d.catalog.map((c) => `<button type="button" onclick="P2.live.M10.filter('${ctx.J(c.name)}')" aria-pressed="${evFilter === c.name}" class="px-2.5 py-1 rounded-full ${c.is_click ? tpl.on : tpl.off} ${evFilter === c.name ? "ring-2 ring-[#18181B]" : ""}">${ctx.H(c.name)} · ${fmtN(c.count)}</button>`).join("");
        const card = wrap.parentElement;
        card.insertAdjacentHTML("beforeend",
          `<div class="flex flex-wrap items-center gap-2 text-[10px] text-[#64748B]">${d.is_demo ? ctx.demoPill() : ""}<span>${fmtN(d.total_stored)} sự kiện đã lưu · gần nhất ${ctx.H(hhmm(d.last_event_at))}${evFilter ? " · lọc: " + ctx.H(evFilter) : ""}</span>${evFilter ? `<button type="button" onclick="P2.live.M10.filter('')" class="underline">Bỏ lọc</button>` : ""}<button type="button" onclick="P2.live.M10.sendTest()" class="ml-auto px-3 py-1 rounded-full bg-[#18181B] text-white font-extrabold">＋ Gửi sự kiện thử (app_open)</button></div>` +
          `<div class="space-y-1.5 max-h-[360px] overflow-y-auto">${d.recent.map((e) => `<div class="p-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]"><div class="flex flex-wrap items-center gap-2 text-[11px]"><b class="font-mono">${ctx.H(e.name)}</b><span class="text-[#64748B]">${ctx.H(hhmm(e.ts))} · ${ctx.H(e.platform || "")} · ${ctx.H(e.actor)}</span>${e.is_demo ? '<span class="px-1.5 rounded bg-[#E0F2FE] text-[#075985] text-[9px] font-bold">demo</span>' : '<span class="px-1.5 rounded bg-[#DCFCE7] text-[#15803D] text-[9px] font-bold">thật</span>'}</div><pre class="mt-1 text-[10px] text-[#334155] whitespace-pre-wrap break-all">${ctx.H(JSON.stringify(e.props))}</pre></div>`).join("") || '<div class="text-[11px] text-[#64748B]">Chưa có sự kiện.</div>'}</div>`);
        return root;
      },
    },
  };

  async function renderTab(ctx) {
    const c = document.getElementById("live-analytics-content");
    if (!c) return;
    c.innerHTML = '<div class="text-center py-12 text-xs text-[var(--text-muted)]">⏳ Đang tổng hợp dữ liệu phễu chuyển đổi &amp; benchmark AI...</div>';
    let f, bm, ab;
    try {
      [f, bm, ab] = await Promise.all([ctx.api("/analytics/funnel" + q()), ctx.api("/analytics/ai-performance"), ctx.api("/analytics/ab-test")]);
    } catch (e) {
      if ((e.status === 401 || e.status === 403) && window.TOV_AUTH) return window.TOV_AUTH.renderLoginRequired(c, e.status, window.loadLiveAnalytics);
      c.innerHTML = '<div class="text-center py-10 text-xs text-red-500">Lỗi kết nối Analytics.</div>';
      return;
    }
    const H = ctx.H, n = bm.nlu;
    const card = (label, value, sub, color = "text-[var(--text-main)]") => `<div class="genui-card p-4 rounded-2xl border border-[var(--border-subtle)] space-y-1"><span class="text-[10px] font-bold text-[var(--text-muted)] uppercase">${label}</span><div class="text-2xl font-black ${color}">${H(value)}</div><div class="text-[10px] text-[#22C55E]">${H(sub)}</div></div>`;
    const base = f.base_sessions || 0;
    const steps = [{ label: "1. app_open", count: base, pct: base ? 100 : 0 }, ...f.stages.map((s, i) => ({ label: `${i + 2}. ${s.label}`, count: s.count, pct: s.pct || 0 }))];
    c.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">${f.is_demo ? ctx.demoPill() : ""}${[7, 30].map((x) => `<button onclick="P2.live.M10.tabPeriod(${x})" class="px-2.5 py-1 rounded-full border text-[10px] font-bold ${days === x ? "bg-[#FBBF24] text-[#0F172A] border-[#FBBF24]" : "border-[var(--border-subtle)]"}">${x} ngày</button>`).join("")}<span>${fmtN(f.events_counted)} sự kiện (${fmtN(f.real_events)} thật, ${fmtN(f.demo_events)} demo) · ${fmtN(f.real_redirects)} lượt order_redirects thật</span></div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${card("North Star WAMD", fmtN(f.wamd_current), `Quyết định bữa ăn/7 ngày · tuần trước ${fmtN(f.wamd_previous)}`, "text-[#FBBF24]")}
        ${card("Giữ Chân D7", fmtPct(f.d7_retention_pct), "Người quay lại trong tuần thứ 2")}
        ${card("Chốt Món &lt; 60 Giây", fmtPct(f.decision_under_60s_pct), "Từ lúc thấy gợi ý đến lúc chốt", "text-[#22C55E]")}
        ${card("NLU Tiếng Việt SLA", fmtPct(n.accuracy_pct), n.passed_sla ? `Đạt SLA ≥90% · ${n.passed}/${n.cases} câu` : `Dưới SLA 90% · ${n.passed}/${n.cases} câu`, n.passed_sla ? "text-[#FBBF24]" : "text-red-400")}
      </div>
      <div class="genui-card p-5 rounded-3xl space-y-4 border border-[var(--border-subtle)]">
        <div class="flex items-center justify-between"><div><h3 class="font-black text-sm flex items-center gap-2"><span>📊</span> Phễu Chuyển Đổi Quyết Định Bữa Ăn (14-Event Funnel)</h3><p class="text-[11px] text-[var(--text-muted)]">Theo phiên: từ khi mở app đến khi bấm đặt món, chỉ đường hoặc gọi quán (${f.period_days} ngày gần nhất)</p></div><span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FBBF24]/20 text-[#B45309]">Toàn Hệ Thống</span></div>
        <div class="space-y-3.5">${steps.map((s) => `<div class="space-y-1.5"><div class="flex items-center justify-between text-xs"><span class="font-bold text-[var(--text-main)]">${H(s.label)}</span><span class="font-mono text-[#FBBF24] font-black">${H(fmtN(s.count))} phiên (${H(fmtPct(s.pct))})</span></div><div class="w-full bg-[var(--bg-elevated)] h-2.5 rounded-full overflow-hidden border border-[var(--border-subtle)]"><div class="h-full bg-gradient-to-r from-[#FBBF24] to-[#22C55E]" style="width: ${Math.min(100, s.pct)}%"></div></div></div>`).join("")}</div>
      </div>
      <div class="genui-card p-5 rounded-3xl space-y-4 border border-[var(--border-subtle)]">
        <div class="flex items-center justify-between"><div><h3 class="font-black text-sm flex items-center gap-2"><span>🎯</span> Bộ Đánh Giá NLU Tiếng Việt ${H(n.cases)} Câu (Vietnamese Intent Benchmark)</h3><p class="text-[11px] text-[var(--text-muted)]">Chạy thật bộ bóc tách: số người, ngân sách, trẻ nhỏ, bữa, chế độ · lần chạy ${H(hhmm(bm.ran_at))}</p></div>
          <button onclick="P2.live.M10.tabRerun()" class="px-3 py-1 rounded-xl bg-[#FBBF24] text-[#0F172A] font-extrabold text-xs hover:bg-[#F59E0B] transition">🧪 Chạy Lại Benchmark</button></div>
        <div class="space-y-2.5 max-h-[520px] overflow-y-auto">${(n.details || []).map((x) => `
          <div class="p-3.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2 text-xs">
            <div class="flex items-center justify-between gap-2"><span class="font-bold text-[var(--text-main)]">💬 "${H(x.query)}"</span>${x.passed ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#22C55E]/20 text-[#22C55E] shrink-0">✓ ĐÚNG</span>' : `<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-500/20 text-red-400 shrink-0">✗ SAI: ${H((x.failed_fields || []).join(", "))}</span>`}</div>
            <div class="flex flex-wrap gap-2 text-[10px]">
              <span class="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)]">👥 Số người: <strong>${H(x.parsed.party_size)}</strong></span>
              <span class="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)]">💰 Ngân sách: <strong>${H(fmtN(x.parsed.total_budget_vnd || 0))}đ</strong></span>
              <span class="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)]">👶 Trẻ nhỏ: <strong>${x.parsed.has_kids ? "Có" : "Không"}</strong></span>
              <span class="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-subtle)]">🍽️ Bữa: <strong>${H(x.parsed.meal_slot)}</strong></span>
              <span class="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] font-bold">🛡️ Chặn dị ứng: ${H((x.parsed.hard_allergies_applied || []).join(", ") || "theo hồ sơ")}</span>
            </div>
          </div>`).join("")}</div>
      </div>
      <div class="genui-card p-5 rounded-3xl space-y-4 border border-[var(--border-subtle)]">
        <div class="flex items-center justify-between"><div><h3 class="font-black text-sm flex items-center gap-2"><span>🧪</span> Thử Nghiệm A/B</h3><p class="text-[11px] text-[var(--text-muted)]">Tính từ sự kiện theo nhánh đã gán (z-test hai phía, ý nghĩa khi p &lt; 0,05 và ≥30 phiên mỗi nhánh) · ${ab.period_days} ngày</p></div>${ab.is_demo ? ctx.demoPill() : ""}</div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">${(ab.active_experiments || []).map((x) => `
          <div class="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2 text-xs">
            <div class="font-extrabold text-[var(--text-main)]">${H(x.name)}</div>
            <div class="text-[10px] text-[var(--text-muted)]">${H(x.metric_label)} · ${H(x.status === "running" ? "Đang chạy" : x.status === "paused" ? "Tạm dừng" : "Đã kết thúc")}</div>
            <div class="flex justify-between"><span>A · ${H(x.variants.A)}</span><b class="font-mono">${fmtPct(x.variant_a.rate === null ? null : Number((x.variant_a.rate * 100).toFixed(1)))} <span class="text-[10px] text-[var(--text-muted)]">(${fmtN(x.variant_a.sessions)})</span></b></div>
            <div class="flex justify-between"><span>B · ${H(x.variants.B)}</span><b class="font-mono">${fmtPct(x.variant_b.rate === null ? null : Number((x.variant_b.rate * 100).toFixed(1)))} <span class="text-[10px] text-[var(--text-muted)]">(${fmtN(x.variant_b.sessions)})</span></b></div>
            <div class="text-[11px] ${x.significant ? "text-[#22C55E] font-bold" : "text-[var(--text-muted)]"}">${x.significant ? "Thắng: " : ""}${H(x.winner)}${x.p_value === null ? "" : " · p = " + String(x.p_value).replace(".", ",")}${x.uplift_pct === null ? "" : " · B so với A " + sign(x.uplift_pct, "%")}</div>
            <button onclick="P2.live.M10.abStatus('${ctx.J(x.id)}','${x.status === "running" ? "paused" : "running"}')" class="px-3 py-1 rounded-xl border border-[var(--border-subtle)] font-bold text-[11px] hover:border-[#FBBF24]">${x.status === "running" ? "⏸ Tạm dừng" : "▶ Chạy tiếp"}</button>
          </div>`).join("")}</div>
      </div>`;
  }

  window.TOV_LIVE.register("M10", {
    screens,
    actions: {
      period(ctx, n) { days = n; ctx.reload(); },
      filter(ctx, name) { evFilter = name; ctx.reload("M10-S06"); },
      rerun(ctx) { ctx.action(() => ctx.api("/analytics/ai-performance/run", "POST", {}), () => ctx.reload("M10-S03")); },
      sendTest(ctx) {
        ctx.action(() => ctx.api("/events", "POST", { event_name: "app_open", session_id: sid(), platform: "desktop", properties: { source: "admin_explorer", test: true } }),
          () => ctx.reload("M10-S06"));
      },
      tabPeriod(ctx, n) { days = n; renderTab(ctx); },
      tabRerun(ctx) { ctx.action(() => ctx.api("/analytics/ai-performance/run", "POST", {}), () => renderTab(ctx)); },
      abStatus(ctx, id, status) { ctx.action(() => ctx.api("/analytics/ab-test/" + encodeURIComponent(id), "PATCH", { status }), () => renderTab(ctx)); },
    },
    fns: { loadLiveAnalytics: (ctx) => renderTab(ctx) },
  });

  // ── Client tracker: real actions → POST /api/v1/events (fire-and-forget) ──────────
  function sid() {
    try {
      let s = sessionStorage.getItem("tov_sid");
      if (!s) { s = "S-" + Math.random().toString(36).slice(2, 12); sessionStorage.setItem("tov_sid", s); }
      return s;
    } catch (_) { return "S-nostorage"; }
  }
  if (typeof window.fetch !== "function" || window.__tovTracker) return;
  window.__tovTracker = true;
  const raw = window.fetch.bind(window);
  let lastShown = [], todayCalls = 0;
  const platform = () => (window.innerWidth < 768 ? "mobile" : "web");
  function track(name, properties) {
    // Through window.fetch so the app's auth wrapper adds the token when there is one.
    setTimeout(() => {
      try { window.fetch("/api/v1/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_name: name, session_id: sid(), platform: platform(), properties }) }).catch(() => {}); } catch (_) {}
    }, 0);
  }
  window.fetch = async function (input, init = {}) {
    const res = await raw(input, init);
    try {
      const u = new URL(typeof input === "string" ? input : input.url, location.href);
      const m = (init.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
      const p = u.pathname;
      if (u.origin === location.origin && res.ok && p.startsWith("/api/v1/") && p !== "/api/v1/events") {
        const body = () => res.clone().json().catch(() => ({}));
        if (m === "GET" && p === "/api/v1/suggestions/today") {
          body().then((d) => {
            const items = d.items || [];
            lastShown = items.map((i) => i.dish_id);
            track(todayCalls++ ? "suggestion_swiped" : "suggestion_shown", { items: items.length, sponsored: items.filter((i) => i.is_sponsored).length, dish_ids: lastShown, latency_ms: d.latency_ms ?? null });
            items.filter((i) => i.is_sponsored && i.campaign_id).forEach((i) => track("ad_impression", { campaign_id: i.campaign_id }));
          });
        } else if (m === "GET" && /^\/api\/v1\/dishes\/DISH-[\w-]+$/.test(p)) {
          const id = p.split("/").pop(), rank = lastShown.indexOf(id) + 1;
          track("dish_view", { dish_id: id, ...(rank ? { rank, source: "suggestion" } : { source: "browse" }) });
        } else if (m === "GET" && /^\/api\/v1\/places\/PLACE-[\w-]+$/.test(p)) track("place_view", { place_id: p.split("/").pop() });
        else if (m === "POST" && p === "/api/v1/orders/redirect") {
          body().then((d) => track(d.action_type === "direction" ? "direction_click" : d.action_type === "call" ? "call_click" : "order_click",
            { partner: d.partner, place_id: d.place_id, dish_id: d.dish_id, redirect_id: d.id }));
        } else if (m === "POST" && p === "/api/v1/chat") track("chat_query", { query_len: String(init.body || "").length });
        else if (m === "POST" && p === "/api/v1/me/collections") track("save_dish", {});
        else if (m === "POST" && /^\/api\/v1\/ads\/campaigns\/[^/]+\/click$/.test(p)) track("ad_click", { campaign_id: p.split("/")[5] });
        else if (m === "POST" && /^\/api\/v1\/places\/[^/]+\/reports$/.test(p)) track("report_issue", { place_id: p.split("/")[4] });
      }
    } catch (_) {}
    return res;
  };
  const open = () => track("app_open", { source: /[?&]src=reminder/.test(location.search) ? "meal_reminder" : "organic" });
  try { if (!sessionStorage.getItem("tov_opened")) { sessionStorage.setItem("tov_opened", "1"); open(); } } catch (_) {}
})();
