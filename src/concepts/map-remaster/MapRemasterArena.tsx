"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentType } from "react";
import {
  MAP_REMASTER_TEAMS,
  type MapRemasterTeamId,
} from "./teams";

const load = (name: string, loader: () => Promise<{ default: ComponentType }>) =>
  dynamic(loader, {
    ssr: false,
    loading: () => <p className="p-6 text-sm text-parch-300">Loading {name}…</p>,
  });

const PREVIEWS: Record<MapRemasterTeamId, ComponentType> = {
  daylit: load("Daylit Reliquary", () =>
    import("./daylit/DaylitPreview").then((m) => ({ default: m.DaylitPreview })),
  ),
  crystal: load("Crystal Frontier", () =>
    import("./crystal/CrystalPreview").then((m) => ({ default: m.CrystalPreview })),
  ),
  cartographer: load("Cartographer's Desk", () =>
    import("./cartographer/CartographerPreview").then((m) => ({
      default: m.CartographerPreview,
    })),
  ),
  boardsky: load("Deep Board Sky", () =>
    import("./boardsky/BoardskyPreview").then((m) => ({ default: m.BoardskyPreview })),
  ),
  raised: load("Raised Court", () =>
    import("./raised/RaisedPreview").then((m) => ({ default: m.RaisedPreview })),
  ),
};

export function MapRemasterArena({
  initialTeam = "daylit",
}: {
  initialTeam?: MapRemasterTeamId;
}) {
  const [team, setTeam] = useState<MapRemasterTeamId>(initialTeam);
  const Preview = PREVIEWS[team];
  const meta = MAP_REMASTER_TEAMS.find((t) => t.id === team)!;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Map remaster teams">
          {MAP_REMASTER_TEAMS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === team}
              onClick={() => setTeam(t.id)}
              className={`border px-3 py-1.5 text-sm ${
                t.id === team
                  ? "border-gem-500 bg-stone-850 text-gem-300"
                  : "border-stone-750 text-parch-100 hover:text-parch-50"
              }`}
            >
              {t.codename}
            </button>
          ))}
        </div>
        <a
          href={`/concepts/map-remaster/${team}`}
          className="ml-auto text-xs text-gem-300 hover:underline"
        >
          Open {meta.codename} full page →
        </a>
      </div>
      <p className="mb-2 text-sm text-parch-100">
        <span className="font-medium text-parch-50">{meta.name}</span>
        {" · "}
        {meta.agents.join(" + ")}
        {" · "}
        {meta.thesis}
      </p>
      <div
        className="overflow-hidden border border-stone-750"
        style={{
          minHeight: "78vh",
          background: "var(--color-stone-950)",
          color: "var(--color-parch-50)",
        }}
      >
        <Preview />
      </div>
    </div>
  );
}
