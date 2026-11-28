// =============================================================================
// M3 · Măm AI chat (M3-S04/S05) + history view (M3-S07) — takes over the core paths
// POST /api/v1/chat and GET /api/v1/suggestions/history (routeEarly), adds
// GET/DELETE /api/v1/chat/session. Feedback (M3-S06) stays on the core route
// POST /api/v1/suggestions/feedback; its 72 h "eaten" cooldown is the shared gate.
//
// Conversation context: one module_records row per user (kind 'chat_session',
// owner = user) with the last 6 turns (redacted text + intent + option ids) and the
// timestamps of LLM calls in the last hour (rate limit). Anonymous callers get no
// context and share one hourly LLM bucket.
// =============================================================================
import { runMamChat, MAX_TURNS, MAX_QUERY_CHARS } from '../services/mamAi.js';
import { llmHealth } from '../services/llmClient.js';

const HOUR = 3600000;
const perUserLimit = () => Math.max(0, Number(process.env.LLM_RATE_PER_HOUR ?? 20));
const anonLimit = () => Math.max(0, Number(process.env.LLM_ANON_RATE_PER_HOUR ?? 20));
const anonCalls = [];
const sessionId = userId => `M3-CHAT-${String(userId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80)}`;
const ACTION_LABELS = { eaten: '✓ Đã ăn', liked: 'Yêu thích', skipped: 'Bỏ qua' };
const COOLDOWN_MS = 72 * HOUR;

async function loadSession(ms, userId) {
  if (!userId) return null;
  return ms.get(sessionId(userId));
}

export default {
  id: 'M3',
  personalKinds: ['chat_session'],

  async routeEarly(ctx) {
    const { method, pathname, ms, userId, body, util, repo, searchParams } = ctx;

    if (pathname === '/api/v1/chat' && method === 'POST') {
      if (body.query !== undefined && typeof body.query !== 'string') return util.bad('query phải là chuỗi');
      if (typeof body.query === 'string' && body.query.length > 4 * MAX_QUERY_CHARS) return util.bad(`Câu hỏi tối đa ${MAX_QUERY_CHARS} ký tự`);
      ctx.store.analyticsEvents && (ctx.store.analyticsEvents.chat_query = (ctx.store.analyticsEvents.chat_query || 0) + 1);
      const now = Date.now();
      let session = await loadSession(ms, userId);
      if (body.reset === true || body.new_chat === true) session = session ? { ...session, turns: [] } : null;
      // Rate limit: LLM calls in the last hour.
      let left;
      if (userId) left = perUserLimit() - (session?.llm_calls || []).filter(t => now - t < HOUR).length;
      else {
        while (anonCalls.length && now - anonCalls[0] >= HOUR) anonCalls.shift();
        left = anonLimit() - anonCalls.length;
      }
      const budget = Math.max(0, Math.min(2, left));
      const view = await ctx.view();
      const result = await runMamChat(view, body.query ?? 'Hôm nay ăn gì?', { session, llmBudget: budget, now });
      const calls = Array.from({ length: result.llm.calls }, () => now);
      if (!userId) anonCalls.push(...calls);
      else {
        const next = cur => ({
          turns: [...(cur?.turns || []), result.turn].slice(-MAX_TURNS),
          llm_calls: [...(cur?.llm_calls || []).filter(t => now - t < HOUR), ...calls],
          tokens_total: (cur?.tokens_total || 0) + (result.llm.usage?.total_tokens || 0)
        });
        if (session) await ms.update(session.id, cur => next(body.reset === true || body.new_chat === true ? { ...cur, turns: [] } : cur));
        else {
          try { await ms.insert({ module: 'M3', kind: 'chat_session', id: sessionId(userId), ownerId: userId, data: next(null) }); }
          catch (e) { if (e.status === 409) await ms.update(sessionId(userId), cur => next(cur)); else throw e; }
        }
      }
      if (result.llm.usage) console.log(`[MamAI] chat tokens=${result.llm.usage.total_tokens} calls=${result.llm.calls} intent=${result.llm.intent} reply=${result.llm.reply} ${result.llm.latency_ms}ms`);
      const { turn, query, ...data } = result;
      data.session_turns = userId ? Math.min(MAX_TURNS, ((session?.turns || []).length) + 1) : 0;
      data.llm.rate_limit = { per_hour: userId ? perUserLimit() : anonLimit(), remaining: Math.max(0, left - result.llm.calls) };
      return { status: result.context.valid ? 200 : 400, data };
    }

    if (pathname === '/api/v1/chat/session' && method === 'GET') {
      const s = await loadSession(ms, userId);
      return { status: 200, data: {
        turns: (s?.turns || []).map(t => ({ query: t.query, intent: t.intent, option_dish_ids: t.option_dish_ids, source: t.source, at: t.at })),
        max_turns: MAX_TURNS, llm: { configured: llmHealth().configured, model: llmHealth().model } } };
    }
    if (pathname === '/api/v1/chat/session' && method === 'DELETE') {
      if (!userId) return util.unauthorized();
      const s = await loadSession(ms, userId);
      if (s) await ms.update(s.id, cur => ({ ...cur, turns: [] }));
      return { status: 200, data: { cleared: true } };
    }

    // M3-S07: real history, newest first, with the dish picture and the 72 h cooldown.
    if (pathname === '/api/v1/suggestions/history' && method === 'GET') {
      const limit = searchParams.has('limit') ? Math.round(util.cleanNumber(searchParams.get('limit'), 1, 100, 50)) : 50;
      const before = searchParams.get('before');
      const all = [...await repo.listHistory(userId)].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      const rows = before ? all.filter(h => String(h.created_at) < before) : all;
      const page = rows.slice(0, limit);
      const dishes = new Map((await repo.listDishes()).map(d => [d.id, d]));
      const now = Date.now();
      const items = page.map(h => {
        const d = dishes.get(h.dish_id);
        const at = Date.parse(h.created_at);
        const cooldown = h.action === 'eaten' && Number.isFinite(at) && at + COOLDOWN_MS > now ? new Date(at + COOLDOWN_MS).toISOString() : null;
        return { ...h, img_key: d?.img_key ?? null, action_label: ACTION_LABELS[h.action] || h.action, cooldown_until: cooldown };
      });
      return { status: 200, data: { items, next_cursor: rows.length > limit ? page[page.length - 1].created_at : null } };
    }
    return null;
  }
};
