"use client";

import { useState, type ReactNode } from "react";
import { WorkbenchPanel, WorkbenchTabs } from "@/components/WorkbenchTabs";
import { AnalysisTab } from "./AnalysisTab";
import { QuickCalculator } from "./QuickCalculator";
import { RotationPlanner } from "./RotationPlanner";
import { SetupTab } from "./SetupTab";

const COMBAT_TABS = [
  { id: "Quick", label: "Quick" },
  { id: "Setup", label: "Setup" },
  { id: "Rotation", label: "Rotation" },
  { id: "Analysis", label: "Analysis" },
  { id: "Reference", label: "Reference" },
] as const;

type Tab = (typeof COMBAT_TABS)[number]["id"];

export function CombatTabs({ reference }: { reference: ReactNode }) {
  const [tab, setTab] = useState<Tab>("Quick");

  return (
    <div className="flex min-h-0 flex-col">
      <WorkbenchTabs
        aria-label="Combat sections"
        tabs={COMBAT_TABS}
        active={tab}
        onChange={setTab}
      />

      <WorkbenchPanel id="Quick" active={tab}>
        <QuickCalculator />
      </WorkbenchPanel>
      <WorkbenchPanel id="Setup" active={tab}>
        <SetupTab />
      </WorkbenchPanel>
      <WorkbenchPanel id="Rotation" active={tab}>
        <RotationPlanner />
      </WorkbenchPanel>
      <WorkbenchPanel id="Analysis" active={tab}>
        <AnalysisTab />
      </WorkbenchPanel>
      <WorkbenchPanel id="Reference" active={tab}>
        {reference}
      </WorkbenchPanel>
    </div>
  );
}
