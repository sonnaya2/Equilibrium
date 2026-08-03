import { describe, expect, it } from "vitest";
import {
  CONSERVATION_OF_ENERGY_ID,
  CONSERVATION_OF_ENERGY_REFUND,
  conservationOfEnergyQualifies,
} from "./conservationOfEnergy";

describe("conservationOfEnergy", () => {
  it("exports wiki constants", () => {
    expect(CONSERVATION_OF_ENERGY_ID).toBe("conservation_of_energy");
    expect(CONSERVATION_OF_ENERGY_REFUND).toBe(10);
  });

  it("qualifies ultimates other than onslaught", () => {
    expect(conservationOfEnergyQualifies({ id: "berserk", category: "ultimate" })).toBe(
      true,
    );
    expect(conservationOfEnergyQualifies({ id: "overpower", category: "ultimate" })).toBe(
      true,
    );
  });

  it("rejects thresholds, basics, and onslaught", () => {
    expect(
      conservationOfEnergyQualifies({ id: "assault", category: "threshold" }),
    ).toBe(false);
    expect(conservationOfEnergyQualifies({ id: "attack", category: "basic" })).toBe(false);
    expect(conservationOfEnergyQualifies({ id: "onslaught", category: "ultimate" })).toBe(
      false,
    );
  });
});
