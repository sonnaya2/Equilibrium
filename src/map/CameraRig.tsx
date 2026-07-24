"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three/webgpu";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MAP_FRAME, type RegionShape } from "./data/regionShapes";

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
  focus: RegionShape | null;
  reducedMotion: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const desired = useRef({ pos: OVERVIEW_POS.clone(), look: OVERVIEW_TARGET.clone() });
  const moving = useRef(true); // intro settle on mount

  useEffect(() => {
    if (focus) {
      desired.current.pos.set(...focus.camera);
      desired.current.look.set(focus.centroid[0], 0, focus.centroid[1]);
    } else {
      desired.current.pos.copy(OVERVIEW_POS);
      desired.current.look.copy(OVERVIEW_TARGET);
    }
    moving.current = true;
    if (reducedMotion && controlsRef.current) {
      camera.position.copy(desired.current.pos);
      controlsRef.current.target.copy(desired.current.look);
      controlsRef.current.update();
      moving.current = false;
    }
  }, [focus, reducedMotion, camera]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !moving.current) return;
    const k = 1 - Math.exp(-delta * 3.5);
    camera.position.lerp(desired.current.pos, k);
    controls.target.lerp(desired.current.look, k);
    controls.update();
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
      minDistance={0.25}
      maxDistance={2.2}
      maxPolarAngle={Math.PI * 0.49}
      onStart={() => {
        moving.current = false; // user input wins over any transition
      }}
    />
  );
}
