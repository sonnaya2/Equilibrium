"use client";

import { useState, type ReactNode } from "react";
import { WorkbenchPanel, SectionTabs } from "@/components/SectionTabs";
import { AnalysisTab } from "./AnalysisTab";
import { QuickCalculator } from "./QuickCalculator";
import { RotationPlanner } from "./RotationPlanner";
import { SetupTab } from "./SetupTab";
import "./combat.css";

const COMBAT_TABS = [
  { id: "Quick", label: "Abilities" },
  { id: "Setup", label: "Loadout" },
  { id: "Rotation", label: "Rotation" },
  { id: "Analysis", label: "Analysis" },
  { id: "Reference", label: "Reference" },
] as const;

type Tab = (typeof COMBAT_TABS)[number]["id"];

export function CombatTabs({ reference }: { reference: ReactNode }) {
  const [tab, setTab] = useState<Tab>("Quick");

  return (
    <div className="combat-screen flex min-h-0 flex-1 flex-col">
      <SectionTabs aria-label="Combat sections" tabs={COMBAT_TABS} active={tab} onChange={setTab} />

      <div className="combat-tab-stage min-h-0 flex-1 overflow-hidden">
        <WorkbenchPanel id="Quick" active={tab}>
          <div className="h-full min-h-0 overflow-auto">
            <QuickCalculator />
          </div>
        </WorkbenchPanel>
        <WorkbenchPanel id="Setup" active={tab}>
          <div className="h-full min-h-0 overflow-auto">
            <SetupTab />
          </div>
        </WorkbenchPanel>
        <WorkbenchPanel id="Rotation" active={tab}>
          <div className="h-full min-h-0 overflow-hidden">
            <RotationPlanner />
          </div>
        </WorkbenchPanel>
        <WorkbenchPanel id="Analysis" active={tab}>
          <div className="h-full min-h-0 overflow-hidden">
            <AnalysisTab />
          </div>
        </WorkbenchPanel>
        <WorkbenchPanel id="Reference" active={tab}>
          <div className="h-full min-h-0 overflow-auto">{reference}</div>
        </WorkbenchPanel>
      </div>
    </div>
  );
}
