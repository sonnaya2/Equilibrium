"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three/webgpu";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { PLACES_BY_REGION } from "@/map/data/placeAnchors";
import { MAP_WORLD } from "@/map/data/regionAnchors";
import { SHAPE_BY_ID } from "@/map/data/regionShapes";
import { GEM_200, GEM_400 } from "@/map/palette";
import { BEVEL } from "@/map/slabHeight";
import { useRemaster } from "./remasterState";

const PICK_R = 0.028;
const OUTER = 0.016;
const INNER = 0.01;

export function RemasterMarkers() {
  const { focus, setPlace, unlocked, skin } = useRemaster();
  const invalidate = useThree((s) => s.invalidate);
  const shape = focus.region ? SHAPE_BY_ID.get(focus.region) : undefined;
  const places = focus.region ? (PLACES_BY_REGION.get(focus.region) ?? []) : [];

  const mats = useMemo(() => {
    const base = new THREE.MeshBasicMaterial({
      color: skin.id === "crystal" ? GEM_200 : GEM_400,
      transparent: true,
      opacity: 0.85,
      toneMapped: false,
      depthWrite: false,
    });
    const lit = new THREE.MeshBasicMaterial({
      color: GEM_200,
      toneMapped: false,
      depthWrite: false,
    });
    const pick = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    return {
      base,
      lit,
      pick,
      dispose: () => [base, lit, pick].forEach((m) => m.dispose()),
    };
  }, [skin.id]);

  const geo = useMemo(() => {
    const disc = new THREE.CircleGeometry(PICK_R, 20);
    const ring = new THREE.RingGeometry(INNER, OUTER, 20);
    const stem =
      skin.id === "raised"
        ? new THREE.CylinderGeometry(0.004, 0.006, 0.045, 8)
        : null;
    return {
      disc,
      ring,
      stem,
      dispose: () => {
        disc.dispose();
        ring.dispose();
        stem?.dispose();
      },
    };
  }, [skin.id]);

  useEffect(() => () => mats.dispose(), [mats]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => {
    invalidate();
  }, [focus, invalidate]);

  if (!shape || !focus.region || places.length === 0) return null;

  const yBase =
    (unlocked.has(focus.region) ? 0.02 : -0.024) +
    skin.focusLift +
    shape.depth +
    BEVEL +
    0.012;

  return (
    <group>
      {places.map((p) => {
        const x = (p.uv[0] - 0.5) * MAP_WORLD.width;
        const z = (p.uv[1] - 0.5) * MAP_WORLD.height;
        const selected = focus.place === p.area;
        const onClick = (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          setPlace(selected ? null : p.area);
        };
        return (
          <group key={p.area} position={[x, yBase, z]}>
            {geo.stem ? (
              <mesh
                geometry={geo.stem}
                position={[0, 0.02, 0]}
                material={selected ? mats.lit : mats.base}
                raycast={() => null}
              />
            ) : null}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              geometry={geo.ring}
              material={selected ? mats.lit : mats.base}
              raycast={() => null}
            />
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              geometry={geo.disc}
              material={mats.pick}
              onClick={onClick}
              onPointerOver={() => {
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto";
              }}
            />
          </group>
        );
      })}
    </group>
  );
}
