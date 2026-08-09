import { afterEach, describe, expect, it } from "vitest";
import { EventQueue, type ScheduledEvent } from "../engine/runtime/events";
import {
  isAllocationProfilingEnabled,
  noteAbilityMapRebuild,
  noteCatalogueArrayRebuild,
  noteRuntimeCreated,
  resetAllocationCounters,
  setAllocationProfiling,
  snapshotAllocationCounters,
} from "./allocation";

const event = (over: Partial<ScheduledEvent> = {}): ScheduledEvent => ({
  tick: 0,
  seq: 0,
  family: "hit",
  abilityId: "a",
  sourceCast: 0,
  hitIndex: 0,
  attached: false,
  procEligible: true,
  recursionAllowed: false,
  provenance: { kind: "player_direct" },
  resolve: () => ({ damage: { min: 0, max: 0, expected: 0 } }),
  ...over,
});

describe("allocation profiling counters", () => {
  afterEach(() => {
    resetAllocationCounters();
    setAllocationProfiling(false);
  });

  it("stays zero while disabled", () => {
    setAllocationProfiling(false);
    resetAllocationCounters();
    noteRuntimeCreated();
    noteAbilityMapRebuild();
    noteCatalogueArrayRebuild();
    const q = new EventQueue();
    q.push(event({ tick: 1, seq: 0 }));
    q.shift();
    expect(snapshotAllocationCounters()).toEqual({
      runtimeObjectsCreated: 0,
      abilityMapRebuilds: 0,
      catalogueArrayRebuilds: 0,
      eventQueueOps: 0,
      eventQueuePush: 0,
      eventQueueShift: 0,
      eventQueueCancel: 0,
      eventQueueMaxDepth: 0,
      castsGrowthOps: 0,
      historyEventsGrowthOps: 0,
      attachedTermsResolved: 0,
      blessingIndexRebuilds: 0,
      blessingDamageCacheHits: 0,
      blessingDamageCacheMisses: 0,
    });
  });

  it("counts runtime / evaluate map rebuilds and event queue ops when enabled", () => {
    setAllocationProfiling(true);
    resetAllocationCounters();
    expect(isAllocationProfilingEnabled()).toBe(true);

    noteRuntimeCreated();
    noteAbilityMapRebuild();
    noteCatalogueArrayRebuild();

    const q = new EventQueue();
    q.push(event({ tick: 1, seq: 0 }));
    q.push(event({ tick: 2, seq: 1 }));
    q.shift();
    q.cancelBySeq(1);

    const snap = snapshotAllocationCounters();
    expect(snap.runtimeObjectsCreated).toBe(1);
    expect(snap.abilityMapRebuilds).toBe(1);
    expect(snap.catalogueArrayRebuilds).toBe(1);
    expect(snap.eventQueuePush).toBe(2);
    expect(snap.eventQueueShift).toBe(1);
    expect(snap.eventQueueCancel).toBe(1);
    expect(snap.eventQueueOps).toBe(4);
    expect(snap.eventQueueMaxDepth).toBe(2);
  });
});
