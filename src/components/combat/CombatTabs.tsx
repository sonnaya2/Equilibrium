"use client";

import { useState, type ReactNode } from "react";
import type { CombatStyle } from "@/combat/types";
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

const STYLE_LABELS: Record<CombatStyle, string> = {
  melee: "Melee",
  ranged: "Ranged",
  magic: "Magic",
  necromancy: "Necromancy",
};

const STYLES: CombatStyle[] = ["melee", "ranged", "magic", "necromancy"];

export function CombatTabs({ sourceLinks }: { sourceLinks: ReactNode }) {
  const [tab, setTab] = useState<Tab>("Setup");
  const [loadout, setLoadout] = useLoadout();

  const setStyle = (style: CombatStyle) => {
    if (style === loadout.style) return;
    if (style === "melee") {
      setLoadout({
        ...loadout,
        style,
        baseDamage: { ...loadout.baseDamage, mode: "automatic" },
        level: loadout.strengthLevel,
      });
      return;
    }
    setLoadout({
      ...loadout,
      style,
      baseDamage: { ...loadout.baseDamage, mode: "automatic" },
      level: loadout.style === "melee" ? loadout.strengthLevel : loadout.level,
    });
  };

  return (
    <div className="combat-screen flex min-h-0 flex-1 flex-col">
      <header className="combat-toolbar">
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
        {tab === "Setup" ? (
          <div className="combat-toolbar__styles" role="group" aria-label="Combat style">
            {STYLES.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setStyle(style)}
                aria-pressed={loadout.style === style}
                className="combat-button setup-style-button"
              >
                <GameIcon src={styleIconPath(style)} size={18} />
                {STYLE_LABELS[style]}
              </button>
            ))}
          </div>
        ) : null}
        <div className="combat-toolbar__sources">{sourceLinks}</div>
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
