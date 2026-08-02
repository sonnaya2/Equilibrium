import type { PoolAbility, SizeBounds } from "./contracts";
import { remainingCandidates } from "./eligibility";
import type { Rng } from "./rng";

export interface SeedOptions {
  pool: readonly PoolAbility[];
  sizeBounds: SizeBounds;
  rng: Rng;
  /** Authored bars (wiki/PvME/user) accepted when legal. */
  authored?: readonly (readonly string[])[];
  /** How many random / heuristic seeds to emit (excluding authored). */
  count?: number;
}

/**
 * Heuristic seeds: authored bars, category-balanced, damage-per-occupancy,
 * cooldown spread, random legal subsets.
 */
export function buildSeeds(opts: SeedOptions): string[][] {
  const { pool, sizeBounds, rng } = opts;
  const byId = new Map(pool.map((a) => [a.id, a] as const));
  const count = opts.count ?? 12;
  const out: string[][] = [];
  const seen = new Set<string>();

  const push = (bar: string[]) => {
    if (bar.length < sizeBounds.min || bar.length > sizeBounds.max) return;
    const built: string[] = [];
    for (const id of bar) {
      const a = byId.get(id);
      if (a && remainingCandidates(built, [a], byId).length) built.push(id);
    }
    if (built.length < sizeBounds.min) return;
    const key = built.join("\0");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(built);
  };

  for (const a of opts.authored ?? []) push([...a]);

  push(categoryBalanced(pool, sizeBounds, byId));
  push(damagePerOccupancy(pool, sizeBounds, byId));
  push(cooldownSpread(pool, sizeBounds, byId));

  let guard = count * 10;
  while (out.length < count + (opts.authored?.length ?? 0) && guard-- > 0) {
    push(randomSubset(pool, sizeBounds, rng, byId));
  }

  return out;
}

function targetLen(bounds: SizeBounds, prefer?: number): number {
  if (prefer !== undefined) {
    return Math.min(bounds.max, Math.max(bounds.min, prefer));
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.ceil((bounds.min + bounds.max) / 2)));
}

function categoryBalanced(
  pool: readonly PoolAbility[],
  bounds: SizeBounds,
  byId: Map<string, PoolAbility>,
): string[] {
  const order: NonNullable<PoolAbility["category"]>[] = [
    "ultimate",
    "enhanced",
    "basic",
    "utility",
  ];
  const buckets = new Map<string, PoolAbility[]>();
  for (const c of order) buckets.set(c, []);
  buckets.set("_", []);
  for (const a of pool) {
    const key = a.category ?? "_";
    const list = buckets.get(key) ?? [];
    list.push(a);
    buckets.set(key, list);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => (b.averageDamage ?? 0) - (a.averageDamage ?? 0));
  }

  const bar: string[] = [];
  const len = targetLen(bounds);
  let progress = true;
  while (bar.length < len && progress) {
    progress = false;
    for (const c of [...order, "_" as const]) {
      if (bar.length >= len) break;
      const list = buckets.get(c) ?? [];
      for (const a of list) {
        if (remainingCandidates(bar, [a], byId).length) {
          bar.push(a.id);
          progress = true;
          break;
        }
      }
    }
  }
  return bar;
}

function damagePerOccupancy(
  pool: readonly PoolAbility[],
  bounds: SizeBounds,
  byId: Map<string, PoolAbility>,
): string[] {
  const ranked = [...pool].sort((a, b) => {
    const da = (a.averageDamage ?? 0) / Math.max(1, a.occupancyTicks ?? 3);
    const db = (b.averageDamage ?? 0) / Math.max(1, b.occupancyTicks ?? 3);
    return db - da;
  });
  const bar: string[] = [];
  const len = targetLen(bounds, bounds.max);
  for (const a of ranked) {
    if (bar.length >= len) break;
    if (remainingCandidates(bar, [a], byId).length) bar.push(a.id);
  }
  return bar;
}

function cooldownSpread(
  pool: readonly PoolAbility[],
  bounds: SizeBounds,
  byId: Map<string, PoolAbility>,
): string[] {
  const ranked = [...pool].sort(
    (a, b) => (b.cooldownTicks ?? 0) - (a.cooldownTicks ?? 0),
  );
  const bar: string[] = [];
  const len = targetLen(bounds);
  let lo = 0;
  let hi = ranked.length - 1;
  let takeHi = true;
  while (bar.length < len && lo <= hi) {
    const a = takeHi ? ranked[lo++]! : ranked[hi--]!;
    if (remainingCandidates(bar, [a], byId).length) bar.push(a.id);
    takeHi = !takeHi;
  }
  return bar;
}

function randomSubset(
  pool: readonly PoolAbility[],
  bounds: SizeBounds,
  rng: Rng,
  byId: Map<string, PoolAbility>,
): string[] {
  const len = bounds.min + rng.int(bounds.max - bounds.min + 1);
  const shuffled = rng.shuffle([...pool]);
  const bar: string[] = [];
  for (const a of shuffled) {
    if (bar.length >= len) break;
    if (remainingCandidates(bar, [a], byId).length) bar.push(a.id);
  }
  return bar;
}
