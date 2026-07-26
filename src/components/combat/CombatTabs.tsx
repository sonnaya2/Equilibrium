"use client";

import { useState, type ReactNode } from "react";
import { AnalysisTab } from "./AnalysisTab";
import { BuildTab } from "./BuildTab";
import { QuickCalculator } from "./QuickCalculator";
import { RotationPlanner } from "./RotationPlanner";

const TABS = ["Quick", "Build", "Rotation", "Analysis", "Reference"] as const;
type Tab = (typeof TABS)[number];

export function CombatTabs({ reference }: { reference: ReactNode }) {
  const [tab, setTab] = useState<Tab>("Quick");

  return (
    <div>
      <div className="flex gap-1 border-b border-stone-750 pb-3">
        {TABS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(label)}
            className={`border-b-2 px-3 py-1.5 text-sm ${
              tab === label
                ? "border-gem-400 font-medium text-gem-300"
                : "border-transparent text-parch-300 hover:text-parch-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "Quick" ? <QuickCalculator /> : null}
      {tab === "Build" ? <BuildTab /> : null}
      {tab === "Rotation" ? <RotationPlanner /> : null}
      {tab === "Analysis" ? <AnalysisTab /> : null}
      {tab === "Reference" ? reference : null}
    </div>
  );
}
