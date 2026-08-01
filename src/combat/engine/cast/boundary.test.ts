import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { rotationOf } from "../simulation/contracts";
import { simulate, type SimulateInput } from "../simulation/simulate";
import { createCastContext } from "../simulation/simulate";

/**
 * Regression coverage for the cast-branch preparation boundary: future-tick
 * evaluation uses the advanced state at the candidate tick, branching commits
 * the same prepared cast as direct execution, and rejection mutates nothing
 * beyond the canonical time advance.
 */

const meleeInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
};

const rangedInput: Omit<SimulateInput, "rotation"> = {
  ...meleeInput,
  abilities: RANGED_ABILITIES,
  context: { style: "ranged" },
};

describe("cast boundary — candidate-tick evaluation", () => {
  it("a Deathspore buff triggered by channel hits during the wait makes the next cast free", () => {
    // 6 attacks (6 stacks) → Rapid Fire's landed hits build stacks 7-12 while
    // the actor is still channelling; the 12th lands at tick 23, the actor is
    // free at 26, and Corruption Shot at 26 must be evaluated against the
    // advanced state (buff active), not the pre-channel one.
    const s = simulate({
      ...rangedInput,
      ammo: "deathspore",
      rotation: rotationOf(...Array(6).fill("ranged_attack"), "rapid_fire", "corruption_shot"),
    });
    expect(s.ok).toBe(true);
    const corruption = s.casts.at(-1)!;
    expect(corruption.abilityId).toBe("corruption_shot");
    expect(corruption.tick).toBe(26);
    // Free cast: 54 − 25 (Rapid Fire) = 29 adrenaline, spend 0 for Corruption.
    expect(corruption.adrenalineAfter).toBe(29);
  });

  it("the same cast pays full price once the window has lapsed at the candidate tick", () => {
    // As above, but three idle attacks push the candidate past the 15-tick
    // window (23 + 15 = 38): evaluated at the candidate, the buff is gone.
    const s = simulate({
      ...rangedInput,
      ammo: "deathspore",
      rotation: rotationOf(
        ...Array(6).fill("ranged_attack"),
        "rapid_fire",
        ...Array(4).fill("ranged_attack"),
        "corruption_shot",
      ),
    });
    expect(s.ok).toBe(true);
    const corruption = s.casts.at(-1)!;
    // 29 + 4×9 = 65 on hand, spend the full 20.
    expect(corruption.adrenalineAfter).toBe(65 - 20);
  });
});

describe("cast boundary — branching commits the prepared cast", () => {
  it("Relentless branches across a cooldown wait with the candidate-tick spend", () => {
    const s = simulate({
      ...meleeInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf(...Array(6).fill("attack"), "assault", "assault"),
    });
    expect(s.ok).toBe(true);
    // First assault at 18 splits (0.05 refund / 0.95 spend). In the refund
    // branch the lockout blocks a second point; in the spend branch the second
    // assault (candidate 28, after its 10-tick cooldown) splits again.
    expect(s.rng?.branches).toBe(3);
    // Modal branch (0.95², no refunds): 54 − 25 − 25 adrenaline.
    expect(s.casts.at(-1)!.adrenalineAfter).toBe(4);
  });
});

describe("cast boundary — rejection is mutation-free beyond the advance", () => {
  it("a rejected future cast leaves only the canonical time advance behind", () => {
    const ctx = createCastContext(meleeInput);
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    ctx.performCast(attack, 0, false);
    ctx.performCast(attack, 3, false);
    const before = ctx.getState();
    // Assault at tick 30: 18 adrenaline < 25. The wait itself changes nothing
    // here (no passive windows), so the state must be the plain advance.
    const attempt = ctx.performCast(assault, 30, false);
    expect(attempt.ok).toBe(false);
    const after = ctx.getState();
    expect(after.tick).toBe(30);
    expect({ ...after, tick: before.tick }).toEqual(before);
    expect(after.cooldowns["assault"]).toBeUndefined();
    expect(after.melee.stacks).toBe(before.melee.stacks);
    const s = ctx.finish();
    expect(s.casts).toHaveLength(2); // no phantom cast record
  });
});
