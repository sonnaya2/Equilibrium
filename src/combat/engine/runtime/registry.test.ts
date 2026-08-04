import { describe, expect, it } from "vitest";
import { abilityBehaviorFingerprint } from "../../shared/abilityFingerprint";
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

  it("rejects same-id re-registration when hit bands differ", () => {
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const bandDifferent = {
      ...attack,
      hits: [{ band: { minPct: 1, maxPct: 2 } }],
    };
    expect(abilityBehaviorFingerprint(attack)).not.toBe(abilityBehaviorFingerprint(bandDifferent));
    expect(() => mapAbilitiesById([attack, bandDifferent])).toThrow(
      /Duplicate ability id in runtime registry: attack/,
    );
  });

  it("rejects same-id re-registration when adrenaline differs (fingerprint deeper than name/hits.length)", () => {
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const adrenDifferent = {
      ...attack,
      name: attack.name,
      style: attack.style,
      category: attack.category,
      hits: [...attack.hits],
      adrenaline: { gain: (attack.adrenaline?.gain ?? 0) + 99 },
    };
    expect(() => mapAbilitiesById([attack, adrenDifferent])).toThrow(
      /Duplicate ability id in runtime registry: attack/,
    );
  });

  it("accepts identical re-registration from catalogue merges", () => {
    const attack = MELEE_ABILITIES.find((a) => a.id === "attack")!;
    const map = mapAbilitiesById([attack, { ...attack }]);
    expect(map.get("attack")).toBe(attack);
    expect(abilityBehaviorFingerprint(attack)).toBe(abilityBehaviorFingerprint({ ...attack }));
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
