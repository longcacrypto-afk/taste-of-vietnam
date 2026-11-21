// =============================================================================
// HIGH-PERFORMANCE IN-MEMORY & DISTRIBUTED CACHE SERVICE
// Hôm nay ăn gì · Taste of Vietnam v0.2
// SLA: Latency reduction < 1ms for p95 suggestion queries
// =============================================================================

class CacheService {
  constructor(defaultTtlSeconds = 60, maxEntries = 500) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
    this.maxEntries = maxEntries;
    this.store = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
    };
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  set(key, value, ttlSeconds = null) {
    // Evict oldest if limit reached
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      this.store.delete(firstKey);
    }

    const ttlMs = ttlSeconds !== null ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      cachedAt: Date.now(),
    });
    this.stats.sets++;
  }

  delete(key) {
    const deleted = this.store.delete(key);
    if (deleted) this.stats.invalidations++;
    return deleted;
  }

  invalidatePattern(prefix) {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    this.stats.invalidations += count;
    return count;
  }

  invalidateUser(userId) {
    return this.invalidatePattern(`sugg:${userId}`);
  }

  clear() {
    this.store.clear();
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    return {
      size: this.store.size,
      max_entries: this.maxEntries,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hit_rate_pct: Math.round(hitRate * 10) / 10,
      sets: this.stats.sets,
      invalidations: this.stats.invalidations,
    };
  }
}

export const suggestionCache = new CacheService(60, 300);
export const staticDataCache = new CacheService(300, 100);
