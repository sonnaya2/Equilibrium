import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES, withStrengthCape99Dismember } from "../styles/melee/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import type { AbilityHit, AbilitySpec } from "../pipeline/calculateAbility";
import { activeEquipmentEffects, type ActiveEquipmentEffects } from "./equipment";
import type { ItemPassiveId } from "../data/records";
import {
  additionalBleedHitsFromExtension,
  eligibleBleedHitCount,
  extendBleedHitList,
  resolveAbilityWithEquipment,
} from "./bleedDurationExtension";

function byId(id: string) {
  const a = MELEE_ABILITIES.find((x) => x.id === id);
  if (!a) throw new Error(`missing ${id}`);
  return a;
}

function effectsWith(passiveIds: ItemPassiveId[]): ActiveEquipmentEffects {
  return {
    ...activeEquipmentEffects({ style: "melee" }),
    passiveIds,
  };
}

describe("bleed duration extension math", () => {
  it("floors half the base bleed count", () => {
    expect(additionalBleedHitsFromExtension(8)).toBe(4);
    expect(additionalBleedHitsFromExtension(6)).toBe(3);
    expect(additionalBleedHitsFromExtension(1)).toBe(0);
    expect(additionalBleedHitsFromExtension(0)).toBe(0);
    expect(additionalBleedHitsFromExtension(7)).toBe(3);
  });

  it("counts only bleed DoT hits", () => {
    const hits: AbilityHit[] = [
      { band: { minPct: 100, maxPct: 100 } },
      {
        band: { minPct: 50, maxPct: 50 },
        dot: true,
        dotKind: "bleed",
        bleedId: "massacre",
        tickOffset: 4,
      },
      {
        band: { minPct: 50, maxPct: 50 },
        dot: true,
        dotKind: "burn",
        tickOffset: 2,
      },
    ];
    expect(eligibleBleedHitCount(hits)).toBe(1);
  });
});

describe("extendBleedHitList", () => {
  it("appends Dismember to 12 hits on 2-tick cadence without mutating the source", () => {
    const base = byId("dismember");
    const before = base.hits.map((h) => h.tickOffset);
    const extended = extendBleedHitList(base.hits);
    expect(base.hits).toHaveLength(8);
    expect(base.hits.map((h) => h.tickOffset)).toEqual(before);
    expect(extended).toHaveLength(12);
    expect(extended.map((h) => h.tickOffset)).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    for (const hit of extended) {
      expect(hit.dot).toBe(true);
      expect(hit.dotKind).toBe("bleed");
      expect(hit.bleedId).toBe("dismember");
      expect(hit.critEligible).toBe(false);
      expect(hit.band).toEqual({ minPct: 25, maxPct: 35 });
    }
  });

  it("appends Slaughter to 9 hits on 3-tick cadence", () => {
    const extended = extendBleedHitList(byId("slaughter").hits);
    expect(extended).toHaveLength(9);
    expect(extended.map((h) => h.tickOffset)).toEqual([3, 6, 9, 12, 15, 18, 21, 24, 27]);
  });

  it("extends only Massacre bleed ticks (direct hit unchanged)", () => {
    const base = byId("massacre").hits;
    const extended = extendBleedHitList(base);
    expect(base).toHaveLength(7);
    expect(extended).toHaveLength(10);
    expect(extended[0]?.band).toEqual({ minPct: 110, maxPct: 130 });
    expect(extended[0]?.tickOffset).toBeUndefined();
    expect(extended[0]?.dot).toBeUndefined();
    const bleeds = extended.slice(1);
    expect(bleeds).toHaveLength(9);
    expect(bleeds.map((h) => h.tickOffset)).toEqual([4, 8, 12, 16, 20, 24, 28, 32, 36]);
    for (const hit of bleeds) {
      expect(hit.dot).toBe(true);
      expect(hit.dotKind).toBe("bleed");
      expect(hit.bleedId).toBe("massacre");
      expect(hit.band).toEqual({ minPct: 100, maxPct: 100 });
    }
  });

  it("does not re-extend an already-extended list when re-run on the result as base", () => {
    // floor(12 * 0.5) would add 6 more if someone re-applied wrongly - callers
    // must always start from the catalogue list. Document the pure-function behavior:
    const once = extendBleedHitList(byId("dismember").hits);
    expect(once).toHaveLength(12);
    const twice = extendBleedHitList(once);
    expect(twice).toHaveLength(18);
  });
});

describe("resolveAbilityWithEquipment", () => {
  const spear = effectsWith(["masterwork-spear-bleed-extension"]);
  const ordinary = effectsWith([]);

  it("extends only when the declared passive is active", () => {
    const dismember = byId("dismember");
    expect(resolveAbilityWithEquipment(dismember, ordinary).hits).toHaveLength(8);
    expect(resolveAbilityWithEquipment(dismember, spear).hits).toHaveLength(12);
    expect(dismember.hits).toHaveLength(8);
  });

  // Wiki: 8 + floor(8*0.5) + 3 cape = 15; not floor(11*0.5) on top of cape (=16).
  it("Strength cape + Masterwork spear Dismember totals 15 hits", () => {
    const base = byId("dismember");
    const caped = withStrengthCape99Dismember([base], 3)[0]!;
    expect(caped.hits).toHaveLength(11);
    expect(caped.flatBleedHitBonus).toBe(3);
    expect(resolveAbilityWithEquipment(base, spear).hits).toHaveLength(12);
    expect(resolveAbilityWithEquipment(caped, ordinary).hits).toHaveLength(11);
    expect(resolveAbilityWithEquipment(caped, spear).hits).toHaveLength(15);
  });

  it("is a no-op for abilities that do not declare bleedDurationExtension", () => {
    const assault = byId("assault");
    expect(assault.bleedDurationExtension).toBeUndefined();
    expect(resolveAbilityWithEquipment(assault, spear).hits).toHaveLength(assault.hits.length);
  });

  it("does not extend ranged bleeds or magic burns", () => {
    const corruption = RANGED_ABILITIES.find((a) => a.id === "corruption_shot");
    const combust = MAGIC_ABILITIES.find((a) => a.id === "combust");
    if (corruption) {
      expect(resolveAbilityWithEquipment(corruption, spear)).toBe(corruption);
    }
    if (combust) {
      expect(resolveAbilityWithEquipment(combust, spear)).toBe(combust);
    }
  });

  it("ignores Abyssal Parasite passive for ability bleed extension", () => {
    const withParasite = effectsWith(["abyssal-parasite"]);
    expect(resolveAbilityWithEquipment(byId("dismember"), withParasite).hits).toHaveLength(8);
  });

  it("does not treat an arbitrary crit-ineligible hit as extendable without declaration", () => {
    const fake: AbilitySpec = {
      id: "fake_dot",
      name: "Fake",
      style: "melee",
      category: "basic",
      hits: [
        {
          band: { minPct: 10, maxPct: 10 },
          critEligible: false,
          dot: true,
          dotKind: "bleed",
          tickOffset: 2,
        },
      ],
    };
    expect(resolveAbilityWithEquipment(fake, spear)).toBe(fake);
  });
});
