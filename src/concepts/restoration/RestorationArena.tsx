"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentType } from "react";
import { TEAMS, type TeamId } from "./teams";

import "./r1/alpha.css";
import "./r1/bravo.css";
import "./r1/charlie.css";
import "./r1/delta.css";
import "./r1/echo.css";

const load = (name: string, loader: () => Promise<{ default: ComponentType }>) =>
  dynamic(loader, {
    ssr: false,
    loading: () => <p className="p-4 text-sm text-parch-300">Loading {name}…</p>,
  });

const PREVIEWS: Record<TeamId, ComponentType> = {
  alpha: load("Alpha", () => import("./r1/AlphaPreview").then((m) => ({ default: m.AlphaPreview }))),
  bravo: load("Bravo", () => import("./r1/BravoPreview").then((m) => ({ default: m.BravoPreview }))),
  charlie: load("Charlie", () =>
    import("./r1/CharliePreview").then((m) => ({ default: m.CharliePreview })),
  ),
  delta: load("Delta", () => import("./r1/DeltaPreview").then((m) => ({ default: m.DeltaPreview }))),
  echo: load("Echo", () => import("./r1/EchoPreview").then((m) => ({ default: m.EchoPreview }))),
};

const SKIN: Record<TeamId, string> = {
  alpha: "restoration-skin--alpha",
  bravo: "restoration-skin--bravo",
  charlie: "restoration-skin--charlie",
  delta: "restoration-skin--delta",
  echo: "restoration-skin--echo",
};

export function RestorationArena() {
  const [team, setTeam] = useState<TeamId>("alpha");
  const Preview = PREVIEWS[team];
  const meta = TEAMS.find((t) => t.id === team)!;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Teams">
          {TEAMS.map((t) => (
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
          href={`/concepts/restoration/${team}`}
          className="ml-auto text-xs text-gem-300 hover:underline"
        >
          Open {meta.codename} full page →
        </a>
      </div>
      <p className="mb-2 text-sm text-parch-100">
        <span className="font-medium text-parch-50">{meta.name}</span> · {meta.agents.join(" + ")} ·{" "}
        {meta.bias}
      </p>
      <div
        className={`restoration-arena overflow-hidden border border-stone-750 ${SKIN[team]}`}
        style={{
          minHeight: "75vh",
          background: "var(--color-stone-950)",
          color: "var(--color-parch-50)",
        }}
      >
        <Preview />
      </div>
    </div>
  );
}
