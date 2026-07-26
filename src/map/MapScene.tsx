"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three/webgpu";
// Side-effect: Timer-backed THREE.Clock before R3F constructs its store.
import "./patchThreeClock";
import { Canvas, extend, useThree } from "@react-three/fiber";
import { useBuild } from "@/league/useBuild";
import { MapTable } from "./MapTable";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { FitProbe } from "./FitProbe";
import { FlatBoard } from "./FlatBoard";
import { Ocean } from "./Ocean";
import { useReducedMotion } from "./useReducedMotion";
import { MAP_IMAGE } from "./data/regionAnchors";
import { LIGHT_FILL, LIGHT_KEY, LIGHT_RIM, SURFACE_VOID } from "./palette";
import { useMapFocus } from "./useMapFocus";
import { VineFrame } from "./VineFrame";

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

/**
 * frameloop="demand" sleeps unless something invalidates. Any store change
 * that forgets leaves a stale frame on screen (wartable plan, risk 3), so one
 * subscription re-renders on every build mutation.
 */
function InvalidateOnBuild() {
  const invalidate = useThree((s) => s.invalidate);
  const { build } = useBuild();
  useEffect(() => {
    invalidate();
  }, [build, invalidate]);
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

  if (supported === null) {
    return <div className="panel min-h-0 w-full flex-1" aria-hidden="true" />;
  }

  if (!supported) {
    return (
      <div className="panel panel-body min-h-0 flex-1 overflow-y-auto">
        <p className="mb-3 text-sm text-parch-300">
          {narrow
            ? "Narrow layout uses the flat board so every region choice stays usable without the 3D table."
            : "This browser has no WebGPU, so the 3D table stays off. The board below is the full planner - every region choice works here."}
        </p>
        {/* e2e/map3d.spec.ts matches /no WebGPU/ when the 3D path is unavailable. */}
        <span className="sr-only">no WebGPU</span>
        {/* The frame belongs to the board, not to the panel: wrapped any wider
            it grows its corners over the copy above. */}
        <div className="relative">
          <FlatBoard />
          <VineFrame />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Sized by the viewport, not by an aspect ratio. The old aspect-[1.88]
          box was the dead-space bug: it pinned the board to a strip whatever
          the screen had to offer. CameraRig solves its radius from the live
          aspect, so a taller canvas is simply a bigger board — but only if
          every ancestor carries min-h-0, or this cell refuses to shrink and
          the page grows a scrollbar instead. */}
      <div className="panel relative min-h-0 w-full flex-1 overflow-hidden">
        <Canvas
          dpr={[1, 2]}
          frameloop="demand"
          // Starts wide and high; the rig settles to the table framing as the
          // intro descent (a hard cut under reduced motion).
          camera={{ position: [0.9, 2.4, 2.1], fov: 42, near: 0.05, far: 20 }}
          onPointerMissed={unframe}
          gl={(props) =>
            rendererFor(props as unknown as Record<string, unknown>, () => failRef.current())
          }
        >
          <color attach="background" args={[SURFACE_VOID]} />

          {/* Warm key over a warm board, with a gem rim so raised slab edges
              separate from the void. The cool sage/mint this replaced fought
              the umber palette and flattened every extrusion. */}
          <ambientLight intensity={0.42} color={LIGHT_FILL} />
          <directionalLight position={[1.6, 2.4, 0.9]} intensity={1.7} color={LIGHT_KEY} />
          <directionalLight position={[-1.8, 1.2, -1.6]} intensity={0.45} color={LIGHT_RIM} />

          <Ocean reducedMotion={reducedMotion} />
          <MapTable reducedMotion={reducedMotion} />
          <CameraRig
            focus={focus.framed ? focus.region : null}
            place={focus.place}
            reducedMotion={reducedMotion}
          />
          <InvalidateOnBuild />
          {process.env.NODE_ENV === "production" ? null : <FitProbe />}
          {/* Bloom is scoped to the emissive MRT target, and nothing is emissive
              at rest — only the focus rim and the unlock sweep ever light up. */}
          <Effects />
        </Canvas>
        <VineFrame />
      </div>
      <p className="mt-1.5 text-xs text-parch-500">{MAP_IMAGE.credit}</p>
    </div>
  );
}
