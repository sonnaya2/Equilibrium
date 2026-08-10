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

  it("labels Corruption Shot as Desert ability codex (Mazcab)", () => {
    expect(abilityUnlockMarkerData({ id: "corruption_shot", name: "Corruption Shot" })).toEqual({
      regions: ["desert"],
      codex: "/game/upgrades/ability-codices/corruption-shot.webp",
      label: "Kharidian Desert · Ability codex",
    });
  });

  it("labels Corruption Blast as Desert ability codex (Mazcab)", () => {
    expect(abilityUnlockMarkerData({ id: "corruption_blast", name: "Corruption Blast" })).toEqual({
      regions: ["desert"],
      codex: "/game/upgrades/ability-codices/corruption-blast.webp",
      label: "Kharidian Desert · Ability codex",
    });
  });

  it("labels Greater Death's Swiftness as Misthalin ability codex (Zamorak)", () => {
    expect(
      abilityUnlockMarkerData({ id: "greater_deaths_swiftness", name: "Greater Death's Swiftness" }),
    ).toEqual({
      regions: ["misthalin"],
      codex: "/game/upgrades/ability-codices/greater-deaths-swiftness.webp",
      label: "Misthalin · Ability codex",
    });
  });

  it("labels Greater Sunshine as Misthalin ability codex (Zamorak)", () => {
    expect(abilityUnlockMarkerData({ id: "greater_sunshine", name: "Greater Sunshine" })).toEqual({
      regions: ["misthalin"],
      codex: "/game/upgrades/ability-codices/greater-sunshine.webp",
      label: "Misthalin · Ability codex",
    });
  });

  it("labels Sunshine as Kandarin quest unlock (The World Wakes)", () => {
    expect(abilityUnlockMarkerData({ id: "sunshine", name: "Sunshine" })).toEqual({
      regions: ["kandarin"],
      codex: null,
      label: "Kandarin",
    });
  });

  it("labels Death's Swiftness as Kandarin quest unlock (The World Wakes)", () => {
    expect(abilityUnlockMarkerData({ id: "deaths_swiftness", name: "Death's Swiftness" })).toEqual({
      regions: ["kandarin"],
      codex: null,
      label: "Kandarin",
    });
  });

  it("labels Chaos Roar as Misthalin ability codex (Zamorak)", () => {
    expect(abilityUnlockMarkerData({ id: "chaos_roar", name: "Chaos Roar" })).toEqual({
      regions: ["misthalin"],
      codex: "/game/upgrades/ability-codices/chaos-roar.webp",
      label: "Misthalin · Ability codex",
    });
  });

  it("labels Greater Chain as Anachronia ability codex (Raksha)", () => {
    expect(abilityUnlockMarkerData({ id: "greater_chain", name: "Greater Chain" })).toEqual({
      regions: ["anachronia"],
      codex: "/game/upgrades/ability-codices/greater-chain.webp",
      label: "Anachronia · Ability codex",
    });
  });

  it("labels Greater Barge as Wilderness/Forinthry ability codex (Dragonkin Laboratory)", () => {
    expect(abilityUnlockMarkerData({ id: "greater_barge", name: "Greater Barge" })).toEqual({
      regions: ["forinthry"],
      codex: "/game/upgrades/ability-codices/greater-barge.webp",
      label: "Wilderness · Ability codex",
    });
  });

  it("labels Greater Flurry as Wilderness/Forinthry ability codex (Dragonkin Laboratory)", () => {
    expect(abilityUnlockMarkerData({ id: "greater_flurry", name: "Greater Flurry" })).toEqual({
      regions: ["forinthry"],
      codex: "/game/upgrades/ability-codices/greater-flurry.webp",
      label: "Wilderness · Ability codex",
    });
  });

  it("labels Magma Tempest as Misthalin ability codex (TzKal-Zuk)", () => {
    expect(abilityUnlockMarkerData({ id: "magma_tempest", name: "Magma Tempest" })).toEqual({
      regions: ["misthalin"],
      codex: "/game/upgrades/ability-codices/magma-tempest.webp",
      label: "Misthalin · Ability codex",
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
