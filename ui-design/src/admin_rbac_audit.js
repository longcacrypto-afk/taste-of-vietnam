/* M9-S08 (roles) and M9-S09 (audit log) inside the original admin screens.
 * Reuses the original cards and dark log panel; only adds the form controls the
 * existing APIs need (/admin/rbac/users, /admin/rbac/roles, /admin/audit-logs). */
(function () {
  "use strict";
  const ROLE_CARDS = [
    ["super_admin", "Super Admin"],
    ["content_moderator", "Content Moderator"],
    ["ops_admin", "Ops Admin"],
    ["consumer", "Consumer"]
  ];
  const vnTime = iso => {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "—";
    return new Date(t + 7 * 3600000).toISOString().slice(0, 19).replace("T", " ");
  };
  // Calendar date (yyyy-mm-dd) in Vietnam time -> inclusive ISO range bounds.
  const dayStart = d => d ? d + "T00:00:00+07:00" : "";
  const dayEnd = d => d ? d + "T23:59:59.999+07:00" : "";
  function roleCounts(users) {
    const out = {};
    // Legacy OTP accounts carry role "user": same rights as consumer, counted with it.
    for (const u of users || []) if (!u.guest) {
      const r = u.role === "user" ? "consumer" : u.role;
      out[r] = (out[r] || 0) + 1;
    }
    return out;
  }
  function auditQuery(form) {
    const q = new URLSearchParams();
    for (const k of ["action", "actor_id", "target"]) {
      const v = String(form.get(k) || "").trim();
      if (v) q.set(k, v);
    }
    if (form.get("from")) q.set("from", dayStart(form.get("from")));
    if (form.get("to")) q.set("to", dayEnd(form.get("to")));
    return q;
  }
  function logLine(r, H) {
    return `<div><span class="text-[#4ADE80]">[${H(vnTime(r.timestamp))}]</span> <b>${H(r.actor || r.actor_id || "—")}</b> ${H(r.action)} <span class="text-[#FBBF24]">${H(r.target || "—")}</span>${r.reason ? " · " + H(r.reason) : ""}</div>`;
  }
  window.M9RbacAudit = { roleCounts, auditQuery, logLine, vnTime, dayStart, dayEnd };

  function rbac(root, content, C, H) {
    if (C.role !== "super_admin") {
      content.textContent = "Chỉ Super Admin xem và đổi vai trò người dùng.";
      return;
    }
    const grid = content.matches(".grid") ? content : content.querySelector(".grid") || content;
    const cards = [...grid.children];
    const host = document.createElement("div");
    host.className = "space-y-3 mt-3";
    content.after(host);
    let users = [], roles = [];
    const roleName = id => roles.find(r => r.id === id)?.name || (id === "user" ? "Consumer (user cũ)" : id);
    const who = u => (u.email || "Chưa có email") + " · " + u.id;
    function drawCards() {
      const n = roleCounts(users);
      cards.forEach((card, i) => {
        const [id, name] = ROLE_CARDS[i] || [];
        const pill = card.querySelector("span");
        if (pill && id) pill.textContent = `${name} (${n[id] || 0})`;
        const p = card.querySelector("p");
        if (p && i === 0 && /AI Gateway/.test(p.textContent)) p.textContent = "Phân quyền & Audit Log";
      });
    }
    function drawForm() {
      const real = users.filter(u => !u.guest);
      host.innerHTML = C.card("Đổi vai trò người dùng", C.form(
        C.select("user_id", "Tài khoản", real[0]?.id || "", real.map(u => [u.id, who(u) + " · " + roleName(u.role)])) +
        C.select("role", "Vai trò mới", real[0]?.role || "consumer", roles.map(r => [r.id, r.name])) +
        C.area("reason", "Lý do đổi vai trò") + C.button("Lưu vai trò"))) +
        C.card("Tài khoản (" + real.length + ")", `<div class="space-y-1" data-user-list>${real.map(u =>
          `<div class="flex justify-between gap-2 border-b border-[#E2E8F0] py-1"><span>${H(who(u))}</span><b>${H(roleName(u.role))}</b></div>`).join("") || "Chưa có tài khoản."}</div>`);
      const f = host.querySelector("form");
      const userSel = f.elements.namedItem("user_id"), roleSel = f.elements.namedItem("role");
      userSel?.addEventListener("change", () => {
        const u = real.find(x => x.id === userSel.value);
        if (u) roleSel.value = u.role;
      });
      f.addEventListener("submit", e => {
        e.preventDefault();
        C.run(f, async () => {
          const data = new FormData(f), reason = String(data.get("reason") || "").trim();
          if (!data.get("user_id")) throw new Error("Hãy chọn tài khoản.");
          if (!reason || reason.length > 1000) throw new Error("Cần lý do đổi vai trò, tối đa 1000 ký tự.");
          const r = await C.api("/admin/rbac/users", "POST", { user_id: data.get("user_id"), role: data.get("role"), reason });
          users = (await C.api("/admin/rbac/users")).users || [];
          drawCards(); drawForm();
          host.querySelector("[data-feedback]").textContent = "Đã đổi vai trò " + r.user_id + " thành " + roleName(r.new_role) + ".";
          return "Đã lưu.";
        });
      });
    }
    host.textContent = "Đang tải danh sách tài khoản…";
    Promise.all([C.api("/admin/rbac/users"), C.api("/admin/rbac/roles")]).then(([u, r]) => {
      users = u.users || []; roles = r.roles || [];
      drawCards(); drawForm();
    }).catch(e => { host.textContent = e.status === 403 ? "Không có quyền xem tài khoản." : "Chưa tải được danh sách tài khoản. Bấm Thử lại ở thanh trạng thái hoặc tải lại trang."; });
  }

  function audit(root, content, C, H) {
    if (!["ops_admin", "super_admin"].includes(C.role)) {
      content.textContent = "Vai trò này không có quyền xem nhật ký kiểm toán.";
      return;
    }
    const box = content.matches(".font-mono") ? content : content.querySelector(".font-mono") || content;
    const filters = document.createElement("div");
    filters.className = "mb-3";
    filters.innerHTML = C.card("Lọc nhật ký", C.form(
      `<div class="grid grid-cols-1 md:grid-cols-5 gap-2">` +
      C.field("action", "Thao tác (mã)", "", "text", 'list="m9-audit-actions" maxlength="64"') +
      C.field("actor_id", "Người thực hiện (id)", "", "text", 'maxlength="64"') +
      C.field("target", "Đối tượng (id)", "", "text", 'maxlength="64"') +
      C.field("from", "Từ ngày", "", "date") + C.field("to", "Đến ngày", "", "date") +
      `</div><datalist id="m9-audit-actions"></datalist>` + C.button("Lọc nhật ký")));
    box.before(filters);
    const more = document.createElement("button");
    more.type = "button"; more.className = "mt-3 px-4 py-2 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold";
    more.textContent = "Tải thêm"; more.hidden = true;
    const note = document.createElement("p");
    note.className = "mt-3 text-[10px] text-[#64748B]";
    note.textContent = "Cấu hình trọng số AI chưa có API; phần này chưa mở.";
    box.after(more, note);
    const f = filters.querySelector("form"), list = filters.querySelector("datalist");
    let query = new URLSearchParams(), shown = 0, total = 0;
    const seen = new Set();
    function draw(items, append) {
      if (!append) box.innerHTML = "";
      items.forEach(r => { seen.add(r.action); box.insertAdjacentHTML("beforeend", logLine(r, H)); });
      if (!append && !items.length) box.innerHTML = "<div>Không có thao tác phù hợp.</div>";
      list.innerHTML = [...seen].filter(Boolean).sort().map(a => `<option value="${H(a)}">`).join("");
    }
    async function fetchPage(append) {
      const q = new URLSearchParams(query); q.set("limit", "50"); q.set("offset", String(append ? shown : 0));
      const r = await C.api("/admin/audit-logs?" + q);
      draw(r.logs || r.items || [], append);
      shown = (append ? shown : 0) + (r.logs || r.items || []).length; total = r.total;
      more.hidden = shown >= total;
      return `${total} thao tác phù hợp · đang hiện ${shown}.`;
    }
    f.addEventListener("submit", e => {
      e.preventDefault();
      C.run(f, async () => {
        const data = new FormData(f);
        if (data.get("from") && data.get("to") && data.get("from") > data.get("to")) throw new Error("Từ ngày phải trước Đến ngày.");
        query = auditQuery(data);
        return fetchPage(false);
      });
    });
    more.addEventListener("click", () => C.run(f, () => fetchPage(true)));
    box.innerHTML = "<div>Đang tải nhật ký…</div>";
    C.run(f, () => fetchPage(false));
  }

  function mount(root, screen, dashboard, C) {
    if (!["M9-S08", "M9-S09"].includes(screen)) return;
    const content = root.lastElementChild?.lastElementChild;
    if (!content || content.dataset.m9RbacAudit) return;
    content.dataset.m9RbacAudit = "1";
    const H = window.escHtml;
    if (screen === "M9-S08") rbac(root, content, C, H);
    else audit(root, content, C, H);
  }
  window.M9FormsParts = { ...window.M9FormsParts, rbacAudit: mount };
})();
