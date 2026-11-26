/* M16 live wiring — M16-S01 menu translator (POST /translate/menu, glossary engine, no LLM),
 * M16-S02 pronunciation / ordering card (GET /translate/phrases, audio via speechSynthesis),
 * desktop tab "translator" (replaces the legacy loadLiveTranslator). */
(function () {
  const LANGS = [["EN", "🇬🇧 EN"], ["KO", "🇰🇷 KO"], ["JA", "🇯🇵 JA"], ["ZH", "🇨🇳 ZH"]];
  let lang = "EN";
  let menu = ""; // lines typed by the user; empty = sample menu from the dish catalogue
  let run = 0;
  const fail = (d) => d && d.error && !d.items;
  async function get(ctx, path, method, body) {
    let d;
    try { d = await ctx.api(path, method, body); }
    catch (e) { throw Object.assign(new Error(e.status === 400 ? "Thực đơn trống hoặc quá 60 dòng — mỗi món 1 dòng." : "Chưa dịch được. Kiểm tra mạng rồi thử lại."), { status: e.status }); }
    if (fail(d)) throw Object.assign(new Error(d.error), { status: 400 });
    return d;
  }
  const translate = (ctx) => get(ctx, "/translate/menu", "POST", menu.trim() ? { target_lang: lang, lines: menu.split("\n") } : { target_lang: lang });
  function speak(ctx, text) {
    if (!text) return;
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "vi-VN"; u.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      ctx.status("🔊 " + text);
    } else ctx.status("Thiết bị chưa hỗ trợ đọc to. Đưa thẻ này cho chủ quán: " + text);
  }
  const chips = (ctx, act) => `<div class="flex gap-1.5">${LANGS.map(([l, t]) => `<button type="button" onclick="P2.live.M16.${act}('${l}')" class="flex-1 py-1.5 rounded-full border text-[10px] font-extrabold ${l === lang ? "bg-[#18181B] text-white border-[#18181B]" : "bg-white border-[#E2E8F0] text-[#334155]"}">${t}</button>`).join("")}</div>`;
  const statusPill = (i, ctx) => i.status === "translated" ? ""
    : i.status === "partial" ? `<span class="px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] text-[9px] font-extrabold">${ctx.H(i.status_label)}</span>`
      : ""; // the title slot already reads "chưa dịch được"
  function card(i, ctx, desk) {
    const warn = [i.allergen_warning, i.possible_allergen_warning].filter(Boolean);
    const price = i.price_vnd ? `${ctx.money(i.price_vnd)}${i.price_hint ? ` ≈ ${i.price_hint.amount}` : ""}` : "";
    const say = i.ordering_phrase_vi || i.original_vietnamese_name;
    return desk ? `
      <div class="genui-card p-5 rounded-3xl space-y-3 border border-[var(--border-subtle)] flex flex-col justify-between">
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FBBF24]/20 text-[#B45309]">${ctx.H(lang)}</span>${statusPill(i, ctx)}</div>
          <div><h4 class="font-black text-sm text-[var(--text-main)]">${ctx.H(i.original_vietnamese_name)}</h4>
            <div class="font-bold text-xs ${i.translated_title ? "text-[#22C55E]" : "text-[var(--text-muted)]"} mt-0.5">${ctx.H(i.translated_title || "chưa dịch được")}</div></div>
          ${i.cultural_note ? `<p class="text-[11px] text-[var(--text-muted)] leading-relaxed">${ctx.H(i.cultural_note)}</p>` : ""}
          ${price ? `<div class="text-[11px] font-bold">${ctx.H(price)}</div>` : ""}
          ${warn.map((w) => `<div class="p-2 rounded-xl bg-amber-500/10 text-amber-600 text-[10px] font-medium border border-amber-500/20">⚠️ ${ctx.H(w)}</div>`).join("")}
        </div>
        ${say ? `<div class="pt-2 border-t border-[var(--border-subtle)] space-y-1.5"><div class="text-[10px] text-[var(--text-muted)]">Câu gọi món tại quán:</div>
          <div class="p-2 rounded-xl bg-[var(--bg-elevated)] text-[11px] font-medium flex items-center justify-between gap-2"><span class="italic">"${ctx.H(say)}"</span>
          <button onclick="P2.live.M16.speak('${ctx.J(say)}')" class="px-2 py-1 rounded-lg bg-[#FBBF24] text-[#0F172A] text-[10px] font-black shrink-0">🔊 Nghe</button></div></div>` : ""}
      </div>` : `
      <div class="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
        <div class="flex items-start justify-between gap-2"><b class="text-[12px]">${ctx.H(i.original_vietnamese_name)}</b>${price ? `<span class="text-[10px] font-extrabold shrink-0">${ctx.H(price)}</span>` : ""}</div>
        <div class="flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold ${i.translated_title ? "text-[#15803D]" : "text-[#94A3B8]"}">${ctx.H(i.translated_title || "chưa dịch được")}</span>${statusPill(i, ctx)}</div>
        ${i.cultural_note ? `<div class="text-[10px] text-[#64748B] leading-snug">${ctx.H(i.cultural_note)}</div>` : ""}
        ${warn.map((w) => `<div class="px-2 py-1 rounded-xl bg-[#FFE4E6] text-[#BE123C] text-[10px] font-bold">⚠️ ${ctx.H(w)}</div>`).join("")}
        ${say ? `<div class="flex items-center justify-between gap-2 pt-0.5"><span class="text-[10px] italic text-[#334155]">"${ctx.H(say)}"</span><button type="button" onclick="P2.live.M16.speak('${ctx.J(say)}')" class="px-2.5 py-1 rounded-full bg-[#FBBF24] text-[10px] font-extrabold shrink-0">🔊 Đọc</button></div>` : ""}
      </div>`;
  }
  const sourceLine = (d) => d.source === "catalogue" ? "Thực đơn mẫu từ thư viện món — dán thực đơn của quán để dịch." : d.source === "place_menu" ? "Thực đơn của " + (d.place_name || "quán") : "Thực đơn anh vừa nhập";

  window.TOV_LIVE.register("M16", {
    screens: {
      "M16-S01": {
        key: () => lang + ":" + run,
        load: (ctx) => translate(ctx),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const im = ctx.$("img[data-img]", root);
          const c = d.counts || {};
          im?.insertAdjacentHTML("afterend", `
            ${chips(ctx, "lang")}
            <div class="space-y-1.5">
              <textarea id="m16-menu" rows="3" placeholder="Dán thực đơn tiếng Việt, mỗi món 1 dòng — ví dụ: Phở bò tái nạm 45.000đ" class="w-full px-3 py-2 rounded-2xl border border-[#E2E8F0] bg-white text-xs">${ctx.H(menu)}</textarea>
              <div class="flex gap-2"><button type="button" onclick="P2.live.M16.translate()" class="flex-1 py-2 rounded-full bg-[#18181B] text-white font-extrabold">Dịch thực đơn</button>${menu ? `<button type="button" onclick="P2.live.M16.sample()" class="px-3 py-2 rounded-full bg-white border border-[#E2E8F0] font-bold">Thực đơn mẫu</button>` : ""}</div>
              <div class="text-[10px] text-[#64748B]">${ctx.H(sourceLine(d))} · Dịch bằng từ điển món (${c.translated || 0} khớp món, ${c.partial || 0} dịch từng từ, ${c.untranslated || 0} chưa dịch được). Tên tiếng Việt luôn được giữ.</div>
              ${d.fx_note ? `<div class="flex flex-wrap items-center gap-1.5 text-[9px] text-[#94A3B8]">${d.fx_is_demo ? ctx.demoPill() : ""}<span>Quy đổi: ${ctx.H(d.fx_note)}</span></div>` : ""}
            </div>
            <div class="space-y-2" data-m16-items>${(d.items || []).map((i) => card(i, ctx)).join("")}</div>`);
          return root;
        },
      },
      "M16-S02": {
        key: () => lang,
        load: (ctx) => get(ctx, "/translate/phrases?lang=" + lang),
        bind(html, d, ctx) {
          if (!d.items?.length) return ctx.stateHtml("M16-S02", "empty");
          const root = ctx.dom(html);
          const cards = ctx.$$(":scope > .p-3\\.5", root);
          const [orderTpl, allergyTpl] = cards;
          cards.forEach((n) => n.remove());
          root.firstElementChild.insertAdjacentHTML("afterend", chips(ctx, "phraseLang"));
          d.items.forEach((p) => {
            const n = (p.kind === "allergy" ? allergyTpl : orderTpl).cloneNode(true);
            ctx.text(ctx.$("b", n), `"${p.vi}"`);
            ctx.text(ctx.$("b + div", n), `${d.language}: ${p.translation}${p.from_profile ? " · theo hồ sơ dị ứng của anh" : ""}`);
            const btn = ctx.$("button", n);
            btn.setAttribute("type", "button");
            btn.classList.add("shrink-0", "whitespace-nowrap");
            n.classList.add("gap-2");
            ctx.click(btn, `P2.live.M16.speak('${ctx.J(p.vi)}')`);
            root.append(n);
          });
          root.insertAdjacentHTML("beforeend", `<div class="text-[10px] text-[#64748B]">🔊 Đọc bằng giọng tiếng Việt của trình duyệt (vi-VN). Đưa màn hình cho chủ quán nếu máy không đọc được.</div>`);
          return root;
        },
      },
    },
    actions: {
      lang(ctx, l) { lang = l; ctx.reload("M16-S01"); },
      phraseLang(ctx, l) { lang = l; ctx.reload("M16-S02"); },
      translate(ctx) {
        menu = document.getElementById("m16-menu")?.value || "";
        run++;
        ctx.reload("M16-S01");
      },
      sample(ctx) { menu = ""; run++; ctx.reload("M16-S01"); },
      speak(ctx, text) { speak(ctx, text); },
      deskTranslate(ctx) {
        menu = document.getElementById("m16-desk-menu")?.value || "";
        window.loadLiveTranslator(lang);
      },
    },
    fns: {
      async loadLiveTranslator(ctx, l) {
        if (l) lang = l;
        const grid = document.getElementById("live-translator-grid");
        if (!grid) return;
        if (!document.getElementById("m16-desk-menu")) {
          grid.insertAdjacentHTML("beforebegin", `
            <div class="genui-card p-4 rounded-3xl border border-[var(--border-subtle)] space-y-2">
              <textarea id="m16-desk-menu" rows="3" placeholder="Dán thực đơn tiếng Việt, mỗi món 1 dòng — ví dụ: Bún bò Huế 50.000đ" class="w-full px-3 py-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs"></textarea>
              <div class="flex flex-wrap items-center gap-2"><button onclick="P2.live.M16.deskTranslate()" class="px-4 py-2 rounded-xl bg-[#18181B] text-white text-xs font-extrabold">Dịch thực đơn</button><span id="m16-desk-note" class="text-[11px] text-[var(--text-muted)]"></span></div>
            </div>`);
        }
        grid.innerHTML = '<div class="col-span-3 text-center py-10 text-xs text-[var(--text-muted)]">Đang dịch thực đơn…</div>';
        try {
          const d = await translate(ctx);
          const c = d.counts || {};
          const note = document.getElementById("m16-desk-note");
          if (note) note.innerHTML = `${ctx.H(sourceLine(d))} · ${c.translated || 0} khớp món, ${c.partial || 0} dịch từng từ, ${c.untranslated || 0} chưa dịch được${d.fx_note ? ` · Quy đổi: ${ctx.H(d.fx_note)} ${d.fx_is_demo ? ctx.demoPill() : ""}` : ""}`;
          grid.innerHTML = (d.items || []).map((i) => card(i, ctx, true)).join("");
        } catch (e) {
          grid.innerHTML = `<div class="col-span-3 text-center py-6 text-xs text-red-500">${ctx.H(e.message || "Lỗi dịch thực đơn.")}</div>`;
        }
      },
    },
  });

})();
