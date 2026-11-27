import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

export const MAX_REQUEST_BYTES = 256 * 1024;
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Exact origins only. A typo must fail closed rather than silently enable "*".
export function parseOrigins(value = '') {
  return new Set(value.split(',').map(s => s.trim()).filter(Boolean).map(value => {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== value ||
        url.username || url.password) throw new Error('CORS_ALLOWED_ORIGINS requires exact http(s) origins');
    return url.origin;
  }));
}

export function clientIp(req, trustedHops = 0) {
  const peer = req.socket.remoteAddress || 'unknown';
  if (!trustedHops) return peer;
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim());
  // Count from the trusted socket, never accept the attacker-controlled leftmost address.
  if (forwarded.length < trustedHops || forwarded.some(ip => !isIP(ip))) return peer;
  return forwarded[forwarded.length - trustedHops];
}

export const RATE_RULES = {
  auth: { limit: 30, windowMs: 60_000 },
  write: { limit: 120, windowMs: 60_000 },
  report: { limit: 10, windowMs: 600_000 },
  redirect: { limit: 30, windowMs: 60_000 }
};

export function rateGroups(method, pathname) {
  const groups = [];
  if (pathname.startsWith('/api/v1/') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    groups.push('write');
    if (pathname.startsWith('/api/v1/auth/')) groups.push('auth');
    if (/^\/api\/v1\/places\/[^/]+\/reports\/?$/.test(pathname)) groups.push('report');
    if (pathname.startsWith('/api/v1/orders/')) groups.push('redirect');
  }
  return groups;
}

export function createRateLimiter({ now = Date.now, rules = RATE_RULES, maxEntries = 20_000 } = {}) {
  const buckets = new Map();
  let nextSweep = 0;
  return (ip, groups) => {
    const time = now();
    if (time >= nextSweep) {
      for (const [key, entry] of buckets) if (entry.reset <= time) buckets.delete(key);
      nextSweep = time + 60_000;
    }
    const keys = groups.map(group => [group, `${group}:${createHash('sha256').update(ip).digest('hex')}`]);
    let retryMs = 0;
    for (const [group, key] of keys) {
      const rule = rules[group];
      let entry = buckets.get(key);
      if (entry && entry.reset <= time) { buckets.delete(key); entry = null; }
      if (!entry) {
        // Don't evict active clients: an address flood must not reset their budgets.
        if (buckets.size >= maxEntries) { retryMs = Math.max(retryMs, 60_000); continue; }
        entry = { count: 0, reset: time + rule.windowMs };
        buckets.set(key, entry);
      }
      entry.count++;
      if (entry.count > rule.limit) retryMs = Math.max(retryMs, entry.reset - time);
    }
    return retryMs ? Math.max(1, Math.ceil(retryMs / 1000)) : 0;
  };
}

export function applySecurityHeaders(res, requestId) {
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // The existing UI has inline scripts/styles and Google sign-in; don't break it
  // with a pretend strict script policy. These directives are enforceable today.
  res.setHeader('Content-Security-Policy', "base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
  res.setHeader('Vary', 'Origin');
}

export function allowOrigin(req, res, allowed, production = false) {
  const origin = req.headers.origin;
  if (!origin) return true; // Native clients still need normal API authentication.
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  const sameOrigin = parsed.origin === origin && parsed.host === req.headers.host &&
    parsed.protocol === (production ? 'https:' : 'http:');
  if (!sameOrigin && !allowed.has(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, Retry-After');
  return true;
}

export async function readJsonBody(req, maxBytes = MAX_REQUEST_BYTES) {
  if (Number(req.headers['content-length']) > maxBytes) throw new HttpError(413, 'Dữ liệu gửi lên quá lớn');
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
    throw new HttpError(415, 'Không hỗ trợ dữ liệu nén');
  }
  let bytes = 0;
  const chunks = [];
  // A data listener lets us return 413 cleanly instead of async-iterator.destroy()
  // closing the socket before the response is sent.
  const raw = await new Promise((resolve, reject) => {
    const cleanup = () => {
      req.off('data', data); req.off('end', end); req.off('error', error); req.off('aborted', aborted);
    };
    const error = err => { cleanup(); reject(err); };
    const aborted = () => error(new HttpError(400, 'Yêu cầu bị ngắt'));
    const data = chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) { cleanup(); req.resume(); reject(new HttpError(413, 'Dữ liệu gửi lên quá lớn')); }
      else chunks.push(chunk);
    };
    const end = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')); };
    req.on('data', data); req.on('end', end); req.on('error', error); req.on('aborted', aborted);
  });
  if (!raw) return {};
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    throw new HttpError(415, 'Cần gửi application/json');
  }
  let body;
  try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'JSON không hợp lệ'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Cần gửi một đối tượng JSON');
  return body;
}

// Monitoring hook: JSON lines for Render logs, deliberately no raw URL, headers,
// error.message/stack, body, IP, identity, token or provider key.
export function logHttpFailure({ requestId, method, status, durationMs }, sink = console.error) {
  sink(JSON.stringify({
    timestamp: new Date().toISOString(), level: 'error', event: 'http_failure',
    request_id: requestId, method: ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(method) ? method : 'OTHER',
    status, duration_ms: Math.max(0, Math.round(durationMs))
  }));
}

export function requestId() { return randomUUID(); }
