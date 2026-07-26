"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { GalleryWarId } from "./teams";
import type { TasksDensityPreviewProps } from "../TasksDensityTeamMount";

function stub(id: string): ComponentType<TasksDensityPreviewProps> {
  function Stub() {
    return (
      <p className="border border-stone-750 px-3 py-8 text-sm text-parch-100">
        Fighter <span className="font-mono text-gem-300">{id}</span> entering the arena…
      </p>
    );
  }
  Stub.displayName = `GalleryWarStub_${id}`;
  return Stub;
}

function load(id: GalleryWarId, loader: () => Promise<{ default?: ComponentType<TasksDensityPreviewProps> } & Record<string, ComponentType<TasksDensityPreviewProps>>>) {
  return dynamic(
    () =>
      loader()
        .then((m) => {
          const name = `${id[0]!.toUpperCase()}${id.slice(1)}Preview`;
          const C = m[name] ?? m.default;
          return C ?? stub(id);
        })
        .catch(() => stub(id)),
    { ssr: false },
  );
}

const PREVIEWS: Record<GalleryWarId, ComponentType<TasksDensityPreviewProps>> = {
  ash: load("ash", () => import("./r1/ash/AshPreview")),
  ember: load("ember", () => import("./r1/ember/EmberPreview")),
  grove: load("grove", () => import("./r2/grove/GrovePreview")),
  vault: load("vault", () => import("./r1/vault/VaultPreview")),
  cipher: load("cipher", () => import("./r3/cipher/CipherPreview")),
  bastion: load("bastion", () => import("./r1/bastion/BastionPreview")),
  quill: load("quill", () => import("./r2/quill/QuillPreview")),
  crucible: load("crucible", () => import("./r2/crucible/CruciblePreview")),
  sigil: load("sigil", () => import("./r3/sigil/SigilPreview")),
  oracle: load("oracle", () => import("./r1/oracle/OraclePreview")),
};

export function GalleryWarMount({
  teamId,
  ...props
}: TasksDensityPreviewProps & { teamId: GalleryWarId }) {
  const Preview = PREVIEWS[teamId];
  return <Preview {...props} />;
}
