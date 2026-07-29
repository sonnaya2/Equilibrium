"use client";

/**
 * Development-only query switches, read once and never persisted:
 *   /map?debugGeometry=1   plate outlines, seams, anchors, region ids
 *   /map?topDown=1         lock the camera overhead, for comparing with the raster
 *   /map?no=water,relief,markers,bloom
 *   /map?wireframe=1
 */

export interface MapFlags {
  debugGeometry: boolean;
  topDown: boolean;
  wireframe: boolean;
  water: boolean;
  relief: boolean;
  markers: boolean;
  bloom: boolean;
}

const DEFAULTS: MapFlags = {
  debugGeometry: false,
  topDown: false,
  wireframe: false,
  water: true,
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
    relief: !off.has("relief"),
    markers: !off.has("markers"),
    bloom: !off.has("bloom"),
  };
  return cached;
}
