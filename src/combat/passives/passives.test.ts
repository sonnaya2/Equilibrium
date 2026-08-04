import { describe, expect, it } from "vitest";
import { combatEquipment, equipmentById } from "../data";
import { equippedPassiveSummaries } from "../shared/equipment";
import { RING_OF_VIGOUR_ITEM_ID } from "../shared/ringOfVigour";
import {
  IGNEOUS_ULTIMATE_PASSIVES,
  ITEM_PASSIVE_IDS,
  LENG_PASSIVES,
  allPassiveDefinitions,
  definitionById,
  presentPassive,
  validateEquipmentPassiveRefs,
  validatePassiveRegistry,
} from "./index";

const emptyCtx = {
  passageAgonyActive: false,
  hasHeroism: false,
  hasShadows: false,
  hasMetaphysics: false,
};

describe("passive registry", () => {
  it("validatePassiveRegistry has no errors", () => {
    expect(validatePassiveRegistry()).toEqual([]);
  });

  it("covers every ItemPassiveId exactly once", () => {
    const defs = allPassiveDefinitions();
    expect(defs.map((d) => d.id).sort()).toEqual([...ITEM_PASSIVE_IDS].sort());
    expect(new Set(defs.map((d) => d.id)).size).toBe(ITEM_PASSIVE_IDS.length);
  });

  it("modeled passives declare owners; not-modeled may be empty", () => {
    for (const def of allPassiveDefinitions()) {
      if (def.support === "modeled" || def.support === "partially-modeled") {
        expect(def.implementationOwners.length, def.id).toBeGreaterThan(0);
      }
      expect(def.source.verifiedAt, def.id).toBeTruthy();
    }
    expect(definitionById("asylum-surgeon")?.implementationOwners).toEqual([]);
    expect(definitionById("deathtouch-reflect")?.implementationOwners).toEqual([]);
  });

  it("collapse groups list expected ids", () => {
    expect(IGNEOUS_ULTIMATE_PASSIVES).toEqual([
      "igneous-overpower",
      "igneous-deadshot",
      "igneous-omnipower",
      "igneous-death-skulls",
    ]);
    expect(LENG_PASSIVES).toEqual(["leng-endless-frost", "leng-boundless-chill"]);
    for (const id of IGNEOUS_ULTIMATE_PASSIVES) {
      expect(definitionById(id)?.duplicatePolicy).toBe("collapse");
    }
    for (const id of LENG_PASSIVES) {
      expect(definitionById(id)?.duplicatePolicy).toBe("collapse");
    }
  });

  it("equipment catalogue passive refs resolve in the registry", () => {
    expect(validateEquipmentPassiveRefs(combatEquipment.records)).toEqual([]);
  });
});

describe("presentPassive parity", () => {
  it("jaws / abyssal / asylum / deathtouch / defender baselines", () => {
    expect(presentPassive("jaws-of-the-abyss", emptyCtx)).toMatchObject({
      label: "Jaws of the Abyss",
      support: "modeled",
    });
    expect(presentPassive("jaws-of-the-abyss", emptyCtx).effects).toHaveLength(2);

    expect(presentPassive("abyssal-parasite", emptyCtx)).toMatchObject({
      label: "Abyssal Parasite",
      support: "partially-modeled",
    });

    expect(presentPassive("asylum-surgeon", emptyCtx)).toMatchObject({
      label: "Asylum surgeon's ring",
      support: "not-modeled",
    });

    expect(presentPassive("deathtouch-reflect", emptyCtx)).toMatchObject({
      label: "Deathtouch reflect",
      support: "not-modeled",
    });
    expect(presentPassive("deathtouch-reflect", emptyCtx).effects[0]).toContain("5,000");

    expect(presentPassive("defender-accuracy", emptyCtx)).toMatchObject({
      label: "Defender accuracy",
      effects: ["Defenders, reprisers, and rebounders have +3% accuracy."],
      support: "modeled",
    });
  });

  it("enduring-ruin / ring enchantment overlays", () => {
    expect(presentPassive("enduring-ruin", emptyCtx).label).toBe("Enduring Ruin");
    expect(presentPassive("enduring-ruin", { ...emptyCtx, passageAgonyActive: true })).toMatchObject(
      {
        label: "Enduring Ruin + Agony",
        effects: [
          "Rend grants +16% damage to the next attack for 6 seconds.",
          "Bleeds take +25% damage for 10 seconds.",
        ],
      },
    );

    expect(presentPassive("champion-ring", { ...emptyCtx, hasHeroism: true }).label).toBe(
      "Champion's ring + Heroism",
    );
    expect(presentPassive("stalker-ring", { ...emptyCtx, hasShadows: true }).label).toBe(
      "Stalker's ring + Shadows",
    );
    expect(presentPassive("channeller-ring", { ...emptyCtx, hasMetaphysics: true }).label).toBe(
      "Channeller's ring + Metaphysics",
    );
  });

  it("ring-of-vigour presentation is modeled", () => {
    expect(presentPassive("ring-of-vigour", emptyCtx)).toMatchObject({
      label: "Ring of Vigour",
      support: "modeled",
    });
    expect(presentPassive("ring-of-vigour", emptyCtx).effects).toHaveLength(3);
  });
});

describe("equippedPassiveSummaries via registry", () => {
  it("collapses multi-igneous Kal-Zuk", () => {
    const rows = equippedPassiveSummaries({
      equipmentSlots: { cape: "item:igneous-kal-zuk" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      label: "Igneous ultimate upgrades",
      support: "modeled",
    });
  });

  it("collapses dual Leng into one row", () => {
    const rows = equippedPassiveSummaries({
      equipmentSlots: {
        mainhand: "item:dark-shard-of-leng",
        offhand: "item:dark-sliver-of-leng",
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      passiveId: "leng-endless-frost",
      itemName: "Dark Shard & Sliver of Leng",
      label: "Leng weapons",
      support: "modeled",
    });
  });

  it("surfaces RoV from catalogue passiveId (no item-id special case)", () => {
    const rec = equipmentById(RING_OF_VIGOUR_ITEM_ID);
    expect(rec?.passiveId).toBe("ring-of-vigour");
    const rows = equippedPassiveSummaries({
      equipmentSlots: { ring: RING_OF_VIGOUR_ITEM_ID },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      passiveId: "ring-of-vigour",
      itemId: RING_OF_VIGOUR_ITEM_ID,
      label: "Ring of Vigour",
      support: "modeled",
    });
  });

  it("jaws + agony gloves still show two rows", () => {
    const rows = equippedPassiveSummaries({
      style: "melee",
      equipmentSlots: {
        helmet: "item:jaws-of-the-abyss",
        gloves: "item:enhanced-gloves-of-passage",
      },
      enchantments: ["agony"],
    });
    expect(rows.map((r) => r.passiveId)).toEqual(["jaws-of-the-abyss", "enduring-ruin"]);
    expect(rows[1]?.label).toBe("Enduring Ruin + Agony");
  });
});
