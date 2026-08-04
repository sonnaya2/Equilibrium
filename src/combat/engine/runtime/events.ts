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

/** Compact cast-snap fingerprint (branch-equivalence; same fields as prior JSON form). */
function snapSig(s: CastSnapshot): string {
  let mods = "";
  for (const m of s.baseMods) {
    mods += m.id + US + String(m.stage) + US + String(m.priority) + RS;
  }
  return (
    s.castSeq +
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
    (s.searingWindsAtCast ? 1 : 0)
  );
}

function eventSig(e: ScheduledEvent<unknown>): string {
  return (
    e.tick +
    US +
    e.seq +
    US +
    e.family +
    US +
    e.abilityId +
    US +
    e.sourceCast +
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
    (e.cancelOwner ?? -1) +
    US +
    (e.derivedFrom ?? -1) +
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
    (e.castSnap ? snapSig(e.castSnap) : "")
  );
}

/**
 * Pending damage/state events. Resolve at land time against that tick's state
 * (Sunshine / Berserk / Searing Winds not frozen at cast). Order: (tick, seq);
 * seq is monotonic and follows cast flow (hits by hit-index, then on-cast effects).
 */
export type EventFamily =
  "hit" | "dot" | "proc" | "blessing" | "conjureAuto" | "command" | "poison";

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
   * Includes derivedFrom: different source hits => different damage.
   * Compact multi-field string (equality-preserving vs prior JSON form).
   */
  signature(): string {
    const items = this.items;
    if (items.length === 0) return "";
    let out = eventSig(items[0] as ScheduledEvent<unknown>);
    for (let i = 1; i < items.length; i++) {
      out += RS + eventSig(items[i] as ScheduledEvent<unknown>);
    }
    return out;
  }

  get length(): number {
    return this.items.length;
  }
}
