/**
 * Temp scout: default-melee revolution DPM x blessing packs x bars.
 * Delete after scoring.
 */
import { describe, expect, it } from "vitest";
import { createSavedSetupCollection } from "../components/combat/loadout/savedSetups";
import { resolveLoadoutCombat } from "../components/combat/toResolvedCombatModel";
import { buildSimulationInputBase } from "./model/simulationBase";
import {
  resolveAbilityCatalogue,
  resolveAbilitySpecsFromCatalogue,
} from "./abilities/catalogue";
import { simulateRevolution } from "./engine/simulation/revolution";
import { resolveLeagueRules } from "./league/ruleset";
import type { BlessingPath } from "@/league/blessings";
import { TICK_SECONDS } from "./core/ticks";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const BARS: Record<string, string[]> = {
  high_adren: [
    "berserk",
    "assault",
    "greater_flurry",
    "flurry",
    "hurricane",
    "overpower",
    "slaughter",
    "dismember",
    "slice",
  ],
  igneous: [
    "berserk",
    "igneous_showdown",
    "overpower_igneous",
    "assault",
    "greater_flurry",
    "hurricane",
    "overpower",
    "slaughter",
    "dismember",
    "slice",
  ],
  chaos_bleed: [
    "berserk",
    "chaos_roar",
    "slaughter",
    "massacre",
    "assault",
    "hurricane",
    "dismember",
    "greater_flurry",
    "slice",
  ],
};

const BLESS: Record<string, BlessingPath[]> = {
  none: [],
  chaos6: ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"],
  balance6: ["Balance", "Balance", "Balance", "Balance", "Balance", "Balance"],
  order6: ["Order", "Order", "Order", "Order", "Order", "Order"],
  // Big Boned + Chaos damage stack (Cinders / Rampage / Havoc / Critual / Perfidious)
  bb_chaos_stack: ["Balance", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"],
  // Cinders first path then BB-ish mid is impossible for BB (T1 only); try Chaos lead + Order Higher Power
  chaos_higher_power: ["Chaos", "Chaos", "Chaos", "Order", "Chaos", "Chaos"],
  // Order Sacred Fervor / Higher Power heavy for revo CD
  order_then_chaos_dps: ["Order", "Order", "Order", "Chaos", "Chaos", "Chaos"],
  // True Eq path mix (3 paths early) + Chaos late
  true_eq_chaos: ["Order", "Balance", "Chaos", "Chaos", "Chaos", "Chaos"],
};

function dpm(total: number, ticks: number) {
  const seconds = ticks * TICK_SECONDS;
  return seconds > 0 ? (total / seconds) * 60 : 0;
}

type Row = {
  variant: string;
  bar: string;
  horizon: number;
  totalExpected: number | null;
  DPM: number | null;
  ok: boolean;
  notes: string;
  cards: string;
  barIds: string;
  casts: number;
  ticks: number;
};

describe("melee revo dpm score (temp)", () => {
  it("scores default-melee x bars x blessings", () => {
    const col = createSavedSetupCollection();
    const setup = col.setups.find((s) => s.id === "default-melee");
    expect(setup, "default-melee").toBeDefined();
    if (!setup) return;

    const horizons = [100, 500] as const;
    const rows: Row[] = [];

    for (const [variant, picks] of Object.entries(BLESS)) {
      const league = resolveLeagueRules({
        ruleset: picks.length ? "equilibrium" : "base",
        blessingPicks: picks,
      });
      const cards = league.blessings.map((b) => b.id).join(",");

      let model;
      try {
        ({ model } = resolveLoadoutCombat(setup.loadout, {
          blessingPicks: picks.length ? picks : undefined,
          ruleset: picks.length ? "equilibrium" : "base",
          relics: [],
          unlockedRegions: [],
        }));
      } catch (e) {
        for (const barName of Object.keys(BARS)) {
          for (const horizon of horizons) {
            rows.push({
              variant,
              bar: barName,
              horizon,
              totalExpected: null,
              DPM: null,
              ok: false,
              notes: `resolve: ${e instanceof Error ? e.message : String(e)}`,
              cards,
              barIds: "",
              casts: 0,
              ticks: 0,
            });
          }
        }
        continue;
      }

      const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
      const base = buildSimulationInputBase(model, catalogue);

      for (const [barName, barWanted] of Object.entries(BARS)) {
        const available = barWanted.filter((id) => catalogue.byId.has(id));
        const skipped = barWanted.filter((id) => !catalogue.byId.has(id));
        if (available.length === 0) {
          for (const horizon of horizons) {
            rows.push({
              variant,
              bar: barName,
              horizon,
              totalExpected: null,
              DPM: null,
              ok: false,
              notes: `no bar ids; missing=${skipped.join(",")}`,
              cards,
              barIds: "",
              casts: 0,
              ticks: 0,
            });
          }
          continue;
        }
        const bar = resolveAbilitySpecsFromCatalogue(catalogue, available);
        const skipNote = skipped.length ? `skipped=${skipped.join(",")}` : "";

        for (const horizon of horizons) {
          try {
            const s = simulateRevolution({
              ...base,
              bar,
              style: "melee",
              durationTicks: horizon,
              startingAdrenaline: 100,
            });
            rows.push({
              variant,
              bar: barName,
              horizon,
              totalExpected: Math.round(s.totalExpected * 100) / 100,
              DPM: Math.round(dpm(s.totalExpected, s.ticks)),
              ok: s.ok === true && !s.error,
              notes: [s.error ?? "", skipNote].filter(Boolean).join("; "),
              cards,
              barIds: available.join(">"),
              casts: s.casts.length,
              ticks: s.ticks,
            });
          } catch (e) {
            rows.push({
              variant,
              bar: barName,
              horizon,
              totalExpected: null,
              DPM: null,
              ok: false,
              notes: `sim: ${e instanceof Error ? e.message : String(e)}; ${skipNote}`,
              cards,
              barIds: available.join(">"),
              casts: 0,
              ticks: 0,
            });
          }
        }
      }
    }

    rows.sort((a, b) => (b.DPM ?? 0) - (a.DPM ?? 0));

    const outPath = join(process.cwd(), "src/combat/_meleeRevoDpmScore.out.json");
    writeFileSync(outPath, JSON.stringify(rows, null, 2), "utf8");

    // Compact table for vitest console
    const header =
      "variant | bar | horizon | totalExpected | DPM | ok | notes | cards";
    const lines = rows.map(
      (r) =>
        `${r.variant} | ${r.bar} | ${r.horizon} | ${r.totalExpected ?? "-"} | ${r.DPM ?? "-"} | ${r.ok} | ${r.notes || "-"} | ${r.cards}`,
    );
    console.log(["", header, ...lines, "", `wrote ${outPath}`].join("\n"));

    const best = rows.find((r) => typeof r.DPM === "number" && r.ok);
    expect(best?.DPM).toBeGreaterThan(0);
  }, 300_000);
});
