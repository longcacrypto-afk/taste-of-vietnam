/* M20 live wiring — M20-S01 community recipe feed (core /community/recipes: filters, one like per
 * account), M20-S02 VietQR tip (tip-intent → QR to the author's own account, or sandbox; the tipper
 * confirms the transfer themselves), desktop tab "community" (loadLiveCommunity, tipLiveRecipe,
 * openLiveCreateRecipeModal) incl. the author's payout account and posting a recipe. */
(function () {
  const S = { tag: "", maxMin: 0, q: "", current: null, tip: null, dTip: null, dCreate: false, dPayout: false };
  const PRESETS = [10000, 20000, 50000, 100000];
  const k = (v) => `${Math.round((v || 0) / 1000).toLocaleString("en-US")}k đ`;
  const val = (sel) => document.querySelector(sel)?.value ?? "";
  const field = "w-full min-w-0 px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[11px] text-[#0F172A]";
  const listPath = () => {
    const p = new URLSearchParams();
    if (S.tag) p.set("tag", S.tag);
    if (S.maxMin) p.set("max_minutes", S.maxMin);
    if (S.q) p.set("q", S.q);
    const s = p.toString();
    return "/community/recipes" + (s ? "?" + s : "");
  };

  function qrBox(ctx, tip, big) {
    const size = big ? "w-40 h-40" : "w-32 h-32";
    if (!tip) return `<div class="${size} mx-auto bg-white rounded-xl border-2 border-[#FBBF24] flex items-center justify-center font-mono text-[10px] text-center p-2 text-[#78350F]">Chọn mức ủng hộ để tạo mã VietQR</div>`;
    const q = tip.vietqr || {};
    if (tip.sandbox || !q.qr_image_url)
      return `<div class="${size} mx-auto bg-white rounded-xl border-2 border-dashed border-[#94A3B8] flex flex-col items-center justify-center font-mono text-[10px] text-center p-2 text-[#475569]"><b class="text-[#0F172A]">SANDBOX</b>Không phải mã thanh toán<br>${ctx.H(k(tip.amount_vnd))}</div>`;
    return `<div class="${size} mx-auto bg-white rounded-xl border-2 border-[#FBBF24] flex items-center justify-center overflow-hidden"><img src="${ctx.H(q.qr_image_url)}" alt="VietQR ${ctx.H(q.bank_name)} ${ctx.H(k(tip.amount_vnd))}" class="w-full h-full object-contain" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'font-mono text-[9px] break-all p-1',textContent:${ctx.H(JSON.stringify(q.qr_emvco_raw))}}))"></div>`;
  }
  const tipInfo = (ctx, tip) => {
    if (!tip) return "";
    const q = tip.vietqr || {};
    return `<div class="text-[10px] text-[#78350F] space-y-0.5">${tip.sandbox ? "" : `<div><b>${ctx.H(q.bank_name)}</b> · ${ctx.H(q.account_name)} · STK ${ctx.H(q.account_number)}</div>`}
      <div>Số tiền ${ctx.H(Number(tip.amount_vnd).toLocaleString("vi-VN"))}đ · Nội dung: ${ctx.H(q.transfer_memo)}</div>
      <div class="opacity-80">${ctx.H(tip.note)}</div>${tip.status === "CONFIRMED_BY_TIPPER" ? `<div class="font-bold text-[#15803D]">✓ Bạn đã xác nhận chuyển khoản</div>` : ""}</div>`;
  };

  async function pickRecipe(ctx) {
    if (S.current) return S.current;
    const l = await ctx.api("/community/recipes");
    return l.recipes?.[0]?.id || null;
  }

  // ─── desktop tab ────────────────────────────────────────────────────────
  async function renderDesktop(ctx) {
    const c = document.getElementById("live-community-content");
    if (!c) return;
    let list, payout = null;
    try {
      list = await ctx.api(listPath());
      payout = await ctx.api("/community/payout-account").catch(() => null);
    } catch (e) { c.innerHTML = '<div class="text-center py-10 text-xs text-red-500">Chưa tải được công thức cộng đồng. Kiểm tra mạng rồi thử lại.</div>'; return; }
    const H = ctx.H, banks = payout?.banks || {};
    const chip = (on, label, js) => `<button onclick="${js}" class="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 ${on ? "bg-[#18181B] text-white" : "bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]"}">${label}</button>`;
    c.innerHTML = `
      <div class="flex flex-wrap items-center gap-2">
        ${chip(!S.tag && !S.maxMin, "Tất cả", "P2.live.M20.filter('','0','d')")}
        ${chip(S.tag === "zero_waste", "♻️ Zero-Waste", "P2.live.M20.filter('zero_waste','0','d')")}
        ${chip(S.maxMin === 20, "⏱️ ≤ 20 phút", "P2.live.M20.filter('','20','d')")}
        <input data-cd-q class="${field} max-w-[220px]" placeholder="Tìm món, nguyên liệu, tác giả" value="${H(S.q)}" onkeydown="if(event.key==='Enter')P2.live.M20.search('d')">
        <button onclick="P2.live.M20.search('d')" class="px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--border-subtle)]">Tìm</button>
        <button onclick="P2.live.M20.toggle('dPayout')" class="ml-auto px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--border-subtle)]">🏦 Tài khoản nhận tip${payout?.payout ? ": " + H(payout.payout.bank_name) + " " + H(payout.payout.account_number_masked) : ""}</button>
        ${list.recipes.some((r) => r.is_demo) ? ctx.demoPill() : ""}
      </div>
      ${S.dPayout ? `<div class="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[#FBBF24] space-y-2 text-xs max-w-lg">
        <div class="font-extrabold">Tài khoản ngân hàng nhận tip cho công thức của bạn</div>
        <div class="text-[11px] text-[var(--text-muted)]">Người ủng hộ quét VietQR và chuyển thẳng vào tài khoản này. Tiền không đi qua ứng dụng.</div>
        <select data-pd-bin class="${field}">${Object.entries(banks).map(([b, n]) => `<option value="${b}" ${payout?.payout?.bank_bin === b ? "selected" : ""}>${H(n)} (${b})</option>`).join("")}</select>
        <input data-pd-acc inputmode="numeric" class="${field}" placeholder="Số tài khoản">
        <input data-pd-name class="${field}" placeholder="Tên chủ tài khoản (không dấu)" value="${H(payout?.payout?.account_name || "")}">
        <button onclick="P2.live.M20.savePayout()" class="px-3 py-1.5 rounded-lg bg-[#18181B] text-white font-bold">Lưu tài khoản</button></div>` : ""}
      ${S.dCreate ? `<div class="p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[#FBBF24] space-y-2 text-xs max-w-lg">
        <div class="font-extrabold">✍️ Đăng công thức mới</div>
        <input data-rd-title maxlength="120" class="${field}" placeholder="Tên món (VD: Bún sườn nấu sấu)">
        <div class="grid grid-cols-3 gap-2"><input data-rd-min type="number" min="1" max="1440" class="${field}" placeholder="Phút nấu">
          <input data-rd-kcal type="number" min="0" max="10000" class="${field}" placeholder="kcal / phần">
          <select data-rd-diff class="${field}"><option>Rất dễ</option><option selected>Dễ</option><option>Trung bình</option><option>Khó</option></select></div>
        <input data-rd-zw maxlength="40" class="${field}" placeholder="Mẹo Zero-Waste (không bắt buộc)">
        <textarea data-rd-ing rows="3" class="${field}" placeholder="Nguyên liệu, mỗi dòng một thứ"></textarea>
        <button onclick="P2.live.M20.createRecipe()" class="px-3 py-1.5 rounded-lg bg-[#FBBF24] text-[#18181B] font-extrabold">Đăng công thức</button></div>` : ""}
      ${S.dTip ? `<div class="p-4 rounded-2xl bg-[#FFFBEB] border border-[#FCD34D] space-y-2 text-xs max-w-lg text-[#0F172A]">
        <div class="font-black text-sm text-[#B45309]">Tặng Thưởng Tác Giả: ${H(S.dTip.author)}</div>
        <div class="flex gap-2">${PRESETS.map((a) => `<button onclick="P2.live.M20.tip(${a},'d')" class="px-3 py-1 rounded-lg font-bold ${S.tip?.amount_vnd === a && S.tip?.recipe_id === S.dTip.id ? "bg-[#D97706] text-white" : "bg-white border border-[#D97706] text-[#B45309]"}">${k(a)}</button>`).join("")}</div>
        ${S.tip && S.tip.recipe_id === S.dTip.id ? `<div class="flex gap-3 items-start">${qrBox(ctx, S.tip)}<div class="flex-1 space-y-2">${tipInfo(ctx, S.tip)}
          <button onclick="P2.live.M20.confirm('d')" ${S.tip.sandbox || S.tip.status !== "PENDING_TRANSFER" ? "disabled" : ""} class="px-3 py-1.5 rounded-lg bg-[#18181B] text-white font-extrabold disabled:opacity-40">Xác nhận đã chuyển khoản</button></div></div>` : ""}
        <button onclick="P2.live.M20.closeTip()" class="text-[11px] underline">Đóng</button></div>` : ""}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${list.recipes.length ? list.recipes.map((r) => `
          <div class="p-5 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-3 shadow-sm flex flex-col justify-between">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0"><span class="text-2xl">${H(r.author_avatar || "👨‍🍳")}</span>
                  <div class="min-w-0"><div class="font-extrabold text-xs text-[var(--text-main)]">${H(r.author)}</div>
                    <div class="text-[10px] text-[var(--text-muted)]">${r.is_mine ? "Công thức của bạn" : r.payout_ready ? "Đã có tài khoản nhận tip" : "Đầu bếp cộng đồng"}</div></div></div>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#22C55E]/15 text-[#15803D] shrink-0">Đã nhận ${H(k(r.tips_received_vnd))} Tip</span>
              </div>
              <div class="font-black text-sm text-[var(--text-main)]">${H(r.title)}</div>
              ${r.zero_waste_tag ? `<div class="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">♻️ ${H(r.zero_waste_tag)}</div>` : ""}
              <div class="flex items-center gap-3 text-[11px] text-[var(--text-muted)] pt-1"><span>⏱️ ${H(r.prep_time_minutes)} phút</span><span>•</span><span>Độ khó: ${H(r.difficulty)}</span><span>•</span><span>🔥 ${H(r.calories)} kcal</span></div>
              <div class="flex flex-wrap gap-1.5 pt-1">${(r.ingredients || []).map((i) => `<span class="px-2 py-0.5 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[10px]">${H(i)}</span>`).join("")}</div>
            </div>
            <div class="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
              <button onclick="P2.live.M20.like('${ctx.J(r.id)}','d')" ${r.liked_by_me ? "disabled" : ""} class="px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] text-xs font-bold hover:border-red-400 flex items-center gap-1.5 transition ${r.liked_by_me ? "text-red-500" : ""}"><span>❤️</span> ${H(r.likes_count)} Thích</button>
              ${r.is_mine ? "" : `<button onclick="tipLiveRecipe('${ctx.J(r.id)}', '${ctx.J(r.author)}')" class="px-3.5 py-1.5 rounded-xl bg-[#FBBF24] text-[#18181B] font-extrabold text-xs hover:bg-[#F59E0B] transition flex items-center gap-1.5 shadow-sm"><span>💸</span> Tip VietQR</button>`}
            </div>
          </div>`).join("") : '<div class="md:col-span-2 p-6 rounded-2xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)]">Không có công thức phù hợp bộ lọc.</div>'}
      </div>`;
  }

  window.TOV_LIVE.register("M20", {
    screens: {
      "M20-S01": {
        key: () => [S.tag, S.maxMin, S.q].join("|"),
        load: (ctx) => ctx.api(listPath()),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const card = root.children[1];
          const chip = (on, label, js) => `<button type="button" onclick="${js}" class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full border text-[10px] font-bold ${on ? "bg-[#18181B] text-white border-[#18181B]" : "bg-white border-[#E2E8F0]"}">${label}</button>`;
          card.insertAdjacentHTML("beforebegin", `<div class="flex gap-1.5"><input data-cm-q value="${ctx.H(S.q)}" placeholder="Tìm món, nguyên liệu, tác giả" class="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-[#E2E8F0] text-[11px]" onkeydown="if(event.key==='Enter')P2.live.M20.search('m')">
            <button type="button" onclick="P2.live.M20.search('m')" class="px-3 py-1.5 rounded-xl bg-[#18181B] text-white text-[11px] font-bold">Tìm</button></div>
            <div class="flex gap-1.5 overflow-x-auto pb-1">${chip(!S.tag && !S.maxMin, "Tất cả", "P2.live.M20.filter('','0','m')")}${chip(S.tag === "zero_waste", "♻️ Zero-Waste", "P2.live.M20.filter('zero_waste','0','m')")}${chip(S.maxMin === 20, "⏱️ ≤ 20 phút", "P2.live.M20.filter('','20','m')")}</div>`);
          card.remove();
          if (!d.recipes.length) root.insertAdjacentHTML("beforeend", `<div class="p-3 rounded-2xl bg-[#F8FAFC] border border-dashed border-[#E2E8F0] text-center text-[11px] text-[#64748B]">Không có công thức phù hợp bộ lọc.</div>`);
          d.recipes.forEach((r) => {
            const n = card.cloneNode(true);
            const [head, title, zw, foot] = n.children;
            ctx.$("span", head).textContent = r.author_avatar || "👨‍🍳";
            ctx.$("b", head).textContent = r.author;
            head.lastElementChild.textContent = `Đã nhận ${k(r.tips_received_vnd)} Tip`;
            title.textContent = r.title;
            if (r.zero_waste_tag) zw.textContent = "♻️ " + r.zero_waste_tag; else zw.remove();
            const [time, likes] = foot.children;
            time.textContent = `⏱️ ${r.prep_time_minutes} phút · ${r.calories} kcal · ${r.difficulty}`;
            const like = document.createElement("button");
            like.type = "button";
            like.className = likes.className + (r.liked_by_me ? " text-[#DC2626]" : "");
            like.textContent = `${r.liked_by_me ? "❤️ Đã thích" : "🤍 Thích"} · ${r.likes_count}`;
            if (r.liked_by_me) like.disabled = true; else like.setAttribute("onclick", `P2.live.M20.like('${ctx.J(r.id)}','m')`);
            likes.replaceWith(like);
            if (!r.is_mine) foot.insertAdjacentHTML("afterend", `<button type="button" onclick="P2.live.M20.openTip('${ctx.J(r.id)}')" class="w-full py-1.5 rounded-xl bg-[#FBBF24] text-[#18181B] font-extrabold text-[11px]">💸 Tip VietQR cho tác giả</button>`);
            root.append(n);
          });
          if (d.recipes.some((r) => r.is_demo)) root.insertAdjacentHTML("beforeend", `<div>${ctx.demoPill()}</div>`);
          return root;
        },
      },
      "M20-S02": {
        key: () => (S.current || "first") + ":" + (S.tip?.tip_id || "") + ":" + (S.tip?.status || ""),
        async load(ctx) {
          const id = await pickRecipe(ctx);
          return id ? ctx.api("/community/recipes/" + encodeURIComponent(id)) : null;
        },
        bind(html, r, ctx) {
          if (!r) return ctx.stateHtml("M20-S02", "empty");
          const root = ctx.dom(html);
          const [, box, confirm] = root.children;
          const [title, sub, qr, amounts] = box.children;
          const tip = S.tip && S.tip.recipe_id === r.id ? S.tip : null;
          title.textContent = "Tặng Thưởng Tác Giả: " + r.author;
          title.insertAdjacentHTML("afterend", `<div class="text-[11px] font-bold text-[#0F172A]">${ctx.H(r.title)}</div>`);
          if (!r.payout_ready) sub.textContent = "Tác giả chưa khai báo tài khoản nhận tip · chế độ sandbox, không phát sinh chuyển khoản";
          qr.outerHTML = qrBox(ctx, tip);
          const tpl = amounts.children[1];
          amounts.innerHTML = "";
          (r.tip_presets_vnd || PRESETS).forEach((a) => {
            const b = tpl.cloneNode(true);
            b.textContent = k(a);
            b.className = tip?.amount_vnd === a ? "px-3 py-1 rounded-lg bg-[#D97706] text-white font-bold" : "px-3 py-1 rounded-lg bg-white border border-[#D97706] font-bold text-[#B45309]";
            b.setAttribute("onclick", `P2.live.M20.tip(${a},'m','${ctx.J(r.id)}')`);
            amounts.append(b);
          });
          amounts.className = amounts.className.replace("justify-center gap-2", "justify-center gap-1.5 flex-wrap");
          if (tip) amounts.insertAdjacentHTML("afterend", tipInfo(ctx, tip));
          box.insertAdjacentHTML("beforeend", `<div class="text-[9px] text-[#78350F]/70">Tổng "Đã nhận ${ctx.H(k(r.tips_received_vnd))}" gồm số liệu mẫu và lượt người ủng hộ tự xác nhận, ứng dụng không đối soát với ngân hàng.</div>`);
          if (tip && !tip.sandbox && tip.status === "PENDING_TRANSFER") confirm.setAttribute("onclick", "P2.live.M20.confirm('m')");
          else {
            confirm.disabled = true;
            confirm.classList.add("opacity-40");
            if (tip?.status === "CONFIRMED_BY_TIPPER") confirm.textContent = "Đã xác nhận chuyển khoản";
          }
          if (r.is_demo) root.insertAdjacentHTML("beforeend", `<div>${ctx.demoPill()}</div>`);
          return root;
        },
      },
    },
    actions: {
      filter(ctx, tag, max, scope) {
        S.tag = tag; S.maxMin = Number(max) || 0;
        scope === "d" ? renderDesktop(ctx) : ctx.reload("M20-S01");
      },
      search(ctx, scope) {
        S.q = val(`[data-c${scope}-q]`).trim();
        scope === "d" ? renderDesktop(ctx) : ctx.reload("M20-S01");
      },
      like(ctx, id, scope) {
        ctx.action(() => ctx.api("/community/recipes/" + encodeURIComponent(id) + "/like", "POST"), () =>
          (scope === "d" ? renderDesktop(ctx) : ctx.reload("M20-S01")));
      },
      openTip(ctx, id) { S.current = id; S.tip = null; ctx.goScreen("M20-S02"); },
      tip(ctx, amount, scope, id) {
        const rid = scope === "d" ? S.dTip?.id : id;
        if (!rid) return;
        ctx.action(() => ctx.api("/community/recipes/" + encodeURIComponent(rid) + "/tip-intent", "POST", { amount_vnd: amount }), (t) => {
          S.tip = t; S.current = rid;
          ctx.status(t.sandbox ? "Mã sandbox: tác giả chưa có tài khoản nhận, không có tiền được chuyển." : "Đã tạo mã VietQR. Quét bằng app ngân hàng rồi bấm xác nhận.");
          scope === "d" ? renderDesktop(ctx) : ctx.reload("M20-S02");
        });
      },
      confirm(ctx, scope) {
        if (!S.tip) return;
        ctx.action(() => ctx.api("/community/tips/" + encodeURIComponent(S.tip.tip_id) + "/confirm", "POST"), (t) => {
          S.tip = t;
          ctx.status("Đã ghi nhận bạn xác nhận chuyển khoản. Cảm ơn bạn đã ủng hộ tác giả!");
          scope === "d" ? renderDesktop(ctx) : ctx.reload("M20-S02");
        });
      },
      closeTip(ctx) { S.dTip = null; renderDesktop(ctx); },
      toggle(ctx, key) { S[key] = !S[key]; renderDesktop(ctx); },
      savePayout(ctx) {
        const body = { bank_bin: val("[data-pd-bin]"), account_number: val("[data-pd-acc]").replace(/\s+/g, ""), account_name: val("[data-pd-name]") };
        if (!/^\d{6,19}$/.test(body.account_number)) return ctx.status("Số tài khoản cần 6–19 chữ số.");
        ctx.action(() => ctx.api("/community/payout-account", "PUT", body), () => { S.dPayout = false; ctx.status("Đã lưu tài khoản nhận tip."); renderDesktop(ctx); });
      },
      createRecipe(ctx) {
        const body = { title: val("[data-rd-title]").trim(), prep_time_minutes: Number(val("[data-rd-min]")) || undefined, calories: Number(val("[data-rd-kcal]")) || undefined,
          difficulty: val("[data-rd-diff]"), zero_waste_tag: val("[data-rd-zw]").trim() || undefined,
          ingredients: val("[data-rd-ing]").split("\n").map((s) => s.trim()).filter(Boolean) };
        if (body.title.length < 2) return ctx.status("Nhập tên công thức (ít nhất 2 ký tự).");
        ctx.action(() => ctx.api("/community/recipes", "POST", body), () => { S.dCreate = false; ctx.status("Đã đăng công thức lên Bếp Sáng Tạo."); renderDesktop(ctx); });
      },
    },
    fns: {
      loadLiveCommunity: (ctx) => renderDesktop(ctx),
      tipLiveRecipe(ctx, id, author) { S.dTip = { id, author }; if (S.tip?.recipe_id !== id) S.tip = null; return renderDesktop(ctx); },
      openLiveCreateRecipeModal(ctx) { S.dCreate = !S.dCreate; return renderDesktop(ctx); },
    },
  });
})();
