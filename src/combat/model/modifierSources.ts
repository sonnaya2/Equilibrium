/**
 * Explicit modifier-source assembly for ResolvedCombatModel.
 * Host resolves descriptors once; workers revive from these sources only.
 */
import { equippedSetCounts } from "../shared/equipment";
import {
  emptyModifierSources,
  type SerializableModifierSources,
} from "../solver/worker/serializable";
import type { HostCombatResolveInput, ResolvedModifierSources } from "./contracts";

export { emptyModifierSources };

/** Subset of host input needed to build modifier sources. */
export type ModifierSourcesHostInput = Pick<
  HostCombatResolveInput,
  | "setCounts"
  | "equipmentSlots"
  | "equipmentIds"
  | "vulnerability"
  | "styleCurseId"
  | "amZiFlatDamage"
  | "amHejDamageBonus"
  | "slayer"
  | "target"
  | "slayerHelmet"
  | "salve"
  | "ultimatums"
  | "lunging"
  | "caroming"
  | "berserkersFuryBonus"
>;

/** Build set-count pairs (precomputed or derived once). No Map on the wire. */
export function resolveSetCounts(
  input: Pick<ModifierSourcesHostInput, "setCounts" | "equipmentSlots" | "equipmentIds">,
): readonly (readonly [string, number])[] {
  if (input.setCounts != null) return [...input.setCounts];
  return [
    ...equippedSetCounts({
      equipmentSlots: input.equipmentSlots,
      equipmentIds: [...input.equipmentIds],
    }).entries(),
  ].map(([setId, pieces]) => [setId, pieces] as const);
}

/**
 * Canonical modifier-source assembly. Called once at model build; worker only
 * revives from the result.
 */
export function resolveModifierSourcesFromHost(
  input: ModifierSourcesHostInput,
): ResolvedModifierSources {
  const setCounts = resolveSetCounts(input);
  const fury =
    typeof input.berserkersFuryBonus === "number" &&
    Number.isFinite(input.berserkersFuryBonus) &&
    input.berserkersFuryBonus > 0
      ? input.berserkersFuryBonus
      : 0;

  return {
    ...emptyModifierSources(),
    vulnerability: input.vulnerability === true,
    styleCurseId: input.styleCurseId ?? "none",
    amZiFlatDamage: input.amZiFlatDamage ?? 0,
    amHejDamageBonus: input.amHejDamageBonus ?? 0,
    setCounts,
    slayer: {
      demon: input.slayer?.demon ?? 0,
      dragon: input.slayer?.dragon ?? 0,
      undead: input.slayer?.undead ?? 0,
    },
    target: {
      demon: input.target?.demon,
      dragon: input.target?.dragon,
      undead: input.target?.undead,
    },
    // Pre-resolved on host (includes region gate for stand). Never re-resolve.
    slayerHelmet: input.slayerHelmet ?? null,
    salve: input.salve ?? null,
    ultimatums: input.ultimatums ?? 0,
    lunging: input.lunging ?? 0,
    caroming: input.caroming ?? 0,
    berserkersFuryBonus: fury,
  };
}

/** Type alias for callers that already hold SerializableModifierSources. */
export type { SerializableModifierSources };
