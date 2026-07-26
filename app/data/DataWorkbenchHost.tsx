"use client";

import dynamic from "next/dynamic";
import { DataWorkbench } from "@/components/DataWorkbench";
import { ResearchBrowser } from "@/components/ResearchBrowser";
import type { ResearchCatalog } from "@/research/catalog";
import type { ReactNode } from "react";

const panelFallback = () => (
  <p className="py-6 text-sm text-parch-300" aria-busy="true">
    Loading…
  </p>
);

// Heavy research trees stay out of the initial /data chunk. WorkbenchPanel only
// mounts the active tab; dynamic() keeps inactive JSON/modules off the wire.
// ssr:false requires a client module — cannot live on the server page.tsx.
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
const PrayerSpellbookResearch = dynamic(
  () =>
    import("@/components/PrayerSpellbookResearch").then((m) => ({
      default: m.PrayerSpellbookResearch,
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
const ProgressionSystemsResearch = dynamic(
  () =>
    import("@/components/ProgressionSystemsResearch").then((m) => ({
      default: m.ProgressionSystemsResearch,
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
const MasterworkChainResearch = dynamic(
  () =>
    import("@/components/MasterworkChainResearch").then((m) => ({
      default: m.MasterworkChainResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const RegionBoundariesResearch = dynamic(
  () =>
    import("@/components/RegionBoundariesResearch").then((m) => ({
      default: m.RegionBoundariesResearch,
    })),
  { ssr: false, loading: panelFallback },
);
const ReferenceNotesResearch = dynamic(
  () =>
    import("@/components/ReferenceNotesResearch").then((m) => ({
      default: m.ReferenceNotesResearch,
    })),
  { ssr: false, loading: panelFallback },
);

export function DataWorkbenchHost({
  catalog,
  notes,
}: {
  catalog: ResearchCatalog;
  notes: ReactNode;
}) {
  return (
    <DataWorkbench
      browse={<ResearchBrowser catalog={catalog} />}
      quests={<QuestBrowser />}
      progression={<ProgressionResearch />}
      unlocks={<PermanentUnlockResearch />}
      regional={<RegionalUnlocksResearch />}
      combos={<RegionCombosResearch />}
      slayer={<SlayerResearch />}
      invention={<InventionResearch />}
      prayers={<PrayerSpellbookResearch />}
      consumables={<ConsumablesResearch />}
      systems={<ProgressionSystemsResearch />}
      archaeology={<ArchaeologyProductionResearch />}
      masterwork={<MasterworkChainResearch />}
      referenceNotes={<ReferenceNotesResearch />}
      boundaries={<RegionBoundariesResearch />}
      notes={notes}
    />
  );
}
