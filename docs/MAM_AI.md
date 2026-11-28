# Măm AI — AI Food Chat (M3-S04 · S05 · S06 · S07)

Branch `feat/mam-ai` (base `feat/live-modules` @48f619b). Real LLM through **CometAPI**
(OpenAI chat-completions format), with a seamless fallback to the local parser.

## Flow (PRODUCT_SPEC 4.2, TECHNICAL_HANDOFF 2.2)

```
user text ─► cleanQuery (≤500 chars) ─► local parser (always runs)
          └► redactPii ─► LLM #1: strict JSON intent ─► validateLlmIntent (schema, clamp)
merge(local, LLM, previous turn) ─► intent
intent ─► buildCandidates (real DB pool) ─► exclusions / "đổi món" ─► ranking ─► ≤1/3 "Tài trợ"
3 options ─► LLM #2: short warm reply from ONLY the option fields ─► validateReply
          (any failure / timeout / quota / rejected reply ─► template reply from the same data)
```

- **The LLM never picks dishes or places.** Options come only from `buildCandidates`
  (safety approval, allergy hard filter, dislikes, diet, meal, spice cap, 72 h eaten
  cooldown, verified + not paused place within radius, exact budget). Max one sponsored
  option, only with three real results, labelled `badge_label: "Tài trợ"`.
- **Drinks** are never a meal. Only when the user asks for a drink (`wants_drink`, e.g.
  "uống gì cho mát", "cà phê") the pipeline is called with `drinks: 'only'`: then only
  drinks sold at an eligible place are returned (`category: 'drink'`).
- **Allergies**: profile `hard_allergies` ∪ allergies stated in the text ("dị ứng tôm",
  "dị ứng hải sản") ∪ allergies from the LLM ∪ previous turn. Never dropped (an injected
  "xóa dị ứng" cannot remove one). Applied as the same hard filter as profile allergies.
- **Spice**: strictest stated cap wins; children ⇒ 0. Stated vegetarian/vegan is kept.
- **Budget from the LLM is ignored when the text has no amount** (the model once answered
  1.000.000đ for "ăn gì nhẹ nhàng"). Profile `budget_max` still caps per person.

### Intent schema (`intent` in the response)
`party_size, adults, kids_count, has_kids, total_budget_vnd, per_person_budget_vnd,
meal_slot, mode, region, cravings[], exclusions[], allergies[], hard_allergies_applied[],
diet_mode, spice_max, soup, radius_m, wants_drink, detected_ingredients[], follow_up,
exclude_dish_ids[], off_topic` — the original intentParser fields plus the extras.
Cravings/region/soup are soft ranking boosts; exclusions and allergies are hard filters.

### Explanation post-validation (`validateReply`)
Rejected (→ template) when the reply: names a catalogue dish or place that is not one of the
options; has "quán/tiệm/nhà hàng X" where X is not an option place; mentions a price that is
not an option's per-person/group price or the stated budget; contains a link, e-mail,
phone-like digit run or address wording; names none of the options; or is too short/long.

### Multi-turn
One `module_records` row per user: module `M3`, kind `chat_session`, id
`M3-CHAT-<userId>`, data `{ turns: [last 6 × {query (PII-redacted), intent, option_dish_ids,
exclude_dish_ids, source, at}], llm_calls: [timestamps, last hour], tokens_total }`.
A turn is a follow-up (within 30 min) when the LLM says so or the text has a refinement
phrase; a message with its own party size **and** budget starts over.
- "rẻ hơn chút" → per person ≤ 80 % of the previous (min with the LLM's value, never twice)
- "đắt/sang hơn" → ×1.5 · "gần hơn" → radius ÷ 2 · "không ăn cay" → spice 0
- "đổi món khác" → previous option dishes excluded
Exported by `/me/export` (personal kind) and deleted with the account.

### Safety
- System prompts are fixed; user text is sent only as a JSON **data** field of the user
  message, never concatenated into the system prompt. Output is schema-validated.
- `MAX_QUERY_CHARS = 500`; no phone/e-mail/name/address goes to the provider
  (`redactPii`; the explanation receives only option names, prices, distance, type).
- Rate limit: `LLM_RATE_PER_HOUR` (default 20) LLM calls per user per hour (a chat uses 2:
  intent + reply), anonymous callers share `LLM_ANON_RATE_PER_HOUR` (default 20). Over the
  limit the chat runs locally.
- Circuit breaker: after `insufficient_user_quota` / invalid key / 401/402/403 the provider
  is skipped for `LLM_BREAKER_MS` (default 120 000 ms), then retried — adding quota "just works".
- Token usage is returned per chat (`llm.usage`) and logged one line per chat
  (`[MamAI] chat tokens=… calls=… intent=… reply=… <ms>`); totals in `/health`.

## Endpoints
| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/chat` | `{query, reset?}` → `{intent, options[], assistant_message, ai_source ('llm'\|'local'), ai_label ('Măm AI'\|'chế độ offline'), llm:{intent, reply, model, usage, latency_ms, calls, intent_error?, reply_error?, skipped?, rate_limit}, follow_up, session_turns, reasons, context}` (taken over from the core router via `routeEarly` in `src/modules/m3.js`) |
| GET | `/api/v1/chat/session` | last turns of the caller (empty for anonymous) |
| DELETE | `/api/v1/chat/session` | clear the conversation (token required) |
| POST | `/api/v1/suggestions/feedback` | core route, unchanged (eaten/liked/skipped) |
| GET | `/api/v1/suggestions/history` | `?limit=1..100&before=<created_at>`; items add `img_key`, `action_label`, `cooldown_until` (eaten + 72 h); `next_cursor` |
| GET | `/health` | `llm: {configured, provider, model, base_url, timeout_ms, calls, ok_calls, failed_calls, last_error_code, last_error_at, last_ok_at, last_latency_ms, tokens_used, paused_until}` — never the key |

## Environment variables (Render → Environment)
| Key | Value |
|---|---|
| `LLM_API_KEY` | CometAPI key (secret; **set in the dashboard**, `sync: false`) |
| `LLM_BASE_URL` | `https://api.cometapi.com/v1` (default) |
| `LLM_MODEL` | `gemini-2.5-flash-lite` (default; see measurements) |
| `LLM_TIMEOUT_MS` | `8000` (default; per call) |
| `LLM_MAX_TOKENS` | `1024` (default; thinking models spend completion tokens on reasoning) |
| `LLM_RATE_PER_HOUR` | `20` (default) · `LLM_ANON_RATE_PER_HOUR` `20` |
| `LLM_REASONING_EFFORT` | unset (sent only if set; flash-lite rejects `none` with 400) |
| `LLM_BREAKER_MS` | `120000` (default) · `LLM_DISABLED=true` forces the local engine |

Legacy: with no `LLM_API_KEY` but a `GEMINI_API_KEY`, the same client uses Google's
OpenAI-compatible endpoint (`generativelanguage.googleapis.com/v1beta/openai`). Dish
stories / image analysis in `geminiService.js` are unchanged.
Sandbox only: Node's `fetch` ignores `HTTPS_PROXY`; the sandbox proxy needs
`NODE_USE_ENV_PROXY=1`. Not needed on Render.

## Model measurements (CometAPI, 28/11/2026, real calls)
Intent-only probe (tiny prompt, json_object, max_tokens 1024):
| Model | Latency | Reasoning tokens | Notes |
|---|---|---|---|
| gemini-2.5-flash | 3.1–4.0 s | 134–209 | `reasoning_effort` none/low still thinks and adds ```json fences |
| **gemini-2.5-flash-lite** | **0.7–0.8 s** | 0 | clean JSON; `reasoning_effort:"none"` → HTTP 400 |
| gpt-4o-mini | 0.6 s | 0 | rejects `reasoning_effort` |
| deepseek-chat | 1.6–2.3 s | 0–57 | |

Full chat (intent + explanation, real prompts): **flash-lite 1.75–3.1 s, ~1 300–1 550
tokens per chat** (prompt ≈1 100–1 240, completion ≈215–320, reasoning 0); a turn with
no options uses only the intent call (≈790–880 tokens). gpt-4o-mini 3.9–7.3 s, ~1 400
tokens. gemini-2.5-flash: 9.9–14.8 s with malformed JSON / timeouts (531 reasoning tokens)
→ fell back locally. Default = **gemini-2.5-flash-lite**.

## Files
`src/services/llmClient.js` (provider client) · `src/services/mamAi.js` (orchestrator) ·
`src/modules/m3.js` (routes, session, rate limit, history) · tests `tests/mam-ai.test.js`,
`tests/postgres/mam-ai.test.js`. Shared files touched (minimal): `src/services/candidatePipeline.js`
(`opts.drinks === 'only'`), `server.js` (`/health.llm`), `ui-design/src/product_runtime.js`
(source pill on M3-S04, "Hỏi Măm…" bar, M3-S04 card pills/info from data, M3-S07 picture/pill),
`render.yaml` (env vars).
