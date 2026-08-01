import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { NECROMANCY_ABILITIES } from "../styles/necromancy/abilities";
import { rotationOf } from "./contracts";
import { simulate, type CastRecord, type SimulateInput } from "./simulate";
import { createCastContext } from "./simulate";

/**
 * Stage 6 regression coverage: Wild Magic crit layers, Concentrated Blast /
 * Greater Concentrated Blast crit progression, Channelled Might after a
 * completed Asphyxiate, Dragon Breath vs Combust, Sonic Wave / Greater Sonic
 * Wave Flow, and target-HP-dependent bands (Punish, Spectral Scythe 3).
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
    // 1400 avg band × (1 + 0.10 × 0.70)
    expect(wm.result.expected).toBeCloseTo(2 * 1400 * 1.07);
    expect(wm.result.hits[0].critChance).toBeCloseTo(0.1);
  });
});

describe("Concentrated Blast crit progression", () => {
  it("stacks +5% per landed hit through the channel, then the next Magic attack gets +15%", () => {
    const ctx = createCastContext(magicInput);
    const cb = ctx.byId.get("concentrated_blast")!;
    const attack = ctx.byId.get("magic_attack")!;
    ctx.performCast(cb, 0, false); // hits land 0,1,2 → stacks build to 3
    expect(ctx.getState().magicFx.concCritStacks).toBe(3);
    ctx.performCast(attack, ctx.getState().tick, false);
    const s = ctx.finish();
    const cbCast = s.casts[0];
    expect(cbCast.result.hits[0].critChance).toBeCloseTo(0);
    expect(cbCast.result.hits[1].critChance).toBeCloseTo(0.05);
    expect(cbCast.result.hits[2].critChance).toBeCloseTo(0.1);
    expect(s.casts[1].result.hits[0].critChance).toBeCloseTo(0.15);
    expect(s.casts[1].result.expected).toBeCloseTo(1000 * 1.075);
    // The consuming attack reset the stacks.
    expect(ctx.getState().magicFx.concCritStacks).toBe(0);
  });

  it("Greater Concentrated Blast stacks +7% per hit", () => {
    const ctx = createCastContext(magicInput);
    const gcb = ctx.byId.get("greater_concentrated_blast")!;
    ctx.performCast(gcb, 0, false);
    expect(ctx.getState().magicFx.concCritStacks).toBe(3);
    expect(ctx.getState().magicFx.concCritPerStackPct).toBe(7);
    const s = ctx.finish();
    expect(s.casts[0].result.hits[1].critChance).toBeCloseTo(0.07);
    expect(s.casts[0].result.hits[2].critChance).toBeCloseTo(0.14);
  });

  it("a Runic-charged cast empowers the grant to +15% per hit and consumes the charge", () => {
    const ctx = createCastContext(magicInput);
    ctx.performOffGcdCast(ctx.byId.get("runic_charge")!);
    ctx.performCast(ctx.byId.get("concentrated_blast")!, ctx.getState().tick, false);
    expect(ctx.getState().magicFx.concCritPerStackPct).toBe(15);
    expect(ctx.getState().magic.animaUntilTick).toBe(0);
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
    const might = ctx.getState().magicFx.channelledMight;
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
    expect(empowered.result.hits[0].expected).toBeCloseTo(1000 * 1.65);
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
    expect(breaths[0].result.expected).toBeCloseTo(1200 * 1.25);
    // Second cast at tick 30: the 10-tick burn (0→30) has just lapsed.
    expect(breaths[1].result.expected).toBeCloseTo(1200);
  });
});

describe("Sonic Wave Flow", () => {
  it("reduces the next Magic ability's cost by 10% and is consumed", () => {
    const ctx = createCastContext(magicInput);
    const attack = ctx.byId.get("magic_attack")!;
    const sonic = ctx.byId.get("sonic_wave")!;
    const wild = ctx.byId.get("wild_magic")!;
    ctx.performCast(attack, 0, false);
    ctx.performCast(attack, 3, false);
    ctx.performCast(sonic, 6, false);
    expect(ctx.getState().magicFx.flowReductionPct).toBe(10);
    expect(ctx.costOf(wild)).toBeCloseTo(25 * 0.9);
    ctx.performCast(wild, ctx.getState().tick, false);
    expect(ctx.getState().magicFx.flowUntilTick).toBe(0); // consumed
  });

  it("basics do not consume Flow; Greater Sonic Wave reduces by 20%", () => {
    const ctx = createCastContext(magicInput);
    const attack = ctx.byId.get("magic_attack")!;
    const gsw = ctx.byId.get("greater_sonic_wave")!;
    const wild = ctx.byId.get("wild_magic")!;
    ctx.performCast(attack, 0, false);
    ctx.performCast(attack, 3, false);
    ctx.performCast(gsw, 6, false);
    ctx.performCast(attack, 9, false);
    expect(ctx.getState().magicFx.flowReductionPct).toBe(20);
    expect(ctx.costOf(wild)).toBeCloseTo(25 * 0.8);
  });

  it("a Runic-charged Sonic Wave reduces by 35% and consumes the charge", () => {
    const ctx = createCastContext(magicInput);
    ctx.performOffGcdCast(ctx.byId.get("runic_charge")!);
    ctx.performCast(ctx.byId.get("sonic_wave")!, ctx.getState().tick, false);
    expect(ctx.getState().magicFx.flowReductionPct).toBe(35);
    expect(ctx.getState().magic.animaUntilTick).toBe(0);
  });

  it("Flow expires at the 9s boundary", () => {
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

  it("Spectral Scythe cast 3 scales by (2 − hp fraction)", () => {
    const at50 = simulate({
      ...necroInput,
      targetHpPercent: 50,
      rotation: rotationOf(...Array(4).fill("necromancy_basic"), "spectral_scythe_3"),
    });
    expect(lastCastOf(at50).result.expected).toBeCloseTo(2500 * 1.5);
    const noHp = simulate({
      ...necroInput,
      rotation: rotationOf(...Array(4).fill("necromancy_basic"), "spectral_scythe_3"),
    });
    expect(lastCastOf(noHp).result.expected).toBeCloseTo(2500);
  });

  it("rejects out-of-range HP input", () => {
    expect(() =>
      simulate({ ...meleeInput, targetHpPercent: 140, rotation: rotationOf("punish") }),
    ).toThrow(RangeError);
  });
});
