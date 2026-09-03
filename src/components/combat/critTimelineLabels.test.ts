import { describe, expect, it } from "vitest";
import { resolveAbilityCatalogue } from "@/combat/abilities/catalogue";
import { buildSimulationInputBase, toRevolutionInput } from "@/combat/model";
import { simulateRevolution } from "@/combat/engine/simulation/revolution";
import type { ResolvedEvent } from "@/combat";
import { DEFAULT_LOADOUT, equipInSlot } from "@/components/combat/loadout/model";
import { loadoutStats } from "@/components/combat/loadoutStats";
import { toResolvedCombatModel } from "@/components/combat/toResolvedCombatModel";
import { castCritLabel } from "./revoPanelFormat";
import { eventCritLabel } from "./RotationAnalysis";

const NOW = 1_700_000_000_000;

function magicSummary() {
  let loadout = equipInSlot(DEFAULT_LOADOUT, "twohand", "item:staff-of-light");
  loadout = { ...loadout, style: "magic" };
  const stats = loadoutStats(loadout, { now: NOW });
  const model = toResolvedCombatModel(loadout, { now: NOW }, stats);
  const catalogue = resolveAbilityCatalogue();
  const summary = simulateRevolution(
    toRevolutionInput(buildSimulationInputBase(model, catalogue), {
      bar: [catalogue.byId.get("magic_attack")!],
      style: "magic",
      durationTicks: 90,
    }),
  );
  return { stats, summary };
}

describe("castCritLabel / eventCritLabel (concrete outcomes)", () => {
  it("labels concrete outcomes only", () => {
    expect(
      castCritLabel({ hits: [{ critChance: 0.5, critOutcome: true } as never] } as never),
    ).toBe("Crit");
    expect(
      castCritLabel({ hits: [{ critChance: 0.5, critOutcome: false } as never] } as never),
    ).toBe("No crit");
    expect(
      eventCritLabel({
        damage: { critical: { mode: "expected", chance: 0.5, contribution: 1, outcome: true } },
      } as ResolvedEvent),
    ).toBe("Crit");
    expect(
      eventCritLabel({
        damage: { critical: { mode: "expected", chance: 0.5, contribution: 1, outcome: false } },
      } as ResolvedEvent),
    ).toBe("No crit");
  });
});

describe("revo single-path concrete crit timeline", () => {
  it("materializes Crit/No crit chrome at the 10% base rate without EV wording", () => {
    const { stats, summary } = magicSummary();
    expect(summary.ok).toBe(true);
    expect(stats.critChance).toBeCloseTo(0.1, 10);
    expect(summary.rng?.lanes ?? 1).toBe(1);
    const labels = summary.casts.map((c) => castCritLabel(c.result));
    expect(labels.every((l) => l === "Crit" || l === "No crit")).toBe(true);
    expect(labels.some((l) => l === "Crit")).toBe(true);
    expect(labels.some((l) => l === "No crit")).toBe(true);
    for (const event of summary.events) {
      const label = eventCritLabel(event);
      if (label == null) continue;
      expect(label).toMatch(/^(Crit|No crit)$/);
      expect(label.includes("EV")).toBe(false);
    }
  });

  it("Critual adds 15% to base crit with concrete chrome (128-lane ensemble)", () => {
    let loadout = equipInSlot(DEFAULT_LOADOUT, "twohand", "item:staff-of-light");
    loadout = { ...loadout, style: "magic" };
    const opts = {
      now: NOW,
      blessingPicks: ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos"] as const,
    };
    const stats = loadoutStats(loadout, opts);
    expect(stats.league.blessingIds.has("unholy-critual")).toBe(true);
    expect(stats.critChance).toBeCloseTo(0.25, 10);
    const model = toResolvedCombatModel(loadout, opts, stats);
    const catalogue = resolveAbilityCatalogue();
    const summary = simulateRevolution(
      toRevolutionInput(buildSimulationInputBase(model, catalogue), {
        bar: [catalogue.byId.get("magic_attack")!],
        style: "magic",
        durationTicks: 90,
      }),
    );
    expect(summary.ok).toBe(true);
    expect(summary.rng?.lanes).toBe(128);
    const hits = summary.events.filter((e) => e.family === "hit");
    for (const e of hits) {
      if (!e.damage.critical || e.damage.critical.mode === "none") continue;
      expect(e.damage.critical.outcome === true || e.damage.critical.outcome === false).toBe(true);
      expect(eventCritLabel(e)).toMatch(/^(Crit|No crit)$/);
    }
    expect(Math.max(...hits.map((e) => e.damage.critical?.chance ?? 0))).toBeCloseTo(0.25, 10);
  });
});
