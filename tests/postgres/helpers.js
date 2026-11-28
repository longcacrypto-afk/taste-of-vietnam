// Helpers for the PostgreSQL suite (npm run test:db). Needs TEST_DATABASE_URL pointing at a
// throwaway PostGIS database: every run DROPS and recreates its public schema.
import pg from 'pg';
import { runMigrations } from '../../src/db/migrate.js';
import { seedCatalog } from '../../src/db/seedCatalog.js';
import { createPool } from '../../src/db/connection.js';

// The shared suites assert the original 12-dish catalogue: the removable demo catalogue
// (docs/DEMO_CATALOG.md) is off unless a test turns it on (tests/postgres/demo-catalog.test.js).
process.env.SEED_DEMO_CATALOG ??= 'false';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
export const skip = TEST_DATABASE_URL ? false : 'TEST_DATABASE_URL not set (PostgreSQL suite skipped)';

/** Fresh schema: drop everything, run all migrations, seed the demo catalogue. */
export async function resetDatabase() {
  const pool = createPool(TEST_DATABASE_URL);
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    const applied = await runMigrations(pool, { log: () => {} });
    await seedCatalog(pool, { log: () => {} });
    return applied;
  } finally {
    await pool.end();
  }
}

/** A short-lived pool for assertions on the raw tables. */
export function rawPool() {
  return createPool(TEST_DATABASE_URL, { max: 2 });
}

/** CREATE DATABASE <name> next to the test database; returns its URL and a drop() function. */
export async function scratchDatabase(name) {
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${name}`);
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    async drop() {
      const c = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    }
  };
}
