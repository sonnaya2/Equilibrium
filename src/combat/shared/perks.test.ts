import { describe, expect, it } from "vitest";
import { calculateAbility } from "../pipeline/calculateAbility";
import { runPipeline } from "../pipeline/modifierPipeline";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import {
  ATTACK_CAPE_MELEE_HIT_CHANCE,
  bitingCritChanceBonus,
  cracklingDamageFraction,
  energisingAccuracyBonus,
  equilibriumBlocksCrits,
  equilibriumDamageBonus,
  equilibriumPerkModifier,
  eruptiveDamageBonus,
  eruptivePerkModifier,
  expectedRelentlessRefund,
  genocidalDamageBonus,
  lungingPerkModifier,
  preciseMinHitAddition,
  relentlessProcChance,
  ruthlessDamageBonus,
  ruthlessPerkModifier,
  SLAYER_PERK_DAMAGE_BONUS,
  STRENGTH_CAPE_DISMEMBER_EXTRA_HITS,
  STRENGTH_CAPE_DISMEMBER_HEAL_BONUS,
  ultimatumsPerkModifier,
} from "./perks";

const meleeContext = { style: "melee" as const };
const applyAt = (damage: number, modifiers: Parameters<typeof runPipeline>[1]) =>
  runPipeline({ damage }, modifiers, meleeContext).damage;

describe("shared/perks", () => {
  it("Equilibrium is R1 +8% AD then +2%/rank to +14% and blocks crits", () => {
    expect(equilibriumDamageBonus(1)).toBeCloseTo(0.08, 10);
    expect(equilibriumDamageBonus(4)).toBeCloseTo(0.14, 10);
    expect(applyAt(1000, [equilibriumPerkModifier(1)])).toBe(1080);
    expect(applyAt(1000, [equilibriumPerkModifier(2)])).toBe(1100);
    expect(applyAt(1000, [equilibriumPerkModifier(3)])).toBe(1120);
    expect(applyAt(1000, [equilibriumPerkModifier(4)])).toBe(1140);
    expect(equilibriumBlocksCrits(1)).toBe(true);
    expect(equilibriumBlocksCrits(0)).toBe(false);
  });

  it("Equilibrium accepts Power Archive effective ranks (R6 +18%, R8 +22%)", () => {
    // https://runescape.wiki/w/Power_Archive
    expect(equilibriumDamageBonus(6)).toBeCloseTo(0.18, 10);
    expect(equilibriumDamageBonus(8)).toBeCloseTo(0.22, 10);
  });

  it("Eruptive is +0.5%/rank AD (R4 +2%)", () => {
    expect(eruptiveDamageBonus(4)).toBeCloseTo(0.02, 10);
    expect(applyAt(1000, [eruptivePerkModifier(4)])).toBe(1020);
  });

  it("Eruptive remains distinct from Equilibrium at Archive ranks", () => {
    // Power Archive: Eruptive R6 +3%, R8 +4%; Equilibrium R6 +18% no crit
    expect(eruptiveDamageBonus(6)).toBeCloseTo(0.03, 10);
    expect(eruptiveDamageBonus(8)).toBeCloseTo(0.04, 10);
    expect(equilibriumDamageBonus(6)).not.toBeCloseTo(eruptiveDamageBonus(6), 10);
  });

  it("Biting is +2%/rank crit (+2.2% on level-20 gear)", () => {
    expect(bitingCritChanceBonus(4)).toBeCloseTo(0.08, 10);
    expect(bitingCritChanceBonus(4, true)).toBeCloseTo(0.088, 10);
  });

  it("Precise raises min by 1.5% of max per rank", () => {
    expect(preciseMinHitAddition(1100, 6)).toBeCloseTo(99, 10);
  });

  it("Ultimatums applies only to ultimate casts (R1 +4% ... R4 +7%)", () => {
    expect(applyAt(1000, [ultimatumsPerkModifier(1, "ultimate")])).toBe(1040);
    expect(applyAt(1000, [ultimatumsPerkModifier(4, "ultimate")])).toBe(1070);
    expect(applyAt(1000, [ultimatumsPerkModifier(4, "basic")])).toBe(1000);
  });

  it("Lunging matches engine and record ability ids (R1 +13% ... R4 +22%)", () => {
    expect(applyAt(1000, [lungingPerkModifier(4, "melee:dismember")])).toBe(1220);
    expect(applyAt(1000, [lungingPerkModifier(4, "dismember")])).toBe(1220);
    expect(applyAt(1000, [lungingPerkModifier(4, "combust")])).toBe(1220);
    expect(applyAt(1000, [lungingPerkModifier(4, "magic:combust")])).toBe(1220);
    expect(applyAt(1000, [lungingPerkModifier(4, "melee:rend")])).toBe(1000);
  });

  it("stacks Equilibrium + Ultimatums through the pipeline", () => {
    expect(applyAt(1000, [equilibriumPerkModifier(4), ultimatumsPerkModifier(4, "ultimate")])).toBe(
      Math.floor(1140 * 1.07),
    );
  });

  it("Energising grants flat accuracy 50 + 25/rank", () => {
    expect(energisingAccuracyBonus(4)).toBe(150);
  });

  it("slayer / ruthless / crackling / genocidal formulas match wiki", () => {
    expect(SLAYER_PERK_DAMAGE_BONUS).toBeCloseTo(0.07, 10);
    expect(ruthlessDamageBonus(3, 5)).toBeCloseTo(0.075, 10);
    expect(cracklingDamageFraction(4)).toBeCloseTo(2.0, 10);
    expect(genocidalDamageBonus(100, 100)).toBe(0);
    expect(genocidalDamageBonus(1, 100)).toBeCloseTo(0.049, 10);
  });

  // https://runescape.wiki/w/Ruthless - bleed abilities unaffected
  it("Ruthless multiplies direct hits and skips bleed/true DoT ticks", () => {
    const mod = ruthlessPerkModifier(3, 5);
    expect(mod.stage).toBe("base");
    expect(mod.applies({ style: "melee" })).toBe(true);
    expect(mod.applies({ style: "melee", provenance: { kind: "player_direct" } })).toBe(true);
    expect(mod.applies({ style: "melee", dotKind: "bleed" })).toBe(false);
    expect(mod.applies({ style: "melee", damageSource: "dot" })).toBe(false);
    expect(
      mod.applies({ style: "melee", provenance: { kind: "player_dot", detail: "bleed" } }),
    ).toBe(false);
    expect(mod.applies({ style: "melee", provenance: { kind: "player_converted_channel" } })).toBe(
      true,
    );
    expect(ruthlessPerkModifier(3, 0).applies({ style: "melee" })).toBe(false);
    // R3 x 5 stacks = +7.5%; floor(1000 * 1.075) = 1075
    expect(applyAt(1000, [mod])).toBe(1075);
    expect(runPipeline({ damage: 1000 }, [mod], { style: "melee", dotKind: "bleed" }).damage).toBe(
      1000,
    );

    const hitInput = {
      base: 1000,
      level: 90,
      accuracy: 1,
      crit: { chance: 0 },
      modifiers: [mod],
    };
    const dismember = MELEE_ABILITIES.find((a) => a.id === "dismember")!;
    const assault = MELEE_ABILITIES.find((a) => a.id === "assault")!;
    const bleedPlain = calculateAbility(dismember, { ...hitInput, modifiers: [] });
    const bleedRuthless = calculateAbility(dismember, hitInput);
    expect(bleedRuthless.expected).toBe(bleedPlain.expected);
    const directPlain = calculateAbility(assault, { ...hitInput, modifiers: [] });
    const directRuthless = calculateAbility(assault, hitInput);
    expect(directRuthless.expected).toBeGreaterThan(directPlain.expected);
  });

  it("skillcape constants match wiki combat modernisation values", () => {
    expect(ATTACK_CAPE_MELEE_HIT_CHANCE).toBe(0.02);
    expect(STRENGTH_CAPE_DISMEMBER_EXTRA_HITS).toBe(3);
    expect(STRENGTH_CAPE_DISMEMBER_HEAL_BONUS).toBeCloseTo(0.03, 10);
  });

  it("Relentless is 1%/rank (1.1% lvl20) and EV refund is cost × chance", () => {
    expect(relentlessProcChance(1)).toBeCloseTo(0.01, 10);
    expect(relentlessProcChance(5)).toBeCloseTo(0.05, 10);
    expect(relentlessProcChance(5, true)).toBeCloseTo(0.055, 10);
    expect(expectedRelentlessRefund(60, 5)).toBeCloseTo(3, 10);
    expect(expectedRelentlessRefund(60, 5, true)).toBeCloseTo(3.3, 10);
    expect(expectedRelentlessRefund(0, 5)).toBe(0);
    expect(expectedRelentlessRefund(60, 0)).toBe(0);
  });
});
