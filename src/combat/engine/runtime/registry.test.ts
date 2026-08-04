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

  it("reuses prebuilt abilityRegistry maps without remapping", () => {
    const rebuilt = createRuntime({
      ...baseInput,
      abilities: MELEE_ABILITIES,
    });
    const rt = createRuntime({
      ...baseInput,
      // Intentionally thin catalogue: maps come from abilityRegistry.
      abilities: [],
      abilityRegistry: {
        byId: rebuilt.byId,
        basicByStyle: rebuilt.basicByStyle,
      },
    });
    expect(rt.byId).toBe(rebuilt.byId);
    expect(rt.basicByStyle).toBe(rebuilt.basicByStyle);
    expect(rt.basicByStyle.get("melee")?.autoAttack).toBe(true);
    expect(rt.byId.get("assault")).toBeDefined();
  });

  it("rebuilds maps when abilityRegistry is absent", () => {
    const rt = createRuntime({
      ...baseInput,
      abilities: MELEE_ABILITIES,
    });
    expect(rt.byId.get("attack")).toBeDefined();
    expect(rt.basicByStyle.get("melee")?.id).toBe("attack");
  });
});
