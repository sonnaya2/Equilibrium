import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../styles/necromancy/abilities";
import { combatAbilities, combatRevolutionBars } from "./index";
import type { RevolutionBarRecord } from "./records";
import { engineIdForRecord, resolveBar, resolveBarSlot, revoManagedSlots } from "./specs";

const ENGINE_SPECS: ReadonlyMap<string, AbilitySpec> = new Map(
  [
    ...MELEE_ABILITIES,
    ...RANGED_ABILITIES,
    ...MAGIC_ABILITIES,
    ...NECROMANCY_ABILITIES,
    volleyOfSouls(3),
  ].map((spec) => [spec.id, spec]),
);

/** Melee record ids that must map to engine AbilitySpecs present in ENGINE_SPECS. */
const MELEE_RECORD_ENGINE_PAIRS: Array<[string, string]> = [
  ["melee:attack", "attack"],
  ["melee:rend", "rend"],
  ["melee:fury", "fury"],
  ["melee:greater-fury", "greater_fury"],
  ["melee:backhand", "backhand"],
  ["melee:punish", "punish"],
  ["melee:barge", "barge"],
  ["melee:greater-barge", "greater_barge"],
  ["melee:dismember", "dismember"],
  ["melee:slaughter", "slaughter"],
  ["melee:massacre", "massacre"],
  ["melee:assault", "assault"],
  ["melee:flurry", "flurry"],
  ["melee:greater-flurry", "greater_flurry"],
  ["melee:hurricane", "hurricane"],
  ["melee:overpower", "overpower"],
  ["melee:pulverise", "pulverise"],
  ["melee:berserk", "berserk"],
  ["melee:meteor-strike", "meteor_strike"],
  ["melee:chaos-roar", "chaos_roar"],
];

describe("ENGINE_ID_BY_RECORD_ID melee", () => {
  it("maps every post-mod melee record id to an engine AbilitySpec", () => {
    for (const [recordId, engineId] of MELEE_RECORD_ENGINE_PAIRS) {
      expect(engineIdForRecord(recordId), recordId).toBe(engineId);
      expect(ENGINE_SPECS.has(engineId), engineId).toBe(true);
    }
  });

  it("does not invent mappings for utility/shared skips", () => {
    expect(engineIdForRecord("shared:sacrifice")).toBeUndefined();
    expect(engineIdForRecord("melee:bladed-dive")).toBeUndefined();
    expect(engineIdForRecord("melee:dive")).toBeUndefined();
  });

  it("resolveBarSlot prefers engine over record adapter for Revo melee slots", () => {
    const flurry = resolveBarSlot(
      { name: "Flurry", abilityId: "melee:flurry" },
      ENGINE_SPECS,
      "melee",
    );
    expect(flurry.modelledBy).toBe("engine");
    expect(flurry.spec?.id).toBe("flurry");
    expect(flurry.spec?.hits).toHaveLength(8);

    const meteor = resolveBarSlot(
      { name: "Meteor Strike", abilityId: "melee:meteor-strike" },
      ENGINE_SPECS,
      "melee",
    );
    expect(meteor.modelledBy).toBe("engine");
    expect(meteor.spec?.hits[0]?.band).toEqual({ minPct: 220, maxPct: 250 });

    const pulverise = resolveBarSlot(
      { name: "Pulverise", abilityId: "melee:pulverise" },
      ENGINE_SPECS,
      "melee",
    );
    expect(pulverise.modelledBy).toBe("engine");
    expect(pulverise.spec?.hits[0]?.band).toEqual({ minPct: 300, maxPct: 340 });
  });
});

describe("melee revolution bars", () => {
  it("resolves dual-wield PvME ST slots via engine", () => {
    const bar = combatRevolutionBars.records.find((b) => b.id === "melee-dual-wield")!;
    const resolved = resolveBar(bar, ENGINE_SPECS);
    for (const slot of resolved) {
      expect(slot.modelledBy, slot.name).not.toBe("unmodelled");
    }
    expect(resolved.find((s) => s.name === "Greater Flurry")!.spec?.id).toBe("greater_flurry");
    expect(resolved.find((s) => s.name === "Greater Fury")!.spec?.id).toBe("greater_fury");
    expect(resolved.find((s) => s.name === "Chaos Roar")!.spec?.id).toBe("chaos_roar");
    expect(resolved.find((s) => s.name === "Meteor Strike")!.spec?.id).toBe("meteor_strike");
  });

  it("resolves hurricane once the bar slot carries melee:hurricane", () => {
    const hurricane = resolveBarSlot(
      { name: "Hurricane", abilityId: "melee:hurricane" },
      ENGINE_SPECS,
      "melee",
      "Two-handed",
    );
    expect(hurricane.modelledBy).toBe("engine");
    expect(hurricane.spec?.id).toBe("hurricane");
    expect(hurricane.spec?.hits).toHaveLength(2);
  });

  it("two-handed PvME ST bar carries Hurricane + Pulverise and resolves via engine", () => {
    const bar = combatRevolutionBars.records.find((b) => b.id === "melee-two-handed")!;
    const slot = bar.slots.find((s) => s.name === "Hurricane")!;
    expect(slot.abilityId).toBe("melee:hurricane");
    const resolved = resolveBar(bar, ENGINE_SPECS);
    const hurricane = resolved.find((s) => s.name === "Hurricane")!;
    expect(hurricane.modelledBy).toBe("engine");
    expect(hurricane.spec?.id).toBe("hurricane");
    expect(resolved.find((s) => s.name === "Pulverise")!.modelledBy).toBe("engine");
    expect(resolved.every((s) => s.modelledBy !== "unmodelled")).toBe(true);
  });
});

describe("ENGINE_ID_BY_RECORD_ID magic", () => {
  const MAGIC_RECORD_ENGINE_PAIRS: Array<[string, string]> = [
    ["magic:magic-attack", "magic_attack"],
    ["magic:sonic-wave", "sonic_wave"],
    ["magic:greater-sonic-wave", "greater_sonic_wave"],
    ["magic:dragon-breath", "dragon_breath"],
    ["magic:impact", "impact"],
    ["magic:combust", "combust"],
    ["magic:chain", "chain"],
    ["magic:greater-chain", "greater_chain"],
    ["magic:concentrated-blast", "concentrated_blast"],
    ["magic:greater-concentrated-blast", "greater_concentrated_blast"],
    ["magic:wild-magic", "wild_magic"],
    ["magic:asphyxiate", "asphyxiate"],
    ["magic:asphyxiate-resplendence", "asphyxiate_resplendence"],
    ["magic:corruption-blast", "corruption_blast"],
    ["magic:smoke-tendrils", "smoke_tendrils"],
    ["magic:magma-tempest", "magma_tempest"],
    ["magic:omnipower", "omnipower"],
    ["magic:sunshine", "sunshine"],
    ["magic:greater-sunshine", "greater_sunshine"],
    ["magic:tsunami", "tsunami"],
    ["magic:runic-charge", "runic_charge"],
    ["magic:instability", "instability"],
    ["magic:claws-of-guthix", "claws_of_guthix"],
  ];

  it("maps every filled magic record id to an engine AbilitySpec", () => {
    for (const [recordId, engineId] of MAGIC_RECORD_ENGINE_PAIRS) {
      expect(engineIdForRecord(recordId), recordId).toBe(engineId);
      expect(ENGINE_SPECS.has(engineId), engineId).toBe(true);
    }
  });

  it("resolves magic PvME ST bar slots via engine", () => {
    const magic = resolveBar(
      combatRevolutionBars.records.find((b) => b.id === "magic")!,
      ENGINE_SPECS,
    );
    for (const [name, id] of [
      ["Tsunami", "tsunami"],
      ["Omnipower", "omnipower"],
      ["Corruption Blast", "corruption_blast"],
      ["Dragon Breath", "dragon_breath"],
      ["Greater Chain", "greater_chain"],
      ["Asphyxiate", "asphyxiate"],
    ] as const) {
      const slot = magic.find((s) => s.name === name)!;
      expect(slot.modelledBy, name).toBe("engine");
      expect(slot.spec?.id, name).toBe(id);
    }
  });
});

describe("ENGINE_ID_BY_RECORD_ID necromancy", () => {
  const NECRO_RECORD_ENGINE_PAIRS: Array<[string, string]> = [
    ["necromancy:necromancy", "necromancy_basic"],
    ["necromancy:soul-sap", "soul_sap"],
    ["necromancy:touch-of-death", "touch_of_death"],
    ["necromancy:finger-of-death", "finger_of_death"],
    ["necromancy:death-skulls", "death_skulls"],
    ["necromancy:soul-strike", "soul_strike"],
    ["necromancy:spectral-scythe", "spectral_scythe"],
    ["necromancy:bloat", "bloat"],
    ["necromancy:living-death", "living_death"],
    ["necromancy:volley-of-souls", "volley_of_souls"],
    ["necromancy:blood-siphon", "blood_siphon"],
    ["necromancy:command-skeleton-warrior", "command_skeleton_warrior"],
    ["necromancy:command-putrid-zombie", "command_putrid_zombie"],
    ["necromancy:command-phantom-guardian", "command_phantom_guardian"],
    ["necromancy:death-grasp", "death_grasp"],
  ];

  it("maps every filled necromancy record id to an engine AbilitySpec", () => {
    for (const [recordId, engineId] of NECRO_RECORD_ENGINE_PAIRS) {
      expect(engineIdForRecord(recordId), recordId).toBe(engineId);
      expect(ENGINE_SPECS.has(engineId), engineId).toBe(true);
    }
  });

  it("resolves necromancy Revo++ damage/buff slots via engine; conjures stay unmodelled", () => {
    const bar = combatRevolutionBars.records.find((b) => b.id === "necromancy")!;
    expect(bar.supported).toBe(true);
    const resolved = resolveBar(bar, ENGINE_SPECS);
    for (const [name, id] of [
      ["Death Skulls", "death_skulls"],
      ["Living Death", "living_death"],
      ["Soul Sap", "soul_sap"],
      ["Touch of Death", "touch_of_death"],
      ["Volley of Souls", "volley_of_souls"],
      ["Finger of Death", "finger_of_death"],
      ["Bloat", "bloat"],
    ] as const) {
      const slot = resolved.find((s) => s.name === name)!;
      expect(slot.modelledBy, name).toBe("engine");
      expect(slot.spec?.id, name).toBe(id);
    }
    expect(resolved.find((s) => s.name === "Sacrifice")!.modelledBy).toBe("record");
    for (const name of ["Conjure Undead Army", "Conjure Vengeful Ghost", "Conjure Skeleton Warrior"]) {
      expect(resolved.find((s) => s.name === name)!.modelledBy, name).toBe("unmodelled");
    }
  });
});

describe("revolution bar resolve coverage matrix", () => {
  it("reports engine | record | unmodelled counts for PvME ST bars", () => {
    const matrix: Record<string, { engine: number; record: number; unmodelled: number }> = {};
    for (const bar of combatRevolutionBars.records) {
      const counts = { engine: 0, record: 0, unmodelled: 0 };
      for (const slot of resolveBar(bar, ENGINE_SPECS)) {
        counts[slot.modelledBy]++;
      }
      matrix[bar.id] = counts;
    }
    // PvME ST dual-wield: 10 engine.
    expect(matrix["melee-dual-wield"]).toEqual({ engine: 10, record: 0, unmodelled: 0 });
    // PvME ST 2h: 11 engine (incl. Hurricane + Pulverise).
    expect(matrix["melee-two-handed"]).toEqual({ engine: 11, record: 0, unmodelled: 0 });
    // PvME ST ranged: all engine (no Sacrifice on this bar).
    expect(matrix.ranged).toEqual({ engine: 10, record: 0, unmodelled: 0 });
    // PvME ST magic: all 10 engine.
    expect(matrix.magic).toEqual({ engine: 10, record: 0, unmodelled: 0 });
    // Necromancy ST: 7 engine + Sacrifice record + 3 conjure nulls.
    expect(matrix.necromancy).toEqual({ engine: 7, record: 1, unmodelled: 3 });
  });
});

describe("revoManagedSlots hybrid revolutionSize", () => {
  it("returns only the revolutionSize prefix; resolveBar keeps the full bar", () => {
    const hybrid: RevolutionBarRecord = {
      id: "test-hybrid",
      name: "Test Hybrid",
      style: "melee",
      setup: "Dual-wield",
      target: "single",
      mode: "hybrid",
      revolutionSize: 2,
      slots: [
        { name: "Berserk", abilityId: "melee:berserk" },
        { name: "Assault", abilityId: "melee:assault" },
        { name: "Manual Keybind", abilityId: "melee:flurry" },
      ],
      replacements: [],
      supported: true,
      sources: [],
    };
    const full = resolveBar(hybrid, ENGINE_SPECS);
    const managed = revoManagedSlots(hybrid, ENGINE_SPECS);
    expect(full).toHaveLength(3);
    expect(managed).toHaveLength(2);
    expect(managed.map((s) => s.name)).toEqual(["Berserk", "Assault"]);
    expect(managed.every((s) => s.modelledBy === "engine")).toBe(true);
    expect(full[2]!.name).toBe("Manual Keybind");
  });
});

describe("melee ability corpus coverage", () => {
  it("every engine melee ability is present in MELEE_ABILITIES", () => {
    const expected = [
      "attack",
      "adaptive_strike_2h",
      "adaptive_strike_dw",
      "rend",
      "fury",
      "greater_fury",
      "backhand",
      "punish",
      "barge",
      "greater_barge",
      "chaos_roar",
      "dismember",
      "slaughter",
      "massacre",
      "assault",
      "flurry",
      "greater_flurry",
      "hurricane",
      "overpower",
      "overpower_igneous",
      "pulverise",
      "berserk",
      "meteor_strike",
    ];
    for (const id of expected) {
      expect(MELEE_ABILITIES.some((a) => a.id === id), id).toBe(true);
    }
  });

  it("melee JSON records that claim damage have engine or record bands", () => {
    const meleeRecords = combatAbilities.records.filter((r) => r.style === "melee");
    for (const r of meleeRecords) {
      if (!r.damagePercent) continue;
      const engineId = engineIdForRecord(r.id);
      if (engineId) {
        expect(ENGINE_SPECS.has(engineId), r.id).toBe(true);
      }
    }
  });
});
