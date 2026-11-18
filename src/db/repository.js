// =============================================================================
// REPOSITORY LAYER — POSTGRESQL + POSTGIS SPATIAL QUERIES
// Hôm nay ăn gì · Taste of Vietnam v0.1
// =============================================================================

import { query, isPostgresConnected } from './connection.js';

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
