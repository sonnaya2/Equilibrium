let hits = 0;
let misses = 0;
let enabled = false;

export function enablePoisonFutureInternProfile(on: boolean): void {
  enabled = on;
}

export function notePoisonFutureIntern(hit: boolean): void {
  if (!enabled) return;
  if (hit) hits += 1;
  else misses += 1;
}

export function resetPoisonFutureInternProfile(): void {
  hits = 0;
  misses = 0;
}

export function poisonFutureInternProfile(): { hits: number; misses: number } {
  return { hits, misses };
}
