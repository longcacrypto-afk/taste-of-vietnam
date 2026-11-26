/* M18 live wiring — M18-S01 fridge inventory (4 compartments, ≤48 h alert, add/edit/consume/remove,
 * dish suggestions), M18-S02 EAN-13 lookup + save, desktop tab "fridge" (loadLiveFridge, scanLiveFridgeItem).
 * API: GET/POST /fridge/inventory, PATCH/DELETE /fridge/inventory/:id, POST /fridge/inventory/:id/consume,
 *      GET /fridge/barcode/:ean, POST /fridge/scan, GET /fridge/suggestions. */
(function () {
  const COMP = { chill: "Ngăn mát", freeze: "Ngăn đông", door: "Cánh tủ", vegetable: "Ngăn rau củ" };
  const COMP_ICON = { chill: "❄️", freeze: "🧊", door: "🚪", vegetable: "🥦" };
  const UNITS = ["quả", "miếng", "g", "kg", "ml", "lít", "hộp", "chai", "gói", "lốc", "bó", "phần", "túi", "con", "khay"];
  const S = { filter: "all", editing: null, adding: false, code: "", scan: null, scanErr: "", v: 0, dFilter: "all", dScan: false };
  const COUNTABLE = new Set(["quả", "miếng", "hộp", "chai", "gói", "lốc", "bó", "phần", "túi", "con", "khay"]);

  const daysText = (it) =>
    it.is_expired ? (it.expires_in_days === 0 ? "Hết hạn hôm nay" : `Đã hết hạn ${Math.abs(it.expires_in_days)} ngày`)
      : it.hours_left < 24 ? `Còn ${Math.max(0, it.hours_left)} giờ` : `Còn ${it.expires_in_days} ngày`;
  const pill = (it) =>
    it.is_expired ? ["Hết hạn", "bg-[#18181B] text-white"] : it.is_expiring_soon ? ["Cận hạn", "bg-[#FEE2E2] text-[#DC2626]"] : ["Tươi ngon", "bg-[#DCFCE7] text-[#16A34A]"];
  const val = (sel) => document.querySelector(sel)?.value ?? "";
  const field = (cls) => `w-full min-w-0 px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[11px] text-[#0F172A] ${cls || ""}`;
  const opts = (map, cur) => Object.entries(map).map(([k, l]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${l}</option>`).join("");
  const unitOpts = (cur) => UNITS.map((u) => `<option ${u === cur ? "selected" : ""}>${u}</option>`).join("");

  function itemForm(ctx, it, scope) {
    // scope: "m" (mobile screen) or "d" (desktop tab); it = item being edited or null (add)
    const p = `data-f${scope}`;
    return `<div ${p} class="p-3 rounded-2xl bg-white border border-[#FBBF24] space-y-2 text-[#0F172A]">
      <b class="text-[11px]">${it ? "Sửa nguyên liệu" : "Thêm nguyên liệu"}</b>
      <input ${p}-name class="${field()}" maxlength="80" placeholder="Tên nguyên liệu (VD: Thịt heo ba rọi)" value="${ctx.H(it?.name || "")}">
      <div class="grid grid-cols-3 gap-1.5">
        <input ${p}-qty type="number" min="0.1" step="any" class="${field()}" placeholder="Số lượng" value="${ctx.H(it?.quantity ?? 1)}">
        <select ${p}-unit class="${field()}">${unitOpts(it?.unit || "phần")}</select>
        <select ${p}-comp class="${field()}">${opts(COMP, it?.compartment || "chill")}</select>
      </div>
      <label class="flex items-center gap-2 text-[10px] text-[#64748B]">Hạn dùng còn
        <input ${p}-days type="number" min="-30" max="3650" class="${field("w-20")}" value="${ctx.H(it ? Math.max(0, it.expires_in_days) : 3)}"> ngày</label>
      <div class="flex gap-1.5">
        <button type="button" onclick="P2.live.M18.saveItem('${scope}','${ctx.J(it?.id || "")}')" class="flex-1 py-1.5 rounded-lg bg-[#18181B] text-white font-extrabold text-[11px]">Lưu</button>
        <button type="button" onclick="P2.live.M18.cancelForm('${scope}')" class="px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[11px] font-bold">Huỷ</button>
      </div></div>`;
  }
  const itemButtons = (ctx, it, scope) => {
    const b = "px-2 py-0.5 rounded-md border border-[#E2E8F0] bg-white text-[10px] font-bold text-[#334155]";
    return `<div class="flex flex-wrap gap-1 mt-1">
      ${COUNTABLE.has(it.unit) && it.quantity > 1 ? `<button type="button" class="${b}" onclick="P2.live.M18.consume('${ctx.J(it.id)}',1,'${scope}')">Dùng 1 ${ctx.H(it.unit)}</button>` : ""}
      <button type="button" class="${b}" onclick="P2.live.M18.consume('${ctx.J(it.id)}','all','${scope}')">Đã dùng hết</button>
      <button type="button" class="${b}" onclick="P2.live.M18.edit('${ctx.J(it.id)}','${scope}')">Sửa</button>
      <button type="button" class="${b} text-[#DC2626]" onclick="P2.live.M18.remove('${ctx.J(it.id)}','${scope}')">Xoá</button></div>`;
  };
  const suggestionChips = (ctx, list) => (list || []).map((s) =>
    `<button type="button" onclick="P2.dish('${ctx.J(s.dish_id)}')" class="w-full text-left p-2 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-[10px] text-[#78350F]">🍲 <b>${ctx.H(s.name)}</b> · dùng ${ctx.H(s.matched.join(", "))}${s.uses_expiring.length ? ` <span class="text-[#DC2626] font-bold">(${ctx.H(s.uses_expiring.join(", "))} sắp hết hạn)</span>` : ""}</button>`).join("");

  function scanBox(ctx, scope) {
    // Shared EAN-13 result block (mobile M18-S02 is dark, desktop light)
    const sc = S.scan;
    if (S.scanErr) return `<div class="text-[11px] font-bold text-[#F87171]">${ctx.H(S.scanErr)}</div>`;
    if (!sc) return `<div class="text-[10px] opacity-80">Chưa có mã. Nhập 13 số in dưới mã vạch (hàng Việt Nam bắt đầu bằng 893).</div>`;
    const p = sc.product;
    const days = p ? p.shelf_life_days : 3;
    return `<div class="flex justify-between items-center gap-2"><b class="text-[#FBBF24]">${p ? "Đã nhận diện: " + ctx.H(p.name) : "Mã hợp lệ, chưa có trong danh mục"}</b><span class="text-[10px] opacity-60 shrink-0">EAN: ${ctx.H(sc.ean)}</span></div>
      <div class="text-[10px] opacity-80">${p ? `${ctx.H(p.brand)} · ` : ""}Xuất xứ mã GS1: ${ctx.H(sc.gs1_country)}${p ? ` · Tự động đề xuất: ${ctx.H(p.compartment_label)} · Hạn sử dụng: ${ctx.H(p.shelf_life_days)} ngày` : ""}</div>
      ${p ? "" : `<input data-s${scope}-name maxlength="80" class="${field()}" placeholder="Đặt tên nguyên liệu này (bắt buộc)">`}
      <div class="grid grid-cols-2 gap-1.5"><select data-s${scope}-comp class="${field()}">${opts(COMP, p?.compartment || "chill")}</select>
      <label class="flex items-center gap-1 text-[10px]">Hạn <input data-s${scope}-days type="number" min="0" max="3650" class="${field("w-16")}" value="${ctx.H(days)}"> ngày</label></div>`;
  }

  async function lookup(ctx, code) {
    S.code = String(code || "").replace(/\D/g, "");
    S.scan = null;
    S.scanErr = "";
    if (S.code.length !== 13) S.scanErr = "Mã EAN-13 cần đúng 13 chữ số.";
    else {
      try { S.scan = await ctx.api("/fridge/barcode/" + S.code); }
      catch (e) { S.scanErr = e.status === 400 ? "Mã không hợp lệ: sai chữ số kiểm tra EAN-13. Kiểm tra lại mã." : "Chưa tra được mã. Kiểm tra mạng rồi thử lại."; }
    }
  }

  // ─── desktop tab ────────────────────────────────────────────────────────
  async function renderDesktop(ctx) {
    const c = document.getElementById("live-fridge-content");
    if (!c) return;
    let d;
    try { d = await ctx.api("/fridge/inventory"); }
    catch (e) { c.innerHTML = '<div class="text-center py-10 text-xs text-red-500">Chưa tải được tủ lạnh. Kiểm tra mạng hoặc đăng nhập rồi thử lại.</div>'; return; }
    const H = ctx.H, f = S.dFilter;
    const items = f === "all" ? d.items : d.items.filter((i) => i.compartment === f);
    const exp = d.items.filter((i) => i.is_expiring_soon);
    const labels = { all: "Tất cả", chill: "Ngăn mát ❄️", freeze: "Ngăn đông 🧊", door: "Cánh tủ 🚪", vegetable: "Rau quả 🥦" };
    const sugg = await ctx.api("/fridge/suggestions").catch(() => ({ items: [] }));
    c.innerHTML = `
      <div class="p-5 rounded-3xl bg-gradient-to-br from-[#18181B] to-[#27272A] text-white space-y-3 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#22C55E] text-white">ZERO FOOD WASTE · ${d.is_demo ? "DỮ LIỆU DEMO" : "KHO CỦA BẠN"}</span>
          <span class="text-xs text-white/60">Tổng: ${H(d.total_items)} nguyên liệu · ${H(d.by_compartment.chill)} mát · ${H(d.by_compartment.freeze)} đông · ${H(d.by_compartment.door)} cánh · ${H(d.by_compartment.vegetable)} rau củ</span>
        </div>
        <div class="text-base font-extrabold text-white">Kho Tủ Lạnh Gia Đình Thông Minh</div>
        <p class="text-xs text-white/80 leading-relaxed">Theo dõi hạn dùng từng nguyên liệu, cảnh báo đồ sắp hết hạn trong 48 giờ và gợi ý món từ những thứ sẵn có. ${d.is_demo ? ctx.demoPill() : ""}</p>
      </div>
      ${S.dScan ? `<div class="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[#FBBF24] space-y-2 text-xs">
        <div class="font-extrabold">📷 Quét mã vạch EAN-13 <span class="font-normal text-[var(--text-muted)]">· Camera chưa kết nối trên web: nhập 13 số dưới mã vạch</span></div>
        <div class="flex gap-2"><input data-sd-code inputmode="numeric" maxlength="13" class="${field("max-w-xs")}" placeholder="VD: 8934567890120" value="${H(S.code)}">
          <button type="button" onclick="P2.live.M18.lookup('d')" class="px-3 py-1.5 rounded-lg bg-[#18181B] text-white font-bold">Tra mã</button></div>
        <div class="space-y-1.5">${scanBox(ctx, "d")}</div>
        ${S.scan ? `<button type="button" onclick="P2.live.M18.saveScan('d')" class="px-3 py-1.5 rounded-lg bg-[#22C55E] text-white font-extrabold">Lưu vào Tủ Lạnh</button>` : ""}
      </div>` : ""}
      ${exp.length ? `<div class="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-between gap-3">
          <div class="flex items-center gap-3"><span class="text-2xl">⚠️</span><div>
            <b class="text-xs text-[#DC2626]">Cảnh báo: ${H(exp.length)} nguyên liệu sắp hết hạn trong 48h!</b>
            <div class="text-[11px] text-[#991B1B]">${H(exp.map((e) => `${e.name} (${daysText(e)})`).join(", "))}${d.suggestion ? ` · Gợi ý: ${H(d.suggestion.name)}` : ""}</div></div></div>
          ${d.suggestion ? `<button onclick="P2.dish('${ctx.J(d.suggestion.dish_id)}')" class="px-3 py-1.5 rounded-xl bg-[#DC2626] text-white text-xs font-extrabold shrink-0 hover:bg-[#B91C1C]">Nấu Ngay</button>` : ""}
        </div>` : ""}
      <div class="flex items-center gap-2 overflow-x-auto pb-1">
        ${Object.entries(labels).map(([k, l]) => `<button onclick="loadLiveFridge('${k}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${f === k ? "bg-[#18181B] text-white" : "bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]"}">${H(l)}</button>`).join("")}
        <button onclick="P2.live.M18.add('d')" class="ml-auto px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#FBBF24] text-[#18181B] shrink-0">＋ Thêm nguyên liệu</button>
      </div>
      ${S.adding === "d" || S.editing?.scope === "d" ? itemForm(ctx, S.editing?.scope === "d" ? S.editing.item : null, "d") : ""}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${items.length ? items.map((it) => `
          <div class="p-4 rounded-2xl bg-[var(--bg-elevated)] border ${it.is_expiring_soon ? "border-red-300 dark:border-red-800" : "border-[var(--border-subtle)]"} flex items-center justify-between gap-3 shadow-sm">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl ${it.is_expiring_soon ? "bg-red-100 text-red-600" : "bg-[#FBBF24]/20 text-[#B45309]"} flex items-center justify-center text-xl shrink-0">${H(it.emoji || COMP_ICON[it.compartment])}</div>
              <div class="min-w-0"><div class="font-extrabold text-xs text-[var(--text-main)]">${H(it.name)}</div>
                <div class="text-[11px] text-[var(--text-muted)]">${H(it.quantity_label)} · ${H(it.compartment_label)}${it.barcode ? " · EAN " + H(it.barcode) : ""}</div>${itemButtons(ctx, it, "d")}</div>
            </div>
            <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold shrink-0 ${it.is_expiring_soon ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}">${H(daysText(it))}</span>
          </div>`).join("") : `<div class="md:col-span-2 p-6 rounded-2xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)]">Ngăn này đang trống.</div>`}
      </div>
      <div class="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
        <div class="font-extrabold text-xs">🍳 Món nấu được từ đồ có sẵn${d.applied_allergies?.length ? ` <span class="font-normal text-[var(--text-muted)]">(đã lọc món có thành phần dị ứng bạn khai báo)</span>` : ""}</div>
        ${sugg.items?.length ? `<div class="grid md:grid-cols-2 gap-2">${suggestionChips(ctx, sugg.items)}</div>` : '<div class="text-[11px] text-[var(--text-muted)]">Chưa có món trong danh mục khớp với nguyên liệu hiện có.</div>'}
      </div>`;
  }

  window.TOV_LIVE.register("M18", {
    screens: {
      "M18-S01": {
        key: () => "inv",
        async load(ctx) {
          const inv = await ctx.api("/fridge/inventory");
          const sugg = await ctx.api("/fridge/suggestions?limit=3").catch(() => ({ items: [] }));
          return { ...inv, suggestions: sugg.items || [] };
        },
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const [, alert, list, cook] = root.children;
          const exp = d.items.filter((i) => i.is_expiring_soon);
          // alert (≤48 h)
          const b = ctx.$("b", alert), sub = ctx.$("b + div", alert);
          if (exp.length) {
            b.textContent = `${exp.length} nguyên liệu cần dùng gấp trong 48h`;
            sub.textContent = exp.map((e) => `${e.name} (${daysText(e).replace(/^Còn /, "")})`).join(", ") + (d.suggestion ? ` · Gợi ý: ${d.suggestion.name}` : "");
          } else {
            alert.className = alert.className.replace("bg-[#FEF2F2]", "bg-[#F0FDF4]").replace("border-[#FECACA]", "border-[#BBF7D0]");
            ctx.$("span", alert).textContent = "✅";
            b.className = "text-[#16A34A]";
            b.textContent = "Không có nguyên liệu nào sắp hết hạn trong 48h";
            sub.className = "text-[10px] text-[#15803D]";
            sub.textContent = d.suggestion ? `Gợi ý: ${d.suggestion.name}` : `${d.total_items} nguyên liệu trong tủ`;
          }
          // compartment chips + add / scan controls (small added controls)
          const chips = [["all", "Tất cả", d.total_items], ...Object.entries(COMP).map(([k, l]) => [k, l, d.by_compartment[k]])]
            .map(([k, l, n]) => `<button type="button" onclick="P2.live.M18.filter('${k}')" class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full border text-[10px] font-bold ${S.filter === k ? "bg-[#18181B] text-white border-[#18181B]" : "bg-white border-[#E2E8F0]"}">${ctx.H(l)} ${ctx.H(n)}</button>`).join("");
          alert.insertAdjacentHTML("afterend", `<div class="flex gap-1.5 overflow-x-auto pb-1" data-fridge-chips>${chips}</div>
            <div class="flex gap-1.5"><button type="button" onclick="P2.live.M18.add('m')" class="flex-1 py-1.5 rounded-xl border border-[#E2E8F0] bg-white font-bold text-[11px]">＋ Thêm nguyên liệu</button>
            <button type="button" onclick="goScreen('M18-S02')" class="flex-1 py-1.5 rounded-xl border border-[#E2E8F0] bg-white font-bold text-[11px]">📷 Quét mã vạch</button></div>
            ${S.adding === "m" || S.editing?.scope === "m" ? itemForm(ctx, S.editing?.scope === "m" ? S.editing.item : null, "m") : ""}`);
          // items
          const tpl = list.children[0];
          list.innerHTML = "";
          const shown = S.filter === "all" ? d.items : d.items.filter((i) => i.compartment === S.filter);
          shown.forEach((it) => {
            const n = tpl.cloneNode(true);
            ctx.$("b", n).textContent = `${it.emoji || COMP_ICON[it.compartment]} ${it.name} (${it.quantity_label})`;
            const line = ctx.$("b + div", n);
            line.textContent = `${it.compartment_label} · ${daysText(it)}`;
            line.insertAdjacentHTML("afterend", itemButtons(ctx, it, "m"));
            const [txt, cls] = pill(it);
            const p = n.lastElementChild;
            p.textContent = txt;
            p.className = `px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${cls}`;
            list.append(n);
          });
          if (!shown.length) list.innerHTML = `<div class="p-3 rounded-2xl bg-[#F8FAFC] border border-dashed border-[#E2E8F0] text-center text-[11px] text-[#64748B]">${d.total_items ? "Ngăn này đang trống." : "Tủ lạnh trống. Thêm hoặc quét nguyên liệu để bắt đầu."}</div>`;
          // cook button → top suggestion (catalogue dish, allergy-safe)
          if (d.suggestion) cook.setAttribute("onclick", `P2.dish('${ctx.J(d.suggestion.dish_id)}')`);
          else { cook.disabled = true; cook.classList.add("opacity-50"); }
          if (d.suggestions.length) cook.insertAdjacentHTML("beforebegin", `<div class="space-y-1.5" data-fridge-suggestions>${suggestionChips(ctx, d.suggestions)}</div>`);
          else cook.insertAdjacentHTML("beforebegin", `<div class="text-[10px] text-[#64748B]">Chưa có món trong danh mục khớp với nguyên liệu hiện có.</div>`);
          if (d.is_demo) root.insertAdjacentHTML("beforeend", `<div>${ctx.demoPill()}</div>`);
          return root;
        },
      },
      "M18-S02": {
        key: () => String(S.v),
        async load() { return { scan: S.scan, err: S.scanErr, code: S.code }; },
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const [, frame, result, save] = root.children;
          ctx.$(".text-\\[11px\\]", frame).textContent = "Camera chưa kết nối trên web · nhập 13 số dưới mã vạch";
          frame.insertAdjacentHTML("afterend", `<div class="flex gap-1.5"><input data-sm-code inputmode="numeric" maxlength="13" placeholder="VD: 8934567890120" value="${ctx.H(S.code)}" class="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white text-[#0F172A] text-xs font-mono">
            <button type="button" onclick="P2.live.M18.lookup('m')" class="px-3 py-2 rounded-xl bg-[#FBBF24] text-[#18181B] font-extrabold text-[11px]">Tra mã</button></div>`);
          result.innerHTML = scanBox(ctx, "m");
          if (S.scan) save.setAttribute("onclick", "P2.live.M18.saveScan('m')");
          else { save.disabled = true; save.classList.add("opacity-50"); }
          if (S.scan?.product?.is_demo) root.insertAdjacentHTML("beforeend", `<div>${ctx.demoPill()} <span class="text-[10px] text-white/60">Danh mục mã vạch demo</span></div>`);
          return root;
        },
      },
    },
    actions: {
      filter(ctx, k) { S.filter = k; ctx.reload("M18-S01"); },
      add(ctx, scope) {
        S.editing = null; S.adding = scope;
        scope === "d" ? renderDesktop(ctx) : ctx.reload("M18-S01");
      },
      cancelForm(ctx, scope) {
        S.editing = null; S.adding = false;
        scope === "d" ? renderDesktop(ctx) : ctx.reload("M18-S01");
      },
      async edit(ctx, id, scope) {
        const d = await ctx.api("/fridge/inventory");
        S.adding = false;
        S.editing = { scope, item: d.items.find((i) => i.id === id) };
        scope === "d" ? renderDesktop(ctx) : ctx.reload("M18-S01");
      },
      saveItem(ctx, scope, id) {
        const p = `[data-f${scope}-`;
        const body = { name: val(p + "name]"), quantity: Number(val(p + "qty]")), unit: val(p + "unit]"), compartment: val(p + "comp]"), expires_in_days: Number(val(p + "days]")) };
        if (body.name.trim().length < 2) return ctx.status("Nhập tên nguyên liệu (ít nhất 2 ký tự).");
        if (!(body.quantity > 0)) return ctx.status("Số lượng phải lớn hơn 0.");
        ctx.action(() => (id ? ctx.api("/fridge/inventory/" + encodeURIComponent(id), "PATCH", body) : ctx.api("/fridge/inventory", "POST", body)), () => {
          S.editing = null; S.adding = false;
          ctx.status(id ? "Đã cập nhật nguyên liệu." : "Đã thêm vào tủ lạnh.");
          scope === "d" ? renderDesktop(ctx) : ctx.reload("M18-S01");
        });
      },
      consume(ctx, id, amount, scope) {
        ctx.action(() => ctx.api("/fridge/inventory/" + encodeURIComponent(id) + "/consume", "POST", { amount }), (r) => {
          ctx.status(r.removed ? `Đã dùng hết ${r.name}, đã bỏ khỏi tủ.` : `Đã trừ ${r.consumed}, còn ${r.remaining}.`);
          scope === "d" ? renderDesktop(ctx) : ctx.reload("M18-S01");
        });
      },
      remove(ctx, id, scope) {
        ctx.action(() => ctx.api("/fridge/inventory/" + encodeURIComponent(id), "DELETE"), () => {
          ctx.status("Đã xoá khỏi tủ lạnh.");
          scope === "d" ? renderDesktop(ctx) : ctx.reload("M18-S01");
        });
      },
      async lookup(ctx, scope) {
        await lookup(ctx, val(`[data-s${scope}-code]`));
        S.v++;
        scope === "d" ? renderDesktop(ctx) : ctx.reload("M18-S02");
      },
      saveScan(ctx, scope) {
        if (!S.scan) return;
        const body = { barcode: S.scan.ean, compartment: val(`[data-s${scope}-comp]`), expires_in_days: Number(val(`[data-s${scope}-days]`)) };
        if (!S.scan.product) {
          body.item_name = val(`[data-s${scope}-name]`).trim();
          if (body.item_name.length < 2) return ctx.status("Mã chưa có trong danh mục: hãy đặt tên cho nguyên liệu trước khi lưu.");
        }
        ctx.action(() => ctx.api("/fridge/scan", "POST", body), (r) => {
          S.scan = null; S.code = ""; S.v++;
          ctx.status(`Đã lưu ${r.scanned_item.name} vào ${r.scanned_item.compartment_label}.` + (r.zero_waste_suggestion ? ` Gợi ý: ${r.zero_waste_suggestion.recommended_dish}.` : ""));
          if (scope === "d") { S.dScan = false; renderDesktop(ctx); }
          else { ctx.reload("M18-S01"); ctx.goScreen("M18-S01"); }
        });
      },
    },
    fns: {
      loadLiveFridge(ctx, filter) { if (filter) S.dFilter = filter; return renderDesktop(ctx); },
      scanLiveFridgeItem(ctx) { S.dScan = !S.dScan; S.scan = null; S.scanErr = ""; return renderDesktop(ctx); },
    },
  });
})();
