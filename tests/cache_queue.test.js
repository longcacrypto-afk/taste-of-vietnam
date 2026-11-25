// =============================================================================
// TEST SUITE: CACHE SERVICE, ASYNC QUEUE & HIGH-THROUGHPUT ROADMAP
// SLA: p95 latency < 1ms on cache hits, anti-fatigue push SLA <= 2/day
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { call } from './helpers/auth.js';
import { suggestionCache } from '../src/services/cacheService.js';
import { pushQueue } from '../src/services/queueService.js';

test('CACHE-01: CacheService stores, retrieves, and tracks hit statistics', () => {
  suggestionCache.clear();
  suggestionCache.set('test:key:1', { message: 'hello' }, 10);

  const hit = suggestionCache.get('test:key:1');
  assert.equal(hit.message, 'hello');

  const miss = suggestionCache.get('test:key:nonexistent');
  assert.equal(miss, null);

  const stats = suggestionCache.getStats();
  assert.equal(stats.hits >= 1, true);
  assert.equal(stats.misses >= 1, true);
  assert.equal(stats.size >= 1, true);
});

test('CACHE-02: GET /api/v1/suggestions/today leverages cache on repeated requests', async () => {
  suggestionCache.clear();
  const store = createInitialStore();

  // First call: Cache Miss
  const res1 = await call(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  assert.equal(res1.status, 200);
  assert.equal(res1.data.items.length, 3);
  assert.equal(res1.data.from_cache, undefined);

  // Second call: Cache Hit
  const res2 = await call(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  assert.equal(res2.status, 200);
  assert.equal(res2.data.from_cache, true);
  assert.equal(res2.data.items.length, 3);
});

test('CACHE-03: Order confirmation (M5 loopback) invalidates suggestion cache', async () => {
  suggestionCache.clear();
  const store = createInitialStore();

  // Populate cache
  await call(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());

  // Confirm eaten order -> triggers invalidation
  const confirmRes = await call(store, 'POST', '/api/v1/orders/ORD-TEST-999/confirm-eaten', new URLSearchParams(), {
    dish_id: 'DISH-101',
    dish_name: 'Phở Bò Tái Nạm'
  });
  assert.equal(confirmRes.status, 200);

  // Next call should be a fresh query (not from_cache)
  const resAfter = await call(store, 'GET', '/api/v1/suggestions/today', new URLSearchParams());
  assert.equal(resAfter.data.from_cache, undefined);
});

test('QUEUE-01: PushQueueService enqueues and enforces <= 2 notifications/day SLA', async () => {
  const userId = 'usr-test-queue-01';

  // Job 1: Success
  const j1 = pushQueue.enqueueNotification(userId, {
    type: 'lunch_reminder',
    title: 'Gợi ý bữa trưa',
    body: 'Phở Bò nóng hổi'
  });
  assert.equal(j1.success, true);

  // Dispatch batch to record sent history
  await pushQueue.processBatch();

  // Job 2: Success
  const j2 = pushQueue.enqueueNotification(userId, {
    type: 'dinner_reminder',
    title: 'Gợi ý bữa tối',
    body: 'Cơm tấm sườn nướng'
  });
  assert.equal(j2.success, true);
  await pushQueue.processBatch();

  // Job 3: REJECTED by Anti-Fatigue Guard
  const j3 = pushQueue.enqueueNotification(userId, {
    type: 'late_night',
    title: 'Ăn khuya không?',
    body: 'Cháo sườn sụn'
  });
  assert.equal(j3.success, false);
  assert.equal(j3.reason, 'ANTI_FATIGUE_LIMIT_REACHED');
});

test('SYS-01: System monitoring endpoints return cache and queue metrics', async () => {
  const store = createInitialStore();
  const cacheRes = await call(store, 'GET', '/api/v1/system/cache', new URLSearchParams());
  assert.equal(cacheRes.status, 200);
  assert.equal(typeof cacheRes.data.hit_rate_pct, 'number');

  const qRes = await call(store, 'GET', '/api/v1/notifications/queue-status', new URLSearchParams());
  assert.equal(qRes.status, 200);
  assert.equal(typeof qRes.data.pending_jobs, 'number');
});
