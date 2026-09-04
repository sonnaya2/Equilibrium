/**
 * Adapter coverage: styles, host-resolved descriptors, pack alignment.
 */
import { describe, expect, it } from "vitest";
import { BERSERKERS_FURY_ID } from "@/combat/shared/berserkersFury";
import { FULL_SLAYER_HELMET_ITEM_ID } from "@/combat/shared/slayerHelmet";
import { SALVE_AMULET_E_ITEM_ID } from "@/combat/shared/salveAmulet";
import { RING_OF_VIGOUR_ITEM_ID } from "@/combat/shared/ringOfVigour";
import { FURY_OF_THE_SMALL_ID } from "@/combat/shared/furyOfTheSmall";
import {
  analyzeSingleCast,
  hostInputFromResolvedModel,
  projectSerializableSimBase,
  toHybridManualCombatModel,
} from "@/combat/model";
import { packSimBase, packSimBaseFromModel } from "@/combat/solver/packRequest";
import { buildCandidatePool } from "@/combat/solver/candidatePool";
import { evaluateRevolutionBar } from "@/combat/solver/evaluate";
import { NECROMANCY_ABILITIES } from "@/combat/styles/necromancy/abilities";
import {
  abilityStyleForBar,
  TUSKAS_EMPOWERED_COOLDOWN_SECONDS,
  TUSKAS_WRATH,
} from "@/combat/styles/shared/constitutionAbilities";
import { POWERBURST_DURATION_MS } from "@/combat";
import { DEFAULT_LOADOUT, equipInSlot, type Loadout } from "./loadout/model";
import { loadoutStats } from "./loadoutStats";
import { solverSnapshotFromResolvedModel } from "./solverSnapshot";
import { toResolvedCombatModel } from "./toResolvedCombatModel";

const NOW = 1_700_000_000_000;

const TARGET_DEFAULTS = { defenceLevel: 80, affinity: 60 };

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

  it("projects the host-resolved target accuracy profile", () => {
    const loadout = withLoadout({
      style: "ranged",
      target: { defenceLevel: 80, armour: 500, affinity: 60 },
    });
    const stats = loadoutStats(loadout, { now: NOW });
    const model = toResolvedCombatModel(loadout, { now: NOW }, stats);
    expect(model.targetAccuracyProfile).toEqual(stats.targetAccuracyProfile);
    expect(projectSerializableSimBase(model).targetAccuracyProfile).toEqual(
      stats.targetAccuracyProfile,
    );
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
    expect(model.modifierSources.berserkersFuryBonus).toBe(model.diagnostics.berserkersFury.bonus);
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

  it("hitCapEnabled controls bypass under equilibrium (not forced off)", () => {
    const on = toResolvedCombatModel(withLoadout({ hitCapEnabled: true }), {
      now: NOW,
      ruleset: "equilibrium",
      blessingPicks: ["Balance"],
    });
    const off = toResolvedCombatModel(withLoadout({ hitCapEnabled: false }), {
      now: NOW,
      ruleset: "equilibrium",
      blessingPicks: ["Balance"],
    });
    expect(on.league.ruleset).toBe("equilibrium");
    expect(off.league.ruleset).toBe("equilibrium");
    expect(on.cap).toEqual({ cap: 30_000, bypass: false });
    expect(off.cap).toEqual({ cap: 30_000, bypass: true });
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

  /**
   * Conjure gate: weaponConfiguration must be "necromancy" (conduit), not stored
   * loadout dualwield and not shield OH. UI Run / solver pack this field.
   */
  it("necro death guard + conduit packs weaponConfiguration necromancy for Run/solver; shield OH does not", () => {
    // equipInSlot stores dualwield for any offensive OH; sim shape must still be necromancy.
    let dual = equipInSlot(DEFAULT_LOADOUT, "mainhand", "item:omni-guard");
    dual = equipInSlot(dual, "offhand", "item:soulbound-lantern");
    expect(dual.style).toBe("necromancy");
    expect(dual.weaponConfiguration).toBe("dualwield");

    let tank = equipInSlot(DEFAULT_LOADOUT, "mainhand", "item:omni-guard");
    tank = equipInSlot(tank, "offhand", "item:malevolent-kiteshield");
    expect(tank.style).toBe("necromancy");
    expect(tank.weaponConfiguration).toBe("shield");

    const dualStats = loadoutStats(dual, { now: NOW });
    const tankStats = loadoutStats(tank, { now: NOW });
    expect(dualStats.weaponConfiguration).toBe("necromancy");
    expect(tankStats.weaponConfiguration).toBe("shield");

    const dualModel = toResolvedCombatModel(dual, { now: NOW }, dualStats);
    const tankModel = toResolvedCombatModel(tank, { now: NOW }, tankStats);
    expect(dualModel.weaponConfiguration).toBe("necromancy");
    expect(tankModel.weaponConfiguration).toBe("shield");

    const dualPacked = packSimBaseFromModel(dualModel);
    const tankPacked = packSimBaseFromModel(tankModel);
    expect(dualPacked.weaponConfiguration).toBe("necromancy");
    expect(tankPacked.weaponConfiguration).toBe("shield");
    expect(packSimBase(solverSnapshotFromResolvedModel(dualModel)).weaponConfiguration).toBe(
      "necromancy",
    );
    expect(projectSerializableSimBase(dualModel).weaponConfiguration).toBe("necromancy");

    // Hybrid "Use Loadout off" must keep conduit shape (conjure gate on revo Run).
    const hybrid = toHybridManualCombatModel(dualModel, {
      base: 1000,
      level: 99,
      accuracy: 1,
      critChance: 0,
    });
    expect(hybrid.weaponConfiguration).toBe("necromancy");
    expect(packSimBaseFromModel(hybrid).weaponConfiguration).toBe("necromancy");

    const pool = buildCandidatePool(NECROMANCY_ABILITIES, "necromancy", {
      weaponConfiguration: dualPacked.weaponConfiguration,
    });
    expect(pool.byId.has("conjure_skeleton_warrior")).toBe(true);

    const withConduit = evaluateRevolutionBar({
      bar: ["conjure_skeleton_warrior", "touch_of_death", "soul_sap"],
      style: "necromancy",
      durationTicks: 40,
      pool,
      sim: {
        base: dualPacked.base,
        level: dualPacked.level,
        accuracy: dualPacked.accuracy,
        crit: dualPacked.crit,
        abilities: NECROMANCY_ABILITIES,
        weaponConfiguration: dualPacked.weaponConfiguration,
        equipmentIds: dualPacked.equipmentIds,
        startingAdrenaline: dualPacked.startingAdrenaline,
      },
      profileId: "balanced",
    });
    expect(withConduit.ok).toBe(true);
    expect(withConduit.summary?.casts.some((c) => c.abilityId === "conjure_skeleton_warrior")).toBe(
      true,
    );

    const shieldPool = buildCandidatePool(NECROMANCY_ABILITIES, "necromancy", {
      weaponConfiguration: tankPacked.weaponConfiguration,
    });
    // Conjures illegal under shield; pool drops them at build time.
    expect(shieldPool.byId.has("conjure_skeleton_warrior")).toBe(false);
    expect(shieldPool.byId.has("touch_of_death")).toBe(true);

    const blocked = evaluateRevolutionBar({
      bar: ["conjure_skeleton_warrior", "touch_of_death"],
      style: "necromancy",
      durationTicks: 30,
      pool: buildCandidatePool(NECROMANCY_ABILITIES, "necromancy", {
        weaponConfiguration: "necromancy",
      }),
      sim: {
        base: tankPacked.base,
        level: tankPacked.level,
        accuracy: tankPacked.accuracy,
        crit: tankPacked.crit,
        abilities: NECROMANCY_ABILITIES,
        weaponConfiguration: tankPacked.weaponConfiguration,
        equipmentIds: tankPacked.equipmentIds,
      },
      profileId: "balanced",
    });
    // Bar may fail eligibility or cast zero conjures; never summon under shield shape.
    if (blocked.ok && blocked.summary) {
      expect(blocked.summary.casts.some((c) => c.abilityId === "conjure_skeleton_warrior")).toBe(
        false,
      );
    } else {
      expect(blocked.ok).toBe(false);
    }
  });

  it("projectSerializableSimBase matches packSimBaseFromModel and model snapshot pack", () => {
    const loadout = withLoadout({
      perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 3, lunging: 2, precise: 4 },
      buffs: { ...DEFAULT_LOADOUT.buffs, vulnerability: true },
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      target: {
        ...TARGET_DEFAULTS,
        onSlayerTask: true,
        demon: true,
        elementalWeakness: "water",
        dragonfireImmune: true,
        incomingHitIntervalSeconds: 2.4,
      },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    const fromModel = projectSerializableSimBase(model);
    const fromPack = packSimBaseFromModel(model);
    const fromSnap = packSimBase(solverSnapshotFromResolvedModel(model));

    expect(fromPack).toEqual(fromModel);
    expect(fromSnap).toEqual(fromModel);
    expect(fromSnap.incomingHitIntervalSeconds).toBe(2.4);
    expect(fromModel.modifierSources.target).toMatchObject({
      elementalWeakness: "water",
      dragonfireImmune: true,
    });
  });

  it("keeps poison sources separate from canonical ammo, modifier, and target inputs", () => {
    const loadout = withLoadout({
      buffs: {
        ...DEFAULT_LOADOUT.buffs,
        vulnerability: true,
        weaponPoison: "weapon-plus-plus",
        kwuarmPotency: 4,
        herbloreLevel: 120,
      },
      equipmentSlots: {
        twohand: "item:laniakeas-spear",
        gloves: "item:cinderbane-gloves",
        ammo: "item:bik-arrows",
      },
      target: { ...TARGET_DEFAULTS, poisonImmune: true },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    expect(model.playerPoison).toEqual({
      potion: "weapon-plus-plus",
      potionUntilTick: 1_000,
      kwuarmPotency: 4,
      cinderbane: true,
      blowpipe: false,
      laniakea: true,
    });
    expect(model.ammunition).toBeNull();
    expect(model.modifierSources.vulnerability).toBe(true);
    expect(model.target.poisonImmune).toBe(true);
    expect(model.league.herbloreLevel).toBe(120);
    expect(projectSerializableSimBase(model).ammunition).toBeNull();
    expect(projectSerializableSimBase(model)).toMatchObject({
      playerPoison: model.playerPoison,
      targetPoisonImmune: true,
    });

    const blowpipe = toResolvedCombatModel(
      withLoadout({
        style: "ranged",
        equipmentSlots: { twohand: "item:upgraded-bone-blowpipe" },
      }),
      { now: NOW },
    );
    expect(blowpipe.playerPoison.blowpipe).toBe(true);
  });
});

describe("Tuska slayer task UI → sim wiring", () => {
  it("maps onSlayerTask + slayerLevel onto model, sim base, and snapshot", () => {
    const loadout = withLoadout({
      slayerLevel: 99,
      target: { ...TARGET_DEFAULTS, onSlayerTask: true },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    expect(model.slayerOnTask).toBe(true);
    expect(model.slayerLevel).toBe(99);

    const simBase = projectSerializableSimBase(model);
    expect(simBase.slayerOnTask).toBe(true);
    expect(simBase.slayerLevel).toBe(99);

    const snap = solverSnapshotFromResolvedModel(model);
    expect(snap.slayerOnTask).toBe(true);
    expect(snap.slayerLevel).toBe(99);
    expect(packSimBase(snap)).toMatchObject({ slayerOnTask: true, slayerLevel: 99 });
    expect(packSimBaseFromModel(model)).toMatchObject({ slayerOnTask: true, slayerLevel: 99 });
  });

  it("does not invent slayerLevel when only on-task is set", () => {
    const loadout = withLoadout({
      target: { ...TARGET_DEFAULTS, onSlayerTask: true },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    expect(model.slayerOnTask).toBe(true);
    expect(model.slayerLevel).toBeUndefined();
    expect(projectSerializableSimBase(model).slayerLevel).toBeUndefined();
  });

  it("does not set slayerOnTask when only level is present", () => {
    const loadout = withLoadout({ slayerLevel: 120 });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    expect(model.slayerOnTask).toBeUndefined();
    expect(model.slayerLevel).toBe(120);
  });

  it("hostInputFromResolvedModel preserves Tuska slayer fields through overlay", () => {
    const loadout = withLoadout({
      slayerLevel: 99,
      target: { ...TARGET_DEFAULTS, onSlayerTask: true },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    const rehosted = hostInputFromResolvedModel(model);
    expect(rehosted.slayerOnTask).toBe(true);
    expect(rehosted.slayerLevel).toBe(99);
  });

  it("empowers tuskas_wrath from loadout on-task + level 99", () => {
    const loadout = withLoadout({
      slayerLevel: 99,
      target: { ...TARGET_DEFAULTS, onSlayerTask: true },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    const ability = abilityStyleForBar(TUSKAS_WRATH, model.style);
    const analysis = analyzeSingleCast(model, ability);
    expect(analysis.ok, analysis.error).toBe(true);
    expect(analysis.expected).toBe(9900);
    expect(ability.cooldownSeconds).toBe(15);
    // Empowered cast uses 120s CD on the cast path (spec default stays 15).
    expect(TUSKAS_EMPOWERED_COOLDOWN_SECONDS).toBe(120);
  });

  it("stays off-task without level even when onSlayerTask is true", () => {
    const loadout = withLoadout({
      target: { ...TARGET_DEFAULTS, onSlayerTask: true },
    });
    const model = toResolvedCombatModel(loadout, { now: NOW });
    const ability = abilityStyleForBar(TUSKAS_WRATH, model.style);
    const analysis = analyzeSingleCast(model, ability);
    expect(analysis.ok, analysis.error).toBe(true);
    // Off-task band 75-85% AD, not 100x Slayer.
    expect(analysis.expected).not.toBe(9900);
    expect(analysis.expected).toBeLessThan(5000);
  });
});
