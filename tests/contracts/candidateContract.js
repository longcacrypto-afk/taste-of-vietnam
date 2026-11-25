import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidates } from '../../src/services/candidatePipeline.js';
import { handleApiRequest } from '../../src/api/router.js';
import { suggestionCache } from '../../src/services/cacheService.js';

export const NOW = Date.parse('2026-11-26T04:00:00Z');
export const matrixDishes = () => Array.from({ length: 32 }, (_, n) => ({
  id: `MATRIX-${n}`, name: `Món kiểm thử ${n}`, safety_status: 'approved',
  allergen_tags: n & 1 ? ['shrimp'] : [], diet_flags: n & 2 ? ['vegetarian'] : [],
  meal_slots: n & 4 ? ['dinner'] : ['lunch'], spice_level: 0,
  ref_price: n & 8 ? 40000 : 20000, market_cost_base: n & 8 ? 80000 : 40000, base_servings: 2,
  ingredients: [{ name: 'Thành phần fixture', amount: 1, unit: 'g' }],
  steps: [{ step: 1, title: 'Bước fixture' }], region: 'nam', weather_fit: []
}));
export const matrixPlace = dishes => ({ id: 'MATRIX-PLACE', name: 'Quán fixture', is_verified: true,
  is_open_override: true, closed_report_count: 0, lat: 10.9582, lng: 106.8431,
  menu: dishes.map(d => ({ dish_id: d.id, available: true, price: d.ref_price })) });

// Same 32 contexts and endpoint assertions against memory and actual SQL rows.
export function candidateContract(label, setupScenario, { skip = false } = {}) {
  for (let scenario = 0; scenario < 32; scenario++) {
    test(`${label}: allergy × vegetarian × budget × meal × eaten ${scenario}`, { skip }, async () => {
      const allergies = Boolean(scenario & 1), vegetarian = Boolean(scenario & 2);
      const tight = Boolean(scenario & 4), dinner = Boolean(scenario & 8), eaten = Boolean(scenario & 16);
      const profile = { hard_allergies: allergies ? ['shrimp'] : [], diet_mode: vegetarian ? 'vegetarian' : 'balanced',
        budget_min: 0, budget_max: tight ? 30000 : 50000, meal_slot: dinner ? 'dinner' : 'lunch',
        lat: 10.9582, lng: 106.8431, radius_m: 3000, disliked_dish_ids: [], regions: [] };
      const history = eaten ? matrixDishes().filter((_, n) => n & 16).map(d => ({ id: `h-${scenario}-${d.id}`, dish_id: d.id,
        dish_name: d.name, action: 'eaten', created_at: new Date().toISOString() })) : [];
      const { store, view, headers } = await setupScenario(profile, history);
      const expected = matrixDishes().filter((d, n) => (!allergies || !(n & 1)) && (!vegetarian || Boolean(n & 2))
        && (!tight || !(n & 8)) && Boolean(n & 4) === dinner && (!eaten || !(n & 16))).map(d => d.id).sort();
      for (const mode of ['both', 'cook', 'eat_out']) {
        const result = buildCandidates(view, { mode });
        assert.deepEqual(result.candidates.map(c => c.dish_id).sort(), expected);
        assert.ok(result.candidates.every(c => mode === 'both' || (mode === 'cook' ? c.option_type === 'home_recipe' : c.nearest_place)));
      }
      suggestionCache.clear();
      for (const endpoint of ['today', 'spin', 'game', 'fortune', 'blind-box']) {
        const response = await handleApiRequest(store, 'GET', `/api/v1/suggestions/${endpoint}`, new URLSearchParams(), {}, headers);
        assert.equal(response.status, 200, JSON.stringify(response.data));
        if (endpoint === 'today') {
          assert.equal(response.data.items.length, Math.min(3, expected.length));
          assert.ok(response.data.items.every(c => expected.includes(c.dish_id)));
        } else {
          assert.equal(response.data.total_safe_candidates, expected.length);
          assert.ok(expected.includes(response.data.picked_dish?.id));
        }
      }
      const query = `1 nguoi ${tight ? 30 : 50}k an ${dinner ? 'toi' : 'trua'} ${vegetarian ? 'chay' : ''}`;
      const chat = await handleApiRequest(store, 'POST', '/api/v1/chat', new URLSearchParams(), { query }, headers);
      assert.equal(chat.status, 200);
      assert.equal(chat.data.options.length, Math.min(3, expected.length));
      assert.ok(chat.data.options.every(c => expected.includes(c.dish_id)));
      assert.equal(chat.data.ai_source, 'local');
    });
  }
}
