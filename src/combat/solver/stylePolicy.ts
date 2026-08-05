/**
 * Style search policy: one ult twin per loadout; required abilities per style.
 * Keeps the optimizer from wasting budget on dual Sunshine / DS / igneous pairs.
 */
import type { CombatStyle } from "../types";
import type { ItemPassiveId } from "../data/records";

/**
 * Base vs upgrade twins that must not both enter the search pool.
 * - Igneous: cape passive (Kal-Ket/Xil/Mej/Mor/Zuk).
 * - Greater Sunshine / Greater DS: ability codex unlock (not Planted Feet).
 */
const ULT_TWINS: readonly {
  base: string;
  upgrade: string;
  /** Passive that enables the igneous upgrade; omit for codex greaters. */
  igneousPassive?: string;
}[] = [
  { base: "sunshine", upgrade: "greater_sunshine" },
  { base: "deaths_swiftness", upgrade: "greater_deaths_swiftness" },
  { base: "overpower", upgrade: "overpower_igneous", igneousPassive: "igneous-overpower" },
  { base: "deadshot", upgrade: "deadshot_igneous", igneousPassive: "igneous-deadshot" },
  { base: "omnipower", upgrade: "omnipower_igneous", igneousPassive: "igneous-omnipower" },
  {
    base: "death_skulls",
    upgrade: "death_skulls_igneous",
    igneousPassive: "igneous-death-skulls",
  },
];

/**
 * Ids to deny so only one twin of each pair remains.
 *
 * Codex greaters (Sunshine / Death's Swiftness): if the greater form is in the
 * pool (unlocked / obtainable for this request), keep greater and deny base.
 * Otherwise keep base. Planted Feet only extends base duration - it does not
 * choose which ability form is unlocked.
 *
 * Igneous: prefer upgrade when its cape passive is live; else base.
 */
export function dualVersionDenyIds(opts: {
  style: CombatStyle;
  passiveIds?: readonly ItemPassiveId[] | readonly string[] | null;
  /** Pool ids after region/weapon/passive supersede filters. */
  availableIds: readonly string[];
}): string[] {
  const available = new Set(opts.availableIds);
  const passives = new Set((opts.passiveIds ?? []).map(String));
  const deny: string[] = [];

  for (const twin of ULT_TWINS) {
    if (!available.has(twin.base) || !available.has(twin.upgrade)) continue;

    if (twin.igneousPassive) {
      if (passives.has(twin.igneousPassive)) deny.push(twin.base);
      else deny.push(twin.upgrade);
      continue;
    }

    // Codex greater: presence of upgrade in pool means codex path is open.
    deny.push(twin.base);
  }

  return deny;
}

/** Preferred required ability candidates (first present in pool wins per row). */
const STYLE_REQUIRED_CANDIDATES: Record<CombatStyle, readonly (readonly string[])[]> = {
  melee: [["berserk"]],
  necromancy: [["conjure_undead_army"], ["finger_of_death"], ["touch_of_death"]],
  ranged: [
    // Prefer codex greater when in pool; dual-deny already leaves one.
    ["greater_deaths_swiftness", "deaths_swiftness"],
    ["imbue_shadows"],
  ],
  magic: [["greater_sunshine", "sunshine"]],
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
