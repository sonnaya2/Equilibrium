"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentType } from "react";
import { HYBRID_TEAMS, type HybridTeamId } from "./teams";

import "./r1/nova.css";
import "./r1/orbit.css";
import "./r1/prism.css";
import "./r1/ridge.css";
import "./r1/forge.css";
import "./r2/composite.css";

const load = (name: string, loader: () => Promise<{ default: ComponentType }>) =>
  dynamic(loader, {
    ssr: false,
    loading: () => <p className="p-6 text-sm text-parch-300">Loading {name}…</p>,
  });

const PREVIEWS: Record<HybridTeamId, ComponentType> = {
  nova: load("Nova", () => import("./r1/NovaPreview").then((m) => ({ default: m.NovaPreview }))),
  orbit: load("Orbit", () => import("./r1/OrbitPreview").then((m) => ({ default: m.OrbitPreview }))),
  prism: load("Prism", () => import("./r1/PrismPreview").then((m) => ({ default: m.PrismPreview }))),
  ridge: load("Ridge", () => import("./r1/RidgePreview").then((m) => ({ default: m.RidgePreview }))),
  forge: load("Forge", () => import("./r1/ForgePreview").then((m) => ({ default: m.ForgePreview }))),
  composite: load("Champion", () =>
    import("./r2/CompositePreview").then((m) => ({ default: m.CompositePreview })),
  ),
};

const SKIN: Record<HybridTeamId, string> = {
  nova: "hybrid-skin--nova",
  orbit: "hybrid-skin--orbit",
  prism: "hybrid-skin--prism",
  ridge: "hybrid-skin--ridge",
  forge: "hybrid-skin--forge",
  composite: "hybrid-skin--composite",
};

export function HybridArena() {
  const [team, setTeam] = useState<HybridTeamId>("composite");
  const Preview = PREVIEWS[team];
  const meta = HYBRID_TEAMS.find((t) => t.id === team)!;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Hybrid teams">
          {HYBRID_TEAMS.map((t) => (
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
        <a href={`/concepts/hybrid/${team}`} className="ml-auto text-xs text-gem-300 hover:underline">
          Open {meta.codename} full page →
        </a>
      </div>
      <p className="mb-2 text-sm text-parch-100">
        <span className="font-medium text-parch-50">{meta.name}</span> · {meta.agents.join(" + ")} ·{" "}
        {meta.angle}
      </p>
      <div
        className={`overflow-hidden border border-stone-750 ${SKIN[team]}`}
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
