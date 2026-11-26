// M19 — Dinh dưỡng & đồng bộ wearables (M19-S01 dashboard + sync, M19-S02 macros & Low-GI).
// Apple Health / Google Fit are NOT connected: a sync records the numbers the user enters
// (source 'manual'), or labels them sandbox when the request names a wearable. Nothing is
// read from a device. BMR (Mifflin-St Jeor) comes only from the body profile the user enters;
// TDEE = BMR × 1.2 + active kcal synced today (TECHNICAL_HANDOFF_SPEC §6.2); macro split
// 30% protein / 50% carb / 20% fat. Daily intake = calories of dishes marked "eaten" today.
// Demo data: an estimated GI level per catalogue dish (kind 'gi', is_demo).
import { isDishSafeForUser } from '../services/recommender.js';

const M = 'M19';
const TZ = 'Asia/Ho_Chi_Minh';
const SPLIT = { protein: 0.30, carbs: 0.50, fat: 0.20 };
const SOURCES = { manual: 'Nhập tay', apple_health: 'Apple Health', google_fit: 'Google Fit' };
const GOALS = { cut: 'Giảm mỡ', maintain: 'Giữ cân', bulk: 'Tăng cơ' };

const gi = (dish, level, value, tip) => ({ kind: 'gi', id: `M19-GI-${dish}`, data: { dish_id: dish, gi_level: level, gi_estimate: value, low_gi_tip: tip } });
const seed = () => [
  gi('DISH-101', 'medium', 55, 'Phở ít bánh, thêm thịt bò nạc và giá trụng, rau thơm'),
  gi('DISH-102', 'high', 75, 'Đổi nửa phần cơm tấm sang gạo lứt, thêm dưa leo và đồ chua'),
  gi('DISH-103', 'medium', 58, 'Bún bò Huế ít bún, thêm bắp bò và rau sống, bắp chuối bào'),
  gi('DISH-104', 'high', 72, 'Chọn bánh mì nguyên cám, ăn nửa ổ và thêm nhiều rau'),
  gi('DISH-105', 'low', 35, 'Canh chua cá lóc ăn với ít cơm gạo lứt, nhiều rau'),
  gi('DISH-106', 'medium', 56, 'Bún riêu ít bún, thêm đậu hũ và rau sống'),
  gi('DISH-107', 'low', 40, 'Gỏi cuốn nhiều rau, chấm ít tương'),
  gi('DISH-108', 'medium', 60, 'Bò hầm bớt khoai tây, thêm cà rốt và bánh mì nguyên cám'),
  gi('DISH-109', 'high', 70, 'Bánh xèo cuốn nhiều rau, ăn 1 cái thay vì 2'),
  gi('DISH-110', 'low', 36, 'Canh chua bông điên điển với cơm gạo lứt'),
  gi('DISH-111', 'medium', 57, 'Mì Quảng ít mì, thêm gà và rau sống'),
  gi('DISH-112', 'high', 68, 'Chả giò chay nướng thay vì chiên, cuốn rau xà lách')
];

const today = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA', { timeZone: TZ });
const r0 = n => Math.round(n);

/** Mifflin-St Jeor: 10·kg + 6.25·cm − 5·tuổi + 5 (nam) / −161 (nữ). */
export function mifflinBmr({ sex, age, height_cm, weight_kg }) {
  if (!sex || !age || !height_cm || !weight_kg) return null;
  return r0(10 * weight_kg + 6.25 * height_cm - 5 * age + (sex === 'male' ? 5 : -161));
}
export function targets(bmr, activeKcal, goal = 'maintain') {
  if (!bmr) return null;
  const tdee = r0(bmr * 1.2 + (activeKcal || 0));
  const kcal = goal === 'cut' ? Math.max(bmr, tdee - 400) : goal === 'bulk' ? tdee + 300 : tdee;
  return { tdee, target_calories_daily: r0(kcal),
    macro_targets_g: { protein: r0(kcal * SPLIT.protein / 4), carbs: r0(kcal * SPLIT.carbs / 4), fat: r0(kcal * SPLIT.fat / 9) } };
}

async function bodyProfile(ms, userId) {
  return (await ms.list(M, 'profile', { ownerId: userId }))[0] || null;
}

async function nutrition(ctx) {
  const { ms, repo, userId, profile } = ctx;
  const body = await bodyProfile(ms, userId);
  const day = today();
  const syncs = (await ms.list(M, 'sync', { ownerId: userId })).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const todays = syncs.find(s => s.date === day) || null;
  const goal = body?.goal || 'maintain';
  const bmr = body ? mifflinBmr(body) : null;
  const t = targets(bmr, todays?.active_calories_burned || 0, goal);

  const [dishes, history, giRows] = await Promise.all([repo.listDishes(), repo.listHistory(userId), ms.list(M, 'gi')]);
  const byId = new Map(dishes.map(d => [d.id, d]));
  const giBy = new Map(giRows.map(g => [g.dish_id, g]));
  const eaten = (history || []).filter(h => h.action === 'eaten' && h.created_at && today(Date.parse(h.created_at)) === day).map(h => {
    const d = byId.get(h.dish_id);
    return { dish_id: h.dish_id, name: d?.name || h.dish_name, calories: d?.calories ?? null, macros: d?.macros || null,
      gi_level: giBy.get(h.dish_id)?.gi_level || null, at: h.created_at };
  });
  const intake = eaten.reduce((s, e) => s + (e.calories || 0), 0);
  const intakeMacros = eaten.reduce((s, e) => ({ protein: s.protein + (e.macros?.protein || 0), carbs: s.carbs + (e.macros?.carbs || 0), fat: s.fat + (e.macros?.fat || 0) }), { protein: 0, carbs: 0, fat: 0 });
  const remaining = t ? t.target_calories_daily - intake : null;

  const safe = dishes.filter(d => isDishSafeForUser(d, profile || {}));
  const lowGi = safe.filter(d => giBy.get(d.id)?.gi_level === 'low').map(d => ({ dish_id: d.id, name: d.name, calories: d.calories, gi_estimate: giBy.get(d.id).gi_estimate, tip: giBy.get(d.id).low_gi_tip }));
  const swaps = safe.filter(d => giBy.get(d.id)?.gi_level === 'medium').slice(0, 3).map(d => ({ dish_id: d.id, name: d.name, tip: giBy.get(d.id).low_gi_tip }));
  const fastCarbWarnings = eaten.filter(e => e.gi_level === 'high').map(e => ({ dish_id: e.dish_id, name: e.name, tip: giBy.get(e.dish_id)?.low_gi_tip || null }));

  let recommendation;
  if (!bmr) recommendation = 'Nhập giới tính, tuổi, chiều cao, cân nặng để tính BMR và TDEE của bạn.';
  else if (!todays) recommendation = `Chưa có dữ liệu vận động hôm nay. Mục tiêu tạm tính theo BMR × 1.2: ${t.target_calories_daily} kcal.`;
  else if (remaining > 0) recommendation = `Hôm nay bạn đã nạp ${intake} kcal, còn ${remaining} kcal so với mục tiêu ${t.target_calories_daily} kcal (ưu tiên đạm ~${r0(remaining * SPLIT.protein / 4)}g).`;
  else recommendation = `Bạn đã nạp ${intake} kcal, vượt mục tiêu ${-remaining} kcal. Bữa tiếp theo nên nhẹ, nhiều rau.`;

  return {
    needs_profile: !bmr, body_profile: body ? { sex: body.sex, age: body.age, height_cm: body.height_cm, weight_kg: body.weight_kg, goal, low_gi: !!body.low_gi } : null,
    goal, goal_label: GOALS[goal], bmr, bmr_formula: 'Mifflin-St Jeor', tdee_formula: 'BMR × 1.2 + calo vận động hôm nay',
    tdee: t?.tdee ?? null, target_calories_daily: t?.target_calories_daily ?? null, macro_targets_g: t?.macro_targets_g ?? null,
    macro_split_pct: { protein: 30, carbs: 50, fat: 20 },
    date: day, daily_steps: todays?.daily_steps ?? null, active_calories_burned: todays?.active_calories_burned ?? null,
    connected_wearable: todays ? todays.source_label : null, sync_source: todays?.source || null, sandbox: todays ? !!todays.sandbox : null,
    last_synced_at: syncs[0]?.created_at || null,
    intake_today_kcal: intake, intake_today_macros_g: intakeMacros, eaten_today: eaten, remaining_kcal: remaining,
    blood_sugar_support: !!body?.low_gi, low_gi_dishes: lowGi, low_gi_swaps: swaps, fast_carb_warnings: fastCarbWarnings,
    gi_note: 'Chỉ số GI là ước tính demo theo nguyên liệu chính, không thay thế tư vấn bác sĩ.',
    recommendation, applied_allergies: [...(profile?.hard_allergies || [])],
    history: syncs.slice(0, 7).map(s => ({ id: s.id, date: s.date, daily_steps: s.daily_steps, active_calories_burned: s.active_calories_burned, source_label: s.source_label, sandbox: s.sandbox })),
    is_demo: giRows.some(g => g.is_demo)
  };
}

export default {
  id: M,
  personalKinds: ['profile', 'sync'],
  seed,
  async route(ctx) {
    const { ms, method, pathname, body, userId, util } = ctx;
    if (!pathname.startsWith('/api/v1/health/')) return null;
    if (!userId) return util.unauthorized();

    if (pathname === '/api/v1/health/nutrition-profile' && method === 'GET') return { status: 200, data: await nutrition(ctx) };

    if (pathname === '/api/v1/health/profile' && method === 'GET') {
      const p = await bodyProfile(ms, userId);
      return { status: 200, data: p ? { sex: p.sex, age: p.age, height_cm: p.height_cm, weight_kg: p.weight_kg, goal: p.goal, low_gi: !!p.low_gi, bmr: mifflinBmr(p) } : { needs_profile: true } };
    }

    if (pathname === '/api/v1/health/profile' && (method === 'PUT' || method === 'PATCH')) {
      const cur = await bodyProfile(ms, userId);
      const next = { sex: cur?.sex, age: cur?.age, height_cm: cur?.height_cm, weight_kg: cur?.weight_kg, goal: cur?.goal || 'maintain', low_gi: !!cur?.low_gi };
      if (body.sex !== undefined) { if (!['male', 'female'].includes(body.sex)) return util.bad('Giới tính: male hoặc female'); next.sex = body.sex; }
      const num = (k, min, max, label) => {
        if (body[k] === undefined || body[k] === '') return null;
        const n = Number(body[k]);
        if (!Number.isFinite(n) || n < min || n > max) return `${label} phải từ ${min} đến ${max}`;
        next[k] = Math.round(n * 10) / 10; return null;
      };
      const err = num('age', 10, 100, 'Tuổi') || num('height_cm', 100, 230, 'Chiều cao (cm)') || num('weight_kg', 25, 300, 'Cân nặng (kg)');
      if (err) return util.bad(err);
      if (body.goal !== undefined) { if (!GOALS[body.goal]) return util.bad('Mục tiêu: cut, maintain hoặc bulk'); next.goal = body.goal; }
      if (body.low_gi !== undefined) next.low_gi = body.low_gi === true || body.low_gi === 'true';
      if (next.age) next.age = Math.round(next.age);
      const rec = cur ? await ms.update(cur.id, next) : await ms.insert({ module: M, kind: 'profile', ownerId: userId, data: next });
      return { status: 200, data: { ...next, id: rec.id, bmr: mifflinBmr(next), complete: !!mifflinBmr(next) } };
    }

    if (pathname === '/api/v1/health/sync' && method === 'POST') {
      let source = body.source;
      if (!source && body.wearable) source = /google/i.test(body.wearable) ? 'google_fit' : /apple/i.test(body.wearable) ? 'apple_health' : 'manual';
      source = source || 'manual';
      if (!SOURCES[source]) return util.bad('Nguồn: manual, apple_health hoặc google_fit');
      const steps = Number(body.daily_steps), kcal = Number(body.active_calories_burned);
      if (!Number.isFinite(steps) || steps < 0 || steps > 100000) return util.bad('Số bước phải từ 0 đến 100.000');
      if (!Number.isFinite(kcal) || kcal < 0 || kcal > 5000) return util.bad('Calo vận động phải từ 0 đến 5.000 kcal');
      if (body.goal !== undefined) {
        if (!GOALS[body.goal]) return util.bad('Mục tiêu: cut, maintain hoặc bulk');
        const cur = await bodyProfile(ms, userId);
        if (cur) await ms.update(cur.id, { goal: body.goal });
        else await ms.insert({ module: M, kind: 'profile', ownerId: userId, data: { goal: body.goal, low_gi: false } });
      }
      const sandbox = source !== 'manual';
      const date = today();
      const data = { date, daily_steps: Math.round(steps), active_calories_burned: Math.round(kcal), source, sandbox,
        source_label: sandbox ? `${SOURCES[source]} (sandbox – chưa kết nối thiết bị)` : SOURCES[source] };
      // One reading per day: a later sync replaces today's numbers.
      const existing = (await ms.list(M, 'sync', { ownerId: userId })).find(s => s.date === date);
      if (existing) await ms.update(existing.id, data);
      else await ms.insert({ module: M, kind: 'sync', ownerId: userId, data });
      const out = await nutrition(ctx);
      return { status: 200, data: { ...out, synced: true,
        note: sandbox ? 'Chưa kết nối Apple Health/Google Fit: số liệu do bạn nhập, được ghi nhận dạng sandbox.' : 'Đã ghi nhận số liệu bạn nhập.' } };
    }
    return null;
  }
};
