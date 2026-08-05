/**
 * Pure labels for necro conjure casts and spirit auto/poison ledgers.
 * Engine does not emit a despawn event; duration is derived from Spirit Pact III.
 */
import { ticksToSeconds } from "@/combat/core/ticks";
import {
  CONJURE_ABILITY_SUMMONS,
  CONJURE_ANIM_TICKS,
  SPIRIT_AUTO_ABILITY_ID,
  SPIRIT_PACT_III_DURATION_TICKS,
  SPIRIT_POISON_ABILITY_ID,
} from "@/combat/styles/necromancy/conjures";

/** Exclusive untilTick offset from cast ready tick (anim + SP3 * mult). */
export function conjureUntilOffsetTicks(durationMult = 1): number {
  const mult = Number.isFinite(durationMult) && durationMult > 0 ? durationMult : 1;
  return CONJURE_ANIM_TICKS + Math.floor(SPIRIT_PACT_III_DURATION_TICKS * mult);
}

export function conjureCastUntilTick(castTick: number, durationMult = 1): number {
  return castTick + conjureUntilOffsetTicks(durationMult);
}

export function isConjureSummonAbilityId(abilityId: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONJURE_ABILITY_SUMMONS, abilityId);
}

/** Wiki revo++ seed lead when catalogue inject is unavailable. */
export const NECRO_BAR_CONJURE_FALLBACK = "conjure_undead_army";

/**
 * Run needs conjure_* to summon spirits. Solver bars may omit them.
 * Army fallback for pure unit tests; UI path uses ensureNecroConjuresOnBarIds (full wiki).
 */
export function ensureNecromancyConjureOnBar(
  barIds: readonly string[],
  style: string,
): string[] {
  if (style !== "necromancy") return [...barIds];
  if (barIds.some((id) => isConjureSummonAbilityId(id))) return [...barIds];
  return [NECRO_BAR_CONJURE_FALLBACK, ...barIds];
}

/** Human label for spirit ledger ids (not bar abilities). */
const SPIRIT_EFFECT_LABEL: Readonly<Record<string, string>> = {
  [SPIRIT_AUTO_ABILITY_ID.skeleton_warrior]: "Skeleton Warrior auto",
  [SPIRIT_AUTO_ABILITY_ID.vengeful_ghost]: "Vengeful Ghost auto",
  [SPIRIT_AUTO_ABILITY_ID.putrid_zombie]: "Putrid Zombie auto",
  [SPIRIT_AUTO_ABILITY_ID.phantom_guardian]: "Phantom Guardian",
  [SPIRIT_POISON_ABILITY_ID]: "Putrid Zombie poison",
};

export function spiritEffectDisplayName(abilityId: string): string | null {
  return SPIRIT_EFFECT_LABEL[abilityId] ?? null;
}

/** Cast-timeline note: exclusive end tick and wall-clock length from cast. */
export function formatConjureCastDurationNote(castTick: number, durationMult = 1): string {
  const until = conjureCastUntilTick(castTick, durationMult);
  const spanTicks = until - castTick;
  return `until t${until} · ${ticksToSeconds(spanTicks).toFixed(1)}s`;
}

/** Event-row note when remainingTicks is present (spirit life, bleed tail, etc.). */
export function formatRemainingDurationNote(
  eventTick: number,
  remainingTicks: number,
): string {
  const endsAt = eventTick + remainingTicks;
  return `${remainingTicks} ticks left · ends t${endsAt}`;
}

/**
 * Assumptions row when a run cast a conjure. Explains no despawn line and
 * re-summon only after exclusive untilTick (SP3 + anim).
 */
export function conjurePactAssumptionNote(durationMult = 1): string {
  const offset = conjureUntilOffsetTicks(durationMult);
  const seconds = ticksToSeconds(offset).toFixed(1);
  return `Spirits active until cast+${offset} ticks (~${seconds}s; ${CONJURE_ANIM_TICKS}-tick anim + Spirit Pact III). Re-summon only after expiry; no separate despawn log line. Command Putrid Zombie dismisses the zombie for one hit (not an unprompted explode).`;
}

export function rotationHasConjureCast(
  casts: readonly { abilityId: string }[] | undefined,
): boolean {
  if (!casts?.length) return false;
  return casts.some((c) => isConjureSummonAbilityId(c.abilityId));
}
