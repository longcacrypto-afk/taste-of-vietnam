/* W live wiring — Consumer Web / PWA desktop screens (W-S01..W-S05).
 * Same core endpoints and behaviour as the mobile M1–M5 screens:
 *   W-S01 GET /suggestions/today, /me/profile, /areas (+ Google sign-in, P2.google)
 *   W-S02 GET /dishes?q&meal_slot&budget_min&budget_max (or /collections/public/:id), /places
 *   W-S03 GET /dishes/:id?servings=, /places?dish_id= ; POST /me/collections (save)
 *   W-S04 GET /places/:id, /places (map pins) ; POST /orders/redirect (GrabFood/ShopeeFood/maps)
 *   W-S05 GET /collections/public (W module, demo) ; POST /me/collections (+ /dishes)
 * Never invents data: every number/name shown comes from the API response. */
(function () {
  const REGION_VI = { bac: "Miền Bắc", trung: "Miền Trung", nam: "Miền Nam", toan_quoc: "Toàn quốc" };
  const ALLERGY_VI = {
    shrimp: "Tôm/Hải sản", peanut: "Đậu phộng", shrimp_paste: "Mắm tôm", dairy: "Sữa", milk: "Sữa",
    egg: "Trứng", gluten: "Gluten", fish: "Cá", soy: "Đậu nành", shellfish: "Hải sản có vỏ",
  };
  const MEALS = { "Bữa sáng": "breakfast", "Bữa trưa": "lunch", "Bữa tối": "dinner", "Ăn vặt": "snack" };
  const MEAL_VI = { breakfast: "Bữa sáng", lunch: "Bữa trưa", dinner: "Bữa tối", snack: "Ăn vặt" };
  // W-S02 sidebar budget chips (the two chips of the design).
  const BUDGETS = { mid: [35000, 60000, "35k – 60k"], low: [0, 34999, "< 35k"] };
  const w = { dish: null, place: null, q: "", meal: "", budget: "", collection: null, servings: 2 };

  const soon = (el, why) => {
    if (!el) return;
    el.setAttribute("aria-disabled", "true");
    el.title = why;
    el.style.opacity = "0.6";
    el.removeAttribute("onclick");
    if (el.tagName === "BUTTON") el.setAttribute("disabled", "");
  };
  const km = (m) => (!Number.isFinite(Number(m)) ? "" : m < 1000 ? Math.round(m) + "m" : (m / 1000).toFixed(1).replace(".", ",") + "km");
  const hh = (h) => String(h).padStart(2, "0") + ":00";
  const hours = (p) => (Number.isInteger(p.open_hour) && Number.isInteger(p.close_hour) ? hh(p.open_hour) + "–" + hh(p.close_hour) : "Chưa rõ giờ");
  // Closed / unverified places are never shown as open (core rule): the label comes from open_status.
  const openLabel = (p) => (p.is_currently_open ? "Đang mở cửa" : p.open_status?.label ? "Giờ mở: " + p.open_status.label + ", hãy gọi xác nhận" : "Hãy gọi xác nhận");
  const allergyText = (tags) => [...new Set((tags || []).map((t) => ALLERGY_VI[t] || t))].join(", ");
  const menuRow = (p, dishId) => (p.menu || []).find((m) => m.dish_id === dishId) || null;
  const pills = (box) => [...(box?.querySelectorAll(":scope > span") || [])];
  const setPills = (box, labels) => {
    const list = pills(box);
    list.forEach((n, i) => {
      if (labels[i] === undefined || labels[i] === "") n.remove();
      else n.textContent = labels[i];
    });
    for (let i = list.length; i < labels.length; i++) {
      if (!list.length || !labels[i]) continue;
      const n = list[list.length - 1].cloneNode(true);
      n.textContent = labels[i];
      box.append(n);
    }
  };
  const currentDish = (ctx) => w.dish || ctx.appState.liveToday?.items?.[0]?.dish_id || "DISH-101";
  const go = (ctx, id) => ctx.goScreen(id);

  // ---------------------------------------------------------------- W-S01
  function bindLogin(root, d, ctx) {
    const right = ctx.$(".px-6.py-4 > div:last-child", root);
    if (!right) return;
    const role = window.TOV_AUTH?.role?.() || "guest";
    const g = ctx.state.google || {};
    const btn = "px-3 py-1.5 rounded-full border border-[#E2E8F0] bg-white font-bold whitespace-nowrap";
    let html;
    if (role === "guest") {
      // Same states as M1-S01: Google when configured; phone/Zalo/Apple stay "sắp có" (flags off).
      const F = window.TOV_FEATURES || {};
      const off = (label, flag, why) =>
        F[flag] ? "" : `<button type="button" data-w-soon="${ctx.H(why)}" class="${btn}">${ctx.H(label)} · Sắp có</button>`;
      html = `<div data-w-login class="flex items-center gap-1.5 text-[11px]">
        <span class="font-bold text-[#64748B]">Đăng nhập:</span>
        <button type="button" onclick="P2.google()" class="${btn}" ${g.enabled && g.ready ? "" : "disabled"}>${g.enabled ? "Google" : "Google · Sắp có"}</button>
        ${off("Số điện thoại", "phoneLogin", "Đăng nhập bằng SMS chưa mở.")}${off("Zalo", "zaloLogin", "Đăng nhập Zalo chưa mở.")}${off("Apple", "appleLogin", "Đăng nhập Apple chưa mở.")}
      </div>`;
    } else {
      const name = d.profile?.name || d.me?.phone || "Tài khoản";
      html = `<div data-w-login class="flex items-center gap-1.5 text-[11px]"><button type="button" onclick="goScreen('M1-S09')" class="${btn}">👤 ${ctx.H(name)}</button><button type="button" onclick="P2.live.W.logout()" class="${btn}">Đăng xuất</button></div>`;
    }
    right.insertAdjacentHTML("afterbegin", html);
    ctx.$$("[data-w-soon]", right).forEach((b) => soon(b, b.getAttribute("data-w-soon")));
    right.classList.add("flex-wrap");
  }
  function locationChip(d) {
    const p = d.profile || {};
    const areas = d.areas || [];
    let near = null;
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng))
      near = areas.reduce((a, b) => (!a || Math.hypot(b.lat - p.lat, b.lng - p.lng) < Math.hypot(a.lat - p.lat, a.lng - p.lng) ? b : a), null);
    const where = near ? near.name : "Chưa chọn vị trí";
    const lw = d.today?.live_weather;
    return "📍 " + where + (p.location_set ? "" : " (mặc định)") + " · " + (lw?.label ? (lw.emoji || "🌡️") + " " + lw.label : "🌤️ Thời tiết · sắp có");
  }
  function bindS01(html, d, ctx) {
    const root = ctx.dom(html);
    const items = d.today?.items || [];
    bindLogin(root, d, ctx);
    const chip = ctx.$(".px-6.py-4 > div:last-child > span", root);
    if (chip) {
      chip.textContent = locationChip(d);
      ctx.click(chip, "goScreen('M1-S08')");
      chip.classList.add("cursor-pointer");
      chip.title = "Chọn khu vực của bạn";
    }
    // Hero: second button + photo follow the first real suggestion.
    const first = items[0];
    const heroBtns = ctx.$$(".lg\\:col-span-7 button", root);
    if (heroBtns[0]) ctx.click(heroBtns[0], "P2.live.W.search('')");
    if (heroBtns[1]) {
      if (first) {
        ctx.text(heroBtns[1], "Xem Công thức " + first.name + (first.calories ? " (" + first.calories + " kcal)" : ""));
        ctx.click(heroBtns[1], `P2.live.W.dish('${ctx.J(first.dish_id)}')`);
      } else soon(heroBtns[1], "Chưa có gợi ý hôm nay.");
    }
    const heroImg = ctx.$(".lg\\:col-span-5 img", root);
    if (heroImg && first) ctx.img(heroImg, first.img_key);
    // Category circles → W-S02 meal filter (Tráng miệng has no meal slot in the data).
    ctx.$$(".grid.grid-cols-5 > button", root).forEach((b) => {
      const name = ctx.$("span", b)?.textContent.trim();
      if (MEALS[name]) ctx.click(b, `P2.live.W.meal('${MEALS[name]}')`);
      else {
        ctx.text(ctx.$("span", b), name + " · sắp có");
        soon(b, "Dữ liệu món chưa có nhóm Tráng miệng để lọc.");
      }
    });
    const head = ctx.$$("h3", root).find((h) => /Gợi ý Hôm nay/.test(h.textContent));
    if (head) {
      head.textContent = items.length + " Gợi ý Hôm nay từ Măm AI";
      const c = d.today?.context || {};
      const al = allergyText(d.today?.applied_allergies);
      const budget = c.budget_min != null && c.budget_max != null ? " · Ngân sách " + Math.round(c.budget_min / 1000) + "k–" + Math.round(c.budget_max / 1000) + "k" : "";
      ctx.text(head.nextElementSibling, (al ? "Đã lọc dị ứng " + al + " theo thành phần đã ghi" : "Chưa khai báo dị ứng") + budget + (c.meal_slot ? " · " + (MEAL_VI[c.meal_slot] || c.meal_slot) : ""));
    }
    const cards = ctx.$$(".md\\:grid-cols-3 > div", root);
    cards.forEach((n, i) => {
      const a = items[i];
      if (!a) {
        n.removeAttribute("onclick");
        n.style.opacity = "0.5";
        ctx.text(ctx.$("b.text-sm", n), "Chưa có thêm món phù hợp");
        ctx.text(ctx.$('b[class*="D97736"]', n), "—");
        ctx.text(ctx.$("p", n), "Chưa có dữ liệu");
        setPills(ctx.$(".flex.gap-1\\.5", n), []);
        ctx.$("img", n).style.filter = "grayscale(1)";
        return;
      }
      ctx.img(ctx.$("img", n), a.img_key);
      const tags = (a.tags || []).slice(0, 2);
      // Sponsored slot keeps the "Tài trợ" label (max 1/3, from the API flag only).
      setPills(ctx.$(".flex.gap-1\\.5", n), a.is_sponsored ? [tags[0] || "", "Tài trợ"] : tags);
      ctx.text(ctx.$("b.text-sm", n), a.name);
      ctx.text(ctx.$('b[class*="D97736"]', n), ctx.money(a.price_vnd));
      const np = a.nearest_place;
      ctx.text(ctx.$("p", n), (a.reason || "") + (np ? " · " + np.place_name + (np.is_currently_open ? " đang mở" : " (" + (np.open_status?.label || "chưa rõ giờ") + ")") : ""));
      ctx.click(n, `P2.live.W.dish('${ctx.J(a.dish_id)}')`);
      if (!a.is_sponsored) n.classList.replace("border-2", "border");
    });
    return root;
  }

  // ---------------------------------------------------------------- W-S02
  function bindS02(html, d, ctx) {
    const root = ctx.dom(html);
    const side = root.children[0], main = root.children[1];
    const groups = ctx.$$(":scope > div", side);
    const reset = ctx.$(":scope > div:first-child > span:last-child", side);
    if (reset) { ctx.click(reset, "P2.live.W.reset()"); reset.classList.add("cursor-pointer"); }
    const mealBox = ctx.$$(".flex.flex-wrap", side)[0], budgetBox = ctx.$$(".flex.flex-wrap", side)[1];
    const mark = (n, on, label, code) => {
      n.textContent = label + (on ? " ✓" : "");
      n.setAttribute("onclick", code);
      n.setAttribute("role", "button");
      n.setAttribute("aria-pressed", String(on));
      n.classList.add("cursor-pointer");
      n.style.boxShadow = on ? "0 0 0 2px #FBBF24" : "";
    };
    const inCollection = !!d.collection;
    pills(mealBox).forEach((n) => {
      const label = n.textContent.replace(/\s*✓\s*$/, "").trim(), slot = MEALS[label];
      if (inCollection) { n.textContent = label; return soon(n, "Bỏ bộ sưu tập để lọc theo bữa."); }
      mark(n, w.meal === slot, label, `P2.live.W.meal('${slot}')`);
    });
    pills(budgetBox).forEach((n, i) => {
      const key = i === 0 ? "mid" : "low";
      if (inCollection) { n.textContent = BUDGETS[key][2]; return soon(n, "Bỏ bộ sưu tập để lọc theo ngân sách."); }
      mark(n, w.budget === key, BUDGETS[key][2], `P2.live.W.budget('${key}')`);
    });
    const block = ctx.$(".bg-\\[\\#FFE4E6\\] span", side);
    const al = allergyText(d.allergies);
    ctx.text(block, al ? "Đã lọc theo dị ứng: " + al : "Chưa khai báo dị ứng · chưa lọc món nào");
    const blockBox = block?.parentElement;
    if (blockBox) { ctx.click(blockBox, "goScreen('M1-S05')"); blockBox.classList.add("cursor-pointer"); blockBox.title = "Sửa dị ứng trong hồ sơ"; }
    const tip = ctx.$$(".text-\\[\\#334155\\]", side).pop();
    ctx.text(tip, al ? "Kết quả bên phải đã bỏ các món có " + al.toLowerCase() + " theo thành phần đã ghi. Anh nhớ xác nhận lại với quán nhé!" : "Anh chưa khai báo dị ứng nên Lá chưa lọc món nào. Khai báo trong hồ sơ khẩu vị để Lá lọc giúp.");
    void groups;
    // Header: search box (added control) + real count/filter text.
    const bar = main.children[0];
    const label = ctx.$("span", bar);
    const filters = inCollection
      ? ["Bộ sưu tập " + d.collection.title]
      : [w.q && "“" + w.q + "”", w.meal && MEAL_VI[w.meal], w.budget && BUDGETS[w.budget][2]].filter(Boolean);
    ctx.text(label, "🔍 " + d.items.length + " món khớp bộ lọc" + (filters.length ? " \"" + filters.join(" · ") + "\"" : "") + (al ? " · Không " + al.toLowerCase() : ""));
    bar.insertAdjacentHTML("beforebegin",
      `<form onsubmit="event.preventDefault();P2.live.W.search(this.q.value)" class="bg-white p-2.5 rounded-2xl border border-[#E2E8F0] flex items-center gap-2"><label for="w-search" class="sr-only">Tìm món</label><input id="w-search" name="q" value="${ctx.H(w.q)}" placeholder="Tìm món, nguyên liệu… (vd: phở, bún bò)" class="flex-1 min-w-0 bg-transparent outline-none px-2"/>${inCollection ? `<button type="button" onclick="P2.live.W.collection('')" class="px-3 py-1.5 rounded-full bg-white border border-[#E2E8F0] font-bold">✕ Bỏ bộ sưu tập</button>` : ""}<button class="px-4 py-1.5 rounded-full bg-[#18181B] text-white font-extrabold">Tìm</button></form>`);
    if (d.collection?.is_demo) label.insertAdjacentHTML("afterend", `<span class="ml-2">${ctx.demoPill()}</span>`);
    const grid = ctx.$(".grid", main);
    const tpl = grid.firstElementChild.cloneNode(true);
    grid.innerHTML = "";
    if (!d.items.length) grid.outerHTML = ctx.stateHtml("W-S02", "empty");
    d.items.forEach((a) => {
      const n = tpl.cloneNode(true);
      ctx.img(ctx.$("img", n), a.img_key);
      ctx.text(ctx.$(".font-extrabold.text-sm", n), a.name);
      setPills(ctx.$(".flex.gap-1", n), [a.prep_minutes ? a.prep_minutes + " phút" : "", a.calories ? a.calories + " kcal" : ""]);
      const cnt = d.placeCount[a.id] || 0;
      ctx.text(ctx.$('[class*="D97736"]', n), ctx.money(a.ref_price) + " · " + (cnt ? cnt + " quán gần bạn" : "chưa có quán gần"));
      ctx.click(n, `P2.live.W.dish('${ctx.J(a.id)}')`);
      grid.append(n);
    });
    return root;
  }

  // ---------------------------------------------------------------- W-S03
  function recipeJsonLd(d) {
    const ld = {
      "@context": "https://schema.org", "@type": "Recipe", name: d.name, description: d.description || "",
      recipeCuisine: "Vietnamese", recipeYield: d.requested_servings + " khẩu phần",
      totalTime: d.prep_minutes ? "PT" + d.prep_minutes + "M" : undefined,
      nutrition: d.calories ? { "@type": "NutritionInformation", calories: d.calories + " kcal" } : undefined,
      recipeIngredient: (d.scaled_ingredients || []).map((i) => (i.scaled_amount ?? i.amount) + " " + i.unit + " " + i.name),
      recipeInstructions: (d.steps || []).map((s) => ({ "@type": "HowToStep", name: s.title, text: s.text })),
    };
    return `<script type="application/ld+json" data-w-jsonld>${JSON.stringify(ld).replace(/</g, "\\u003c")}<\/script>`;
  }
  function bindS03(html, d, ctx) {
    const root = ctx.dom(html), dish = d.dish, places = d.places || [];
    const left = root.children[0], right = root.children[1];
    ctx.img(ctx.$("img", left), dish.img_key);
    setPills(ctx.$(".flex.gap-1\\.5", left), ["Schema.org/Recipe", REGION_VI[dish.region] || "Chưa rõ vùng"]);
    ctx.text(ctx.$("h2", left), dish.name);
    const meta = ctx.$("h2 + p", left);
    ctx.text(meta, "🍴 " + dish.requested_servings + " Khẩu phần · 🔥 " + (dish.calories ?? "—") + " kcal/phần · ⏱️ " + (dish.prep_minutes ?? "—") + " phút · " + (dish.difficulty || "Chưa rõ độ khó"));
    meta?.insertAdjacentHTML("afterend",
      `<div class="flex flex-wrap items-center gap-1.5 pt-1"><button type="button" onclick="P2.live.W.servings(-1)" aria-label="Bớt khẩu phần" class="w-7 h-7 rounded-full border border-[#E2E8F0] font-extrabold">−</button><span class="font-bold">${dish.requested_servings} khẩu phần</span><button type="button" onclick="P2.live.W.servings(1)" aria-label="Thêm khẩu phần" class="w-7 h-7 rounded-full border border-[#E2E8F0] font-extrabold">+</button><button type="button" onclick="P2.save('${ctx.J(dish.id)}')" class="ml-1 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] font-extrabold">🔖 Lưu món</button><span class="text-[#64748B]">Chi phí đi chợ ước tính ${ctx.money(dish.scaled_market_cost_vnd)}</span></div>`);
    const ing = ctx.$(".grid-cols-4", left), tpl = ing.firstElementChild.cloneNode(true);
    ing.innerHTML = "";
    (dish.scaled_ingredients || []).forEach((a) => {
      const n = tpl.cloneNode(true);
      ctx.img(ctx.$("img", n), a.img_key);
      ctx.text(ctx.$("b", n), a.name);
      ctx.text(ctx.$("div", n), (a.scaled_amount ?? a.amount) + " " + a.unit);
      ing.append(n);
    });
    if (!(dish.scaled_ingredients || []).length) ing.outerHTML = '<p class="text-[#64748B]">Chưa có nguyên liệu cho món này.</p>';
    const tipText = ctx.$$(".text-\\[\\#334155\\]", left).pop();
    const steps = dish.steps || [];
    ctx.text(tipText, steps.length ? steps.map((s, i) => "Bước " + (s.step || i + 1) + (s.duration_min ? " (" + s.duration_min + "p)" : "") + ": " + s.title + ". " + s.text).join(" ") : "Chưa có cách nấu cho món này.");
    left.insertAdjacentHTML("beforeend", recipeJsonLd(dish));
    // Right: real places nearby that serve this dish.
    ctx.text(ctx.$("h4", right), places.length ? "Muốn đi ăn ngay? " + places.length + " quán gần bạn bán món này:" : "Chưa có quán gần bạn bán món này");
    const row = ctx.$("[onclick]", right), rowTpl = row.cloneNode(true), btn = ctx.$("button", right);
    row.remove();
    places.slice(0, 4).forEach((p) => {
      const n = rowTpl.cloneNode(true);
      ctx.img(ctx.$("img", n), p.img_key);
      ctx.text(ctx.$(".flex-1 > .font-extrabold", n), p.name + (p.is_verified ? " ✔" : ""));
      ctx.text(ctx.$(".flex-1 > div:last-child", n), "Cách " + km(p.distance_m) + " · " + hours(p) + " · " + openLabel(p));
      const m = menuRow(p, dish.id);
      ctx.text(ctx.$(":scope > span", n), m ? ctx.money(m.price) : "—");
      ctx.click(n, `P2.live.W.place('${ctx.J(p.id)}')`);
      btn.before(n);
    });
    if (places.length) ctx.click(btn, `P2.live.W.place('${ctx.J(places[0].id)}')`);
    else { ctx.text(btn, "Xem quán quanh bạn"); ctx.click(btn, "goScreen('M4-S01')"); }
    return root;
  }

  // ---------------------------------------------------------------- W-S04
  function bindS04(html, d, ctx) {
    const root = ctx.dom(html), p = d.place;
    const left = root.children[0], mapBox = root.children[1];
    ctx.img(ctx.$("img", left), p.img_key);
    const pill = ctx.$(".space-y-1 > span", left);
    ctx.text(pill, (p.is_currently_open ? "● Đang mở cửa" : "● " + openLabel(p)) + " · " + hours(p));
    if (!p.is_currently_open && pill) pill.className = pill.className.replace(/bg-\[#DCFCE7\] text-\[#15803D\]/, "bg-[#FEF3C7] text-[#B45309]");
    ctx.text(ctx.$("h3", left), p.name + (p.is_verified ? " ✔" : ""));
    ctx.text(ctx.$("h3 + p", left), "📍 " + p.address + " (Cách " + km(p.distance_m) + ")" + (p.rating ? " · ⭐ " + p.rating + (p.review_count ? " (" + p.review_count + " đánh giá)" : "") : ""));
    const [orderBtn, mapsBtn] = ctx.$$(".flex-wrap button", left);
    const partners = ((window.TOV_FEATURES || {}).orderPartners || ["grabfood", "shopeefood"]).filter((k) => p.links?.[k]);
    const PN = { grabfood: "GrabFood", shopeefood: "ShopeeFood" };
    const dishRow = d.dishRow;
    if (orderBtn) {
      if (partners.length && dishRow) {
        ctx.text(orderBtn, "🛵 Đặt " + PN[partners[0]]);
        ctx.click(orderBtn, `P2.live.W.order('${partners[0]}')`);
        partners.slice(1).forEach((k) => {
          const b = orderBtn.cloneNode(true);
          ctx.text(b, "🛵 Đặt " + (PN[k] || k));
          ctx.click(b, `P2.live.W.order('${k}')`);
          orderBtn.after(b);
        });
      } else {
        ctx.text(orderBtn, "🛵 Đặt giao tận nơi · Sắp có");
        soon(orderBtn, "Quán chưa có liên kết đối tác giao hàng.");
      }
    }
    if (mapsBtn) ctx.click(mapsBtn, "P2.live.W.order('maps')");
    if (p.phone && mapsBtn)
      mapsBtn.insertAdjacentHTML("afterend", `<button type="button" onclick="P2.live.W.call()" class="px-4 py-2 rounded-full bg-white border border-[#E2E8F0] font-bold">📞 ${ctx.H(p.phone)}</button>`);
    // Menu (added list): real menu rows; the dish being ordered is marked.
    const menu = (p.menu || []).map((m) =>
      `<button type="button" ${m.available ? `onclick="P2.live.W.pickDish('${ctx.J(m.dish_id)}')"` : 'aria-disabled="true" disabled'} class="w-full flex justify-between items-center p-2.5 rounded-xl border ${dishRow && m.dish_id === dishRow.dish_id ? "border-[#FBBF24] bg-[#FFFBEB]" : "border-[#F1F5F9] bg-[#F8FAFC]"} text-left"><span class="font-bold">${ctx.H(m.name || m.dish_id)}${m.available ? "" : " · Tạm hết"}</span><b class="text-[#D97736]">${ctx.money(m.price)}</b></button>`).join("");
    left.insertAdjacentHTML("beforeend", `<div class="space-y-1.5"><div class="font-extrabold text-sm">Thực đơn quán${dishRow ? " · đang chọn: " + ctx.H(dishRow.name) : ""}</div>${menu || '<p class="text-[#64748B]">Chưa có thực đơn.</p>'}<p class="text-[10px] text-[#64748B]">Giá theo thực đơn đã nhập; giá và phí giao do đối tác xác nhận.</p></div>`);
    // Split map: the original frame becomes a Leaflet map (mountLiveMaps in the shared polish).
    const others = (d.nearby || []).filter((x) => x.id !== p.id);
    const tag = ctx.$(".absolute", mapBox);
    const center = d.center;
    ctx.text(tag, "📍 " + (center?.radius_m ? "Bán kính " + Math.round(center.radius_m / 100) / 10 + "km · " : "") + (others.length + 1) + " quán trên bản đồ");
    if (tag) tag.style.zIndex = "10";
    const coords = (x) => Number.isFinite(Number(x?.lat)) && Number.isFinite(Number(x?.lng)) && x.lat !== null && x.lng !== null;
    const pinsData = [p, ...others].filter(coords);
    if ((window.TOV_FEATURES || {}).liveMap !== false && pinsData.length) {
      // Other places: compact "🍜" pins (name + distance on hover/click) so this place's label stays readable.
      [...pinsData.slice(1), pinsData[0]].forEach((x) => {
        const i = x === pinsData[0] ? 0 : 1;
        const n = document.createElement("span");
        n.style.display = "none"; // shown by the map mount (inline-block); dropped on fallback
        n.className = "absolute top-3 left-3 px-2.5 py-1 rounded-full font-extrabold shadow cursor-pointer " + (i === 0 ? "bg-[#18181B] text-[#FBBF24]" : "bg-white text-[#0F172A] border border-[#E2E8F0] !px-1 !py-0");
        n.textContent = i === 0 ? "📍 " + x.name : "🍜";
        n.title = x.name + " · " + km(x.distance_m);
        if (i) n.style.fontSize = "10px";
        if (i) n.setAttribute("onclick", `P2.live.W.place('${ctx.J(x.id)}')`);
        Object.assign(n.dataset, { mapPin: "", mapExtra: "", lat: x.lat, lng: x.lng });
        mapBox.append(n);
      });
      const c = center && coords(center) ? { lat: Number(center.lat), lng: Number(center.lng), radius_m: Number(center.radius_m) || null } : null;
      mapBox.dataset.liveMap = JSON.stringify({ center: c, pins: pinsData.map((x) => ({ id: x.id, lat: Number(x.lat), lng: Number(x.lng) })) });
    }
    root.insertAdjacentHTML("beforeend", `<p class="lg:col-span-12 text-[10px] text-[#64748B]">Bản đồ OpenStreetMap: ghim là quán thật có tọa độ trong dữ liệu, chỉ hiện quán chưa bị báo đóng cửa. Nếu bản đồ không tải được, khung hiện ảnh minh họa.</p>`);
    return root;
  }

  // ---------------------------------------------------------------- W-S05
  function bindS05(html, d, ctx) {
    const root = ctx.dom(html), items = d.items || [];
    if (!items.length) return ctx.stateHtml("W-S05", "empty");
    const head = ctx.$("h3", root)?.parentElement;
    if (d.is_demo && head) head.insertAdjacentHTML("beforeend", `<div class="mt-1">${ctx.demoPill()}</div>`);
    const grid = ctx.$(".grid", root), tpl = grid.firstElementChild.cloneNode(true);
    grid.innerHTML = "";
    items.forEach((c) => {
      const n = tpl.cloneNode(true);
      ctx.img(ctx.$("img", n), c.img_key);
      setPills(ctx.$(".flex.gap-1", n), [c.tags[0] || REGION_VI[c.region] || "", c.dish_count + " món", ...(c.tags.slice(1))]);
      ctx.text(ctx.$(".font-extrabold.text-sm", n), c.title);
      n.insertAdjacentHTML("beforeend",
        `<p class="text-[#64748B] leading-relaxed">${ctx.H(c.description || "")}</p>` +
        (c.hidden_by_allergy ? `<p class="text-[10px] text-[#BE123C] font-bold">Đã ẩn ${c.hidden_by_allergy} món không hợp dị ứng của bạn</p>` : "") +
        `<div class="flex flex-wrap gap-1.5 pt-1"><button type="button" onclick="event.stopPropagation();P2.live.W.saveCollection('${ctx.J(c.id)}')" class="px-3 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] font-extrabold" ${c.dish_count ? "" : "disabled"}>🔖 Lưu vào Bộ sưu tập của tôi</button>${c.story_id ? `<button type="button" onclick="event.stopPropagation();P2.live.W.story('${ctx.J(c.story_id)}')" class="px-3 py-1 rounded-full bg-white border border-[#E2E8F0] font-bold">📖 Câu chuyện món</button>` : ""}</div>`);
      ctx.click(n, `P2.live.W.collection('${ctx.J(c.id)}')`);
      grid.append(n);
    });
    return root;
  }

  // Desktop web screens are not squeezed into the 480px phone preview at desktop widths
  // (same rule as widenPreview() in product_runtime.js, which only covers previews).
  function widen() {
    const id = window.appState?.activeScreenId || "";
    if (!/^W-S0[1-5]$/.test(id) || window.innerWidth <= 768) return;
    const frame = document.querySelector("#stage-container .phone-frame");
    if (frame && frame.style.maxWidth !== "100%") frame.style.setProperty("max-width", "100%", "important");
  }
  function watch() {
    const stage = document.getElementById("stage-container");
    if (!stage) return;
    new MutationObserver(widen).observe(stage, { childList: true });
    window.addEventListener("resize", widen);
    widen();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch);
  else watch();

  window.TOV_LIVE.register("W", {
    screens: {
      "W-S01": {
        key: () => window.TOV_AUTH?.role?.() || "guest",
        async load(ctx) {
          const [today, profile, areas, me] = await Promise.all([
            ctx.api("/suggestions/today"),
            ctx.api("/me/profile").catch(() => null),
            ctx.api("/areas").catch(() => ({ items: [] })),
            ctx.api("/auth/me").catch(() => null),
          ]);
          if (Array.isArray(today?.items)) ctx.appState.liveToday = today;
          return { today, profile, areas: areas.items || [], me };
        },
        bind: bindS01,
      },
      "W-S02": {
        key: () => [w.q, w.meal, w.budget, w.collection || ""].join("|"),
        async load(ctx) {
          const placesP = ctx.api("/places").catch(() => ({ items: [] }));
          const profileP = ctx.api("/me/profile").catch(() => null);
          let items, collection = null;
          if (w.collection) {
            collection = await ctx.api("/collections/public/" + encodeURIComponent(w.collection));
            items = collection.dishes || [];
            if (w.q) items = items.filter((d) => d.name.toLowerCase().includes(w.q.toLowerCase()));
          } else {
            const qs = new URLSearchParams({ limit: "50" });
            if (w.q) qs.set("q", w.q);
            if (w.meal) qs.set("meal_slot", w.meal);
            if (w.budget) { qs.set("budget_min", BUDGETS[w.budget][0]); qs.set("budget_max", BUDGETS[w.budget][1]); }
            items = (await ctx.api("/dishes?" + qs)).items || [];
          }
          const [places, profile] = await Promise.all([placesP, profileP]);
          const placeCount = {};
          (places.items || []).forEach((p) => (p.menu || []).forEach((m) => { if (m.available) placeCount[m.dish_id] = (placeCount[m.dish_id] || 0) + 1; }));
          return { items, collection, placeCount, allergies: profile?.hard_allergies || collection?.applied_allergies || [] };
        },
        bind: bindS02,
      },
      "W-S03": {
        key: (ctx) => currentDish(ctx) + ":" + w.servings,
        async load(ctx) {
          const id = currentDish(ctx);
          const [dish, places] = await Promise.all([
            ctx.api("/dishes/" + encodeURIComponent(id) + "?servings=" + w.servings),
            ctx.api("/places?dish_id=" + encodeURIComponent(id)).catch(() => ({ items: [] })),
          ]);
          return { dish, places: places.items || [] };
        },
        bind: bindS03,
      },
      "W-S04": {
        key: (ctx) => (w.place || "first") + ":" + currentDish(ctx),
        async load(ctx) {
          const dishId = currentDish(ctx);
          let id = w.place;
          if (!id) id = (await ctx.api("/places?dish_id=" + encodeURIComponent(dishId))).items?.[0]?.id;
          if (!id) id = (await ctx.api("/places")).items?.[0]?.id;
          if (!id) return { place: null };
          const [place, nearby] = await Promise.all([
            ctx.api("/places/" + encodeURIComponent(id)),
            ctx.api("/places").catch(() => ({ items: [], center: null })),
          ]);
          const dishRow = (place.menu || []).find((m) => m.dish_id === dishId && m.available) || (place.menu || []).find((m) => m.available) || null;
          // Mirror into the shared state so M5-S05 (order confirmation) names this meal.
          ctx.state.place = place.id;
          return { place, nearby: nearby.items || [], center: nearby.center || null, dishRow };
        },
        bind(html, d, ctx) {
          if (!d.place) return ctx.stateHtml("W-S04", "empty");
          return bindS04(html, d, ctx);
        },
      },
      "W-S05": {
        load: (ctx) => ctx.api("/collections/public"),
        bind: bindS05,
      },
    },
    actions: {
      dish(ctx, id) { w.dish = id; w.place = null; w.servings = 2; ctx.state.dish = id; go(ctx, "W-S03"); },
      place(ctx, id) { w.place = id; go(ctx, "W-S04"); },
      pickDish(ctx, id) { w.dish = id; ctx.state.dish = id; ctx.reload("W-S04"); },
      servings(ctx, delta) { w.servings = Math.max(1, Math.min(10, w.servings + delta)); ctx.reload("W-S03"); },
      search(ctx, q) { w.q = String(q || "").trim().slice(0, 200); go(ctx, "W-S02"); },
      meal(ctx, slot) { w.meal = w.meal === slot ? "" : slot; w.collection = null; go(ctx, "W-S02"); },
      budget(ctx, key) { w.budget = w.budget === key ? "" : key; ctx.reload("W-S02"); },
      reset(ctx) { Object.assign(w, { q: "", meal: "", budget: "", collection: null }); ctx.reload("W-S02"); },
      collection(ctx, id) { w.collection = id || null; w.q = ""; w.meal = ""; w.budget = ""; go(ctx, "W-S02"); },
      story(ctx, id) {
        const m14 = window.P2?.live?.M14;
        if (!m14?.pick) return ctx.status("Câu chuyện món chưa mở trong bản này.");
        go(ctx, "M14-S01");
        m14.pick(id);
      },
      logout(ctx) {
        window.TOV_AUTH?.logout();
        window.M9Forms?.syncRole?.();
        ctx.state.cache = {};
        ctx.status("Đã đăng xuất.");
        ctx.reload("W-S01");
      },
      saveCollection(ctx, id) {
        ctx.action(async () => {
          const c = await ctx.api("/collections/public/" + encodeURIComponent(id));
          const mine = await ctx.api("/me/collections");
          let col = (mine.collections || []).find((x) => x.name === c.title);
          if (!col) col = (await ctx.api("/me/collections", "POST", { name: c.title })).collection;
          for (const dsh of c.dishes || [])
            if (!(col.dish_ids || []).includes(dsh.id)) await ctx.api("/me/collections/" + encodeURIComponent(col.id) + "/dishes", "POST", { dish_id: dsh.id });
          return { c };
        }, ({ c }) => {
          delete ctx.state.cache.saved;
          ctx.status("Đã lưu " + c.dish_count + " món vào bộ sưu tập “" + c.title + "”.");
        });
      },
      order(ctx, partner) {
        const key = "live:W-S04:" + (w.place || "first") + ":" + currentDish(ctx);
        const d = ctx.state.cache[key]?.data;
        const p = d?.place;
        if (!p) return ctx.status("Chưa chọn được quán.");
        const dishId = d.dishRow?.dish_id || currentDish(ctx);
        let tab = window.open("about:blank", "_blank");
        if (!tab) return ctx.status("Trình duyệt đang chặn mở dịch vụ bên ngoài. Cho phép cửa sổ mới rồi thử lại.");
        tab.opener = null;
        ctx.action(async () => {
          try {
            const r = await ctx.api("/orders/redirect", "POST", { dish_id: dishId, place_id: p.id, partner });
            const u = new URL(r.target_deeplink);
            if (u.protocol !== "https:") throw new Error("Liên kết không hợp lệ");
            return { ...r, target_deeplink: u.href, dish_name: d.dishRow?.name || null, place_name: p.name };
          } catch (e) { tab.close(); throw e; }
        }, (r) => {
          ctx.state.order = r;
          ctx.state.dish = dishId;
          ctx.state.place = p.id;
          tab.location.replace(r.target_deeplink);
          go(ctx, "M5-S05");
        });
      },
      call(ctx) {
        const key = "live:W-S04:" + (w.place || "first") + ":" + currentDish(ctx);
        const d = ctx.state.cache[key]?.data, p = d?.place;
        if (!/^\+?[\d\s-]+$/.test(p?.phone || "")) return ctx.status("Chưa có số điện thoại hợp lệ.");
        const dishId = d.dishRow?.dish_id || currentDish(ctx);
        ctx.state.order = { target_deeplink: "tel:" + p.phone.replace(/\s/g, ""), dish_id: dishId, dish_name: d.dishRow?.name || null, place_id: p.id, place_name: p.name };
        ctx.state.dish = dishId;
        ctx.state.place = p.id;
        location.href = ctx.state.order.target_deeplink;
        go(ctx, "M5-S05");
      },
    },
  });
})();
