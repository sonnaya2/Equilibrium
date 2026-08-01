import type { EventResolution, ResolvedDamage } from "../resolution/types";

export type { EventResolution, ResolvedDamage } from "../resolution/types";

/**
 * Scheduled combat events: every damaging or state-changing thing the simulator
 * has promised for a future tick. Damage resolves AT LAND TIME against the state
 * at that tick (time-windowed globals like Sunshine / Berserk / Searing Winds are
 * evaluated there, not frozen at cast time). Same-tick order is (tick, seq);
 * `seq` is monotonic per simulation run and follows the canonical cast flow
 * (a cast's hits in hit-index order, then its on-cast effects), so the log is
 * deterministic for a given input.
 */
export type EventFamily = "hit" | "dot" | "proc" | "conjureAuto" | "command" | "poison";

/**
 * RT is the runtime context handed to `resolve` at land time. Events never close
 * over a runtime directly, so a branched/cloned runtime can share pending events
 * safely (each branch resolves them against its own state).
 */
export interface ScheduledEvent<RT = unknown> {
  tick: number; // land tick
  seq: number; // monotonic per simulation run — explicit same-tick tiebreak
  family: EventFamily;
  abilityId: string; // ability or spirit that produced it
  sourceCast: number; // cast sequence number, or -1 for autonomous schedulers
  hitIndex: number; // 0-based within the source cast/scheduler
  attached: boolean; // true = attached damage component, NOT a separate proc-eligible hit
  procEligible: boolean; // may trigger on-hit procs / stack generation / hit counters
  recursionAllowed: boolean; // may recursively create events of the same family
  cancelOwner?: number; // cast sequence whose cancellation removes this event
  /** Source event seq this hit derives its damage from (Bloat tails, Death Skulls bounces). */
  derivedFrom?: number;
  /** Flow reduction carried by the Sonic hit that can grant it. */
  flowReduction?: number;
  /** Greater Barge converted a channel hit into Endless Assault damage over time. */
  convertedChannel?: boolean;
  /** Calculates AT LAND TIME; never writes to the runtime's ledgers. */
  resolve: (rt: RT, landTick: number) => EventResolution;
}

export interface ResolvedEvent<RT = unknown> extends Omit<ScheduledEvent<RT>, "resolve"> {
  damage: ResolvedDamage;
}

/**
 * Ordered event queue. Push inserts at its (tick, seq) position (almost always
 * the tail, so this is a short walk); `due` extracts in order. Cancellation is
 * removal by `cancelOwner`.
 */
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

  /** Still-pending events, in order. */
  pending(): readonly ScheduledEvent<RT>[] {
    return this.items;
  }

  /** Shallow copy sharing the (immutable) events — used by branch snapshots. */
  clone(): EventQueue<RT> {
    const next = new EventQueue<RT>();
    next.items = [...this.items];
    return next;
  }

  /**
   * Structural signature for branch equivalence: EVERY branch-relevant field of
   * every pending event, in order (resolve closures excluded — equivalent
   * branches scheduled identical events from identical casts). `derivedFrom`
   * belongs here: two branches whose tails derive from different source hits
   * resolve to different damage and are not equivalent.
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
        e.cancelOwner ?? -1,
        e.derivedFrom ?? -1,
        e.flowReduction ?? 0,
        e.convertedChannel ?? false,
      ]),
    );
  }

  get length(): number {
    return this.items.length;
  }
}
