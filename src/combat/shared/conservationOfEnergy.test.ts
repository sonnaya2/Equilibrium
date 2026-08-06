import { describe, expect, it } from "vitest";
import {
  CONSERVATION_OF_ENERGY_ID,
  CONSERVATION_OF_ENERGY_REFUND,
  ultimateAdrenalineRefundQualifies,
  resolveUltimateAdrenalineRefunds,
} from "./conservationOfEnergy";
import { RING_OF_VIGOUR_REFUND } from "./ringOfVigour";

describe("conservationOfEnergy", () => {
  it("exports wiki constants", () => {
    expect(CONSERVATION_OF_ENERGY_ID).toBe("conservation_of_energy");
    expect(CONSERVATION_OF_ENERGY_REFUND).toBe(10);
  });

  it("qualifies ultimates other than onslaught", () => {
    expect(ultimateAdrenalineRefundQualifies({ id: "berserk", category: "ultimate" })).toBe(true);
    expect(ultimateAdrenalineRefundQualifies({ id: "overpower", category: "ultimate" })).toBe(true);
  });

  it("rejects thresholds, basics, and onslaught", () => {
    expect(ultimateAdrenalineRefundQualifies({ id: "assault", category: "threshold" })).toBe(false);
    expect(ultimateAdrenalineRefundQualifies({ id: "attack", category: "basic" })).toBe(false);
    expect(ultimateAdrenalineRefundQualifies({ id: "onslaught", category: "ultimate" })).toBe(
      false,
    );
  });
});

describe("resolveUltimateAdrenalineRefunds (CoE + RoV SSOT)", () => {
  const ult = { id: "berserk", category: "ultimate" as const };

  it("qualifying ultimate + Vigour only: +10 RoV, 0 CoE", () => {
    const r = resolveUltimateAdrenalineRefunds(ult, { ringOfVigour: true }, RING_OF_VIGOUR_REFUND);
    expect(r.ringOfVigourRefund).toBe(RING_OF_VIGOUR_REFUND);
    expect(r.conservationOfEnergyRefund).toBe(0);
    expect(r.ringOfVigourRefund).toBe(10);
  });

  it("qualifying ultimate + CoE only: +10 CoE, 0 RoV", () => {
    const r = resolveUltimateAdrenalineRefunds(
      ult,
      { conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND },
      RING_OF_VIGOUR_REFUND,
    );
    expect(r.conservationOfEnergyRefund).toBe(10);
    expect(r.ringOfVigourRefund).toBe(0);
  });

  it("CoE + Vigour: exactly +20 total (10 each, additive)", () => {
    const r = resolveUltimateAdrenalineRefunds(
      ult,
      {
        conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
        ringOfVigour: true,
      },
      RING_OF_VIGOUR_REFUND,
    );
    expect(r.conservationOfEnergyRefund).toBe(10);
    expect(r.ringOfVigourRefund).toBe(10);
    expect(r.conservationOfEnergyRefund + r.ringOfVigourRefund).toBe(20);
  });

  it("ringOfVigour boolean once: never double refund amount", () => {
    // Equipped + permanent resolve to ringOfVigour:true once upstream; this gate
    // pays RING_OF_VIGOUR_REFUND once, not 2x.
    const r = resolveUltimateAdrenalineRefunds(ult, { ringOfVigour: true }, RING_OF_VIGOUR_REFUND);
    expect(r.ringOfVigourRefund).toBe(10);
    expect(r.ringOfVigourRefund).not.toBe(20);
  });

  it("threshold / basic / onslaught grant nothing", () => {
    const adren = {
      conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
      ringOfVigour: true,
    };
    for (const ability of [
      { id: "assault", category: "threshold" },
      { id: "attack", category: "basic" },
      { id: "onslaught", category: "ultimate" },
    ]) {
      const r = resolveUltimateAdrenalineRefunds(ability, adren, RING_OF_VIGOUR_REFUND);
      expect(r, ability.id).toEqual({ conservationOfEnergyRefund: 0, ringOfVigourRefund: 0 });
    }
  });
});
