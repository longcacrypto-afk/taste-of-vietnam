// Exact existing M9 role IDs. No wildcard: even super_admin cannot call an unregistered route.
export const ROLES = [
  { id: 'consumer', name: 'Consumer', permissions: [] },
  { id: 'merchant_owner', name: 'Merchant Owner', permissions: [] },
  { id: 'merchant_staff', name: 'Merchant Staff', permissions: [] },
  { id: 'content_moderator', name: 'Content Moderator', permissions: ['dashboard', 'dishes', 'ocr', 'reports'] },
  { id: 'ops_admin', name: 'Ops Admin', permissions: ['dashboard', 'places', 'reports', 'ads', 'audit'] },
  { id: 'super_admin', name: 'Super Admin', permissions: ['dashboard', 'dishes', 'ocr', 'places', 'reports', 'ads', 'audit', 'rbac'] }
];
export const ADMIN_ROUTES = [
  ['GET', /^\/api\/v1\/admin\/(ocr-review|menu-revisions)$/, 'ocr'],
  ['GET', /^\/api\/v1\/admin\/reports\/[^/]+$/, 'reports'],
  ['GET', /^\/api\/v1\/admin\/dishes(?:\/[^/]+(?:\/versions)?)?$/, 'dishes'],
  ['GET', /^\/api\/v1\/admin\/recipes\/[^/]+(?:\/versions)?$/, 'dishes'],
  ['PUT', /^\/api\/v1\/admin\/recipes\/[^/]+$/, 'dishes'],
  ['PATCH', /^\/api\/v1\/admin\/recipes\/[^/]+$/, 'dishes'],
  ['POST', /^\/api\/v1\/admin\/(dishes|recipes)\/[^/]+\/(verify|publish|archive|restore)$/, 'dishes'],
  ['GET', /^\/api\/v1\/admin\/places(?:\/[^/]+(?:\/(menu|hours|availability|versions))?)?$/, 'places'],
  ['POST', /^\/api\/v1\/admin\/places$/, 'places'],
  ['POST', /^\/api\/v1\/admin\/places\/import$/, 'places'],
  ['PATCH', /^\/api\/v1\/admin\/places\/[^/]+(?:\/(menu|hours|availability))?$/, 'places'],
  ['PUT', /^\/api\/v1\/admin\/places\/[^/]+(?:\/(menu|hours|availability))?$/, 'places'],
  ['DELETE', /^\/api\/v1\/admin\/places\/[^/]+$/, 'places'],
  ['POST', /^\/api\/v1\/admin\/places\/[^/]+\/archive$/, 'places'],
  ['GET', /^\/api\/v1\/admin\/dashboard$/, 'dashboard'],
  ['POST', /^\/api\/v1\/admin\/dishes$/, 'dishes'],
  ['PUT', /^\/api\/v1\/admin\/dishes\/[^/]+$/, 'dishes'],
  ['PATCH', /^\/api\/v1\/admin\/dishes\/[^/]+$/, 'dishes'],
  ['DELETE', /^\/api\/v1\/admin\/dishes\/[^/]+$/, 'dishes'],
  ['POST', /^\/api\/v1\/admin\/ocr-review$/, 'ocr'],
  ['POST', /^\/api\/v1\/admin\/places\/[^/]+\/(approve|unpause)$/, 'places'],
  ['GET', /^\/api\/v1\/admin\/reports$/, 'reports'],
  ['PATCH', /^\/api\/v1\/admin\/reports\/[^/]+$/, 'reports'],
  ['GET', /^\/api\/v1\/admin\/ads$/, 'ads'],
  ['POST', /^\/api\/v1\/admin\/ads\/[^/]+\/moderate$/, 'ads'],
  ['GET', /^\/api\/v1\/admin\/audit-logs$/, 'audit'],
  ['GET', /^\/api\/v1\/admin\/rbac\/roles$/, 'rbac'],
  ['GET', /^\/api\/v1\/admin\/rbac\/users$/, 'rbac'],
  ['POST', /^\/api\/v1\/admin\/rbac\/users$/, 'rbac']
];
export function adminAllowed(method, path, role) {
  const rule = ADMIN_ROUTES.find(([m, re]) => m === method && re.test(path));
  return Boolean(rule && ROLES.find(r => r.id === role)?.permissions.includes(rule[2]));
}
export class PolicyError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Only trusted root identity columns, never editable profile.phone/profile.email.
export function bootstrapAllowed(user) {
  if (!user || user.guest || user.role === 'guest') return false;
  const phones=(process.env.ADMIN_PHONES || '').split(',').map(p=>{
    p=p.replace(/[\s.\-()]/g,'');
    if(p.startsWith('0')) return '+84'+p.slice(1);
    if(p.startsWith('84')) return '+'+p;
    return p;
  });
  const emails=(process.env.ADMIN_EMAILS || '').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean);
  return Boolean((user.phone && phones.includes(user.phone)) ||
    (user.identity_verified && user.email && emails.includes(user.email.toLowerCase())));
}
