"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { TeamId } from "./teams";

import "./r1/alpha.css";
import "./r1/bravo.css";
import "./r1/charlie.css";
import "./r1/delta.css";
import "./r1/echo.css";

const load = (name: string, loader: () => Promise<{ default: ComponentType }>) =>
  dynamic(loader, {
    ssr: false,
    loading: () => (
      <p className="p-8 text-sm text-parch-300" style={{ minHeight: "80vh" }}>
        Loading {name}…
      </p>
    ),
  });

const PREVIEWS: Record<TeamId, ComponentType> = {
  alpha: load("Daylight", () =>
    import("./r1/AlphaPreview").then((m) => ({ default: m.AlphaPreview })),
  ),
  bravo: load("Stone UI", () =>
    import("./r1/BravoPreview").then((m) => ({ default: m.BravoPreview })),
  ),
  charlie: load("Cinematic", () =>
    import("./r1/CharliePreview").then((m) => ({ default: m.CharliePreview })),
  ),
  delta: load("Crystal", () =>
    import("./r1/DeltaPreview").then((m) => ({ default: m.DeltaPreview })),
  ),
  echo: load("Editorial", () =>
    import("./r1/EchoPreview").then((m) => ({ default: m.EchoPreview })),
  ),
};

const SKIN: Record<TeamId, string> = {
  alpha: "restoration-skin--alpha",
  bravo: "restoration-skin--bravo",
  charlie: "restoration-skin--charlie",
  delta: "restoration-skin--delta",
  echo: "restoration-skin--echo",
};

export function TeamFullBleed({ team }: { team: TeamId }) {
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
