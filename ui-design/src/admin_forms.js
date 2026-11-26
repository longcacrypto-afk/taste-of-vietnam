/* Inputs inside the original M9 screens; all visual primitives come from the
 * existing admin cards/buttons and the existing profile input controls. */
(function () {
  if (!["/", "/app"].includes(location.pathname)) return;
  const H = window.escHtml;
  const inputClass = "w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] focus:outline-none";
  const buttonClass = "px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold";
  const $ = (s, r) => r.querySelector(s);
  const $$ = (s, r) => [...r.querySelectorAll(s)];
  let role = null, checking = null;
  const isAdmin = r => ["content_moderator", "ops_admin", "super_admin"].includes(r);
  const content = r => ["content_moderator", "super_admin"].includes(r);
  const ops = r => ["ops_admin", "super_admin"].includes(r);
  let seq = 0;
  const selections = {};
  function rememberSelection() {
    const picker = document.querySelector("#stage-container [name=dish_picker], #stage-container [name=place_pick]");
    if (picker) selections[window.appState.activeScreenId] = picker.value;
  }
  function label(name, title, control) {
    const id = "m9-input-" + (++seq);
    return `<label class="block space-y-1"><span class="font-bold">${H(title)}</span>${control.replace("data-control", `id="${id}" name="${H(name)}" aria-label="${H(title)}"`)}</label>`;
  }
  const C = {
    field(name, title, value = "", type = "text", attrs = "") {
      return label(name, title, `<input data-control type="${H(type)}" value="${H(value ?? "")}" class="${inputClass}" ${attrs}>`);
    },
    select(name, title, value, options) {
      return label(name, title, `<select data-control class="${inputClass}">${options.map(([v,t]) => `<option value="${H(v)}" ${String(v) === String(value) ? "selected" : ""}>${H(t)}</option>`).join("")}</select>`);
    },
    area(name, title, value = "") {
      return label(name, title, `<textarea data-control rows="3" class="${inputClass}">${H(value ?? "")}</textarea>`);
    },
    check(name, title, checked) {
      return `<label class="flex items-center gap-2"><input type="checkbox" name="${H(name)}" ${checked ? "checked" : ""} class="accent-[#FBBF24]"><span>${H(title)}</span></label>`;
    },
    button(title, type = "submit") {
      return `<button type="${type === "submit" ? "submit" : "button"}" ${!["button","submit"].includes(type) ? `data-action="${H(type)}"` : ""} class="${buttonClass}">${H(title)}</button>`;
    },
    card(title, body) {
      return `<div class="bg-white p-4 rounded-2xl border border-[#E2E8F0] space-y-3 shadow-sm"><div class="font-extrabold text-sm">${H(title)}</div>${body}</div>`;
    },
    form(body) {
      return `<form class="space-y-3">${body}<div data-feedback role="status" aria-live="polite" class="text-[#BE123C]"></div></form>`;
    },
    async api(path, method = "GET", body) {
      // This captures the original auth wrapper before P2's generic fetch errors:
      // retain server validation details and never convert a 503 into success.
      const res = await window.M9_AUTH_FETCH("/api/v1" + path, {
        method, ...(body === undefined ? {} : {headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)})
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(typeof data.error === "string" ? data.error : "Chưa lưu được dữ liệu.");
        err.status = res.status; err.data = data; throw err;
      }
      if (method === "POST" && ["/admin/dishes", "/admin/places"].includes(path) && data.id)
        selections[window.appState.activeScreenId] = data.id;
      return data;
    },
    refresh() { window.P2.reload(); },
    async run(form, job) {
      if (form.dataset.busy) return;
      const box = $("[data-feedback]", form);
      const states = $$("button", form).map(b => [b,b.disabled]);
      rememberSelection();
      form.dataset.busy = "1";
      states.forEach(([b]) => b.disabled = true);
      box.textContent = "Đang xử lý…";
      try {
        const result = await job();
        if (typeof result === "string") box.textContent = result;
        else C.refresh();
      } catch (e) {
        box.textContent = e.status === 409
          ? "Dữ liệu đã thay đổi hoặc đã được xử lý. Nội dung nhập vẫn giữ; tải bản mới trước khi gửi lại."
          : e.status === 503 ? "Dịch vụ tạm thời chưa sẵn sàng (503). Chưa lưu; nội dung nhập vẫn giữ."
          : e.status === 403 ? "Bạn không có quyền thực hiện thao tác này. Chưa lưu."
          : e.message || "Chưa lưu được. Kiểm tra kết nối rồi thử lại.";
        if (e.status === 409) {
          const b = document.createElement("button");
          b.type = "button"; b.className = buttonClass; b.textContent = "Tải bản mới";
          b.addEventListener("click", () => C.refresh()); box.append(b);
        }
      } finally {
        delete form.dataset.busy;
        states.forEach(([b, disabled]) => b.disabled = disabled);
      }
    }
  };
  function review(root, id, d) {
    if (id !== "M9-S05" || !C.canContent) return;
    const holder = root.lastElementChild.lastElementChild.firstElementChild;
    const queue = (d.ocr_queue || []).filter(a => a.status === "pending_review");
    const dishes = (d.catalog || []).filter(a =>
      (!a.cms || a.cms.status === "published") && a.safety_status !== "rejected");
    [...holder.children].forEach((card, i) => {
      const row = queue[i]; if (!row) return;
      $("button",card)?.remove();
      card.insertAdjacentHTML("beforeend", C.form(
        C.select("dish_id", "Món chuẩn", row.matched_dish_id || "", [["","Chọn món"], ...dishes.map(a => [a.id,a.name])]) +
        C.field("price", "Giá chuẩn (đồng)", row.extracted_price, "number", 'min="0" max="100000000" step="1"') +
        C.area("reason", "Lý do duyệt / từ chối") +
        `<div class="flex flex-wrap gap-2">${C.button("✓ Xác nhận ghép")}${C.button("Từ chối", "button")}</div>`));
      const f = $("form", card);
      const send = decision => C.run(f, async () => {
        const data = new FormData(f), reason = data.get("reason").trim();
        if (reason.length > 1000 || (decision === "rejected" && !reason)) throw new Error("Cần lý do từ chối, tối đa 1000 ký tự.");
        const body = {ocr_id:row.id, version:row.version, decision, reason};
        if (decision === "approved") {
          const raw = data.get("price"), price = Number(raw);
          if (!data.get("dish_id")) throw new Error("Hãy chọn món chuẩn.");
          if (!raw || !Number.isSafeInteger(price) || price < 0 || price > 100000000) throw new Error("Giá phải là số nguyên từ 0 đến 100000000.");
          Object.assign(body, {dish_id:data.get("dish_id"), price});
        }
        await C.api("/admin/ocr-review", "POST", body);
      });
      f.addEventListener("submit", e => {e.preventDefault(); send("approved");});
      $('button[type="button"]', f).addEventListener("click", () => send("rejected"));
    });
  }
  function reports(root,id,d) {
    if (id !== "M9-S06") return;
    const area = root.lastElementChild.lastElementChild;
    const filters = document.createElement("div");
    filters.innerHTML = C.card("Lọc báo cáo", C.form(
      C.select("status", "Trạng thái", "", [["","Tất cả"],["pending_review","Chờ xử lý"],["auto_paused","Đã tạm ẩn"],["resolved","Đã xử lý"],["rejected","Đã bác bỏ"]]) +
      C.select("reason", "Loại báo cáo", "", [["","Tất cả"],["closed","Đóng cửa"],["wrong_price","Sai giá"],["wrong_location","Sai vị trí"],["wrong_menu","Sai thực đơn"],["other","Khác"]]) +
      C.field("place_id", "Mã quán (để trống: tất cả)") + C.button("Lọc báo cáo")));
    const rows = document.createElement("div"); rows.className = "space-y-3";
    const draw = items => {
      rows.replaceChildren();
      if (!items.length) {rows.textContent = "Không có báo cáo phù hợp."; return;}
      items.forEach(a => {
        const node = document.createElement("div");
        const status = ({pending_review:"Chờ xử lý", auto_paused:"Đã tạm ẩn",resolved:"Đã xử lý",rejected:"Đã bác bỏ"})[a.status] || a.status;
        node.innerHTML = C.card(a.place_name || a.place_id,
          `<div>${H(status)} · ${H(a.reason)}</div><p>${H(a.evidence || "Chưa có bằng chứng")}</p><p>${H(a.resolution_reason || "")} ${H(a.resolved_at || "")}</p>` +
          (["pending_review","auto_paused"].includes(a.status) ? C.form(
            C.area("reason","Lý do xử lý") + `<div class="flex flex-wrap gap-2">${C.button("Xác nhận đã xử lý")}${C.button("Bác bỏ báo cáo","button")}</div>`) : ""));
        const f = $("form",node);
        if (f) {
          const send = status => C.run(f, async () => {
            const reason = new FormData(f).get("reason").trim();
            if (!reason || reason.length > 1000) throw new Error("Cần nêu lý do xử lý, tối đa 1000 ký tự.");
            await C.api("/admin/reports/" + encodeURIComponent(a.id), "PATCH", {status,reason});
          });
          f.addEventListener("submit",e=>{e.preventDefault();send("resolved");});
          $('button[type="button"]',f).addEventListener("click",()=>send("rejected"));
        }
        rows.append(node);
      });
    };
    area.replaceChildren(filters,rows); draw(d.user_reports || []);
    const f = $("form",filters);
    f.addEventListener("submit",e=>{
      e.preventDefault();
      C.run(f,async()=>{
        const query = new URLSearchParams();
        new FormData(f).forEach((v,k)=>{if(v.trim())query.set(k,v.trim());});
        const response = await C.api("/admin/reports?"+query);
        draw(response.items); return `${response.total} báo cáo phù hợp (hiển thị tối đa ${response.limit}).`;
      });
    });
    if (C.canOps) {
      const paused = (d.places || []).filter(p => p.is_open_override === false);
      if (paused.length) {
        const n = document.createElement("div");
        n.innerHTML = C.card("Mở lại quán đã tạm dừng", C.form(
          C.select("place_id","Quán cần mở lại",paused[0].id,paused.map(p=>[p.id,p.name]))+
          C.area("reason","Lý do mở lại")+
          "<p>Mở lại không xác minh quán; bằng chứng và lịch sử báo cáo vẫn được giữ.</p>"+C.button("Mở lại quán")));
        const form = $("form",n);
        form.addEventListener("submit",e=>{e.preventDefault();C.run(form,async()=>{
          const data = new FormData(form), reason=data.get("reason").trim();
          if (!reason || reason.length>1000) throw new Error("Cần lý do mở lại, tối đa 1000 ký tự.");
          await C.api("/admin/places/"+encodeURIComponent(data.get("place_id"))+"/unpause","POST",{reason});
        });});
        area.append(n);
      }
    }
  }
  const navTemplate = document.querySelector("#ltab-admin")?.cloneNode(true);
  function navigation(scope) {
    const desktop = document.querySelector("#ltab-admin");
    if (!isAdmin(role)) scope?.querySelectorAll("[data-m9-entry]").forEach(n => n.remove());
    if (desktop) {desktop.hidden = !isAdmin(role); desktop.style.display = isAdmin(role) ? "" : "none"; desktop.setAttribute("onclick","goScreen('M9-S01')");}
    if (document.body.classList.contains("pwa-mobile-mode") && isAdmin(role) && navTemplate &&
        ["M3-S01","M1-S09","M1-S03"].includes(window.appState.activeScreenId) && !scope.querySelector("[data-m9-entry]")) {
      const button = navTemplate.cloneNode(true);
      button.removeAttribute("id"); button.dataset.m9Entry = "1";
      button.setAttribute("onclick","goScreen('M9-S01')");
      button.textContent = "Quản trị nội dung";
      const destination = scope.querySelector(".phone-frame > .flex-1") || scope.firstElementChild;
      destination?.prepend(button);
    }
  }
  window.M9Forms = {
    async syncRole() {
      if (checking) return checking;
      checking = C.api("/auth/me").then(d => {role=d.role;}).catch(()=>{role=null;}).finally(()=>{
        checking=null; navigation(document.querySelector("#stage-container"));
      });
      return checking;
    },
    mount(scope,id,d) {
      if (!scope) return;
      navigation(scope);
      if (!/^M9-S0[1-6]$/.test(id) || !d || scope.dataset.m9Mounted === id) return;
      const nav = scope.querySelector("aside nav");
      if (!nav) return;
      const root = nav.closest("aside").parentElement;
      scope.dataset.m9Mounted = id;
      // Each paint replaces the root, so mark that root, not the persistent stage.
      delete scope.dataset.m9Mounted;
      if (root.dataset.m9Mounted) return;
      root.dataset.m9Mounted = id;
      const actualRole = d.actor_role;
      Object.assign(C,{role:actualRole,canContent:content(actualRole),canOps:ops(actualRole)});
      nav.closest("aside").style.setProperty("display","flex","important");
      $$("button",nav).forEach(b=>{
        const target = b.getAttribute("onclick") || "";
        if ((!C.canContent && /M9-S0[235]/.test(target)) || (!C.canOps && /M9-S04/.test(target))) b.remove();
      });
      if (!nav.querySelector("[data-m9-home]")) {
        const b = document.createElement("button");
        b.className = nav.firstElementChild?.className || buttonClass;
        b.dataset.m9Home="1"; b.textContent="← Trang chủ"; b.type="button";
        b.addEventListener("click",()=>goScreen("M3-S01")); nav.append(b);
      }
      if (id === "M9-S01" && !C.canContent) root.querySelectorAll("button[onclick*=M9-S05]").forEach(n => n.remove());
      if (id === "M9-S05" && !C.canContent) {
        root.lastElementChild.lastElementChild.textContent = "Vai trò này không có quyền duyệt menu.";
        return;
      }
      Object.values(window.M9FormsParts || {}).forEach(fn=>fn(root,id,d,C));
      review(root,id,d); reports(root,id,d);
      const picker = root.querySelector("[name=dish_picker], [name=place_pick]");
      if (picker && selections[id] && [...picker.options].some(o => o.value === selections[id])) {
        picker.value = selections[id]; picker.dispatchEvent(new Event("change"));
      }
    }
  };
})();
