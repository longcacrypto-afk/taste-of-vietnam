// M8 live: meal-reminder schedule, ≤2 notifications/day (server-side), in-app inbox,
// weather-aware text from the real weather provider, lunar vegetarian days, sandbox push.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { login } from './helpers/auth.js';
import { __setNow, solarToLunar } from '../src/modules/m8.js';
import { setWeatherFetch } from '../src/services/weatherProvider.js';

const q = () => new URLSearchParams();
const api = (store, who, method, path, body) => handleApiRequest(store, method, path, q(), body || {}, who ? who.headers : {});
// 10:45 and 17:30 in Asia/Ho_Chi_Minh on 2026-11-26
const at = iso => () => new Date(iso);
const LUNCH_1045 = '2026-11-26T03:45:00Z', DINNER_1730 = '2026-11-26T10:30:00Z', EVENING_2130 = '2026-11-26T14:30:00Z';

test.afterEach(() => { __setNow(null); setWeatherFetch(null); });

test('M8: anonymous inbox shows the default schedule (10:30 / 17:00) and the hard cap of 2', async () => {
  const store = createInitialStore();
  const r = await api(store, null, 'GET', '/api/v1/notifications');
  assert.equal(r.status, 200);
  assert.equal(r.data.max_push_per_day, 2);
  assert.equal(r.data.signed_in, false);
  assert.deepEqual(r.data.items.map(i => i.slot_time), ['10:30', '17:00']);
  assert.ok(r.data.items.every(i => i.status === 'scheduled'));
  assert.equal(r.data.push.sandbox, true);
  assert.equal(r.data.timezone, 'Asia/Ho_Chi_Minh');
});

test('M8: settings and schedule are validated, capped at 2/day and persisted in the profile', async () => {
  const store = createInitialStore();
  const u = await login(store, '0900000081');
  let s = await api(store, u, 'GET', '/api/v1/me/notification-settings');
  assert.equal(s.status, 200);
  assert.equal(s.data.max_per_day, 0, 'reminders are off until the user turns them on');
  s = await api(store, u, 'PUT', '/api/v1/me/notification-settings', { meal_suggestions: true, lunar_vegan_reminder: false });
  assert.equal(s.data.max_per_day, 2);
  assert.equal(s.data.lunar_vegan_reminder, false);
  s = await api(store, u, 'PUT', '/api/v1/me/meal-schedule', { lunch: '11:00', dinner: '18:15', max_per_day: 9, dinner_enabled: false });
  assert.equal(s.status, 200);
  assert.deepEqual([s.data.lunch, s.data.dinner, s.data.max_per_day, s.data.dinner_enabled], ['11:00', '18:15', 2, false]);
  assert.deepEqual(u.user.profile.meal_reminders, { lunch: '11:00', dinner: '18:15', max_per_day: 2 });
  for (const bad of [{ lunch: '25:00' }, { lunch: '19:00' }, { weather_aware: 'yes' }, { max_per_day: 'many' }])
    assert.equal((await api(store, u, 'PUT', '/api/v1/me/meal-schedule', bad)).status, 400, JSON.stringify(bad));
  assert.equal((await api(store, null, 'PUT', '/api/v1/me/meal-schedule', { lunch: '10:00' })).status, 401);
  assert.equal((await api(store, null, 'GET', '/api/v1/me/meal-schedule')).status, 401);
  // The M1 profile validator still accepts the stored meal_reminders shape.
  assert.equal((await api(store, u, 'PUT', '/api/v1/me/profile', { meal_reminders: u.user.profile.meal_reminders })).status, 200);
});

test('M8: a due reminder is delivered once in-app, named dishes pass the allergy gate', async () => {
  const store = createInitialStore();
  const u = await login(store, '0900000082');
  await api(store, u, 'PUT', '/api/v1/me/profile', { hard_allergies: ['egg'] });
  await api(store, u, 'PUT', '/api/v1/me/notification-settings', { meal_suggestions: true });
  __setNow(at(LUNCH_1045));
  const a = await api(store, u, 'GET', '/api/v1/notifications');
  const b = await api(store, u, 'GET', '/api/v1/notifications');
  assert.equal(a.data.inbox.length, 1);
  assert.equal(b.data.inbox.length, 1, 'not delivered twice');
  const n = a.data.inbox[0];
  assert.equal(n.slot, 'lunch');
  assert.equal(n.local_date, '2026-11-26');
  assert.equal(n.push.sandbox, true);
  assert.equal(n.push.delivered, false);
  assert.equal(n.weather, null, 'no weather claimed without a reading at a chosen location');
  const eggDishes = store.dishes.filter(d => d.allergen_tags.includes('egg')).map(d => d.id);
  assert.ok(n.dishes.every(d => !eggDishes.includes(d.dish_id)));
  assert.equal(a.data.sent_today, 1);
  // Detail, read, ownership
  const d = await api(store, u, 'GET', `/api/v1/notifications/${n.id}`);
  assert.equal(d.status, 200);
  assert.equal(d.data.read_at, null);
  const other = await login(store, '0900000083');
  assert.equal((await api(store, other, 'GET', `/api/v1/notifications/${n.id}`)).status, 403);
  assert.equal((await api(store, other, 'POST', `/api/v1/notifications/${n.id}/read`)).status, 403);
  assert.equal((await api(store, u, 'GET', '/api/v1/notifications/M8-NOPE')).status, 404);
  assert.equal((await api(store, null, 'GET', `/api/v1/notifications/${n.id}`)).status, 401);
  const r = await api(store, u, 'POST', `/api/v1/notifications/${n.id}/read`);
  assert.ok(r.data.read_at);
  assert.equal((await api(store, u, 'GET', '/api/v1/notifications')).data.unread_count, 0);
  // Outside the 3h window nothing new is delivered
  __setNow(at(EVENING_2130));
  assert.equal((await api(store, u, 'GET', '/api/v1/notifications')).data.inbox.length, 1);
});

test('M8: anti-fatigue cap — at most 2 notifications per local day, tests included', async () => {
  const store = createInitialStore();
  const u = await login(store, '0900000084');
  await api(store, u, 'PUT', '/api/v1/me/notification-settings', { meal_suggestions: true });
  __setNow(at(LUNCH_1045));
  await api(store, u, 'GET', '/api/v1/notifications'); // lunch delivered (1)
  const t1 = await api(store, u, 'POST', '/api/v1/notifications/test'); // (2)
  assert.equal(t1.status, 201);
  assert.equal(t1.data.sandbox, true);
  const t2 = await api(store, u, 'POST', '/api/v1/notifications/test');
  assert.equal(t2.status, 429);
  assert.equal(t2.data.capped, true);
  __setNow(at(DINNER_1730));
  const s = await api(store, u, 'GET', '/api/v1/notifications');
  assert.equal(s.data.inbox.length, 2, 'dinner reminder skipped: cap reached');
  assert.equal(s.data.remaining_today, 0);
  // Next day the counter starts again
  __setNow(at('2026-11-27T03:40:00Z'));
  assert.equal((await api(store, u, 'GET', '/api/v1/notifications')).data.sent_today, 1);
  assert.equal((await api(store, null, 'POST', '/api/v1/notifications/test')).status, 401);
  const all = await api(store, u, 'POST', '/api/v1/notifications/read-all');
  assert.equal(all.data.marked_read, 3);
});

test('M8: a user who lowered the cap to 1 gets only one reminder a day', async () => {
  const store = createInitialStore();
  const u = await login(store, '0900000085');
  await api(store, u, 'PUT', '/api/v1/me/meal-schedule', { max_per_day: 1 });
  __setNow(at(LUNCH_1045));
  await api(store, u, 'GET', '/api/v1/notifications');
  __setNow(at(DINNER_1730));
  const s = await api(store, u, 'GET', '/api/v1/notifications');
  assert.equal(s.data.inbox.length, 1);
});

test('M8: weather-aware text uses the real provider reading at the chosen location', async () => {
  setWeatherFetch(async () => ({ ok: true, json: async () => ({ current: { time: '2026-11-26T03:30', temperature_2m: 24.6, weather_code: 61 } }) }));
  const store = createInitialStore();
  const u = await login(store, '0900000086');
  await api(store, u, 'PUT', '/api/v1/me/profile', { lat: 10.9446, lng: 106.8243 });
  await api(store, u, 'PUT', '/api/v1/me/notification-settings', { meal_suggestions: true });
  __setNow(at(LUNCH_1045));
  const n = (await api(store, u, 'GET', '/api/v1/notifications')).data.inbox[0];
  assert.equal(n.weather.condition, 'rain_cool');
  assert.equal(n.weather.temp_c, 25);
  assert.match(n.title, /25°C/);
  // Switching weather off: no weather in the next message
  await api(store, u, 'PUT', '/api/v1/me/notification-settings', { weather_aware: false });
  const t = await api(store, u, 'POST', '/api/v1/notifications/test');
  assert.equal(t.data.notification.weather, null);
});

test('M8: lunar calendar (mùng 1 / rằm) and vegetarian reminders', async () => {
  assert.deepEqual(solarToLunar(17, 2, 2026), { day: 1, month: 1, year: 2026, leap: false }); // Tết Bính Ngọ
  assert.deepEqual(solarToLunar(10, 2, 2024), { day: 1, month: 1, year: 2024, leap: false }); // Tết Giáp Thìn
  assert.equal(solarToLunar(3, 3, 2026).day, 15); // Rằm tháng Giêng
  // Find the next mùng 1 after 2026-11-26 and deliver a lunch reminder that day.
  let d = new Date(Date.UTC(2026, 10, 26));
  while (solarToLunar(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()).day !== 1) d = new Date(d.getTime() + 86400000);
  const store = createInitialStore();
  const u = await login(store, '0900000087');
  await api(store, u, 'PUT', '/api/v1/me/notification-settings', { meal_suggestions: true });
  __setNow(() => new Date(d.getTime() + 3 * 3600000 + 45 * 60000)); // 10:45 VN
  const n = (await api(store, u, 'GET', '/api/v1/notifications')).data.inbox[0];
  assert.deepEqual(n.lunar && n.lunar.day, 1);
  const veg = new Set(store.dishes.filter(x => (x.diet_flags || []).includes('vegetarian') || (x.diet_flags || []).includes('vegan')).map(x => x.id));
  assert.ok(n.dishes.every(x => veg.has(x.dish_id)));
});

test('M8: PDPD — notifications and settings are exported and deleted with the account', async () => {
  const store = createInitialStore();
  const u = await login(store, '0900000089');
  await api(store, u, 'PUT', '/api/v1/me/notification-settings', { meal_suggestions: true });
  await api(store, u, 'POST', '/api/v1/notifications/test');
  const ex = await api(store, u, 'GET', '/api/v1/me/export');
  assert.equal(ex.data.modules.M8.notification.length, 1);
  assert.equal(ex.data.modules.M8.settings.length, 1);
  await api(store, u, 'DELETE', '/api/v1/me');
  assert.equal(store.moduleRecords.filter(r => r.owner_id === u.user.id).length, 0);
});
