// =============================================================================
// SEED THE DEMO CATALOGUE INTO POSTGRESQL (npm run db:seed)
// 12 dishes, 8 places (+ menus, PostGIS points), 5 sponsored campaigns, the OCR
// queue, the seeded closure report and 2 community recipes — all taken from
// src/data/seed.js so memory mode and Postgres mode start from the same data.
// Idempotent: ON CONFLICT DO NOTHING, so re-running never overwrites rows an
// admin has edited. No user accounts are seeded.
//   npm run db:seed               insert missing demo rows only
//   npm run db:seed -- --update   also refresh the demo rows that already exist
//                                 (same ids) with every catalogue field — for a
//                                 database seeded by the old migrateAndSeed.js,
//                                 whose demo rows lack descriptions, tags, links…
//                                 Never touches campaign balances or user data.
// =============================================================================

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialStore } from '../data/seed.js';
import { removeVietnameseTones } from '../services/textUtils.js';
import { createPool } from './connection.js';
import { hourToTime } from './postgresRepository.js';

// Seed rows share one old timestamp so new rows (newest first) list above them
const SEED_TS = '2026-01-01T00:00:00Z';

/** "ON CONFLICT (...) DO NOTHING" or, with update, "DO UPDATE SET c = EXCLUDED.c, …". */
const onConflict = (update, key, cols) => update
  ? `ON CONFLICT (${key}) DO UPDATE SET ${cols.map(c => `${c} = EXCLUDED.${c}`).join(', ')}`
  : `ON CONFLICT (${key}) DO NOTHING`;

export async function seedCatalog(pool, { log = console.log, update = false } = {}) {
  const store = createInitialStore();
  const client = await pool.connect();
  const counts = { dishes: 0, places: 0, menu_items: 0, campaigns: 0, ocr: 0, reports: 0, recipes: 0 };
  try {
    await client.query('BEGIN');
    for (const d of store.dishes) {
      const r = await client.query(
        `INSERT INTO dishes (id, name, unaccented_name, region, meal_slots, diet_flags, allergen_flags, spice_level, calories,
           prep_time_minutes, estimated_price_vnd, ingredients, recipe_steps, description, tags, weather_fit, img_key, macros,
           difficulty, base_servings, market_cost_base, is_soup)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         ${onConflict(update, 'id', ['name', 'unaccented_name', 'region', 'meal_slots', 'diet_flags', 'allergen_flags', 'spice_level',
    'calories', 'prep_time_minutes', 'estimated_price_vnd', 'ingredients', 'recipe_steps', 'description', 'tags', 'weather_fit',
    'img_key', 'macros', 'difficulty', 'base_servings', 'market_cost_base', 'is_soup'])}`,
        [d.id, d.name, removeVietnameseTones(d.name), d.region, d.meal_slots || ['lunch', 'dinner'], d.diet_flags || [],
          d.allergen_tags || [], d.spice_level ?? 0, d.calories ?? 400, d.prep_minutes ?? 25, d.ref_price ?? 50000,
          JSON.stringify(d.ingredients || []), JSON.stringify(d.steps || []), d.description || '', d.tags || [],
          d.weather_fit || ['any'], d.img_key || null, JSON.stringify(d.macros || {}), d.difficulty || null,
          d.base_servings || 2, d.market_cost_base ?? null, typeof d.is_soup === 'boolean' ? d.is_soup : null]);
      counts.dishes += r.rowCount;
    }

    for (const p of store.places) {
      const r = await client.query(
        `INSERT INTO places (id, name, address, geom, open_time, close_time, rating, review_count, report_count, is_paused,
           is_verified, phone, img_key, links, has_ac, has_kids_seat)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ${onConflict(update, 'id', ['name', 'address', 'geom', 'open_time', 'close_time', 'rating', 'review_count', 'is_verified',
    'phone', 'img_key', 'links', 'has_ac', 'has_kids_seat'])}`,
        [p.id, p.name, p.address, p.lng, p.lat, hourToTime(p.open_hour, 6), hourToTime(p.close_hour, 22), p.rating ?? 4.5,
          p.review_count || 0, p.closed_report_count || 0, p.is_open_override === false, p.is_verified !== false,
          p.phone || null, p.img_key || null, JSON.stringify(p.links || {}), typeof p.has_ac === 'boolean' ? p.has_ac : null, Boolean(p.has_kids_seat)]);
      counts.places += r.rowCount;
      for (const m of p.menu || []) {
        const mr = await client.query(
          `INSERT INTO place_dishes (place_id, dish_id, price_vnd, is_available, menu_name) VALUES ($1, $2, $3, $4, $5)
           ${onConflict(update, 'place_id, dish_id', ['price_vnd', 'is_available', 'menu_name'])}`,
          [p.id, m.dish_id, m.price, m.available !== false, m.name || null]);
        counts.menu_items += mr.rowCount;
      }
    }

    for (const c of store.campaigns) {
      const r = await client.query(
        `INSERT INTO ad_campaigns (id, place_id, dish_id, title, badge_label, radius_m, budget_monthly_vnd, balance_vnd,
           impressions, clicks, conversions, roas, status, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10, $11, $12, $13, $14)
         ${onConflict(update, 'id', ['title', 'badge_label', 'radius_m', 'budget_monthly_vnd', 'impressions', 'conversions', 'roas'])}`,
        [c.id, c.place_id, c.dish_id, c.title, c.badge_label || 'Tài trợ', c.radius_m || 3000, c.budget_monthly_vnd ?? null,
          c.impressions || 0, c.clicks || 0, c.conversions || 0, c.roas ?? null, c.status || 'active', c.status === 'active', SEED_TS]);
      counts.campaigns += r.rowCount;
    }

    for (const o of store.ocrQueue || []) {
      const r = await client.query(
        `INSERT INTO ocr_review_queue (id, place_id, raw_text, extracted_dish_name, extracted_price_vnd, confidence_score, status,
           matched_dish_id, matched_dish_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ${onConflict(update, 'id', ['matched_dish_id', 'matched_dish_name'])}`,
        [o.id, o.place_id, o.raw_text, o.extracted_name, o.extracted_price, o.confidence, o.status, o.matched_dish_id || null,
          o.matched_dish_name || null, SEED_TS]);
      counts.ocr += r.rowCount;
    }

    for (const rep of store.userReports || []) {
      const r = await client.query(
        `INSERT INTO place_reports (id, place_id, reason, report_count, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [rep.id, rep.place_id, rep.reason, rep.report_count || 1, rep.status || 'pending_review', SEED_TS]);
      counts.reports += r.rowCount;
    }

    for (const rec of store.communityRecipes || []) {
      const r = await client.query(
        `INSERT INTO community_recipes (id, author_id, author_name, author_avatar, title, prep_time_minutes, difficulty, calories,
           ingredients, zero_waste_tag, likes_count, total_tips_vnd, created_at)
         VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ${onConflict(update, 'id', ['author_avatar'])}`,
        [rec.id, rec.author, rec.author_avatar || null, rec.title, rec.prep_time_minutes || 20, rec.difficulty || 'Dễ',
          rec.calories || 400, JSON.stringify(rec.ingredients || []), rec.zero_waste_tag || null, rec.likes_count || 0,
          rec.tips_received_vnd || 0, SEED_TS]);
      counts.recipes += r.rowCount;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  log(`🌱 Seed ${update ? 'inserted/refreshed' : 'inserted (existing rows kept)'}: ${JSON.stringify(counts)}`);
  return counts;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not set.');
    process.exit(1);
  }
  const pool = createPool(url);
  seedCatalog(pool, { update: process.argv.includes('--update') })
    .catch(err => { console.error('❌ Seed failed:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
