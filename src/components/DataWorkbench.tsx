"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ResearchRegion } from "@/research/catalog";
import { WorkbenchPanel, WorkbenchTabs } from "./WorkbenchTabs";
import "./data.css";

const DataRegionContext = createContext<ResearchRegion | null>(null);

export function useDataRegion() {
  return useContext(DataRegionContext);
}

export function DataViewHeader({
  title,
  description,
  count,
  countLabel = "records",
  children,
}: {
  title: string;
  description?: string;
  count: number;
  countLabel?: string;
  children?: ReactNode;
}) {
  const region = useDataRegion();
  return (
    <header className="data-view-head">
      <div className="data-view-head__copy">
        <h2>{title}</h2>
        <p className="data-view-head__region">{region ? region.name : "All regions"}</p>
        {description ? <p className="data-view-head__description">{description}</p> : null}
      </div>
      <div className="data-view-head__count" aria-label={`${count} ${countLabel}`}>
        <strong>{count}</strong>
        <span>{countLabel}</span>
      </div>
      {children ? <div className="data-view-head__controls">{children}</div> : null}
    </header>
  );
}

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
  { id: "consumables", label: "Consumables" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Active tab only. */
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
  consumables,
  region,
  regionRail,
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
  consumables: ReactNode;
  region: ResearchRegion | null;
  regionRail: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("browse");

  return (
    <div className="data-screen flex min-h-0 flex-1 flex-col">
      {regionRail}
      <WorkbenchTabs aria-label="Data" tabs={TABS} active={tab} onChange={setTab} />

      <DataRegionContext.Provider value={region}>
        <div className="data-workbench__panels flex min-h-0 flex-1 flex-col overflow-hidden">
          <WorkbenchPanel id="browse" active={tab} clip>
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
          <WorkbenchPanel id="consumables" active={tab}>
            {consumables}
          </WorkbenchPanel>
        </div>
      </DataRegionContext.Provider>
    </div>
  );
}
