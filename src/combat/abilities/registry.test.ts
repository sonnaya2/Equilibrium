import { describe, expect, it } from "vitest";
import { combatAbilities } from "../data";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import {
  ABILITY_REGISTRY,
  entryByEngineId,
  entryByRecordId,
  engineIdForRecord,
  engineSpecs,
  validateAbilityRegistry,
} from "./registry";
import { RECORD_TO_ENGINE, validateEngineMap } from "./engineMap";

const ALL_STYLE_SPECS = [
  ...MELEE_ABILITIES,
  ...RANGED_ABILITIES,
  ...MAGIC_ABILITIES,
  ...NECROMANCY_ABILITIES,
  volleyOfSouls(3),
];

describe("ability registry single authority", () => {
  it("has no map/registry validation errors", () => {
    expect(validateAbilityRegistry()).toEqual([]);
    expect(validateEngineMap(ABILITY_REGISTRY.map((e) => e.engineId))).toEqual([]);
  });

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

  it("at most one auto-attack per style", () => {
    const byStyle = new Map<string, string[]>();
    for (const e of ABILITY_REGISTRY) {
      if (!e.spec.autoAttack) continue;
      const list = byStyle.get(e.style) ?? [];
      list.push(e.engineId);
      byStyle.set(e.style, list);
    }
    for (const [style, ids] of byStyle) {
      expect(ids, style).toHaveLength(1);
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

  it("death_skulls_igneous is honest partial like base Death Skulls", () => {
    const base = entryByEngineId("death_skulls");
    const igneous = entryByEngineId("death_skulls_igneous");
    expect(base?.support.status).toBe("partially-modeled");
    expect(igneous?.support.status).toBe("partially-modeled");
    expect(igneous?.solverEligibleDefault).toBe(false);
    expect(igneous?.support.note).toMatch(/Single-target/i);
  });

  it("engineIdForRecord matches RECORD_TO_ENGINE for catalogue records", () => {
    for (const record of combatAbilities.records) {
      const mapped = RECORD_TO_ENGINE[record.id];
      if (mapped) {
        expect(engineIdForRecord(record.id)).toBe(mapped);
      }
    }
  });

  it("entryByRecordId resolves greater_fury and common mappings", () => {
    expect(entryByRecordId("melee:greater-fury")?.engineId).toBe("greater_fury");
    expect(entryByRecordId("melee:rend")?.engineId).toBe("rend");
    expect(entryByRecordId("magic:runic-charge")?.engineId).toBe("runic_charge");
    expect(entryByRecordId("necromancy:volley-of-souls")?.engineId).toBe("volley_of_souls");
  });

  it("entryByRecordId resolves aliases to the same engine entry", () => {
    const a = entryByRecordId("magic:asphyxiate");
    const b = entryByRecordId("magic:asphyxiate-resplendence");
    expect(a?.engineId).toBe("asphyxiate");
    expect(b?.engineId).toBe("asphyxiate");
  });

  it("tags setup / equipment / cast-stage / factory link kinds", () => {
    expect(entryByEngineId("adaptive_strike_2h")?.linkKind).toBe("setup-variant");
    expect(entryByEngineId("adaptive_strike_mh")?.linkKind).toBe("setup-variant");
    expect(entryByEngineId("adaptive_strike_mh")?.parentRecordId).toBe("melee:adaptive-strike");
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
    expect(entryByEngineId("spectral_scythe_2")?.castStage).toBe(2);
    expect(entryByEngineId("spectral_scythe_3")?.castStage).toBe(3);
    expect(entryByEngineId("spectral_scythe_2")?.solverEligibleDefault).toBe(false);
    expect(entryByEngineId("spectral_scythe_3")?.solverEligibleDefault).toBe(false);
    expect(entryByEngineId("volley_of_souls")?.linkKind).toBe("factory");
    expect(entryByEngineId("volley_of_souls")?.solverEligibleDefault).toBe(true);
  });

  it("exposes replacementGroup / cooldownGroup from specs", () => {
    expect(entryByEngineId("greater_fury")?.replacementGroup).toBe("fury");
    expect(entryByEngineId("adaptive_strike_2h")?.replacementGroup).toBe("adaptive_strike");
    expect(entryByEngineId("adaptive_strike_mh")?.replacementGroup).toBe("adaptive_strike");
    expect(entryByEngineId("adaptive_strike_dw")?.replacementGroup).toBe("adaptive_strike");
  });

  it("engine ids match specs; damaging full specs have hits", () => {
    for (const e of ABILITY_REGISTRY) {
      expect(e.spec.id).toBe(e.engineId);
      if (e.spec.category !== "utility" && !e.spec.stateEffect && e.support.status === "full") {
        expect(e.spec.hits.length, e.engineId).toBeGreaterThan(0);
      }
    }
  });
});
