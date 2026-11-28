// =============================================================================
// PROVIDER-AGNOSTIC LLM CLIENT (OpenAI chat-completions format)
// Default provider: CometAPI (https://api.cometapi.com/v1). Any OpenAI-compatible
// endpoint works (LiteLLM, OpenAI, Gemini's /v1beta/openai, DeepSeek…).
//
//   LLM_BASE_URL   default https://api.cometapi.com/v1
//   LLM_API_KEY    bearer key (never logged, never returned by any API)
//   LLM_MODEL      default gemini-2.5-flash-lite (fastest JSON-capable model measured)
//   LLM_TIMEOUT_MS default 8000
//   LLM_MAX_TOKENS default 1024 (thinking models spend completion tokens on reasoning)
//   LLM_REASONING_EFFORT optional ('low'|'medium'|'high'|'none'), sent only when set
//   LLM_DISABLED=true  forces the local engine
// Fold-in of the old GEMINI_API_KEY: when LLM_API_KEY is absent but GEMINI_API_KEY is
// set, the client talks to Google's OpenAI-compatible endpoint with that key.
//
// chatCompletion() never throws: it returns { ok, content, usage, model, latency_ms }
// or { ok:false, error_code, status }. Callers fall back to the local engine.
// =============================================================================

const DEFAULT_BASE = 'https://api.cometapi.com/v1';
const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

// Process-wide status for /health (no secrets).
const status = {
  calls: 0, ok_calls: 0, failed_calls: 0,
  last_error_code: null, last_error_at: null, last_ok_at: null, last_latency_ms: null,
  tokens: { prompt: 0, completion: 0, total: 0 },
  breaker_until: 0
};

// Errors that will not fix themselves on the next request: pause the provider a while
// so every chat does not pay a round trip (quota added later → works after the pause).
const BREAKER_CODES = new Set(['insufficient_user_quota', 'invalid_api_key', 'http_401', 'http_402', 'http_403']);
const breakerMs = () => Math.max(0, Number(process.env.LLM_BREAKER_MS ?? 120000) || 0);

export function llmConfig(env = process.env) {
  const disabled = String(env.LLM_DISABLED || '').toLowerCase() === 'true';
  let apiKey = env.LLM_API_KEY || '';
  let baseUrl = (env.LLM_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  let provider = /cometapi\.com/.test(baseUrl) ? 'cometapi' : 'openai_compatible';
  if (!apiKey && env.GEMINI_API_KEY) {
    apiKey = env.GEMINI_API_KEY;
    if (!env.LLM_BASE_URL) { baseUrl = GEMINI_OPENAI_BASE; provider = 'gemini_openai'; }
  }
  const timeoutMs = Math.min(60000, Math.max(500, Number(env.LLM_TIMEOUT_MS) || 8000));
  const maxTokens = Math.min(8192, Math.max(64, Number(env.LLM_MAX_TOKENS) || 1024));
  const effort = ['none', 'minimal', 'low', 'medium', 'high'].includes(env.LLM_REASONING_EFFORT) ? env.LLM_REASONING_EFFORT : null;
  return { configured: Boolean(apiKey) && !disabled, disabled, apiKey, baseUrl, provider,
    model: env.LLM_MODEL || DEFAULT_MODEL, timeoutMs, maxTokens, reasoningEffort: effort };
}

/** Safe status for /health: never the key. */
export function llmHealth(env = process.env) {
  const c = llmConfig(env);
  return { configured: c.configured, provider: c.provider, model: c.model, base_url: c.baseUrl,
    timeout_ms: c.timeoutMs, calls: status.calls, ok_calls: status.ok_calls, failed_calls: status.failed_calls,
    last_error_code: status.last_error_code, last_error_at: status.last_error_at, last_ok_at: status.last_ok_at,
    last_latency_ms: status.last_latency_ms, tokens_used: { ...status.tokens },
    paused_until: status.breaker_until > Date.now() ? new Date(status.breaker_until).toISOString() : null };
}

export function resetLlmStatus() {
  Object.assign(status, { calls: 0, ok_calls: 0, failed_calls: 0, last_error_code: null, last_error_at: null,
    last_ok_at: null, last_latency_ms: null, tokens: { prompt: 0, completion: 0, total: 0 }, breaker_until: 0 });
}

export function llmAvailable(env = process.env) {
  return llmConfig(env).configured && status.breaker_until <= Date.now();
}

function fail(code, httpStatus = null, latency = null) {
  status.failed_calls++;
  status.last_error_code = code;
  status.last_error_at = new Date().toISOString();
  if (latency != null) status.last_latency_ms = latency;
  if (BREAKER_CODES.has(code) && breakerMs() > 0) status.breaker_until = Date.now() + breakerMs();
  return { ok: false, error_code: code, status: httpStatus, latency_ms: latency };
}

/** Provider error body → short stable code (no message text, which may echo input). */
function errorCode(httpStatus, body) {
  const e = body && typeof body === 'object' ? (body.error || body) : {};
  const raw = typeof e.code === 'string' && e.code ? e.code : typeof e.type === 'string' ? e.type : '';
  const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  if (/insufficient_user_quota|insufficient_quota/.test(raw) || /quota/.test(msg)) return 'insufficient_user_quota';
  if (httpStatus === 401 || /invalid token|invalid api key|invalid_api_key/.test(msg)) return 'invalid_api_key';
  if (httpStatus === 429) return 'rate_limited';
  if (/^[a-z0-9_]{2,48}$/.test(raw) && raw !== 'cometapi_error' && raw !== 'upstream_error') return raw;
  return `http_${httpStatus}`;
}

/** Remove ```json fences some models add even in JSON mode. */
export function stripFences(text) {
  const t = String(text ?? '').trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

/**
 * POST {base}/chat/completions. messages: [{role, content}]. json: request a JSON object.
 * Empty content (e.g. a thinking model that spent all tokens reasoning) is a failure.
 */
export async function chatCompletion({ messages, json = false, maxTokens, temperature = 0.2, fetchImpl, env = process.env } = {}) {
  const c = llmConfig(env);
  if (!c.configured) return { ok: false, error_code: c.disabled ? 'disabled' : 'not_configured' };
  if (status.breaker_until > Date.now()) return { ok: false, error_code: 'paused_' + (status.last_error_code || 'error') };
  const f = fetchImpl || globalThis.fetch;
  status.calls++;
  const started = Date.now();
  const body = { model: c.model, messages, temperature, max_tokens: maxTokens || c.maxTokens };
  if (json) body.response_format = { type: 'json_object' };
  if (c.reasoningEffort) body.reasoning_effort = c.reasoningEffort;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), c.timeoutMs);
  let res, data;
  try {
    res = await f(`${c.baseUrl}/chat/completions`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.apiKey}` },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = null; }
  } catch (e) {
    clearTimeout(timer);
    const latency = Date.now() - started;
    return fail(e?.name === 'AbortError' || ctrl.signal.aborted ? 'timeout' : 'network_error', null, latency);
  }
  clearTimeout(timer);
  const latency = Date.now() - started;
  if (!res.ok) return fail(errorCode(res.status, data), res.status, latency);
  // Some gateways answer 200 with an error object.
  if (data && data.error && !data.choices) return fail(errorCode(res.status, data), res.status, latency);
  const content = data?.choices?.[0]?.message?.content;
  const usage = data?.usage ? {
    prompt_tokens: Number(data.usage.prompt_tokens) || 0,
    completion_tokens: Number(data.usage.completion_tokens) || 0,
    total_tokens: Number(data.usage.total_tokens) || 0,
    reasoning_tokens: Number(data.usage.completion_tokens_details?.reasoning_tokens) || 0
  } : null;
  if (usage) {
    status.tokens.prompt += usage.prompt_tokens; status.tokens.completion += usage.completion_tokens;
    status.tokens.total += usage.total_tokens;
  }
  if (typeof content !== 'string' || !content.trim()) return { ...fail('empty_content', res.status, latency), usage };
  status.ok_calls++;
  status.last_ok_at = new Date().toISOString();
  status.last_latency_ms = latency;
  return { ok: true, content: stripFences(content), usage, model: data?.model || c.model, latency_ms: latency,
    finish_reason: data?.choices?.[0]?.finish_reason || null };
}
