/**
 * The flat league map on a table: the official region map texture as an
 * unlit plane, with a floating hex gem per region carrying unlock state.
 * Gems are the state language — emerald and lit when unlocked, dim when
 * locked; the emissive channel feeds the selective bloom pass.
 * Names are baked into the map art, so DOM overlays appear only on hover.
 */
"use client";

import { useMemo, useState } from "react";
import * as THREE from "three/webgpu";
import { Html } from "@react-three/drei";
import { useLoader, type ThreeEvent } from "@react-three/fiber";
import {
  canSelectElective,
  ELECTIVE_REGIONS,
  isRegionUnlocked,
  MILESTONE_REGION,
  type RegionId,
} from "@/league";
import { useBuild } from "@/league/useBuild";
import {
  anchorWorld,
  MAP_IMAGE,
  MAP_WORLD,
  REGION_ANCHORS,
  type RegionAnchor,
} from "./data/regionAnchors";

const GEM_LIT = new THREE.Color(0x2ecb8f);
const GEM_DIM = new THREE.Color(0x33453b);
const RING_COLOR = 0x2ecb8f;
const SLAB_COLOR = 0x17140f;

function MapPlane() {
  const texture = useLoader(THREE.TextureLoader, MAP_IMAGE.src);
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
  }, [texture]);

  return (
    <group>
      {/* Backing slab — the table edge around the map. */}
      <mesh position={[0, -0.011, 0]}>
        <boxGeometry args={[MAP_WORLD.width + 0.09, 0.02, MAP_WORLD.height + 0.09]} />
        <meshStandardMaterial color={SLAB_COLOR} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[MAP_WORLD.width, MAP_WORLD.height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function statusLabel(
  anchor: RegionAnchor,
  elective: boolean,
  unlocked: boolean,
  selectable: boolean,
): string {
  if (!elective) return anchor.id === MILESTONE_REGION ? "First milestone" : "Fixed start";
  if (unlocked) return "Selected · click to remove";
  return selectable ? "Click to unlock" : "Locked";
}

function RegionMarker({
  anchor,
  onFocus,
}: {
  anchor: RegionAnchor;
  onFocus: (anchor: RegionAnchor) => void;
}) {
  const { build, toggleRegion } = useBuild();
  const [hovered, setHovered] = useState(false);

  const unlocked = isRegionUnlocked(build, anchor.id);
  const elective = (ELECTIVE_REGIONS as readonly RegionId[]).includes(anchor.id);
  const selectable = elective && canSelectElective(build, anchor.id);

  const [x, z] = anchorWorld(anchor.uv);
  const r = 0.028 * anchor.size;
  const gemY = hovered ? 0.062 : 0.048;

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onFocus(anchor);
    if (elective) toggleRegion(anchor.id);
  };
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = selectable || !elective ? "pointer" : "not-allowed";
  };
  const out = () => {
    setHovered(false);
    document.body.style.cursor = "auto";
  };

  return (
    <group position={[x, 0, z]}>
      {/* Invisible hit disc on the map surface, wider than the gem. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.003, 0]}
        onClick={click}
        onPointerOver={over}
        onPointerOut={out}
      >
        <circleGeometry args={[r * 2.2, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hovered && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <ringGeometry args={[r * 1.6, r * 1.9, 32]} />
          <meshBasicMaterial color={RING_COLOR} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh position={[0, gemY, 0]} onClick={click} onPointerOver={over} onPointerOut={out}>
        <cylinderGeometry args={[r, r, 0.018, 6]} />
        <meshStandardMaterial
          color={unlocked ? GEM_LIT : GEM_DIM}
          emissive={unlocked ? GEM_LIT : GEM_DIM}
          emissiveIntensity={unlocked ? (hovered ? 3.2 : 2.2) : 0.12}
          roughness={0.3}
        />
      </mesh>
      {hovered && (
        <Html
          position={[0, gemY + 0.055, 0]}
          center
          distanceFactor={1}
          zIndexRange={[20, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="map-chip">
            <span className="map-chip-name">{anchor.name}</span>
            <span className="map-chip-state">{statusLabel(anchor, elective, unlocked, selectable)}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

export function MapTable({ onFocus }: { onFocus: (anchor: RegionAnchor) => void }) {
  return (
    <group>
      <MapPlane />
      {REGION_ANCHORS.map((anchor) => (
        <RegionMarker key={anchor.id} anchor={anchor} onFocus={onFocus} />
      ))}
    </group>
  );
}
