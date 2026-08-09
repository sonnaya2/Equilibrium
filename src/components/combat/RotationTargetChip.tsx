"use client";

import { useMemo } from "react";
import { GameIcon } from "../GameIcon";
import {
  formatLifePoints,
  targetSummaryView,
} from "./targetSummaryPresentation";
import { isTargetModifiedFromPreset } from "./targetPresetUi";
import type { Loadout } from "./useLoadout";

/** Compact boss / NPC face for rotation surfaces (bottom-right). */
export function RotationTargetChip({
  loadout,
  onOpenTarget,
}: {
  loadout: Loadout;
  onOpenTarget?: () => void;
}) {
  const view = useMemo(
    () =>
      targetSummaryView(loadout.target, {
        modified:
          loadout.target != null &&
          isTargetModifiedFromPreset(loadout.target, loadout.style),
      }),
    [loadout.target, loadout.style],
  );

  if (!view) {
    return (
      <button
        type="button"
        className="rotation-target-chip rotation-target-chip--empty"
        onClick={onOpenTarget}
        disabled={!onOpenTarget}
      >
        Set target
      </button>
    );
  }

  return (
    <button
      type="button"
      className="rotation-target-chip"
      onClick={onOpenTarget}
      disabled={!onOpenTarget}
      title={`${view.name} · Def ${view.defenceLevel} · Aff ${view.affinity}`}
    >
      <span className="rotation-target-chip__icon" aria-hidden>
        <GameIcon src={view.iconSrc} size={28} />
      </span>
      <span className="rotation-target-chip__copy">
        <strong>{view.name}</strong>
        <small>
          Def {view.defenceLevel} · Aff {view.affinity}
          {view.maximumLifePoints != null
            ? ` · LP ${formatLifePoints(view.maximumLifePoints)}`
            : ""}
          {view.modifiedHint ? ` · ${view.modifiedHint}` : ""}
        </small>
      </span>
    </button>
  );
}
