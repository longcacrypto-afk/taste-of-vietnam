// Test helpers: log in through the real OTP flow (dev mode returns the code).
import { handleApiRequest } from '../../src/api/router.js';

export const TEST_ADMIN_PHONE = '0900000001';
export const TEST_MERCHANT_PHONE = '0900000002';
process.env.ADMIN_PHONES = [process.env.ADMIN_PHONES, TEST_ADMIN_PHONE].filter(Boolean).join(',');
process.env.MERCHANT_PHONES = [process.env.MERCHANT_PHONES, TEST_MERCHANT_PHONE].filter(Boolean).join(',');

const q = () => new URLSearchParams();

export async function login(store, phone) {
  const req = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/request', q(), { phone });
  if (req.status !== 200) throw new Error(`otp request failed ${req.status} ${JSON.stringify(req.data)}`);
  const ver = await handleApiRequest(store, 'POST', '/api/v1/auth/otp/verify', q(), { phone, code: req.data.dev_code });
  if (ver.status !== 200) throw new Error(`otp verify failed ${ver.status} ${JSON.stringify(ver.data)}`);
  const headers = { authorization: `Bearer ${ver.data.access_token}` };
  const user = Object.values(store.users).find(u => u.phone === req.data.phone);
  return { headers, user, token: ver.data.access_token, role: ver.data.role };
}

export async function guest(store) {
  const res = await handleApiRequest(store, 'POST', '/api/v1/auth/guest', q());
  return { headers: { authorization: `Bearer ${res.data.access_token}` }, user: store.users[res.data.guest_id], token: res.data.access_token };
}

export const loginAdmin = (store) => login(store, TEST_ADMIN_PHONE);
export const loginMerchant = (store) => login(store, TEST_MERCHANT_PHONE);

/**
 * For the older module tests: every call runs as a logged-in admin (passes every
 * access check), so they keep testing business logic. Access rules have their own tests.
 */
const sessions = new WeakMap();
export async function call(store, method, pathname, searchParams, body = {}) {
  if (!sessions.has(store)) sessions.set(store, await loginAdmin(store));
  return handleApiRequest(store, method, pathname, searchParams, body, sessions.get(store).headers);
}
export async function sessionUser(store) {
  if (!sessions.has(store)) sessions.set(store, await loginAdmin(store));
  return sessions.get(store).user;
}
