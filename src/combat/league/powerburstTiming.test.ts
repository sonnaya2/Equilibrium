import { describe, expect, it } from "vitest";
import { simulate } from "../engine/simulation/simulate";
import { rotationOf } from "../engine/simulation/contracts";
import { POWERBURST_DURATION_MS } from "../core/lifePoints";
import { TICK_SECONDS } from "../core/ticks";
import { baseInput } from "../test/fixtures/inputs";
import { leagueDamageComponents } from "./damage";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { resolveLeagueRules, resolveMaximumLife } from "./ruleset";
import { serializeLeague, reviveLeague } from "../solver/worker/revive";
import { powerburstRemainingTicks } from "@/components/combat/loadoutStats";

const attack = MELEE_ABILITIES.find((ability) => ability.id === "attack")!;

const bigBoned = (derived: { maximumLife?: number; powerburstUntilTick?: number }) =>
  resolveLeagueRules(
    { ruleset: "equilibrium", blessingPicks: ["Balance"] },
    { includeBigBonedOutgoingDamage: true, ...derived },
  );

function bigBonedExpected(rules: ReturnType<typeof resolveLeagueRules>, landTick: number): number {
  const components = leagueDamageComponents({
    rules,
    ability: attack,
    hitIndex: 0,
    source: "direct",
    landTick,
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    modifiers: [],
    context: { style: "melee", ruleset: "equilibrium" },
  });
  return components.find((c) => c.effectId === "big-boned")?.damage.expected ?? 0;
}

describe("Powerburst max-life window for Big Boned", () => {
  it("uses doubled maximum life for hits before expiry", () => {
    const rules = bigBoned({ maximumLife: 10_000, powerburstUntilTick: 10 });
    expect(resolveMaximumLife(rules, 0)).toBe(20_000);
    expect(resolveMaximumLife(rules, 9)).toBe(20_000);
    // 5% of doubled max
    expect(bigBonedExpected(rules, 0)).toBe(1_000);
    expect(bigBonedExpected(rules, 9)).toBe(1_000);
  });

  it("uses normal maximum life for hits at or after the exclusive until-tick", () => {
    const rules = bigBoned({ maximumLife: 10_000, powerburstUntilTick: 10 });
    expect(resolveMaximumLife(rules, 10)).toBe(10_000);
    expect(resolveMaximumLife(rules, 50)).toBe(10_000);
    expect(bigBonedExpected(rules, 10)).toBe(500);
    expect(bigBonedExpected(rules, 50)).toBe(500);
  });

  it("does not preserve Powerburst for a 60s revo / 300s horizon", () => {
    // Full duration freeze at request: 6s = 10 ticks remaining.
    const until = powerburstRemainingTicks(Date.now() + POWERBURST_DURATION_MS, Date.now());
    expect(until).toBe(Math.ceil(POWERBURST_DURATION_MS / (TICK_SECONDS * 1000)));
    expect(until).toBe(10);

    const rules = bigBoned({ maximumLife: 10_000, powerburstUntilTick: until });
    // Early land tick (within 6s / 10-tick window) is doubled; a 60s or 300s
    // revolution horizon must not keep that boost for late hits.
    const early = simulate({
      ...baseInput,
      league: rules,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const earlyBb = early.events.find((e) => e.abilityId === "big-boned");
    expect(earlyBb?.damage.expected).toBe(1_000);
    expect(earlyBb?.tick).toBeLessThan(until);

    // Hits scheduled well past the 10-tick window (late revo / 300s solver).
    expect(resolveMaximumLife(rules, 100)).toBe(10_000);
    expect(resolveMaximumLife(rules, secondsToTicksSafe(60))).toBe(10_000);
    expect(resolveMaximumLife(rules, 500)).toBe(10_000); // ~300s
    expect(bigBonedExpected(rules, 100)).toBe(500);
    expect(bigBonedExpected(rules, 500)).toBe(500);
  });

  it("treats powerburstUntilTick 0 as inactive for the whole run", () => {
    const rules = bigBoned({ maximumLife: 12_000, powerburstUntilTick: 0 });
    expect(resolveMaximumLife(rules, 0)).toBe(12_000);
    expect(bigBonedExpected(rules, 0)).toBe(600);
  });

  it("serializes and revives the until-tick frozen once per request", () => {
    const live = bigBoned({ maximumLife: 15_000, powerburstUntilTick: 7 });
    const wire = serializeLeague(live);
    expect(wire.powerburstUntilTick).toBe(7);
    expect(wire.maximumLife).toBe(15_000);

    const revived = reviveLeague(wire);
    expect(revived.powerburstUntilTick).toBe(7);
    expect(revived.maximumLife).toBe(15_000);
    expect(resolveMaximumLife(revived, 6)).toBe(30_000);
    expect(resolveMaximumLife(revived, 7)).toBe(15_000);

    // Round-trip again without re-sampling wall clock.
    const again = serializeLeague(revived);
    expect(again.powerburstUntilTick).toBe(7);
  });
});

describe("powerburstRemainingTicks", () => {
  it("ceils partial remaining ms to at least one tick", () => {
    expect(powerburstRemainingTicks(1_000, 900)).toBe(1); // 100ms left
    expect(powerburstRemainingTicks(1_600, 1_000)).toBe(1); // 600ms = 1 tick
    expect(powerburstRemainingTicks(1_601, 1_000)).toBe(2); // 601ms -> 2
  });

  it("returns 0 when inactive or expired", () => {
    expect(powerburstRemainingTicks(null, 1_000)).toBe(0);
    expect(powerburstRemainingTicks(1_000, 1_000)).toBe(0);
    expect(powerburstRemainingTicks(500, 1_000)).toBe(0);
  });

  it("maps a full 6s window to 10 ticks", () => {
    const now = 50_000;
    expect(powerburstRemainingTicks(now + POWERBURST_DURATION_MS, now)).toBe(10);
  });
});

function secondsToTicksSafe(seconds: number): number {
  return Math.round(seconds / TICK_SECONDS);
}
