import { describe, expect, it } from "vitest";
import { runPipeline } from "../pipeline/modifierPipeline";
import {
  ATTACK_CAPE_MELEE_HIT_CHANCE,
  energisingAccuracyBonus,
  equilibriumPerkModifier,
  lungingPerkModifier,
  ultimatumsPerkModifier,
} from "./perks";

const meleeContext = { style: "melee" as const };
const applyAt = (damage: number, modifiers: Parameters<typeof runPipeline>[1]) =>
  runPipeline({ damage }, modifiers, meleeContext).damage;

describe("shared/perks", () => {
  it("Equilibrium adds +10% ability damage plus 1% per rank", () => {
    expect(applyAt(1000, [equilibriumPerkModifier(1)])).toBe(1110);
    expect(applyAt(1000, [equilibriumPerkModifier(4)])).toBe(1140);
  });

  it("Ultimatums applies only to ultimate casts, +3% plus 1%/rank", () => {
    expect(applyAt(1000, [ultimatumsPerkModifier(4, "ultimate")])).toBe(1070);
    expect(applyAt(1000, [ultimatumsPerkModifier(4, "basic")])).toBe(1000);
  });

  it("Lunging applies only to the Dismember/Combust line at +10% + 3%/rank", () => {
    expect(applyAt(1000, [lungingPerkModifier(4, "melee:dismember")])).toBe(1220);
    expect(applyAt(1000, [lungingPerkModifier(4, "melee:rend")])).toBe(1000);
  });

  it("stacks with other perks through the pipeline without merging stages", () => {
    expect(applyAt(1000, [equilibriumPerkModifier(4), ultimatumsPerkModifier(4, "ultimate")])).toBe(
      Math.floor(1140 * 1.07),
    );
  });

  it("Energising grants flat accuracy 50 + 25/rank", () => {
    expect(energisingAccuracyBonus(4)).toBe(150);
  });

  it("skillcape constants match Beta Update 4", () => {
    expect(ATTACK_CAPE_MELEE_HIT_CHANCE).toBe(0.02);
  });
});
