"use client";

import { useCallback, useEffect, useState } from "react";
import { peekBuildFromLocation, stripShareHash } from "@/league/share";
import { applyBuild, buildHasContent, buildsEqual, hydrateLocalBuild } from "@/league/useBuild";
import type { BuildState } from "@/league/index";

/**
 * Layout-mounted handler for #b= share links. Works on every route, not only
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/80 px-3 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-import-title"
    >
      <section className="surface-panel w-full max-w-sm">
        <div className="surface-panel__header" id="share-import-title">
          Shared build
        </div>
        <div className="surface-panel__body space-y-2.5">
          <p className="text-sm text-parch-300">Link differs from the build saved here.</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={importShared} className="btn btn--gem">
              Import
            </button>
            <button type="button" onClick={keepMine} className="btn">
              Keep mine
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
