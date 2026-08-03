import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import type { SimulateInput } from "../../engine/simulation/simulate";

/**
 * The neutral loadout engine tests start from: base ability damage 1000, level
 * 99, full Damage Potential, no crit chance. Every number in a test is then a
 * consequence of the mechanic under test rather than of the setup - which is
 * why these stay flat constants and not a builder with options.

 * Style-specific state (Bloodlust stacks, Necrosis, buff windows, ammo) is
 * always set up in the test itself, by casting. It is never pre-seeded here.
 */
export const baseInput: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MELEE_ABILITIES,
};

export const rangedInput: Omit<SimulateInput, "rotation"> = {
  ...baseInput,
  abilities: RANGED_ABILITIES,
  context: { style: "ranged" },
};

export const magicInput: Omit<SimulateInput, "rotation"> = {
  ...baseInput,
  abilities: MAGIC_ABILITIES,
  context: { style: "magic" },
};

/** Volley's hit count is fixed at cast time, so the 3-soul form is a separate spec. */
export const necroAbilities = [...NECROMANCY_ABILITIES, volleyOfSouls(3)];

export const necroInput: Omit<SimulateInput, "rotation"> = {
  ...baseInput,
  abilities: necroAbilities,
  context: { style: "necromancy" },
};
