"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { HybridTeamId } from "./teams";

import "./r1/nova.css";
import "./r1/orbit.css";
import "./r1/prism.css";
import "./r1/ridge.css";
import "./r1/forge.css";
import "./r2/composite.css";

const load = (name: string, loader: () => Promise<{ default: ComponentType }>) =>
  dynamic(loader, {
    ssr: false,
    loading: () => <p className="p-8 text-sm text-parch-300">Loading {name}…</p>,
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

export function HybridTeamBleed({ team }: { team: HybridTeamId }) {
  const Preview = PREVIEWS[team];
  return (
    <div
      className={`flex-1 ${SKIN[team]}`}
      style={{
        minHeight: "calc(100vh - 3rem)",
        background: "var(--color-stone-950)",
        color: "var(--color-parch-50)",
      }}
    >
      <Preview />
    </div>
  );
}
