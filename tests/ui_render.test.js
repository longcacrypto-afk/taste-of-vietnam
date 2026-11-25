// P0: UI screen templates rendered in a VM with real API data
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadUi } from './helpers/ui.js';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';

test('/app M3-S01 shows the 3 dish names and prices returned by GET /suggestions/today (no "undefined")', async () => {
  const store = createInitialStore();
  const today = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  const win = loadUi({ liveToday: today.data });
  const html = win.SCREENS_M3_M4_M5_M8['M3-S01'].render();
  assert.ok(!html.includes('>undefined<'), 'no undefined dish names');
  for (const item of today.data.items) {
    assert.ok(html.includes(item.name), `card shows ${item.name}`);
    assert.ok(html.includes(Number(item.price_vnd).toLocaleString('vi-VN')), `card shows price of ${item.name}`);
  }
});
