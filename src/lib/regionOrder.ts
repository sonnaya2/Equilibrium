/**
 * Stable region ranking for Build (and similar lists).
 * Known ids keep their declared order; unknown future ids sort after known
 * ones while preserving original relative order (stable sort).
 */

export function regionRank(id: string, order: readonly string[]): number {
  const idx = order.indexOf(id);
  // Unknowns sort after every known id.
  return idx === -1 ? order.length : idx;
}

/**
 * Sort regions by a declared id order. Unknown ids trail known ones and keep
 * their relative input order (Array.prototype.sort is stable in modern JS).
 */
export function sortByRegionOrder<T extends { id: string }>(
  items: readonly T[],
  order: readonly string[],
): T[] {
  return [...items].sort((a, b) => regionRank(a.id, order) - regionRank(b.id, order));
}
