import { describe, expect, it } from "vitest";
import { MAGIC_ABILITIES } from "./magic/abilities";
import { MELEE_ABILITIES } from "./melee/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "./necromancy/abilities";
import { RANGED_ABILITIES } from "./ranged/abilities";

function idsWithCategory(
  abilities: readonly { id: string; category: string }[],
  category: string,
): string[] {
  return abilities.filter((ability) => ability.category === category).map((ability) => ability.id);
}

describe("current ability categories", () => {
  it("keeps the modernized melee categories separate from legacy thresholds", () => {
    expect(idsWithCategory(MELEE_ABILITIES, "basic")).toEqual([
      "attack",
      "adaptive_strike_2h",
      "adaptive_strike_mh",
      "adaptive_strike_dw",
      "rend",
      "fury",
      "greater_fury",
      "backhand",
      "punish",
      "barge",
      "greater_barge",
      "chaos_roar",
    ]);
    expect(idsWithCategory(MELEE_ABILITIES, "enhanced")).toEqual([
      "dismember",
      "slaughter",
      "massacre",
      "assault",
      "flurry",
      "greater_flurry",
      "hurricane",
    ]);
    expect(idsWithCategory(MELEE_ABILITIES, "threshold")).toEqual([]);
  });

  it("keeps the modernized ranged categories separate from legacy thresholds", () => {
    expect(idsWithCategory(RANGED_ABILITIES, "basic")).toEqual([
      "ranged_attack",
      "piercing_shot",
      "binding_shot",
      "galeshot",
      "ricochet",
      "greater_ricochet",
    ]);
    expect(idsWithCategory(RANGED_ABILITIES, "enhanced")).toEqual([
      "balance_by_force",
      "descent_of_darkness",
      "snap_shot",
      "snipe",
      "bombardment",
      "rapid_fire",
      "corruption_shot",
      "shadow_tendrils",
      "imbue_shadows",
    ]);
    expect(idsWithCategory(RANGED_ABILITIES, "threshold")).toEqual([]);
  });

  it("keeps the modernized magic categories separate from legacy thresholds", () => {
    expect(idsWithCategory(MAGIC_ABILITIES, "basic")).toEqual([
      "magic_attack",
      "sonic_wave",
      "greater_sonic_wave",
      "dragon_breath",
      "impact",
      "combust",
      "chain",
      "greater_chain",
      "concentrated_blast",
      "greater_concentrated_blast",
    ]);
    expect(idsWithCategory(MAGIC_ABILITIES, "enhanced")).toEqual([
      "wild_magic",
      "asphyxiate",
      "corruption_blast",
      "smoke_tendrils",
      "magma_tempest",
      "instability",
      "claws_of_guthix",
    ]);
    expect(idsWithCategory(MAGIC_ABILITIES, "threshold")).toEqual([]);
  });

  it("marks Necromancy commands and conjures as Enhanced", () => {
    expect(idsWithCategory(NECROMANCY_ABILITIES, "basic")).toEqual([
      "necromancy_basic",
      "soul_sap",
      "touch_of_death",
    ]);
    expect(idsWithCategory(NECROMANCY_ABILITIES, "enhanced")).toEqual([
      "finger_of_death",
      "soul_strike",
      "spectral_scythe",
      "spectral_scythe_2",
      "spectral_scythe_3",
      "bloat",
      "blood_siphon",
      "command_skeleton_warrior",
      "command_putrid_zombie",
      "command_phantom_guardian",
      "command_vengeful_ghost",
      "death_grasp",
      "conjure_skeleton_warrior",
      "conjure_vengeful_ghost",
      "conjure_putrid_zombie",
      "conjure_phantom_guardian",
      "conjure_undead_army",
    ]);
    expect(idsWithCategory(NECROMANCY_ABILITIES, "threshold")).toEqual([]);
    expect(volleyOfSouls(3).category).toBe("enhanced");
    expect(
      NECROMANCY_ABILITIES.find((ability) => ability.id === "command_phantom_guardian")?.name,
    ).toBe("Command Phantom Guardian");
  });
});
