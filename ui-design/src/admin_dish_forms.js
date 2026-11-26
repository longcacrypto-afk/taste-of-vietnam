(function () {
  "use strict";

  function mount(root, screen, dashboard, C) {
    if (!["M9-S02", "M9-S03"].includes(screen) || !C.canContent ||
        !["content_moderator", "super_admin"].includes(C.role)) return;
    const content = root.lastElementChild?.lastElementChild;
    if (!content || content.querySelector("[data-dish-forms]")) return;
    const E = window.escHtml;
    const dishes = Array.isArray(dashboard.dishes) ? dashboard.dishes : (dashboard.catalog || []);
    const host = document.createElement("div");
    host.dataset.dishForms = "";
    content.appendChild(host);
    const recipe = screen === "M9-S03";
    const statuses = {draft: "Bản nháp", published: "Đã xuất bản", archived: "Đã lưu trữ"};
    const meals = [["breakfast", "Bữa sáng"], ["lunch", "Bữa trưa"], ["dinner", "Bữa tối"],
      ["snack", "Ăn vặt"], ["late_night", "Ăn khuya"]];
    const regions = [["bac", "Miền Bắc"], ["trung", "Miền Trung"], ["nam", "Miền Nam"],
      ["Miền Bắc", "Miền Bắc (dữ liệu cũ)"], ["Miền Trung", "Miền Trung (dữ liệu cũ)"],
      ["Miền Nam", "Miền Nam (dữ liệu cũ)"], ["Toàn quốc", "Toàn quốc"]];
    const para = text => `<p class="text-[#64748B]">${E(String(text))}</p>`;
    const value = (form, name) => form.elements.namedItem(name)?.value ?? "";
    const checked = (form, name) => Boolean(form.elements.namedItem(name)?.checked);
    const num = (name, label, v, max, step = 1, min = 0) =>
      C.field(name, label, v ?? "", "number", `min="${min}" max="${max}" step="${step}"`);
    const path = dish => "/admin/dishes/" + encodeURIComponent(dish.id);
    const version = dish => dish?.cms?.version ?? 0;
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const tags = input => [...new Set(input.split(",").map(s => s.trim()).filter(Boolean))];
    function numeric(form, name, optional = false) {
      const raw = value(form, name).trim();
      if (!raw && optional) return undefined;
      if (!raw || !Number.isFinite(Number(raw))) throw new Error("Cần nhập số hợp lệ.");
      return Number(raw);
    }
    function wire(form, job) {
      form.addEventListener("submit", event => {
        event.preventDefault();
        if (form.reportValidity()) C.run(form, () => job(form));
      });
    }
    // All mutable state belongs to this mounted DOM. Switching records discards nothing silently.
    function dirty(container) {
      container.addEventListener("input", () => { container.dataset.dirty = "true"; });
      container.addEventListener("change", () => { container.dataset.dirty = "true"; });
    }
    function requireSaved(panel) {
      if (panel.dataset.dirty === "true" || panel.querySelector('form[data-dirty="true"]'))
        throw new Error("Có thay đổi chưa lưu. Hãy lưu bản nháp trước khi xác minh hoặc xuất bản.");
    }
    function sourceFields(dish) {
      return ["source", "image_source"].map(key => {
        const source = dish?.cms?.[key] || {};
        const label = key === "source" ? "Nguồn công thức" : "Nguồn ảnh";
        return C.card(label,
          C.field(key + "_author", label + " · Tác giả", source.author || "", "text", 'maxlength="200"') +
          C.field(key + "_url", label + " · URL (nếu có)", source.url || "", "url", 'maxlength="2000"') +
          C.field(key + "_license", label + " · Quyền sử dụng", source.license || "", "text", 'maxlength="500"'));
      }).join("");
    }
    function readSources(form) {
      const out = {};
      for (const key of ["source", "image_source"]) {
        const source = {
          author: value(form, key + "_author").trim(),
          url: value(form, key + "_url").trim(),
          license: value(form, key + "_license").trim()
        };
        if (source.author || source.url || source.license) out[key] = source;
      }
      return out;
    }
    function macroFields(dish) {
      const macros = dish?.macros || {};
      return [["protein", "Đạm"], ["carbs", "Tinh bột"], ["fat", "Chất béo"], ["fiber", "Chất xơ"]]
        .map(([key, label]) => {
          const keys = Object.hasOwn(macros, key + "_g")
            ? (Object.hasOwn(macros, key) ? [key, key + "_g"] : [key + "_g"]) : [key];
          return keys.map(k => num("macro_" + k,
            `${label} mỗi suất (g)${keys.length > 1 ? " · " + k : ""}`, macros[k], 10000, "any")).join("");
        }).join("");
    }
    function readMacros(form, dish) {
      const out = {...(dish?.macros || {})};
      for (const el of form.querySelectorAll('[name^="macro_"]')) {
        if (!el.value.trim() && Object.hasOwn(out, el.name.slice(6)))
          throw new Error("Không thể để trống chỉ số dinh dưỡng đã lưu.");
        if (el.value.trim()) out[el.name.slice(6)] = numeric(form, el.name);
      }
      return out;
    }
    function nutritionFields(dish) {
      return num("base_servings", "Khẩu phần gốc (người, 1–10)", dish?.base_servings ?? 2, 10, 1, 1) +
        num("market_cost_base", "Chi phí nguyên liệu cho khẩu phần gốc (VND)", dish?.market_cost_base ?? 0, 100000000) +
        num("calories", "Năng lượng mỗi suất (kcal)", dish?.calories ?? 450, 10000) + macroFields(dish);
    }
    function readNutrition(form, dish) {
      return {base_servings: numeric(form, "base_servings"),
        market_cost_base: numeric(form, "market_cost_base"),
        calories: numeric(form, "calories"), macros: readMacros(form, dish)};
    }
    function patch(initial, next, dish) {
      const out = {version: version(dish)};
      for (const [key, val] of Object.entries(next)) if (!same(val, initial[key])) out[key] = val;
      // Do not silently keep a cleared source, or turn a blank source into a fake attribution.
      for (const key of ["source", "image_source"])
        if (initial[key] && !next[key]) throw new Error("Không thể xóa trắng nguồn đã lưu. Hãy nhập tác giả và quyền sử dụng hợp lệ.");
      if (Object.keys(out).length === 1) return null;
      return out;
    }
    function sourcePreview(source) {
      return source ? `${source.author || "—"} · ${source.license || "—"} · ${source.url || "Không có URL"}` : "Chưa có nguồn/quyền sử dụng";
    }
    function preview(dish) {
      const facts = [
        dish.name || "Chưa có tên", "Vùng: " + (dish.region || "—"),
        "Trạng thái: " + (statuses[dish.cms?.status] || "Dữ liệu cũ · chưa qua CMS") + " · Phiên bản " + version(dish),
        "Bữa ăn: " + (dish.meal_slots || []).map(k => meals.find(m => m[0] === k)?.[1] || k).join(", "),
        "Độ cay: " + (dish.spice_level ?? "—") + " · Giá tham khảo: " + (dish.ref_price ?? "—") + " VND",
        "Dị ứng: " + ((dish.allergen_tags || []).join(", ") || "Chưa gắn nhãn; không đồng nghĩa an toàn"),
        "Chế độ ăn: " + ((dish.diet_flags || []).join(", ") || "Chưa gắn nhãn"),
        `Khẩu phần: ${dish.base_servings ?? "—"} người · Chi phí gốc: ${dish.market_cost_base ?? "—"} VND`,
        `Mỗi suất: ${dish.calories ?? "—"} kcal · ` + Object.entries(dish.macros || {}).map(([k, v]) => `${k}: ${v} g`).join(" · "),
        "Nguồn công thức: " + sourcePreview(dish.cms?.source),
        "Ảnh: " + (dish.img_key || "Chưa có ảnh; ảnh minh họa không phải xác nhận đúng món"),
        "Nguồn ảnh: " + sourcePreview(dish.cms?.image_source),
        "Bằng chứng xác minh: " + (dish.cms?.evidence || "Chưa xác minh"),
        "Người xác minh: " + (dish.cms?.verified_by || "—") + " · " + (dish.cms?.verified_at || "—")
      ];
      return facts.map(para).join("") + para("Nguyên liệu cho khẩu phần gốc") +
        "<ul>" + (dish.ingredients || []).map(i => `<li>${E(`${i.name} · ${i.amount} ${i.unit}${i.is_allergen ? " · Có dị ứng" : ""}`)}</li>`).join("") +
        "</ul>" + para("Các bước nấu") + "<ol>" +
        (dish.steps || []).map((s, i) => `<li>${E(`${i + 1}. ${s.title || ""} · ${s.duration_min ?? 0} phút · ${s.text || ""}`)}</li>`).join("") + "</ol>";
    }

    host.innerHTML = C.card(recipe ? "Chọn công thức cần biên tập" : "Thêm hoặc sửa món ăn",
      C.select("dish_picker", "Món ăn (gồm bản nháp và lưu trữ)", "",
        [["", recipe ? "Chọn món ăn" : "Món mới"], ...dishes.map(a => [a.id, a.name])])) +
      '<div data-dish-panel></div>';
    const picker = host.querySelector('[name="dish_picker"]');
    const panel = host.querySelector("[data-dish-panel]");
    function render(dish) {
      panel.innerHTML = "";
      delete panel.dataset.dirty;
      if (recipe && !dish) {
        panel.innerHTML = C.card("Công thức", para("Chọn một món ở trên. Tạo món mới trong Thư viện món ăn."));
        return;
      }
      const editor = document.createElement("div");
      panel.appendChild(editor);
      if (recipe) renderRecipe(editor, dish);
      else renderBasics(editor, dish);
      if (!dish) return;
      const lifecycle = document.createElement("div");
      panel.appendChild(lifecycle);
      lifecycle.innerHTML = C.card("Xem trước & phiên bản",
        C.form(C.button("Xem trước bản đã lưu")) + '<div data-preview></div>') +
        C.card("Lịch sử & khôi phục",
          para("Khôi phục tạo bản nháp mới và thu hồi xác minh; không ghi đè lịch sử.") +
          C.form(C.button("Tải lịch sử phiên bản")) + '<div data-versions></div>') +
        C.card("Lưu trữ món ăn", para("Ẩn món nhưng giữ bản ghi và lịch sử.") +
          C.form(C.check("confirm_archive", "Tôi xác nhận lưu trữ món này", false) + C.button("Lưu trữ món")));
      const [previewForm, historyForm, archiveForm] = lifecycle.querySelectorAll("form");
      wire(previewForm, async () => {
        const loaded = await C.api(path(dish));
        lifecycle.querySelector("[data-preview]").innerHTML = preview(loaded);
        return "Đã tải bản lưu trên máy chủ; không thay đổi nội dung.";
      });
      wire(historyForm, async () => {
        const result = await C.api(path(dish) + "/versions");
        const list = lifecycle.querySelector("[data-versions]");
        list.innerHTML = "";
        if (!result.items?.length) list.innerHTML = para("Chưa có phiên bản CMS đã lưu.");
        for (const revision of result.items || []) {
          const row = document.createElement("div");
          row.innerHTML = C.card("Phiên bản " + revision.version,
            para("Thời điểm: " + (revision.created_at || "—")) +
            `<details><summary>${E("Xem nội dung phiên bản " + revision.version)}</summary>${preview(revision.snapshot || {})}</details>` +
            C.form(C.check("confirm_restore", "Tôi xác nhận khôi phục bản này thành bản nháp", false) +
              C.button("Khôi phục phiên bản " + revision.version)));
          list.appendChild(row);
          wire(row.querySelector("form"), async form => {
            if (!checked(form, "confirm_restore")) throw new Error("Cần xác nhận khôi phục.");
            requireSaved(editor);
            await C.api(path(dish) + "/restore", "POST", {version: version(dish), restore_version: revision.version});
          });
        }
        return "Đã tải lịch sử. Khôi phục luôn cần xác minh và xuất bản lại.";
      });
      wire(archiveForm, async form => {
        requireSaved(editor);
        if (!checked(form, "confirm_archive")) throw new Error("Cần xác nhận lưu trữ.");
        await C.api(path(dish) + "/archive", "POST", {version: version(dish)});
      });
    }
    function renderBasics(editor, dish) {
      editor.innerHTML = C.card(dish ? "Thông tin món ăn" : "Tạo món ăn mới",
        para("Mọi sửa nội dung sẽ đưa món về bản nháp, thu hồi xác minh và ẩn khỏi danh mục công khai cho đến khi duyệt/xuất bản lại.") +
        C.form(
          C.field("name", "Tên món", dish?.name || "", "text", 'required maxlength="120"') +
          C.select("region", "Vùng miền", dish?.region || "nam", regions) +
          meals.map(([key, label]) => C.check("meal_" + key, label, (dish?.meal_slots || ["lunch", "dinner"]).includes(key))).join("") +
          C.select("spice_level", "Độ cay", String(dish?.spice_level ?? 1),
            [["0", "Không cay"], ["1", "Cay nhẹ"], ["2", "Cay vừa"], ["3", "Cay nhiều"]]) +
          C.field("allergen_tags", "Nhãn dị ứng (mã cách nhau bằng dấu phẩy)", (dish?.allergen_tags || []).join(", ")) +
          C.field("diet_flags", "Nhãn chế độ ăn (mã cách nhau bằng dấu phẩy)", (dish?.diet_flags || []).join(", ")) +
          num("ref_price", "Giá tham khảo (VND)", dish?.ref_price ?? 50000, 100000000) +
          nutritionFields(dish) +
          C.field("img_key", "Mã ảnh (để trống nếu chưa có)", dish?.img_key || "", "text", 'maxlength="120"') +
          sourceFields(dish) + C.button(dish ? "Lưu thay đổi thành bản nháp" : "Tạo bản nháp")));
      const form = editor.querySelector("form");
      dirty(form);
      function read() {
        return {name: value(form, "name").trim(), region: value(form, "region"),
          meal_slots: meals.filter(([key]) => checked(form, "meal_" + key)).map(([key]) => key),
          spice_level: numeric(form, "spice_level"), allergen_tags: tags(value(form, "allergen_tags")),
          diet_flags: tags(value(form, "diet_flags")), ref_price: numeric(form, "ref_price"),
          ...readNutrition(form, dish), img_key: value(form, "img_key").trim(), ...readSources(form)};
      }
      const initial = read();
      wire(form, async () => {
        const next = read();
        if (!next.meal_slots.length) throw new Error("Chọn ít nhất một bữa ăn.");
        const body = dish ? patch(initial, next, dish) : {version: 0, ...next};
        if (!body) return "Không có thay đổi để lưu.";
        await C.api(dish ? path(dish) : "/admin/dishes", dish ? "PATCH" : "POST", body);
      });
    }
    function renderRecipe(editor, dish) {
      editor.innerHTML = C.card("Biên tập công thức · " + dish.name,
        para("Lưu thay đổi thu hồi xác minh, chuyển về bản nháp và ẩn món. Lưu trước, kiểm tra bằng chứng, xác minh rồi mới xuất bản.") +
        para("Định lượng nguyên liệu và chi phí tính cho khẩu phần gốc; kcal và macro tính cho mỗi suất.") +
        C.form(nutritionFields(dish) + sourceFields(dish) +
          '<div data-ingredient-rows></div>' + C.button("Thêm nguyên liệu", "button") +
          '<div data-step-rows></div>' + C.button("Thêm bước nấu", "button") +
          C.button("Lưu công thức thành bản nháp"))) +
        C.card("Xác minh an toàn",
          para("Không tự coi nhãn trống là không gây dị ứng. Chỉ xác nhận khi đã kiểm tra nguyên liệu, nhãn và nguồn thực tế.") +
          C.form(C.check("allergen_verified", "Đã kiểm tra đầy đủ dị ứng", false) +
            C.check("diet_verified", "Đã kiểm tra đầy đủ chế độ ăn", false) +
            C.area("evidence", "Bằng chứng: ai kiểm, kiểm gì, nguồn nào (bắt buộc)", "") +
            C.button("Xác minh công thức"))) +
        C.card("Xuất bản", para("Chỉ bản đã lưu và đã xác minh trên máy chủ mới được xuất bản.") +
          C.form(C.check("confirm_publish", "Tôi xác nhận xuất bản bản đã xác minh", false) + C.button("Xuất bản món")));
      const [form, verifyForm, publishForm] = editor.querySelectorAll("form");
      dirty(form);
      const ingredients = form.querySelector("[data-ingredient-rows]");
      const steps = form.querySelector("[data-step-rows]");
      let rowSequence = 0;
      function addRow(kind, item = {}) {
        const ingredient = kind === "ingredient";
        const list = ingredient ? ingredients : steps;
        const row = document.createElement("div");
        row.dataset.recipeRow = kind;
        const key = kind + "_" + (++rowSequence) + "_";
        row.dataset.prefix = key;
        row.dataset.hadAllergen = String(Object.hasOwn(item, "is_allergen"));
        row.innerHTML = C.card(ingredient ? "Nguyên liệu" : "Bước nấu",
          C.field(key + "name", ingredient ? "Tên nguyên liệu" : "Tiêu đề bước", ingredient ? (item.name || "") : (item.title || ""),
            "text", `required maxlength="${ingredient ? 200 : 2000}"`) +
          (ingredient
            ? num(key + "amount", "Số lượng cho khẩu phần gốc", item.amount ?? "", 1000000, "any") +
              C.field(key + "unit", "Đơn vị (g, ml…)", item.unit || "", "text", 'required maxlength="40"') +
              C.check(key + "is_allergen", "Nguyên liệu có thành phần gây dị ứng", item.is_allergen === true)
            : C.area(key + "text", "Hướng dẫn nấu", item.text || "") +
              num(key + "duration_min", "Thời gian bước (phút)", item.duration_min ?? 0, 1440, "any")) +
          C.button("Chuyển lên", "button") + C.button("Chuyển xuống", "button") +
          C.button(ingredient ? "Xóa nguyên liệu" : "Xóa bước nấu", "button"));
        list.appendChild(row);
        const buttons = row.querySelectorAll("button");
        buttons[0].addEventListener("click", () => {
          if (row.previousElementSibling) {
            list.insertBefore(row, row.previousElementSibling);
            form.dataset.dirty = editor.dataset.dirty = "true";
          }
        });
        buttons[1].addEventListener("click", () => {
          if (row.nextElementSibling) {
            list.insertBefore(row.nextElementSibling, row);
            form.dataset.dirty = editor.dataset.dirty = "true";
          }
        });
        buttons[2].addEventListener("click", () => { row.remove(); editor.dataset.dirty = "true"; });
      }
      for (const item of dish.ingredients || []) addRow("ingredient", item);
      for (const item of dish.steps || []) addRow("step", item);
      const addButtons = [...form.querySelectorAll("button")].filter(b => !b.closest("[data-recipe-row]"));
      addButtons[0].addEventListener("click", () => {
        if (ingredients.children.length >= 200) return;
        addRow("ingredient"); editor.dataset.dirty = "true";
      });
      addButtons[1].addEventListener("click", () => {
        if (steps.children.length >= 100) return;
        addRow("step"); editor.dataset.dirty = "true";
      });
      function readRows(list, ingredient) {
        return [...list.children].map((row, index) => {
          const key = row.dataset.prefix;
          if (!ingredient) return {step: index + 1, title: value(form, key + "name").trim(),
            text: value(form, key + "text").trim(), duration_min: numeric(form, key + "duration_min")};
          return {name: value(form, key + "name").trim(), amount: numeric(form, key + "amount"),
            unit: value(form, key + "unit").trim(),
            ...(row.dataset.hadAllergen === "true" || checked(form, key + "is_allergen")
              ? {is_allergen: checked(form, key + "is_allergen")} : {})};
        });
      }
      const read = () => ({...readNutrition(form, dish), ...readSources(form),
        ingredients: readRows(ingredients, true), steps: readRows(steps, false)});
      const initial = read();
      wire(form, async () => {
        const body = patch(initial, read(), dish);
        if (!body) return "Không có thay đổi để lưu.";
        await C.api(path(dish), "PATCH", body);
      });
      wire(verifyForm, async f => {
        if (!same(initial, read())) throw new Error("Hãy lưu thay đổi công thức trước khi xác minh.");
        if (!checked(f, "allergen_verified") || !checked(f, "diet_verified"))
          throw new Error("Phải xác nhận cả kiểm tra dị ứng và chế độ ăn.");
        if (!value(f, "evidence").trim()) throw new Error("Cần bằng chứng xác minh.");
        await C.api(path(dish) + "/verify", "POST", {version: version(dish),
          allergen_verified: true, diet_verified: true, evidence: value(f, "evidence").trim()});
      });
      wire(publishForm, async f => {
        if (!same(initial, read())) throw new Error("Hãy lưu thay đổi công thức trước khi xuất bản.");
        if (!checked(f, "confirm_publish")) throw new Error("Cần xác nhận xuất bản.");
        if (dish.safety_status !== "approved" || !dish.cms?.verified_at || !dish.cms?.verified_by)
          throw new Error("Bản hiện tại chưa được xác minh. Hãy xác minh trước rồi tải lại.");
        await C.api(path(dish) + "/publish", "POST", {version: version(dish)});
      });
    }
    picker.addEventListener("change", () => {
      if (panel.querySelector('[data-dirty="true"]') &&
          !window.confirm("Bỏ các thay đổi hoặc xác nhận chưa lưu để chuyển món?")) {
        picker.value = panel.dataset.selected || "";
        return;
      }
      panel.dataset.selected = picker.value;
      render(dishes.find(a => a.id === picker.value));
    });
    render(null);
  }

  window.M9FormsParts = {...window.M9FormsParts, dishes: mount};
})();
