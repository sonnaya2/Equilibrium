import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { bandOf } from "../../core/abilityDamage";
import { mulFloor } from "../../core/rounding";
import type { CombatStyle, SourceReference } from "../../types";

const SHARED_PLACEHOLDER_STYLE: CombatStyle = "melee";

const BASH_WIKI: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Bash",
  title: "Bash",
  verifiedAt: "2026-08-19",
};

const PREPARATION_WIKI: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Preparation",
  title: "Preparation",
  verifiedAt: "2026-08-19",
};

const DEBILITATE_WIKI: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Debilitate",
  title: "Debilitate",
  verifiedAt: "2026-08-19",
};

export const BASH: AbilitySpec = {
  id: "bash",
  name: "Bash",
  style: SHARED_PLACEHOLDER_STYLE,
  category: "basic",
  hits: [{ band: { minPct: 20, maxPct: 100 } }],
  adrenaline: { gain: 9 },
  cooldownSeconds: 15,
  weaponRequirement: "shield-or-defender",
  supportNote:
    "Outgoing damage is modeled. Ordinary Bash uses 20-100% of ability damage + shield armour + Defence; Steadfast Will adds 350-450% Total Armour as one combined band.",
};

export const PREPARATION: AbilitySpec = {
  id: "preparation",
  name: "Preparation",
  style: SHARED_PLACEHOLDER_STYLE,
  category: "basic",
  stateEffect: "preparation",
  hits: [],
  adrenaline: { gain: 9 },
  cooldownSeconds: 20.4,
  weaponRequirement: "shield-or-defender",
  supportNote:
    "Outgoing cooldown effects are modeled. Base incoming-hit Resonance/Divert reduction and Bone Shield casting are outside the DPS simulation.",
};

export const DEBILITATE: AbilitySpec = {
  id: "debilitate",
  name: "Debilitate",
  style: SHARED_PLACEHOLDER_STYLE,
  category: "threshold",
  hits: [{ band: { minPct: 20, maxPct: 100 } }],
  adrenaline: { cost: 15 },
  cooldownSeconds: 30,
  supportNote:
    "20-100% ability damage. The damage-reduction duration does not affect outgoing DPS.",
};

export const SHARED_DEFENCE_ABILITIES: readonly AbilitySpec[] = [BASH, PREPARATION, DEBILITATE];

export interface BashDamageProfile {
  offhandArmourValue: number;
  defenceLevel: number;
  totalArmour: number;
  steadfastArmourBand?: readonly [number, number];
}

export function bashRawDamageBand(
  abilityDamage: number,
  profile: BashDamageProfile,
): { min: number; max: number } {
  const ordinary = bandOf(
    abilityDamage + profile.offhandArmourValue + profile.defenceLevel,
    BASH.hits[0]!.band,
  );
  const steadfast = profile.steadfastArmourBand;
  if (!steadfast) return { min: ordinary.min, max: ordinary.max };
  return {
    min: ordinary.min + mulFloor(profile.totalArmour, steadfast[0]),
    max: ordinary.max + mulFloor(profile.totalArmour, steadfast[1]),
  };
}

const SHARED_DEFENCE_IDS = new Set(SHARED_DEFENCE_ABILITIES.map((ability) => ability.id));

export function isSharedDefenceAbilityId(id: string): boolean {
  return SHARED_DEFENCE_IDS.has(id);
}

export function bashSource(): SourceReference {
  return BASH_WIKI;
}

export function preparationSource(): SourceReference {
  return PREPARATION_WIKI;
}

export function debilitateSource(): SourceReference {
  return DEBILITATE_WIKI;
}
