"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import type { RegionId } from "@/league";
import { PLACES_BY_REGION, rasterPlaceUv } from "./data/placeAnchors";
import { MAP_WORLD, REGION_ANCHOR_BY_ID, anchorWorld } from "./data/regionAnchors";

interface Framing {
  target: readonly [number, number];
  zoom: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export function CameraRig({
  focus,
  place,
  reducedMotion,
}: {
  focus: RegionId | null;
  place?: string | null;
  reducedMotion: boolean;
}) {
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera;
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);

  const table = useMemo<Framing>(() => ({
    target: [0, 0],
    zoom: Math.min(
      size.width / (MAP_WORLD.width * 1.025),
      size.height / (MAP_WORLD.height * 1.025),
    ),
  }), [size]);

  const want = useMemo<Framing>(() => {
    const region = focus ? REGION_ANCHOR_BY_ID.get(focus) : undefined;
    if (!region) return table;

    let uv = region.uv;
    if (place) {
      const placeAnchor = PLACES_BY_REGION.get(region.id)?.find((entry) => entry.area === place);
      if (placeAnchor) uv = rasterPlaceUv(placeAnchor);
    }

    const [rawX, rawZ] = anchorWorld(uv);
    const viewWidth = place ? 0.72 : 0.9 + region.size * 0.08;
    const viewHeight = place ? 0.46 : 0.58 + region.size * 0.08;
    const zoom = Math.min(size.width / viewWidth, size.height / viewHeight);
    const halfWidth = size.width / (zoom * 2);
    const halfHeight = size.height / (zoom * 2);
    const limitX = Math.max(0, MAP_WORLD.width * 0.5 - halfWidth);
    const limitZ = Math.max(0, MAP_WORLD.height * 0.5 - halfHeight);

    return {
      target: [
        Math.max(-limitX, Math.min(limitX, rawX)),
        Math.max(-limitZ, Math.min(limitZ, rawZ)),
      ],
      zoom,
    };
  }, [focus, place, size, table]);

  const current = useRef({
    target: new THREE.Vector2(...table.target),
    zoom: table.zoom,
  });
  const target = useMemo(() => new THREE.Vector2(), []);
  const moving = useRef(true);

  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [invalidate, want]);

  useFrame((_, delta) => {
    const state = current.current;
    target.set(...want.target);

    if (reducedMotion) {
      state.target.copy(target);
      state.zoom = want.zoom;
      moving.current = false;
    } else if (moving.current) {
      const k = 1 - Math.exp(-delta * 7);
      state.target.lerp(target, k);
      state.zoom = lerp(state.zoom, want.zoom, k);
      moving.current =
        state.target.distanceTo(target) > 0.001 ||
        Math.abs(state.zoom - want.zoom) > 0.25;
    }

    camera.position.set(state.target.x, 4, state.target.y);
    camera.up.set(0, 0, -1);
    camera.lookAt(state.target.x, 0, state.target.y);
    camera.zoom = state.zoom;
    camera.updateProjectionMatrix();
    if (moving.current) invalidate();
  });

  return null;
}
