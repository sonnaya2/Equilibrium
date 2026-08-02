import { describe, expect, it } from "vitest";
import { runPipeline } from "../pipeline/modifierPipeline";
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

  it("Eruptive is +0.5%/rank AD (R4 +2%)", () => {
    expect(eruptiveDamageBonus(4)).toBeCloseTo(0.02, 10);
    expect(applyAt(1000, [eruptivePerkModifier(4)])).toBe(1020);
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
