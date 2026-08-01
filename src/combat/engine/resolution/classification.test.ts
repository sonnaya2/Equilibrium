import { describe, expect, it } from "vitest";
import { mulFloor } from "../../core/rounding";
import { MODERNISATION_WIKI } from "../../data/sources";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import type { CombatModifier } from "../../types";
import { rotationOf } from "../simulation/contracts";
import { simulate, type SimulateInput } from "../simulation/simulate";

/**
 * Event classification is declared by the ability, not inferred from when a hit
 * lands or whether it can crit. These cases pin the two axes apart.
 */

const prayer = (multiplier: number): CombatModifier => ({
  id: "prayer:test",
  stage: "onCast",
  priority: 0,
  applies: () => true,
  apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
  source: MODERNISATION_WIKI,
});

const magicInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MAGIC_ABILITIES,
  context: { style: "magic" },
  modifiers: [prayer(1.2)],
};

const rangedInput: Omit<SimulateInput, "rotation"> = {
  ...magicInput,
  abilities: RANGED_ABILITIES,
  context: { style: "ranged" },
};

describe("damage over time is declared, not inferred from timing", () => {
  it("Corruption Shot's first bleed tick ignores prayers like its later ticks", () => {
    // Wiki Corruption Shot (verified 2026-08-01): 5 damage-over-time hits, the
    // first landing on the cast tick. Landing at offset 0 must not promote it to
    // a direct hit that takes damage-boosting prayers.
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf(...Array(8).fill("ranged_attack"), "corruption_shot"),
    });
    expect(s.ok).toBe(true);
    const ticks = s.events.filter((e) => e.abilityId === "corruption_shot");
    expect(ticks).toHaveLength(5);
    expect(ticks.every((e) => e.family === "dot")).toBe(true);
    // 90-110% of 1000 → 1000 expected, with no prayer multiplier applied.
    expect(ticks[0].damage.expected).toBeCloseTo(1000);
  });

  it("Magma Tempest keeps prayers even though it cannot crit and lands late", () => {
    // Wiki Magma Tempest (verified 2026-08-01): "Damage from this ability is not
    // considered as damage over time", despite 8 non-critting hits over 16 ticks.
    const s = simulate({
      ...magicInput,
      rotation: rotationOf(...Array(8).fill("magic_attack"), "magma_tempest"),
    });
    expect(s.ok).toBe(true);
    const hits = s.events.filter((e) => e.abilityId === "magma_tempest");
    expect(hits).toHaveLength(8);
    expect(hits.every((e) => e.family === "hit")).toBe(true);
    // 35-45% of 1000 → 400 expected, ×1.2 prayer.
    expect(hits[0].damage.expected).toBeCloseTo(480);
  });

  it("a delayed crit-eligible hit stays a direct hit", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf(...Array(8).fill("magic_attack"), "smoke_tendrils"),
    });
    expect(s.ok).toBe(true);
    const hits = s.events.filter((e) => e.abilityId === "smoke_tendrils");
    expect(hits.every((e) => e.family === "hit")).toBe(true);
    expect(hits.some((e) => e.tick > e.hitIndex)).toBe(true);
  });

  it("Combust's burn ticks stay damage over time", () => {
    const s = simulate({ ...magicInput, rotation: rotationOf("combust") });
    const ticks = s.events.filter((e) => e.abilityId === "combust");
    expect(ticks).toHaveLength(10);
    expect(ticks.every((e) => e.family === "dot")).toBe(true);
    expect(ticks[0].damage.expected).toBeCloseTo(300);
  });
});
