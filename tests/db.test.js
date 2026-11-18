// =============================================================================
// DATABASE LAYER TESTS — POSTGRESQL & FALLBACK VERIFICATION
// Hôm nay ăn gì · Taste of Vietnam v0.1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { initDatabase, isPostgresConnected, closeDatabase } from '../src/db/connection.js';
import {
  findPlacesWithinRadius,
  searchDishesWithFilters,
  recordAdClickWithAntiFraud,
  verifyGpsAndSubmitReview,
  saveWeeklyMealPlan,
  fetchDishCulturalStory,
  fetchFoodTrail,
  fetchB2gTourismReport,
} from '../src/db/repository.js';

test('DB-01: Graceful fallback when DATABASE_URL is not set', () => {
  const originalUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  const pool = initDatabase();
  assert.equal(pool, null, 'Pool should be null when DATABASE_URL is absent');
  assert.equal(isPostgresConnected(), false, 'isPostgresConnected should be false');

  if (originalUrl) process.env.DATABASE_URL = originalUrl;
});

test('DB-02: Repository methods safely fallback when PostgreSQL is offline', async () => {
  const places = await findPlacesWithinRadius(106.82, 10.95, 3000, 12);
  assert.equal(places, null, 'findPlacesWithinRadius should return null in fallback mode');

  const dishes = await searchDishesWithFilters({ keyword: 'pho' });
  assert.equal(dishes, null, 'searchDishesWithFilters should return null in fallback mode');

  const adResult = await recordAdClickWithAntiFraud('CAM-501', 'hash123');
  assert.equal(adResult, null, 'recordAdClickWithAntiFraud should return null in fallback mode');

  const reviewResult = await verifyGpsAndSubmitReview('PLACE-401', 106.82, 10.95, 5, 'Ngon');
  assert.equal(reviewResult, null, 'verifyGpsAndSubmitReview should return null in fallback mode');

  const mealPlanResult = await saveWeeklyMealPlan({});
  assert.equal(mealPlanResult, null, 'saveWeeklyMealPlan should return null in fallback mode');

  const storyResult = await fetchDishCulturalStory('DISH-101');
  assert.equal(storyResult, null, 'fetchDishCulturalStory should return null in fallback mode');

  const trailResult = await fetchFoodTrail();
  assert.equal(trailResult, null, 'fetchFoodTrail should return null in fallback mode');

  const b2gResult = await fetchB2gTourismReport();
  assert.equal(b2gResult, null, 'fetchB2gTourismReport should return null in fallback mode');
});

test('DB-03: Close database handles null pool gracefully', async () => {
  await closeDatabase();
  assert.equal(isPostgresConnected(), false);
});
