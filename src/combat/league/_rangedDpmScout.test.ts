import { describe, expect, it } from "vitest";
import { createSavedSetupCollection } from "../../components/combat/loadout/savedSetups";
import { resolveLoadoutCombat } from "../../components/combat/toResolvedCombatModel";
import { buildSimulationInputBase, toRevolutionInput } from "../model/simulationBase";
import { resolveAbilityCatalogue, resolveAbilitySpecsFromCatalogue } from "../abilities/catalogue";
import { simulateRevolution } from "../engine/simulation/revolution";
import { resolveLeagueRules } from "../league/ruleset";
import type { BlessingPath } from "@/league/blessings";
import { TICK_SECONDS } from "../core/ticks";
import type { Loadout } from "../../components/combat/loadout/model";

const BARS: Record<string, string[]> = {
  // Standard DS revolution bar (igneous Deadshot when cape present)
  ds_revo: [
    "greater_deaths_swiftness",
    "rapid_fire",
    "snap_shot",
    "deadshot_igneous",
    "snipe",
    "greater_ricochet",
    "corruption_shot",
  ],
  // BOTLG PE-heavy: multi-hit physicals + basics so Perfect Equilibrium stacks fire
  pe_heavy: [
    "rapid_fire",
    "greater_ricochet",
    "snipe",
    "needle_strike",
    "piercing_shot",
    "corruption_shot",
    "ranged_attack",
  ],
  // Short adrenaline dump without ultimate setup
  adren_dump: [
    "rapid_fire",
    "snap_shot",
    "deadshot_igneous",
    "greater_ricochet",
    "snipe",
    "piercing_shot",
  ],
};

const BLESS: Record<string, BlessingPath[]> = {
  base: [],
  Chaos: ["Chaos", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"],
  Balance: ["Balance", "Balance", "Balance", "Balance", "Balance", "Balance"],
  Order: ["Order", "Order", "Order", "Order", "Order", "Order"],
  // Big Boned + Cinders/Rampage/Havoc/Critual damage stack (God1 Demon's Mark)
  god_havoc: ["Balance", "Chaos", "Chaos", "Chaos", "Chaos", "Chaos"],
};

function dpm(total: number, ticks: number) {
  const seconds = ticks * TICK_SECONDS;
  return seconds > 0 ? (total / seconds) * 60 : 0;
}

function rangedLoadout(peSpecial: boolean): Loadout {
  const col = createSavedSetupCollection();
  const setup = col.setups.find((s) => s.id === "default-ranged");
  if (!setup) throw new Error("missing default-ranged");
  return {
    ...setup.loadout,
    buffs: {
      ...setup.loadout.buffs,
      useEquippedWeaponSpecial: peSpecial,
    },
  };
}

type Row = {
  variant: string;
  bar: string;
  ticks: number;
  totalExpected: number;
  dpm: number;
  notes: string;
  ok: boolean;
  peEvents: number;
  casts: number;
  cards: string;
};

function score(
  loadout: Loadout,
  barName: string,
  barIds: string[],
  blessName: string,
  picks: BlessingPath[],
  durationTicks: number,
): Row {
  const league = resolveLeagueRules({
    ruleset: picks.length ? "equilibrium" : "base",
    blessingPicks: picks,
  });
  const cards = league.blessings.map((b) => b.id).join(",");
  try {
    const { model } = resolveLoadoutCombat(loadout, {
      blessingPicks: picks.length ? picks : undefined,
      ruleset: picks.length ? "equilibrium" : "base",
      relics: [],
      unlockedRegions: [],
    });
    const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
    const available = barIds.filter((id) => catalogue.byId.has(id));
    if (available.length === 0) {
      return {
        variant: blessName,
        bar: barName,
        ticks: durationTicks,
        totalExpected: 0,
        dpm: 0,
        notes: "no bar ids in catalogue",
        ok: false,
        peEvents: 0,
        casts: 0,
        cards,
      };
    }
    const bar = resolveAbilitySpecsFromCatalogue(catalogue, available);
    const base = buildSimulationInputBase(model, catalogue);
    const result = simulateRevolution(
      toRevolutionInput(base, { bar, style: "ranged", durationTicks }),
      { stochasticSeed: 1, stochasticLanes: 128, detailLevel: "score-only" },
    );
    const peEvents = result.events.filter(
      (e) => e.abilityId === "perfect_equilibrium" || e.provenance?.kind === "botlg_perfect_equilibrium",
    ).length;
    const peNote =
      barName === "pe_heavy"
        ? peEvents > 0
          ? `PE events=${peEvents}; special=${loadout.buffs.useEquippedWeaponSpecial}`
          : `no PE events; special=${loadout.buffs.useEquippedWeaponSpecial}`
        : cards
          ? `cards=${cards}`
          : "base ruleset";
    const hpNote = league.blessingIds.has("higher-power") ? "; Higher Power (no DS)" : "";
    const havocNote = league.blessingIds.has("havoc-born") ? "; Havoc Born" : "";
    return {
      variant: blessName,
      bar: barName,
      ticks: result.ticks,
      totalExpected: Math.round(result.totalExpected),
      dpm: Math.round(dpm(result.totalExpected, result.ticks)),
      notes: `${peNote}${hpNote}${havocNote}${result.ok ? "" : `; err=${result.error ?? "?"}`}`,
      ok: result.ok,
      peEvents,
      casts: result.casts.length,
      cards,
    };
  } catch (e) {
    return {
      variant: blessName,
      bar: barName,
      ticks: durationTicks,
      totalExpected: 0,
      dpm: 0,
      notes: e instanceof Error ? e.message : String(e),
      ok: false,
      peEvents: 0,
      casts: 0,
      cards,
    };
  }
}

describe("ranged revolution dpm scout", () => {
  it("scores default-ranged x bars x blessings @ 100 (and 500 for leaders)", () => {
    const rows: Row[] = [];
    for (const [barName, barIds] of Object.entries(BARS)) {
      const peSpecial = barName === "pe_heavy";
      const loadout = rangedLoadout(peSpecial);
      for (const [blessName, picks] of Object.entries(BLESS)) {
        rows.push(score(loadout, barName, barIds, blessName, picks, 100));
      }
    }

    rows.sort((a, b) => b.dpm - a.dpm);
    const top = rows.slice(0, 6);
    const long: Row[] = [];
    for (const leader of top) {
      const peSpecial = leader.bar === "pe_heavy";
      const loadout = rangedLoadout(peSpecial);
      const picks = BLESS[leader.variant] ?? [];
      const barIds = BARS[leader.bar] ?? [];
      long.push(score(loadout, leader.bar, barIds, leader.variant, picks, 500));
    }
    long.sort((a, b) => b.dpm - a.dpm);

    const table = [...rows, ...long.map((r) => ({ ...r, notes: `${r.notes}; @500` }))];
    console.log(
      "variant|bar|ticks|totalExpected|DPM|notes\n" +
        table
          .map(
            (r) =>
              `${r.variant}|${r.bar}|${r.ticks}|${r.totalExpected}|${r.dpm}|${r.notes}`,
          )
          .join("\n"),
    );
    console.log(JSON.stringify({ rows, long }, null, 2));

    const best = rows[0];
    expect(best?.ok).toBe(true);
    expect(best?.dpm).toBeGreaterThan(0);
  }, 300_000);
});
