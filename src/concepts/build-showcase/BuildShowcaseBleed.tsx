"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { BuildShowcaseFrame } from "./BuildShowcaseFrame";
import type { BuildConceptId } from "./teams";
import "./build-showcase.css";

const load = (name: string, loader: () => Promise<{ default: ComponentType }>) =>
  dynamic(loader, {
    ssr: false,
    loading: () => (
      <p className="p-6 text-sm text-parch-300" aria-busy="true">
        Loading {name}…
      </p>
    ),
  });

const PREVIEWS: Record<BuildConceptId, ComponentType> = {
  "war-court": load("War Court", () =>
    import("./WarCourt").then((m) => ({ default: m.WarCourt })),
  ),
  "dossier-board": load("Dossier Board", () =>
    import("./DossierBoard").then((m) => ({ default: m.DossierBoard })),
  ),
  "herald-stage": load("Herald Stage", () =>
    import("./HeraldStage").then((m) => ({ default: m.HeraldStage })),
  ),
  herald: load("Herald Card", () =>
    import("./HeraldCard").then((m) => ({ default: m.HeraldCard })),
  ),
  roster: load("War Roster", () =>
    import("./WarRoster").then((m) => ({ default: m.WarRoster })),
  ),
  dossier: load("Court Dossier", () =>
    import("./CourtDossier").then((m) => ({ default: m.CourtDossier })),
  ),
  plaque: load("Gem Plaque", () =>
    import("./GemPlaque").then((m) => ({ default: m.GemPlaque })),
  ),
  billboard: load("Strip Billboard", () =>
    import("./StripBillboard").then((m) => ({ default: m.StripBillboard })),
  ),
};

export function BuildShowcaseBleed({ id }: { id: BuildConceptId }) {
  const Preview = PREVIEWS[id];
  return (
    <BuildShowcaseFrame active={id}>
      <Preview />
    </BuildShowcaseFrame>
  );
}
