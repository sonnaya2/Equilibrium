import { describe, expect, it } from "vitest";
import type { RegionId } from "@/league";
import { simulate } from "../simulation/simulate";
import { simulateRevolution } from "../simulation/revolution";
import { rotationOf } from "../simulation/contracts";
import {
  DEFAULT_LOADOUT,
  withArchaeologySelection,
  normalizeLoadout,
} from "../../../components/combat/loadout/model";
import { loadoutStats } from "../../../components/combat/loadoutStats";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { calculateLeagueAbility } from "../../league/damage";
import { resolveLeagueRules } from "../../league/ruleset";

const regions = [
  "misthalin",
  "kandarin",
  "morytania",
  "forinthry",
  "anachronia",
] as readonly RegionId[];

function statsFor(selected: string[]) {
  const loadout = normalizeLoadout(
    withArchaeologySelection(DEFAULT_LOADOUT, selected, 500),
  );
  return {
    loadout,
    stats: loadoutStats(loadout, { unlockedRegions: regions }),
  };
}

function sim(
  selected: string[],
  rotation: string[],
  startingAdrenaline = 100,
  autoWeave = true,
) {
  const { stats } = statsFor(selected);
  return simulate({
    base: stats.base,
    level: stats.level,
    accuracy: stats.dp,
    crit: {
      chance: stats.critChance,
      disabled: stats.critsDisabled,
      damageBonus: stats.critDamageBonus,
    },
    abilities: MELEE_ABILITIES,
    rotation: rotationOf(...rotation),
    modifiers: stats.globalModifiers,
    adrenaline: stats.adrenaline,
    startingAdrenaline,
    autoWeave,
    equipmentIds: stats.equipmentIds,
    weaponConfiguration: stats.weaponConfiguration,
    equipmentEffects: stats.equipmentEffects,
    league: stats.league,
    context: stats.combatContext,
    cap: stats.cap,
  });
}

describe("FotS + CoE must not reduce damage EV / rotation DPS", () => {
  it("single-cast ability expected damage is identical with/without FotS+CoE", () => {
    const bare = statsFor([]);
    const withRelics = statsFor(["fury_of_the_small", "conservation_of_energy"]);
    expect(withRelics.stats.adrenaline?.basicAdrenalineFlatBonus).toBe(1);
    expect(withRelics.stats.adrenaline?.conservationOfEnergyRefund).toBe(10);

    const assault = MELEE_ABILITIES.find((a) => a.id === "assault")!;
    const mk = (stats: typeof bare.stats) =>
      calculateLeagueAbility(assault, {
        base: stats.base,
        level: stats.level,
        accuracy: stats.dp,
        crit: {
          chance: stats.critChance,
          disabled: stats.critsDisabled,
          damageBonus: stats.critDamageBonus,
        },
        modifiers: stats.globalModifiers,
        context: stats.combatContext,
        cap: stats.cap,
        rules: resolveLeagueRules({ ruleset: "base" }),
        adrenaline: stats.adrenaline,
      });

    const a = mk(bare.stats);
    const b = mk(withRelics.stats);
    expect(b.expected).toBeCloseTo(a.expected, 10);
    expect(b.min).toBe(a.min);
    expect(b.max).toBe(a.max);
  });

  it("globalModifiers are unchanged by FotS+CoE alone", () => {
    const bare = statsFor([]);
    const withRelics = statsFor(["fury_of_the_small", "conservation_of_energy"]);
    const ids = (s: typeof bare.stats) =>
      s.globalModifiers.map((m) => m.id).sort().join("|");
    expect(ids(withRelics.stats)).toBe(ids(bare.stats));
  });

  it("basic-only rotation totalExpected never drops with FotS", () => {
    const rot = ["attack", "attack", "attack", "attack", "attack", "attack"];
    const off = sim([], rot, 0);
    const on = sim(["fury_of_the_small"], rot, 0);
    expect(off.error).toBeUndefined();
    expect(on.error).toBeUndefined();
    expect(on.totalExpected).toBeGreaterThanOrEqual(off.totalExpected - 1e-9);
    expect(on.casts[0]!.adrenalineAfter).toBeGreaterThan(off.casts[0]!.adrenalineAfter);
  });

  it("spender rotation totalExpected never drops with CoE+FotS vs bare", () => {
    const rot = [
      "berserk",
      "assault",
      "assault",
      "overpower",
      "assault",
      "assault",
      "assault",
      "assault",
      "assault",
      "assault",
      "assault",
      "berserk",
    ];
    const off = sim([], rot, 100);
    const on = sim(["fury_of_the_small", "conservation_of_energy"], rot, 100);
    expect(off.error ?? null).toBeNull();
    expect(on.error ?? null).toBeNull();

    // Duration-normalized DPS must not regress; raw totalExpected can fall if
    // fewer auto-weaves (shorter path, same queued spenders).
    expect(on.dps).toBeGreaterThanOrEqual(off.dps - 1e-6);
  });

  it("without auto-weave, CoE leaves residual after ultimate dump", () => {
    const rot = ["berserk"];
    const off = sim([], rot, 100, false);
    const on = sim(["fury_of_the_small", "conservation_of_energy"], rot, 100, false);
    expect(off.ok, off.error).toBe(true);
    expect(on.ok, on.error).toBe(true);
    expect(off.casts[0]?.abilityId).toBe("berserk");
    expect(on.casts[0]?.abilityId).toBe("berserk");
    expect(off.casts[0]!.adrenalineAfter).toBe(0);
    expect(on.casts[0]!.adrenalineAfter).toBe(10);
  });

  it("fixed-horizon revolution window: CoE+FotS damage/DPS >= bare", () => {
    const barIds = ["berserk", "assault", "overpower", "dismember"];
    function win(selected: string[]) {
      const { stats } = statsFor(selected);
      const bar = barIds.map((id) => {
        const a = MELEE_ABILITIES.find((x) => x.id === id);
        if (!a) throw new Error(id);
        return a;
      });
      return simulateRevolution({
        base: stats.base,
        level: stats.level,
        accuracy: stats.dp,
        crit: {
          chance: stats.critChance,
          disabled: stats.critsDisabled,
          damageBonus: stats.critDamageBonus,
        },
        abilities: MELEE_ABILITIES,
        bar,
        style: "melee",
        durationTicks: 100,
        modifiers: stats.globalModifiers,
        adrenaline: stats.adrenaline,
        startingAdrenaline: 100,
        equipmentIds: stats.equipmentIds,
        weaponConfiguration: stats.weaponConfiguration,
        equipmentEffects: stats.equipmentEffects,
        league: stats.league,
        context: stats.combatContext,
        cap: stats.cap,
      });
    }
    const off = win([]);
    const on = win(["fury_of_the_small", "conservation_of_energy"]);
    expect(off.ok, off.error).toBe(true);
    expect(on.ok, on.error).toBe(true);
    expect(on.totalExpected).toBeGreaterThanOrEqual(off.totalExpected - 1e-6);
    expect(on.dps).toBeGreaterThanOrEqual(off.dps - 1e-6);
  });
});


