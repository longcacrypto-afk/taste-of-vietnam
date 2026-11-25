// =============================================================================
// P1: repository behaviour in memory mode (DATABASE_URL unset) — the same rules
// the PostgreSQL suite (tests/postgres, npm run test:db) checks on a real DB.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { handleApiRequest } from '../src/api/router.js';
import { getRepository, MemoryRepository } from '../src/db/repository.js';
import { suggestionCache } from '../src/services/cacheService.js';
import { guest } from './helpers/auth.js';

const q = () => new URLSearchParams();

test('Without DATABASE_URL the API uses the in-memory repository', () => {
  const store = createInitialStore();
  const repo = getRepository(store);
  assert.ok(repo instanceof MemoryRepository);
  assert.equal(repo.kind, 'memory');
  assert.equal(getRepository(store), repo, 'one repository per store');
});

test('3-day cooldown also hides a sponsored dish the user just ate', async () => {
  suggestionCache.clear();
  const store = createInitialStore();
  const g = await guest(store);
  const before = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', q(), {}, g.headers);
  const sponsored = before.data.items.find(i => i.is_sponsored);
  assert.ok(sponsored, 'seed data shows one sponsored dish');
  await handleApiRequest(store, 'POST', '/api/v1/suggestions/feedback', q(), { dish_id: sponsored.dish_id, action: 'eaten' }, g.headers);
  const after = await handleApiRequest(store, 'GET', '/api/v1/suggestions/today', q(), {}, g.headers);
  assert.ok(!after.data.items.some(i => i.dish_id === sponsored.dish_id));
});

test('Loopback: a user cannot confirm another user\'s order', async () => {
  const store = createInitialStore();
  const a = await guest(store);
  const b = await guest(store);
  const redir = await handleApiRequest(store, 'POST', '/api/v1/orders/redirect', q(), { place_id: 'PLACE-401', dish_id: 'DISH-101' }, a.headers);
  const other = await handleApiRequest(store, 'POST', `/api/v1/orders/${redir.data.id}/confirm-eaten`, q(), {}, b.headers);
  assert.equal(other.status, 404);
  assert.equal(b.user.suggestionHistory.length, 0);
  const own = await handleApiRequest(store, 'POST', `/api/v1/orders/${redir.data.id}/confirm-eaten`, q(), {}, a.headers);
  assert.equal(own.status, 200);
  assert.equal(a.user.suggestionHistory[0].dish_id, 'DISH-101');
});

test('DELETE /me also removes the user\'s order redirects and own recipes', async () => {
  const store = createInitialStore();
  const a = await guest(store);
  await handleApiRequest(store, 'POST', '/api/v1/orders/redirect', q(), { place_id: 'PLACE-401', dish_id: 'DISH-101' }, a.headers);
  const rec = await handleApiRequest(store, 'POST', '/api/v1/community/recipes', q(), { title: 'Món riêng' }, a.headers);
  await handleApiRequest(store, 'DELETE', '/api/v1/me', q(), {}, a.headers);
  assert.ok(!store.orderRedirects.some(o => o.user_id === a.user.id));
  assert.ok(!store.communityRecipes.some(r => r.id === rec.data.id));
  assert.ok(store.communityRecipes.some(r => r.id === 'CREC-01'), 'other recipes stay');
});

test('Admin writes are recorded in the audit log', async () => {
  const { loginAdmin } = await import('./helpers/auth.js');
  const store = createInitialStore();
  const admin = await loginAdmin(store);
  const d = await handleApiRequest(store, 'POST', '/api/v1/admin/dishes', q(), { name: 'Bánh Cuốn', allergens: ['egg'] }, admin.headers);
  assert.deepEqual(d.data.allergen_tags, ['egg'], 'admin dishes use the field the allergy filter reads');
  const logs = await handleApiRequest(store, 'GET', '/api/v1/admin/audit-logs', q(), {}, admin.headers);
  assert.equal(logs.data.logs[0].action, 'CREATE_DISH');
  assert.equal(logs.data.logs[0].target, d.data.id);
  assert.equal(logs.data.logs[0].actor_id, admin.user.id);
});
