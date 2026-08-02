import { describe, expect, it } from "vitest";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import {
  ABILITY_REGISTRY,
  entryByEngineId,
  entryByRecordId,
  engineSpecs,
} from "./registry";

const ALL_STYLE_SPECS = [
  ...MELEE_ABILITIES,
  ...RANGED_ABILITIES,
  ...MAGIC_ABILITIES,
  ...NECROMANCY_ABILITIES,
  volleyOfSouls(3),
];

describe("ABILITY_REGISTRY", () => {
  it("has unique engine ids", () => {
    const ids = ABILITY_REGISTRY.map((e) => e.engineId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("registers every style ability plus volley factory", () => {
    for (const spec of ALL_STYLE_SPECS) {
      expect(engineSpecs.has(spec.id), `missing ${spec.id}`).toBe(true);
      expect(entryByEngineId(spec.id)?.spec.id).toBe(spec.id);
    }
  });

  it("every registered style ability is sourced with sane hit bands", () => {
    const byStyle = [
      ["melee", MELEE_ABILITIES],
      ["ranged", RANGED_ABILITIES],
      ["magic", MAGIC_ABILITIES],
      ["necromancy", NECROMANCY_ABILITIES],
    ] as const;
    for (const [style, list] of byStyle) {
      expect(new Set(list.map((a) => a.id)).size).toBe(list.length);
      for (const a of list) expect(a.style, a.id).toBe(style);
    }
    for (const spec of ALL_STYLE_SPECS) {
      expect(spec.source.verifiedAt, spec.id).toBeTruthy();
      for (const hit of spec.hits) {
        expect(hit.band.minPct, spec.id).toBeLessThanOrEqual(hit.band.maxPct);
      }
    }
  });

  it("marks autos not solver eligible by default", () => {
    for (const id of ["attack", "ranged_attack", "magic_attack", "necromancy_basic"]) {
      expect(entryByEngineId(id)?.solverEligibleDefault, id).toBe(false);
      expect(entryByEngineId(id)?.spec.autoAttack, id).toBe(true);
    }
  });

  it("marks offGcd not solver eligible", () => {
    const runic = entryByEngineId("runic_charge");
    expect(runic?.spec.offGcd).toBe(true);
    expect(runic?.solverEligibleDefault).toBe(false);
  });

  it("marks partially-modeled not solver eligible by default", () => {
    const partial = ABILITY_REGISTRY.filter((e) => e.support.status === "partially-modeled");
    expect(partial.length).toBeGreaterThan(0);
    for (const e of partial) {
      expect(e.solverEligibleDefault, e.engineId).toBe(false);
    }
  });

  it("entryByRecordId resolves greater_fury and common mappings", () => {
    expect(entryByRecordId("melee:greater-fury")?.engineId).toBe("greater_fury");
    expect(entryByRecordId("melee:rend")?.engineId).toBe("rend");
    expect(entryByRecordId("magic:runic-charge")?.engineId).toBe("runic_charge");
    expect(entryByRecordId("necromancy:volley-of-souls")?.engineId).toBe("volley_of_souls");
  });

  it("tags setup / equipment / cast-stage / factory link kinds", () => {
    expect(entryByEngineId("adaptive_strike_2h")?.linkKind).toBe("setup-variant");
    expect(entryByEngineId("adaptive_strike_dw")?.parentRecordId).toBe("melee:adaptive-strike");
    expect(entryByEngineId("overpower_igneous")?.linkKind).toBe("equipment-variant");
    expect(entryByEngineId("overpower_igneous")?.parentRecordId).toBe("melee:overpower");
    expect(entryByEngineId("deadshot_igneous")?.linkKind).toBe("equipment-variant");
    expect(entryByEngineId("deadshot_igneous")?.parentRecordId).toBe("ranged:deadshot");
    expect(entryByEngineId("omnipower_igneous")?.linkKind).toBe("equipment-variant");
    expect(entryByEngineId("omnipower_igneous")?.parentRecordId).toBe("magic:omnipower");
    expect(entryByEngineId("death_skulls_igneous")?.linkKind).toBe("equipment-variant");
    expect(entryByEngineId("death_skulls_igneous")?.parentRecordId).toBe("necromancy:death-skulls");
    expect(entryByEngineId("spectral_scythe_2")?.linkKind).toBe("cast-stage");
    expect(entryByEngineId("spectral_scythe_3")?.solverEligibleDefault).toBe(false);
    expect(entryByEngineId("volley_of_souls")?.linkKind).toBe("factory");
    expect(entryByEngineId("volley_of_souls")?.solverEligibleDefault).toBe(true);
  });
});
