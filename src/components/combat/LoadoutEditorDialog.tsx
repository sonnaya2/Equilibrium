"use client";

import { useEffect, useRef } from "react";
import { ArchPanel } from "./ArchPanel";
import { BuffsPanel } from "./BuffsPanel";
import { CombatFrame } from "./CombatFrame";
import { GearPanel } from "./GearPanel";
import { PerksPanel } from "./PerksPanel";
import { PowerArchivePanel } from "./PowerArchivePanel";
import type { ResolvedStats } from "./ResolvedSummary";
import { TargetPanel } from "./TargetPanel";
import type { Loadout, SetLoadout } from "./useLoadout";

export type LoadoutEditorMode =
  | "equipment"
  | "effects"
  | "perks"
  | "relics"
  | "target"
  | "power-archive";

const EDITOR_TITLES: Record<LoadoutEditorMode, string> = {
  equipment: "Change equipment",
  effects: "Active effects",
  perks: "Change perks",
  relics: "Archaeology",
  target: "Edit target",
  "power-archive": "Automaton Control Bot",
};

export function LoadoutEditorDialog({
  mode,
  loadout,
  setLoadout,
  stats,
  onDismiss,
}: {
  mode: LoadoutEditorMode | null;
  loadout: Loadout;
  setLoadout: SetLoadout;
  stats: ResolvedStats;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (mode && !dialog.open) dialog.showModal();
    if (!mode && dialog.open) dialog.close();
  }, [mode]);

  return (
    <CombatFrame
      as="dialog"
      frameRef={dialogRef}
      className="loadout-editor-dialog"
      aria-labelledby="loadout-editor-title"
      onClose={onDismiss}
    >
      <header className="loadout-editor-dialog__header">
        <h2 id="loadout-editor-title">{mode ? EDITOR_TITLES[mode] : "Loadout editor"}</h2>
        <button
          type="button"
          aria-label="Close loadout editor"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
      </header>
      <div className="loadout-editor-dialog__body">
        {mode === "equipment" ? <GearPanel loadout={loadout} setLoadout={setLoadout} /> : null}
        {mode === "effects" ? (
          <BuffsPanel loadout={loadout} setLoadout={setLoadout} stats={stats} />
        ) : null}
        {mode === "perks" ? <PerksPanel loadout={loadout} setLoadout={setLoadout} /> : null}
        {mode === "relics" ? <ArchPanel loadout={loadout} setLoadout={setLoadout} /> : null}
        {mode === "target" ? <TargetPanel loadout={loadout} setLoadout={setLoadout} /> : null}
        {mode === "power-archive" ? (
          <PowerArchivePanel loadout={loadout} setLoadout={setLoadout} />
        ) : null}
      </div>
    </CombatFrame>
  );
}
