import { describe, expect, it } from "vitest";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { SPIRIT_AUTO_ABILITY_ID } from "../../styles/necromancy/conjures";
import { necroInput } from "../../test/fixtures/inputs";
import { abilityById } from "../../test/helpers/summary";
import { simulateRevolution } from "../simulation/revolution";
import { buildCandidatePool } from "../../solver/candidatePool";
import { evaluateRevolutionBar } from "../../solver/evaluate";

/**
 * Conduit gate (wiki Conjuration): conjure_* needs weaponConfiguration "necromancy".
 * meetsWeaponRequirement treats undefined as unrestricted (engine tests); any set
 * shape other than "necromancy" permanently blocks conjures, so revo falls through
 * to necromancy_basic without summoning even when the ability sits on the bar.
 */

const skeleton = abilityById(NECROMANCY_ABILITIES, "conjure_skeleton_warrior");
const army = abilityById(NECROMANCY_ABILITIES, "conjure_undead_army");
const touch = abilityById(NECROMANCY_ABILITIES, "touch_of_death");
const soulSap = abilityById(NECROMANCY_ABILITIES, "soul_sap");

const necroRevoBase = {
  ...necroInput,
  // Real loadouts with a conduit report "necromancy"; required for conjure casts.
  weaponConfiguration: "necromancy" as const,
  style: "necromancy" as const,
};

function conjureAutoEvents(summary: { events: readonly { family: string; abilityId: string }[] }) {
  return summary.events.filter((e) => e.family === "conjureAuto");
}

describe("revo + evaluate summon conjures end-to-end", () => {
  it("simulateRevolution casts conjure_skeleton_warrior on bar and spirit autos deal damage", () => {
    // Horizon covers first auto (cast+7) and several intervals (5 ticks).
    const durationTicks = 60;
    const s = simulateRevolution({
      ...necroRevoBase,
      bar: [skeleton, touch, soulSap],
      durationTicks,
    });

    expect(s.ok).toBe(true);
    expect(s.error).toBeUndefined();

    const conjureCasts = s.casts.filter((c) => c.abilityId === "conjure_skeleton_warrior");
    expect(conjureCasts.length).toBeGreaterThanOrEqual(1);
    expect(conjureCasts[0]!.tick).toBe(0);

    const autos = conjureAutoEvents(s);
    expect(autos.length).toBeGreaterThan(0);
    expect(autos.every((e) => e.abilityId === SPIRIT_AUTO_ABILITY_ID.skeleton_warrior)).toBe(true);

    const spiritDamage = s.perAbility[SPIRIT_AUTO_ABILITY_ID.skeleton_warrior] ?? 0;
    expect(spiritDamage).toBeGreaterThan(0);
    expect(s.totalExpected).toBeGreaterThan(0);
  });

  it("simulateRevolution with Undead Army on bar summons three spirit auto tracks", () => {
    const s = simulateRevolution({
      ...necroRevoBase,
      bar: [army, touch, soulSap],
      durationTicks: 60,
    });

    expect(s.ok).toBe(true);
    expect(s.casts.some((c) => c.abilityId === "conjure_undead_army")).toBe(true);

    const autos = conjureAutoEvents(s);
    expect(autos.length).toBeGreaterThan(0);

    expect(s.perAbility[SPIRIT_AUTO_ABILITY_ID.skeleton_warrior] ?? 0).toBeGreaterThan(0);
    expect(s.perAbility[SPIRIT_AUTO_ABILITY_ID.vengeful_ghost] ?? 0).toBeGreaterThan(0);
    expect(s.perAbility[SPIRIT_AUTO_ABILITY_ID.putrid_zombie] ?? 0).toBeGreaterThan(0);
    expect(s.totalExpected).toBeGreaterThan(0);
  });

  it("weaponConfiguration other than necromancy blocks conjures on the bar (conduit)", () => {
    const s = simulateRevolution({
      ...necroInput,
      weaponConfiguration: "shield",
      style: "necromancy",
      bar: [skeleton, touch, soulSap],
      durationTicks: 30,
    });

    expect(s.ok).toBe(true);
    expect(s.casts.some((c) => c.abilityId === "conjure_skeleton_warrior")).toBe(false);
    expect(conjureAutoEvents(s)).toHaveLength(0);
    expect(s.perAbility[SPIRIT_AUTO_ABILITY_ID.skeleton_warrior] ?? 0).toBe(0);
  });

  it("evaluateRevolutionBar scores a skeleton conjure bar with spirit damage", () => {
    const pool = buildCandidatePool(NECROMANCY_ABILITIES, "necromancy", {
      weaponConfiguration: "necromancy",
    });
    expect(pool.byId.has("conjure_skeleton_warrior")).toBe(true);

    const evaluation = evaluateRevolutionBar({
      bar: ["conjure_skeleton_warrior", "touch_of_death", "soul_sap"],
      style: "necromancy",
      durationTicks: 60,
      pool,
      sim: {
        ...necroInput,
        weaponConfiguration: "necromancy",
      },
      profileId: "balanced",
    });

    expect(evaluation.ok).toBe(true);
    expect(evaluation.failureReason).toBeUndefined();
    expect(evaluation.summary?.ok).toBe(true);
    expect(evaluation.score).toBeGreaterThan(0);

    const summary = evaluation.summary!;
    expect(summary.casts.some((c) => c.abilityId === "conjure_skeleton_warrior")).toBe(true);
    expect(conjureAutoEvents(summary).length).toBeGreaterThan(0);
    expect(summary.perAbility[SPIRIT_AUTO_ABILITY_ID.skeleton_warrior] ?? 0).toBeGreaterThan(0);
    expect(summary.totalExpected).toBeGreaterThan(0);
  });

  it("evaluateRevolutionBar scores an Undead Army bar", () => {
    const pool = buildCandidatePool(NECROMANCY_ABILITIES, "necromancy", {
      weaponConfiguration: "necromancy",
    });
    expect(pool.byId.has("conjure_undead_army")).toBe(true);

    const evaluation = evaluateRevolutionBar({
      bar: ["conjure_undead_army", "touch_of_death", "soul_sap"],
      style: "necromancy",
      durationTicks: 60,
      pool,
      sim: {
        ...necroInput,
        weaponConfiguration: "necromancy",
      },
      profileId: "balanced",
    });

    expect(evaluation.ok).toBe(true);
    expect(evaluation.summary?.ok).toBe(true);
    expect(evaluation.score).toBeGreaterThan(0);

    const summary = evaluation.summary!;
    expect(summary.casts.some((c) => c.abilityId === "conjure_undead_army")).toBe(true);
    expect(summary.perAbility[SPIRIT_AUTO_ABILITY_ID.skeleton_warrior] ?? 0).toBeGreaterThan(0);
    expect(summary.perAbility[SPIRIT_AUTO_ABILITY_ID.vengeful_ghost] ?? 0).toBeGreaterThan(0);
    expect(summary.perAbility[SPIRIT_AUTO_ABILITY_ID.putrid_zombie] ?? 0).toBeGreaterThan(0);
  });
});
