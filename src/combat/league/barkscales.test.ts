import { describe, expect, it } from "vitest";
import { blessingChoice } from "../../league/blessings";
import { barkscalesGraspNote, barkscalesOutcome } from "./barkscales";
import { graspOfGuthixComponent } from "./damage";
import { resolveLeagueRules } from "./ruleset";

/**
 * Barkscales: "Incoming damage is reduced by 10% of your armour value. After
 * Barkscales reduces damage 5 times, unleash a Grasp of Guthix at your
 * attacker's location, which deals poison damage equal to 80-120% of your
 * ability damage in a 3x3 area."
 * (RuneScape Wiki, Equilibrium League/Blessings, verified 2026-08-02.)
 */
const BARKSCALES = blessingChoice(2, "Balance")!.combat;

const league = resolveLeagueRules(
  { ruleset: "equilibrium", blessingPicks: ["Order", "Balance"] },
  { totalArmour: 1_000 },
);

describe("Barkscales without an incoming scenario", () => {
  const outcome = barkscalesOutcome(BARKSCALES, 1_000, 60);

  it("is scenario-dependent, never a calculated zero", () => {
    expect(outcome.support).toBe("scenario-dependent");
    expect(outcome.unavailability).toBe("no-scenario");
    expect(outcome.triggers).toBeNull();
    expect(outcome.qualifyingHits).toBeNull();
    expect(outcome.mitigatedDamage).toBeNull();
  });

  it("names the input the outgoing rotation cannot supply", () => {
    expect(outcome.missingInputs).toEqual(["Incoming qualifying-hit interval"]);
  });

  it("rejects invalid interval and duration without reporting zero damage", () => {
    const badInterval = barkscalesOutcome(BARKSCALES, 1_000, 60, {
      incomingHitIntervalSeconds: Number.NaN,
    });
    expect(badInterval.support).toBe("scenario-dependent");
    expect(badInterval.unavailability).toBe("invalid-interval");
    expect(badInterval.triggers).toBeNull();

    const badDuration = barkscalesOutcome(BARKSCALES, 1_000, -10, {
      incomingHitIntervalSeconds: 6,
    });
    expect(badDuration.unavailability).toBe("invalid-duration");
    expect(badDuration.mitigatedDamage).toBeNull();
  });

  it("still reports the mitigation the blessing provides per hit", () => {
    expect(outcome.perHit).toBe(100);
    expect(outcome.hitsPerTrigger).toBe(5);
  });

  it("produces no Grasp damage, so it cannot enter an outgoing damage total", () => {
    expect(
      graspOfGuthixComponent({
        rules: league,
        triggers: outcome.triggers ?? 0,
        targetsStruck: outcome.targetsStruck,
        base: 1_000,
        level: 99,
        accuracy: 1,
        modifiers: [],
        context: { style: "melee", ruleset: "equilibrium" },
      }),
    ).toBeUndefined();
  });
});

describe("Barkscales with a bounded incoming scenario", () => {
  it("caps the shared area-target scenario to Grasp's 3x3 area", () => {
    const outcome = barkscalesOutcome(BARKSCALES, 1_000, 30, {
      incomingHitIntervalSeconds: 6,
      targetsStruck: 20,
    });
    expect(outcome.targetsStruck).toBe(9);
  });

  it("needs five qualifying reductions for one Grasp", () => {
    // Five hits at 6s over a 30s window: exactly one trigger, counter back to 0.
    const outcome = barkscalesOutcome(BARKSCALES, 1_000, 30, {
      incomingHitIntervalSeconds: 6,
    });
    expect(outcome.support).toBe("modeled");
    expect(outcome.qualifyingHits).toBe(5);
    expect(outcome.triggers).toBe(1);
    expect(outcome.counterRemainder).toBe(0);
    expect(outcome.secondsPerTrigger).toBe(30);
  });

  it("banks the remainder toward the next trigger instead of rounding it up", () => {
    const outcome = barkscalesOutcome(BARKSCALES, 1_000, 60, {
      incomingHitIntervalSeconds: 6,
    });
    expect(outcome.qualifyingHits).toBe(10);
    expect(outcome.triggers).toBe(2);
    const partial = barkscalesOutcome(BARKSCALES, 1_000, 54, { incomingHitIntervalSeconds: 6 });
    expect(partial.qualifyingHits).toBe(9);
    expect(partial.triggers).toBe(1);
    expect(partial.counterRemainder).toBe(4);
  });

  it("changes trigger frequency predictably with the incoming cadence", () => {
    const slow = barkscalesOutcome(BARKSCALES, 1_000, 60, { incomingHitIntervalSeconds: 12 });
    const fast = barkscalesOutcome(BARKSCALES, 1_000, 60, { incomingHitIntervalSeconds: 3 });
    expect(slow.triggers).toBe(1);
    expect(fast.triggers).toBe(4);
    expect(fast.secondsPerTrigger).toBe(15);
  });

  it("scales mitigation with the total armour value, not the block rating", () => {
    expect(barkscalesOutcome(BARKSCALES, 1_000, 60, { incomingHitIntervalSeconds: 6 }).perHit).toBe(
      100,
    );
    expect(barkscalesOutcome(BARKSCALES, 2_430, 60, { incomingHitIntervalSeconds: 6 }).perHit).toBe(
      243,
    );
    expect(
      barkscalesOutcome(BARKSCALES, 1_000, 60, { incomingHitIntervalSeconds: 6 }).mitigatedDamage,
    ).toBe(1_000);
  });

  it("respects poison immunity by striking no targets", () => {
    const immune = barkscalesOutcome(BARKSCALES, 1_000, 60, {
      incomingHitIntervalSeconds: 6,
      poisonImmune: true,
    });
    expect(immune.triggers).toBe(2);
    expect(immune.targetsStruck).toBe(0);
    expect(immune.unavailability).toBe("poison-immune");
    expect(barkscalesGraspNote(immune)).toMatch(/poison-immune/i);
    expect(barkscalesGraspNote(immune)).not.toMatch(/^0 /);
    expect(
      graspOfGuthixComponent({
        rules: league,
        triggers: immune.triggers ?? 0,
        targetsStruck: immune.targetsStruck,
        base: 1_000,
        level: 99,
        accuracy: 1,
        modifiers: [],
        context: { style: "melee", ruleset: "equilibrium" },
      }),
    ).toBeUndefined();
  });

  it("keeps the area target count separate from single-target damage", () => {
    const single = graspOfGuthixComponent({
      rules: league,
      triggers: 2,
      targetsStruck: 1,
      base: 1_000,
      level: 99,
      accuracy: 1,
      modifiers: [],
      context: { style: "melee", ruleset: "equilibrium" },
    })!;
    const area = graspOfGuthixComponent({
      rules: league,
      triggers: 2,
      targetsStruck: 4,
      base: 1_000,
      level: 99,
      accuracy: 1,
      modifiers: [],
      context: { style: "melee", ruleset: "equilibrium" },
    })!;
    // 80-120% of 1,000 averages 1,000 per hit; two triggers on one target = 2,000.
    expect(single.expectedOccurrences).toBe(2);
    expect(single.damage.expected).toBeCloseTo(2_000, 0);
    expect(area.expectedOccurrences).toBe(8);
    expect(area.damage.expected).toBeCloseTo(4 * single.damage.expected, 0);
    // The per-application figure is unchanged by how many targets were struck.
    expect(area.damage.expected / area.expectedOccurrences).toBeCloseTo(
      single.damage.expected / single.expectedOccurrences,
      6,
    );
  });

  it("resolves Grasp as non-critical poison that cannot generate more blessing damage", () => {
    const grasp = graspOfGuthixComponent({
      rules: league,
      triggers: 1,
      targetsStruck: 1,
      base: 1_000,
      level: 99,
      accuracy: 1,
      modifiers: [],
      context: { style: "melee", ruleset: "equilibrium" },
    })!;
    expect(grasp.blessingId).toBe("barkscales");
    expect(grasp.attached).toBe(false);
    expect(grasp.damage.critical?.mode ?? "none").toBe("none");
    expect(grasp.damage.critical?.contribution ?? 0).toBe(0);
  });

  it("lets each Grasp host Big Boned once", () => {
    const combined = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Balance", "Balance"] },
      { totalArmour: 1_000, maximumLife: 10_000 },
    );
    const grasp = graspOfGuthixComponent({
      rules: combined,
      triggers: 1,
      targetsStruck: 1,
      base: 1_000,
      level: 99,
      accuracy: 1,
      modifiers: [],
      context: { style: "melee", ruleset: "equilibrium" },
    })!;

    expect(grasp.damage.expected).toBe(1_500);
    expect(grasp.components).toHaveLength(1);
    expect(grasp.components?.[0]).toMatchObject({
      id: "big-boned",
      attached: true,
      hitCapPolicy: "shared",
      analysis: { blessingId: "big-boned", expectedActivations: 1 },
    });
    expect(grasp.components?.some((component) => component.id === "abyssal-cinders")).toBe(false);
  });

  it("reports nothing at all without the blessing picked", () => {
    const noBarkscales = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Order", "Order"] },
      { totalArmour: 1_000 },
    );
    expect(
      graspOfGuthixComponent({
        rules: noBarkscales,
        triggers: 5,
        targetsStruck: 9,
        base: 1_000,
        level: 99,
        accuracy: 1,
        modifiers: [],
        context: { style: "melee", ruleset: "equilibrium" },
      }),
    ).toBeUndefined();
    expect(barkscalesOutcome(undefined, 1_000, 60, { incomingHitIntervalSeconds: 6 }).perHit).toBe(
      0,
    );
  });
});
