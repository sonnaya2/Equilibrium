import { describe, expect, it } from "vitest";
import type { ItemPassiveId } from "../data/records";
import { combatEquipment } from "../data";
import {
  ITEM_PASSIVE_IDS,
  PASSIVE_DEFINITIONS,
  allPassiveDefinitions,
  definitionById,
  isIgneousUltimatePassive,
  isLengPassive,
  presentPassive,
  presentationContextFromEffects,
  igneousCombinedPresentation,
  lengCombinedPresentation,
  validateEquipmentPassiveRefs,
  validatePassiveRegistry,
} from "./index";

const EMPTY_CTX = {
  passageAgonyActive: false,
  hasHeroism: false,
  hasShadows: false,
  hasMetaphysics: false,
};

describe("passives registry", () => {
  it("covers every ItemPassiveId exactly once", () => {
    expect(validatePassiveRegistry()).toEqual([]);
    expect(PASSIVE_DEFINITIONS).toHaveLength(ITEM_PASSIVE_IDS.length);
    expect(allPassiveDefinitions()).toHaveLength(ITEM_PASSIVE_IDS.length);

    const ids = PASSIVE_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ITEM_PASSIVE_IDS) {
      expect(definitionById(id), id).toBeDefined();
      expect(ids).toContain(id);
    }
  });

  it("requires sources and owners for modeled / partially-modeled defs", () => {
    for (const def of PASSIVE_DEFINITIONS) {
      expect(def.source.verifiedAt, def.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(def.label, def.id).toBeTruthy();
      expect(def.lifecycle.length, def.id).toBeGreaterThan(0);
      if (def.support === "modeled" || def.support === "partially-modeled") {
        expect(def.implementationOwners.length, def.id).toBeGreaterThan(0);
      }
    }
  });

  it("rejects unknown equipment passive refs", () => {
    const bad = {
      id: "item:fake",
      name: "Fake",
      bonuses: {},
      sources: [
        {
          source: "runescape-wiki" as const,
          url: "https://runescape.wiki/w/X",
          verifiedAt: "2026-08-01",
        },
      ],
      passiveId: "not-a-real-passive" as ItemPassiveId,
    };
    expect(validateEquipmentPassiveRefs([bad])).toEqual([
      "item:fake: unknown passive not-a-real-passive",
    ]);
    expect(validateEquipmentPassiveRefs(combatEquipment.records)).toEqual([]);
  });

  it("classifies igneous collapse and leng pair helpers", () => {
    expect(isIgneousUltimatePassive("igneous-overpower")).toBe(true);
    expect(isIgneousUltimatePassive("ring-of-vigour")).toBe(false);
    expect(isLengPassive("leng-endless-frost")).toBe(true);
    expect(isLengPassive("leng-boundless-chill")).toBe(true);
    expect(isLengPassive("abyssal-parasite")).toBe(false);
  });

  it("presentPassive covers all ids with catalogue labels and support", () => {
    for (const id of ITEM_PASSIVE_IDS) {
      const row = presentPassive(id, EMPTY_CTX);
      const def = definitionById(id)!;
      expect(row.label, id).toBe(def.label);
      expect(row.effects, id).toEqual(def.effects);
      if (def.support === "mechanics-unverified") {
        expect(row.support, id).toBe("not-modeled");
      } else {
        expect(row.support, id).toBe(def.support);
      }
    }
  });

  it("applies enchantment / agony presentation overlays", () => {
    expect(presentPassive("enduring-ruin", { ...EMPTY_CTX, passageAgonyActive: true })).toMatchObject(
      {
        label: "Enduring Ruin + Agony",
        effects: [
          "Rend grants +16% damage to the next attack for 6 seconds.",
          "Bleeds take +25% damage for 10 seconds.",
        ],
      },
    );
    expect(presentPassive("champion-ring", { ...EMPTY_CTX, hasHeroism: true }).label).toBe(
      "Champion's ring + Heroism",
    );
    expect(presentPassive("stalker-ring", { ...EMPTY_CTX, hasShadows: true }).label).toBe(
      "Stalker's ring + Shadows",
    );
    expect(presentPassive("channeller-ring", { ...EMPTY_CTX, hasMetaphysics: true }).label).toBe(
      "Channeller's ring + Metaphysics",
    );
  });

  it("builds presentation context from active equipment effects shape", () => {
    expect(
      presentationContextFromEffects({
        passage: { agonyActive: true },
        enchantments: ["heroism", "shadows"],
      }),
    ).toEqual({
      passageAgonyActive: true,
      hasHeroism: true,
      hasShadows: true,
      hasMetaphysics: false,
    });
  });

  it("combined igneous / leng presentations match Gear collapse strings", () => {
    expect(igneousCombinedPresentation()).toEqual({
      label: "Igneous ultimate upgrades",
      effects: ["Unlocks upgraded Overpower, Deadshot, Omnipower, and Death Skulls."],
      support: "modeled",
    });
    expect(lengCombinedPresentation().label).toBe("Leng weapons");
    expect(lengCombinedPresentation().support).toBe("modeled");
  });

  it("marks not-modeled and partially-modeled catalogue entries", () => {
    expect(definitionById("asylum-surgeon")?.support).toBe("not-modeled");
    expect(definitionById("deathtouch-reflect")?.support).toBe("not-modeled");
    expect(definitionById("abyssal-parasite")?.support).toBe("partially-modeled");
    expect(definitionById("ring-of-vigour")?.support).toBe("modeled");
  });
});
