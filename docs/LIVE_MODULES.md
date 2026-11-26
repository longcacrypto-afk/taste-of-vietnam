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
