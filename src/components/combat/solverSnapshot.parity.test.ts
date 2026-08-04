/**
 * UI snapshot vs live loadoutStats: slayer/salve descriptors copy from CalcStats.
 */
import { describe, expect, it } from "vitest";
import {
  CORRUPTED_SLAYER_HELMET_ITEM_ID,
  FULL_SLAYER_HELMET_ITEM_ID,
  MIGHTY_SLAYER_HELMET_ITEM_ID,
  resolveSlayerHelmet,
} from "@/combat/shared/slayerHelmet";
import { solverSnapshotFromUi } from "./solverSnapshot";
import { DEFAULT_LOADOUT, type Loadout } from "./loadout/model";
import { loadoutStats } from "./loadoutStats";

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

describe("solverSnapshotFromUi slayer / salve descriptors", () => {
  it("Stand + Anachronia locked -> null / inactive", () => {
    const loadout = withGear({
      style: "melee",
      buffs: { ...DEFAULT_LOADOUT.buffs, slayerHelmetStand: "corrupted" },
      target: { defenceLevel: 80, affinity: "same", onSlayerTask: true },
    });
    const locked = ["misthalin", "kandarin"] as const;
    const stats = loadoutStats(loadout, { unlockedRegions: [...locked] });
    const snap = solverSnapshotFromUi(stats, loadout);
    expect(stats.slayerHelmet).toBeNull();
    expect(snap.slayerHelmet).toBeNull();
    expect(stats.globalModifiers.some((m) => m.id.startsWith("item:slayer-helmet:"))).toBe(
      false,
    );

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
    const stats = loadoutStats(loadout, { unlockedRegions: [...open] });
    const snap = solverSnapshotFromUi(stats, loadout);
    expect(stats.slayerHelmet).toMatchObject({
      tierId: "corrupted",
      source: "stand",
      damageMult: 1.095,
    });
    expect(snap.slayerHelmet).toEqual(stats.slayerHelmet);
    expect(stats.globalModifiers.some((m) => m.id.startsWith("item:slayer-helmet:"))).toBe(true);
  });

  it("Equipped helmet -> equipped full tier", () => {
    const loadout = withGear({
      style: "melee",
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      target: { defenceLevel: 80, affinity: "same", onSlayerTask: true },
    });
    const stats = loadoutStats(loadout);
    const snap = solverSnapshotFromUi(stats, loadout);
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
    const stats = loadoutStats(loadout, { unlockedRegions: ["anachronia"] });
    const snap = solverSnapshotFromUi(stats, loadout);
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
    const noLens = loadoutStats(
      withGear({
        ...base,
        buffs: { ...DEFAULT_LOADOUT.buffs, ensouledSpectralLens: false },
      }),
    );
    expect(noLens.slayerHelmet).toBeNull();
    expect(solverSnapshotFromUi(noLens, withGear(base)).slayerHelmet).toBeNull();

    const withLensLoadout = withGear({
      ...base,
      buffs: { ...DEFAULT_LOADOUT.buffs, ensouledSpectralLens: true },
    });
    const withLens = loadoutStats(withLensLoadout);
    expect(withLens.slayerHelmet).toMatchObject({
      tierId: "corrupted",
      source: "equipped",
    });
    expect(solverSnapshotFromUi(withLens, withLensLoadout).slayerHelmet).toEqual(
      withLens.slayerHelmet,
    );
  });

  it("snapshot slayerHelmet / salve are reference-equal copies from stats", () => {
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
    const stats = loadoutStats(loadout);
    const snap = solverSnapshotFromUi(stats, loadout);
    expect(snap.slayerHelmet).toBe(stats.slayerHelmet);
    expect(snap.salve).toBe(stats.salve);
    expect(stats.salve).toMatchObject({ variantId: "salve-e", damageMult: 1.2 });
  });
});
