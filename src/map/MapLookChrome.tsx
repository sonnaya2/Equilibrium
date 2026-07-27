"use client";

/**
 * Board overlay: what you are looking at + designed zoom controls.
 *
 * Lives outside the WebGPU canvas so it is readable UI (not Html flicker under
 * demand-loop). Wiki opens the existing article dialog — not a second 3D panel.
 */

import { useMemo, useState } from "react";
import {
  activityIconPath,
  bossIconPath,
  regionCrestPath,
  upgradeIconPath,
} from "@/lib/gameArt";
import { WikiArticleDialog, type WikiArticleTarget } from "@/components/WikiArticleDialog";
import { REGION_ANCHOR_BY_ID } from "./data/regionAnchors";
import { useMapFocus, ZOOM_MAX, ZOOM_MIN } from "./useMapFocus";

function localArtFor(name: string, regionId: string): string | null {
  return (
    bossIconPath(name) ??
    activityIconPath(name) ??
    upgradeIconPath(name) ??
    regionCrestPath(regionId)
  );
}

function wikiUrlFor(name: string): string {
  return `https://runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, "_"))}`;
}

export function MapLookChrome() {
  const { focus, nudgeZoom, unframe } = useMapFocus();
  const [wiki, setWiki] = useState<WikiArticleTarget | null>(null);

  const region = REGION_ANCHOR_BY_ID.get(focus.region);
  const regionName = region?.name ?? focus.region;
  const lookingAt = focus.place ?? regionName;
  const subtitle = focus.place
    ? focus.framed
      ? regionName
      : `${regionName} · table`
    : focus.framed
      ? "Region framed"
      : "Table overview";

  const art = useMemo(
    () => localArtFor(lookingAt, focus.region),
    [lookingAt, focus.region],
  );

  const openWiki = () => {
    setWiki({
      name: lookingAt,
      localArtSrc: art,
      wikiUrl: wikiUrlFor(lookingAt),
    });
  };

  return (
    <>
      <div className="board-sky__look" aria-live="polite">
        <div className="board-sky__look-main">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element -- local game art only
            <img src={art} alt="" className="board-sky__look-art" width={36} height={36} />
          ) : null}
          <div className="board-sky__look-copy">
            <span className="board-sky__look-kicker">{subtitle}</span>
            <strong className="board-sky__look-title">{lookingAt}</strong>
          </div>
        </div>
        <div className="board-sky__look-actions" title="WASD pan · drag orbit · scroll zoom">
          <button
            type="button"
            className="board-sky__zoom"
            onClick={() => nudgeZoom(-1)}
            disabled={focus.zoom <= ZOOM_MIN}
            title="Zoom out (or scroll)"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="board-sky__zoom"
            onClick={() => nudgeZoom(1)}
            disabled={focus.zoom >= ZOOM_MAX}
            title="Zoom in (or scroll)"
            aria-label="Zoom in"
          >
            +
          </button>
          {focus.framed ? (
            <button type="button" className="board-sky__look-btn" onClick={() => unframe()}>
              Table
            </button>
          ) : null}
          <button type="button" className="board-sky__look-btn board-sky__look-btn--gem" onClick={openWiki}>
            Wiki
          </button>
        </div>
      </div>
      <WikiArticleDialog target={wiki} onClose={() => setWiki(null)} />
    </>
  );
}
