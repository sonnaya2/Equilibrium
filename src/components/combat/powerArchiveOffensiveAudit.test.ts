/**
 * Exhaustive wire audit: every Power Archive offensive perk must move a combat
 * signal (rank / base AD / crit / accuracy / hit EV / adren) when the blessing
 * is active and the perk is stored in the Automaton bot.
 *
 * Failures mean unwired or broken - not "no visual change in the UI."
 *
 * Suites:
 * - rank wire: catalogue coverage of effective rank / scalar signals (Archive ON vs OFF)
 * - damage EV: hit expected-value rises for damage-routing perks (sim)
 */
import { describe, expect, it } from "vitest";
import { resolveAbilityCatalogue } from "@/combat/abilities/catalogue";
import { simulate } from "@/combat/engine/simulation/simulate";
import { rotationOf } from "@/combat/engine/simulation/contracts";
import {
  buildSimulationInputBase,
  toHybridManualCombatModel,
  toManualSimulateInput,
} from "@/combat/model/simulationBase";
import type { BlessingPath } from "@/league/blessings";
import {
  POWER_ARCHIVE_PERKS,
  normalizePowerArchiveState,
  type PowerArchivePerkId,
} from "@/combat/league/powerArchive";
import { DEFAULT_LOADOUT, type Loadout } from "./loadout/model";
import { resolveLoadoutCombat } from "./toResolvedCombatModel";

const BALANCE_GOD2: readonly BlessingPath[] = [
  "Balance",
  "Balance",
  "Balance",
  "Balance",
  "Balance",
  "Balance",
];

const OFFENSIVE = POWER_ARCHIVE_PERKS.filter((p) => p.combatScope === "offensive");

function botLoadout(
  perkId: PowerArchivePerkId,
  storedRank: number,
  extras: Partial<Loadout> = {},
): Loadout {
  const def = POWER_ARCHIVE_PERKS.find((p) => p.id === perkId)!;
  const ancient = def.standardMaxStored == null || storedRank > (def.standardMaxStored ?? 0);
  const shell = def.gizmoKind === "armour" ? "armour" : "weapon";
  return {
    ...DEFAULT_LOADOUT,
    style: extras.style ?? DEFAULT_LOADOUT.style,
    ...extras,
    perks: { ...DEFAULT_LOADOUT.perks, ...(extras.perks ?? {}) },
    buffs: { ...DEFAULT_LOADOUT.buffs, ...(extras.buffs ?? {}) },
    powerArchive: normalizePowerArchiveState({
      slots: [
        {
          id: `audit-${perkId}`,
          shell,
          ancient: def.standardMaxStored == null ? true : ancient,
          perks: [{ perkId, rank: storedRank }],
        },
      ],
    }),
  };
}

function maxStored(perkId: PowerArchivePerkId): number {
  const def = POWER_ARCHIVE_PERKS.find((p) => p.id === perkId)!;
  return def.ancientMaxStored ?? def.standardMaxStored ?? 1;
}

function hitEv(
  model: ReturnType<typeof resolveLoadoutCombat>["model"],
  abilityId: string,
): number {
  const catalogue = resolveAbilityCatalogue({ strengthCape99: model.strengthCape99 });
  const summary = simulate(
    toManualSimulateInput(buildSimulationInputBase(model, catalogue), {
      rotation: rotationOf(abilityId),
    }),
  );
  return summary.events
    .filter(
      (e) =>
        e.abilityId === abilityId &&
        !e.attached &&
        (e.family === "hit" || e.family === "dot"),
    )
    .reduce((s, e) => s + e.damage.expected, 0);
}

describe("Power Archive offensive catalogue coverage", () => {
  it("lists exactly the 17 offensive perks", () => {
    expect(OFFENSIVE.map((p) => p.id).sort()).toEqual(
      [
        "aftershock",
        "biting",
        "caroming",
        "crackling",
        "energising",
        "equilibrium",
        "eruptive",
        "flanking",
        "impatient",
        "invigorating",
        "lunging",
        "precise",
        "relentless",
        "ruthless",
        "shield-bashing",
        "spendthrift",
        "ultimatums",
      ].sort(),
    );
  });
});

describe("Power Archive rank wire (blessing on vs off)", () => {
  for (const perk of OFFENSIVE) {
    const stored = maxStored(perk.id);
    it(`${perk.label}: stored ${stored} → effective ${stored * 2} only when Archive is active`, () => {
      const loadout = botLoadout(perk.id, stored, {
        style: perk.id === "caroming" || perk.id === "lunging" ? "ranged" : "melee",
        buffs: {
          ...DEFAULT_LOADOUT.buffs,
          targetNotFacing: perk.id === "flanking",
          ruthlessStacks: perk.id === "ruthless" ? 5 : 0,
        },
      });
      const off = resolveLoadoutCombat(loadout, {});
      const on = resolveLoadoutCombat(loadout, { blessingPicks: BALANCE_GOD2 });
      expect(on.stats.league.blessingIds.has("power-archive")).toBe(true);

      // Scalar / side-effect perks: pin public stats, not inverse-decoded ranks.
      if (perk.id === "biting") {
        // +2% crit per rank; ancient max stored 4 → Archive effective R8 → +16%.
        expect(stored).toBe(4);
        expect(off.stats.critChanceBreakdown.biting).toBe(0);
        expect(on.stats.critChanceBreakdown.biting).toBeCloseTo(0.16, 8);
        return;
      }
      if (perk.id === "invigorating") {
        // +5% basic-attack adren per rank; ancient max stored 4 → effective R8 → x1.4.
        expect(stored).toBe(4);
        expect(off.stats.adrenaline?.basicGainMultiplier ?? 1).toBe(1);
        expect(on.stats.adrenaline?.basicGainMultiplier ?? 1).toBeCloseTo(1.4, 8);
        return;
      }
      if (perk.id === "equilibrium") {
        expect(off.stats.critsDisabled).toBe(false);
        expect(on.stats.critsDisabled).toBe(true);
        expect(on.stats.base).toBeGreaterThan(off.stats.base);
        return;
      }
      if (perk.id === "eruptive") {
        // Same blessing set: bare (no bot) vs Archive Eruptive.
        const bare = resolveLoadoutCombat(
          { ...DEFAULT_LOADOUT, style: loadout.style },
          { blessingPicks: BALANCE_GOD2 },
        );
        expect(on.stats.base).toBeGreaterThan(bare.stats.base);
        // Archive OFF ignores stored bot slots.
        const offBlessed = resolveLoadoutCombat(loadout, {});
        expect(offBlessed.stats.base).toBeLessThan(on.stats.base);
        return;
      }
      if (perk.id === "energising") {
        const bare = resolveLoadoutCombat(
          { ...DEFAULT_LOADOUT, style: loadout.style },
          { blessingPicks: BALANCE_GOD2 },
        );
        expect(on.stats.accuracyRating).toBeGreaterThan(bare.stats.accuracyRating);
        expect(off.stats.accuracyRating).toBe(bare.stats.accuracyRating);
        return;
      }

      const read = (model: typeof on.model, stats: typeof on.stats): number => {
        switch (perk.id) {
          case "aftershock":
            return stats.procs?.aftershockRank ?? 0;
          case "crackling":
            return stats.procs?.cracklingRank ?? 0;
          case "precise":
            return stats.preciseRank ?? 0;
          case "caroming":
            return stats.caromingRank ?? model.caromingRank;
          case "impatient":
            return stats.adrenaline?.impatientRank ?? 0;
          case "relentless":
            return stats.adrenaline?.relentlessRank ?? 0;
          case "ultimatums":
            return model.modifierSources.ultimatums;
          case "lunging":
            return model.modifierSources.lunging;
          case "flanking":
            return model.modifierSources.flanking ?? 0;
          case "shield-bashing":
            return model.modifierSources.shieldBashing ?? 0;
          case "spendthrift":
            return model.modifierSources.spendthrift ?? 0;
          case "ruthless":
            return model.modifierSources.ruthless ?? 0;
          default:
            return 0;
        }
      };

      expect(read(off.model, off.stats), "rank with Archive OFF").toBe(0);
      expect(read(on.model, on.stats), "rank with Archive ON").toBe(stored * 2);
      if (perk.id === "flanking") {
        expect(on.model.modifierSources.flankingActive).toBe(true);
      }
      if (perk.id === "ruthless") {
        expect(on.model.modifierSources.ruthlessStacks).toBe(5);
      }
    });
  }
});

describe("Power Archive damage EV wire (sim)", () => {
  // Damage-routing perks only. Rank / accuracy / adren scalars live in rank-wire above.
  // Caroming hit multiplicity magnitude: league caroming / GRico suites elsewhere.
  const cases: Array<{
    perk: PowerArchivePerkId;
    ability: string;
    style: Loadout["style"];
    buffs?: Partial<Loadout["buffs"]>;
  }> = [
    { perk: "precise", ability: "attack", style: "melee" },
    { perk: "ultimatums", ability: "overpower", style: "melee" },
    { perk: "lunging", ability: "dismember", style: "melee" },
    { perk: "caroming", ability: "greater_ricochet", style: "ranged" },
    {
      perk: "flanking",
      ability: "backhand",
      style: "melee",
      buffs: { targetNotFacing: true },
    },
    {
      perk: "ruthless",
      ability: "attack",
      style: "melee",
      buffs: { ruthlessStacks: 5 },
    },
    { perk: "spendthrift", ability: "attack", style: "melee" },
  ];

  for (const c of cases) {
    it(`${c.perk} on ${c.ability}: Archive ON raises hit EV vs bare blessing frame`, () => {
      const stored = maxStored(c.perk);
      const loadout = botLoadout(c.perk, stored, {
        style: c.style,
        buffs: { ...DEFAULT_LOADOUT.buffs, ...(c.buffs ?? {}) },
      });
      const on = resolveLoadoutCombat(loadout, { blessingPicks: BALANCE_GOD2 });
      expect(on.stats.league.blessingIds.has("power-archive")).toBe(true);

      // Same blessing frame: bare vs Archive perk (not blessing OFF vs ON).
      const bare = resolveLoadoutCombat(
        { ...DEFAULT_LOADOUT, style: c.style, buffs: { ...DEFAULT_LOADOUT.buffs, ...(c.buffs ?? {}) } },
        { blessingPicks: BALANCE_GOD2 },
      );
      const evBare = hitEv(bare.model, c.ability);
      const evOn = hitEv(on.model, c.ability);
      expect(evBare, `${c.ability} baseline EV`).toBeGreaterThan(0);
      expect(evOn, `${c.perk} should raise ${c.ability} hit EV`).toBeGreaterThan(evBare);
    });
  }
});

describe("Power Archive wiring traps", () => {
  it("equipment-only perks are not doubled by Archive blessing alone", () => {
    const loadout: Loadout = {
      ...DEFAULT_LOADOUT,
      perks: { ...DEFAULT_LOADOUT.perks, caroming: 4, eruptive: 4, precise: 6 },
    };
    const on = resolveLoadoutCombat(loadout, { blessingPicks: BALANCE_GOD2 });
    expect(on.model.caromingRank).toBe(4);
    expect(on.stats.preciseRank).toBe(6);
    expect(on.model.modifierSources.ultimatums).toBe(0);
  });

  it("empty Archive slots do not inject invention ranks when blessing is active", () => {
    const loadout: Loadout = {
      ...DEFAULT_LOADOUT,
      powerArchive: normalizePowerArchiveState({ slots: [] }),
    };
    const on = resolveLoadoutCombat(loadout, { blessingPicks: BALANCE_GOD2 });
    expect(on.model.caromingRank).toBe(0);
    expect(on.stats.procs?.aftershockRank ?? 0).toBe(0);
    expect(on.model.modifierSources.spendthrift ?? 0).toBe(0);
  });

  it("hybrid Use-Loadout-off zeroes caroming/ultimatums/lunging even if scaffold had them", () => {
    const loadout = botLoadout("caroming", 4, { style: "ranged" });
    const { model } = resolveLoadoutCombat(loadout, { blessingPicks: BALANCE_GOD2 });
    expect(model.caromingRank).toBe(8);
    const hybrid = toHybridManualCombatModel(model, {
      base: model.base,
      level: model.level,
      accuracy: model.accuracy,
      critChance: model.crit.chance,
    });
    expect(hybrid.caromingRank).toBe(0);
  });
});
