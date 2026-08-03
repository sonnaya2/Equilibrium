import type { RegionId } from "@/league";

/**
 * Archaeology monolith relic powers (Mysterious monolith).
 * https://runescape.wiki/w/Relic_powers
 * Energy: tutorial/research ladder to 500; Mysterious City +150 -> 650.
 * Equilibrium product: 650 when Anachronia is unlocked (Orthen / City path).
 * Active energy budget is simultaneous (not permanently spent).
 * Max 3 active powers at once (MONOLITH_ACTIVE_LIMIT).
 */

export const MONOLITH_ENERGY_DEFAULT = 500 as const;
export const MONOLITH_ENERGY_EXTENDED = 650 as const;
export type MonolithEnergyCap = typeof MONOLITH_ENERGY_DEFAULT | typeof MONOLITH_ENERGY_EXTENDED;
/** In-game max simultaneous active relic powers (plus energy budget). */
export const MONOLITH_ACTIVE_LIMIT = 3 as const;

/** League region that unlocks the 650 energy cap. */
export const MONOLITH_EXTENDED_REGION: RegionId = "anachronia";

export type ArchRelicCategory = "combat" | "skilling" | "luck" | "experience" | "other";
export type ArchaeologyRelicImplementation = "full" | "energy-only";
/** @deprecated alias */
export type ArchRelicImplementation = ArchaeologyRelicImplementation;

export const ARCH_CATEGORY_ORDER: readonly ArchRelicCategory[] = [
  "combat",
  "skilling",
  "luck",
  "experience",
  "other",
] as const;

export const ARCH_CATEGORY_LABEL: Readonly<Record<ArchRelicCategory, string>> = {
  combat: "Combat",
  skilling: "Skilling",
  luck: "Luck",
  experience: "Experience",
  other: "Other",
};

export interface ArchaeologyRelicDefinition {
  id: string;
  name: string;
  energyCost: number;
  category: ArchRelicCategory;
  /** Dig-site / collection regions (league ids). */
  requiredRegions: readonly RegionId[];
  /** public path under /game/upgrades/permanent-unlocks/ when asset exists */
  icon?: string;
  effect?: string;
  /** full = combat pipeline / loadout buff; energy-only = selection + budget only. */
  implementation: ArchaeologyRelicImplementation;
}

/** @deprecated alias of ArchaeologyRelicDefinition */
export type ArchaeologyRelic = ArchaeologyRelicDefinition;

export interface ArchaeologySelectionState {
  selectedIds: string[];
  energyCap: MonolithEnergyCap;
}

export type ArchaeologyState = ArchaeologySelectionState;

const PERM = (slug: string) => `/game/upgrades/permanent-unlocks/${slug}.webp`;

/** Wiki list (33). Energy from Relic powers; regions dig-site / collection best-effort. */
export const ARCHAEOLOGY_RELICS: readonly ArchaeologyRelicDefinition[] = [
  {
    id: "font_of_life",
    name: "Font of Life",
    energyCost: 50,
    category: "combat",
    requiredRegions: ["misthalin"],
    icon: PERM("font-of-life"),
    effect: "Increases maximum life points by 500.",
    implementation: "energy-only",
  },
  {
    id: "berserkers_fury",
    name: "Berserker's Fury",
    energyCost: 250,
    category: "combat",
    requiredRegions: ["morytania"],
    icon: PERM("berserkers-fury"),
    effect:
      "Up to +5.5% damage as current LP falls below max. Does not stack with Dharok set. Not bleeds.",
    implementation: "full",
  },
  {
    id: "hungry_like_the_wolf",
    name: "Hungry Like the Wolf",
    energyCost: 100,
    category: "combat",
    requiredRegions: ["havenhythe"],
    icon: PERM("hungry-like-the-wolf"),
    effect: "Food heals +100 LP and no longer costs adrenaline.",
    implementation: "energy-only",
  },
  {
    id: "shadows_grace",
    name: "Shadow's Grace",
    energyCost: 50,
    category: "combat",
    requiredRegions: ["misthalin"],
    icon: PERM("shadows-grace"),
    effect:
      "Surge, Escape, Bladed Dive, Dive, and Barge cooldowns -50%. Does not stack with Mobile.",
    implementation: "energy-only",
  },
  {
    id: "blessing_of_het",
    name: "Blessing of Het",
    energyCost: 100,
    category: "combat",
    requiredRegions: ["desert"],
    icon: PERM("blessing-of-het"),
    effect: "Food and potions heal 10% more life points.",
    implementation: "energy-only",
  },
  {
    id: "death_ward",
    name: "Death Ward",
    energyCost: 150,
    category: "combat",
    requiredRegions: ["kandarin", "asgarnia"],
    icon: PERM("death-ward"),
    effect: "5% damage reduction below 50% LP; 10% below 25% LP.",
    implementation: "energy-only",
  },
  {
    id: "fury_of_the_small",
    name: "Fury of the Small",
    energyCost: 150,
    category: "combat",
    requiredRegions: ["kandarin"],
    icon: PERM("fury-of-the-small"),
    effect: "Basic abilities generate +1% adrenaline.",
    implementation: "full",
  },
  {
    id: "persistent_rage",
    name: "Persistent Rage",
    energyCost: 150,
    category: "combat",
    requiredRegions: ["misthalin"],
    icon: PERM("persistent-rage"),
    effect: "Adrenaline generates out of combat instead of draining.",
    implementation: "energy-only",
  },
  {
    id: "heightened_senses",
    name: "Heightened Senses",
    energyCost: 350,
    category: "combat",
    requiredRegions: ["morytania"],
    icon: PERM("heightened-senses"),
    effect: "Increases maximum adrenaline by 10%.",
    implementation: "full",
  },
  {
    id: "conservation_of_energy",
    name: "Conservation of Energy",
    energyCost: 350,
    category: "combat",
    requiredRegions: ["kandarin"],
    icon: PERM("conservation-of-energy"),
    effect: "After an ultimate ability, regain 10% adrenaline.",
    implementation: "full",
  },

  {
    id: "unexpected_diplomacy",
    name: "Unexpected Diplomacy",
    energyCost: 50,
    category: "skilling",
    requiredRegions: ["desert"],
    icon: PERM("unexpected-diplomacy"),
    effect: "+10% reputation gains (Heart, Farming Guild, Menaphos, Mazcab).",
    implementation: "energy-only",
  },
  {
    id: "pouch_protector",
    name: "Pouch Protector",
    energyCost: 100,
    category: "skilling",
    requiredRegions: ["misthalin"],
    icon: PERM("pouch-protector"),
    effect: "Runecrafting pouches never degrade.",
    implementation: "energy-only",
  },
  {
    id: "nexus_mod",
    name: "Nexus Mod",
    energyCost: 150,
    category: "skilling",
    requiredRegions: ["misthalin"],
    icon: PERM("nexus-mod"),
    effect: "Entering the Abyss arrives at the centre.",
    implementation: "energy-only",
  },
  {
    id: "endurance",
    name: "Endurance",
    energyCost: 100,
    category: "skilling",
    requiredRegions: ["asgarnia"],
    icon: PERM("endurance"),
    effect: "Running no longer drains run energy.",
    implementation: "energy-only",
  },
  {
    id: "pharm_ecology",
    name: "Pharm Ecology",
    energyCost: 150,
    category: "skilling",
    requiredRegions: ["asgarnia"],
    icon: PERM("pharm-ecology"),
    effect: "Herb and mushroom patches no longer become diseased.",
    implementation: "energy-only",
  },
  {
    id: "always_adze",
    name: "Always Adze",
    energyCost: 100,
    category: "skilling",
    requiredRegions: ["desert"],
    icon: PERM("always-adze"),
    effect: "Woodcutting always burns logs for Firemaking XP.",
    implementation: "energy-only",
  },
  {
    id: "sticky_fingers",
    name: "Sticky Fingers",
    energyCost: 100,
    category: "skilling",
    requiredRegions: ["fremennik"],
    icon: PERM("sticky-fingers"),
    effect: "Auto-pickpocket rate +50%; experience -33%.",
    implementation: "energy-only",
  },
  {
    id: "deathless",
    name: "Deathless",
    energyCost: 100,
    category: "skilling",
    requiredRegions: ["fremennik"],
    icon: PERM("deathless"),
    effect: "No Dungeoneering death penalty.",
    implementation: "energy-only",
  },
  {
    id: "divine_conversion",
    name: "Divine Conversion",
    energyCost: 100,
    category: "skilling",
    requiredRegions: ["misthalin"],
    icon: PERM("divine-conversion"),
    effect: "Convert entire backpack of memories at a rift in one action.",
    implementation: "energy-only",
  },
  {
    id: "bait_and_switch",
    name: "Bait and Switch",
    energyCost: 100,
    category: "skilling",
    requiredRegions: ["asgarnia"],
    icon: PERM("bait-and-switch"),
    effect: "Fishing produce is cooked when caught.",
    implementation: "energy-only",
  },
  {
    id: "flow_state",
    name: "Flow State",
    energyCost: 200,
    category: "skilling",
    requiredRegions: ["desert"],
    icon: PERM("flow-state"),
    effect: "+20% Archaeology excavation precision; no soil.",
    implementation: "energy-only",
  },
  {
    id: "death_note",
    name: "Death Note",
    energyCost: 150,
    category: "skilling",
    requiredRegions: ["anachronia"],
    icon: PERM("death-note"),
    effect: "Guaranteed bone and ash drops are noted.",
    implementation: "energy-only",
  },
  {
    id: "abyssal_link",
    name: "Abyssal Link",
    energyCost: 250,
    category: "skilling",
    requiredRegions: ["kandarin"],
    icon: PERM("abyssal-link"),
    effect: "Spellbook teleports need no runes; award no Magic XP.",
    implementation: "energy-only",
  },
  {
    id: "slayer_introspection",
    name: "Slayer Introspection",
    energyCost: 200,
    category: "skilling",
    requiredRegions: ["misthalin", "morytania", "kandarin"],
    icon: PERM("slayer-introspection"),
    effect: "Choose min or max assignment size when requesting Slayer tasks.",
    implementation: "energy-only",
  },

  {
    id: "ring_of_luck",
    name: "Ring of Luck",
    energyCost: 50,
    category: "luck",
    requiredRegions: ["morytania"],
    icon: PERM("ring-of-luck"),
    effect: "Always gain tier 1 luck.",
    implementation: "energy-only",
  },
  {
    id: "ring_of_wealth",
    name: "Ring of Wealth",
    energyCost: 100,
    category: "luck",
    requiredRegions: ["morytania"],
    icon: PERM("ring-of-wealth"),
    effect: "Always gain tier 2 luck.",
    implementation: "energy-only",
  },
  {
    id: "ring_of_fortune",
    name: "Ring of Fortune",
    energyCost: 150,
    category: "luck",
    requiredRegions: ["morytania"],
    icon: PERM("ring-of-fortune"),
    effect: "Always gain tier 3 luck.",
    implementation: "energy-only",
  },
  {
    id: "luck_of_the_dwarves",
    name: "Luck of the Dwarves",
    energyCost: 200,
    category: "luck",
    requiredRegions: ["morytania"],
    icon: PERM("luck-of-the-dwarves"),
    effect: "Always gain tier 4 luck.",
    implementation: "energy-only",
  },

  {
    id: "spirit_weaver",
    name: "Spirit Weaver",
    energyCost: 50,
    category: "experience",
    requiredRegions: ["anachronia"],
    icon: PERM("spirit-weaver"),
    effect: "+50% XP when crafting Summoning pouches (one at a time).",
    implementation: "energy-only",
  },
  {
    id: "inspire_love",
    name: "Inspire Love",
    energyCost: 250,
    category: "experience",
    requiredRegions: ["asgarnia"],
    icon: PERM("inspire-love"),
    effect: "+2% XP for support skills (Agility, Dungeoneering, Slayer, Thieving).",
    implementation: "energy-only",
  },
  {
    id: "inspire_effort",
    name: "Inspire Effort",
    energyCost: 250,
    category: "experience",
    requiredRegions: ["morytania"],
    icon: PERM("inspire-effort"),
    effect:
      "+2% XP for gathering skills (Archaeology, Divination, Farming, Fishing, Hunter, Mining, Woodcutting).",
    implementation: "energy-only",
  },
  {
    id: "inspire_genius",
    name: "Inspire Genius",
    energyCost: 250,
    category: "experience",
    requiredRegions: ["asgarnia"],
    icon: PERM("inspire-genius"),
    effect:
      "+2% XP for artisan skills (Crafting, Construction, Cooking, Firemaking, Fletching, Herblore, Runecrafting, Smithing).",
    implementation: "energy-only",
  },
  {
    id: "inspire_awe",
    name: "Inspire Awe",
    energyCost: 250,
    category: "experience",
    requiredRegions: ["kandarin"],
    icon: PERM("inspire-awe"),
    effect:
      "+2% XP for combat skills (Attack, Constitution, Defence, Magic, Prayer, Ranged, Strength, Summoning, Necromancy).",
    implementation: "energy-only",
  },
] as const;

const BY_ID: ReadonlyMap<string, ArchaeologyRelicDefinition> = new Map(
  ARCHAEOLOGY_RELICS.map((r) => [r.id, r]),
);

export function relicById(id: string): ArchaeologyRelicDefinition | undefined {
  return BY_ID.get(id);
}

export function hasAnachronia(unlockedRegions: readonly RegionId[]): boolean {
  return unlockedRegions.includes(MONOLITH_EXTENDED_REGION);
}

/** Cap is derived from Anachronia; requestedCap cannot raise without it. */
export function resolveMonolithEnergyCap(input: {
  unlockedRegions: readonly RegionId[];
  requestedCap?: MonolithEnergyCap | null;
}): MonolithEnergyCap {
  if (hasAnachronia(input.unlockedRegions)) return MONOLITH_ENERGY_EXTENDED;
  return MONOLITH_ENERGY_DEFAULT;
}

export function totalEnergyUsed(selectedIds: readonly string[]): number {
  const seen = new Set<string>();
  let sum = 0;
  for (const id of selectedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const relic = BY_ID.get(id);
    if (relic) sum += relic.energyCost;
  }
  return sum;
}

export function isRelicActive(selectedIds: readonly string[], relicId: string): boolean {
  return selectedIds.includes(relicId);
}

/** Drop unknown ids; trim from the end while over energyCap or over active limit. */
export function sanitizeSelectedRelics(input: {
  selectedIds: readonly string[];
  energyCap: MonolithEnergyCap | number;
  unlockedRegions?: readonly RegionId[];
}): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const id of input.selectedIds) {
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    if (!BY_ID.has(id)) continue;
    seen.add(id);
    kept.push(id);
  }
  const cap = input.energyCap;
  while (kept.length > 0 && totalEnergyUsed(kept) > cap) {
    kept.pop();
  }
  while (kept.length > MONOLITH_ACTIVE_LIMIT) {
    kept.pop();
  }
  return kept;
}

export function sanitizeArchaeologyState(
  state: { selectedIds?: readonly string[]; energyCap?: unknown },
  unlockedRegions: readonly RegionId[],
): ArchaeologySelectionState {
  const energyCap = resolveMonolithEnergyCap({
    unlockedRegions,
    requestedCap:
      state.energyCap === MONOLITH_ENERGY_EXTENDED || state.energyCap === MONOLITH_ENERGY_DEFAULT
        ? state.energyCap
        : null,
  });
  return {
    energyCap,
    selectedIds: sanitizeSelectedRelics({
      selectedIds: state.selectedIds ?? [],
      energyCap,
      unlockedRegions,
    }),
  };
}

export function canSelectRelic(input: {
  relicId: string;
  selectedIds: readonly string[];
  energyCap: MonolithEnergyCap | number;
}): boolean {
  if (input.selectedIds.includes(input.relicId)) return true;
  const relic = BY_ID.get(input.relicId);
  if (!relic) return false;
  const active = new Set(
    input.selectedIds.filter((id) => typeof id === "string" && BY_ID.has(id)),
  );
  if (active.size >= MONOLITH_ACTIVE_LIMIT) return false;
  return totalEnergyUsed(input.selectedIds) + relic.energyCost <= input.energyCap;
}

/** Toggle id; select is a no-op when over energy or at active limit. */
export function toggleArchaeologyRelic(input: {
  relicId: string;
  selectedIds: readonly string[];
  energyCap: MonolithEnergyCap | number;
}): string[] {
  const { relicId, selectedIds, energyCap } = input;
  if (selectedIds.includes(relicId)) {
    return selectedIds.filter((id) => id !== relicId);
  }
  if (!canSelectRelic({ relicId, selectedIds, energyCap })) {
    return [...selectedIds];
  }
  return sanitizeSelectedRelics({
    selectedIds: [...selectedIds, relicId],
    energyCap,
  });
}

export function relicsGroupedByCategory(): {
  category: ArchRelicCategory;
  label: string;
  relics: ArchaeologyRelicDefinition[];
}[] {
  return ARCH_CATEGORY_ORDER.map((category) => ({
    category,
    label: ARCH_CATEGORY_LABEL[category],
    relics: ARCHAEOLOGY_RELICS.filter((r) => r.category === category),
  })).filter((g) => g.relics.length > 0);
}
