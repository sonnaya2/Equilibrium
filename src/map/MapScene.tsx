"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import { Canvas, extend } from "@react-three/fiber";
import { MapTable } from "./MapTable";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { FlatBoard } from "./FlatBoard";
import { useReducedMotion } from "./useReducedMotion";
import { MAP_IMAGE, type RegionAnchor } from "./data/regionAnchors";

extend(THREE as never);

export default function MapScene() {
  // Gate on a real adapter, not just the API — three would otherwise fall back
  // to WebGL2 silently, and the honest-unsupported state is the spec.
  const [supported, setSupported] = useState<boolean | null>(null);
  const [focus, setFocus] = useState<RegionAnchor | null>(null);
  const reducedMotion = useReducedMotion();
  // R3F never calls dispose() on a custom gl (its forceContextLoss is a WebGL
  // concept WebGPURenderer lacks), so every Canvas mount would leak a whole
  // renderer. Dispose it ourselves on unmount.
  const rendererRef = useRef<THREE.WebGPURenderer | null>(null);
  useEffect(
    () => () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    },
    [],
  );

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
          <color attach="background" args={["#0e0d0b"]} />

          <ambientLight intensity={0.55} color="#cfd8c8" />
          <directionalLight position={[1.6, 2.4, 0.9]} intensity={1.55} color="#e4efd6" />
          <directionalLight position={[-1.8, 1.2, -1.6]} intensity={0.55} color="#7fd0a8" />

          <MapTable onFocus={setFocus} />
          <CameraRig focus={focus} reducedMotion={reducedMotion} />
          {/* <Effects /> */}
        </Canvas>
      </div>
      <p className="mt-1.5 text-xs text-parch-500">{MAP_IMAGE.credit}</p>
    </div>
  );
}
