import { describe, expect, it } from "vitest";
import { simulate } from "../simulation/simulate";
import { rotationOf } from "../simulation/contracts";
import { magicInput, baseInput } from "../../test/fixtures/inputs";
import { activeEquipmentEffects } from "../../shared/equipment";
import { resolveLeagueRules } from "../../league/ruleset";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { eventCritLabel } from "@/components/combat/RotationAnalysis";
import { castCritLabel } from "@/components/combat/revoPanelFormat";
import { createStochasticOracle } from "../runtime/stochastic";

/** Pure Unholy Critual (no Abyssal Cinders) so Inferno is parent-crit-gated only. */
const critualOnlyLeague = resolveLeagueRules({
  ruleset: "equilibrium",
  blessingPicks: ["Order", "Order", "Order", "Order", "Chaos"],
});

const MAGIC_ATTACKS_X24 = rotationOf(
  ...Array.from({ length: 24 }, () => "magic_attack" as const),
);

describe("concrete crit path (multi-lane / Critual)", () => {
  it("single-lane oracle bernoulli rate is near p over many hits", () => {
    const p = 0.35;
    const stream = createStochasticOracle({ laneIndex: 0, laneCount: 1, seed: 91 });
    const n = 500;
    const hits = Array.from({ length: n }, () => stream.bernoulli("land:critical:rate", p)).filter(
      Boolean,
    ).length;
    const rate = hits / n;
    // Old stratified midpoint was always 0.5 => all false at p=0.35.
    expect(rate).toBeGreaterThan(0.2);
    expect(rate).toBeLessThan(0.5);
    expect(Math.abs(rate - p)).toBeLessThan(0.08);
  });

  it("multi-lane materializes Crit/No crit with different expected damage at p=0.5", () => {
    const summary = simulate(
      {
        ...magicInput,
        crit: { chance: 0.5 },
        abilities: MAGIC_ABILITIES,
        rotation: rotationOf("magic_attack", "magic_attack", "magic_attack", "magic_attack"),
        horizonTicks: 20,
      },
      { stochasticLanes: 128, stochasticSeed: 42 },
    );
    expect(summary.ok).toBe(true);
    expect(summary.rng?.lanes).toBe(128);
    const hits = summary.events.filter((e) => e.family === "hit" && e.abilityId === "magic_attack");
    expect(hits.length).toBeGreaterThan(0);
    // Representative history is one concrete multi-lane path: every hit has an outcome.
    const withOutcome = hits.filter((e) => e.damage.critical?.outcome !== undefined);
    expect(withOutcome.length).toBe(hits.length);
    const crits = withOutcome.filter((e) => e.damage.critical?.outcome === true);
    const non = withOutcome.filter((e) => e.damage.critical?.outcome === false);
    // One 4-hit path may be all crit or all non-crit; require both labels if both exist.
    for (const event of withOutcome) {
      expect(eventCritLabel(event)).toBe(event.damage.critical?.outcome ? "Crit" : "No crit");
      expect(eventCritLabel(event)).not.toContain("EV");
      if (event.damage.critical?.outcome === true && event.damage.critExpected != null) {
        expect(event.damage.expected).toBe(event.damage.critExpected);
      }
      if (event.damage.critical?.outcome === false && event.damage.critExpected != null) {
        expect(event.damage.expected).toBeLessThan(event.damage.critExpected);
      }
    }
    if (crits.length > 0 && non.length > 0) {
      expect(crits[0]!.damage.expected).toBeGreaterThan(non[0]!.damage.expected);
    }
  });

  it("Inferno only on parent crit (not always); chain terminal No crit; damages differ", () => {
    expect(critualOnlyLeague.blessingIds.has("unholy-critual")).toBe(true);
    expect(critualOnlyLeague.blessingIds.has("abyssal-cinders")).toBe(false);

    // Critual alone does not force ensemble lanes; pin 128 for concrete parent outcomes.
    const summary = simulate(
      {
        ...magicInput,
        crit: { chance: 0.5 },
        league: critualOnlyLeague,
        equipmentEffects: activeEquipmentEffects({
          style: "magic",
          equipmentSlots: { twohand: "item:staff-of-light" },
        }),
        abilities: MAGIC_ABILITIES,
        rotation: MAGIC_ATTACKS_X24,
        horizonTicks: 120,
      },
      { stochasticLanes: 128, stochasticSeed: 21 },
    );
    expect(summary.ok).toBe(true);
    expect(summary.rng?.lanes).toBe(128);

    const parents = summary.events.filter(
      (e) => e.abilityId === "magic_attack" && e.family === "hit",
    );
    const parentBySeq = new Map(parents.map((p) => [p.seq, p]));
    const parentCrits = parents.filter((e) => e.damage.critical?.outcome === true);
    const parentNon = parents.filter((e) => e.damage.critical?.outcome === false);
    expect(parentCrits.length).toBeGreaterThan(0);
    expect(parentNon.length).toBeGreaterThan(0);

    const infernos = summary.events.filter((e) => e.abilityId === "inferno-of-zamorak");
    expect(infernos.length).toBeGreaterThan(0);

    for (const inf of infernos) {
      const parent = parentBySeq.get(inf.derivedFrom ?? -1);
      expect(parent, "Inferno must attach to a magic_attack parent").toBeDefined();
      // Critual path: only parent crits schedule Inferno (Cinders absent).
      expect(parent!.damage.critical?.outcome).toBe(true);
      expect(inf.damage.critical?.outcome === true || inf.damage.critical?.outcome === false).toBe(
        true,
      );
      expect(eventCritLabel(inf)).toBe(inf.damage.critical?.outcome ? "Crit" : "No crit");
    }

    for (const parent of parentNon) {
      const children = infernos.filter((inf) => inf.derivedFrom === parent.seq);
      expect(children).toHaveLength(0);
    }

    const chains = new Map<number, typeof infernos>();
    for (const event of infernos) {
      const key = event.derivedFrom ?? -1;
      const chain = chains.get(key) ?? [];
      chain.push(event);
      chains.set(key, chain);
    }
    for (const chain of chains.values()) {
      expect(chain.at(-1)?.damage.critical?.outcome).toBe(false);
      expect(chain.slice(0, -1).every((event) => event.damage.critical?.outcome === true)).toBe(
        true,
      );
    }

    const critInf = infernos.filter((e) => e.damage.critical?.outcome === true);
    const nonInf = infernos.filter((e) => e.damage.critical?.outcome === false);
    expect(nonInf.length).toBeGreaterThan(0);
    if (critInf.length > 0) {
      expect(critInf[0]!.damage.expected).toBeGreaterThan(nonInf[0]!.damage.expected);
    }

    const zero = simulate(
      {
        ...baseInput,
        abilities: MAGIC_ABILITIES,
        crit: { chance: 0 },
        league: critualOnlyLeague,
        context: { style: "magic", ruleset: "equilibrium" },
        equipmentEffects: activeEquipmentEffects({
          style: "magic",
          equipmentSlots: { twohand: "item:staff-of-light" },
        }),
        rotation: rotationOf("magic_attack", "magic_attack", "magic_attack"),
        horizonTicks: 20,
      },
      { stochasticLanes: 128 },
    );
    expect(zero.ok).toBe(true);
    expect(zero.events.filter((e) => e.abilityId === "inferno-of-zamorak")).toHaveLength(0);
  });

  it("castCritLabel uses outcomes not EV wording", () => {
    expect(
      castCritLabel({
        hits: [{ critChance: 0.5, critOutcome: true } as never],
      } as never),
    ).toBe("Crit");
    expect(
      castCritLabel({
        hits: [{ critChance: 0.5, critOutcome: false } as never],
      } as never),
    ).toBe("No crit");
    expect(
      castCritLabel({
        hits: [
          { critChance: 0.5, critOutcome: true } as never,
          { critChance: 0.5, critOutcome: false } as never,
        ],
      } as never),
    ).toBe("1/2 crit");
    expect(
      castCritLabel({
        hits: [{ critChance: 0.5 } as never],
      } as never),
    ).toBeNull();
  });
});
