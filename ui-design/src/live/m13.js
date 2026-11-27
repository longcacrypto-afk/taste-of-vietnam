/* M13 live wiring — M13-S01 đặt bàn, M13-S02 ví voucher + MoMo/ZaloPay (sandbox).
 * API: GET /bookings/places, GET /bookings/slots, GET/POST /bookings, DELETE /bookings/:id,
 * GET /vouchers, POST /vouchers/:id/save, POST /vouchers/redeem.
 * Desktop tab 'booking': loadLiveBooking / submitLiveBooking are replaced (fns). */
(function () {
  // ---- Minimal QR encoder (byte mode, ECC L, versions 1–5, mask 0) for the voucher payload ----
  const QR = (() => {
    const CAP = [0, 19, 34, 55, 80, 108], EC = [0, 7, 10, 15, 20, 26];
    const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 255; };
    function divisor(deg) { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; }
    function rem(data, div) { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); } return r; }
    return function encode(text) {
      const bytes = [...new TextEncoder().encode(text)];
      let v = 1; while (v <= 5 && bytes.length + 2 > CAP[v]) v++;
      if (v > 5) return null;
      const bits = [];
      const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      put(4, 4); put(bytes.length, 8); bytes.forEach((b) => put(b, 8));
      const cap = CAP[v] * 8; put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
      const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
      for (let p = 0xec; data.length < CAP[v]; p ^= 0xec ^ 0x11) data.push(p);
      const all = data.concat(rem(data, divisor(EC[v])));
      const n = 17 + 4 * v, m = [...Array(n)].map(() => Array(n).fill(false)), fn = [...Array(n)].map(() => Array(n).fill(false));
      const set = (x, y, d) => { if (x >= 0 && y >= 0 && x < n && y < n) { m[y][x] = d; fn[y][x] = true; } };
      for (let i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
      for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); }
      if (v > 1) { const a = n - 7; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(a + dx, a + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
      const fmt = (() => { const d = (1 << 3) | 0; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); return ((d << 10) | r) ^ 0x5412; })();
      const bit = (i) => ((fmt >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(i));
      set(8, n - 8, true);
      let k = 0;
      for (let right = n - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
          const x = right - j, up = ((right + 1) & 2) === 0, y = up ? n - 1 - vert : vert;
          if (!fn[y][x] && k < all.length * 8) { m[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
        }
      }
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fn[y][x] && (x + y) % 2 === 0) m[y][x] = !m[y][x];
      return m;
    };
  })();
  function qrSvg(text, px = 4) {
    const m = QR(text);
    if (!m) return "";
    const n = m.length, q = 4, size = (n + 2 * q) * px;
    let d = "";
    m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${(x + q) * px},${(y + q) * px}h${px}v${px}h-${px}z`; }));
    return `<svg data-voucher-qr xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Mã QR voucher"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  window.TOV_QR_SVG = qrSvg; // used by tests (decoded with OpenCV) and by the desktop tab

  const st = { placeId: null, date: null, party: 4, time: null, baby: false, last: null, openWallet: null, bill: {} };
  const ERR = { 400: "Thông tin đặt bàn chưa hợp lệ (số khách, ghế em bé hoặc phòng lạnh quán chưa có).", 404: "Quán chưa nhận đặt bàn qua ứng dụng.", 409: "Khung giờ vừa hết bàn hoặc đã qua. Hãy chọn giờ khác." };
  const VERR = { 400: "Hóa đơn chưa đạt mức tối thiểu hoặc voucher không áp dụng tại quán này.", 409: "Voucher đã dùng hoặc đã hết hạn." };
  const write = async (ctx, job, done, map) => {
    try { ctx.status("Đang xử lý…"); const d = await job(); document.getElementById("p2-action-status")?.remove(); await done?.(d); }
    catch (e) { ctx.status((map && map[e.status]) || "Chưa thực hiện được. Kiểm tra mạng hoặc phiên đăng nhập rồi thử lại.", true); }
  };
  const subOf = (root, ctx) => ctx.$(".text-center .text-\\[10px\\]", root);

  // st.placeId / st.date are what the user picked (part of the cache key); st.eff* what the load resolved.
  async function loadBooking(ctx) {
    const places = await ctx.api("/bookings/places");
    const place = places.items.find((p) => p.place_id === st.placeId) || places.items[0];
    if (!place) return { places: places.items, place: null, slots: null, bookings: [] };
    if (!place.has_kids_seat) st.baby = false;
    const get = (date) => { const q = new URLSearchParams({ place_id: place.place_id, party_size: String(st.party) }); if (date) q.set("date", date); return ctx.api("/bookings/slots?" + q); };
    let [slots, mine] = await Promise.all([get(st.date), ctx.api("/bookings")]);
    // Nothing left today and no day picked yet: show tomorrow.
    if (!st.date && !slots.slots.some((x) => x.available) && slots.dates[1]) slots = await get(slots.dates[1].date);
    st.effPlace = place.place_id; st.effDate = slots.date;
    if (st.time && !slots.slots.some((x) => x.time === st.time && x.available)) st.time = null;
    return { places: places.items, place, slots, bookings: mine.upcoming || [] };
  }
  const book = (ctx, after) => write(ctx, () => ctx.api("/bookings", "POST", { place_id: st.effPlace, date: st.effDate, time: st.time, party_size: st.party, has_baby_chair: st.baby }), after, ERR);

  async function loadVouchers(ctx) { return ctx.api("/vouchers"); }
  const voucherLine = (v) => `Áp dụng tại ${v.place_names.join(" & ")} · Hạn ${v.expires_label}`;

  window.TOV_LIVE.register("M13", {
    screens: {
      "M13-S01": {
        key: () => [st.placeId, st.date, st.party].join(":"),
        load: loadBooking,
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          if (!d.place) return ctx.stateHtml("M13-S01", "empty");
          const s = d.slots;
          ctx.text(subOf(root, ctx), `M13-S01 · ${d.place.name}`);
          const im = ctx.$("img[data-img]", root);
          if (d.place.img_key) im.setAttribute("data-img", d.place.img_key);
          im.insertAdjacentHTML("beforebegin", `<div class="flex gap-1.5 overflow-x-auto pb-1">${d.places.map((p) => `<button type="button" onclick="P2.live.M13.place('${ctx.J(p.place_id)}')" class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full border text-[10px] font-bold ${p.place_id === d.place.place_id ? "bg-[#18181B] text-white border-[#18181B]" : "bg-white border-[#E2E8F0]"}">${ctx.H(p.name)}</button>`).join("")}</div>`);
          const tiles = ctx.$(".grid-cols-3", root).children;
          tiles[0].innerHTML = `<div>👥 ${ctx.H(st.party)} Người</div><div class="flex justify-center gap-2 mt-1"><button type="button" aria-label="Bớt khách" onclick="P2.live.M13.party(-1)" class="w-6 h-6 rounded-full bg-white">−</button><button type="button" aria-label="Thêm khách" onclick="P2.live.M13.party(1)" class="w-6 h-6 rounded-full bg-white">+</button></div>`;
          ctx.text(tiles[1], st.time ? `🕖 ${st.time} ${Number(st.time.slice(0, 2)) < 15 ? "Trưa" : "Tối"}` : "🕖 Chọn giờ");
          if (!st.time) tiles[1].className = "p-2.5 rounded-xl bg-[#F8FAFC] border border-dashed border-[#E2E8F0] text-[#64748B]";
          ctx.text(tiles[2], d.place.has_kids_seat ? (st.baby ? "👶 Ghế em bé ✓" : "👶 Ghế em bé?") : "👶 Chưa có ghế em bé");
          if (!st.baby) tiles[2].className = "p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B]";
          if (d.place.has_kids_seat) tiles[2].setAttribute("onclick", "P2.live.M13.baby()");
          const btn = ctx.$("button[onclick*=\"M13-S02\"]", root);
          btn.insertAdjacentHTML("beforebegin", `<div class="flex gap-1.5 overflow-x-auto pb-1">${s.dates.map((x) => `<button type="button" onclick="P2.live.M13.date('${ctx.J(x.date)}')" class="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full border text-[10px] font-bold ${x.date === s.date ? "bg-[#FBBF24] border-[#F59E0B]" : "bg-white border-[#E2E8F0]"}">${ctx.H(x.label)}</button>`).join("")}</div>
            ${s.slots.length ? `<div class="grid grid-cols-4 gap-1.5">${s.slots.map((x) => `<button type="button" ${x.available ? `onclick="P2.live.M13.time('${ctx.J(x.time)}')"` : "disabled"} class="py-1.5 rounded-xl border text-[11px] font-bold ${x.time === st.time ? "bg-[#18181B] text-white border-[#18181B]" : x.available ? "bg-white border-[#E2E8F0]" : "bg-[#F1F5F9] text-[#94A3B8] border-[#F1F5F9] line-through"}">${ctx.H(x.time)}</button>`).join("")}</div>`
              : '<div class="text-center text-[11px] text-[#64748B] py-2">Không còn khung giờ nhận đặt trong ngày này.</div>'}
            <div class="flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B]">${s.is_demo ? ctx.demoPill() : ""}<span>Tối đa ${ctx.H(s.max_party)} khách / bàn · Giờ gạch ngang đã hết bàn</span></div>`);
          btn.setAttribute("onclick", "P2.live.M13.book()");
          ctx.text(btn, st.time ? `Xác nhận đặt bàn ${st.time} · ${st.party} người →` : "Chọn giờ để đặt bàn");
          if (!st.time) btn.disabled = true;
          const extra = [];
          if (st.last) extra.push(`<div class="p-3 rounded-2xl bg-[#DCFCE7] border border-[#86EFAC] text-[#15803D] space-y-0.5"><b>🎉 Đã giữ bàn · Mã ${ctx.H(st.last.code)}</b><div>${ctx.H(st.last.place_name)} · ${ctx.H(st.last.party_size)} khách · ${ctx.H(st.last.time_slot)}</div><div class="text-[10px]">Xác nhận tức thì trong ứng dụng. ${ctx.H(st.last.confirmation.note)}</div></div>`);
          if (d.bookings.length) extra.push(`<div class="space-y-1.5"><b>Lịch đặt bàn sắp tới</b>${d.bookings.map((b) => `<div class="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center gap-2"><div class="min-w-0"><div class="font-bold">${ctx.H(b.place_name)}</div><div class="text-[10px] text-[#64748B]">${ctx.H(b.time_slot)} · ${ctx.H(b.party_size)} khách${b.has_baby_chair ? " · ghế em bé" : ""} · ${ctx.H(b.code)}</div></div><button type="button" onclick="P2.live.M13.cancel('${ctx.J(b.id)}')" class="shrink-0 px-2.5 py-1 rounded-full bg-white border border-[#E2E8F0] text-[10px] font-bold">Huỷ</button></div>`).join("")}</div>`);
          extra.push(`<button type="button" onclick="goScreen('M13-S02')" class="w-full py-2.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] font-extrabold">🎟️ Ví voucher quán (M13-S02) →</button>`);
          btn.insertAdjacentHTML("afterend", extra.join(""));
          return root;
        },
      },
      "M13-S02": {
        key: () => st.openWallet || "",
        load: loadVouchers,
        bind(html, d, ctx) {
          const root = ctx.dom(html);
          const tpl = ctx.$(".bg-\\[\\#18181B\\]", root);
          if (!d.vouchers?.length) { tpl.outerHTML = ctx.stateHtml("M13-S02", "empty"); return root; }
          ctx.text(subOf(root, ctx), `M13-S02 · ${d.wallet_count} voucher trong ví`);
          const rank = (v) => (v.wallet_status === "saved" ? 0 : v.wallet_status === "used" ? 2 : 1);
          const list = [...d.vouchers].sort((a, b) => rank(a) - rank(b));
          const base = tpl.cloneNode(true);
          list.forEach((v, i) => {
            const n = i === 0 ? tpl : base.cloneNode(true);
            ctx.text(n.children[1], v.title);
            ctx.text(n.children[2], voucherLine(v) + (v.description ? " · " + v.description : ""));
            let act;
            if (!v.saved) act = `<button type="button" onclick="P2.live.M13.save('${ctx.J(v.id)}')" class="px-3 py-1.5 rounded-full bg-[#FBBF24] text-[#0F172A] font-extrabold text-[11px]">+ Lưu vào ví</button>`;
            else if (v.wallet_status !== "saved") act = `<span class="text-[11px] text-gray-300">✓ Đã dùng ${v.used_at ? new Date(v.used_at).toLocaleDateString("vi-VN") : ""}</span>`;
            else if (st.openWallet !== v.wallet_id) act = `<button type="button" onclick="P2.live.M13.open('${ctx.J(v.wallet_id)}')" class="px-3 py-1.5 rounded-full bg-white text-[#0F172A] font-extrabold text-[11px]">Hiện mã QR & thanh toán</button>`;
            else act = `<div class="space-y-2"><div class="flex items-center gap-3"><div class="rounded-xl overflow-hidden shrink-0">${qrSvg(v.qr_payload, 3)}</div><div class="text-[10px] text-gray-300 break-all font-mono">${ctx.H(v.qr_payload)}<div class="font-sans mt-1">Đưa nhân viên quét mã tại quầy.</div></div></div>
                <div class="flex gap-2"><input id="m13-bill-${ctx.H(v.wallet_id)}" type="number" min="0" step="1000" value="${ctx.H(st.bill[v.wallet_id] || v.min_bill_vnd)}" class="flex-1 min-w-0 px-3 py-1.5 rounded-full text-[#0F172A] text-xs" aria-label="Số tiền hóa đơn"/><span class="self-center text-[10px] text-gray-300">đ hóa đơn</span></div>
                <div class="grid grid-cols-3 gap-1.5">${[["momo", "MoMo"], ["zalopay", "ZaloPay"], ["cash", "Tiền mặt"]].map(([m, l]) => `<button type="button" onclick="P2.live.M13.redeem('${ctx.J(v.wallet_id)}','${m}','${ctx.J(v.place_ids[0])}')" class="py-1.5 rounded-full ${m === "momo" ? "bg-[#A50064]" : m === "zalopay" ? "bg-[#0068FF]" : "bg-white text-[#0F172A]"} font-extrabold text-[11px]">${l}</button>`).join("")}</div>
                <div class="text-[10px] text-[#FBBF24]">MoMo/ZaloPay: chế độ thử nghiệm (sandbox) — không có tiền thật được trừ.</div></div>`;
            n.insertAdjacentHTML("beforeend", `<div class="pt-1">${act}</div>`);
            if (i > 0) root.append(n);
          });
          root.insertAdjacentHTML("beforeend", `<div class="flex flex-wrap items-center gap-1.5 text-[10px] text-[#64748B]">${d.vouchers.some((v) => v.is_demo) ? ctx.demoPill() : ""}<span>${ctx.H(d.payment_note)}</span></div>`);
          return root;
        },
      },
    },
    actions: {
      place(ctx, id) { st.placeId = id; st.time = null; ctx.reload("M13-S01"); },
      date(ctx, d) { st.date = d; st.time = null; ctx.reload("M13-S01"); },
      time(ctx, t) { st.time = t; ctx.reload("M13-S01"); },
      party(ctx, delta) { st.party = Math.max(1, Math.min(50, st.party + delta)); ctx.reload("M13-S01"); },
      baby(ctx) { st.baby = !st.baby; ctx.reload("M13-S01"); },
      book(ctx) { if (!st.time) return ctx.status("Chọn khung giờ trước."); book(ctx, (b) => { st.last = b; st.time = null; ctx.reload("M13-S01"); }); },
      cancel(ctx, id) { write(ctx, () => ctx.api("/bookings/" + encodeURIComponent(id), "DELETE"), () => { st.last = null; ctx.reload("M13-S01"); ctx.status("Đã huỷ lượt đặt bàn."); }, { 409: "Lượt đặt đã huỷ hoặc giờ hẹn đã qua." }); },
      save(ctx, id) { write(ctx, () => ctx.api("/vouchers/" + encodeURIComponent(id) + "/save", "POST", {}), (v) => { st.openWallet = v.wallet_id; ctx.reload("M13-S02"); }, VERR); },
      open(ctx, walletId) { st.openWallet = walletId; ctx.reload("M13-S02"); },
      redeem(ctx, walletId, method, placeId) {
        const bill = Number(document.getElementById("m13-bill-" + walletId)?.value);
        if (!Number.isInteger(bill) || bill <= 0) return ctx.status("Nhập số tiền hóa đơn.");
        st.bill[walletId] = bill;
        write(ctx, () => ctx.api("/vouchers/redeem", "POST", { wallet_id: walletId, bill_vnd: bill, method, place_id: placeId }), (r) => {
          st.openWallet = null; ctx.reload("M13-S02");
          ctx.status(`Đã áp dụng ${r.code}: giảm ${ctx.money(r.discount_vnd)}${r.gift ? " + " + r.gift : ""}, còn ${ctx.money(r.payable_vnd)}. ` + (r.payment ? r.payment.message : "Thanh toán tại quầy."));
        }, VERR);
      },
      setBooking(ctx, s) { Object.assign(st, s || {}); },
    },
    fns: {
      // Desktop Live App tab 'booking' (#lpanel-booking): real places/slots + voucher wallet.
      async loadLiveBooking(ctx) {
        const list = document.getElementById("live-vouchers-list");
        const H = ctx.H, J = ctx.J;
        try {
          const [b, v] = await Promise.all([loadBooking(ctx), loadVouchers(ctx)]);
          st.placeId = b.place?.place_id || st.placeId;
          const sel = document.getElementById("book-place-id");
          if (sel) { sel.innerHTML = b.places.map((p) => `<option value="${H(p.place_id)}" ${p.place_id === st.effPlace ? "selected" : ""}>${H(p.name)}</option>`).join(""); sel.onchange = () => { st.placeId = sel.value; st.time = null; window.loadLiveBooking(); }; }
          const ps = document.getElementById("book-party-size");
          if (ps) { ps.value = st.party; ps.max = b.place?.max_party || 20; ps.onchange = () => { st.party = Math.max(1, parseInt(ps.value, 10) || 1); window.loadLiveBooking(); }; }
          let ts = document.getElementById("book-time-slot");
          if (ts && ts.tagName !== "SELECT") { const s = document.createElement("select"); s.id = ts.id; s.className = ts.className; ts.replaceWith(s); ts = s; }
          if (ts && b.slots) {
            ts.innerHTML = '<option value="">Chọn ngày & giờ…</option>' + b.slots.dates.map((dd) => `<optgroup label="${H(dd.label)}">${dd.date === b.slots.date ? b.slots.slots.map((x) => `<option value="${H(dd.date + " " + x.time)}" ${x.available ? "" : "disabled"} ${x.time === st.time ? "selected" : ""}>${H(x.time)}${x.available ? ` (còn ${x.remaining_tables} bàn)` : " (hết bàn)"}</option>`).join("") : `<option value="${H(dd.date)}">Chọn ngày ${H(dd.label)}…</option>`}</optgroup>`).join("");
            if (!st.time) ts.value = "";
            ts.onchange = () => { const [d0, t0] = ts.value.split(" "); st.date = d0; st.time = t0 || null; if (!t0) window.loadLiveBooking(); };
          }
          const baby = document.getElementById("book-baby-chair");
          if (baby) { baby.checked = st.baby; baby.disabled = !b.place?.has_kids_seat; baby.onchange = () => { st.baby = baby.checked; }; }
          const resBox = document.getElementById("live-booking-result");
          if (resBox && b.bookings.length) {
            resBox.classList.remove("hidden");
            resBox.innerHTML = `<div class="font-black text-sm">Lịch đặt bàn sắp tới</div>` + b.bookings.map((x) => `<div class="flex items-center justify-between gap-2"><span>${H(x.code)} · ${H(x.place_name)} · ${H(x.party_size)} khách (${H(x.time_slot)})</span><button type="button" onclick="P2.live.M13.deskCancel('${J(x.id)}')" class="px-2 py-0.5 rounded-lg bg-white text-[10px] font-bold">Huỷ</button></div>`).join("") + `<div class="text-[10px] mt-1">Xác nhận tức thì trong ứng dụng · ${H(b.bookings[0].confirmation.note)}</div>${b.slots?.is_demo ? ctx.demoPill() : ""}`;
          }
          if (list) list.innerHTML = v.vouchers.map((x) => `
            <div class="p-3.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#22C55E]/15 text-[#15803D]">${H(x.code)}</span>
                <span class="text-[10px] text-[#FBBF24] font-bold">${x.wallet_status === "used" ? "Đã dùng" : x.saved ? "Trong ví" : "Hạn " + H(x.expires_label)}</span>
              </div>
              <div class="font-extrabold text-xs">${H(x.title)}</div>
              <div class="text-[10px] text-[var(--text-muted)]">${H(voucherLine(x))}</div>
              ${x.qr_payload && st.openWallet === x.wallet_id ? `<div class="flex items-center gap-3"><div class="rounded-lg overflow-hidden shrink-0">${qrSvg(x.qr_payload, 3)}</div><span class="text-[10px] font-mono text-[var(--text-muted)] break-all">${H(x.qr_payload)}</span></div>` : ""}
              <div class="pt-1 flex items-center justify-end gap-2">
                ${!x.saved ? `<button type="button" onclick="P2.live.M13.deskSave('${J(x.id)}')" class="px-3 py-1 rounded-xl bg-[#FBBF24] text-[#0F172A] text-[10px] font-bold">Lưu vào ví</button>`
                  : x.qr_payload ? `<button type="button" onclick="P2.live.M13.deskOpen('${J(x.wallet_id)}')" class="px-3 py-1 rounded-xl bg-[#18181B] text-white text-[10px] font-bold">${st.openWallet === x.wallet_id ? "Ẩn mã QR" : "Hiện Mã QR"}</button>` : ""}
              </div>
            </div>`).join("") + `<div class="text-[10px] text-[var(--text-muted)] flex flex-wrap gap-1.5 items-center">${v.vouchers.some((x) => x.is_demo) ? ctx.demoPill() : ""}${H(v.payment_note)} Thanh toán voucher trên màn M13-S02.</div>`;
        } catch (e) {
          if (list) list.innerHTML = '<div class="text-xs text-red-500 text-center py-4">Lỗi tải voucher. <button type="button" onclick="loadLiveBooking()" class="underline">Thử lại</button></div>';
        }
      },
      async submitLiveBooking(ctx) {
        const ts = document.getElementById("book-time-slot"), [d0, t0] = String(ts?.value || "").split(" ");
        if (!t0) return ctx.status("Chọn khung giờ còn bàn trước khi đặt.");
        st.date = d0; st.effDate = d0; st.time = t0;
        st.party = Math.max(1, parseInt(document.getElementById("book-party-size")?.value, 10) || st.party);
        st.baby = !!document.getElementById("book-baby-chair")?.checked;
        book(ctx, async (b) => {
          st.time = null;
          await window.loadLiveBooking();
          const resBox = document.getElementById("live-booking-result");
          resBox.classList.remove("hidden");
          resBox.insertAdjacentHTML("afterbegin", `<div class="font-black text-sm">🎉 Đặt bàn thành công!</div>
            <div>Mã đặt chỗ: <span class="font-mono font-bold">${ctx.H(b.booking_id)}</span></div>
            <div>Quán: <span class="font-bold">${ctx.H(b.place_name)}</span> · ${ctx.H(b.party_size)} khách (${ctx.H(b.time_slot)})</div>
            <div>Ghế trẻ em: <span class="font-bold">${b.has_baby_chair ? "Có chuẩn bị sẵn" : "Không"}</span></div>
            <div class="text-[10px] text-green-700 mt-1 mb-2">Trạng thái: Xác nhận tức thì (Instant Confirmed)</div>`);
        });
      },
    },
  });
  const M13 = window.TOV_LIVE.modules.M13;
  Object.assign(M13.actions, {
    deskCancel(ctx, id) { write(ctx, () => ctx.api("/bookings/" + encodeURIComponent(id), "DELETE"), () => window.loadLiveBooking(), { 409: "Lượt đặt đã huỷ hoặc giờ hẹn đã qua." }); },
    deskSave(ctx, id) { write(ctx, () => ctx.api("/vouchers/" + encodeURIComponent(id) + "/save", "POST", {}), (v) => { st.openWallet = v.wallet_id; window.loadLiveBooking(); }, VERR); },
    deskOpen(ctx, walletId) { st.openWallet = st.openWallet === walletId ? null : walletId; window.loadLiveBooking(); },
  });
})();
