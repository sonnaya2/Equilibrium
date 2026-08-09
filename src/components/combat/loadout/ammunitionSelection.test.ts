import { describe, expect, it } from "vitest";
import { normalizeSavedEquipmentId, normalizeSelectedAmmunitionId } from "./ammunitionSelection";

describe("loadout ammunition selection persistence", () => {
  it("persists selected ammunition only when the equipped record is a quiver", () => {
    expect(normalizeSelectedAmmunitionId(true, "item:jas-dragonbane-arrows")).toBe(
      "item:jas-dragonbane-arrows",
    );
    expect(normalizeSelectedAmmunitionId(false, "item:jas-dragonbane-arrows")).toBeNull();
  });

  it("normalizes an absent or invalid quiver selection to null", () => {
    expect(normalizeSelectedAmmunitionId(true, undefined)).toBeNull();
    expect(normalizeSelectedAmmunitionId(true, "")).toBeNull();
    expect(normalizeSelectedAmmunitionId(true, 123)).toBeNull();
  });

  it("migrates the removed hydra id at the saved-loadout boundary", () => {
    expect(normalizeSavedEquipmentId("item:hydra-bakriminel-bolts-e")).toBe(
      "item:hydrix-bakriminel-bolts-e",
    );
    expect(normalizeSelectedAmmunitionId(true, "item:hydra-bakriminel-bolts-e")).toBe(
      "item:hydrix-bakriminel-bolts-e",
    );
  });
});
