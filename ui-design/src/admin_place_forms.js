(function () {
  "use strict";
  function mountPlaces(root, id, d, C) {
    if (id !== "M9-S04" || !C.canOps || root.querySelector("[data-place-editor]")) return;
    const content = root.lastElementChild && root.lastElementChild.lastElementChild;
    if (!content) return;
    const E = window.escHtml;
    const host = document.createElement("div");
    host.dataset.placeEditor = "";
    content.appendChild(host);
    const places = d.places || [];
    let dishes = [...(d.catalog || [])];
    // Ops cannot read the private dish catalogue. Retain internal menu references.
    for (const p of places) for (const m of p.menu || []) {
      if (!dishes.some(a => a.id === m.dish_id)) dishes.push({id:m.dish_id, name:m.name || m.dish_id});
    }
    const field = C.field, select = C.select, area = C.area, check = C.check;
    const btn = (label, action) => C.button(label, action || "button");
    const note = text => `<p class="text-[11px] text-[#64748B]">${E(text)}</p>`;
    const days = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
    host.innerHTML = C.card("Nhập và chỉnh sửa quán",
      select("place_pick", "Chọn hồ sơ quán", "", [["", "Tạo quán mới"], ...places.map(p => [p.id, p.name + " · " + p.address])]) +
      '<div data-editor-body></div>') +
      '<div data-import-card></div>';
    const picker = host.querySelector('[name="place_pick"]');
    const body = host.querySelector("[data-editor-body]");
    const val = (f, name) => f.elements.namedItem(name).value.trim();
    const checked = (f, name) => f.elements.namedItem(name).checked;
    const number = (f, name) => {
      const raw = val(f, name), n = Number(raw);
      if (!raw || !Number.isFinite(n)) throw new Error("Cần nhập số hợp lệ: " + f.elements.namedItem(name).getAttribute("aria-label"));
      return n;
    };
    const sourceFields = (prefix, label, s) => field(prefix + "_author", label + " — tác giả", s?.author || "", "text", 'maxlength="200"') +
      field(prefix + "_url", label + " — đường dẫn", s?.url || "", "url", 'maxlength="2000"') +
      field(prefix + "_license", label + " — quyền sử dụng", s?.license || "", "text", 'maxlength="500"');
    const readSource = (f, prefix) => ({author:val(f, prefix + "_author"), url:val(f, prefix + "_url"), license:val(f, prefix + "_license")});
    function intervalHTML(pair) {
      // Text with a strict time pattern supports the API's valid 24:00 endpoint.
      return '<div data-interval>' +
        field("from", "Giờ bắt đầu (HH:MM)", pair?.[0] || "", "text", 'required pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" placeholder="08:00"') +
        field("to", "Giờ kết thúc (HH:MM; có thể 24:00)", pair?.[1] || "", "text", 'required pattern="(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00)" placeholder="22:00"') +
        btn("Xóa khoảng giờ", "remove-interval") + "</div>";
    }
    const scheduleHTML = pairs => '<div data-intervals>' + (pairs || []).map(intervalHTML).join("") + "</div>" +
      btn("Thêm khoảng giờ", "add-interval");
    const overrideHTML = (date, pairs) => '<div data-override>' +
      field("override_date", "Ngày ngoại lệ", date || "", "date", "required") +
      scheduleHTML(pairs) + btn("Xóa ngày ngoại lệ", "remove-override") + "</div>";
    function menuHTML(m) {
      return '<div data-menu-row>' +
        select("dish_id", "Món trong thực đơn", m?.dish_id || "", [["", "Chọn món"], ...dishes.map(a => [a.id, a.name])]) +
        field("menu_name", "Tên hiển thị tại quán (không bắt buộc)", m?.name || "", "text", 'maxlength="200"') +
        field("price", "Giá (VND)", m?.price ?? "", "number", 'required min="0" max="100000000" step="1"') +
        check("available", "Đang có món", m ? m.available === true : true) +
        btn("Xóa món khỏi thực đơn", "remove-menu") + "</div>";
    }
    function readHours(f) {
      const intervals = el => [...el.querySelectorAll("[data-interval]")].map(row =>
        [row.querySelector('[name="from"]').value, row.querySelector('[name="to"]').value]);
      const weekly = {}, overrides = {};
      for (const day of f.querySelectorAll("[data-weekday]")) weekly[day.dataset.weekday] = intervals(day);
      for (const row of f.querySelectorAll("[data-override]")) {
        const date = row.querySelector('[name="override_date"]').value;
        if (Object.hasOwn(overrides, date)) throw new Error("Ngày ngoại lệ bị trùng: " + date);
        overrides[date] = intervals(row);
      }
      return {weekly, overrides};
    }
    let dirty = false, selectedPlace = "";
    const requireSaved = () => { if (dirty) throw new Error("Có thay đổi hồ sơ chưa lưu. Hãy lưu trước khi duyệt hoặc thực hiện thao tác khác."); };
    function render(p) {
      dirty = false;
      const version = p?.cms?.version || 0;
      const url = p ? "/admin/places/" + encodeURIComponent(p.id) : "/admin/places";
      const status = p ? ({pending:"Chờ xác minh", verified:"Đã xác minh", archived:"Đã lưu trữ"}[p.cms?.status] ||
        (p.is_verified ? "Đã xác minh (dữ liệu cũ)" : "Chưa xác minh")) : "Hồ sơ mới · chưa xác minh";
      body.innerHTML = note(status + " · Phiên bản " + version) + C.form(
        field("name", "Tên quán", p?.name || "", "text", 'required maxlength="200"') +
        field("address", "Địa chỉ", p?.address || "", "text", 'required maxlength="1000"') +
        field("lat", "Vĩ độ", p?.lat ?? "", "number", 'min="-90" max="90" step="any"') +
        field("lng", "Kinh độ", p?.lng ?? "", "number", 'min="-180" max="180" step="any"') +
        field("phone", "Điện thoại", p?.phone || "", "tel", 'maxlength="200"') +
        check("has_ac", "Có máy lạnh", p?.has_ac === true) +
        check("has_kids_seat", "Có ghế trẻ em", p?.has_kids_seat === true) +
        sourceFields("source", "Nguồn thông tin quán", p?.cms?.source) +
        sourceFields("image", "Nguồn ảnh (nếu có ảnh)", p?.cms?.image_source) +
        area("evidence", "Bằng chứng xác minh thực tế", p?.cms?.evidence || "") +
        C.card("Thực đơn", note("Sửa thực đơn hoặc giá cần xác minh lại. Món nháp chỉ được lưu nội bộ.") +
          '<div data-menu>' + (p?.menu || []).map(menuHTML).join("") + "</div>" + btn("Thêm món", "add-menu")) +
        C.card("Giờ mở cửa — múi giờ Việt Nam", note("Không có khoảng giờ = đóng cửa. Cả ngày: 00:00–24:00. Qua đêm: 22:00–02:00.") +
          days.map((label, i) => '<div data-weekday="' + i + '"><b>' + label + "</b>" +
            scheduleHTML(p?.opening_hours?.weekly?.[String(i)]) + "</div>").join("") +
          '<div data-overrides>' + Object.entries(p?.opening_hours?.overrides || {}).map(([date, pairs]) => overrideHTML(date, pairs)).join("") +
          "</div>" + btn("Thêm ngày ngoại lệ", "add-override")) +
        area("reason", "Lý do lưu (ghi nhật ký)", "") +
        note("Lưu thay đổi đưa hồ sơ về chờ xác minh, không tự duyệt hoặc mở lại quán đang tạm dừng.") +
        C.button(p ? "Lưu thay đổi và chờ xác minh" : "Tạo hồ sơ chờ xác minh"));
      const f = body.querySelector("form");
      f.addEventListener("input", () => {dirty=true;});
      f.addEventListener("change", () => {dirty=true;});
      f.addEventListener("click", event => {
        const b = event.target.closest("button");
        if (!b || !f.contains(b)) return;
        const a = b.dataset.action;
        if (!a || a === "submit") return;
        dirty = true;
        if (a === "add-menu") f.querySelector("[data-menu]").insertAdjacentHTML("beforeend", menuHTML());
        else if (a === "remove-menu") b.closest("[data-menu-row]").remove();
        else if (a === "add-interval") b.previousElementSibling.insertAdjacentHTML("beforeend", intervalHTML());
        else if (a === "remove-interval") b.closest("[data-interval]").remove();
        else if (a === "add-override") f.querySelector("[data-overrides]").insertAdjacentHTML("beforeend", overrideHTML());
        else if (a === "remove-override") b.closest("[data-override]").remove();
      });
      f.addEventListener("submit", event => {
        event.preventDefault();
        C.run(f, async () => {
          const menu = [...f.querySelectorAll("[data-menu-row]")].map(row => ({
            dish_id:row.querySelector('[name="dish_id"]').value,
            name:row.querySelector('[name="menu_name"]').value.trim(),
            price:Number(row.querySelector('[name="price"]').value),
            available:row.querySelector('[name="available"]').checked
          }));
          if (menu.some(m => !m.dish_id)) throw new Error("Cần chọn món cho mỗi dòng thực đơn.");
          if (new Set(menu.map(m => m.dish_id)).size !== menu.length) throw new Error("Thực đơn có món trùng nhau.");
          const data = {
            version, name:val(f,"name"), address:val(f,"address"), phone:val(f,"phone"),
            has_ac:checked(f,"has_ac"), has_kids_seat:checked(f,"has_kids_seat"),
            source:readSource(f,"source"), menu, opening_hours:readHours(f), reason:val(f,"reason")
          };
          for (const key of ["lat","lng"]) if (val(f,key)) data[key] = number(f,key);
          if (val(f,"evidence")) data.evidence = val(f,"evidence");
          const image = readSource(f,"image");
          if (p?.img_key || image.author || image.url || image.license) data.image_source = image;
          await C.api(url, p ? "PATCH" : "POST", data);
        });
      });
      if (!p) return;
      body.insertAdjacentHTML("beforeend",
        C.card("Xác minh hồ sơ đã lưu", note("Chỉ duyệt dữ liệu đã lưu, không dùng các ô sửa chưa lưu phía trên. Duyệt không gỡ tạm dừng.") +
          C.form(area("approval_evidence", "Bằng chứng dùng để duyệt", p.cms?.evidence || "") +
          area("approval_reason", "Lý do duyệt", "") + C.button("Duyệt hồ sơ đã lưu"))) +
        C.card("Ẩn hồ sơ quán", C.form(area("archive_reason", "Lý do lưu trữ", "") + C.button("Lưu trữ hồ sơ"))));
      const forms = body.querySelectorAll("form");
      forms[1].addEventListener("submit", event => {
        event.preventDefault();
        C.run(forms[1], async () => {
          requireSaved();
          const evidence = val(forms[1],"approval_evidence"), reason = val(forms[1],"approval_reason");
          if (!evidence || !reason) throw new Error("Cần bằng chứng và lý do duyệt.");
          if (!p.cms) throw new Error("Hồ sơ cũ cần lưu thông tin, nguồn và giờ trước khi xác minh.");
          await C.api(url + "/approve", "POST", {version, evidence, reason});
        });
      });
      forms[2].addEventListener("submit", event => {
        event.preventDefault();
        C.run(forms[2], async () => {
          requireSaved();
          const reason = val(forms[2],"archive_reason");
          if (!reason) throw new Error("Cần lý do lưu trữ hồ sơ.");
          await C.api(url + "/archive", "POST", {version, reason});
        });
      });
      if (p.menu?.length) {
        body.insertAdjacentHTML("beforeend", C.card("Tình trạng còn món — không thay đổi xác minh",
          note("Chỉ đổi tình trạng món đã lưu; không sửa giá, không duyệt hoặc mở lại quán.") +
          C.form(select("available_dish", "Chọn món cần đổi tình trạng", p.menu[0].dish_id,
            p.menu.map(m => [m.dish_id, m.name || dishes.find(a => a.id === m.dish_id)?.name || m.dish_id])) +
          check("available_now", "Đang có món", p.menu[0].available === true) +
          area("availability_reason", "Lý do đổi tình trạng", "") + C.button("Lưu tình trạng còn món"))));
        const af = body.querySelectorAll("form")[3];
        af.elements.available_dish.addEventListener("change", () => {
          af.elements.available_now.checked = p.menu.find(m => m.dish_id === val(af,"available_dish"))?.available === true;
        });
        af.addEventListener("submit", event => {
          event.preventDefault();
          C.run(af, async () => {
            requireSaved();
            await C.api(url + "/availability", "PATCH", {version, dish_id:val(af,"available_dish"),
              available:checked(af,"available_now"), reason:val(af,"availability_reason")});
          });
        });
      }
    }
    picker.addEventListener("change", () => {
      if (dirty && !window.confirm("Bỏ các thay đổi chưa lưu để chuyển quán?")) {picker.value=selectedPlace;return;}
      selectedPlace=picker.value;render(places.find(p => p.id === picker.value));
    });
    render();
    const importer = host.querySelector("[data-import-card]");
    importer.innerHTML = C.card("Nhập quán từ CSV",
      note("UTF-8, tối đa 500 KB / 500 dòng. Header: name,address,lat,lng,phone,opening_hours,menu,source_author,source_url,source_license,evidence,is_example. Giờ/menu trong CSV theo mẫu; dùng trình nhập quán phía trên nếu không dùng CSV. Dòng ví dụ và trùng được bỏ qua; dữ liệu nhập luôn chờ xác minh.") +
      C.form(field("csv_file", "Chọn tệp CSV", "", "file", 'accept=".csv,text/csv" required') +
        area("import_reason", "Lý do nhập dữ liệu", "") +
        C.button("Chạy thử CSV (không ghi dữ liệu)") +
        '<div data-import-result role="status" aria-live="polite"></div>' +
        btn("Xác nhận nhập CSV đã chạy thử", "import-csv")));
    const inf = importer.querySelector("form"), file = inf.elements.csv_file;
    const importButton = inf.querySelector('[data-action="import-csv"]');
    importButton.disabled = true;
    let preview = null;
    const resultNode = inf.querySelector("[data-import-result]");
    const invalidate = () => { preview = null; importButton.disabled = true; resultNode.textContent = ""; };
    file.addEventListener("change", invalidate);
    inf.elements.import_reason.addEventListener("input", invalidate);
    function showResult(r) {
      const lines = [
        "Sẽ tạo: " + (r.would_create ?? 0) + " · Đã tạo: " + (r.created ?? 0),
        "Dòng trùng bỏ qua: " + ((r.duplicates || []).join(", ") || "không"),
        "Dòng ví dụ bỏ qua: " + ((r.examples || []).join(", ") || "không"),
        ...(r.errors || []).map(e => "Dòng " + e.line + ": " + e.error)
      ];
      resultNode.replaceChildren(...lines.map(line => {
        const p = document.createElement("p"); p.textContent = line; return p;
      }));
    }
    const getCsv = async () => {
      const selected = file.files[0];
      if (!selected) throw new Error("Cần chọn tệp CSV.");
      if (selected.size > 500000) throw new Error("Tệp CSV vượt quá 500 KB.");
      return selected.text();
    };
    const importApi = async data => {
      try { return await C.api("/admin/places/import", "POST", data); }
      catch (e) {
        // Parent's API helper may attach a structured non-2xx payload.
        const r = e.data || e.body;
        if (r?.errors) showResult(r);
        throw e;
      }
    };
    inf.addEventListener("submit", event => {
      event.preventDefault();
      preview = null;
      importButton.disabled = true;
      C.run(inf, async () => {
        const csv = await getCsv(), reason = val(inf,"import_reason");
        const r = await importApi({csv, dry_run:true, reason, version:0});
        showResult(r);
        if (!(r.errors || []).length && r.would_create > 0) preview = {csv, reason};
        return "Đã chạy thử; chưa ghi dữ liệu. Kiểm tra kết quả rồi xác nhận nhập.";
      }).finally(() => { importButton.disabled = !preview; });
    });
    importButton.addEventListener("click", () => {
      C.run(inf, async () => {
        if (!preview) throw new Error("Cần chạy thử CSV thành công trước khi nhập.");
        const approved = preview;
        if (await getCsv() !== approved.csv || val(inf,"import_reason") !== approved.reason) {
          invalidate(); throw new Error("Tệp hoặc lý do đã đổi; cần chạy thử lại.");
        }
        const r = await importApi({...approved, dry_run:false, version:0});
        showResult(r); preview = null; C.refresh();
        return "Đã nhập " + r.created + " hồ sơ chờ xác minh theo phản hồi máy chủ.";
      }).finally(() => { importButton.disabled = !preview; });
    });
    // Read-only public catalogue fallback is allowed for ops_admin.
    if (!(d.catalog || []).length) {
      C.run(inf, async () => {
        const all = [];
        let page = 1, last = 1;
        do {
          const r = await C.api("/dishes?limit=100&page=" + page);
          all.push(...(r.items || [])); last = r.total_pages || 1; page++;
        } while (page <= last);
        for (const a of all) if (!dishes.some(x => x.id === a.id)) dishes.push(a);
        // Update options only, preserving any unsaved form edits.
        for (const s of body.querySelectorAll('[name="dish_id"]')) {
          const current = s.value;
          s.innerHTML = '<option value="">Chọn món</option>' + dishes.map(a =>
            '<option value="' + E(a.id) + '">' + E(a.name) + "</option>").join("");
          s.value = current;
        }
        return "Đã tải danh sách món công khai để chọn thực đơn.";
      }).finally(() => { importButton.disabled = !preview; });
    }
  }
  window.M9FormsParts = {...window.M9FormsParts, places:mountPlaces};
})();
