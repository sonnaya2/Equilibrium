import type { AbilitySpec } from "../pipeline/calculateAbility";
import { abilityById } from "./index";
import type { AbilityRecord, RevolutionBarRecord } from "./records";

/**
 * Turns a canonical ability record into an engine-consumable spec. Structure comes
 * only from the record's explicit fields — engine specs always take precedence over
 * this adapter, because the engine holds the verified mechanical rules (data-sync).
 */

/** Engine spec ids for record ids that have a verified engine implementation.
 *  adaptive-strike resolves by weapon setup instead (see resolveBarSlot). */
const ENGINE_ID_BY_RECORD_ID: Record<string, string> = {
  "melee:attack": "attack",
  "melee:rend": "rend",
  "melee:dismember": "dismember",
  "melee:slaughter": "slaughter",
  "melee:massacre": "massacre",
  "melee:assault": "assault",
  "melee:overpower": "overpower",
  "melee:berserk": "berserk",
  "ranged:galeshot": "galeshot",
  "ranged:shadow-tendrils": "shadow_tendrils",
  "ranged:deaths-swiftness": "deaths_swiftness",
  "ranged:imbue-shadows": "imbue_shadows",
  "ranged:greater-deaths-swiftness": "greater_deaths_swiftness",
  "magic:magic-attack": "magic_attack",
  "magic:greater-sunshine": "greater_sunshine",
  "magic:combust": "combust",
};

export function specFromRecord(record: AbilityRecord, styleOverride?: AbilitySpec["style"]): AbilitySpec | null {
  if (!record.damagePercent) return null;
  const hits = record.hits ?? 1;
  return {
    id: record.id,
    name: record.name,
    style: record.style === "shared" ? (styleOverride ?? "melee") : record.style,
    category: record.category,
    hits: Array.from({ length: hits }, () => ({
      band: { minPct: record.damagePercent![0], maxPct: record.damagePercent![1] },
    })),
    adrenaline: record.adrenaline
      ? record.adrenaline.kind === "gain"
        ? { gain: record.adrenaline.percent }
        : { cost: record.adrenaline.percent }
      : undefined,
    cooldownSeconds: record.cooldownTicks != null ? record.cooldownTicks * 0.6 : undefined,
  };
}

export type SlotModel = "engine" | "record" | "unmodelled";

export interface ResolvedSlot {
  name: string;
  modelledBy: SlotModel;
  spec: AbilitySpec | null;
}

/** Resolves one bar slot: engine spec first (verified rules), record adapter second
 *  (sourced candidate data), unmodelled last (never invented). Shared-style records
 *  (Sacrifice) take the bar's style. */
export function resolveBarSlot(
  slot: { name: string; abilityId: string | null },
  engineSpecs: ReadonlyMap<string, AbilitySpec>,
  barStyle: AbilitySpec["style"],
  setup?: string,
): ResolvedSlot {
  if (slot.abilityId == null) return { name: slot.name, modelledBy: "unmodelled", spec: null };

  if (slot.abilityId === "melee:adaptive-strike") {
    const engineId = setup === "Two-handed" ? "adaptive_strike_2h" : "adaptive_strike_dw";
    const spec = engineSpecs.get(engineId);
    if (spec) return { name: slot.name, modelledBy: "engine", spec };
  }
  const engineId = ENGINE_ID_BY_RECORD_ID[slot.abilityId] ?? slot.abilityId;
  const engineSpec = engineSpecs.get(engineId);
  if (engineSpec) return { name: slot.name, modelledBy: "engine", spec: engineSpec };

  const record = abilityById(slot.abilityId);
  if (record) {
    const spec = specFromRecord(record, barStyle);
    if (spec) return { name: slot.name, modelledBy: "record", spec };
  }
  return { name: slot.name, modelledBy: "unmodelled", spec: null };
}

/** Resolves a whole bar. */
export function resolveBar(
  bar: RevolutionBarRecord,
  engineSpecs: ReadonlyMap<string, AbilitySpec>,
): ResolvedSlot[] {
  return bar.slots.map((slot) => resolveBarSlot(slot, engineSpecs, bar.style, bar.setup));
}
