import { describe, expect, it } from "vitest";
import { calculateHit } from "../../pipeline/calculateHit";
import { STANDARD_HIT_CAP } from "../../core/hitCaps";
import { mulFloor } from "../../core/rounding";
import { MODERNISATION_WIKI } from "../../data/sources";
import { necroInput as necroFixtureInput } from "../../test/fixtures/inputs";
import type { CombatModifier } from "../../types";
import { commitCast, prepareSimulationCast } from "../cast";
import { createRuntime } from "../runtime/runtime";
import { rotationOf } from "../simulation/contracts";
import { simulate } from "../simulation/simulate";
import {
  applySkeletonCommand,
  conjureBasicDamageModifier,
  resolveConjureModifiers,
  SPIRIT_MODIFIER_SCOPE,
} from "./conjures";

describe("conjure mult before final cap", () => {
  it("keeps a near-cap conjure hit capped after its multiplier", () => {
    const base = Math.floor(STANDARD_HIT_CAP / 1.2);
    const mult = 1.35;
    const boosted = calculateHit({
      base,
      band: { minPct: 100, maxPct: 100 },
      level: 99,
      accuracy: 1,
      crit: { chance: 0, eligible: false },
      modifiers: [conjureBasicDamageModifier(mult)],
    });
    expect(boosted.max).toBe(STANDARD_HIT_CAP);
    expect(boosted.expected).toBe(STANDARD_HIT_CAP);
    expect(boosted.expected).toBeLessThan(Math.floor(base * mult) + 0.001);
  });
  it("computes conjure capLoss from the true uncapped hit", () => {
    const base = Math.floor(STANDARD_HIT_CAP / 1.2);
    const mult = 1.35;
    const boosted = calculateHit({
      base,
      band: { minPct: 100, maxPct: 100 },
      level: 99,
      accuracy: 1,
      crit: { chance: 0, eligible: false },
      modifiers: [conjureBasicDamageModifier(mult)],
    });
    const uncapped = Math.floor(base * mult);
    expect(boosted.uncappedExpected).toBe(uncapped);
    expect(boosted.capLoss).toBe(uncapped - STANDARD_HIT_CAP);
  });
  it("applies First Necromancer mult on the spirit path", () => {
    const rot = rotationOf("conjure_skeleton_warrior", ...Array(20).fill("necromancy_basic"));
    const base = simulate({ ...necroFixtureInput, rotation: rot });
    const boosted = simulate({ ...necroFixtureInput, rotation: rot, conjureBasicDamageMult: 1.35 });
    expect(base.ok && boosted.ok).toBe(true);
    const r =
      (boosted.perAbility["spirit_skeleton_warrior"] ?? 0) /
      (base.perAbility["spirit_skeleton_warrior"] ?? 1);
    expect(r).toBeCloseTo(1.35, 2);
  });
});

describe("spirit modifier seam", () => {
  it("resolveConjureModifiers filters prayers", () => {
    const globalBuff: CombatModifier = {
      id: "set:test",
      stage: "onHit",
      priority: 0,
      applies: () => true,
      apply: (s) => ({ ...s, damage: mulFloor(s.damage, 1.1) }),
      source: MODERNISATION_WIKI,
    };
    const prayer: CombatModifier = {
      id: "prayer:test",
      stage: "onCast",
      priority: 0,
      applies: () => true,
      apply: (s) => ({ ...s, damage: mulFloor(s.damage, 1.2) }),
      source: MODERNISATION_WIKI,
    };
    expect(resolveConjureModifiers([globalBuff, prayer]).map((m) => m.id)).toEqual(["set:test"]);
    const fromFn = resolveConjureModifiers((ability) => {
      expect(ability.id).toBe(SPIRIT_MODIFIER_SCOPE.id);
      return [globalBuff, prayer];
    });
    expect(fromFn.map((m) => m.id)).toEqual(["set:test"]);
  });
});

describe("spirit bookkeeping cleanup", () => {
  it("suppressed skeleton autos drop dead bookkeeping", () => {
    const rt = createRuntime(necroFixtureInput);
    const prep = prepareSimulationCast(rt, rt.byId.get("conjure_skeleton_warrior")!, 0);
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;
    commitCast(rt, prep.prepared, false);
    applySkeletonCommand(rt, 0);
    for (const seq of rt.spiritEventMeta.keys()) {
      expect(rt.queue.pending().some((e) => e.seq === seq)).toBe(true);
    }
  });
});
