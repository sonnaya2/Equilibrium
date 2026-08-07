import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import {
  resetHitPipelineCounters,
  setHitPipelineProfiling,
  snapshotHitPipelineCounters,
} from "../../profiling/hitPipeline";
import { createRuntime } from "../runtime/runtime";
import { prepareCast } from "../cast/prepare";
import { resolveCastHit } from "./castHit";
import { hitReuseSize, runWithHitReuseScope } from "./hitReuse";
import { patchMelee } from "../runtime/state";

const assault = MELEE_ABILITIES.find((a) => a.id === "assault")!;

function runtimeWithAssault() {
  const rt = createRuntime({
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    abilities: MELEE_ABILITIES,
    context: { style: "melee" },
  });
  return rt;
}

describe("hit reuse under multi-branch land identity", () => {
  it("memoizes ability modifier programs across equivalent branch casts", () => {
    let builds = 0;
    const rt = createRuntime({
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: MELEE_ABILITIES,
      context: { style: "melee" },
      modifiers: () => {
        builds += 1;
        return [];
      },
    });
    const first = prepareCast(rt, assault, 0);
    const second = prepareCast(rt, assault, 0);
    expect(first.snap.baseMods).toBe(second.snap.baseMods);
    expect(builds).toBe(1);
  });

  it("reuses EventResolution for identical land context within a scope", () => {
    setHitPipelineProfiling(true);
    resetHitPipelineCounters();
    const rt = runtimeWithAssault();
    const prepared = prepareCast(rt, assault, 0);
    const hitSpec = prepared.working.hits[0]!;
    const snap = prepared.snap;

    runWithHitReuseScope(() => {
      const a = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      const b = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      expect(b).toBe(a);
      expect(hitReuseSize()).toBe(1);
    });

    const snapCounters = snapshotHitPipelineCounters();
    expect(snapCounters.hitExpectationCalls).toBe(1);
    setHitPipelineProfiling(false);
  });

  it("does not reuse when frostblades window differs", () => {
    setHitPipelineProfiling(true);
    resetHitPipelineCounters();
    const rt = runtimeWithAssault();
    const prepared = prepareCast(rt, assault, 0);
    const hitSpec = prepared.working.hits[0]!;
    const snap = prepared.snap;

    runWithHitReuseScope(() => {
      const cold = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      rt.state = patchMelee(rt.state, {
        primordialIce: {
          atoms: [{ weight: 1, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 50 }],
        },
      });
      const hot = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      expect(hot).not.toBe(cold);
      expect(hot.damage.expected).toBeGreaterThan(cold.damage.expected);
    });

    expect(snapshotHitPipelineCounters().hitExpectationCalls).toBe(2);
    setHitPipelineProfiling(false);
  });

  it("stack-only divergence still reuses (stacks do not affect land hit)", () => {
    setHitPipelineProfiling(true);
    resetHitPipelineCounters();
    const rt = runtimeWithAssault();
    const prepared = prepareCast(rt, assault, 0);
    const hitSpec = prepared.working.hits[0]!;
    const snap = prepared.snap;

    runWithHitReuseScope(() => {
      const a = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      rt.state = patchMelee(rt.state, {
        primordialIce: {
          atoms: [{ weight: 1, stacks: 7, stacksExpireAtTick: 0, frostbladesExpireAtTick: 0 }],
        },
      });
      const b = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
      expect(b).toBe(a);
    });

    expect(snapshotHitPipelineCounters().hitExpectationCalls).toBe(1);
    setHitPipelineProfiling(false);
  });

  it("inactive scope never reuses by reference", () => {
    const rt = runtimeWithAssault();
    const prepared = prepareCast(rt, assault, 0);
    const hitSpec = prepared.working.hits[0]!;
    const snap = prepared.snap;
    const a = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
    const b = resolveCastHit(rt, 0, hitSpec, 0, assault, snap, false);
    expect(b).not.toBe(a);
    expect(a.damage.expected).toBe(b.damage.expected);
  });
});
