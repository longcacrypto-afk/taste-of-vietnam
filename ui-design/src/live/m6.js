/* M6 live wiring — Merchant Portal M6-S01..M6-S09 (GET/POST/PUT/PATCH/DELETE /api/v1/merchant/...).
 * The original templates (screens_web_m6_m7.js, UI_KIT.merchantShell) are bound to API data.
 * The desktop "merchant" tab belongs to the M7 module and is not mounted here. */
(function () {
  let cur = null; // place chosen in the portal (null = the API picks the first owned place)
  let ver = 0; // bumped after every write so every M6 screen reloads fresh data
  let days = 7; // M6-S08 window
  let ocrImage = ""; // M6-S06: chosen image name (image OCR runs as a labelled sandbox)
  let shown = null; // M6-S03: the place whose profile is on screen
  const P = (extra = "") => {
    const q = [cur ? "place_id=" + encodeURIComponent(cur) : "", extra].filter(Boolean).join("&");
    return q ? "?" + q : "";
  };
  const key = () => (cur || "-") + ":" + ver;
  const num = (n) => Number(n || 0).toLocaleString("vi-VN");
  const pct = (v) => (v === null || v === undefined ? "—" : (v > 0 ? "+" : "") + String(v).replace(".", ",") + "%");
  const STATUS_VARIANT = { open: "green", closed: "rose", unknown: "yellow", stale: "orange" };
  const ROLE_VARIANT = { owner: "dark", manager: "purple", staff: "blue" };

  async function guarded(ctx, job) {
    try {
      return await job();
    } catch (e) {
      if (e.status === 401 || e.status === 403) return { needLogin: true, status: e.status };
      throw e;
    }
  }
  async function withShell(ctx, job) {
    const branches = await ctx.api("/merchant/branches").catch((e) => {
      if (e.status === 401 || e.status === 403) return { branches: [] };
      throw e;
    });
    const out = await guarded(ctx, job);
    const base = { branches: branches.branches || [], demo: !!branches.is_demo };
    return out && out.needLogin ? { ...base, ...out } : { ...base, data: out };
  }
  // The runtime widens only frozen *previews* of desktop designs (widenPreview); a live
  // desktop screen would stay squeezed in the 480px phone frame. Same rule, module-local.
  function widen() {
    setTimeout(() => {
      if (window.innerWidth <= 768) return;
      const st = document.getElementById("stage-container");
      const frame = st && st.querySelector(".phone-frame");
      if (frame) frame.style.setProperty("max-width", "100%", "important");
      const aside = st && st.querySelector("aside");
      if (aside && aside.querySelector("nav")) aside.style.setProperty("display", "flex", "important");
    }, 0);
  }
  const main = (root, ctx) => ctx.$(".lg\\:col-span-9", root);
  const body = (root, ctx) => {
    const m = main(root, ctx);
    return m && m.lastElementChild;
  };
  /** Sidebar + top bar: real place name, branch count, place switcher, honest copy. */
  function shell(root, ctx, d, placeId, demo) {
    widen();
    const br = d.branches || [];
    const place = br.find((b) => b.id === placeId) || br[0];
    const brand = ctx.$("aside .text-\\[\\#4ADE80\\]", root);
    if (brand) brand.textContent = place ? "● " + place.name + (place.is_verified ? " (Verified)" : "") : "● Chưa gán quán";
    ctx.$$("aside nav button", root).forEach((b) => {
      if ((b.getAttribute("onclick") || "").includes("M6-S04")) {
        const s = ctx.$("span span:last-child", b);
        if (s) s.textContent = "Chi nhánh (" + br.length + ")";
      }
    });
    const tip = ctx.$("aside .text-\\[10px\\].text-gray-300", root);
    if (tip) tip.innerHTML = '<b class="text-[#FBBF24] block">Bếp AI Hỗ trợ Quán</b>Dán chữ trên bảng giá để AI tách món & giá, món chưa chắc sẽ chờ duyệt.';
    const top = main(root, ctx)?.firstElementChild;
    const titleRow = top && ctx.$("div > div.flex", top);
    if (titleRow && demo) titleRow.insertAdjacentHTML("beforeend", ctx.demoPill());
    if (top && br.length > 1) {
      const opts = br.map((b) => `<option value="${ctx.H(b.id)}" ${b.id === place?.id ? "selected" : ""}>${ctx.H(b.name)} · ${ctx.H(b.role_label)}</option>`).join("");
      top.lastElementChild?.classList.add("flex-wrap");
      top.lastElementChild?.insertAdjacentHTML("afterbegin", `<select aria-label="Chọn quán" onchange="P2.live.M6.pickPlace(this.value)" class="px-2.5 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-[11px] font-bold w-full md:w-auto md:max-w-[220px]">${opts}</select>`);
    }
    return place;
  }
  function needLogin(root, ctx, d) {
    widen();
    shell(root, ctx, d, cur, false);
    subtitle(root, ctx, d.branches?.length ? "Vai trò của bạn không dùng được mục này." : "Đăng nhập bằng số điện thoại chủ quán để quản lý quán.");
    const b = body(root, ctx);
    const kpi = main(root, ctx)?.children[1];
    if (kpi && kpi !== b) kpi.remove();
    if (b) b.innerHTML = `<div class="bg-white p-6 rounded-2xl border border-[#E2E8F0] text-center space-y-3 shadow-sm">${ctx.K.mascotSVG("bep", "w-16 h-20 mx-auto")}<div class="font-extrabold text-sm">${d.branches?.length ? "Mục này dành cho Chủ quán / Quản lý. Nhân viên chỉ báo Còn món / Tạm hết ở màn Thực đơn." : d.status === 403 ? "Tài khoản này chưa quản lý quán nào hoặc chưa có quyền chủ quán." : "Cần đăng nhập tài khoản chủ quán."}</div>${d.branches?.length ? `<button onclick="goScreen('M6-S05')" class="px-5 py-2.5 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Mở Thực đơn & Giá (M6-S05)</button>` : `<button onclick="goScreen('M6-S01')" class="px-5 py-2.5 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Đăng nhập / Nhận quán (M6-S01)</button>`}</div>`;
    return root;
  }
  const subtitle = (root, ctx, t) => ctx.text(ctx.$("p.text-\\[11px\\]", main(root, ctx)?.firstElementChild || root), t);
  const title = (root, ctx, t) => ctx.text(ctx.$("h3", main(root, ctx)?.firstElementChild || root), t);
  const write = (ctx, job, msg) => ctx.action(job, () => { ver++; if (msg) ctx.status(msg); ctx.reload(); });
  const val = (sel) => document.querySelector(sel)?.value ?? "";
  const pill = (ctx, label, variant) => ctx.K.tagPill(ctx.H(label), variant);
  const greyPill = (ctx, label) => `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 bg-[#F1F5F9] text-[#64748B]">${ctx.H(label)}</span>`;
  const input = (cls = "") => `p-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] font-bold ${cls}`;

  window.TOV_LIVE.register("M6", {
    screens: {
      // ── M6-S01 login (phone OTP) + claim ─────────────────────────────────
      "M6-S01": {
        key: () => String(ver) + ":" + (window.TOV_AUTH?.role?.() || ""),
        async load(ctx) {
          try {
            return { me: await ctx.api("/merchant/me") };
          } catch (e) {
            if (e.status === 401 || e.status === 403) return { me: null, status: e.status, role: window.TOV_AUTH?.role?.() || "guest" };
            throw e;
          }
        },
        bind(html, d, ctx) {
          widen();
          const root = ctx.dom(html);
          const left = root.children[0], form = root.children[1];
          ctx.text(ctx.$("p", left), "Tiếp cận thực khách đang hỏi “Hôm nay ăn gì?” quanh quán của bạn.");
          const tip = ctx.$(".bg-white\\/10", left);
          if (tip) tip.innerHTML = '<b class="text-[#FBBF24] block">Bếp AI tách món từ bảng giá</b>Dán chữ trên bảng giá, AI tách tên món & giá; món chưa chắc sẽ chờ duyệt. Đọc ảnh đang ở chế độ thử.';
          const [phone, pass] = ctx.$$("input", form);
          const labels = ctx.$$("label", form);
          const btn = ctx.$("button", form);
          const me = d.me;
          if (me && (me.places.length || me.admin)) {
            ctx.text(ctx.$("h3", form), "Đã đăng nhập Cổng Quán");
            const list = me.places.slice(0, 6).map((p) => `<div class="flex justify-between items-center p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]"><span class="font-bold">${ctx.H(p.name)}</span>${pill(ctx, p.role_label, ROLE_VARIANT[p.role])}</div>`).join("");
            phone.closest("div").outerHTML = `<div class="space-y-1.5">${me.is_demo ? ctx.demoPill() : ""}${me.admin ? '<div class="text-[11px] text-[#64748B]">Quản trị viên: xem được mọi quán.</div>' : ""}${list}</div>`;
            pass.closest("div").outerHTML = `<button type="button" onclick="P2.live.M6.logout()" class="text-[11px] font-bold text-[#64748B] underline">Đăng xuất</button>`;
            return root;
          }
          // Phone + OTP (the core auth API); the original fields stay, the password field carries the OTP.
          phone.removeAttribute("readonly"); phone.setAttribute("value", ""); phone.type = "tel"; phone.id = "m6-login-phone";
          phone.setAttribute("placeholder", "VD: 0900 000 002");
          labels[1].textContent = "Mã OTP (thay cho mật khẩu)";
          pass.removeAttribute("readonly"); pass.setAttribute("value", ""); pass.type = "text"; pass.id = "m6-login-code";
          pass.setAttribute("inputmode", "numeric"); pass.setAttribute("maxlength", "6"); pass.setAttribute("placeholder", "Mã 6 số");
          phone.insertAdjacentHTML("afterend", `<button type="button" onclick="P2.live.M6.sendOtp()" class="mt-1.5 px-3 py-1.5 rounded-full bg-[#18181B] text-white text-[11px] font-bold">Gửi mã OTP</button><div id="m6-login-msg" class="text-[10px] text-[#64748B] mt-1"></div>`);
          if (me && !me.places.length) {
            // Signed in as a merchant without a place: claim one (pending verification).
            ctx.text(ctx.$("h3", form), "Nhận quán của bạn (chờ xác minh)");
            const opts = (me.claimable || []).map((p) => `<option value="${ctx.H(p.id)}">${ctx.H(p.name)} — ${ctx.H(p.address || "")}</option>`).join("");
            const claims = (me.claims || []).map((c) => `<div class="flex justify-between p-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px]"><span>${ctx.H(c.place_name)}</span>${pill(ctx, "Chờ xác minh", "yellow")}</div>`).join("");
            phone.closest("div").outerHTML = `<div class="space-y-1.5"><label class="text-[11px] font-bold text-[#64748B]">Chọn quán trong danh mục</label><select id="m6-claim-place" class="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-bold">${opts}</select>${claims}</div>`;
            pass.closest("div").outerHTML = `<div><label class="text-[11px] font-bold text-[#64748B]">Ghi chú xác minh (giấy phép, SĐT quán…)</label><input id="m6-claim-note" type="text" maxlength="300" class="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-bold mt-1"/></div>`;
            btn.textContent = "Gửi yêu cầu nhận quán";
            btn.setAttribute("onclick", "P2.live.M6.claim()");
            return root;
          }
          if (d.status === 403 && d.role && d.role !== "guest")
            btn.insertAdjacentHTML("beforebegin", `<div class="text-[11px] text-[#B45309] font-bold">Số đang đăng nhập chưa được cấp quyền chủ quán.</div>`);
          btn.textContent = "✨ Đăng nhập & Vào Bảng Điều Khiển Quán (M6-S02) →";
          btn.setAttribute("onclick", "P2.live.M6.verifyOtp()");
          return root;
        },
      },

      // ── M6-S02 overview ──────────────────────────────────────────────────
      "M6-S02": {
        key,
        load: (ctx) => withShell(ctx, () => ctx.api("/merchant/overview" + P())),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          if (d.needLogin) return needLogin(root, ctx, d);
          const o = d.data;
          shell(root, ctx, d, o.place.id, o.is_demo);
          subtitle(root, ctx, `${o.place.name} · 7 ngày qua. Chỉ đường, đặt món, gọi điện đếm từ lượt bấm thật trong app (+ số demo); lượt hiển thị hiện là số demo.`);
          ctx.$$(".grid.grid-cols-2 > div", main(root, ctx)).forEach((card, i) => {
            const c = o.cards[i];
            if (!c) return;
            ctx.text(ctx.$(".truncate", card), c.label);
            const spans = ctx.$$(".text-base span", card);
            ctx.text(spans[0], num(c.value));
            if (spans[1]) {
              spans[1].textContent = pct(c.delta_pct);
              if (c.delta_pct < 0) spans[1].className = "text-[10px] font-bold text-[#DC2626]";
            }
            card.title = `Thật: ${num(c.real)} · Demo: ${num(c.demo)}`;
          });
          const b = body(root, ctx);
          const [chartCol, topCol] = ctx.$$(":scope > .grid > div", b);
          if (chartCol) {
            const tag = ctx.$(".flex.justify-between span:last-child", chartCol);
            if (tag) tag.outerHTML = pill(ctx, pct(o.chart.delta_pct) + " so với tuần trước", o.chart.delta_pct < 0 ? "rose" : "green");
            const vals = o.chart.days.map((x) => x.directions + x.orders);
            const max = Math.max(1, ...vals);
            const bar = ctx.$(".pt-3.pb-1", chartCol);
            if (bar) {
              const fresh = ctx.dom(ctx.K.barChart(vals.map((v) => Math.max(4, Math.round((v / max) * 100))), o.chart.days.map((x) => x.label), "#FBBF24", vals.length - 1));
              ctx.$$(".grid > div > span:first-child", fresh).forEach((s, i) => { s.textContent = num(vals[i]); });
              bar.replaceWith(fresh);
            }
            const donut = ctx.$(".flex.items-center.gap-4", chartCol);
            if (donut) {
              const colors = ["#FBBF24", "#22C55E", "#3B82F6", "#F97316"];
              const items = o.channels.items.map((c, i) => ({ label: ctx.H(c.label), pct: c.pct + "%", color: colors[i] }));
              const fresh = ctx.dom(ctx.K.donutChart("Chuyển đổi", num(o.channels.total), items));
              let off = 0;
              ctx.$$("circle", fresh).slice(1).forEach((c, i) => {
                const p = o.channels.items[i]?.pct || 0;
                c.setAttribute("stroke", colors[i]);
                c.setAttribute("stroke-dasharray", `${p} ${100 - p}`);
                c.setAttribute("stroke-dashoffset", String(-off));
                c.setAttribute("pathLength", "100");
                off += p;
              });
              donut.replaceWith(fresh);
            }
          }
          if (topCol) {
            const rows = ctx.$$(":scope > .flex", topCol), tpl = rows[0];
            rows.forEach((r) => r.remove());
            if (!o.top_dishes.length) topCol.insertAdjacentHTML("beforeend", '<div class="text-[11px] text-[#64748B]">Chưa có món trong thực đơn.</div>');
            o.top_dishes.forEach((t, i) => {
              const n = tpl.cloneNode(true);
              const im = ctx.$("img", n);
              if (t.img_key) ctx.img(im, t.img_key); else im.remove();
              ctx.text(ctx.$(".font-extrabold", n), `${i + 1}. ${t.name}`);
              ctx.text(ctx.$(".text-\\[10px\\]", n), `${num(t.impressions)} hiển thị · ${num(t.directions)} chỉ đường · ${num(t.orders)} đặt món`);
              ctx.text(ctx.$(":scope > span", n), ctx.money(t.price_vnd));
              topCol.append(n);
            });
          }
          return root;
        },
      },

      // ── M6-S03 profile & hours ───────────────────────────────────────────
      "M6-S03": {
        key,
        load: (ctx) => guarded(ctx, async () => {
          const br = await ctx.api("/merchant/branches");
          const id = cur || br.branches?.[0]?.id;
          return { branches: br.branches || [], demo: !!br.is_demo, data: id ? await ctx.api("/merchant/places/" + encodeURIComponent(id)) : null };
        }),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          if (d.needLogin || !d.data) return needLogin(root, ctx, { status: 403, ...d });
          const p = d.data;
          shown = p.id;
          shell(root, ctx, d, p.id, d.demo);
          const can = p.role !== "staff";
          const [left, right] = ctx.$$(":scope > div > div", body(root, ctx));
          const [nameIn, hoursIn] = ctx.$$("input", left);
          nameIn.setAttribute("value", p.pending_change?.name || p.name); nameIn.setAttribute("data-m6", "name");
          hoursIn.setAttribute("value", p.pending_change?.hours_text || p.hours_text || ""); hoursIn.setAttribute("data-m6", "hours");
          hoursIn.setAttribute("placeholder", "06:00 – 22:00");
          if (can) { nameIn.removeAttribute("readonly"); hoursIn.removeAttribute("readonly"); }
          const pills = ctx.$(".flex.flex-wrap", left);
          const AM = [["has_ac", "Có máy lạnh", "blue"], ["has_parking", "Đậu xe miễn phí", "green"], ["has_kids_seat", "Ghế trẻ em", "yellow"]];
          pills.innerHTML = AM.map(([k, label, v]) => {
            const on = !!p.amenities[k];
            return `<button type="button" data-m6-am="${k}" data-on="${on}" data-label="${ctx.H(label)}" data-variant="${v}" ${can ? `onclick="P2.live.M6.toggleAmenity(this)"` : "disabled"} aria-pressed="${on}">${on ? ctx.K.tagPill("✔ " + ctx.H(label), v) : greyPill(ctx, "○ " + label)}</button>`;
          }).join("");
          const status = [pill(ctx, "● " + p.open_status.label, STATUS_VARIANT[p.open_status.status] || "yellow"),
            p.hours_verified ? pill(ctx, "Giờ đã xác minh", "mint") : greyPill(ctx, "Giờ chưa xác minh"),
            p.pending_change ? pill(ctx, "Thay đổi chờ M9 duyệt", "orange") : ""].join("");
          left.insertAdjacentHTML("afterbegin", `<div class="flex flex-wrap gap-1.5">${status}</div>`);
          if (p.pending_change) left.insertAdjacentHTML("beforeend", `<div class="text-[10px] text-[#B45309]">${ctx.H(p.pending_change.note || "")}</div>`);
          const linkIn = ctx.$("input", right);
          const label = ctx.$("label", right);
          if (label) label.textContent = "Deep-link GrabFood / ShopeeFood / Xanh SM Ngon";
          linkIn.setAttribute("value", p.links.grabfood); linkIn.setAttribute("data-m6", "grabfood"); linkIn.setAttribute("placeholder", "https://food.grab.com/vn/vi/restaurant/…");
          const more = [["shopeefood", "https://shopeefood.vn/…"], ["xanhsm", "https://xanhsm.com/…"]].map(([k, ph]) => {
            const n = linkIn.cloneNode(true);
            n.setAttribute("value", p.links[k]); n.setAttribute("data-m6", k); n.setAttribute("placeholder", ph);
            return n;
          });
          [linkIn, ...more].forEach((n) => { if (can) n.removeAttribute("readonly"); });
          linkIn.after(...more);
          const save = ctx.$("button", right);
          if (can) {
            save.setAttribute("onclick", "P2.live.M6.saveProfile()");
            save.insertAdjacentHTML("afterend", `<button type="button" onclick="P2.live.M6.pause(${p.is_open ? "true" : "false"})" class="w-full py-2.5 rounded-full bg-white border border-[#E2E8F0] font-extrabold">${p.is_open ? "Tạm ngưng nhận khách (ẩn khỏi gợi ý)" : "Mở lại quán"}</button><div class="text-[10px] text-[#64748B]">Tiện ích, link giao hàng và tạm ngưng được áp dụng ngay; tên, địa chỉ, giờ mở cửa chờ đội vận hành xác minh. Quán chưa xác minh giờ không bao giờ hiện là Đang mở.</div>`);
          } else {
            save.disabled = true; save.textContent = "Nhân viên chỉ xem hồ sơ quán";
          }
          return root;
        },
      },

      // ── M6-S04 branches ──────────────────────────────────────────────────
      "M6-S04": {
        key,
        load: (ctx) => withShell(ctx, async () => ({})),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          if (d.needLogin) return needLogin(root, ctx, d);
          const br = d.branches;
          const place = shell(root, ctx, d, cur, d.demo);
          title(root, ctx, `Quản Lý Chi Nhánh (${br.length} Cơ sở)`);
          subtitle(root, ctx, "Mỗi cơ sở có thực đơn và trạng thái mở cửa riêng. Bấm một cơ sở để chỉnh hồ sơ.");
          const grid = ctx.$(":scope > .grid", body(root, ctx));
          const [hl, plain] = ctx.$$(":scope > div", grid);
          grid.innerHTML = "";
          if (!br.length) grid.innerHTML = '<div class="text-[11px] text-[#64748B]">Chưa có cơ sở nào.</div>';
          br.forEach((b, i) => {
            const n = (b.id === place?.id ? hl : plain).cloneNode(true);
            const head = ctx.$(".flex", n);
            head.innerHTML = `<b class="text-sm">Cơ sở ${i + 1}: ${ctx.H(b.name)}</b>${pill(ctx, "● " + b.open_status.label, STATUS_VARIANT[b.open_status.status] || "yellow")}`;
            ctx.text(ctx.$("p", n), `${b.address} · ${b.menu_available} món đang phục vụ${b.rating ? " · " + String(b.rating).replace(".", ",") + "★" : ""} · ${b.role_label}`);
            n.classList.add("cursor-pointer");
            n.setAttribute("onclick", `P2.live.M6.pickPlace('${ctx.J(b.id)}','M6-S03')`);
            grid.append(n);
          });
          return root;
        },
      },

      // ── M6-S05 menu ──────────────────────────────────────────────────────
      "M6-S05": {
        key,
        load: (ctx) => withShell(ctx, () => ctx.api("/merchant/menu" + P())),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          if (d.needLogin) return needLogin(root, ctx, d);
          const m = d.data;
          shell(root, ctx, d, m.place_id, m.is_demo);
          subtitle(root, ctx, `${m.place_name} · ${m.items.length} món. Món đã ghép Thư viện M2 kế thừa tag dị ứng; Còn món / Tạm hết của món trên gợi ý được đồng bộ ngay.`);
          const grid = ctx.$(":scope > .grid", body(root, ctx));
          const tpl = grid.firstElementChild;
          grid.innerHTML = "";
          const canEdit = m.role !== "staff";
          m.items.forEach((it) => {
            const n = tpl.cloneNode(true);
            const im = ctx.$("img", n);
            if (it.img_key) ctx.img(im, it.img_key);
            else im.outerHTML = '<div class="w-full h-32 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-2xl" aria-hidden="true">🍽️</div>';
            const tags = [
              it.status === "pending_review" ? pill(ctx, "Chờ duyệt", "yellow") : it.available ? pill(ctx, "Còn món", "green") : pill(ctx, "Tạm hết", "rose"),
              it.dish_id ? pill(ctx, "Dish #" + it.dish_id.replace(/^DISH-/, ""), "blue") : greyPill(ctx, "Chưa ghép M2"),
              it.campaign_active ? pill(ctx, "Đang chạy M7", "orange") : it.on_recommendations ? pill(ctx, "Trên gợi ý", "mint") : "",
            ].join("");
            ctx.$(".flex.gap-1", n).innerHTML = tags;
            ctx.$(".flex.gap-1", n).classList.add("flex-wrap");
            const [nm, pr] = ctx.$$(".flex.justify-between span", n);
            ctx.text(nm, it.name);
            ctx.text(pr, ctx.money(it.price_vnd));
            const allergy = it.allergen_tags.length ? "Dị ứng: " + it.allergen_tags.join(", ") : it.allergen_note || "";
            if (allergy) ctx.$(".flex.justify-between", n).insertAdjacentHTML("afterend", `<div class="text-[10px] text-[#B45309]">${ctx.H(allergy)}</div>`);
            const btn = ctx.$("button", n);
            if (it.status === "pending_review") {
              btn.disabled = true; btn.textContent = "Chờ duyệt trước khi bán";
            } else {
              btn.textContent = it.available ? "Báo Tạm hết" : "Bật lại Còn món";
              btn.setAttribute("onclick", `P2.live.M6.toggleItem('${ctx.J(it.id)}',${!it.available})`);
            }
            if (canEdit) btn.insertAdjacentHTML("afterend", `<div class="flex gap-1.5"><input data-m6-price="${ctx.H(it.id)}" type="number" min="0" step="1000" value="${ctx.H(it.price_vnd)}" aria-label="Giá mới" class="${input("flex-1 min-w-0")}"/><button type="button" onclick="P2.live.M6.savePrice('${ctx.J(it.id)}')" class="px-3 py-1.5 rounded-full bg-white border border-[#E2E8F0] text-[11px] font-extrabold">Lưu giá</button></div>`);
            grid.append(n);
          });
          if (canEdit) grid.insertAdjacentHTML("beforeend", `<div class="bg-white p-3.5 rounded-2xl border border-dashed border-[#CBD5E1] space-y-2 shadow-sm"><div class="font-extrabold text-sm">+ Thêm món mới</div><input id="m6-new-name" type="text" maxlength="80" placeholder="Tên món" class="${input("w-full")}"/><input id="m6-new-price" type="number" min="0" step="1000" placeholder="Giá (đ)" class="${input("w-full")}"/><input id="m6-new-cat" type="text" maxlength="40" placeholder="Nhóm (Món nước, Món thêm…)" class="${input("w-full")}"/><button type="button" onclick="P2.live.M6.addItem()" class="w-full py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Thêm vào thực đơn</button></div>`);
          if (!m.items.length && !canEdit) grid.innerHTML = '<div class="text-[11px] text-[#64748B]">Chưa có món.</div>';
          return root;
        },
      },

      // ── M6-S06 AI menu OCR ───────────────────────────────────────────────
      "M6-S06": {
        key,
        load: (ctx) => withShell(ctx, () => ctx.api("/merchant/menu/ocr" + P())),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          if (d.needLogin) return needLogin(root, ctx, d);
          const o = d.data, s = o.latest;
          shell(root, ctx, d, o.place_id, o.is_demo);
          subtitle(root, ctx, "Dán chữ trên bảng giá (hoặc chọn ảnh — đọc ảnh đang ở chế độ thử). AI tách tên món, giá và ghép Thư viện M2; món chưa chắc sẽ chờ duyệt.");
          const [imgCol, listCol] = ctx.$$(":scope > .grid > div", body(root, ctx));
          const badge = ctx.$("span", imgCol);
          if (badge) badge.textContent = s?.sandbox ? "✨ Ảnh: kết quả mẫu (sandbox)" : "✨ Bảng giá của quán";
          imgCol.insertAdjacentHTML("beforeend", `<div class="mt-2 space-y-2 text-white"><div class="text-[10px] text-gray-300">${s ? "Lượt quét gần nhất: " + ctx.H(s.image_name || "chữ dán tay") : "Chưa có lượt quét"}</div><input id="m6-ocr-file" type="file" accept="image/*" onchange="P2.live.M6.pickImage(this)" class="block w-full text-[10px] text-gray-300"/><textarea id="m6-ocr-text" rows="4" maxlength="4000" placeholder="Phở bò tái nạm 45k&#10;Bún bò Huế 50.000đ" class="w-full p-2 rounded-xl bg-white text-[#0F172A] text-[11px]"></textarea><button type="button" onclick="P2.live.M6.scan()" class="w-full py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Quét thực đơn</button></div>`);
          const cards = ctx.$$(":scope > .bg-white", listCol), tpl = cards[0], tplPending = cards[2] || cards[0];
          cards.forEach((c) => c.remove());
          const btn = ctx.$("button", listCol);
          if (!s) {
            btn.insertAdjacentHTML("beforebegin", '<div class="text-[11px] text-[#64748B]">Chưa có món nào được tách. Dán chữ trên bảng giá rồi bấm Quét.</div>');
            btn.disabled = true;
            return root;
          }
          if (s.sandbox) btn.insertAdjacentHTML("beforebegin", `<div class="p-2.5 rounded-xl bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold">${ctx.H(s.sandbox_note || "Kết quả mẫu (sandbox)")}</div>`);
          s.items.forEach((it, i) => {
            const n = (it.status === "ready" ? tpl : tplPending).cloneNode(true);
            const conf = Math.round(it.confidence * 100);
            const head = ctx.$(".flex.items-center", n);
            const sub = ctx.$(":scope > div > .text-\\[10px\\]", n);
            head.innerHTML = `<b>${i + 1}. ${ctx.H(it.name)}</b>${it.status === "ready"
              ? pill(ctx, `Khớp ${conf}% · M2 #${(it.dish_id || "").replace(/^DISH-/, "")}`, "green")
              : pill(ctx, `Chờ duyệt (${conf}%)`, "yellow")}`;
            const tags = [...(it.dish_tags || []), it.calories ? it.calories + " kcal" : ""].filter(Boolean).join(" · ");
            sub.textContent = it.dish_id
              ? `Ghép ${it.dish_name}${tags ? " · tag: " + tags : ""}${it.allergen_tags.length ? " · Dị ứng: " + it.allergen_tags.join(", ") : ""}`
              : "Chưa ghép được món chuẩn M2 — cần người duyệt" + (it.price_vnd === null ? " · chưa đọc được giá" : "");
            ctx.text(ctx.$(":scope > span", n), it.price_vnd === null ? "Chưa rõ giá" : ctx.money(it.price_vnd));
            btn.before(n);
          });
          if (s.status === "draft") {
            btn.textContent = `✓ Xác nhận & Xuất bản ${s.items.length} món vào Thực đơn Quán`;
            btn.setAttribute("onclick", `P2.live.M6.publish('${ctx.J(s.id)}')`);
            btn.insertAdjacentHTML("afterend", `<div class="text-[10px] text-[#64748B]">${s.auto_approved_count} món khớp cao vào thực đơn; ${s.queued_for_admin_count} món chờ duyệt trong Cổng Quán (chưa bật bán).</div>`);
          } else {
            btn.textContent = "✓ Đã xuất bản vào Thực đơn Quán";
            btn.setAttribute("onclick", "goScreen('M6-S05')");
          }
          return root;
        },
      },

      // ── M6-S07 daily special & promotions ────────────────────────────────
      "M6-S07": {
        key,
        load: (ctx) => withShell(ctx, async () => {
          const [promo, menu] = await Promise.all([ctx.api("/merchant/promotions" + P()), ctx.api("/merchant/menu" + P())]);
          return { promo, menu };
        }),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          if (d.needLogin) return needLogin(root, ctx, d);
          const { promo, menu } = d.data;
          shell(root, ctx, d, promo.place_id, promo.is_demo);
          subtitle(root, ctx, `${promo.place_name} · Món đặc biệt và ưu đãi được lưu cho quán; bộ máy gợi ý M3 chưa đọc tín hiệu này.`);
          const grid = ctx.$(":scope > .grid", body(root, ctx));
          const [specCard, promoCard] = ctx.$$(":scope > div", grid);
          const sp = promo.daily_special[0];
          const sIm = ctx.$("img", specCard);
          if (sp?.img_key) ctx.img(sIm, sp.img_key);
          else sIm.outerHTML = '<div class="w-16 h-16 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-xl shrink-0" aria-hidden="true">🔥</div>';
          ctx.text(ctx.$(".font-extrabold", specCard), sp ? sp.name : "Chưa đặt món đặc biệt hôm nay");
          ctx.text(ctx.$(".text-\\[11px\\]", specCard), sp ? [sp.special_label, sp.start_time && sp.end_time ? `${sp.start_time} – ${sp.end_time}` : ""].filter(Boolean).join(" · ") : "Chọn một món bên dưới để làm món đặc biệt hôm nay.");
          const canEdit = menu.role !== "staff";
          promoCard.remove();
          if (!promo.promotions.length) grid.insertAdjacentHTML("beforeend", '<div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] text-[11px] text-[#64748B]">Chưa có khuyến mãi nào.</div>');
          promo.promotions.forEach((p) => {
            const n = promoCard.cloneNode(true);
            const im = ctx.$("img", n);
            if (p.img_key) ctx.img(im, p.img_key);
            else im.outerHTML = '<div class="w-16 h-16 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-xl shrink-0" aria-hidden="true">🏷️</div>';
            const box = ctx.$(".space-y-1", n);
            const tag = box.firstElementChild;
            tag.outerHTML = pill(ctx, (p.tag || (p.discount_pct ? `Giảm ${p.discount_pct}%` : "Khuyến mãi")) + (p.active ? "" : " · Tạm dừng"), p.active ? "green" : "rose");
            ctx.text(ctx.$(".font-extrabold", n), p.title);
            ctx.text(ctx.$(".text-\\[11px\\]", n), [p.detail, p.start_time && p.end_time ? `${p.start_time} – ${p.end_time}` : ""].filter(Boolean).join(" · "));
            if (canEdit) box.insertAdjacentHTML("beforeend", `<button type="button" onclick="P2.live.M6.togglePromo('${ctx.J(p.id)}',${!p.active})" class="mt-1 px-3 py-1 rounded-full bg-white border border-[#E2E8F0] text-[10px] font-extrabold">${p.active ? "Tạm dừng" : "Bật lại"}</button>`);
            grid.append(n);
          });
          if (canEdit) {
            const opts = menu.items.filter((i) => i.status !== "pending_review").map((i) => `<option value="${ctx.H(i.id)}">${ctx.H(i.name)} · ${ctx.money(i.price_vnd)}</option>`).join("");
            body(root, ctx).insertAdjacentHTML("beforeend", `<div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div class="bg-white p-4 rounded-2xl border border-dashed border-[#FBBF24] space-y-2"><b>🔥 Đặt món đặc biệt hôm nay</b><select id="m6-sp-item" class="${input("w-full")}">${opts}</select><input id="m6-sp-detail" type="text" maxlength="200" placeholder="Ưu đãi kèm (VD: Tặng 1 đĩa quẩy)" class="${input("w-full")}"/><div class="flex gap-1.5"><input id="m6-sp-start" type="time" class="${input("flex-1 min-w-0")}"/><input id="m6-sp-end" type="time" class="${input("flex-1 min-w-0")}"/></div><button type="button" onclick="P2.live.M6.setSpecial()" class="w-full py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Đặt làm món hôm nay</button></div><div class="bg-white p-4 rounded-2xl border border-dashed border-[#CBD5E1] space-y-2"><b>🏷️ Thêm khuyến mãi</b><input id="m6-pr-title" type="text" maxlength="120" placeholder="Tiêu đề (VD: Giảm 15% bữa tối)" class="${input("w-full")}"/><input id="m6-pr-detail" type="text" maxlength="200" placeholder="Điều kiện áp dụng" class="${input("w-full")}"/><div class="flex gap-1.5"><input id="m6-pr-disc" type="number" min="0" max="90" placeholder="% giảm" class="${input("w-20")}"/><input id="m6-pr-start" type="time" class="${input("flex-1 min-w-0")}"/><input id="m6-pr-end" type="time" class="${input("flex-1 min-w-0")}"/></div><button type="button" onclick="P2.live.M6.addPromo()" class="w-full py-2 rounded-full bg-[#22C55E] text-white font-extrabold">Thêm khuyến mãi</button></div></div>`);
          }
          return root;
        },
      },

      // ── M6-S08 analytics ─────────────────────────────────────────────────
      "M6-S08": {
        key: () => key() + ":" + days,
        load: (ctx) => withShell(ctx, () => ctx.api("/merchant/analytics" + P("days=" + days))),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          if (d.needLogin) return needLogin(root, ctx, d);
          const a = d.data;
          shell(root, ctx, d, a.place_id, a.is_demo);
          subtitle(root, ctx, `${a.place_name} · ${a.days} ngày qua. Chỉ đường / đặt món đếm từ lượt bấm thật (${num(a.real_redirects)}) cộng số demo; hiển thị AI là số demo.`);
          const b = body(root, ctx);
          b.insertAdjacentHTML("afterbegin", `<div class="flex gap-1.5">${[7, 30].map((n) => `<button type="button" onclick="P2.live.M6.setDays(${n})" class="px-3 py-1.5 rounded-full text-[11px] font-extrabold ${n === a.days ? "bg-[#18181B] text-white" : "bg-white border border-[#E2E8F0]"}">${n} ngày</button>`).join("")}</div>`);
          const tbody = ctx.$("tbody", b), tpl = tbody.firstElementChild;
          tbody.innerHTML = "";
          if (!a.rows.length) tbody.innerHTML = '<tr><td class="p-3.5 text-[#64748B]" colspan="5">Chưa có món trong thực đơn.</td></tr>';
          a.rows.forEach((r) => {
            const n = tpl.cloneNode(true);
            const td = ctx.$$("td", n);
            td[0].textContent = `${r.name} (${Math.round(r.price_vnd / 1000)}k)`;
            td[1].textContent = num(r.impressions);
            td[2].textContent = num(r.directions);
            td[3].textContent = num(r.orders);
            td[4].innerHTML = r.cvr_pct === null ? greyPill(ctx, "—") : pill(ctx, String(r.cvr_pct).replace(".", ",") + "% CVR", r.cvr_pct >= 4 ? "green" : r.cvr_pct >= 2.5 ? "yellow" : "rose");
            tbody.append(n);
          });
          return root;
        },
      },

      // ── M6-S09 staff & roles ─────────────────────────────────────────────
      "M6-S09": {
        key,
        load: (ctx) => withShell(ctx, () => ctx.api("/merchant/staff" + P())),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          if (d.needLogin) return needLogin(root, ctx, d);
          const s = d.data;
          shell(root, ctx, d, s.place_id, s.is_demo);
          subtitle(root, ctx, `${s.place_name} · Owner toàn quyền, Manager quản lý thực đơn & khuyến mãi, Staff chỉ báo Còn món / Tạm hết.`);
          const box = ctx.$(":scope > div", body(root, ctx));
          const tpl = box.firstElementChild;
          box.innerHTML = "";
          s.staff.forEach((m) => {
            const n = tpl.cloneNode(true);
            ctx.text(ctx.$("b", n), `${m.name} (${m.title || m.role_label})`);
            ctx.text(ctx.$(".text-\\[11px\\]", n), `${m.rights} · ${m.phone_masked}${m.linked ? "" : " · chưa đăng nhập"}`);
            const tag = n.lastElementChild;
            let ctl = pill(ctx, m.role_label, ROLE_VARIANT[m.role]);
            if (s.can_manage && m.role !== "owner")
              ctl = `<div class="flex items-center gap-1.5 shrink-0">${ctl}<select aria-label="Đổi vai trò" onchange="P2.live.M6.setRole('${ctx.J(m.id)}',this.value)" class="p-1 rounded-lg border border-[#E2E8F0] text-[10px] font-bold"><option value="staff" ${m.role === "staff" ? "selected" : ""}>Staff</option><option value="manager" ${m.role === "manager" ? "selected" : ""}>Manager</option></select><button type="button" onclick="P2.live.M6.removeStaff('${ctx.J(m.id)}')" class="px-2 py-1 rounded-lg bg-white border border-[#FECACA] text-[#B91C1C] text-[10px] font-bold">Xoá</button></div>`;
            tag.outerHTML = ctl;
            box.append(n);
          });
          if (s.can_manage)
            box.insertAdjacentHTML("beforeend", `<div class="p-3 rounded-xl border border-dashed border-[#CBD5E1] flex flex-wrap gap-2 items-center"><input id="m6-st-name" type="text" maxlength="80" placeholder="Họ tên" class="${input("flex-1 min-w-[120px]")}"/><input id="m6-st-phone" type="tel" placeholder="Số điện thoại" class="${input("flex-1 min-w-[120px]")}"/><select id="m6-st-role" class="${input()}"><option value="staff">Staff</option><option value="manager">Manager</option></select><button type="button" onclick="P2.live.M6.addStaff()" class="px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold text-[11px]">Thêm nhân viên</button><div class="w-full text-[10px] text-[#64748B]">Chưa gửi SMS mời (sandbox): nhân viên đăng nhập bằng số này sau khi số được cấp quyền chủ quán.</div></div>`);
          return root;
        },
      },
    },
    actions: {
      pickPlace(ctx, id, go) {
        cur = id || null;
        if (go) ctx.goScreen(go); else ctx.reload();
      },
      async sendOtp(ctx) {
        const msg = document.getElementById("m6-login-msg");
        const r = await window.TOV_AUTH.requestOtp(val("#m6-login-phone"));
        if (!r.ok) { if (msg) msg.textContent = r.data.error || "Không gửi được mã."; return; }
        if (r.data.dev_code) { const c = document.getElementById("m6-login-code"); if (c) c.value = r.data.dev_code; if (msg) msg.textContent = "Chế độ phát triển: mã thử nghiệm đã được điền sẵn."; }
        else if (msg) msg.textContent = "Đã gửi mã qua SMS.";
      },
      async verifyOtp(ctx) {
        const msg = document.getElementById("m6-login-msg");
        const r = await window.TOV_AUTH.verifyOtp(val("#m6-login-phone"), val("#m6-login-code"));
        if (!r.ok) { if (msg) msg.textContent = r.data.error || "Mã không đúng."; return; }
        ver++;
        if (r.data.role === "merchant" || r.data.role === "super_admin") ctx.goScreen("M6-S02");
        else ctx.reload("M6-S01");
      },
      logout(ctx) { window.TOV_AUTH.logout(); cur = null; ver++; ctx.reload("M6-S01"); },
      claim(ctx) {
        write(ctx, () => ctx.api("/merchant/claim", "POST", { place_id: val("#m6-claim-place"), note: val("#m6-claim-note") }), "Đã gửi yêu cầu nhận quán. Quyền quản lý được cấp sau khi xác minh.");
      },
      toggleAmenity(ctx, el) {
        const on = el.dataset.on !== "true";
        el.dataset.on = String(on);
        el.setAttribute("aria-pressed", String(on));
        const label = el.dataset.label;
        el.innerHTML = on ? ctx.K.tagPill("✔ " + label, el.dataset.variant) : `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 bg-[#F1F5F9] text-[#64748B]">○ ${label}</span>`;
      },
      saveProfile(ctx) {
        const v = (k) => val(`[data-m6="${k}"]`);
        const amenities = {};
        document.querySelectorAll("[data-m6-am]").forEach((b) => { amenities[b.dataset.m6Am] = b.dataset.on === "true"; });
        const id = shown;
        if (!id) return ctx.status("Chưa chọn quán.", true);
        write(ctx, () => ctx.api("/merchant/places/" + encodeURIComponent(id), "PUT", {
          name: v("name"), hours_text: v("hours"), amenities,
          links: { grabfood: v("grabfood"), shopeefood: v("shopeefood"), xanhsm: v("xanhsm") },
        }), "Đã lưu hồ sơ quán.");
      },
      pause(ctx, paused) {
        const id = shown;
        if (!id) return;
        write(ctx, () => ctx.api("/merchant/places/" + encodeURIComponent(id), "PUT", { paused }), paused ? "Đã tạm ngưng: quán hiện là Đang đóng." : "Đã mở lại quán.");
      },
      toggleItem(ctx, id, available) {
        write(ctx, () => ctx.api("/merchant/menu/" + encodeURIComponent(id), "PATCH", { available }), available ? "Đã bật Còn món." : "Đã báo Tạm hết.");
      },
      savePrice(ctx, id) {
        const price = Number(val(`[data-m6-price="${id}"]`));
        write(ctx, () => ctx.api("/merchant/menu/" + encodeURIComponent(id), "PATCH", { price_vnd: price }), "Đã lưu giá.");
      },
      addItem(ctx) {
        write(ctx, () => ctx.api("/merchant/menu" + P(), "POST", { name: val("#m6-new-name"), price_vnd: Number(val("#m6-new-price")), category: val("#m6-new-cat") }), "Đã thêm món.");
      },
      pickImage(ctx, el) {
        const f = el.files && el.files[0];
        ocrImage = f ? f.name : "";
        if (f && f.type.startsWith("image/")) {
          const r = new FileReader();
          r.onload = () => { const im = el.closest(".relative")?.querySelector("img"); if (im) { im.removeAttribute("data-img"); im.src = r.result; } };
          r.readAsDataURL(f);
        }
      },
      scan(ctx) {
        const raw_text = val("#m6-ocr-text");
        write(ctx, () => ctx.api("/merchant/menu/ocr" + P(), "POST", { raw_text, image_name: ocrImage }), "Đã tách món. Kiểm tra rồi bấm Xuất bản.");
      },
      publish(ctx, id) {
        write(ctx, () => ctx.api("/merchant/menu/ocr/" + encodeURIComponent(id) + "/publish", "POST", {}), "Đã xuất bản vào Thực đơn Quán.");
      },
      setSpecial(ctx) {
        write(ctx, () => ctx.api("/merchant/promotions" + P(), "POST", { type: "daily_special", menu_item_id: val("#m6-sp-item"), detail: val("#m6-sp-detail"), start_time: val("#m6-sp-start"), end_time: val("#m6-sp-end") }), "Đã đặt món đặc biệt hôm nay.");
      },
      addPromo(ctx) {
        write(ctx, () => ctx.api("/merchant/promotions" + P(), "POST", { title: val("#m6-pr-title"), detail: val("#m6-pr-detail"), discount_pct: val("#m6-pr-disc"), start_time: val("#m6-pr-start"), end_time: val("#m6-pr-end") }), "Đã thêm khuyến mãi.");
      },
      togglePromo(ctx, id, active) {
        write(ctx, () => ctx.api("/merchant/promotions/" + encodeURIComponent(id), "PATCH", { active }));
      },
      setDays(ctx, n) { days = n === 30 ? 30 : 7; ctx.reload(); },
      addStaff(ctx) {
        write(ctx, () => ctx.api("/merchant/staff" + P(), "POST", { name: val("#m6-st-name"), phone: val("#m6-st-phone"), role: val("#m6-st-role") }), "Đã thêm nhân viên (chưa gửi SMS mời — sandbox).");
      },
      setRole(ctx, id, role) { write(ctx, () => ctx.api("/merchant/staff/" + encodeURIComponent(id), "PATCH", { role }), "Đã đổi vai trò."); },
      removeStaff(ctx, id) { write(ctx, () => ctx.api("/merchant/staff/" + encodeURIComponent(id), "DELETE"), "Đã xoá nhân viên."); },
    },
  });
})();

/* M9-S04 (Restaurant Verification Queue): small "Yêu cầu nhận quán (M6)" card for
 * super_admin/admin — approve/reject pending merchant claims (POST /merchant/admin/claims/:id/…).
 * Mounted through the existing M9 form parts, inside the original screen; no new screen. */
(function () {
  const REVIEWERS = ["super_admin", "admin"];
  function mountClaims(root, id, d, C) {
    if (id !== "M9-S04" || !REVIEWERS.includes(C.role) || root.querySelector("[data-claim-review]")) return;
    const content = root.lastElementChild && root.lastElementChild.lastElementChild;
    if (!content) return;
    const E = window.escHtml;
    const host = document.createElement("div");
    host.dataset.claimReview = "";
    content.insertBefore(host, content.querySelector("[data-place-editor]"));
    host.innerHTML = C.card("Yêu cầu nhận quán của chủ quán (M6)", C.form('<div data-claim-list><p class="text-[11px] text-[#64748B]">Đang tải yêu cầu…</p></div>'));
    const form = host.querySelector("form");
    const list = host.querySelector("[data-claim-list]");
    const fmt = (iso) => { try { return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
    function draw(items) {
      if (!items.length) { list.innerHTML = '<p class="text-[11px] text-[#64748B]">Không có yêu cầu nhận quán nào đang chờ duyệt.</p>'; return; }
      list.innerHTML = '<div class="space-y-1 mb-3">' + items.map((c) => '<div class="text-[11px] text-[#64748B]"><b class="text-[#0F172A]">' + E(c.place_name || c.place_id) + "</b> · " +
        E((c.claimant && (c.claimant.name || c.claimant.phone_masked)) || "Tài khoản đã xoá") + (c.claimant && c.claimant.phone_masked && c.claimant.name ? " (" + E(c.claimant.phone_masked) + ")" : "") +
        " · " + E(fmt(c.created_at)) + (c.note ? " · “" + E(c.note) + "”" : "") + (c.is_demo ? " · Dữ liệu demo" : "") + "</div>").join("") + "</div>" +
        C.select("claim_id", "Yêu cầu cần xử lý", items[0].id, items.map((c) => [c.id, (c.place_name || c.place_id) + " · " + ((c.claimant && (c.claimant.name || c.claimant.phone_masked)) || "")])) +
        C.area("reason", "Lý do từ chối (bắt buộc khi từ chối)") +
        '<p class="text-[11px] text-[#64748B]">Duyệt sẽ cấp quyền Chủ quán cho tài khoản gửi yêu cầu tại quán này. Quán đã có chủ thì chỉ có thể từ chối.</p>' +
        '<div class="flex gap-2 mt-3">' + C.button("✓ Duyệt & cấp quyền chủ quán", "approve-claim") + C.button("Từ chối", "reject-claim") + "</div>";
    }
    const load = () => C.api("/merchant/admin/claims").then((r) => { draw(r.items || []); return "Có " + (r.items || []).length + " yêu cầu chờ duyệt."; });
    C.run(form, load);
    form.addEventListener("submit", (e) => e.preventDefault());
    form.addEventListener("click", (e) => {
      const b = e.target.closest("[data-action]");
      if (!b || !["approve-claim", "reject-claim"].includes(b.dataset.action)) return;
      const claimId = form.elements.namedItem("claim_id") && form.elements.namedItem("claim_id").value;
      if (!claimId) return;
      C.run(form, async () => {
        if (b.dataset.action === "approve-claim") {
          const r = await C.api("/merchant/admin/claims/" + encodeURIComponent(claimId) + "/approve", "POST", {});
          await load();
          return "Đã duyệt: " + (r.claim.place_name || r.claim.place_id) + " — đã cấp quyền chủ quán.";
        }
        const reason = form.elements.namedItem("reason").value.trim();
        if (reason.length < 3) throw new Error("Cần ghi lý do từ chối.");
        const r = await C.api("/merchant/admin/claims/" + encodeURIComponent(claimId) + "/reject", "POST", { reason });
        await load();
        return "Đã từ chối yêu cầu nhận " + (r.claim.place_name || r.claim.place_id) + ".";
      });
    });
  }
  window.M9FormsParts = { ...(window.M9FormsParts || {}), claims: mountClaims };
})();
