// M14 (live-module reference): stories + regional variants, demo data, core fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';

const q = (s = '') => new URLSearchParams(s);

test('M14: stories list is demo-seeded and persisted through the module store', async () => {
  const store = createInitialStore();
  const r = await handleApiRequest(store, 'GET', '/api/v1/stories', q());
  assert.equal(r.status, 200);
  assert.ok(r.data.items.length >= 3);
  assert.ok(r.data.items.every(s => s.is_demo === true));
  assert.ok(store.moduleRecords.some(x => x.module === 'M14' && x.kind === 'story'));
  const d = await handleApiRequest(store, 'GET', '/api/v1/stories', q('dish_id=DISH-101'));
  assert.deepEqual(d.data.items.map(s => s.dish_id), ['DISH-101']);
});

test('M14: one story by id or slug, its variants, 404 for unknown variants', async () => {
  const store = createInitialStore();
  const a = await handleApiRequest(store, 'GET', '/api/v1/stories/STORY-PHO', q());
  const b = await handleApiRequest(store, 'GET', '/api/v1/stories/hanh-trinh-pho-viet', q());
  assert.equal(a.status, 200);
  assert.equal(a.data.id, b.data.id);
  assert.ok(a.data.body.length > 0);
  const v = await handleApiRequest(store, 'GET', '/api/v1/stories/STORY-PHO/variants', q());
  assert.equal(v.status, 200);
  assert.ok(v.data.items.length >= 2);
  const missing = await handleApiRequest(store, 'GET', '/api/v1/stories/NOPE/variants', q());
  assert.equal(missing.status, 404);
});

test('M14: an unknown story id still falls through to the core generated dish story', async () => {
  const store = createInitialStore();
  const r = await handleApiRequest(store, 'GET', '/api/v1/stories/DISH-101', q());
  assert.equal(r.status, 200);
  assert.notEqual(r.data.id, 'STORY-PHO');
});

test('demo seeding can be switched off', async () => {
  process.env.SEED_DEMO_MODULES = 'false';
  try {
    const store = createInitialStore();
    const r = await handleApiRequest(store, 'GET', '/api/v1/stories', q());
    assert.equal(r.data.items.length, 0);
  } finally { delete process.env.SEED_DEMO_MODULES; }
});
