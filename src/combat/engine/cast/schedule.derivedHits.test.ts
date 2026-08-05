import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { createRuntime } from "../runtime/runtime";
import type { CastContextInput } from "../simulation/contracts";
import { prepareSimulationCast } from ".";
import { scheduleCastEvents } from "./schedule";

const meleeInput: CastContextInput = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
  context: { style: "melee" },
};

const mismatchedDerived: AbilitySpec = {
  id: "bad_fraction_pcts",
  name: "Bad fractionPcts",
  style: "melee",
  category: "basic",
  hits: [{ band: { minPct: 100, maxPct: 100 } }],
  adrenaline: { gain: 8 },
  derivedHits: {
    count: 4,
    intervalTicks: 2,
    firstOffset: 2,
    fractionPct: 80,
    fractionPcts: [80, 60],
    dot: true,
  },
};

const sparseDerived: AbilitySpec = {
  id: "sparse_fraction_pcts",
  name: "Sparse fractionPcts",
  style: "melee",
  category: "basic",
  hits: [{ band: { minPct: 100, maxPct: 100 } }],
  adrenaline: { gain: 8 },
  derivedHits: {
    count: 4,
    intervalTicks: 2,
    firstOffset: 2,
    fractionPct: 80,
    // length matches count but index 1 is hole; JSON would drop it - force undefined slot
    fractionPcts: [80, undefined as unknown as number, 40, 20],
    dot: true,
  },
};

describe("scheduleCastEvents derivedHits.fractionPcts", () => {
  it("throws when fractionPcts length does not equal count", () => {
    const rt = createRuntime({
      ...meleeInput,
      abilities: [...MELEE_ABILITIES, mismatchedDerived],
    });
    const prep = prepareSimulationCast(rt, mismatchedDerived, 0);
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;
    expect(() => scheduleCastEvents(rt, prep.prepared, false)).toThrow(
      "derivedHits.fractionPcts length 2 != count 4 for bad_fraction_pcts",
    );
  });

  it("throws when a fractionPcts slot is not a finite number", () => {
    const rt = createRuntime({
      ...meleeInput,
      abilities: [...MELEE_ABILITIES, sparseDerived],
    });
    const prep = prepareSimulationCast(rt, sparseDerived, 0);
    expect(prep.ok).toBe(true);
    if (!prep.ok) return;
    expect(() => scheduleCastEvents(rt, prep.prepared, false)).toThrow(
      "derivedHits.fractionPcts[1] is not a finite number for sparse_fraction_pcts",
    );
  });
});
