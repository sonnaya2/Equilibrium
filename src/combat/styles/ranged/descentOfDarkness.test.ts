import { describe, expect, it } from "vitest";
import { resolveAbilityCatalogue } from "../../abilities/catalogue";
import { simulate } from "../../engine/simulation/simulate";
import { rotationOf } from "../../engine/simulation/contracts";
import { rangedInput } from "../../test/fixtures/inputs";
import { equipmentById } from "../../data";
import { activeEquipmentEffects } from "../../shared/equipment";
import { RANGED_ABILITIES } from "./abilities";
import { hasDarkfangWeapon } from "./darkfang";

describe("Descent of Darkness (Dark bow special)", () => {
  const ability = RANGED_ABILITIES.find((a) => a.id === "descent_of_darkness");

  it("matches wiki cost and two-hit bands", () => {
    expect(ability).toMatchObject({
      weaponSpecial: true,
      requiresSpecialAccess: true,
      adrenaline: { cost: 65 },
    });
    expect(ability!.hits).toHaveLength(2);
    expect(ability!.hits[0]!.band).toEqual({ minPct: 190, maxPct: 230 });
    expect(ability!.hits[1]!.band).toEqual({ minPct: 190, maxPct: 230 });
  });

  it("is in the ability catalogue", () => {
    const cat = resolveAbilityCatalogue({});
    expect(cat.byId.get("descent_of_darkness")).toBeTruthy();
  });

  it("Dark bow equipment carries the special id", () => {
    const bow = equipmentById("item:dark-bow");
    expect(bow?.specialAttackId).toBe("descent_of_darkness");
    expect(bow?.weaponClass).toBe("bow");
    expect(hasDarkfangWeapon(["item:dark-bow"])).toBe(true);
  });

  it("simulates two direct hits at ~420% average AD total", () => {
    const equipmentEffects = activeEquipmentEffects({
      style: "ranged",
      equipmentSlots: { twohand: "item:dark-bow" },
    });
    expect(equipmentEffects.activeWeapon?.specialAttackId).toBe("descent_of_darkness");
    const summary = simulate({
      ...rangedInput,
      equipmentEffects,
      equipmentIds: ["item:dark-bow"],
      weaponConfiguration: "twohand",
      startingAdrenaline: 100,
      rotation: rotationOf("descent_of_darkness"),
    });
    const hits = summary.events.filter(
      (e) => e.abilityId === "descent_of_darkness" && e.family === "hit" && !e.attached,
    );
    expect(hits).toHaveLength(2);
    const total = hits.reduce((s, e) => s + e.damage.expected, 0);
    // mid 210% x2 on base 1000 with DP=1 and no crits.
    expect(total).toBeCloseTo(4200, 0);
    expect(hits[0]!.damage.expected).toBeCloseTo(hits[1]!.damage.expected, 5);
  });
});
