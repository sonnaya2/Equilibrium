"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three/webgpu";
import { color, mx_noise_float, time, uv } from "three/tsl";
import { Canvas, extend } from "@react-three/fiber";
import { Terrain } from "./terrain";
import { CameraRig } from "./CameraRig";
import { Effects } from "./Effects";
import { Labels } from "./Labels";
import { useReducedMotion } from "./useReducedMotion";
import type { RegionShape } from "./data/regionShapes";

extend(THREE as never);

function Sea({ still }: { still: boolean }) {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0.1 });
    const drift = mx_noise_float(uv().mul(6).add(time.mul(still ? 0 : 0.04)));
    m.colorNode = color(0x15303a).add(drift.mul(0.018));
    return m;
  }, [still]);
  return (
    <mesh position={[0, -0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[6, 6]} />
    </mesh>
  );
}

export default function MapScene() {
  // Gate on a real adapter, not just the API — three would otherwise fall back
  // to WebGL2 silently, and the honest-unsupported state is the spec.
  const [supported, setSupported] = useState<boolean | null>(null);
  const [focus, setFocus] = useState<RegionShape | null>(null);
  const reducedMotion = useReducedMotion();

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
      <div className="panel panel-body text-sm text-parch-300">
        This browser has no WebGPU, so the 3D map stays off. The planner below is the full
        planner — every region choice works there.
      </div>
    );
  }

  return (
    <div className="panel h-[62vh] overflow-hidden">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 2.6, 2.6], fov: 42, near: 0.05, far: 20 }}
        gl={async (props) => {
          const renderer = new THREE.WebGPURenderer({ ...(props as object), antialias: true });
          await renderer.init();
          return renderer;
        }}
      >
        <color attach="background" args={["#0e0d0b"]} />
        <fog attach="fog" args={["#0e0d0b", 2.0, 4.0]} />

        <ambientLight intensity={0.55} color="#cfd8c8" />
        <directionalLight position={[1.6, 2.4, 0.9]} intensity={1.55} color="#e4efd6" />
        <directionalLight position={[-1.8, 1.2, -1.6]} intensity={0.55} color="#7fd0a8" />

        <Sea still={reducedMotion} />

        <Terrain onFocus={setFocus} />
        <Labels />
        <CameraRig focus={focus} reducedMotion={reducedMotion} />
        <Effects />
      </Canvas>
    </div>
  );
}
