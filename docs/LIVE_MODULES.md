# Opening frozen modules — the live-module kit

Owner decision 26/11/2026: every "sắp có" screen (W, M6–M8, M10–M20) becomes a working
screen with real API + persistent storage, running on **demo data** for now. The real data
loading phase comes later and replaces the demo rows (`DELETE FROM module_records WHERE is_demo`).

## Rules (unchanged from the owner)
- No new screens. Small controls inside an existing screen are fine.
- Keep every original element of a design. Replace sample text/numbers with API data.
- Never invent data in the UI. Whatever the screen shows comes from the API response.
- Demo data lives only in the module's `seed()`; every demo record is flagged `is_demo`
  and the screen shows one "Dữ liệu demo" pill (`ctx.demoPill()`).
- Safety rules from the core still hold everywhere (allergy hard filter, closed places never
  shown as open, max 1/3 sponsored + "Tài trợ" label, PDPD).
- External systems not available yet (real VietQR/PayOS money movement, SMS, push, wearables,
  camera OCR, MoMo/ZaloPay) are simulated honestly: the API records the request and returns
  a clearly labelled demo/sandbox result. Never claim money moved.

## Backend: `src/modules/<mod>.js` (auto-discovered: `m6.js`, `m13.js`, `w.js`)
```js
export default {
  id: 'M13',
  personalKinds: ['booking'],        // exported by /me/export, deleted with the account
  seed: () => [{ kind: 'slot', id: 'M13-SLOT-1', data: {...} }],   // FIXED ids
  async route(ctx) {...},            // after the core router, before legacy frozenRoutes.js
  async routeEarly(ctx) {...},       // optional: only to take over a path the core already answers
  async onDeleteUser({ ms, repo }, userId, user) {...}, // optional: PDPD cleanup of rows not keyed by owner_id
};
```
`ctx`: `repo, ms, store, authUser, userId, profile, method, pathname, searchParams, body,
view()` (store-shaped view with dishes/places/campaigns from the repository) and
`util: { cleanText, cleanNumber, cleanList, unauthorized, bad, notFound, forbidden }`.

`ms` (src/modules/moduleStore.js) — same API on memory and Postgres (`module_records`, migration 012):
`list(module, kind, {ownerId, where, limit})`, `get(id)`, `insert({module, kind, ownerId, data, isDemo, id})`,
`update(id, patchObject | (cur) => next)` (row-locked in Postgres: use the function form for
counters/votes), `remove(id)`, `count(module, kind)`.

Access control is applied before any module route (src/api/accessPolicy.js): `/merchant/*`,
`/ads/campaigns`, `/ads/payments/` need merchant/admin; `/analytics/`, `/enterprise/` admin;
`/fridge/`, `/health/`, `/bookings`, `/groceries/`, `/me` need a token; every non-GET needs a
token unless listed in PUBLIC_WRITES. Still check ownership inside the route.

## UI: `ui-design/src/live/<mod>.js` (auto-bundled by `npm run build:ui`)
```js
window.TOV_LIVE.register("M13", {
  screens: { "M13-S01": { key(ctx){}, async load(ctx){ return ctx.api("/bookings") }, bind(html, data, ctx){ const root = ctx.dom(html); ...; return root; } } },
  tabs: { booking: { mount(panel, ctx) {} } },     // desktop Live App tab (#lpanel-<tab>)
  actions: { submit(ctx, ...a) {} },               // onclick="P2.live.M13.submit(...)"
  fns: { submitLiveBooking(ctx, ...a) {} },        // replaces the legacy window.* desktop fn
});
```
`ctx`: `api(path, method, body)` (path without `/api/v1`), `H` (escape html), `J` (escape js string),
`$`, `$$`, `K` (UI kit), `money`, `img(el, key)`, `text(el, v)`, `click(el, code)`, `status(msg)`,
`action(job, done)` (write with spinner/retry), `goScreen(id)`, `reload(id?)`, `state`, `appState`,
`dom(html)`, `out(root)`, `demoPill()`, `stateHtml(id, 'empty'|'loading'|'error', err)`.

A registered module goes live automatically. A desktop tab goes live only when every module of
that tab is registered (FROZEN_TABS in product_runtime.js: merchant = M6+M7, stories = M14+M15).
The legacy desktop loaders in app_shell.html (loadLiveBooking, …) are kept for live tabs: either
make your API return the shape they read, or replace them through `fns` / `tabs[tab].mount`.

## Tests
- `tests/<mod>-live.test.js`: API behaviour via `handleApiRequest(createInitialStore(), ...)`
  (see tests/m14-live.test.js; login helpers in tests/helpers/auth.js).
- Postgres: `tests/postgres/<mod>-live.test.js` with `{ skip }` from helpers.js.
- `npm test` must stay green. `npm run build:ui` regenerates ui-design/index.html.

## Trạng thái (27/11/2026) — tất cả module ngoài core đã live

| Module | Màn | Tab desktop | Phần demo / sandbox |
|---|---|---|---|
| W | W-S01..S05 | — | 3 bộ sưu tập demo; Phone/Zalo/Apple login "Sắp có" |
| M6 | M6-S01..S09 | (merchant, chung M7) | Merchant demo 0900000002; OCR ảnh = sandbox; mời nhân viên không gửi SMS |
| M7 | M7-S01..S08 | merchant | Số chi tiêu/doanh thu demo; nạp VietQR có nút xác nhận sandbox (`PAYMENTS_SANDBOX=false` để tắt) |
| M8 | M8-S01..S04 | notifications | Push = sandbox (chỉ trong app); 6 mẫu tin demo |
| M10 | M10-S01..S06 | analytics | ~1.060 sự kiện demo, 3 A/B demo; NLU benchmark chạy thật |
| M11 | M11-S01..S03 | mealplan | Không có demo; trừ đồ trong tủ lạnh M18 |
| M12 | M12-S01..S03 | poll | Phòng demo BH2611 |
| M13 | M13-S01..S02 | booking | Slot demo theo quán; Zalo/SMS + MoMo/ZaloPay = sandbox, `money_moved:false` |
| M14 | M14-S01..S02 | stories | 3 story demo |
| M15 | M15-S01..S02 | stories | 2 trail demo; nhập mã QR thay camera |
| M16 | M16-S01..S02 | translator | Từ điển tay (không LLM) |
| M17 | M17-S01..S02 | insights | Số nền demo; ẩn ô < 50 người |
| M18 | M18-S01..S02 | fridge | 6 món tủ lạnh demo / user; 10 mã vạch demo |
| M19 | M19-S01..S02 | health | Health/Fit = sandbox; GI demo |
| M20 | M20-S01..S02 | community | 2 công thức demo; tip VietQR xác nhận bởi người gửi, không đối soát ngân hàng |

Xóa toàn bộ demo khi nạp dữ liệu thật: `DELETE FROM module_records WHERE is_demo;` và đặt `SEED_DEMO_MODULES=false`.

Còn mở (cần quyết định): cooldown 72h hay 3 ngày; endpoint cũ `POST /community/recipes/:id/tip` (1 bước) còn giữ; nhắm mục tiêu theo bữa/thời tiết của M7 chưa áp vào recommender; M6 OCR độ tin thấp chưa vào hàng chờ M9-S05; merchant↔place của core chưa có (M6 dùng record `membership`; yêu cầu nhận quán được super_admin duyệt/từ chối trong M9-S04 qua `/merchant/admin/claims`, duyệt = tạo membership owner; xóa tài khoản xóa membership của user). M13: mỗi slot giữ `holds {booking_id: owner_id}`, xóa tài khoản trả bàn lại.
