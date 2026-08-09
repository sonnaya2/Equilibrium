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

describe("filterAbilitiesForLoadout — region gate (Limit to regions)", () => {
  it("hides Corruption Shot without Desert; shows it with Desert", () => {
    const pool = byStyle("ranged");
    const noDesert = filterAbilitiesForLoadout(pool, {
      unlockedRegions: ["misthalin", "asgarnia"],
      includeUnknownAvailability: false,
    }).map((a) => a.id);
    expect(noDesert).not.toContain("corruption_shot");

    const withDesert = filterAbilitiesForLoadout(pool, {
      unlockedRegions: ["misthalin", "asgarnia", "desert"],
      includeUnknownAvailability: false,
    }).map((a) => a.id);
    expect(withDesert).toContain("corruption_shot");
  });

  it("gates every codex ability by its unlock region", () => {
    const cases = [
      { style: "ranged" as const, id: "greater_deaths_swiftness", region: "misthalin" },
      { style: "magic" as const, id: "greater_sunshine", region: "misthalin" },
      { style: "melee" as const, id: "chaos_roar", region: "misthalin" },
      { style: "magic" as const, id: "greater_chain", region: "anachronia" },
      { style: "melee" as const, id: "greater_barge", region: "forinthry" },
      { style: "melee" as const, id: "greater_flurry", region: "forinthry" },
      { style: "magic" as const, id: "magma_tempest", region: "misthalin" },
      { style: "ranged" as const, id: "corruption_shot", region: "desert" },
      { style: "magic" as const, id: "corruption_blast", region: "desert" },
      { style: "ranged" as const, id: "greater_ricochet", region: "anachronia" },
      { style: "melee" as const, id: "greater_fury", region: "forinthry" },
    ];
    for (const c of cases) {
      const pool = byStyle(c.style);
      const without = filterAbilitiesForLoadout(pool, {
        unlockedRegions: ["asgarnia", "kandarin"],
        includeUnknownAvailability: false,
      }).map((a) => a.id);
      expect(without).not.toContain(c.id);
      const withRegion = filterAbilitiesForLoadout(pool, {
        unlockedRegions: ["asgarnia", "kandarin", c.region],
        includeUnknownAvailability: false,
      }).map((a) => a.id);
      expect(withRegion).toContain(c.id);
    }
  });

  it("without unlockedRegions leaves regional abilities visible", () => {
    const ids = filterAbilitiesForLoadout(byStyle("ranged"), { passiveIds: [] }).map((a) => a.id);
    expect(ids).toContain("corruption_shot");
  });
});

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
