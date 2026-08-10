import type { AbilityAvailabilityKind, RegionRequirementMode, UnlockType } from "./records";

export type AbilityAvailability = AbilityAvailabilityKind;
export type { RegionRequirementMode };

/** Minimal unlock shape - regions are plain strings so callers need not import RegionId. */
export type UnlockLike = {
  type?: UnlockType | (string & {});
  regions?: readonly string[];
  requirement?: string;
  availability?: AbilityAvailabilityKind;
  regionMode?: RegionRequirementMode;
};

/**
 * Empty regions:
 * - level → global (base skill unlocks)
 * - equipment / drop / activity / shop / ability → global for region obtainability
 *   (gated by gear, passives, or cast state - not league region stamps)
 * - codex / quest with no stamp → unknown (Limit-to-regions denies until stamped)
 */
const NON_REGIONAL_EMPTY_TYPES = new Set([
  "level",
  "equipment",
  "drop",
  "activity",
  "shop",
  "ability",
]);

export function resolveAvailability(unlock: UnlockLike | null | undefined): AbilityAvailability {
  if (unlock == null) return "unknown";
  if (unlock.type === "removed") return "removed";
  if (unlock.availability) return unlock.availability;
  if ((unlock.regions?.length ?? 0) > 0) return "regional";
  if (unlock.type != null && NON_REGIONAL_EMPTY_TYPES.has(String(unlock.type))) {
    return "global";
  }
  return "unknown";
}

export function resolveRegionMode(unlock: UnlockLike | null | undefined): RegionRequirementMode {
  return unlock?.regionMode ?? "any";
}

export function isObtainableInRegions(
  unlock: UnlockLike | null | undefined,
  unlockedRegions: readonly string[],
  options?: { includeUnknown?: boolean },
): { obtainable: boolean; availability: AbilityAvailability; reason?: string } {
  const availability = resolveAvailability(unlock);
  if (availability === "global") {
    return { obtainable: true, availability };
  }
  if (availability === "removed") {
    return { obtainable: false, availability, reason: "removed" };
  }
  if (availability === "unknown") {
    if (options?.includeUnknown) return { obtainable: true, availability };
    // No unlock row at all (engine-only / unmapped): do not region-deny.
    // Other cast gates (weapon, passive, special) still apply.
    if (unlock == null) {
      return { obtainable: true, availability, reason: "no-unlock-metadata" };
    }
    return { obtainable: false, availability, reason: "unknown-availability" };
  }
  // regional
  const required = unlock?.regions ?? [];
  const unlocked = new Set(unlockedRegions);
  const mode = resolveRegionMode(unlock);
  if (mode === "all") {
    const ok = required.every((r) => unlocked.has(r));
    return ok
      ? { obtainable: true, availability }
      : { obtainable: false, availability, reason: "missing-regions-all" };
  }
  const ok = required.some((r) => unlocked.has(r));
  return ok
    ? { obtainable: true, availability }
    : { obtainable: false, availability, reason: "missing-regions-any" };
}

