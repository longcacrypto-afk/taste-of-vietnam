// M20 — Bếp sáng tạo & tip VietQR (M20-S01 community feed, M20-S02 tip an author).
// The recipes themselves are core data (repo.listRecipes/createRecipe/likeRecipe/tipRecipe,
// table community_recipes). This module adds only what was missing:
//  - GET /community/recipes: + q / max_minutes filters, is_demo for the seeded sample recipes,
//    liked_by_me and payout_ready (author saved a bank account). Shape stays { total, recipes }.
//  - POST /community/recipes/:id/like: one like per account (repeat = no change).
//  - GET/PUT /community/payout-account: the author's own bank account for tips.
//  - POST /community/recipes/:id/tip-intent → a pending tip with a VietQR (paymentService)
//    to the author's account; without an account the QR is sandbox (not payable).
//  - POST /community/tips/:id/confirm: the tipper says they transferred → the core counter
//    (repo.tipRecipe) goes up, marked "người ủng hộ tự xác nhận, chưa đối soát ngân hàng".
//    Nothing is ever confirmed with a bank; money never passes through the app.
// The legacy one-step POST /community/recipes/:id/tip stays in the core router unchanged.
import { buildVietQrTransfer, VIETQR_BANKS } from '../services/paymentService.js';
import { removeVietnameseTones } from '../services/textUtils.js';

const M = 'M20';
const PRESETS = [10000, 20000, 50000, 100000];

async function payoutOf(ms, userId) {
  if (!userId) return null;
  return (await ms.list(M, 'payout', { ownerId: userId }))[0] || null;
}
const pubPayout = p => p && ({ bank_bin: p.bank_bin, bank_name: VIETQR_BANKS[p.bank_bin] || p.bank_bin,
  account_number_masked: '•••• ' + String(p.account_number).slice(-4), account_name: p.account_name, updated_at: p.updated_at });
const pubTip = t => ({ tip_id: t.id, recipe_id: t.recipe_id, recipe_title: t.recipe_title, author: t.author, amount_vnd: t.amount_vnd,
  status: t.status, sandbox: t.sandbox, vietqr: t.vietqr || null, created_at: t.created_at, confirmed_at: t.confirmed_at || null,
  note: t.sandbox ? 'Sandbox: tác giả chưa khai báo tài khoản nhận, mã QR không dùng để chuyển tiền.'
    : t.status === 'CONFIRMED_BY_TIPPER' ? 'Người ủng hộ tự xác nhận đã chuyển khoản; ứng dụng không đối soát với ngân hàng.'
      : 'Quét mã bằng app ngân hàng. Tiền chuyển thẳng tới tài khoản tác giả, không qua ứng dụng.' });

export default {
  id: M,
  personalKinds: ['payout', 'tip', 'like'],
  async routeEarly(ctx) {
    const { ms, repo, method, pathname, searchParams, userId, util } = ctx;
    if (pathname === '/api/v1/community/recipes' && method === 'GET') {
      let recipes = await repo.listRecipes();
      if (searchParams.get('tag') === 'zero_waste') recipes = recipes.filter(r => r.zero_waste_tag);
      const q = removeVietnameseTones(util.cleanText(searchParams.get('q'), 60));
      if (q) recipes = recipes.filter(r => removeVietnameseTones([r.title, r.author, r.zero_waste_tag, ...(r.ingredients || [])].join(' ')).includes(q));
      const maxMin = Number(searchParams.get('max_minutes'));
      if (Number.isFinite(maxMin) && maxMin > 0) recipes = recipes.filter(r => (r.prep_time_minutes || 0) <= maxMin);
      const likes = userId ? new Set((await ms.list(M, 'like', { ownerId: userId })).map(l => l.recipe_id)) : new Set();
      const authors = [...new Set(recipes.map(r => r.author_id).filter(Boolean))];
      const ready = new Set();
      for (const a of authors) if (await payoutOf(ms, a)) ready.add(a);
      recipes = recipes.map(r => ({ ...r, is_demo: !r.author_id, liked_by_me: likes.has(r.id), payout_ready: !!(r.author_id && ready.has(r.author_id)),
        is_mine: !!(userId && r.author_id === userId) }));
      return { status: 200, data: { total: recipes.length, recipes, tip_presets_vnd: PRESETS } };
    }
    const like = pathname.match(/^\/api\/v1\/community\/recipes\/([^/]+)\/like$/);
    if (like && method === 'POST') {
      if (!userId) return util.unauthorized();
      const id = decodeURIComponent(like[1]);
      const rec = await repo.getRecipe(id);
      if (!rec) return util.notFound('Recipe not found');
      const key = `M20-LIKE-${id}-${userId}`;
      try { await ms.insert({ module: M, kind: 'like', id: key, ownerId: userId, data: { recipe_id: id } }); }
      catch (e) {
        if (e.status !== 409) throw e;
        return { status: 200, data: { id: rec.id, likes_count: rec.likes_count, liked_by_me: true, already_liked: true } };
      }
      const upd = await repo.likeRecipe(id);
      return { status: 200, data: { id: upd.id, likes_count: upd.likes_count, liked_by_me: true, already_liked: false } };
    }
    return null;
  },
  async route(ctx) {
    const { ms, repo, method, pathname, body, userId, util } = ctx;
    if (!pathname.startsWith('/api/v1/community/')) return null;

    const one = pathname.match(/^\/api\/v1\/community\/recipes\/([^/]+)$/);
    if (one && method === 'GET') {
      const r = await repo.getRecipe(decodeURIComponent(one[1]));
      if (!r) return util.notFound('Recipe not found');
      const tips = (await ms.list(M, 'tip', { where: t => t.recipe_id === r.id && t.status === 'CONFIRMED_BY_TIPPER' }));
      return { status: 200, data: { ...r, is_demo: !r.author_id, payout_ready: !!(await payoutOf(ms, r.author_id)), confirmed_tip_count: tips.length, tip_presets_vnd: PRESETS } };
    }

    if (pathname === '/api/v1/community/payout-account') {
      if (!userId) return util.unauthorized();
      const cur = await payoutOf(ms, userId);
      if (method === 'GET') return { status: 200, data: { payout: pubPayout(cur), banks: VIETQR_BANKS } };
      if (method === 'DELETE') { if (cur) await ms.remove(cur.id); return { status: 200, data: { deleted: !!cur } }; }
      if (method === 'PUT' || method === 'POST') {
        const bin = String(body.bank_bin || '');
        const acc = String(body.account_number || '').replace(/\s+/g, '');
        const name = removeVietnameseTones(util.cleanText(body.account_name, 60)).toUpperCase();
        if (!VIETQR_BANKS[bin]) return util.bad('Ngân hàng không hợp lệ (mã BIN NAPAS)');
        if (!/^\d{6,19}$/.test(acc)) return util.bad('Số tài khoản 6–19 chữ số');
        if (name.length < 3) return util.bad('Tên chủ tài khoản không hợp lệ');
        const data = { bank_bin: bin, account_number: acc, account_name: name };
        const rec = cur ? await ms.update(cur.id, data) : await ms.insert({ module: M, kind: 'payout', ownerId: userId, data });
        return { status: 200, data: { payout: pubPayout(rec) } };
      }
    }

    const intent = pathname.match(/^\/api\/v1\/community\/recipes\/([^/]+)\/tip-intent$/);
    if (intent && method === 'POST') {
      if (!userId) return util.unauthorized();
      const r = await repo.getRecipe(decodeURIComponent(intent[1]));
      if (!r) return util.notFound('Recipe not found');
      if (r.author_id && r.author_id === userId) return util.bad('Không thể tự ủng hộ công thức của mình');
      const amount = Number(body.amount_vnd);
      if (!Number.isInteger(amount) || amount < 1000 || amount > 5000000) return util.bad('Số tiền ủng hộ từ 1.000đ đến 5.000.000đ');
      const payout = await payoutOf(ms, r.author_id);
      const rec = await ms.insert({ module: M, kind: 'tip', ownerId: userId, data: {
        recipe_id: r.id, recipe_title: r.title, author: r.author, author_id: r.author_id || null, amount_vnd: amount,
        status: payout ? 'PENDING_TRANSFER' : 'SANDBOX', sandbox: !payout } });
      let vietqr = null;
      if (payout) {
        vietqr = buildVietQrTransfer({ bankBin: payout.bank_bin, accountNumber: payout.account_number, accountName: payout.account_name,
          amountVnd: amount, memo: `TOV TIP ${rec.id.slice(-8)}` });
      } else {
        vietqr = { sandbox: true, qr_emvco_raw: null, qr_image_url: null, amount_vnd: amount, transfer_memo: `TOV TIP ${rec.id.slice(-8)}`,
          bank_name: null, account_name: null, label: 'SANDBOX · chưa có tài khoản nhận' };
      }
      const saved = await ms.update(rec.id, { vietqr });
      return { status: 201, data: pubTip(saved) };
    }

    const confirm = pathname.match(/^\/api\/v1\/community\/tips\/([^/]+)\/confirm$/);
    if (confirm && method === 'POST') {
      if (!userId) return util.unauthorized();
      const t = await ms.get(decodeURIComponent(confirm[1]));
      if (!t || t.module !== M || t.kind !== 'tip') return util.notFound('Không tìm thấy lượt ủng hộ');
      if (t.owner_id !== userId) return util.forbidden('Lượt ủng hộ không phải của bạn');
      if (t.sandbox) return { status: 409, data: { error: 'Tác giả chưa có tài khoản nhận, đây là mã sandbox nên không có chuyển khoản để xác nhận', sandbox: true } };
      let first = false;
      const upd = await ms.update(t.id, cur => {
        if (cur.status !== 'PENDING_TRANSFER') return null;
        first = true;
        return { ...cur, status: 'CONFIRMED_BY_TIPPER', confirmed_at: new Date().toISOString() };
      });
      let total = null;
      if (first) total = (await repo.tipRecipe(t.recipe_id, t.amount_vnd))?.tips_received_vnd ?? null;
      else total = (await repo.getRecipe(t.recipe_id))?.tips_received_vnd ?? null;
      return { status: 200, data: { ...pubTip(upd), already_confirmed: !first, total_tips_vnd: total } };
    }

    if (pathname === '/api/v1/community/tips' && method === 'GET') {
      if (!userId) return util.unauthorized();
      const items = (await ms.list(M, 'tip', { ownerId: userId })).reverse().slice(0, 50).map(pubTip);
      return { status: 200, data: { total: items.length, items } };
    }
    return null;
  }
};
