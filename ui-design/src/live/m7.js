/* M7 live wiring — Quảng bá & Chiến dịch tài trợ + VietQR (M7-S01..M7-S08) and the desktop
 * Live App tab "merchant" (#lpanel-merchant, shared design of M6 + M7).
 * Endpoints (src/modules/m7.js): GET /ads/overview, GET /ads/campaigns, GET|POST|DELETE /ads/campaigns/builder,
 * POST /ads/campaigns/builder/submit, GET /ads/campaigns/:id/analytics, POST /ads/campaigns/:id/pause|resume,
 * GET /ads/account, GET /ads/payments/invoices, POST /ads/payments/topup,
 * POST /ads/payments/invoices/:id/sandbox-confirm. Tab header also reads GET /merchant/overview (M6).
 * Rule: every number/name shown comes from the API; sandbox confirmations say so. */
(function () {
  const sel = { campaign: null, amount: null };   // campaign chosen on S02/S07/S08, amount for S08
  let tabInvoice = null;                           // invoice shown in the desktop tab VietQR box
  const tr = (n) => {
    const v = Number(n || 0);
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 2).replace(/\.?0+$/, "") + "tr";
    if (Math.abs(v) >= 1e3) return Math.round(v / 1e3) + "k";
    return String(v);
  };
  const num = (n) => Number(n || 0).toLocaleString("vi-VN");
  const pill = (ctx, label, tone) => ctx.K.tagPill(ctx.H(label), tone || "yellow");
  const chip = (ctx, label, on, code, title) =>
    `<button type="button" onclick="${code}"${title ? ` title="${ctx.H(title)}"` : ""} class="px-2.5 py-1 rounded-full border text-[10px] font-bold ${on ? "bg-[#18181B] text-white border-[#18181B]" : "bg-white text-[#0F172A] border-[#E2E8F0]"}">${ctx.H(label)}</button>`;
  const body = (root, ctx) => ctx.$(".lg\\:col-span-9 > .space-y-4", root);
  // Merchant shell: brand line = account name, one demo pill next to the page title.
  // Desktop merchant design inside the product stage: same widening product_runtime applies to frozen
  // desktop previews (widenPreview), which does not cover live desktop screens yet.
  function widen() {
    requestAnimationFrame(() => {
      if (window.innerWidth <= 768) return;
      const frame = document.querySelector("#stage-container .phone-frame");
      if (!frame || !frame.querySelector("[data-m7-shell]")) return;
      frame.style.setProperty("max-width", "100%", "important");
      const aside = frame.querySelector("[data-m7-shell] aside");
      if (aside) aside.style.setProperty("display", "flex", "important");
    });
  }
  function shell(root, ctx, d) {
    root.setAttribute("data-m7-shell", "");
    widen();
    const acc = d && d.account;
    if (acc && acc.name) ctx.text(ctx.$("aside .text-\\[10px\\].text-\\[\\#4ADE80\\]", root), "● " + acc.name + (acc.is_demo ? " (demo)" : ""));
    if (d && d.is_demo) ctx.$(".lg\\:col-span-9 h3", root)?.insertAdjacentHTML("afterend", ctx.demoPill());
  }
  function kpi(root, ctx, i, value, delta) {
    const card = ctx.$$(".grid.grid-cols-2 > div", root)[i];
    if (!card) return;
    const spans = ctx.$$(".text-base > span", card);
    ctx.text(spans[0], value);
    if (spans[1]) ctx.text(spans[1], delta || "");
  }
  const save = (ctx, patch, next) => ctx.action(() => ctx.api("/ads/campaigns/builder", "POST", patch), () => (next ? ctx.goScreen(next) : ctx.reload()));
  const pickCampaign = (d) => {
    const items = d.campaigns || d.items || [];
    if (!items.some((c) => c.id === sel.campaign)) sel.campaign = (items.find((c) => c.status === "active") || items[0] || {}).id || null;
    return items.find((c) => c.id === sel.campaign) || null;
  };
  const controls = (ctx, c) =>
    c.can_pause ? `<button type="button" onclick="P2.live.M7.pause('${ctx.J(c.id)}')" class="px-3 py-2 rounded-full bg-white border border-[#E2E8F0] font-bold">⏸ Tạm dừng</button>`
      : c.can_resume ? `<button type="button" onclick="P2.live.M7.resume('${ctx.J(c.id)}')" class="px-3 py-2 rounded-full bg-[#DCFCE7] text-[#15803D] font-bold">▶ Chạy lại</button>` : "";
  function linePath(values) {
    const n = values.length;
    if (!n) return null;
    const max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
    const pts = values.map((v, i) => [n === 1 ? 320 : Math.round((i * 320) / (n - 1)), Math.round(78 - ((v - min) / span) * 62)]);
    return { line: pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" "), pts };
  }

  window.TOV_LIVE.register("M7", {
    screens: {
      // ── S01 Advertising overview ────────────────────────────────────────
      "M7-S01": {
        load: (ctx) => ctx.api("/ads/overview"),
        bind(html, d, ctx) {
          const root = ctx.dom(html), k = d.kpis || {};
          shell(root, ctx, d);
          kpi(root, ctx, 0, k.roas == null ? "—" : k.roas + "x", k.roas >= 3 ? "Tốt" : k.roas == null ? "Chưa có chi phí" : "");
          kpi(root, ctx, 1, (k.cvr_pct || 0) + "%", num(k.conversions) + " lượt");
          kpi(root, ctx, 2, tr(k.revenue_vnd_30d), "30 ngày");
          kpi(root, ctx, 3, tr(k.spend_vnd_30d), "30 ngày");
          const chart = ctx.$(".md\\:col-span-7", root);
          if (chart) {
            ctx.text(ctx.$(".space-y-2 .font-extrabold", chart), `Lượt hiển thị tài trợ · ${(d.series || []).length} ngày gần nhất`);
            ctx.text(ctx.$(".space-y-2 .rounded-full", chart), k.roas == null ? `CTR ${k.ctr_pct || 0}%` : `ROAS ${k.roas}x · CTR ${k.ctr_pct}%`);
            const svg = ctx.$("svg", chart), lp = linePath((d.series || []).map((s) => s.impressions));
            const paths = svg ? ctx.$$("path", svg) : [];
            svg && ctx.$$("circle", svg).forEach((c) => c.remove());
            if (svg && lp && paths.length === 2) {
              paths[0].setAttribute("d", lp.line + " L320,85 L0,85 Z");
              paths[1].setAttribute("d", lp.line);
              const last = lp.pts[lp.pts.length - 1];
              svg.insertAdjacentHTML("beforeend", `<circle cx="${last[0]}" cy="${last[1]}" r="5" fill="#22C55E" stroke="#FFFFFF" stroke-width="2"/>`);
              const s = d.series, first = s[0], end = s[s.length - 1];
              svg.insertAdjacentHTML("afterend", `<div class="flex justify-between text-[10px] text-[#64748B]"><span>${ctx.H(first.date)} · ${num(first.impressions)}</span><span>${ctx.H(end.date)} · ${num(end.impressions)} lượt</span></div>`);
            } else if (svg) svg.outerHTML = `<div class="h-24 flex items-center justify-center text-[11px] text-[#64748B]">Chưa có số liệu hiển thị theo ngày</div>`;
          }
          const bars = ctx.$(".md\\:col-span-5", root);
          const perf = d.performance || [];
          if (bars) {
            const old = ctx.$(".pt-3", bars);
            const best = perf.findIndex((p) => p.key === d.best_slot);
            if (old) old.outerHTML = perf.some((p) => p.index > 0)
              ? ctx.K.barChart(perf.map((p) => p.index), perf.map((p) => p.label), "#FBBF24", best)
              : `<div class="h-32 flex items-center justify-center text-[11px] text-[#64748B]">Chưa có lượt hiển thị theo khung giờ</div>`;
            bars.insertAdjacentHTML("beforeend", `<div class="text-[10px] text-[#64748B]">Chỉ số = CTR so với khung tốt nhất (100). ${d.counts ? `${d.counts.active}/${d.counts.total} chiến dịch đang chạy${d.counts.pending_review ? ` · ${d.counts.pending_review} chờ duyệt` : ""}` : ""}</div>`);
          }
          return root;
        },
      },
      // ── S02 Campaign list ───────────────────────────────────────────────
      "M7-S02": {
        load: (ctx) => ctx.api("/ads/campaigns"),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          shell(root, ctx, d);
          const list = ctx.$(".space-y-3", body(root, ctx));
          const [active, pending] = ctx.$$(":scope > div", list);
          list.innerHTML = "";
          if (!d.items.length) {
            list.innerHTML = ctx.stateHtml("M7-S02", "empty");
            return root;
          }
          d.items.forEach((c) => {
            const n = (c.status === "pending_review" ? pending : active).cloneNode(true);
            const im = ctx.$("img", n);
            if (im && c.img_key) ctx.img(im, c.img_key);
            ctx.text(ctx.$("b", n), c.title);
            const tag = ctx.$("b + span", n);
            if (tag) tag.outerHTML = pill(ctx, c.status_label, c.tone);
            const bits = [`${c.dish_name} · ${c.place_name}`, `Bán kính ${(c.radius_m / 1000).toFixed(1).replace(".0", "")}km`];
            if (c.slot_hours.length) bits.push("Khung giờ " + c.slot_hours.join(" & "));
            if (c.weather_label) bits.push(c.weather_label);
            if (c.status !== "pending_review") bits.push("CTR " + c.ctr_pct + "%");
            bits.push("Số dư " + ctx.money(c.balance_vnd) + (c.sandbox_credit_vnd ? ` (+${ctx.money(c.sandbox_credit_vnd)} sandbox)` : ""));
            ctx.text(ctx.$(".mt-0\\.5", n), bits.join(" · "));
            const btn = ctx.$(":scope > button", n);
            if (c.status === "pending_review") {
              ctx.text(btn, "Thanh toán VietQR");
              ctx.click(btn, `P2.live.M7.open('${ctx.J(c.id)}','M7-S08')`);
            } else ctx.click(btn, `P2.live.M7.open('${ctx.J(c.id)}','M7-S07')`);
            const extra = controls(ctx, c);
            if (extra) {
              const wrap = document.createElement("div");
              wrap.className = "flex items-center gap-2 shrink-0";
              btn.before(wrap);
              wrap.insertAdjacentHTML("beforeend", extra);
              wrap.append(btn);
            }
            list.append(n);
          });
          return root;
        },
      },
      // ── S03 Builder step 1: dish ───────────────────────────────────────
      "M7-S03": {
        load: (ctx) => ctx.api("/ads/campaigns/builder"),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          shell(root, ctx, d);
          const grid = ctx.$(".grid", body(root, ctx));
          const [onTpl, offTpl] = ctx.$$(":scope > div", grid);
          grid.innerHTML = "";
          if (!d.dishes.length) grid.outerHTML = ctx.stateHtml("M7-S03", "empty");
          d.dishes.forEach((x) => {
            const on = x.dish_id === d.draft.dish_id && x.place_id === d.draft.place_id;
            const n = (on ? onTpl : offTpl).cloneNode(true);
            const im = ctx.$("img", n);
            if (im && x.img_key) ctx.img(im, x.img_key);
            const name = ctx.$(".font-extrabold.text-sm", n);
            ctx.text(name, `${x.name} (${ctx.money(x.price_vnd)})`);
            const note = ctx.$("div.text-\\[10px\\]", n);
            const allergy = x.allergen_tags ? (x.allergen_tags.length ? "tag dị ứng: " + x.allergen_tags.join(", ") : "không có tag dị ứng") : "";
            if (!x.eligible) {
              ctx.text(note, "✕ " + x.reason);
              note.className = "text-[10px] text-[#BE123C] font-bold";
              n.style.opacity = "0.6";
            } else if (on) ctx.text(note, `✔ Đã kiểm tra an toàn · ${allergy} · ${x.place_name}`);
            else {
              ctx.text(note, [x.fit, x.place_name, allergy].filter(Boolean).join(" · "));
              ctx.click(n, `P2.live.M7.pickDish('${ctx.J(x.dish_id)}','${ctx.J(x.place_id)}')`);
              n.style.cursor = "pointer";
            }
            grid.append(n);
          });
          const next = ctx.$(":scope > button", body(root, ctx));
          if (next) ctx.click(next, d.draft.dish_id ? `P2.live.M7.saveNext({dish_id:'${ctx.J(d.draft.dish_id)}',place_id:'${ctx.J(d.draft.place_id)}',step:'dish'},'M7-S04')` : "P2.live.M7.noDish()");
          return root;
        },
      },
      // ── S04 Builder step 2: radius, meal slots, weather ────────────────
      "M7-S04": {
        load: (ctx) => ctx.api("/ads/campaigns/builder"),
        bind(html, d, ctx) {
          const root = ctx.dom(html), dr = d.draft, o = d.options;
          shell(root, ctx, d);
          const cards = ctx.$$(".grid > div", body(root, ctx));
          const km = (m) => (m / 1000).toFixed(1);
          if (cards[0]) {
            ctx.text(ctx.$(".p-3", cards[0]), `📍 Trong vòng ${km(dr.radius_m)} km quanh quán`);
            const steps = [];
            for (let r = o.radius.min; r <= o.radius.max; r += 1000) steps.push(r);
            cards[0].insertAdjacentHTML("beforeend", `<div class="flex flex-wrap gap-1.5">${steps.map((r) => chip(ctx, km(r).replace(".0", "") + "km", r === dr.radius_m, `P2.live.M7.set({radius_m:${r}})`)).join("")}</div>`);
          }
          if (cards[1]) {
            const on = o.meal_slots.filter((s) => dr.meal_slots.includes(s.key));
            ctx.text(ctx.$(".p-3", cards[1]), "☀️ " + (on.map((s) => `${s.label} (${s.hours})`).join(" & ") || "Chưa chọn khung giờ"));
            cards[1].insertAdjacentHTML("beforeend", `<div class="flex flex-wrap gap-1.5">${o.meal_slots.map((s) => {
              const has = dr.meal_slots.includes(s.key);
              const nextSlots = has ? dr.meal_slots.filter((k) => k !== s.key) : dr.meal_slots.concat(s.key);
              return chip(ctx, s.short + " " + s.hours, has, nextSlots.length ? `P2.live.M7.set({meal_slots:${ctx.H(JSON.stringify(nextSlots))}})` : "P2.live.M7.needSlot()");
            }).join("")}</div>`);
          }
          if (cards[2]) {
            const on = o.weather.filter((w) => dr.weather.includes(w.key));
            ctx.text(ctx.$(".p-3", cards[2]), on.map((w) => `${w.emoji} ${w.label}`).join(" · ") || "Chưa chọn");
            cards[2].insertAdjacentHTML("beforeend", `<div class="flex flex-wrap gap-1.5">${o.weather.map((w) => chip(ctx, w.short, dr.weather.includes(w.key), `P2.live.M7.set({weather:['${w.key}']})`)).join("")}</div>`);
          }
          const next = ctx.$(":scope > button", body(root, ctx));
          if (next) ctx.click(next, `P2.live.M7.saveNext({step:'targeting'},'M7-S05')`);
          return root;
        },
      },
      // ── S05 Builder step 3: budget & schedule ──────────────────────────
      "M7-S05": {
        load: (ctx) => ctx.api("/ads/campaigns/builder"),
        bind(html, d, ctx) {
          const root = ctx.dom(html), dr = d.draft, q = d.quote || {};
          shell(root, ctx, d);
          const cards = ctx.$$(".grid > div", body(root, ctx));
          const plans = Object.fromEntries(d.options.plans.map((p) => [p.key, p]));
          const style = (el, on) => { el.className = el.className.replace(/border-2 border-\[#FBBF24\]|border border-\[#E2E8F0\]/, on ? "border-2 border-[#FBBF24]" : "border border-[#E2E8F0]"); };
          [["ctx30", cards[0]], ["cpa_daily", cards[1]]].forEach(([key, el]) => {
            if (!el) return;
            const p = plans[key], on = dr.plan === key;
            style(el, on);
            const tag = ctx.$(":scope > span", el);
            if (tag) tag.outerHTML = pill(ctx, p.tag + (on ? " · Đang chọn" : ""), key === "ctx30" ? "yellow" : "blue");
            ctx.text(ctx.$(".text-lg", el), key === "ctx30" ? `${p.name} · ${ctx.money(p.price_vnd)}` : `${p.name} · ${ctx.money(on ? dr.daily_budget_vnd : p.daily_budget_vnd)} / ngày`);
            ctx.text(ctx.$("p", el), p.note);
            if (!on) { ctx.click(el, `P2.live.M7.set({plan:'${key}'})`); el.style.cursor = "pointer"; }
          });
          if (cards[1] && dr.plan === "cpa_daily") {
            cards[1].insertAdjacentHTML("beforeend",
              `<div class="flex flex-wrap gap-1.5">${[30000, 50000, 100000].map((v) => chip(ctx, tr(v) + "/ngày", dr.daily_budget_vnd === v, `P2.live.M7.set({daily_budget_vnd:${v}})`)).join("")}</div>` +
              `<div class="flex flex-wrap gap-1.5">${[7, 14, 30].map((v) => chip(ctx, v + " ngày", dr.days === v, `P2.live.M7.set({days:${v}})`)).join("")}</div>` +
              (q.est_actions_per_day ? `<p class="text-[10px] text-[#64748B]">Ước tính ~${q.est_actions_per_day} lượt hành động/ngày theo CPA đã ghi nhận ${ctx.money(q.ref_cpa_vnd)}.</p>` : ""));
          }
          body(root, ctx).insertAdjacentHTML("afterbegin", `<div class="bg-white p-3 rounded-2xl border border-[#E2E8F0] font-extrabold">Tổng cần nạp: ${ctx.money(q.total_vnd)} · ${ctx.H(q.days)} ngày chạy</div>`);
          const next = ctx.$(":scope > button", body(root, ctx));
          if (next) ctx.click(next, `P2.live.M7.saveNext({step:'budget'},'M7-S06')`);
          return root;
        },
      },
      // ── S06 Preview & hard-rule compliance → submit ─────────────────────
      "M7-S06": {
        load: (ctx) => ctx.api("/ads/campaigns/builder"),
        bind(html, d, ctx) {
          const root = ctx.dom(html), pv = d.preview;
          shell(root, ctx, d);
          if (!pv) {
            body(root, ctx).innerHTML = ctx.stateHtml("M7-S06", "empty");
            return root;
          }
          const card = ctx.$(".md\\:col-span-6", body(root, ctx));
          const im = ctx.$("img", card);
          if (im && pv.img_key) ctx.img(im, pv.img_key);
          ctx.text(ctx.$("b", card), pv.title);
          ctx.text(ctx.$(".mt-0\\.5", card), `${pv.place_name} · Bán kính ${pv.radius_km}km · ${pv.open_label || "Chưa rõ giờ mở"} · ${pv.context_label}`);
          ctx.text(ctx.$(".font-extrabold.text-\\[\\#D97736\\]", card), ctx.money(pv.price_vnd));
          const side = ctx.$$(".md\\:col-span-6", body(root, ctx))[1];
          const btn = ctx.$("button", side);
          btn.insertAdjacentHTML("beforebegin", `<ul class="space-y-1 text-[11px]">${d.checks.map((c) => `<li class="${c.ok ? "text-[#15803D]" : "text-[#BE123C]"} font-bold">${c.ok ? "✔" : "✕"} ${ctx.H(c.label)}</li>`).join("")}</ul>` +
            `<div class="text-[11px] text-[#64748B]">Vị trí thẻ: slot ${ctx.H(pv.slot)} · Gửi duyệt xong chiến dịch ở trạng thái Chờ duyệt (M9-S07), chỉ chạy sau khi quản trị duyệt.</div>`);
          if (d.ready) ctx.click(btn, "P2.live.M7.submit()");
          else { btn.disabled = true; btn.style.opacity = "0.6"; ctx.text(btn, "Chưa đủ điều kiện gửi duyệt"); }
          return root;
        },
      },
      // ── S07 Analytics & anti-fraud ──────────────────────────────────────
      "M7-S07": {
        key: () => sel.campaign || "first",
        async load(ctx) {
          let id = sel.campaign;
          if (!id) {
            const l = await ctx.api("/ads/campaigns");
            id = (l.items.find((c) => c.status === "active") || l.items[0] || {}).id;
          }
          if (!id) return { empty: true };
          return ctx.api("/ads/campaigns/" + encodeURIComponent(id) + "/analytics");
        },
        bind(html, d, ctx) {
          if (d.empty) return ctx.stateHtml("M7-S07", "empty");
          const root = ctx.dom(html), m = d.metrics, c = d.campaign;
          shell(root, ctx, d);
          kpi(root, ctx, 0, num(m.impressions), m.impressions_change_pct == null ? "" : (m.impressions_change_pct >= 0 ? "+" : "") + m.impressions_change_pct + "% tuần");
          kpi(root, ctx, 1, m.ctr_pct + "%", num(c.clicks) + " click");
          kpi(root, ctx, 2, num(m.conversions), m.cpa_vnd ? ctx.money(m.cpa_vnd) + "/action" : "");
          kpi(root, ctx, 3, num(m.filtered_fraud_clicks), "Miễn phí");
          const note = ctx.$(":scope > div", body(root, ctx));
          if (note) ctx.text(note, `Hệ thống Anti-Fraud tự động không tính phí các click lặp lại trong ${d.anti_fraud.cooldown_window_seconds} giây từ cùng một thiết bị. Click hợp lệ: ${num(d.anti_fraud.valid_clicks)} · đã loại trừ: ${num(d.anti_fraud.filtered_fraud_clicks)}.`);
          body(root, ctx).insertAdjacentHTML("afterbegin",
            `<div class="bg-white p-3 rounded-2xl border border-[#E2E8F0] space-y-2"><div class="flex flex-wrap items-center gap-2"><b class="text-sm">${ctx.H(c.title)}</b>${pill(ctx, c.status_label, c.tone)}<span class="text-[11px] text-[#64748B]">${ctx.H(c.dish_name)} · ${ctx.H(c.place_name)} · Chi 30 ngày ${ctx.money(m.spend_vnd_30d)}</span>${controls(ctx, c)}</div>` +
            (d.campaigns.length > 1 ? `<div class="flex flex-wrap gap-1.5">${d.campaigns.map((x) => chip(ctx, x.title, x.id === c.id, `P2.live.M7.open('${ctx.J(x.id)}','M7-S07')`)).join("")}</div>` : "") + "</div>");
          return root;
        },
      },
      // ── S08 VietQR top-up & invoices ───────────────────────────────────
      "M7-S08": {
        load: (ctx) => ctx.api("/ads/payments/invoices"),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          shell(root, ctx, d);
          const c = pickCampaign(d);
          const [left, right] = ctx.$$(".grid > div", body(root, ctx));
          const pending = c ? d.items.find((i) => i.campaign_id === c.id && i.status === "PENDING_PAYMENT" && i.qr) : null;
          const box = ctx.$(".w-36", left), spans = ctx.$$("span", box);
          const tag = ctx.$(":scope > span", left);
          if (pending) {
            box.classList.remove("h-36"); box.style.height = "auto";
            box.insertAdjacentHTML("afterbegin", `<img src="${ctx.H(pending.qr.image)}" alt="Mã VietQR ${ctx.H(pending.number)}" class="w-32 h-32 rounded-lg bg-white p-1 mb-1" data-m7-qr />`);
            ctx.text(spans[1], ctx.money(pending.amount_vnd));
            ctx.text(spans[2], pending.memo);
            left.insertAdjacentHTML("beforeend", `<div class="text-[10px] text-[#64748B] text-left space-y-0.5"><div>${ctx.H(pending.qr.bank_name)} (${ctx.H(pending.qr.bank_bin)}) · STK ${ctx.H(pending.qr.account_number)}</div><div>${ctx.H(pending.qr.account_holder)}</div><div>Hoá đơn #${ctx.H(pending.number)} · hết hạn ${ctx.H(new Date(pending.expires_at).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }))}</div></div>`);
          } else {
            ctx.text(spans[1], ctx.money(sel.amount || 500000));
            ctx.text(spans[2], c ? "Chưa tạo mã" : "Chưa có chiến dịch");
          }
          if (tag) tag.outerHTML = pill(ctx, d.payos_configured ? "● Tự động gạch nợ khi PayOS xác nhận (webhook)" : "● PayOS chưa cấu hình · chưa nhận tiền thật", d.payos_configured ? "green" : "orange");
          if (c) {
            const amounts = [...new Set([500000, 1500000, sel.amount].filter(Boolean))];
            left.insertAdjacentHTML("beforeend",
              `<div class="flex flex-wrap justify-center gap-1.5">${d.campaigns.filter((x) => x.status !== "rejected").map((x) => chip(ctx, x.title, x.id === c.id, `P2.live.M7.open('${ctx.J(x.id)}','M7-S08')`)).join("")}</div>` +
              (pending
                ? (d.sandbox_available ? `<button type="button" onclick="P2.live.M7.sandboxConfirm('${ctx.J(pending.id)}')" class="w-full py-2 rounded-full bg-[#DBEAFE] text-[#1D4ED8] font-extrabold">Xác nhận thử (Sandbox · không có tiền thật)</button>` : "")
                : `<div class="flex flex-wrap justify-center gap-1.5">${amounts.map((v) => chip(ctx, ctx.money(v), (sel.amount || 500000) === v, `P2.live.M7.amount(${v})`)).join("")}</div><button type="button" onclick="P2.live.M7.topup('${ctx.J(c.id)}',${Number(sel.amount || 500000)})" class="w-full py-2 rounded-full bg-[#22C55E] text-white font-extrabold">Tạo mã VietQR ${ctx.money(sel.amount || 500000)}</button>`));
          }
          const rows = ctx.$$(".flex.justify-between", right), rowTpl = rows[0];
          rows.forEach((r) => r.remove());
          const b = d.balance || {};
          ctx.$(".font-extrabold.text-sm", right)?.insertAdjacentHTML("afterend", `<div class="text-[11px] text-[#64748B]">Số dư chiến dịch: <b class="text-[#0F172A]">${ctx.money(b.real_vnd)}</b>${b.sandbox_vnd ? ` · Sandbox (không phải tiền thật): ${ctx.money(b.sandbox_vnd)}` : ""}</div>`);
          if (!d.items.length) right.insertAdjacentHTML("beforeend", ctx.stateHtml("M7-S08", "empty"));
          d.items.forEach((i, idx) => {
            const n = rowTpl.cloneNode(true);
            n.className = "flex justify-between items-center py-2 " + (idx < d.items.length - 1 ? "border-b border-[#F1F5F9]" : "");
            ctx.text(ctx.$("span", n), `#${i.number} · ${i.label}`);
            const p = ctx.$("span:last-child", n);
            p.outerHTML = pill(ctx, `${ctx.money(i.amount_vnd)} · ${i.status_label}`, i.tone);
            right.append(n);
          });
          return root;
        },
      },
    },

    actions: {
      open(ctx, id, screen) { sel.campaign = id; ctx.goScreen(screen); },
      pickDish(ctx, dish_id, place_id) { save(ctx, { dish_id, place_id }); },
      set(ctx, patch) { save(ctx, patch); },
      saveNext(ctx, patch, next) { save(ctx, patch, next); },
      noDish(ctx) { ctx.status("Quán chưa có món đủ điều kiện quảng bá (cần khai báo tag dị ứng)."); },
      needSlot(ctx) { ctx.status("Cần giữ ít nhất một khung giờ bữa ăn."); },
      submit(ctx) {
        ctx.action(() => ctx.api("/ads/campaigns/builder/submit", "POST", {}), (r) => {
          sel.campaign = r.campaign.id; sel.amount = r.amount_due_vnd;
          ctx.status(r.review);
          ctx.goScreen("M7-S08");
        });
      },
      pause(ctx, id) { ctx.action(() => ctx.api("/ads/campaigns/" + encodeURIComponent(id) + "/pause", "POST", {}), () => ctx.reload()); },
      resume(ctx, id) { ctx.action(() => ctx.api("/ads/campaigns/" + encodeURIComponent(id) + "/resume", "POST", {}), () => ctx.reload()); },
      amount(ctx, v) { sel.amount = v; ctx.reload(); },
      topup(ctx, id, amount) {
        ctx.action(() => ctx.api("/ads/payments/topup", "POST", { campaign_id: id, amount_vnd: amount }), (r) => { ctx.reload(); ctx.status(r.note); });
      },
      sandboxConfirm(ctx, invId) {
        ctx.action(() => ctx.api("/ads/payments/invoices/" + encodeURIComponent(invId) + "/sandbox-confirm", "POST", {}), (r) => { ctx.reload(); ctx.status(r.message); });
      },
    },

    // ── Desktop Live App tab "merchant" (M6 overview header + M7 balance / VietQR / campaigns) ──
    tabs: {
      merchant: {
        async mount(panel, ctx) {
          const acc = await ctx.api("/ads/account");
          let ov = null;
          try { ov = await ctx.api("/merchant/overview"); } catch (_) { ov = null; } // M6 (legacy or new shape)
          const ovPlace = ov && (ov.place || ov.profile || (ov.merchant && ov.merchant.place) || null);
          const mine = acc.places.find((p) => ovPlace && p.id === ovPlace.id) || acc.places[0] || null;
          const head = ctx.$(":scope > .flex.items-center.justify-between", panel);
          if (head) {
            const name = (ovPlace && ovPlace.name) || (mine && mine.name) || acc.account.name;
            const addr = (ovPlace && ovPlace.address) || (mine && mine.address) || "";
            ctx.text(ctx.$("h2", head), name);
            ctx.text(ctx.$("p", head), "📍 " + addr + (mine && mine.is_verified ? " · Quán đối tác xác minh" : ""));
            const st = ctx.$(":scope > span", head);
            const status = (ovPlace && ovPlace.open_status && ovPlace.open_status.status) || (mine && mine.open_status) || "unknown";
            if (st) {
              st.textContent = status === "open" ? "🟢 Đang Mở Cửa" : status === "closed" ? "🔴 Đang Đóng Cửa" : "⚪ " + ((mine && mine.open_label) || "Chưa rõ giờ mở");
              st.className = "px-3 py-1 rounded-full text-xs font-bold " + (status === "open" ? "bg-[#DCFCE7] text-[#15803D]" : status === "closed" ? "bg-[#FFE4E6] text-[#BE123C]" : "bg-[#F1F5F9] text-[#475569]");
            }
            ctx.$("[data-demo-pill]", panel)?.remove();
            if (acc.is_demo) ctx.$("h2", head).insertAdjacentHTML("afterend", ctx.demoPill());
          }
          const b = acc.balance;
          const bal = document.getElementById("live-merchant-balance");
          if (bal) {
            bal.textContent = ctx.money(b.real_vnd);
            const sub = bal.nextElementSibling;
            if (sub) sub.textContent = `Chống click tặc ${acc.anti_fraud.cooldown_window_seconds}s · đã loại ${num(acc.anti_fraud.filtered_fraud_clicks)} click` + (b.sandbox_vnd ? ` · Sandbox: ${ctx.money(b.sandbox_vnd)} (không phải tiền thật)` : "");
          }
          const confirmBtn = ctx.$("#live-vietqr-box .justify-end button", panel);
          if (confirmBtn) confirmBtn.textContent = "Xác nhận thử (Sandbox · không có tiền thật)";
          ctx.$("[data-m7-campaigns]", panel)?.remove();
          const camps = acc.campaigns.map((c) => `<div class="flex items-center justify-between gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0">
              <div class="min-w-0"><div class="flex items-center gap-2"><b class="text-xs truncate">${ctx.H(c.title)}</b>${pill(ctx, c.status_label, c.tone)}</div>
              <div class="text-[11px] text-[var(--text-muted)]">${ctx.H(c.place_name)} · ${num(c.impressions)} hiển thị · CTR ${c.ctr_pct}% · Số dư ${ctx.money(c.balance_vnd)}</div></div>
              <div class="flex gap-1.5 shrink-0">${c.can_pause ? `<button type="button" onclick="P2.live.M7.tabPause('${ctx.J(c.id)}')" class="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[11px] font-bold">⏸ Tạm dừng</button>` : ""}${c.can_resume ? `<button type="button" onclick="P2.live.M7.tabResume('${ctx.J(c.id)}')" class="px-3 py-1.5 rounded-xl bg-[#DCFCE7] text-[#15803D] text-[11px] font-bold">▶ Chạy lại</button>` : ""}${c.status !== "rejected" ? `<button type="button" onclick="openLiveVietQrModal(500000,'${ctx.J(c.id)}')" class="px-3 py-1.5 rounded-xl bg-[#FBBF24] text-[#0F172A] text-[11px] font-extrabold">Nạp</button>` : ""}</div></div>`).join("");
          const invs = acc.invoices.slice(0, 3).map((i) => `<div class="flex justify-between items-center py-1.5 text-[11px]"><span>#${ctx.H(i.number)} · ${ctx.H(i.label)}</span>${pill(ctx, `${ctx.money(i.amount_vnd)} · ${i.status_label}`, i.tone)}</div>`).join("");
          panel.insertAdjacentHTML("beforeend", `<div data-m7-campaigns class="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
            <div class="flex items-center justify-between"><span class="font-extrabold text-sm">Chiến dịch tài trợ (M7)</span><span class="text-[10px] text-[var(--text-muted)]">Tối đa 1/3 slot · nhãn "Tài trợ" · không vượt bộ lọc dị ứng</span></div>
            ${camps || '<div class="text-xs text-[var(--text-muted)]">Chưa có chiến dịch</div>'}
            ${invs ? `<div class="pt-2 border-t border-[var(--border-subtle)]"><div class="text-xs font-extrabold mb-1">Hoá đơn gần đây</div>${invs}</div>` : ""}</div>`);
          panel.dataset.m7Campaign = acc.default_campaign_id || "";
        },
      },
    },
    fns: {
      async openLiveVietQrModal(ctx, amount, campaignId) {
        const panel = document.getElementById("lpanel-merchant"), box = document.getElementById("live-vietqr-box");
        const cmp = campaignId || panel?.dataset.m7Campaign;
        if (!box || !cmp) return ctx.status("Chưa có chiến dịch để nạp tiền.");
        try {
          const r = await ctx.api("/ads/payments/topup", "POST", { campaign_id: cmp, amount_vnd: Number(amount) || 500000 });
          tabInvoice = r.invoice.id;
          box.classList.remove("hidden");
          const img = document.getElementById("live-vietqr-img");
          if (img) { img.src = r.qr.image; img.alt = "Mã VietQR " + r.invoice.number; }
          const rows = box.querySelectorAll(".space-y-1\\.5 > div");
          const vals = [`${r.qr.bank_name} (${r.qr.bank_bin})`, r.qr.account_number, r.qr.account_holder];
          vals.forEach((v, i) => { const s = rows[i]?.querySelectorAll("span")[1]; if (s) s.textContent = v; });
          const amt = document.getElementById("live-qr-amt");
          if (amt) amt.textContent = ctx.money(r.qr.amount_vnd);
          const memo = document.getElementById("live-qr-memo");
          if (memo) memo.textContent = r.qr.memo;
          const btn = box.querySelector(".justify-end button");
          if (btn) { btn.textContent = "Xác nhận thử (Sandbox · không có tiền thật)"; btn.disabled = !r.sandbox_available; btn.style.opacity = r.sandbox_available ? "" : "0.6"; }
          ctx.status(r.note);
        } catch (e) {
          ctx.status(e.status === 401 || e.status === 403 ? "Nạp tiền quảng cáo chỉ dành cho tài khoản chủ quán hoặc quản trị." : "Chưa tạo được mã VietQR. Thử lại sau.", true);
        }
      },
      confirmLivePayment(ctx) {
        if (!tabInvoice) return ctx.status("Chưa có hoá đơn VietQR nào đang chờ.");
        const id = tabInvoice;
        ctx.action(() => ctx.api("/ads/payments/invoices/" + encodeURIComponent(id) + "/sandbox-confirm", "POST", {}), async (r) => {
          tabInvoice = null;
          document.getElementById("live-vietqr-box")?.classList.add("hidden");
          const panel = document.getElementById("lpanel-merchant");
          await window.TOV_LIVE.tab("merchant").mount(panel, ctx);
          ctx.status(r.message);
        });
      },
    },
  });
  // Tab buttons reuse the screen actions but repaint the tab instead of a screen.
  const mod = window.TOV_LIVE.modules.M7;
  const remount = (ctx) => mod.tabs.merchant.mount(document.getElementById("lpanel-merchant"), ctx);
  mod.actions.tabPause = (ctx, id) => ctx.action(() => ctx.api("/ads/campaigns/" + encodeURIComponent(id) + "/pause", "POST", {}), () => remount(ctx));
  mod.actions.tabResume = (ctx, id) => ctx.action(() => ctx.api("/ads/campaigns/" + encodeURIComponent(id) + "/resume", "POST", {}), () => remount(ctx));
})();
