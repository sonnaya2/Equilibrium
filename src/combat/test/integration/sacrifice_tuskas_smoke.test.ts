import { describe, expect, it } from "vitest";
import { entryByEngineId, engineSpecs } from "../../abilities/registry";
import { secondsToTicks } from "../../core/ticks";
import { MODERNISATION_WIKI } from "../../data/sources";
import { abilityStyleForBar } from "../../styles/shared/constitutionAbilities";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { baseInput, magicInput, necroInput, rangedInput } from "../fixtures/inputs";
import { leagueModifiers, resolveLeagueRules } from "../../league/ruleset";
import type { CombatModifier } from "../../types";

const STYLE_INPUT = {
  melee: baseInput,
  ranged: rangedInput,
  magic: magicInput,
  necromancy: necroInput,
} as const;

/**
 * Sacrifice / Tuska's Wrath are Constitution abilities. Engine specs must cast
 * once under each style stamp so Revo/manual paths do not crash.
 */
describe("sacrifice / tuskas_wrath engine smoke", () => {
  for (const id of ["sacrifice", "tuskas_wrath"] as const) {
    it(`simulates one cast of ${id} when present in the engine registry`, () => {
      const entry = entryByEngineId(id);
      expect(entry, `${id} missing from registry`).toBeDefined();
      expect(engineSpecs.has(id)).toBe(true);

      for (const style of ["melee", "ranged", "magic", "necromancy"] as const) {
        const fixture = STYLE_INPUT[style];
        const stamped = abilityStyleForBar(entry!.spec, style);
        const s = simulate({
          ...fixture,
          abilities: [...fixture.abilities, stamped],
          context: { ...(fixture.context ?? {}), style },
          rotation: rotationOf(id),
        });
        expect(s.ok, `${id}@${style}: ${s.error ?? "simulate failed"}`).toBe(true);
        expect(
          s.casts.some((c) => c.abilityId === id),
          `${id}@${style}`,
        ).toBe(true);
      }
    });
  }

  it("tuskas_wrath applies a 15s cooldown after cast", () => {
    const entry = entryByEngineId("tuskas_wrath")!;
    const stamped = abilityStyleForBar(entry.spec, "melee");
    const s = simulate({
      ...baseInput,
      abilities: [...baseInput.abilities, stamped],
      rotation: rotationOf("tuskas_wrath"),
    });
    expect(s.ok, s.error).toBe(true);
    expect(entry.spec.cooldownSeconds).toBe(15);
    expect(secondsToTicks(15)).toBe(25);
  });

  it("sacrifice totalHealed is 25% of damage", () => {
    const entry = entryByEngineId("sacrifice")!;
    const stamped = abilityStyleForBar(entry.spec, "melee");
    const s = simulate({
      ...baseInput,
      abilities: [...baseInput.abilities, stamped],
      rotation: rotationOf("sacrifice"),
    });
    expect(s.ok, s.error).toBe(true);
    expect(s.totalHealed).toBe(175);
    expect(s.casts.find((c) => c.abilityId === "sacrifice")?.expectedHeal).toBe(175);
  });

  it("tuskas on-task smoke: empowered damage and 120s CD", () => {
    const entry = entryByEngineId("tuskas_wrath")!;
    const stamped = abilityStyleForBar(entry.spec, "melee");
    const s = simulate({
      ...baseInput,
      abilities: [...baseInput.abilities, stamped],
      rotation: rotationOf("tuskas_wrath"),
      slayerOnTask: true,
      slayerLevel: 120,
    });
    expect(s.ok, s.error).toBe(true);
    expect(s.perAbility.tuskas_wrath).toBe(12_000);
  });

  it("keeps the empowered Tuska Slayer-50 case below cap and applies only Havoc's final multiplier", () => {
    const entry = entryByEngineId("tuskas_wrath")!;
    const stamped = abilityStyleForBar(entry.spec, "melee");
    const withoutHavoc = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Balance", "Balance", "Balance"],
    });
    const withHavoc = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Balance", "Balance", "Chaos"],
    });
    const run = (league: typeof withoutHavoc, modifiers = leagueModifiers(league)) =>
      simulate({
        ...baseInput,
        abilities: [...baseInput.abilities, stamped],
        league,
        modifiers,
        context: { style: "melee", ruleset: "equilibrium" },
        rotation: rotationOf("tuskas_wrath"),
        slayerOnTask: true,
        slayerLevel: 50,
      });

    expect(run(withoutHavoc).perAbility.tuskas_wrath).toBe(5_000);
    expect(run(withHavoc).perAbility.tuskas_wrath).toBe(6_000);
    const ordinaryAbilityModifier: CombatModifier = {
      id: "test:ordinary-ability-stage",
      stage: "ability",
      priority: 0,
      applies: () => true,
      apply: (state) => ({ ...state, damage: state.damage * 2 }),
      source: MODERNISATION_WIKI,
    };
    expect(
      run(withHavoc, [...leagueModifiers(withHavoc), ordinaryAbilityModifier]).perAbility
        .tuskas_wrath,
    ).toBe(6_000);
  });
});
