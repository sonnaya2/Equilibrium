import { describe, expect, it } from "vitest";
import { rotationOf } from "../../engine/simulation/contracts";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { baseInput } from "../../test/fixtures/inputs";
import { abilityById, lastCast } from "../../test/helpers/summary";
import { MELEE_ABILITIES } from "./abilities";
import { MAGIC_ABILITIES } from "../magic/abilities";
import { RANGED_ABILITIES } from "../ranged/abilities";
import { NECROMANCY_ABILITIES } from "../necromancy/abilities";
import { activeEquipmentEffects } from "../../shared/equipment";
import {
  activateBerserk,
  BERSERK_OVERPOWER_COOLDOWN_SECONDS,
  bloodlustCap,
  gainBloodlust,
  newBloodlust,
  spendBloodlust,
} from "./bloodlust";
import { secondsToTicks } from "../../core/ticks";

const VESTMENTS = [
  "item:vestments-of-havoc-hood",
  "item:vestments-of-havoc-robe-top",
  "item:vestments-of-havoc-robe-bottom",
  "item:vestments-of-havoc-boots",
];
const vestments = (pieces: number, style: "melee" | "magic" = "melee") =>
  activeEquipmentEffects({ style, equipmentIds: VESTMENTS.slice(0, pieces) });

describe("bloodlust", () => {
  it("builds to a cap of 4", () => {
    let s = newBloodlust();
    s = gainBloodlust(s, 1);
    s = gainBloodlust(s, 2);
    s = gainBloodlust(s, 2);
    expect(s.stacks).toBe(4);
    expect(bloodlustCap(s)).toBe(4);
  });

  it("Berserk raises the cap to 8, grants 4 on activation, doubles generation", () => {
    let s = activateBerserk(newBloodlust());
    expect(s.stacks).toBe(4);
    s = gainBloodlust(s, 1);
    expect(s.stacks).toBe(6);
    s = gainBloodlust(s, 2);
    expect(s.stacks).toBe(8);
  });

  it("spending never drops below zero", () => {
    expect(spendBloodlust({ stacks: 2, berserk: false }, 5).stacks).toBe(0);
  });
});

describe("bloodlust — spend lifecycle through the simulator", () => {
  it("Vestments set(2) regenerates 15 adrenaline over 18 seconds", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      equipmentEffects: vestments(2),
    });
    ctx.performCast(ctx.byId.get("berserk")!, 0, false);
    expect(ctx.getState().vestmentsAdrenalineUntilTick).toBe(30);
    expect(ctx.getState().adrenaline).toBeCloseTo(1.5, 10);
    ctx.advanceTo(30);
    expect(ctx.getState().adrenaline).toBeCloseTo(15, 10);
  });

  it("Overpower under Berserk starts a 9s CD (wiki Berserk, 2 Mar 2026)", () => {
    // Relentless keeps adren payable after Berserk so the CD path is reached.
    const under = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { relentlessRank: 1 },
    });
    under.performCast(under.byId.get("berserk")!, 0, false, { relentless: true });
    const opTick = under.getState().tick;
    const op = under.performCast(under.byId.get("overpower")!, opTick, false, {
      relentless: true,
    });
    expect(op.ok).toBe(true);
    expect(under.getState().cooldowns.overpower).toBe(
      opTick + secondsToTicks(BERSERK_OVERPOWER_COOLDOWN_SECONDS),
    );

    const alone = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { relentlessRank: 1 },
    });
    const aloneCast = alone.performCast(alone.byId.get("overpower")!, 0, false, {
      relentless: true,
    });
    expect(aloneCast.ok).toBe(true);
    expect(alone.getState().cooldowns.overpower).toBe(secondsToTicks(30));
  });

  it("Berserk cast does not clear an existing Overpower cooldown", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { relentlessRank: 1 },
    });
    const op = ctx.performCast(ctx.byId.get("overpower")!, 0, false, { relentless: true });
    expect(op.ok).toBe(true);
    const opReady = ctx.getState().cooldowns.overpower;
    expect(opReady).toBe(secondsToTicks(30));

    // Rebuild adren for Berserk (Relentless spent OP for free; still need 100 listed).
    ctx.performCast(ctx.byId.get("berserk")!, ctx.getState().tick, false, { relentless: true });
    expect(ctx.getState().cooldowns.overpower).toBe(opReady);
    expect(ctx.firstLegalTick("overpower")).toBe(opReady);
  });

  it("Berserk expiration does not rewrite remaining Overpower CD", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { relentlessRank: 1 },
    });
    ctx.performCast(ctx.byId.get("berserk")!, 0, false, { relentless: true });
    const opTick = ctx.getState().tick;
    expect(
      ctx.performCast(ctx.byId.get("overpower")!, opTick, false, { relentless: true }).ok,
    ).toBe(true);
    const ready = ctx.getState().cooldowns.overpower;
    expect(ready).toBe(opTick + secondsToTicks(BERSERK_OVERPOWER_COOLDOWN_SECONDS));

    // Past Berserk window (19.8s = 33 ticks from berserk cast at 0).
    ctx.advanceTo(secondsToTicks(19.8) + 1);
    expect(ctx.getState().cooldowns.overpower).toBe(ready);
  });

  it("Igneous Overpower shares replacement group and 9s under Berserk", () => {
    const effects = activeEquipmentEffects({
      equipmentSlots: { cape: "item:igneous-kal-ket" },
    });
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { relentlessRank: 1 },
      equipmentEffects: effects,
      equipmentIds: ["item:igneous-kal-ket"],
    });
    ctx.performCast(ctx.byId.get("berserk")!, 0, false, { relentless: true });
    const opTick = ctx.getState().tick;
    const ig = ctx.byId.get("overpower_igneous")!;
    expect(ig.replacementGroup).toBe("overpower");
    expect(ctx.performCast(ig, opTick, false, { relentless: true }).ok).toBe(true);
    expect(ctx.getState().cooldowns.overpower).toBe(
      opTick + secondsToTicks(BERSERK_OVERPOWER_COOLDOWN_SECONDS),
    );
    expect(ctx.firstLegalTick("overpower")).toBe(
      opTick + secondsToTicks(BERSERK_OVERPOWER_COOLDOWN_SECONDS),
    );
  });

  it("a second ultimate during Vestments regeneration gains 20 instantly and ends it", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 120,
      equipmentEffects: vestments(4),
      adrenaline: { relentlessRank: 1 },
    });
    ctx.performCast(ctx.byId.get("berserk")!, 0, false, { relentless: true });
    ctx.performCast(ctx.byId.get("overpower")!, ctx.getState().tick, false, {
      relentless: false,
    });
    expect(ctx.getState().vestmentsAdrenalineUntilTick).toBe(0);
    expect(ctx.getState().adrenaline).toBeCloseTo(80, 10);

    // Vestments Herald +20 is otherImmediateGrants on the second ultimate (SSOT).
    const cast = ctx.finish().casts.find((c) => c.abilityId === "overpower")!;
    expect(cast.adrenalineTransaction?.otherImmediateGrants).toBe(20);
    // No occupancy passive advances between commit and afterResources equality.
    expect(cast.adrenalineAfterResources).toBe(cast.adrenalineAfter);
    const tx = cast.adrenalineTransaction!;
    const netFromTx =
      tx.totalAbilityGain +
      tx.otherImmediateGrants -
      tx.actualSpend +
      tx.conservationOfEnergyRefund +
      tx.ringOfVigourRefund;
    expect(cast.result.adrenalineDelta).toBe(netFromTx);
    expect(ctx.getState().adrenaline).toBeCloseTo(80, 10);
  });

  it("Vestments set(3) extends Berserk by 6 seconds and set(4) raises the cap to 120", () => {
    const three = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      equipmentEffects: vestments(3),
    });
    three.performCast(three.byId.get("berserk")!, 0, false);
    expect(three.getState().melee.berserkUntilTick).toBe(43);
    expect(three.getState().adrenalineCap).toBe(100);

    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 120,
      equipmentEffects: vestments(4),
    });
    expect(ctx.getState().adrenalineCap).toBe(120);
    ctx.performCast(ctx.byId.get("berserk")!, 0, false);
    expect(ctx.getState().melee.berserkUntilTick).toBe(43);
    expect(() => createCastContext({ ...baseInput, startingAdrenaline: 120 })).toThrow(
      "outside 0-100",
    );
    expect(() =>
      createCastContext({
        ...baseInput,
        startingAdrenaline: 120,
        equipmentEffects: vestments(4, "magic"),
      }),
    ).toThrow("outside 0-100");
  });

  it("starts Herald of Chaos from either eligible melee ultimate", () => {
    for (const abilityId of ["berserk", "meteor_strike"]) {
      const ctx = createCastContext({
        ...baseInput,
        startingAdrenaline: 100,
        equipmentEffects: vestments(2),
      });
      expect(ctx.performCast(ctx.byId.get(abilityId)!, 0, false).ok).toBe(true);
      expect(ctx.getState().vestmentsAdrenalineUntilTick, abilityId).toBe(30);
    }
  });

  it("does not consume Herald of Chaos on Magic, Ranged, or Necromancy ultimates", () => {
    const abilities = [
      ...MELEE_ABILITIES,
      ...MAGIC_ABILITIES,
      ...RANGED_ABILITIES,
      ...NECROMANCY_ABILITIES,
    ];
    for (const abilityId of ["sunshine", "deaths_swiftness", "living_death"]) {
      const ctx = createCastContext({
        ...baseInput,
        abilities,
        startingAdrenaline: 120,
        equipmentEffects: vestments(4),
        adrenaline: { relentlessRank: 1 },
      });
      ctx.performCast(ctx.byId.get("berserk")!, 0, false, { relentless: true });
      const before = ctx.getState().vestmentsAdrenalineUntilTick;
      expect(ctx.performCast(ctx.byId.get(abilityId)!, ctx.getState().tick, false).ok).toBe(true);
      expect(ctx.getState().vestmentsAdrenalineUntilTick, abilityId).toBe(before);
    }
  });

  it("swaps Assault to its 4-Bloodlust band only once the threshold is met", () => {
    const low = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "assault"),
    });
    expect(lastCast(low).result.expected).toBeCloseTo(4 * 1400);

    const high = simulate({
      ...baseInput,
      rotation: rotationOf("attack", "attack", "attack", "attack", "assault"),
    });
    const assault = lastCast(high);
    expect(assault.tick).toBe(12);
    expect(assault.result.expected).toBeCloseTo(4 * 1800);
    expect(assault.adrenalineAfter).toBe(36 - 25);
  });

  it("an empowered Assault consumes 4 stacks atomically; the next spender rebuilds first", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const assault = ctx.byId.get("assault")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(4);
    expect(ctx.performCast(assault, ctx.firstLegalTick("assault"), false).ok).toBe(true);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(0);
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(3);
    expect(ctx.performCast(assault, ctx.firstLegalTick("assault"), false).ok).toBe(true);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(3); // unempowered: no spend
    const s = ctx.finish();
    expect(s.casts[4].result.expected).toBeCloseTo(4 * 1800); // empowered 170-190
    expect(s.casts[8].result.expected).toBeCloseTo(4 * 1400); // normal 130-150
  });

  it("an empowered Hurricane appends its sourced extra hit and spends 4 stacks", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const hurricane = ctx.byId.get("hurricane")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(hurricane, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(0);
    const s = ctx.finish();
    const cast = lastCast(s);
    expect(cast.result.hits).toHaveLength(3);
    expect(cast.result.expected).toBeCloseTo(1500 + 1700 + 850);
    const events = s.events.filter((e) => e.abilityId === "hurricane");
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.hitIndex)).toEqual([0, 1, 2]);
    expect(events.every((e) => e.procEligible && !e.attached)).toBe(true);
  });

  it("an unempowered Hurricane keeps its two hits and its stacks", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const hurricane = ctx.byId.get("hurricane")!;
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(hurricane, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(3); // below threshold: no spend
    const s = ctx.finish();
    expect(lastCast(s).result.hits).toHaveLength(2);
    expect(lastCast(s).result.expected).toBeCloseTo(1500 + 1700);
  });

  it("an empowered Flurry scales with target missing LP when HP is provided", () => {
    const rotation = rotationOf("attack", "attack", "attack", "attack", "flurry");
    const low = simulate({ ...baseInput, targetHpPercent: 30, rotation });
    // 70% missing LP capped to +65%, with the multiplier floored per integer roll.
    expect(lastCast(low).result.expected).toBeCloseTo(8576.237623762376, 10);
    const full = simulate({ ...baseInput, targetHpPercent: 100, rotation });
    expect(lastCast(full).result.expected).toBeCloseTo(8 * 650);
  });

  it("an empowered Flurry without target HP preserves stacks and invents no bonus", () => {
    const ctx = createCastContext(baseInput);
    const attack = ctx.byId.get("attack")!;
    const flurry = ctx.byId.get("flurry")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.performCast(flurry, ctx.getState().tick, false).ok).toBe(true);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(4);
    const s = ctx.finish();
    expect(s.casts[4].result.expected).toBeCloseTo(8 * 650);
  });

  it("clips Bloodlust stacks when Berserk expires mid-wait, at the boundary tick", () => {
    const ctx = createCastContext(baseInput);
    const attack = abilityById(MELEE_ABILITIES, "attack");
    for (let i = 0; i < 12; i++) ctx.performCast(attack, i * 3, false);
    ctx.performCast(abilityById(MELEE_ABILITIES, "berserk"), 36, false);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(8);
    expect(ctx.getState().melee.berserkUntilTick).toBe(69);
    for (let t = 39; t <= 63; t += 3) ctx.performCast(attack, t, false);
    // Still inside the window at tick 66: no clip.
    expect(ctx.getState().tick).toBe(66);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(8);
    expect(ctx.getState().melee.bloodlust.berserk).toBe(true);
    ctx.performCast(attack, 66, false);
    // The occupancy advance crosses tick 69 (the exclusive end): stacks clip to the base cap.
    expect(ctx.getState().tick).toBe(69);
    expect(ctx.getState().melee.bloodlust.berserk).toBe(false);
    expect(ctx.getState().melee.bloodlust.stacks).toBe(4);
    expect(ctx.getState().melee.berserkUntilTick).toBe(0);
  });
});
