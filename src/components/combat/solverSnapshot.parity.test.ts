/**
 * Model → solver snapshot: slayer/salve descriptors copy from pre-resolved sources.
 */
import { describe, expect, it } from "vitest";
import {
  CORRUPTED_SLAYER_HELMET_ITEM_ID,
  FULL_SLAYER_HELMET_ITEM_ID,
  MIGHTY_SLAYER_HELMET_ITEM_ID,
  resolveSlayerHelmet,
} from "@/combat/shared/slayerHelmet";
import { packSimBase, packSimBaseFromModel } from "@/combat/solver/packRequest";
import { solverSnapshotFromResolvedModel } from "./solverSnapshot";
import { DEFAULT_LOADOUT, type Loadout } from "./loadout/model";
import { loadoutStats, type LoadoutStatsOptions } from "./loadoutStats";
import { toResolvedCombatModel } from "./toResolvedCombatModel";

function withGear(patch: Partial<Loadout>): Loadout {
  return {
    ...DEFAULT_LOADOUT,
    ...patch,
    buffs: { ...DEFAULT_LOADOUT.buffs, ...patch.buffs },
    perks: { ...DEFAULT_LOADOUT.perks, ...patch.perks },
    equipmentSlots: { ...DEFAULT_LOADOUT.equipmentSlots, ...patch.equipmentSlots },
    target:
      patch.target === undefined
        ? DEFAULT_LOADOUT.target
        : patch.target === null
          ? null
          : {
              ...patch.target,
              defenceLevel: patch.target.defenceLevel ?? 80,
              affinity: patch.target.affinity ?? "same",
            },
  };
}

function modelSnap(loadout: Loadout, unlockedRegions?: LoadoutStatsOptions["unlockedRegions"]) {
  const opts: LoadoutStatsOptions = unlockedRegions ? { unlockedRegions } : {};
  const stats = loadoutStats(loadout, opts);
  const model = toResolvedCombatModel(loadout, opts, stats);
  const snap = solverSnapshotFromResolvedModel(model);
  return { stats, model, snap };
}

describe("solverSnapshotFromResolvedModel slayer / salve descriptors", () => {
  it("Stand + Anachronia locked -> null / inactive", () => {
    const loadout = withGear({
      style: "melee",
      buffs: { ...DEFAULT_LOADOUT.buffs, slayerHelmetStand: "corrupted" },
      target: { defenceLevel: 80, affinity: "same", onSlayerTask: true },
    });
    const locked = ["misthalin", "kandarin"] as const;
    const { stats, model, snap } = modelSnap(loadout, locked);
    expect(stats.slayerHelmet).toBeNull();
    expect(model.modifierSources.slayerHelmet).toBeNull();
    expect(snap.slayerHelmet).toBeNull();
    expect(stats.globalModifiers.some((m) => m.id.startsWith("item:slayer-helmet:"))).toBe(false);

    const direct = resolveSlayerHelmet({
      equipmentSlots: loadout.equipmentSlots,
      standTier: loadout.buffs.slayerHelmetStand,
      unlockedRegions: locked,
      onSlayerTask: true,
      style: "melee",
    });
    expect(direct.active).toBe(false);
  });

  it("Stand + Anachronia unlocked -> stand", () => {
    const loadout = withGear({
      style: "melee",
      buffs: { ...DEFAULT_LOADOUT.buffs, slayerHelmetStand: "corrupted" },
      target: { defenceLevel: 80, affinity: "same", onSlayerTask: true },
    });
    const open = ["anachronia"] as const;
    const { stats, model, snap } = modelSnap(loadout, open);
    expect(stats.slayerHelmet).toMatchObject({
      tierId: "corrupted",
      source: "stand",
      damageMult: 1.095,
    });
    expect(snap.slayerHelmet).toEqual(stats.slayerHelmet);
    expect(model.modifierSources.slayerHelmet).toEqual(stats.slayerHelmet);
    expect(stats.globalModifiers.some((m) => m.id.startsWith("item:slayer-helmet:"))).toBe(true);
  });

  it("Equipped helmet -> equipped full tier", () => {
    const loadout = withGear({
      style: "melee",
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      target: { defenceLevel: 80, affinity: "same", onSlayerTask: true },
    });
    const { stats, snap } = modelSnap(loadout);
    expect(stats.slayerHelmet).toMatchObject({
      tierId: "full",
      source: "equipped",
      damageMult: 1.075,
    });
    expect(snap.slayerHelmet).toEqual(stats.slayerHelmet);
  });

  it("Equipped + higher stand tier -> stand wins", () => {
    const loadout = withGear({
      style: "melee",
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      buffs: { ...DEFAULT_LOADOUT.buffs, slayerHelmetStand: "corrupted" },
      target: { defenceLevel: 80, affinity: "same", onSlayerTask: true },
    });
    const { stats, snap } = modelSnap(loadout, ["anachronia"]);
    expect(stats.slayerHelmet).toMatchObject({
      tierId: "corrupted",
      source: "stand",
    });
    expect(snap.slayerHelmet).toEqual(stats.slayerHelmet);

    // Equal tier prefers equipped.
    const equal = withGear({
      style: "melee",
      equipmentSlots: { helmet: MIGHTY_SLAYER_HELMET_ITEM_ID },
      buffs: { ...DEFAULT_LOADOUT.buffs, slayerHelmetStand: "mighty" },
      target: { defenceLevel: 80, affinity: "same", onSlayerTask: true },
    });
    const equalStats = loadoutStats(equal, { unlockedRegions: ["anachronia"] });
    expect(equalStats.slayerHelmet).toMatchObject({
      tierId: "mighty",
      source: "equipped",
    });
  });

  it("Necro without lens -> inactive; with lens -> active", () => {
    const base = {
      style: "necromancy" as const,
      equipmentSlots: { helmet: CORRUPTED_SLAYER_HELMET_ITEM_ID },
      target: { defenceLevel: 80, affinity: "same" as const, onSlayerTask: true },
    };
    const noLens = modelSnap(
      withGear({
        ...base,
        buffs: { ...DEFAULT_LOADOUT.buffs, ensouledSpectralLens: false },
      }),
    );
    expect(noLens.stats.slayerHelmet).toBeNull();
    expect(noLens.snap.slayerHelmet).toBeNull();

    const withLens = modelSnap(
      withGear({
        ...base,
        buffs: { ...DEFAULT_LOADOUT.buffs, ensouledSpectralLens: true },
      }),
    );
    expect(withLens.stats.slayerHelmet).toMatchObject({
      tierId: "corrupted",
      source: "equipped",
    });
    expect(withLens.snap.slayerHelmet).toEqual(withLens.stats.slayerHelmet);
  });

  it("snapshot slayerHelmet / salve equal stats descriptors; pack matches model", () => {
    const loadout = withGear({
      style: "melee",
      equipmentSlots: {
        helmet: FULL_SLAYER_HELMET_ITEM_ID,
        amulet: "item:salve-amulet-e",
      },
      target: {
        defenceLevel: 80,
        affinity: "same",
        onSlayerTask: true,
        undead: true,
      },
    });
    const { stats, model, snap } = modelSnap(loadout);
    expect(snap.slayerHelmet).toEqual(stats.slayerHelmet);
    expect(snap.salve).toEqual(stats.salve);
    expect(stats.salve).toMatchObject({ variantId: "salve-e", damageMult: 1.2 });
    expect(packSimBaseFromModel(model)).toEqual(packSimBase(snap));
  });
});

describe("caroming snapshot authority", () => {
  it.each([0, 1, 2, 3, 4] as const)(
    "model.caromingRank === modifierSources.caroming for rank %i",
    (rank) => {
      const { model, snap } = modelSnap(
        withGear({
          style: "ranged",
          perks: { ...DEFAULT_LOADOUT.perks, caroming: rank },
        }),
      );
      expect(model.caromingRank).toBe(rank);
      expect(model.modifierSources.caroming).toBe(rank);
      expect(model.caromingRank).toBe(model.modifierSources.caroming);
      // Snapshot uses resolved caromingRank once; pack fans out to both wire fields.
      expect(snap.caroming).toBe(rank);
      const wire = packSimBase(snap);
      expect(wire.caromingRank).toBe(rank);
      expect(wire.modifierSources.caroming).toBe(rank);
      expect(packSimBaseFromModel(model)).toEqual(wire);
    },
  );
});
