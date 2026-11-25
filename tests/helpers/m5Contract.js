import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApiRequest } from '../../src/api/router.js';
import { redirectEvent } from '../../src/services/redirectService.js';

const valid = { place_id: 'PLACE-401', dish_id: 'DISH-101', partner: 'grabfood' };
export function m5Contract(setup, options = {}) {
  const run = (name, fn) => test(`M5 ${name}`, options, async t => {
    const ctx = await setup();
    t.after(ctx.close || (() => {}));
    const g = await handleApiRequest(ctx.store, 'POST', '/api/v1/auth/guest', new URLSearchParams(), {});
    ctx.userId = g.data.guest_id;
    ctx.headers = { authorization: `Bearer ${g.data.access_token}` };
    ctx.api = (method, path, body = {}, headers = ctx.headers) =>
      handleApiRequest(ctx.store, method, path, new URLSearchParams(), body, headers);
    ctx.redirect = body => ctx.api('POST', '/api/v1/orders/redirect', { ...valid, ...body });
    ctx.confirm = (id, headers) => ctx.api('POST', `/api/v1/orders/${id}/confirm-eaten`, {}, headers);
    await fn(ctx);
  });
  run('rejects unknown partners and invalid ids without catalogue fallback', async c => {
    for (const partner of ['evil', 'javascript', '', null, 123, 'befood', 'xanhsm'])
      assert.equal((await c.redirect({ partner })).status, 400);
    for (const body of [{ place_id: 'missing' }, { dish_id: 'missing' }, { place_id: null }, { dish_id: [] }])
      assert.equal((await c.redirect(body)).status, 404);
    assert.equal((await c.confirm('does-not-exist')).status, 404);
    assert.equal((await c.repo.listHistory(c.userId)).length, 0);
  });
  run('blocks dangerous schemes, wrong hosts, credentials and disguised hosts', async c => {
    const place = await c.repo.getPlace('PLACE-401');
    c.repo.getPlace = async () => place;
    for (const link of ['javascript:alert(1)', 'data:text/html,hi', 'http://food.grab.com/shop',
      'https://food.grab.com.evil.test/x', 'https://evil.test/food.grab.com',
      'https://u:p@food.grab.com/x', 'https://food.grab.com:444/x',
      'https://food.grab.com./x', '//food.grab.com/x', 'https://food.grab.com\\\\@evil.test/x']) {
      place.links.grabfood = link;
      assert.equal((await c.redirect()).status, 422, link);
    }
    delete place.links.grabfood;
    assert.equal((await c.redirect()).status, 422, 'no Maps substitution');
  });
  run('accepts both existing ordering partners and only fixed tracking tags', async c => {
    const place = await c.repo.getPlace('PLACE-401');
    c.repo.getPlace = async () => place;
    place.links.grabfood += '?phone=0912345678&lat=10.2&token=private#secret';
    for (const partner of ['grabfood', 'shopeefood']) {
      const r = await c.redirect({ partner, phone: 'private', lat: 88, target_deeplink: 'https://evil.test' });
      assert.equal(r.status, 200);
      const url = new URL(r.data.target_deeplink);
      assert.equal(url.protocol, 'https:');
      assert.deepEqual([...url.searchParams.keys()], ['utm_source', 'utm_medium']);
      assert.equal(new URL(r.data.fallback_web_url).search, '');
      assert.equal(url.hash, '');
    }
  });
  run('builds canonical Maps directions from place, not user GPS', async c => {
    const r = await c.redirect({ partner: 'maps', lat: 88, lng: 99 });
    assert.equal(r.status, 200);
    const url = new URL(r.data.target_deeplink);
    assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/dir/');
    assert.equal(url.searchParams.get('api'), '1');
    assert.equal(url.searchParams.get('destination'), '10.9598,106.8452');
    assert.equal(url.searchParams.has('origin'), false);
    assert.equal(r.data.action_type, 'direction');
  });
  run('rejects bad Maps coordinates', async c => {
    const place = await c.repo.getPlace('PLACE-401');
    c.repo.getPlace = async () => place;
    for (const lat of [NaN, Infinity, 91, null, '10.2']) {
      place.lat = lat;
      assert.equal((await c.redirect({ partner: 'maps' })).status, 422);
    }
  });
  run('builds digits-only tel without UTM, rejects malicious phone values', async c => {
    const place = await c.repo.getPlace('PLACE-401');
    c.repo.getPlace = async () => place;
    place.phone = '+84 (251) 384-5999';
    const r = await c.redirect({ partner: 'phone' });
    assert.equal(r.status, 200);
    assert.equal(r.data.target_deeplink, 'tel:842513845999');
    assert.equal(r.data.fallback_web_url, null);
    assert.equal(r.data.action_type, 'call');
    for (const phone of ['javascript:123456789', '12345678;ext=1', '123?utm=hi', '12', '', '1'.repeat(16)]) {
      place.phone = phone;
      assert.equal((await c.redirect({ partner: 'phone' })).status, 422);
    }
  });
  run('validates verification, pause, menu membership and availability', async c => {
    const place = await c.repo.getPlace('PLACE-401');
    const original = structuredClone(place);
    c.repo.getPlace = async () => place;
    for (const patch of [{ is_verified: false }, { is_open_override: false }, { is_paused: true },
      { status: 'pending_review' }, { menu: [] }, { menu: [{ dish_id: 'DISH-101', available: false }] }]) {
      Object.assign(place, structuredClone(original), patch);
      assert.equal((await c.redirect()).status, patch.is_verified===false ? 404 : 409, JSON.stringify(patch));
    }
    Object.assign(place, original);
    assert.equal((await c.redirect({ dish_id: 'DISH-102' })).status, 409);
  });
  run('requires dish for order; place-only Maps/phone cannot invent eaten dish', async c => {
    assert.equal((await c.redirect({ dish_id: undefined })).status, 400);
    for (const partner of ['maps', 'phone']) {
      const r = await c.redirect({ partner, dish_id: undefined });
      assert.equal(r.status, 200);
      assert.equal((await c.confirm(r.data.id)).status, 409);
    }
    assert.equal((await c.repo.listHistory(c.userId)).length, 0);
  });
  run('confirmation is idempotent under concurrency and later retries', async c => {
    const r = await c.redirect();
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const replies = await Promise.all(Array.from({ length: 12 }, () => c.confirm(r.data.id)));
    assert.ok(replies.every(r => r.status === 200 && r.data.confirmation_source === 'self_report'));
    assert.equal(replies.filter(r => !r.data.already_confirmed).length, 1);
    const first = (await c.repo.getOrderRedirect(r.data.id)).confirmed_at;
    assert.ok(first);
    assert.equal((await c.confirm(r.data.id)).data.already_confirmed, true);
    assert.equal((await c.repo.getOrderRedirect(r.data.id)).confirmed_at, first);
    const history = await c.repo.listHistory(c.userId);
    assert.equal(history.length, 1);
    assert.equal(history[0].dish_id, 'DISH-101');
  });
  run('owner check applies both before and after confirmation; resume is private', async c => {
    const a = await c.redirect();
    const other = await c.api('POST', '/api/v1/auth/guest');
    const b = { authorization: `Bearer ${other.data.access_token}` };
    assert.equal((await c.confirm(a.data.id, b)).status, 404);
    await c.confirm(a.data.id);
    assert.equal((await c.confirm(a.data.id, b)).status, 404);
    assert.equal((await c.api('GET', '/api/v1/orders/redirects', {}, b)).data.items.length, 0);
    assert.equal((await c.api('GET', '/api/v1/orders/redirects')).data.items[0].id, a.data.id);
    assert.equal((await c.api('GET', '/api/v1/orders/redirects', {}, {})).status, 401);
  });
  run('three actions persist one minimal event per redirect, no PII in event projection', async c => {
    for (const partner of ['grabfood', 'maps', 'phone']) await c.redirect({ partner });
    const rows = await c.repo.listOrderRedirects(c.userId);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(r => r.action_type).sort(), ['call', 'direction', 'order']);
    for (const row of rows) {
      const event = redirectEvent(row);
      assert.deepEqual(Object.keys(event).sort(),
        ['redirect_id', 'action_type', 'clicked_at', 'confirmed_at', 'confirmation_source'].sort());
      assert.ok(event.clicked_at);
      assert.equal(event.confirmation_source, null);
      assert.ok(!JSON.stringify(event).includes('0251'));
    }
  });
}
