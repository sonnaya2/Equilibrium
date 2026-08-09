import { describe, expect, it } from "vitest";
import type { ActiveEquipmentEffects } from "../../shared/equipment";
import { createCastContext } from "../../engine/simulation/simulate";
import { rangedInput } from "../../test/fixtures/inputs";
import {
  FLEETING_BOOTS_ITEM_IDS,
  hasFleetingBoots,
  isFleetingBootsId,
  SNIPE_CDR_FLEETING_TICKS,
  SNIPE_CDR_PIERCING_BASE_TICKS,
  WINDS_END_PASSIVE_ID,
} from "./fleetingBoots";

function effectsWithPassives(passiveIds: readonly string[]): ActiveEquipmentEffects {
  return {
    activation: "pre-activated-static-loadout",
    setCritChance: { unconditional: 0, conditional: {} },
    passiveIds: passiveIds as ActiveEquipmentEffects["passiveIds"],
    enchantments: [],
    weaponClass: null,
    defenderEquipped: false,
    passage: { active: false, agonyActive: false },
    amZiFlatDamage: 0,
    amHejDamageBonus: 0,
    vestments: {
      pieces: 0,
      heraldOfChaos: false,
      berserkExtension: false,
      increasedAdrenalineCap: false,
    },
  };
}

describe("hasFleetingBoots", () => {
  it("is false for empty / bare input", () => {
    expect(hasFleetingBoots(undefined)).toBe(false);
    expect(hasFleetingBoots(null)).toBe(false);
    expect(hasFleetingBoots({})).toBe(false);
    expect(hasFleetingBoots({ equipmentIds: [] })).toBe(false);
    expect(hasFleetingBoots({ equipmentIds: ["item:glaiven-boots"] })).toBe(false);
    expect(hasFleetingBoots({ equipmentSlots: { boots: "item:glaiven-boots" } })).toBe(false);
    expect(hasFleetingBoots({ equipmentEffects: effectsWithPassives([]) })).toBe(false);
  });

  it("detects both catalogue boot ids on equipmentIds", () => {
    for (const id of FLEETING_BOOTS_ITEM_IDS) {
      expect(isFleetingBootsId(id)).toBe(true);
      expect(hasFleetingBoots({ equipmentIds: [id] })).toBe(true);
    }
    expect(hasFleetingBoots({ equipmentIds: ["item:other", "item:fleeting-boots"] })).toBe(true);
  });

  it("detects boots-slot-only equip without equipmentIds", () => {
    expect(
      hasFleetingBoots({
        equipmentSlots: { boots: "item:fleeting-boots" },
      }),
    ).toBe(true);
    expect(
      hasFleetingBoots({
        equipmentSlots: { boots: "item:enhanced-fleeting-boots" },
      }),
    ).toBe(true);
    expect(
      hasFleetingBoots({
        equipmentIds: [],
        equipmentSlots: { boots: "item:fleeting-boots" },
      }),
    ).toBe(true);
  });

  it("detects winds-end on equipmentEffects.passiveIds", () => {
    expect(
      hasFleetingBoots({
        equipmentEffects: effectsWithPassives([WINDS_END_PASSIVE_ID]),
      }),
    ).toBe(true);
    expect(
      hasFleetingBoots({
        equipmentIds: [],
        equipmentSlots: {},
        equipmentEffects: effectsWithPassives([WINDS_END_PASSIVE_ID]),
      }),
    ).toBe(true);
  });
});

describe("Snipe CDR via hasFleetingBoots sources", () => {
  function afterPiercing(input: {
    equipmentIds?: readonly string[];
    equipmentEffects?: ActiveEquipmentEffects;
    equipmentSlots?: Partial<Record<string, string | null>>;
  }) {
    const ctx = createCastContext({ ...rangedInput, ...input });
    expect(ctx.performCast(ctx.byId.get("snipe")!, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.snipe).toBe(100);
    expect(ctx.performCast(ctx.byId.get("piercing_shot")!, 3, false).ok).toBe(true);
    return ctx.getState().cooldowns.snipe;
  }

  it("keeps base 4-tick Piercing CDR without boots", () => {
    expect(afterPiercing({})).toBe(100 - SNIPE_CDR_PIERCING_BASE_TICKS * 2);
  });

  it("uses 6-tick Piercing CDR from equipmentIds (existing fixtures)", () => {
    expect(afterPiercing({ equipmentIds: ["item:fleeting-boots"] })).toBe(
      100 - SNIPE_CDR_FLEETING_TICKS * 2,
    );
  });

  it("uses 6-tick Piercing CDR from winds-end passive only", () => {
    expect(
      afterPiercing({
        equipmentEffects: effectsWithPassives([WINDS_END_PASSIVE_ID]),
      }),
    ).toBe(100 - SNIPE_CDR_FLEETING_TICKS * 2);
  });

  it("uses 6-tick Piercing CDR from boots slot only", () => {
    expect(
      afterPiercing({
        equipmentIds: [],
        equipmentSlots: { boots: "item:fleeting-boots" },
      }),
    ).toBe(100 - SNIPE_CDR_FLEETING_TICKS * 2);
  });
});
