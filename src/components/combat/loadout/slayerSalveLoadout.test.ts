import { describe, expect, it } from "vitest";
import { mulFloor } from "@/combat/core/rounding";
import { runPipeline } from "@/combat/pipeline/modifierPipeline";
import { hitChance, playerAccuracy } from "@/combat/target/genericTarget";
import { FULL_SLAYER_HELMET_ITEM_ID, resolveSlayerHelmet } from "@/combat/shared/slayerHelmet";
import {
  SALVE_AMULET_E_ITEM_ID,
  SALVE_AMULET_ITEM_ID,
  resolveSalve,
} from "@/combat/shared/salveAmulet";
import { DEFAULT_LOADOUT, normalizeLoadout, type Loadout } from "./model";
import { loadoutStats } from "../loadoutStats";

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

describe("legacy normalize for slayer/salve", () => {
  it("defaults onSlayerTask false, no stand, no invented salve state", () => {
    const next = normalizeLoadout({});
    expect(next.target).toBeNull();
    expect(next.buffs.slayerHelmetStand).toBeNull();
    expect(next.buffs.ensouledSpectralLens).toBe(false);
    expect(next.buffs).not.toHaveProperty("salveEnabled");
  });

  it("persists onSlayerTask only when true", () => {
    const on = normalizeLoadout({
      target: { defenceLevel: 80, affinity: "same", onSlayerTask: true, undead: true },
    });
    expect(on.target?.onSlayerTask).toBe(true);
    const off = normalizeLoadout({
      target: { defenceLevel: 80, affinity: "same", onSlayerTask: false },
    });
    expect(off.target?.onSlayerTask).toBeUndefined();
  });
});

describe("loadoutStats wires slayer and salve", () => {
  it("installs on-hit damage modifiers and scales accuracy for Full + Salve (e)", () => {
    const loadout = withGear({
      style: "melee",
      equipmentSlots: {
        helmet: FULL_SLAYER_HELMET_ITEM_ID,
        amulet: SALVE_AMULET_E_ITEM_ID,
      },
      target: {
        defenceLevel: 80,
        affinity: "same",
        onSlayerTask: true,
        undead: true,
      },
    });
    const stats = loadoutStats(loadout);
    const helmMod = stats.globalModifiers.find((m) => m.id.startsWith("item:slayer-helmet:"));
    const salveMod = stats.globalModifiers.find((m) => m.id.startsWith("item:salve:"));
    expect(helmMod).toBeTruthy();
    expect(salveMod).toBeTruthy();
    expect(
      runPipeline({ damage: 1000 }, [helmMod!, salveMod!], {
        style: "melee",
        damageSource: "direct",
      }).damage,
    ).toBe(mulFloor(mulFloor(1000, 1.075), 1.2));

    // Accuracy rating mult product (uncapped hit-chance ratio needs a tough target).
    const bareRating = playerAccuracy(99, 90);
    const boostedRating = bareRating * 1.125 * 1.2;
    const hard = { defenceLevel: 99, armour: 2500, affinity: "strong" as const };
    const bareHc = hitChance(bareRating, hard);
    const boostedHc = hitChance(boostedRating, hard);
    expect(bareHc).toBeLessThan(0.95);
    expect(boostedHc / bareHc).toBeCloseTo(1.125 * 1.2, 5);
    expect(stats.accuracyRating).toBeCloseTo(boostedRating, 5);
  });

  it("lists each analysis source once in activePassives", () => {
    const stats = loadoutStats(
      withGear({
        equipmentSlots: {
          helmet: FULL_SLAYER_HELMET_ITEM_ID,
          amulet: SALVE_AMULET_ITEM_ID,
        },
        target: {
          defenceLevel: 80,
          affinity: "same",
          onSlayerTask: true,
          undead: true,
        },
      }),
    );
    const helmDmg = stats.activePassives.filter(
      (p) => p.includes("Full Slayer Helmet") && p.includes("direct-hit damage"),
    );
    const salveDmg = stats.activePassives.filter(
      (p) => p.includes("Salve amulet") && p.includes("direct-hit damage") && !p.includes("(e)"),
    );
    expect(helmDmg).toHaveLength(1);
    expect(salveDmg).toHaveLength(1);
    expect(stats.activePassives.filter((p) => p.includes("hit chance")).length).toBe(2);
  });

  it("Undead Slayer perk stays separate when salve/helm active", () => {
    const stats = loadoutStats(
      withGear({
        equipmentSlots: {
          helmet: FULL_SLAYER_HELMET_ITEM_ID,
          amulet: SALVE_AMULET_ITEM_ID,
        },
        perks: { ...DEFAULT_LOADOUT.perks, undeadSlayer: 1 },
        target: {
          defenceLevel: 80,
          affinity: "same",
          onSlayerTask: true,
          undead: true,
        },
      }),
    );
    expect(stats.globalModifiers.some((m) => m.id === "perk:undead-slayer")).toBe(true);
    expect(stats.globalModifiers.some((m) => m.id.startsWith("item:salve:"))).toBe(true);
    expect(stats.globalModifiers.some((m) => m.id.startsWith("item:slayer-helmet:"))).toBe(true);
  });

  it("stand without Anachronia does not grant bonuses; equipped still does", () => {
    const standOnly = loadoutStats(
      withGear({
        buffs: { ...DEFAULT_LOADOUT.buffs, slayerHelmetStand: "corrupted" },
        target: { defenceLevel: 80, affinity: "same", onSlayerTask: true },
      }),
      { unlockedRegions: [] },
    );
    expect(standOnly.globalModifiers.some((m) => m.id.startsWith("item:slayer-helmet:"))).toBe(
      false,
    );

    const equipped = loadoutStats(
      withGear({
        equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
        buffs: { ...DEFAULT_LOADOUT.buffs, slayerHelmetStand: "corrupted" },
        target: { defenceLevel: 80, affinity: "same", onSlayerTask: true },
      }),
      { unlockedRegions: [] },
    );
    const mod = equipped.globalModifiers.find((m) => m.id.startsWith("item:slayer-helmet:"));
    expect(mod?.id).toContain("equipped");
    expect(mod?.id).toContain("full");
  });
});

describe("resolver parity for solver snapshot sources", () => {
  it("manual resolve matches loadoutStats modifier mults", () => {
    const loadout = withGear({
      equipmentSlots: {
        helmet: FULL_SLAYER_HELMET_ITEM_ID,
        amulet: SALVE_AMULET_E_ITEM_ID,
      },
      target: {
        defenceLevel: 80,
        affinity: "same",
        onSlayerTask: true,
        undead: true,
      },
    });
    const helm = resolveSlayerHelmet({
      equipmentSlots: loadout.equipmentSlots,
      standTier: loadout.buffs.slayerHelmetStand,
      onSlayerTask: true,
      style: "melee",
    });
    const salve = resolveSalve({
      equipmentSlots: loadout.equipmentSlots,
      targetUndead: true,
    });
    const stats = loadoutStats(loadout);
    const helmMod = stats.globalModifiers.find((m) => m.id.startsWith("item:slayer-helmet:"))!;
    const salveMod = stats.globalModifiers.find((m) => m.id.startsWith("item:salve:"))!;
    expect(helm.damageMult).toBe(1.075);
    expect(salve.damageMult).toBe(1.2);
    expect(
      runPipeline({ damage: 2000 }, [helmMod, salveMod], {
        style: "melee",
        damageSource: "direct",
      }).damage,
    ).toBe(mulFloor(mulFloor(2000, 1.075), 1.2));
  });
});
