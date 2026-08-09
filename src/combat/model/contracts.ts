/**
 * Immutable combat-domain model: everything fixed before tick zero.
 * No React, no Loadout UI type, no function properties, no Maps.
 */
import type { ActiveEquipmentEffects } from "../shared/equipment";
import type {
  AdrenalineRules,
  PlayerVitalityInput,
  ProcRules,
} from "../engine/simulation/contracts";
import type { HitCapRule } from "../core/hitCaps";
import type { CombatContext, CombatStyle } from "../types";
import type {
  SerializableLeagueRules,
  SerializableModifierSources,
  SerializableRevolutionSimBase,
} from "../solver/worker/serializable";
import type { ResolvedCombatDiagnostics } from "./diagnostics";
import type { PlayerPoisonProfile } from "../poison/mechanics";
import type { ResolvedRangedAmmunitionProfile } from "../styles/ranged/ammunitionProfile";
import type { EnchantedBoltChanceModifiers } from "../styles/ranged/enchantedBolt";
import type { ResolvedTargetAccuracyProfile } from "../target/genericTarget";

/** Static crit layers for sim (no per-hit eligibility). */
export interface ResolvedCritInput {
  readonly chance: number;
  readonly disabled?: boolean;
  readonly damageBonus?: number;
  readonly critualConvertedDamageBonus?: number;
}

/**
 * Explicit modifier truth with the same wire shape as SerializableModifierSources.
 * setCounts are tuple pairs (no Map).
 */
export type ResolvedModifierSources = SerializableModifierSources;

/** Target race / HP scenario frozen for race slayers and HP-gated mechanics. */
export interface ResolvedTargetScenario {
  readonly hpPercent?: number;
  readonly maximumLifePoints?: number;
  readonly demon?: boolean;
  readonly dragon?: boolean;
  readonly undead?: boolean;
  readonly poisonImmune?: boolean;
  readonly elementalWeakness?: "water" | "fire" | "other" | "unknown";
  readonly dragonfireImmune?: boolean;
}

export type ResolvedWeaponConfiguration = SerializableRevolutionSimBase["weaponConfiguration"];

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
  /** Activate Sliver of Edicts at combat start (Rotation toggle). */
  readonly activateNaragiAtStart?: boolean;
  /** Damage Potential 0..1 (sim / pack accuracy). */
  readonly accuracy: number;
  /** Host-resolved target facts; absent keeps the legacy accuracy fallback. */
  readonly targetAccuracyProfile?: ResolvedTargetAccuracyProfile;
  readonly crit: ResolvedCritInput;

  readonly equipmentIds: readonly string[];
  readonly equipmentEffects: ActiveEquipmentEffects;
  readonly weaponConfiguration: ResolvedWeaponConfiguration;
  readonly nativeSpecialPolicy: {
    readonly useEquippedWeaponSpecial: boolean;
    readonly afterAbilityId?: string | null;
  };
  /**
   * EoF stored special ability id. Required with Essence of Finality for
   * requiresSpecialAccess weapon specials.
   */
  readonly eofStoredSpecialId?: string | null;

  readonly modifierSources: ResolvedModifierSources;
  readonly adrenaline: AdrenalineRules;
  readonly procs: ProcRules;

  readonly plantedFeet: boolean;
  readonly strengthCape99: boolean;
  readonly preciseRank: number;
  readonly ammunition: ResolvedRangedAmmunitionProfile | null;
  readonly enchantedBoltChanceModifiers: EnchantedBoltChanceModifiers;
  /** Caroming rank 1-4 (0 = off). */
  readonly caromingRank: number;

  readonly conjureBasicDamageMult: number;
  readonly conjureDurationMult: number;
  readonly tumekensPieces: number;

  readonly target: ResolvedTargetScenario;
  readonly playerVitality?: PlayerVitalityInput;
  readonly playerPoison: PlayerPoisonProfile;
  /** Serializable league freeze (arrays, not Sets). */
  readonly league: SerializableLeagueRules;
  readonly context: CombatContext;
  readonly cap: HitCapRule;
  readonly startingAdrenaline: number;
  readonly naturalInstinctUntilTick?: number;
  readonly startingResidualSouls?: number;
  readonly slayerOnTask?: boolean;
  readonly slayerLevel?: number;

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
  readonly activateNaragiAtStart?: boolean;
  readonly accuracy: number;
  readonly targetAccuracyProfile?: ResolvedTargetAccuracyProfile;
  readonly crit: ResolvedCritInput;
  readonly adrenaline?: AdrenalineRules;
  readonly procs?: ProcRules;
  readonly plantedFeet?: boolean;
  readonly strengthCape99?: boolean;
  readonly preciseRank?: number;
  readonly ammunition?: ResolvedRangedAmmunitionProfile | null;
  readonly enchantedBoltChanceModifiers?: EnchantedBoltChanceModifiers;
  readonly caromingRank?: number;
  readonly conjureBasicDamageMult?: number;
  readonly conjureDurationMult?: number;
  readonly tumekensPieces?: number;
  readonly equipmentEffects: ActiveEquipmentEffects;
  readonly nativeSpecialPolicy?: {
    readonly useEquippedWeaponSpecial: boolean;
    readonly afterAbilityId?: string | null;
  };
  /** EoF stored special ability id when Essence of Finality is equipped. */
  readonly eofStoredSpecialId?: string | null;
  readonly league: SerializableLeagueRules;
  readonly context?: CombatContext;
  readonly targetHpPercent?: number;
  readonly targetMaximumLifePoints?: number;
  readonly playerVitality?: PlayerVitalityInput;
  readonly cap?: HitCapRule;
  readonly startingAdrenaline?: number;
  readonly naturalInstinctUntilTick?: number;
  readonly startingResidualSouls?: number;
  readonly slayerOnTask?: boolean;
  readonly slayerLevel?: number;
  readonly equipmentIds: readonly string[];
  readonly weaponConfiguration: ResolvedWeaponConfiguration;
  /** Slot map used to derive set piece counts when setCounts is omitted. */
  readonly equipmentSlots?: Partial<Record<string, string | null>>;
  readonly vulnerability?: boolean;
  readonly styleCurseId?: string | "none";
  readonly amZiFlatDamage?: number;
  readonly amHejDamageBonus?: number;
  readonly slayer?: { demon: number; dragon: number; undead: number };
  readonly target?: {
    demon?: boolean;
    dragon?: boolean;
    undead?: boolean;
    poisonImmune?: boolean;
    elementalWeakness?: "water" | "fire" | "other" | "unknown";
    dragonfireImmune?: boolean;
  };
  readonly playerPoison?: PlayerPoisonProfile;
  readonly slayerHelmet?: SerializableModifierSources["slayerHelmet"];
  readonly salve?: SerializableModifierSources["salve"];
  readonly ultimatums?: number;
  readonly lunging?: number;
  readonly caroming?: number;
  readonly flanking?: number;
  readonly flankingActive?: boolean;
  readonly shieldBashing?: number;
  readonly spendthrift?: number;
  readonly ruthless?: number;
  readonly ruthlessStacks?: number;
  readonly berserkersFuryBonus?: number;
  readonly setCounts?: readonly (readonly [string, number])[];
  readonly diagnostics: ResolvedCombatDiagnostics;
}
