import type { SourceReference } from "../../types";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { MODERNISATION_WIKI, NECROSIS_WIKI, RESIDUAL_SOUL_WIKI } from "../../data/sources";

/**
 * Necromancy was the modernisation's template and saw only minor changes
 * (changelog §5.10), so resource mechanics stay as launched (§1.8). No ability
 * bands are pinned by the changelog — records hold sourced notes only.
 */
export interface NecromancyAbilitySpec extends AbilitySpec {
  style: "necromancy";
  source: SourceReference;
}

export const NECROMANCY_ABILITIES: NecromancyAbilitySpec[] = [];

export const NECROMANCY_EFFECTS = [
  {
    id: "death_skulls",
    name: "Death Skulls",
    adrenaline: { cost: 60 },
    notes:
      "Always costs 60% post-modernisation (igneous cape no longer needed); Living Death reduces its cooldown to 17 ticks, enabling triple Death Skulls.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "touch_of_death",
    name: "Touch of Death",
    notes: "+4 Necrosis stacks.",
    source: NECROSIS_WIKI,
  },
  {
    id: "finger_of_death",
    name: "Finger of Death",
    notes: "Consumes up to 6 Necrosis stacks for −10% adrenaline cost each.",
    source: NECROSIS_WIKI,
  },
  {
    id: "volley_of_souls",
    name: "Volley of Souls",
    notes: "Spends all Residual Souls; one 135–165% hit per soul.",
    source: RESIDUAL_SOUL_WIKI,
  },
  {
    id: "soul_sap",
    name: "Soul Sap",
    notes: "Generates 1 Residual Soul per target hit.",
    source: RESIDUAL_SOUL_WIKI,
  },
  {
    id: "spectral_scythe",
    name: "Spectral Scythe",
    notes: "25% chance to generate a Residual Soul per target hit.",
    source: RESIDUAL_SOUL_WIKI,
  },
  {
    id: "soul_strike",
    name: "Soul Strike",
    notes: "Spends 1 Residual Soul; AoE stun.",
    source: RESIDUAL_SOUL_WIKI,
  },
  {
    id: "necromancy_basic",
    name: "Necromancy basic attack",
    notes:
      "Counts as a basic ability for Impatient and Fury of the Small since the modernisation. Band not yet sourced.",
    source: MODERNISATION_WIKI,
  },
];
