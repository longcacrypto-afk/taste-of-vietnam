// M17 — B2G Tourism & FMCG insights (admin only: /api/v1/enterprise/*, super_admin by accessPolicy).
// M17-S01 tourism insights: anonymised aggregates over the last 4 weeks, built from
//   (a) demo baseline cells (module records, is_demo) and
//   (b) real events already stored: M15 passport stamps, M16 translation requests
//       and M5 order redirects (deep links to a partner / maps for a dish).
//   k-anonymity: a cell (dish, language, place, area, week) whose number of distinct
//   contributors is below K = 50 is suppressed (value null, suppressed: true), and totals
//   only add up the cells that are shown, so a hidden cell can not be derived by subtraction.
// M17-S02 FMCG brand sponsorship campaigns: demo campaign records with weekly performance;
//   placements point at real catalogue dishes; an admin can pause / resume a campaign.
const M = 'M17';
export const K = 50;
const WEEKS = 4;
const DAY = 86400000;

const w = (...pairs) => pairs.map(([users, events]) => ({ users, events })); // index 0 = this week
const cell = (id, metric, dimension, key, weeks) => ({ kind: 'aggregate', id, data: { metric, dimension, key, weeks } });

const seed = () => [
  // Dish interest (searches + dish views for local specialties), per dish.
  cell('M17-AGG-DISH-101', 'dish_interest', 'dish', 'DISH-101', w([4210, 11850], [3980, 11020], [3720, 10310], [3510, 9640])),
  cell('M17-AGG-DISH-102', 'dish_interest', 'dish', 'DISH-102', w([3650, 9920], [3420, 9310], [3300, 8870], [3010, 8150])),
  cell('M17-AGG-DISH-103', 'dish_interest', 'dish', 'DISH-103', w([2870, 7640], [2610, 7010], [2440, 6580], [2290, 6120])),
  cell('M17-AGG-DISH-104', 'dish_interest', 'dish', 'DISH-104', w([1980, 4720], [1910, 4560], [1850, 4390], [1760, 4180])),
  cell('M17-AGG-DISH-109', 'dish_interest', 'dish', 'DISH-109', w([1240, 2930], [1120, 2650], [990, 2380], [870, 2050])),
  cell('M17-AGG-DISH-111', 'dish_interest', 'dish', 'DISH-111', w([860, 1940], [810, 1820], [760, 1700], [700, 1580])),
  cell('M17-AGG-DISH-112', 'dish_interest', 'dish', 'DISH-112', w([12, 25], [9, 18], [8, 14], [6, 11])), // too small → suppressed
  // Menu translator sessions by visitor language (M16).
  cell('M17-AGG-LANG-KO', 'translator_session', 'lang', 'KO', w([1720, 2480], [1610, 2310], [1490, 2150], [1380, 1990])),
  cell('M17-AGG-LANG-EN', 'translator_session', 'lang', 'EN', w([1450, 2020], [1390, 1940], [1310, 1830], [1240, 1720])),
  cell('M17-AGG-LANG-JA', 'translator_session', 'lang', 'JA', w([820, 1130], [770, 1060], [720, 990], [690, 940])),
  cell('M17-AGG-LANG-ZH', 'translator_session', 'lang', 'ZH', w([9, 12], [11, 14], [8, 10], [12, 15])), // suppressed
  // Food Trail passport check-ins by place (M15).
  cell('M17-AGG-CHK-401', 'trail_checkin', 'place', 'PLACE-401', w([640, 690], [590, 630], [540, 580], [480, 510])),
  cell('M17-AGG-CHK-402', 'trail_checkin', 'place', 'PLACE-402', w([520, 560], [500, 530], [450, 480], [410, 440])),
  cell('M17-AGG-CHK-403', 'trail_checkin', 'place', 'PLACE-403', w([470, 500], [430, 460], [400, 420], [360, 380])),
  cell('M17-AGG-CHK-404', 'trail_checkin', 'place', 'PLACE-404', w([390, 410], [370, 390], [330, 350], [300, 320])),
  cell('M17-AGG-CHK-406', 'trail_checkin', 'place', 'PLACE-406', w([150, 160], [140, 150], [120, 130], [110, 115])),
  cell('M17-AGG-CHK-407', 'trail_checkin', 'place', 'PLACE-407', w([96, 101], [88, 92], [80, 84], [71, 75])),
  cell('M17-AGG-CHK-408', 'trail_checkin', 'place', 'PLACE-408', w([7, 7], [5, 5], [6, 6], [4, 4])), // suppressed
  // Activity heatmap by ward (phường) of Biên Hòa.
  cell('M17-AGG-AREA-BL', 'area_activity', 'area', 'Bửu Long', w([3120, 8410], [2950, 7980], [2760, 7420], [2600, 6950])),
  cell('M17-AGG-AREA-TT', 'area_activity', 'area', 'Tân Tiến', w([2840, 7330], [2700, 6980], [2590, 6610], [2420, 6150])),
  cell('M17-AGG-AREA-QT', 'area_activity', 'area', 'Quyết Thắng', w([2510, 6620], [2330, 6150], [2190, 5790], [2050, 5380])),
  cell('M17-AGG-AREA-TH', 'area_activity', 'area', 'Tân Hiệp', w([1460, 3520], [1390, 3340], [1300, 3110], [1210, 2900])),
  cell('M17-AGG-AREA-TP', 'area_activity', 'area', 'Tân Phong', w([690, 1520], [650, 1430], [610, 1350], [560, 1240])),
  cell('M17-AGG-AREA-HB', 'area_activity', 'area', 'Hóa An', w([12, 22], [9, 17], [8, 14], [6, 11])), // suppressed (35 contributors)
  // FMCG brand sponsorship campaigns (M17-S02).
  { kind: 'campaign', id: 'BRAND-901', data: { brand: 'Nước Mắm Truyền Thống Phú Quốc', title: 'Nước mắm truyền thống Phú Quốc cho Món Kho & Canh Chua',
    status: 'active', placement_screens: ['M2-S06', 'M11-S02'], placement_label: 'Công thức món kho & canh miền Nam (M2-S06) · Giỏ đi chợ (M11-S02)',
    dish_ids: ['DISH-105', 'DISH-110', 'DISH-102'], ingredient: 'Nước mắm', start: '2026-10-15', end: '2027-01-15',
    weeks: [{ impressions: 128400, clicks: 10850, add_to_cart: 4120 }, { impressions: 121900, clicks: 10210, add_to_cart: 3890 },
      { impressions: 117300, clicks: 9740, add_to_cart: 3610 }, { impressions: 109800, clicks: 9080, add_to_cart: 3350 }] } },
  { kind: 'campaign', id: 'BRAND-902', data: { brand: 'Gạo ST25 Sóc Trăng', title: 'Gạo ST25 Sóc Trăng cho Cơm Tấm & Cơm gia đình',
    status: 'active', placement_screens: ['M2-S06', 'M11-S02'], placement_label: 'Nguyên liệu gạo trong công thức cơm (M2-S06) · Giỏ đi chợ (M11-S02)',
    dish_ids: ['DISH-102'], ingredient: 'Gạo tấm thơm', start: '2026-11-01', end: '2027-02-01',
    weeks: [{ impressions: 64200, clicks: 3980, add_to_cart: 1540 }, { impressions: 61800, clicks: 3760, add_to_cart: 1460 },
      { impressions: 58900, clicks: 3520, add_to_cart: 1350 }, { impressions: 0, clicks: 0, add_to_cart: 0 }] } },
  { kind: 'campaign', id: 'BRAND-903', data: { brand: 'Sa Tế Sả Ớt Cố Đô Huế', title: 'Sa tế sả ớt Huế cho Bún Bò Huế',
    status: 'paused', placement_screens: ['M2-S06'], placement_label: 'Gia vị trong công thức bún bò Huế (M2-S06)',
    dish_ids: ['DISH-103'], ingredient: 'Sả cây & Hành tây', start: '2026-09-20', end: '2026-12-20',
    weeks: [{ impressions: 0, clicks: 0, add_to_cart: 0 }, { impressions: 22400, clicks: 1180, add_to_cart: 410 },
      { impressions: 24100, clicks: 1290, add_to_cart: 450 }, { impressions: 23800, clicks: 1250, add_to_cart: 430 }] } }
];

const LANG_LABEL = { KO: 'Hàn Quốc (KO)', EN: 'Tiếng Anh (EN)', JA: 'Nhật Bản (JA)', ZH: 'Trung Quốc (ZH)' };
const weekOf = (iso, now) => { const t = Date.parse(iso); if (!Number.isFinite(t)) return -1; return Math.floor((now - t) / (7 * DAY)); };
const areaOf = addr => (String(addr || '').match(/P\.\s*([^,]+)/) || [])[1]?.trim() || null;

/** Real events as [metric, key, week, contributor] rows. */
async function realEvents(repo, ms, now) {
  const rows = [];
  const places = new Map((await repo.listPlaces()).map(p => [p.id, p]));
  for (const s of await ms.list('M15', 'stamp')) {
    const wk = weekOf(s.stamped_at || s.created_at, now);
    rows.push(['trail_checkin', s.place_id, wk, s.owner_id]);
    const area = areaOf(places.get(s.place_id)?.address);
    if (area) rows.push(['area_activity', area, wk, s.owner_id]);
  }
  for (const r of await ms.list('M16', 'request'))
    rows.push(['translator_session', r.lang, weekOf(r.at || r.created_at, now), r.owner_id || r.id]);
  for (const o of await allRedirects(repo)) {
    const wk = weekOf(o.created_at || o.clicked_at, now);
    if (o.dish_id) rows.push(['dish_interest', o.dish_id, wk, o.user_id || o.id]);
    const area = areaOf(places.get(o.place_id)?.address);
    if (area) rows.push(['area_activity', area, wk, o.user_id || o.id]);
  }
  return { rows: rows.filter(r => r[1] && r[2] >= 0 && r[2] < WEEKS), counts: {
    passport_stamps: rows.filter(r => r[0] === 'trail_checkin').length,
    translator_requests: rows.filter(r => r[0] === 'translator_session').length,
    order_redirects: rows.filter(r => r[0] === 'dish_interest').length } };
}

// Order redirects of every user (aggregate only, never returned row by row).
async function allRedirects(repo) {
  if (repo.kind === 'memory' || !repo.pool) return (repo.store?.orderRedirects || []);
  const q = repo.q ? repo.q.bind(repo) : (t, p) => repo.pool.query(t, p);
  try {
    return (await q("SELECT id, user_id, place_id, dish_id, created_at FROM order_redirects WHERE created_at > NOW() - INTERVAL '28 days'", [])).rows
      .map(r => ({ ...r, created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at }));
  } catch { return []; }
}

/** Merge demo cells + real rows into { key → per-week {users, events} } for one metric. */
function cube(metric, demo, real) {
  const out = new Map();
  const get = key => { if (!out.has(key)) out.set(key, Array.from({ length: WEEKS }, () => ({ users: 0, events: 0, real: new Set(), demo: false }))); return out.get(key); };
  for (const c of demo.filter(c => c.metric === metric)) {
    const ws = get(c.key);
    (c.weeks || []).slice(0, WEEKS).forEach((x, i) => { ws[i].users += x.users || 0; ws[i].events += x.events || 0; ws[i].demo = ws[i].demo || c.is_demo; });
  }
  for (const [m, key, wk, who] of real) {
    if (m !== metric) continue;
    const ws = get(key);
    ws[wk].events += 1;
    ws[wk].real.add(String(who));
  }
  return out;
}
const users = x => x.users + x.real.size;

/** One row per key over the whole window; suppressed when contributors < K. */
function rowsOf(c, labelFn) {
  return [...c.entries()].map(([key, ws]) => {
    const u = ws.reduce((a, x) => a + users(x), 0), e = ws.reduce((a, x) => a + x.events, 0);
    const shown = u >= K;
    return { key, label: labelFn(key), contributors: shown ? u : null, value: shown ? e : null, suppressed: !shown };
  }).sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
}
const sumShown = rows => rows.reduce((a, r) => a + (r.value || 0), 0);
const pctChange = (a, b) => (a !== null && b ? Math.round(((a - b) / b) * 1000) / 10 : null);

async function insights(repo, ms) {
  const now = Date.now();
  const demo = await ms.list(M, 'aggregate');
  const { rows: real, counts } = await realEvents(repo, ms, now);
  const [dishes, places] = await Promise.all([repo.listDishes(), repo.listPlaces()]);
  const dishName = id => dishes.find(d => d.id === id)?.name || id;
  const placeName = id => places.find(p => p.id === id)?.name || id;

  const dishRows = rowsOf(cube('dish_interest', demo, real), dishName);
  const langRows = rowsOf(cube('translator_session', demo, real), k => LANG_LABEL[k] || k);
  const placeRows = rowsOf(cube('trail_checkin', demo, real), placeName);
  const areaRows = rowsOf(cube('area_activity', demo, real), k => 'P. ' + k);

  // Weekly trend (oldest → newest) of dish interest + check-ins; a week below K is hidden.
  const weekly = Array.from({ length: WEEKS }, (_, i) => ({ users: 0, events: 0 }));
  for (const metric of ['dish_interest', 'trail_checkin']) {
    for (const ws of cube(metric, demo, real).values()) ws.forEach((x, i) => {
      if (users(x) < K) return; // small cells stay out of the trend too
      weekly[i].users += users(x); weekly[i].events += x.events;
    });
  }
  const trend = weekly.map((x, i) => ({ week_offset: i, week_label: i === 0 ? 'Tuần này' : `${i} tuần trước`,
    value: x.users >= K ? x.events : null, suppressed: x.users < K })).reverse();
  const weekTotal = (rowsCube, i) => { let s = 0; for (const ws of rowsCube.values()) if (users(ws[i]) >= K) s += ws[i].events; return s; };
  const dishCube = cube('dish_interest', demo, real);

  const langShown = langRows.filter(r => !r.suppressed);
  const langTotal = sumShown(langShown);
  const languages = langRows.map(r => ({ ...r, lang: r.key, pct: r.suppressed || !langTotal ? null : Math.round((r.value / langTotal) * 100) }));
  const all = [dishRows, langRows, placeRows, areaRows].flat();
  const demoUsed = demo.some(d => d.is_demo);

  const out = {
    period_days: WEEKS * 7, generated_at: new Date(now).toISOString(),
    k_anonymity: { k: K, enforced: true, cells: all.length, suppressed_cells: all.filter(r => r.suppressed).length,
      rule: `Ô có dưới ${K} người đóng góp bị ẩn; tổng chỉ cộng các ô được hiển thị.` },
    kpis: {
      local_specialty_queries: sumShown(dishRows),
      local_specialty_queries_change_pct: pctChange(weekTotal(dishCube, 0), weekTotal(dishCube, 1)),
      international_visitors: langShown.reduce((a, r) => a + r.contributors, 0),
      translator_sessions: langTotal,
      top_languages: langShown.slice(0, 3).map(r => r.key),
      trail_checkins: sumShown(placeRows),
      checkin_places: placeRows.filter(r => !r.suppressed).length
    },
    trend, trend_change_pct: pctChange(trend.at(-1)?.value ?? null, trend[0]?.value ?? null),
    top_dishes: dishRows.slice(0, 5).map(r => ({ ...r, dish_id: r.key })),
    languages, checkin_places: placeRows.map(r => ({ ...r, place_id: r.key })), areas: areaRows,
    sources: { demo_cells: demo.length, real_events: counts }, is_demo: demoUsed
  };
  // Legacy desktop loader keys.
  out.k_anonymity_enforced = true;
  out.local_specialty_queries_30d = out.kpis.local_specialty_queries;
  out.international_visitors_m16 = out.kpis.international_visitors;
  out.top_trending_dishes = dishRows.filter(r => !r.suppressed).slice(0, 3).map(r => r.label);
  return out;
}

async function campaignOut(repo, c) {
  const dishes = await repo.listDishes();
  const tot = (c.weeks || []).reduce((a, x) => ({ impressions: a.impressions + x.impressions, clicks: a.clicks + x.clicks, add_to_cart: a.add_to_cart + x.add_to_cart }),
    { impressions: 0, clicks: 0, add_to_cart: 0 });
  const placed = (c.dish_ids || []).map(id => dishes.find(d => d.id === id)).filter(Boolean);
  return {
    id: c.id, brand: c.brand, title: c.title, status: c.status, ingredient: c.ingredient,
    placements: c.placement_label, placement_screens: c.placement_screens || [],
    dishes: placed.map(d => ({ dish_id: d.id, name: d.name })), recipes_count: placed.length,
    start: c.start, end: c.end, ...tot,
    ctr_pct: tot.impressions ? Math.round((tot.clicks / tot.impressions) * 1000) / 10 : null,
    add_to_cart_rate_pct: tot.clicks ? Math.round((tot.add_to_cart / tot.clicks) * 1000) / 10 : null,
    weeks: (c.weeks || []).map((x, i) => ({ week_offset: i, ...x })),
    sponsored_label: 'Tài trợ', placement_rule: 'Tối đa 1/3 vị trí gợi ý là tài trợ, luôn gắn nhãn "Tài trợ"',
    status_history: c.status_history || [], is_demo: c.is_demo
  };
}

export default {
  id: M,
  seed,
  async route({ repo, ms, authUser, method, pathname, body, util }) {
    if (!pathname.startsWith('/api/v1/enterprise/')) return null;
    if (!authUser) return util.unauthorized();
    if (authUser.role !== 'super_admin') return util.forbidden('Chỉ quản trị viên cấp cao được truy cập');

    if (pathname === '/api/v1/enterprise/tourism-insights' && method === 'GET')
      return { status: 200, data: await insights(repo, ms) };

    if (pathname === '/api/v1/enterprise/brand-campaigns' && method === 'GET') {
      const items = [];
      for (const c of await ms.list(M, 'campaign')) items.push(await campaignOut(repo, c));
      const active = items.filter(c => c.status === 'active');
      const imp = active.reduce((a, c) => a + c.impressions, 0), clk = active.reduce((a, c) => a + c.clicks, 0);
      return { status: 200, data: { total: items.length, items, campaigns: items,
        summary: { active: active.length, impressions: imp, clicks: clk, ctr_pct: imp ? Math.round((clk / imp) * 1000) / 10 : null } } };
    }
    const one = pathname.match(/^\/api\/v1\/enterprise\/brand-campaigns\/([^/]+)(\/status)?$/);
    if (one) {
      const c = await ms.get(one[1]);
      if (!c || c.module !== M || c.kind !== 'campaign') return util.notFound('Không tìm thấy chiến dịch');
      if (!one[2] && method === 'GET') return { status: 200, data: await campaignOut(repo, c) };
      if (one[2] && method === 'POST') {
        const status = util.cleanText(body.status, 20);
        if (!['active', 'paused'].includes(status)) return util.bad('Trạng thái phải là active hoặc paused');
        const updated = await ms.update(c.id, cur => cur.status === status ? null : ({ ...cur, status,
          status_history: [...(cur.status_history || []), { status, by: authUser.id, at: new Date().toISOString() }].slice(-20) }));
        return { status: 200, data: await campaignOut(repo, updated) };
      }
    }
    return null;
  }
};
