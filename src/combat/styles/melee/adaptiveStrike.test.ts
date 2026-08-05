import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { resolveBarSlot } from "../../data/specs";
import { rotationOf } from "../../engine/simulation/contracts";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { meetsWeaponRequirement, resolveAbilityCastAvailability } from "../../shared/requirements";
import { buildCandidatePool } from "../../solver/candidatePool";
import { baseInput } from "../../test/fixtures/inputs";
import { abilityById } from "../../test/helpers/summary";
import {
  ADAPTIVE_STRIKE_DW_HIT_BAND,
  ADAPTIVE_STRIKE_PRIMARY_BAND,
  adaptiveStrikeEngineId,
  MELEE_ABILITIES,
  weaponConfigurationFromBarSetup,
} from "./abilities";

const ENGINE_SPECS: ReadonlyMap<string, AbilitySpec> = new Map(
  MELEE_ABILITIES.map((spec) => [spec.id, spec]),
);

const LEGAL = [
  {
    config: "twohand" as const,
    engineId: "adaptive_strike_2h",
    hits: 1,
    band: ADAPTIVE_STRIKE_PRIMARY_BAND,
  },
  {
    config: "dualwield" as const,
    engineId: "adaptive_strike_dw",
    hits: 2,
    band: ADAPTIVE_STRIKE_DW_HIT_BAND,
  },
  {
    config: "mainhand" as const,
    engineId: "adaptive_strike_mh",
    hits: 1,
    band: ADAPTIVE_STRIKE_PRIMARY_BAND,
  },
  {
    // MH + shield uses the main-hand form (not dual).
    config: "shield" as const,
    engineId: "adaptive_strike_mh",
    hits: 1,
    band: ADAPTIVE_STRIKE_PRIMARY_BAND,
  },
];

const ILLEGAL = ["defender", "necromancy"] as const;

describe("adaptiveStrikeEngineId", () => {
  it.each(LEGAL)("maps $config -> $engineId", ({ config, engineId }) => {
    expect(adaptiveStrikeEngineId(config)).toBe(engineId);
  });

  it.each(ILLEGAL)("returns null for %s", (config) => {
    expect(adaptiveStrikeEngineId(config)).toBeNull();
  });

  it("returns null when weapon configuration is missing", () => {
    expect(adaptiveStrikeEngineId(undefined)).toBeNull();
  });
});

describe("weaponConfigurationFromBarSetup", () => {
  it("maps wiki setup labels", () => {
    expect(weaponConfigurationFromBarSetup("Two-handed")).toBe("twohand");
    expect(weaponConfigurationFromBarSetup("Dual wield")).toBe("dualwield");
    expect(weaponConfigurationFromBarSetup("Dual-wield")).toBe("dualwield");
    expect(weaponConfigurationFromBarSetup("Any")).toBeUndefined();
    expect(weaponConfigurationFromBarSetup(undefined)).toBeUndefined();
  });
});

describe("Adaptive Strike catalogue selection", () => {
  it.each(LEGAL)(
    "resolveBarSlot picks $engineId from weaponConfiguration=$config",
    ({ config, engineId, hits, band }) => {
      const slot = resolveBarSlot(
        { name: "Adaptive Strike", abilityId: "melee:adaptive-strike" },
        ENGINE_SPECS,
        "melee",
        "Any",
        config,
      );
      expect(slot.modelledBy).toBe("engine");
      expect(slot.spec?.id).toBe(engineId);
      expect(slot.spec?.hits).toHaveLength(hits);
      expect(slot.spec?.hits.every((h) => h.band.minPct === band.minPct && h.band.maxPct === band.maxPct)).toBe(
        true,
      );
    },
  );

  it("resolveBarSlot prefers weaponConfiguration over mismatched setup", () => {
    const slot = resolveBarSlot(
      { name: "Adaptive Strike", abilityId: "melee:adaptive-strike" },
      ENGINE_SPECS,
      "melee",
      "Two-handed",
      "dualwield",
    );
    expect(slot.spec?.id).toBe("adaptive_strike_dw");
  });

  it("resolveBarSlot maps setup when weaponConfiguration is omitted", () => {
    const th = resolveBarSlot(
      { name: "Adaptive Strike", abilityId: "melee:adaptive-strike" },
      ENGINE_SPECS,
      "melee",
      "Two-handed",
    );
    expect(th.spec?.id).toBe("adaptive_strike_2h");
    const dw = resolveBarSlot(
      { name: "Adaptive Strike", abilityId: "melee:adaptive-strike" },
      ENGINE_SPECS,
      "melee",
      "Dual wield",
    );
    expect(dw.spec?.id).toBe("adaptive_strike_dw");
  });

  it.each(ILLEGAL)("resolveBarSlot is unmodelled for %s", (config) => {
    const slot = resolveBarSlot(
      { name: "Adaptive Strike", abilityId: "melee:adaptive-strike" },
      ENGINE_SPECS,
      "melee",
      "Any",
      config,
    );
    expect(slot.modelledBy).toBe("unmodelled");
    expect(slot.spec).toBeNull();
  });

  it("resolveBarSlot is unmodelled when setup is Any and config is missing", () => {
    const slot = resolveBarSlot(
      { name: "Adaptive Strike", abilityId: "melee:adaptive-strike" },
      ENGINE_SPECS,
      "melee",
      "Any",
    );
    expect(slot.modelledBy).toBe("unmodelled");
    expect(slot.spec).toBeNull();
  });
});

describe("Adaptive Strike cast legality", () => {
  it.each(LEGAL)("casts $engineId under $config", ({ config, engineId, hits }) => {
    const ability = abilityById(MELEE_ABILITIES, engineId);
    expect(meetsWeaponRequirement(ability, config)).toBe(true);
    const ctx = createCastContext({
      ...baseInput,
      weaponConfiguration: config,
    });
    expect(ctx.performCast(ability, 0, false).ok).toBe(true);

    const summary = simulate({
      ...baseInput,
      weaponConfiguration: config,
      rotation: rotationOf(engineId),
    });
    expect(summary.ok).toBe(true);
    expect(summary.casts).toHaveLength(1);
    expect(summary.casts[0]!.abilityId).toBe(engineId);
    expect(summary.casts[0]!.result.hits).toHaveLength(hits);
  });

  it.each(ILLEGAL)("rejects every Adaptive form under %s", (config) => {
    for (const id of ["adaptive_strike_2h", "adaptive_strike_mh", "adaptive_strike_dw"] as const) {
      const ability = abilityById(MELEE_ABILITIES, id);
      expect(meetsWeaponRequirement(ability, config)).toBe(false);
      const ctx = createCastContext({
        ...baseInput,
        weaponConfiguration: config,
      });
      expect(ctx.performCast(ability, 0, false).ok).toBe(false);
    }
  });

  it("MH form fails on dual/2h; DW fails on mainhand; 2h fails on mainhand", () => {
    const mh = abilityById(MELEE_ABILITIES, "adaptive_strike_mh");
    const dw = abilityById(MELEE_ABILITIES, "adaptive_strike_dw");
    const th = abilityById(MELEE_ABILITIES, "adaptive_strike_2h");
    expect(meetsWeaponRequirement(mh, "dualwield")).toBe(false);
    expect(meetsWeaponRequirement(mh, "twohand")).toBe(false);
    expect(meetsWeaponRequirement(mh, "shield")).toBe(true);
    expect(meetsWeaponRequirement(mh, "mainhand")).toBe(true);
    expect(meetsWeaponRequirement(dw, "mainhand")).toBe(false);
    expect(meetsWeaponRequirement(th, "mainhand")).toBe(false);
  });

  it("Icy Tempest is a weapon special gated by special access, not weapon shape", () => {
    const tempest = abilityById(MELEE_ABILITIES, "icy_tempest");
    expect(tempest.weaponSpecial).toBe(true);
    expect(tempest.requiresSpecialAccess).toBe(true);
    expect(tempest.weaponRequirement).toBeUndefined();
    // No shape gate: EoF path may cast on 2h; access is equipment specialAttackId / EoF.
    for (const shape of ["mainhand", "shield", "defender", "dualwield", "twohand"] as const) {
      expect(meetsWeaponRequirement(tempest, shape)).toBe(true);
    }
    // Passive alone is not enough.
    expect(
      resolveAbilityCastAvailability(tempest, {
        weaponConfiguration: "dualwield",
        equipmentIds: [],
        passiveIds: ["leng-endless-frost"],
      }).available,
    ).toBe(false);
    // Native Leng MH unlocks.
    expect(
      resolveAbilityCastAvailability(tempest, {
        weaponConfiguration: "dualwield",
        equipmentIds: ["item:dark-shard-of-leng"],
      }).available,
    ).toBe(true);
    // EoF unlocks without Leng MH.
    expect(
      resolveAbilityCastAvailability(tempest, {
        weaponConfiguration: "twohand",
        equipmentIds: ["item:essence-of-finality"],
      }).available,
    ).toBe(true);
  });

  it("Flurry still accepts defender as dual-wield", () => {
    const flurry = abilityById(MELEE_ABILITIES, "flurry");
    expect(meetsWeaponRequirement(flurry, "defender")).toBe(true);
    expect(meetsWeaponRequirement(flurry, "dualwield")).toBe(true);
  });
});

describe("Adaptive Strike solver pool", () => {
  it.each(LEGAL)("pool under $config contains only $engineId Adaptive form", ({ config, engineId }) => {
    const pool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: config,
    });
    const adaptive = ["adaptive_strike_2h", "adaptive_strike_mh", "adaptive_strike_dw"] as const;
    for (const id of adaptive) {
      expect(pool.byId.has(id)).toBe(id === engineId);
    }
  });

  it.each(ILLEGAL)("pool under %s contains no Adaptive form", (config) => {
    const pool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: config,
    });
    expect(pool.byId.has("adaptive_strike_2h")).toBe(false);
    expect(pool.byId.has("adaptive_strike_mh")).toBe(false);
    expect(pool.byId.has("adaptive_strike_dw")).toBe(false);
  });
});

describe("production bar resolution with weaponConfiguration", () => {
  it("mainhand overrides dual-wield bar setup to MH form", () => {
    const dualSetup = "Dual wield";
    const slot = resolveBarSlot(
      { name: "Adaptive Strike", abilityId: "melee:adaptive-strike" },
      ENGINE_SPECS,
      "melee",
      dualSetup,
      "mainhand",
    );
    expect(slot.modelledBy).toBe("engine");
    expect(slot.spec?.id).toBe("adaptive_strike_mh");
  });

  it("shield with dual bar setup selects MH Adaptive form", () => {
    const slot = resolveBarSlot(
      { name: "Adaptive Strike", abilityId: "melee:adaptive-strike" },
      ENGINE_SPECS,
      "melee",
      "Dual wield",
      "shield",
    );
    expect(slot.modelledBy).toBe("engine");
    expect(slot.spec?.id).toBe("adaptive_strike_mh");
  });

  it("defender with dual bar setup leaves Adaptive unmodelled", () => {
    const slot = resolveBarSlot(
      { name: "Adaptive Strike", abilityId: "melee:adaptive-strike" },
      ENGINE_SPECS,
      "melee",
      "Dual wield",
      "defender",
    );
    expect(slot.modelledBy).toBe("unmodelled");
    expect(slot.spec).toBeNull();
  });

  it("twohand config wins over Dual wield setup string", () => {
    const slot = resolveBarSlot(
      { name: "Adaptive Strike", abilityId: "melee:adaptive-strike" },
      ENGINE_SPECS,
      "melee",
      "Dual wield",
      "twohand",
    );
    expect(slot.spec?.id).toBe("adaptive_strike_2h");
  });
});
