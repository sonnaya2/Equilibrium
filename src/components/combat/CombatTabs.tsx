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
    <div className="combat-screen">
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

      <div className="combat-tab-stage">
        <WorkbenchPanel id="Setup" active={tab}>
          <SetupTab loadout={loadout} setLoadout={setLoadout} />
        </WorkbenchPanel>
        <WorkbenchPanel id="Rotation" active={tab} clip>
          <RotationPlanner loadout={loadout} setLoadout={setLoadout} />
        </WorkbenchPanel>
        <WorkbenchPanel id="Analysis" active={tab} clip>
          <AnalysisTab loadout={loadout} />
        </WorkbenchPanel>
      </div>
    </div>
  );
}
