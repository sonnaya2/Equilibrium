"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three/webgpu";
// Side-effect: Timer-backed THREE.Clock before R3F constructs its store.
import "./patchThreeClock";
import { Canvas, extend, useThree } from "@react-three/fiber";
import { useBuild } from "@/league/useBuild";
import { MapTable } from "./MapTable";
import { CameraRig } from "./CameraRig";
import { BloomWhenNeeded } from "./Effects";
import { FlatBoard } from "./FlatBoard";
import { useReducedMotion } from "./useReducedMotion";
import { MAP_IMAGE } from "./data/regionAnchors";
import { mapFlags } from "./mapQuality";
import { OCEAN_HORIZON } from "./materials/WaterMaterial";
import { useMapFocus } from "./useMapFocus";

extend(THREE as never);

/**
 * One renderer per canvas element, cached outside React.
 *
 * A ref cannot do this job: StrictMode's dev replay unmounts and remounts on a
 * fresh fiber, so every ref is new and a second WebGPURenderer gets built over
 * the same canvas. The second `getContext('webgpu')` + configure() displaces the
 * first, which leaves frames drawing while R3F's event system is still bound to
 * the torn-down root — a board that renders and cannot be hovered or clicked.
 * Production never replays, which is why only dev was ever broken.
 *
 * Keyed weakly so a discarded canvas takes its renderer with it.
 */
const RENDERERS = new WeakMap<HTMLCanvasElement, Promise<THREE.WebGPURenderer>>();

type RendererParams = ConstructorParameters<typeof THREE.WebGPURenderer>[0];

function rendererFor(
  props: Record<string, unknown>,
  onFail?: () => void,
): Promise<THREE.WebGPURenderer> {
  const canvas = props.canvas as HTMLCanvasElement | undefined;
  const existing = canvas ? RENDERERS.get(canvas) : undefined;
  if (existing) return existing;
  const made = (async () => {
    try {
      const r = new THREE.WebGPURenderer({ ...props, antialias: true } as RendererParams);
      await r.init();
      return r;
    } catch (err) {
      // A rejected promise stuck in the WeakMap permanently poisons this canvas
      // — adapter present, init dead. Drop it so a remount can retry or fall back.
      if (canvas) RENDERERS.delete(canvas);
      onFail?.();
      throw err;
    }
  })();
  if (canvas) RENDERERS.set(canvas, made);
  return made;
}

/** Re-render the demand-driven canvas when the build changes. */
function InvalidateOnBuild() {
  const invalidate = useThree((s) => s.invalidate);
  const { build } = useBuild();
  useEffect(() => {
    invalidate();
  }, [build, invalidate]);
  return null;
}

/** Demand loop is silent until something invalidates — kick once on mount. */
function KickFirstFrame() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    const id = window.requestAnimationFrame(() => invalidate());
    return () => window.cancelAnimationFrame(id);
  }, [invalidate]);
  return null;
}

export default function MapScene() {
  // Gate on a real adapter, not just the API — three would otherwise fall back
  // to WebGL2 silently, and the honest-unsupported state is the spec.
  const [supported, setSupported] = useState<boolean | null>(null);
  // Adapter can exist while WebGPURenderer.init() still fails (driver, flags).
  // Fall through to FlatBoard rather than leave a blank/broken canvas.
  const failRef = useRef(() => setSupported(false));
  failRef.current = () => setSupported(false);
  const { focus, unframe } = useMapFocus();
  const reducedMotion = useReducedMotion();
  // Exactly one renderer, and it must be built from R3F's own canvas — the
  // factory's `props` carry it, so constructing without them makes three spin up
  // a second, detached canvas and the board renders where nobody can see it.
  //
  // The promise is cached rather than the renderer. StrictMode replays
  // mount/unmount in dev, and an un-cached async factory races two
  // `renderer.init()` calls against the same canvas: the later one reconfigures
  // the GPUCanvasContext so frames keep drawing, while R3F's events stay bound
  // to the root that was torn down. That is a board which renders perfectly and
  // cannot be hovered or clicked, and it only ever reproduced in dev — which is
  // why the production build was fine the whole time.
  //
  // R3F never disposes a custom gl (its forceContextLoss is a WebGL concept
  // WebGPURenderer lacks), so disposal is ours, deferred past the replay.
  // The WeakMap owns the renderer's lifetime now: when React drops the canvas,
  // the entry goes with it. No manual dispose, so nothing can tear down a
  // renderer that the replayed mount is still driving.

  // Sub-760px: FlatBoard is the planner (comments + mobile cost). Skip WebGPU.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (narrow) {
      setSupported(false);
      return;
    }
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) {
      setSupported(false);
      return;
    }
    gpu
      .requestAdapter()
      .then((adapter) => setSupported(adapter !== null))
      .catch(() => setSupported(false));
  }, [narrow]);

  /**
   * Chosen 2D. Checked before the adapter probe and before mounting anything,
   * so picking flat never pays for a WebGPU context — and, unlike the
   * unsupported branch, it says nothing about WebGPU, because nothing is wrong.
   */
  if (focus.flat) {
    return (
      <div className="map-layout__scene">
        <div className="map-layout__canvas-host">
          <FlatBoard />
        </div>
      </div>
    );
  }

  if (supported === null) {
    // Flat raster during the adapter probe so the cell is never an empty void
    // if the probe stalls. WebGPU path replaces this once the adapter resolves.
    return (
      <div className="map-layout__scene" aria-hidden="true">
        <div className="map-layout__canvas-host">
          <FlatBoard />
        </div>
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="map-layout__scene">
        {/* Visible copy always carries the frozen e2e substring (not sr-only-only). */}
        <p className="shrink-0 px-2 pt-2 text-sm text-parch-300">
          {narrow
            ? "no WebGPU — flat board · narrow."
            : "no WebGPU — flat board plans all regions."}
        </p>
        {/* Same canvas-host contract as the WebGPU path: absolute fill, no
            intrinsic-SVG growth into the under ledger. */}
        <div className="map-layout__canvas-host">
          <FlatBoard />
        </div>
      </div>
    );
  }

  return (
    <div className="map-layout__scene">
      {/* Host is sized by the board flex cell, not an aspect-ratio strip.
          CameraRig fits the map from live aspect; absolute canvas fill keeps
          WebGPU glued to the host so min-h-0 ancestors actually work. */}
      <div className="map-layout__canvas-host">
        <Canvas
          // Absolute fill of the host cell; R3F's wrapper default is relative.
          style={{ position: "absolute", inset: 0 }}
          // Cap dpr: 2x on a 4k display multiplies subpixel z-fight and coast
          // aliasing into visible shimmer under the demand loop.
          dpr={[1, 1.5]}
          frameloop="demand"
          // Printed map, not outdoor HDR. R3F defaults to ACES filmic which
          // crushed midtones on LDR wiki albedos under the sparse light rig —
          // FlatBoard stayed bright while the 3D path went muddy.
          flat
          // Opens wide and a little low; CameraRig settles it onto the table
          // shot as the intro descent, or cuts straight there under reduced
          // motion. Perspective, because a straight-down orthographic board
          // hides every bit of the depth this map is built out of.
          // near 0.02 — deep zoom (ZOOM_MAX 10) shortens the sphere; 0.05 clipped.
          camera={{ position: [0.6, 1.9, 2.1], fov: 34, near: 0.02, far: 20 }}
          onPointerMissed={unframe}
          gl={(props) =>
            rendererFor(props as unknown as Record<string, unknown>, () => failRef.current())
          }
        >
          <color attach="background" args={[OCEAN_HORIZON]} />

          {/* The raster, the field, the atlas and the plate rings all suspend.
              Without a boundary inside the canvas that throw escapes to the
              route and takes the whole page down instead of the board. */}
          <Suspense fallback={null}>
            <MapTable reducedMotion={reducedMotion} />
          </Suspense>
          <CameraRig
            focus={focus.framed ? focus.region : null}
            place={focus.place}
            zoom={focus.zoom}
            reducedMotion={reducedMotion}
          />
          {mapFlags().bloom && !mapFlags().debugGeometry ? <BloomWhenNeeded /> : null}
          <InvalidateOnBuild />
          {/* First paint after Suspense resolves — demand loop has nothing until this. */}
          <KickFirstFrame />
        </Canvas>
      </div>
      <p className="map-layout__credit">{MAP_IMAGE.credit}</p>
    </div>
  );
}
