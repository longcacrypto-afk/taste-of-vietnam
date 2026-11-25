/* P2 wiring for the repo's existing designs. No replacement product shell.
 * /studio retains the unmodified design-tool behavior. On product routes, bind
 * those same screen templates/components to API data and real user actions.
 */
(function () {
  if (!["/", "/app"].includes(location.pathname)) return;
  document.body.classList.add("product-mode");
  document.title = "Hôm nay ăn gì · Taste of Vietnam";
  const H = window.escHtml,
    J = window.escJs,
    K = window.UI_KIT;
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
  const img = (el, key) => {
    if (!el) return;
    el.setAttribute("data-img", /^\d+$/.test(key || "") ? key : "298");
    el.alt = "Ảnh minh họa";
  };
  const text = (el, v) => {
    if (el) el.textContent = v ?? "";
  };
  const click = (el, code) => {
    if (el) el.setAttribute("onclick", code);
  };
  const state = {
    cache: {},
    dish: null,
    place: null,
    query: "",
    region: "",
    chat: [],
    phone: "",
    otp: "",
    order: null,
  };
  const request = window.fetch.bind(window);
  let lastButton = null,
    retryWrite = null;
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest("button,[onclick]");
      if (b && !b.closest("#p2-action-status")) lastButton = b;
    },
    true,
  );
  function status(message, retry = false) {
    let box = $("#p2-action-status");
    if (!box) {
      box = document.createElement("div");
      box.id = "p2-action-status";
      box.className = "genui-card p-3 text-xs";
      box.setAttribute("aria-live", "polite");
      document.body.append(box);
    }
    box.innerHTML = `<p>${H(message)}</p>${retry ? '<button type="button" onclick="P2.retryWrite()" class="mt-2 px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Thử lại</button>' : ""}<button type="button" onclick="this.parentElement.remove()" aria-label="Đóng thông báo" class="ml-3 p-2">Đóng</button>`;
  }
  // Preserve the P0 token wrapper. Add bounded requests and truthful HTTP errors.
  // GET auth responses remain available to the repo's login-required renderer.
  window.fetch = async function (input, init = {}) {
    const u = new URL(
      typeof input === "string" ? input : input.url,
      location.href,
    );
    if (u.origin !== location.origin || !u.pathname.startsWith("/api/v1/"))
      return request(input, init);
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000);
    const method = (init.method || "GET").toUpperCase(),
      button = method !== "GET" ? lastButton : null;
    if (button) button.disabled = true;
    try {
      const res = await request(input, {
        ...init,
        signal: init.signal || controller.signal,
      });
      const read = res.json.bind(res);
      res.json = async () => {
        if (!res.ok) {
          const e = new Error("Không tải được dữ liệu. Vui lòng thử lại.");
          e.status = res.status;
          throw e;
        }
        return read();
      };
      if (
        !res.ok &&
        method !== "GET" &&
        !u.pathname.startsWith("/api/v1/auth/")
      ) {
        const e = new Error(
          "Chưa lưu được. Kiểm tra kết nối hoặc đăng nhập rồi thử lại.",
        );
        e.status = res.status;
        throw e;
      }
      return res;
    } catch (e) {
      if (method !== "GET" && button) {
        retryWrite = () => button.click();
        status(
          "Chưa thực hiện được. Nội dung đã nhập vẫn được giữ. Kiểm tra kết quả trước khi gửi lại.",
          true,
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
      if (button) button.disabled = false;
    }
  };
  // Existing alerts are feedback, not proof of an API write. Errors have retry.
  window.alert = (message) => status(String(message));
  async function api(path, method = "GET", body) {
    const r = await fetch("/api/v1" + path, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    return r.json();
  }
  const action = async (job, done) => {
    try {
      status("Đang xử lý…");
      const d = await job();
      $("#p2-action-status")?.remove();
      await done?.(d);
    } catch (e) {
      status(
        e.status === 403
          ? "Tài khoản chưa có quyền. Hãy đăng nhập bằng số đã được cấp quyền."
          : "Chưa thực hiện được. Kiểm tra mạng hoặc phiên đăng nhập rồi thử lại.",
        true,
      );
    }
  };
  function selected() {
    return (
      state.dish || window.appState.liveToday?.items?.[0]?.dish_id || "DISH-101"
    );
  }
  function config(id) {
    if (/^M1-S(0[3-9]|10)$/.test(id))
      return ["profile", () => api("/me/profile")];
    if (["M2-S01", "M2-S02", "M2-S03"].includes(id))
      return [
        "dishes:" + state.query + ":" + state.region,
        () =>
          api(
            "/dishes?q=" +
              encodeURIComponent(state.query) +
              "&region=" +
              encodeURIComponent(state.region),
          ),
      ];
    if (/^M2-S0[4-7]$/.test(id) || ["M3-S02", "M3-S06"].includes(id))
      return [
        "dish:" + selected() + ":" + appState.servings,
        () =>
          api(
            "/dishes/" +
              encodeURIComponent(selected()) +
              "?servings=" +
              (appState.servings || 2),
          ),
      ];
    if (id === "M2-S08")
      return [
        "saved",
        async () => {
          const d = await api("/me/collections");
          const ids = [
            ...new Set((d.collections || []).flatMap((c) => c.dish_ids || [])),
          ];
          return {
            items: await Promise.all(
              ids.map((id) => api("/dishes/" + encodeURIComponent(id))),
            ),
          };
        },
      ];
    if (id === "M3-S01") return ["today", () => api("/suggestions/today")];
    if (id === "M3-S07") return ["history", () => api("/suggestions/history")];
    if (/^M[45]-/.test(id))
      return [
        "places:" + selected(),
        () => api("/places?dish_id=" + encodeURIComponent(selected())),
      ];
    if (/^M9-/.test(id))
      return [
        "admin",
        async () => {
          const d = await api("/admin/dashboard");
          return {
            ...d,
            catalog: (await api("/dishes?safe_only=false")).items || [],
          };
        },
      ];
    return null;
  }
  let originalStage = renderStage,
    originalGo = goScreen;
  function paint() {
    originalStage();
    polish($("#stage-container"));
  }
  async function load(id, force = false) {
    const cfg = config(id);
    if (!cfg) return;
    const [key, get] = cfg;
    if (!force && state.cache[key]) return;
    state.cache[key] = { status: "loading" };
    if (appState.activeScreenId === id) paint();
    try {
      const data = await get();
      state.cache[key] = { status: "success", data };
      if (key === "today") appState.liveToday = data;
    } catch (e) {
      state.cache[key] = { status: "error", error: e };
    }
    if (config(appState.activeScreenId)?.[0] === key) paint();
  }
  function stateHtml(id, s) {
    return `<div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">${K.mobileHeader(ALL_SCREENS[id].title.replace(/\([^)]*\)/g, ""), "", "M3-S01")}<div class="p-5 rounded-3xl bg-[#F8FAFC] border border-[#E2E8F0] text-center space-y-3" role="${s === "loading" ? "status" : "alert"}">${K.mascotSVG("mam", "w-20 h-24 mx-auto")}<div class="font-extrabold">${s === "loading" ? "Đang tải…" : s === "empty" ? "Chưa có kết quả phù hợp" : "Chưa tải được. Kiểm tra mạng hoặc đăng nhập rồi thử lại."}</div>${s === "loading" ? "" : `<button onclick="P2.reload()" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Thử lại</button><button onclick="goScreen('M1-S01')" class="w-full py-2 rounded-full bg-white border border-[#E2E8F0]">Đăng nhập</button>`}</div></div>`;
  }
  function rows(parent, template, items, bind) {
    parent.innerHTML = "";
    items.forEach((item, i) => {
      const node = template.cloneNode(true);
      bind(node, item, i);
      parent.append(node);
    });
  }
  function clearAfter(root, count) {
    [...root.children].slice(count).forEach((n) => n.remove());
  }
  function cardFill(node, d) {
    img($("img", node), d.img_key);
    text($('b,[class*="font-extrabold"]', node), d.name || d.dish_name);
    click(node, `P2.dish('${J(d.id || d.dish_id)}')`);
  }
  function mobile(id, html, d) {
    const t = document.createElement("template");
    t.innerHTML = html;
    const root = t.content.firstElementChild;
    if (id === "M3-S01") {
      // Keep the repo's two photo cards + horizontal sponsored card intact.
      const items = d.items || [];
      if (!items.length) return stateHtml(id, "empty");
      const cards = $$(".group", root);
      cards.forEach((node, i) => {
        const a = items[i];
        if (!a) {
          node.remove();
          return;
        }
        img($("img", node), a.img_key);
        $$('[onclick*="M2-S04"]', node).forEach((n) =>
          click(n, `P2.dish('${J(a.dish_id)}')`),
        );
        const heart = $("span.absolute", node);
        if (heart) click(heart, `P2.save('${J(a.dish_id)}')`);
      });
      const third = $('[onclick*="M4-S03"]', root);
      if (third) {
        const a = items[2];
        if (!a) third.remove();
        else {
          img($("img", third), a.img_key);
          click(third, `P2.dish('${J(a.dish_id)}','M4-S01')`);
        }
      }
      text(
        $("div.text-lg > span", root),
        state.cache.profile?.data?.name || "Bạn",
      );
    }
    if (["M2-S01", "M2-S02", "M2-S08"].includes(id)) {
      const items = d.items || [];
      if (id === "M2-S01") {
        const featured = $('[onclick*="M2-S04"]', root),
          small = $(".grid.grid-cols-2", root),
          tpl = small?.firstElementChild?.cloneNode(true);
        if (!items.length) return stateHtml(id, "empty");
        cardFill(featured, items[0]);
        text($("b.text-sm", featured), items[0].name);
        text($('b[class*="D97736"]', featured), money(items[0].ref_price));
        if (small && tpl)
          rows(small, tpl, items.slice(1), (n, a) => {
            cardFill(n, a);
            text(
              $("div.text-\\[10px\\]", n),
              money(a.ref_price) + " · " + a.calories + " kcal",
            );
          });
      }
      if (id === "M2-S02") {
        const bar = root.children[1];
        bar.innerHTML = `<form onsubmit="event.preventDefault();P2.search(this.query.value)" class="flex gap-2 w-full"><label for="p2-search" class="sr-only">Tìm món</label><input id="p2-search" name="query" value="${H(state.query)}" class="bg-transparent min-w-0 flex-1" placeholder="Tìm món, nguyên liệu…"><button class="font-extrabold">Tìm</button></form>`;
        root.children[2].remove();
        const tpl = $('[onclick*="M2-S04"]', root);
        if (tpl) {
          const holder = document.createElement("div");
          holder.className = "space-y-2";
          tpl.replaceWith(holder);
          if (!items.length) holder.innerHTML = stateHtml(id, "empty");
          else
            rows(holder, tpl, items, (n, a) => {
              cardFill(n, a);
              text($(".font-extrabold.text-sm", n), a.name);
              text($(".text-\\[10px\\]", n), a.calories + " kcal");
              text($('[class*="D97736"]', n), money(a.ref_price));
            });
        }
      }
      if (id === "M2-S08") {
        const grid = $(".grid", root),
          tpl = grid.firstElementChild.cloneNode(true);
        if (!items.length) grid.outerHTML = stateHtml(id, "empty");
        else
          rows(grid, tpl, items, (n, a) => {
            cardFill(n, a);
            text($(".font-extrabold", n), a.name);
            $$("span", n).forEach((x) => {
              if (x.textContent.includes("món")) x.remove();
            });
          });
      }
    }
    if (id === "M2-S03") {
      const all = d.items || [];
      $$("[onclick]", root).forEach((n, i) => {
        const reg = ["bac", "trung", "nam"][i];
        click(n, `P2.region('${reg}')`);
        const pill = $("span", n);
        text(pill, all.filter((a) => a.region === reg).length + " món");
      });
    }
    if (/^M2-S0[4-7]$/.test(id) || id === "M3-S02") {
      const title = $("h3", root);
      text(title, d.name);
      const hero = $("img", root);
      img(hero, d.img_key);
      if (id === "M2-S04") {
        text(
          $("p.text-\\[11px\\]", root),
          d.description || "Chưa có mô tả món.",
        );
        const meta = $(".grid-cols-3", root);
        if (meta) {
          meta.children[0].innerHTML = `<div><b>${H(d.prep_minutes || "—")} phút</b><div class="text-[9px] text-[#64748B]">Thời gian nấu</div></div>`;
          text(
            $(".font-extrabold", meta.children[2]),
            (d.scaled_calories_total ?? d.calories ?? "—") + " kcal",
          );
        }
        const ingredients = $(".grid-cols-4", root);
        if (ingredients) {
          const tpl = ingredients.firstElementChild.cloneNode(true);
          rows(
            ingredients,
            tpl,
            (d.scaled_ingredients || []).slice(0, 4),
            (n, a) => {
              img($("img", n), a.img_key);
              text($(".font-extrabold", n), a.name);
              text(
                $(".text-\\[9px\\]", n),
                (a.scaled_amount ?? a.amount) + " " + a.unit,
              );
            },
          );
        }
        const step = $('[onclick*="M2-S07"].cursor-pointer', root);
        if (step) {
          const a = (d.steps || [])[0];
          if (a) {
            text($(".font-extrabold", step), a.title);
            text($("p", step), a.text);
            img($("img", step), d.img_key);
          } else step.innerHTML = "<p>Chưa có cách nấu cho món này.</p>";
        }
        $$("button", root).forEach((b) => {
          if (
            b.innerHTML.includes("bookmark") ||
            b.querySelector("svg")?.outerHTML.includes("M19 21l-7")
          )
            click(b, `P2.save('${J(d.id)}')`);
        });
        const heart = $("button.hover\\:text-\\[\\#EF4444\\]", root);
        if (heart) click(heart, `P2.save('${J(d.id)}')`);
      }
      if (id === "M2-S05") {
        text($(".text-2xl", root), d.calories ?? "—");
        const vals = $$(".grid-cols-3 b", root);
        [d.macros?.carbs, d.macros?.protein, d.macros?.fat].forEach((v, i) =>
          text(vals[i], v == null ? "Chưa rõ" : v + "g"),
        );
        const macro = $(".text-\\[9px\\].font-bold", root);
        text(macro, "Ước tính theo dữ liệu món");
      }
      if (id === "M2-S06") {
        const grid = $(".grid-cols-2", root),
          tpl = grid.firstElementChild.cloneNode(true);
        rows(grid, tpl, d.scaled_ingredients || [], (n, a) => {
          img($("img", n), a.img_key);
          text($("b", n), a.name);
          text(
            $(".font-extrabold", n),
            (a.scaled_amount ?? a.amount) + " " + a.unit,
          );
        });
        text($("b", root), money(d.scaled_market_cost_vnd));
      }
      if (id === "M2-S07") {
        const holder = root.children[2],
          tpl = holder.firstElementChild.cloneNode(true);
        rows(holder, tpl, d.steps || [], (n, a, i) => {
          text($("span", n), i + 1);
          text($(".font-extrabold", n), a.title);
          text($("p", n), a.text);
          img($("img", n), d.img_key);
          $$("span", n)
            .slice(1)
            .forEach((x) => {
              if (x.textContent.includes("Đang đếm"))
                text(x, (a.duration_min || 0) + " phút");
            });
        });
        click(root.lastElementChild, `P2.feedback('eaten')`);
      }
      if (id === "M3-S02") {
        const photo = $("img", root)?.parentElement;
        text($("b", photo), d.name);
        text($('b[class*="D97736"]', photo), money(d.ref_price));
      }
    }
    if (id === "M3-S04" || id === "M3-S05") {
      const list = $$(".space-y-2", root).find(
        (n) => n.querySelectorAll(':scope > [onclick*="M2-S04"]').length >= 2,
      );
      if (list) {
        const tpl = list.firstElementChild.cloneNode(true);
        if (!state.chat.length)
          list.innerHTML =
            '<p class="p-3 text-[#64748B]">Chưa có đề xuất. Hãy hỏi Măm về bữa ăn của bạn.</p>';
        else
          rows(list, tpl, state.chat, (n, a) => {
            cardFill(n, a);
            text($(".font-extrabold", n), a.dish_name || a.name);
            text($(".text-\\[10px\\]", n), a.explanation || "");
          });
      }
    }
    if (id === "M3-S03") {
      text(
        $("#m3-spin-title", root),
        state.spin?.name || "Bấm quay để chọn một món",
      );
      text(
        $("#m3-spin-sub", root),
        state.spin
          ? "Xem công thức hoặc quán bán món này."
          : "Chưa chọn món nào.",
      );
    }
    if (id === "M3-S06") {
      $$("button", root)
        .slice(-3)
        .forEach((b, i) =>
          click(b, `P2.feedback('${["eaten", "liked", "skipped"][i]}')`),
        );
    }
    if (id === "M3-S07") {
      const tpl = root.children[1].cloneNode(true);
      clearAfter(root, 1);
      if (!(d.items || []).length)
        root.insertAdjacentHTML(
          "beforeend",
          '<p class="p-4 text-[#64748B]">Chưa có bữa ăn trong lịch sử.</p>',
        );
      else
        (d.items || []).forEach((a) => {
          const n = tpl.cloneNode(true);
          text($(".font-extrabold", n), a.dish_name);
          text(
            $(".text-\\[10px\\]", n),
            new Date(a.created_at).toLocaleDateString("vi-VN"),
          );
          root.append(n);
        });
    }
    if (/^M4-/.test(id) || /^M5-/.test(id)) bindPlaces(root, id, d.items || []);
    if (/^M1-/.test(id)) bindProfile(root, id, d || {});
    if (/^M9-/.test(id)) return adminHtml(id, d);
    return root.outerHTML;
  }
  function bindProfile(root, id, p) {
    if (id === "M1-S01") {
      const phone = $("input", root);
      phone.removeAttribute("readonly");
      phone.type = "tel";
      phone.value = state.phone;
      phone.placeholder = "0912 345 678";
      phone.setAttribute("aria-label", "Số điện thoại");
      click($('[onclick*="M1-S02"]', root), "P2.requestOtp()");
      $$('[onclick*="M1-S03"]', root).forEach((b) => {
        b.disabled = true;
        b.title = "Chưa được cấu hình";
      });
    }
    if (id === "M1-S02") {
      const grid = $(".grid-cols-6", root);
      grid.innerHTML = Array.from(
        { length: 6 },
        (_, i) =>
          `<input aria-label="Chữ số ${i + 1} của mã OTP" inputmode="numeric" pattern="[0-9]" maxlength="1" value="${H(state.otp[i] || "")}" class="min-w-0 h-12 rounded-2xl bg-[#F8FAFC] border-2 border-[#E2E8F0] text-center font-extrabold" oninput="if(this.value&&this.nextElementSibling)this.nextElementSibling.focus()">`,
      ).join("");
      click($('[onclick*="M1-S03"]', root), "P2.verifyOtp()");
      const resend = $("span.font-extrabold", root);
      if (resend) {
        resend.outerHTML =
          '<button onclick="P2.requestOtp(true)" class="font-extrabold text-[#B45309]">Gửi lại SMS</button>';
      }
    }
    const choices = (holder, values, key, multi = false) => {
      if (!holder) return;
      [...holder.children].forEach((n, i) => {
        const value = values[i];
        n.querySelectorAll("span").forEach((s) => {
          if (/Đã chọn|Đang chọn|🚫|^\+$/.test(s.textContent.trim()))
            s.remove();
        });
        n.innerHTML = n.innerHTML.replace(/ ✓/g, "");
        click(n, `P2.choose('${key}',${JSON.stringify(value)},${multi})`);
        n.setAttribute(
          "aria-pressed",
          String(multi ? (p[key] || []).includes(value) : p[key] === value),
        );
        n.style.border =
          n.getAttribute("aria-pressed") === "true"
            ? "2px solid #FBBF24"
            : "1px solid #E2E8F0";
      });
    };
    if (id === "M1-S03")
      choices(root.children[2], ["bac", "trung", "nam"], "regions", true);
    if (id === "M1-S04") choices(root.children[2], [0, 1, 2, 3], "spice_level");
    if (id === "M1-S05")
      choices(
        $(".grid-cols-2", root),
        ["shrimp", "peanut", "milk", "gluten", "egg", "soy"],
        "hard_allergies",
        true,
      );
    if (id === "M1-S06")
      choices(
        $(".grid-cols-3", root),
        [
          "balanced",
          "vegetarian",
          "eat_clean",
          "high_protein",
          "low_fat",
          "low_carb",
        ],
        "diet_mode",
      );
    if (id === "M1-S07") {
      const holder = root.children[2];
      [...holder.children].forEach((n, i) => {
        click(n, `P2.budget(${i})`);
        n.style.border =
          i === (p.budget_max <= 35000 ? 0 : p.budget_max <= 65000 ? 1 : 2)
            ? "2px solid #FBBF24"
            : "1px solid #E2E8F0";
      });
    }
    const next = {
      "M1-S03": "M1-S04",
      "M1-S04": "M1-S05",
      "M1-S05": "M1-S06",
      "M1-S06": "M1-S07",
      "M1-S07": "M1-S08",
    }[id];
    if (next) click(root.lastElementChild, `P2.saveProfile('${next}')`);
    if (id === "M1-S08") {
      const buttons = $$("button", root).filter((b) =>
        (b.getAttribute("onclick") || "").includes("M3-S01"),
      );
      buttons.forEach((b, i) => {
        if (i === 0) click(b, "P2.locate()");
        else if (i === 1) {
          click(b, "P2.saveProfile('M3-S01')");
          text($("span", b), "Dùng vị trí đang lưu");
        } else {
          b.disabled = true;
          b.title = "Khu vực này chưa có dữ liệu quán";
        }
      });
    }
    if (id === "M1-S09") {
      text($(".text-base.font-extrabold", root), p.name || "Bạn");
      const summary = $(".text-\\[10px\\].text-gray-300", root);
      text(
        summary,
        "Ngân sách " + money(p.budget_min) + " – " + money(p.budget_max),
      );
      const tags = $$(".grid-cols-2 b", root);
      text(tags[0], (p.hard_allergies || []).join(", ") || "Chưa chọn dị ứng");
      text(tags[1], "Mức cay " + p.spice_level + " · " + p.diet_mode);
      const banner = $(".bg-\\[\\#18181B\\] span", root);
      if (banner && banner.textContent.includes("94%"))
        text(banner, "Khẩu vị đã lưu");
      const edit = document.createElement("button");
      edit.className =
        "w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold";
      edit.textContent = "Chỉnh sửa khẩu vị";
      click(edit, "goScreen('M1-S03')");
      root.insertBefore(edit, root.lastElementChild);
      const login = document.createElement("button");
      login.className = "w-full py-2 rounded-full bg-[#F8FAFC] font-bold";
      login.textContent = "Đăng nhập / Quản trị";
      click(login, "goScreen('M1-S01')");
      root.append(login);
    }
    if (id === "M1-S10") {
      const download = $$("span", root).find(
        (n) => n.textContent.trim() === "Tải về",
      );
      if (download)
        download.outerHTML =
          '<button onclick="P2.exportData()" class="font-bold text-[#1D4ED8]">Tải về</button>';
      click(root.lastElementChild, "P2.deleteAccount()");
      $$('[onclick*="M8-"]', root).forEach((n) =>
        n.closest("div.flex")?.remove(),
      );
    }
  }
  function bindPlaces(root, id, items) {
    const place = items.find((p) => p.id === state.place) || items[0];
    if (!place) {
      clearAfter(root, 1);
      root.insertAdjacentHTML("beforeend", stateHtml(id, "empty"));
      return;
    }
    if (id === "M4-S01") {
      const tile = $('[onclick*="M4-S03"]', root),
        holder = document.createElement("div");
      holder.className = "space-y-3";
      tile.replaceWith(holder);
      rows(holder, tile, items, (n, p) => {
        img($("img", n), p.img_key);
        text($(".font-extrabold", n), p.name);
        text(
          $(".text-\\[10px\\]", n),
          Math.round(p.distance_m) +
            "m · " +
            (p.is_currently_open ? "Đang mở" : "Hỏi quán để xác nhận"),
        );
        text(
          $('[class*="D97736"]', n),
          money(p.menu?.find((m) => m.dish_id === selected())?.price),
        );
        click(n, `P2.place('${J(p.id)}')`);
      });
      const filters = $(".overflow-x-auto", root);
      if (filters)
        filters.textContent = items.length + " quán theo vị trí đã lưu";
    }
    if (id === "M4-S02") {
      const pins = $$("button.absolute", root);
      pins.forEach((n, i) => {
        if (!items[i]) n.remove();
        else {
          text(
            n,
            items[i].name + " · " + Math.round(items[i].distance_m) + "m",
          );
          click(n, `P2.place('${J(items[i].id)}')`);
        }
      });
      const note = document.createElement("p");
      note.className = "text-[10px] text-[#64748B]";
      note.textContent =
        "Nền bản đồ minh họa. Chọn chỉ đường để mở vị trí thật trên bản đồ.";
      root.append(note);
    }
    if (id === "M4-S03") {
      img($("img", root), place.img_key);
      text($("h3", root), place.name);
      text(
        $("p", root),
        place.address + " · " + Math.round(place.distance_m) + "m",
      );
      const badges = $$(".space-y-2 > .flex span", root);
      text(
        badges[0],
        place.is_currently_open ? "Đang mở theo dữ liệu" : "Hãy gọi xác nhận",
      );
    }
    if (id === "M4-S04" || id === "M4-S05") {
      const tpl = root.children[1].cloneNode(true);
      clearAfter(root, 1);
      (place.menu || []).forEach((m) => {
        const n = tpl.cloneNode(true);
        text($(".font-extrabold", n), m.name || m.dish_id);
        text($('[class*="D97736"]', n), money(m.price));
        click(n, `P2.dish('${J(m.dish_id)}','M5-S01')`);
        if (!m.available) {
          n.setAttribute("aria-disabled", "true");
          n.removeAttribute("onclick");
        }
        root.append(n);
      });
      if (!(place.menu || []).length)
        root.insertAdjacentHTML("beforeend", "<p>Chưa có thực đơn.</p>");
    }
    if (id === "M4-S06") click(root.lastElementChild, "P2.report()");
    if (id === "M5-S01") {
      const b = $$('[onclick*="M5-S03"]', root)[0];
      if (b)
        text(b, "Chỉ đường đến quán (" + Math.round(place.distance_m) + "m)");
    }
    if (id === "M5-S02") {
      $$('[onclick*="M5-S05"]', root).forEach((n) => {
        const name = $("b", n)?.textContent || "";
        const partner =
          name === "GrabFood"
            ? "grabfood"
            : name === "ShopeeFood"
              ? "shopeefood"
              : null;
        if (!partner || !place.links?.[partner]) n.remove();
        else {
          click(n, `P2.order('${partner}')`);
          text(
            $(".text-\\[10px\\]", n),
            "Giá và phí giao hàng do đối tác xác nhận",
          );
        }
      });
    }
    if (id === "M5-S03") {
      $$("button", root)
        .slice(-2)
        .forEach((b) => click(b, "P2.order('maps')"));
    }
    if (id === "M5-S04") {
      text($(".text-sm.font-extrabold", root), place.name);
      text($(".font-mono", root), place.phone || "Chưa có số điện thoại");
      const b = root.lastElementChild?.querySelector("button");
      if (b) {
        b.disabled = !place.phone;
        click(b, "P2.call()");
      }
    }
    if (id === "M5-S05") {
      const a = document.createElement("a"),
        url = state.order?.target_deeplink;
      try {
        const u = new URL(url);
        if (["https:", "tel:"].includes(u.protocol)) {
          a.href = u.href;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.className =
            "block py-3 rounded-full bg-[#18181B] text-white font-extrabold";
          a.textContent = "Tiếp tục sang dịch vụ bên ngoài";
          root.insertBefore(a, root.lastElementChild);
        }
      } catch {}
      click(root.lastElementChild, "P2.confirmMeal()");
    }
  }
  function adminHtml(id, d) {
    const row = (a) =>
      `<div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">${a}</div>`;
    const button = (label, code) =>
      `<button onclick="${code}" class="px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">${label}</button>`;
    let body = "";
    if (id === "M9-S01")
      body = `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">${row(button("Quản lý món", "goScreen('M9-S02')"))}${row(button("Duyệt thực đơn", "goScreen('M9-S05')"))}${row(button("Báo cáo quán", "goScreen('M9-S06')"))}</div>`;
    if (id === "M9-S02")
      body =
        (d.catalog || [])
          .map((a) =>
            row(
              `<div><b>${H(a.name)}</b><p>${money(a.ref_price)}</p></div>${button("Sửa", `P2.edit('${J(a.id)}')`)}`,
            ),
          )
          .join("") + button("Thêm món mới", "P2.edit('')");
    if (id === "M9-S03") {
      const a = (d.catalog || []).find((a) => a.id === state.edit) || {};
      body = `<form onsubmit="event.preventDefault();P2.saveDish(this)" class="p-4 bg-white rounded-2xl border border-[#E2E8F0] space-y-3">${[
        ["name", "Tên món", a.name || ""],
        ["ref_price", "Giá tham khảo (đ)", a.ref_price || 0],
        ["calories", "Năng lượng (kcal)", a.calories || 0],
      ]
        .map(
          ([key, label, v]) =>
            `<label class="block font-bold">${label}<input required name="${key}" value="${H(v)}" class="block w-full p-3 mt-1 rounded-2xl border border-[#E2E8F0]"></label>`,
        )
        .join(
          "",
        )}${button("Lưu món", "")}${a.id ? button("Xóa món", `P2.deleteDish('${J(a.id)}')`) : ""}</form>`;
    }
    if (id === "M9-S05")
      body =
        (d.ocr_queue || [])
          .filter((a) => a.status === "pending_review")
          .map((a) =>
            row(
              `<div><b>${H(a.extracted_name)}</b><p>${H(a.place_name)} · ${money(a.extracted_price)}</p></div><div>${button("Duyệt", `P2.review('${J(a.id)}','approved')`)} ${button("Từ chối", `P2.review('${J(a.id)}','rejected')`)}</div>`,
            ),
          )
          .join("") || "<p>Không có thực đơn cần kiểm tra.</p>";
    if (id === "M9-S04" || id === "M9-S06")
      body =
        (d.user_reports || [])
          .map((a) =>
            row(
              `<div><b>${H(a.place_name)}</b><p>${H(a.reason)}</p></div>${button("Xác nhận quán mở lại", `P2.unpause('${J(a.place_id)}')`)}`,
            ),
          )
          .join("") || "<p>Không có báo cáo cần xử lý.</p>";
    if (!body)
      body =
        '<p class="p-4">Mục này chưa nằm trong luồng quản trị đang hoàn thiện. Chọn quản lý món, duyệt thực đơn hoặc báo cáo quán.</p>';
    return K.adminShell(
      id,
      "Quản trị nội dung",
      "Món ăn và quán trong dữ liệu hiện có",
      [
        {
          label: "Món trong thư viện",
          value: d.total_dishes ?? 0,
          delta: "",
          icon: "utensils",
          bg: "bg-[#FEF3C7] text-[#B45309]",
        },
        {
          label: "Quán xác thực",
          value: d.total_verified_places ?? 0,
          delta: "",
          icon: "store",
          bg: "bg-[#DCFCE7] text-[#15803D]",
        },
      ],
      body,
    );
  }
  function polish(root = document) {
    if (!root) return;
    // Only presented product text is cleaned; Studio templates retain their specs.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement?.closest("script,style,svg")
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    let n;
    while ((n = walker.nextNode())) {
      n.textContent = n.textContent
        .replace(/\(?M\d{1,2}[-–]S\d{2}\)?\s*[·→]?/g, "")
        .replace(/\(M\d+(?:[–-]M?\d+)?\)/g, "")
        .replace(
          /\bPostGIS\b|\bAnti-Fraud Active\b|\bGemini Active\b|\bv0\.\d+\b/g,
          "",
        )
        .replace(
          /542 món|500\+ món|Bảo mật 2 lớp|Hoàn tất trong 38 giây!|\(Guest Mode\)/g,
          "",
        )
        .replace(/Chào anh Long/g, "Chào bạn")
        .replace(/AI Powered/g, "Gợi ý bữa ăn");
    }
    $$("img", root).forEach((i) => {
      if (!i.hasAttribute("alt")) i.alt = "Ảnh minh họa";
      if (!i.src && i.dataset.img && window.CHATGPT_IMAGES?.[i.dataset.img])
        i.src = window.CHATGPT_IMAGES[i.dataset.img];
    });
    $$("input,textarea,select", root).forEach((el, i) => {
      if (!el.labels?.length && !el.getAttribute("aria-label"))
        el.setAttribute(
          "aria-label",
          el.placeholder ||
            {
              tel: "Số điện thoại",
              number: "Số lượng",
              range: "Mức tùy chọn",
              checkbox: "Bật tùy chọn",
            }[el.type] ||
            el.id ||
            "Thông tin " + (i + 1),
        );
    });
    $$("[onclick]:not(button):not(a):not(input)", root).forEach((el) => {
      if (el.closest("svg") || el.querySelector("button,a,input")) return;
      const b = document.createElement("button");
      for (const a of el.attributes) b.setAttribute(a.name, a.value);
      b.type = "button";
      b.style.textAlign = "inherit";
      if (el.tagName === "DIV") b.style.width = "100%";
      b.innerHTML = el.innerHTML;
      el.replaceWith(b);
    });
    $$("button", root).forEach((b) => {
      if (!b.getAttribute("type")) b.type = "button";
      if (!(b.textContent.trim() || b.getAttribute("aria-label"))) {
        const code = b.getAttribute("onclick") || "";
        b.setAttribute(
          "aria-label",
          b.title ||
            (/M3-S01/.test(code)
              ? "Về trang chủ"
              : /M1-S09/.test(code)
                ? "Hồ sơ khẩu vị"
                : /M2-S08|P2.save/.test(code)
                  ? "Lưu món"
                  : "Mở tùy chọn"),
        );
      }
    });
    // Native submit buttons on forms need to keep their submission behavior.
    $$("form", root).forEach((f) => {
      const submit = $('button:not([onclick]),button[onclick=""]', f);
      if (submit) submit.type = "submit";
    });
    hydrateImages(root);
  }
  window.P2 = {
    state,
    retryWrite() {
      retryWrite?.();
    },
    reload() {
      load(appState.activeScreenId, true);
    },
    dish(id, target = "M2-S04") {
      state.dish = id;
      state.place = null;
      appState.servings = 2;
      goScreen(target);
    },
    place(id) {
      state.place = id;
      goScreen("M4-S03");
    },
    search(q) {
      state.query = q;
      goScreen("M2-S02");
      load("M2-S02", true);
    },
    region(reg) {
      state.region = reg;
      state.query = "";
      goScreen("M2-S01");
    },
    choose(key, value, multi) {
      const p = state.cache.profile.data;
      if (multi) {
        const a = p[key] || [];
        p[key] = a.includes(value)
          ? a.filter((v) => v !== value)
          : [...a, value];
      } else p[key] = value;
      paint();
    },
    budget(i) {
      const p = state.cache.profile.data;
      [p.budget_min, p.budget_max] = [
        [0, 35000],
        [35000, 65000],
        [60000, 120000],
      ][i];
      paint();
    },
    saveProfile(next) {
      action(
        () => api("/me/profile", "PATCH", state.cache.profile.data),
        (p) => {
          state.cache.profile = { status: "success", data: p };
          delete state.cache.today;
          goScreen(next);
        },
      );
    },
    locate() {
      if (!navigator.geolocation)
        return status(
          "Trình duyệt không hỗ trợ định vị. Bạn vẫn có thể dùng vị trí đã lưu.",
        );
      status("Đang xin quyền định vị…");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          Object.assign(state.cache.profile.data, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          P2.saveProfile("M3-S01");
        },
        () =>
          status(
            "Chưa lấy được vị trí. Kiểm tra quyền trình duyệt hoặc dùng vị trí đang lưu.",
            true,
          ),
        { timeout: 10000 },
      );
    },
    requestOtp(resend = false) {
      state.phone = resend
        ? state.phone
        : $("#stage-container input[type=tel]")?.value.trim();
      action(
        async () => {
          const r = await TOV_AUTH.requestOtp(state.phone);
          if (!r.ok)
            throw Object.assign(new Error("Không gửi được mã"), {
              status: r.status,
            });
          return r.data;
        },
        (d) => {
          state.otp = d.dev_code || "";
          goScreen("M1-S02");
          if (d.dev_code) status("Máy phát triển: mã thử đã được điền sẵn.");
        },
      );
    },
    verifyOtp() {
      const code = $$("#stage-container .grid-cols-6 input")
        .map((i) => i.value)
        .join("");
      action(
        async () => {
          const r = await TOV_AUTH.verifyOtp(state.phone, code);
          if (!r.ok)
            throw Object.assign(new Error("Mã không đúng"), {
              status: r.status,
            });
          return r.data;
        },
        (r) => {
          state.cache = {};
          goScreen(r.role === "admin" ? "M9-S01" : "M1-S03");
        },
      );
    },
    save(id = selected()) {
      action(
        () => api("/me/collections", "POST", { dish_id: id }),
        () => {
          delete state.cache.saved;
          status("Đã lưu món vào bộ sưu tập.");
        },
      );
    },
    feedback(type, id = selected()) {
      action(
        () =>
          api("/suggestions/feedback", "POST", { dish_id: id, action: type }),
        () => {
          delete state.cache.history;
          delete state.cache.today;
          goScreen("M3-S07");
        },
      );
    },
    report() {
      if (!confirm("Xác nhận gửi báo cáo về quán này?")) return;
      const p =
        state.cache["places:" + selected()]?.data.items.find(
          (p) => p.id === state.place,
        ) || state.cache["places:" + selected()]?.data.items[0];
      const reason =
        $(
          "#stage-container input[name=r]:checked",
        )?.parentElement.textContent.trim() || "Quán đóng cửa";
      action(
        () =>
          api("/places/" + encodeURIComponent(p.id) + "/reports", "POST", {
            reason,
          }),
        () => status("Đã gửi báo cáo. Cảm ơn bạn!"),
      );
    },
    order(partner) {
      const items = state.cache["places:" + selected()]?.data.items || [],
        p = items.find((p) => p.id === state.place) || items[0];
      if (!p) return status("Chưa chọn được quán.");
      action(
        () =>
          api("/orders/redirect", "POST", {
            dish_id: selected(),
            place_id: p.id,
            partner,
          }),
        (d) => {
          state.order = d;
          goScreen("M5-S05");
        },
      );
    },
    call() {
      const items = state.cache["places:" + selected()]?.data.items || [],
        p = items.find((p) => p.id === state.place) || items[0];
      if (!/^\+?[\d\s-]+$/.test(p?.phone || ""))
        return status("Chưa có số điện thoại hợp lệ.");
      state.order = {
        target_deeplink: "tel:" + p.phone.replace(/\s/g, ""),
        dish_id: selected(),
        place_id: p.id,
      };
      goScreen("M5-S05");
    },
    confirmMeal() {
      if (state.order?.id)
        action(
          () =>
            api(
              "/orders/" +
                encodeURIComponent(state.order.id) +
                "/confirm-eaten",
              "POST",
              {},
            ),
          () => {
            delete state.cache.history;
            delete state.cache.today;
            goScreen("M3-S07");
          },
        );
      else P2.feedback("eaten");
    },
    exportData() {
      action(
        () => api("/me/export"),
        (d) => {
          const u = URL.createObjectURL(
              new Blob([JSON.stringify(d, null, 2)], {
                type: "application/json",
              }),
            ),
            a = document.createElement("a");
          a.href = u;
          a.download = "du-lieu-ca-nhan.json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(u), 1000);
          status("Đã tải dữ liệu cá nhân.");
        },
      );
    },
    deleteAccount() {
      if (confirm("Xóa vĩnh viễn tài khoản và dữ liệu? Không thể hoàn tác."))
        action(
          () => api("/me", "DELETE"),
          () => {
            TOV_AUTH.logout();
            state.cache = {};
            goScreen("M1-S01");
            status("Đã xóa tài khoản.");
          },
        );
    },
    edit(id) {
      state.edit = id;
      goScreen("M9-S03");
    },
    saveDish(form) {
      const f = new FormData(form),
        payload = Object.fromEntries(f);
      action(
        () =>
          api(
            "/admin/dishes" +
              (state.edit ? "/" + encodeURIComponent(state.edit) : ""),
            state.edit ? "PATCH" : "POST",
            payload,
          ),
        () => {
          delete state.cache.admin;
          goScreen("M9-S02");
        },
      );
    },
    deleteDish(id) {
      if (confirm("Xóa món này khỏi thư viện?"))
        action(
          () => api("/admin/dishes/" + encodeURIComponent(id), "DELETE"),
          () => {
            delete state.cache.admin;
            goScreen("M9-S02");
          },
        );
    },
    review(id, decision) {
      action(
        () => api("/admin/ocr-review", "POST", { ocr_id: id, decision }),
        () => {
          delete state.cache.admin;
          goScreen("M9-S05");
        },
      );
    },
    unpause(id) {
      if (confirm("Bạn đã xác nhận quán mở lại?"))
        action(
          () =>
            api(
              "/admin/places/" + encodeURIComponent(id) + "/unpause",
              "POST",
              {},
            ),
          () => {
            delete state.cache.admin;
            goScreen("M9-S06");
          },
        );
    },
  };
  // Bind only core designs. The frozen modules remain byte-for-byte unchanged.
  Object.entries(ALL_SCREENS).forEach(([id, scr]) => {
    if (!/^M[1-59]-/.test(id)) return;
    const original = scr.render;
    scr.render = () => {
      const cfg = config(id),
        entry = cfg ? state.cache[cfg[0]] : null;
      if (cfg && entry?.status !== "success")
        return stateHtml(id, entry?.status || "loading");
      return mobile(id, original(), entry?.data);
    };
  });
  goScreen = function (id) {
    if (!/^M[1-59]-/.test(id))
      return status("Tính năng này chưa mở trong bản hiện tại.");
    if (id === "M9-S01" && !document.body.classList.contains("pwa-mobile-mode"))
      return setLiveAppTab("admin");
    originalGo(id);
    load(id);
    polish($("#stage-container"));
  };
  renderStage = function () {
    originalStage();
    polish($("#stage-container"));
  };
  changeServings = function (delta) {
    appState.servings = Math.max(
      1,
      Math.min(20, (appState.servings || 2) + delta),
    );
    load(appState.activeScreenId, true);
  };
  LIVE_APP.loadToday = () => load("M3-S01", true);
  LIVE_APP.markDishEaten = (id) => P2.feedback("eaten", id);
  LIVE_APP.sendMamChat = async function (prefill) {
    const q = (prefill || $("#mam-chat-inp")?.value || "").trim();
    if (!q) return;
    appState.liveChatQuery = q;
    appState.liveChatReply = "Đang tìm món phù hợp…";
    state.chat = [];
    paint();
    try {
      const d = await api("/chat", "POST", { query: q });
      appState.liveChatReply =
        d.assistant_message || "Chưa có câu trả lời. Hãy thử mô tả rõ hơn.";
      state.chat = d.options || [];
      appState.liveChatOptions = state.chat;
    } catch (e) {
      appState.liveChatReply =
        "Chưa gửi được câu hỏi. Kiểm tra mạng rồi thử lại.";
      retryWrite = () => LIVE_APP.sendMamChat(q);
      status(appState.liveChatReply, true);
    }
    if (appState.activeScreenId === "M3-S04") paint();
  };
  spinM3Wheel = () =>
    action(
      () => api("/suggestions/spin"),
      (d) => {
        state.spin = d.picked_dish;
        state.dish = d.picked_dish?.id;
        paint();
        const wheel = $("#m3-wheel-svg");
        if (wheel) wheel.classList.add("wheel-spinning");
      },
    );
  // Remove design-tool and frozen-module entry points, not the original app UI.
  document.querySelector("body > header")?.remove();
  $("#main-chatgpt")?.remove();
  $("#main-screens aside")?.remove();
  $("#main-screens section > .genui-card:first-child")?.remove();
  $("#pwa-drawer-btn")?.remove();
  const allowed = [
    "today",
    "explore",
    "recipe",
    "chat",
    "wheel",
    "places",
    "admin",
    "profile",
  ];
  $$("[id^=ltab-]").forEach((n) => {
    if (!allowed.includes(n.id.slice(5))) n.remove();
  });
  $$("[id^=lpanel-]").forEach((n) => {
    if (!allowed.includes(n.id.slice(7))) n.remove();
  });
  $$("[data-ai-badge]").forEach((n) => n.remove());
  const style = document.createElement("style");
  style.textContent = `.product-mode #p2-action-status{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:100;max-width:calc(100vw - 24px);width:420px;box-shadow:0 8px 30px #0003}.product-mode :focus-visible{outline:3px solid #B45309;outline-offset:3px}.product-mode input{min-width:0}.product-mode [onclick]{touch-action:manipulation}.product-mode .phone-frame .flex-1{min-width:0}.product-mode .phone-frame button{white-space:normal}.product-mode .phone-frame{overflow:hidden}.product-mode #main-liveapp{min-width:0}.product-mode [data-p2-layout]{min-width:0}@media(max-width:768px){.product-mode #stage-container .min-w-\\[1100px\\],.product-mode #stage-container .min-w-\\[1000px\\]{min-width:0!important}.product-mode #stage-container table{display:block;max-width:100%;overflow:auto}.product-mode #stage-container aside{display:none}.product-mode #stage-container .grid-cols-4{grid-template-columns:repeat(2,minmax(0,1fr))}.product-mode #stage-container .w-64{width:auto}.product-mode #stage-container .min-w-0{max-width:100%}}`;
  document.head.append(style);
  polish(document.body);
  // Existing dynamic live panels retain their original functions and markup.
  const observed = $("#main-liveapp");
  if (observed) {
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        observer.disconnect();
        polish(observed);
        observer.observe(observed, { childList: true, subtree: true });
      });
    });
    observer.observe(observed, { childList: true, subtree: true });
  }
  load("M1-S09");
  load(appState.activeScreenId);
  window.P2.polish = polish;
})();
