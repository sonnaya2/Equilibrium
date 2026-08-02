import type { AbilityAvailabilityKind, RegionRequirementMode, UnlockType } from "./records";

export type AbilityAvailability = AbilityAvailabilityKind;
export type { RegionRequirementMode };

/** Minimal unlock shape — regions are plain strings so callers need not import RegionId. */
export type UnlockLike = {
  type?: UnlockType | (string & {});
  regions?: readonly string[];
  requirement?: string;
  availability?: AbilityAvailabilityKind;
  regionMode?: RegionRequirementMode;
};

/** Empty regions is unknown unless type is level (base skill unlocks are global). */
export function resolveAvailability(unlock: UnlockLike | null | undefined): AbilityAvailability {
  if (unlock == null) return "unknown";
  if (unlock.type === "removed") return "removed";
  if (unlock.availability) return unlock.availability;
  if ((unlock.regions?.length ?? 0) > 0) return "regional";
  if (unlock.type === "level") return "global";
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

