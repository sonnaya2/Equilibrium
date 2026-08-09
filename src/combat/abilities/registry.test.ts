import { describe, expect, it } from "vitest";
import { combatAbilities } from "../data";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { SHARED_CONSTITUTION_ABILITIES } from "../styles/shared/constitutionAbilities";
import {
  ABILITY_REGISTRY,
  entryByEngineId,
  entryByRecordId,
  engineIdForRecord,
  engineSpecs,
  engineSpecsForStyle,
  validateAbilityRegistry,
} from "./registry";
import { RECORD_TO_ENGINE, validateEngineMap } from "./engineMap";

const ALL_STYLE_SPECS = [
  ...MELEE_ABILITIES,
  ...RANGED_ABILITIES,
  ...MAGIC_ABILITIES,
  ...NECROMANCY_ABILITIES,
  volleyOfSouls(3),
  ...SHARED_CONSTITUTION_ABILITIES,
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

  it("has exactly one Basic Attack per style", () => {
    const byStyle = new Map<string, string[]>();
    for (const e of ABILITY_REGISTRY) {
      if (!e.spec.basicAttack) continue;
      const list = byStyle.get(e.style) ?? [];
      list.push(e.engineId);
      byStyle.set(e.style, list);
    }
    for (const style of ["melee", "ranged", "magic", "necromancy"]) {
      expect(byStyle.get(style), style).toHaveLength(1);
    }
  });

  it("marks FSoA Instability and Guthix Claws as manual-only (not Revo++ solver)", () => {
    expect(entryByEngineId("instability")?.solverEligibleDefault).toBe(false);
    expect(entryByEngineId("claws_of_guthix")?.solverEligibleDefault).toBe(false);
    expect(entryByEngineId("soulfire")?.solverEligibleDefault).toBe(false);
  });

  it("keeps Basic Attacks implicit in Revolution rather than generated bar slots", () => {
    for (const id of ["attack", "ranged_attack", "magic_attack", "necromancy_basic"]) {
      expect(entryByEngineId(id)?.solverEligibleDefault, id).toBe(false);
      expect(entryByEngineId(id)?.spec.basicAttack, id).toBe(true);
      expect(entryByEngineId(id)?.spec.cooldownSeconds, id).toBeUndefined();
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

  it("death_skulls + death_skulls_igneous are solver-eligible ST models with honest note", () => {
    const base = entryByEngineId("death_skulls");
    const igneous = entryByEngineId("death_skulls_igneous");
    expect(base?.support.status).toBe("full");
    expect(igneous?.support.status).toBe("full");
    expect(base?.solverEligibleDefault).toBe(true);
    expect(igneous?.solverEligibleDefault).toBe(true);
    expect(base?.support.note).toMatch(/Single-target/i);
    expect(igneous?.support.note).toMatch(/Single-target/i);
  });

  it("conjure summons and commands are solver-eligible without includePartial", () => {
    for (const id of [
      "conjure_skeleton_warrior",
      "conjure_vengeful_ghost",
      "conjure_putrid_zombie",
      "conjure_undead_army",
    ] as const) {
      const e = entryByEngineId(id);
      expect(e?.support.status, id).toBe("full");
      expect(e?.solverEligibleDefault, id).toBe(true);
      expect(e?.spec.supportStatus, id).toBeUndefined();
      expect(e?.support.note, id).toBeTruthy();
    }
    const phantom = entryByEngineId("conjure_phantom_guardian");
    expect(phantom?.support.status).toBe("partially-modeled");
    expect(phantom?.solverEligibleDefault).toBe(false);
    expect(phantom?.spec.supportStatus).toBe("partially-modeled");
    for (const id of [
      "command_skeleton_warrior",
      "command_phantom_guardian",
      "command_vengeful_ghost",
    ] as const) {
      expect(entryByEngineId(id)?.solverEligibleDefault, id).toBe(true);
      expect(entryByEngineId(id)?.spec.supportStatus, id).toBeUndefined();
    }
    // ST single-target explode; wiki is area (2 tiles) so not default solver-eligible.
    expect(entryByEngineId("command_putrid_zombie")?.solverEligibleDefault).toBe(false);
    expect(entryByEngineId("command_putrid_zombie")?.spec.supportStatus).toBe("partially-modeled");
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
    expect(entryByRecordId("shared:sacrifice")?.engineId).toBe("sacrifice");
    expect(entryByRecordId("shared:tuskas-wrath")?.engineId).toBe("tuskas_wrath");
  });

  it("shared constitution abilities are registry full, solver-eligible, remapped per style", () => {
    const sac = entryByEngineId("sacrifice");
    expect(sac?.recordId).toBe("shared:sacrifice");
    expect(sac?.support.status).toBe("full");
    expect(sac?.solverEligibleDefault).toBe(true);
    expect(sac?.spec.hits[0]?.band).toEqual({ minPct: 65, maxPct: 75 });
    expect(sac?.spec.adrenaline).toEqual({ gain: 9 });
    expect(sac?.spec.cooldownSeconds).toBe(30);
    expect(sac?.support.note).toMatch(/heal/i);
    expect(sac?.support.note).toMatch(/kill-blow/i);

    const tuska = entryByEngineId("tuskas_wrath");
    expect(tuska?.recordId).toBe("shared:tuskas-wrath");
    expect(tuska?.support.status).toBe("full");
    expect(tuska?.solverEligibleDefault).toBe(true);
    expect(tuska?.spec.hits[0]?.band).toEqual({ minPct: 75, maxPct: 85 });
    expect(tuska?.spec.adrenaline).toEqual({ gain: 9 });
    expect(tuska?.spec.cooldownSeconds).toBe(15);
    expect(tuska?.support.note).toMatch(/on-task/i);
    expect(tuska?.support.note).toMatch(/slayerOnTask/i);

    for (const style of ["melee", "ranged", "magic", "necromancy"] as const) {
      const specs = engineSpecsForStyle(style);
      expect(specs.find((s) => s.id === "sacrifice")?.style, style).toBe(style);
      expect(specs.find((s) => s.id === "tuskas_wrath")?.style, style).toBe(style);
    }
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
