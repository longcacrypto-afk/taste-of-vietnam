import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlaceOpenStatus, isPlaceEligible, PLACE_STALE_MS } from '../src/services/placeHours.js';

const at = value => new Date(`2026-11-${value}+07:00`);
const now = at('26T12:00:00');
const fullWeek = pair => Object.fromEntries(Array.from({ length: 7 }, (_, d) => [d, pair]));
const place = (patch = {}) => ({
  is_verified: true, is_open_override: true, verified_at: at('25T12:00:00').toISOString(),
  opening_hours: { weekly: fullWeek([['08:00', '20:00']]), overrides: {} }, ...patch
});
const status = (p, t = now) => getPlaceOpenStatus(p, t).status;

test('M4 time is Asia/Ho_Chi_Minh, opening inclusive / closing exclusive to the second', () => {
  assert.equal(status(place(), at('26T07:59:59')), 'closed');
  assert.equal(status(place(), at('26T08:00:00')), 'open');
  assert.equal(status(place(), at('26T19:59:59')), 'open');
  assert.equal(status(place(), at('26T20:00:00')), 'closed');
  assert.equal(status(place(), '2026-11-26T01:00:00Z'), 'open');
  assert.equal(getPlaceOpenStatus(place(), now).timezone, 'Asia/Ho_Chi_Minh');
});

test('M4 overnight Thursday → Friday and Sunday → Monday, exact midnight and closing', () => {
  const weekly = fullWeek([]);
  weekly[4] = [['20:00', '02:00']];
  weekly[0] = [['22:00', '03:00']];
  const p = place({ opening_hours: { weekly } });
  for (const date of ['26T20:00:00', '26T23:59:59', '27T00:00:00', '27T01:59:59', '30T02:59:59']) {
    assert.equal(status(p, at(date)), 'open', date);
  }
  assert.equal(status(p, at('27T02:00:00')), 'closed');
  assert.equal(status(p, at('30T03:00:00')), 'closed');
});

test('M4 explicit closed days, multiple shifts, all day and gaps', () => {
  const weekly = fullWeek([]);
  weekly[4] = [['08:00', '12:00'], ['17:00', '21:00']];
  weekly[5] = [['00:00', '24:00']];
  const p = place({ opening_hours: { weekly } });
  assert.equal(status(p, now), 'closed');
  assert.equal(status(p, at('26T17:00:00')), 'open');
  assert.equal(status(p, at('27T00:00:00')), 'open');
  assert.equal(status(p, at('27T23:59:59')), 'open');
  assert.equal(status(p, at('28T00:00:00')), 'closed');
});

test('M4 date overrides replace the whole day and suppress previous overnight spill', () => {
  const weekly = fullWeek([['20:00', '02:00']]);
  const p = place({ opening_hours: { weekly, overrides: { '2026-11-27': [] } } });
  assert.equal(status(p, at('27T01:00:00')), 'closed');
  p.opening_hours.overrides['2026-11-27'] = [['09:00', '10:00']];
  assert.equal(status(p, at('27T01:00:00')), 'closed');
  assert.equal(status(p, at('27T09:00:00')), 'open');
  assert.equal(status(p, at('27T10:00:00')), 'closed');
  p.opening_hours.overrides['2026-11-27'] = [['23:00', '04:00']];
  assert.equal(status(p, at('28T03:59:59')), 'open');
  assert.equal(status(p, at('28T04:00:00')), 'closed');
});

test('M4 exactly 90 days is stale; missing/invalid/future verification is unknown', () => {
  const base = now.getTime() - PLACE_STALE_MS;
  assert.equal(status(place({ verified_at: new Date(base + 1).toISOString() })), 'open');
  for (const offset of [0, -1]) assert.equal(status(place({ verified_at: new Date(base + offset).toISOString() })), 'stale');
  for (const verified_at of [undefined, null, '', 'invalid', '2099-01-01T00:00:00Z']) {
    assert.equal(status(place({ verified_at })), 'unknown');
  }
});

test('M4 no hours, legacy demo hours, malformed intervals and missing days are never open', () => {
  for (const opening_hours of [null, {}, [], { weekly: {} }, { weekly: { 4: null } },
    { weekly: fullWeek([['20:00', '20:00']]) }, { weekly: fullWeek([['25:00', '26:00']]) },
    { weekly: fullWeek([['8:00', '09:00']]) }, { weekly: fullWeek([['08:00']]) },
    { weekly: fullWeek([['08:00', '20:00']]), overrides: [] }]) {
    assert.equal(status(place({ opening_hours, open_hour: 6, close_hour: 22 })), 'unknown');
  }
  assert.equal(getPlaceOpenStatus(place(), 'bad').status, 'unknown');
  assert.equal(getPlaceOpenStatus(null).status, 'unknown');
});

test('M4 paused/unverified never open; report counters are not reinterpreted here', () => {
  assert.equal(status(place({ is_open_override: false })), 'closed');
  assert.equal(status(place({ is_paused: true })), 'closed');
  assert.equal(status(place({ is_verified: false })), 'unknown');
  assert.equal(status(place({ closed_report_count: 99 })), 'open', 'closure policy owns the paused flag');
});

test('M4 shared eligibility defaults compatible; strict accepts only open and labels never lie', () => {
  for (const [patch, expected, compatible, strict] of [
    [{}, 'open', true, true],
    [{ opening_hours: null }, 'unknown', true, false],
    [{ verified_at: '2026-01-01T00:00:00Z' }, 'stale', true, false],
    [{ opening_hours: { weekly: fullWeek([]) } }, 'closed', false, false],
    [{ is_open_override: false }, 'closed', false, false],
    [{ is_verified: false }, 'unknown', false, false]
  ]) {
    const p = place(patch), result = getPlaceOpenStatus(p, now);
    assert.equal(result.status, expected);
    assert.equal(result.is_currently_open, expected === 'open');
    assert.equal(result.label === 'Đang mở', expected === 'open');
    assert.equal(isPlaceEligible(p, now), compatible);
    assert.equal(isPlaceEligible(p, now, { requireVerifiedHours: true }), strict);
  }
});
