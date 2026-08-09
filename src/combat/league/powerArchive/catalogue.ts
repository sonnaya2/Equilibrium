/**
 * Power Archive perk catalogue.
 *
 * Archive EFFECTIVE maxima come from https://runescape.wiki/w/Power_Archive
 * (verified 2026-08-09). Stored maxima are half of Archive effective when
 * rankScales (doubling rule). Ancient-only perks leave standardMaxStored null.
 *
 * Combat formulas must accept effective ranks up to ancientArchiveMax.
 */

import type { PowerArchivePerkDef, PowerArchivePerkId } from "./types";

const PERK = (
  def: PowerArchivePerkDef,
): PowerArchivePerkDef => def;

/**
 * Stored max = Archive effective / 2 for scaling perks.
 * Power Archive table lists EFFECTIVE ranks after doubling.
 */
export const POWER_ARCHIVE_PERKS: readonly PowerArchivePerkDef[] = [
  PERK({
    id: "absorbative",
    label: "Absorbative",
    wikiPath: "Absorbative",
    icon: "/game/combat/perks/absorbative.webp",
    gizmoKind: "armour",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Chance to reduce incoming attack damage.",
  }),
  PERK({
    id: "aftershock",
    label: "Aftershock",
    wikiPath: "Aftershock",
    icon: "/game/combat/perks/aftershock.webp",
    gizmoKind: "weapon",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "After 50,000 damage, AoE blast for ability damage per rank.",
  }),
  PERK({
    id: "biting",
    label: "Biting",
    wikiPath: "Biting",
    icon: "/game/combat/perks/biting.webp",
    gizmoKind: "both",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "+2% critical strike chance per rank.",
  }),
  PERK({
    id: "brief-respite",
    label: "Brief Respite",
    wikiPath: "Brief_Respite",
    icon: "/game/combat/perks/brief-respite.webp",
    gizmoKind: "armour",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Reduces Guthix's Blessing and Rejuvenate cooldown; heals max LP fraction.",
  }),
  PERK({
    id: "bulwark",
    label: "Bulwark",
    wikiPath: "Bulwark",
    icon: "/game/combat/perks/bulwark.webp",
    gizmoKind: "armour",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Debilitate deals no damage but gains extra duration from shield value.",
  }),
  PERK({
    id: "caroming",
    label: "Caroming",
    wikiPath: "Caroming",
    icon: "/game/combat/perks/caroming.webp",
    gizmoKind: "weapon",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary:
      "+4% ability damage per rank per Ricochet hit. Chain secondary unmodeled.",
  }),
  PERK({
    id: "clear-headed",
    label: "Clear Headed",
    wikiPath: "Clear_Headed",
    icon: "/game/combat/perks/clear-headed.webp",
    gizmoKind: "armour",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Anticipation lasts longer but no longer reduces damage taken.",
  }),
  PERK({
    id: "crackling",
    label: "Crackling",
    wikiPath: "Crackling",
    icon: "/game/combat/perks/crackling.webp",
    gizmoKind: "both",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "Periodic zap for 50% ability damage per rank (60s cooldown).",
  }),
  PERK({
    id: "crystal-shield",
    label: "Crystal Shield",
    wikiPath: "Crystal_Shield_(perk)",
    icon: "/game/combat/perks/crystal-shield.webp",
    gizmoKind: "armour",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Chance on damage taken to convert a share into temporary lifepoints.",
  }),
  PERK({
    id: "devoted",
    label: "Devoted",
    wikiPath: "Devoted",
    icon: "/game/combat/perks/devoted.webp",
    gizmoKind: "armour",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Chance on hit that protection prayers work at 100% for 3s.",
  }),
  PERK({
    id: "energising",
    label: "Energising",
    wikiPath: "Energising",
    icon: "/game/combat/perks/energising.webp",
    gizmoKind: "both",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "Flat accuracy bonus (50 + 25 per rank beyond 1 on base game).",
  }),
  PERK({
    id: "enhanced-devoted",
    label: "Enhanced Devoted",
    wikiPath: "Enhanced_Devoted",
    icon: "/game/combat/perks/enhanced-devoted.webp",
    gizmoKind: "armour",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Higher chance on hit that protection prayers work at 100% for 3s.",
  }),
  PERK({
    id: "equilibrium",
    label: "Equilibrium",
    wikiPath: "Equilibrium",
    icon: "/game/combat/perks/equilibrium.webp",
    gizmoKind: "both",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "+6% ability damage +2%/rank; prevents critical strikes.",
  }),
  PERK({
    id: "eruptive",
    label: "Eruptive",
    wikiPath: "Eruptive",
    icon: "/game/combat/perks/eruptive.webp",
    gizmoKind: "weapon",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "+0.5% ability damage per rank. Formerly named Equilibrium (pre-2024).",
  }),
  PERK({
    id: "flanking",
    label: "Flanking",
    wikiPath: "Flanking",
    icon: "/game/combat/perks/flanking.webp",
    gizmoKind: "weapon",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "Listed stuns lose stun; +40%/rank vs targets not facing you.",
  }),
  PERK({
    id: "impatient",
    label: "Impatient",
    wikiPath: "Impatient",
    icon: "/game/combat/perks/impatient.webp",
    gizmoKind: "both",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "Chance for basic abilities to generate +3 adrenaline.",
  }),
  PERK({
    id: "invigorating",
    label: "Invigorating",
    wikiPath: "Invigorating",
    icon: "/game/combat/perks/invigorating.webp",
    gizmoKind: "both",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "Boosts adrenaline from basic attacks by 5% per rank.",
  }),
  PERK({
    id: "lucky",
    label: "Lucky",
    wikiPath: "Lucky",
    icon: "/game/combat/perks/lucky.webp",
    gizmoKind: "armour",
    standardMaxStored: 5,
    ancientMaxStored: 6,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Chance when hit that damage is reduced to 1.",
  }),
  PERK({
    id: "lunging",
    label: "Lunging",
    wikiPath: "Lunging",
    icon: "/game/combat/perks/lunging.webp",
    gizmoKind: "weapon",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "Increases Combust and Dismember damage.",
  }),
  PERK({
    id: "precise",
    label: "Precise",
    wikiPath: "Precise",
    icon: "/game/combat/perks/precise.webp",
    gizmoKind: "weapon",
    standardMaxStored: 5,
    ancientMaxStored: 6,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "Raises minimum damage by 1.5% of maximum per rank.",
  }),
  PERK({
    id: "preparation",
    label: "Preparation",
    wikiPath: "Preparation_(perk)",
    icon: "/game/combat/perks/preparation.webp",
    gizmoKind: "armour",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Preparation ability duration and cooldown increased.",
  }),
  PERK({
    id: "relentless",
    label: "Relentless",
    wikiPath: "Relentless",
    icon: "/game/combat/perks/relentless.webp",
    gizmoKind: "both",
    standardMaxStored: null,
    ancientMaxStored: 5,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "Chance to prevent adrenaline consumption (30s internal CD). Ancient only.",
  }),
  PERK({
    id: "ruthless",
    label: "Ruthless",
    wikiPath: "Ruthless",
    icon: "/game/combat/perks/ruthless.webp",
    gizmoKind: "weapon",
    standardMaxStored: null,
    ancientMaxStored: 3,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "On kill: +0.5% damage per rank per stack, max 5 stacks, 20s. Ancient only.",
  }),
  PERK({
    id: "scavenging",
    label: "Scavenging",
    wikiPath: "Scavenging",
    icon: "/game/combat/perks/scavenging.webp",
    gizmoKind: "weapon",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Chance for uncommon Invention components from combat.",
  }),
  PERK({
    id: "shield-bashing",
    label: "Shield Bashing",
    wikiPath: "Shield_Bashing",
    icon: "/game/combat/perks/shield-bashing.webp",
    gizmoKind: "both",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary:
      "Increases Debilitate damage. (Debilitate not in engine yet - rank wires; no DPS until ability ships.)",
  }),
  PERK({
    id: "spendthrift",
    label: "Spendthrift",
    wikiPath: "Spendthrift",
    icon: "/game/combat/perks/spendthrift.webp",
    gizmoKind: "weapon",
    standardMaxStored: 5,
    ancientMaxStored: 6,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "Chance to deal extra damage equal to rank% at 1 coin per extra damage.",
  }),
  PERK({
    id: "trophy-takers",
    label: "Trophy-taker's",
    wikiPath: "Trophy-taker%27s",
    icon: "/game/combat/perks/trophy-takers.webp",
    gizmoKind: "weapon",
    standardMaxStored: 5,
    ancientMaxStored: 6,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Slayer assignment kill-count weighting on slain creatures.",
  }),
  PERK({
    id: "turtling",
    label: "Turtling",
    wikiPath: "Turtling",
    icon: "/game/combat/perks/turtling.webp",
    gizmoKind: "armour",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "ui-only",
    effectSummary: "Barricade duration and cooldown increased.",
  }),
  PERK({
    id: "ultimatums",
    label: "Ultimatums",
    wikiPath: "Ultimatums",
    icon: "/game/combat/perks/ultimatums.webp",
    gizmoKind: "both",
    standardMaxStored: 3,
    ancientMaxStored: 4,
    rankScales: true,
    combatScope: "offensive",
    effectSummary: "Ultimate abilities gain base damage (4% + 1%/rank).",
  }),
];

const BY_ID: ReadonlyMap<PowerArchivePerkId, PowerArchivePerkDef> = new Map(
  POWER_ARCHIVE_PERKS.map((p) => [p.id, p]),
);

export function powerArchivePerk(id: PowerArchivePerkId): PowerArchivePerkDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Unknown Power Archive perk: ${id}`);
  return def;
}

export function isPowerArchivePerkId(value: string): value is PowerArchivePerkId {
  return BY_ID.has(value as PowerArchivePerkId);
}

export function powerArchiveWikiUrl(def: PowerArchivePerkDef): string {
  return `https://runescape.wiki/w/${def.wikiPath}`;
}

/** Archive effective max for a shell type after doubling (when rankScales). */
export function archiveEffectiveMax(
  def: PowerArchivePerkDef,
  ancient: boolean,
): number | null {
  const stored = ancient ? def.ancientMaxStored : def.standardMaxStored;
  if (stored == null) return null;
  return def.rankScales ? stored * 2 : stored;
}

export function storedMaxForShell(
  def: PowerArchivePerkDef,
  ancient: boolean,
): number | null {
  return ancient ? def.ancientMaxStored : def.standardMaxStored;
}

export function gizmoAcceptsPerk(
  shell: "weapon" | "armour",
  def: PowerArchivePerkDef,
  ancient: boolean,
): boolean {
  const max = storedMaxForShell(def, ancient);
  if (max == null || max < 1) return false;
  if (def.gizmoKind === "both") return true;
  return def.gizmoKind === shell;
}

/** Expected Archive effective maxima from the League page (audit target). */
export const POWER_ARCHIVE_EFFECTIVE_MAXIMA: Readonly<
  Record<PowerArchivePerkId, { standard: number | null; ancient: number | null }>
> = Object.fromEntries(
  POWER_ARCHIVE_PERKS.map((p) => [
    p.id,
    {
      standard: archiveEffectiveMax(p, false),
      ancient: archiveEffectiveMax(p, true),
    },
  ]),
) as Record<PowerArchivePerkId, { standard: number | null; ancient: number | null }>;
