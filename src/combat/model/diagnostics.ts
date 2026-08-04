/**
 * Host freeze diagnostics on ResolvedCombatModel.
 * Audit trail for pre-tick-zero facts — not Setup UI breakdown rows.
 */
import type {
  SerializableSalveSource,
  SerializableSlayerHelmetSource,
} from "../solver/worker/serializable";

/** Berserker's Fury snapshot frozen at resolve (LP vs temporary max). */
export interface ResolvedBerserkersFuryDiagnostics {
  readonly active: boolean;
  /** Damage bonus fraction (0.03 = +3%). */
  readonly bonus: number;
  readonly currentLifePoints: number;
  readonly maximumLifePoints: number;
  readonly currentHealthPercent: number;
}

export interface ResolvedCombatDiagnostics {
  /** Host-resolved helmet descriptor; null when inactive. */
  readonly slayerHelmet: SerializableSlayerHelmetSource | null;
  /** Host-resolved salve descriptor; null when inactive. */
  readonly salve: SerializableSalveSource | null;
  readonly berserkersFury: ResolvedBerserkersFuryDiagnostics;
  /**
   * Exact Powerburst remaining ticks at freeze (mirrors league.powerburstUntilTick).
   * 0 = inactive.
   */
  readonly powerburstRemainingTicks: number;
  /** Ring of Vigour OR-collapsed; true when equipped and/or permanent passive applies. */
  readonly ringOfVigourActive: boolean;
  /** Collapsed source labels (equipped / permanent) — one line of truth for UI later. */
  readonly ringOfVigourSources: readonly string[];
  /** Archaeology selectedIds after host sanitization (region + energy + 3-slot). */
  readonly archaeologySelectedIds: readonly string[];
  /** Effective adrenaline cap after vestments / Heightened Senses / league. */
  readonly maxAdrenaline: number;
}

export function emptyBerserkersFuryDiagnostics(): ResolvedBerserkersFuryDiagnostics {
  return {
    active: false,
    bonus: 0,
    currentLifePoints: 0,
    maximumLifePoints: 0,
    currentHealthPercent: 50,
  };
}

export function emptyCombatDiagnostics(): ResolvedCombatDiagnostics {
  return {
    slayerHelmet: null,
    salve: null,
    berserkersFury: emptyBerserkersFuryDiagnostics(),
    powerburstRemainingTicks: 0,
    ringOfVigourActive: false,
    ringOfVigourSources: [],
    archaeologySelectedIds: [],
    maxAdrenaline: 100,
  };
}
