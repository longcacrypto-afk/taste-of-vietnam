/* LIVE MODULE REGISTRY (UI side) — modules opened after launch (M6–M8, M10–M20, W).
 * Loaded before product_runtime.js. Each file ui-design/src/live/<mod>.js calls
 *
 *   TOV_LIVE.register("M13", {
 *     screens: {
 *       "M13-S01": {
 *         key: (ctx) => "",                 // optional cache-key suffix
 *         load: (ctx) => ctx.api("/bookings"), // optional; resolves to an object
 *         bind: (html, data, ctx) => html,  // original template → bound markup (string or Element)
 *       },
 *     },
 *     tabs: { booking: { mount(panel, ctx) {} } },   // desktop Live App tab (optional)
 *     actions: { submitBooking(ctx, ...args) {} },    // exposed as P2.live.M13.submitBooking(...)
 *     fns: { submitLiveBooking(ctx, ...args) {} },    // replaces a window.* legacy desktop fn
 *   });
 *
 * A registered module goes live automatically (TOV_FEATURES.frozenModules[mod] = "off"
 * still hides it; TOV_FEATURES.liveModules = false shows every module as preview again).
 * ctx (from product_runtime): api, H, J, $, $$, K, money, img, text, click, status, action,
 * goScreen, reload(id?), state, appState, dom(html), out(root), demoPill(), polish.
 * Rule: never invent data in bind; show what the API returned. Demo records carry
 * is_demo: true → show ctx.demoPill() once on the screen.
 */
(function () {
  const modules = {};
  const live = (window.TOV_LIVE = window.TOV_LIVE || {});
  live.modules = modules;
  live.register = function (id, def) {
    modules[id] = Object.assign({ id, screens: {}, tabs: {}, actions: {}, fns: {} }, def || {});
    return modules[id];
  };
  live.screen = (screenId) => {
    const m = modules[String(screenId).split("-")[0]];
    return (m && m.screens && m.screens[screenId]) || null;
  };
  live.tab = (tab) => {
    for (const m of Object.values(modules)) if (m.tabs && m.tabs[tab]) return m.tabs[tab];
    return null;
  };
})();
