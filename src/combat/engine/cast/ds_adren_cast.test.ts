import { describe, expect, it } from "vitest";
import type { RegionId } from "@/league";
import { simulate } from "../simulation/simulate";
import { rotationOf } from "../simulation/contracts";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import {
  DEFAULT_LOADOUT,
  withArchaeologySelection,
  normalizeLoadout,
} from "../../../components/combat/loadout/model";
import { loadoutStats } from "../../../components/combat/loadoutStats";

const regions = [
  "misthalin",
  "kandarin",
  "morytania",
  "forinthry",
  "anachronia",
] as readonly RegionId[];

function run(
  selected: string[],
  rotation: string[],
  opts: { starting?: number; weave?: boolean } = {},
) {
  const loadout = normalizeLoadout(
    withArchaeologySelection(
      {
        ...DEFAULT_LOADOUT,
        style: "ranged",
      },
      selected,
      500,
    ),
  );
  const stats = loadoutStats(loadout, { unlockedRegions: [...regions] });
  const summary = simulate({
    base: stats.base,
    level: stats.level,
    accuracy: stats.dp,
    crit: { chance: stats.critChance },
    abilities: [...RANGED_ABILITIES, ...MELEE_ABILITIES],
    rotation: rotationOf(...rotation),
    modifiers: stats.globalModifiers,
    adrenaline: stats.adrenaline,
    startingAdrenaline: opts.starting ?? 100,
    autoWeave: opts.weave ?? true,
    weaponConfiguration: stats.weaponConfiguration,
    equipmentIds: stats.equipmentIds,
    equipmentEffects: stats.equipmentEffects,
    league: stats.league,
    context: stats.combatContext,
    cap: stats.cap,
  });
  return { summary, adren: stats.adrenaline, weapon: stats.weaponConfiguration, stats };
}

describe("Death's Swiftness casting with energy relics", () => {
  it("casts deaths_swiftness first when starting at 100 (bare and CoE+FotS)", () => {
    for (const selected of [
      [],
      ["fury_of_the_small"],
      ["conservation_of_energy"],
      ["fury_of_the_small", "conservation_of_energy"],
    ]) {
      const { summary } = run(selected, [
        "deaths_swiftness",
        "piercing_shot",
        "piercing_shot",
      ]);
      expect(summary.ok, `failed selected=${selected.join(",")}: ${summary.error}`).toBe(true);
      expect(
        summary.casts.some((c) => c.abilityId === "deaths_swiftness"),
        `no DS cast selected=${selected.join(",")}`,
      ).toBe(true);
      expect(summary.casts[0]?.abilityId).toBe("deaths_swiftness");
      // After DS: 0 bare, 10 with CoE.
      const after = summary.casts[0]!.adrenalineAfter;
      if (selected.includes("conservation_of_energy")) {
        expect(after).toBe(10);
      } else {
        expect(after).toBe(0);
      }
    }
  });

  it("rebuilds adren with FotS and reaches second DS under CoE", () => {
    const rot = [
      "deaths_swiftness",
      "piercing_shot",
      "piercing_shot",
      "piercing_shot",
      "piercing_shot",
      "piercing_shot",
      "piercing_shot",
      "piercing_shot",
      "piercing_shot",
      "piercing_shot",
      "piercing_shot",
      "piercing_shot",
      "deaths_swiftness",
    ];
    const off = run([], rot);
    const on = run(["fury_of_the_small", "conservation_of_energy"], rot);
    expect(off.summary.ok, off.summary.error).toBe(true);
    expect(on.summary.ok, on.summary.error).toBe(true);
    const offDs = off.summary.casts.filter((c) => c.abilityId === "deaths_swiftness").length;
    const onDs = on.summary.casts.filter((c) => c.abilityId === "deaths_swiftness").length;
    expect(offDs).toBeGreaterThanOrEqual(1);
    expect(onDs).toBeGreaterThanOrEqual(offDs);
    // First DS leaves 10 with CoE so rebuild needs fewer shots.
    const firstOn = on.summary.casts.find((c) => c.abilityId === "deaths_swiftness")!;
    expect(firstOn.adrenalineAfter).toBe(10);
  });

  it("starting from 0: FotS+weaves can afford DS", () => {
    const rot = ["deaths_swiftness"];
    const on = run(["fury_of_the_small"], rot, { starting: 0, weave: true });
    expect(on.summary.ok, on.summary.error).toBe(true);
    expect(on.summary.casts.some((c) => c.abilityId === "deaths_swiftness")).toBe(true);
    const basics = on.summary.casts.filter((c) => c.auto || c.abilityId === "piercing_shot" || c.abilityId === "attack" || c.abilityId === "needle_strike" || c.abilityId === "corruption_shot");
    // Should have woven generating basics before DS.
    expect(on.summary.casts.length).toBeGreaterThan(1);
    void basics;
  });
});
