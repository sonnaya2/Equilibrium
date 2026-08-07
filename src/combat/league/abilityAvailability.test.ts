import { describe, expect, it } from "vitest";
import { buildCandidatePool } from "../solver/candidatePool";
import { validateBarEligibility } from "../solver/eligibility";
import { resolveAbilityCastAvailability } from "../shared/requirements";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { NECROMANCY_ABILITIES } from "../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { resolveLeagueRules } from "./ruleset";

const higherPower = resolveLeagueRules({
  ruleset: "equilibrium",
  blessingPicks: ["Order", "Order", "Order", "Order"],
});

const baseRules = resolveLeagueRules({ ruleset: "base" });

const restrictedAbilities = [
  [MELEE_ABILITIES, "melee", "berserk"],
  [RANGED_ABILITIES, "ranged", "deaths_swiftness"],
  [RANGED_ABILITIES, "ranged", "greater_deaths_swiftness"],
  [NECROMANCY_ABILITIES, "necromancy", "living_death"],
  [MAGIC_ABILITIES, "magic", "sunshine"],
  [MAGIC_ABILITIES, "magic", "greater_sunshine"],
] as const;

describe("Higher Power ability availability", () => {
  it("blocks each base and replacement ultimate through the shared cast gate", () => {
    for (const [catalogue, , id] of restrictedAbilities) {
      const ability = catalogue.find((entry) => entry.id === id);
      expect(ability, id).toBeDefined();
      if (!ability) continue;

      expect(resolveAbilityCastAvailability(ability, { league: higherPower })).toEqual({
        available: false,
        reason: "league-restriction",
        message: "Higher Power removes Berserk, Death's Swiftness, Living Death, and Sunshine",
      });
      expect(resolveAbilityCastAvailability(ability, { league: baseRules })).toEqual({
        available: true,
      });
    }
  });

  it("removes restricted abilities from solver pools and reports persisted bars", () => {
    for (const [catalogue, style, id] of restrictedAbilities) {
      const pool = buildCandidatePool(catalogue, style, {
        includeBasicAttacks: true,
        includeOffGcd: true,
        includePartial: true,
        league: higherPower,
      });
      expect(pool.ids, `${style}:${id}`).not.toContain(id);
    }

    const unrestrictedPool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      includePartial: true,
    });
    expect(unrestrictedPool.ids).toContain("berserk");
    expect(
      validateBarEligibility(["berserk"], unrestrictedPool, {
        skipSizeBounds: true,
        league: higherPower,
      }),
    ).toEqual([
      expect.objectContaining({
        abilityId: "berserk",
        code: "league-restriction",
      }),
    ]);
  });
});
