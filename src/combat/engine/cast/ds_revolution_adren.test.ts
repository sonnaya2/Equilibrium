import { describe, expect, it } from "vitest";
import type { RegionId } from "@/league";
import { simulateRevolution } from "../simulation/revolution";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
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

function byId(id: string) {
  const a = RANGED_ABILITIES.find((x) => x.id === id);
  if (!a) throw new Error(id);
  return a;
}

function revo(selected: string[], barIds: string[], starting = 0) {
  const loadout = normalizeLoadout(
    withArchaeologySelection({ ...DEFAULT_LOADOUT, style: "ranged" }, selected, 500),
  );
  const stats = loadoutStats(loadout, { unlockedRegions: [...regions] });
  const bar = barIds.map(byId);
  return simulateRevolution({
    base: stats.base,
    level: stats.level,
    accuracy: stats.dp,
    crit: { chance: stats.critChance },
    abilities: RANGED_ABILITIES,
    bar,
    style: "ranged",
    durationTicks: 200,
    modifiers: stats.globalModifiers,
    adrenaline: stats.adrenaline,
    startingAdrenaline: starting,
    weaponConfiguration: stats.weaponConfiguration,
    equipmentIds: stats.equipmentIds,
    equipmentEffects: stats.equipmentEffects,
    league: stats.league,
    context: stats.combatContext,
    cap: stats.cap,
  });
}

describe("Revolution casts Death's Swiftness with energy relics", () => {
  it("from 0 adren, weaves then casts DS when on the bar (CoE+FotS)", () => {
    const s = revo(
      ["fury_of_the_small", "conservation_of_energy"],
      ["deaths_swiftness", "piercing_shot", "ricochet", "corruption_shot"],
      0,
    );
    expect(s.ok, s.error).toBe(true);
    const dsCount = s.casts.filter((c) => c.abilityId === "deaths_swiftness").length;
    expect(dsCount, `casts=${s.casts.map((c) => c.abilityId).join(",")}`).toBeGreaterThanOrEqual(1);
  });

  it("from 100 adren, first cast can be DS", () => {
    const s = revo(
      ["conservation_of_energy"],
      ["deaths_swiftness", "piercing_shot"],
      100,
    );
    expect(s.ok, s.error).toBe(true);
    expect(s.casts[0]?.abilityId).toBe("deaths_swiftness");
    expect(s.casts[0]?.adrenalineAfter).toBe(10);
  });

  it("bare vs CoE+FotS: CoE+FotS must cast DS at least as often in 200 ticks", () => {
    const bar = ["deaths_swiftness", "piercing_shot", "ricochet", "corruption_shot"];
    const off = revo([], bar, 0);
    const on = revo(["fury_of_the_small", "conservation_of_energy"], bar, 0);
    expect(off.ok, off.error).toBe(true);
    expect(on.ok, on.error).toBe(true);
    const offDs = off.casts.filter((c) => c.abilityId === "deaths_swiftness").length;
    const onDs = on.casts.filter((c) => c.abilityId === "deaths_swiftness").length;
    expect(onDs).toBeGreaterThanOrEqual(offDs);
    expect(onDs).toBeGreaterThanOrEqual(1);
  });
});
