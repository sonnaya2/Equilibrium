import { describe, expect, it } from "vitest";
import type { TargetPresetRecord } from "../data/records";
import {
  affinityForStyle,
  materializeTargetPreset,
  necromancyAffinityFromProfile,
  targetDiffersFromPreset,
} from "./presetAdapter";

const basePreset = (overrides: Partial<TargetPresetRecord> = {}): TargetPresetRecord => ({
  id: "boss:test",
  name: "Test Boss",
  encounter: "Test",
  category: "boss",
  wiki: { pageName: "Test_Boss" },
  support: "supported",
  sources: [
    {
      source: "runescape-wiki",
      url: "https://runescape.wiki/w/Test_Boss",
      verifiedAt: "2026-08-09",
    },
  ],
  stats: {
    defenceLevel: 80,
    armour: 500,
    affinities: { melee: 70, ranged: 60, magic: 50, weakness: 90 },
    size: 3,
    lifePoints: 100_000,
    poisonImmune: true,
    demon: true,
  },
  ...overrides,
});

describe("presetAdapter", () => {
  it("picks style affinity and derives necromancy as middle", () => {
    const profile = { melee: 70, ranged: 60, magic: 50 };
    expect(affinityForStyle(profile, "melee")).toBe(70);
    expect(affinityForStyle(profile, "ranged")).toBe(60);
    expect(affinityForStyle(profile, "magic")).toBe(50);
    expect(necromancyAffinityFromProfile(profile)).toBe(60);
    expect(affinityForStyle(profile, "necromancy")).toBe(60);
    expect(necromancyAffinityFromProfile({ melee: 55, ranged: 55, magic: 55 })).toBe(55);
  });

  it("materializes supported preset fields", () => {
    const fields = materializeTargetPreset(basePreset(), { style: "ranged" });
    expect(fields).toEqual({
      defenceLevel: 80,
      armour: 500,
      affinity: 60,
      weaknessAffinity: 90,
      size: 3,
      maximumLifePoints: 100_000,
      poisonImmune: true,
      demon: true,
    });
  });

  it("materializes interval from attackRateTicks without affecting Modified", () => {
    const fields = materializeTargetPreset(
      basePreset({
        stats: {
          defenceLevel: 80,
          armour: 500,
          affinities: { melee: 70, ranged: 60, magic: 50 },
          size: 3,
          attackRateTicks: 4,
        },
      }),
      { style: "melee" },
    );
    expect(fields?.incomingHitIntervalSeconds).toBe(2.4);
    expect(fields?.attackRateTicks).toBe(4);
    // Interval is scenario seed only; Modified compares defence/aff/race, not cadence.
    expect(
      targetDiffersFromPreset(
        {
          defenceLevel: 80,
          armour: 500,
          affinity: 70,
          size: 3,
        },
        fields!,
      ),
    ).toBe(false);
  });

  it("exposes weaknessAffinity without rewriting style affinity", () => {
    const fields = materializeTargetPreset(basePreset(), { style: "melee" });
    expect(fields?.affinity).toBe(70);
    expect(fields?.weaknessAffinity).toBe(90);
  });

  it("returns null for unsupported or incomplete presets", () => {
    expect(
      materializeTargetPreset(basePreset({ support: "unsupported", unsupportedReason: "skilling" }), {
        style: "melee",
      }),
    ).toBeNull();
    expect(
      materializeTargetPreset(
        basePreset({
          stats: {
            defenceLevel: null,
            armour: null,
            affinities: null,
            size: null,
          },
        }),
        { style: "melee" },
      ),
    ).toBeNull();
  });

  it("returns null when affinities are missing with valid Def", () => {
    expect(
      materializeTargetPreset(
        basePreset({
          stats: {
            defenceLevel: 80,
            armour: 500,
            affinities: null,
            size: 3,
          },
        }),
        { style: "melee" },
      ),
    ).toBeNull();
  });

  it("detects modified targets", () => {
    const materialized = materializeTargetPreset(basePreset(), { style: "melee" })!;
    expect(
      targetDiffersFromPreset(
        {
          defenceLevel: 80,
          armour: 500,
          affinity: 70,
          size: 3,
          maximumLifePoints: 100_000,
          poisonImmune: true,
          demon: true,
        },
        materialized,
      ),
    ).toBe(false);
    expect(
      targetDiffersFromPreset(
        {
          defenceLevel: 80,
          armour: 500,
          affinity: 55,
          size: 3,
          maximumLifePoints: 100_000,
          poisonImmune: true,
          demon: true,
        },
        materialized,
      ),
    ).toBe(true);
  });
});
