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
 * One renderer per canvas across StrictMode replays.
 * WeakMap alone does not free GPU resources - R3F never disposes custom gl,
 * and WebGPURenderer has no forceContextLoss. Dispose on real unmount (route
 * leave / flat switch); cancel if the same canvas remounts before the timer.
 */
const RENDERERS = new WeakMap<HTMLCanvasElement, Promise<THREE.WebGPURenderer>>();
const DISPOSE_TIMERS = new WeakMap<HTMLCanvasElement, ReturnType<typeof setTimeout>>();

type RendererParams = ConstructorParameters<typeof THREE.WebGPURenderer>[0];

function cancelRendererDispose(canvas: HTMLCanvasElement | undefined): void {
  if (!canvas) return;
  const timer = DISPOSE_TIMERS.get(canvas);
  if (timer == null) return;
  clearTimeout(timer);
  DISPOSE_TIMERS.delete(canvas);
}

function scheduleRendererDispose(canvas: HTMLCanvasElement | undefined): void {
  if (!canvas) return;
  cancelRendererDispose(canvas);
  DISPOSE_TIMERS.set(
    canvas,
    setTimeout(() => {
      DISPOSE_TIMERS.delete(canvas);
      const pending = RENDERERS.get(canvas);
      RENDERERS.delete(canvas);
      if (!pending) return;
      void pending
        .then((renderer) => {
          renderer.dispose();
        })
        .catch(() => {
          // Init failed; catch path already dropped the WeakMap entry.
        });
    }, 0),
  );
}

function rendererFor(
  props: Record<string, unknown>,
  onFail?: () => void,
): Promise<THREE.WebGPURenderer> {
  const canvas = props.canvas as HTMLCanvasElement | undefined;
  cancelRendererDispose(canvas);
  const existing = canvas ? RENDERERS.get(canvas) : undefined;
  if (existing) return existing;
  const made = (async () => {
    try {
      const r = new THREE.WebGPURenderer({ ...props, antialias: true } as RendererParams);
      await r.init();
      return r;
    } catch (err) {
      // Remove failed initialization so a remount can retry or use the flat fallback.
      if (canvas) RENDERERS.delete(canvas);
      onFail?.();
      throw err;
    }
  })();
  if (canvas) RENDERERS.set(canvas, made);
  return made;
}

/** Dispose the custom WebGPU gl when the canvas fiber really leaves (not StrictMode replay). */
function DisposeGlOnUnmount() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement as HTMLCanvasElement;
    cancelRendererDispose(canvas);
    return () => scheduleRendererDispose(canvas);
  }, [gl]);
  return null;
}

function InvalidateOnBuild() {
  const invalidate = useThree((s) => s.invalidate);
  const { build } = useBuild();
  useEffect(() => {
    invalidate();
  }, [build, invalidate]);
  return null;
}

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
  const [supported, setSupported] = useState<boolean | null>(null);
  const failRef = useRef(() => setSupported(false));
  failRef.current = () => setSupported(false);
  const { focus, unframe } = useMapFocus();
  const reducedMotion = useReducedMotion();

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
    // Keep the flat board visible while WebGPU adapter detection is pending.
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
          // Flat tone mapping preserves the LDR Wiki raster's midtones.
          flat
          // Perspective preserves relief; near 0.02 prevents clipping at maximum zoom.
          camera={{ position: [0.6, 1.9, 2.1], fov: 34, near: 0.02, far: 20 }}
          onPointerMissed={unframe}
          gl={(props) =>
            rendererFor(props as unknown as Record<string, unknown>, () => failRef.current())
          }
        >
          <color attach="background" args={[OCEAN_HORIZON]} />

          {/* Keep map-asset suspension inside the canvas. */}
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
          <DisposeGlOnUnmount />
          <InvalidateOnBuild />
          {/* First paint after Suspense resolves - demand loop has nothing until this. */}
          <KickFirstFrame />
        </Canvas>
      </div>
      <p className="map-layout__credit">{MAP_IMAGE.credit}</p>
    </div>
  );
}
