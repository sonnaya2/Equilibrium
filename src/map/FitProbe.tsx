"use client";

/**
 * Dev-only: how big does a region actually land, in CSS pixels?
 *
 * On-screen size is a function of canvas pixels and the camera solve, not of
 * world units — so "make the board bigger" is only checkable by projecting the
 * real geometry through the real camera and reading the spread. Re-normalising
 * MAP_WORLD to chase a pixel target would invalidate every uv anchor, every
 * border node and all eleven authored framings, and change nothing on screen.
 *
 * Tree-shaken out of production by the NODE_ENV guard at its mount site.
 * Call `window.__mapFitProbe()` once the rig has settled.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three/webgpu";
import { useFrame, useThree } from "@react-three/fiber";
import { MAP_WORLD } from "./data/regionAnchors";
import { smoothRing } from "./data/regionCurve";
import { REGION_SHAPES } from "./data/regionShapes";

export interface FitReport {
  canvas: string;
  p10: number;
  median: number;
  p90: number;
  widest: string;
  narrowest: string;
  /** CSS px cut off each side. Positive means the board runs off the canvas. */
  overflow: { left: number; right: number; top: number; bottom: number };
  regions: { id: string; w: number; h: number }[];
}

export function FitProbe() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);

  // Ground truth for "is frameloop=demand actually sleeping": count R3F loop
  // ticks directly. Deliberately does not invalidate, so measuring cannot
  // itself keep the loop awake.
  const ticks = useRef(0);
  useFrame(() => {
    ticks.current += 1;
  });

  // Renderer counters, for checking that the demand loop still sleeps and that
  // marker/vine work did not quietly multiply draw calls. Dev only.
  useEffect(() => {
    const w = window as Window & { __mapDiag?: () => unknown };
    w.__mapDiag = () => {
      const info = (gl as unknown as { info: THREE.WebGPURenderer["info"] }).info;
      return {
        // `frame` is top-level on three's Info, not under `render`.
        frame: info.frame,
        ticks: ticks.current,
        calls: info.render.calls,
        drawCalls: info.render.drawCalls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      };
    };
    return () => {
      delete w.__mapDiag;
    };
  }, [gl]);

  useEffect(() => {
    const v = new THREE.Vector3();
    const measure = (): FitReport => {
      const regions = REGION_SHAPES.map((shape) => {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        // Measured at cap height: that is the silhouette a player sees, and a
        // slab read at y=0 under a 46-degree tilt is a few percent smaller.
        for (const [u, w] of smoothRing(shape)) {
          v.set((u - 0.5) * MAP_WORLD.width, shape.depth, (w - 0.5) * MAP_WORLD.height);
          v.project(camera);
          const px = (v.x * 0.5 + 0.5) * size.width;
          const py = (-v.y * 0.5 + 0.5) * size.height;
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);
        }
        return { id: shape.id, w: Math.round(maxX - minX), h: Math.round(maxY - minY) };
      }).sort((a, b) => a.w - b.w);

      // Does the whole board actually sit inside the canvas? The camera solve
      // fits against the target plane, but the tilt puts the south coast much
      // nearer the camera, where perspective magnifies it — so a fit that looks
      // right on paper can still run the board off the bottom edge.
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const shape of REGION_SHAPES) {
        for (const [u, w] of smoothRing(shape)) {
          v.set((u - 0.5) * MAP_WORLD.width, shape.depth, (w - 0.5) * MAP_WORLD.height);
          v.project(camera);
          minX = Math.min(minX, (v.x * 0.5 + 0.5) * size.width);
          maxX = Math.max(maxX, (v.x * 0.5 + 0.5) * size.width);
          minY = Math.min(minY, (-v.y * 0.5 + 0.5) * size.height);
          maxY = Math.max(maxY, (-v.y * 0.5 + 0.5) * size.height);
        }
      }
      const overflow = {
        left: Math.round(-minX),
        right: Math.round(maxX - size.width),
        top: Math.round(-minY),
        bottom: Math.round(maxY - size.height),
      };

      const widths = regions.map((r) => r.w);
      const pct = (p: number) => widths[Math.min(widths.length - 1, Math.round((widths.length - 1) * p))];
      return {
        canvas: `${Math.round(size.width)}x${Math.round(size.height)}`,
        p10: pct(0.1),
        median: pct(0.5),
        p90: pct(0.9),
        narrowest: `${regions[0].id} ${regions[0].w}px`,
        widest: `${regions[regions.length - 1].id} ${regions[regions.length - 1].w}px`,
        /** Positive on any side means the board is cut off there, in CSS px. */
        overflow,
        regions,
      };
    };

    const w = window as Window & { __mapFitProbe?: () => FitReport };
    w.__mapFitProbe = measure;
    return () => {
      delete w.__mapFitProbe;
    };
  }, [camera, size]);

  return null;
}
