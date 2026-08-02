/** Simple insertion-order LRU evaluation cache. */

export class EvalCache<V = { score: number }> {
  hits = 0;
  misses = 0;
  private readonly map = new Map<string, V>();

  constructor(readonly maxEntries?: number) {
    if (maxEntries !== undefined && !(maxEntries > 0)) {
      throw new RangeError(`EvalCache: maxEntries must be positive (got ${maxEntries})`);
    }
  }

  get size(): number {
    return this.map.size;
  }

  get(key: string): V | undefined {
    if (!this.map.has(key)) {
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    const value = this.map.get(key) as V;
    // Refresh recency for LRU.
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.maxEntries !== undefined) {
      while (this.map.size > this.maxEntries) {
        const oldest = this.map.keys().next().value as string;
        this.map.delete(oldest);
      }
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/** Default eval cache for search (score-bearing entries). */
export function createEvalCache(maxEntries?: number): EvalCache<{ score: number }> {
  return new EvalCache(maxEntries);
}
