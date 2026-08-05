import { describe, expect, it } from "vitest";
import { NECROMANCY_ABILITIES } from "../../styles/necromancy/abilities";
import {
  applyConjureCast,
  conjureCanCast,
  newConjures,
  type ConjureState,
} from "../../styles/necromancy/conjures";
import { necroCanCast } from "../../styles/necromancy/effects";
import {
  castRejection,
  costOf,
  permanentAvailabilityBlock,
  resolveCastAbility,
  type WeaponConfiguration,
} from "./rules";
import { newRotationState, type RotationState } from "../runtime/state";
import { abilityById } from "../../test/helpers/summary";

/**
 * Diagnostic matrix: every castRejection gate for conjure_undead_army.
 * Asserts (not console spam) permanentAvailabilityBlock, necro/conjureCanCast,
 * and costOf under WC x spirits x lantern. Necro dual + lantern must stay legal.
 */

const army = abilityById(NECROMANCY_ABILITIES, "conjure_undead_army");
const LANTERN = "item:soulbound-lantern" as const;

const WEAPON_CONFIGS: readonly (WeaponConfiguration | undefined)[] = [
  undefined,
  "necromancy",
  "dualwield",
  "mainhand",
  "shield",
];

const EQUIP_SETS: readonly { label: string; equipmentIds: readonly string[] }[] = [
  { label: "empty", equipmentIds: [] },
  { label: "lantern", equipmentIds: [LANTERN] },
];

function spiritsEmpty(): ConjureState {
  return newConjures();
}

function spiritsArmyActive(): ConjureState {
  return applyConjureCast(newConjures(), "conjure_undead_army", 0);
}

function stateOf(opts: {
  conjures?: ConjureState;
  adrenaline?: number;
  lantern?: boolean;
}): RotationState {
  const base = newRotationState({
    adrenaline: opts.adrenaline ?? 100,
    lantern: opts.lantern === true,
  });
  if (!opts.conjures) return base;
  return {
    ...base,
    necromancy: {
      ...base.necromancy,
      conjures: opts.conjures,
    },
  };
}

/** Conduit WC shapes that may cast conjures (wiki + loadout dual store). */
function conduitCapable(wc: WeaponConfiguration | undefined): boolean {
  return wc === undefined || wc === "necromancy" || wc === "dualwield";
}

type GateRow = {
  wc: string;
  equip: string;
  spirits: "none" | "army";
  permanentBlock: string | null;
  necroCan: boolean;
  conjureCan: boolean;
  cost: number;
  rejection: string | null;
  available: boolean;
};

function diagnose(
  wc: WeaponConfiguration | undefined,
  equipmentIds: readonly string[],
  spirits: "none" | "army",
): GateRow {
  const conjures = spirits === "army" ? spiritsArmyActive() : spiritsEmpty();
  const state = stateOf({
    conjures,
    adrenaline: 100,
    lantern: equipmentIds.includes(LANTERN),
  });
  const permanentBlock = permanentAvailabilityBlock(army, {
    weaponConfiguration: wc,
    equipmentIds,
  });
  const conjureCan = conjureCanCast(army.id, conjures, 0);
  const necroCan = necroCanCast(army, state.necromancy.resources, conjures, 0);
  const cost = costOf(state, army, 0);
  const rejection = castRejection(state, army, 0, wc, equipmentIds);
  return {
    wc: wc ?? "undefined",
    equip: equipmentIds.includes(LANTERN) ? "lantern" : "empty",
    spirits,
    permanentBlock,
    necroCan,
    conjureCan,
    cost,
    rejection,
    available: rejection === null,
  };
}

describe("conjure_undead_army castRejection gate matrix", () => {
  const rows: GateRow[] = [];
  for (const wc of WEAPON_CONFIGS) {
    for (const equip of EQUIP_SETS) {
      for (const spirits of ["none", "army"] as const) {
        rows.push(diagnose(wc, equip.equipmentIds, spirits));
      }
    }
  }

  it("table: permanentAvailabilityBlock / necroCan / conjureCan / cost / available", () => {
    // Materialize expects so failures name the gate + config.
    for (const row of rows) {
      const label = `wc=${row.wc} equip=${row.equip} spirits=${row.spirits}`;
      const wc = row.wc === "undefined" ? undefined : (row.wc as WeaponConfiguration);
      const expectPermNull = conduitCapable(wc);

      if (expectPermNull) {
        expect(row.permanentBlock, `${label} permanentAvailabilityBlock`).toBeNull();
      } else {
        expect(row.permanentBlock, `${label} permanentAvailabilityBlock`).toBe(
          "conjure_undead_army requires a conduit",
        );
      }

      // Army has no soul cost; conjureCan is the only necro gate that flips.
      if (row.spirits === "none") {
        expect(row.conjureCan, `${label} conjureCanCast`).toBe(true);
        expect(row.necroCan, `${label} necroCanCast`).toBe(true);
      } else {
        expect(row.conjureCan, `${label} conjureCanCast`).toBe(false);
        expect(row.necroCan, `${label} necroCanCast`).toBe(false);
      }

      // Listed adren cost is 0; never the blocking gate at 100% adren.
      expect(row.cost, `${label} costOf`).toBe(0);

      const expectAvailable = expectPermNull && row.spirits === "none";
      expect(row.available, `${label} castRejection available`).toBe(expectAvailable);
      if (!expectPermNull) {
        expect(row.rejection, `${label} rejection`).toBe(
          "conjure_undead_army requires a conduit",
        );
      } else if (row.spirits === "army") {
        expect(row.rejection, `${label} rejection`).toMatch(
          /needs residual souls or an active conjure/,
        );
      } else {
        expect(row.rejection, `${label} rejection`).toBeNull();
      }
    }

    // Compact availability table for the suite report / human handoff.
    const lines = rows.map(
      (r) =>
        `${r.wc.padEnd(11)} ${r.equip.padEnd(7)} spirits=${r.spirits.padEnd(4)} ` +
        `perm=${r.permanentBlock === null ? "ok" : "block"} ` +
        `necro=${r.necroCan ? "ok" : "no"} ` +
        `conjure=${r.conjureCan ? "ok" : "no"} ` +
        `cost=${r.cost} ` +
        `avail=${r.available ? "yes" : "no"}`,
    );
    expect(lines.length).toBe(WEAPON_CONFIGS.length * EQUIP_SETS.length * 2);
    expect(lines.some((l) => l.includes("dualwield") && l.includes("lantern") && l.includes("spirits=none") && l.includes("avail=yes"))).toBe(
      true,
    );
    // Snapshot the full gate matrix (asserted as structured rows above).
    expect(rows.map((r) => ({
      wc: r.wc,
      equip: r.equip,
      spirits: r.spirits,
      permanent: r.permanentBlock === null ? "ok" : "block",
      necro: r.necroCan ? "ok" : "no",
      conjure: r.conjureCan ? "ok" : "no",
      cost: r.cost,
      available: r.available,
    }))).toEqual(
      WEAPON_CONFIGS.flatMap((wc) =>
        EQUIP_SETS.flatMap((equip) =>
          (["none", "army"] as const).map((spirits) => {
            const wcKey = wc ?? "undefined";
            const permOk = conduitCapable(wc);
            const conjureOk = spirits === "none";
            return {
              wc: wcKey,
              equip: equip.label === "lantern" ? "lantern" : "empty",
              spirits,
              permanent: permOk ? "ok" : "block",
              necro: conjureOk ? "ok" : "no",
              conjure: conjureOk ? "ok" : "no",
              cost: 0,
              available: permOk && conjureOk,
            };
          }),
        ),
      ),
    );
  });

  it("necro dual + lantern is never blocked by permanent/cost gates", () => {
    for (const wc of ["necromancy", "dualwield"] as const) {
      for (const equip of EQUIP_SETS) {
        const row = diagnose(wc, equip.equipmentIds, "none");
        expect(row.permanentBlock, `wc=${wc} equip=${row.equip}`).toBeNull();
        expect(row.cost, `wc=${wc} equip=${row.equip}`).toBe(0);
        expect(row.necroCan, `wc=${wc} equip=${row.equip}`).toBe(true);
        expect(row.available, `wc=${wc} equip=${row.equip}`).toBe(true);
        expect(row.rejection, `wc=${wc} equip=${row.equip}`).toBeNull();
      }
    }
  });

  it("shield and mainhand always permanent-block conjure regardless of lantern", () => {
    for (const wc of ["shield", "mainhand"] as const) {
      for (const equip of EQUIP_SETS) {
        const row = diagnose(wc, equip.equipmentIds, "none");
        expect(row.permanentBlock).toBe("conjure_undead_army requires a conduit");
        expect(row.available).toBe(false);
      }
    }
  });

  it("undefined WC stays unrestricted (engine tests omit shape)", () => {
    const empty = diagnose(undefined, [], "none");
    const lantern = diagnose(undefined, [LANTERN], "none");
    expect(empty.available).toBe(true);
    expect(lantern.available).toBe(true);
  });

  it("full army spirits block via conjureCanCast even with dual + lantern", () => {
    const row = diagnose("dualwield", [LANTERN], "army");
    expect(row.permanentBlock).toBeNull();
    expect(row.conjureCan).toBe(false);
    expect(row.necroCan).toBe(false);
    expect(row.cost).toBe(0);
    expect(row.available).toBe(false);
    expect(row.rejection).toMatch(/needs residual souls or an active conjure/);
  });

  it("resolveCastAbility keeps conjure_undead_army id (no rewrite)", () => {
    const byId = new Map(NECROMANCY_ABILITIES.map((a) => [a.id, a]));
    for (const wc of WEAPON_CONFIGS) {
      for (const equip of EQUIP_SETS) {
        const { ability, block } = resolveCastAbility(army, {
          byId,
          weaponConfiguration: wc,
          equipmentIds: equip.equipmentIds,
        });
        expect(ability.id, `wc=${wc ?? "undefined"} equip=${equip.label}`).toBe(
          "conjure_undead_army",
        );
        expect(ability.id).toBe(army.id);
        if (conduitCapable(wc)) {
          expect(block).toBeNull();
        } else {
          expect(block).toBe("conjure_undead_army requires a conduit");
        }
      }
    }
  });

  it("costOf never exceeds adrenaline for army at 0% adren (cost gate stays open)", () => {
    const state = stateOf({ adrenaline: 0, conjures: spiritsEmpty() });
    expect(costOf(state, army, 0)).toBe(0);
    expect(castRejection(state, army, 0, "dualwield", [LANTERN])).toBeNull();
    expect(castRejection(state, army, 0, "necromancy", [LANTERN])).toBeNull();
  });
});
