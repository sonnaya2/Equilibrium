/**
 * Pure labels for necro conjure casts and spirit auto/poison ledgers.
 * Engine does not emit a despawn event; duration is derived from Spirit Pact III.
 * Spirit hit events carry remainingTicks from live untilTick (presentation only).
 */
import { ticksToSeconds } from "@/combat/core/ticks";
import {
  COMMAND_REQUIRES_CONJURE,
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

export function isConjureCommandAbilityId(abilityId: string): boolean {
  return Object.prototype.hasOwnProperty.call(COMMAND_REQUIRES_CONJURE, abilityId);
}

/** Wiki revo++ seed lead when catalogue inject is unavailable. */
export const NECRO_BAR_CONJURE_FALLBACK = "conjure_undead_army";

/**
 * Run needs conjure_* to summon spirits. Solver bars may omit them.
 * Army fallback for pure unit tests; UI path uses ensureNecroConjuresOnBarIds (full wiki).
 */
export function ensureNecromancyConjureOnBar(barIds: readonly string[], style: string): string[] {
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

const SPIRIT_LEDGER_IDS = new Set<string>([
  ...Object.values(SPIRIT_AUTO_ABILITY_ID),
  SPIRIT_POISON_ABILITY_ID,
]);

export function isSpiritLedgerId(abilityId: string): boolean {
  return SPIRIT_LEDGER_IDS.has(abilityId);
}

export function spiritEffectDisplayName(abilityId: string): string | null {
  return SPIRIT_EFFECT_LABEL[abilityId] ?? null;
}

/** True when a byEffect / cast row is conjure-family (summon, command, or spirit ledger). */
export function isConjureEffectRow(id: string, kind?: string): boolean {
  if (kind === "conjure-or-familiar") return true;
  return isSpiritLedgerId(id) || isConjureSummonAbilityId(id) || isConjureCommandAbilityId(id);
}

/** Timeline / damage event is conjure damage or summon-related. */
export function isConjureDamageEvent(event: {
  family?: string;
  abilityId?: string;
  provenance?: { kind?: string };
}): boolean {
  const family = event.family;
  if (family === "conjureAuto" || family === "command" || family === "poison") return true;
  const id = event.abilityId ?? "";
  if (isSpiritLedgerId(id) || isConjureCommandAbilityId(id) || isConjureSummonAbilityId(id)) {
    return true;
  }
  const kind = event.provenance?.kind;
  return kind === "conjure_auto" || kind === "conjure_poison" || kind === "conjure_command";
}

/** Event column type for conjure rows (null when not conjure). */
export function conjureEventTypeLabel(event: {
  family?: string;
  abilityId?: string;
  provenance?: { kind?: string };
}): string | null {
  if (!isConjureDamageEvent(event)) return null;
  if (event.family === "command" || isConjureCommandAbilityId(event.abilityId ?? "")) {
    return "Conjure command";
  }
  if (event.family === "poison" || event.abilityId === SPIRIT_POISON_ABILITY_ID) {
    return "Conjure poison";
  }
  if (isConjureSummonAbilityId(event.abilityId ?? "")) return "Conjure";
  return "Conjure auto";
}

/** Revo / compact byEffect label. Prefixes "Conjure · " for spirit/summon rows. */
export function formatConjureByEffectLabel(
  id: string,
  kind: string | undefined,
  baseName: string,
): string {
  if (!isConjureEffectRow(id, kind)) return baseName;
  if (baseName.startsWith("Conjure · ")) return baseName;
  return `Conjure · ${baseName}`;
}

/** Cast-timeline note: exclusive end tick and wall-clock length from cast. */
export function formatConjureCastDurationNote(castTick: number, durationMult = 1): string {
  const until = conjureCastUntilTick(castTick, durationMult);
  const spanTicks = until - castTick;
  return `until t${until} · ${ticksToSeconds(spanTicks).toFixed(1)}s`;
}

/** Event-row note when remainingTicks is present (spirit life, bleed tail, etc.). */
export function formatRemainingDurationNote(eventTick: number, remainingTicks: number): string {
  const endsAt = eventTick + remainingTicks;
  const seconds = ticksToSeconds(remainingTicks).toFixed(1);
  return `${remainingTicks}t left (~${seconds}s) · ends t${endsAt}`;
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

/** Matches ability supportNote: wiki area, ST primary explode only (no invented multi hits). */
export const COMMAND_PUTRID_ST_ASSUMPTION_NOTE =
  "Wiki is area (2 tiles). ST model: one explode hit on the primary target only.";

/** Matches ability supportNote: default three; no phantom/custom army. */
export const UNDEAD_ARMY_ASSUMPTION_NOTE =
  "Default three: Skeleton Warrior, Vengeful Ghost, Putrid Zombie (Spirit Pact III). Army customisation not modeled.";

export function rotationHasConjureCast(
  casts: readonly { abilityId: string }[] | undefined,
): boolean {
  if (!casts?.length) return false;
  return casts.some((c) => isConjureSummonAbilityId(c.abilityId));
}

export function rotationHasAbilityId(
  casts: readonly { abilityId: string }[] | undefined,
  abilityId: string,
): boolean {
  if (!casts?.length) return false;
  return casts.some((c) => c.abilityId === abilityId);
}

/**
 * ST/area honesty for conjure command+army when those casts appear in a run.
 * Does not invent multi-target area damage numbers.
 */
export function conjureStAreaAssumptionRows(
  casts: readonly { abilityId: string }[] | undefined,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (rotationHasAbilityId(casts, "command_putrid_zombie")) {
    rows.push(["Command Putrid Zombie", COMMAND_PUTRID_ST_ASSUMPTION_NOTE]);
  }
  if (rotationHasAbilityId(casts, "conjure_undead_army")) {
    rows.push(["Conjure Undead Army", UNDEAD_ARMY_ASSUMPTION_NOTE]);
  }
  return rows;
}
