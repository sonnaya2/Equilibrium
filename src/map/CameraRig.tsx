"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three/webgpu";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { anchorWorld, MAP_FRAME, type RegionAnchor } from "./data/regionAnchors";

const OVERVIEW_POS = new THREE.Vector3(...MAP_FRAME.position);
const OVERVIEW_TARGET = new THREE.Vector3(...MAP_FRAME.target);

/**
 * Orbit controls + cinematic focus moves. Transitions are damped lerps that
 * stop the moment the user grabs the scene; reduced motion snaps instead.
 */
export function CameraRig({
  focus,
  reducedMotion,
}: {
  focus: RegionAnchor | null;
  reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const desired = useRef({ pos: OVERVIEW_POS.clone(), look: OVERVIEW_TARGET.clone() });
  const moving = useRef(true); // intro settle on mount

  useEffect(() => {
    if (focus) {
      const [x, z] = anchorWorld(focus.uv);
      desired.current.pos.set(x, 0.48, z + 0.42);
      desired.current.look.set(x, 0, z);
    } else {
      desired.current.pos.copy(OVERVIEW_POS);
      desired.current.look.copy(OVERVIEW_TARGET);
    }
    moving.current = true;
    invalidate();
    if (reducedMotion && controlsRef.current) {
      camera.position.copy(desired.current.pos);
      controlsRef.current.target.copy(desired.current.look);
      controlsRef.current.update();
      moving.current = false;
    }
  }, [focus, reducedMotion, camera, invalidate]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !moving.current) return;
    const k = 1 - Math.exp(-delta * 3.5);
    camera.position.lerp(desired.current.pos, k);
    controls.target.lerp(desired.current.look, k);
    controls.update();
    invalidate(); // keep the demand frameloop alive until the move settles
    if (
      camera.position.distanceTo(desired.current.pos) < 0.005 &&
      controls.target.distanceTo(desired.current.look) < 0.005
    ) {
      moving.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.2}
      maxDistance={2.2}
      maxPolarAngle={Math.PI * 0.49}
      onStart={() => {
        moving.current = false; // user input wins over any transition
      }}
    />
  );
}
