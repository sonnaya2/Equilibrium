import type { AttachedDamageComponent, EventResolution, ResolvedDamage } from "../resolution/types";
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

export type EventFamily =
  "hit" | "dot" | "proc" | "blessing" | "conjureAuto" | "command" | "poison" | "player";

export type StatefulOccurrenceModel =
  | { readonly kind: "bernoulli"; readonly probability: number }
  | {
      readonly kind: "geometric";
      readonly startProbability: number;
      readonly continuationProbability: number;
    };

export type DamageOriginKind =
  "direct" | "dot" | "command" | "conjure" | "proc" | "blessing" | "poison";

export interface ScheduledEvent<RT = unknown> {
  tick: number;
  seq: number;
  family: EventFamily;
  abilityId: string;
  sourceCast: number;
  hitIndex: number;
  attached: boolean;
  procEligible: boolean;
  recursionAllowed: boolean;
  blessingId?: BlessingId;
  damageTag?: BlessingDamageTag;
  bonusTargetId?: string;
  analysisGroupId?: string;
  analysisGroupActivations?: number;
  expectedOccurrences?: number;
  expectedTriggerRolls?: number;
  expectedActivations?: number;
  expectedSeparateHits?: number;
  occurrenceModel?: StatefulOccurrenceModel;
  originKind?: DamageOriginKind;
  provenance: DamageProvenance;
  cancelOwner?: number;
  derivedFrom?: number;
  flowReduction?: number;
  convertedChannel?: boolean;
  dotKind?: DamageOverTimeKind;
  bleedId?: BleedId;
  bleedExpiresAtTick?: number;
  lightningSurge?: boolean;
  castSnap?: CastSnapshot;
  resolve: (rt: RT, landTick: number) => EventResolution;
}

export interface ResolvedEvent<RT = unknown> extends Omit<ScheduledEvent<RT>, "resolve"> {
  damage: ResolvedDamage;
  components?: readonly AttachedDamageComponent[];
  stackCount?: number;
  remainingTicks?: number;
}

function compareEvents<RT>(a: ScheduledEvent<RT>, b: ScheduledEvent<RT>): number {
  return a.tick - b.tick || a.seq - b.seq;
}

export class EventQueue<RT = unknown> {
  private heap: ScheduledEvent<RT>[] = [];
  private ordered: readonly ScheduledEvent<RT>[] | null = null;

  private invalidateOrdered(): void {
    this.ordered = null;
  }

  private siftUp(index: number): void {
    const event = this.heap[index]!;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (compareEvents(this.heap[parent]!, event) <= 0) break;
      this.heap[index] = this.heap[parent]!;
      index = parent;
    }
    this.heap[index] = event;
  }

  private siftDown(index: number): void {
    const length = this.heap.length;
    const event = this.heap[index]!;
    for (;;) {
      const left = index * 2 + 1;
      if (left >= length) break;
      const right = left + 1;
      const child =
        right < length && compareEvents(this.heap[right]!, this.heap[left]!) < 0 ? right : left;
      if (compareEvents(this.heap[child]!, event) >= 0) break;
      this.heap[index] = this.heap[child]!;
      index = child;
    }
    this.heap[index] = event;
  }

  private heapify(): void {
    for (let index = (this.heap.length >> 1) - 1; index >= 0; index--) this.siftDown(index);
  }

  private cancelMatching(predicate: (event: ScheduledEvent<RT>) => boolean): number {
    const before = this.heap.length;
    this.heap = this.heap.filter((event) => !predicate(event));
    const removed = before - this.heap.length;
    if (removed > 0) {
      this.heapify();
      this.invalidateOrdered();
    }
    noteEventQueueCancel(removed);
    return removed;
  }

  push(event: ScheduledEvent<RT>): void {
    this.heap.push(event);
    noteEventQueuePush(this.heap.length);
    this.siftUp(this.heap.length - 1);
    this.invalidateOrdered();
  }

  peek(): ScheduledEvent<RT> | undefined {
    return this.heap[0];
  }

  shift(): ScheduledEvent<RT> | undefined {
    noteEventQueueShift();
    const first = this.heap[0];
    if (first === undefined) return undefined;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    this.invalidateOrdered();
    return first;
  }

  maxTick(): number {
    let max = -1;
    for (const event of this.heap) max = Math.max(max, event.tick);
    return max;
  }

  cancelByOwner(owner: number): number {
    return this.cancelMatching((event) => event.cancelOwner === owner);
  }

  cancelBySeq(seq: number): boolean {
    return this.cancelMatching((event) => event.seq === seq) > 0;
  }

  cancelWhere(predicate: (event: ScheduledEvent<RT>) => boolean): number {
    return this.cancelMatching(predicate);
  }

  pending(): readonly ScheduledEvent<RT>[] {
    this.ordered ??= [...this.heap].sort(compareEvents);
    return this.ordered;
  }

  clone(): EventQueue<RT> {
    const next = new EventQueue<RT>();
    next.heap = [...this.heap];
    next.ordered = this.ordered;
    return next;
  }

  get length(): number {
    return this.heap.length;
  }
}
