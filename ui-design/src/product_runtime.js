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
  window.M9_AUTH_FETCH = request;
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
    retryWrite = () => action(job, done);
    try {
      status("Đang xử lý…");
      const d = await job();
      $("#p2-action-status")?.remove();
      await done?.(d);
    } catch (e) {
      if(e.status===409) {
        // Reuse the existing retry control to reload, never replay a stale version.
        retryWrite=()=>{$("#p2-action-status")?.remove();P2.reload();};
        status("Bản này đã thay đổi hoặc được xử lý. Bấm Thử lại để tải dữ liệu mới.",true);
        return;
      }
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
              (state.region ? "&region=" + encodeURIComponent(state.region) : ""),
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
          const [d, identity] = await Promise.all([api("/admin/dashboard"), api("/auth/me")]);
          return {
            ...d,
            catalog: d.catalog || [],
            actor_role: identity.role,
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
      if (!data || typeof data !== "object" ||
          (/^(dishes:|places:|today$|saved$|history$)/.test(key) && !Array.isArray(data.items)) ||
          (key.startsWith("dish:") && !data.id) ||
          (key === "admin" && !Array.isArray(data.ocr_queue)))
        throw new Error("Dữ liệu chưa hợp lệ. Vui lòng thử lại.");
      state.cache[key] = { status: "success", data };
      if (key === "today") appState.liveToday = data;
    } catch (e) {
      state.cache[key] = { status: "error", error: e };
    }
    if (config(appState.activeScreenId)?.[0] === key) paint();
  }
  const originals = {};
  function stateHtml(id, s, nested = false, err = null) {
    const msg = s === "loading" ? "Đang tải…" : s === "empty" ? "Chưa có kết quả phù hợp" : (err?.status === 401 || err?.status === 403) ? "Mục này cần đăng nhập bằng tài khoản được cấp quyền." : "Chưa tải được. Kiểm tra mạng rồi thử lại.";
    const needsLogin = s === "error" && (err?.status === 401 || err?.status === 403);
    const card = `<div class="p-5 rounded-3xl bg-[#F8FAFC] border border-[#E2E8F0] text-center space-y-3" role="${s === "loading" ? "status" : "alert"}">${K.mascotSVG("mam", "w-20 h-24 mx-auto")}<div class="font-extrabold">${msg}</div>${s === "error" ? `<button onclick="P2.reload()" class="w-full py-3 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold">Thử lại</button>${needsLogin ? `<button onclick="goScreen('M1-S01')" class="w-full py-2 rounded-full bg-white border border-[#E2E8F0]">Đăng nhập</button>` : ""}` : ""}</div>`;
    if (nested) return card;
    // Reuse the screen's own original header (title, subtitle, back target).
    let header = "";
    try {
      const t = document.createElement("template");
      t.innerHTML = originals[id] ? originals[id]() : "";
      const first = t.content.firstElementChild?.firstElementChild;
      if (first && first.matches(".flex.items-center.justify-between.pb-1")) header = first.outerHTML;
    } catch (_) {}
    if (!header) header = K.mobileHeader(({M1:"Hồ sơ khẩu vị",M2:"Khám phá món ngon",M3:"Gợi ý bữa ăn",M4:"Quán quanh bạn",M5:"Thưởng thức",M9:"Quản trị nội dung"})[id.split("-")[0]], "", "M3-S01");
    return `<div class="p-4 space-y-3.5 bg-white text-[#0F172A] text-xs">${header}${card}</div>`;
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
      const cards = $$(".grid-cols-2 > .group", root);
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
        if (heart) click(heart, `event.stopPropagation();P2.save('${J(a.dish_id)}')`);
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
          if (!items.length) holder.innerHTML = stateHtml(id, "empty", true);
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
        if (!items.length) grid.outerHTML = stateHtml(id, "empty", true);
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
        const overlay=$(".absolute.inset-0",n);if(overlay)overlay.style.backgroundColor="rgba(0,0,0,0.7)";
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
        const heroBadges = $$(".absolute.bottom-7 > span > span", root);
        text(heroBadges[0], (d.prep_minutes ?? "—") + " phút");
        text(heroBadges[1], d.difficulty || "Chưa rõ độ khó");
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
            text($(".flex-1 .font-extrabold", step), a.title);
            text($("p", step), a.text);
            img($("img", step), d.img_key);
            const duration = $(".flex-1 > span", step);
            if (duration) duration.textContent = (a.duration_min ?? "—") + " phút";
          } else step.innerHTML = "<p>Chưa có cách nấu cho món này.</p>";
        }
        $$("button", root).forEach((b) => {
          if (
            (b.getAttribute("onclick") || "").includes("M2-S08") || b.innerHTML.includes("bookmark") ||
            b.querySelector("svg")?.outerHTML.includes("M19 21l-7")
          )
            click(b, `P2.save('${J(d.id)}')`);
        });
        const heart = $("button.hover\\:text-\\[\\#EF4444\\]", root);
        if (heart) click(heart, `P2.save('${J(d.id)}')`);
      }
      if (id === "M2-S05") {
        const tip=$(".bg-\\[\\#DCFCE7\\]",root);
        if(tip){text($(".font-extrabold",tip),d.name);text($("p",tip),d.description||"");}
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
          first = holder.firstElementChild.cloneNode(true),
          other = (holder.children[1] || holder.firstElementChild).cloneNode(true);
        holder.innerHTML = "";
        (d.steps || []).forEach((a, i) => {
          const n = (i === 0 ? first : other).cloneNode(true);
          text(n.firstElementChild, i + 1);
          text($(".flex-1 > .font-extrabold", n), a.title);
          text($(".flex-1 > p", n), a.text);
          img($("img", n), d.img_key);
          $$(".flex-1 span", n).forEach((x) => {
            if (x.textContent.includes("Đang đếm"))
              text(x, "⏱️ " + (a.duration_min || 0) + " phút");
          });
          holder.append(n);
        });
        click(root.lastElementChild, `P2.feedback('eaten')`);
      }
      if (id === "M3-S02") {
        const photo = $("img", root)?.parentElement;
        text($("b", photo), d.name);
        const shown = appState.liveToday?.items?.find((a) => a.dish_id === d.id);
        text($('b[class*="D97736"]', photo), money(shown?.price_vnd ?? d.ref_price));
      }
    }
    if(id==="M3-S05" && !state.chat.length) return stateHtml(id,"empty");
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
    if (/^M9-/.test(id)) return bindAdmin(root, id, d);
    return root.outerHTML;
  }
  function bindProfile(root, id, p) {
    if (id === "M1-S01") {
      $("input",root)?.closest(".space-y-3")?.remove();
      $$("button",root).forEach(b=>{
        if(["Zalo","Apple"].includes(b.textContent.trim())) b.remove();
        else if(b.textContent.trim()==="Google") {
          const row=b.parentElement; if(row?.classList.contains("grid-cols-3")) row.classList.replace("grid-cols-3","grid-cols-1");
          b.disabled=!(state.google?.enabled && state.google?.ready);
          b.textContent=state.google?.enabled?"Google":"Google · Sắp có";
          click(b,"P2.google()");
        }
      });
    }
    const choices = (holder, values, key, multi = false) => {
      if (!holder) return;
      // The original marks a chosen card with its own pill; reuse that pill
      // for the cards the saved profile actually selects.
      const isPill = (s) => /Đã chọn|Đang chọn|🚫|^\+$/.test(s.textContent.trim());
      const samplePill = $$("span", holder).find(isPill);
      const pillHtml = samplePill ? samplePill.outerHTML : "";
      [...holder.children].forEach((n, i) => {
        const value = values[i];
        const pillParent = $$("span", n).find(isPill)?.parentElement;
        n.querySelectorAll("span").forEach((s) => {
          if (isPill(s)) s.remove();
        });
        const chosen = multi ? (p[key] || []).includes(value) : p[key] === value;
        if (chosen && pillHtml && !/🚫|^\+$/.test(samplePill.textContent.trim()))
          (pillParent || $(".justify-between", n) || n).setAttribute("data-p2-pill", "1");
        n.innerHTML = n.innerHTML.replace(/ ✓/g, "");
        const slot = n.matches("[data-p2-pill]") ? n : $("[data-p2-pill]", n);
        if (slot) { slot.removeAttribute("data-p2-pill"); slot.insertAdjacentHTML("beforeend", pillHtml); }
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
      text(tags[0], (p.hard_allergies || []).map(v => ({shrimp:"Tôm / hải sản",peanut:"Đậu phộng",milk:"Sữa",gluten:"Gluten",egg:"Trứng",soy:"Đậu nành"})[v] || v).join(", ") || "Chưa chọn dị ứng");
      text(tags[1], "Mức cay " + p.spice_level + " · " + ({balanced:"Cân bằng",vegetarian:"Ăn chay",eat_clean:"Ăn sạch",high_protein:"Giàu đạm",low_fat:"Ít béo",low_carb:"Ít tinh bột"}[p.diet_mode] || "Chưa chọn chế độ"));
      const banner = $(".bg-\\[\\#18181B\\] span", root);
      if (banner && banner.textContent.includes("94%"))
        text(banner, "Khẩu vị đã lưu");
      const card=$(".bg-\\[\\#18181B\\]",root);
      if(card) { click(card,"goScreen('M1-S03')");card.setAttribute("aria-label","Chỉnh sửa khẩu vị"); }
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
      root.insertAdjacentHTML("beforeend", stateHtml(id, "empty", true));
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
      const openChip = $(".overflow-x-auto > span", root);
      if (openChip)
        openChip.textContent = "● Đang mở (" + items.filter((p) => p.is_currently_open).length + ")";
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
      const tpl = root.children[1].cloneNode(true),
        plain = (root.children[2] || root.children[1]).cloneNode(true);
      clearAfter(root, 1);
      (place.menu || []).forEach((m, i) => {
        const n = (i === 0 ? tpl : plain).cloneNode(true);
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
      text($(".text-\\[10px\\]",root.firstElementChild),Math.round(place.distance_m)+"m");
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
      text($("h3", root), "Liên kết đã sẵn sàng");
      const tip = root.children[1];
      if (tip) {
        text($(".font-extrabold", tip), "Bạn chưa đặt món trong ứng dụng này");
        text($("p", tip), "Mở dịch vụ bên ngoài để xem giá và xác nhận. Chỉ đánh dấu Đã ăn sau khi bạn thực sự dùng bữa.");
      }
      click(root.lastElementChild, "P2.confirmMeal()");
    }
  }
  function bindAdmin(root, id, d) {
    const workspace=root.lastElementChild, content=workspace.lastElementChild;
    const queue=(d.ocr_queue||[]).filter(a=>a.status==="pending_review");
    const reports=d.user_reports||[];
    $$("aside nav button",root).forEach(b=>{
      const code=b.getAttribute("onclick")||"";
      if (!/M9-S0[123456]/.test(code)) b.remove();
      const badge=b.lastElementChild;
      if (badge?.tagName==="SPAN" && badge!==b.firstElementChild) {
        if(code.includes("M9-S05")) text(badge,queue.length);
        else if(code.includes("M9-S06")) text(badge,reports.length);
        else badge.remove();
      }
      for(const span of $$("span",b)) if(span.children.length===0) span.textContent=span.textContent.replace(/\(542\)/g,"("+(d.total_dishes??0)+")");
    });
    $("aside > div:last-child",root)?.remove();
    const title=$("h3",workspace);
    if(title) title.textContent=title.textContent.replace(/542 Món/g,(d.total_dishes??0)+" Món").replace(/5 Báo cáo/g,reports.length+" Báo cáo");
    $$("span",workspace.firstElementChild).filter(n=>/LiteLLM/.test(n.textContent)).forEach(n=>n.remove());
    if(id==="M9-S01") {
      const kpis=workspace.children[1];
      [...kpis.children].forEach((card,i)=>{
        const value=$(".text-base > span",card);
        text(value,[d.total_dishes??0,d.total_verified_places??0,queue.length,reports.length][i]);
        value?.nextElementSibling?.remove();
      });
      const chart=content.firstElementChild?.firstElementChild;
      if(chart) chart.innerHTML=stateHtml(id,"empty", true);
      const links=$$("[onclick]",content);
      links.forEach(n=>{
        const code=n.getAttribute("onclick")||"";
        if(code.includes("M9-S07")) n.remove();
        else text($(".text-\\[10px\\]",n),code.includes("M9-S05")?queue.length:reports.length);
      });
    }
    if(id==="M9-S02") {
      const tbody=$("tbody",content), tpl=tbody.firstElementChild.cloneNode(true);
      $("thead tr",content)?.lastElementChild?.remove();
      rows(tbody,tpl,d.catalog||[],(n,a)=>{
        const cells=[...n.children];
        img($("img",cells[0]),a.img_key);text($("b",cells[0]),a.name);
        text(cells[1],({bac:"Miền Bắc",trung:"Miền Trung",nam:"Miền Nam"})[a.region]||a.region||"—");
        text(cells[2],(a.allergen_tags||[]).join(", ")||"—");
        text(cells[3],(a.calories??"—")+" kcal · "+money(a.ref_price));cells[4]?.remove();
      });
      if(!(d.catalog||[]).length) content.innerHTML=stateHtml(id,"empty", true);
    }
    if(id==="M9-S03") {
      const a=(d.catalog||[]).find(a=>a.id===selected())||d.catalog?.[0];
      if(!a) content.innerHTML=stateHtml(id,"empty", true);
      else {
        const cards=[...content.firstElementChild.children];
        text($("span",cards[0]),"Khẩu phần gốc: "+(a.base_servings??"—")+" người");
        text($("span",cards[2]),({draft:"Bản nháp",published:"Đã xuất bản",archived:"Đã lưu trữ"})[a.cms?.status]||"Dữ liệu cũ · chưa qua CMS");
        text($(".font-extrabold",cards[0]),a.name);
        text($(".text-\\[\\#64748B\\]",cards[0]),(a.calories??"—")+" kcal");
        text($(".font-extrabold",cards[1]),(a.ingredients||[]).length+" Nhóm Nguyên liệu");
        text($(".text-\\[\\#64748B\\]",cards[1]),(a.ingredients||[]).map(x=>x.name+" "+x.amount+x.unit).join(" · "));
        text($(".font-extrabold",cards[2]),(a.steps||[]).length+" Bước Nấu Có Timer");
        text($(".text-\\[\\#64748B\\]",cards[2]),(a.steps||[]).map(x=>x.title).join(" · "));
      }
    }
    if(id==="M9-S04") {
      const pending=(d.places||[]).filter(p=>!p.is_verified && p.cms?.status!=="archived");
      if(title) text(title,"Duyệt Xác Minh Quán Ăn Thực Tế ("+pending.length+" Hồ sơ chờ)");
      const tpl=content.firstElementChild.cloneNode(true);
      if(!pending.length) content.innerHTML=stateHtml(id,"empty", true);
      else rows(content,tpl,pending,(n,p)=>{
        img($("img",n),p.img_key);text($("b",n),p.name+" · "+p.address);
        text($("[class~='text-[11px]']",n),(p.cms?.evidence||"Chưa có bằng chứng xác minh")+" · "+(p.lat??"—")+", "+(p.lng??"—"));
        const buttons=$$("button",n);
        click(buttons[0],`P2.approvePlace('${J(p.id)}',${p.cms?.version||0})`);
        buttons[0].disabled=!p.cms?.evidence;
        buttons[1].disabled=true;buttons[1].title="Chưa có API yêu cầu bổ sung; sửa hồ sơ và ghi lý do tại biểu mẫu bên dưới.";
      });
    }
    if(id==="M9-S05") {
      const holder=content.firstElementChild,tpl=holder.firstElementChild.cloneNode(true);
      if(!queue.length) holder.innerHTML=stateHtml(id,"empty", true);
      else rows(holder,tpl,queue,(n,a)=>{
        const spans=$$(".flex.items-center.gap-2 > span",n);
        text(spans[0],a.extracted_name);text(spans[2],a.matched_dish_name||a.suggested_dish_id||"—");
        text(spans[3],a.confidence==null?"—":Math.round(a.confidence*100)+"%");
        text($(".text-\\[11px\\]",n),(a.place_name||a.place_id||"")+" · "+money(a.extracted_price));
        const button=$("button",n);
        click(button,`P2.review('${J(a.id)}','approved',${Number(a.version)},'${J(a.matched_dish_id||"")}',${Number(a.extracted_price)})`);
        button.disabled=!a.matched_dish_id||!Number.isSafeInteger(a.extracted_price)||!Number.isSafeInteger(a.version);
        button.title="Xác nhận món và giá đang hiển thị; đổi lựa chọn hoặc từ chối qua API vì màn gốc chưa có ô nhập.";
      });
    }
    if(id==="M9-S06") {
      const tpl=content.firstElementChild.cloneNode(true);
      if(!reports.length) content.innerHTML=stateHtml(id,"empty", true);
      else rows(content,tpl,reports,(n,a)=>{
        text($("b",n),a.place_name||a.place_id);
        const stateLabel=({pending_review:"Chờ xử lý",auto_paused:"Đã tạm ẩn",resolved:"Đã xử lý",rejected:"Đã bác bỏ"})[a.status]||a.status;
        const reasonLabel=({closed:"Báo đóng cửa",wrong_price:"Sai giá",wrong_location:"Sai vị trí",wrong_menu:"Sai thực đơn",other:"Khác"})[a.reason]||a.reason;
        text($("p",n),[reasonLabel,a.evidence,a.resolution_reason,a.resolved_at].filter(Boolean).join(" · "));
        text($("span",n),(a.report_count??1)+" báo cáo · "+stateLabel);
        // No new reason/filter/resolve controls: preserve the original hours button,
        // but don't mislabel it as unpause or allow a write without a reason.
        const button=$("button",n);
        if(button) {
          button.disabled=true;button.removeAttribute("onclick");
          button.title="Màn gốc chưa có ô sửa giờ/lý do xử lý. Lọc, xử lý báo cáo và mở lại qua API.";
        }
      });
    }
    return root.outerHTML;
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
      // Original labels, screen codes and badges stay exactly as designed.
      // Only invented figures/claims that real data cannot back are replaced.
      const next = n.textContent
        .replace(/\bAnti-Fraud Active\b/g, "")
        .replace(/542 món|500\+ món|Hoàn tất trong 38 giây!/g, "")
        .replace(/Chào anh Long/g, "Chào bạn")
        .replace(/Verified Merchant/g,"Thông tin quán")
        .replace(/⭐ 4\.8 \(150\)/g, "Chưa có đánh giá thực tế")
        .replace(/Chặn 100% dị ứng/g,"Lọc theo dị ứng đã khai báo");
      if (next !== n.textContent) n.textContent = next;
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
    $$("[onclick]:not(button):not(a):not(input)", root).reverse().forEach((el) => {
      if (el.closest("svg") || el.querySelector("button,a,input,[onclick]")) return;
      const b = document.createElement("button");
      for (const a of el.attributes) b.setAttribute(a.name, a.value);
      b.type = "button";
      b.style.textAlign = "inherit";
      if (el.tagName === "DIV" && !el.classList.contains("absolute") && !el.classList.contains("fixed") && ![...el.classList].some(c => /^(w|max-w|min-w)-/.test(c))) b.style.width = "100%";
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
      const submit = $('button:not([onclick]):not([type]),button[onclick=""]:not([type])', f);
      if (submit) submit.type = "submit";
    });
    hydrateImages(root);
    window.M9Forms?.mount(root, appState.activeScreenId, state.cache.admin?.data);
  }
  const desktopLoginRequired = TOV_AUTH.renderLoginRequired;
  TOV_AUTH.renderLoginRequired = function(container, status, retry) {
    // Same desktop card the app already uses; phone OTP is replaced by the enabled sign-in.
    desktopLoginRequired.call(TOV_AUTH, container, status, retry);
    container.querySelectorAll('[data-auth="phone"],[data-auth="send"],[data-auth="code"],[data-auth="verify"]').forEach(n=>n.remove());
    const box = container.firstElementChild;
    const intro = box?.children[1];
    if (intro) intro.textContent = (status === 403 ? "Tài khoản hiện tại không có quyền xem mục này." : "Mục này cần đăng nhập.") + " Đăng nhập bằng tài khoản đã được cấp quyền.";
    if (box) box.insertAdjacentHTML("beforeend", `<button type="button" onclick="P2.google()" class="w-full py-2 rounded-xl bg-[#FBBF24] text-[#0F172A] font-extrabold" ${state.google?.enabled && state.google?.ready ? "" : "disabled"}>${state.google?.enabled ? "Google" : "Google · Sắp có"}</button>`);
  };
  window.P2 = {
    async google() {
      if(!state.google?.enabled || !window.google?.accounts?.id) return;
      google.accounts.id.prompt(notification=>{
        if(notification.isNotDisplayed?.() || notification.isSkippedMoment?.())
          status("Chưa mở được đăng nhập Google. Kiểm tra cài đặt trình duyệt rồi thử lại.");
      });
    },
    state,
    retryWrite() {
      retryWrite?.();
    },
    reload() {
      load(appState.activeScreenId, true);
    },
    async gamePick(kind) {
      if (!["spin", "game", "fortune", "blind-box"].includes(kind)) return null;
      try {
        const result = await api("/suggestions/" + kind);
        state.spin = result.picked_dish || null;
        if (!state.spin) {
          state.dish = null;
          status((result.reasons || []).map(r => r.message).filter(Boolean).join(" ") || "Chưa có món phù hợp. Không tự nới bộ lọc.");
          return null;
        }
        state.dish = state.spin.id || state.spin.dish_id;
        state.place = result.nearest_place?.place_id || null;
        return state.spin;
      } catch (e) {
        state.spin = null;
        state.dish = null;
        status("Chưa tải được món. Kiểm tra kết nối rồi bấm thử lại.");
        return null; // NEVER fall back to a local, unfiltered dish.
      }
    },
    dish(id, target = "M2-S04") {
      state.dish = id;
      if(target !== "M5-S01") state.place = null;
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
      const radios=$$("#stage-container input[name=r]");
      const reason=["closed","wrong_price","wrong_location"][radios.findIndex(r=>r.checked)]||"other";
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
      const dishId=selected();
      let tab=window.open("about:blank","_blank");
      if(!tab) return status("Trình duyệt đang chặn mở dịch vụ bên ngoài. Cho phép cửa sổ mới rồi thử lại.");
      tab.opener=null;
      action(
        async()=>{
          if(tab.closed) {
            tab=window.open("about:blank","_blank");
            if(!tab) throw new Error("Trình duyệt đang chặn cửa sổ mới");
            tab.opener=null;
          }
          try {
            const d=await api("/orders/redirect", "POST", {dish_id:dishId,place_id:p.id,partner});
            const u=new URL(d.target_deeplink);
            if(u.protocol!=="https:") throw new Error("Liên kết không hợp lệ");
            return {...d,target_deeplink:u.href};
          } catch(e){tab.close();throw e;}
        },
        (d)=>{state.order=d;tab.location.replace(d.target_deeplink);goScreen("M5-S05");}
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
      location.href=state.order.target_deeplink;
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
            window.M9Forms?.syncRole();
            state.cache = {};
            goScreen("M1-S01");
            status("Đã xóa tài khoản.");
          },
        );
    },
    approvePlace(id, version) {
      if(!confirm("Duyệt dựa trên bằng chứng đã lưu? Thao tác này không mở lại quán đang tạm dừng.")) return;
      action(()=>api("/admin/places/"+encodeURIComponent(id)+"/approve","POST",{version,reason:"Duyệt hồ sơ theo bằng chứng đã lưu"}),
        ()=>{delete state.cache.admin;goScreen("M9-S04");});
    },
    review(id, decision, version, dish_id, price) {
      action(
        () => api("/admin/ocr-review", "POST", { ocr_id: id, decision, version, dish_id, price }),
        () => {
          delete state.cache.admin;
          goScreen("M9-S05");
        },
      );
    },
    unpause(id, reason) {
      if(typeof reason!=="string"||!reason.trim()) {
        status("Màn gốc chưa có ô lý do mở lại; hãy dùng API có reason.");
        return;
      }
      if (confirm("Bạn đã xác nhận quán mở lại?"))
        action(
          () =>
            api(
              "/admin/places/" + encodeURIComponent(id) + "/unpause",
              "POST",
              {reason},
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
    originals[id] = original;
    scr.render = () => {
      const cfg = config(id),
        entry = cfg ? state.cache[cfg[0]] : null;
      if (cfg && entry?.status !== "success")
        return stateHtml(id, entry?.status || "loading", false, entry?.error);
      return mobile(id, original(), entry?.data);
    };
  });
  goScreen = function (id) {
    if(id==="M1-S02") id="M1-S01";
    if (!/^M[1-59]-/.test(id))
      return status("Tính năng này chưa mở trong bản hiện tại.");
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
      Math.min(10, (appState.servings || 2) + delta),
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
  // Keep the original blind-box layout, but do not promise a nonexistent voucher.
  text($("#view-subgame-blindbox > div:first-child > div:last-child"),
    "Chọn 1 trong 3 túi để nhận gợi ý món theo điều kiện bữa ăn đã chọn.");
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
  style.textContent = `.product-mode{--text-muted:#5B6A80}.product-mode #p2-action-status{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:100;max-width:calc(100vw - 24px);width:420px;box-shadow:0 8px 30px #0003}.product-mode :focus-visible{outline:3px solid #B45309;outline-offset:3px}.product-mode input{min-width:0}.product-mode [onclick]{touch-action:manipulation}.product-mode .phone-frame .flex-1{min-width:0}.product-mode .phone-frame{overflow:hidden}.product-mode #main-liveapp{min-width:0}.product-mode [data-p2-layout]{min-width:0}@media(max-width:768px){.product-mode #stage-container .min-w-\\[1100px\\],.product-mode #stage-container .min-w-\\[1000px\\]{min-width:0!important}.product-mode #stage-container table{display:block;max-width:100%;overflow:auto}.product-mode #stage-container aside nav{display:flex;flex-wrap:wrap;max-height:none}.product-mode #stage-container aside nav button{width:auto}.product-mode #stage-container .w-64{width:auto}.product-mode #stage-container .min-w-0{max-width:100%}}`;
  document.head.append(style);
  window.M9Forms?.syncRole();
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
  (async()=>{
    try {
      const res=await request("/api/v1/auth/google/config");
      state.google=res.ok?await res.json():{enabled:false};
      if(state.google.enabled && state.google.client_id) {
        const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;
        script.onload=()=>{google.accounts.id.initialize({client_id:state.google.client_id,callback:credential=>action(
          async()=>{const r=await TOV_AUTH.google(credential.credential);if(!r.ok)throw Object.assign(new Error("Đăng nhập chưa thành công"),{status:r.status});return r.data;},
          (d)=>{state.cache={};window.M9Forms?.syncRole();if(document.body.classList.contains("pwa-mobile-mode"))goScreen("M1-S03");else setLiveAppTab((d.role||d.user?.role)==="admin"?"admin":"profile");}
        )});state.google.ready=true;$$("[onclick='P2.google()']").forEach(b=>b.disabled=false);};
        script.onerror=()=>status("Chưa tải được đăng nhập Google. Kiểm tra mạng rồi thử lại.");
        document.head.append(script);
      }
    } catch {state.google={enabled:false};}
    if(appState.activeScreenId==="M1-S01")paint();
    $$("[onclick='P2.google()']").forEach(b=>{b.disabled=!(state.google?.enabled && state.google?.ready);b.textContent=state.google?.enabled?"Google":"Google · Sắp có";});
  })();
  load("M1-S09");
  load(appState.activeScreenId);
  window.P2.polish = polish;
})();
