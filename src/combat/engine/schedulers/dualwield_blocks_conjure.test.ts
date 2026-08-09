import { describe, expect, it } from "vitest";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { necroInput } from "../../test/fixtures/inputs";
import { abilityById } from "../../test/helpers/summary";
import { simulateRevolution } from "../simulation/revolution";
import {
  resolveAbilityCatalogue,
  resolveAbilitySpecsFromCatalogue,
} from "../../abilities/catalogue";
import { simulateRevolutionForUi } from "../../solver/uiRunCore";

const army = abilityById(NECROMANCY_ABILITIES, "conjure_undead_army");
const skeleton = abilityById(NECROMANCY_ABILITIES, "conjure_skeleton_warrior");
const soulSap = abilityById(NECROMANCY_ABILITIES, "soul_sap");

/**
 * Conduit gate: "necromancy" is the sim shape. Loadout may store "dualwield" for
 * death-guard + lantern - that must still summon. Shield still blocks conjures.
 */
describe("weaponConfiguration gate for necro conjures", () => {
  it("dualwield (loadout store shape) still casts army at tick 0", () => {
    const s = simulateRevolution({
      ...necroInput,
      weaponConfiguration: "dualwield",
      style: "necromancy",
      bar: [army, soulSap],
      durationTicks: 100,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.some((c) => c.abilityId === "conjure_undead_army" && c.tick === 0)).toBe(true);
  });

  it("shield never casts conjure", () => {
    const s = simulateRevolution({
      ...necroInput,
      weaponConfiguration: "shield",
      style: "necromancy",
      bar: [army, soulSap],
      durationTicks: 100,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.filter((c) => c.abilityId.includes("conjure"))).toHaveLength(0);
  });

  it("necromancy WC casts army at tick 0", () => {
    const s = simulateRevolution({
      ...necroInput,
      weaponConfiguration: "necromancy",
      style: "necromancy",
      bar: [army, skeleton],
      durationTicks: 100,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.some((c) => c.abilityId === "conjure_undead_army" && c.tick === 0)).toBe(true);
  });

  it("UI full-analysis path summons with wiki-like barIds", () => {
    const cat = resolveAbilityCatalogue();
    const barIds = [
      "conjure_undead_army",
      "death_skulls",
      "conjure_vengeful_ghost",
      "soul_sap",
      "touch_of_death",
    ];
    const bar = resolveAbilitySpecsFromCatalogue(cat, barIds);
    const { summary } = simulateRevolutionForUi({
      ...necroInput,
      weaponConfiguration: "dualwield",
      style: "necromancy",
      bar,
      durationTicks: 100,
      abilities: [...cat.catalogue],
    });
    expect(summary.ok).toBe(true);
    expect(summary.casts.some((c) => c.abilityId === "conjure_undead_army")).toBe(true);
    expect(summary.events.some((e) => e.family === "conjureAuto")).toBe(true);
  });
});
