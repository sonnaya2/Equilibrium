import type { EventResolution, ResolvedDamage } from "../resolution/types";
import type { BleedId, DamageOverTimeKind } from "../../types";
import type { BlessingId } from "../../../league/blessings";
import type { BlessingDamageTag } from "../../league/damage";
import type { DamageProvenance } from "../../shared/damageProvenance";
import type { CastSnapshot } from "../cast/snapshot";
import {
  noteEventQueueCancel,
  noteEventQueuePush,
  noteEventQueueShift,
} from "../../profiling/allocation";

export type { EventResolution, ResolvedDamage } from "../resolution/types";

const US = "\x1f";
const RS = "\x1e";

/**
 * Branch-key ranks for pending events only (runtime seqs stay absolute).
 * - seqRank: absolute event seq -> 0..n-1 by queue (tick, seq) order
 * - castRank: cast ids appearing on pending events -> dense 0..m-1 by abs order
 * - histDerivedRank: derivedFrom targets not in pending -> dense 0..h-1 by abs order
 *
 * Deferred: state cast ids (grantedByCast, puncture owner) outside the pending set.
 */
export interface PendingKeyRanks {
  readonly seqRank: ReadonlyMap<number, number>;
  readonly castRank: ReadonlyMap<number, number>;
  readonly histDerivedRank: ReadonlyMap<number, number>;
}

/** Build key-only ranks from a pending list (already ordered by tick, seq). */
export function pendingKeyRanks(
  items: readonly ScheduledEvent<unknown>[],
): PendingKeyRanks {
  const seqRank = new Map<number, number>();
  const castIds = new Set<number>();
  const histDerived = new Set<number>();
  for (let i = 0; i < items.length; i++) {
    const e = items[i]!;
    seqRank.set(e.seq, i);
    if (e.sourceCast >= 0) castIds.add(e.sourceCast);
    if (e.cancelOwner != null && e.cancelOwner >= 0) castIds.add(e.cancelOwner);
    if (e.castSnap) castIds.add(e.castSnap.castSeq);
  }
  for (const e of items) {
    const d = e.derivedFrom;
    if (d == null) continue;
    if (!seqRank.has(d)) histDerived.add(d);
  }
  const castRank = new Map<number, number>();
  const sortedCasts = [...castIds].sort((a, b) => a - b);
  for (let i = 0; i < sortedCasts.length; i++) castRank.set(sortedCasts[i]!, i);
  const histDerivedRank = new Map<number, number>();
  const sortedHist = [...histDerived].sort((a, b) => a - b);
  for (let i = 0; i < sortedHist.length; i++) histDerivedRank.set(sortedHist[i]!, i);
  return { seqRank, castRank, histDerivedRank };
}

/**
 * Map an event-seq reference for branch keys.
 * none=-1; pending rank r>=0; historical rank h encoded as -2-h (<= -2).
 * Namespaces never collide: pending, none, and historical occupy disjoint ranges.
 */
export function mapEventRefForKey(
  abs: number | undefined | null,
  ranks: PendingKeyRanks,
): number {
  if (abs == null) return -1;
  const pending = ranks.seqRank.get(abs);
  if (pending !== undefined) return pending;
  const hist = ranks.histDerivedRank.get(abs);
  if (hist !== undefined) return -2 - hist;
  // Ref not in pending graph (e.g. spirit meta stray): keep absolute offset below hist space.
  // Unreachable for derivedFrom built via pendingKeyRanks; kept for meta key safety.
  return -2 - ranks.histDerivedRank.size - 1 - abs;
}

function mapCastRefForKey(
  abs: number | undefined | null,
  ranks: PendingKeyRanks,
  missing: number,
): number {
  if (abs == null) return missing;
  if (abs < 0) return abs;
  return ranks.castRank.get(abs) ?? abs;
}

/** Compact cast-snap fingerprint (branch-equivalence; castSeq is key-rank when provided). */
function snapSig(s: CastSnapshot, castSeqKey: number): string {
  let mods = "";
  for (const m of s.baseMods) {
    mods += m.id + US + String(m.stage) + US + String(m.priority) + RS;
  }
  return (
    castSeqKey +
    US +
    s.critLayers.chance +
    US +
    (s.critLayers.damageBonus ?? 0) +
    US +
    (s.critLayers.guaranteed ? 1 : 0) +
    US +
    (s.critLayers.disabled ? 1 : 0) +
    US +
    (s.critLayers.eligible === false ? 0 : 1) +
    US +
    mods +
    US +
    s.empowerMult +
    US +
    s.enduringRuinBonus +
    US +
    (s.chaosRoarActive ? 1 : 0) +
    US +
    (s.channelled ? 1 : 0) +
    US +
    (s.greaterFuryActive ? 1 : 0) +
    US +
    (s.furyActive ? 1 : 0) +
    US +
    s.firstEligibleHitIndex +
    US +
    (s.searingWindsAtCast ? 1 : 0) +
    US +
    (s.hauntedAtCast ? 1 : 0) +
    US +
    s.hauntedCapAd
  );
}

function eventSig(
  e: ScheduledEvent<unknown>,
  seqKey: number,
  ranks: PendingKeyRanks,
): string {
  const sourceCastKey = mapCastRefForKey(e.sourceCast, ranks, -1);
  const cancelOwnerKey = mapCastRefForKey(e.cancelOwner, ranks, -1);
  const derivedFromKey = mapEventRefForKey(e.derivedFrom, ranks);
  const castSnapKey =
    e.castSnap != null
      ? snapSig(e.castSnap, mapCastRefForKey(e.castSnap.castSeq, ranks, 0))
      : "";
  return (
    e.tick +
    US +
    seqKey +
    US +
    e.family +
    US +
    e.abilityId +
    US +
    sourceCastKey +
    US +
    e.hitIndex +
    US +
    (e.attached ? 1 : 0) +
    US +
    (e.procEligible ? 1 : 0) +
    US +
    (e.recursionAllowed ? 1 : 0) +
    US +
    (e.blessingId ?? "") +
    US +
    (e.expectedOccurrences ?? 1) +
    US +
    cancelOwnerKey +
    US +
    derivedFromKey +
    US +
    (e.flowReduction ?? 0) +
    US +
    (e.convertedChannel ? 1 : 0) +
    US +
    (e.dotKind ?? "") +
    US +
    (e.bleedId ?? "") +
    US +
    (e.bleedExpiresAtTick ?? -1) +
    US +
    (e.originKind ?? "") +
    US +
    (e.triggerRolls ?? "") +
    US +
    (e.expectedActivations ?? "") +
    US +
    (e.expectedSeparateHits ?? "") +
    US +
    (e.damageTag ?? "") +
    US +
    e.provenance.kind +
    US +
    (e.provenance.detail ?? "") +
    US +
    (e.lightningSurge ? 1 : 0) +
    US +
    castSnapKey
  );
}

/**
 * Pending damage/state events. Resolve at land time against that tick's state
 * (Sunshine / Berserk / Searing Winds not frozen at cast). Order: (tick, seq);
 * seq is monotonic and follows cast flow (hits by hit-index, then on-cast effects).
 */
export type EventFamily =
  | "hit"
  | "dot"
  | "proc"
  | "blessing"
  | "conjureAuto"
  | "command"
  | "poison"
  /** Player-side meta (heals, buff expire). Resolvers may mutate player state. */
  | "player";

/** Analysis damage origin. Derived/attached keep parent origin (e.g. Big Boned on bleed stays "dot"). */
export type DamageOriginKind = "direct" | "dot" | "command" | "conjure" | "proc" | "blessing";

/**
 * RT is the land-time runtime. Events do not close over a runtime so branches can
 * share pending events and resolve each against their own state.
 */
export interface ScheduledEvent<RT = unknown> {
  tick: number; // land tick
  seq: number; // monotonic per simulation run - explicit same-tick tiebreak
  family: EventFamily;
  abilityId: string; // ability or spirit that produced it
  sourceCast: number; // cast sequence number, or -1 for autonomous schedulers
  hitIndex: number; // 0-based within the source cast/scheduler
  attached: boolean; // true = attached damage component, NOT a separate proc-eligible hit
  procEligible: boolean; // may trigger on-hit procs / stack generation / hit counters
  recursionAllowed: boolean; // may recursively create events of the same family
  blessingId?: BlessingId;
  /** Analysis tag for bonus-damage riders (e.g. Big Boned). */
  damageTag?: BlessingDamageTag;
  /**
   * Legacy application weight for expected-value events. Prefer the explicit
   * multiplicity fields below; kept so older schedulers and tests still work.
   */
  expectedOccurrences?: number;
  /** Probability rolls represented by this event (e.g. one Inferno 5% roll). */
  triggerRolls?: number;
  /** Expected activations represented (0.05 for one 5% roll). */
  expectedActivations?: number;
  /** Expected separate hits represented; 0 when attached. */
  expectedSeparateHits?: number;
  /** Damage-origin provenance for analysis (direct vs DoT vs proc…). */
  originKind?: DamageOriginKind;
  /** Capability-derived provenance for gear/blessing gates (serializable). */
  provenance: DamageProvenance;
  cancelOwner?: number; // cast sequence whose cancellation removes this event
  /** Source event seq this hit derives its damage from (Bloat tails, Death Skulls bounces). */
  derivedFrom?: number;
  /** Flow reduction carried by the Sonic hit that can grant it. */
  flowReduction?: number;
  /** Greater Barge converted a channel hit into Endless Assault damage over time. */
  convertedChannel?: boolean;
  dotKind?: DamageOverTimeKind;
  bleedId?: BleedId;
  bleedExpiresAtTick?: number;
  /** Marker: event is Lightning Surge damage; snap lives on castSnap. */
  lightningSurge?: boolean;
  /** Cast-scoped snapshot for land-time resolve. */
  castSnap?: CastSnapshot;
  /** Calculates AT LAND TIME; never writes to the runtime's ledgers. */
  resolve: (rt: RT, landTick: number) => EventResolution;
}

export interface ResolvedEvent<RT = unknown> extends Omit<ScheduledEvent<RT>, "resolve"> {
  damage: ResolvedDamage;
  stackCount?: number;
  remainingTicks?: number;
}

/** Ordered by (tick, seq). Cancel via cancelOwner / cancelBySeq. */
export class EventQueue<RT = unknown> {
  private items: ScheduledEvent<RT>[] = [];

  push(event: ScheduledEvent<RT>): void {
    noteEventQueuePush();
    let i = this.items.length;
    while (i > 0) {
      const prev = this.items[i - 1]!;
      if (prev.tick < event.tick || (prev.tick === event.tick && prev.seq < event.seq)) break;
      i--;
    }
    this.items.splice(i, 0, event);
  }

  /** Next event in (tick, seq) order, without removing it. */
  peek(): ScheduledEvent<RT> | undefined {
    return this.items[0];
  }

  /** Remove and return the next event in (tick, seq) order. */
  shift(): ScheduledEvent<RT> | undefined {
    noteEventQueueShift();
    return this.items.shift();
  }

  /** Largest scheduled tick in the queue (-1 when empty). */
  maxTick(): number {
    let max = -1;
    for (const e of this.items) if (e.tick > max) max = e.tick;
    return max;
  }

  /** Remove every pending event owned by `cancelOwner`; returns the count. */
  cancelByOwner(owner: number): number {
    const before = this.items.length;
    this.items = this.items.filter((e) => e.cancelOwner !== owner);
    const removed = before - this.items.length;
    noteEventQueueCancel(removed);
    return removed;
  }

  /** Remove one pending event by seq; returns true when it was present. */
  cancelBySeq(seq: number): boolean {
    const before = this.items.length;
    this.items = this.items.filter((e) => e.seq !== seq);
    const removed = before - this.items.length;
    noteEventQueueCancel(removed);
    return removed > 0;
  }

  /** Remove every pending event matching `pred`; returns the count. */
  cancelWhere(pred: (event: ScheduledEvent<RT>) => boolean): number {
    const before = this.items.length;
    this.items = this.items.filter((e) => !pred(e));
    const removed = before - this.items.length;
    noteEventQueueCancel(removed);
    return removed;
  }

  /** Still-pending events, in order. */
  pending(): readonly ScheduledEvent<RT>[] {
    return this.items;
  }

  /** Shallow copy sharing the (immutable) events - used by branch snapshots. */
  clone(): EventQueue<RT> {
    const next = new EventQueue<RT>();
    next.items = [...this.items];
    return next;
  }

  /**
   * Branch-equivalence fingerprint of pending events (no resolve closures).
   * Key-only: seq / sourceCast / cancelOwner / castSnap.castSeq / derivedFrom
   * use dense ranks within this pending set so drained history allocators
   * do not false-split equivalent futures. Runtime seqs stay absolute.
   * Relative graphs (shared owners, derived edges) still distinguish.
   */
  signature(): string {
    const items = this.items;
    if (items.length === 0) return "";
    const ranks = pendingKeyRanks(items as ScheduledEvent<unknown>[]);
    let out = eventSig(items[0] as ScheduledEvent<unknown>, 0, ranks);
    for (let i = 1; i < items.length; i++) {
      out += RS + eventSig(items[i] as ScheduledEvent<unknown>, i, ranks);
    }
    return out;
  }

  get length(): number {
    return this.items.length;
  }
}
