import type { EventResolution, ResolvedDamage } from "../resolution/types";
import type { BleedId, DamageOverTimeKind } from "../../types";
import type { BlessingId } from "../../../league/blessings";
import type { BlessingDamageTag } from "../../league/damage";
import type { DamageProvenance } from "../../shared/damageProvenance";
import type { CastSnapshot } from "../cast/snapshot";

export type { EventResolution, ResolvedDamage } from "../resolution/types";

/** Branch-equivalence fingerprint for cast-scoped snapshot fields. */
function snapSig(s: CastSnapshot) {
  return [
    s.castSeq,
    s.critLayers.chance,
    s.critLayers.damageBonus ?? 0,
    s.critLayers.guaranteed ?? false,
    s.critLayers.disabled ?? false,
    s.critLayers.eligible ?? true,
    s.baseMods.map((m) => [m.id, m.stage, m.priority]),
    s.empowerMult,
    s.enduringRuinBonus,
    s.chaosRoarActive,
    s.channelled,
    s.greaterFuryActive,
    s.furyActive,
    s.firstEligibleHitIndex,
    s.searingWindsAtCast,
  ];
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
    return before - this.items.length;
  }

  /** Remove one pending event by seq; returns true when it was present. */
  cancelBySeq(seq: number): boolean {
    const before = this.items.length;
    this.items = this.items.filter((e) => e.seq !== seq);
    return this.items.length < before;
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
   */
  signature(): string {
    return JSON.stringify(
      this.items.map((e) => [
        e.tick,
        e.seq,
        e.family,
        e.abilityId,
        e.sourceCast,
        e.hitIndex,
        e.attached,
        e.procEligible,
        e.recursionAllowed,
        e.blessingId ?? null,
        e.expectedOccurrences ?? 1,
        e.cancelOwner ?? -1,
        e.derivedFrom ?? -1,
        e.flowReduction ?? 0,
        e.convertedChannel ?? false,
        e.dotKind ?? null,
        e.bleedId ?? null,
        e.bleedExpiresAtTick ?? -1,
        e.originKind ?? null,
        e.triggerRolls ?? null,
        e.expectedActivations ?? null,
        e.expectedSeparateHits ?? null,
        e.damageTag ?? null,
        e.provenance.kind,
        e.provenance.detail ?? null,
        e.castSnap ? snapSig(e.castSnap) : null,
      ]),
    );
  }

  get length(): number {
    return this.items.length;
  }
}
