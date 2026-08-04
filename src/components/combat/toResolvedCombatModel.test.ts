/**
 * Adapter coverage: styles, host-resolved descriptors, pack alignment.
 */
import { describe, expect, it } from "vitest";
import { BERSERKERS_FURY_ID } from "@/combat/shared/berserkersFury";
import { FULL_SLAYER_HELMET_ITEM_ID } from "@/combat/shared/slayerHelmet";
import { SALVE_AMULET_E_ITEM_ID } from "@/combat/shared/salveAmulet";
import { RING_OF_VIGOUR_ITEM_ID } from "@/combat/shared/ringOfVigour";
import {
  FURY_OF_THE_SMALL_ID,
} from "@/combat/shared/furyOfTheSmall";
import { projectSerializableSimBase } from "@/combat/model";
import { packSimBase, packSimBaseFromModel } from "@/combat/solver/packRequest";
import { POWERBURST_DURATION_MS } from "@/combat";
import { DEFAULT_LOADOUT, type Loadout } from "./loadout/model";
import { loadoutStats } from "./loadoutStats";
import { solverSnapshotFromResolvedModel } from "./solverSnapshot";
import { toResolvedCombatModel } from "./toResolvedCombatModel";

const NOW = 1_700_000_000_000;

const TARGET_DEFAULTS = { defenceLevel: 80, affinity: "same" as const };

function withLoadout(patch: Partial<Loadout>): Loadout {
  return {
    ...DEFAULT_LOADOUT,
    ...patch,
    buffs: { ...DEFAULT_LOADOUT.buffs, ...patch.buffs },
    perks: { ...DEFAULT_LOADOUT.perks, ...patch.perks },
    archaeology: patch.archaeology
      ? { ...DEFAULT_LOADOUT.archaeology, ...patch.archaeology }
      : DEFAULT_LOADOUT.archaeology,
    equipmentSlots: { ...DEFAULT_LOADOUT.equipmentSlots, ...patch.equipmentSlots },
    baseDamage: patch.baseDamage ?? DEFAULT_LOADOUT.baseDamage,
    target:
      patch.target === undefined
        ? DEFAULT_LOADOUT.target
        : patch.target === null
          ? null
          : { ...TARGET_DEFAULTS, ...patch.target },
  };
}

describe("toResolvedCombatModel", () => {
  it.each([
    ["melee", {}] as const,
    ["ranged", { style: "ranged" as const }] as const,
    ["magic", { style: "magic" as const }] as const,
    ["necromancy", { style: "necromancy" as const }] as const,
  ])("builds immutable model for %s", (style, patch) => {
    const loadout = withLoadout({ ...patch, style });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    expect(model.style).toBe(style);
    expect(Object.isFrozen(model)).toBe(true);
    expect(model.accuracy).toBe(loadoutStats(loadout, { now: NOW }).dp);
    expect(model.base).toBe(loadoutStats(loadout, { now: NOW }).base);
  });

  it("copies Slayer Helmet host descriptor (equipped)", () => {
    const loadout = withLoadout({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      target: { ...TARGET_DEFAULTS, onSlayerTask: true },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    expect(model.modifierSources.slayerHelmet).toMatchObject({
      tierId: "full",
      source: "equipped",
    });
    expect(model.diagnostics.slayerHelmet).toEqual(model.modifierSources.slayerHelmet);
  });

  it("region-gates Slayer Helmet stand without Anachronia", () => {
    const loadout = withLoadout({
      buffs: { ...DEFAULT_LOADOUT.buffs, slayerHelmetStand: "corrupted" },
      target: { ...TARGET_DEFAULTS, onSlayerTask: true },
    });
    const locked = toResolvedCombatModel(loadout, {
      now: NOW,
      unlockedRegions: ["misthalin", "kandarin"],
    });
    expect(locked.modifierSources.slayerHelmet).toBeNull();

    const open = toResolvedCombatModel(loadout, {
      now: NOW,
      unlockedRegions: ["anachronia"],
    });
    expect(open.modifierSources.slayerHelmet).toMatchObject({
      tierId: "corrupted",
      source: "stand",
    });
  });

  it("copies Salve (e) descriptor for undead target", () => {
    const loadout = withLoadout({
      equipmentSlots: { amulet: SALVE_AMULET_E_ITEM_ID },
      target: { ...TARGET_DEFAULTS, undead: true },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    expect(model.modifierSources.salve).toMatchObject({
      variantId: "salve-e",
      damageMult: 1.2,
    });
  });

  it("freezes Berserker's Fury bonus from archaeology selection", () => {
    const loadout = withLoadout({
      archaeology: {
        ...DEFAULT_LOADOUT.archaeology,
        selectedIds: [BERSERKERS_FURY_ID],
        energyCap: 500,
      },
      currentHealthPercent: 20,
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    expect(model.diagnostics.archaeologySelectedIds).toContain(BERSERKERS_FURY_ID);
    expect(model.diagnostics.berserkersFury.active).toBe(true);
    expect(model.modifierSources.berserkersFuryBonus).toBeGreaterThan(0);
    expect(model.modifierSources.berserkersFuryBonus).toBe(
      model.diagnostics.berserkersFury.bonus,
    );
  });

  it("collapses Ring of Vigour sources and sets adrenaline flag", () => {
    const loadout = withLoadout({
      equipmentSlots: { ring: RING_OF_VIGOUR_ITEM_ID },
      buffs: { ...DEFAULT_LOADOUT.buffs, ringOfVigourPassive: true },
    });
    const model = toResolvedCombatModel(loadout, {
      now: NOW,
      unlockedRegions: ["anachronia"],
    });
    expect(model.adrenaline.ringOfVigour).toBe(true);
    expect(model.diagnostics.ringOfVigourActive).toBe(true);
    expect(model.diagnostics.ringOfVigourSources.length).toBe(1);
    expect(model.diagnostics.ringOfVigourSources[0]).toMatch(/Equipped ring/);
    expect(model.diagnostics.ringOfVigourSources[0]).toMatch(/Permanent unlock/);
  });

  it("records Fury of the Small from sanitized archaeology", () => {
    const loadout = withLoadout({
      archaeology: {
        ...DEFAULT_LOADOUT.archaeology,
        selectedIds: [FURY_OF_THE_SMALL_ID],
        energyCap: 500,
      },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    expect(model.diagnostics.archaeologySelectedIds).toContain(FURY_OF_THE_SMALL_ID);
    expect(model.adrenaline.basicAdrenalineFlatBonus).toBeDefined();
  });

  it("preserves exact powerburst remaining ticks", () => {
    const until = NOW + POWERBURST_DURATION_MS;
    const loadout = withLoadout({
      buffs: {
        ...DEFAULT_LOADOUT.buffs,
        powerburstOfVitalityUntil: until,
      },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    const stats = loadoutStats(loadout, { now: NOW });
    expect(model.league.powerburstUntilTick).toBe(stats.league.powerburstUntilTick);
    expect(model.diagnostics.powerburstRemainingTicks).toBe(stats.league.powerburstUntilTick);
    expect(model.league.powerburstUntilTick).toBeGreaterThan(0);
  });

  it("preserves hit-cap toggle and target race flags", () => {
    const loadout = withLoadout({
      hitCapEnabled: false,
      target: { ...TARGET_DEFAULTS, demon: true, dragon: true, undead: true, hpPercent: 42 },
      perks: {
        ...DEFAULT_LOADOUT.perks,
        demonSlayer: 1,
        dragonSlayer: 1,
        undeadSlayer: 1,
      },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    expect(model.cap.bypass).toBe(true);
    expect(model.target).toMatchObject({
      demon: true,
      dragon: true,
      undead: true,
      hpPercent: 42,
    });
    expect(model.modifierSources.slayer).toEqual({ demon: 1, dragon: 1, undead: 1 });
  });

  it("classifies shield / defender / necromancy conduit configurations", () => {
    const shield = toResolvedCombatModel(
      withLoadout({
        style: "melee",
        equipmentSlots: {
          mainhand: "item:drygore-longsword",
          offhand: "item:malevolent-kiteshield",
        },
      }),
      { now: NOW },
    );
    const defender = toResolvedCombatModel(
      withLoadout({
        style: "melee",
        equipmentSlots: {
          mainhand: "item:drygore-longsword",
          offhand: "item:kalphite-defender",
        },
      }),
      { now: NOW },
    );
    const necro = toResolvedCombatModel(
      withLoadout({
        style: "necromancy",
        equipmentSlots: {
          mainhand: "item:omni-guard",
          offhand: "item:soulbound-lantern",
        },
      }),
      { now: NOW },
    );
    expect(shield.weaponConfiguration).toBe("shield");
    expect(defender.weaponConfiguration).toBe("defender");
    expect(necro.weaponConfiguration).toBe("necromancy");
  });

  it("projectSerializableSimBase matches packSimBaseFromModel and model snapshot pack", () => {
    const loadout = withLoadout({
      perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 3, lunging: 2, precise: 4 },
      buffs: { ...DEFAULT_LOADOUT.buffs, vulnerability: true },
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      target: { ...TARGET_DEFAULTS, onSlayerTask: true, demon: true },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    const fromModel = projectSerializableSimBase(model);
    const fromPack = packSimBaseFromModel(model);
    const fromSnap = packSimBase(solverSnapshotFromResolvedModel(model));

    expect(fromPack).toEqual(fromModel);
    expect(fromSnap).toEqual(fromModel);
  });
});
