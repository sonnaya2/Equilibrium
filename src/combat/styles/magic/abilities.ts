import type { SourceReference } from "../../types";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import {
  BLOOMING_BURROW_WIKI_2026_03_30,
  MODERNISATION_WIKI,
  REFINEMENTS_WIKI_2026_03_09,
  RUNIC_CHARGE_WIKI,
} from "../../data/sources";

/**
 * Post-modernisation magic records, seeded from docs/combat-changelog.md
 * (§5.6/§5.8, §6, §8). The corpus itself flags magic ability-by-ability data as
 * needing a dedicated pass — records carry only what the changelog pins down;
 * average-only numbers stay effect notes instead of fabricated bands.
 */
export interface MagicAbilitySpec extends AbilitySpec {
  style: "magic";
  /** Cast only under Anima Charged (Runic Charge); the unempowered band is unsourced. */
  requiresAnima?: boolean;
  source: SourceReference;
}

export const MAGIC_ABILITIES: MagicAbilitySpec[] = [
  {
    id: "magic_attack",
    name: "Magic basic attack",
    style: "magic",
    category: "basic",
    autoAttack: true,
    hits: [{ band: { minPct: 90, maxPct: 110 } }],
    adrenaline: { gain: 9 },
    source: MODERNISATION_WIKI,
  },
  {
    id: "runic_charge",
    name: "Runic Charge",
    style: "magic",
    category: "utility",
    hits: [],
    buff: "runic_charge",
    offGcd: true,
    cooldownSeconds: 30,
    source: RUNIC_CHARGE_WIKI,
  },
  {
    id: "dragon_breath_empowered",
    name: "Dragon Breath (Runic-Charged)",
    style: "magic",
    category: "enhanced",
    hits: [{ band: { minPct: 260, maxPct: 310 } }],
    requiresAnima: true,
    source: RUNIC_CHARGE_WIKI,
  },
];

/** Sourced numbers whose full hit bands are not yet pinned — notes, not calculable abilities. */
export const MAGIC_EFFECTS = [
  {
    id: "sonic_wave",
    name: "Sonic Wave",
    notes:
      "Next ability −10% adrenaline cost (Greater −20%); Runic-Charged: −35% (Greater −45%). Band not yet sourced.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "concentrated_blast",
    name: "Concentrated Blast",
    notes:
      "Per-hit crit-chance grant 5% (Greater 7%); Runic-Charged 15%/17% per the current Critical strike page — the CSM table's +20% is unresolved (changelog §10).",
    source: MODERNISATION_WIKI,
  },
  {
    id: "dragon_breath",
    name: "Dragon Breath",
    notes:
      "+25% against combusted targets. Base band not yet sourced; the Runic-Charged band (260–310%) is modelled as dragon_breath_empowered.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "wild_magic",
    name: "Wild Magic",
    adrenaline: { cost: 25 },
    cooldownSeconds: 5.4,
    notes:
      "2 hits at 140% AVG; since 30 Mar each hit gains +20% critical strike damage and +10% critical strike chance. Band range not yet sourced.",
    source: BLOOMING_BURROW_WIKI_2026_03_30,
  },
  {
    id: "asphyxiate",
    name: "Asphyxiate",
    adrenaline: { cost: 25 },
    notes:
      "Live range recorded as 120–140% per hit (post said 130%); full channel grants Channelled Might. Hit count not yet sourced.",
    source: BLOOMING_BURROW_WIKI_2026_03_30,
  },
  {
    id: "smoke_tendrils",
    name: "Smoke Tendrils",
    notes: "0% adrenaline, guaranteed crits, escalating hits. Bands not yet sourced.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "tsunami",
    name: "Tsunami",
    notes: "Keeps crit-adrenaline (8% per crit since Mar 2024). Band not yet sourced.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "corruption_blast",
    name: "Corruption Blast",
    category: "enhanced" as const,
    adrenaline: { cost: 20 },
    notes: "100% initial hit plus decaying hits. Decay profile not yet sourced.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "magma_tempest",
    name: "Magma Tempest",
    adrenaline: { cost: 20 },
    notes: "40% per hit. Hit count not yet sourced.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "rune_consumption",
    name: "Rune consumption",
    notes: "Any magic ability can consume runes, 15% per cast (was 20% at release, changed 9 Mar).",
    source: REFINEMENTS_WIKI_2026_03_09,
  },
];
