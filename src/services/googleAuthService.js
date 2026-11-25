import crypto from 'node:crypto';
import { defaultProfile } from './profileService.js';
import { signToken } from './authService.js';

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const TTL = 7 * 24 * 3600;
let cache = null;
let pending = null;
let lastFetch = 0;
export function googleConfig() {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  return { enabled: Boolean(id), client_id: id || null };
}
export function resetGoogleKeyCache() { cache = null; pending = null; lastFetch = 0; }
const invalid = () => Object.assign(new Error('Google ID token không hợp lệ hoặc đã hết hạn'), { status: 401 });
const unavailable = () => Object.assign(new Error('Chưa thể xác minh Google, vui lòng thử lại'), { status: 503 });
async function getKeys(force = false) {
  if (cache && cache.until > Date.now() && (!force || Date.now() - lastFetch < 30000)) return cache.keys;
  if (!pending) pending = (async () => {
    try {
      lastFetch = Date.now();
      const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5000), redirect: 'error' });
      if (!res.ok) throw unavailable();
      const data = await res.json();
      if (!Array.isArray(data.keys) || !data.keys.length || data.keys.length > 20) throw unavailable();
      const maxAge = Number(/max-age=(\d+)/i.exec(res.headers.get('cache-control') || '')?.[1] || 300);
      cache = { keys: data.keys, until: Date.now() + Math.min(maxAge, 3600) * 1000 };
      return data.keys;
    } catch { throw unavailable(); }
    finally { pending = null; }
  })();
  return pending;
}
export async function verifyGoogleIdToken(token, clientId = googleConfig().client_id) {
  if (typeof token !== 'string' || token.length > 16384) throw invalid();
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) throw invalid();
  let h, p;
  try { h = JSON.parse(Buffer.from(parts[0], 'base64url')); p = JSON.parse(Buffer.from(parts[1], 'base64url')); } catch { throw invalid(); }
  if (!h || !p || h.alg !== 'RS256' || typeof h.kid !== 'string' || h.kid.length > 256) throw invalid();
  const now = Math.floor(Date.now() / 1000);
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(p.iss)
      || !(typeof p.aud === 'string' ? p.aud === clientId : Array.isArray(p.aud) && p.aud.includes(clientId))
      || (Array.isArray(p.aud) && p.aud.length > 1 && p.azp !== clientId)
      || (p.azp !== undefined && p.azp !== clientId)
      || !Number.isFinite(p.exp) || p.exp <= now
      || !Number.isFinite(p.iat) || p.iat > now + 60 || p.exp <= p.iat
      || (p.nbf !== undefined && (!Number.isFinite(p.nbf) || p.nbf > now))
      || typeof p.sub !== 'string' || !p.sub.length || p.sub.length > 255) throw invalid();
  let keys = await getKeys();
  if (!keys.some(k => k.kid === h.kid)) keys = await getKeys(true);
  const jwk = keys.find(k => k.kid === h.kid && k.kty === 'RSA' && (!k.use || k.use === 'sig') && (!k.alg || k.alg === 'RS256'));
  if (!jwk) throw invalid(); // refresh on rotation at most once per 30 seconds
  let valid = false;
  try { valid = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url')); } catch { throw invalid(); }
  if (!valid) throw invalid();
  return { sub: p.sub, email: p.email_verified === true && typeof p.email === 'string' && p.email.length <= 254 ? p.email.trim().toLowerCase() : null,
    identity_verified: p.email_verified === true && typeof p.email === 'string' && p.email.length <= 254 };
}
export async function googleLogin(repo, token, guestUser = null) {
  if (!googleConfig().enabled) return { status: 503, data: { error: 'Đăng nhập Google chưa được cấu hình (GOOGLE_CLIENT_ID)' } };
  if (typeof token !== 'string' || !token.trim()) return { status: 400, data: { error: 'Thiếu id_token Google' } };
  try {
    const identity = await verifyGoogleIdToken(token);
    const id = `usr-${crypto.randomBytes(8).toString('hex')}`;
    let user = await repo.loginGoogle(identity, guestUser?.guest ? guestUser.id : null, {
      id, role: 'user', phone: null, guest: false, created_at: new Date().toISOString(), profile: defaultProfile(id),
      savedCollections: [{ id: 'col-1', name: 'Món yêu thích', dish_ids: [] }]
    });
    // M9 owns the one-time bootstrap policy; never infer privileges here.
    if (user.identity_verified && typeof repo.bootstrapSuperAdmin === 'function') {
      await repo.bootstrapSuperAdmin(user.id);
      user = await repo.getUser(user.id);
    }
    return { status: 200, data: { verified: true, access_token: signToken({ sub: user.id, role: user.role }, TTL), token_type: 'Bearer', expires_in_s: TTL, role: user.role, user: user.profile } };
  } catch (e) {
    if (e.status === 401 || e.status === 503) return { status: e.status, data: { error: e.message } };
    throw e;
  }
}
