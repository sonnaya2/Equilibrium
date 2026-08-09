import { describe, expect, it } from "vitest";
import { allEngineSpecs } from "@/combat/abilities/registry";
import { activeEquipmentEffects } from "@/combat/shared/equipment";
import {
  equipAbilityForLoadout,
  filterAbilitiesForLoadout,
  sortAbilitiesForDisplay,
} from "./abilityLoadoutFilter";

const catalogue = allEngineSpecs();

function byStyle(style: string) {
  return catalogue.filter((a) => a.style === style);
}

function capeGate(cape: string) {
  const effects = activeEquipmentEffects({ equipmentSlots: { cape } });
  return {
    equipmentIds: [cape],
    passiveIds: effects.passiveIds,
  };
}

describe("filterAbilitiesForLoadout — igneous only-version", () => {
  const cases = [
    {
      style: "melee" as const,
      cape: "item:igneous-kal-ket",
      base: "overpower",
      upgrade: "overpower_igneous",
    },
    {
      style: "ranged" as const,
      cape: "item:igneous-kal-xil",
      base: "deadshot",
      upgrade: "deadshot_igneous",
    },
    {
      style: "magic" as const,
      cape: "item:igneous-kal-mej",
      base: "omnipower",
      upgrade: "omnipower_igneous",
    },
    {
      style: "necromancy" as const,
      cape: "item:igneous-kal-mor",
      base: "death_skulls",
      upgrade: "death_skulls_igneous",
    },
  ];

  for (const c of cases) {
    it(`${c.style}: with style cape shows only ${c.upgrade}`, () => {
      const pool = byStyle(c.style);
      const ids = filterAbilitiesForLoadout(pool, capeGate(c.cape)).map((a) => a.id);
      expect(ids).toContain(c.upgrade);
      expect(ids).not.toContain(c.base);
    });

    it(`${c.style}: without cape shows only ${c.base}`, () => {
      const pool = byStyle(c.style);
      const ids = filterAbilitiesForLoadout(pool, { passiveIds: [] }).map((a) => a.id);
      expect(ids).toContain(c.base);
      expect(ids).not.toContain(c.upgrade);
    });

    it(`${c.style}: equipAbilityForLoadout rewrites base under cape`, () => {
      const pool = byStyle(c.style);
      const byId = new Map(pool.map((a) => [a.id, a]));
      const base = byId.get(c.base)!;
      expect(equipAbilityForLoadout(base, byId, capeGate(c.cape)).id).toBe(c.upgrade);
      expect(equipAbilityForLoadout(base, byId, { passiveIds: [] }).id).toBe(c.base);
    });

    it(`${c.style}: equipAbilityForLoadout reverses upgrade without cape`, () => {
      const pool = byStyle(c.style);
      const byId = new Map(pool.map((a) => [a.id, a]));
      const upgrade = byId.get(c.upgrade)!;
      expect(equipAbilityForLoadout(upgrade, byId, { passiveIds: [] }).id).toBe(c.base);
      expect(equipAbilityForLoadout(upgrade, byId, capeGate(c.cape)).id).toBe(c.upgrade);
    });
  }

  it("Kal-Zuk shows all four upgrades and no bases", () => {
    const gate = capeGate("item:igneous-kal-zuk");
    for (const c of cases) {
      const ids = filterAbilitiesForLoadout(byStyle(c.style), gate).map((a) => a.id);
      expect(ids).toContain(c.upgrade);
      expect(ids).not.toContain(c.base);
    }
  });

  it("Kal-Zuk necro shows death_skulls_igneous not death_skulls", () => {
    const ids = filterAbilitiesForLoadout(
      byStyle("necromancy"),
      capeGate("item:igneous-kal-zuk"),
    ).map((a) => a.id);
    expect(ids).toContain("death_skulls_igneous");
    expect(ids).not.toContain("death_skulls");
  });

  it("groups by display type and alphabetizes names within each group", () => {
    const pool = catalogue;
    const ordered = sortAbilitiesForDisplay(pool);
    const groups = [
      pool.filter((ability) => ability.weaponSpecial === true),
      pool.filter((ability) => ability.weaponSpecial !== true && ability.category === "utility"),
      pool.filter((ability) => ability.weaponSpecial !== true && ability.category === "basic"),
      pool.filter((ability) => ability.weaponSpecial !== true && ability.category === "enhanced"),
      pool.filter((ability) => ability.weaponSpecial !== true && ability.category === "threshold"),
      pool.filter((ability) => ability.weaponSpecial !== true && ability.category === "ultimate"),
    ].map((group) =>
      [...group].sort((left, right) =>
        left.name.localeCompare(right.name, "en", {
          numeric: true,
          sensitivity: "base",
        }),
      ),
    );

    expect(ordered).toEqual(groups.flat());
  });
});
