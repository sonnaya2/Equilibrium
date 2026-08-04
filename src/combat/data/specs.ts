import type { AbilitySpec } from "../pipeline/calculateAbility";
import { engineIdForRecord as mapEngineId } from "../abilities/engineMap";
import {
  adaptiveStrikeEngineId,
  weaponConfigurationFromBarSetup,
  type AdaptiveStrikeWeaponConfiguration,
} from "../styles/melee/abilities";
import { abilityById } from "./index";
import type { AbilityRecord, RevolutionBarRecord } from "./records";

/**
 * Bar-slot resolution: engine specs always win over record adapters.
 * Record->engine ids live only in abilities/engineMap.ts.
 */

/** Re-export single map authority for callers/tests. */
export function engineIdForRecord(recordId: string): string | undefined {
  return mapEngineId(recordId);
}

/**
 * Record-derived AbilitySpec only when mechanically complete enough to simulate.
 *
 * Forbidden: multi-hit by repeating the full damage band `hits` times (invents
 * tick offsets, per-hit crit eligibility, DoT classification).
 *
 * Allowed: single-hit records with damagePercent + adrenaline (e.g. shared
 * Sacrifice). Multi-hit / channels / state windows require engine registry.
 */
export function specFromRecord(
  record: AbilityRecord,
  styleOverride?: AbilitySpec["style"],
): AbilitySpec | null {
  if (!record.damagePercent) return null;
  const hitCount = record.hits ?? 1;
  if (hitCount !== 1) return null;
  if (!record.adrenaline) return null;
  if (record.channelTicks != null && record.channelTicks > 1) return null;

  return {
    id: record.id,
    name: record.name,
    style: record.style === "shared" ? (styleOverride ?? "melee") : record.style,
    category: record.category,
    hits: [
      {
        band: { minPct: record.damagePercent[0], maxPct: record.damagePercent[1] },
        critEligible: record.category !== "utility",
      },
    ],
    adrenaline:
      record.adrenaline.kind === "gain"
        ? { gain: record.adrenaline.percent }
        : { cost: record.adrenaline.percent },
    cooldownSeconds: record.cooldownTicks != null ? record.cooldownTicks * 0.6 : undefined,
    supportStatus: "partially-modeled",
    supportNote:
      "Single-hit record adapter only; multi-hit and state windows require engine registry",
  };
}

export type SlotModel = "engine" | "record" | "unmodelled";

export interface ResolvedSlot {
  name: string;
  modelledBy: SlotModel;
  spec: AbilitySpec | null;
}

/**
 * Resolves one bar slot: engine spec first, record adapter only when
 * mechanically complete single-hit, else unmodelled.
 *
 * Adaptive Strike: prefer `weaponConfiguration` from the loadout/sim; fall back
 * to mapped wiki bar setup ("Two-handed" / "Dual wield"). "Any" / missing needs
 * an explicit weaponConfiguration from the caller.
 */
export function resolveBarSlot(
  slot: { name: string; abilityId: string | null },
  engineSpecs: ReadonlyMap<string, AbilitySpec>,
  barStyle: AbilitySpec["style"],
  setup?: string,
  weaponConfiguration?: AdaptiveStrikeWeaponConfiguration,
): ResolvedSlot {
  if (slot.abilityId == null) return { name: slot.name, modelledBy: "unmodelled", spec: null };

  if (slot.abilityId === "melee:adaptive-strike") {
    const config = weaponConfiguration ?? weaponConfigurationFromBarSetup(setup);
    const engineId = adaptiveStrikeEngineId(config);
    if (engineId) {
      const spec = engineSpecs.get(engineId);
      if (spec) return { name: slot.name, modelledBy: "engine", spec };
    }
    return { name: slot.name, modelledBy: "unmodelled", spec: null };
  }
  const engineId = mapEngineId(slot.abilityId) ?? slot.abilityId;
  const engineSpec = engineSpecs.get(engineId);
  if (engineSpec) return { name: slot.name, modelledBy: "engine", spec: engineSpec };

  const record = abilityById(slot.abilityId);
  if (record) {
    const spec = specFromRecord(record, barStyle);
    if (spec) return { name: slot.name, modelledBy: "record", spec };
  }
  return { name: slot.name, modelledBy: "unmodelled", spec: null };
}

/** Resolves a whole bar (all slots - UI shows keybind slots past revolutionSize). */
export function resolveBar(
  bar: RevolutionBarRecord,
  engineSpecs: ReadonlyMap<string, AbilitySpec>,
  weaponConfiguration?: AdaptiveStrikeWeaponConfiguration,
): ResolvedSlot[] {
  return bar.slots.map((slot) =>
    resolveBarSlot(slot, engineSpecs, bar.style, bar.setup, weaponConfiguration),
  );
}

/** Wiki hybrid bars list keybind slots past revolutionSize; only the prefix is auto-fired. */
export function revoManagedSlots(
  bar: RevolutionBarRecord,
  engineSpecs: ReadonlyMap<string, AbilitySpec>,
  weaponConfiguration?: AdaptiveStrikeWeaponConfiguration,
): ResolvedSlot[] {
  return resolveBar(bar, engineSpecs, weaponConfiguration).slice(0, bar.revolutionSize);
}
