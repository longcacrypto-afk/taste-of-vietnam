import assert from 'node:assert/strict';
import { handleApiRequest } from '../../src/api/router.js';
const query = o => new URLSearchParams(o);
export const NOW = new Date();
const weekly = pair => Object.fromEntries(Array.from({ length: 7 }, (_, d) => [d, pair]));
// WGS84 equatorial eastward points: PostGIS distances exactly 2990m / 3010m.
const east = metres => metres / 6378137 * 180 / Math.PI;
export function fixtures() {
  const common = { name: 'Quán thử', address: 'Fixture only', is_verified: true, is_open_override: true,
    closed_report_count: 0, lat: 0, lng: 0, verified_at: new Date(NOW.getTime() - 86400000).toISOString(),
    opening_hours: { weekly: weekly([['00:00', '24:00']]) },
    menu: [{ dish_id: 'DISH-101', name: 'Phở', price: 50000, available: true }] };
  return [
    { ...common, id: 'M4-IN', lng: east(2990) },
    { ...common, id: 'M4-OUT', lng: east(3010) },
    { ...common, id: 'M4-ZERO' },
    { ...common, id: 'M4-UNKNOWN', lat: null, lng: null },
    { ...common, id: 'M4-NOHOURS', opening_hours: null },
    { ...common, id: 'M4-STALE', verified_at: new Date(NOW.getTime() - 91 * 86400000).toISOString() },
    { ...common, id: 'M4-CLOSED', opening_hours: { weekly: weekly([]) } },
    { ...common, id: 'M4-PAUSED', is_open_override: false },
    { ...common, id: 'M4-UNVERIFIED', is_verified: false },
    { ...common, id: 'M4-NOMENU', menu: [{ dish_id: 'DISH-101', price: 1, available: false }] }
  ];
}

/** Same contract on both persistence engines; no provider calls, secrets or UI. */
export function contract(test, options, getStore) {
  const api = (path, q = {}) => handleApiRequest(getStore(), 'GET', path, query(q), {}, {});
  test('M4 2.99km in / 3.01km out; zero coordinates and distance 0 stay real', options, async () => {
    const r = await api('/api/v1/places', { lat: 0, lng: 0, radius: 3000, open_only: 'false' });
    assert.equal(r.status, 200);
    assert.ok(r.data.items.some(p => p.id === 'M4-IN'));
    assert.ok(!r.data.items.some(p => p.id === 'M4-OUT'));
    assert.ok(!r.data.items.some(p => p.id === 'M4-UNKNOWN'));
    assert.equal(r.data.items.find(p => p.id === 'M4-ZERO').distance_m, 0);
    const ds = r.data.items.map(p => p.distance_m);
    assert.deepEqual(ds, [...ds].sort((a, b) => a - b));
  });
  test('M4 query position/radius overrides profile and selected dish must be sold + available', options, async () => {
    const near = await api('/api/v1/places', { lat: 0, lng: 0, radius: 3100, dish_id: 'DISH-101', open_only: 'false' });
    assert.ok(near.data.items.some(p => p.id === 'M4-OUT'));
    assert.ok(!near.data.items.some(p => p.id === 'M4-NOMENU'));
    assert.equal((await api('/api/v1/places', { lat: 20, lng: 20, radius: 3000 })).data.total, 0);
    assert.equal((await api('/api/v1/places', { lat: 0, lng: 0, dish_id: 'NO-SUCH' })).data.total, 0);
  });
  test('M4 invalid positions/radius/boolean return 400 rather than falling back silently', options, async () => {
    for (const q of [{ lat: 1 }, { lng: 1 }, { lat: '', lng: 0 }, { lat: 'x', lng: 1 },
      { lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { radius: 0 }, { radius: -1 },
      { radius: 'NaN' }, { radius: 'Infinity' }, { radius: '' }, { radius: 50001 }, { open_only: 'yes' }]) {
      assert.equal((await api('/api/v1/places', q)).status, 400, JSON.stringify(q));
      assert.equal((await api('/api/v1/places/M4-ZERO', q)).status, 400, JSON.stringify(q));
    }
  });
  test('M4 detail deep links public, unknown id 404, missing location distance null', options, async () => {
    assert.equal((await api('/api/v1/places/NO-SUCH')).status, 404);
    const found = await api('/api/v1/places/M4-IN', { lat: 0, lng: 0 });
    assert.equal(found.status, 200);
    assert.ok(found.data.distance_m > 2900 && found.data.distance_m < 3000);
    const unknown = await api('/api/v1/places/M4-UNKNOWN', { lat: 0, lng: 0 });
    assert.equal(unknown.data.lat, null);
    assert.equal(unknown.data.lng, null);
    assert.equal(unknown.data.distance_m, null);
    const closed = await api('/api/v1/places/M4-CLOSED');
    assert.equal(closed.data.open_status.status, 'closed');
    assert.equal(closed.data.is_currently_open, false);
  });
  test('M4 compatible and strict policies use same status; no-hours/stale never claim open', options, async () => {
    const repo = getStore().repo;
    for (const requireVerifiedHours of [false, true]) {
      const rows = await repo.findPlacesNear({ lat: 0, lng: 0, radiusM: 3100, now: NOW, requireVerifiedHours });
      const ids = rows.map(p => p.id);
      assert.ok(ids.includes('M4-IN'));
      for (const id of ['M4-CLOSED', 'M4-PAUSED', 'M4-UNVERIFIED']) assert.ok(!ids.includes(id), id);
      for (const id of ['M4-NOHOURS', 'M4-STALE']) assert.equal(ids.includes(id), !requireVerifiedHours, id);
      for (const row of rows) {
        assert.equal(row.is_currently_open, row.open_status.status === 'open');
        assert.equal(row.open_status.label === 'Đang mở', row.is_currently_open);
      }
    }
  });
  test('M4 REQUIRE_VERIFIED_HOURS environment controls API with no location invented', options, async () => {
    const old = process.env.REQUIRE_VERIFIED_HOURS;
    try {
      for (const mode of ['false', 'true']) {
        process.env.REQUIRE_VERIFIED_HOURS = mode;
        const r = await api('/api/v1/places', { lat: 0, lng: 0, radius: 3000 });
        assert.equal(r.data.items.some(p => p.id === 'M4-NOHOURS'), mode === 'false');
        assert.equal(r.data.items.some(p => p.id === 'M4-STALE'), mode === 'false');
      }
      const rows = await getStore().repo.findPlacesNear({ lat: null, lng: null, openOnly: false });
      assert.ok(rows.some(p => p.id === 'M4-UNKNOWN'));
      assert.ok(rows.every(p => p.distance_m === null));
    } finally {
      if (old === undefined) delete process.env.REQUIRE_VERIFIED_HOURS;
      else process.env.REQUIRE_VERIFIED_HOURS = old;
    }
  });
}
