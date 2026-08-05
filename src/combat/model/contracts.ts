/**
 * Immutable combat-domain model: everything fixed before tick zero.
 * No React, no Loadout UI type, no function properties, no Maps.
 */
import type { ActiveEquipmentEffects } from "../shared/equipment";
import type { AdrenalineRules, ProcRules } from "../engine/simulation/contracts";
import type { HitCapRule } from "../core/hitCaps";
import type { CombatContext, CombatStyle } from "../types";
import type {
  SerializableLeagueRules,
  SerializableModifierSources,
  SerializableRevolutionSimBase,
} from "../solver/worker/serializable";
import type { ResolvedCombatDiagnostics } from "./diagnostics";

/** Static crit layers for sim (no per-hit eligibility). */
export interface ResolvedCritInput {
  readonly chance: number;
  readonly disabled?: boolean;
  readonly damageBonus?: number;
}

/**
 * Explicit modifier truth — same wire shape as SerializableModifierSources.
 * setCounts are tuple pairs (no Map).
 */
export type ResolvedModifierSources = SerializableModifierSources;

/** Target race / HP scenario frozen for race slayers and HP-gated mechanics. */
export interface ResolvedTargetScenario {
  readonly hpPercent?: number;
  readonly demon?: boolean;
  readonly dragon?: boolean;
  readonly undead?: boolean;
}

export type ResolvedWeaponConfiguration =
  SerializableRevolutionSimBase["weaponConfiguration"];

/**
 * One immutable combat representation beneath the UI presentation layer.
 * Modifier behavior is reconstructed from modifierSources (never an opaque closure).
 */
export interface ResolvedCombatModel {
  readonly style: CombatStyle;

  readonly base: number;
  readonly level: number;
  /** Base AD while temporary level override is active (Naragi 255). */
  readonly overrideBase?: number;
  readonly overrideLevel?: number;
  /** Damage Potential 0..1 (sim / pack accuracy). */
  readonly accuracy: number;
  readonly crit: ResolvedCritInput;

  readonly equipmentIds: readonly string[];
  readonly equipmentEffects: ActiveEquipmentEffects;
  readonly weaponConfiguration: ResolvedWeaponConfiguration;

  readonly modifierSources: ResolvedModifierSources;
  readonly adrenaline: AdrenalineRules;
  readonly procs: ProcRules;

  readonly plantedFeet: boolean;
  readonly strengthCape99: boolean;
  readonly preciseRank: number;
  /**
   * Style ammo (deathspore / splintering). Derived from equipment when unset
   * on host input; explicit override wins.
   */
  readonly ammo?: "deathspore" | "splintering";
  /** Caroming rank 1-4 (0 = off). */
  readonly caromingRank: number;

  readonly conjureBasicDamageMult: number;
  readonly conjureDurationMult: number;
  readonly tumekensPieces: number;
  readonly tumekensCritEnabled: boolean;

  readonly target: ResolvedTargetScenario;
  /** Serializable league freeze (arrays, not Sets). */
  readonly league: SerializableLeagueRules;
  readonly context: CombatContext;
  readonly cap: HitCapRule;
  readonly startingAdrenaline: number;

  readonly diagnostics: ResolvedCombatDiagnostics;
}

/**
 * Domain-neutral host input (not Loadout). Filled by the UI adapter after stages.
 * Mirrors SolverPackSnapshot plus style and diagnostics fields.
 */
export interface HostCombatResolveInput {
  readonly style: CombatStyle;
  readonly base: number;
  readonly level: number;
  readonly overrideBase?: number;
  readonly overrideLevel?: number;
  readonly accuracy: number;
  readonly crit: ResolvedCritInput;
  readonly adrenaline?: AdrenalineRules;
  readonly procs?: ProcRules;
  readonly plantedFeet?: boolean;
  readonly strengthCape99?: boolean;
  readonly preciseRank?: number;
  readonly ammo?: "deathspore" | "splintering";
  readonly caromingRank?: number;
  readonly conjureBasicDamageMult?: number;
  readonly conjureDurationMult?: number;
  readonly tumekensPieces?: number;
  readonly tumekensCritEnabled?: boolean;
  readonly equipmentEffects: ActiveEquipmentEffects;
  readonly league: SerializableLeagueRules;
  readonly context?: CombatContext;
  readonly targetHpPercent?: number;
  readonly cap?: HitCapRule;
  readonly startingAdrenaline?: number;
  readonly equipmentIds: readonly string[];
  readonly weaponConfiguration: ResolvedWeaponConfiguration;
  /** Slot map used to derive set piece counts when setCounts is omitted. */
  readonly equipmentSlots?: Partial<Record<string, string | null>>;
  readonly vulnerability?: boolean;
  readonly styleCurseId?: string | "none";
  readonly amZiFlatDamage?: number;
  readonly amHejDamageBonus?: number;
  readonly slayer?: { demon: number; dragon: number; undead: number };
  readonly target?: { demon?: boolean; dragon?: boolean; undead?: boolean };
  readonly slayerHelmet?: SerializableModifierSources["slayerHelmet"];
  readonly salve?: SerializableModifierSources["salve"];
  readonly ultimatums?: number;
  readonly lunging?: number;
  readonly caroming?: number;
  readonly berserkersFuryBonus?: number;
  readonly setCounts?: readonly (readonly [string, number])[];
  readonly diagnostics: ResolvedCombatDiagnostics;
}
