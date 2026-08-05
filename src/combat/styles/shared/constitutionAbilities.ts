import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type { CombatStyle, SourceReference } from "../../types";

/**
 * Constitution basics usable on every combat style bar.
 * Registry stores one engine id; pools/bars remap `style` to the active bar.
 *
 * https://runescape.wiki/w/Sacrifice
 * https://runescape.wiki/w/Tuska%27s_Wrath
 */

const SACRIFICE_WIKI: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Sacrifice",
  title: "Sacrifice",
  // Wiki patch 2 Mar 2026: adren 8% -> 9%; band 65-75% since Mar 2024.
  verifiedAt: "2026-08-04",
};

const TUSKAS_WRATH_WIKI: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Tuska%27s_Wrath",
  title: "Tuska's Wrath",
  // Wiki patch 2 Mar 2026: adren 8% -> 9%; band 75-85% since 4 Mar 2024.
  verifiedAt: "2026-08-04",
};

/** Registry / catalogue placeholder style; remapped per bar and candidate pool. */
const SHARED_PLACEHOLDER_STYLE: CombatStyle = "melee";

/** Wiki: heals for 25% of damage dealt (100% on killing blow - not modeled). */
export const SACRIFICE_HEAL_FRACTION = 0.25;

/** Wiki: empowered hit = 10,000% (100x) Slayer level. */
export const TUSKAS_EMPOWERED_SLAYER_MULT = 100;

/** Wiki: empowered Tuska hit cap is 15,000 (not the standard 30k). */
export const TUSKAS_EMPOWERED_HIT_CAP = 15_000;

/** Wiki: empowered-effect cooldown when on task. */
export const TUSKAS_EMPOWERED_COOLDOWN_SECONDS = 120;

/** Wiki: off-task / non-empowered ability cooldown. */
export const TUSKAS_OFF_TASK_COOLDOWN_SECONDS = 15;

export const SACRIFICE: AbilitySpec = {
  // Wiki Sacrifice: 65-75% AD, +9% adren, 30s CD (50 ticks).
  id: "sacrifice",
  name: "Sacrifice",
  style: SHARED_PLACEHOLDER_STYLE,
  category: "basic",
  hits: [{ band: { minPct: 65, maxPct: 75 } }],
  adrenaline: { gain: 9 },
  cooldownSeconds: 30,
  supportNote:
    "Heal 25% of damage dealt (expectedHeal / totalHealed). Kill-blow 100% heal not modeled.",
};

export const TUSKAS_WRATH: AbilitySpec = {
  // Wiki Tuska's Wrath off-task: 75-85% AD, +9% adren, 15s CD (25 ticks).
  // On-task: needs SimulateInput.slayerOnTask + slayerLevel (never invented).
  id: "tuskas_wrath",
  name: "Tuska's Wrath",
  style: SHARED_PLACEHOLDER_STYLE,
  category: "basic",
  hits: [{ band: { minPct: 75, maxPct: 85 } }],
  adrenaline: { gain: 9 },
  cooldownSeconds: TUSKAS_OFF_TASK_COOLDOWN_SECONDS,
  supportNote:
    "Default off-task: 75-85% AD, 15s CD. On-task when slayerOnTask + slayerLevel: 100x Slayer level (15k cap), 120s CD. Flat formula (no AD mods). Dual empowered/off-task CD while empowered is on CD not modeled.",
};

export const SHARED_CONSTITUTION_ABILITIES: readonly AbilitySpec[] = [SACRIFICE, TUSKAS_WRATH];

const SHARED_CONSTITUTION_IDS = new Set(SHARED_CONSTITUTION_ABILITIES.map((a) => a.id));

export function isSharedConstitutionAbilityId(id: string): boolean {
  return SHARED_CONSTITUTION_IDS.has(id);
}

/** Remap a shared constitution ability onto the bar / pool combat style. */
export function abilityStyleForBar(spec: AbilitySpec, barStyle: CombatStyle): AbilitySpec {
  if (!isSharedConstitutionAbilityId(spec.id) || spec.style === barStyle) return spec;
  return { ...spec, style: barStyle };
}

/** Expected self-heal from Sacrifice damage dealt (kill-blow 100% not modeled). */
export function sacrificeExpectedHeal(damageDealt: number): number {
  if (!Number.isFinite(damageDealt) || damageDealt <= 0) return 0;
  return Math.floor(damageDealt * SACRIFICE_HEAL_FRACTION);
}

/**
 * Empowered Tuska damage from Slayer level: min(100 * level, 15000).
 * Returns 0 when level is missing/invalid so callers never invent a level.
 */
export function tuskasEmpoweredDamage(slayerLevel: number | undefined | null): number {
  if (slayerLevel == null || !Number.isFinite(slayerLevel) || slayerLevel <= 0) return 0;
  return Math.min(Math.floor(slayerLevel) * TUSKAS_EMPOWERED_SLAYER_MULT, TUSKAS_EMPOWERED_HIT_CAP);
}

/** True when sim input opts into on-task empower and supplies a usable Slayer level. */
export function tuskasEmpoweredActive(input: {
  slayerOnTask?: boolean;
  slayerLevel?: number;
}): boolean {
  return input.slayerOnTask === true && tuskasEmpoweredDamage(input.slayerLevel) > 0;
}

/** Wiki provenance for tests / tooling (AbilitySpec has no required source field). */
export function sacrificeSource(): SourceReference {
  return SACRIFICE_WIKI;
}

export function tuskasWrathSource(): SourceReference {
  return TUSKAS_WRATH_WIKI;
}
