import { describe, expect, it } from "vitest";
import { DEFAULT_LOADOUT, withArchaeologySelection, normalizeLoadout, withLoadoutBuffs } from "../../components/combat/loadout/model";
import { loadoutStats } from "../../components/combat/loadoutStats";
import { toggleArchaeologyRelic, sanitizeArchaeologyState } from "./archaeologyRelics";
import { simulate } from "../engine/simulation/simulate";
import { rotationOf } from "../engine/simulation/contracts";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { unlockedRegions, emptyBuild, toggleElective } from "../../league";

describe("UI-exact path debug", () => {
  it("toggle FotS like ArchPanel", () => {
    let ids = toggleArchaeologyRelic({
      relicId: "fury_of_the_small",
      selectedIds: [],
      energyCap: 500,
    });
    expect(ids).toEqual(["fury_of_the_small"]);
    let loadout = withArchaeologySelection(DEFAULT_LOADOUT, ids, 500);
    // useLoadout always normalizes
    loadout = normalizeLoadout(loadout);
    console.log("after normalize", JSON.stringify(loadout.archaeology), loadout.buffs.furyOfTheSmall);

    // sanitize like ArchPanel useEffect with base regions only
    const regions = unlockedRegions(emptyBuild());
    console.log("base regions", regions);
    const sanitized = sanitizeArchaeologyState(loadout.archaeology, regions);
    console.log("sanitized", sanitized);

    // With kandarin (FotS required region - does resolve gate?)
    const withKand = unlockedRegions(toggleElective(emptyBuild(), "kandarin"));
    console.log("with kandarin", withKand);

    const statsBare = loadoutStats(loadout, { unlockedRegions: regions as any });
    const statsKand = loadoutStats(loadout, { unlockedRegions: withKand as any });
    console.log("stats bare adren", statsBare.adrenaline);
    console.log("stats kand adren", statsKand.adrenaline);

    expect(statsBare.adrenaline?.basicAdrenalineFlatBonus).toBe(1);
    expect(statsKand.adrenaline?.basicAdrenalineFlatBonus).toBe(1);

    const attack = MELEE_ABILITIES.find(a => a.id === "attack")!;
    const sum = simulate({
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: MELEE_ABILITIES,
      rotation: rotationOf("attack"),
      startingAdrenaline: 0,
      adrenaline: statsBare.adrenaline,
    });
    console.log("attack adren after", sum.casts[0]?.adrenalineAfter, "gained", sum.casts[0]?.adrenalineGained);
    expect(sum.casts[0]!.adrenalineAfter).toBe(10);
  });
});
