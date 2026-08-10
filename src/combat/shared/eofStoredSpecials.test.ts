import { describe, expect, it } from "vitest";
import { allEngineSpecs } from "../abilities/registry";
import { resolveAbilityCastAvailability } from "./requirements";
import { eofStorableSpecials, isEofStorableSpecial } from "./eofStoredSpecials";
import { projectSerializableSimBase, buildSimulationInputBase } from "../model";
import { resolveAbilityCatalogue } from "../abilities/catalogue";
import { reviveRevolutionBase } from "../solver/worker/revive";
import { canonicalSimulationIdentity } from "../solver/identity";
import { stableStringify } from "../solver/fingerprint";
import { activeEquipmentEffects } from "./equipment";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { NECROMANCY_ABILITIES } from "../styles/necromancy/abilities";

const EOF = "item:essence-of-finality";

describe("EoF storable specials catalogue", () => {
  it("lists every requiresSpecialAccess weapon special and nothing else", () => {
    const listed = eofStorableSpecials();
    const ids = new Set(listed.map((s) => s.id));
    for (const spec of allEngineSpecs()) {
      if (isEofStorableSpecial(spec)) {
        expect(ids.has(spec.id), spec.id).toBe(true);
      } else {
        expect(ids.has(spec.id), spec.id).toBe(false);
      }
    }
    // Known modelled set (any special that can go in EoF).
    for (const id of [
      "icy_tempest",
      "igneous_showdown",
      "instability",
      "claws_of_guthix",
      "soulfire",
      "balance_by_force",
      "death_grasp",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});

describe("EoF stored special end-to-end access", () => {
  const cases = [
    { id: "icy_tempest", weaponConfiguration: "twohand" as const, pool: MELEE_ABILITIES },
    { id: "igneous_showdown", weaponConfiguration: "twohand" as const, pool: MELEE_ABILITIES },
    { id: "instability", weaponConfiguration: "twohand" as const, pool: MAGIC_ABILITIES },
    { id: "claws_of_guthix", weaponConfiguration: "twohand" as const, pool: MAGIC_ABILITIES },
    { id: "soulfire", weaponConfiguration: "twohand" as const, pool: MAGIC_ABILITIES },
    { id: "balance_by_force", weaponConfiguration: "twohand" as const, pool: RANGED_ABILITIES },
    { id: "death_grasp", weaponConfiguration: "necromancy" as const, pool: NECROMANCY_ABILITIES },
  ];

  it.each(cases)(
    "EoF alone fails closed for $id; matching store unlocks",
    ({ id, pool, weaponConfiguration }) => {
      const ability = pool.find((a) => a.id === id)!;
      expect(ability.requiresSpecialAccess).toBe(true);
      expect(
        resolveAbilityCastAvailability(ability, {
          weaponConfiguration,
          equipmentIds: [EOF],
          activeWeapon: { specialAttackId: null },
        }).available,
      ).toBe(false);
      expect(
        resolveAbilityCastAvailability(ability, {
          weaponConfiguration,
          equipmentIds: [EOF],
          activeWeapon: { specialAttackId: null },
          eofStoredSpecialId: id,
        }).available,
      ).toBe(true);
      expect(
        resolveAbilityCastAvailability(ability, {
          weaponConfiguration,
          equipmentIds: [EOF],
          activeWeapon: { specialAttackId: null },
          eofStoredSpecialId: "not_this_special",
        }).available,
      ).toBe(false);
    },
  );
});

describe("EoF store packs through model → wire → revive → identity", () => {
  it("fingerprint changes when stored special changes via projectSerializableSimBase shape", () => {
    // Minimal wire objects (skip full host diagnostics) - pack field + identity only.
    const none = {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      equipmentEffects: activeEquipmentEffects({ style: "magic" }),
      equipmentIds: [EOF],
      weaponConfiguration: "twohand" as const,
      modifierSources: {
        setCounts: [] as const,
        vulnerability: false,
        styleCurseId: "none" as const,
        amZiFlatDamage: 0,
        amHejDamageBonus: 0,
        slayer: { demon: 0, dragon: 0, undead: 0 },
        target: {
          demon: false,
          dragon: false,
          undead: false,
          elementalWeakness: "unknown" as const,
          dragonfireImmune: false,
        },
        slayerHelmet: null,
        salve: null,
        ultimatums: 0,
        lunging: 0,
        caroming: 0,
        berserkersFuryBonus: 0,
      },
      league: {
        ruleset: "base" as const,
        blessings: [] as const,
        blessingIds: [] as const,
        relics: [] as const,
        totalArmour: 0,
        maximumLife: 9900,
        powerburstUntilTick: 0,
        targetSize: 1,
        occupiedTiles: 1,
      },
    };
    const soulfire = { ...none, eofStoredSpecialId: "soulfire" };
    const tempest = { ...none, eofStoredSpecialId: "icy_tempest" };

    expect(reviveRevolutionBase(soulfire).eofStoredSpecialId).toBe("soulfire");
    expect(reviveRevolutionBase(tempest).eofStoredSpecialId).toBe("icy_tempest");

    const idSoul = stableStringify(canonicalSimulationIdentity(soulfire));
    const idTempest = stableStringify(canonicalSimulationIdentity(tempest));
    const idNone = stableStringify(canonicalSimulationIdentity(none));
    expect(idSoul).not.toBe(idTempest);
    expect(idSoul).not.toBe(idNone);
  });

  it("buildSimulationInputBase forwards eofStoredSpecialId from model", () => {
    const catalogue = resolveAbilityCatalogue();
    // Use toResolvedCombatModel path via minimal host with diagnostics through loadout is heavy;
    // assert simulationBase from a hand-built model shape matching ResolvedCombatModel.
    const model = {
      style: "magic" as const,
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      equipmentIds: [EOF],
      equipmentEffects: activeEquipmentEffects({ style: "magic" }),
      weaponConfiguration: "twohand" as const,
      nativeSpecialPolicy: { useEquippedWeaponSpecial: false },
      eofStoredSpecialId: "soulfire",
      modifierSources: {
        setCounts: [] as readonly (readonly [string, number])[],
        vulnerability: false,
        styleCurseId: "none" as const,
        amZiFlatDamage: 0,
        amHejDamageBonus: 0,
        slayer: { demon: 0, dragon: 0, undead: 0 },
        target: {
          demon: false,
          dragon: false,
          undead: false,
          elementalWeakness: "unknown" as const,
          dragonfireImmune: false,
        },
        slayerHelmet: null,
        salve: null,
        ultimatums: 0,
        lunging: 0,
        caroming: 0,
        berserkersFuryBonus: 0,
      },
      adrenaline: {},
      procs: {},
      plantedFeet: false,
      strengthCape99: false,
      preciseRank: 0,
      ammunition: null,
      enchantedBoltChanceModifiers: { rangedCape: false, eliteSeersVillage: false },
      caromingRank: 0,
      conjureBasicDamageMult: 1,
      conjureDurationMult: 1,
      tumekensPieces: 0,
      target: {
        hpPercent: undefined,
        maximumLifePoints: undefined,
        demon: false,
        dragon: false,
        undead: false,
        poisonImmune: false,
        elementalWeakness: "unknown" as const,
        dragonfireImmune: false,
      },
      playerPoison: {
        potion: "none" as const,
        potionUntilTick: 0,
        kwuarmPotency: 0 as const,
        cinderbane: false,
        blowpipe: false,
        laniakea: false,
      },
      league: {
        ruleset: "base" as const,
        blessings: [] as const,
        blessingIds: [] as const,
        relics: [] as const,
        totalArmour: 0,
        maximumLife: 9900,
        powerburstUntilTick: 0,
        targetSize: 1,
        occupiedTiles: 1,
      },
      context: { style: "magic" as const, ruleset: "base" as const },
      cap: { cap: 30_000, bypass: false },
      startingAdrenaline: 100,
      diagnostics: {
        slayerHelmet: null,
        salve: null,
        berserkersFury: {
          active: false,
          bonus: 0,
          currentLifePoints: 4950,
          maximumLifePoints: 9900,
          currentHealthPercent: 50,
        },
        powerburstRemainingTicks: 0,
        ringOfVigourActive: false,
        ringOfVigourSources: [] as string[],
        archaeologySelectedIds: [] as string[],
        maxAdrenaline: 100,
      },
    };
    const simBase = buildSimulationInputBase(model, catalogue);
    expect(simBase.eofStoredSpecialId).toBe("soulfire");
    expect(projectSerializableSimBase(model).eofStoredSpecialId).toBe("soulfire");
  });
});
