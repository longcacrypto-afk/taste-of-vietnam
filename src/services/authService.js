// =============================================================================
// AUTH: phone OTP + HMAC-signed expiring tokens, per-user profiles.
// Accounts and OTP challenges are stored through the repository
// (src/db/repository.js): PostgreSQL in production, memory in tests/dev.
// Tokens survive a restart only when JWT_SECRET is set.
// =============================================================================

import crypto from 'node:crypto';
import { defaultProfile } from './profileService.js';

const OTP_TTL_MS = 5 * 60 * 1000;      // code valid 5 minutes
const OTP_RESEND_MS = 30 * 1000;       // at most one code per phone every 30 s
const OTP_MAX_ATTEMPTS = 5;            // wrong codes before the challenge is burned
const TOKEN_TTL_S = 7 * 24 * 3600;     // 7 days

let ephemeralSecret = null;
let warnedSecret = false;

/** JWT_SECRET from env; otherwise a random per-boot secret (tokens die on restart). */
export function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString('hex');
  }
  if (!warnedSecret) {
    warnedSecret = true;
    console.warn('⚠️  JWT_SECRET not set — using a random secret for this process. All tokens are invalid after a restart. Set JWT_SECRET in production.');
  }
  return ephemeralSecret;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** HS256 JWT. */
export function signToken(claims, ttlSeconds = TOKEN_TTL_S) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ ...claims, iat: now, exp: now + ttlSeconds }));
  const sig = crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

/** Returns the claims, or null when the token is malformed, forged or expired. */
export function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  try {
    const h = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (h.alg !== 'HS256') return null;
    const expected = Buffer.from(crypto.createHmac('sha256', getJwtSecret()).update(`${header}.${payload}`).digest('base64url'));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Vietnamese mobile number -> +84XXXXXXXXX, or null when invalid. */
export function normalizePhone(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  let p = String(raw).replace(/[\s.\-()]/g, '');
  if (p.startsWith('+84')) p = p.slice(3);
  else if (p.startsWith('84') && p.length === 11) p = p.slice(2);
  else if (p.startsWith('0')) p = p.slice(1);
  if (!/^[35789]\d{8}$/.test(p)) return null;
  return `+84${p}`;
}

function phoneList(envName) {
  return (process.env[envName] || '').split(',').map(s => normalizePhone(s.trim())).filter(Boolean);
}

/** Role from env: ADMIN_PHONES / MERCHANT_PHONES (comma-separated). Default 'user'. */
export function roleForPhone(phone) {
  if (phoneList('ADMIN_PHONES').includes(phone)) return 'admin';
  if (phoneList('MERCHANT_PHONES').includes(phone)) return 'merchant';
  return 'user';
}

function hashCode(phone, code) {
  return crypto.createHmac('sha256', getJwtSecret()).update(`otp:${phone}:${code}`).digest('hex');
}

function smsConfigured() {
  return Boolean(process.env.SMS_API_KEY && process.env.SMS_SECRET_KEY);
}

/**
 * Send the OTP by SMS through eSMS.vn (SMS_API_KEY / SMS_SECRET_KEY / SMS_BRANDNAME).
 * Untested against the live provider: no keys were available when this was written.
 */
async function sendOtpSms(phone, code) {
  const res = await fetch('https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ApiKey: process.env.SMS_API_KEY,
      SecretKey: process.env.SMS_SECRET_KEY,
      Phone: '0' + phone.slice(3),
      Content: `${code} la ma xac thuc Hom Nay An Gi cua ban. Ma het han sau 5 phut.`,
      Brandname: process.env.SMS_BRANDNAME || undefined,
      SmsType: process.env.SMS_BRANDNAME ? '2' : '8',
      IsUnicode: '0'
    }),
    signal: AbortSignal.timeout(8000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || String(data.CodeResult) !== '100') {
    throw new Error(`SMS provider error ${res.status} ${data.CodeResult || ''} ${data.ErrorMessage || ''}`.trim());
  }
}

/** POST /auth/otp/request. Dev mode (NODE_ENV !== 'production', no SMS keys): logs and returns the code. */
export async function requestOtp(repo, rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { status: 400, data: { error: 'Số điện thoại không hợp lệ' } };
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !smsConfigured()) {
    return { status: 503, data: { error: 'Đăng nhập bằng SMS chưa được cấu hình (SMS_API_KEY / SMS_SECRET_KEY).' } };
  }
  const now = Date.now();
  const prev = await repo.getOtp(phone);
  if (prev && now - prev.created_at < OTP_RESEND_MS) {
    return { status: 429, data: { error: 'Vui lòng đợi trước khi gửi lại mã', retry_after_s: Math.ceil((OTP_RESEND_MS - (now - prev.created_at)) / 1000) } };
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await repo.putOtp(phone, { hash: hashCode(phone, code), created_at: now, expires_at: now + OTP_TTL_MS, attempts: 0 });

  const data = { otp_sent: true, phone, expires_in_s: OTP_TTL_MS / 1000 };
  if (smsConfigured()) {
    try {
      await sendOtpSms(phone, code);
      data.channel = 'sms';
    } catch (err) {
      await repo.deleteOtp(phone);
      console.error('❌ OTP SMS failed:', err.message);
      return { status: 502, data: { error: 'Không gửi được SMS, vui lòng thử lại sau' } };
    }
  } else {
    // Dev mode only (production without SMS keys returned 503 above)
    console.log(`🔐 [DEV OTP] ${phone}: ${code}`);
    data.channel = 'dev';
    data.dev_code = code;
  }
  return { status: 200, data };
}

function newProfile(template, id, { name, phone }) {
  return defaultProfile(id, name, phone);
}

async function createUser(repo, template, { phone = null, role = 'user', guest = false }) {
  const id = `${guest ? 'gst' : 'usr'}-${crypto.randomBytes(8).toString('hex')}`;
  const user = await repo.createUser({
    id,
    role,
    phone,
    guest,
    created_at: new Date().toISOString(),
    profile: newProfile(template, id, { name: guest ? 'Khách trải nghiệm' : 'Bạn mới', phone }),
    savedCollections: [{ id: 'col-1', name: 'Món yêu thích', dish_ids: [] }]
  });
  if (guest) await repo.pruneGuests();
  return user;
}

function issue(user) {
  return signToken({ sub: user.id, role: user.role });
}

/** POST /auth/otp/verify -> { access_token, user }. `template` = default profile for new accounts. */
export async function verifyOtp(repo, rawPhone, rawCode, template = {}) {
  const phone = normalizePhone(rawPhone);
  const code = String(rawCode ?? '').trim();
  if (!phone || !/^\d{6}$/.test(code)) return { status: 400, data: { verified: false, error: 'Thiếu số điện thoại hoặc mã 6 số' } };
  const ch = await repo.getOtp(phone);
  if (!ch || ch.expires_at < Date.now()) {
    if (ch) await repo.deleteOtp(phone);
    return { status: 401, data: { verified: false, error: 'Mã đã hết hạn hoặc chưa được gửi' } };
  }
  if (ch.attempts >= OTP_MAX_ATTEMPTS) {
    await repo.deleteOtp(phone);
    return { status: 429, data: { verified: false, error: 'Nhập sai quá nhiều lần, vui lòng yêu cầu mã mới' } };
  }
  const ok = crypto.timingSafeEqual(Buffer.from(ch.hash), Buffer.from(hashCode(phone, code)));
  if (!ok) {
    const attempts = ch.attempts + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) await repo.deleteOtp(phone);
    else await repo.setOtpAttempts(phone, attempts);
    return { status: 401, data: { verified: false, error: 'Mã không đúng', attempts_left: Math.max(0, OTP_MAX_ATTEMPTS - attempts) } };
  }
  await repo.deleteOtp(phone);

  let user = await repo.findUserByPhone(phone);
  const role = roleForPhone(phone);
  if (!user) user = await createUser(repo, template, { phone, role });
  else if (user.role !== role) {
    await repo.setUserRole(user.id, role);
    user.role = role;
  }
  return { status: 200, data: { verified: true, access_token: issue(user), token_type: 'Bearer', expires_in_s: TOKEN_TTL_S, role: user.role, user: user.profile } };
}

/** POST /auth/guest -> a guest account with its own profile and a token. */
export async function createGuest(repo, template = {}) {
  const user = await createUser(repo, template, { guest: true, role: 'guest' });
  return { status: 200, data: { guest_mode: true, guest_id: user.id, access_token: issue(user), token_type: 'Bearer', expires_in_s: TOKEN_TTL_S, role: 'guest', profile: user.profile } };
}

/** Resolve the user from `Authorization: Bearer <token>`; null if absent/invalid/deleted. */
export async function authenticate(repo, headers = {}) {
  const raw = headers.authorization || headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(raw));
  if (!m) return null;
  const claims = verifyToken(m[1].trim());
  if (!claims) return null;
  return repo.getUser(claims.sub);
}

/** DELETE /me: remove the account and everything personal (see the repository's deleteUser). */
export async function deleteUser(repo, userId) {
  return repo.deleteUser(userId);
}

/**
 * Memory mode: a view of the store where userProfile / suggestionHistory / savedCollections
 * belong to `user`; everything else (dishes, places, campaigns...) is shared.
 * `overrides` (Postgres mode) replaces more keys, e.g. dishes/places loaded from the DB.
 */
export function scopeStoreToUser(store, user, overrides = null) {
  const own = user ? { userProfile: 'profile', suggestionHistory: 'suggestionHistory', savedCollections: 'savedCollections' } : {};
  const extra = overrides || {};
  return new Proxy(store, {
    get(target, prop, receiver) {
      if (prop in extra) return extra[prop];
      if (prop in own) return user[own[prop]];
      if (prop === 'currentUser') return user;
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value) {
      if (prop in extra) { extra[prop] = value; return true; }
      if (prop in own) { user[own[prop]] = value; return true; }
      return Reflect.set(target, prop, value);
    }
  });
}
