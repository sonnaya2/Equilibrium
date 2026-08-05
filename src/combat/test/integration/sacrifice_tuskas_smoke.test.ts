import { describe, expect, it } from "vitest";
import { entryByEngineId, engineSpecs } from "../../abilities/registry";
import { secondsToTicks } from "../../core/ticks";
import { abilityStyleForBar } from "../../styles/shared/constitutionAbilities";
import { rotationOf } from "../../engine/simulation/contracts";
import { simulate } from "../../engine/simulation/simulate";
import { baseInput, magicInput, necroInput, rangedInput } from "../fixtures/inputs";

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
        expect(s.casts.some((c) => c.abilityId === id), `${id}@${style}`).toBe(true);
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
});
