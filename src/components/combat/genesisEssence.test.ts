import { describe, expect, it } from "vitest";
import { effectiveWeaponTier, loadoutWeaponConfig } from "./loadout/weaponConfiguration";
import { loadoutStats } from "./loadoutStats";
import { DEFAULT_LOADOUT, type Loadout } from "./useLoadout";
import { toResolvedCombatModel } from "./toResolvedCombatModel";

const GENESIS_PICKS = ["Order", "Order", "Order", "Order", "Order", "Order"] as const;

function withLoadout(patch: Partial<Loadout>): Loadout {
  return {
    ...DEFAULT_LOADOUT,
    ...patch,
    buffs: { ...DEFAULT_LOADOUT.buffs, ...patch.buffs },
    perks: { ...DEFAULT_LOADOUT.perks, ...patch.perks },
    equipmentSlots: { ...DEFAULT_LOADOUT.equipmentSlots, ...patch.equipmentSlots },
    baseDamage: patch.baseDamage ?? DEFAULT_LOADOUT.baseDamage,
  };
}

describe("Genesis Essence combat-tier override", () => {
  it.each([
    ["melee", "twohand", 90, 0],
    ["ranged", "dualwield", 90, 80],
    ["magic", "twohand", 95, 0],
    ["necromancy", "mainhand", 95, 95],
  ] as const)(
    "raises %s %s weapons to the same result as explicit T120",
    (style, shape, tier, offhand) => {
      const loadout = withLoadout({
        style,
        weaponConfiguration: shape,
        weaponTier: tier,
        offhandTier: offhand,
        ammunitionTier: style === "ranged" ? 80 : DEFAULT_LOADOUT.ammunitionTier,
        spellTier: style === "magic" ? 80 : DEFAULT_LOADOUT.spellTier,
      });
      const genesis = loadoutStats(loadout, { blessingPicks: GENESIS_PICKS });
      const explicit = loadoutStats(
        withLoadout({
          ...loadout,
          weaponTier: 120,
          offhandTier: offhand > 0 ? 120 : 0,
          ammunitionTier: style === "ranged" ? 120 : loadout.ammunitionTier,
          spellTier: style === "magic" ? 120 : loadout.spellTier,
        }),
      );

      expect(genesis.weaponTierOverride).toBe(120);
      expect(genesis.mainhandTier).toBe(120);
      expect(genesis.base).toBe(explicit.base);
      expect(genesis.accuracyRating).toBe(explicit.accuracyRating);
      expect(genesis.weaponConfiguration).toBe(explicit.weaponConfiguration);
      if (offhand > 0) expect(genesis.offhandTier).toBe(explicit.offhandTier);
      if (style === "ranged") expect(genesis.ammunitionTier).toBe(120);
      if (style === "magic") expect(genesis.spellTier).toBe(120);
    },
  );

  it("keeps defender half-tier scaling while the underlying weapon reaches T120", () => {
    const loadout = withLoadout({
      weaponConfiguration: "defender",
      weaponTier: 90,
      offhandTier: 90,
    });
    expect(loadoutWeaponConfig(loadout, [120])).toMatchObject({
      weapon: { tier: 120 },
      offhand: { tier: 60 },
    });
  });

  it("does not synthesize a weapon for weaponless or main-hand-only setups", () => {
    const weaponless = withLoadout({
      weaponConfiguration: "mainhand",
      weaponTier: 0,
      offhandTier: 0,
    });
    const mainOnly = withLoadout({
      weaponConfiguration: "mainhand",
      weaponTier: 90,
      offhandTier: 0,
    });

    expect(loadoutWeaponConfig(weaponless, [120])).toMatchObject({
      kind: "mainhand",
      weapon: { tier: 0 },
    });
    expect(loadoutWeaponConfig(mainOnly, [120])).toMatchObject({
      kind: "mainhand",
      weapon: { tier: 120 },
    });
    expect(loadoutWeaponConfig(mainOnly, [120])).not.toHaveProperty("offhand");
  });

  it("is idempotent and composes with a higher existing effective tier", () => {
    expect(effectiveWeaponTier(90, [120, 120])).toBe(120);
    expect(effectiveWeaponTier(120, [120])).toBe(120);
    expect(effectiveWeaponTier(130, [120])).toBe(130);
  });

  it("leaves an already tier-120 weapon unchanged", () => {
    const loadout = withLoadout({ weaponTier: 120 });
    const withoutGenesis = loadoutStats(loadout);
    const withGenesis = loadoutStats(loadout, { blessingPicks: GENESIS_PICKS });

    expect(withGenesis.weaponTierOverride).toBe(120);
    expect(withGenesis.mainhandTier).toBe(withoutGenesis.mainhandTier);
    expect(withGenesis.base).toBe(withoutGenesis.base);
    expect(withGenesis.accuracyRating).toBe(withoutGenesis.accuracyRating);
  });

  it("keeps shields out of the weapon override and preserves armour", () => {
    const loadout = withLoadout({
      weaponConfiguration: "shield",
      weaponTier: 90,
      equipmentSlots: {
        mainhand: "item:drygore-longsword",
        offhand: "item:malevolent-kiteshield",
      },
    });
    const withoutGenesis = loadoutStats(loadout);
    const withGenesis = loadoutStats(loadout, { blessingPicks: GENESIS_PICKS });

    expect(withGenesis.mainhandTier).toBe(120);
    expect(withGenesis.offhandTier).toBeNull();
    expect(withGenesis.defence.totalArmour).toBe(withoutGenesis.defence.totalArmour);
  });

  it("carries the resolved tier into the simulation model", () => {
    const loadout = withLoadout({ weaponTier: 90 });
    const stats = loadoutStats(loadout, { blessingPicks: GENESIS_PICKS });
    const model = toResolvedCombatModel(loadout, { blessingPicks: GENESIS_PICKS }, stats);

    expect(model.base).toBe(stats.base);
    expect(model.accuracy).toBe(stats.dp);
    expect(model.league.blessingIds).toContain("genesis-essence");
  });

  it("raises ranged ammo and magic spell tiers without changing resource behavior", () => {
    const ranged = withLoadout({
      style: "ranged",
      weaponConfiguration: "twohand",
      weaponTier: 90,
      ammunitionTier: 80,
    });
    const magic = withLoadout({
      style: "magic",
      weaponConfiguration: "twohand",
      weaponTier: 90,
      spellTier: 80,
    });
    const rangedStats = loadoutStats(ranged, { blessingPicks: GENESIS_PICKS });
    const magicStats = loadoutStats(magic, { blessingPicks: GENESIS_PICKS });

    expect(rangedStats.mainhandTier).toBe(120);
    expect(rangedStats.ammunitionTier).toBe(120);
    expect(magicStats.mainhandTier).toBe(120);
    expect(magicStats.spellTier).toBe(120);
    expect(rangedStats.base).toBe(
      loadoutStats({ ...ranged, weaponTier: 120, ammunitionTier: 120 }).base,
    );
    expect(magicStats.base).toBe(loadoutStats({ ...magic, weaponTier: 120, spellTier: 120 }).base);
  });

  it("keeps zero ammo and spell tiers as the weaponless sentinel", () => {
    const ranged = withLoadout({ style: "ranged", ammunitionTier: 0 });
    const magic = withLoadout({ style: "magic", spellTier: 0 });

    expect(loadoutWeaponConfig(ranged, [120])).toMatchObject({ ammunitionTier: 0 });
    expect(loadoutWeaponConfig(magic, [120])).toMatchObject({ spellTier: 0 });
  });
});
