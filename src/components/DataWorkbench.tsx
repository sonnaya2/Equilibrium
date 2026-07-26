"use client";

import { useState, type ReactNode } from "react";
import { WorkbenchPanel, WorkbenchTabs } from "./WorkbenchTabs";

const TABS = [
  { id: "browse", label: "Browse" },
  { id: "quests", label: "Quests" },
  { id: "progression", label: "Progression" },
  { id: "unlocks", label: "Unlocks" },
  { id: "regional", label: "Regional" },
  { id: "combatBis", label: "BiS" },
  { id: "combos", label: "Combos" },
  { id: "slayer", label: "Slayer" },
  { id: "invention", label: "Invention" },
  { id: "prayers", label: "Prayers" },
  { id: "consumables", label: "Consumables" },
  { id: "systems", label: "Systems" },
  { id: "crafting", label: "Crafting" },
  { id: "notes", label: "Notes" },
  { id: "boundaries", label: "Boundaries" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Control Surface Data: primary tabs, only the active category mounts heavy trees.
 * Crafting holds Archaeology + Masterwork as stacked sections.
 */
export function DataWorkbench({
  browse,
  quests,
  progression,
  unlocks,
  regional,
  combatBis,
  combos,
  slayer,
  invention,
  prayers,
  consumables,
  systems,
  archaeology,
  masterwork,
  referenceNotes,
  boundaries,
  notes,
}: {
  browse: ReactNode;
  quests: ReactNode;
  progression: ReactNode;
  unlocks: ReactNode;
  regional: ReactNode;
  combatBis: ReactNode;
  combos: ReactNode;
  slayer: ReactNode;
  invention: ReactNode;
  prayers: ReactNode;
  consumables: ReactNode;
  systems: ReactNode;
  archaeology: ReactNode;
  masterwork: ReactNode;
  referenceNotes: ReactNode;
  boundaries: ReactNode;
  notes: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("browse");

  return (
    <div className="data-screen flex min-h-0 flex-1 flex-col">
      <WorkbenchTabs aria-label="Data categories" tabs={TABS} active={tab} onChange={setTab} />

      <div className="min-h-0 flex-1 overflow-hidden">
      <WorkbenchPanel id="browse" active={tab}>
        {browse}
      </WorkbenchPanel>
      <WorkbenchPanel id="quests" active={tab}>
        {quests}
      </WorkbenchPanel>
      <WorkbenchPanel id="progression" active={tab}>
        {progression}
      </WorkbenchPanel>
      <WorkbenchPanel id="unlocks" active={tab}>
        {unlocks}
      </WorkbenchPanel>
      <WorkbenchPanel id="regional" active={tab}>
        {regional}
      </WorkbenchPanel>
      <WorkbenchPanel id="combatBis" active={tab}>
        {combatBis}
      </WorkbenchPanel>
      <WorkbenchPanel id="combos" active={tab}>
        {combos}
      </WorkbenchPanel>
      <WorkbenchPanel id="slayer" active={tab}>
        {slayer}
      </WorkbenchPanel>
      <WorkbenchPanel id="invention" active={tab}>
        {invention}
      </WorkbenchPanel>
      <WorkbenchPanel id="prayers" active={tab}>
        {prayers}
      </WorkbenchPanel>
      <WorkbenchPanel id="consumables" active={tab}>
        {consumables}
      </WorkbenchPanel>
      <WorkbenchPanel id="systems" active={tab}>
        {systems}
      </WorkbenchPanel>
      <WorkbenchPanel id="crafting" active={tab}>
        <div className="space-y-8">
          {archaeology}
          {masterwork}
        </div>
      </WorkbenchPanel>
      <WorkbenchPanel id="notes" active={tab}>
        {referenceNotes}
      </WorkbenchPanel>
      <WorkbenchPanel id="boundaries" active={tab}>
        <div className="h-full overflow-auto">{boundaries}</div>
      </WorkbenchPanel>
      </div>

      {tab === "browse" ? (
        <div className="mt-2 shrink-0 border-t border-stone-750 pt-2 text-xs">{notes}</div>
      ) : null}
    </div>
  );
}
