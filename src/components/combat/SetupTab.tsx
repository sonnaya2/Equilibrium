"use client";

import { useMemo, useState } from "react";
import { unlockedRegions } from "@/league";
import { activeBlessings } from "@/league/blessings";
import { useBuild } from "@/league/useBuild";
import { POWER_ARCHIVE_BLESSING_ID } from "@/combat/league/powerArchive";
import { EquipmentColumn } from "./EquipmentColumn";
import { LoadoutEditorDialog, type LoadoutEditorMode } from "./LoadoutEditorDialog";
import { LeagueLoadoutDisplay } from "./LeagueLoadoutDisplay";
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
  const powerArchiveActive = useMemo(
    () =>
      activeBlessings(build.blessingPicks).some(
        (b) => b.id === POWER_ARCHIVE_BLESSING_ID,
      ),
    [build.blessingPicks],
  );
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
        <div className="setup-equipment-column">
          <EquipmentColumn
            loadout={loadout}
            setLoadout={setLoadout}
            genesisActive={stats.weaponTierOverride != null}
            onEdit={() => setEditorMode("equipment")}
            onOpenPrayers={() => setEditorMode("equipment")}
          />
          <LeagueLoadoutDisplay build={build} regions={regions} />
        </div>
        <SetupWorkbench
          loadout={loadout}
          stats={stats}
          ringOfVigourPassive={regions.includes("anachronia")}
          powerArchiveActive={powerArchiveActive}
          onOpenEffects={() => setEditorMode("effects")}
          onOpenPerks={() => setEditorMode("perks")}
          onOpenRelics={() => setEditorMode("relics")}
          onOpenTarget={() => setEditorMode("target")}
          onOpenRotation={onOpenRotation}
          onOpenPowerArchive={() => setEditorMode("power-archive")}
        />
        <aside className="setup-summary-column">
          <ResolvedSummary
            stats={stats}
            storedTargetAffinity={loadout.target?.affinity}
          />
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
