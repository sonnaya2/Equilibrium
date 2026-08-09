import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { rotationOf } from "../simulation/contracts";
import { simulate, type SimulateInput } from "../simulation/simulate";
import { createCastContext } from "../simulation/simulate";
import { simulateRevolution } from "../simulation/revolution";
import { baseInput } from "../../test/fixtures/inputs";
import { lastCast } from "../../test/helpers/summary";
import { meetsWeaponRequirement } from "./rules";
import { testRangedAmmunition } from "../../testing/rangedAmmunition";

/**
 * Regression coverage for cast preparation: future-tick evaluation uses the
 * advanced state at the candidate tick, and stochastic outcomes commit
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
  equipmentIds: ["item:noxious-longbow"],
};

describe("cast boundary — candidate-tick evaluation", () => {
  it("a Deathspore buff triggered by channel hits during the wait makes the next cast free", () => {
    // 6 attacks (6 stacks) → Rapid Fire's landed hits build stacks 7-12 while
    // the actor is still channelling; the 12th lands at tick 23, the actor is
    // free at 26, and Corruption Shot at 26 must be evaluated against the
    // advanced state (buff active), not the pre-channel one.
    const s = simulate({
      ...rangedInput,
      ammunition: testRangedAmmunition("deathspore"),
      rotation: rotationOf(...Array(6).fill("ranged_attack"), "rapid_fire", "corruption_shot"),
    });
    expect(s.ok).toBe(true);
    const corruption = s.casts.at(-1)!;
    expect(corruption.abilityId).toBe("corruption_shot");
    expect(corruption.tick).toBe(26);
    // Free cast: 54 − 25 (Rapid Fire) = 29 adrenaline, spend 0 for Corruption.
    expect(corruption.adrenalineAfter).toBe(29);
    expect(corruption.adrenalineBefore).toBe(29);
    expect(corruption.adrenalineAfterResources).toBe(29);
    expect(corruption.adrenalineTransaction?.spendPreventedBy).toBe("deathspore");
  });

  it("the same cast pays full price once the window has lapsed at the candidate tick", () => {
    // As above, but three idle attacks push the candidate past the 15-tick
    // window (23 + 15 = 38): evaluated at the candidate, the buff is gone.
    const s = simulate({
      ...rangedInput,
      ammunition: testRangedAmmunition("deathspore"),
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

describe("cast boundary — stateful RNG commits the prepared cast", () => {
  it("Relentless samples across a cooldown wait with the candidate-tick spend", () => {
    const s = simulate({
      ...meleeInput,
      adrenaline: { relentlessRank: 5 },
      rotation: rotationOf(...Array(6).fill("attack"), "assault", "assault"),
    });
    expect(s.ok).toBe(true);
    // First assault at 18 splits (0.05 refund / 0.95 spend). In the refund
    // outcome the lockout blocks a second point; in the spend outcome the second
    // assault (candidate 28, after its 10-tick cooldown) splits again.
    expect(s.rng?.lanes).toBe(128);
    // Highest-weight terminal class (0.95², no refunds): 54 − 25 − 25 adrenaline.
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
    expect(after.melee.bloodlust.stacks).toBe(before.melee.bloodlust.stacks);
    const s = ctx.finish();
    expect(s.casts).toHaveLength(2); // no phantom cast record
  });
});

describe("cast legality at the candidate tick", () => {
  it("stalls a repeated cast until its individual cooldown expires (Assault's channel occupies 8 ticks)", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(
        "attack",
        "attack",
        "attack",
        "assault",
        "attack",
        "attack",
        "attack",
        "assault",
      ),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 17, 20, 23, 26]);
  });

  it("fails on adrenaline starvation instead of silently skipping", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("attack", "overpower") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("adrenaline");
    expect(s.casts).toHaveLength(1);
  });

  it("fails on an unknown ability id", () => {
    const s = simulate({ ...baseInput, rotation: rotationOf("definitely_not_real") });
    expect(s.ok).toBe(false);
    expect(s.error).toContain("unknown ability");
  });

  it("advance-then-check: waiting out a cooldown under Meteor Strike's passive makes the repeat cast affordable", () => {
    const s = simulate({
      ...baseInput,
      rotation: rotationOf(
        ...Array(7).fill("attack"),
        "meteor_strike",
        "attack",
        "attack",
        "overpower",
        "overpower",
      ),
    });
    expect(s.ok).toBe(true);
    expect(s.casts.map((c) => c.tick)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 80]);
    const repeat = lastCast(s);
    expect(repeat.abilityId).toBe("overpower");
    // 24% at tick 33 → 100% after the passive-covered wait to the 50-tick cooldown.
    expect(repeat.tick).toBe(80);
  });

  it("shares one cooldown across base and greater replacements", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    expect(ctx.performCast(ctx.byId.get("fury")!, 0, false).ok).toBe(true);
    expect(ctx.firstLegalTick("greater_fury")).toBe(25);
    expect(ctx.performCast(ctx.byId.get("greater_fury")!, ctx.getState().tick, false).ok).toBe(
      true,
    );
    expect(ctx.finish().casts.map((cast) => cast.tick)).toEqual([0, 25]);
  });

  it("rejects selecting both replacement variants in manual and Revolution inputs", () => {
    const manual = simulate({ ...baseInput, rotation: rotationOf("fury", "greater_fury") });
    expect(manual.ok).toBe(false);
    expect(manual.error).toContain("mutually exclusive variants");
    expect(manual.casts).toHaveLength(0);

    const revo = simulateRevolution({
      ...baseInput,
      bar: [
        baseInput.abilities.find((ability) => ability.id === "fury")!,
        baseInput.abilities.find((ability) => ability.id === "greater_fury")!,
      ],
      style: "melee",
      durationTicks: 10,
    });
    expect(revo.ok).toBe(false);
    expect(revo.error).toContain("mutually exclusive variants");
  });

  it("rejects an incompatible weapon without state mutation and lets Revolution skip it", () => {
    const input = {
      ...baseInput,
      startingAdrenaline: 100,
      weaponConfiguration: "dualwield" as const,
    };
    const ctx = createCastContext(input);
    const before = structuredClone(ctx.getState());
    const attempt = ctx.performCast(ctx.byId.get("hurricane")!, 0, false);
    expect(attempt.ok).toBe(false);
    expect(attempt).toMatchObject({ error: "hurricane requires twohand" });
    expect(ctx.getState()).toEqual(before);

    const revo = simulateRevolution({
      ...input,
      bar: [input.abilities.find((ability) => ability.id === "hurricane")!],
      style: "melee",
      durationTicks: 7,
    });
    expect(revo.ok).toBe(true);
    expect(revo.casts.every((cast) => cast.abilityId === "attack")).toBe(true);
  });

  it("requires the matching Igneous cape and shares the variant cooldown", () => {
    const overpower = baseInput.abilities.find((ability) => ability.id === "overpower")!;
    const igneous = baseInput.abilities.find((ability) => ability.id === "overpower_igneous")!;
    const withoutCape = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    expect(withoutCape.performCast(igneous, 0, false).ok).toBe(true);
    const withoutSummary = withoutCape.finish(undefined, 20);
    expect(withoutSummary.casts.some((c) => c.abilityId === "overpower")).toBe(true);
    expect(withoutSummary.casts.every((c) => c.abilityId !== "overpower_igneous")).toBe(true);

    const revo = simulateRevolution({
      ...baseInput,
      startingAdrenaline: 100,
      bar: [igneous],
      style: "melee",
      durationTicks: 12,
    });
    expect(revo.ok).toBe(true);
    expect(revo.casts.some((cast) => cast.abilityId === "overpower")).toBe(true);
    expect(revo.casts.every((cast) => cast.abilityId !== "overpower_igneous")).toBe(true);

    const withCape = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      equipmentIds: ["item:igneous-kal-ket"],
    });
    expect(withCape.performCast(igneous, 0, false).ok).toBe(true);
    expect(withCape.firstLegalTick(overpower.id)).toBe(50);
  });

  it("enforces death guard and conduit semantics", () => {
    const necro = NECROMANCY_ABILITIES.find((ability) => ability.id === "necromancy_basic")!;
    const ctx = createCastContext({
      ...baseInput,
      abilities: [...baseInput.abilities, necro],
      weaponConfiguration: "twohand",
    });
    const before = structuredClone(ctx.getState());
    expect(ctx.performCast(necro, 0, false)).toMatchObject({
      ok: false,
      error: "necromancy_basic requires a necromancy weapon",
    });
    expect(ctx.getState()).toEqual(before);
  });

  it("blocks conjures without a conduit while necrotic abilities still cast with a shield", () => {
    const conjure = NECROMANCY_ABILITIES.find((a) => a.id === "conjure_skeleton_warrior")!;
    const basic = NECROMANCY_ABILITIES.find((a) => a.id === "necromancy_basic")!;
    // Wiki Conjuration: equipment Conduit. Shield keeps necrotic casting (siphon).
    expect(meetsWeaponRequirement(conjure, "necromancy")).toBe(true);
    expect(meetsWeaponRequirement(conjure, "shield")).toBe(false);
    expect(meetsWeaponRequirement(conjure, "mainhand")).toBe(false);
    expect(meetsWeaponRequirement(basic, "shield")).toBe(true);
    expect(meetsWeaponRequirement(basic, "mainhand")).toBe(true);
    expect(meetsWeaponRequirement(basic, "necromancy")).toBe(true);

    const noConduit = createCastContext({
      ...baseInput,
      abilities: NECROMANCY_ABILITIES,
      context: { style: "necromancy" },
      weaponConfiguration: "shield",
    });
    expect(noConduit.performCast(conjure, 0, false)).toMatchObject({
      ok: false,
      error: "conjure_skeleton_warrior requires a conduit",
    });
    expect(noConduit.performCast(basic, 0, false).ok).toBe(true);
  });

  it("lets defenders satisfy dual-wield requirements without treating shields as weapons", () => {
    // Flurry keeps defender-as-dualwield; Adaptive Strike DW is dual weapons only.
    const dualWield = MELEE_ABILITIES.find(
      (ability) => ability.weaponRequirement === "dualwield" && ability.id === "flurry",
    )!;
    const twoHand = MELEE_ABILITIES.find((ability) => ability.weaponRequirement === "twohand")!;
    const unrestricted = MELEE_ABILITIES.find((ability) => ability.weaponRequirement == null)!;
    // Dual-wield melee: offensive OH or defender only.
    expect(meetsWeaponRequirement(dualWield, "defender")).toBe(true);
    expect(meetsWeaponRequirement(dualWield, "dualwield")).toBe(true);
    expect(meetsWeaponRequirement(dualWield, "shield")).toBe(false);
    expect(meetsWeaponRequirement(dualWield, "mainhand")).toBe(false);
    expect(meetsWeaponRequirement(dualWield, "twohand")).toBe(false);
    // Two-hand melee: twohand only.
    expect(meetsWeaponRequirement(twoHand, "twohand")).toBe(true);
    expect(meetsWeaponRequirement(twoHand, "dualwield")).toBe(false);
    expect(meetsWeaponRequirement(twoHand, "defender")).toBe(false);
    expect(meetsWeaponRequirement(twoHand, "shield")).toBe(false);
    expect(meetsWeaponRequirement(twoHand, "mainhand")).toBe(false);
    // Unrestricted: any non-necro shape including shield.
    expect(meetsWeaponRequirement(unrestricted, "shield")).toBe(true);
    expect(meetsWeaponRequirement(unrestricted, "defender")).toBe(true);
    expect(meetsWeaponRequirement(unrestricted, "mainhand")).toBe(true);
    expect(meetsWeaponRequirement(unrestricted, "dualwield")).toBe(true);
    expect(meetsWeaponRequirement(unrestricted, "twohand")).toBe(true);
  });

  it("ignores dual/twohand tags on magic and ranged (wiki: no weapon-type cast gates)", () => {
    // Stale dualwield tags on magic (if present) must not block; ranged never gates.
    const magicTagged = {
      ...MELEE_ABILITIES.find((a) => a.weaponRequirement === "dualwield")!,
      id: "test_magic_dual",
      style: "magic" as const,
    };
    const rangedTagged = {
      ...MELEE_ABILITIES.find((a) => a.weaponRequirement === "twohand")!,
      id: "test_ranged_2h",
      style: "ranged" as const,
    };
    for (const shape of ["mainhand", "shield", "defender", "dualwield", "twohand"] as const) {
      expect(meetsWeaponRequirement(magicTagged, shape)).toBe(true);
      expect(meetsWeaponRequirement(rangedTagged, shape)).toBe(true);
    }
  });
});
