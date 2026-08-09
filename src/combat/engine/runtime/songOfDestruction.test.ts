import { describe, expect, it } from "vitest";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { activeEquipmentEffects } from "../../shared/equipment";
import { songOfDestructionSummary } from "../../styles/magic/songOfDestruction";
import { stochasticLaneCount } from "./stochastic";

describe("Song stochastic lane gating", () => {
  const effects = {
    ...activeEquipmentEffects({ style: "magic" }),
    songOfDestruction: songOfDestructionSummary(1),
  };

  it("keeps one lane without Song or without an affected active ability", () => {
    expect(stochasticLaneCount({ abilities: MAGIC_ABILITIES }, ["combust"])).toBe(1);
    expect(stochasticLaneCount({ abilities: MAGIC_ABILITIES, equipmentEffects: effects }, [])).toBe(1);
    expect(stochasticLaneCount({ abilities: MAGIC_ABILITIES, equipmentEffects: effects }, ["magic_attack"])).toBe(1);
  });

  it("uses the 128-lane ensemble for active/manual/native affected casts", () => {
    expect(stochasticLaneCount({ abilities: MAGIC_ABILITIES, equipmentEffects: effects }, ["combust"])).toBe(128);
    expect(
      stochasticLaneCount(
        { abilities: MAGIC_ABILITIES, abilityRegistry: { byId: new Map(MAGIC_ABILITIES.map((a) => [a.id, a])), basicByStyle: new Map() }, equipmentEffects: effects },
        ["soulfire"],
      ),
    ).toBe(128);
  });
});
