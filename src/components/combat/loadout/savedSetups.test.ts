import { describe, expect, it } from "vitest";
import { DEFAULT_LOADOUT } from "./model";
import {
  addSavedSetup,
  createSavedSetupCollection,
  deleteSavedSetup,
  duplicateSavedSetup,
  exportSavedSetups,
  importSavedSetups,
  normalizeSavedSetupCollection,
  renameSavedSetup,
  resetDefaultSavedSetups,
  selectSavedSetup,
  updateActiveSavedSetup,
} from "./savedSetups";

describe("saved setup state", () => {
  it("starts with four equipped style defaults", () => {
    const collection = createSavedSetupCollection();

    expect(collection.activeSetupId).toBe("default-melee");
    expect(collection.setups.map(({ name }) => name)).toEqual([
      "Melee",
      "Ranged",
      "Magic",
      "Necromancy",
    ]);
    expect(collection.setups.map(({ loadout }) => loadout.style)).toEqual([
      "melee",
      "ranged",
      "magic",
      "necromancy",
    ]);
    for (const { loadout } of collection.setups) {
      expect(loadout.equipmentSlots).toMatchObject({
        helmet: expect.any(String),
        body: expect.any(String),
        legs: expect.any(String),
        gloves: expect.any(String),
        boots: expect.any(String),
        cape: expect.any(String),
        amulet: expect.any(String),
        ring: expect.any(String),
        pocket: expect.any(String),
      });
    }
    expect(collection.setups.map(({ loadout }) => loadout.weaponConfiguration)).toEqual([
      "dualwield",
      "twohand",
      "twohand",
      "dualwield",
    ]);
    expect(collection.setups.map(({ loadout }) => loadout.buffs.herbloreLevel)).toEqual([
      120, 120, 120, 120,
    ]);
    expect(collection.setups.map(({ loadout }) => loadout.buffs.styleCurse)).toEqual([
      "malevolence",
      "desolation",
      "affliction",
      "ruination",
    ]);
    expect(
      collection.setups.map(({ loadout }) => ({
        vulnerability: loadout.buffs.vulnerability,
        overload: loadout.buffs.overload,
        enchantments: loadout.enchantments,
      })),
    ).toEqual(
      Array.from({ length: 4 }, () => ({
        vulnerability: true,
        overload: "overload",
        enchantments: [],
      })),
    );
    expect(collection.setups.map(({ loadout }) => loadout.equipmentSlots.ammo)).toEqual([
      "item:pernix-quiver",
      "item:bik-arrows",
      "item:pernix-quiver",
      "item:pernix-quiver",
    ]);
    expect(collection.setups.map(({ loadout }) => loadout.perks)).toMatchObject([
      { precise: 6, aftershock: 4, eruptive: 2, biting: 4, ultimatums: 4 },
      { precise: 6, aftershock: 4, eruptive: 2, caroming: 1, biting: 4 },
      { precise: 6, aftershock: 4, eruptive: 2, energising: 4, invigorating: 3 },
      { precise: 6, aftershock: 4, eruptive: 2, equilibrium: 4, invigorating: 4 },
    ]);
    expect(collection.setups.every(({ loadout }) => Object.keys(loadout.gizmos).length === 4)).toBe(
      true,
    );
  });

  it("keeps setup ids and names unique when adding and duplicating", () => {
    const first = renameSavedSetup(createSavedSetupCollection(), "default-melee", "Bossing");
    const second = addSavedSetup(first, { id: "default-melee", name: "Bossing" });
    const third = duplicateSavedSetup(second, second.activeSetupId, "default-melee");

    expect(second.setups.slice(-1).map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "default-melee-2", name: "Bossing 2" },
    ]);
    expect(third.setups.slice(-1).map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "default-melee-3", name: "Bossing 2 copy" },
    ]);
    expect(third.activeSetupId).toBe("default-melee-3");
  });

  it("protects the final setup from deletion", () => {
    const fresh = createSavedSetupCollection();
    const collection = { ...fresh, setups: [fresh.setups[0]] };

    expect(deleteSavedSetup(collection, collection.activeSetupId)).toEqual(collection);
  });

  it("selects and updates only the active setup", () => {
    const collection = createSavedSetupCollection();
    const selected = selectSavedSetup(collection, "default-ranged");
    const updated = updateActiveSavedSetup(selected, (loadout) => ({
      ...loadout,
      currentLife: 1234,
    }));

    expect(updated.activeSetupId).toBe("default-ranged");
    expect(updated.setups[0].loadout.currentLife).toBe(DEFAULT_LOADOUT.currentLife);
    expect(updated.setups[1].loadout.currentLife).toBe(1234);
  });

  it("restores built-in presets without changing custom setups", () => {
    const fresh = createSavedSetupCollection();
    const customized = updateActiveSavedSetup(fresh, (loadout) => ({
      ...loadout,
      currentLife: 1234,
    }));
    const withoutMagic = deleteSavedSetup(customized, "default-magic");
    const withCustom = addSavedSetup(withoutMagic, {
      id: "custom-raksha",
      name: "Raksha",
      loadout: { ...DEFAULT_LOADOUT, currentLife: 2222 },
    });
    const reset = resetDefaultSavedSetups(withCustom);

    expect(reset.setups.slice(0, 4).map(({ name }) => name)).toEqual([
      "Melee",
      "Ranged",
      "Magic",
      "Necromancy",
    ]);
    expect(reset.setups[0].loadout).toEqual(fresh.setups[0].loadout);
    expect(reset.setups.find(({ id }) => id === "custom-raksha")).toEqual(
      withCustom.setups.find(({ id }) => id === "custom-raksha"),
    );
    expect(reset.activeSetupId).toBe("custom-raksha");
  });

  it("adds the four defaults once when migrating a version-one collection", () => {
    const legacy = {
      version: 1,
      activeSetupId: "setup-1",
      setups: [{ id: "setup-1", name: "My setup", loadout: DEFAULT_LOADOUT }],
    };
    const migrated = normalizeSavedSetupCollection(legacy);

    expect(migrated.activeSetupId).toBe("setup-1");
    expect(migrated.setups.map(({ name }) => name)).toEqual([
      "My setup",
      "Melee",
      "Ranged",
      "Magic",
      "Necromancy",
    ]);
    expect(normalizeSavedSetupCollection(migrated)).toEqual(migrated);
  });

  it("restores boss attack cadence in saved setups whenever it is missing", () => {
    const migrated = normalizeSavedSetupCollection({
      version: 2,
      activeSetupId: "zilyana",
      setups: [
        {
          id: "zilyana",
          name: "Zilyana",
          loadout: {
            loadoutSchemaVersion: 3,
            style: "melee",
            target: {
              targetPresetId: "boss:commander-zilyana",
              defenceLevel: 75,
              armour: 1694,
              affinity: 55,
            },
          },
        },
      ],
    });

    expect(migrated.setups[0].loadout.loadoutSchemaVersion).toBe(4);
    expect(migrated.setups[0].loadout.target?.incomingHitIntervalSeconds).toBe(1.2);

    const alreadyV4 = normalizeSavedSetupCollection({
      version: 2,
      activeSetupId: "zilyana",
      setups: [
        {
          id: "zilyana",
          name: "Zilyana",
          loadout: {
            loadoutSchemaVersion: 4,
            style: "melee",
            target: {
              targetPresetId: "boss:commander-zilyana",
              defenceLevel: 75,
              armour: 1694,
              affinity: 55,
            },
          },
        },
      ],
    });
    expect(alreadyV4.setups[0].loadout.target?.incomingHitIntervalSeconds).toBe(1.2);
  });

  it("round-trips exports and rejects malformed or unsupported imports", () => {
    const collection = addSavedSetup(createSavedSetupCollection(), { name: "Second" });
    const imported = importSavedSetups(exportSavedSetups(collection));

    expect(imported).toEqual({ ok: true, collection });
    expect(importSavedSetups("{")).toEqual({
      ok: false,
      error: "That JSON is malformed. Check the pasted text and try again.",
    });
    expect(importSavedSetups(JSON.stringify({ version: 99, setups: [] }))).toEqual({
      ok: false,
      error: "That setup export uses an unsupported version.",
    });
  });
});
