import type { AbilitySpec } from "../pipeline/calculateAbility";
import { abilityById } from "./index";
import type { AbilityRecord, RevolutionBarRecord } from "./records";

/**
 * Turns a canonical ability record into an engine-consumable spec. Structure comes
 * only from the record's explicit fields — engine specs always take precedence over
 * this adapter, because the engine holds the verified mechanical rules (data-sync).
 */

/**
 * Record id -> engine AbilitySpec id for every calculable entry in
 * MELEE_ABILITIES / RANGED_ABILITIES / MAGIC_ABILITIES / NECROMANCY_ABILITIES
 * (plus volley factory). adaptive-strike resolves by weapon setup (see resolveBarSlot).
 *
 * Only AbilitySpec ids — never MELEE_EFFECTS / RANGED_EFFECTS / MAGIC_EFFECTS notes
 * that are prose-only (e.g. flurry_bloodlust, ricochet_aoe).
 */
const ENGINE_ID_BY_RECORD_ID: Record<string, string> = {
  // Melee
  "melee:attack": "attack",
  "melee:rend": "rend",
  "melee:fury": "fury",
  "melee:greater-fury": "greater_fury",
  "melee:backhand": "backhand",
  "melee:punish": "punish",
  "melee:barge": "barge",
  "melee:greater-barge": "greater_barge",
  "melee:dismember": "dismember",
  "melee:slaughter": "slaughter",
  "melee:massacre": "massacre",
  "melee:assault": "assault",
  "melee:flurry": "flurry",
  "melee:greater-flurry": "greater_flurry",
  "melee:hurricane": "hurricane",
  "melee:overpower": "overpower",
  "melee:pulverise": "pulverise",
  "melee:berserk": "berserk",
  "melee:meteor-strike": "meteor_strike",
  "melee:chaos-roar": "chaos_roar",
  // Ranged
  "ranged:attack": "ranged_attack",
  "ranged:piercing-shot": "piercing_shot",
  "ranged:binding-shot": "binding_shot",
  "ranged:galeshot": "galeshot",
  "ranged:ricochet": "ricochet",
  "ranged:greater-ricochet": "greater_ricochet",
  "ranged:snap-shot": "snap_shot",
  "ranged:snipe": "snipe",
  "ranged:bombardment": "bombardment",
  "ranged:rapid-fire": "rapid_fire",
  "ranged:corruption-shot": "corruption_shot",
  "ranged:shadow-tendrils": "shadow_tendrils",
  "ranged:imbue-shadows": "imbue_shadows",
  "ranged:deadshot": "deadshot",
  "ranged:deadshot-igneous": "deadshot_igneous",
  "ranged:deaths-swiftness": "deaths_swiftness",
  "ranged:greater-deaths-swiftness": "greater_deaths_swiftness",
  // Magic
  "magic:magic-attack": "magic_attack",
  "magic:sonic-wave": "sonic_wave",
  "magic:greater-sonic-wave": "greater_sonic_wave",
  "magic:dragon-breath": "dragon_breath",
  "magic:impact": "impact",
  "magic:combust": "combust",
  "magic:chain": "chain",
  "magic:greater-chain": "greater_chain",
  "magic:concentrated-blast": "concentrated_blast",
  "magic:greater-concentrated-blast": "greater_concentrated_blast",
  "magic:wild-magic": "wild_magic",
  "magic:asphyxiate": "asphyxiate",
  "magic:asphyxiate-resplendence": "asphyxiate_resplendence",
  "magic:omnipower-igneous": "omnipower_igneous",
  "magic:dragon-breath-empowered": "dragon_breath_empowered",
  "magic:corruption-blast": "corruption_blast",
  "magic:smoke-tendrils": "smoke_tendrils",
  "magic:magma-tempest": "magma_tempest",
  "magic:omnipower": "omnipower",
  "magic:sunshine": "sunshine",
  "magic:greater-sunshine": "greater_sunshine",
  "magic:tsunami": "tsunami",
  "magic:runic-charge": "runic_charge",
  "magic:instability": "instability",
  "magic:claws-of-guthix": "claws_of_guthix",
  // Necromancy
  "necromancy:necromancy": "necromancy_basic",
  "necromancy:soul-sap": "soul_sap",
  "necromancy:touch-of-death": "touch_of_death",
  "necromancy:finger-of-death": "finger_of_death",
  "necromancy:death-skulls": "death_skulls",
  "necromancy:soul-strike": "soul_strike",
  "necromancy:spectral-scythe": "spectral_scythe",
  "necromancy:bloat": "bloat",
  "necromancy:living-death": "living_death",
  "necromancy:volley-of-souls": "volley_of_souls",
  "necromancy:blood-siphon": "blood_siphon",
  "necromancy:command-skeleton-warrior": "command_skeleton_warrior",
  "necromancy:command-putrid-zombie": "command_putrid_zombie",
  "necromancy:command-phantom-guardian": "command_phantom_guardian",
  "necromancy:death-grasp": "death_grasp",
};

/** Test/helper: record id -> engine id when mapped, else undefined. */
export function engineIdForRecord(recordId: string): string | undefined {
  return ENGINE_ID_BY_RECORD_ID[recordId];
}

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

/** Resolves a whole bar (all slots — UI shows keybind slots past revolutionSize). */
export function resolveBar(
  bar: RevolutionBarRecord,
  engineSpecs: ReadonlyMap<string, AbilitySpec>,
): ResolvedSlot[] {
  return bar.slots.map((slot) => resolveBarSlot(slot, engineSpecs, bar.style, bar.setup));
}

/** Wiki hybrid bars list keybind slots past revolutionSize; only the prefix is auto-fired. */
export function revoManagedSlots(
  bar: RevolutionBarRecord,
  engineSpecs: ReadonlyMap<string, AbilitySpec>,
): ResolvedSlot[] {
  return resolveBar(bar, engineSpecs).slice(0, bar.revolutionSize);
}
