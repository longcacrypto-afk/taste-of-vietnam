// =============================================================================
// REPOSITORY LAYER — the only way the API reads and writes data.
//
//   getRepository(store) -> PostgresRepository when the server booted with
//                           DATABASE_URL (store.repo), otherwise a
//                           MemoryRepository over the in-memory seed store
//                           (tests / local dev only: data is lost on restart).
//   initRepository(...)  -> called once at boot by server.js.
//
// Both classes expose the same async methods (users, OTP, history, collections,
// dishes, places, campaigns, payments, order redirects, recipes, audit log).
// The helpers at the bottom of this file are the older, unwired queries for the
// frozen modules (M7 ad clicks, M11–M20); they use the legacy pool in
// connection.js and return null when it is not connected.
// =============================================================================

import { query, isPostgresConnected, createPool } from './connection.js';
import { MemoryRepository } from './memoryRepository.js';
import { PostgresRepository } from './postgresRepository.js';
import { migrationStatus, runMigrations } from './migrate.js';

export { MemoryRepository, PostgresRepository };

const memoryRepos = new WeakMap();

/** The repository for this store: Postgres if attached at boot, else memory. */
export function getRepository(store) {
  if (store.repo) return store.repo;
  let repo = memoryRepos.get(store);
  if (!repo) {
    repo = new MemoryRepository(store);
    memoryRepos.set(store, repo);
  }
  return repo;
}

/**
 * Boot-time setup. Without a database URL: memory mode. With one: connect, make sure
 * every migration is applied (or apply them when autoMigrate), attach the Postgres
 * repository to the store. Throws when the database is unreachable or behind on
 * migrations, so the server never silently falls back to memory and loses data.
 */
export async function initRepository(store, {
  databaseUrl = process.env.DATABASE_URL,
  autoMigrate = process.env.DB_AUTO_MIGRATE === 'true',
  log = console.log
} = {}) {
  if (!databaseUrl) {
    log(process.env.NODE_ENV === 'production'
      ? '⚠️  DATABASE_URL not set — IN-MEMORY mode: every account, profile and order is lost on restart.'
      : 'ℹ️  DATABASE_URL not set — in-memory store (dev/test mode, data is lost on restart).');
    return getRepository(store);
  }
  const pool = createPool(databaseUrl);
  try {
    await pool.query('SELECT 1');
    const status = await migrationStatus(pool);
    if (status.pending.length) {
      if (!autoMigrate) {
        throw new Error(`Database is missing migrations: ${status.pending.join(', ')}. Run "npm run db:migrate" against this DATABASE_URL first (or set DB_AUTO_MIGRATE=true).`);
      }
      await runMigrations(pool, { log });
    }
    const dishCount = Number((await pool.query('SELECT COUNT(*)::int AS n FROM dishes')).rows[0].n);
    if (dishCount === 0) log('⚠️  The dishes table is empty. Load the demo catalogue with "npm run db:seed".');
  } catch (err) {
    await pool.end().catch(() => {});
    throw err;
  }
  const repo = new PostgresRepository(pool);
  store.repo = repo;
  log('🐘 PostgreSQL storage active (accounts, profiles, history, catalogue, payments persist across restarts).');
  return repo;
}

// =============================================================================
// LEGACY QUERIES FOR FROZEN MODULES (not wired into the router)
// =============================================================================

/**
 * M4: Tìm quán trong bán kính R mét sử dụng hàm không gian PostGIS ST_DWithin
 */
export async function findPlacesWithinRadius(lng, lat, radiusMeters = 3000, currentHour = 12) {
  if (!isPostgresConnected()) return null; // Fallback to in-memory

  const sql = `
    SELECT
      p.id,
      p.name,
      p.address,
      p.rating,
      p.review_count,
      p.open_time,
      p.close_time,
      p.is_paused,
      ST_Distance(p.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters,
      COALESCE(
        json_agg(
          json_build_object('id', d.id, 'name', d.name, 'price', pd.price_vnd)
        ) FILTER (WHERE d.id IS NOT NULL), '[]'
      ) AS menu_dishes
    FROM places p
    LEFT JOIN place_dishes pd ON p.id = pd.place_id AND pd.is_available = true
    LEFT JOIN dishes d ON pd.dish_id = d.id
    WHERE
      p.is_paused = false
      AND ST_DWithin(p.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      AND $4 >= EXTRACT(HOUR FROM p.open_time)
      AND $4 < EXTRACT(HOUR FROM p.close_time)
    GROUP BY p.id
    ORDER BY distance_meters ASC
    LIMIT 20;
  `;

  const res = await query(sql, [lng, lat, radiusMeters, currentHour]);
  return res ? res.rows : null;
}

/**
 * M2 / M3: Tìm kiếm món ăn với bộ lọc dị ứng cứng & không lặp 3 ngày
 */
export async function searchDishesWithFilters({
  keyword = '',
  hardAllergies = [],
  dietMode = 'normal',
  spiceMax = 3,
  excludedDishIds = [],
}) {
  if (!isPostgresConnected()) return null;

  const sql = `
    SELECT
      id, name, unaccented_name, region, meal_slots, diet_flags,
      allergen_flags, spice_level, calories, estimated_price_vnd, ingredients
    FROM dishes
    WHERE
      ($1 = '' OR unaccented_name ILIKE ('%' || unaccent($1) || '%'))
      AND NOT (allergen_flags && $2::text[]) -- Hard allergy 100% block
      AND ($3 = 'normal' OR $3 = ANY(diet_flags))
      AND spice_level <= $4
      AND NOT (id = ANY($5::varchar[]))
    ORDER BY id ASC;
  `;

  const res = await query(sql, [keyword, hardAllergies, dietMode, spiceMax, excludedDishIds]);
  return res ? res.rows : null;
}

/**
 * M7: Ghi nhận click tài trợ với cơ chế chống click tặc 60 giây
 */
export async function recordAdClickWithAntiFraud(campaignId, ipHash, userId = null) {
  if (!isPostgresConnected()) return null;

  // 1. Kiểm tra xem IP này đã click chiến dịch này trong 60 giây qua chưa
  const checkSql = `
    SELECT id FROM ad_clicks
    WHERE
      campaign_id = $1
      AND ip_hash = $2
      AND clicked_at > NOW() - INTERVAL '60 seconds'
    LIMIT 1;
  `;
  const existing = await query(checkSql, [campaignId, ipHash]);

  if (existing && existing.rows.length > 0) {
    // Click trùng lặp — không trừ tiền
    return { deduplicated: true, charged: false };
  }

  // 2. Ghi nhận click hợp lệ và trừ tiền số dư chiến dịch
  await query(
    `INSERT INTO ad_clicks (campaign_id, ip_hash, user_id, is_valid) VALUES ($1, $2, $3, true);`,
    [campaignId, ipHash, userId]
  );

  const updateRes = await query(
    `UPDATE ad_campaigns
     SET balance_vnd = GREATEST(0, balance_vnd - cpc_vnd),
         is_active = (balance_vnd - cpc_vnd > 0)
     WHERE id = $1
     RETURNING balance_vnd, is_active;`,
    [campaignId]
  );

  return { deduplicated: false, charged: true, campaign: updateRes.rows[0] };
}

/**
 * M12: Xác minh khoảng cách GPS khi gửi đánh giá (<= 500m)
 */
export async function verifyGpsAndSubmitReview(placeId, userLng, userLat, rating, comment, userId = null) {
  if (!isPostgresConnected()) return null;

  const distSql = `
    SELECT
      id, name,
      ROUND(ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)) AS distance_meters
    FROM places
    WHERE id = $3;
  `;
  const distRes = await query(distSql, [userLng, userLat, placeId]);
  if (!distRes || distRes.rows.length === 0) return null;

  const distMeters = parseInt(distRes.rows[0].distance_meters, 10);
  const isValid = distMeters <= 500;

  await query(
    `INSERT INTO place_reviews (place_id, user_id, rating, comment, gps_distance_meters, is_gps_verified)
     VALUES ($1, $2, $3, $4, $5, $6);`,
    [placeId, userId, rating, comment, distMeters, isValid]
  );

  return { verified: isValid, distance_meters: distMeters, place: distRes.rows[0] };
}

/**
 * M11: Lưu và truy vấn Kế hoạch Thực đơn 7 Ngày
 */
export async function saveWeeklyMealPlan(planData) {
  if (!isPostgresConnected()) return null;
  const sql = `
    INSERT INTO weekly_meal_plans (id, user_id, week_start_date, plan_slots, consolidated_groceries, total_budget_vnd)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO UPDATE SET
      plan_slots = EXCLUDED.plan_slots,
      consolidated_groceries = EXCLUDED.consolidated_groceries,
      total_budget_vnd = EXCLUDED.total_budget_vnd
    RETURNING *;
  `;
  const res = await query(sql, [
    planData.id || `PLAN-${Date.now()}`,
    planData.user_id || null,
    planData.week_start_date || new Date().toISOString().slice(0, 10),
    JSON.stringify(planData.days || []),
    JSON.stringify(planData.consolidated_groceries || []),
    planData.weekly_budget_vnd || 450000,
  ]);
  return res ? res.rows[0] : null;
}

/**
 * M14: Truy vấn câu chuyện di sản & biến thể 3 miền
 */
export async function fetchDishCulturalStory(dishId) {
  if (!isPostgresConnected()) return null;
  const res = await query(`SELECT * FROM cultural_stories WHERE dish_id = $1 LIMIT 1;`, [dishId]);
  return res && res.rows.length > 0 ? res.rows[0] : null;
}

/**
 * M15: Truy vấn lộ trình Food Trail & trạm dừng
 */
export async function fetchFoodTrail(trailId = 'TRAIL-HN-OLDQUARTER') {
  if (!isPostgresConnected()) return null;
  const res = await query(`SELECT * FROM food_trails WHERE id = $1 LIMIT 1;`, [trailId]);
  return res && res.rows.length > 0 ? res.rows[0] : null;
}

/**
 * M17: Báo cáo du lịch B2G tuân thủ K-Anonymity (k >= 50)
 */
export async function fetchB2gTourismReport(period = '30d') {
  if (!isPostgresConnected()) return null;
  const res = await query(
    `SELECT * FROM b2g_tourism_reports WHERE report_period = $1 ORDER BY generated_at DESC LIMIT 1;`,
    [period]
  );
  return res && res.rows.length > 0 ? res.rows[0] : null;
}

/**
 * M18: Lưu hoặc cập nhật nguyên liệu trong tủ lạnh thông minh
 */
export async function saveFridgeItem(itemData) {
  if (!isPostgresConnected()) return null;
  const sql = `
    INSERT INTO fridge_items (id, user_id, barcode, name, quantity, compartment, expires_at, is_expiring_soon)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET
      quantity = EXCLUDED.quantity,
      compartment = EXCLUDED.compartment,
      expires_at = EXCLUDED.expires_at,
      is_expiring_soon = EXCLUDED.is_expiring_soon
    RETURNING *;
  `;
  const res = await query(sql, [
    itemData.id || `FRIDGE-${Date.now()}`,
    itemData.user_id || null,
    itemData.barcode || null,
    itemData.name,
    itemData.quantity || '1',
    itemData.compartment || 'chill',
    itemData.expires_at || new Date(Date.now() + 86400000 * 3).toISOString(),
    itemData.is_expiring_soon || false
  ]);
  return res ? res.rows[0] : null;
}

export async function fetchFridgeInventoryDb(userId = null) {
  if (!isPostgresConnected()) return null;
  const sql = `
    SELECT * FROM fridge_items
    WHERE ($1::uuid IS NULL OR user_id = $1)
    ORDER BY expires_at ASC;
  `;
  const res = await query(sql, [userId]);
  return res ? res.rows : null;
}

/**
 * M19: Ghi nhận chỉ số thể trạng đồng bộ từ thiết bị đeo sức khỏe
 */
export async function saveHealthMetrics(healthData) {
  if (!isPostgresConnected()) return null;
  const sql = `
    INSERT INTO health_metrics (
      user_id, wearable_source, daily_steps, active_calories_burned,
      calculated_tdee, target_calories_daily, target_protein_g, target_carbs_g, target_fat_g
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;
  const res = await query(sql, [
    healthData.user_id || null,
    healthData.wearable_source || 'Apple Health',
    healthData.daily_steps || 0,
    healthData.active_calories_burned || 0,
    healthData.calculated_tdee || 2000,
    healthData.target_calories_daily || 2000,
    healthData.target_protein_g || 120,
    healthData.target_carbs_g || 220,
    healthData.target_fat_g || 50
  ]);
  return res ? res.rows[0] : null;
}

export async function fetchLatestHealthMetrics(userId = null) {
  if (!isPostgresConnected()) return null;
  const sql = `
    SELECT * FROM health_metrics
    WHERE ($1::uuid IS NULL OR user_id = $1)
    ORDER BY synced_at DESC LIMIT 1;
  `;
  const res = await query(sql, [userId]);
  return res && res.rows.length > 0 ? res.rows[0] : null;
}

/**
 * M20: Tạo mới, truy vấn công thức cộng đồng và ghi nhận tiền tip VietQR
 */
export async function saveCommunityRecipe(recipeData) {
  if (!isPostgresConnected()) return null;
  const sql = `
    INSERT INTO community_recipes (
      id, author_id, author_name, title, prep_time_minutes, difficulty,
      calories, ingredients, steps, zero_waste_tag, likes_count, total_tips_vnd
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      prep_time_minutes = EXCLUDED.prep_time_minutes,
      difficulty = EXCLUDED.difficulty,
      calories = EXCLUDED.calories,
      ingredients = EXCLUDED.ingredients,
      zero_waste_tag = EXCLUDED.zero_waste_tag
    RETURNING *;
  `;
  const res = await query(sql, [
    recipeData.id || `CREC-${Date.now()}`,
    recipeData.author_id || null,
    recipeData.author_name || 'Chef Sáng Tạo',
    recipeData.title,
    recipeData.prep_time_minutes || 20,
    recipeData.difficulty || 'Dễ',
    recipeData.calories || 400,
    JSON.stringify(recipeData.ingredients || []),
    JSON.stringify(recipeData.steps || []),
    recipeData.zero_waste_tag || null,
    recipeData.likes_count || 0,
    recipeData.total_tips_vnd || 0
  ]);
  return res ? res.rows[0] : null;
}

export async function fetchCommunityRecipesDb({ tag = null, limit = 20 } = {}) {
  if (!isPostgresConnected()) return null;
  const sql = `
    SELECT * FROM community_recipes
    WHERE ($1::text IS NULL OR zero_waste_tag ILIKE ('%' || $1 || '%'))
    ORDER BY created_at DESC LIMIT $2;
  `;
  const res = await query(sql, [tag, limit]);
  return res ? res.rows : null;
}

export async function recordRecipeTip(recipeId, amountVnd) {
  if (!isPostgresConnected()) return null;
  const sql = `
    UPDATE community_recipes
    SET total_tips_vnd = total_tips_vnd + $1
    WHERE id = $2
    RETURNING id, title, author_name, total_tips_vnd;
  `;
  const res = await query(sql, [amountVnd, recipeId]);
  return res && res.rows.length > 0 ? res.rows[0] : null;
}

