import { describe, expect, it } from "vitest";
import { mapAbilitiesById } from "../engine/runtime/runtime";
import { STRENGTH_CAPE_DISMEMBER_EXTRA_HITS } from "../shared/perks";
import { resolveAbilityCatalogue } from "./catalogue";
import { allEngineSpecs } from "./registry";

describe("resolveAbilityCatalogue", () => {
  it("starts from ABILITY_REGISTRY and indexes all styles", () => {
    const cat = resolveAbilityCatalogue();
    expect(cat.catalogue.length).toBe(allEngineSpecs().length);
    expect(cat.byId.size).toBe(cat.catalogue.length);
    expect(cat.basicByStyle.has("melee")).toBe(true);
    expect(cat.basicByStyle.has("ranged")).toBe(true);
    expect(cat.basicByStyle.has("magic")).toBe(true);
    expect(cat.basicByStyle.has("necromancy")).toBe(true);
    expect(cat.abilityRegistry.byId).toBe(cat.byId);
  });

  it("applies Strength Cape once to Dismember", () => {
    const plain = resolveAbilityCatalogue();
    const caped = resolveAbilityCatalogue({ strengthCape99: true });
    const d0 = plain.byId.get("dismember")!;
    const d1 = caped.byId.get("dismember")!;
    expect(d1.hits.length).toBe(d0.hits.length + STRENGTH_CAPE_DISMEMBER_EXTRA_HITS);
    expect(caped.strengthCape99).toBe(true);
  });

  it("indexes via mapAbilitiesById (fingerprint conflict check)", () => {
    const attack = allEngineSpecs().find((a) => a.id === "attack")!;
    const conflicting = { ...attack, name: "Conflict Name" };
    // Catalogue merges by id first (overlays win); direct mapAbilitiesById still
    // enforces fingerprint conflict when the same id appears twice with drift.
    expect(() => mapAbilitiesById([attack, conflicting])).toThrow(/Duplicate ability id/);
    const cat = resolveAbilityCatalogue({
      base: [attack],
      overlays: [conflicting],
    });
    expect(cat.byId.get("attack")!.name).toBe("Conflict Name");
  });

  it("overlays win on id", () => {
    const base = allEngineSpecs();
    const attack = base.find((a) => a.id === "attack")!;
    const overlay = { ...attack, name: "Overlaid Attack" };
    const cat = resolveAbilityCatalogue({ overlays: [overlay] });
    expect(cat.byId.get("attack")!.name).toBe("Overlaid Attack");
  });

  it("abilityRegistry maps match mapAbilitiesById(catalogue)", () => {
    const cat = resolveAbilityCatalogue({ strengthCape99: true });
    const rebuilt = mapAbilitiesById(cat.catalogue);
    expect([...cat.byId.keys()].sort()).toEqual([...rebuilt.keys()].sort());
  });
});
