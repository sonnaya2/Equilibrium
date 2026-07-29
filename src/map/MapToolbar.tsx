"use client";

/**
 * Board overlay: what you are looking at + designed zoom controls.
 *
 * Lives outside the WebGPU canvas so it is readable UI (not Html flicker under
 * demand-loop). Wiki opens the existing article dialog — not a second 3D panel.
 */

import { useMemo, useState } from "react";
import { activityIconPath, bossIconPath, regionCrestPath, upgradeIconPath } from "@/lib/gameArt";
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

export function MapToolbar() {
  const { focus, nudgeZoom, unframe, setFlatBoard } = useMapFocus();
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

  const art = useMemo(() => localArtFor(lookingAt, focus.region), [lookingAt, focus.region]);

  const openWiki = () => {
    setWiki({
      name: lookingAt,
      localArtSrc: art,
      wikiUrl: wikiUrlFor(lookingAt),
    });
  };

  return (
    <>
      <div className="map-layout__look" aria-live="polite">
        <div className="map-layout__look-main">
          {art ? (
            <img src={art} alt="" className="map-layout__look-art" width={36} height={36} />
          ) : null}
          <div className="map-layout__look-copy">
            <span className="map-layout__look-kicker">{subtitle}</span>
            <strong className="map-layout__look-title">{lookingAt}</strong>
          </div>
        </div>
        <div className="map-layout__look-actions" title="WASD pan · drag orbit · scroll zoom">
          <button
            type="button"
            className="map-layout__zoom"
            onClick={() => nudgeZoom(-1)}
            disabled={focus.zoom <= ZOOM_MIN}
            title="Zoom out (or scroll)"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="map-layout__zoom"
            onClick={() => nudgeZoom(1)}
            disabled={focus.zoom >= ZOOM_MAX}
            title="Zoom in (or scroll)"
            aria-label="Zoom in"
          >
            +
          </button>
          {focus.framed ? (
            <button type="button" className="map-layout__look-btn" onClick={() => unframe()}>
              Table
            </button>
          ) : null}
          {/* Reads as the state you are in, not the state you would move to —
              aria-pressed carries the "would switch" meaning for a reader. */}
          <button
            type="button"
            className={`map-layout__look-btn${focus.flat ? " is-on" : ""}`}
            onClick={() => setFlatBoard(!focus.flat)}
            aria-pressed={focus.flat}
            title={focus.flat ? "Switch to the 3D board" : "Switch to the flat 2D map"}
          >
            {focus.flat ? "2D" : "3D"}
          </button>
          <button
            type="button"
            className="map-layout__look-btn map-layout__look-btn--gem"
            onClick={openWiki}
          >
            Wiki
          </button>
        </div>
      </div>
      <WikiArticleDialog target={wiki} onClose={() => setWiki(null)} />
    </>
  );
}
