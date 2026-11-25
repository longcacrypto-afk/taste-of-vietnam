// =============================================================================
// TEST SUITE: GEMINI 2.0 FLASH MULTIMODAL VISION (M6 & M18)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStore } from '../src/data/seed.js';
import { call } from './helpers/auth.js';
import { analyzeFoodImageWithGemini } from '../src/services/geminiService.js';

test('VISION-01: analyzeFoodImageWithGemini identifies fridge contents in fallback mode', async () => {
  const result = await analyzeFoodImageWithGemini('fake_base64_data', 'image/jpeg', 'fridge');
  assert.equal(Array.isArray(result.detected_ingredients), true);
  assert.equal(result.detected_ingredients.length > 0, true);
  assert.equal(Array.isArray(result.suggested_zero_waste_dishes), true);
  assert.equal(result.source.includes('vision'), true);
});

test('VISION-02: analyzeFoodImageWithGemini extracts restaurant menu items in fallback mode', async () => {
  const result = await analyzeFoodImageWithGemini('fake_menu_base64', 'image/jpeg', 'menu');
  assert.equal(Array.isArray(result.items), true);
  assert.equal(result.items.length >= 2, true);
  assert.equal(typeof result.items[0].price_vnd, 'number');
  assert.equal(result.source.includes('ocr'), true);
});

test('VISION-03: POST /api/v1/vision/analyze endpoint handles both fridge & menu requests', async () => {
  const store = createInitialStore();

  // Test fridge context
  const fridgeRes = await call(store, 'POST', '/api/v1/vision/analyze', new URLSearchParams(), {
    context: 'fridge',
    image_base64: 'sample_base64'
  });
  assert.equal(fridgeRes.status, 200);
  assert.equal(Array.isArray(fridgeRes.data.detected_ingredients), true);

  // Test menu context
  const menuRes = await call(store, 'POST', '/api/v1/vision/analyze', new URLSearchParams(), {
    context: 'menu',
    image_base64: 'sample_menu_base64'
  });
  assert.equal(menuRes.status, 200);
  assert.equal(Array.isArray(menuRes.data.items), true);
});
