import { describe, expect, it } from "vitest";
import { abilityUnlockMarkerData } from "./AbilityUnlockMarkers";

describe("ability unlock markers", () => {
  it("exposes the regional crest and codex for regional codex unlocks", () => {
    expect(abilityUnlockMarkerData({ id: "greater_ricochet", name: "Greater Ricochet" })).toEqual({
      regions: ["anachronia"],
      codex: "/game/upgrades/ability-codices/greater-ricochet.webp",
      label: "Anachronia · Ability codex",
    });
  });

  it("does not mark ordinary global level abilities", () => {
    expect(abilityUnlockMarkerData({ id: "ranged_attack", name: "Ranged Attack" })).toEqual({
      regions: [],
      codex: null,
      label: "",
    });
  });
});
