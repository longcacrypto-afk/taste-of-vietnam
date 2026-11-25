// =============================================================================
// ORDERED SQL MIGRATIONS — src/db/migrations/NNN_name.sql
//   node src/db/migrate.js            apply pending migrations (npm run db:migrate)
//   node src/db/migrate.js --status   list applied / pending, change nothing
// Each file runs once, inside its own transaction, recorded in schema_migrations
// with a checksum. A pg advisory lock stops two deploys migrating at once.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPool } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const LOCK_KEY = 7317001; // arbitrary, fixed: "taste-of-vietnam migrations"

export function listMigrationFiles(dir = MIGRATIONS_DIR) {
  return fs.readdirSync(dir)
    .filter(f => /^\d{3,}_[\w-]+\.sql$/.test(f))
    .sort()
    .map(file => {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      return {
        version: file.split('_')[0],
        name: file.replace(/\.sql$/, ''),
        sql,
        checksum: crypto.createHash('sha256').update(sql).digest('hex')
      };
    });
}

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(16) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
}

async function appliedMap(client) {
  const exists = await client.query(`SELECT to_regclass('public.schema_migrations') AS t`);
  if (!exists.rows[0].t) return new Map();
  const res = await client.query('SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version');
  return new Map(res.rows.map(r => [r.version, r]));
}

/** Read-only: which migrations are applied, which are pending, which changed after being applied. */
export async function migrationStatus(pool, dir = MIGRATIONS_DIR) {
  const applied = await appliedMap(pool);
  const files = listMigrationFiles(dir);
  return {
    applied: files.filter(f => applied.has(f.version)).map(f => f.name),
    pending: files.filter(f => !applied.has(f.version)).map(f => f.name),
    changed: files.filter(f => applied.has(f.version) && applied.get(f.version).checksum !== f.checksum).map(f => f.name)
  };
}

/** Apply every pending migration in order. Returns the names applied. */
export async function runMigrations(pool, { dir = MIGRATIONS_DIR, log = console.log } = {}) {
  const client = await pool.connect();
  const done = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await ensureTable(client);
    const applied = await appliedMap(client);
    for (const m of listMigrationFiles(dir)) {
      if (applied.has(m.version)) {
        if (applied.get(m.version).checksum !== m.checksum) {
          log(`⚠️  ${m.name} was edited after it was applied (checksum differs). Not re-run: add a new migration instead.`);
        }
        continue;
      }
      log(`➡️  applying ${m.name} …`);
      try {
        await client.query('BEGIN');
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)', [m.version, m.name, m.checksum]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`Migration ${m.name} failed and was rolled back: ${err.message}`);
      }
      done.push(m.name);
      log(`✅ ${m.name}`);
    }
    if (!done.length) log('✅ Database schema is up to date.');
    return done;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    client.release();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL is not set. Example: DATABASE_URL=postgres://user:pass@localhost:5432/taste_of_vietnam npm run db:migrate');
    process.exit(1);
  }
  const pool = createPool(url);
  const statusOnly = process.argv.includes('--status');
  (statusOnly ? migrationStatus(pool) : runMigrations(pool))
    .then(r => { if (statusOnly) console.log(JSON.stringify(r, null, 2)); })
    .catch(err => { console.error('❌', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
