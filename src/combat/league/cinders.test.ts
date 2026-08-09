import { describe, expect, it } from "vitest";
import { rotationOf } from "../engine/simulation/contracts";
import { simulate } from "../engine/simulation/simulate";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { baseInput, necroInput, rangedInput } from "../test/fixtures/inputs";
import { vulnerabilityModifier } from "../shared/vulnerability";
import { activeEquipmentEffects } from "../shared/equipment";
import type { ResolvedEvent } from "../engine/runtime/events";
import {
  blessingHitEligibility,
  calculateLeagueAbility,
  resolveLeagueAttachedRawHost,
} from "./damage";
import { resolveLeagueRules } from "./ruleset";

const INFERNO_CHANCE = 0.05;

const cinders = (maximumLife = 0) =>
  resolveLeagueRules(
    { ruleset: "equilibrium", blessingPicks: ["Chaos", "Chaos"] },
    { maximumLife },
  );

const bigBoned = (maximumLife = 15_000) =>
  resolveLeagueRules({ ruleset: "equilibrium", blessingPicks: ["Balance"] }, { maximumLife });

const combined = (maximumLife = 10_000) =>
  resolveLeagueRules(
    { ruleset: "equilibrium", blessingPicks: ["Balance", "Chaos"] },
    { maximumLife },
  );

const ranged = (id: string) => RANGED_ABILITIES.find((ability) => ability.id === id)!;

function components(summary: ReturnType<typeof simulate>, id: string) {
  return summary.events.flatMap((event) =>
    (event.components ?? [])
      .filter((component) => component.id === id)
      .map((component) => ({ event, component })),
  );
}

function expectedActivations(summary: ReturnType<typeof simulate>, id: string): number {
  return components(summary, id).reduce(
    (sum, { component }) => sum + (component.analysis?.expectedActivations ?? 0),
    0,
  );
}

function infernos(summary: ReturnType<typeof simulate>): ResolvedEvent[] {
  return summary.events.filter((event) => event.abilityId === "inferno-of-zamorak");
}

describe("Big Boned and Cinders eligibility", () => {
  const closed = { rider: false, cinders: false, onHit: false } as const;
  const broad = { rider: true, cinders: false, onHit: false } as const;
  const direct = { rider: true, cinders: true, onHit: true } as const;

  it("keeps Cinders narrower than Big Boned", () => {
    expect(blessingHitEligibility({ kind: "player_direct" }, false)).toEqual(direct);
    expect(blessingHitEligibility({ kind: "derived_bounce" }, false)).toEqual(direct);
    for (const kind of [
      "player_dot",
      "player_converted_channel",
      "player_poison",
      "conjure_auto",
      "conjure_poison",
      "conjure_command",
      "equipment_proc",
      "invention_proc",
      "derived_tail",
      "reflected",
    ] as const) {
      expect(blessingHitEligibility({ kind }, false), kind).toEqual(broad);
    }
  });

  it("lets independent blessing hits host Big Boned but closes attached and self-recursive terms", () => {
    for (const detail of ["light-of-saradomin", "inferno-of-zamorak", "grasp-of-guthix"]) {
      expect(blessingHitEligibility({ kind: "blessing", detail }, false), detail).toEqual(broad);
    }
    expect(blessingHitEligibility({ kind: "blessing", detail: "big-boned" }, false)).toEqual(
      closed,
    );
    expect(blessingHitEligibility({ kind: "blessing", detail: "abyssal-cinders" }, false)).toEqual(
      closed,
    );
    expect(blessingHitEligibility({ kind: "player_direct" }, true)).toEqual(closed);
  });
});

describe("host-typed attached damage", () => {
  it("runs both raw terms through the host modifiers exactly once", () => {
    const resolved = resolveLeagueAttachedRawHost({
      rules: combined(),
      source: { kind: "player_direct" },
      abilityBase: 1_000,
      min: 1_000,
      max: 1_000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0, eligible: true },
      modifiers: [vulnerabilityModifier()],
      context: { style: "melee", ruleset: "equilibrium" },
      cap: { cap: 30_000 },
    });

    expect(resolved.hit.expected).toBe(1_815);
    expect(resolved.components.map((component) => component.effectId)).toEqual([
      "big-boned",
      "abyssal-cinders",
    ]);
    expect(resolved.components.map((component) => component.damage.expected)).toEqual([550, 165]);
  });

  it("shares the host cap instead of capping attached terms independently", () => {
    const resolved = resolveLeagueAttachedRawHost({
      rules: combined(),
      source: { kind: "player_direct" },
      abilityBase: 1_000,
      min: 900,
      max: 900,
      level: 99,
      accuracy: 1,
      crit: { chance: 0, eligible: true },
      modifiers: [],
      context: { style: "melee", ruleset: "equilibrium" },
      cap: { cap: 1_000 },
    });

    expect(resolved.hit.expected).toBe(1_000);
    expect(resolved.components.map((component) => component.damage.expected)).toEqual([100, 0]);
    expect(resolved.components.reduce((sum, component) => sum + component.damage.expected, 0)).toBe(
      100,
    );
  });

  it("uses poison provenance and poison modifiers for Big Boned", () => {
    const resolved = resolveLeagueAttachedRawHost({
      rules: bigBoned(10_000),
      source: { kind: "player_poison" },
      abilityBase: 1_000,
      min: 300,
      max: 300,
      level: 99,
      accuracy: 1,
      crit: { chance: 0, eligible: false },
      modifiers: [vulnerabilityModifier()],
      context: { style: "melee", ruleset: "equilibrium", dotKind: "poison" },
    });

    expect(resolved.hit.expected).toBe(880);
    expect(resolved.components[0]?.effectId).toBe("big-boned");
    expect(resolved.components[0]?.damage.expected).toBe(550);
  });
});

describe("Cinders direct-hit rolls", () => {
  it.each([
    ["attack", baseInput, 1],
    ["greater_ricochet", rangedInput, 7],
    ["rapid_fire", { ...rangedInput, startingAdrenaline: 100 }, 8],
  ] as const)("creates one attached term and one Inferno roll per %s hit", (id, input, hits) => {
    const summary = simulate({
      ...input,
      league: cinders(),
      context: { style: id === "attack" ? "melee" : "ranged", ruleset: "equilibrium" },
      rotation: rotationOf(id),
    });

    expect(expectedActivations(summary, "abyssal-cinders")).toBe(hits);
    expect(
      summary.analysis.byEffect.find((effect) => effect.id === "inferno-of-zamorak")
        ?.expectedActivations,
    ).toBeCloseTo(hits * INFERNO_CHANCE, 1);
    for (const event of infernos(summary)) {
      expect(event.occurrenceModel).toBeUndefined();
      expect(event.expectedOccurrences).toBe(1);
      expect(event.expectedActivations).toBe(1);
      expect(event.expectedSeparateHits).toBe(1);
    }
    expect(summary.events.some((event) => event.abilityId === "abyssal-cinders")).toBe(false);
  });

  it("excludes damage-over-time ticks while Big Boned remains attached", () => {
    const dismember = MELEE_ABILITIES.find((ability) => ability.id === "dismember")!;
    const summary = simulate({
      ...baseInput,
      league: combined(15_000),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("dismember"),
    });

    expect(expectedActivations(summary, "abyssal-cinders")).toBe(0);
    expect(infernos(summary)).toHaveLength(0);
    expect(expectedActivations(summary, "big-boned")).toBe(dismember.hits.length);
  });

  it("keeps Inferno bounded and lets it host Big Boned once", () => {
    const summary = simulate({
      ...rangedInput,
      league: combined(15_000),
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });

    expect(
      summary.analysis.byEffect.find((effect) => effect.id === "inferno-of-zamorak")
        ?.expectedActivations,
    ).toBeCloseTo(7 * INFERNO_CHANCE, 1);
    for (const event of infernos(summary)) {
      expect(event).toMatchObject({
        attached: false,
        procEligible: false,
        recursionAllowed: false,
      });
      expect(event.occurrenceModel).toBeUndefined();
      expect(event.expectedOccurrences).toBe(1);
      expect(event.expectedActivations).toBe(1);
      expect(event.expectedSeparateHits).toBe(1);
      expect(event.components?.map((component) => component.id)).toEqual(["big-boned"]);
      expect(event.components?.some((component) => component.id === "abyssal-cinders")).toBe(false);
    }
  });

  it("agrees with the Quick calculator on direct-hit multiplicity", () => {
    const rules = cinders();
    const quick = calculateLeagueAbility(ranged("greater_ricochet"), {
      base: 1_000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      context: { style: "ranged", ruleset: "equilibrium" },
      rules,
    });
    const quickCinders = quick.leagueContributions.filter(
      (component) => component.effectId === "abyssal-cinders",
    );
    const quickInfernos = quick.leagueContributions.filter(
      (component) => component.effectId === "inferno-of-zamorak",
    );

    expect(quickCinders).toHaveLength(7);
    expect(quickInfernos).toHaveLength(7);
    expect(
      quickInfernos.reduce((sum, component) => sum + component.expectedActivations, 0),
    ).toBeCloseTo(7 * INFERNO_CHANCE, 12);
  });

  it("attaches once to direct derived bounces without reopening on Inferno", () => {
    const summary = simulate({
      ...necroInput,
      league: combined(),
      startingAdrenaline: 100,
      context: { style: "necromancy", ruleset: "equilibrium" },
      rotation: rotationOf("death_skulls"),
    });
    const skulls = summary.events.filter((event) => event.abilityId === "death_skulls");

    expect(skulls).toHaveLength(3);
    expect(skulls.map((event) => event.provenance.kind)).toEqual([
      "player_direct",
      "derived_bounce",
      "derived_bounce",
    ]);
    expect(
      skulls.every(
        (event) =>
          event.components?.filter((component) => component.id === "big-boned").length === 1 &&
          event.components?.filter((component) => component.id === "abyssal-cinders").length === 1,
      ),
    ).toBe(true);
    expect(
      summary.analysis.byEffect.find((effect) => effect.id === "inferno-of-zamorak")
        ?.expectedActivations,
    ).toBeCloseTo(3 * INFERNO_CHANCE, 1);
    expect(infernos(summary).every((event) => event.components?.length === 1)).toBe(true);
    expect(infernos(summary).every((event) => event.components?.[0]?.id === "big-boned")).toBe(
      true,
    );
  });
});

describe("Big Boned source composition", () => {
  it("appears as attached analysis components, never queue events", () => {
    const summary = simulate({
      ...rangedInput,
      league: bigBoned(),
      crit: { chance: 0.2 },
      context: { style: "ranged", ruleset: "equilibrium" },
      rotation: rotationOf("greater_ricochet"),
    });
    const riders = components(summary, "big-boned");

    expect(riders).toHaveLength(7);
    expect(summary.events.some((event) => event.abilityId === "big-boned")).toBe(false);
    expect(riders.every(({ component }) => component.hitCapPolicy === "shared")).toBe(true);
    expect(riders.every(({ component }) => component.damage.expected > 750)).toBe(true);
    expect(summary.analysis.byEffect.find((row) => row.id === "big-boned")?.dotDamage).toBe(0);
  });

  it("attaches to Crackling and Aftershock without adding proc events", () => {
    const summary = simulate({
      ...baseInput,
      league: bigBoned(),
      crit: { chance: 0 },
      context: { style: "melee", ruleset: "equilibrium" },
      procs: { cracklingRank: 4, aftershockRank: 1 },
      base: 50_000,
      cap: { cap: 30_000, bypass: true },
      rotation: rotationOf("attack"),
    });
    const procs = summary.events.filter(
      (event) => event.abilityId === "crackling" || event.abilityId === "aftershock",
    );

    expect(procs.length).toBeGreaterThan(0);
    expect(
      procs.every((event) => event.components?.some((component) => component.id === "big-boned")),
    ).toBe(true);
    expect(summary.events.some((event) => event.abilityId === "big-boned")).toBe(false);
  });

  it("attaches to equipment-proc hosts without opening Cinders rolls", () => {
    const rules = combined();
    const parasiteSummary = simulate({
      ...baseInput,
      league: rules,
      context: { style: "melee", ruleset: "equilibrium" },
      equipmentEffects: {
        ...activeEquipmentEffects({ style: "melee" }),
        passiveIds: ["abyssal-parasite"],
      },
      rotation: rotationOf("attack"),
    });
    const parasite = parasiteSummary.events.filter(
      (event) => event.abilityId === "abyssal_parasite",
    );
    const punctureSummary = simulate({
      ...rangedInput,
      league: rules,
      context: { style: "ranged", ruleset: "equilibrium" },
      ammo: "splintering",
      rotation: rotationOf("ranged_attack"),
    });
    const puncture = punctureSummary.events.filter((event) => event.abilityId === "puncture");

    for (const events of [parasite, puncture]) {
      expect(events.length).toBeGreaterThan(0);
      expect(
        events.every(
          (event) =>
            event.components?.filter((component) => component.id === "big-boned").length === 1,
        ),
      ).toBe(true);
      expect(
        events.some((event) =>
          event.components?.some((component) => component.id === "abyssal-cinders"),
        ),
      ).toBe(false);
    }
    expect(
      parasiteSummary.analysis.byEffect.find((effect) => effect.id === "inferno-of-zamorak")
        ?.expectedActivations,
    ).toBeCloseTo(INFERNO_CHANCE, 1);
    expect(
      punctureSummary.analysis.byEffect.find((effect) => effect.id === "inferno-of-zamorak")
        ?.expectedActivations,
    ).toBeCloseTo(INFERNO_CHANCE, 1);
  });
});

describe("base ruleset", () => {
  it("does not change the event graph or totals", () => {
    const ordinary = simulate({ ...rangedInput, rotation: rotationOf("greater_ricochet") });
    const base = simulate({
      ...rangedInput,
      league: resolveLeagueRules({ ruleset: "base" }),
      rotation: rotationOf("greater_ricochet"),
    });

    expect(base.totalExpected).toBe(ordinary.totalExpected);
    expect(base.events.map((event) => event.abilityId)).toEqual(
      ordinary.events.map((event) => event.abilityId),
    );
  });
});
