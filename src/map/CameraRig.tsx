"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three/webgpu";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { anchorWorld, MAP_FRAME, type RegionAnchor } from "./data/regionAnchors";

const OVERVIEW_BASE = new THREE.Vector3(...MAP_FRAME.position);
const OVERVIEW_TARGET = new THREE.Vector3(...MAP_FRAME.target);
const OVERVIEW_LEN = OVERVIEW_BASE.length();

/**
 * Orbit controls + cinematic focus moves. Transitions are damped lerps that
 * stop the moment the user grabs the scene; reduced motion snaps instead.
 * The overview distance grows on narrow viewports so the whole map fits
 * horizontally instead of cropping the east and west edges.
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
  const aspect = useThree((s) => s.size.width / s.size.height);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Fit the 2-unit-wide map: distance * tan(vfov/2) * aspect must cover it
  // (fov 42° → tan ≈ 0.384), with margin.
  const overview = useMemo(() => {
    const dist = Math.max(OVERVIEW_LEN, 2.9 / aspect);
    return OVERVIEW_BASE.clone().multiplyScalar(dist / OVERVIEW_LEN);
  }, [aspect]);
  const maxDistance = Math.max(2.2, overview.length() + 0.6);

  const desired = useRef({ pos: overview.clone(), look: OVERVIEW_TARGET.clone() });
  const moving = useRef(true); // intro settle on mount

  useEffect(() => {
    if (focus) {
      const [x, z] = anchorWorld(focus.uv);
      desired.current.pos.set(x, 0.48, z + 0.42);
      desired.current.look.set(x, 0, z);
    } else {
      desired.current.pos.copy(overview);
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
  }, [focus, reducedMotion, camera, invalidate, overview]);

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
      maxDistance={maxDistance}
      maxPolarAngle={Math.PI * 0.49}
      onStart={() => {
        moving.current = false; // user input wins over any transition
      }}
    />
  );
}
