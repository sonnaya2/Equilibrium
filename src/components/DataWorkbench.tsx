"use client";

import { useState, type ReactNode } from "react";
import { WorkbenchPanel, WorkbenchTabs } from "./WorkbenchTabs";

const TABS = [
  { id: "browse", label: "Browse" },
  { id: "progression", label: "Progression" },
  { id: "unlocks", label: "Permanent unlocks" },
  { id: "regional", label: "Regional unlocks" },
  { id: "slayer", label: "Slayer" },
  { id: "invention", label: "Invention" },
  { id: "prayers", label: "Prayers & books" },
  { id: "consumables", label: "Consumables" },
  { id: "systems", label: "Systems" },
  { id: "crafting", label: "Crafting" },
  { id: "boundaries", label: "Boundaries" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Control Surface Data: primary tabs, only the active category mounts heavy trees.
 * Crafting holds Archaeology + Masterwork as stacked sections.
 */
export function DataWorkbench({
  browse,
  progression,
  unlocks,
  regional,
  slayer,
  invention,
  prayers,
  consumables,
  systems,
  archaeology,
  masterwork,
  boundaries,
  notes,
}: {
  browse: ReactNode;
  progression: ReactNode;
  unlocks: ReactNode;
  regional: ReactNode;
  slayer: ReactNode;
  invention: ReactNode;
  prayers: ReactNode;
  consumables: ReactNode;
  systems: ReactNode;
  archaeology: ReactNode;
  masterwork: ReactNode;
  boundaries: ReactNode;
  notes: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("browse");

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col">
      <WorkbenchTabs aria-label="Data categories" tabs={TABS} active={tab} onChange={setTab} />

      <WorkbenchPanel id="browse" active={tab}>
        {browse}
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
      <WorkbenchPanel id="boundaries" active={tab}>
        {boundaries}
      </WorkbenchPanel>

      {tab === "browse" ? <div className="mt-6 border-t border-stone-750 pt-4">{notes}</div> : null}
    </div>
  );
}
