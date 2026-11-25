import crypto from 'node:crypto';
import { getJwtSecret } from './authService.js';
import { PolicyError } from './adminPolicy.js';
export const REPORT_REASONS = ['closed', 'wrong_price', 'wrong_location', 'wrong_menu', 'other'];
// Compatibility with the existing S06 closure button; free text is evidence, not a reason enum.
const aliases = { 'Đóng cửa': 'closed', 'Quán đóng cửa': 'closed', 'Sai giá': 'wrong_price' };
export function reportInput(user, body) {
  if (!user || user.guest || user.role === 'guest' || !(user.identity_verified || user.phone)) {
    throw new PolicyError(403, 'Cần tài khoản đã xác minh để báo sai; khách không được gửi báo cáo');
  }
  const reason = aliases[body.reason] || body.reason;
  if (!REPORT_REASONS.includes(reason)) throw new PolicyError(400, 'Lý do báo sai không hợp lệ');
  // Stable per verified identity, even if the user deletes/recreates the account.
  const identity = user.phone || user.google_sub || user.id;
  const reporterKey = crypto.createHmac('sha256', getJwtSecret()).update(`report:${identity}`).digest('hex');
  return { reason, reporterKey, userId: user.id, evidence: String(body.evidence || '').slice(0, 2000) };
}
