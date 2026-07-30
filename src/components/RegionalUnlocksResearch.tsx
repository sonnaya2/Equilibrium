"use client";

import { useEffect, useState } from "react";
import type { ResearchRegionalPanel } from "@/research/catalog";
import { useDataRegion } from "./DataBrowser";
import { ResearchSection, type ResearchTab } from "./ResearchSection";

export function RegionalUnlocksResearch() {
  const region = useDataRegion();
  const [rows, setRows] = useState<ResearchRegionalPanel | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const href = region?.panelHrefs?.regional;
    if (!href) {
      setRows(null);
      setError("");
      return;
    }
    let live = true;
    setRows(null);
    setError("");
    fetch(href, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) throw new Error(`Regional data returned ${response.status}`);
        return response.json() as Promise<ResearchRegionalPanel & { region: string }>;
      })
      .then((data) => {
        if (live && data.region === region.id) setRows(data);
      })
      .catch((reason) => {
        if (live)
          setError(reason instanceof Error ? reason.message : "Regional data failed to load");
      });
    return () => {
      live = false;
    };
  }, [region]);

  const tabs: ResearchTab[] = [
    { key: "skilling-activities", label: "Skilling", rows: rows?.skillingActivities ?? [] },
    { key: "skilling-equipment", label: "Skilling gear", rows: rows?.skillingEquipment ?? [] },
    { key: "combat-accounts", label: "Account", rows: rows?.combatAccounts ?? [] },
    { key: "combat-activities", label: "Combat", rows: rows?.combatActivities ?? [] },
    { key: "combat-equipment", label: "Combat gear", rows: rows?.combatEquipment ?? [] },
  ];

  if (error) return <p className="px-4 py-6 text-sm text-red-300">{error}</p>;

  return (
    <ResearchSection
      title="Regional"
      intro=""
      tabs={tabs}
      searchPlaceholder="Search"
      searchLabel="Search regional unlocks"
    />
  );
}
