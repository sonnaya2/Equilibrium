import { describe, expect, it } from "vitest";
import { allEngineSpecs, engineSpecs, engineSpecsForStyle } from "../../abilities/registry";
import { secondsToTicks } from "../../core/ticks";
import { resolveBarSlot } from "../../data/specs";
import { createCastContext } from "../../engine/simulation/simulate";
import { calculateAbility } from "../../pipeline/calculateAbility";
import { buildCandidatePool } from "../../solver/candidatePool";
import { baseInput } from "../../test/fixtures/inputs";
import {
  abilityStyleForBar,
  isSharedConstitutionAbilityId,
  SACRIFICE,
  SHARED_CONSTITUTION_ABILITIES,
  TUSKAS_WRATH,
} from "./constitutionAbilities";

const STYLES = ["melee", "ranged", "magic", "necromancy"] as const;

describe("shared constitution abilities", () => {
  it("registers sacrifice and tuskas_wrath once each", () => {
    expect(SHARED_CONSTITUTION_ABILITIES.map((a) => a.id)).toEqual([
      "sacrifice",
      "tuskas_wrath",
    ]);
    expect(isSharedConstitutionAbilityId("sacrifice")).toBe(true);
    expect(isSharedConstitutionAbilityId("tuskas_wrath")).toBe(true);
    expect(isSharedConstitutionAbilityId("rend")).toBe(false);
    expect(allEngineSpecs().filter((a) => a.id === "sacrifice")).toHaveLength(1);
    expect(allEngineSpecs().filter((a) => a.id === "tuskas_wrath")).toHaveLength(1);
  });

  it("uses wiki bands, adren, and CDs", () => {
    expect(SACRIFICE.category).toBe("basic");
    expect(SACRIFICE.hits).toEqual([{ band: { minPct: 65, maxPct: 75 } }]);
    expect(SACRIFICE.adrenaline).toEqual({ gain: 9 });
    expect(SACRIFICE.cooldownSeconds).toBe(30);
    expect(SACRIFICE.supportStatus).toBeUndefined();
    expect(SACRIFICE.supportNote).toMatch(/heal/i);

    expect(TUSKAS_WRATH.category).toBe("basic");
    expect(TUSKAS_WRATH.hits).toEqual([{ band: { minPct: 75, maxPct: 85 } }]);
    expect(TUSKAS_WRATH.adrenaline).toEqual({ gain: 9 });
    expect(TUSKAS_WRATH.cooldownSeconds).toBe(15);
    expect(TUSKAS_WRATH.supportStatus).toBeUndefined();
    expect(TUSKAS_WRATH.supportNote).toMatch(/on-task/i);
  });

  it("remaps style per bar without cloning engine id", () => {
    const necroSac = abilityStyleForBar(SACRIFICE, "necromancy");
    expect(necroSac.id).toBe("sacrifice");
    expect(necroSac.style).toBe("necromancy");
    expect(abilityStyleForBar(SACRIFICE, "melee")).toBe(SACRIFICE);

    const magicTuska = abilityStyleForBar(TUSKAS_WRATH, "magic");
    expect(magicTuska.id).toBe("tuskas_wrath");
    expect(magicTuska.style).toBe("magic");
  });

  it("calculateAbility deals expected band damage at base 1000", () => {
    const sac = calculateAbility(SACRIFICE, {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
    });
    expect(sac.min).toBe(650);
    expect(sac.max).toBe(750);
    expect(sac.expected).toBe(700);
    expect(sac.listedAdrenalineDelta).toBe(9);

    const tuska = calculateAbility(TUSKAS_WRATH, {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
    });
    expect(tuska.min).toBe(750);
    expect(tuska.max).toBe(850);
    expect(tuska.expected).toBe(800);
    expect(tuska.listedAdrenalineDelta).toBe(9);
  });

  it("appears in every style candidate pool and engineSpecsForStyle", () => {
    const catalogue = allEngineSpecs();
    for (const style of STYLES) {
      const pool = buildCandidatePool(catalogue, style);
      expect(pool.byId.has("sacrifice"), `pool sacrifice ${style}`).toBe(true);
      expect(pool.byId.get("sacrifice")!.style, `pool sacrifice style ${style}`).toBe(style);
      expect(pool.byId.has("tuskas_wrath"), `pool tuskas ${style}`).toBe(true);
      expect(pool.byId.get("tuskas_wrath")!.style, `pool tuskas style ${style}`).toBe(style);

      const specs = engineSpecsForStyle(style);
      expect(specs.find((s) => s.id === "sacrifice")?.style, style).toBe(style);
      expect(specs.find((s) => s.id === "tuskas_wrath")?.style, style).toBe(style);
    }
  });

  it("resolveBarSlot uses engine and bar style for shared record ids", () => {
    const sac = resolveBarSlot(
      { name: "Sacrifice", abilityId: "shared:sacrifice" },
      engineSpecs,
      "magic",
    );
    expect(sac.modelledBy).toBe("engine");
    expect(sac.spec?.id).toBe("sacrifice");
    expect(sac.spec?.style).toBe("magic");
    expect(sac.spec?.hits[0]?.band).toEqual({ minPct: 65, maxPct: 75 });

    const tuska = resolveBarSlot(
      { name: "Tuska's Wrath", abilityId: "shared:tuskas-wrath" },
      engineSpecs,
      "ranged",
    );
    expect(tuska.modelledBy).toBe("engine");
    expect(tuska.spec?.id).toBe("tuskas_wrath");
    expect(tuska.spec?.style).toBe("ranged");
    expect(tuska.spec?.hits[0]?.band).toEqual({ minPct: 75, maxPct: 85 });

    const byEngineId = resolveBarSlot(
      { name: "Tuska's Wrath", abilityId: "tuskas_wrath" },
      engineSpecs,
      "necromancy",
    );
    expect(byEngineId.modelledBy).toBe("engine");
    expect(byEngineId.spec?.style).toBe("necromancy");
  });

  it("casts once and applies 15s (25 tick) cooldown", () => {
    const stamped = abilityStyleForBar(TUSKAS_WRATH, "melee");
    const ctx = createCastContext({
      ...baseInput,
      abilities: [...baseInput.abilities, stamped],
    });
    expect(ctx.performCast(ctx.byId.get("tuskas_wrath")!, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.tuskas_wrath).toBe(secondsToTicks(15));
    expect(secondsToTicks(15)).toBe(25);

    const summary = ctx.finish();
    expect(summary.ok).toBe(true);
    expect(summary.casts.some((c) => c.abilityId === "tuskas_wrath")).toBe(true);
  });
});
