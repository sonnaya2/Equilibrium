"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { DataBrowser } from "@/components/DataBrowser";
import { DataRegionRail, ResearchBrowser } from "@/components/ResearchBrowser";
import { REGION_IDS } from "@/league";
import { sortByRegionOrder } from "@/lib/regionOrder";
import type { ResearchCatalogIndex } from "@/research/catalog";
import { useResearchRegion } from "@/research/regionStore";

const panelFallback = () => (
  <p className="py-6 text-xs text-parch-300" aria-busy="true">
    Loading
  </p>
);

// Inactive tabs stay off the wire (dynamic + mount-active). ssr:false needs client host.
const ProgressionResearch = dynamic(
  () =>
    import("@/components/ProgressionResearch").then((m) => ({
      default: m.ProgressionResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const PermanentUnlockResearch = dynamic(
  () =>
    import("@/components/PermanentUnlockResearch").then((m) => ({
      default: m.PermanentUnlockResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const RegionalUnlocksResearch = dynamic(
  () =>
    import("@/components/RegionalUnlocksResearch").then((m) => ({
      default: m.RegionalUnlocksResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const CombatBisResearch = dynamic(
  () =>
    import("@/components/CombatBisResearch").then((m) => ({
      default: m.CombatBisResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const RegionCombosResearch = dynamic(
  () =>
    import("@/components/RegionCombosResearch").then((m) => ({
      default: m.RegionCombosResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const QuestBrowser = dynamic(
  () =>
    import("@/components/QuestBrowser").then((m) => ({
      default: m.QuestBrowser,
    })),
  { ssr: false, loading: panelFallback },
);
const SlayerResearch = dynamic(
  () =>
    import("@/components/SlayerResearch").then((m) => ({
      default: m.SlayerResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const InventionResearch = dynamic(
  () =>
    import("@/components/InventionResearch").then((m) => ({
      default: m.InventionResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const PrayerResearch = dynamic(
  () =>
    import("@/components/PrayerSpellbookResearch").then((m) => ({
      default: m.PrayerResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const MagicResearch = dynamic(
  () =>
    import("@/components/PrayerSpellbookResearch").then((m) => ({
      default: m.MagicResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const ConsumablesResearch = dynamic(
  () =>
    import("@/components/ConsumablesResearch").then((m) => ({
      default: m.ConsumablesResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const ArchaeologyProductionResearch = dynamic(
  () =>
    import("@/components/ArchaeologyProductionResearch").then((m) => ({
      default: m.ArchaeologyProductionResearch,
    })),
  { ssr: false, loading: panelFallback },
);
export function DataBrowserHost({
  catalog,
}: {
  catalog: ResearchCatalogIndex;
}) {
  const railRegions = useMemo(
    () => sortByRegionOrder(catalog.regions, REGION_IDS),
    [catalog.regions],
  );
  const [regionId, setRegionId] = useState(railRegions[0]?.id ?? "");
  const { region, error } = useResearchRegion(regionId);

  return (
    <DataBrowser
      region={region}
      regionRail={
        <DataRegionRail regions={railRegions} regionId={regionId} onChange={setRegionId} />
      }
      browse={
        error ? (
          <p className="px-4 py-6 text-sm text-red-300">{error}</p>
        ) : (
          <ResearchBrowser
            skills={catalog.skills}
            skillDetails={{
              archaeology: <ArchaeologyProductionResearch />,
              magic: <MagicResearch />,
              prayer: <PrayerResearch />,
            }}
          />
        )
      }
      quests={<QuestBrowser />}
      progression={<ProgressionResearch />}
      unlocks={<PermanentUnlockResearch />}
      regional={<RegionalUnlocksResearch />}
      combatBis={<CombatBisResearch />}
      combos={<RegionCombosResearch />}
      slayer={<SlayerResearch />}
      invention={<InventionResearch />}
      consumables={<ConsumablesResearch />}
    />
  );
}
