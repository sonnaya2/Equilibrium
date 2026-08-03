/** Mulberry32 seeded PRNG - no Math.random. */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates copy; does not mutate input. */
  shuffle<T>(items: readonly T[]): T[];
  /** Independent stream seeded from this generator's next output. */
  fork(): Rng;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    // Canonical Mulberry32 (gist/stackoverflow form).
    let t = (state = (state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    int(maxExclusive: number): number {
      if (!(maxExclusive > 0) || !Number.isFinite(maxExclusive)) {
        throw new RangeError(
          `rng.int: maxExclusive must be a positive finite number (got ${maxExclusive})`,
        );
      }
      return Math.floor(next() * maxExclusive);
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError("rng.pick: empty sequence");
      return items[rng.int(items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        const tmp = out[i] as T;
        out[i] = out[j] as T;
        out[j] = tmp;
      }
      return out;
    },
    fork(): Rng {
      return createRng((next() * 0x100000000) >>> 0);
    },
  };

  return rng;
}
