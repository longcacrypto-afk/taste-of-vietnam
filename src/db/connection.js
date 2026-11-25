// =============================================================================
// DATABASE CONNECTION MANAGER — POSTGRESQL + IN-MEMORY FALLBACK
// Hôm nay ăn gì · Taste of Vietnam v0.1
// =============================================================================

import pg from 'pg';

const { Pool } = pg;

let pool = null;
let isConnected = false;

/** SSL for managed databases (Render, or an explicit sslmode=require), plain TCP locally/CI. */
export function sslFor(connectionString) {
  const useSsl = process.env.NODE_ENV === 'production' ||
    (connectionString && (connectionString.includes('render.com') || connectionString.includes('sslmode=require')));
  return useSsl ? { rejectUnauthorized: false } : false;
}

/** A plain pg Pool (used by the repository, migrations and the seed script). */
export function createPool(connectionString, opts = {}) {
  const p = new Pool({
    connectionString,
    ssl: sslFor(connectionString),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ...opts,
  });
  p.on('error', (err) => console.error('⚠️  PostgreSQL pool error:', err.message));
  return p;
}

/** Legacy pool for the frozen-module helpers at the bottom of repository.js. */
export function initDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.log('ℹ️  DATABASE_URL not set — Running in High-Speed In-Memory Store mode.');
    return null;
  }

  try {
    pool = new Pool({
      connectionString,
      ssl: sslFor(connectionString),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('⚠️  PostgreSQL Pool error:', err.message);
      isConnected = false;
    });

    pool.query('SELECT NOW()', (err, res) => {
      if (err) {
        console.warn('⚠️  PostgreSQL connection check failed, using fallback in-memory store:', err.message);
        isConnected = false;
      } else {
        isConnected = true;
        console.log('🐘 PostgreSQL + PostGIS connected successfully at', res.rows[0].now);
      }
    });

    return pool;
  } catch (err) {
    console.warn('⚠️  Error initializing PostgreSQL pool:', err.message);
    return null;
  }
}

export async function query(text, params = []) {
  if (!pool || !isConnected) {
    return null;
  }
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 200) {
      console.warn(`🐢 Slow Query (${duration}ms):`, text);
    }
    return res;
  } catch (err) {
    console.error('❌ SQL Query error:', err.message, '\nQuery:', text);
    throw err;
  }
}

export function isPostgresConnected() {
  return isConnected;
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    isConnected = false;
  }
}
