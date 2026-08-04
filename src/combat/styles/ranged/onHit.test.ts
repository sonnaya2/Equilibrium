import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { rangedInput } from "../../test/fixtures/inputs";
import { lastCast } from "../../test/helpers/summary";
import {
  activePuncture,
  activateSearingWinds,
  activateShadowImbued,
  applyPunctureStack,
  DEATHSPORE_COOLDOWN_TICKS,
  DEATHSPORE_FREE_ABILITY_STACKS,
  DEATHSPORE_FREE_CAST_WINDOW_TICKS,
  deathsporeFreeCastActive,
  extendSearingWinds,
  extendShadowImbued,
  newDeathspore,
  newPuncture,
  newShadowImbued,
  onRangedHit,
  PUNCTURE_CAP,
  PUNCTURE_HIT_PERCENTS,
  punctureHitDamage,
  punctureStoreAmount,
  searingWindsBonusPct,
  shadowImbuedAdrenalinePerHit,
  spendDeathspore,
} from "./onHit";

describe("puncture", () => {
  it("stores damage per stack application", () => {
    let state = newPuncture();
    state = applyPunctureStack(state, 0, 1000, 0);
    state = applyPunctureStack(state, 3, 1000, 0);
    expect(state.stacks).toBe(2);
    expect(state.storedDamage).toBe(20);
  });

  it("caps at 250 stacks", () => {
    let state = newPuncture();
    for (let i = 0; i < 300; i++) state = applyPunctureStack(state, i, 1000, 0);
    expect(state.stacks).toBe(PUNCTURE_CAP);
    expect(state.storedDamage).toBe(PUNCTURE_CAP * 10);
  });

  it("refreshes the 30-second window on application and expires to zero", () => {
    let state = applyPunctureStack(newPuncture(), 0, 1000, 0);
    state = applyPunctureStack(state, 40, 1000, 0);
    expect(state.expiresAtTick).toBe(40 + 50);
    expect(activePuncture(state, 89).stacks).toBe(2);
    expect(activePuncture(state, 90).stacks).toBe(0);
    expect(activePuncture(state, 90).storedDamage).toBe(0);
  });

  it("1-stack stored 10 floors sequence to [5,2,1,1,0]", () => {
    const stored = punctureStoreAmount(1000);
    expect(stored).toBe(10);
    expect(PUNCTURE_HIT_PERCENTS.map((p) => punctureHitDamage(stored, p))).toEqual([5, 2, 1, 1, 0]);
  });
});

describe("deathspore arrows", () => {
  it("builds one stack per landed hit; the 12th triggers the buff and the shared cooldown", () => {
    let state = newDeathspore();
    for (let i = 0; i < DEATHSPORE_FREE_ABILITY_STACKS - 1; i++) state = onRangedHit(state, i);
    expect(state.stacks).toBe(DEATHSPORE_FREE_ABILITY_STACKS - 1);
    expect(deathsporeFreeCastActive(state, 11)).toBe(false);
    state = onRangedHit(state, 11);
    expect(state.stacks).toBe(0);
    expect(state.freeCastUntilTick).toBe(11 + DEATHSPORE_FREE_CAST_WINDOW_TICKS);
    expect(state.cooldownUntilTick).toBe(11 + DEATHSPORE_COOLDOWN_TICKS);
    expect(deathsporeFreeCastActive(state, 11)).toBe(true);
  });

  it("free-cast window is half-open: active at untilTick - 1, gone at untilTick", () => {
    let state = newDeathspore();
    for (let i = 0; i < DEATHSPORE_FREE_ABILITY_STACKS; i++) state = onRangedHit(state, 0);
    const last = state.freeCastUntilTick - 1;
    expect(deathsporeFreeCastActive(state, last)).toBe(true);
    expect(deathsporeFreeCastActive(state, state.freeCastUntilTick)).toBe(false);
    expect(deathsporeFreeCastActive(state, state.freeCastUntilTick + 5)).toBe(false);
  });

  it("rejects stack generation during the cooldown, then rebuilds after it", () => {
    let state = newDeathspore();
    for (let i = 0; i < DEATHSPORE_FREE_ABILITY_STACKS; i++) state = onRangedHit(state, 0);
    const during = onRangedHit(state, 10);
    expect(during.stacks).toBe(0);
    expect(onRangedHit(during, state.cooldownUntilTick - 1).stacks).toBe(0);
    expect(onRangedHit(during, state.cooldownUntilTick).stacks).toBe(1);
  });

  it("a free cast consumes the buff while the cooldown keeps running", () => {
    let state = newDeathspore();
    for (let i = 0; i < DEATHSPORE_FREE_ABILITY_STACKS; i++) state = onRangedHit(state, 0);
    state = spendDeathspore(state, 3);
    expect(deathsporeFreeCastActive(state, 3)).toBe(false);
    expect(state.cooldownUntilTick).toBe(DEATHSPORE_COOLDOWN_TICKS);
    expect(onRangedHit(state, 3).stacks).toBe(0);
  });

  it("spending without an active buff changes nothing", () => {
    const state = newDeathspore();
    expect(spendDeathspore(state, 0)).toBe(state);
  });
});

describe("searing winds", () => {
  it("grants the +20% bonus hit for 10 ticks and rapid fire extends it", () => {
    let state = activateSearingWinds(5);
    expect(searingWindsBonusPct(state, 14)).toBe(20);
    expect(searingWindsBonusPct(state, 15)).toBe(0);
    state = extendSearingWinds(state, 4);
    expect(state.expiresAtTick).toBe(19);
    expect(searingWindsBonusPct(state, 18)).toBe(20);
  });
});

describe("shadow imbued", () => {
  it("grants +5% adrenaline per hit for 50 ticks", () => {
    const state = activateShadowImbued(0);
    expect(shadowImbuedAdrenalinePerHit(state, 49)).toBe(5);
    expect(shadowImbuedAdrenalinePerHit(state, 50)).toBe(0);
  });

  it("shadow tendrils extends an active window by 6 ticks", () => {
    const state = extendShadowImbued(activateShadowImbued(0), 0);
    expect(state.expiresAtTick).toBe(56);
  });

  it("shadow tendrils never creates a window from nothing", () => {
    expect(extendShadowImbued(newShadowImbued(), 0)).toEqual(newShadowImbued());
    expect(extendShadowImbued(activateShadowImbued(0), 60).expiresAtTick).toBe(50);
  });
});

describe("deathspore arrows — free-cast lifecycle through the simulator", () => {
  it("deathspore arrows waive the adrenaline cost at 12 stacks", () => {
    const rotation = rotationOf(...Array(12).fill("ranged_attack"), "imbue_shadows");
    const withAmmo = simulate({ ...rangedInput, ammo: "deathspore", rotation });
    expect(withAmmo.ok).toBe(true);
    expect(lastCast(withAmmo).adrenalineAfter).toBe(100);

    const without = simulate({ ...rangedInput, rotation });
    expect(lastCast(without).adrenalineAfter).toBe(60);
  });

  it("a free cast outside the 15-tick window pays full cost", () => {
    // 12th stack lands at tick 33 → buff until 48; imbue at 54 is past it.
    const rotation = rotationOf(...Array(18).fill("ranged_attack"), "imbue_shadows");
    const s = simulate({ ...rangedInput, ammo: "deathspore", rotation });
    expect(s.ok).toBe(true);
    expect(lastCast(s).adrenalineAfter).toBe(100 - 40);
  });

  it("the free cast still needs the adrenaline on hand", () => {
    // 6 attacks (54 adrenaline, 6 stacks) → Rapid Fire drains 25 and its hits
    // build stacks 7-12; the buff opens at tick 23 with only 29 on hand, so
    // the free-but-40-cost imbue at 26 is rejected (wiki: "the player still
    // needs the necessary adrenaline to cast it").
    const broke = simulate({
      ...rangedInput,
      ammo: "deathspore",
      rotation: rotationOf(...Array(6).fill("ranged_attack"), "rapid_fire", "imbue_shadows"),
    });
    expect(broke.ok).toBe(false);
    expect(broke.error).toContain("imbue_shadows needs 40% adrenaline");
    // With enough adrenaline rebuilt inside the window, the same cast spends 0.
    const funded = simulate({
      ...rangedInput,
      ammo: "deathspore",
      rotation: rotationOf(
        ...Array(6).fill("ranged_attack"),
        "rapid_fire",
        ...Array(3).fill("ranged_attack"),
        "imbue_shadows",
      ),
    });
    expect(funded.ok).toBe(true);
    expect(lastCast(funded).adrenalineAfter).toBe(29 + 27); // spend 0
  });

  it("stacks cannot rebuild during the 50-tick cooldown, then build again", () => {
    const ctx = createCastContext({ ...rangedInput, ammo: "deathspore" });
    const attack = ctx.byId.get("ranged_attack")!;
    for (let i = 0; i < 12; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().ranged.deathspore.freeCastUntilTick).toBe(33 + 15);
    expect(ctx.getState().ranged.deathspore.cooldownUntilTick).toBe(33 + 50);
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().ranged.deathspore.stacks).toBe(0); // cooldown rejects
    ctx.advanceTo(83);
    ctx.performCast(attack, 83, false);
    expect(ctx.getState().ranged.deathspore.stacks).toBe(1); // building again
  });

  it("the free cast consumes the buff; the next spender pays again", () => {
    const rotation = rotationOf(
      ...Array(12).fill("ranged_attack"),
      "imbue_shadows",
      ...Array(20).fill("ranged_attack"),
      "imbue_shadows",
    );
    const s = simulate({ ...rangedInput, ammo: "deathspore", rotation });
    expect(s.ok).toBe(true);
    const imbues = s.casts.filter((c) => c.abilityId === "imbue_shadows");
    expect(imbues[0].adrenalineAfter).toBe(100); // free: spend 0
    // Second imbue: 20 more attacks cannot retrigger the buff before tick 83,
    // and 12 fresh stacks need 36 ticks of attacks after it - full price.
    expect(imbues[1].adrenalineAfter).toBe(100 - 40);
  });
});

describe("searing winds — cast-time eligibility and Rapid Fire extension", () => {
  it("searing winds adds its bonus hit inside the window only", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf(
        "galeshot",
        "ranged_attack",
        "ranged_attack",
        "ranged_attack",
        "ranged_attack",
      ),
    });
    expect(s.casts[1].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[2].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[3].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[4].result.expected).toBeCloseTo(1000);
  });

  it("a channel cast inside the window keeps the bonus on hits landing after expiry", () => {
    const ctx = createCastContext(rangedInput);
    const galeshot = ctx.byId.get("galeshot")!;
    const attack = ctx.byId.get("ranged_attack")!;
    const rapidFire = ctx.byId.get("rapid_fire")!;
    ctx.performCast(galeshot, 0, false); // Searing Winds until tick 10
    ctx.performCast(attack, 3, false);
    ctx.performCast(attack, 6, false);
    expect(ctx.performCast(rapidFire, 9, false).ok).toBe(true);
    const s = ctx.finish();
    expect(s.casts[0].result.expected).toBeCloseTo(1000); // Galeshot precludes its own buff
    const rf = s.casts[3];
    expect(rf.result.hits).toHaveLength(8); // attached, not phantom hits
    expect(rf.result.expected).toBeCloseTo(8 * (800 + 200));
  });

  it("each landed Rapid Fire hit extends the buff one tick; the next ability rides the extension", () => {
    const ctx = createCastContext(rangedInput);
    const galeshot = ctx.byId.get("galeshot")!;
    const attack = ctx.byId.get("ranged_attack")!;
    const rapidFire = ctx.byId.get("rapid_fire")!;
    ctx.performCast(galeshot, 0, false);
    ctx.performCast(attack, 3, false);
    ctx.performCast(attack, 6, false);
    ctx.performCast(rapidFire, 9, false);
    expect(ctx.getState().ranged.searingWinds.expiresAtTick).toBe(18);
    ctx.performCast(attack, 17, false); // inside the extended window
    ctx.performCast(attack, 20, false); // outside it
    const s = ctx.finish();
    expect(s.casts[4].result.expected).toBeCloseTo(1000 + 200);
    expect(s.casts[5].result.expected).toBeCloseTo(1000);
  });
});

describe("shadow imbued — adrenaline is per real hit", () => {
  it("shadow imbued grants adrenaline per real hit — attached Searing Winds damage does not inflate the count", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf(
        ...Array(5).fill("ranged_attack"),
        "imbue_shadows",
        "galeshot",
        "ranged_attack",
      ),
    });
    // The Searing Winds bonus is attached to the source hit, not a phantom second
    // hit: 1 real hit → +5 imbued adrenaline.
    expect(lastCast(s).result.hits).toHaveLength(1);
    expect(lastCast(s).result.hits[0].expected).toBeCloseTo(1000);
    expect(lastCast(s).result.expected).toBeCloseTo(1200);
    expect(lastCast(s).adrenalineAfter).toBe(5 + 9 + 5 + 9 + 5);
  });

  it("shadow tendrils without an active imbue grants no phantom adrenaline", () => {
    const s = simulate({
      ...rangedInput,
      rotation: rotationOf("shadow_tendrils", "ranged_attack"),
    });
    expect(s.casts.map((c) => c.adrenalineAfter)).toEqual([0, 9]);
  });
});

describe("Snipe cooldown reduction", () => {
  function afterPiercing(equipmentIds: readonly string[] = []) {
    const ctx = createCastContext({ ...rangedInput, equipmentIds });
    expect(ctx.performCast(ctx.byId.get("snipe")!, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.snipe).toBe(100);
    expect(ctx.performCast(ctx.byId.get("piercing_shot")!, 3, false).ok).toBe(true);
    return ctx.getState().cooldowns.snipe;
  }

  it("subtracts 4 ticks per landed Piercing Shot hit", () => {
    expect(afterPiercing()).toBe(92);
  });

  it("subtracts 6 ticks per Piercing Shot hit with Fleeting boots", () => {
    expect(afterPiercing(["item:fleeting-boots"])).toBe(88);
    expect(afterPiercing(["item:enhanced-fleeting-boots"])).toBe(88);
  });

  it("lets a boot-enabled ranged basic subtract 6 ticks and never crosses the land tick", () => {
    const ctx = createCastContext({
      ...rangedInput,
      equipmentIds: ["item:fleeting-boots"],
    });
    ctx.performCast(ctx.byId.get("snipe")!, 0, false);
    ctx.performCast(ctx.byId.get("ranged_attack")!, 3, false);
    expect(ctx.getState().cooldowns.snipe).toBe(94);

    const floor = createCastContext({
      ...rangedInput,
      equipmentIds: ["item:fleeting-boots"],
    });
    floor.performCast(floor.byId.get("snipe")!, 0, false);
    floor.advanceTo(98);
    floor.performCast(floor.byId.get("ranged_attack")!, 98, false);
    expect(floor.getState().cooldowns.snipe).toBe(98);
  });
});
