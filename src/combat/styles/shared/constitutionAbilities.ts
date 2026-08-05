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
    "TODO: heal 25% of damage dealt (100% on killing blow) not modeled; damage and CD are.",
};

export const TUSKAS_WRATH: AbilitySpec = {
  // Wiki Tuska's Wrath off-task: 75-85% AD, +9% adren, 15s CD (25 ticks).
  // On-task empowered: 10000% of Slayer level, 15k hit cap, 120s empowered CD - not modeled.
  id: "tuskas_wrath",
  name: "Tuska's Wrath",
  style: SHARED_PLACEHOLDER_STYLE,
  category: "basic",
  hits: [{ band: { minPct: 75, maxPct: 85 } }],
  adrenaline: { gain: 9 },
  cooldownSeconds: 15,
  supportNote:
    "TODO: on-task empowered hit (100x Slayer level, 15k cap, 120s empowered CD) not modeled; damage and CD are.",
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

/** Wiki provenance for tests / tooling (AbilitySpec has no required source field). */
export function sacrificeSource(): SourceReference {
  return SACRIFICE_WIKI;
}

export function tuskasWrathSource(): SourceReference {
  return TUSKAS_WRATH_WIKI;
}
