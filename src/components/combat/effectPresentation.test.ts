import { describe, expect, it } from "vitest";
import { combatEffectDisplayName, combatEffectIconPath } from "./effectPresentation";

describe("combat effect presentation", () => {
  it("names procedural ranged and poison damage", () => {
    expect(combatEffectDisplayName("perfect_equilibrium")).toBe("Perfect Equilibrium");
    expect(combatEffectDisplayName("ammunition:bik")).toBe("Evolving Toxin");
    expect(combatEffectDisplayName("player_weapon_poison")).toBe("Weapon poison");
    expect(combatEffectDisplayName("song:essence-corruption")).toBe("Essence Corruption");
  });

  it("uses local icons for PE, poison, ammunition, and damaging perks", () => {
    expect(combatEffectIconPath("perfect_equilibrium")).toBe(
      "/game/combat/equipment/bow-of-the-last-guardian.webp",
    );
    expect(combatEffectIconPath("player_weapon_poison")).toBe(
      "/game/upgrades/permanent-unlocks/weapon-poison.webp",
    );
    expect(combatEffectIconPath("ammunition:bik")).toBe("/game/combat/equipment/bik-arrows.webp");
    expect(combatEffectIconPath("crackling")).toBe("/game/combat/perks/crackling.webp");
    expect(combatEffectIconPath("aftershock")).toBe("/game/combat/perks/aftershock.webp");
    expect(combatEffectIconPath("song:essence-corruption")).toBe(
      "/game/combat/equipment/roar-of-awakening.webp",
    );
  });

  it("uses the originating blessing icon when the effect id is shared", () => {
    expect(
      combatEffectIconPath("inferno-of-zamorak", {
        kind: "league-blessing",
        blessingId: "unholy-critual",
      }),
    ).toBe("/game/blessings/unholy-critual.webp");
    expect(combatEffectIconPath("light-of-saradomin", { kind: "league-blessing" })).toBe(
      "/game/blessings/striking-light.webp",
    );
  });
});
