"use client";

import { useCallback, useEffect, useState } from "react";
import { peekBuildFromLocation, stripShareHash } from "@/league/share";
import {
  applyBuild,
  buildHasContent,
  buildsEqual,
  hydrateLocalBuild,
} from "@/league/useBuild";
import type { BuildState } from "@/league/index";

/**
 * Layout-mounted one-shot for #b= share links. Works on every route — not only
 * pages that call useBuild. Conflict with a non-empty local build opens a carved
 * panel; empty (or identical) local imports immediately.
 */

export function ShareImport() {
  const [pending, setPending] = useState<BuildState | null>(null);

  const resolveShare = useCallback(() => {
    const shared = peekBuildFromLocation();
    if (!shared) return;

    const local = hydrateLocalBuild();

    if (!buildHasContent(local) || buildsEqual(local, shared)) {
      applyBuild(shared);
      stripShareHash();
      setPending(null);
      return;
    }

    // Leave hash until the user chooses so a refresh re-opens the prompt.
    setPending(shared);
  }, []);

  useEffect(() => {
    resolveShare();
    window.addEventListener("hashchange", resolveShare);
    return () => window.removeEventListener("hashchange", resolveShare);
  }, [resolveShare]);

  const importShared = () => {
    if (!pending) return;
    applyBuild(pending);
    stripShareHash();
    setPending(null);
  };

  const keepMine = () => {
    // Local already hydrated; only drop the share payload.
    stripShareHash();
    setPending(null);
  };

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/75 px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-import-title"
    >
      <section className="panel w-full max-w-md">
        <div className="panel-head" id="share-import-title">
          Shared build
        </div>
        <div className="panel-body space-y-4">
          <p className="text-sm text-parch-300">
            This link carries a build that differs from what is saved in this browser. Import it, or
            keep yours.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={importShared}
              className="rounded-sm border border-gem-500 bg-gem-600 px-3 py-1.5 text-sm text-parch-50 transition-colors duration-150 hover:bg-gem-500"
            >
              Import shared build
            </button>
            <button
              type="button"
              onClick={keepMine}
              className="rounded-sm border border-stone-750 bg-stone-800 px-3 py-1.5 text-sm text-parch-50 transition-colors duration-150 hover:border-stone-carve hover:text-parch-50"
            >
              Keep mine
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
