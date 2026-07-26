"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { useFrame, useThree } from "@react-three/fiber";
import { MAP_WORLD } from "@/map/data/regionAnchors";
import { PLACES_BY_REGION } from "@/map/data/placeAnchors";
import { SHAPE_BY_ID, TABLE_FRAMING, type Framing } from "@/map/data/regionShapes";
import { useRemaster } from "./remasterState";

const FIT_HALF_WIDTH = 0.89;
const FIT_HALF_DEPTH = MAP_WORLD.height * 0.5;
const FIT_MARGIN = 1.02;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
function lerpAngle(a: number, b: number, k: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
function orbit(out: THREE.Vector3, target: THREE.Vector3, az: number, el: number, r: number) {
  const flat = Math.cos(el) * r;
  out.set(target.x + Math.sin(az) * flat, target.y + Math.sin(el) * r, target.z + Math.cos(az) * flat);
}

export function RemasterCamera({ reducedMotion }: { reducedMotion: boolean }) {
  const { focus, skin } = useRemaster();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));

  const table = useMemo<Framing>(() => {
    const halfFov = (TABLE_FRAMING.fov * Math.PI) / 360;
    const forWidth = FIT_HALF_WIDTH / (Math.tan(halfFov) * aspect);
    const forDepth =
      (FIT_HALF_DEPTH * Math.sin(TABLE_FRAMING.elevation)) / Math.tan(halfFov);
    // Raised skin pulls in slightly so plinth drama fills the frame.
    const pull = skin.id === "raised" ? 0.96 : skin.id === "cartographer" ? 0.98 : 1;
    return {
      ...TABLE_FRAMING,
      radius: Math.max(TABLE_FRAMING.radius, forWidth, forDepth) * FIT_MARGIN * pull,
    };
  }, [aspect, skin.id]);

  const want = useMemo<Framing>(() => {
    const shape = focus.region ? SHAPE_BY_ID.get(focus.region) : undefined;
    let framing: Framing = shape?.framing ?? table;
    if (focus.region && focus.place) {
      const anchor = PLACES_BY_REGION.get(focus.region)?.find((p) => p.area === focus.place);
      if (anchor) {
        framing = {
          ...framing,
          radius: framing.radius * 0.62,
          target: [
            (anchor.uv[0] - 0.5) * MAP_WORLD.width,
            framing.target[1],
            (anchor.uv[1] - 0.5) * MAP_WORLD.height,
          ],
        };
      }
    }
    // Blend region framing radius with table floor so edge regions don't zoom out past fit.
    if (shape) {
      framing = {
        ...framing,
        radius: Math.min(framing.radius, table.radius * 1.05),
      };
    }
    return framing;
  }, [focus, table]);

  const cur = useRef({ ...table });
  const pos = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());

  useEffect(() => {
    invalidate();
  }, [want, invalidate]);

  useFrame((_, delta) => {
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 5.5);
    const c = cur.current;
    c.azimuth = lerpAngle(c.azimuth, want.azimuth, k);
    c.elevation = lerp(c.elevation, want.elevation, k);
    c.radius = lerp(c.radius, want.radius, k);
    c.fov = lerp(c.fov, want.fov, k);
    c.target = [
      lerp(c.target[0], want.target[0], k),
      lerp(c.target[1], want.target[1], k),
      lerp(c.target[2], want.target[2], k),
    ];
    target.current.set(c.target[0], c.target[1], c.target[2]);
    orbit(pos.current, target.current, c.azimuth, c.elevation, c.radius);
    camera.position.copy(pos.current);
    camera.fov = c.fov;
    camera.lookAt(target.current);
    camera.updateProjectionMatrix();

    const settled =
      Math.abs(c.radius - want.radius) < 0.001 &&
      Math.abs(c.azimuth - want.azimuth) < 0.001 &&
      Math.abs(c.elevation - want.elevation) < 0.001;
    if (!settled) invalidate();
  });

  return null;
}
