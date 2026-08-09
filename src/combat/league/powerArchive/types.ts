/**
 * Power Archive (God Tier 2 Balance blessing) types.
 * Wiki: https://runescape.wiki/w/Power_Archive
 *
 * Stored ranks are craftable gizmo ranks. Effective ranks are archive-doubled
 * combat ranks. Do not persist effective ranks.
 */

export const POWER_ARCHIVE_BLESSING_ID = "power-archive" as const;

export const POWER_ARCHIVE_SLOT_CAP = 20;

export const POWER_ARCHIVE_GIZMO_PERK_CAP = 2;

export type PowerArchiveShell = "weapon" | "armour";

export type PowerArchiveGizmoKind = "weapon" | "armour" | "both";

export type PowerArchiveCombatScope = "offensive" | "ui-only";

export type PowerArchivePerkId =
  | "absorbative"
  | "aftershock"
  | "biting"
  | "brief-respite"
  | "bulwark"
  | "caroming"
  | "clear-headed"
  | "crackling"
  | "crystal-shield"
  | "devoted"
  | "energising"
  | "enhanced-devoted"
  | "equilibrium"
  | "eruptive"
  | "flanking"
  | "impatient"
  | "invigorating"
  | "lucky"
  | "lunging"
  | "precise"
  | "preparation"
  | "relentless"
  | "ruthless"
  | "scavenging"
  | "shield-bashing"
  | "spendthrift"
  | "trophy-takers"
  | "turtling"
  | "ultimatums";

export interface PowerArchivePerkDef {
  readonly id: PowerArchivePerkId;
  readonly label: string;
  readonly wikiPath: string;
  readonly icon: string;
  readonly gizmoKind: PowerArchiveGizmoKind;
  /** Null when the perk cannot roll on standard (non-ancient) shells. */
  readonly standardMaxStored: number | null;
  readonly ancientMaxStored: number | null;
  /** False for rankless perks; Archive does not double non-scaling effects. */
  readonly rankScales: boolean;
  readonly combatScope: PowerArchiveCombatScope;
  readonly effectSummary: string;
}

export interface PowerArchivePerkEntry {
  readonly perkId: PowerArchivePerkId;
  /** Craftable rank on the stored gizmo (pre-double). */
  readonly rank: number;
}

export interface PowerArchiveGizmoSlot {
  readonly id: string;
  readonly shell: PowerArchiveShell;
  readonly ancient: boolean;
  readonly perks: readonly PowerArchivePerkEntry[];
}

export interface PowerArchiveState {
  readonly slots: readonly PowerArchiveGizmoSlot[];
}

/** One resolved combat rank after highest-wins merge. */
export interface ResolvedArchivePerk {
  readonly perkId: PowerArchivePerkId;
  readonly storedRank: number;
  readonly effectiveRank: number;
  readonly fromArchive: boolean;
  readonly combatScope: PowerArchiveCombatScope;
}

export interface ResolvePowerArchiveInput {
  /** Equipment flat ranks keyed by catalogue id. Rank 0 / missing = absent. */
  readonly equipmentRanks: Readonly<Partial<Record<PowerArchivePerkId, number>>>;
  readonly archive: PowerArchiveState | null | undefined;
  /** True only when the Power Archive blessing is active. */
  readonly archiveActive: boolean;
}
