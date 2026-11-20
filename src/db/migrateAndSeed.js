// =============================================================================
// AUTOMATED DATABASE MIGRATION & SEED SCRIPT
// Hôm nay ăn gì · Taste of Vietnam v0.1 (PostgreSQL + PostGIS + pgvector)
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createInitialStore } from '../data/seed.js';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrationAndSeed(customConnectionString = null) {
  const connectionString = customConnectionString || process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn('⚠️  No DATABASE_URL provided. Migration skipped (using in-memory store).');
    return { success: false, reason: 'NO_DATABASE_URL' };
  }

  console.log('🚀 Connecting to PostgreSQL for migration...');
  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    // 1. Run Schema DDL
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('📄 Executing schema DDL (12 tables + PostGIS + pgvector)...');
    await pool.query(schemaSql);
    console.log('✅ Schema tables & extensions verified/created.');

    // 2. Load Seed Data from in-memory seed generator
    const store = createInitialStore();

    // 3. Seed Dishes (M2 Library)
    console.log(`🍜 Seeding ${store.dishes.length} dishes into 'dishes' table...`);
    for (const d of store.dishes) {
      await pool.query(
        `INSERT INTO dishes (
          id, name, unaccented_name, region, meal_slots, diet_flags, allergen_flags,
          spice_level, calories, prep_time_minutes, estimated_price_vnd, ingredients, recipe_steps
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          unaccented_name = EXCLUDED.unaccented_name,
          estimated_price_vnd = EXCLUDED.estimated_price_vnd;`,
        [
          d.id,
          d.name,
          d.unaccented_name || d.name,
          d.region,
          d.meal_slots || ['lunch', 'dinner'],
          d.diet_flags || [d.diet_mode || 'balanced'],
          d.allergen_flags || d.allergen_tags || [],
          d.spice_level ?? 1,
          d.calories || 400,
          d.prep_time_minutes || d.prep_minutes || 25,
          d.estimated_price_vnd || d.ref_price || 45000,
          JSON.stringify(d.ingredients || []),
          JSON.stringify(d.recipe_steps || d.steps || []),
        ]
      );
    }

    // 4. Seed Places with PostGIS Geometries (M4 Places)
    console.log(`📍 Seeding ${store.places.length} places into 'places' table with PostGIS geometry...`);
    for (const p of store.places) {
      const openTime = p.open_time || (p.open_hour !== undefined ? `${String(p.open_hour).padStart(2, '0')}:00:00` : '06:00:00');
      const closeTime = p.close_time || (p.close_hour !== undefined ? `${String(p.close_hour).padStart(2, '0')}:00:00` : '22:00:00');
      const reportCount = p.report_count || p.closed_report_count || 0;
      const isPaused = p.is_paused !== undefined ? p.is_paused : false;

      await pool.query(
        `INSERT INTO places (
          id, name, address, geom, open_time, close_time, rating, review_count, report_count, is_paused, is_verified
        ) VALUES (
          $1, $2, $3,
          ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
          $6, $7, $8, $9, $10, $11, $12
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          address = EXCLUDED.address,
          rating = EXCLUDED.rating;`,
        [
          p.id,
          p.name,
          p.address,
          p.lng, // PostGIS Point takes (lng, lat)
          p.lat,
          openTime,
          closeTime,
          p.rating || 4.5,
          p.review_count || 0,
          reportCount,
          isPaused,
          p.is_verified ?? true,
        ]
      );

      // Seed Place Dishes
      const dishIds = p.dish_ids || (p.menu ? p.menu.map((m) => m.dish_id) : ['DISH-101']);
      for (const dishId of dishIds) {
        const dish = store.dishes.find((d) => d.id === dishId);
        const menuItem = p.menu ? p.menu.find((m) => m.dish_id === dishId) : null;
        const price = menuItem ? menuItem.price : (dish ? (dish.ref_price || dish.estimated_price_vnd) : 50000);
        await pool.query(
          `INSERT INTO place_dishes (place_id, dish_id, price_vnd, is_available)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (place_id, dish_id) DO NOTHING;`,
          [p.id, dishId, price]
        );
      }
    }

    // 5. Seed Ad Campaigns (M7 Sponsored)
    const campaigns = store.ad_campaigns || store.campaigns || [];
    console.log(`🎯 Seeding ${campaigns.length} campaigns into 'ad_campaigns' table...`);
    for (const c of campaigns) {
      await pool.query(
        `INSERT INTO ad_campaigns (id, place_id, dish_id, cpc_vnd, balance_vnd, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET balance_vnd = EXCLUDED.balance_vnd;`,
        [c.id, c.place_id, c.dish_id, c.cpc_vnd || 3500, c.balance_vnd || c.budget_monthly_vnd || 500000, c.is_active ?? (c.status === 'active')]
      );
    }

    // 6. Seed OCR Queue (M6/M9 Review)
    const ocrQueue = store.ocr_queue || store.ocrQueue || [];
    console.log(`📋 Seeding ${ocrQueue.length} items into 'ocr_review_queue' table...`);
    for (const q of ocrQueue) {
      await pool.query(
        `INSERT INTO ocr_review_queue (id, place_id, raw_text, extracted_dish_name, extracted_price_vnd, confidence_score, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING;`,
        [
          q.id,
          q.place_id,
          q.raw_text,
          q.extracted_dish_name || q.extracted_name || 'Phở',
          q.extracted_price_vnd || q.extracted_price || 45000,
          q.confidence_score || q.confidence || 0.9,
          q.status || 'pending',
        ]
      );
    }

    // 7. Seed Phase 2: Cultural Stories (M14)
    console.log(`📖 Seeding cultural stories into 'cultural_stories' table...`);
    await pool.query(
      `INSERT INTO cultural_stories (id, dish_id, title, history_summary, regional_variants)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING;`,
      [
        'STORY-PHO',
        'DISH-101',
        'Nguồn Gốc & Sự Biến Chuyển Của Phở Bò',
        'Phở ra đời vào đầu thế kỷ 20 tại miền Bắc Việt Nam, giao thoa giữa nét ẩm thực cung đình Huế, Pháp và làng quê Bắc Bộ.',
        JSON.stringify([
          { region: 'Bắc', style: 'Nước dùng trong, thanh ngọt xương bò, bánh phở dẹp bản to, không giá quế' },
          { region: 'Nam', style: 'Nước dùng béo đậm, ăn kèm tương đen, bò viên, giá trụng và húng quế' }
        ])
      ]
    );

    // 8. Seed Phase 2: Food Trails (M15)
    console.log(`🗺️ Seeding Food Trail into 'food_trails' table...`);
    await pool.query(
      `INSERT INTO food_trails (id, title, city, stops, passport_badge)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING;`,
      [
        'TRAIL-HN-OLDQUARTER',
        'Food Trail 1 Ngày Khám Phá Ẩm Thực Cổ',
        'Hà Nội',
        JSON.stringify([
          { order: 1, dish_name: 'Phở Bò Tái Nạm', place_name: 'Phở Gia Truyền Bát Đàn' },
          { order: 2, dish_name: 'Cà Phê Trứng', place_name: 'Giảng Cafe Hàng Gai' },
          { order: 3, dish_name: 'Bún Chả Nem Cua Bể', place_name: 'Bún Chả Hương Liên' },
          { order: 4, dish_name: 'Chả Cá Lã Vọng', place_name: 'Chả Cá Thăng Long' }
        ]),
        'Đại Sứ Ẩm Thực Phố Cổ'
      ]
    );

    // 9. Seed Phase 2: B2G Tourism Reports (M17)
    console.log(`📊 Seeding B2G insights report into 'b2g_tourism_reports' table...`);
    await pool.query(
      `INSERT INTO b2g_tourism_reports (id, report_period, k_anonymity_min_group, specialty_search_count, international_tourist_count, trending_dishes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING;`,
      [
        'REP-2026-Q4',
        '30d',
        50,
        142500,
        18400,
        JSON.stringify(['Phở Bò Tái Nạm', 'Cơm Tấm Sườn Bì Chả', 'Bún Bò Huế O Xuân'])
      ]
    );

    console.log('🎉 Database migration & seeding completed successfully!');
    return { success: true, seeded: { dishes: store.dishes.length, places: store.places.length } };
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

// Auto-run if invoked directly via CLI (node src/db/migrateAndSeed.js)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runMigrationAndSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
