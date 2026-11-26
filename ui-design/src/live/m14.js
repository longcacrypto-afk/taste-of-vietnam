/* M14 live wiring — M14-S01 story, M14-S02 regional variants (GET /api/v1/stories...). */
(function () {
  let current = null; // story id chosen on M14-S01
  window.TOV_LIVE.register("M14", {
    screens: {
      "M14-S01": {
        key: () => current || "first",
        async load(ctx) {
          const list = await ctx.api("/stories");
          const id = current || list.items?.[0]?.id;
          const story = id ? await ctx.api("/stories/" + encodeURIComponent(id)) : null;
          return { items: list.items || [], story };
        },
        bind(html, d, ctx) {
          if (!d.story) return ctx.stateHtml("M14-S01", "empty");
          const root = ctx.dom(html), s = d.story;
          const im = ctx.$("img[data-img]", root);
          if (im && s.img_key) im.setAttribute("data-img", s.img_key);
          const pill = ctx.$(".space-y-1\\.5 > span", root);
          if (pill) pill.textContent = s.tag || "";
          ctx.text(ctx.$("h4", root), s.title);
          ctx.text(ctx.$(".space-y-1\\.5 p", root), s.summary);
          const box = ctx.$(".space-y-1\\.5", root);
          if (box) {
            box.insertAdjacentHTML("beforeend",
              `<div class="flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B]">${s.is_demo ? ctx.demoPill() : ""}<span>${ctx.H(s.region || "")} · ${ctx.H(s.read_min || 0)} phút đọc</span></div>` +
              (s.body || []).map((p) => `<p class="text-[11px] leading-relaxed">${ctx.H(p)}</p>`).join(""));
          }
          if (d.items.length > 1) {
            const chips = d.items.map((it) => `<button type="button" onclick="P2.live.M14.pick('${ctx.J(it.id)}')" class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full border text-[10px] font-bold ${it.id === s.id ? "bg-[#18181B] text-white border-[#18181B]" : "bg-white border-[#E2E8F0]"}">${ctx.H(it.title)}</button>`).join("");
            ctx.$("button[onclick*=\"M14-S02\"]", root)?.insertAdjacentHTML("beforebegin", `<div class="flex gap-1.5 overflow-x-auto pb-1" data-story-chips>${chips}</div>`);
          }
          return root;
        },
      },
      "M14-S02": {
        key: () => current || "first",
        async load(ctx) {
          let id = current;
          if (!id) id = (await ctx.api("/stories")).items?.[0]?.id;
          return id ? ctx.api("/stories/" + encodeURIComponent(id) + "/variants") : { items: [] };
        },
        bind(html, d, ctx) {
          if (!d.items?.length) return ctx.stateHtml("M14-S02", "empty");
          const root = ctx.dom(html);
          const cards = ctx.$$(":scope > .p-3", root);
          const tpl = cards[0];
          cards.forEach((c) => c.remove());
          d.items.forEach((v, i) => {
            const n = tpl.cloneNode(true);
            ctx.text(ctx.$("b", n), `${i + 1}. ${v.name}`);
            ctx.text(ctx.$("p", n), v.description);
            root.append(n);
          });
          if (d.is_demo) root.insertAdjacentHTML("beforeend", `<div>${ctx.demoPill()}</div>`);
          return root;
        },
      },
    },
    actions: {
      pick(ctx, id) {
        current = id;
        ctx.reload("M14-S01");
      },
    },
  });
})();
