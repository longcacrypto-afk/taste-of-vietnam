// =============================================================================
// MIGRATE + SEED IN ONE STEP (npm run db:setup) — for a new, empty database.
//   1. apply pending migrations (src/db/migrate.js)
//   2. insert the demo catalogue if missing (src/db/seedCatalog.js)
// =============================================================================

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from './connection.js';
import { runMigrations } from './migrate.js';
import { seedCatalog } from './seedCatalog.js';

export async function runMigrationAndSeed(customConnectionString = null, { seed = true } = {}) {
  const connectionString = customConnectionString || process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('⚠️  No DATABASE_URL provided. Migration skipped (using in-memory store).');
    return { success: false, reason: 'NO_DATABASE_URL' };
  }
  const pool = createPool(connectionString);
  try {
    const applied = await runMigrations(pool);
    const seeded = seed ? await seedCatalog(pool) : null;
    return { success: true, applied, seeded };
  } catch (err) {
    console.error('❌ Migration/seed failed:', err.message);
    return { success: false, reason: 'ERROR', error: err.message };
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  runMigrationAndSeed().then(r => { if (!r.success) process.exitCode = 1; });
}
