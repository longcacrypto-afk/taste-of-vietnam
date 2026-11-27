// Small helpers shared by the M11, M12 and M13 live modules (not a module itself:
// src/modules/index.js only loads files named m<NN>.js / w.js).
import { removeVietnameseTones } from '../services/textUtils.js';

export const TZ = 'Asia/Ho_Chi_Minh';
const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** YYYY-MM-DD of an instant in Việt Nam time. */
export const localDate = (at = Date.now()) => dateFmt.format(new Date(at));
/** HH:MM of an instant in Việt Nam time. */
export const localTime = (at = Date.now()) => timeFmt.format(new Date(at));
export const addDays = (date, n) => new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;
export const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
export const weekdayLabel = date => WEEKDAYS[new Date(date + 'T00:00:00Z').getUTCDay()];
export const shortDate = date => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
/** Instant (ms) of a Việt Nam wall-clock date + HH:MM (UTC+7, no DST). */
export const vnInstant = (date, hhmm) => Date.parse(`${date}T${hhmm}:00+07:00`);

export const norm = s => removeVietnameseTones(s || '');
export const tokens = s => norm(s).split(' ').filter(t => t.length > 0);
export const money = n => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;

export const ALLERGY_VI = {
  shrimp: 'tôm/hải sản', peanut: 'đậu phộng', shrimp_paste: 'mắm tôm', dairy: 'sữa', milk: 'sữa',
  egg: 'trứng', gluten: 'gluten', fish: 'cá', soy: 'đậu nành', shellfish: 'hải sản có vỏ'
};
