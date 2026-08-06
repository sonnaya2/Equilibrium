/**
 * Single-ability Analysis via one-cast simulate() on ResolvedCombatModel.
 * Parity by construction with Manual/Revo/solver shared base (not castModifiersFor SSOT).
 */
import { resolveAbilityCatalogue } from "../abilities/catalogue";
import type { ResolvedAbilityCatalogue } from "../abilities/catalogue";
import { simulate } from "../engine/simulation/simulate";
import { rotationOf } from "../engine/simulation/contracts";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { HitResult } from "../pipeline/calculateHit";
import {
  netAdrenalineDeltaFromTransaction,
  previewAdrenalineTransaction,
  type AdrenalineTransaction,
} from "../shared/adrenalineTransaction";
import { hasPassive } from "../shared/equipment";
import { COMMAND_REQUIRES_CONJURE } from "../styles/necromancy/conjures";
import { isMeleeAbility } from "../styles/melee/abilities";
import type { HostCombatResolveInput, ResolvedCombatModel } from "./contracts";
import { buildResolvedCombatModel } from "./resolve";
import { buildSimulationInputBase, toManualSimulateInput } from "./simulationBase";

export type StatefulLimitationId =
  | "active_bleed_count"
  | "primordial_ice_stacks"
  | "previous_channel_stacks"
  | "live_berserk_sunshine_window"
  | "conjure_already_active"
  | "target_debuff_from_earlier_cast"
  | "residual_souls"
  | "bloodlust_stacks"
  | "spectral_scythe_sequence";

export interface StatefulLimitation {
  readonly id: StatefulLimitationId | string;
  readonly label: string;
  readonly abilityIds?: readonly string[];
  readonly detail?: string;
}

export type AnalysisParity = "full" | "limited";

export interface AnalysisStatLine {
  readonly base: number;
  readonly level: number;
  /** Damage Potential 0..1. */
  readonly accuracy: number;
  /** Crit chance 0..1 absolute. */
  readonly critChance: number;
}

export interface SingleCastAnalysisOptions {
  /** Explicit Analysis control for Volley - not a hidden default. */
  readonly residualSouls?: number;
  readonly catalogue?: ResolvedAbilityCatalogue;
  /** e.g. volleyOfSouls(n) when the catalogue base entry is a placeholder. */
  readonly abilityOverlay?: AbilitySpec;
}

export interface SingleCastAnalysis {
  readonly abilityId: string;
  readonly abilityName: string;
  readonly min: number;
  readonly max: number;
  readonly expected: number;
  readonly criticalContribution: number;
  readonly capLoss: number;
  readonly adrenalineTransaction: AdrenalineTransaction | null;
  readonly adrenalineDelta: number;
  readonly statefulLimitations: readonly StatefulLimitation[];
  readonly parity: AnalysisParity;
  readonly ok: boolean;
  readonly error?: string;
  readonly hits: readonly HitResult[];
  readonly damagePotential: number;
}

/** Project model -> host input; optional line overrides base/level/accuracy/crit only. */
export function hostInputFromResolvedModel(
  model: ResolvedCombatModel,
  line?: AnalysisStatLine,
): HostCombatResolveInput {
  const src = model.modifierSources;
  const base = line ? Math.max(0, line.base) : model.base;
  const level = line ? Math.min(Math.max(1, line.level), 145) : model.level;
  const accuracy = line ? Math.min(Math.max(0, line.accuracy), 1) : model.accuracy;
  const critChance = line ? Math.min(Math.max(0, line.critChance), 1) : model.crit.chance;
  return {
    style: model.style,
    base,
    level,
    accuracy,
    crit: {
      chance: critChance,
      disabled: model.crit.disabled,
      damageBonus: model.crit.damageBonus,
    },
    adrenaline: model.adrenaline,
    procs: model.procs,
    plantedFeet: model.plantedFeet,
    strengthCape99: model.strengthCape99,
    preciseRank: model.preciseRank,
    conjureBasicDamageMult: model.conjureBasicDamageMult,
    conjureDurationMult: model.conjureDurationMult,
    tumekensPieces: model.tumekensPieces,
    tumekensCritEnabled: model.tumekensCritEnabled,
    equipmentEffects: model.equipmentEffects,
    league: model.league,
    context: model.context,
    targetHpPercent: model.target.hpPercent,
    cap: model.cap,
    startingAdrenaline: model.startingAdrenaline,
    equipmentIds: model.equipmentIds,
    weaponConfiguration: model.weaponConfiguration,
    setCounts: src.setCounts,
    vulnerability: src.vulnerability,
    styleCurseId: src.styleCurseId,
    amZiFlatDamage: src.amZiFlatDamage,
    amHejDamageBonus: src.amHejDamageBonus,
    slayer: src.slayer,
    target: {
      demon: src.target.demon,
      dragon: src.target.dragon,
      undead: src.target.undead,
    },
    slayerHelmet: src.slayerHelmet,
    salve: src.salve,
    ultimatums: src.ultimatums,
    lunging: src.lunging,
    berserkersFuryBonus: src.berserkersFuryBonus,
    diagnostics: model.diagnostics,
  };
}

/** Clone model with only base / level / accuracy / crit.chance replaced. */
export function overlayAnalysisStatLine(
  model: ResolvedCombatModel,
  line: AnalysisStatLine,
): ResolvedCombatModel {
  return buildResolvedCombatModel(hostInputFromResolvedModel(model, line));
}

/**
 * Prerequisites Analysis cannot invent at empty start.
 * Does not flag every basic for inactive Berserk / Sunshine.
 */
export function classifyStatefulLimitations(
  ability: AbilitySpec,
  model: ResolvedCombatModel,
  options: SingleCastAnalysisOptions = {},
): StatefulLimitation[] {
  const out: StatefulLimitation[] = [];

  if (hasPassive(model.equipmentEffects, "champion-ring")) {
    out.push({
      id: "active_bleed_count",
      label: "Active bleed count (Champion's ring)",
      detail: "Ring crit scales with bleeds already on the target; Analysis starts at zero bleeds.",
    });
  }

  if (ability.id === "icy_tempest") {
    out.push({
      id: "primordial_ice_stacks",
      label: "Primordial Ice stacks",
      abilityIds: ["icy_tempest"],
      detail: "Icy Tempest spend and hit scale need Leng stacks from earlier casts.",
    });
  }

  if (
    hasPassive(model.equipmentEffects, "channeller-ring") &&
    ability.style === "magic" &&
    ability.channelTicks != null
  ) {
    out.push({
      id: "previous_channel_stacks",
      label: "Prior channel stacks (Channeller's ring)",
      abilityIds: [ability.id],
      detail: "Per-hit crit steps assume carry from a prior magic channel; Analysis has none.",
    });
  }

  if (isMeleeAbility(ability)) {
    if (ability.bloodlustScale || ability.bloodlustExtraHits || ability.bloodlustMissingHp) {
      out.push({
        id: "bloodlust_stacks",
        label: "Bloodlust stacks",
        abilityIds: [ability.id],
        detail: "Empowered band / extra hits need Bloodlust stacks; Analysis starts at 0.",
      });
    }
    if (ability.recastOf) {
      out.push({
        id: "target_debuff_from_earlier_cast",
        label: `Bleed chain (${ability.recastOf})`,
        abilityIds: [ability.id],
        detail: `${ability.name} needs a live ${ability.recastOf} recast window.`,
      });
    }
  }

  if (COMMAND_REQUIRES_CONJURE[ability.id]) {
    out.push({
      id: "conjure_already_active",
      label: "Active conjure required",
      abilityIds: [ability.id],
      detail: "Command abilities need their spirit already summoned.",
    });
  }

  if (ability.id === "volley_of_souls" && options.residualSouls === undefined) {
    out.push({
      id: "residual_souls",
      label: "Residual souls",
      abilityIds: ["volley_of_souls"],
      detail: "Volley needs residual souls set explicitly; Analysis does not invent them.",
    });
  }

  if (ability.id === "spectral_scythe_2" || ability.id === "spectral_scythe_3") {
    out.push({
      id: "spectral_scythe_sequence",
      label: "Spectral Scythe sequence",
      abilityIds: [ability.id],
      detail: "Stage 2/3 needs a live prior stage window.",
    });
  }

  return out;
}

function badSupportStatus(ability: AbilitySpec): boolean {
  const s = ability.supportStatus;
  return s === "partially-modeled" || s === "not-modeled" || s === "mechanics-unverified";
}

/**
 * One-cast natural-completion simulate on the shared model path.
 * Never invents damage when the cast fails; labels stateful gaps instead.
 */
export function analyzeSingleCast(
  model: ResolvedCombatModel,
  ability: AbilitySpec,
  options: SingleCastAnalysisOptions = {},
): SingleCastAnalysis {
  const limitations = classifyStatefulLimitations(ability, model, options);

  const catalogue =
    options.catalogue ??
    resolveAbilityCatalogue({
      strengthCape99: model.strengthCape99,
      overlays: options.abilityOverlay ? [options.abilityOverlay] : undefined,
    });
  const resolvedAbility = catalogue.byId.get(ability.id) ?? ability;

  const base = buildSimulationInputBase(model, catalogue);
  const simInput = {
    ...toManualSimulateInput(base, {
      rotation: rotationOf(resolvedAbility.id),
      autoWeave: false,
    }),
    ...(options.residualSouls != null ? { startingResidualSouls: options.residualSouls } : {}),
  };

  let summary;
  try {
    summary = simulate(simInput);
  } catch (err) {
    const preview = previewAdrenalineTransaction(resolvedAbility, model.adrenaline);
    return {
      abilityId: resolvedAbility.id,
      abilityName: resolvedAbility.name,
      min: 0,
      max: 0,
      expected: 0,
      criticalContribution: 0,
      capLoss: 0,
      adrenalineTransaction: preview,
      adrenalineDelta: netAdrenalineDeltaFromTransaction(preview),
      statefulLimitations: limitations,
      parity: "limited",
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      hits: [],
      damagePotential: model.accuracy,
    };
  }

  const cast = summary.casts.find((c) => c.auto !== true) ?? summary.casts[0];
  const preview = previewAdrenalineTransaction(resolvedAbility, model.adrenaline);
  const adrenTx = cast?.adrenalineTransaction ?? (summary.ok ? null : preview);
  const adrenDelta =
    cast?.result.adrenalineDelta ??
    (cast != null
      ? cast.adrenalineAfter - cast.adrenalineBefore
      : netAdrenalineDeltaFromTransaction(preview));

  const ok = summary.ok === true && cast != null;
  const hits = ok ? cast.result.hits : [];
  const min = ok ? summary.damage.supportMinDamage : 0;
  const max = ok ? summary.damage.supportMaxDamage : 0;
  const expected = ok ? summary.damage.expectedDamage : 0;
  const criticalContribution = ok ? summary.analysis.criticalContribution : 0;
  const capLoss = ok ? summary.analysis.capLoss : 0;
  const damagePotential = hits[0]?.potential ?? model.accuracy;

  const parity: AnalysisParity =
    limitations.length === 0 && ok && !badSupportStatus(resolvedAbility) ? "full" : "limited";

  return {
    abilityId: resolvedAbility.id,
    abilityName: resolvedAbility.name,
    min,
    max,
    expected,
    criticalContribution,
    capLoss,
    adrenalineTransaction: adrenTx,
    adrenalineDelta: adrenDelta,
    statefulLimitations: limitations,
    parity,
    ok,
    error: summary.error ?? (ok ? undefined : (summary.error ?? "cast failed")),
    hits,
    damagePotential,
  };
}
