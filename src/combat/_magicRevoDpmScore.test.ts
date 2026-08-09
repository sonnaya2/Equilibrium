/**
 * Temp scout: default-magic revolution DPM x blessing packs x bars.
 * Delete after scoring.
 */
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSavedSetupCollection } from "../components/combat/loadout/savedSetups";
import type { Loadout } from "../components/combat/loadout/model";
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

/** PvME-ish ST priority + sunshine_gcb spam + instability via native special. */
const BARS: Record<string, string[]> = {
  pvme_st: [
    "greater_sunshine",
    "asphyxiate",
    "greater_concentrated_blast",
    "omnipower_igneous",
    "omnipower",
    "tsunami",
    "combust",
    "corruption_blast",
    "greater_sonic_wave",
    "sonic_wave",
    "dragon_breath",
    "wild_magic",
    "greater_chain",
  ],
  // Same bar; loadout enables useEquippedWeaponSpecial (FSoA Instability / Song Soulfire).
  instability_open: [
    "greater_sunshine",
    "asphyxiate",
    "greater_concentrated_blast",
    "omnipower_igneous",
    "omnipower",
    "tsunami",
    "combust",
    "corruption_blast",
    "greater_sonic_wave",
    "sonic_wave",
    "dragon_breath",
    "wild_magic",
    "greater_chain",
  ],
  sunshine_gcb: ["greater_sunshine", "greater_concentrated_blast"],
};

function chaosN(n: number): BlessingPath[] {
  return Array.from({ length: n }, () => "Chaos" as const);
}
function orderN(n: number): BlessingPath[] {
  return Array.from({ length: n }, () => "Order" as const);
}

// base, Chaosxn, Orderxn, Higher Power (Order T4), Havoc Born (Chaos T4)
const BLESS: Record<string, BlessingPath[]> = {
  base: [],
  chaos1: chaosN(1),
  chaos2: chaosN(2),
  chaos3: chaosN(3),
  chaos4_havoc_born: chaosN(4),
  chaos5: chaosN(5),
  chaos6: chaosN(6),
  order1: orderN(1),
  order2: orderN(2),
  order3: orderN(3),
  order4_higher_power: orderN(4),
  order5: orderN(5),
  order6: orderN(6),
};

function dpm(total: number, ticks: number) {
  const seconds = ticks * TICK_SECONDS;
  return seconds > 0 ? (total / seconds) * 60 : 0;
}

/** Prefer greater/igneous when both base and upgraded ids are listed. */
function dedupeReplacementGroup(ids: string[]): string[] {
  const skipIfPresent = new Map<string, string>([
    ["omnipower", "omnipower_igneous"],
    ["sonic_wave", "greater_sonic_wave"],
  ]);
  const set = new Set(ids);
  return ids.filter((id) => {
    const prefer = skipIfPresent.get(id);
    return prefer == null || !set.has(prefer);
  });
}

function withNativeSpecial(loadout: Loadout, on: boolean): Loadout {
  return {
    ...loadout,
    startingAdrenaline: 100,
    buffs: {
      ...loadout.buffs,
      useEquippedWeaponSpecial: on,
    },
  };
}

/** Song of Destruction DW: Roar + Ode (optional scout arm). */
function asSongDw(loadout: Loadout): Loadout {
  return {
    ...loadout,
    equipmentSlots: {
      ...loadout.equipmentSlots,
      twohand: undefined,
      mainhand: "item:roar-of-awakening",
      offhand: "item:ode-to-deceit",
    },
  };
}

type Row = {
  gear: string;
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
  spellTier: number | null;
  weapon: string;
};

describe("magic revo dpm score (temp)", () => {
  it("scores default-magic x bars x blessings (+ Song DW)", () => {
    const col = createSavedSetupCollection();
    const setup = col.setups.find((s) => s.id === "default-magic");
    expect(setup, "default-magic").toBeDefined();
    if (!setup) return;

    expect(setup.loadout.spellTier).toBe(95);
    expect(setup.loadout.equipmentSlots.twohand).toBe("item:fractured-staff-of-armadyl");

    const gearArms: Array<{ gear: string; loadout: Loadout }> = [
      { gear: "fsoa", loadout: setup.loadout },
      { gear: "song_dw", loadout: asSongDw(setup.loadout) },
    ];

    const horizons = [100, 500] as const;
    const rows: Row[] = [];

    for (const { gear, loadout: gearLoadout } of gearArms) {
      for (const [variant, picks] of Object.entries(BLESS)) {
        const league = resolveLeagueRules({
          ruleset: picks.length ? "equilibrium" : "base",
          blessingPicks: picks,
        });
        const cards = league.blessings.map((b) => b.id).join(",");

        for (const [barName, barWanted] of Object.entries(BARS)) {
          const wantSpecial = barName === "instability_open";
          const loadout = withNativeSpecial(gearLoadout, wantSpecial);

          let model;
          try {
            ({ model } = resolveLoadoutCombat(loadout, {
              blessingPicks: picks.length ? picks : undefined,
              ruleset: picks.length ? "equilibrium" : "base",
              relics: [],
              unlockedRegions: [],
            }));
          } catch (e) {
            for (const horizon of horizons) {
              rows.push({
                gear,
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
                spellTier: loadout.spellTier ?? null,
                weapon: "",
              });
            }
            continue;
          }

          const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
          const base = buildSimulationInputBase(model, catalogue);
          const preferred = dedupeReplacementGroup(barWanted.filter((id) => catalogue.byId.has(id)));
          const skipped = barWanted.filter((id) => !catalogue.byId.has(id));
          const weapon =
            model.equipmentEffects.activeWeapon?.id ??
            model.equipmentIds.find((id) => id.startsWith("item:")) ??
            "";

          if (preferred.length === 0) {
            for (const horizon of horizons) {
              rows.push({
                gear,
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
                spellTier: loadout.spellTier ?? null,
                weapon,
              });
            }
            continue;
          }

          const bar = resolveAbilitySpecsFromCatalogue(catalogue, preferred);
          const specialNote =
            wantSpecial && model.nativeSpecialPolicy.useEquippedWeaponSpecial
              ? `nativeSpecial=${model.equipmentEffects.activeWeapon?.specialAttackId ?? "none"}`
              : wantSpecial
                ? "nativeSpecial=off"
                : "";
          const skipNote = skipped.length ? `skipped=${skipped.join(",")}` : "";

          for (const horizon of horizons) {
            try {
              const s = simulateRevolution({
                ...base,
                bar,
                style: "magic",
                durationTicks: horizon,
                startingAdrenaline: 100,
              });
              rows.push({
                gear,
                variant,
                bar: barName,
                horizon,
                totalExpected: Math.round(s.totalExpected * 100) / 100,
                DPM: Math.round(dpm(s.totalExpected, s.ticks)),
                ok: s.ok === true && !s.error,
                notes: [s.error ?? "", specialNote, skipNote].filter(Boolean).join("; "),
                cards,
                barIds: preferred.join(">"),
                casts: s.casts.length,
                ticks: s.ticks,
                spellTier: loadout.spellTier ?? null,
                weapon,
              });
            } catch (e) {
              rows.push({
                gear,
                variant,
                bar: barName,
                horizon,
                totalExpected: null,
                DPM: null,
                ok: false,
                notes: `sim: ${e instanceof Error ? e.message : String(e)}; ${specialNote}; ${skipNote}`,
                cards,
                barIds: preferred.join(">"),
                casts: 0,
                ticks: 0,
                spellTier: loadout.spellTier ?? null,
                weapon,
              });
            }
          }
        }
      }
    }

    rows.sort((a, b) => (b.DPM ?? 0) - (a.DPM ?? 0));

    const outPath = join(process.cwd(), "src/combat/_magicRevoDpmScore.out.json");
    writeFileSync(outPath, JSON.stringify(rows, null, 2), "utf8");

    const header =
      "gear | variant | bar | horizon | totalExpected | DPM | ok | notes | cards";
    const lines = rows.map(
      (r) =>
        `${r.gear} | ${r.variant} | ${r.bar} | ${r.horizon} | ${r.totalExpected ?? "-"} | ${r.DPM ?? "-"} | ${r.ok} | ${r.notes || "-"} | ${r.cards}`,
    );
    const best = rows.find((r) => typeof r.DPM === "number" && r.ok);
    console.log(
      ["", header, ...lines, "", `best: ${JSON.stringify(best)}`, `wrote ${outPath}`].join("\n"),
    );

    expect(best?.DPM).toBeGreaterThan(0);
  }, 600_000);
});
