import { describe, expect, it } from "vitest";
import { necroInput } from "../../test/fixtures/inputs";
import { createCastContext } from "../../engine/simulation/simulate";
import { SPIRIT_POISON_ABILITY_ID } from "./conjures";
import {
  applyHaunted,
  HAUNTED_BONUS_PCT,
  HAUNTED_CAP_PCT_OF_AD,
  HAUNTED_DURATION_TICKS,
  hauntedActive,
  hauntedBonusDamage,
  hauntedParentDamage,
  newHaunted,
} from "./haunted";

describe("haunted pure helpers", () => {
  it("applyHaunted sets exclusive untilTick and cap AD", () => {
    const h = applyHaunted(10, 1000);
    expect(h.untilTick).toBe(10 + HAUNTED_DURATION_TICKS);
    expect(h.capAbilityDamage).toBe(1000);
    expect(HAUNTED_DURATION_TICKS).toBe(6);
  });

  it("hauntedActive is half-open [0, until) from apply land", () => {
    const h = applyHaunted(10, 500);
    // untilTick = land + 6; no start bound (refresh replaces window)
    expect(h.untilTick).toBe(16);
    expect(hauntedActive(h, 10)).toBe(true);
    expect(hauntedActive(h, 15)).toBe(true);
    expect(hauntedActive(h, 16)).toBe(false);
    expect(hauntedActive(newHaunted(), 0)).toBe(false);
  });

  it("hauntedParentDamage reverses DP below 1", () => {
    expect(hauntedParentDamage(700, 0.7)).toBeCloseTo(1000, 10);
    expect(hauntedParentDamage(700, 1)).toBe(700);
    expect(hauntedParentDamage(700, 1.5)).toBe(700);
    expect(hauntedParentDamage(700, 0)).toBe(0);
    expect(hauntedParentDamage(0, 0.7)).toBe(0);
    expect(hauntedParentDamage(-10, 0.7)).toBe(0);
  });

  it("hauntedBonusDamage is floor(parent*10%) capped at floor(capAD*20%)", () => {
    expect(HAUNTED_BONUS_PCT).toBe(10);
    expect(HAUNTED_CAP_PCT_OF_AD).toBe(20);
    // 10% of 1000 = 100; cap 20% of 1000 = 200 -> 100
    expect(hauntedBonusDamage(1000, 1000)).toBe(100);
    // 10% of 3000 = 300; cap 20% of 1000 = 200 -> 200
    expect(hauntedBonusDamage(3000, 1000)).toBe(200);
    // Zero / negative parent or cap
    expect(hauntedBonusDamage(0, 1000)).toBe(0);
    expect(hauntedBonusDamage(1000, 0)).toBe(0);
    expect(hauntedBonusDamage(-10, 1000)).toBe(0);
    // Floor chain
    expect(hauntedBonusDamage(15, 1000)).toBe(1); // floor(1.5)=1
    expect(hauntedBonusDamage(9, 1000)).toBe(0);
  });
});

describe("Haunted sim: commanding ghost auto applies; player hits get bonus", () => {
  it("empowered ghost auto applies Haunted; next basic gains attached 10%", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    const ghost = ctx.byId.get("conjure_vengeful_ghost")!;
    const command = ctx.byId.get("command_vengeful_ghost")!;

    ctx.performCast(ghost, 0, false);
    // Command first legal at 6; same-tick auto at 6 lands before command, so no Haunted yet.
    ctx.performCast(command, ctx.firstLegalTick("command_vengeful_ghost"), false);
    expect(ctx.getState().target.haunted.untilTick).toBe(0);

    // Next ghost auto lands at 13 with commanding, applies Haunted for 6 ticks.
    ctx.advanceTo(13);
    const afterAuto = ctx.getState().target.haunted;
    expect(afterAuto.untilTick).toBe(13 + HAUNTED_DURATION_TICKS);
    expect(afterAuto.capAbilityDamage).toBe(1000);
    expect(hauntedActive(afterAuto, 13)).toBe(true);

    // Cast basic while Haunted is active (land-time check at hit).
    ctx.performCast(basic, 15, false);
    const s = ctx.finish();
    expect(s.ok).toBe(true);

    const basics = s.events.filter((e) => e.abilityId === "necromancy_basic" && e.family === "hit");
    // First autos/weaves may exist before Haunted; find a hit boosted past the plain band EV.
    // Plain necro basic: expected 1000 (90-110% of 1000 AD). Bonus floor(1000*10%)=100.
    const boosted = basics.filter((e) => e.damage.expected > 1000 + 1e-9);
    expect(boosted.length).toBeGreaterThan(0);
    for (const e of boosted) {
      expect(e.damage.expected).toBeCloseTo(1100, 5);
      expect(e.attached).toBe(false);
    }

    // Cast-result parent hit stays plain; total includes attached Haunted.
    const hauntedCasts = s.casts.filter(
      (c) =>
        c.abilityId === "necromancy_basic" &&
        c.result.expected > (c.result.hits[0]?.expected ?? 0) + 1e-9,
    );
    expect(hauntedCasts.length).toBeGreaterThan(0);
    for (const c of hauntedCasts) {
      expect(c.result.hits[0]!.expected).toBeCloseTo(1000, 5);
      expect(c.result.expected).toBeCloseTo(1100, 5);
    }
  });

  it("Haunted 10% is of full-accuracy parent (ignores Damage Potential)", () => {
    const ctx = createCastContext({ ...necroInput, accuracy: 0.7 });
    const basic = ctx.byId.get("necromancy_basic")!;
    ctx.performCast(ctx.byId.get("conjure_vengeful_ghost")!, 0, false);
    ctx.performCast(
      ctx.byId.get("command_vengeful_ghost")!,
      ctx.firstLegalTick("command_vengeful_ghost"),
      false,
    );
    ctx.advanceTo(13);
    expect(hauntedActive(ctx.getState().target.haunted, 13)).toBe(true);

    ctx.performCast(basic, 15, false);
    const s = ctx.finish();
    expect(s.ok).toBe(true);

    // Parent EV is post-DP (~700); bonus is 10% of reverse-DP parent (~100), not ~70.
    const hauntedCasts = s.casts.filter(
      (c) =>
        c.abilityId === "necromancy_basic" &&
        c.result.expected > (c.result.hits[0]?.expected ?? 0) + 1e-9,
    );
    expect(hauntedCasts.length).toBeGreaterThan(0);
    for (const c of hauntedCasts) {
      const parent = c.result.hits[0]!.expected;
      const bonus = c.result.expected - parent;
      expect(bonus).toBe(hauntedBonusDamage(hauntedParentDamage(parent, 0.7), 1000));
      // Old bug: 10% of post-DP parent.
      expect(bonus).toBeGreaterThan(hauntedBonusDamage(parent, 1000));
    }
  });

  it("zombie poison under Haunted gets attached bonus", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    // Ghost at 0; zombie as soon as legal so poison ticks overlap Haunted [13, 19).
    ctx.performCast(ctx.byId.get("conjure_vengeful_ghost")!, 0, false);
    ctx.performCast(
      ctx.byId.get("conjure_putrid_zombie")!,
      ctx.firstLegalTick("conjure_putrid_zombie"),
      false,
    );
    ctx.performCast(
      ctx.byId.get("command_vengeful_ghost")!,
      ctx.firstLegalTick("command_vengeful_ghost"),
      false,
    );
    ctx.advanceTo(13);
    const hauntedUntil = ctx.getState().target.haunted.untilTick;
    expect(hauntedUntil).toBe(13 + HAUNTED_DURATION_TICKS);

    while (ctx.getState().tick < hauntedUntil + 3) {
      ctx.performCast(basic, ctx.getState().tick, false);
    }
    const s = ctx.finish();
    expect(s.ok).toBe(true);

    const poisons = s.events.filter((e) => e.abilityId === SPIRIT_POISON_ABILITY_ID);
    expect(poisons.length).toBeGreaterThan(0);
    // Plain poison EV: band 8-12% of 1000 AD => expected 100. Bonus floor(100*10%)=10.
    const underHaunted = poisons.filter(
      (e) => e.tick >= 13 && e.tick < hauntedUntil && e.damage.expected > 100 + 1e-9,
    );
    expect(underHaunted.length).toBeGreaterThan(0);
    for (const e of underHaunted) {
      expect(e.damage.expected).toBeCloseTo(110, 5);
    }
  });

  it("ghost auto without command never applies Haunted", () => {
    const ctx = createCastContext(necroInput);
    const basic = ctx.byId.get("necromancy_basic")!;
    ctx.performCast(ctx.byId.get("conjure_vengeful_ghost")!, 0, false);
    while (ctx.getState().tick < 20) ctx.performCast(basic, ctx.getState().tick, false);
    expect(ctx.getState().target.haunted.untilTick).toBe(0);
    const s = ctx.finish();
    const basics = s.events.filter((e) => e.abilityId === "necromancy_basic" && e.family === "hit");
    for (const e of basics) {
      expect(e.damage.expected).toBeCloseTo(1000, 5);
    }
  });
});
