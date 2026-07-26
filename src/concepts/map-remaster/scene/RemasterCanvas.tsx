"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three/webgpu";
import { Canvas, extend, useThree } from "@react-three/fiber";
import "@/map/patchThreeClock";
import { REGION_ANCHORS } from "@/map/data/regionAnchors";
import { PLACES_BY_REGION } from "@/map/data/placeAnchors";
import { RemasterCamera } from "./RemasterCamera";
import { RemasterOcean } from "./RemasterOcean";
import { RemasterTable } from "./RemasterTable";
import { useRemaster } from "./remasterState";

extend(THREE as never);

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
      const r = new THREE.WebGPURenderer({
        ...props,
        antialias: true,
      } as RendererParams);
      await r.init();
      return r;
    } catch (err) {
      if (canvas) RENDERERS.delete(canvas);
      onFail?.();
      throw err;
    }
  })();
  if (canvas) RENDERERS.set(canvas, made);
  return made;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function SceneBody({ reducedMotion }: { reducedMotion: boolean }) {
  const { skin } = useRemaster();
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [skin, invalidate]);
  return (
    <>
      <color attach="background" args={[skin.voidColor]} />
      <ambientLight intensity={skin.ambient.intensity} color={skin.ambient.color} />
      <directionalLight
        position={skin.key.position}
        intensity={skin.key.intensity}
        color={skin.key.color}
      />
      <directionalLight
        position={skin.fill.position}
        intensity={skin.fill.intensity}
        color={skin.fill.color}
      />
      <directionalLight
        position={skin.rim.position}
        intensity={skin.rim.intensity}
        color={skin.rim.color}
      />
      <hemisphereLight
        args={
          skin.id === "daylit"
            ? [0xe8dcc4, 0x3a2e20, 0.38]
            : [0xb8c4c0, 0x2a2318, 0.28]
        }
      />
      <RemasterOcean reducedMotion={reducedMotion} />
      <RemasterTable reducedMotion={reducedMotion} />
      <RemasterCamera reducedMotion={reducedMotion} />
    </>
  );
}

export function RemasterCanvas() {
  const { skin, setRegion } = useRemaster();
  const [supported, setSupported] = useState<boolean | null>(null);
  const failRef = useRef(() => setSupported(false));
  failRef.current = () => setSupported(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) {
      setSupported(false);
      return;
    }
    gpu
      .requestAdapter()
      .then((a) => setSupported(a !== null))
      .catch(() => setSupported(false));
  }, []);

  if (supported === null) {
    return <div className="remaster-canvas remaster-canvas--loading" aria-hidden />;
  }

  if (!supported) {
    return (
      <div className="remaster-canvas remaster-canvas--fallback">
        <p className="text-sm text-parch-300">
          no WebGPU — concept 3D board needs a WebGPU browser. Production /map keeps the flat
          planner path.
        </p>
        <ul className="mt-2 columns-2 gap-2 text-xs text-parch-400">
          {REGION_ANCHORS.map((r) => (
            <li key={r.id}>{r.name}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="remaster-canvas">
      <Canvas
        dpr={[1, 2]}
        frameloop="demand"
        camera={{ position: [0.9, 2.2, 2.0], fov: 38, near: 0.05, far: 20 }}
        onPointerMissed={() => setRegion(null)}
        gl={(props) =>
          rendererFor(props as unknown as Record<string, unknown>, () => failRef.current())
        }
      >
        <SceneBody reducedMotion={reducedMotion} />
      </Canvas>
      <span className="sr-only">
        {skin.title} 3D concept board · {PLACES_BY_REGION.size} region place sets
      </span>
    </div>
  );
}
