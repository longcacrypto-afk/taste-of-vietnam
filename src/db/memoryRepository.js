import { mergeProfile, mergeCollections } from '../services/profileService.js';
// =============================================================================
// IN-MEMORY REPOSITORY — tests and local dev only (DATABASE_URL unset).
// Same interface as PostgresRepository; data lives in the `store` object from
// src/data/seed.js and is lost when the process stops.
// =============================================================================

import { haversineDistanceMeters } from '../services/textUtils.js';
import { recordCampaignClick } from '../services/expansionServices.js';
import { processSuccessfulPayment } from '../services/paymentService.js';

const MAX_GUESTS = 10000; // cap in-memory guest accounts

export class MemoryRepository {
  constructor(store) {
    this.store = store;
    this.kind = 'memory';
  }

  // Link only by verified Google subject; email alone never links an account.
  // Synchronous mutation block (no await): atomic in the in-memory adapter.
  async loginGoogle(identity, guestId, fresh) {
    const users = this.store.users ||= {};
    let user = Object.values(users).find(u => u.google_sub === identity.sub && !u.guest);
    const isNew = !user;
    const guest = guestId && users[guestId]?.guest ? users[guestId] : null;
    if (!user) user = { ...fresh, suggestionHistory: [], savedCollections: structuredClone(fresh.savedCollections) };
    const next = { ...user, google_sub: identity.sub, email: identity.email, identity_verified: identity.identity_verified };
    if (guest) {
      next.profile = mergeProfile(next.profile, guest.profile, isNew);
      next.savedCollections = mergeCollections(next.savedCollections, guest.savedCollections);
      next.suggestionHistory = [...next.suggestionHistory, ...guest.suggestionHistory].sort((a,b) => b.created_at.localeCompare(a.created_at));
    }
    users[next.id] = next;
    if (guest) {
      for (const key of ['orderRedirects', 'userReports']) for (const row of this.store[key] || []) if (row.user_id === guestId) row.user_id = next.id;
      for (const row of this.store.communityRecipes || []) if (row.author_id === guestId) row.author_id = next.id;
      delete users[guestId];
    }
    return next;
  }

  async exportUserData(id) {
    const user = await this.getUser(id);
    return structuredClone({
      account: { id: user.id, role: user.role, phone: user.phone, email: user.email || null, guest: user.guest, created_at: user.created_at },
      profile: user.profile, suggestion_history: user.suggestionHistory, saved_collections: user.savedCollections,
      order_redirects: (this.store.orderRedirects || []).filter(r => r.user_id === id),
      place_reports: (this.store.userReports || []).filter(r => r.user_id === id),
      community_recipes: (this.store.communityRecipes || []).filter(r => r.author_id === id),
      payment_orders: Object.values(this.store.paymentOrders || {}).filter(r => r.created_by === id)
    });
  }

  // ── users & OTP ────────────────────────────────────────────────────────────
  async getUser(id) {
    return (this.store.users || {})[id] || null;
  }

  async findUserByPhone(phone) {
    return Object.values(this.store.users || {}).find(u => u.phone === phone && !u.guest) || null;
  }

  async createUser(user) {
    this.store.users = this.store.users || {};
    const full = { ...user, suggestionHistory: [], savedCollections: user.savedCollections || [] };
    this.store.users[user.id] = full;
    if (user.guest) this.#evictOldGuests();
    return full;
  }

  #evictOldGuests() {
    const guests = Object.values(this.store.users).filter(u => u.guest);
    if (guests.length <= MAX_GUESTS) return;
    guests.sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const g of guests.slice(0, guests.length - MAX_GUESTS)) delete this.store.users[g.id];
  }

  async setUserRole(id, role) {
    const u = await this.getUser(id);
    if (u) u.role = role;
  }

  async saveProfile(id, profile) {
    const u = await this.getUser(id);
    if (u) u.profile = profile;
    return profile;
  }

  /** DELETE /me: the account, its OTP challenge, history, collections, order redirects and own recipes. */
  async deleteUser(id) {
    const user = await this.getUser(id);
    if (!user) return false;
    if (user.phone && this.store.otpChallenges) delete this.store.otpChallenges[user.phone];
    this.store.orderRedirects = (this.store.orderRedirects || []).filter(o => o.user_id !== id);
    this.store.communityRecipes = (this.store.communityRecipes || []).filter(r => r.author_id !== id);
    for (const r of this.store.userReports || []) if (r.user_id === id) r.user_id = null;
    for (const o of Object.values(this.store.paymentOrders || {})) if (o.created_by === id) o.created_by = null;
    for (const r of this.store.campaigns || []) if (r.created_by === id) r.created_by = null;
    for (const r of this.store.auditLogs || []) if (r.actor_id === id) { r.actor_id = null; r.actor = 'deleted-account'; }
    delete this.store.users[id];
    return true;
  }

  async getOtp(phone) {
    return (this.store.otpChallenges || {})[phone] || null;
  }

  async putOtp(phone, challenge) {
    this.store.otpChallenges = this.store.otpChallenges || {};
    this.store.otpChallenges[phone] = challenge;
  }

  async deleteOtp(phone) {
    if (this.store.otpChallenges) delete this.store.otpChallenges[phone];
  }

  async setOtpAttempts(phone, attempts) {
    const ch = await this.getOtp(phone);
    if (ch) ch.attempts = attempts;
  }

  async pruneGuests() { /* bounded by MAX_GUESTS on create */ }

  // ── per-user history & collections (anonymous = the shared demo data) ──────
  async listHistory(userId) {
    if (!userId) return this.store.suggestionHistory || [];
    const u = await this.getUser(userId);
    return u ? u.suggestionHistory : [];
  }

  async addHistory(userId, entry) {
    const list = await this.listHistory(userId);
    list.unshift(entry);
    return list.length;
  }

  async listCollections(userId) {
    if (!userId) {
      this.store.savedCollections = this.store.savedCollections || [
        { id: 'col-1', name: 'Món nước buổi sáng', dish_ids: ['DISH-101', 'DISH-103'] },
        { id: 'col-2', name: 'Thực đơn cuối tuần cho gia đình', dish_ids: ['DISH-102', 'DISH-106'] }
      ];
      return this.store.savedCollections;
    }
    const u = await this.getUser(userId);
    return u ? u.savedCollections : [];
  }

  async saveCollections(userId, collections) {
    const u = await this.getUser(userId);
    if (u) u.savedCollections = collections;
    return collections;
  }

  // ── dishes ─────────────────────────────────────────────────────────────────
  async listDishes() { return this.store.dishes; }

  async getDish(id) { return this.store.dishes.find(d => d.id === id) || null; }

  async createDish(dish) {
    this.store.dishes.unshift(dish);
    return dish;
  }

  async updateDish(id, patch) {
    const dish = await this.getDish(id);
    if (!dish) return null;
    Object.assign(dish, patch);
    return dish;
  }

  async deleteDish(id) {
    const before = this.store.dishes.length;
    this.store.dishes = this.store.dishes.filter(d => d.id !== id);
    return this.store.dishes.length < before;
  }

  // ── places ─────────────────────────────────────────────────────────────────
  async listPlaces() { return this.store.places; }

  async getPlace(id) { return this.store.places.find(p => p.id === id) || null; }

  /** Places within radiusM of (lat, lng), nearest first; same rules as the PostGIS query. */
  async findPlacesNear({ lat, lng, radiusM = 3000, dishId = null, openOnly = true }) {
    return this.store.places
      .map(p => ({
        ...p,
        distance_m: haversineDistanceMeters(lat, lng, p.lat, p.lng),
        is_currently_open: Boolean(p.is_verified && p.is_open_override && p.closed_report_count < 3)
      }))
      .filter(p => {
        if (openOnly && !p.is_currently_open) return false;
        if (dishId && !(p.menu || []).some(m => m.dish_id === dishId && m.available)) return false;
        return p.distance_m <= radiusM;
      })
      .sort((a, b) => a.distance_m - b.distance_m);
  }

  async reportPlace(placeId, { reason, userId = null }) {
    const place = await this.getPlace(placeId);
    if (!place) return null;
    place.closed_report_count = (place.closed_report_count || 0) + 1;
    if (place.closed_report_count >= 3) place.is_open_override = false; // auto-pause
    const rep = {
      id: `rep-${Date.now()}`,
      place_id: place.id,
      place_name: place.name,
      reason,
      report_count: place.closed_report_count,
      status: place.closed_report_count >= 3 ? 'auto_paused' : 'pending_review',
      created_at: new Date().toISOString()
    };
    this.store.userReports.unshift(userId ? { ...rep, user_id: userId } : rep);
    return rep;
  }

  async unpausePlace(placeId) {
    const place = await this.getPlace(placeId);
    if (!place) return null;
    place.is_verified = true;
    place.is_open_override = true;
    place.closed_report_count = 0;
    if (this.store.userReports) this.store.userReports = this.store.userReports.filter(r => r.place_id !== placeId);
    return place;
  }

  async listUserReports() { return this.store.userReports || []; }

  // ── OCR moderation ─────────────────────────────────────────────────────────
  async listOcrQueue() { return this.store.ocrQueue || []; }

  async reviewOcr(id, status, reason) {
    const item = (this.store.ocrQueue || []).find(i => i.id === id);
    if (!item) return null;
    item.status = status;
    if (reason) item.rejection_reason = reason;
    return item;
  }

  // ── campaigns, clicks, payments ────────────────────────────────────────────
  async listCampaigns() { return this.store.campaigns; }

  async getCampaign(id) { return this.store.campaigns.find(c => c.id === id) || null; }

  async createCampaign(c) {
    this.store.campaigns.unshift(c);
    return c;
  }

  async updateCampaign(id, patch) {
    const c = await this.getCampaign(id);
    if (!c) return null;
    Object.assign(c, patch);
    return c;
  }

  async recordCampaignClick(id, fingerprint) {
    return recordCampaignClick(this.store, id, fingerprint);
  }

  async createPaymentOrder(order) {
    this.store.paymentOrders = this.store.paymentOrders || {};
    this.store.paymentOrders[order.order_id] = order;
    return order;
  }

  async getPaymentOrder(orderId) {
    return (this.store.paymentOrders || {})[orderId] || null;
  }

  async findPaymentOrderByCode(orderCode) {
    return Object.values(this.store.paymentOrders || {}).find(o => String(o.order_code) === String(orderCode)) || null;
  }

  /** Idempotent: a COMPLETED order is never credited twice. */
  async completePayment({ orderId, campaignId, amountVnd }) {
    return processSuccessfulPayment(this.store, { orderId, campaignId, amountVnd });
  }

  // ── M5 order redirects ─────────────────────────────────────────────────────
  async createOrderRedirect(record) {
    this.store.orderRedirects = this.store.orderRedirects || [];
    this.store.orderRedirects.unshift(record);
    return record;
  }

  async getOrderRedirect(id) {
    return (this.store.orderRedirects || []).find(o => o.id === id) || null;
  }

  async confirmOrderEaten(id) {
    const o = await this.getOrderRedirect(id);
    if (o) o.loopback_confirmed_eaten = true;
    return o;
  }

  // ── M20 community recipes ──────────────────────────────────────────────────
  async listRecipes() { return this.store.communityRecipes || []; }

  async getRecipe(id) { return (this.store.communityRecipes || []).find(r => r.id === id) || null; }

  async createRecipe(recipe) {
    this.store.communityRecipes = this.store.communityRecipes || [];
    this.store.communityRecipes.unshift(recipe);
    return recipe;
  }

  async updateRecipe(id, patch) {
    const r = await this.getRecipe(id);
    if (!r) return null;
    Object.assign(r, patch);
    return r;
  }

  async deleteRecipe(id) {
    const before = (this.store.communityRecipes || []).length;
    this.store.communityRecipes = (this.store.communityRecipes || []).filter(r => r.id !== id);
    return this.store.communityRecipes.length < before;
  }

  async likeRecipe(id) {
    const r = await this.getRecipe(id);
    if (!r) return null;
    r.likes_count = (r.likes_count || 0) + 1;
    return r;
  }

  async tipRecipe(id, amountVnd) {
    const r = await this.getRecipe(id);
    if (!r) return null;
    r.tips_received_vnd = (r.tips_received_vnd || 0) + Number(amountVnd);
    return r;
  }

  // ── M9 audit log ───────────────────────────────────────────────────────────
  async addAudit(entry) {
    this.store.auditLogs = this.store.auditLogs || [];
    const row = { id: `aud-${Date.now()}-${this.store.auditLogs.length}`, ...entry, timestamp: new Date().toISOString() };
    this.store.auditLogs.unshift(row);
    if (this.store.auditLogs.length > 1000) this.store.auditLogs.length = 1000;
    return row;
  }

  async listAudit(limit = 100) {
    return (this.store.auditLogs || []).slice(0, limit);
  }
}
