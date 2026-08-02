import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { createRuntime, mapAbilitiesById } from "./runtime";
import { baseInput } from "../../test/fixtures/inputs";

describe("runtime ability registries", () => {
  it("rejects conflicting duplicate ability ids with an identifying error", () => {
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const conflicting = { ...attack, name: "Attack copy", hits: [] };
    expect(() => mapAbilitiesById([attack, conflicting])).toThrow(
      /Duplicate ability id in runtime registry: attack/,
    );
    expect(() =>
      createRuntime({
        ...baseInput,
        abilities: [attack, conflicting],
      }),
    ).toThrow(/Duplicate ability id in runtime registry: attack/);
  });
  it("accepts identical re-registration from catalogue merges", () => {
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const map = mapAbilitiesById([attack, { ...attack }]);
    expect(map.get("attack")).toBe(attack);
  });
});
