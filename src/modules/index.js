// =============================================================================
// LIVE MODULE REGISTRY — modules opened after launch (M6–M8, M10–M20, W).
//
// Each module lives in its own file src/modules/mNN.js and exports
//   export default {
//     id: 'M13',
//     seed: () => [{ kind, id?, ownerId?, data }],      // demo records (is_demo = true)
//     async route(ctx) { ... return {status, data} | null }
//   }
// ctx = { repo, ms, store, authUser, userId, profile, method, pathname, searchParams,
//         body, view(), util: { cleanText, cleanNumber, cleanList, unauthorized, bad,
//         notFound, forbidden, demoNote } }
// Routes here run BEFORE the legacy frozen routes, so a module overrides them.
// Demo data is seeded once per module (when it has no records yet) and every
// demo record carries is_demo: true so the data-loading phase can replace it.
// =============================================================================
import fs from 'node:fs';
import { moduleStore } from './moduleStore.js';

// Auto-discovered: every src/modules/m<NN>.js or w.js file is a module.
const MODULE_FILES = fs.readdirSync(new URL('.', import.meta.url))
  .filter(f => /^(m\d+|w)\.js$/.test(f))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  .map(f => './' + f);

let loaded = null;
async function modules() {
  if (!loaded) {
    loaded = [];
    for (const f of MODULE_FILES) loaded.push((await import(f)).default);
  }
  return loaded;
}

export const DEMO_NOTE = 'Dữ liệu demo';
const seededStores = new WeakSet();
const seeding = new WeakMap();

/** Insert each module's demo records once (when that module has none). */
export async function ensureDemoData(repo, { force = false } = {}) {
  if (process.env.SEED_DEMO_MODULES === 'false' && !force) return;
  const key = repo.store || repo.pool || repo;
  if (seededStores.has(key)) return;
  if (!seeding.has(key)) {
    seeding.set(key, (async () => {
      const ms = moduleStore(repo);
      for (const mod of await modules()) {
        if (!mod.seed) continue;
        if (await ms.count(mod.id) > 0) continue;
        for (const rec of mod.seed()) {
          try { await ms.insert({ module: mod.id, kind: rec.kind, id: rec.id, ownerId: rec.ownerId ?? null, data: rec.data, isDemo: true }); }
          catch (e) { if (e.status !== 409) throw e; }
        }
      }
      seededStores.add(key);
    })().finally(() => seeding.delete(key)));
  }
  await seeding.get(key);
}

export async function liveModuleIds() { return (await modules()).map(m => m.id); }

/**
 * phase 'early': mod.routeEarly runs before the core router (use only to take over a
 * path the core router already answers, e.g. M8 /notifications). phase 'late' (default):
 * mod.route runs after the core router, before the legacy frozen routes.
 */
export async function handleModuleRoute(ctx, phase = 'late') {
  const mods = await modules();
  const fn = phase === 'early' ? 'routeEarly' : 'route';
  if (!mods.some(m => typeof m[fn] === 'function')) return null;
  await ensureDemoData(ctx.repo);
  const ms = moduleStore(ctx.repo);
  for (const mod of mods) {
    if (typeof mod[fn] !== 'function') continue;
    const out = await mod[fn]({ ...ctx, ms });
    if (out) return out;
  }
  return null;
}

/** PDPD: personal module data for export, and removal on account deletion. */
export async function exportModuleData(repo, userId) {
  const ms = moduleStore(repo);
  const out = {};
  for (const mod of await modules()) {
    for (const kind of mod.personalKinds || []) {
      const rows = await ms.list(mod.id, kind, { ownerId: userId });
      if (rows.length) (out[mod.id] ||= {})[kind] = rows;
    }
  }
  return out;
}
export async function deleteModuleData(repo, userId) {
  await moduleStore(repo).removeOwner(userId);
}
