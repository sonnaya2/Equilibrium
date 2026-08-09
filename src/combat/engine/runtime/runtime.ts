import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type { HitResult } from "../../pipeline/calculateHit";
import type { CombatModifier } from "../../types";
import type { ConjureId } from "../../styles/necromancy/conjures";
import type { CastContextInput, CastRecord, SimulationDetailLevel } from "../simulation/contracts";
import { keepsAnalysisLedgers, resolveDetailLevel } from "../simulation/contracts";
import type { AdrenalineTransaction } from "../../shared/adrenalineTransaction";
import { abilityBehaviorFingerprint } from "../../shared/abilityFingerprint";
import { isBasicAttack } from "../../shared/adrenalineGain";
import { isSharedConstitutionAbilityId } from "../../styles/shared/constitutionAbilities";
import { assertProvenance } from "../../shared/damageProvenance";
import { cloneAnalysisState, emptyAnalysisState, type RuntimeAnalysisState } from "../analysis";
import { EventQueue, type ResolvedEvent, type ScheduledEvent } from "./events";
import {
  ADRENALINE_CAP,
  inactiveTargetWeaponPoison,
  newRotationState,
  patchTarget,
  type RotationState,
} from "./state";
import { hasBlessing, hasNaragiEdict, resolveMaximumAdrenaline } from "../../league/ruleset";
import { activateNaragiSliver } from "../../league/naragiActivation";
import { SLIVER_OF_EDICTS_ID } from "../../league/naragiEdict";
import { noteRuntimeCreated } from "../../profiling/allocation";
import { hasPassive } from "../../shared/equipment";
import { lengLandTableFor, type CompiledLengLandTable } from "../../styles/melee/lengRng";
import { MAX_SOULS } from "../../styles/necromancy/abilities";
import { residualSoulCapFor } from "../../styles/necromancy/effects";
import { normalizeKwuarmPotency, normalizeWeaponPoisonChoice } from "../../poison/mechanics";
import { resolveStyleAmmo } from "../../styles/ranged/ammoModel";
import {
  createStochasticOracle,
  DEFAULT_STOCHASTIC_LANES,
  type StochasticOracle,
  type StochasticOracleConfig,
} from "./stochastic";

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
  /** Bookkeeping depth (default full-analysis). */
  readonly detailLevel: SimulationDetailLevel;
  /** Runs with a horizon land events only before it (half-open). */
  readonly horizon?: number;
  readonly byId: ReadonlyMap<string, AbilitySpec>;
  readonly basicByStyle: ReadonlyMap<AbilitySpec["style"], AbilitySpec>;
  /**
   * Equipment-static Leng land outcome table (null when no Leng passives).
   * Compiled once in createRuntime; shared across stochastic lanes.
   */
  readonly lengLandTable: CompiledLengLandTable | null;
  readonly stochastic: StochasticOracle;
  readonly playerPoisonDamageCache: Map<string, unknown>;
  readonly leagueDamageCache: Map<string, unknown>;
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
  /** Expected self-heal from damage-derived ability and blessing effects. */
  totalHealed: number;
  /**
   * Weighted analysis ledgers - quantitative breakdown lives here, not in the
   * representative event log. Lane aggregation weight-averages this state.
   */
  analysis: RuntimeAnalysisState;
  nextSeq: number;
  nextCastSeq: number;
  finalized: boolean;
  /** Last ability-economy adren ledger from applyCastResources (one RNG resolve). */
  lastCastAdrenalineTransaction: AdrenalineTransaction | null;
}

export function mapAbilitiesById(abilities: readonly AbilitySpec[]): Map<string, AbilitySpec> {
  const byId = new Map<string, AbilitySpec>();
  for (const ability of abilities) {
    const prev = byId.get(ability.id);
    if (prev) {
      // Catalogue/bar merges may list the same id twice. Silent overwrite is
      // banned: keep the first registration, throw when a later entry conflicts.
      if (abilityBehaviorFingerprint(prev) !== abilityBehaviorFingerprint(ability)) {
        // Shared Constitution (Sacrifice): one engine id, style remapped per bar.
        // Later registration wins (bar / pool overlay after registry placeholder).
        if (isSharedConstitutionAbilityId(ability.id)) {
          byId.set(ability.id, ability);
          continue;
        }
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
  // First Basic Attack wins; the fallback supports synthetic test catalogues.
  const basicByStyle = new Map<AbilitySpec["style"], AbilitySpec>();
  for (const ability of abilities) {
    if (!isBasicAttack(ability) || basicByStyle.has(ability.style)) continue;
    basicByStyle.set(ability.style, ability);
  }
  return basicByStyle;
}

export function createRuntime(
  input: CastContextInput,
  stochastic?: StochasticOracleConfig,
): SimulationRuntime {
  noteRuntimeCreated();
  const ammo = resolveStyleAmmo(input.ammo, input.equipmentIds, input.context?.style);
  const withAmmo = ammo === input.ammo ? input : { ...input, ammo };
  let runtimeInput = withAmmo;
  if (typeof withAmmo.modifiers === "function") {
    const source = withAmmo.modifiers;
    const modifiersByAbility = new WeakMap<AbilitySpec, CombatModifier[]>();
    runtimeInput = {
      ...withAmmo,
      modifiers: (ability) => {
        const cached = modifiersByAbility.get(ability);
        if (cached) return cached;
        const modifiers = source(ability);
        modifiersByAbility.set(ability, modifiers);
        return modifiers;
      },
    };
  }
  const adrenalineCap = resolveMaximumAdrenaline(
    input.equipmentEffects?.vestments.increasedAdrenalineCap ? 120 : ADRENALINE_CAP,
    input.league,
    input.adrenaline?.maxAdrenalineBonus ?? 0,
  ).cap;
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
  if (
    input.startingResidualSouls != null &&
    (!Number.isFinite(input.startingResidualSouls) || input.startingResidualSouls < 0)
  ) {
    throw new RangeError(`bad startingResidualSouls: ${input.startingResidualSouls}`);
  }
  if (input.slayerLevel != null && (!Number.isFinite(input.slayerLevel) || input.slayerLevel < 0)) {
    throw new RangeError(`bad slayerLevel: ${input.slayerLevel}`);
  }
  if (
    input.playerPoison &&
    (normalizeWeaponPoisonChoice(input.playerPoison.potion) !== input.playerPoison.potion ||
      normalizeKwuarmPotency(input.playerPoison.kwuarmPotency) !==
        input.playerPoison.kwuarmPotency ||
      !Number.isInteger(input.playerPoison.potionUntilTick) ||
      input.playerPoison.potionUntilTick < 0)
  ) {
    throw new RangeError("invalid playerPoison profile");
  }
  // Solver compiled context may pass prebuilt maps (request-invariant).
  // When absent, rebuild from abilities (manual UI / unit tests / one-off sims).
  const byId = input.abilityRegistry?.byId ?? mapAbilitiesById(input.abilities);
  const basicByStyle = input.abilityRegistry?.basicByStyle ?? mapBasicsByStyle(input.abilities);
  const equipment = input.equipmentEffects;
  const lengLandTable = lengLandTableFor(
    hasPassive(equipment, "leng-endless-frost"),
    hasPassive(equipment, "leng-boundless-chill"),
  );
  // Soulbound lantern from equipped ids only - never invent from requested souls.
  const soulboundLantern =
    input.equipmentIds?.some((id) => id === "item:soulbound-lantern") === true;
  let state = newRotationState({
    adrenaline: input.startingAdrenaline,
    adrenalineCap,
    naturalInstinctUntilTick: input.naturalInstinctUntilTick,
    league:
      hasBlessing(input.league, "avernic-rampage") ||
      hasBlessing(input.league, "striking-light") ||
      hasBlessing(input.league, "lord-of-light") ||
      hasBlessing(input.league, "tearing-thorns"),
    ringOfVigour: input.adrenaline?.ringOfVigour === true,
    lantern: soulboundLantern,
  });
  state = patchTarget(state, { weaponPoison: inactiveTargetWeaponPoison() });
  if (input.startingResidualSouls != null) {
    const requested = Math.floor(input.startingResidualSouls);
    const resources = state.necromancy.resources;
    const cap = Math.min(MAX_SOULS, residualSoulCapFor(resources));
    const souls = Math.min(cap, Math.max(0, requested));
    state = {
      ...state,
      necromancy: {
        ...state.necromancy,
        resources: { ...resources, residualSouls: souls },
      },
    };
  }
  const rt: SimulationRuntime = {
    input: runtimeInput,
    detailLevel: resolveDetailLevel(input.detailLevel),
    horizon: input.horizonTicks,
    byId,
    basicByStyle,
    lengLandTable,
    stochastic: createStochasticOracle(
      stochastic ?? { laneIndex: 0, laneCount: DEFAULT_STOCHASTIC_LANES },
    ),
    playerPoisonDamageCache: new Map(),
    leagueDamageCache: new Map(),
    queue: new EventQueue<SimulationRuntime>(),
    state,
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
    totalHealed: 0,
    analysis: emptyAnalysisState(),
    nextSeq: 0,
    nextCastSeq: 0,
    finalized: false,
    lastCastAdrenalineTransaction: null,
  };
  if (input.activateNaragiAtStart === true) {
    activateNaragiSliver(rt, {
      relicActive: hasNaragiEdict(input.league),
      sliverWorn: input.equipmentIds?.includes(SLIVER_OF_EDICTS_ID) === true,
      maximumLifePoints: input.league?.maximumLife ?? 15_000,
    });
  }
  return rt;
}

function cloneCastRecord(
  record: CastRecord,
  cache: Map<CastRecord, CastRecord>,
  scoreOnly: boolean,
): CastRecord {
  const existing = cache.get(record);
  if (existing) return existing;
  const clone = scoreOnly
    ? { ...record, result: { ...record.result } }
    : { ...record, result: { ...record.result, hits: [...record.result.hits] } };
  cache.set(record, clone);
  return clone;
}

export function cloneRuntime(rt: SimulationRuntime): SimulationRuntime {
  const scoreOnly = rt.detailLevel === "score-only";
  const records = new Map<CastRecord, CastRecord>();
  const casts = rt.casts.map((record) => cloneCastRecord(record, records, scoreOnly));
  const recordBySeq = new Map<number, CastRecord>();
  for (const [seq, record] of rt.recordBySeq) {
    recordBySeq.set(seq, cloneCastRecord(record, records, scoreOnly));
  }
  return {
    ...rt,
    stochastic: rt.stochastic.clone(),
    queue: rt.queue.clone(),
    casts,
    perAbility: { ...rt.perAbility },
    damageByTick: { ...rt.damageByTick },
    events: scoreOnly ? [] : [...rt.events],
    recordBySeq,
    hitDetails: new Map(rt.hitDetails),
    spiritEventMeta: new Map(rt.spiritEventMeta),
    scheduledSpiritTracks: new Set(rt.scheduledSpiritTracks),
    spiritHitCounts: new Map(rt.spiritHitCounts),
    analysis: keepsAnalysisLedgers(rt.detailLevel) ? cloneAnalysisState(rt.analysis) : rt.analysis,
  };
}

/** Push a fully-sequenced event after asserting provenance. */
export function enqueueEvent(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
): void {
  assertProvenance(event.provenance);
  rt.queue.push(event);
}

/** Push an event onto the queue, assigning its monotonic per-run seq. */
export function scheduleEvent(
  rt: SimulationRuntime,
  event: Omit<ScheduledEvent<SimulationRuntime>, "seq">,
): number {
  assertProvenance(event.provenance);
  const seq = rt.nextSeq++;
  rt.queue.push({ ...event, seq });
  return seq;
}
