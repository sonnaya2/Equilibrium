import { describe, expect, it } from "vitest";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import { necroInput } from "../../test/fixtures/inputs";
import { activeEquipmentEffects } from "../../shared/equipment";
import { buildCandidatePool } from "../../solver/candidatePool";
import { evaluateRevolutionBar } from "../../solver/evaluate";
import { simulateRevolution } from "../simulation/revolution";

/**
 * Death Skulls (Igneous) is a full ST model (supportStatus unset) gated by
 * Kal-Mor / Kal-Zuk. Pool + evaluate must accept it without includePartial.
 */

const kalMor = "item:igneous-kal-mor";
const morEffects = activeEquipmentEffects({ equipmentSlots: { cape: kalMor } });

const necroKalMorSim = {
  ...necroInput,
  weaponConfiguration: "necromancy" as const,
  equipmentIds: [kalMor],
  equipmentEffects: morEffects,
  startingAdrenaline: 100,
};

describe("revo + evaluate death_skulls_igneous with Kal-Mor", () => {
  it("pool includes death_skulls_igneous without includePartial when cape is equipped", () => {
    const pool = buildCandidatePool(NECROMANCY_ABILITIES, "necromancy", {
      equipmentIds: [kalMor],
      passiveIds: morEffects.passiveIds,
    });
    expect(pool.byId.has("death_skulls_igneous")).toBe(true);
    expect(pool.byId.has("death_skulls")).toBe(false);
    expect(pool.byId.get("death_skulls_igneous")?.supportStatus).toBeUndefined();
  });

  it("pool excludes death_skulls_igneous without cape (no includePartial needed to hide it)", () => {
    const pool = buildCandidatePool(NECROMANCY_ABILITIES, "necromancy");
    expect(pool.byId.has("death_skulls")).toBe(true);
    expect(pool.byId.has("death_skulls_igneous")).toBe(false);
  });

  it("simulateRevolution bar with death_skulls_igneous + Kal-Mor casts upgrade schedule", () => {
    const dsIg = NECROMANCY_ABILITIES.find((a) => a.id === "death_skulls_igneous")!;
    const s = simulateRevolution({
      ...necroKalMorSim,
      bar: [dsIg],
      style: "necromancy",
      durationTicks: 20,
    });
    expect(s.ok, s.error).toBe(true);
    expect(s.casts.some((c) => c.abilityId === "death_skulls_igneous")).toBe(true);
    expect(s.casts.every((c) => c.abilityId !== "death_skulls")).toBe(true);
    const events = s.events.filter((e) => e.abilityId === "death_skulls_igneous");
    expect(events).toHaveLength(4);
    expect(events.map((e) => e.tick)).toEqual([0, 2, 4, 6]);
  });

  it("evaluateRevolutionBar scores death_skulls_igneous bar without includePartial", () => {
    const pool = buildCandidatePool(NECROMANCY_ABILITIES, "necromancy", {
      equipmentIds: [kalMor],
      passiveIds: morEffects.passiveIds,
    });
    expect(pool.byId.has("death_skulls_igneous")).toBe(true);

    const evaluation = evaluateRevolutionBar({
      bar: ["death_skulls_igneous"],
      style: "necromancy",
      durationTicks: 30,
      pool,
      sim: necroKalMorSim,
      profileId: "balanced",
      // explicit: full model must not require partial inclusion
      includePartial: false,
    });

    expect(evaluation.ok).toBe(true);
    expect(evaluation.failureReason).toBeUndefined();
    expect(evaluation.summary?.ok).toBe(true);
    expect(evaluation.score).toBeGreaterThan(0);
    expect(evaluation.resolved?.map((a) => a.id)).toEqual(["death_skulls_igneous"]);

    const summary = evaluation.summary!;
    expect(summary.casts.some((c) => c.abilityId === "death_skulls_igneous")).toBe(true);
    expect(summary.casts.every((c) => c.abilityId !== "death_skulls")).toBe(true);
    const events = summary.events.filter((e) => e.abilityId === "death_skulls_igneous");
    expect(events.length).toBeGreaterThanOrEqual(4);
    expect(summary.perAbility.death_skulls_igneous ?? 0).toBeGreaterThan(0);
    expect(summary.totalExpected).toBeGreaterThan(0);
  });

  it("evaluateRevolutionBar rewrites base death_skulls id under Kal-Mor without includePartial", () => {
    const pool = buildCandidatePool(NECROMANCY_ABILITIES, "necromancy", {
      equipmentIds: [kalMor],
      passiveIds: morEffects.passiveIds,
    });

    const evaluation = evaluateRevolutionBar({
      bar: ["death_skulls"],
      style: "necromancy",
      durationTicks: 30,
      pool,
      sim: necroKalMorSim,
      profileId: "balanced",
      includePartial: false,
    });

    expect(evaluation.ok).toBe(true);
    expect(evaluation.failureReason).toBeUndefined();
    expect(evaluation.resolved?.map((a) => a.id)).toEqual(["death_skulls_igneous"]);
    expect(evaluation.summary?.casts.some((c) => c.abilityId === "death_skulls_igneous")).toBe(
      true,
    );
    expect(evaluation.summary?.casts.every((c) => c.abilityId !== "death_skulls")).toBe(true);
    expect(evaluation.score).toBeGreaterThan(0);
  });
});
