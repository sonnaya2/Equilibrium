import { describe, expect, it } from "vitest";
import { createCastContext } from "../../engine/simulation/simulate";
import type { CastContextInput } from "../../engine/simulation/contracts";
import { resolveLeagueRules } from "../../league/ruleset";
import { findConjure } from "../../styles/necromancy/conjures";
import { necroInput } from "../fixtures/inputs";

/** 5% of max life; crit chance 0 keeps rider EV exact. */
const MAX_LIFE = 15_000;
const BB_PER_HIT = 750;

const baseNecro: CastContextInput = {
  ...necroInput,
  crit: { chance: 0 },
  context: { style: "necromancy" },
};

const withBigBoned: CastContextInput = {
  ...baseNecro,
  league: resolveLeagueRules(
    { ruleset: "equilibrium", blessingPicks: ["Balance"] },
    { maximumLife: MAX_LIFE },
  ),
  context: { style: "necromancy", ruleset: "equilibrium" },
};

/**
 * Summon skeleton, advance so spirit autos land, finish (no player basics).
 * First skeleton auto is cast+7, then every 5 ticks.
 */
function skeletonAutoSummary(input: CastContextInput, untilTick = 40) {
  const ctx = createCastContext(input);
  const conjure = ctx.byId.get("conjure_skeleton_warrior")!;
  expect(ctx.performCast(conjure, 0, false).ok).toBe(true);
  expect(findConjure(ctx.getState().necromancy.conjures, "skeleton_warrior")).toBeTruthy();
  ctx.advanceTo(untilTick);
  return ctx.finish();
}

describe("Big Boned rides conjure auto hits", () => {
  it("emits big-boned riders on skeleton conjure_auto path with expected damage delta", () => {
    const withBb = skeletonAutoSummary(withBigBoned);
    const without = skeletonAutoSummary(baseNecro);

    expect(withBb.ok).toBe(true);
    expect(without.ok).toBe(true);

    const autos = withBb.events.filter(
      (e) =>
        e.family === "conjureAuto" &&
        e.provenance?.kind === "conjure_auto" &&
        e.provenance.detail === "skeleton_warrior",
    );
    expect(autos.length).toBeGreaterThan(0);
    // Same skeleton track without the blessing.
    expect(
      without.events.filter(
        (e) => e.family === "conjureAuto" && e.provenance?.kind === "conjure_auto",
      ),
    ).toHaveLength(autos.length);

    const autoSeqs = new Set(autos.map((e) => e.seq));
    const riders = withBb.events.filter((e) => e.abilityId === "big-boned");
    expect(riders.length).toBe(autos.length);
    for (const rider of riders) {
      expect(rider.attached).toBe(true);
      expect(rider.damageTag).toBe("bonus-damage");
      expect(rider.originKind).toBe("conjure");
      expect(rider.blessingId).toBe("big-boned");
      expect(rider.provenance).toEqual({ kind: "blessing", detail: "big-boned" });
      expect(rider.derivedFrom).toBeDefined();
      expect(autoSeqs.has(rider.derivedFrom!)).toBe(true);
      expect(rider.damage.expected).toBe(BB_PER_HIT);
    }

    expect(without.events.filter((e) => e.abilityId === "big-boned")).toHaveLength(0);

    const bbTotal = riders.reduce((sum, e) => sum + e.damage.expected, 0);
    expect(bbTotal).toBe(autos.length * BB_PER_HIT);
    expect(withBb.totalExpected).toBeCloseTo(without.totalExpected + bbTotal, 6);
  });
});
