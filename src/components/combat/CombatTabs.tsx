"use client";

import { useState } from "react";
import { styleIconPath } from "@/lib/gameArt";
import { WorkbenchPanel, SectionTabs } from "@/components/SectionTabs";
import { GameIcon } from "../GameIcon";
import { AnalysisTab } from "./AnalysisTab";
import { RotationPlanner } from "./RotationPlanner";
import { SetupTab } from "./SetupTab";
import { useLoadout } from "./useLoadout";
import "./combat.css";

const COMBAT_TABS = [
  { id: "Setup", label: "Loadout" },
  { id: "Rotation", label: "Rotation" },
  { id: "Analysis", label: "Analysis" },
] as const;

type Tab = (typeof COMBAT_TABS)[number]["id"];

export function CombatTabs() {
  const [tab, setTab] = useState<Tab>("Setup");
  const [loadout, setLoadout] = useLoadout();

  return (
    <div className="combat-screen flex min-h-0 flex-1 flex-col">
      <header className="combat-toolbar">
        {/* The equipped weapon sets the style, so this icon is the only readout. */}
        <div className="combat-toolbar__title">
          <GameIcon src={styleIconPath(loadout.style)} size={30} />
          <span>Combat</span>
        </div>
        <SectionTabs
          aria-label="Combat sections"
          tabs={COMBAT_TABS}
          active={tab}
          onChange={setTab}
        />
      </header>

      <div className="combat-tab-stage min-h-0 flex-1 overflow-hidden">
        <WorkbenchPanel id="Setup" active={tab}>
          <div className="h-full min-h-0 overflow-auto">
            <SetupTab loadout={loadout} setLoadout={setLoadout} />
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
      </div>
    </div>
  );
}
