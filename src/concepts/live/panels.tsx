"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { ResearchBrowser } from "@/components/ResearchBrowser";
import type { ResearchCatalog } from "@/research/catalog";

const panelFallback = () => (
  <p className="py-6 text-sm text-parch-300" aria-busy="true">
    Loading…
  </p>
);

const ProgressionResearch = dynamic(
  () => import("@/components/ProgressionResearch").then((m) => ({ default: m.ProgressionResearch })),
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
    import("@/components/RegionCombosResearch").then((m) => ({ default: m.RegionCombosResearch })),
  { ssr: false, loading: panelFallback },
);
const QuestBrowser = dynamic(
  () => import("@/components/QuestBrowser").then((m) => ({ default: m.QuestBrowser })),
  { ssr: false, loading: panelFallback },
);
const SlayerResearch = dynamic(
  () => import("@/components/SlayerResearch").then((m) => ({ default: m.SlayerResearch })),
  { ssr: false, loading: panelFallback },
);
const InventionResearch = dynamic(
  () => import("@/components/InventionResearch").then((m) => ({ default: m.InventionResearch })),
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
    import("@/components/ConsumablesResearch").then((m) => ({ default: m.ConsumablesResearch })),
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

export const DATA_CATEGORIES = [
  { id: "browse", label: "Browse" },
  { id: "quests", label: "Quests" },
  { id: "progression", label: "Progression" },
  { id: "unlocks", label: "Permanent unlocks" },
  { id: "regional", label: "Regional unlocks" },
  { id: "combatBis", label: "Combat BiS" },
  { id: "combos", label: "Region combos" },
  { id: "slayer", label: "Slayer" },
  { id: "invention", label: "Invention" },
  { id: "prayers", label: "Prayers & books" },
  { id: "consumables", label: "Consumables" },
  { id: "systems", label: "Systems" },
  { id: "crafting", label: "Crafting" },
  { id: "notes", label: "Reference notes" },
  { id: "boundaries", label: "Boundaries" },
] as const;

export type DataCategoryId = (typeof DATA_CATEGORIES)[number]["id"];

export function renderDataCategory(
  id: DataCategoryId,
  catalog: ResearchCatalog,
  notes: ReactNode,
): ReactNode {
  switch (id) {
    case "browse":
      return <ResearchBrowser catalog={catalog} />;
    case "quests":
      return <QuestBrowser />;
    case "progression":
      return <ProgressionResearch />;
    case "unlocks":
      return <PermanentUnlockResearch />;
    case "regional":
      return <RegionalUnlocksResearch />;
    case "combatBis":
      return <CombatBisResearch />;
    case "combos":
      return <RegionCombosResearch />;
    case "slayer":
      return <SlayerResearch />;
    case "invention":
      return <InventionResearch />;
    case "prayers":
      return <PrayerSpellbookResearch />;
    case "consumables":
      return <ConsumablesResearch />;
    case "systems":
      return <ProgressionSystemsResearch />;
    case "crafting":
      return (
        <div className="space-y-8">
          <ArchaeologyProductionResearch />
          <MasterworkChainResearch />
        </div>
      );
    case "notes":
      return (
        <div className="space-y-6">
          <ReferenceNotesResearch />
          {notes}
        </div>
      );
    case "boundaries":
      return <RegionBoundariesResearch />;
    default:
      return null;
  }
}
