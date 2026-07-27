"use client";

/**
 * Development switches, read once from the query string.
 *
 * Deliberately not a settings panel: these exist so geometry can be proved
 * correct and a suspect layer can be turned off in isolation, not so a visitor
 * can detune their own map. Nothing here is persisted and nothing renders UI.
 *
 *   /map?debugGeometry=1   plate outlines, seams, anchors, region ids
 *   /map?topDown=1         lock the camera overhead, for comparing with the raster
 *   /map?no=water,vines     drop layers (water · vines · relief · markers · bloom)
 *   /map?wireframe=1
 */

export interface MapFlags {
  debugGeometry: boolean;
  topDown: boolean;
  wireframe: boolean;
  water: boolean;
  vines: boolean;
  relief: boolean;
  markers: boolean;
  bloom: boolean;
}

const DEFAULTS: MapFlags = {
  debugGeometry: false,
  topDown: false,
  wireframe: false,
  water: true,
  vines: true,
  relief: true,
  markers: true,
  bloom: true,
};

let cached: MapFlags | null = null;

export function mapFlags(): MapFlags {
  if (cached) return cached;
  if (typeof window === "undefined") return DEFAULTS;
  const params = new URLSearchParams(window.location.search);
  const off = new Set((params.get("no") ?? "").split(",").filter(Boolean));
  cached = {
    debugGeometry: params.get("debugGeometry") === "1",
    topDown: params.get("topDown") === "1",
    wireframe: params.get("wireframe") === "1",
    water: !off.has("water"),
    vines: !off.has("vines"),
    relief: !off.has("relief"),
    markers: !off.has("markers"),
    bloom: !off.has("bloom"),
  };
  return cached;
}
