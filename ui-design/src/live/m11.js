/* M11 live wiring — M11-S01 thực đơn 7 ngày, M11-S02 giỏ đi chợ gộp, M11-S03 tủ lạnh có gì.
 * API: GET/POST/PUT /meal-plans/weekly, POST /meal-plans/weekly/days/:date/regenerate,
 * GET /groceries/consolidated, PATCH/POST/DELETE /groceries/items, GET /meal-plans/fridge-suggestions.
 * Desktop tab 'mealplan': loadLiveMealPlan is replaced (fns). */
(function () {
  const st = { ingredients: [] }; // ingredients typed on M11-S03 (not stored; fridge items come from M18)
  const fail = (ctx, map) => (e) => ctx.status((map && map[e.status]) || "Chưa thực hiện được. Kiểm tra mạng hoặc phiên đăng nhập rồi thử lại.", true);
  const write = async (ctx, job, done, map) => {
    try { ctx.status("Đang xử lý…"); const d = await job(); document.getElementById("p2-action-status")?.remove(); await done?.(d); }
    catch (e) { fail(ctx, map)(e); }
  };
  const allergyText = (d) => (d.applied_allergies || []).length
    ? "Đã loại món có " + d.applied_allergies.map((a) => a.label).join(", ") + " theo nhãn thành phần"
    : "Chưa khai báo dị ứng";
  const subOf = (root, ctx) => ctx.$(".text-center .text-\\[10px\\]", root);

  function dayCard(ctx, tplToday, tplOther, tplVeg, d, i) {
    const tpl = d.is_today ? tplToday : d.all_vegetarian ? tplVeg : tplOther;
    const n = tpl.cloneNode(true);
    ctx.text(ctx.$("b", n), `${d.day} ${d.date_label} · ${d.dish_name || "Chưa có món phù hợp"}`);
    const sub = ctx.$("b + div", n);
    const meals = Object.values(d.meals || {}).filter(Boolean);
    ctx.text(sub, `${d.calories.toLocaleString("vi-VN")} kcal · Chi phí chợ ${ctx.money(d.est_market_cost_vnd)}` + (meals.length ? " · " + meals.map((m) => m.slot_label).join("/") : ""));
    const pill = n.lastElementChild;
    const label = d.is_today ? "Hôm nay" : d.is_past ? "Đã qua" : d.all_vegetarian ? "Ngày Chay" : "Sắp tới";
    const variant = d.is_today ? "yellow" : d.all_vegetarian ? "mint" : d.is_past ? "dark" : "blue";
    const right = document.createElement("div");
    right.className = "flex flex-col items-end gap-1 shrink-0";
    right.innerHTML = ctx.K.tagPill(ctx.H(label), variant) + (d.is_past ? "" :
      `<button type="button" onclick="P2.live.M11.regen('${ctx.J(d.date)}')" class="px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] text-[10px] font-bold">🔄 Đổi món</button>`);
    pill.replaceWith(right);
    n.firstElementChild.classList.add("min-w-0");
    return n;
  }

  window.TOV_LIVE.register("M11", {
    screens: {
      "M11-S01": {
        load: (ctx) => ctx.api("/meal-plans/weekly"),
        bind(html, d, ctx) {
          if (!d?.days?.length) return ctx.stateHtml("M11-S01", "empty");
          const root = ctx.dom(html);
          ctx.text(subOf(root, ctx), `M11-S01 · ${d.servings} người · ${d.weekly_budget_vnd ? "Ngân sách " + ctx.money(d.weekly_budget_vnd) : "Ước tính " + ctx.money(d.total_cost_vnd)} / tuần`);
          const tipBox = ctx.$(".flex-1.border", root);
          if (tipBox) {
            ctx.text(tipBox.firstElementChild, `Bếp lên lịch 7 ngày (${d.meals_per_day === 3 ? "Sáng/Trưa/Tối" : "Trưa + Tối"}) cho ${d.servings} người!`);
            ctx.text(tipBox.lastElementChild, `${d.distinct_dishes} món khác nhau từ thực đơn có công thức · ${allergyText(d)}.` + (d.over_budget ? " Vượt ngân sách tuần — bấm Lên lại." : ""));
          }
          const list = ctx.$(":scope > .space-y-2", root);
          const cards = [...list.children];
          const [t0, t1, t2] = cards;
          cards.forEach((c) => c.remove());
          d.days.forEach((day, i) => list.append(dayCard(ctx, t0, t1, t2, day, i)));
          list.insertAdjacentHTML("beforebegin", `<div class="flex items-center justify-between gap-2 text-[11px]">
            <div class="flex items-center gap-1.5 font-bold">👥 <button type="button" onclick="P2.live.M11.servings(${d.servings - 1})" ${d.servings <= 1 ? "disabled" : ""} class="w-6 h-6 rounded-full border border-[#E2E8F0]">−</button><span>${ctx.H(d.servings)} người</span><button type="button" onclick="P2.live.M11.servings(${d.servings + 1})" ${d.servings >= 12 ? "disabled" : ""} class="w-6 h-6 rounded-full border border-[#E2E8F0]">+</button></div>
            <button type="button" onclick="P2.live.M11.regenAll()" class="px-3 py-1 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] font-bold">🔄 Lên lại cả tuần</button></div>`);
          if (d.replaced_for_safety) list.insertAdjacentHTML("beforebegin", `<div class="text-[10px] text-[#B45309]">Đã thay ${ctx.H(d.replaced_for_safety)} bữa không còn hợp hồ sơ của bạn.</div>`);
          return root;
        },
      },
      "M11-S02": {
        load: (ctx) => ctx.api("/groceries/consolidated"),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          ctx.text(subOf(root, ctx), `M11-S02 · Đã gộp ${d.days_count} ngày (${d.to_buy_count} mục cần mua)`);
          const box = ctx.$(":scope > .rounded-3xl", root);
          if (!d.aisles?.length) { box.innerHTML = ctx.stateHtml("M11-S02", "empty"); return root; }
          const head = box.children[0], rowMid = box.children[1], rowLast = box.children[box.children.length - 1];
          const boxes = d.aisles.map((a) => {
            const b = box.cloneNode(false);
            const h = head.cloneNode(true);
            ctx.text(ctx.$("b", h), a.label);
            h.lastElementChild.outerHTML = ctx.K.tagPill(ctx.H(a.est_cost_vnd ? ctx.money(a.est_cost_vnd) : a.items.length + " mục"), a.id === "extra" ? "blue" : "yellow");
            b.append(h);
            a.items.forEach((it, i) => {
              const r = (i === a.items.length - 1 ? rowLast : rowMid).cloneNode(true);
              const done = it.checked || it.in_fridge;
              r.classList.add("cursor-pointer", "gap-2", "w-full", "text-left");
              r.setAttribute("onclick", it.in_fridge ? "" : `P2.live.M11.check('${ctx.J(it.id)}', ${!it.checked})`);
              const why = it.extra ? "tự thêm" : it.in_fridge ? "có trong tủ lạnh" : (it.dishes || []).join(", ");
              r.firstElementChild.innerHTML = `${done ? "✓" : "☐"} <span class="${done ? "line-through text-[#94A3B8]" : ""}">${ctx.H(it.name)}</span> <span class="text-[10px] text-[#64748B]">(${ctx.H(why)})</span>`;
              const amt = it.in_fridge ? "🧊" : it.amount == null ? "" : `${it.partly_in_fridge ? it.to_buy_amount + " " + it.to_buy_unit : it.amount + " " + it.unit}`;
              ctx.text(r.lastElementChild, amt);
              r.lastElementChild.classList.add("shrink-0");
              if (it.extra) r.lastElementChild.insertAdjacentHTML("afterend", `<button type="button" onclick="event.stopPropagation();P2.live.M11.removeItem('${ctx.J(it.id)}')" aria-label="Xoá" class="text-[#94A3B8] px-1">✕</button>`);
              b.append(r);
            });
            return b;
          });
          box.replaceWith(...boxes);
          const btn = ctx.$(":scope > button", root);
          btn.insertAdjacentHTML("beforebegin", `<div class="flex gap-2"><input id="m11-add-name" maxlength="60" placeholder="Thêm món cần mua (vd: Hành lá)" class="flex-1 min-w-0 px-3 py-2 rounded-full border border-[#E2E8F0] text-xs"/><button type="button" onclick="P2.live.M11.addItem()" class="px-4 py-2 rounded-full bg-[#18181B] text-white font-bold">Thêm</button></div>
            <div class="text-[10px] text-[#64748B]">${ctx.H(d.checked_count)}/${ctx.H(d.to_buy_count)} đã mua · Ước tính ${ctx.H(ctx.money(d.est_cost_vnd))} · ${ctx.H(d.cost_note)} · Đã trừ ${ctx.H(d.in_fridge_count)} mục có trong tủ lạnh (${ctx.H(d.fridge_count)} món trong tủ)</div>`);
          return root;
        },
      },
      "M11-S03": {
        key: () => st.ingredients.join(","),
        load: (ctx) => ctx.api("/meal-plans/fridge-suggestions?ingredients=" + encodeURIComponent(st.ingredients.join(","))),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const grid = ctx.$(".grid-cols-4", root);
          const tiles = [...grid.children], hot = tiles[0], cold = tiles[tiles.length - 1];
          tiles.forEach((t) => t.remove());
          d.fridge.forEach((f) => {
            const n = (f.expiring_soon ? hot : cold).cloneNode(true);
            const im = ctx.$("img", n);
            if (f.img_key) im.setAttribute("data-img", f.img_key);
            else im.outerHTML = '<div class="w-10 h-10 rounded-full mx-auto mb-1 bg-white flex items-center justify-center text-lg">🥬</div>';
            const qty = f.quantity != null && f.quantity !== "" ? ` (${f.quantity}${f.unit ? " " + f.unit : ""})` : "";
            ctx.text(ctx.$("b", n), f.name + qty);
            if (f.source === "query") n.insertAdjacentHTML("beforeend", `<button type="button" onclick="P2.live.M11.dropIng('${ctx.J(f.name)}')" class="block mx-auto text-[10px] text-[#64748B]">✕ bỏ</button>`);
            else if (f.expiring_soon) n.insertAdjacentHTML("beforeend", '<div class="text-[9px] text-[#B45309] font-bold">Sắp hết hạn</div>');
            grid.append(n);
          });
          if (!d.fridge.length) grid.outerHTML = `<div class="p-3 rounded-2xl bg-[#F8FAFC] border border-dashed border-[#E2E8F0] text-center text-[11px] text-[#64748B]">Tủ lạnh chưa có món nào. Thêm đồ trong mục Tủ lạnh, hoặc nhập nhanh nguyên liệu đang có bên dưới.</div>`;
          const card = ctx.$("[onclick*=\"M2-S04\"]", root);
          card.insertAdjacentHTML("beforebegin", `<div class="flex gap-2"><input id="m11-ing" maxlength="60" placeholder="Nhập nguyên liệu đang có (vd: Trứng, Cà chua)" class="flex-1 min-w-0 px-3 py-2 rounded-full border border-[#E2E8F0] text-xs"/><button type="button" onclick="P2.live.M11.addIng()" class="px-4 py-2 rounded-full bg-[#18181B] text-white font-bold">Thêm</button></div>`);
          if (!d.suggestions.length) {
            card.outerHTML = `<div class="p-3.5 rounded-2xl bg-[#EFF6FF] border border-[#DBEAFE] text-[11px] text-[#1D4ED8]">${d.fridge.length ? "Chưa có món an toàn nào dùng được các nguyên liệu này." : "Thêm nguyên liệu để Măm gợi ý món nấu ngay."} ${ctx.H(allergyText(d))}.</div>`;
            return root;
          }
          d.suggestions.forEach((s, i) => {
            const n = i === 0 ? card : card.cloneNode(true);
            n.setAttribute("onclick", `P2.live.M11.cook('${ctx.J(s.dish_id)}')`);
            ctx.text(ctx.$("b", n), (i === 0 ? "Gợi ý nấu ngay: " : "") + s.name);
            ctx.text(ctx.$("b + div", n), `Khớp ${s.match_pct}% nguyên liệu sẵn có` + (s.prep_minutes ? ` · Nấu ${s.prep_minutes} phút` : "")
              + (s.uses_expiring.length ? ` · Dùng ${s.uses_expiring.join(", ")} sắp hết hạn` : "")
              + (s.missing.length ? ` · Cần thêm: ${s.missing.join(", ")}` : ""));
            if (i > 0) root.append(n);
          });
          root.insertAdjacentHTML("beforeend", `<div class="text-[10px] text-[#64748B]">${ctx.H(allergyText(d))}.</div>`);
          return root;
        },
      },
    },
    actions: {
      regen(ctx, date) { write(ctx, () => ctx.api("/meal-plans/weekly/days/" + encodeURIComponent(date) + "/regenerate", "POST", {}), () => ctx.reload()); },
      regenAll(ctx) { write(ctx, () => ctx.api("/meal-plans/weekly", "POST", {}), () => ctx.reload()); },
      servings(ctx, n) {
        if (n < 1 || n > 12) return;
        write(ctx, () => ctx.api("/meal-plans/weekly", "POST", { servings: n }), () => ctx.reload());
      },
      check(ctx, id, v) {
        write(ctx, () => ctx.api("/groceries/items/" + encodeURIComponent(id), "PATCH", { checked: v }), () => ctx.reload(), { 404: "Mục này không còn trong giỏ. Đang tải lại." });
      },
      addItem(ctx) {
        const el = document.getElementById("m11-add-name"), name = (el?.value || "").trim();
        if (!name) return ctx.status("Nhập tên món cần mua trước khi bấm Thêm.");
        write(ctx, () => ctx.api("/groceries/items", "POST", { name }), () => ctx.reload());
      },
      removeItem(ctx, id) { write(ctx, () => ctx.api("/groceries/items/" + encodeURIComponent(id), "DELETE"), () => ctx.reload()); },
      addIng(ctx) {
        const el = document.getElementById("m11-ing");
        const names = (el?.value || "").split(",").map((s) => s.trim()).filter(Boolean);
        if (!names.length) return ctx.status("Nhập ít nhất một nguyên liệu.");
        st.ingredients = [...new Set([...st.ingredients, ...names])].slice(0, 30);
        ctx.reload("M11-S03");
      },
      dropIng(ctx, name) { st.ingredients = st.ingredients.filter((n) => n !== name); ctx.reload("M11-S03"); },
      cook(ctx, dishId) { ctx.state.dish = dishId; ctx.goScreen("M2-S04"); },
      setIngredients(ctx, list) { st.ingredients = (list || []).slice(0, 30); },
    },
    fns: {
      // Desktop Live App tab 'mealplan' (#lpanel-mealplan): same API as M11-S01/S02.
      async loadLiveMealPlan(ctx) {
        const c = document.getElementById("live-mealplan-container");
        if (!c) return;
        const panel = document.getElementById("lpanel-mealplan");
        c.innerHTML = '<div class="text-center py-10 text-xs text-[var(--text-muted)]">Đang tải thực đơn tuần 7 ngày & giỏ đi chợ...</div>';
        let d;
        try { d = await ctx.api("/meal-plans/weekly"); }
        catch (e) { c.innerHTML = '<div class="text-center py-10 text-xs text-[var(--text-muted)]">Chưa tải được thực đơn. <button type="button" onclick="loadLiveMealPlan()" class="underline font-bold">Thử lại</button></div>'; return; }
        const H = ctx.H, J = ctx.J, money = ctx.money, g = d.groceries;
        const badge = panel?.querySelector(":scope > .flex > span");
        if (badge) badge.textContent = (d.weekly_budget_vnd ? "Ngân sách tuần: " + money(d.weekly_budget_vnd) + " · " : "") + "Ước tính chợ: ~" + money(d.total_cost_vnd);
        const sub = panel?.querySelector(":scope > .flex p");
        if (sub) sub.textContent = `${d.servings} người · Trung bình ${Math.round(d.total_calories / 7).toLocaleString("vi-VN")} kcal/ngày/người · ${allergyText(d)} · Đã trừ nguyên liệu có trong tủ lạnh`;
        c.innerHTML = `
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="font-bold">👥 Số người:</span>
            ${[1, 2, 3, 4, 6].map((n) => `<button type="button" onclick="P2.live.M11.deskServings(${n})" class="px-3 py-1 rounded-full border ${n === d.servings ? "bg-[#FBBF24] text-[#0F172A] border-[#F59E0B]" : "border-[var(--border-subtle)]"} font-bold">${n}</button>`).join("")}
            <button type="button" onclick="P2.live.M11.deskRegenAll()" class="ml-auto px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-bold">🔄 Lên lại cả tuần</button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-7 gap-2.5">
            ${d.days.map((day) => `
              <div class="genui-card p-3 rounded-2xl space-y-2 border ${day.is_today ? "border-[#F59E0B]" : "border-[var(--border-subtle)]"} text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FBBF24]/20 text-[#B45309]">${H(day.day)} ${H(day.date_label)}${day.is_today ? " · Hôm nay" : ""}</span>
                ${Object.values(day.meals).map((m) => m ? `<div class="font-black text-xs line-clamp-2 mt-1"><span class="text-[10px] text-[var(--text-muted)] font-bold">${H(m.slot_label)}:</span> ${H(m.name)}</div>` : '<div class="text-[10px] text-[var(--text-muted)]">Không có món phù hợp</div>').join("")}
                <div class="text-[10px] text-[var(--text-muted)]">🔥 ${H(day.calories.toLocaleString("vi-VN"))} kcal/người</div>
                <div class="text-[10px] font-bold text-[#22C55E]">${H(money(day.est_market_cost_vnd))}</div>
                ${day.is_past ? "" : `<button type="button" onclick="P2.live.M11.deskRegen('${J(day.date)}')" class="text-[10px] font-bold underline">Đổi món</button>`}
              </div>`).join("")}
          </div>
          <div class="genui-card p-4 rounded-2xl space-y-3 mt-4">
            <div class="font-extrabold text-xs text-[#FBBF24]">🛒 Giỏ đi chợ gộp (Đã khấu trừ nguyên liệu có sẵn trong tủ lạnh): ${H(g.checked_count)}/${H(g.to_buy_count)} đã mua · ~${H(money(g.est_cost_vnd))}</div>
            ${g.aisles.map((a) => `<div class="space-y-1.5"><div class="text-[11px] font-bold text-[var(--text-muted)]">${H(a.label)}${a.est_cost_vnd ? " · " + H(money(a.est_cost_vnd)) : ""}</div><div class="flex flex-wrap gap-2 text-xs">
              ${a.items.map((it) => `<button type="button" ${it.in_fridge ? "disabled" : `onclick="P2.live.M11.deskCheck('${J(it.id)}', ${!it.checked})"`} class="px-2.5 py-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-medium ${it.checked || it.in_fridge ? "line-through opacity-60" : ""}">
                ${it.checked ? "✓ " : it.in_fridge ? "🧊 " : ""}${H(it.name)}${it.amount == null ? "" : ": " + H(it.partly_in_fridge ? it.to_buy_amount + " " + it.to_buy_unit : it.amount + " " + it.unit)}</button>`).join("")}
            </div></div>`).join("")}
            <div class="text-[10px] text-[var(--text-muted)]">${H(g.cost_note)} · ${H(g.fridge_count)} món trong tủ lạnh</div>
          </div>`;
      },
    },
  });
  // Desktop actions reuse the same endpoints, then redraw the tab.
  const M11 = window.TOV_LIVE.modules.M11;
  const desk = (job) => (ctx, ...a) => write(ctx, () => job(ctx, ...a), () => window.loadLiveMealPlan());
  Object.assign(M11.actions, {
    deskServings: desk((ctx, n) => ctx.api("/meal-plans/weekly", "POST", { servings: n })),
    deskRegenAll: desk((ctx) => ctx.api("/meal-plans/weekly", "POST", {})),
    deskRegen: desk((ctx, date) => ctx.api("/meal-plans/weekly/days/" + encodeURIComponent(date) + "/regenerate", "POST", {})),
    deskCheck: desk((ctx, id, v) => ctx.api("/groceries/items/" + encodeURIComponent(id), "PATCH", { checked: v })),
  });
})();
