import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { rotationOf } from "./contracts";
import { simulate, type CastRecord, type SimulateInput } from "./simulate";
import { createCastContext } from "./simulate";
import { simulateRevolution } from "./revolution";

/**
 * Wild Magic crit layers, Concentrated Blast / Greater Concentrated Blast crit
 * progression, Channelled Might after Asphyxiate, Dragon Breath vs Combust,
 * Sonic Wave / Greater Sonic Wave Flow, HP-dependent bands (Punish, Scythe 3).
 */

const meleeInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
};

const magicInput: Omit<SimulateInput, "rotation"> = {
  ...meleeInput,
  abilities: MAGIC_ABILITIES,
  context: { style: "magic" },
};

const necroInput: Omit<SimulateInput, "rotation"> = {
  ...meleeInput,
  abilities: NECROMANCY_ABILITIES,
  context: { style: "necromancy" },
};

function lastCastOf(s: { casts: CastRecord[] }) {
  return s.casts.at(-1)!;
}

describe("Wild Magic crit layers", () => {
  it("both hits get +10% crit chance and +20% crit damage", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf(...Array(3).fill("magic_attack"), "wild_magic"),
    });
    expect(s.ok).toBe(true);
    const wm = lastCastOf(s);
    expect(wm.result.expected).toBeCloseTo(2995.9102990033225, 10);
    expect(wm.result.hits[0].critChance).toBeCloseTo(0.1);
  });
});

describe("Concentrated Blast crit progression", () => {
  it("stacks +5% per landed hit through the channel, then the next Magic attack gets +15%", () => {
    const ctx = createCastContext(magicInput);
    const cb = ctx.byId.get("concentrated_blast")!;
    const attack = ctx.byId.get("magic_attack")!;
    ctx.performCast(cb, 0, false); // hits land 0,1,2 → stacks build to 3
    expect(ctx.getState().magic.concCritStacks).toBe(3);
    ctx.performCast(attack, ctx.getState().tick, false);
    const s = ctx.finish();
    const cbCast = s.casts[0];
    expect(cbCast.result.hits[0].critChance).toBeCloseTo(0);
    expect(cbCast.result.hits[1].critChance).toBeCloseTo(0.05);
    expect(cbCast.result.hits[2].critChance).toBeCloseTo(0.1);
    expect(s.casts[1].result.hits[0].critChance).toBeCloseTo(0.15);
    expect(s.casts[1].result.expected).toBeCloseTo(1074.9626865671642, 10);
    // The consuming attack reset the stacks.
    expect(ctx.getState().magic.concCritStacks).toBe(0);
  });

  it("Greater Concentrated Blast stacks +7% per hit", () => {
    const ctx = createCastContext(magicInput);
    const gcb = ctx.byId.get("greater_concentrated_blast")!;
    ctx.performCast(gcb, 0, false);
    expect(ctx.getState().magic.concCritStacks).toBe(3);
    expect(ctx.getState().magic.concCritPerStackPct).toBe(7);
    const s = ctx.finish();
    expect(s.casts[0].result.hits[1].critChance).toBeCloseTo(0.07);
    expect(s.casts[0].result.hits[2].critChance).toBeCloseTo(0.14);
  });

  it("a Runic-charged cast empowers the grant to +15% per hit and consumes the charge", () => {
    const ctx = createCastContext(magicInput);
    ctx.performOffGcdCast(ctx.byId.get("runic_charge")!);
    ctx.performCast(ctx.byId.get("concentrated_blast")!, ctx.getState().tick, false);
    expect(ctx.getState().magic.concCritPerStackPct).toBe(15);
    expect(ctx.getState().magic.runicCharge.animaUntilTick).toBe(0);
    const s = ctx.finish();
    expect(s.casts[1].result.hits[1].critChance).toBeCloseTo(0.15);
    expect(s.casts[1].result.hits[2].critChance).toBeCloseTo(0.3);
  });
});

describe("Channelled Might", () => {
  it("a completed Asphyxiate grants +15% crit damage for 3.6s from channel end", () => {
    const ctx = createCastContext(magicInput);
    const attack = ctx.byId.get("magic_attack")!;
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    const asphyxiateTick = ctx.getState().tick;
    ctx.performCast(ctx.byId.get("asphyxiate")!, asphyxiateTick, false);
    const might = ctx.getState().magic.channelledMight;
    expect(might.startsAtTick).toBe(asphyxiateTick + 7);
    expect(might.expiresAtTick).toBe(asphyxiateTick + 7 + 6);
  });

  it("magic crits inside the window deal +15% crit damage", () => {
    const ctx = createCastContext({ ...magicInput, crit: { chance: 0, guaranteed: true } });
    const attack = ctx.byId.get("magic_attack")!;
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    ctx.performCast(ctx.byId.get("asphyxiate")!, ctx.getState().tick, false);
    ctx.performCast(attack, ctx.getState().tick, false);
    const s = ctx.finish();
    const empowered = s.casts.at(-1)!;
    expect(empowered.result.hits[0].expected).toBeCloseTo(1649.5273631840796, 10);
  });

  it("Tumeken set(4) turns the ordinary Asphyxiate into eight 0.6s hits", () => {
    const ctx = createCastContext({ ...magicInput, tumekensPieces: 4 });
    const attack = ctx.byId.get("magic_attack")!;
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    const castTick = ctx.getState().tick;
    ctx.performCast(ctx.byId.get("asphyxiate")!, castTick, false);
    expect(ctx.getState().tick).toBe(castTick + 8);
    ctx.performCast(attack, ctx.getState().tick, false);
    const summary = ctx.finish();
    const cast = summary.casts.at(-2)!;
    expect(cast.abilityId).toBe("asphyxiate");
    expect(cast.result.hits).toHaveLength(8);
    expect(cast.result.hits.every((hit) => hit.expected === 780)).toBe(true);
    expect(ctx.getState().magic.channelledMight.startsAtTick).toBe(castTick + 8);
    expect(summary.casts.at(-1)!.tick).toBe(castTick + 8);
  });

  it("Tumeken set(5) grants +35% Channelled Might for 9 seconds", () => {
    const ctx = createCastContext({ ...magicInput, tumekensPieces: 5 });
    const attack = ctx.byId.get("magic_attack")!;
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    const castTick = ctx.getState().tick;
    ctx.performCast(ctx.byId.get("asphyxiate")!, castTick, false);
    const might = ctx.getState().magic.channelledMight;
    expect(might).toMatchObject({
      startsAtTick: castTick + 8,
      expiresAtTick: castTick + 23,
      critDamageBonus: 0.35,
    });
  });

  it("applies Channelled Might to the first hit after transformed Asphyxiate", () => {
    const ctx = createCastContext({
      ...magicInput,
      crit: { chance: 0, guaranteed: true },
      tumekensPieces: 4,
    });
    const attack = ctx.byId.get("magic_attack")!;
    for (let i = 0; i < 3; i++) ctx.performCast(attack, ctx.getState().tick, false);
    ctx.performCast(ctx.byId.get("asphyxiate")!, ctx.getState().tick, false);
    ctx.performCast(attack, ctx.getState().tick, false);
    expect(ctx.finish().casts.at(-1)!.result.hits[0].expected).toBeCloseTo(1649.5273631840796, 10);
  });

  it("Tumeken set(3) adds crit only while another cast's Sunshine is active", () => {
    const ctx = createCastContext({
      ...magicInput,
      startingAdrenaline: 100,
      tumekensPieces: 3,
    });
    ctx.performCast(ctx.byId.get("sunshine")!, 0, false);
    ctx.performCast(ctx.byId.get("magic_attack")!, ctx.getState().tick, false);
    const s = ctx.finish();
    const sunshine = s.casts[0]!;
    const attack = s.casts[1]!;
    expect(sunshine.result.hits.every((hit) => hit.critChance === 0)).toBe(true);
    expect(attack.result.hits[0].critChance).toBeCloseTo(0.045, 10);
  });
});

describe("Dragon Breath vs Combust", () => {
  it("deals 1.25x while the target burns and normal damage after it ends", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf(
        "combust",
        "dragon_breath",
        ...Array(8).fill("magic_attack"),
        "dragon_breath",
      ),
    });
    expect(s.ok).toBe(true);
    const breaths = s.casts.filter((c) => c.abilityId === "dragon_breath");
    expect(breaths[0].result.expected).toBeCloseTo(1499.6268656716418, 10);
    // Second cast at tick 30: the 10-tick burn (0→30) has just lapsed.
    expect(breaths[1].result.expected).toBeCloseTo(1200);
  });
});

describe("Sonic Wave Flow", () => {
  it("grants Flow only when the hit lands, subtracting 10 adrenaline from the next cost", () => {
    const ctx = createCastContext(magicInput);
    const attack = ctx.byId.get("magic_attack")!;
    const sonic = ctx.byId.get("sonic_wave")!;
    const wild = ctx.byId.get("wild_magic")!;
    ctx.performCast(attack, 0, false);
    ctx.performCast(attack, 3, false);
    // Sonic Wave's hit lands 2 ticks after the cast; Flow runs 15 ticks from there.
    ctx.performCast(sonic, 6, false);
    expect(ctx.getState().magic.flowReduction).toBe(10);
    expect(ctx.getState().magic.flowUntilTick).toBe(8 + 15);
    expect(ctx.costOf(wild)).toBe(25 - 10);
    ctx.performCast(wild, ctx.getState().tick, false);
    expect(ctx.getState().magic.flowUntilTick).toBe(0); // consumed
  });

  it("a Sonic Wave whose hit never lands grants no Flow (horizon truncation)", () => {
    // Cast at tick 0 with horizon 1: the +2 strike lands past the horizon and
    // is never processed, so no window opens.
    const ctx = createCastContext({ ...magicInput, horizonTicks: 1 });
    const sonic = ctx.byId.get("sonic_wave")!;
    ctx.performCast(sonic, 0, false);
    expect(ctx.getState().magic.flowUntilTick).toBe(0);
    expect(ctx.getState().magic.flowReduction).toBe(0);
  });

  it("flat reductions: 60-cost under Flow costs 50, 25-cost under Greater Flow costs 5", () => {
    const ctx = createCastContext(magicInput);
    const attack = ctx.byId.get("magic_attack")!;
    const gsw = ctx.byId.get("greater_sonic_wave")!;
    const wild = ctx.byId.get("wild_magic")!;
    const overpower = ctx.byId.get("omnipower")!;
    ctx.performCast(attack, 0, false);
    ctx.performCast(attack, 3, false);
    ctx.performCast(gsw, 6, false);
    expect(ctx.costOf(wild)).toBe(5);
    expect(ctx.costOf(overpower)).toBe(60 - 20);
  });

  it("a Runic-charged Sonic Wave floors the cost at zero and consumes the charge", () => {
    const ctx = createCastContext(magicInput);
    const sonic = ctx.byId.get("sonic_wave")!;
    const wild = ctx.byId.get("wild_magic")!;
    ctx.performOffGcdCast(ctx.byId.get("runic_charge")!);
    ctx.performCast(sonic, ctx.getState().tick, false);
    expect(ctx.getState().magic.runicCharge.animaUntilTick).toBe(0);
    expect(ctx.getState().magic.flowReduction).toBe(35);
    expect(ctx.costOf(wild)).toBe(0);
    ctx.performCast(wild, ctx.getState().tick, false);
    const record = ctx.finish().casts.at(-1)!;
    expect(record).toMatchObject({ listedCost: 25, effectiveCost: 0, actualSpend: 0 });
    expect(ctx.getState().magic.flowUntilTick).toBe(0);
  });

  it("keeps each pending Sonic hit's own Flow value when hits land out of cast order", () => {
    const ctx = createCastContext(magicInput);
    const sonic = ctx.byId.get("sonic_wave")!;
    const greater = ctx.byId.get("greater_sonic_wave")!;
    const slowSonic = {
      ...sonic,
      cooldownSeconds: 0,
      hits: sonic.hits.map((hit) => ({ ...hit, tickOffset: 8 })),
    };
    const fastGreater = {
      ...greater,
      cooldownSeconds: 0,
      hits: greater.hits.map((hit) => ({ ...hit, tickOffset: 1 })),
    };
    ctx.performCast(slowSonic, 0, false);
    ctx.performCast(fastGreater, 3, false);
    expect(ctx.getState().magic.flowReduction).toBe(20);
    ctx.advanceTo(8);
    expect(ctx.getState().magic.flowReduction).toBe(10);
    expect(ctx.getState().magic.flowUntilTick).toBe(8 + 15);
  });

  it("basics do not consume Flow", () => {
    const ctx = createCastContext(magicInput);
    const attack = ctx.byId.get("magic_attack")!;
    const sonic = ctx.byId.get("sonic_wave")!;
    const wild = ctx.byId.get("wild_magic")!;
    ctx.performCast(attack, 0, false);
    ctx.performCast(attack, 3, false);
    ctx.performCast(sonic, 6, false);
    ctx.performCast(attack, 9, false);
    expect(ctx.getState().magic.flowReduction).toBe(10);
    expect(ctx.costOf(wild)).toBe(15);
  });

  it("Flow expires at the 9s boundary and stops affecting cost", () => {
    const ctx = createCastContext(magicInput);
    const attack = ctx.byId.get("magic_attack")!;
    const sonic = ctx.byId.get("sonic_wave")!;
    const wild = ctx.byId.get("wild_magic")!;
    ctx.performCast(sonic, 0, false);
    for (let i = 0; i < 6; i++) ctx.performCast(attack, ctx.getState().tick, false);
    // Tick 21 > 15: expired — full price.
    expect(ctx.costOf(wild)).toBe(25);
  });
});

describe("target HP percentage", () => {
  it("Punish multiplies by 2.5 strictly below 50% target HP", () => {
    const at40 = simulate({
      ...meleeInput,
      targetHpPercent: 40,
      rotation: rotationOf("punish"),
    });
    expect(lastCastOf(at40).result.expected).toBeCloseTo(1200 * 2.5);
    const at50 = simulate({
      ...meleeInput,
      targetHpPercent: 50,
      rotation: rotationOf("punish"),
    });
    expect(lastCastOf(at50).result.expected).toBeCloseTo(1200);
    const noHp = simulate({ ...meleeInput, rotation: rotationOf("punish") });
    expect(lastCastOf(noHp).result.expected).toBeCloseTo(1200);
  });

  it("Spectral Scythe cast 3 scales by (2 − hp fraction) after casts 1 and 2", () => {
    const at50 = simulate({
      ...necroInput,
      startingAdrenaline: 100,
      targetHpPercent: 50,
      rotation: rotationOf("spectral_scythe", "spectral_scythe_2", "spectral_scythe_3"),
    });
    expect(lastCastOf(at50).abilityId).toBe("spectral_scythe_3");
    expect(lastCastOf(at50).result.expected).toBeCloseTo(3750, 10);
    const noHp = simulate({
      ...necroInput,
      startingAdrenaline: 100,
      rotation: rotationOf("spectral_scythe", "spectral_scythe_2", "spectral_scythe_3"),
    });
    expect(lastCastOf(noHp).result.expected).toBeCloseTo(2500, 10);
  });

  it("rejects out-of-sequence or expired Spectral Scythe stages without changing resources", () => {
    const ctx = createCastContext({ ...necroInput, startingAdrenaline: 100 });
    const stage2 = ctx.byId.get("spectral_scythe_2")!;
    const stage3 = ctx.byId.get("spectral_scythe_3")!;
    const before = structuredClone(ctx.getState());
    expect(ctx.performCast(stage3, 0, false).ok).toBe(false);
    expect(ctx.getState()).toEqual(before);

    expect(ctx.performCast(ctx.byId.get("spectral_scythe")!, 0, false).ok).toBe(true);
    ctx.advanceTo(25);
    const expired = structuredClone(ctx.getState());
    expect(ctx.performCast(stage2, 25, false).ok).toBe(false);
    expect(ctx.getState()).toEqual(expired);
  });

  it("Revolution advances Spectral Scythe in order and resets the sequence after stage 3", () => {
    const byId = new Map(NECROMANCY_ABILITIES.map((ability) => [ability.id, ability]));
    const s = simulateRevolution({
      ...necroInput,
      startingAdrenaline: 100,
      bar: [
        byId.get("spectral_scythe_3")!,
        byId.get("spectral_scythe_2")!,
        byId.get("spectral_scythe")!,
      ],
      style: "necromancy",
      durationTicks: 10,
    });
    expect(s.ok).toBe(true);
    expect(s.casts.slice(0, 3).map((cast) => cast.abilityId)).toEqual([
      "spectral_scythe",
      "spectral_scythe_2",
      "spectral_scythe_3",
    ]);
  });

  it("rejects out-of-range HP input", () => {
    expect(() =>
      simulate({ ...meleeInput, targetHpPercent: 140, rotation: rotationOf("punish") }),
    ).toThrow(RangeError);
  });
});

describe("Runic-charged Dragon Breath", () => {
  it("resolves the empowered band only while the charge is active", () => {
    const ctx = createCastContext(magicInput);
    const db = ctx.byId.get("dragon_breath")!;
    ctx.performCast(db, 0, false);
    ctx.performOffGcdCast(ctx.byId.get("runic_charge")!);
    ctx.performCast(db, ctx.firstLegalTick("dragon_breath"), false);
    const s = ctx.finish();
    expect(s.casts[0].result.expected).toBeCloseTo(1200); // normal 110-130
    expect(s.casts[1].abilityId).toBe("runic_charge"); // off-GCD record
    expect(s.casts[2].abilityId).toBe("dragon_breath");
    expect(s.casts[2].result.expected).toBeCloseTo(2850); // empowered 260-310
  });

  it("consumes the charge exactly once and grants the normal +9 adrenaline", () => {
    const ctx = createCastContext(magicInput);
    const db = ctx.byId.get("dragon_breath")!;
    ctx.performOffGcdCast(ctx.byId.get("runic_charge")!);
    ctx.performCast(db, 0, false);
    expect(ctx.getState().magic.runicCharge.animaUntilTick).toBe(0);
    expect(ctx.getState().adrenaline).toBe(9);
    ctx.performCast(db, ctx.firstLegalTick("dragon_breath"), false);
    const s = ctx.finish();
    expect(s.casts[2].result.expected).toBeCloseTo(1200); // unempowered
  });

  it("shares one cooldown family — no alternating-ID bypass", () => {
    const s = simulate({
      ...magicInput,
      rotation: rotationOf("runic_charge", "dragon_breath", "dragon_breath"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[1].result.expected).toBeCloseTo(2850); // empowered first cast
    expect(s.casts[2].tick).toBe(12); // normal 7.2s cooldown, not an alias reset
    expect(s.casts[2].result.expected).toBeCloseTo(1200);
  });

  it("empowered Dragon Breath stays a basic and never consumes Flow", () => {
    const ctx = createCastContext(magicInput);
    const sonic = ctx.byId.get("sonic_wave")!;
    const db = ctx.byId.get("dragon_breath")!;
    ctx.performCast(sonic, 0, false); // Flow active from tick 2 (10 points)
    ctx.performOffGcdCast(ctx.byId.get("runic_charge")!);
    ctx.performCast(db, 3, false);
    expect(ctx.getState().magic.flowReduction).toBe(10);
    expect(ctx.getState().magic.flowUntilTick).toBeGreaterThan(0);
  });
});
