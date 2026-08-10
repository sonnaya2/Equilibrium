/**
 * Power Archive effective-rank resolve.
 *
 * Flow: equipment ranks + archive slots (doubled when active)
 * → highest rank wins per perk (wiki Perks: no self-stack)
 * → compile once for combat.
 *
 * https://runescape.wiki/w/Power_Archive
 * https://runescape.wiki/w/Perks
 */

import {
  POWER_ARCHIVE_PERKS,
  gizmoAcceptsPerk,
  isPowerArchivePerkId,
  powerArchivePerk,
  storedMaxForShell,
} from "./catalogue";
import {
  POWER_ARCHIVE_GIZMO_PERK_CAP,
  POWER_ARCHIVE_SLOT_CAP,
  type PowerArchiveGizmoSlot,
  type PowerArchivePerkEntry,
  type PowerArchivePerkId,
  type PowerArchiveShell,
  type PowerArchiveState,
  type ResolvePowerArchiveInput,
  type ResolvedArchivePerk,
} from "./types";

export function archiveEffectiveRank(
  perkId: PowerArchivePerkId,
  storedRank: number,
  fromArchive: boolean,
): number {
  if (!Number.isInteger(storedRank) || storedRank < 1) return 0;
  const def = powerArchivePerk(perkId);
  if (!fromArchive || !def.rankScales) return storedRank;
  return storedRank * 2;
}

/**
 * Highest effective rank wins across equipment and archive sources.
 * Archive-off ignores slots entirely.
 */
export function resolvePowerArchivePerks(
  input: ResolvePowerArchiveInput,
): ReadonlyMap<PowerArchivePerkId, ResolvedArchivePerk> {
  const best = new Map<
    PowerArchivePerkId,
    { stored: number; effective: number; fromArchive: boolean }
  >();

  const consider = (
    perkId: PowerArchivePerkId,
    storedRank: number,
    fromArchive: boolean,
  ): void => {
    if (!Number.isInteger(storedRank) || storedRank < 1) return;
    const def = powerArchivePerk(perkId);
    const effective = archiveEffectiveRank(perkId, storedRank, fromArchive);
    if (effective < 1) return;
    const prev = best.get(perkId);
    if (!prev || effective > prev.effective) {
      best.set(perkId, { stored: storedRank, effective, fromArchive });
      return;
    }
    // Tie: prefer archive source only when effective equal and stored higher.
    if (effective === prev.effective && storedRank > prev.stored) {
      best.set(perkId, { stored: storedRank, effective, fromArchive });
    }
  };

  for (const [id, rank] of Object.entries(input.equipmentRanks) as Array<
    [PowerArchivePerkId, number | undefined]
  >) {
    if (rank == null || rank < 1) continue;
    if (!isPowerArchivePerkId(id)) continue;
    consider(id, rank, false);
  }

  if (input.archiveActive && input.archive) {
    for (const slot of input.archive.slots) {
      for (const entry of slot.perks) {
        consider(entry.perkId, entry.rank, true);
      }
    }
  }

  const out = new Map<PowerArchivePerkId, ResolvedArchivePerk>();
  for (const [perkId, row] of best) {
    const def = powerArchivePerk(perkId);
    out.set(perkId, {
      perkId,
      storedRank: row.stored,
      effectiveRank: row.effective,
      fromArchive: row.fromArchive,
      combatScope: def.combatScope,
    });
  }
  return out;
}

export function effectiveCombatRank(
  resolved: ReadonlyMap<PowerArchivePerkId, ResolvedArchivePerk>,
  perkId: PowerArchivePerkId,
): number {
  return resolved.get(perkId)?.effectiveRank ?? 0;
}

export function emptyPowerArchiveState(): PowerArchiveState {
  return { slots: [] };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function normalizePerkEntry(
  raw: unknown,
  shell: PowerArchiveShell,
  ancient: boolean,
): PowerArchivePerkEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const rec = raw as { perkId?: unknown; rank?: unknown };
  if (typeof rec.perkId !== "string" || !isPowerArchivePerkId(rec.perkId)) return null;
  const def = powerArchivePerk(rec.perkId);
  if (!gizmoAcceptsPerk(shell, def, ancient)) return null;
  const max = storedMaxForShell(def, ancient);
  if (max == null) return null;
  const rank = clampInt(rec.rank, 1, max, 0);
  if (rank < 1) return null;
  return { perkId: rec.perkId, rank };
}

function normalizeSlot(raw: unknown, index: number): PowerArchiveGizmoSlot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const rec = raw as {
    id?: unknown;
    shell?: unknown;
    ancient?: unknown;
    perks?: unknown;
  };
  const shell: PowerArchiveShell = rec.shell === "armour" ? "armour" : "weapon";
  const ancient = rec.ancient === true;
  const id =
    typeof rec.id === "string" && rec.id.length > 0 && rec.id.length <= 64
      ? rec.id
      : `pa-${index}`;
  const rawPerks = Array.isArray(rec.perks) ? rec.perks : [];
  const seen = new Set<PowerArchivePerkId>();
  const perks: PowerArchivePerkEntry[] = [];
  for (const entry of rawPerks) {
    if (perks.length >= POWER_ARCHIVE_GIZMO_PERK_CAP) break;
    const normalized = normalizePerkEntry(entry, shell, ancient);
    if (!normalized) continue;
    if (seen.has(normalized.perkId)) continue;
    seen.add(normalized.perkId);
    perks.push(normalized);
  }
  return { id, shell, ancient, perks };
}

/** Cap at 20; drop invalid; stable empty default. */
export function normalizePowerArchiveState(value: unknown): PowerArchiveState {
  if (typeof value !== "object" || value === null) return emptyPowerArchiveState();
  const raw = value as { slots?: unknown };
  if (!Array.isArray(raw.slots)) return emptyPowerArchiveState();
  const slots: PowerArchiveGizmoSlot[] = [];
  const usedIds = new Set<string>();
  for (let i = 0; i < raw.slots.length; i++) {
    if (slots.length >= POWER_ARCHIVE_SLOT_CAP) break;
    const slot = normalizeSlot(raw.slots[i], i);
    if (!slot) continue;
    let id = slot.id;
    if (usedIds.has(id)) id = `pa-${i}-${slots.length}`;
    usedIds.add(id);
    slots.push(id === slot.id ? slot : { ...slot, id });
  }
  return { slots };
}

export function canAddPowerArchiveSlot(state: PowerArchiveState): boolean {
  return state.slots.length < POWER_ARCHIVE_SLOT_CAP;
}

export function withPowerArchiveSlot(
  state: PowerArchiveState,
  slot: PowerArchiveGizmoSlot,
): PowerArchiveState {
  if (state.slots.length >= POWER_ARCHIVE_SLOT_CAP) return state;
  const normalized = normalizeSlot(slot, state.slots.length);
  if (!normalized) return state;
  return { slots: [...state.slots, normalized] };
}

export function withoutPowerArchiveSlot(
  state: PowerArchiveState,
  slotId: string,
): PowerArchiveState {
  return { slots: state.slots.filter((s) => s.id !== slotId) };
}

export function replacePowerArchiveSlot(
  state: PowerArchiveState,
  slotId: string,
  next: PowerArchiveGizmoSlot,
): PowerArchiveState {
  const idx = state.slots.findIndex((s) => s.id === slotId);
  if (idx < 0) return state;
  const normalized = normalizeSlot({ ...next, id: slotId }, idx);
  if (!normalized) return state;
  const slots = state.slots.slice();
  slots[idx] = normalized;
  return { slots };
}

export type BuildMaxDpsPowerArchiveOptions = {
  /**
   * Ancient shells at craft max. When false (Ancient unchecked or no Kandarin),
   * use standard craft max and skip ancient-only perks (Relentless, Ruthless).
   */
  ancient?: boolean;
  /**
   * Include Equilibrium in the fill. Default false: Equilibrium raises mean
   * band but disables crits, so max-crit bot fills lose DPS.
   */
  includeEquilibrium?: boolean;
};

/**
 * Offensive perks never auto-filled by "Add all DPS boosting perks".
 * Still combatScope:"offensive" and manually assignable on the bot.
 */
export const MAX_DPS_FILL_EXCLUDE: ReadonlySet<PowerArchivePerkId> = new Set([
  "equilibrium",
]);

/**
 * Build a full bot loadout of offensive perks at craft max (one perk per gizmo
 * so highest-wins still covers the DPS set). Skips Equilibrium by default
 * (crit disable). Replaces any previous Archive contents when applied.
 */
export function buildMaxDpsPowerArchiveState(
  options: BuildMaxDpsPowerArchiveOptions = {},
): PowerArchiveState {
  const ancient = options.ancient !== false;
  const includeEquilibrium = options.includeEquilibrium === true;
  const offensive = POWER_ARCHIVE_PERKS.filter((p) => {
    if (p.combatScope !== "offensive") return false;
    if (!includeEquilibrium && MAX_DPS_FILL_EXCLUDE.has(p.id)) return false;
    return true;
  });
  const rawSlots: PowerArchiveGizmoSlot[] = [];
  for (let i = 0; i < offensive.length && rawSlots.length < POWER_ARCHIVE_SLOT_CAP; i++) {
    const def = offensive[i]!;
    const shell: PowerArchiveShell = def.gizmoKind === "armour" ? "armour" : "weapon";
    // Ancient-only perks (standardMaxStored null): Relentless, Ruthless.
    if (!gizmoAcceptsPerk(shell, def, ancient)) continue;
    const rank = storedMaxForShell(def, ancient);
    if (rank == null || rank < 1) continue;
    rawSlots.push({
      id: `dps-${def.id}`,
      shell,
      ancient,
      perks: [{ perkId: def.id, rank }],
    });
  }
  return normalizePowerArchiveState({ slots: rawSlots });
}

/** Equipment LoadoutPerks ranks that map onto the Archive catalogue. */
export function equipmentRanksFromLoadoutPerks(perks: {
  equilibrium?: number;
  eruptive?: number;
  biting?: number;
  invigorating?: number;
  impatient?: number;
  ultimatums?: number;
  lunging?: number;
  caroming?: number;
  energising?: number;
  crackling?: number;
  aftershock?: number;
  relentless?: number;
  precise?: number;
  flanking?: number;
  spendthrift?: number;
  shieldBashing?: number;
  ruthless?: number;
}): Partial<Record<PowerArchivePerkId, number>> {
  const out: Partial<Record<PowerArchivePerkId, number>> = {};
  const put = (id: PowerArchivePerkId, rank: number | undefined): void => {
    if (typeof rank === "number" && rank >= 1) out[id] = rank;
  };
  put("equilibrium", perks.equilibrium);
  put("eruptive", perks.eruptive);
  put("biting", perks.biting);
  put("invigorating", perks.invigorating);
  put("impatient", perks.impatient);
  put("ultimatums", perks.ultimatums);
  put("lunging", perks.lunging);
  put("caroming", perks.caroming);
  put("energising", perks.energising);
  put("crackling", perks.crackling);
  put("aftershock", perks.aftershock);
  put("relentless", perks.relentless);
  put("precise", perks.precise);
  put("flanking", perks.flanking);
  put("spendthrift", perks.spendthrift);
  put("shield-bashing", perks.shieldBashing);
  put("ruthless", perks.ruthless);
  return out;
}

/**
 * Overlay resolved Archive effective ranks onto loadout.perks for combat compile.
 * Leaves non-catalogue ranks (plantedFeet, slayers) untouched.
 * Does not mutate the stored powerArchive slots (stored ranks stay craftable).
 * L20 gear flags stay only when equipment wins that perk; archive ranks are not L20.
 */
export function withPowerArchiveEffectivePerks<
  T extends {
    perks: {
      equilibrium: number;
      eruptive: number;
      biting: number;
      invigorating: number;
      impatient: number;
      ultimatums: number;
      lunging: number;
      caroming: number;
      energising: number;
      crackling: number;
      aftershock: number;
      relentless: number;
      precise: number;
      flanking: number;
      shieldBashing: number;
      spendthrift: number;
      ruthless: number;
    };
    powerArchive?: PowerArchiveState;
  },
>(loadout: T, archiveActive: boolean): T {
  const resolved = resolvePowerArchivePerks({
    equipmentRanks: equipmentRanksFromLoadoutPerks(loadout.perks),
    archive: loadout.powerArchive,
    archiveActive,
  });
  const rank = (id: PowerArchivePerkId): number => effectiveCombatRank(resolved, id);
  const archiveWins = (id: PowerArchivePerkId): boolean =>
    resolved.get(id)?.fromArchive === true;
  return {
    ...loadout,
    perks: {
      ...loadout.perks,
      equilibrium: rank("equilibrium"),
      eruptive: rank("eruptive"),
      biting: rank("biting"),
      invigorating: rank("invigorating"),
      impatient: rank("impatient"),
      ultimatums: rank("ultimatums"),
      lunging: rank("lunging"),
      caroming: rank("caroming"),
      energising: rank("energising"),
      crackling: rank("crackling"),
      aftershock: rank("aftershock"),
      relentless: rank("relentless"),
      precise: rank("precise"),
      flanking: rank("flanking"),
      shieldBashing: rank("shield-bashing"),
      spendthrift: rank("spendthrift"),
      ruthless: rank("ruthless"),
      // Archive ranks are not item-level-20; clear gear L20 when archive wins.
      ...(archiveWins("biting") ? { bitingLevel20: false as const } : {}),
      ...(archiveWins("impatient") ? { impatientLevel20: false as const } : {}),
      ...(archiveWins("relentless") ? { relentlessLevel20: false as const } : {}),
    },
  };
}
