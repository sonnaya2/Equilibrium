"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import { Canvas, extend, useThree } from "@react-three/fiber";
import { useBuild } from "@/league/useBuild";
import { MapTable } from "./MapTable";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { FlatBoard } from "./FlatBoard";
import { useReducedMotion } from "./useReducedMotion";
import { MAP_IMAGE, type RegionAnchor } from "./data/regionAnchors";
import { LIGHT_FILL, LIGHT_KEY, LIGHT_RIM, SURFACE_VOID } from "./palette";

extend(THREE as never);

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
  const [focus, setFocus] = useState<RegionAnchor | null>(null);
  const reducedMotion = useReducedMotion();
  // R3F never calls dispose() on a custom gl (its forceContextLoss is a WebGL
  // concept WebGPURenderer lacks), so every Canvas mount would leak a whole
  // renderer. Dispose it ourselves on unmount — but deferred: StrictMode
  // replays mount/unmount synchronously in dev, and disposing there wipes the
  // renderer's texture registry while R3F keeps driving the same instance
  // (every later frame then throws "Texture already initialized" on the
  // shared DFG LUT). The replayed mount cancels the timer; only a real
  // unmount (route change) lets it fire.
  const rendererRef = useRef<THREE.WebGPURenderer | null>(null);
  const disposeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (disposeTimer.current) {
      clearTimeout(disposeTimer.current);
      disposeTimer.current = null;
    }
    return () => {
      disposeTimer.current = setTimeout(() => {
        rendererRef.current?.dispose();
        rendererRef.current = null;
        disposeTimer.current = null;
      }, 0);
    };
  }, []);

  useEffect(() => {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) {
      setSupported(false);
      return;
    }
    gpu
      .requestAdapter()
      .then((adapter) => setSupported(adapter !== null))
      .catch(() => setSupported(false));
  }, []);

  if (supported === null) {
    return <div className="panel h-[62vh]" aria-hidden="true" />;
  }

  if (!supported) {
    return (
      <div className="panel panel-body">
        <p className="mb-3 text-sm text-parch-300">
          This browser has no WebGPU, so the 3D table stays off. The board below is the full
          planner - every region choice works here.
        </p>
        <FlatBoard />
      </div>
    );
  }

  return (
    <div>
      <div className="panel h-[62vh] overflow-hidden">
        <Canvas
          dpr={[1, 2]}
          frameloop="demand"
          // Starts wide and high; the rig settles to MAP_FRAME as the intro
          // descent (a hard cut under reduced motion).
          camera={{ position: [0.9, 2.4, 2.1], fov: 42, near: 0.05, far: 20 }}
          onPointerMissed={() => setFocus(null)}
          gl={async (props) => {
            const renderer = new THREE.WebGPURenderer({ ...(props as object), antialias: true });
            await renderer.init();
            rendererRef.current = renderer;
            return renderer;
          }}
        >
          <color attach="background" args={[SURFACE_VOID]} />

          {/* Warm key over a warm board, with a gem rim so raised slab edges
              separate from the void. The cool sage/mint this replaced fought
              the umber palette and flattened every extrusion. */}
          <ambientLight intensity={0.42} color={LIGHT_FILL} />
          <directionalLight position={[1.6, 2.4, 0.9]} intensity={1.7} color={LIGHT_KEY} />
          <directionalLight position={[-1.8, 1.2, -1.6]} intensity={0.45} color={LIGHT_RIM} />

          <MapTable onFocus={setFocus} reducedMotion={reducedMotion} />
          <CameraRig focus={focus} reducedMotion={reducedMotion} />
          <InvalidateOnBuild />
          {/* <Effects /> */}
        </Canvas>
      </div>
      <p className="mt-1.5 text-xs text-parch-500">{MAP_IMAGE.credit}</p>
    </div>
  );
}
