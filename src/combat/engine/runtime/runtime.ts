import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type { HitResult } from "../../pipeline/calculateHit";
import type { ConjureId } from "../../styles/necromancy/conjures";
import type { CastContextInput, CastRecord } from "../simulation/contracts";
import { emptyAnalysisState, type RuntimeAnalysisState } from "../analysis";
import { EventQueue, type ResolvedEvent, type ScheduledEvent } from "./events";
import { ADRENALINE_CAP, newRotationState, type RotationState } from "./state";
import { resolveMaximumAdrenaline } from "../../league/ruleset";
import { hasBlessing } from "../../league/ruleset";

/** Spirit event identity: a pending auto/poison event is live only for its summon instance. */
export interface SpiritEventMeta {
  id: ConjureId;
  untilTick: number;
  kind: "auto" | "poison";
}

/**
 * All per-run mutable simulation state. Created once per simulation by
 * createCastContext and threaded through every runtime function - never a
 * module-level singleton, so concurrent simulations cannot interfere.
 */
export interface SimulationRuntime {
  readonly input: CastContextInput;
  /** Runs with a horizon land events only before it (half-open). */
  readonly horizon?: number;
  readonly byId: Map<string, AbilitySpec>;
  readonly basicByStyle: Map<AbilitySpec["style"], AbilitySpec>;
  readonly queue: EventQueue<SimulationRuntime>;
  state: RotationState;
  readonly casts: CastRecord[];
  readonly perAbility: Record<string, number>;
  readonly damageByTick: Record<number, number>;
  /** Every landed event in (tick, seq) order. */
  readonly events: ResolvedEvent<SimulationRuntime>[];
  readonly recordBySeq: Map<number, CastRecord>;
  /** Full hit detail per landed hit event, keyed by event seq (cast records, surge EV). */
  readonly hitDetails: Map<number, HitResult>;
  readonly spiritEventMeta: Map<number, SpiritEventMeta>;
  readonly scheduledSpiritTracks: Set<string>;
  readonly spiritHitCounts: Map<string, number>;
  endTick: number;
  totalMin: number;
  totalMax: number;
  totalExpected: number;
  /**
   * Weighted analysis ledgers - quantitative breakdown lives here, not in the
   * representative event log. Branch merge weight-averages this state.
   */
  analysis: RuntimeAnalysisState;
  nextSeq: number;
  nextCastSeq: number;
  finalized: boolean;
}

export function mapAbilitiesById(abilities: readonly AbilitySpec[]): Map<string, AbilitySpec> {
  const byId = new Map<string, AbilitySpec>();
  for (const ability of abilities) {
    const prev = byId.get(ability.id);
    if (prev) {
      // Catalogue/bar merges may list the same id twice. Silent overwrite is
      // banned: keep the first registration, throw when a later entry conflicts.
      if (
        prev.name !== ability.name ||
        prev.style !== ability.style ||
        prev.hits.length !== ability.hits.length ||
        (prev.category ?? "") !== (ability.category ?? "")
      ) {
        throw new Error(`Duplicate ability id in runtime registry: ${ability.id}`);
      }
      continue;
    }
    byId.set(ability.id, ability);
  }
  return byId;
}

function mapBasicsByStyle(
  abilities: readonly AbilitySpec[],
): Map<AbilitySpec["style"], AbilitySpec> {
  // First auto-attack wins. Tests inject temporary autoAttack flags on synthetic
  // abilities; that is not a duplicate ability-id data bug.
  const basicByStyle = new Map<AbilitySpec["style"], AbilitySpec>();
  for (const ability of abilities) {
    if (!ability.autoAttack || basicByStyle.has(ability.style)) continue;
    basicByStyle.set(ability.style, ability);
  }
  return basicByStyle;
}

export function createRuntime(input: CastContextInput): SimulationRuntime {
  const base = resolveMaximumAdrenaline(
    input.equipmentEffects?.vestments.increasedAdrenalineCap ? 120 : ADRENALINE_CAP,
    input.league,
  );
  const adrenalineCap = base + (input.adrenaline?.maxAdrenalineBonus ?? 0);
  if (
    input.startingAdrenaline != null &&
    (!Number.isFinite(input.startingAdrenaline) ||
      input.startingAdrenaline < 0 ||
      input.startingAdrenaline > adrenalineCap)
  ) {
    throw new RangeError(
      `startingAdrenaline outside 0-${adrenalineCap}: ${input.startingAdrenaline}`,
    );
  }
  if (
    input.naturalInstinctUntilTick != null &&
    (!Number.isFinite(input.naturalInstinctUntilTick) || input.naturalInstinctUntilTick < 0)
  ) {
    throw new RangeError(`bad naturalInstinctUntilTick: ${input.naturalInstinctUntilTick}`);
  }
  if (
    input.targetHpPercent != null &&
    (!Number.isFinite(input.targetHpPercent) ||
      input.targetHpPercent < 0 ||
      input.targetHpPercent > 100)
  ) {
    throw new RangeError(`targetHpPercent outside 0-100: ${input.targetHpPercent}`);
  }
  return {
    input,
    horizon: input.horizonTicks,
    byId: mapAbilitiesById(input.abilities),
    basicByStyle: mapBasicsByStyle(input.abilities),
    queue: new EventQueue<SimulationRuntime>(),
    state: newRotationState({
      adrenaline: input.startingAdrenaline,
      adrenalineCap,
      naturalInstinctUntilTick: input.naturalInstinctUntilTick,
      league:
        hasBlessing(input.league, "avernic-rampage") || hasBlessing(input.league, "striking-light"),
    }),
    casts: [],
    perAbility: {},
    damageByTick: {},
    events: [],
    recordBySeq: new Map(),
    hitDetails: new Map(),
    spiritEventMeta: new Map(),
    scheduledSpiritTracks: new Set(),
    spiritHitCounts: new Map(),
    endTick: 0,
    totalMin: 0,
    totalMax: 0,
    totalExpected: 0,
    analysis: emptyAnalysisState(),
    nextSeq: 0,
    nextCastSeq: 0,
    finalized: false,
  };
}

/** Push an event onto the queue, assigning its monotonic per-run seq. */
export function scheduleEvent(
  rt: SimulationRuntime,
  event: Omit<ScheduledEvent<SimulationRuntime>, "seq">,
): number {
  const seq = rt.nextSeq++;
  rt.queue.push({ ...event, seq });
  return seq;
}
