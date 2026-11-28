// Măm AI on PostgreSQL: conversation context in module_records survives a new store,
// concurrent first turns make one session row, drinks only on request (demo catalogue SQL),
// M3-S07 history from suggestion_history. Provider disabled: no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skip, resetDatabase, TEST_DATABASE_URL } from './helpers.js';
import { createPool } from '../../src/db/connection.js';
import { PostgresRepository } from '../../src/db/repository.js';
import { createInitialStore } from '../../src/data/seed.js';
import { handleApiRequest } from '../../src/api/router.js';
import { resetLlmStatus } from '../../src/services/llmClient.js';

const q = () => new URLSearchParams();
const pgStore = pool => { const s = createInitialStore(); s.repo = new PostgresRepository(pool); return s; };
async function guestH(store) {
  const r = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', q());
  return { authorization: `Bearer ${r.data.access_token}` };
}
const chat = (store, h, query) => handleApiRequest(store, 'POST', '/api/v1/chat', q(), { query }, h);

test('Măm AI over Postgres: session context persisted, follow-up refines, drinks only when asked, history', { skip }, async () => {
  const savedDemo = process.env.SEED_DEMO_CATALOG, savedDisabled = process.env.LLM_DISABLED;
  process.env.SEED_DEMO_CATALOG = 'true'; process.env.LLM_DISABLED = 'true'; resetLlmStatus();
  await resetDatabase();
  const pool = createPool(TEST_DATABASE_URL);
  try {
    const store = pgStore(pool);
    const h = await guestH(store);
    // concurrent first turns → exactly one session row
    const first = await Promise.all([chat(store, h, 'Trưa nay 2 người 120k'), chat(store, h, 'Trưa nay 2 người 120k'), chat(store, h, 'Trưa nay 2 người 120k')]);
    assert.ok(first.every(r => r.status === 200 && r.data.ai_source === 'local' && r.data.ai_label === 'chế độ offline'));
    const rows = (await pool.query("SELECT owner_id, data FROM module_records WHERE module='M3' AND kind='chat_session'")).rows;
    assert.equal(rows.length, 1);
    assert.ok(rows[0].data.turns.length >= 1);
    assert.doesNotMatch(JSON.stringify(rows[0].data), /phone|\+84/);
    // a new store (restart) continues the conversation
    const store2 = pgStore(pool);
    const t2 = await chat(store2, h, 'rẻ hơn chút');
    assert.equal(t2.data.follow_up, true);
    assert.equal(t2.data.intent.party_size, 2);
    assert.equal(t2.data.intent.per_person_budget_vnd, 48000);
    assert.ok(t2.data.options.every(o => o.price_per_person_vnd <= 48000 && o.category === 'dish'));
    const prev = t2.data.options.map(o => o.dish_id);
    const t3 = await chat(store2, h, 'đổi món khác');
    assert.ok(t3.data.options.every(o => !prev.includes(o.dish_id)));
    // drinks: never in a meal answer, only when asked (demo menu links: trà đá, cà phê sữa đá…)
    const meal = await chat(store2, h, 'Sáng nay 1 người 50k ăn gì');
    assert.ok(meal.data.options.every(o => o.category === 'dish'));
    const drinks = await chat(store2, h, 'Uống gì cho mát?');
    assert.equal(drinks.status, 200);
    assert.ok(drinks.data.options.length > 0, JSON.stringify(drinks.data.reasons));
    assert.ok(drinks.data.options.every(o => o.category === 'drink' && o.dish_id.startsWith('DISH-DR') && o.place));
    // M3-S06 → M3-S07
    const fb = await handleApiRequest(store2, 'POST', '/api/v1/suggestions/feedback', q(), { dish_id: 'DISH-101', action: 'eaten' }, h);
    assert.equal(fb.status, 200);
    const hist = await handleApiRequest(store2, 'GET', '/api/v1/suggestions/history', q(), {}, h);
    assert.equal(hist.data.items[0].dish_id, 'DISH-101');
    assert.equal(hist.data.items[0].action_label, '✓ Đã ăn');
    assert.ok(hist.data.items[0].img_key);
    assert.ok(hist.data.items[0].cooldown_until);
    const after = await chat(store2, h, 'sáng nay ăn phở');
    assert.ok(after.data.options.every(o => o.dish_id !== 'DISH-101'), '72h cooldown');
    // account deletion removes the conversation
    const del = await handleApiRequest(store2, 'DELETE', '/api/v1/me', q(), {}, h);
    assert.equal(del.status, 200);
    assert.equal((await pool.query("SELECT COUNT(*)::int n FROM module_records WHERE module='M3'")).rows[0].n, 0);
  } finally {
    await pool.end();
    if (savedDemo === undefined) delete process.env.SEED_DEMO_CATALOG; else process.env.SEED_DEMO_CATALOG = savedDemo;
    if (savedDisabled === undefined) delete process.env.LLM_DISABLED; else process.env.LLM_DISABLED = savedDisabled;
  }
});
