// =============================================================================
// POSTGRESQL REPOSITORY — production storage for the core modules (M1–M5, M7
// payments/campaigns, M9 admin, M20 community recipes). Same interface as
// MemoryRepository; returns objects in the shape the API already serves.
// Schema: src/db/migrations/*.sql (run `npm run db:migrate` first).
// =============================================================================

import { removeVietnameseTones } from '../services/textUtils.js';

const GUEST_TTL_DAYS = Number(process.env.GUEST_TTL_DAYS || 30);
const PRUNE_EVERY_MS = 60 * 60 * 1000;
const CLICK_DEDUP_SECONDS = 60;

const iso = (v) => (v instanceof Date ? v.toISOString() : v);
const num = (v) => (v === null || v === undefined ? v : Number(v));
const dropNulls = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
const hourToTime = (h, fallback) => `${String(Number.isFinite(Number(h)) ? Math.max(0, Math.min(23, Number(h))) : fallback).padStart(2, '0')}:00:00`;

// ── row <-> API object mappers ───────────────────────────────────────────────
function userFromRow(r) {
  if (!r) return null;
  return { id: r.id, role: r.role, phone: r.phone, guest: r.is_guest, created_at: iso(r.created_at), profile: r.profile };
}

export function dishFromRow(r) {
  return dropNulls({
    id: r.id,
    name: r.name,
    region: r.region,
    meal_slots: r.meal_slots,
    ref_price: r.estimated_price_vnd,
    calories: r.calories,
    macros: r.macros && Object.keys(r.macros).length ? r.macros : null,
    prep_minutes: r.prep_time_minutes,
    difficulty: r.difficulty,
    spice_level: r.spice_level,
    allergen_tags: r.allergen_flags,
    diet_flags: r.diet_flags,
    weather_fit: r.weather_fit,
    tags: r.tags,
    img_key: r.img_key,
    description: r.description,
    base_servings: r.base_servings,
    market_cost_base: r.market_cost_base,
    ingredients: r.ingredients,
    steps: r.recipe_steps
  });
}

/** API dish object -> column values (only the keys present in `d`). */
function dishColumns(d) {
  const map = {
    name: 'name', region: 'region', meal_slots: 'meal_slots', ref_price: 'estimated_price_vnd', calories: 'calories',
    prep_minutes: 'prep_time_minutes', difficulty: 'difficulty', spice_level: 'spice_level',
    allergen_tags: 'allergen_flags', diet_flags: 'diet_flags', weather_fit: 'weather_fit', tags: 'tags',
    img_key: 'img_key', description: 'description', base_servings: 'base_servings', market_cost_base: 'market_cost_base'
  };
  const jsonCols = { macros: 'macros', ingredients: 'ingredients', steps: 'recipe_steps' };
  const cols = {};
  for (const [k, c] of Object.entries(map)) if (d[k] !== undefined) cols[c] = d[k];
  for (const [k, c] of Object.entries(jsonCols)) if (d[k] !== undefined) cols[c] = JSON.stringify(d[k]);
  if (d.name !== undefined) cols.unaccented_name = removeVietnameseTones(d.name);
  return cols;
}

const PLACE_SELECT = `
  SELECT p.*, ST_Y(p.geom::geometry) AS lat, ST_X(p.geom::geometry) AS lng,
         EXTRACT(HOUR FROM p.open_time)::int AS open_hour, EXTRACT(HOUR FROM p.close_time)::int AS close_hour,
         COALESCE((SELECT json_agg(json_build_object('dish_id', pd.dish_id, 'name', COALESCE(pd.menu_name, d.name),
                                                     'price', pd.price_vnd, 'available', pd.is_available) ORDER BY pd.dish_id)
                   FROM place_dishes pd LEFT JOIN dishes d ON d.id = pd.dish_id WHERE pd.place_id = p.id), '[]') AS menu
  FROM places p`;

function placeFromRow(r) {
  const out = {
    id: r.id,
    name: r.name,
    address: r.address,
    lat: Number(r.lat),
    lng: Number(r.lng),
    open_hour: r.open_hour,
    close_hour: r.close_hour,
    is_open_override: !r.is_paused,
    is_verified: r.is_verified,
    rating: Number(r.rating),
    review_count: r.review_count,
    has_ac: r.has_ac,
    has_kids_seat: r.has_kids_seat,
    closed_report_count: r.report_count,
    phone: r.phone,
    img_key: r.img_key,
    links: r.links || {},
    menu: r.menu || []
  };
  if (r.distance_m !== undefined) {
    out.distance_m = Math.round(Number(r.distance_m));
    out.is_currently_open = Boolean(r.is_verified && !r.is_paused && r.report_count < 3);
  }
  return out;
}

function campaignFromRow(r) {
  return dropNulls({
    id: r.id,
    place_id: r.place_id,
    dish_id: r.dish_id,
    title: r.title,
    package_name: r.package_name,
    badge_label: r.badge_label,
    radius_m: r.radius_m,
    budget_monthly_vnd: r.budget_monthly_vnd,
    budget_vnd: r.budget_vnd,
    spent_vnd: r.budget_vnd !== null ? r.spent_vnd : null,
    balance_vnd: r.balance_vnd,
    is_active: r.balance_vnd !== null ? r.is_active : null,
    impressions: r.impressions,
    clicks: r.clicks,
    filtered_fraud_clicks: r.filtered_fraud_clicks || null,
    conversions: r.conversions || null,
    roas: r.roas !== null ? Number(r.roas) : null,
    status: r.status
  });
}

function recipeFromRow(r) {
  return dropNulls({
    id: r.id,
    title: r.title,
    author: r.author_name,
    author_id: r.author_id,
    author_avatar: r.author_avatar,
    prep_time_minutes: r.prep_time_minutes,
    difficulty: r.difficulty,
    calories: r.calories,
    likes_count: r.likes_count,
    tips_received_vnd: Number(r.total_tips_vnd),
    zero_waste_tag: r.zero_waste_tag,
    ingredients: r.ingredients
  });
}

function historyFromRow(r) {
  return {
    id: r.id, dish_id: r.dish_id, dish_name: r.dish_name, place_id: r.place_id, place_name: r.place_name,
    price_vnd: r.price_vnd, action: r.action, skip_reason: r.skip_reason, created_at: iso(r.created_at)
  };
}

function reportFromRow(r) {
  return { id: r.id, place_id: r.place_id, place_name: r.place_name, reason: r.reason, report_count: r.report_count, status: r.status, created_at: iso(r.created_at) };
}

function ocrFromRow(r) {
  return dropNulls({
    id: r.id, place_id: r.place_id, place_name: r.place_name, raw_text: r.raw_text,
    extracted_name: r.extracted_dish_name, extracted_price: r.extracted_price_vnd,
    matched_dish_id: r.matched_dish_id, matched_dish_name: r.matched_dish_name,
    confidence: Number(r.confidence_score), status: r.status, rejection_reason: r.rejection_reason
  });
}

function paymentFromRow(r) {
  return dropNulls({
    order_id: r.order_id, order_code: num(r.order_code), campaign_id: r.campaign_id, amount_vnd: num(r.amount_vnd),
    status: r.status, created_at: iso(r.created_at), paid_at: iso(r.paid_at), campaign_balance_after: num(r.campaign_balance_after)
  });
}

function orderFromRow(r) {
  return {
    id: r.id, user_id: r.user_id, place_id: r.place_id, place_name: r.place_name, dish_id: r.dish_id, dish_name: r.dish_name,
    partner: r.partner, target_deeplink: r.target_deeplink, fallback_web_url: r.fallback_web_url,
    loopback_confirmed_eaten: r.loopback_confirmed_eaten, created_at: iso(r.created_at)
  };
}

export class PostgresRepository {
  constructor(pool) {
    this.pool = pool;
    this.kind = 'postgres';
    this.lastPrune = 0;
  }

  q(text, params) { return this.pool.query(text, params); }

  async tx(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // ── users & OTP ────────────────────────────────────────────────────────────
  async getUser(id) {
    if (typeof id !== 'string') return null;
    return userFromRow((await this.q('SELECT * FROM users WHERE id = $1', [id])).rows[0]);
  }

  async findUserByPhone(phone) {
    return userFromRow((await this.q('SELECT * FROM users WHERE phone = $1 AND NOT is_guest', [phone])).rows[0]);
  }

  async createUser(user) {
    return this.tx(async (c) => {
      const r = await c.query(
        `INSERT INTO users (id, role, phone, is_guest, profile, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [user.id, user.role, user.phone, user.guest, JSON.stringify(user.profile || {}), user.created_at || new Date().toISOString()]
      );
      let pos = 0;
      for (const col of user.savedCollections || []) {
        await c.query('INSERT INTO saved_collections (user_id, id, name, dish_ids, position) VALUES ($1, $2, $3, $4, $5)',
          [user.id, col.id, col.name, col.dish_ids || [], pos++]);
      }
      return userFromRow(r.rows[0]);
    });
  }

  async setUserRole(id, role) {
    await this.q('UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1', [id, role]);
  }

  async saveProfile(id, profile) {
    await this.q('UPDATE users SET profile = $2, updated_at = NOW() WHERE id = $1', [id, JSON.stringify(profile)]);
    return profile;
  }

  /**
   * DELETE /me (Nghị định 13/2023): removes the account row; history, collections and
   * order redirects go with it (ON DELETE CASCADE); own community recipes and the OTP
   * challenge are deleted; reports and payment records keep no link to the person.
   */
  async deleteUser(id) {
    return this.tx(async (c) => {
      const u = (await c.query('SELECT phone FROM users WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!u) return false;
      if (u.phone) await c.query('DELETE FROM otp_challenges WHERE phone = $1', [u.phone]);
      await c.query('DELETE FROM community_recipes WHERE author_id = $1', [id]);
      await c.query('UPDATE ad_clicks SET user_id = NULL WHERE user_id = $1', [id]);
      await c.query('DELETE FROM users WHERE id = $1', [id]);
      return true;
    });
  }

  async getOtp(phone) {
    const r = (await this.q('SELECT * FROM otp_challenges WHERE phone = $1', [phone])).rows[0];
    if (!r) return null;
    return { hash: r.code_hash, attempts: r.attempts, created_at: r.created_at.getTime(), expires_at: r.expires_at.getTime() };
  }

  async putOtp(phone, ch) {
    await this.q(
      `INSERT INTO otp_challenges (phone, code_hash, attempts, created_at, expires_at)
       VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0))
       ON CONFLICT (phone) DO UPDATE SET code_hash = EXCLUDED.code_hash, attempts = EXCLUDED.attempts,
         created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at`,
      [phone, ch.hash, ch.attempts || 0, ch.created_at, ch.expires_at]
    );
  }

  async deleteOtp(phone) {
    await this.q('DELETE FROM otp_challenges WHERE phone = $1', [phone]);
  }

  async setOtpAttempts(phone, attempts) {
    await this.q('UPDATE otp_challenges SET attempts = $2 WHERE phone = $1', [phone, attempts]);
  }

  /** Guests older than GUEST_TTL_DAYS (default 30) and stale OTPs are removed, at most hourly. */
  async pruneGuests() {
    if (Date.now() - this.lastPrune < PRUNE_EVERY_MS) return;
    this.lastPrune = Date.now();
    await this.q(`DELETE FROM users WHERE is_guest AND created_at < NOW() - make_interval(days => $1)`, [GUEST_TTL_DAYS]);
    await this.q(`DELETE FROM otp_challenges WHERE expires_at < NOW() - INTERVAL '1 day'`);
  }

  // ── history & collections ─────────────────────────────────────────────────
  async listHistory(userId, limit = 200) {
    if (!userId) return [];
    const r = await this.q('SELECT * FROM suggestion_history WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2', [userId, limit]);
    return r.rows.map(historyFromRow);
  }

  async addHistory(userId, e) {
    await this.q(
      `INSERT INTO suggestion_history (id, user_id, dish_id, dish_name, place_id, place_name, price_vnd, action, skip_reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [e.id, userId, e.dish_id, e.dish_name, e.place_id, e.place_name, e.price_vnd ?? null, e.action, e.skip_reason ?? null, e.created_at]
    );
    return Number((await this.q('SELECT COUNT(*)::int AS n FROM suggestion_history WHERE user_id = $1', [userId])).rows[0].n);
  }

  async listCollections(userId) {
    if (!userId) return [];
    const r = await this.q('SELECT id, name, dish_ids FROM saved_collections WHERE user_id = $1 ORDER BY position, id', [userId]);
    return r.rows.map(x => ({ id: x.id, name: x.name, dish_ids: x.dish_ids }));
  }

  async saveCollections(userId, collections) {
    await this.tx(async (c) => {
      await c.query('DELETE FROM saved_collections WHERE user_id = $1', [userId]);
      let pos = 0;
      for (const col of collections) {
        await c.query('INSERT INTO saved_collections (user_id, id, name, dish_ids, position) VALUES ($1, $2, $3, $4, $5)',
          [userId, col.id, col.name, col.dish_ids || [], pos++]);
      }
    });
    return collections;
  }

  // ── dishes ─────────────────────────────────────────────────────────────────
  async listDishes() {
    return (await this.q('SELECT * FROM dishes ORDER BY sort_order DESC, id ASC')).rows.map(dishFromRow);
  }

  async getDish(id) {
    const r = (await this.q('SELECT * FROM dishes WHERE id = $1', [id])).rows[0];
    return r ? dishFromRow(r) : null;
  }

  async createDish(dish) {
    const cols = { id: dish.id, ...dishColumns(dish), sort_order: Date.now() };
    const keys = Object.keys(cols);
    const r = await this.q(
      `INSERT INTO dishes (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map(k => cols[k])
    );
    return dishFromRow(r.rows[0]);
  }

  async updateDish(id, patch) {
    const cols = dishColumns(patch);
    const keys = Object.keys(cols);
    if (!keys.length) return this.getDish(id);
    const r = await this.q(
      `UPDATE dishes SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...keys.map(k => cols[k])]
    );
    return r.rows[0] ? dishFromRow(r.rows[0]) : null;
  }

  async deleteDish(id) {
    return (await this.q('DELETE FROM dishes WHERE id = $1', [id])).rowCount > 0;
  }

  // ── places (PostGIS) ───────────────────────────────────────────────────────
  async listPlaces() {
    return (await this.q(`${PLACE_SELECT} ORDER BY p.id`)).rows.map(placeFromRow);
  }

  async getPlace(id) {
    const r = (await this.q(`${PLACE_SELECT} WHERE p.id = $1`, [id])).rows[0];
    return r ? placeFromRow(r) : null;
  }

  /** ST_DWithin on the geography column (GiST index), ST_Distance in metres, nearest first. */
  async findPlacesNear({ lat, lng, radiusM = 3000, dishId = null, openOnly = true }) {
    const sql = `
      WITH me AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
      SELECT x.*, ST_Distance(x.geom, me.g) AS distance_m
      FROM (${PLACE_SELECT}) x, me
      WHERE ST_DWithin(x.geom, me.g, $3)
        AND (NOT $4::boolean OR (x.is_verified AND NOT x.is_paused AND x.report_count < 3))
        AND ($5::text IS NULL OR EXISTS (SELECT 1 FROM place_dishes pd WHERE pd.place_id = x.id AND pd.dish_id = $5 AND pd.is_available))
      ORDER BY distance_m ASC
      LIMIT 100`;
    const r = await this.q(sql, [Number(lng), Number(lat), Number(radiusM), Boolean(openOnly), dishId || null]);
    return r.rows.map(placeFromRow);
  }

  async reportPlace(placeId, { reason, userId = null }) {
    return this.tx(async (c) => {
      const up = (await c.query(
        `UPDATE places SET report_count = report_count + 1,
                is_paused = CASE WHEN report_count + 1 >= 3 THEN TRUE ELSE is_paused END
         WHERE id = $1 RETURNING id, name, report_count`, [placeId])).rows[0];
      if (!up) return null;
      const rep = {
        id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        place_id: up.id,
        place_name: up.name,
        reason,
        report_count: up.report_count,
        status: up.report_count >= 3 ? 'auto_paused' : 'pending_review',
        created_at: new Date().toISOString()
      };
      await c.query('INSERT INTO place_reports (id, place_id, user_id, reason, report_count, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [rep.id, rep.place_id, userId, rep.reason, rep.report_count, rep.status, rep.created_at]);
      return rep;
    });
  }

  async unpausePlace(placeId) {
    const ok = await this.tx(async (c) => {
      const r = await c.query('UPDATE places SET is_verified = TRUE, is_paused = FALSE, report_count = 0 WHERE id = $1', [placeId]);
      if (!r.rowCount) return false;
      await c.query('DELETE FROM place_reports WHERE place_id = $1', [placeId]);
      return true;
    });
    return ok ? this.getPlace(placeId) : null;
  }

  async listUserReports() {
    const r = await this.q(`SELECT r.*, p.name AS place_name FROM place_reports r JOIN places p ON p.id = r.place_id ORDER BY r.created_at DESC LIMIT 200`);
    return r.rows.map(reportFromRow);
  }

  // ── OCR moderation ─────────────────────────────────────────────────────────
  async listOcrQueue() {
    const r = await this.q(`SELECT o.*, p.name AS place_name FROM ocr_review_queue o LEFT JOIN places p ON p.id = o.place_id ORDER BY o.created_at, o.id`);
    return r.rows.map(ocrFromRow);
  }

  async reviewOcr(id, status, reason) {
    const r = await this.q(
      `UPDATE ocr_review_queue SET status = $2, rejection_reason = COALESCE($3, rejection_reason) WHERE id = $1 RETURNING id`,
      [id, status, reason || null]);
    if (!r.rowCount) return null;
    return (await this.listOcrQueue()).find(o => o.id === id);
  }

  // ── campaigns, clicks, payments ────────────────────────────────────────────
  async listCampaigns() {
    return (await this.q('SELECT * FROM ad_campaigns ORDER BY created_at DESC, id ASC')).rows.map(campaignFromRow);
  }

  async getCampaign(id) {
    const r = (await this.q('SELECT * FROM ad_campaigns WHERE id = $1', [id])).rows[0];
    return r ? campaignFromRow(r) : null;
  }

  async createCampaign(c) {
    const r = await this.q(
      `INSERT INTO ad_campaigns (id, place_id, dish_id, package_name, title, radius_m, budget_vnd, spent_vnd, impressions, clicks, status, badge_label, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [c.id, c.place_id, c.dish_id, c.package_name || null, c.title || null, c.radius_m, c.budget_vnd ?? null, c.spent_vnd || 0,
        c.impressions || 0, c.clicks || 0, c.status || 'active', c.badge_label || 'Tài trợ', c.created_by || null]);
    return campaignFromRow(r.rows[0]);
  }

  async updateCampaign(id, patch) {
    const allowed = ['status', 'budget_vnd', 'radius_m'];
    const keys = allowed.filter(k => patch[k] !== undefined);
    if (!keys.length) return this.getCampaign(id);
    const r = await this.q(
      `UPDATE ad_campaigns SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...keys.map(k => patch[k])]);
    return r.rows[0] ? campaignFromRow(r.rows[0]) : null;
  }

  /** 60-second anti-fraud guard per (campaign, device fingerprint), stored in ad_clicks. */
  async recordCampaignClick(id, fingerprint, userId = null) {
    return this.tx(async (c) => {
      const cmp = (await c.query('SELECT id FROM ad_campaigns WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (!cmp) return { error: 'Campaign not found' };
      const dup = await c.query(
        `SELECT 1 FROM ad_clicks WHERE campaign_id = $1 AND ip_hash = $2 AND is_valid AND clicked_at > NOW() - make_interval(secs => $3) LIMIT 1`,
        [id, String(fingerprint).slice(0, 64), CLICK_DEDUP_SECONDS]);
      const isDup = dup.rowCount > 0;
      await c.query('INSERT INTO ad_clicks (campaign_id, ip_hash, user_id, is_valid) VALUES ($1, $2, $3, $4)',
        [id, String(fingerprint).slice(0, 64), userId, !isDup]);
      const up = (await c.query(
        isDup
          ? 'UPDATE ad_campaigns SET filtered_fraud_clicks = filtered_fraud_clicks + 1 WHERE id = $1 RETURNING clicks, filtered_fraud_clicks'
          : 'UPDATE ad_campaigns SET clicks = clicks + 1 WHERE id = $1 RETURNING clicks, filtered_fraud_clicks',
        [id])).rows[0];
      if (isDup) {
        return {
          campaign_id: id, charged: false, fraud_filtered: true,
          reason: 'Click trùng lặp trong 60 giây — Miễn phí cho quán (Anti-Fraud Guard)',
          total_valid_clicks: up.clicks, filtered_fraud_clicks: up.filtered_fraud_clicks
        };
      }
      return { campaign_id: id, charged: true, fraud_filtered: false, total_valid_clicks: up.clicks, filtered_fraud_clicks: up.filtered_fraud_clicks };
    });
  }

  async createPaymentOrder(o) {
    await this.q(
      `INSERT INTO payment_orders (order_id, order_code, campaign_id, amount_vnd, status, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [o.order_id, o.order_code, o.campaign_id, o.amount_vnd, o.status, o.created_by || null, o.created_at]);
    return o;
  }

  async getPaymentOrder(orderId) {
    const r = (await this.q('SELECT * FROM payment_orders WHERE order_id = $1', [orderId])).rows[0];
    return r ? paymentFromRow(r) : null;
  }

  async findPaymentOrderByCode(orderCode) {
    if (!/^\d{1,18}$/.test(String(orderCode))) return null;
    const r = (await this.q('SELECT * FROM payment_orders WHERE order_code = $1', [String(orderCode)])).rows[0];
    return r ? paymentFromRow(r) : null;
  }

  /** Credits the campaign once per order (row lock on the order makes concurrent webhooks safe). */
  async completePayment({ orderId, campaignId, amountVnd }) {
    return this.tx(async (c) => {
      const ord = (await c.query('SELECT * FROM payment_orders WHERE order_id = $1 FOR UPDATE', [orderId])).rows[0];
      if (ord && ord.status === 'COMPLETED') {
        return { success: true, already_processed: true, order: paymentFromRow(ord) };
      }
      const cmp = (await c.query(
        `UPDATE ad_campaigns SET balance_vnd = COALESCE(balance_vnd, budget_monthly_vnd, 0) + $2, is_active = TRUE, status = 'active'
         WHERE id = $1 RETURNING *`, [campaignId, Number(amountVnd)])).rows[0];
      const paidAt = new Date().toISOString();
      const balanceAfter = cmp ? cmp.balance_vnd : null;
      await c.query(
        `UPDATE payment_orders SET status = 'COMPLETED', paid_at = $2, campaign_balance_after = $3 WHERE order_id = $1`,
        [orderId, paidAt, balanceAfter]);
      return {
        success: true,
        already_processed: false,
        order: { order_id: orderId, campaign_id: campaignId, amount_vnd: Number(amountVnd), status: 'COMPLETED', paid_at: paidAt, campaign_balance_after: balanceAfter },
        campaign: cmp ? campaignFromRow(cmp) : null
      };
    });
  }

  // ── M5 order redirects ─────────────────────────────────────────────────────
  async createOrderRedirect(o) {
    await this.q(
      `INSERT INTO order_redirects (id, user_id, place_id, place_name, dish_id, dish_name, partner, target_deeplink, fallback_web_url, loopback_confirmed_eaten, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [o.id, o.user_id, o.place_id, o.place_name, o.dish_id, o.dish_name, o.partner, o.target_deeplink, o.fallback_web_url, o.loopback_confirmed_eaten, o.created_at]);
    return o;
  }

  async getOrderRedirect(id) {
    const r = (await this.q('SELECT * FROM order_redirects WHERE id = $1', [id])).rows[0];
    return r ? orderFromRow(r) : null;
  }

  async confirmOrderEaten(id) {
    const r = (await this.q('UPDATE order_redirects SET loopback_confirmed_eaten = TRUE WHERE id = $1 RETURNING *', [id])).rows[0];
    return r ? orderFromRow(r) : null;
  }

  // ── M20 community recipes ──────────────────────────────────────────────────
  async listRecipes() {
    return (await this.q('SELECT * FROM community_recipes ORDER BY created_at DESC, id ASC LIMIT 200')).rows.map(recipeFromRow);
  }

  async getRecipe(id) {
    const r = (await this.q('SELECT * FROM community_recipes WHERE id = $1', [id])).rows[0];
    return r ? recipeFromRow(r) : null;
  }

  async createRecipe(rec) {
    const r = await this.q(
      `INSERT INTO community_recipes (id, author_id, author_name, author_avatar, title, prep_time_minutes, difficulty, calories, ingredients, zero_waste_tag, likes_count, total_tips_vnd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [rec.id, rec.author_id || null, rec.author, rec.author_avatar || null, rec.title, rec.prep_time_minutes, rec.difficulty, rec.calories,
        JSON.stringify(rec.ingredients || []), rec.zero_waste_tag, rec.likes_count || 0, rec.tips_received_vnd || 0]);
    return recipeFromRow(r.rows[0]);
  }

  async updateRecipe(id, patch) {
    const map = { title: 'title', prep_time_minutes: 'prep_time_minutes', calories: 'calories', zero_waste_tag: 'zero_waste_tag' };
    const keys = Object.keys(map).filter(k => patch[k] !== undefined);
    if (!keys.length) return this.getRecipe(id);
    const r = await this.q(
      `UPDATE community_recipes SET ${keys.map((k, i) => `${map[k]} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`,
      [id, ...keys.map(k => patch[k])]);
    return r.rows[0] ? recipeFromRow(r.rows[0]) : null;
  }

  async deleteRecipe(id) {
    return (await this.q('DELETE FROM community_recipes WHERE id = $1', [id])).rowCount > 0;
  }

  async likeRecipe(id) {
    const r = (await this.q('UPDATE community_recipes SET likes_count = likes_count + 1 WHERE id = $1 RETURNING *', [id])).rows[0];
    return r ? recipeFromRow(r) : null;
  }

  async tipRecipe(id, amountVnd) {
    const r = (await this.q('UPDATE community_recipes SET total_tips_vnd = total_tips_vnd + $2 WHERE id = $1 RETURNING *', [id, Number(amountVnd)])).rows[0];
    return r ? recipeFromRow(r) : null;
  }

  // ── M9 audit log ───────────────────────────────────────────────────────────
  async addAudit(e) {
    const r = await this.q(
      `INSERT INTO rbac_audit_logs (actor_email, actor_id, role, action, target, ip_address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [String(e.actor || 'unknown').slice(0, 255), e.actor_id || null, e.role || 'unknown', e.action, e.target ? String(e.target).slice(0, 255) : null, String(e.ip || 'unknown').slice(0, 45)]);
    return auditFromRow(r.rows[0]);
  }

  async listAudit(limit = 100) {
    return (await this.q('SELECT * FROM rbac_audit_logs ORDER BY created_at DESC LIMIT $1', [limit])).rows.map(auditFromRow);
  }
}

function auditFromRow(r) {
  return { id: r.id, actor: r.actor_email, actor_id: r.actor_id, role: r.role, action: r.action, target: r.target, ip: r.ip_address, timestamp: iso(r.created_at) };
}

export { hourToTime };
