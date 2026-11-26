// =============================================================================
// MODULE STORE — persistence for modules opened after launch (M6–M8, M10–M20, W).
// One API over two backends: Postgres table module_records (migration 012) when
// the repository is Postgres, an in-memory array otherwise (tests / local dev).
//
//   const ms = moduleStore(repo);
//   await ms.list('M13', 'booking', { ownerId, where: r => ..., limit })
//   await ms.get(id) · ms.insert({module, kind, ownerId, data, isDemo, id?})
//   await ms.update(id, patchOrFn) · ms.remove(id) · ms.count(module, kind)
//
// A record as returned: { id, module, kind, owner_id, is_demo, created_at,
// updated_at, ...data } (data fields are spread on top level for convenience).
// =============================================================================
import crypto from 'node:crypto';

const iso = v => (v instanceof Date ? v.toISOString() : v);
const newId = (module, kind) => `${module}-${kind}-${crypto.randomUUID().slice(0, 12)}`.toUpperCase();

function shape(r) {
  if (!r) return null;
  const data = typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {});
  return { ...data, id: r.id, module: r.module, kind: r.kind, owner_id: r.owner_id ?? null,
    is_demo: !!r.is_demo, created_at: iso(r.created_at), updated_at: iso(r.updated_at) };
}
const stripMeta = d => {
  const { id, module, kind, owner_id, is_demo, created_at, updated_at, ...rest } = d || {};
  return rest;
};

class MemoryModuleStore {
  constructor(store) { this.rows = (store.moduleRecords ||= []); }
  async list(module, kind, { ownerId, where, limit } = {}) {
    let out = this.rows.filter(r => r.module === module && r.kind === kind &&
      (ownerId === undefined || r.owner_id === ownerId)).map(shape);
    if (where) out = out.filter(where);
    out.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    return limit ? out.slice(0, limit) : out;
  }
  async get(id) { return shape(this.rows.find(r => r.id === id)); }
  async insert({ module, kind, ownerId = null, data = {}, isDemo = false, id }) {
    const now = new Date().toISOString();
    const row = { id: id || newId(module, kind), module, kind, owner_id: ownerId, data: structuredClone(stripMeta(data)), is_demo: isDemo, created_at: now, updated_at: now };
    if (this.rows.some(r => r.id === row.id)) throw Object.assign(new Error('duplicate id'), { status: 409 });
    this.rows.push(row);
    return shape(row);
  }
  async update(id, patch) {
    const row = this.rows.find(r => r.id === id);
    if (!row) return null;
    const cur = shape(row);
    const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch };
    if (next === null || next === undefined) return cur;
    row.data = structuredClone(stripMeta(next));
    row.updated_at = new Date().toISOString();
    return shape(row);
  }
  async remove(id) {
    const i = this.rows.findIndex(r => r.id === id);
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }
  async count(module, kind) { return this.rows.filter(r => r.module === module && (!kind || r.kind === kind)).length; }
  async removeOwner(ownerId) { for (let i = this.rows.length - 1; i >= 0; i--) if (this.rows[i].owner_id === ownerId) this.rows.splice(i, 1); }
}

class PgModuleStore {
  constructor(repo) { this.repo = repo; }
  q(text, params) { return this.repo.q ? this.repo.q(text, params) : this.repo.pool.query(text, params); }
  async list(module, kind, { ownerId, where, limit } = {}) {
    const params = [module, kind];
    let sql = 'SELECT * FROM module_records WHERE module=$1 AND kind=$2';
    if (ownerId !== undefined) { params.push(ownerId); sql += ` AND owner_id IS NOT DISTINCT FROM $${params.length}`; }
    sql += ' ORDER BY created_at, id';
    let out = (await this.q(sql, params)).rows.map(shape);
    if (where) out = out.filter(where);
    return limit ? out.slice(0, limit) : out;
  }
  async get(id) { return shape((await this.q('SELECT * FROM module_records WHERE id=$1', [id])).rows[0]); }
  async insert({ module, kind, ownerId = null, data = {}, isDemo = false, id }) {
    try {
      const r = await this.q(`INSERT INTO module_records (id,module,kind,owner_id,data,is_demo) VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING *`,
        [id || newId(module, kind), module, kind, ownerId, JSON.stringify(stripMeta(data)), isDemo]);
      return shape(r.rows[0]);
    } catch (e) {
      if (e.code === '23505') throw Object.assign(new Error('duplicate id'), { status: 409 });
      throw e;
    }
  }
  async update(id, patch) {
    // Row lock so concurrent increments (votes, likes, stamps) do not lose writes.
    const run = async q => {
      const cur = shape((await q('SELECT * FROM module_records WHERE id=$1 FOR UPDATE', [id])).rows[0]);
      if (!cur) return null;
      const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch };
      if (next === null || next === undefined) return cur;
      return shape((await q('UPDATE module_records SET data=$2::jsonb, updated_at=NOW() WHERE id=$1 RETURNING *', [id, JSON.stringify(stripMeta(next))])).rows[0]);
    };
    if (this.repo.inAtomic || !this.repo.pool) return run((t, p) => this.q(t, p));
    const c = await this.repo.pool.connect();
    try {
      await c.query('BEGIN');
      const out = await run((t, p) => c.query(t, p));
      await c.query('COMMIT');
      return out;
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }
  async remove(id) { return (await this.q('DELETE FROM module_records WHERE id=$1', [id])).rowCount > 0; }
  async count(module, kind) {
    const r = kind ? await this.q('SELECT COUNT(*)::int n FROM module_records WHERE module=$1 AND kind=$2', [module, kind])
      : await this.q('SELECT COUNT(*)::int n FROM module_records WHERE module=$1', [module]);
    return r.rows[0].n;
  }
  async removeOwner(ownerId) { await this.q('DELETE FROM module_records WHERE owner_id=$1', [ownerId]); }
}

const cache = new WeakMap();
export function moduleStore(repo) {
  if (repo.kind === 'memory' || !repo.pool) {
    const store = repo.store || repo;
    let ms = cache.get(store);
    if (!ms) { ms = new MemoryModuleStore(store); cache.set(store, ms); }
    return ms;
  }
  return new PgModuleStore(repo);
}
