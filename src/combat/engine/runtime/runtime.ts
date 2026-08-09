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
import {
  hasBlessing,
  hasNaragiEdict,
  resolveMaximumAdrenaline,
  type ResolvedLeagueRules,
} from "../../league/ruleset";

const LEAGUE_CLOCK_BLESSING_IDS = [
  "avernic-rampage",
  "striking-light",
  "lord-of-light",
  "tearing-thorns",
] as const;

/** League runtime clocks for Light CD / Rampage / Thorns. */
function needsLeagueRuntimeClocks(league: ResolvedLeagueRules | undefined): boolean {
  if (!league || league.ruleset !== "equilibrium") return false;
  for (const id of LEAGUE_CLOCK_BLESSING_IDS) {
    if (hasBlessing(league, id)) return true;
  }
  return league.blessings.some((choice) =>
    (LEAGUE_CLOCK_BLESSING_IDS as readonly string[]).includes(choice.id),
  );
}
import { activateNaragiSliver } from "../../league/naragiActivation";
import { SLIVER_OF_EDICTS_ID } from "../../league/naragiEdict";
import { noteRuntimeCreated } from "../../profiling/allocation";
import { hasPassive } from "../../shared/equipment";
import { lengLandTableFor, type CompiledLengLandTable } from "../../styles/melee/lengRng";
import { MAX_SOULS } from "../../styles/necromancy/abilities";
import { residualSoulCapFor } from "../../styles/necromancy/effects";
import { normalizeKwuarmPotency, normalizeWeaponPoisonChoice } from "../../poison/mechanics";
import {
  createStochasticOracle,
  DEFAULT_STOCHASTIC_LANES,
  type StochasticOracle,
  type StochasticOracleConfig,
} from "./stochastic";

const preparedModifierResolver = Symbol("preparedModifierResolver");

type PreparedModifierResolver = ((ability: AbilitySpec) => CombatModifier[]) & {
  [preparedModifierResolver]: true;
};

export function prepareRuntimeInput<T extends CastContextInput>(input: T): T {
  if (
    typeof input.modifiers !== "function" ||
    (input.modifiers as Partial<PreparedModifierResolver>)[preparedModifierResolver] === true
  ) {
    return input;
  }
  const source = input.modifiers;
  const modifiersByAbility = new WeakMap<AbilitySpec, CombatModifier[]>();
  const modifiers = ((ability: AbilitySpec) => {
    const cached = modifiersByAbility.get(ability);
    if (cached) return cached;
    const resolved = source(ability);
    modifiersByAbility.set(ability, resolved);
    return resolved;
  }) as PreparedModifierResolver;
  Object.defineProperty(modifiers, preparedModifierResolver, { value: true });
  return { ...input, modifiers };
}

/**
 * Auto-special ids when policy is on: equipped weapon first, then a distinct
 * EoF store. Revo tries them in order so EoF fires while the weapon special is
 * on cooldown (or otherwise illegal).
 */
export function resolveAutoSpecialIds(input: {
  nativeSpecialPolicy?: { useEquippedWeaponSpecial?: boolean };
  equipmentEffects?: { activeWeapon?: { specialAttackId?: string | null } | null };
  eofStoredSpecialId?: string | null;
}): string[] {
  if (input.nativeSpecialPolicy?.useEquippedWeaponSpecial !== true) return [];
  const ids: string[] = [];
  const weaponId = input.equipmentEffects?.activeWeapon?.specialAttackId;
  if (typeof weaponId === "string" && weaponId.length > 0) ids.push(weaponId);
  const stored = input.eofStoredSpecialId;
  if (typeof stored === "string" && stored.length > 0 && !ids.includes(stored)) {
    ids.push(stored);
  }
  return ids;
}

/** Spirit event identity: a pending auto/poison event is live only for its summon instance. */
export interface SpiritEventMeta {
  id: ConjureId;
  untilTick: number;
  kind: "auto" | "poison";
}

/** Mutable simulation state for one stochastic lane. */
export interface SimulationRuntime {
  readonly input: CastContextInput;
  /** Bookkeeping depth (default full-analysis). */
  readonly detailLevel: SimulationDetailLevel;
  /** Runs with a horizon land events only before it (half-open). */
  readonly horizon?: number;
  readonly byId: ReadonlyMap<string, AbilitySpec>;
  readonly basicByStyle: ReadonlyMap<AbilitySpec["style"], AbilitySpec>;
  /**
   * First auto-special candidate (weapon preferred over EoF store).
   * Prefer `nativeSpecials` when both weapon and EoF store can fire.
   */
  readonly nativeSpecial: AbilitySpec | null;
  /**
   * Auto specials when policy is on: equipped weapon special first, then a
   * distinct EoF store (Roar Soulfire + EoF Instability both must fire).
   */
  readonly nativeSpecials: readonly AbilitySpec[];
  /**
   * Equipment-static Leng land outcome table (null when no Leng passives).
   * Compiled once in createRuntime; shared across stochastic lanes.
   */
  readonly lengLandTable: CompiledLengLandTable | null;
  readonly stochastic: StochasticOracle;
  readonly playerPoisonDamageCache: Map<string, unknown>;
  readonly leagueDamageCache: Map<string, unknown>;
  /** Concrete Ruby/Onyx outcomes shared by cast resolution and landed state. */
  readonly boltProcOutcomes: Map<string, boolean>;
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

/** Invocation-local memo tables shared by lanes. */
export interface RuntimeSharedCaches {
  readonly playerPoisonDamageCache: Map<string, unknown>;
  readonly leagueDamageCache: Map<string, unknown>;
}

export function createRuntimeSharedCaches(): RuntimeSharedCaches {
  return {
    playerPoisonDamageCache: new Map(),
    leagueDamageCache: new Map(),
  };
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
  sharedCaches?: RuntimeSharedCaches,
): SimulationRuntime {
  noteRuntimeCreated();
  const runtimeInput = prepareRuntimeInput(input);
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
  if (input.targetMaximumLifePoints != null && !Number.isFinite(input.targetMaximumLifePoints)) {
    throw new RangeError(
      `targetMaximumLifePoints must be finite: ${input.targetMaximumLifePoints}`,
    );
  }
  if (
    input.playerVitality != null &&
    (!Number.isFinite(input.playerVitality.maximumLifePoints) ||
      input.playerVitality.maximumLifePoints < 0 ||
      !Number.isFinite(input.playerVitality.currentLifePoints) ||
      input.playerVitality.currentLifePoints < 0)
  ) {
    throw new RangeError("playerVitality must contain finite non-negative life points");
  }
  if (
    input.playerMaximumLifePoints != null &&
    (!Number.isFinite(input.playerMaximumLifePoints) || input.playerMaximumLifePoints < 0)
  ) {
    throw new RangeError(
      `playerMaximumLifePoints must be finite and non-negative: ${input.playerMaximumLifePoints}`,
    );
  }
  if (
    input.playerHpPercent != null &&
    (!Number.isFinite(input.playerHpPercent) ||
      input.playerHpPercent < 0 ||
      input.playerHpPercent > 100)
  ) {
    throw new RangeError(`playerHpPercent outside 0-100: ${input.playerHpPercent}`);
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
  // Weapon special and distinct EoF store are both auto candidates when policy on.
  const nativeSpecials = resolveAutoSpecialIds(input)
    .map((id) => byId.get(id))
    .filter((spec): spec is AbilitySpec => spec != null);
  const nativeSpecial = nativeSpecials[0] ?? null;
  const equipment = input.equipmentEffects;
  const lengLandTable = lengLandTableFor(
    hasPassive(equipment, "leng-endless-frost"),
    hasPassive(equipment, "leng-boundless-chill"),
  );
  // Soulbound lantern from equipped ids only - never invent from requested souls.
  const soulboundLantern =
    input.equipmentIds?.some((id) => id === "item:soulbound-lantern") === true;
  const playerVitality =
    input.playerVitality ??
    (input.playerMaximumLifePoints != null && input.playerMaximumLifePoints > 0
      ? {
          maximumLifePoints: input.playerMaximumLifePoints,
          currentLifePoints:
            (input.playerMaximumLifePoints * (input.playerHpPercent ?? 100)) / 100,
        }
      : undefined);
  let state = newRotationState({
    adrenaline: input.startingAdrenaline,
    adrenalineCap,
    naturalInstinctUntilTick: input.naturalInstinctUntilTick,
    league: needsLeagueRuntimeClocks(input.league),
    ringOfVigour: input.adrenaline?.ringOfVigour === true,
    lantern: soulboundLantern,
    ...(playerVitality && playerVitality.maximumLifePoints > 0
      ? { player: { ...playerVitality } }
      : {}),
  });
  state = patchTarget(state, { weaponPoison: inactiveTargetWeaponPoison() });
  const targetMaximumLifePoints = input.targetMaximumLifePoints;
  if (targetMaximumLifePoints !== undefined && targetMaximumLifePoints > 0) {
    const targetHpPercent = input.targetHpPercent ?? 100;
    state = patchTarget(state, {
      vitality: {
        maximumLifePoints: targetMaximumLifePoints,
        currentLifePoints: (targetMaximumLifePoints * targetHpPercent) / 100,
      },
    });
  }
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
  const analysis = emptyAnalysisState();
  const song = input.equipmentEffects?.songOfDestruction;
  if (song) {
    analysis.song = {
      ...analysis.song,
      pieceCount: song.pieceCount,
      enabled: song.enabled,
      twoPiece: song.twoPiece,
    };
  }
  const rt: SimulationRuntime = {
    input: runtimeInput,
    detailLevel: resolveDetailLevel(input.detailLevel),
    horizon: input.horizonTicks,
    byId,
    basicByStyle,
    nativeSpecial,
    nativeSpecials,
    lengLandTable,
    stochastic: createStochasticOracle(
      stochastic ?? { laneIndex: 0, laneCount: DEFAULT_STOCHASTIC_LANES },
    ),
    playerPoisonDamageCache: sharedCaches?.playerPoisonDamageCache ?? new Map(),
    leagueDamageCache: sharedCaches?.leagueDamageCache ?? new Map(),
    boltProcOutcomes: new Map(),
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
    analysis,
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
    boltProcOutcomes: new Map(rt.boltProcOutcomes),
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
