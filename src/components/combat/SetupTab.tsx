"use client";

import { useMemo, useState } from "react";
import { unlockedRegions } from "@/league";
import { useBuild } from "@/league/useBuild";
import { EquipmentColumn } from "./EquipmentColumn";
import { LoadoutEditorDialog, type LoadoutEditorMode } from "./LoadoutEditorDialog";
import { loadoutStats } from "./loadoutStats";
import { ResolvedSummary } from "./ResolvedSummary";
import { SetupWorkbench } from "./SetupWorkbench";
import type { Loadout, SetLoadout } from "./useLoadout";

export { SummaryMetric } from "./ResolvedSummary";

export function SetupTab({
  loadout,
  setLoadout,
  onOpenRotation,
}: {
  loadout: Loadout;
  setLoadout: SetLoadout;
  onOpenRotation: () => void;
}) {
  const [editorMode, setEditorMode] = useState<LoadoutEditorMode | null>(null);
  const { build } = useBuild();
  const regions = useMemo(() => unlockedRegions(build), [build]);
  const stats = useMemo(
    () =>
      loadoutStats(loadout, {
        blessingPicks: build.blessingPicks,
        relics: Object.values(build.relics).filter(Boolean),
        unlockedRegions: regions,
      }),
    [build.blessingPicks, build.relics, loadout, regions],
  );

  return (
    <div className="combat-setup">
      <div className="setup-layout">
        <EquipmentColumn
          loadout={loadout}
          setLoadout={setLoadout}
          genesisActive={stats.weaponTierOverride != null}
          onEdit={() => setEditorMode("equipment")}
          onOpenPrayers={() => setEditorMode("equipment")}
        />
        <SetupWorkbench
          loadout={loadout}
          stats={stats}
          ringOfVigourPassive={regions.includes("anachronia")}
          onOpenEffects={() => setEditorMode("effects")}
          onOpenPerks={() => setEditorMode("perks")}
          onOpenRelics={() => setEditorMode("relics")}
          onOpenTarget={() => setEditorMode("target")}
          onOpenRotation={onOpenRotation}
        />
        <aside className="setup-summary-column">
          <ResolvedSummary stats={stats} />
        </aside>
      </div>
      <LoadoutEditorDialog
        mode={editorMode}
        loadout={loadout}
        setLoadout={setLoadout}
        stats={stats}
        onDismiss={() => setEditorMode(null)}
      />
    </div>
  );
}
