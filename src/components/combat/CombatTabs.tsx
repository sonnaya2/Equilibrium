"use client";

import { useState } from "react";
import { styleIconPath } from "@/lib/gameArt";
import { WorkbenchPanel, SectionTabs } from "@/components/SectionTabs";
import { GameIcon } from "../GameIcon";
import { AnalysisTab } from "./AnalysisTab";
import { CombatFrame } from "./CombatFrame";
import { RotationPlanner } from "./RotationPlanner";
import { SavedSetupRibbon } from "./SavedSetupRibbon";
import { SetupTab } from "./SetupTab";
import { useSavedSetups } from "./useLoadout";
import "./combat.css";
import "./combat-v7.css";

const COMBAT_TABS = [
  { id: "Setup", label: "Loadout" },
  { id: "Rotation", label: "Rotation" },
  { id: "Analysis", label: "Analysis" },
] as const;

type Tab = (typeof COMBAT_TABS)[number]["id"];

export function CombatTabs() {
  const [tab, setTab] = useState<Tab>("Setup");
  const { collection, loadout, setLoadout, actions } = useSavedSetups();

  return (
    <div className="combat-screen">
      <CombatFrame as="header" className="combat-header">
        <div className="combat-toolbar">
          <div className="combat-toolbar__title">
            <GameIcon src={styleIconPath(loadout.style)} size={24} />
            <span>Combat</span>
          </div>
          <SectionTabs
            aria-label="Combat sections"
            tabs={COMBAT_TABS}
            active={tab}
            onChange={setTab}
          />
        </div>
        <SavedSetupRibbon collection={collection} actions={actions} />
      </CombatFrame>

      <div className="combat-tab-stage">
        <WorkbenchPanel id="Setup" active={tab} clip>
          <SetupTab
            loadout={loadout}
            setLoadout={setLoadout}
            onOpenRotation={() => setTab("Rotation")}
          />
        </WorkbenchPanel>
        <WorkbenchPanel id="Rotation" active={tab}>
          <RotationPlanner loadout={loadout} setLoadout={setLoadout} />
        </WorkbenchPanel>
        <WorkbenchPanel id="Analysis" active={tab}>
          <AnalysisTab loadout={loadout} />
        </WorkbenchPanel>
      </div>
    </div>
  );
}
