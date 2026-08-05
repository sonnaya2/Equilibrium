/**
 * Style search policy: one ult twin per loadout; required abilities per style.
 * Keeps the optimizer from wasting budget on dual Sunshine / DS / igneous pairs.
 */
import type { CombatStyle } from "../types";
import type { ItemPassiveId } from "../data/records";

/** Base vs greater (or igneous) twins that must not both enter the search pool. */
const SOFT_TWINS: readonly (readonly [string, string])[] = [
  ["sunshine", "greater_sunshine"],
  ["deaths_swiftness", "greater_deaths_swiftness"],
  ["overpower", "overpower_igneous"],
  ["deadshot", "deadshot_igneous"],
  ["omnipower", "omnipower_igneous"],
  ["death_skulls", "death_skulls_igneous"],
];

/**
 * Planted Feet extends base Sunshine / Death's Swiftness only.
 * Prefer base when PF is on; prefer greater when PF is off.
 */
export function preferGreaterUltTwin(plantedFeet: boolean): boolean {
  return plantedFeet !== true;
}

/**
 * Ids to deny so only one twin of each pair remains.
 * Igneous: prefer upgrade when its passive is live; else base.
 * Soft PF pairs: prefer greater when !plantedFeet, else base.
 */
export function dualVersionDenyIds(opts: {
  style: CombatStyle;
  plantedFeet: boolean;
  passiveIds?: readonly ItemPassiveId[] | readonly string[] | null;
  /** Pool ids after region/weapon/passive supersede filters. */
  availableIds: readonly string[];
}): string[] {
  const available = new Set(opts.availableIds);
  const passives = new Set((opts.passiveIds ?? []).map(String));
  const deny: string[] = [];
  const preferGreater = preferGreaterUltTwin(opts.plantedFeet);

  for (const [base, upgrade] of SOFT_TWINS) {
    if (!available.has(base) || !available.has(upgrade)) continue;

    // Igneous upgrades: gate on style-relevant passives when present on the upgrade path.
    if (upgrade.endsWith("_igneous")) {
      const igneousPassive =
        upgrade === "overpower_igneous"
          ? "igneous-overpower"
          : upgrade === "deadshot_igneous"
            ? "igneous-deadshot"
            : upgrade === "omnipower_igneous"
              ? "igneous-omnipower"
              : upgrade === "death_skulls_igneous"
                ? "igneous-death-skulls"
                : null;
      if (igneousPassive && passives.has(igneousPassive)) {
        deny.push(base);
      } else {
        deny.push(upgrade);
      }
      continue;
    }

    // Sunshine / Death's Swiftness.
    deny.push(preferGreater ? base : upgrade);
  }

  return deny;
}

/** Preferred required ability candidates (first present in pool wins per row). */
const STYLE_REQUIRED_CANDIDATES: Record<CombatStyle, readonly (readonly string[])[]> = {
  melee: [["berserk"]],
  necromancy: [["conjure_undead_army"], ["finger_of_death"], ["touch_of_death"]],
  ranged: [
    ["deaths_swiftness", "greater_deaths_swiftness"],
    ["imbue_shadows"],
  ],
  magic: [["sunshine", "greater_sunshine"]],
};

/**
 * Required ability ids for this style that are present in the pool.
 * Empty when a required family is unavailable (do not invent unlocks).
 */
export function styleRequiredAbilityIds(
  style: CombatStyle,
  availableIds: readonly string[],
): string[] {
  const available = new Set(availableIds);
  const out: string[] = [];
  for (const candidates of STYLE_REQUIRED_CANDIDATES[style] ?? []) {
    const hit = candidates.find((id) => available.has(id));
    if (hit) out.push(hit);
  }
  return out;
}

/**
 * Ensure required ids appear on the bar (prepend missing).
 * When maxLen is set, keep all required first, then fill remaining slots from bar.
 */
export function ensureRequiredAbilityIds(
  bar: readonly string[],
  required: readonly string[],
  maxLen?: number,
): string[] {
  if (required.length === 0) {
    return maxLen != null && bar.length > maxLen ? bar.slice(0, maxLen) : [...bar];
  }
  const have = new Set(bar);
  const missing = required.filter((id) => !have.has(id));
  const merged = missing.length === 0 ? [...bar] : [...missing, ...bar];
  // Dedupe while preserving order.
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of merged) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  if (maxLen == null || out.length <= maxLen) return out;
  // Prefer required family; fill with original bar order.
  const keep: string[] = [];
  const keepSet = new Set<string>();
  for (const id of required) {
    if (keep.length >= maxLen) break;
    if (!seen.has(id) || keepSet.has(id)) continue;
    keep.push(id);
    keepSet.add(id);
  }
  for (const id of out) {
    if (keep.length >= maxLen) break;
    if (keepSet.has(id)) continue;
    keep.push(id);
    keepSet.add(id);
  }
  return keep;
}

/** True when bar contains every required id (or there are none). */
export function barHasRequiredAbilities(
  bar: readonly string[],
  required: readonly string[],
): boolean {
  if (required.length === 0) return true;
  const have = new Set(bar);
  return required.every((id) => have.has(id));
}
