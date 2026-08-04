/**
 * Canonical simulation fingerprint for Rotation / Revolution result validity.
 * Values via packed sim base + canonicalSimulationIdentity; no modifier-id probes.
 */
import {
  canonicalSimulationIdentity,
  packSimBase,
  packSimBaseFromModel,
  stableStringify,
} from "@/combat/solver";
import type { ResolvedCombatModel } from "@/combat/model";
import type { CalcStats } from "./loadoutStats";
import type { Loadout } from "./loadout/model";
import { solverSnapshotFromUi } from "./solverSnapshot";

type SharedRunParts = {
  stats: CalcStats;
  loadout: Loadout;
  /** Preferred: same model as Manual/Revo/solver (identity-aligned). */
  combatModel?: ResolvedCombatModel;
};

export type ManualRunFingerprintParts = SharedRunParts & {
  mode: "manual";
  queue: readonly string[];
  autoWeave: boolean;
  ammo: string;
  useBuild: boolean;
  /** Manual damage line when useBuild is false. */
  manual?: {
    base: number;
    level: number;
    accuracy: number;
    critChance: number;
  };
};

export type RevolutionRunFingerprintParts = SharedRunParts & {
  mode: "revolution";
  barIds: readonly string[];
  durationSeconds: number;
  style: string;
};

export type UiRunFingerprintParts = ManualRunFingerprintParts | RevolutionRunFingerprintParts;

function simulationCore(
  stats: CalcStats,
  loadout: Loadout,
  combatModel?: ResolvedCombatModel,
): unknown {
  // Prefer model projection (same as solver pack); compat via CalcStats snapshot.
  const simBase = combatModel
    ? packSimBaseFromModel(combatModel)
    : packSimBase(solverSnapshotFromUi(stats, loadout));
  return {
    simulation: canonicalSimulationIdentity(simBase),
    // Fury bonus is in modifierSources; life points for honesty if current/temp max drift.
    life: {
      currentLife: stats.life.currentLife,
      temporaryMaxLife: stats.life.temporaryMaxLife,
    },
  };
}

/**
 * Fingerprint of every input that changes a Rotation / Revolution result.
 * Cosmetic UI state (analysis open, cast expand) is intentionally excluded.
 */
export function uiRunFingerprint(parts: UiRunFingerprintParts): string {
  const core = simulationCore(parts.stats, parts.loadout, parts.combatModel);
  if (parts.mode === "manual") {
    return stableStringify({
      mode: "manual",
      core,
      queue: [...parts.queue],
      autoWeave: parts.autoWeave,
      ammo: parts.ammo,
      useBuild: parts.useBuild,
      manual: parts.useBuild ? null : (parts.manual ?? null),
    });
  }
  return stableStringify({
    mode: "revolution",
    core,
    barIds: [...parts.barIds],
    durationSeconds: parts.durationSeconds,
    style: parts.style,
  });
}
