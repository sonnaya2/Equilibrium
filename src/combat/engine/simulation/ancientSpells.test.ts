import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { resolveLeagueRules } from "../../league/ruleset";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import {
  ANCIENT_SPELL_STACK_DURATION_TICKS,
  activeSpellStacks,
} from "../../styles/magic/ancientSpells";
import { performCast } from "../cast";
import { advanceTo } from "../runtime/clock";
import { createRuntime } from "../runtime/runtime";
import { magicInput } from "../../test/fixtures/inputs";
import { calculateHit } from "../../pipeline/calculateHit";
import { patchMagic } from "../runtime/state";
import { resolveLightningSurge } from "../resolution/lightningSurge";

const BASIC: AbilitySpec = {
  id: "spell_test_basic",
  name: "Spell test basic",
  style: "magic",
  category: "basic",
  hits: [{ band: { minPct: 100, maxPct: 100 } }],
  adrenaline: { gain: 9 },
};

const ENHANCED: AbilitySpec = {
  id: "spell_test_enhanced",
  name: "Spell test enhanced",
  style: "magic",
  category: "enhanced",
  hits: [{ band: { minPct: 100, maxPct: 100 } }],
};

describe("Exsanguinate", () => {
  it("adds one Blood Tithe stack per cast and buffs only Magic basics", () => {
    const rt = createRuntime({
      ...magicInput,
      abilities: [BASIC, ENHANCED],
      magicSpell: "exsanguinate",
      startingAdrenaline: 0,
    });

    for (let cast = 0; cast < 12; cast++) {
      expect(performCast(rt, BASIC, rt.state.tick, false)).toEqual({ ok: true });
    }

    expect(rt.casts[0]!.result.expected).toBe(1010);
    expect(rt.casts[11]!.result.expected).toBe(1120);
    expect(rt.state.magic.bloodTithe.stacks).toBe(12);

    expect(performCast(rt, ENHANCED, rt.state.tick, false)).toEqual({ ok: true });
    expect(rt.casts.at(-1)!.result.expected).toBe(1000);
    expect(rt.state.magic.bloodTithe.stacks).toBe(12);
  });

  it("expires Blood Tithe on the 20-second boundary", () => {
    const rt = createRuntime({
      ...magicInput,
      abilities: [BASIC],
      magicSpell: "exsanguinate",
    });
    expect(performCast(rt, BASIC, 0, false)).toEqual({ ok: true });
    const expiresAt = rt.state.magic.bloodTithe.expiresAtTick;
    expect(expiresAt).toBe(ANCIENT_SPELL_STACK_DURATION_TICKS);
    expect(activeSpellStacks(rt.state.magic.bloodTithe, expiresAt - 1)).toBe(1);

    advanceTo(rt, expiresAt);
    expect(rt.state.magic.bloodTithe).toEqual({ stacks: 0, expiresAtTick: 0 });
  });

  it("increases Instability Lightning Surge damage without generating another stack", () => {
    const rt = createRuntime({ ...magicInput, magicSpell: "exsanguinate" });
    rt.state = patchMagic(rt.state, {
      bloodTithe: { stacks: 5, expiresAtTick: 100 },
    });
    rt.hitDetails.set(
      1,
      calculateHit({
        base: 1000,
        band: { minPct: 100, maxPct: 100 },
        level: 99,
        accuracy: 1,
        crit: { chance: 1, eligible: true },
        modifiers: [],
        context: { style: "magic", damageSource: "direct" },
      }),
    );

    const surge = resolveLightningSurge(rt, 1, 1);
    expect(surge.damage.expected).toBeCloseTo(840, 0);
    expect(surge.damage.expected).toBeGreaterThan(800);
    expect(rt.state.magic.bloodTithe.stacks).toBe(5);
  });
});

describe("Incite Fear", () => {
  it("triggers a 10-50% Frost Surge on the fifth cast and keeps five stacks", () => {
    const league = resolveLeagueRules({ ruleset: "base" }, { areaTargets: 4 });
    const rt = createRuntime({
      ...magicInput,
      abilities: [BASIC],
      magicSpell: "incite-fear",
      league,
      startingAdrenaline: 0,
    });

    for (let cast = 0; cast < 5; cast++) {
      expect(performCast(rt, BASIC, rt.state.tick, false)).toEqual({ ok: true });
    }

    const frost = rt.events.find((event) => event.abilityId === "frost_surge");
    expect(frost).toMatchObject({
      tick: 12,
      family: "proc",
      expectedActivations: 1,
      expectedSeparateHits: 4,
      provenance: { kind: "spell_proc", detail: "frost_surge" },
      damage: { min: 400, max: 2000, expected: 1200 },
    });
    expect(rt.perAbility.frost_surge).toBe(1200);
    expect(rt.state.magic.glacialEmbrace.stacks).toBe(5);
    expect(rt.state.magic.frostSurgeReadyTick).toBe(32);
  });

  it("reduces Tsunami to 40 adrenaline at five stacks without retriggering on cooldown", () => {
    const tsunami = MAGIC_ABILITIES.find((ability) => ability.id === "tsunami")!;
    const rt = createRuntime({
      ...magicInput,
      abilities: [BASIC, tsunami],
      magicSpell: "incite-fear",
      startingAdrenaline: 0,
    });

    for (let cast = 0; cast < 5; cast++) {
      expect(performCast(rt, BASIC, rt.state.tick, false)).toEqual({ ok: true });
    }
    expect(rt.state.adrenaline).toBe(45);
    expect(performCast(rt, tsunami, rt.state.tick, false)).toEqual({ ok: true });

    const record = rt.casts.at(-1)!;
    expect(record.abilityId).toBe("tsunami");
    expect(record.effectiveCost).toBe(40);
    expect(record.actualSpend).toBe(40);
    expect(rt.state.adrenaline).toBe(5);
    expect(rt.events.filter((event) => event.abilityId === "frost_surge")).toHaveLength(1);
  });
});
