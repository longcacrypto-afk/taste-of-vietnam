/* M19 live wiring — M19-S01 dashboard (manual / sandbox wearable sync, BMR → TDEE, intake today),
 * M19-S02 macros 30/50/20 + Low-GI, desktop tab "health" (loadLiveHealth, syncLiveWearable).
 * API: GET /health/nutrition-profile, PUT /health/profile, POST /health/sync.
 * Apple Health / Google Fit are not connected: numbers come from what the user types. */
(function () {
  const S = { syncOpen: false, editProfile: false, dSync: false, dProfile: false };
  const SRC = { manual: "Nhập tay", apple_health: "Apple Health (sandbox)", google_fit: "Google Fit (sandbox)" };
  const GOAL = { maintain: "Giữ cân", cut: "Giảm mỡ (−400 kcal)", bulk: "Tăng cơ (+300 kcal)" };
  const n = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("en-US"));
  const val = (sel) => document.querySelector(sel)?.value ?? "";
  const field = "w-full min-w-0 px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[11px] text-[#0F172A]";
  const opts = (map, cur) => Object.entries(map).map(([k, l]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${l}</option>`).join("");

  function profileForm(ctx, d, scope) {
    const p = d.body_profile || {};
    const a = `data-hp${scope}`;
    return `<div class="p-3 rounded-2xl bg-white border border-[#BFDBFE] space-y-2 text-[#0F172A]">
      <b class="text-[11px]">Hồ sơ thể trạng (để tính BMR theo Mifflin-St Jeor)</b>
      <div class="grid grid-cols-2 gap-1.5">
        <select ${a}-sex class="${field}"><option value="">Giới tính</option>${opts({ male: "Nam", female: "Nữ" }, p.sex)}</select>
        <input ${a}-age type="number" min="10" max="100" placeholder="Tuổi" class="${field}" value="${ctx.H(p.age ?? "")}">
        <input ${a}-h type="number" min="100" max="230" placeholder="Chiều cao (cm)" class="${field}" value="${ctx.H(p.height_cm ?? "")}">
        <input ${a}-w type="number" min="25" max="300" step="0.1" placeholder="Cân nặng (kg)" class="${field}" value="${ctx.H(p.weight_kg ?? "")}">
        <select ${a}-goal class="${field} col-span-2">${opts(GOAL, d.goal || "maintain")}</select>
      </div>
      <label class="flex items-center gap-2 text-[10px]"><input ${a}-gi type="checkbox" ${d.blood_sugar_support ? "checked" : ""}> Chế độ Low-GI (ổn định đường huyết)</label>
      <button type="button" onclick="P2.live.M19.saveProfile('${scope}')" class="w-full py-1.5 rounded-lg bg-[#1D4ED8] text-white font-extrabold text-[11px]">Lưu hồ sơ</button></div>`;
  }
  function syncForm(ctx, d, scope) {
    const a = `data-hs${scope}`;
    return `<div class="p-3 rounded-2xl bg-white border border-[#E2E8F0] space-y-2 text-[#0F172A]">
      <b class="text-[11px]">Nhập số liệu vận động hôm nay</b>
      <div class="text-[10px] text-[#64748B]">Apple Health / Google Fit chưa kết nối: số liệu do bạn nhập (chọn nguồn để ghi chú, dạng sandbox).</div>
      <select ${a}-src class="${field}">${opts(SRC, d.sync_source || "manual")}</select>
      <div class="grid grid-cols-2 gap-1.5">
        <input ${a}-steps type="number" min="0" max="100000" placeholder="Số bước" class="${field}" value="${ctx.H(d.daily_steps ?? "")}">
        <input ${a}-kcal type="number" min="0" max="5000" placeholder="Calo vận động (kcal)" class="${field}" value="${ctx.H(d.active_calories_burned ?? "")}">
      </div>
      <button type="button" onclick="P2.live.M19.sync('${scope}')" class="w-full py-1.5 rounded-lg bg-[#0F172A] text-white font-extrabold text-[11px]">Lưu số liệu</button></div>`;
  }
  const lowGiText = (ctx, d) => {
    const parts = [];
    if (d.low_gi_dishes?.length) parts.push(d.low_gi_dishes.map((x) => `<button type="button" onclick="P2.dish('${ctx.J(x.dish_id)}')" class="underline font-bold">${ctx.H(x.name)}</button> (GI ~${ctx.H(x.gi_estimate)})`).join(", "));
    if (d.low_gi_swaps?.length) parts.push("Hoặc: " + d.low_gi_swaps.map((x) => ctx.H(x.tip)).join("; "));
    return parts.join(". ") || "Chưa có món phù hợp sau khi lọc dị ứng.";
  };
  const after = (ctx, scope) => (scope === "d" ? renderDesktop(ctx) : (ctx.reload("M19-S01"), ctx.reload("M19-S02")));

  async function renderDesktop(ctx) {
    const c = document.getElementById("live-health-content");
    if (!c) return;
    let p;
    try { p = await ctx.api("/health/nutrition-profile"); }
    catch (e) { c.innerHTML = '<div class="text-center py-10 text-xs text-red-500">Chưa tải được dữ liệu sức khỏe. Kiểm tra mạng hoặc đăng nhập rồi thử lại.</div>'; return; }
    const H = ctx.H, m = p.macro_targets_g || {}, im = p.intake_today_macros_g || {};
    const pct = p.target_calories_daily ? Math.min(100, Math.round((p.intake_today_kcal / p.target_calories_daily) * 100)) : 0;
    c.innerHTML = `
      ${p.needs_profile || S.dProfile ? `<div class="max-w-md">${profileForm(ctx, p, "d")}</div>` : `<div class="text-xs text-[var(--text-muted)]">BMR ${H(n(p.bmr))} kcal (${H(p.bmr_formula)}) · ${H(p.goal_label)} · <button onclick="P2.live.M19.toggle('dProfile')" class="underline font-bold">Sửa hồ sơ thể trạng</button></div>`}
      ${S.dSync ? `<div class="max-w-md">${syncForm(ctx, p, "d")}</div>` : ""}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
          <div class="flex items-center justify-between text-xs text-[var(--text-muted)]"><span>Bước chân hôm nay</span><span>👟</span></div>
          <div class="text-2xl font-black text-[var(--text-main)]">${H(n(p.daily_steps))}</div>
          <div class="text-[10px] text-emerald-600 font-bold">${p.daily_steps === null ? "Chưa có số liệu hôm nay" : `Mục tiêu 10,000 (${Math.round((p.daily_steps / 10000) * 100)}%) · ${H(p.connected_wearable)}`}</div>
        </div>
        <div class="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
          <div class="flex items-center justify-between text-xs text-[var(--text-muted)]"><span>Calo tiêu hao (vận động)</span><span>🔥</span></div>
          <div class="text-2xl font-black text-[var(--text-main)]">${H(n(p.active_calories_burned))} kcal</div>
          <div class="text-[10px] text-blue-600 font-bold">TDEE: ${H(n(p.tdee))} kcal · ${H(p.tdee_formula)}</div>
        </div>
        <div class="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-1">
          <div class="flex items-center justify-between text-xs text-[var(--text-muted)]"><span>Mục tiêu calo / ngày</span><span>🎯</span></div>
          <div class="text-2xl font-black text-amber-500">${H(n(p.target_calories_daily))} kcal</div>
          <div class="text-[10px] text-[var(--text-muted)]">Đã nạp ${H(n(p.intake_today_kcal))} kcal từ món đã ăn hôm nay (${pct}%)</div>
          <div class="h-1.5 rounded-full bg-[var(--bg-card)] overflow-hidden"><div class="h-full bg-amber-400" style="width:${pct}%"></div></div>
        </div>
      </div>
      <div class="p-5 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-4 shadow-sm">
        <div class="flex items-center justify-between">
          <div><div class="font-extrabold text-sm text-[var(--text-main)]">Tỷ Lệ Dinh Dưỡng Đa Lượng (Macronutrients)</div>
            <div class="text-xs text-[var(--text-muted)]">30% đạm · 50% tinh bột · 20% chất béo của mục tiêu calo</div></div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${p.blood_sugar_support ? "bg-[#22C55E]/20 text-[#15803D]" : "bg-[var(--bg-card)] text-[var(--text-muted)]"}">${p.blood_sugar_support ? "Low-GI đang bật" : "Low-GI tắt"}</span>
        </div>
        <div class="grid grid-cols-3 gap-3 text-center">
          ${[["protein", "Đạm (Protein)", "blue", 30], ["carbs", "Tinh bột (Carb)", "amber", 50], ["fat", "Chất béo (Fat)", "pink", 20]].map(([k, l, col, pc]) => `
          <div class="p-3 rounded-2xl bg-${col}-50 dark:bg-${col}-950/30 border border-${col}-200 dark:border-${col}-900">
            <div class="text-[10px] text-${col}-600 font-bold">${l}</div>
            <div class="text-lg font-black text-${col}-700 dark:text-${col}-400">${H(n(m[k]))}g</div>
            <div class="text-[10px] text-${col}-600/80">${pc}% Calo · đã nạp ${H(n(im[k]))}g</div>
          </div>`).join("")}
        </div>
      </div>
      ${p.fast_carb_warnings?.length ? `<div class="p-4 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-[11px] text-[#991B1B]">⚠️ Món nhiều tinh bột nhanh đã ăn hôm nay: ${H(p.fast_carb_warnings.map((w) => w.name + (w.tip ? " – " + w.tip : "")).join("; "))}</div>` : ""}
      <div class="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-start gap-3">
        <span class="text-2xl shrink-0">🥗</span>
        <div class="space-y-1">
          <div class="font-extrabold text-xs text-emerald-800 dark:text-emerald-300">Khuyến nghị hôm nay:</div>
          <p class="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">${H(p.recommendation)}</p>
          <p class="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">Món Low-GI: ${lowGiText(ctx, p)}</p>
          <p class="text-[10px] text-emerald-800/70">${p.is_demo ? ctx.demoPill() + " " : ""}${H(p.gi_note)}</p>
        </div>
      </div>`;
  }

  window.TOV_LIVE.register("M19", {
    screens: {
      "M19-S01": {
        key: () => "np",
        load: (ctx) => ctx.api("/health/nutrition-profile"),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const [, dark, grid, tip] = root.children;
          ctx.$(".text-\\[10px\\]", dark).textContent = "ĐỒNG BỘ: " + (d.connected_wearable || "chưa có số liệu hôm nay");
          ctx.$("b", dark).textContent = `${n(d.daily_steps)} bước · ${n(d.active_calories_burned)} kcal`;
          const btn = ctx.$("button", dark);
          btn.setAttribute("onclick", "P2.live.M19.toggle('syncOpen')");
          if (S.syncOpen) dark.insertAdjacentHTML("afterend", syncForm(ctx, d, "m"));
          const [goal, tdee] = grid.children;
          ctx.$(".text-base", goal).textContent = `${n(d.target_calories_daily)} kcal`;
          ctx.$(".text-base", tdee).textContent = `${n(d.tdee)} kcal`;
          ctx.$(".text-\\[10px\\]", tdee).textContent = "TDEE thực tế (BMR × 1.2 + vận động)";
          grid.insertAdjacentHTML("afterend", `<div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center text-[11px]">
              <span>🍽️ Calo nạp hôm nay (món đã ăn)</span><b>${n(d.intake_today_kcal)}${d.target_calories_daily ? " / " + n(d.target_calories_daily) : ""} kcal</b></div>
            ${d.needs_profile || S.editProfile ? profileForm(ctx, d, "m") : `<div class="text-[10px] text-[#64748B]">BMR ${n(d.bmr)} kcal (Mifflin-St Jeor) · ${ctx.H(d.goal_label)} · <button type="button" onclick="P2.live.M19.toggle('editProfile')" class="underline font-bold">Sửa hồ sơ</button></div>`}`);
          const over = d.remaining_kcal !== null && d.remaining_kcal < 0;
          if (over) tip.className = tip.className.replace("bg-[#F0FDF4]", "bg-[#FEF2F2]").replace("border-[#BBF7D0]", "border-[#FECACA]");
          const t = ctx.$("div", tip);
          t.textContent = d.recommendation;
          if (over) t.className = t.className.replace("text-[#15803D]", "text-[#B91C1C]");
          return root;
        },
      },
      "M19-S02": {
        key: () => "np",
        load: (ctx) => ctx.api("/health/nutrition-profile"),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const [, grid, box] = root.children;
          const m = d.macro_targets_g || {}, im = d.intake_today_macros_g || {}, pc = d.macro_split_pct;
          ["protein", "carbs", "fat"].forEach((k, i) => {
            const card = grid.children[i];
            ctx.$("b", card).textContent = `${n(m[k])}g`;
            const p = card.lastElementChild;
            p.textContent = `${pc[k]}%`;
            p.insertAdjacentHTML("afterend", `<div class="text-[9px] text-[#64748B]">đã nạp ${n(im[k])}g</div>`);
          });
          if (d.needs_profile) grid.insertAdjacentHTML("afterend", `<div class="text-[10px] text-[#64748B]">Cần hồ sơ thể trạng để tính mục tiêu. <button type="button" onclick="goScreen('M19-S01')" class="underline font-bold">Nhập ở M19-S01</button></div>`);
          ctx.$("div.font-extrabold", box).insertAdjacentHTML("afterend",
            `<div class="text-[10px]"><button type="button" onclick="P2.live.M19.lowGi(${d.blood_sugar_support ? "false" : "true"})" class="px-2 py-0.5 rounded-full font-bold ${d.blood_sugar_support ? "bg-[#DCFCE7] text-[#15803D]" : "bg-white border border-[#E2E8F0] text-[#64748B]"}">${d.blood_sugar_support ? "Chế độ Low-GI: Bật" : "Chế độ Low-GI: Tắt · bật"}</button></div>`);
          ctx.$(".text-\\[11px\\]", box).innerHTML = lowGiText(ctx, d);
          if (d.fast_carb_warnings?.length) box.insertAdjacentHTML("afterend", `<div class="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[11px] text-[#991B1B]">⚠️ Món nhiều tinh bột nhanh hôm nay: ${ctx.H(d.fast_carb_warnings.map((w) => w.name + (w.tip ? " – " + w.tip : "")).join("; "))}</div>`);
          root.insertAdjacentHTML("beforeend", `<div class="text-[10px] text-[#64748B]">${d.is_demo ? ctx.demoPill() + " " : ""}${ctx.H(d.gi_note)}</div>`);
          return root;
        },
      },
    },
    actions: {
      toggle(ctx, k) {
        S[k] = !S[k];
        if (k.startsWith("d")) renderDesktop(ctx); else ctx.reload("M19-S01");
      },
      saveProfile(ctx, scope) {
        const a = `[data-hp${scope}-`;
        const body = { sex: val(a + "sex]") || undefined, age: val(a + "age]"), height_cm: val(a + "h]"), weight_kg: val(a + "w]"), goal: val(a + "goal]"),
          low_gi: !!document.querySelector(a + "gi]")?.checked };
        if (!body.sex || !body.age || !body.height_cm || !body.weight_kg) return ctx.status("Nhập đủ giới tính, tuổi, chiều cao và cân nặng.");
        ctx.action(() => ctx.api("/health/profile", "PUT", body), (r) => {
          S.editProfile = false; S.dProfile = false;
          ctx.status(`Đã lưu. BMR của bạn: ${n(r.bmr)} kcal/ngày.`);
          after(ctx, scope);
        });
      },
      sync(ctx, scope) {
        const a = `[data-hs${scope}-`;
        const steps = val(a + "steps]"), kcal = val(a + "kcal]");
        if (steps === "" || kcal === "") return ctx.status("Nhập số bước và calo vận động hôm nay.");
        ctx.action(() => ctx.api("/health/sync", "POST", { source: val(a + "src]"), daily_steps: Number(steps), active_calories_burned: Number(kcal) }), (r) => {
          S.syncOpen = false; S.dSync = false;
          ctx.status(r.note + (r.tdee ? ` TDEE hôm nay: ${n(r.tdee)} kcal.` : ""));
          after(ctx, scope);
        });
      },
      lowGi(ctx, on) {
        ctx.action(() => ctx.api("/health/profile", "PUT", { low_gi: on }), () => after(ctx, "m"));
      },
    },
    fns: {
      loadLiveHealth: (ctx) => renderDesktop(ctx),
      syncLiveWearable(ctx) { S.dSync = !S.dSync; return renderDesktop(ctx); },
    },
  });
})();
