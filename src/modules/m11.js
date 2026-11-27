// M11 — Thực đơn tuần & đi chợ (M11-S01 7-day plan, M11-S02 consolidated grocery list,
// M11-S03 "Tủ lạnh có gì nấu nấy").
// The plan is built from the real catalogue through the shared candidate gate
// (src/services/candidatePipeline.js buildCandidates, mode 'cook'): allergy hard filter,
// disliked dishes, diet mode, spice cap and the per-serving budget of the user's profile.
// Stored per user as module 'M11', kind 'plan' (one active plan, rolling 7 days from its start).
// Fridge items come from the M18 contract: ms.list('M18', 'item', { ownerId }).
import crypto from 'node:crypto';
import { buildCandidates } from '../services/candidatePipeline.js';
import { localDate, addDays, isDate, dayDiff, weekdayLabel, shortDate, norm, ALLERGY_VI } from './m11m13_shared.js';

const M = 'M11';
const SLOT_LABEL = { breakfast: 'Sáng', lunch: 'Trưa', dinner: 'Tối' };
const slotsFor = mpd => (mpd === 3 ? ['breakfast', 'lunch', 'dinner'] : ['lunch', 'dinner']);
const round1000 = n => Math.round(n / 1000) * 1000;
const hash = s => parseInt(crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8), 16);

// ---------------------------------------------------------------------------
// Candidate pools (shared gate; the 72h "đã ăn" cooldown is a Today rule, not a
// rule for a plan that runs a week ahead, so history is not passed in).
// ---------------------------------------------------------------------------
function pools(view, slots) {
  const out = {};
  let reasons = [];
  for (const slot of slots) {
    const r = buildCandidates({ ...view, suggestionHistory: [] }, { mode: 'cook', meal_slot: slot, budget_min: 0 });
    out[slot] = r.candidates;
    if (!r.context.valid) return { invalid: true, pools: {}, reasons: r.reasons };
    reasons = reasons.concat(r.reasons.filter(x => x.code !== 'insufficient_candidates').map(x => ({ ...x, slot })));
  }
  return { pools: out, reasons };
}

function mealOf(c, slot, servings) {
  const d = c.dish;
  return { slot, slot_label: SLOT_LABEL[slot], dish_id: d.id, name: d.name, img_key: d.img_key || null,
    calories: Number(d.calories) || 0, prep_minutes: d.prep_minutes ?? null,
    cost_vnd: round1000(c.price_vnd * servings), per_serving_vnd: Math.round(c.price_vnd),
    vegetarian: (d.diet_flags || []).some(f => f === 'vegetarian' || f === 'vegan') };
}

/** Pick one candidate for a slot: least used, not already today, not the previous meal, fits budget. */
function pick(pool, { uses, dayUsed, prev, target, seed, servings, exclude }) {
  let list = pool.filter(c => !dayUsed.has(c.dish_id) && c.dish_id !== prev && c.dish_id !== exclude);
  if (!list.length) list = pool.filter(c => !dayUsed.has(c.dish_id) && c.dish_id !== exclude);
  if (!list.length) list = pool.filter(c => c.dish_id !== exclude);
  if (!list.length) list = pool;
  if (!list.length) return null;
  const fits = c => (target == null || c.price_vnd * servings <= target ? 0 : 1);
  return [...list].sort((a, b) => (uses.get(a.dish_id) || 0) - (uses.get(b.dish_id) || 0) || fits(a) - fits(b)
    || (hash(a.dish_id + seed) % 7) - (hash(b.dish_id + seed) % 7) || b.score - a.score || a.dish_id.localeCompare(b.dish_id))[0];
}

function generateDays(pl, settings, start, seed) {
  const slots = slotsFor(settings.meals_per_day);
  const uses = new Map();
  const total = 7 * slots.length;
  let spent = 0, n = 0, prev = null;
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i), dayUsed = new Set(), meals = {};
    for (const slot of slots) {
      const target = settings.weekly_budget_vnd ? (settings.weekly_budget_vnd - spent) / (total - n) : null;
      const c = pick(pl[slot] || [], { uses, dayUsed, prev, target, seed: seed + ':' + i, servings: settings.servings });
      n++;
      if (!c) { meals[slot] = null; continue; }
      const meal = mealOf(c, slot, settings.servings);
      meals[slot] = meal; spent += meal.cost_vnd; prev = c.dish_id; dayUsed.add(c.dish_id);
      uses.set(c.dish_id, (uses.get(c.dish_id) || 0) + 1);
    }
    days.push({ date, meals });
  }
  return days;
}

function readSettings(src, base = {}) {
  const num = (v, lo, hi) => (v === undefined || v === null || v === '' ? undefined
    : Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Math.round(Number(v)) : NaN);
  const servings = num(src.servings ?? src.family_size, 1, 12);
  const mpd = num(src.meals_per_day, 2, 3);
  const budget = src.weekly_budget_vnd === null ? null : num(src.weekly_budget_vnd ?? src.budget_week, 50000, 20000000);
  if ([servings, mpd, budget].some(v => Number.isNaN(v))) return { error: 'servings 1–12, meals_per_day 2–3, weekly_budget_vnd 50.000–20.000.000' };
  return { servings: servings ?? base.servings ?? 2, meals_per_day: mpd ?? base.meals_per_day ?? 2,
    weekly_budget_vnd: budget === undefined ? (base.weekly_budget_vnd ?? null) : budget };
}

// ---------------------------------------------------------------------------
// Groceries: merge recipe ingredients of the remaining days, minus fridge items.
// ---------------------------------------------------------------------------
const UNIT = { g: ['g', 1], gr: ['g', 1], gram: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000], lit: ['ml', 1000] };
const baseUnit = (u, amount) => {
  const k = UNIT[norm(u).replace(/\s/g, '')];
  return k ? { unit: k[0], amount: Number(amount) * k[1] } : { unit: String(u || '').trim(), amount: Number(amount) };
};
const showAmount = (unit, a) => {
  if (unit === 'g') return a >= 1000 ? { amount: Math.round(a / 100) / 10, unit: 'kg' } : { amount: Math.round(a / 10) * 10 || Math.round(a), unit: 'g' };
  if (unit === 'ml') return a >= 1000 ? { amount: Math.round(a / 100) / 10, unit: 'lít' } : { amount: Math.round(a / 10) * 10 || Math.round(a), unit: 'ml' };
  return { amount: Math.ceil(a - 1e-9), unit }; // countable units (ổ, quả, gói…) are bought whole
};
const AISLES = [
  ['dry', 'Tinh bột & Đồ khô', /^(banh|bun|mi|gao|mien|bot|soi|o banh|com)\b/],
  ['condiment', 'Gia vị & Nước dùng', /^(nuoc|do chua|me vat|gia vi|tuong|mam)\b/],
  ['produce', 'Quầy Rau củ', /^(rau|hanh|gung|sa|ca chua|ca rot|khoai|thom|gia|nam|ngo|dua|bac ha|dau bap|bap chuoi|ot|toi|chanh|hat sen|cai)\b/],
  ['protein', 'Quầy Thịt & Cá tươi', /\b(thit|bo|heo|ga|ca|tom|cua|suon|gio|cha|trung|vit|muc)\b/],
  ['produce', 'Quầy Rau củ', /\b(rau|hanh|gung|sa|khoai|thom|gia|nam|ngo|dua|bac ha|dau bap|bap chuoi|ot|toi|chanh|hat sen)\b/]
];
const aisleOf = name => {
  const n = norm(name);
  for (const [id, , re] of AISLES) if (re.test(n)) return id;
  return 'other';
};
const AISLE_LABEL = { ...Object.fromEntries(AISLES.map(([id, label]) => [id, label])), other: 'Khác', extra: 'Tự thêm' };
const keyOf = s => 'G-' + crypto.createHash('sha1').update(s).digest('hex').slice(0, 10).toUpperCase();

/** Fridge item covers a grocery line when its name is a whole-word phrase of the ingredient
 * ("Thịt bò" ⊂ "Thịt bò tái & nạm"), or one part of the ingredient is a phrase of the fridge name. */
export function fridgeMatches(fridgeName, ingredientName) {
  const f = norm(fridgeName), g = norm(ingredientName);
  if (!f || !g) return false;
  if ((' ' + g + ' ').includes(' ' + f + ' ')) return true;
  return String(ingredientName).split(/&|,/).map(norm).filter(Boolean).some(p => (' ' + f + ' ').includes(' ' + p + ' '));
}

async function fridgeItems(ms, userId, extraNames = []) {
  const rows = userId ? await ms.list('M18', 'item', { ownerId: userId }) : [];
  const items = rows.map(r => ({ id: r.id, name: String(r.name || ''), quantity: r.quantity ?? null, unit: r.unit || '',
    compartment: r.compartment || null, expires_at: r.expires_at || null, is_demo: r.is_demo, source: 'M18' }))
    .filter(r => r.name);
  for (const n of extraNames) items.push({ id: null, name: n, quantity: null, unit: '', compartment: null, expires_at: null, source: 'query' });
  return items;
}

function groceries(plan, dishesById, fridge, today) {
  const lines = new Map();
  for (const day of plan.days) {
    if (day.date < today) continue;
    for (const meal of Object.values(day.meals)) {
      if (!meal) continue;
      const dish = dishesById.get(meal.dish_id);
      if (!dish || !Array.isArray(dish.ingredients) || !dish.ingredients.length) continue;
      const scale = plan.servings / (Number(dish.base_servings) || 1);
      const perIngredientCost = (Number(dish.market_cost_base) || 0) * scale / dish.ingredients.length;
      for (const ing of dish.ingredients) {
        if (!ing || !ing.name) continue;
        const b = baseUnit(ing.unit, (Number(ing.amount) || 0) * scale);
        const k = norm(ing.name) + '|' + b.unit;
        const cur = lines.get(k) || { key: keyOf(k), name: ing.name, unit: b.unit, need: 0, est_cost_vnd: 0, dishes: [], img_key: ing.img_key || null };
        cur.need += b.amount; cur.est_cost_vnd += perIngredientCost;
        if (!cur.dishes.includes(dish.name)) cur.dishes.push(dish.name);
        lines.set(k, cur);
      }
    }
  }
  const used = new Set();
  const checked = plan.checked || {};
  const items = [...lines.values()].map(l => {
    const fi = fridge.findIndex((f, i) => !used.has(i) && fridgeMatches(f.name, l.name));
    let inFridge = false, fridgeAmount = null, toBuy = l.need;
    if (fi >= 0) {
      used.add(fi);
      const f = fridge[fi];
      const have = f.quantity !== null && f.quantity !== '' && Number.isFinite(Number(f.quantity)) ? baseUnit(f.unit, Number(f.quantity)) : null;
      if (have && have.unit === l.unit) { fridgeAmount = have.amount; toBuy = Math.max(0, l.need - have.amount); inFridge = toBuy === 0; }
      else inFridge = true; // quantity unknown or another unit: the user has it, check the amount
    }
    const need = showAmount(l.unit, l.need), buy = showAmount(l.unit, toBuy);
    return { id: l.key, key: l.key, name: l.name, amount: need.amount, unit: need.unit,
      to_buy_amount: inFridge && fridgeAmount === null ? 0 : buy.amount, to_buy_unit: buy.unit,
      in_fridge: inFridge, partly_in_fridge: !inFridge && fridgeAmount !== null && fridgeAmount > 0,
      fridge_item: fi >= 0 ? { name: fridge[fi].name, quantity: fridge[fi].quantity, unit: fridge[fi].unit } : null,
      aisle: aisleOf(l.name), est_cost_vnd: round1000(l.est_cost_vnd), dishes: l.dishes, img_key: l.img_key,
      checked: !!checked[l.key], bought: !!checked[l.key], extra: false };
  });
  for (const x of plan.extra_items || []) items.push({ ...x, key: x.id, aisle: 'extra', in_fridge: false, checked: !!x.checked, bought: !!x.checked, extra: true, est_cost_vnd: null, dishes: [] });
  const order = ['protein', 'produce', 'dry', 'condiment', 'other', 'extra'];
  const aisles = order.map(id => {
    const list = items.filter(i => i.aisle === id);
    const toBuy = list.filter(i => !i.in_fridge);
    return { id, label: AISLE_LABEL[id], items: list, est_cost_vnd: round1000(toBuy.reduce((s, i) => s + (i.est_cost_vnd || 0), 0)) };
  }).filter(a => a.items.length);
  const toBuy = items.filter(i => !i.in_fridge);
  return { items, aisles, total_items: items.length, to_buy_count: toBuy.length,
    checked_count: toBuy.filter(i => i.checked).length, in_fridge_count: items.filter(i => i.in_fridge).length,
    est_cost_vnd: round1000(toBuy.reduce((s, i) => s + (i.est_cost_vnd || 0), 0)),
    fridge_count: fridge.length, cost_note: 'Ước tính theo giá chợ tham khảo của công thức' };
}

// ---------------------------------------------------------------------------
function present(plan, ctx, view, groc, extra = {}) {
  const today = localDate();
  const days = plan.days.map(d => {
    const meals = Object.values(d.meals);
    const real = meals.filter(Boolean);
    return { date: d.date, day: weekdayLabel(d.date), date_label: shortDate(d.date), is_today: d.date === today,
      is_past: d.date < today, meals: d.meals,
      dish_name: real.map(m => m.name).join(' + '),
      calories: real.reduce((s, m) => s + m.calories, 0),
      est_market_cost_vnd: real.reduce((s, m) => s + m.cost_vnd, 0),
      all_vegetarian: real.length > 0 && real.every(m => m.vegetarian),
      missing_meals: meals.length - real.length };
  });
  const total = days.reduce((s, d) => s + d.est_market_cost_vnd, 0);
  const profile = view.userProfile || {};
  return { id: plan.id || null, saved: !!plan.id, start_date: plan.start_date, end_date: addDays(plan.start_date, 6),
    servings: plan.servings, family_size: plan.servings, meals_per_day: plan.meals_per_day,
    weekly_budget_vnd: plan.weekly_budget_vnd ?? null, total_cost_vnd: total,
    over_budget: plan.weekly_budget_vnd ? total > plan.weekly_budget_vnd : false,
    total_calories: days.reduce((s, d) => s + d.calories, 0),
    applied_allergies: (profile.hard_allergies || []).map(t => ({ tag: t, label: ALLERGY_VI[t] || t })),
    diet_mode: profile.diet_mode || null, per_serving_budget_max: Number(profile.budget_max) || null,
    distinct_dishes: new Set(days.flatMap(d => Object.values(d.meals).filter(Boolean).map(m => m.dish_id))).size,
    days, groceries: groc, consolidated_groceries: groc.items, updated_at: plan.updated_at || null, ...extra };
}

async function context(ctx) {
  const view = await ctx.view();
  const dishesById = new Map((view.dishes || []).map(d => [d.id, d]));
  return { view, dishesById };
}

async function loadPlan(ctx) {
  if (!ctx.userId) return null;
  const rows = await ctx.ms.list(M, 'plan', { ownerId: ctx.userId });
  return rows[rows.length - 1] || null;
}

/** Re-check every stored meal against the current profile; unsafe ones are swapped. */
function reconcile(plan, pl) {
  let replaced = 0;
  const slots = slotsFor(plan.meals_per_day);
  const uses = new Map();
  for (const d of plan.days) for (const m of Object.values(d.meals)) if (m) uses.set(m.dish_id, (uses.get(m.dish_id) || 0) + 1);
  for (const d of plan.days) {
    const dayUsed = new Set(Object.values(d.meals).filter(Boolean).map(m => m.dish_id));
    for (const slot of slots) {
      const m = d.meals[slot];
      const ok = m && (pl[slot] || []).some(c => c.dish_id === m.dish_id);
      if (ok || (!m && !(pl[slot] || []).length)) continue;
      const c = pick(pl[slot] || [], { uses, dayUsed, prev: null, target: null, seed: 'safe:' + d.date, servings: plan.servings, exclude: m?.dish_id });
      d.meals[slot] = c ? mealOf(c, slot, plan.servings) : null;
      if (m) replaced++;
      if (c) { dayUsed.add(c.dish_id); uses.set(c.dish_id, (uses.get(c.dish_id) || 0) + 1); }
    }
  }
  return replaced;
}

async function respond(ctx, plan, { view, dishesById }, extraFridge = [], extra = {}) {
  const fridge = await fridgeItems(ctx.ms, ctx.userId, extraFridge);
  return present(plan, ctx, view, groceries(plan, dishesById, fridge, localDate()), extra);
}

async function currentPlan(ctx, c) {
  let plan = await loadPlan(ctx);
  const today = localDate();
  const slots = plan ? slotsFor(plan.meals_per_day) : slotsFor(2);
  const p = pools(c.view, slots);
  if (p.invalid) return { error: ctx.util.bad('Hồ sơ khẩu vị chưa hợp lệ (ngân sách/chế độ ăn). Hãy cập nhật hồ sơ.') };
  if (plan && dayDiff(plan.start_date, today) >= 7) plan = null; // the week is over: start a new one
  if (!plan) {
    const settings = readSettings({}, {});
    const days = generateDays(p.pools, settings, today, 'w0');
    plan = await ctx.ms.insert({ module: M, kind: 'plan', ownerId: ctx.userId,
      data: { start_date: today, ...settings, days, seed: 0, checked: {}, extra_items: [] } });
    return { plan, reasons: p.reasons };
  }
  const copy = structuredClone(plan);
  const replaced = reconcile(copy, p.pools);
  if (replaced) plan = await ctx.ms.update(plan.id, cur => ({ ...cur, days: copy.days }));
  return { plan, reasons: p.reasons, replaced };
}

// ---------------------------------------------------------------------------
// M11-S03: dishes from what is in the fridge (safe, cookable dishes only).
// ---------------------------------------------------------------------------
async function fridgeSuggestions(ctx, names) {
  const { view } = await context(ctx);
  const fridge = await fridgeItems(ctx.ms, ctx.userId, names);
  const seen = new Map();
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
    const r = buildCandidates({ ...view, suggestionHistory: [] }, { mode: 'cook', meal_slot: slot, budget_min: 0, budget_max: 100000000 });
    for (const c of r.candidates) if (!seen.has(c.dish_id)) seen.set(c.dish_id, c);
  }
  const now = Date.now();
  const soon = f => f.expires_at && Number.isFinite(Date.parse(f.expires_at)) && Date.parse(f.expires_at) - now <= 2 * 86400000;
  const suggestions = [];
  for (const c of seen.values()) {
    const ings = c.dish.ingredients || [];
    const matched = [], missing = [], expiring = [];
    for (const ing of ings) {
      const f = fridge.find(x => fridgeMatches(x.name, ing.name));
      if (f) { matched.push(ing.name); if (soon(f)) expiring.push(f.name); } else missing.push(ing.name);
    }
    if (!matched.length) continue;
    suggestions.push({ dish_id: c.dish.id, name: c.dish.name, img_key: c.dish.img_key || null, prep_minutes: c.dish.prep_minutes ?? null,
      matched, missing, match_pct: Math.round(matched.length / ings.length * 100), uses_expiring: expiring });
  }
  suggestions.sort((a, b) => b.uses_expiring.length - a.uses_expiring.length || b.match_pct - a.match_pct
    || (a.prep_minutes ?? 999) - (b.prep_minutes ?? 999) || a.dish_id.localeCompare(b.dish_id));
  const imgFor = name => {
    for (const d of view.dishes || []) for (const i of d.ingredients || []) if (i.img_key && fridgeMatches(name, i.name)) return i.img_key;
    return null;
  };
  const items = fridge.map(f => ({ ...f, expiring_soon: !!soon(f), img_key: imgFor(f.name) }))
    .sort((a, b) => (a.expires_at || '9999').localeCompare(b.expires_at || '9999'));
  const profile = view.userProfile || {};
  return { fridge: items, fridge_count: items.length, suggestions: suggestions.slice(0, 5), source: 'M18',
    applied_allergies: (profile.hard_allergies || []).map(t => ({ tag: t, label: ALLERGY_VI[t] || t })) };
}

const ingredientList = (ctx, raw) => (Array.isArray(raw) ? raw : String(raw || '').split(','))
  .map(s => ctx.util.cleanText(s, 60)).filter(Boolean).slice(0, 30);

export default {
  id: M,
  personalKinds: ['plan'],
  async route(ctx) {
    const { method, pathname, searchParams, body, util, userId } = ctx;
    const isPlan = pathname === '/api/v1/meal-plans/weekly' || pathname === '/api/v1/meal-planner/weekly';

    if (isPlan && method === 'GET') {
      const c = await context(ctx);
      const extraFridge = ingredientList(ctx, searchParams.get('fridge'));
      const custom = ['family_size', 'servings', 'meals_per_day', 'weekly_budget_vnd'].some(k => searchParams.has(k));
      if (!userId || custom) {
        // Preview (not stored): anonymous visitors, or settings tried before saving.
        const base = userId ? (await loadPlan(ctx)) || {} : {};
        const settings = readSettings(Object.fromEntries(searchParams), base);
        if (settings.error) return util.bad(settings.error);
        const p = pools(c.view, slotsFor(settings.meals_per_day));
        if (p.invalid) return util.bad('Hồ sơ khẩu vị chưa hợp lệ');
        const today = localDate();
        const plan = { start_date: today, ...settings, days: generateDays(p.pools, settings, today, 'preview'), checked: {}, extra_items: [] };
        return { status: 200, data: await respond(ctx, plan, c, extraFridge, { preview: true, reasons: p.reasons }) };
      }
      const cur = await currentPlan(ctx, c);
      if (cur.error) return cur.error;
      return { status: 200, data: await respond(ctx, cur.plan, c, extraFridge, { preview: false, reasons: cur.reasons, replaced_for_safety: cur.replaced || 0 }) };
    }

    // Regenerate the whole week (optionally with new settings).
    if (isPlan && method === 'POST') {
      if (!userId) return util.unauthorized();
      const c = await context(ctx);
      const old = await loadPlan(ctx);
      const settings = readSettings(body, old || {});
      if (settings.error) return util.bad(settings.error);
      const p = pools(c.view, slotsFor(settings.meals_per_day));
      if (p.invalid) return util.bad('Hồ sơ khẩu vị chưa hợp lệ');
      const today = localDate();
      const seed = (old?.seed || 0) + 1;
      const data = { start_date: today, ...settings, days: generateDays(p.pools, settings, today, 'w' + seed), seed, checked: {}, extra_items: old?.extra_items || [] };
      const plan = old ? await ctx.ms.update(old.id, cur => ({ ...cur, ...data })) : await ctx.ms.insert({ module: M, kind: 'plan', ownerId: userId, data });
      return { status: 200, data: await respond(ctx, plan, c, [], { preview: false, reasons: p.reasons }) };
    }

    // Manual swap: days: [{ date, meals: { lunch: 'DISH-105', dinner: 'DISH-101' } }]
    if (isPlan && (method === 'PUT' || method === 'PATCH')) {
      if (!userId) return util.unauthorized();
      if (!Array.isArray(body.days) || !body.days.length || body.days.length > 7) return util.bad('days phải là danh sách 1–7 ngày { date, meals: { lunch: dish_id } }');
      const c = await context(ctx);
      const cur = await currentPlan(ctx, c);
      if (cur.error) return cur.error;
      const plan = structuredClone(cur.plan);
      const p = pools(c.view, slotsFor(plan.meals_per_day));
      for (const d of body.days) {
        const day = plan.days.find(x => x.date === d?.date);
        if (!day) return util.bad(`Ngày ${util.cleanText(d?.date, 12) || '?'} không thuộc thực đơn tuần này (date: YYYY-MM-DD)`);
        if (!d.meals || typeof d.meals !== 'object') return util.bad('meals là bắt buộc');
        for (const [slot, dishId] of Object.entries(d.meals)) {
          if (!(slot in day.meals)) return util.bad(`Bữa ${util.cleanText(slot, 12)} không có trong thực đơn`);
          const id = util.cleanText(dishId, 32);
          const cand = (p.pools[slot] || []).find(x => x.dish_id === id);
          if (!cand) {
            if (!c.dishesById.has(id)) return util.notFound('Không tìm thấy món');
            return { status: 422, data: { error: 'Món không phù hợp hồ sơ của bạn (dị ứng, chế độ ăn, ngân sách hoặc không có công thức nấu)', dish_id: id } };
          }
          day.meals[slot] = mealOf(cand, slot, plan.servings);
        }
      }
      const saved = await ctx.ms.update(plan.id, x => ({ ...x, days: plan.days }));
      return { status: 200, data: await respond(ctx, saved, c, [], { preview: false }) };
    }

    // Regenerate one day (or one meal of it): POST /meal-plans/weekly/days/:date/regenerate { slot? }
    const regen = pathname.match(/^\/api\/v1\/meal-plans\/weekly\/days\/([^/]+)\/regenerate$/);
    if (regen && method === 'POST') {
      if (!userId) return util.unauthorized();
      const c = await context(ctx);
      const cur = await currentPlan(ctx, c);
      if (cur.error) return cur.error;
      const plan = structuredClone(cur.plan);
      const date = regen[1];
      const day = isDate(date) && plan.days.find(d => d.date === date);
      if (!day) return util.notFound('Ngày không thuộc thực đơn tuần này');
      const slots = slotsFor(plan.meals_per_day);
      const only = body.slot === undefined ? null : String(body.slot);
      if (only && !slots.includes(only)) return util.bad('slot phải là ' + slots.join(' | '));
      const p = pools(c.view, slots);
      const uses = new Map();
      for (const d of plan.days) for (const m of Object.values(d.meals)) if (m) uses.set(m.dish_id, (uses.get(m.dish_id) || 0) + 1);
      const seed = (plan.seed || 0) + 1;
      const dayUsed = new Set(Object.entries(day.meals).filter(([s, m]) => m && only && s !== only).map(([, m]) => m.dish_id));
      let changed = 0;
      for (const slot of only ? [only] : slots) {
        const old = day.meals[slot];
        const ch = pick(p.pools[slot] || [], { uses, dayUsed, prev: null, target: null, seed: 'r' + seed + date + slot, servings: plan.servings, exclude: old?.dish_id });
        if (!ch) continue;
        if (ch.dish_id !== old?.dish_id) changed++;
        day.meals[slot] = mealOf(ch, slot, plan.servings);
        dayUsed.add(ch.dish_id); uses.set(ch.dish_id, (uses.get(ch.dish_id) || 0) + 1);
      }
      const saved = await ctx.ms.update(plan.id, x => ({ ...x, days: plan.days, seed }));
      return { status: 200, data: await respond(ctx, saved, c, [], { preview: false, changed_meals: changed,
        note: changed ? null : 'Không còn món an toàn khác cho ngày này theo hồ sơ của bạn' }) };
    }

    if (pathname === '/api/v1/groceries/consolidated' && method === 'GET') {
      const c = await context(ctx);
      const cur = await currentPlan(ctx, c);
      if (cur.error) return cur.error;
      const data = await respond(ctx, cur.plan, c, ingredientList(ctx, searchParams.get('fridge')));
      return { status: 200, data: { plan_id: data.id, start_date: data.start_date, end_date: data.end_date, servings: data.servings,
        days_count: data.days.filter(d => !d.is_past).length, ...data.groceries } };
    }

    if (pathname === '/api/v1/groceries/items' && method === 'POST') {
      const name = util.cleanText(body.name, 60);
      if (!name) return util.bad('name là bắt buộc');
      const amount = body.amount === undefined || body.amount === '' ? null : Number(body.amount);
      if (amount !== null && !(Number.isFinite(amount) && amount > 0 && amount <= 100000)) return util.bad('amount phải là số dương');
      const c = await context(ctx);
      const cur = await currentPlan(ctx, c);
      if (cur.error) return cur.error;
      const item = { id: 'X-' + crypto.randomUUID().slice(0, 8).toUpperCase(), name, amount, unit: util.cleanText(body.unit, 16), checked: false };
      const plan = await ctx.ms.update(cur.plan.id, x => ({ ...x, extra_items: [...(x.extra_items || []), item].slice(-50) }));
      return { status: 201, data: { ...item, plan_id: plan.id } };
    }

    const item = pathname.match(/^\/api\/v1\/groceries\/items\/([^/]+)$/);
    if (item && (method === 'PATCH' || method === 'DELETE')) {
      const plan = await loadPlan(ctx);
      if (!plan) return util.notFound('Chưa có thực đơn tuần');
      const id = item[1];
      if (method === 'DELETE') {
        if (!(plan.extra_items || []).some(x => x.id === id)) return util.notFound('Chỉ xoá được mục bạn tự thêm');
        await ctx.ms.update(plan.id, x => ({ ...x, extra_items: x.extra_items.filter(e => e.id !== id) }));
        return { status: 200, data: { deleted: true, id } };
      }
      const v = body.checked ?? body.bought;
      if (typeof v !== 'boolean') return util.bad('checked (true/false) là bắt buộc');
      const c = await context(ctx);
      const data = await respond(ctx, plan, c);
      const line = data.groceries.items.find(i => i.id === id);
      if (!line) return util.notFound('Không có mục này trong giỏ đi chợ');
      await ctx.ms.update(plan.id, x => line.extra
        ? { ...x, extra_items: x.extra_items.map(e => (e.id === id ? { ...e, checked: v } : e)) }
        : { ...x, checked: { ...(x.checked || {}), [id]: v } });
      return { status: 200, data: { ...line, checked: v, bought: v } };
    }

    if (pathname === '/api/v1/meal-plans/fridge-suggestions' && method === 'GET')
      return { status: 200, data: await fridgeSuggestions(ctx, ingredientList(ctx, searchParams.get('ingredients'))) };
    if (pathname === '/api/v1/dishes/by-ingredients' && method === 'POST')
      return { status: 200, data: await fridgeSuggestions(ctx, ingredientList(ctx, body.ingredients)) };

    return null;
  }
};
