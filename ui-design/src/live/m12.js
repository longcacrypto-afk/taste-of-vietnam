/* M12 live wiring — M12-S01 vote nhóm, M12-S02 streak & huy hiệu, M12-S03 đánh giá GPS.
 * API: GET/POST /polls, POST /polls/join, GET /polls/:id, POST /polls/:id/vote|close,
 * GET /me/gamification, GET/POST /places/:id/reviews. Desktop tab 'poll': renderLivePoll /
 * voteLivePoll are replaced (fns). */
(function () {
  const st = { pollId: null, placeId: null, rating: 5, text: "" };
  const write = async (ctx, job, done, map) => {
    try { ctx.status("Đang xử lý…"); const d = await job(); document.getElementById("p2-action-status")?.remove(); await done?.(d); }
    catch (e) { ctx.status((map && map[e.status]) || "Chưa thực hiện được. Kiểm tra mạng hoặc phiên đăng nhập rồi thử lại.", true); }
  };
  const subOf = (root, ctx) => ctx.$(".text-center .text-\\[10px\\]", root);
  const clock = (iso) => { const d = new Date(iso); return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }); };
  const stars = (n) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
  const haversine = (a, b, c, d) => { const R = 6371000, r = (x) => x * Math.PI / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))); };

  async function loadPoll(ctx) {
    const list = await ctx.api("/polls");
    const items = list.items || [];
    const id = st.pollId && items.some((p) => p.id === st.pollId) ? st.pollId : items[0]?.id;
    const poll = id ? items.find((p) => p.id === id) : null;
    return { items, poll };
  }
  const POLL_ERR = { 403: "Hãy tham gia phòng (nhập mã) trước khi vote.", 404: "Không tìm thấy phòng với mã này.", 409: "Phòng đã đóng hoặc món này bị loại vì dị ứng của thành viên.", 422: "Không đủ món an toàn cho cả nhóm để tạo phòng." };

  function pollInfo(ctx, p) {
    const allergies = p.combined_allergies.length ? "Đã loại món chứa " + p.combined_allergies.map((a) => a.label).join(", ") : "Chưa thành viên nào khai báo dị ứng";
    return `${allergies} của ${p.members_count} thành viên · ${p.is_open ? "Hạn chót " + clock(p.deadline_at) : "Đã chốt"}`;
  }

  window.TOV_LIVE.register("M12", {
    screens: {
      "M12-S01": {
        key: () => st.pollId || "first",
        load: loadPoll,
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const box = ctx.$(".space-y-2.rounded-2xl", root) || ctx.$(":scope > .bg-\\[\\#F8FAFC\\]", root);
          const btnS02 = ctx.$("button[onclick*=\"M12-S02\"]", root);
          const tools = `<div class="space-y-2">
              <div class="flex gap-2"><input id="m12-title" maxlength="80" placeholder="Tên phòng vote (vd: Trưa nay ăn gì?)" class="flex-1 min-w-0 px-3 py-2 rounded-full border border-[#E2E8F0] text-xs"/><button type="button" onclick="P2.live.M12.create()" class="px-3 py-2 rounded-full bg-[#18181B] text-white font-bold shrink-0">Tạo phòng</button></div>
              <div class="flex gap-2"><input id="m12-code" maxlength="12" placeholder="Nhập mã phòng bạn bè gửi" class="flex-1 min-w-0 px-3 py-2 rounded-full border border-[#E2E8F0] text-xs uppercase"/><button type="button" onclick="P2.live.M12.join()" class="px-3 py-2 rounded-full bg-white border border-[#E2E8F0] font-bold shrink-0">Tham gia</button></div>
            </div>`;
          if (!d.poll) { box.innerHTML = '<div class="text-center text-[11px] text-[#64748B] py-2">Chưa có phòng vote nào. Tạo phòng mới rồi gửi mã cho cả nhóm.</div>'; btnS02.insertAdjacentHTML("beforebegin", tools); return root; }
          const p = d.poll;
          const head = box.children[0], rowLead = box.children[1], rowOther = box.children[box.children.length - 1];
          ctx.text(ctx.$("b", head), `🗳️ "${p.title}"`);
          head.lastElementChild.outerHTML = ctx.K.tagPill(ctx.H(`${p.voted_count}/${p.members_count} đã vote`), p.is_open ? "yellow" : "dark");
          [...box.children].slice(1).forEach((c) => c.remove());
          const canVote = p.is_member && p.is_open;
          p.options.forEach((o, i) => {
            const lead = p.leader && p.leader.id === o.id;
            const r = (lead ? rowLead : rowOther).cloneNode(true);
            r.classList.add("w-full", "text-left", "gap-2");
            ctx.text(r.firstElementChild, `${i + 1}. ${o.name}${o.place_name ? " · " + o.place_name : ""}${o.is_my_vote ? " ✓" : ""}`);
            ctx.text(r.lastElementChild, o.blocked ? "Bị loại" : `${o.votes} phiếu (${o.pct}%)`);
            r.lastElementChild.classList.add("shrink-0");
            if (o.blocked) { r.classList.add("opacity-60", "line-through"); r.title = o.blocked_reason || ""; }
            else if (canVote) r.setAttribute("onclick", `P2.live.M12.vote('${ctx.J(p.id)}','${ctx.J(o.id)}')`);
            box.append(r);
          });
          box.insertAdjacentHTML("beforeend", `<div class="text-[10px] text-[#64748B] leading-relaxed">${ctx.H(pollInfo(ctx, p))}${p.tie ? " · Đang hoà phiếu" : ""}</div>
            <div class="flex flex-wrap items-center gap-1.5 text-[10px]">${p.is_demo ? ctx.demoPill() : ""}
              <span class="px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] font-mono font-bold">Mã: ${ctx.H(p.code)}</span>
              <button type="button" onclick="P2.live.M12.share('${ctx.J(p.share_text)}')" class="px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] font-bold">📤 Chia sẻ mã</button>
              ${!p.is_member && p.is_open ? `<button type="button" onclick="P2.live.M12.joinCode('${ctx.J(p.code)}')" class="px-2 py-0.5 rounded-full bg-[#FBBF24] font-bold">Tham gia để vote</button>` : ""}
              ${p.created_by_me && p.is_open ? `<button type="button" onclick="P2.live.M12.close('${ctx.J(p.id)}')" class="px-2 py-0.5 rounded-full bg-[#18181B] text-white font-bold">Chốt món</button>` : ""}
              ${canVote ? '<span class="text-[#64748B]">Chạm vào món để vote</span>' : ""}</div>`);
          if (d.items.length > 1) box.insertAdjacentHTML("beforebegin", `<div class="flex gap-1.5 overflow-x-auto pb-1">${d.items.map((x) => `<button type="button" onclick="P2.live.M12.pick('${ctx.J(x.id)}')" class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full border text-[10px] font-bold ${x.id === p.id ? "bg-[#18181B] text-white border-[#18181B]" : "bg-white border-[#E2E8F0]"}">${ctx.H(x.title)}</button>`).join("")}</div>`);
          btnS02.insertAdjacentHTML("beforebegin", tools);
          return root;
        },
      },
      "M12-S02": {
        load: (ctx) => ctx.api("/me/gamification"),
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const card = ctx.$(".bg-\\[\\#18181B\\]", root);
          const info = card.firstElementChild;
          ctx.text(info.children[0], d.current_streak_days > 0 ? `🔥 Chuỗi ${d.current_streak_days} ngày liên tiếp!` : "🔥 Chưa có chuỗi — ghi bữa hôm nay để bắt đầu");
          ctx.text(info.children[1], d.level_title);
          ctx.text(info.children[2], `7 ngày qua: ${d.week.meals} bữa${d.week.spent_vnd ? " · ~" + ctx.money(d.week.spent_vnd) : ""} · Kỷ lục ${d.longest_streak_days} ngày`);
          const grid = ctx.$(".grid-cols-3", root);
          const tpls = [...grid.children];
          tpls.forEach((t) => t.remove());
          d.badges.forEach((b, i) => {
            const n = tpls[i % tpls.length].cloneNode(true);
            n.innerHTML = `${ctx.H(b.icon)}<div class="mt-1">${ctx.H(b.name)}</div><div class="text-[9px] font-semibold mt-0.5">${b.earned ? "Đã đạt" : ctx.H(b.progress + "/" + b.goal)}</div>`;
            n.title = b.rule;
            if (!b.earned) n.classList.add("opacity-50", "grayscale");
            grid.append(n);
          });
          grid.insertAdjacentHTML("afterend", `<div class="text-[10px] text-[#64748B] leading-relaxed">${ctx.H(d.earned_count)}/${ctx.H(d.badges.length)} huy hiệu · ${ctx.H(d.total_meals)} bữa đã ghi, ${ctx.H(d.distinct_dishes)} món khác nhau · Còn ${ctx.H(d.next_level_in)} bữa để lên cấp. Tính từ ${ctx.H(d.source)}.</div>
            ${d.badges.filter((b) => !b.earned).slice(0, 2).map((b) => `<div class="text-[10px] text-[#334155]">${ctx.H(b.icon)} ${ctx.H(b.name)}: ${ctx.H(b.rule)}</div>`).join("")}`);
          return root;
        },
      },
      "M12-S03": {
        key: () => st.placeId || "PLACE-401",
        async load(ctx) {
          const id = st.placeId || "PLACE-401";
          const [rv, place, near] = await Promise.all([ctx.api("/places/" + encodeURIComponent(id) + "/reviews"), ctx.api("/places/" + encodeURIComponent(id)), ctx.api("/places").catch(() => ({ items: [] }))]);
          return { ...rv, place, places: near.items || [] };
        },
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const box = ctx.$(".rounded-3xl", root);
          const head = box.children[0], im = ctx.$("img", box), quote = ctx.$("p", box);
          ctx.text(ctx.$("b", head), d.place_name);
          if (d.img_key) im.setAttribute("data-img", d.img_key);
          const top = d.items[0];
          if (top) {
            quote.textContent = `"${top.text}"`;
            quote.insertAdjacentHTML("afterend", `<div class="flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B]"><span class="text-[#F59E0B]">${stars(top.rating)}</span><span>${ctx.H(top.author_name)} · cách quán ${ctx.H(top.distance_m)}m · ${ctx.H(clock(top.visited_at))}</span><span class="font-bold">· TB ${ctx.H(d.avg_rating)}★ (${ctx.H(d.total)} đánh giá GPS)</span></div>`);
          } else {
            head.lastElementChild.remove();
            quote.textContent = "Chưa có đánh giá xác minh GPS nào cho quán này.";
          }
          const rest = d.items.slice(1, 4).map((r) => `<div class="p-3 rounded-2xl bg-white border border-[#E2E8F0] space-y-1"><div class="flex justify-between items-center gap-2"><b>${ctx.H(r.author_name)}</b>${ctx.K.tagPill("✔ GPS " + ctx.H(r.distance_m) + "m", "green")}</div><div class="text-[#F59E0B] text-[11px]">${stars(r.rating)}</div><p class="text-[#334155]">"${ctx.H(r.text)}"</p></div>`).join("");
          const chips = d.places.slice(0, 8).map((p) => `<button type="button" onclick="P2.live.M12.place('${ctx.J(p.id)}')" class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full border text-[10px] font-bold ${p.id === d.place_id ? "bg-[#18181B] text-white border-[#18181B]" : "bg-white border-[#E2E8F0]"}">${ctx.H(p.name)}</button>`).join("");
          box.insertAdjacentHTML("beforebegin", chips ? `<div class="flex gap-1.5 overflow-x-auto pb-1">${chips}</div>` : "");
          box.insertAdjacentHTML("afterend", rest + `<div class="p-3.5 rounded-3xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <b>Viết đánh giá tại quán</b>
              <div class="flex gap-1 text-lg">${[1, 2, 3, 4, 5].map((n) => `<button type="button" aria-label="${n} sao" onclick="P2.live.M12.rate(${n})" class="${n <= st.rating ? "text-[#F59E0B]" : "text-[#CBD5E1]"}">★</button>`).join("")}</div>
              <textarea id="m12-review" maxlength="500" rows="3" placeholder="Món ăn, phục vụ, không gian… (tối thiểu 3 ký tự)" class="w-full p-2.5 rounded-2xl border border-[#E2E8F0] text-xs">${ctx.H(st.text)}</textarea>
              <button type="button" onclick="P2.live.M12.review('${ctx.J(d.place_id)}', ${Number(d.place?.lat)}, ${Number(d.place?.lng)})" class="w-full py-2.5 rounded-full bg-[#22C55E] text-white font-extrabold">📍 Gửi đánh giá (xác minh GPS ≤ ${ctx.H(d.max_distance_m)}m)</button>
              <div class="text-[10px] text-[#64748B]">Ứng dụng đọc vị trí hiện tại một lần khi bạn bấm gửi; chỉ khoảng cách tới quán được lưu kèm đánh giá.</div></div>`
            + (d.items.some((r) => r.is_demo) ? `<div class="text-[10px] text-[#64748B]">${ctx.demoPill()} Một số đánh giá mẫu (demo).</div>` : ""));
          return root;
        },
      },
    },
    actions: {
      pick(ctx, id) { st.pollId = id; ctx.reload("M12-S01"); },
      vote(ctx, pollId, optionId) { write(ctx, () => ctx.api("/polls/" + encodeURIComponent(pollId) + "/vote", "POST", { option_id: optionId }), () => ctx.reload("M12-S01"), POLL_ERR); },
      close(ctx, pollId) { write(ctx, () => ctx.api("/polls/" + encodeURIComponent(pollId) + "/close", "POST", {}), () => ctx.reload("M12-S01"), POLL_ERR); },
      create(ctx) {
        const title = (document.getElementById("m12-title")?.value || "").trim();
        if (!title) return ctx.status("Nhập tên phòng vote trước.");
        write(ctx, () => ctx.api("/polls", "POST", { title }), (p) => { st.pollId = p.id; ctx.reload("M12-S01"); ctx.status(`Đã tạo phòng. Gửi mã ${p.code} cho cả nhóm để cùng vote.`); }, POLL_ERR);
      },
      join(ctx) { P2.live.M12.joinCode((document.getElementById("m12-code")?.value || "").trim()); },
      joinCode(ctx, code) {
        if (!code) return ctx.status("Nhập mã phòng trước.");
        write(ctx, () => ctx.api("/polls/join", "POST", { code }), (p) => { st.pollId = p.id; ctx.reload("M12-S01"); }, POLL_ERR);
      },
      async share(ctx, text) {
        try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); ctx.status("Đã chép lời mời kèm mã phòng. Dán vào Zalo để gửi nhóm."); } }
        catch (e) { ctx.status(text); }
      },
      place(ctx, id) { st.placeId = id; ctx.reload("M12-S03"); },
      rate(ctx, n) { st.text = document.getElementById("m12-review")?.value || st.text; st.rating = n; ctx.reload("M12-S03"); },
      review(ctx, placeId, plat, plng) {
        const text = (document.getElementById("m12-review")?.value || "").trim();
        st.text = text;
        if (text.length < 3) return ctx.status("Viết ít nhất 3 ký tự cho đánh giá.");
        if (!navigator.geolocation) return ctx.status("Thiết bị không hỗ trợ GPS, chưa thể xác minh bạn đang ở quán.");
        ctx.status("Đang lấy vị trí GPS…");
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          const dist = Number.isFinite(plat) ? haversine(lat, lng, plat, plng) : null;
          write(ctx, () => ctx.api("/places/" + encodeURIComponent(placeId) + "/reviews", "POST", { lat, lng, accuracy_m: Math.round(accuracy || 0), rating: st.rating, text }),
            () => { st.text = ""; ctx.reload("M12-S03"); ctx.status("Đã đăng đánh giá xác minh GPS."); },
            { 400: dist !== null && dist > 500 ? `Bạn đang cách quán khoảng ${dist}m. Cần ở trong 500m quanh quán để đánh giá.` : "Chưa xác minh được vị trí (cần ≤ 500m, GPS đủ chính xác).", 409: "Bạn đã đánh giá quán này hôm nay." });
        }, () => ctx.status("Chưa lấy được vị trí. Hãy cho phép ứng dụng dùng GPS rồi thử lại.", true), { enableHighAccuracy: true, timeout: 10000 });
      },
    },
    fns: {
      // Desktop Live App tab 'poll' (#lpanel-poll).
      async renderLivePoll(ctx) {
        const c = document.getElementById("live-poll-options");
        if (!c) return;
        const panel = document.getElementById("lpanel-poll");
        let d, g = null;
        try { [d, g] = await Promise.all([loadPoll(ctx), ctx.api("/me/gamification").catch(() => null)]); }
        catch (e) { c.innerHTML = '<div class="text-xs text-center py-4 text-[var(--text-muted)]">Chưa tải được phòng vote. <button type="button" onclick="renderLivePoll()" class="underline font-bold">Thử lại</button></div>'; return; }
        const H = ctx.H, J = ctx.J, p = d.poll;
        const h2 = panel?.querySelector("h2"), sub = h2?.nextElementSibling, dl = panel?.querySelector(":scope > .flex > span:last-child");
        if (h2) h2.textContent = p ? p.title : "Chưa có phòng vote";
        if (sub) sub.textContent = p ? pollInfo(ctx, p) : "Tạo phòng mới rồi gửi mã cho cả nhóm";
        if (dl) dl.textContent = p ? (p.is_open ? "Hạn chót: " + clock(p.deadline_at) : "Đã chốt") : "";
        const emoji = ["🍜", "🍲", "🍚", "🥖", "🥗", "🍛"];
        c.innerHTML = (p ? `<div class="flex flex-wrap items-center gap-2 text-xs">${p.is_demo ? ctx.demoPill() : ""}<span class="px-2 py-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono font-bold">Mã phòng: ${H(p.code)}</span><span class="text-[var(--text-muted)]">${H(p.voted_count)}/${H(p.members_count)} đã vote</span>
            ${!p.is_member && p.is_open ? `<button type="button" onclick="P2.live.M12.deskJoin('${J(p.code)}')" class="px-3 py-1 rounded-xl bg-[#FBBF24] text-[#0F172A] font-extrabold">Tham gia để vote</button>` : ""}
            ${p.created_by_me && p.is_open ? `<button type="button" onclick="P2.live.M12.deskClose('${J(p.id)}')" class="px-3 py-1 rounded-xl bg-[#18181B] text-white font-extrabold">Chốt món</button>` : ""}</div>` +
          p.options.map((o, i) => `
          <div class="p-3.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-between ${o.blocked ? "opacity-50" : ""}">
            <div class="flex items-center gap-3">
              <span class="text-2xl">${emoji[i % emoji.length]}</span>
              <div>
                <div class="font-extrabold text-sm ${o.blocked ? "line-through" : ""}">${H(o.name)}</div>
                <div class="text-[11px] text-[var(--text-muted)]">${H(o.blocked ? o.blocked_reason : (o.place_name || "Tự nấu") + (o.distance_m != null ? " · " + o.distance_m + "m" : ""))}</div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right">
                <div class="font-black text-xs">${H(o.votes)} phiếu (${H(o.pct)}%)</div>
                <div class="w-20 bg-[var(--border-subtle)] h-1.5 rounded-full mt-1 overflow-hidden"><div class="bg-[#FBBF24] h-full" style="width: ${Number(o.pct) || 0}%"></div></div>
              </div>
              <button type="button" ${o.blocked || !p.is_member || !p.is_open ? "disabled" : `onclick="voteLivePoll('${J(o.id)}')"`} class="px-3 py-1.5 rounded-xl ${o.is_my_vote ? "bg-[#18181B] text-white" : o.blocked || !p.is_member || !p.is_open ? "bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)] opacity-60" : "bg-[#FBBF24] text-[#0F172A] hover:bg-[#F59E0B]"} font-extrabold text-xs">${o.is_my_vote ? "Đã Chọn" : "Chọn"}</button>
            </div>
          </div>`).join("") : "") + `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div class="flex gap-2"><input id="m12-desk-title" maxlength="80" placeholder="Tên phòng vote mới" class="flex-1 min-w-0 p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"/><button type="button" onclick="P2.live.M12.deskCreate()" class="px-3 rounded-xl bg-[#FBBF24] text-[#0F172A] font-extrabold">Tạo</button></div>
            <div class="flex gap-2"><input id="m12-desk-code" maxlength="12" placeholder="Mã phòng" class="flex-1 min-w-0 p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] uppercase"/><button type="button" onclick="P2.live.M12.deskJoin(document.getElementById('m12-desk-code').value)" class="px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] font-extrabold">Tham gia</button></div>
          </div>` + (g ? `<div class="p-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs flex flex-wrap items-center gap-2"><span class="font-extrabold">🔥 Chuỗi ${H(g.current_streak_days)} ngày</span><span class="text-[var(--text-muted)]">${H(g.level_title)} · ${H(g.earned_count)}/${H(g.badges.length)} huy hiệu</span>${g.badges.map((b) => `<span title="${H(b.rule)}" class="px-2 py-0.5 rounded-full border border-[var(--border-subtle)] ${b.earned ? "" : "opacity-40"}">${H(b.icon)} ${H(b.name)}</span>`).join("")}</div>` : "");
        if (d.items.length > 1) c.insertAdjacentHTML("afterbegin", `<div class="flex gap-1.5 overflow-x-auto pb-1">${d.items.map((x) => `<button type="button" onclick="P2.live.M12.deskPick('${J(x.id)}')" class="shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-bold ${x.id === p?.id ? "bg-[#FBBF24] text-[#0F172A] border-[#F59E0B]" : "border-[var(--border-subtle)]"}">${H(x.title)}</button>`).join("")}</div>`);
      },
      async voteLivePoll(ctx, optId) {
        const d = await loadPoll(ctx).catch(() => null);
        if (!d?.poll) return;
        write(ctx, () => ctx.api("/polls/" + encodeURIComponent(d.poll.id) + "/vote", "POST", { option_id: optId }), () => window.renderLivePoll(), POLL_ERR);
      },
    },
  });
  const M12 = window.TOV_LIVE.modules.M12;
  Object.assign(M12.actions, {
    deskPick(ctx, id) { st.pollId = id; window.renderLivePoll(); },
    deskJoin(ctx, code) {
      if (!String(code || "").trim()) return ctx.status("Nhập mã phòng trước.");
      write(ctx, () => ctx.api("/polls/join", "POST", { code: String(code).trim() }), (p) => { st.pollId = p.id; window.renderLivePoll(); }, POLL_ERR);
    },
    deskClose(ctx, id) { write(ctx, () => ctx.api("/polls/" + encodeURIComponent(id) + "/close", "POST", {}), () => window.renderLivePoll(), POLL_ERR); },
    deskCreate(ctx) {
      const title = (document.getElementById("m12-desk-title")?.value || "").trim();
      if (!title) return ctx.status("Nhập tên phòng vote trước.");
      write(ctx, () => ctx.api("/polls", "POST", { title }), (p) => { st.pollId = p.id; window.renderLivePoll(); ctx.status(`Đã tạo phòng. Gửi mã ${p.code} cho cả nhóm.`); }, POLL_ERR);
    },
  });
})();
