import { mulFloor } from "../../core/rounding";
import { secondsToTicks } from "../../core/ticks";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { isTrueDotDamage, type DamageProvenance } from "../../shared/damageProvenance";
import type { CombatContext, CombatModifier, SourceReference } from "../../types";
import type { MagicAbilitySpec } from "./abilities";

export const SONG_OF_DESTRUCTION_SET_ID = "song-of-destruction" as const;
export const ESSENCE_CORRUPTION_STACK_CAP = 100;
export const ESSENCE_CORRUPTION_DURATION_TICKS = 50;
export const ESSENCE_CORRUPTION_EMPOWERMENT_CHANCE = 0.3;
export const ESSENCE_CORRUPTION_FLAT_STACK_MULTIPLIER = 3;
export const ESSENCE_CORRUPTION_FLAT_THRESHOLD = 10;
export const ESSENCE_CORRUPTION_ADRENALINE_THRESHOLD = 25;
export const ESSENCE_CORRUPTION_ADRENALINE_PULSES = 6;
export const ESSENCE_CORRUPTION_ADRENALINE_PER_PULSE = 1;
export const SONG_TWO_PIECE_DAMAGE_MULTIPLIER = 1.3;
export const CONFLAGRATE_ABILITY_PRIORITY = 0;
export const SONG_TWO_PIECE_ABILITY_PRIORITY = 1;
export const CONFLAGRATE_DURATION_TICKS = 25;
export const CONFLAGRATE_DAMAGE_MULTIPLIER = 1.4;

export const SONG_OF_DESTRUCTION_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Template%3ASong_of_Destruction",
  title: "Template:Song of Destruction",
  verifiedAt: "2026-08-09",
};

export const SOULFIRE_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Soulfire",
  title: "Soulfire",
  verifiedAt: "2026-08-09",
};

export const CONFLAGRATE_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Comparison_of_high-level_magic_weapons",
  title: "Comparison of high-level magic weapons",
  verifiedAt: "2026-08-09",
};

export const ESSENCE_CORRUPTION_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Shattered_Worlds",
  title: "Shattered Worlds",
  verifiedAt: "2026-08-09",
};

export interface SongOfDestructionEquipmentSummary {
  pieceCount: number;
  enabled: boolean;
  twoPiece: boolean;
}

export const NO_SONG_OF_DESTRUCTION: SongOfDestructionEquipmentSummary = {
  pieceCount: 0,
  enabled: false,
  twoPiece: false,
};

export function songOfDestructionSummary(pieceCount: number): SongOfDestructionEquipmentSummary {
  const pieces = Number.isFinite(pieceCount) ? Math.max(0, Math.floor(pieceCount)) : 0;
  return {
    pieceCount: Math.min(2, pieces),
    enabled: pieces >= 1,
    twoPiece: pieces >= 2,
  };
}

export interface EssenceCorruptionState {
  stacks: number;
  expiresAtTick: number;
}

export interface SongAdrenalineStreamState {
  nextPulseTick: number;
  remainingPulses: number;
}

export interface SongOfDestructionRotationState {
  essenceCorruption: EssenceCorruptionState;
  conflagrateUntilTick: number;
  adrenalineStream: SongAdrenalineStreamState;
}

export const newSongOfDestructionRotationState = (): SongOfDestructionRotationState => ({
  essenceCorruption: { stacks: 0, expiresAtTick: 0 },
  conflagrateUntilTick: 0,
  adrenalineStream: { nextPulseTick: 0, remainingPulses: 0 },
});

type SongAbility = Pick<
  AbilitySpec,
  | "id"
  | "style"
  | "essenceCorruptionEligible"
  | "essenceCorruptionMagicHitEligible"
  | "songAffectedDot"
>;

export function isEssenceCorruptionAbility(
  ability: SongAbility | undefined,
): boolean {
  return ability?.essenceCorruptionEligible === true;
}

function sameAbilityProvenance(
  provenance: DamageProvenance,
  kind: "player_dot" | "derived_tail",
  ability: SongAbility,
): boolean {
  if (provenance.kind !== kind) return false;
  if (kind === "derived_tail") return provenance.detail === ability.id;
  return provenance.detail == null || provenance.detail === ability.id;
}

export function isEssenceCorruptionMagicHit(
  ability: SongAbility | undefined,
  provenance: DamageProvenance,
): boolean {
  if (ability == null || ability.style !== "magic") return false;
  if (provenance.kind === "equipment_proc") {
    return (
      provenance.detail === "lightning_surge" &&
      ability.essenceCorruptionMagicHitEligible === true
    );
  }
  return (
    provenance.kind === "player_direct" ||
    provenance.kind === "player_auto" ||
    provenance.kind === "player_dot" ||
    (isEssenceCorruptionAbility(ability) &&
      sameAbilityProvenance(provenance, "derived_tail", ability))
  );
}

export function isEssenceCorruptionStackHit(
  ability: SongAbility | undefined,
  provenance: DamageProvenance,
): boolean {
  return (
    ability != null &&
    isEssenceCorruptionAbility(ability) &&
    (sameAbilityProvenance(provenance, "player_dot", ability) ||
      sameAbilityProvenance(provenance, "derived_tail", ability))
  );
}

export function liveEssenceCorruptionStacks(
  state: EssenceCorruptionState,
  tick: number,
): number {
  if (state.expiresAtTick <= tick || state.stacks <= 0) return 0;
  return Math.min(ESSENCE_CORRUPTION_STACK_CAP, Math.max(0, Math.floor(state.stacks)));
}

export function activeEssenceCorruptionStacks(
  summary: SongOfDestructionEquipmentSummary,
  state: EssenceCorruptionState,
  tick: number,
): number {
  return summary.enabled ? liveEssenceCorruptionStacks(state, tick) : 0;
}

export function normalizeEssenceCorruptionState(
  state: EssenceCorruptionState,
  tick: number,
): EssenceCorruptionState {
  if (state.expiresAtTick <= tick || state.stacks <= 0) {
    return { stacks: 0, expiresAtTick: 0 };
  }
  return {
    stacks: Math.min(ESSENCE_CORRUPTION_STACK_CAP, Math.max(0, Math.floor(state.stacks))),
    expiresAtTick: state.expiresAtTick,
  };
}

export function prospectiveEssenceCorruptionStacks(
  summary: SongOfDestructionEquipmentSummary,
  state: EssenceCorruptionState,
  tick: number,
  ability: SongAbility | undefined,
  provenance: DamageProvenance,
): number {
  const current = activeEssenceCorruptionStacks(summary, state, tick);
  return isEssenceCorruptionStackHit(ability, provenance)
    ? Math.min(ESSENCE_CORRUPTION_STACK_CAP, current + 1)
    : current;
}

/** Shattered Worlds: add after Damage Potential and before the hit cap. */
export function essenceCorruptionFlatBonus(
  summary: SongOfDestructionEquipmentSummary,
  state: EssenceCorruptionState,
  tick: number,
  effectiveMagicLevel: number,
  ability: SongAbility | undefined,
  provenance: DamageProvenance,
): number {
  if (!isEssenceCorruptionMagicHit(ability, provenance)) return 0;
  const stacks = prospectiveEssenceCorruptionStacks(summary, state, tick, ability, provenance);
  return stacks >= ESSENCE_CORRUPTION_FLAT_THRESHOLD
    ? ESSENCE_CORRUPTION_FLAT_STACK_MULTIPLIER * stacks +
        Math.max(0, Math.floor(effectiveMagicLevel))
    : 0;
}

export function landEssenceCorruptionHit(
  summary: SongOfDestructionEquipmentSummary,
  state: EssenceCorruptionState,
  landTick: number,
  ability: SongAbility | undefined,
  provenance: DamageProvenance,
): EssenceCorruptionState {
  const normalized = normalizeEssenceCorruptionState(state, landTick);
  if (!isEssenceCorruptionStackHit(ability, provenance) || !summary.enabled) return normalized;
  return {
    stacks: Math.min(ESSENCE_CORRUPTION_STACK_CAP, normalized.stacks + 1),
    expiresAtTick: landTick + ESSENCE_CORRUPTION_DURATION_TICKS,
  };
}

export interface EssenceCorruptionEmpowermentDecision {
  scope: "cast-target";
  rollCount: 0 | 1;
  preCastStacks: number;
  empowered: boolean;
}

export function prepareEssenceCorruptionEmpowerment(
  summary: SongOfDestructionEquipmentSummary,
  state: EssenceCorruptionState,
  castTick: number,
  ability: SongAbility | undefined,
  roll: number,
): EssenceCorruptionEmpowermentDecision {
  const preCastStacks = activeEssenceCorruptionStacks(summary, state, castTick);
  const rollCount: 0 | 1 =
    summary.enabled && preCastStacks >= 1 && isEssenceCorruptionAbility(ability) ? 1 : 0;
  return {
    scope: "cast-target",
    rollCount,
    preCastStacks,
    empowered: rollCount === 1 && roll >= 0 && roll < ESSENCE_CORRUPTION_EMPOWERMENT_CHANCE,
  };
}

export function twoPieceSongDamageMultiplier(
  summary: SongOfDestructionEquipmentSummary,
): number {
  return summary.twoPiece ? SONG_TWO_PIECE_DAMAGE_MULTIPLIER : 1;
}

export type SongDamageScope = "parent" | "corruption-tail" | "hit";

export interface SongDamageModifierInput {
  summary: SongOfDestructionEquipmentSummary;
  ability: SongAbility | undefined;
  conflagrateActive?: boolean;
  scope?: SongDamageScope;
}

function abilityModifier(
  id: string,
  priority: number,
  multiplier: number,
  source: SourceReference,
  applies: (context: CombatContext) => boolean,
): CombatModifier {
  return {
    id,
    stage: "ability",
    priority,
    applies,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
    source,
  };
}

export function songOfDestructionModifiers(input: SongDamageModifierInput): CombatModifier[] {
  const scope = input.scope ?? "parent";
  const modifiers: CombatModifier[] = [];
  if (input.conflagrateActive === true && input.ability?.id === "combust") {
    modifiers.push(
      abilityModifier(
        "song:conflagrate",
        CONFLAGRATE_ABILITY_PRIORITY,
        CONFLAGRATE_DAMAGE_MULTIPLIER,
        CONFLAGRATE_SOURCE,
        (context) => context.style === "magic",
      ),
    );
  }
  if (
    input.summary.twoPiece &&
    input.ability?.songAffectedDot === true &&
    scope !== "corruption-tail"
  ) {
    // Song 2pc is DoT-only (wiki Soulfire opener is direct; no 2pc on that hit).
    modifiers.push(
      abilityModifier(
        "song:two-piece-dot",
        SONG_TWO_PIECE_ABILITY_PRIORITY,
        SONG_TWO_PIECE_DAMAGE_MULTIPLIER,
        SONG_OF_DESTRUCTION_SOURCE,
        (context) => context.style === "magic" && isTrueDotDamage(context),
      ),
    );
  }
  return modifiers;
}

export function armConflagrate(castTick: number): number {
  return castTick + CONFLAGRATE_DURATION_TICKS;
}

export function conflagrateActive(untilTick: number, tick: number): boolean {
  return untilTick > 0 && tick < untilTick;
}

export function consumeConflagrate(
  untilTick: number,
  abilityId: string,
  castTick: number,
): { active: boolean; nextUntilTick: number } {
  const active = abilityId === "combust" && conflagrateActive(untilTick, castTick);
  return { active, nextUntilTick: active ? 0 : untilTick };
}

export function normalizeSongAdrenalineStream(
  stream: SongAdrenalineStreamState,
  tick: number,
): SongAdrenalineStreamState {
  if (
    stream.remainingPulses <= 0 ||
    stream.nextPulseTick <= 0 ||
    tick >= stream.nextPulseTick + stream.remainingPulses
  ) {
    return { nextPulseTick: 0, remainingPulses: 0 };
  }
  return {
    nextPulseTick: stream.nextPulseTick,
    remainingPulses: Math.min(ESSENCE_CORRUPTION_ADRENALINE_PULSES, stream.remainingPulses),
  };
}

export function armSongAdrenalineStream(
  summary: SongOfDestructionEquipmentSummary,
  stacks: number,
  ability: Pick<AbilitySpec, "style" | "category" | "basicAttack">,
  castTick: number,
  current: SongAdrenalineStreamState = { nextPulseTick: 0, remainingPulses: 0 },
): SongAdrenalineStreamState {
  if (
    !summary.enabled ||
    stacks < ESSENCE_CORRUPTION_ADRENALINE_THRESHOLD ||
    ability.category !== "basic"
  ) {
    return current;
  }
  return {
    nextPulseTick: castTick + 1,
    remainingPulses: ESSENCE_CORRUPTION_ADRENALINE_PULSES,
  };
}

export function advanceSongAdrenalineStream(
  stream: SongAdrenalineStreamState,
  fromTick: number,
  toTickExclusive: number,
): { stream: SongAdrenalineStreamState; pulses: number } {
  const normalized = normalizeSongAdrenalineStream(stream, fromTick);
  if (normalized.remainingPulses <= 0 || toTickExclusive <= fromTick) {
    return { stream: normalized, pulses: 0 };
  }
  const end = Math.min(
    toTickExclusive,
    normalized.nextPulseTick + normalized.remainingPulses,
  );
  const pulses = Math.max(0, end - Math.max(fromTick, normalized.nextPulseTick));
  if (pulses <= 0) return { stream: normalized, pulses: 0 };
  const remainingPulses = normalized.remainingPulses - pulses;
  return {
    stream: {
      nextPulseTick:
        remainingPulses > 0
          ? Math.max(fromTick, normalized.nextPulseTick) + pulses
          : 0,
      remainingPulses,
    },
    pulses,
  };
}

// Wiki Soulfire: 1 direct 130-160 (can crit, Sunshine; no Song 2pc) concurrent with
// first of 6 DoT 170-200 every 3 ticks; total 7 hits, 1150-1360% AD.
// https://runescape.wiki/w/Soulfire
export const SOULFIRE_ABILITY: MagicAbilitySpec = {
  id: "soulfire",
  name: "Soulfire",
  style: "magic",
  category: "enhanced",
  weaponSpecial: true,
  requiresSpecialAccess: true,
  minimumAutomaticRecastTicks: secondsToTicks(45),
  hits: [
    { band: { minPct: 130, maxPct: 160 }, tickOffset: 0 },
    ...Array.from({ length: 6 }, (_, index) => ({
      band: { minPct: 170, maxPct: 200 },
      critEligible: false,
      dot: true,
      dotKind: "burn" as const,
      tickOffset: index * 3,
    })),
  ],
  essenceCorruptionEligible: true,
  adrenaline: { cost: 35 },
  cooldownSeconds: 45,
  // Two-piece Song mult applies only to true DoT hits (gated in songOfDestructionModifiers).
  songAffectedDot: true,
  source: SOULFIRE_SOURCE,
};
