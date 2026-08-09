import { describe, expect, it } from "vitest";
import { calculateHit } from "../../pipeline/calculateHit";
import { STANDARD_HIT_CAP } from "../../core/hitCaps";
import { mulFloor } from "../../core/rounding";
import { MODERNISATION_WIKI } from "../../data/sources";
import { necroInput as necroFixtureInput } from "../../test/fixtures/inputs";
import { vulnerabilityModifier } from "../../shared/vulnerability";
import type { CombatModifier } from "../../types";
import { commitCast, performCast, prepareSimulationCast } from "../cast";
import { advanceTo } from "../runtime/clock";
import { createRuntime } from "../runtime/runtime";
import { patchTarget } from "../runtime/state";
import { rotationOf } from "../simulation/contracts";
import { finish } from "../simulation/summary";
import { simulate } from "../simulation/simulate";
import { applyHaunted } from "../../styles/necromancy/haunted";
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

  it("uses live Skeleton Rage stacks before incrementing after each basic auto", () => {
    const summary = simulate({
      ...necroFixtureInput,
      rotation: rotationOf("conjure_skeleton_warrior", ...Array(10).fill("necromancy_basic")),
    });
    const autos = summary.events.filter(
      (event) => event.family === "conjureAuto" && event.abilityId === "spirit_skeleton_warrior",
    );

    expect(autos.slice(0, 3).map((event) => event.damage.expected)).toEqual([250, 257, 264.5]);
  });

  it("derives Ghost healing from each final auto hit", () => {
    const plainRotation = rotationOf(
      "conjure_vengeful_ghost",
      ...Array(20).fill("necromancy_basic"),
    );
    const run = (patch: Partial<typeof necroFixtureInput> & { rotation: typeof plainRotation }) =>
      simulate({ ...necroFixtureInput, ...patch });
    const plain = run({ rotation: plainRotation });
    const firstNecromancer = run({ rotation: plainRotation, conjureBasicDamageMult: 1.14 });
    const vulnerable = run({ rotation: plainRotation, modifiers: [vulnerabilityModifier()] });
    const hauntedRuntime = createRuntime(necroFixtureInput);
    const ghost = hauntedRuntime.byId.get("conjure_vengeful_ghost")!;
    expect(performCast(hauntedRuntime, ghost, 0, false).ok).toBe(true);
    hauntedRuntime.state = patchTarget(hauntedRuntime.state, {
      haunted: applyHaunted(1, necroFixtureInput.base),
    });
    advanceTo(hauntedRuntime, 6);
    const haunted = finish(hauntedRuntime);
    const ghostHits = (summary: typeof plain) =>
      summary.events.filter(
        (event) => event.family === "conjureAuto" && event.abilityId === "spirit_vengeful_ghost",
      );
    const expectedHealing = (summary: typeof plain) =>
      ghostHits(summary).reduce(
        (total, event) => total + Math.floor(event.damage.expected * 1.4),
        0,
      );

    for (const summary of [plain, firstNecromancer, vulnerable, haunted]) {
      expect(summary.ok).toBe(true);
      expect(ghostHits(summary).length).toBeGreaterThan(0);
      expect(summary.totalHealed).toBe(expectedHealing(summary));
    }
    expect(firstNecromancer.totalExpected).toBeGreaterThan(plain.totalExpected);
    expect(vulnerable.totalExpected).toBeGreaterThan(plain.totalExpected);
    expect(haunted.totalHealed).toBeGreaterThan(0);
    expect(ghostHits(haunted).some((event) => event.damage.expected > 200)).toBe(true);
    expect(
      ghostHits(haunted).some((event) =>
        event.components?.some((component) => component.id === "haunted"),
      ),
    ).toBe(true);
    expect(plain.totalHealed).not.toBe(plain.totalExpected);
  });

  it("limits First Necromancer to Skeleton basic autos, preserving Rage and commands", () => {
    const rotation = rotationOf(
      "conjure_skeleton_warrior",
      "command_skeleton_warrior",
      ...Array(14).fill("necromancy_basic"),
    );
    const plain = simulate({ ...necroFixtureInput, rotation });
    const boosted = simulate({ ...necroFixtureInput, rotation, conjureBasicDamageMult: 1.35 });
    const autos = (summary: typeof plain) =>
      summary.events.filter(
        (event) => event.family === "conjureAuto" && event.abilityId === "spirit_skeleton_warrior",
      );
    const commands = (summary: typeof plain) =>
      summary.casts.filter((cast) => cast.abilityId === "command_skeleton_warrior");

    expect(plain.ok && boosted.ok).toBe(true);
    expect(autos(boosted).map((event) => event.tick)).toEqual(
      autos(plain).map((event) => event.tick),
    );
    expect(commands(boosted).map((cast) => cast.tick)).toEqual(
      commands(plain).map((cast) => cast.tick),
    );
    expect(commands(boosted).map((cast) => cast.result.expected)).toEqual(
      commands(plain).map((cast) => cast.result.expected),
    );
    expect(boosted.perAbility["spirit_skeleton_warrior"]).toBeGreaterThan(
      plain.perAbility["spirit_skeleton_warrior"] ?? 0,
    );
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
