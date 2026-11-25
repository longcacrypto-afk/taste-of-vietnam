// =============================================================================
// ACCESS POLICY (P0 stopgap): who may call which /api/v1 route
//   public   : read-only catalogue routes the UI needs to load, auth, AI chat
//   any token: every write, and everything personal (/me, history, fridge...)
//   merchant : /merchant/*, ads campaigns & payments (merchant or admin)
//   admin    : /admin/*, analytics, system, enterprise, fraud logs
// The PayOS webhook is public but must carry a valid signature (router).
// =============================================================================

const ADMIN_PREFIXES = [
  '/api/v1/admin/',
  '/api/v1/analytics/',
  '/api/v1/system/',
  '/api/v1/enterprise/',
  '/api/v1/ads/fraud-logs',
  '/api/v1/notifications/batch-dispatch',
  '/api/v1/notifications/queue-status'
];

const MERCHANT_PREFIXES = [
  '/api/v1/merchant/',
  '/api/v1/ads/campaigns',
  '/api/v1/ads/payments/',
  '/api/v1/payments/orders/'
];

// Personal data: a token is needed even to read it
const PERSONAL_PREFIXES = [
  '/api/v1/me',
  '/api/v1/auth/me',
  '/api/v1/suggestions/history',
  '/api/v1/fridge/',
  '/api/v1/health/',
  '/api/v1/bookings',
  '/api/v1/groceries/'
];

// Non-GET routes that stay public (no stored data of other people changes)
const PUBLIC_WRITES = new Set([
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/google',
  'POST /api/v1/auth/otp/request',
  'POST /api/v1/auth/otp/verify',
  'POST /api/v1/auth/guest',
  'POST /api/v1/payments/webhook',
  'POST /api/v1/chat',
  'POST /api/v1/events',
  'POST /api/v1/translate/menu'
]);

// Routes under a merchant prefix that any signed-in user may call
const USER_ROUTES_UNDER_MERCHANT = [/^\/api\/v1\/ads\/campaigns\/[^/]+\/click$/];

// 'x/' = anything under x/ ; 'x' = exactly x or anything under x/
const matches = (path, p) => (p.endsWith('/') ? path.startsWith(p) : path === p || path.startsWith(p + '/'));
const startsWithAny = (path, list) => list.some(p => matches(path, p));

const deny = (status, error) => ({ status, data: { error } });

/** Returns null when allowed, otherwise the 401/403 response to send. */
export function checkAccess(method, pathname, user) {
  const role = user ? user.role : null;
  const key = `${method} ${pathname}`;

  if (startsWithAny(pathname, ADMIN_PREFIXES)) {
    if (!user) return deny(401, 'Cần đăng nhập quản trị');
    if (role !== 'admin') return deny(403, 'Chỉ quản trị viên được truy cập');
    return null;
  }

  if (startsWithAny(pathname, MERCHANT_PREFIXES) && !USER_ROUTES_UNDER_MERCHANT.some(r => r.test(pathname))) {
    if (!user) return deny(401, 'Cần đăng nhập tài khoản chủ quán');
    if (role !== 'merchant' && role !== 'admin') return deny(403, 'Chỉ chủ quán hoặc quản trị viên được truy cập');
    return null;
  }

  if (startsWithAny(pathname, PERSONAL_PREFIXES)) {
    return user ? null : deny(401, 'Cần đăng nhập (Authorization: Bearer <token>)');
  }

  if (method !== 'GET' && method !== 'HEAD' && !PUBLIC_WRITES.has(key)) {
    return user ? null : deny(401, 'Cần đăng nhập để thực hiện thao tác này');
  }

  return null;
}
