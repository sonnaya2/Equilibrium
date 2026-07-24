/**
 * Region landmasses: extruded slabs from our authored polygons (regionShapes.ts).
 * Cap faces get the biome colour, walls get dark earth — the coastline reads
 * without any texture. Displacement is deterministic value noise, baked once.
 */
import { useMemo, useState } from "react";
import * as THREE from "three/webgpu";
import type { ThreeEvent } from "@react-three/fiber";
import {
  canSelectElective,
  ELECTIVE_REGIONS,
  isRegionUnlocked,
  type RegionId,
} from "@/league";
import { useBuild } from "@/league/useBuild";
import { REGION_SHAPES, type Biome, type RegionShape } from "./data/regionShapes";

const DEPTH = 0.022;

const BIOME_COLORS: Record<Biome, number> = {
  lowland: 0x5d8554,
  port: 0x739467,
  jungle: 0x3f7c44,
  mountain: 0x848a76,
  coast: 0x698c72,
  snow: 0xafc0b0,
  wastes: 0x625c48,
  dunes: 0xa8a06b,
  swamp: 0x514e66,
  canopy: 0x397052,
  prehistoric: 0x637a46,
};

const LOCKED_TINT = new THREE.Color(0x3a3d33);
const WALL_COLOR = 0x2a241c;
const BORDER_COLOR = 0x101b14;
const SHOAL_COLOR = 0x0b1811;
const GEM_LIT = new THREE.Color(0x2ecb8f);
const GEM_DIM = new THREE.Color(0x33453b);

/** Mainland regions knit into one continent; islands stay separated by sea. */
const ISLANDS: ReadonlySet<RegionId> = new Set(["karamja", "anachronia", "havenhythe"]);
const MAINLAND_KNIT = 1.1;

function hash(n: number): number {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
}

function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi * 157.1 + yi * 311.7);
  const b = hash((xi + 1) * 157.1 + yi * 311.7);
  const c = hash(xi * 157.1 + (yi + 1) * 311.7);
  const d = hash((xi + 1) * 157.1 + (yi + 1) * 311.7);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function shapeFrom(shape: RegionShape, scale = 1): THREE.Shape {
  const [cx, cz] = shape.centroid;
  // Midpoint-jittered edges turn the coarse polygon into an organic coastline.
  const seedBase = hash(shape.id.length * 7.13 + cx * 13.1) * 100;
  const pts: [number, number][] = [];
  shape.polygon.forEach((p, i) => {
    const q = shape.polygon[(i + 1) % shape.polygon.length];
    pts.push(p);
    const ex = q[0] - p[0];
    const ez = q[1] - p[1];
    const len = Math.hypot(ex, ez);
    if (len < 1e-6) return;
    const j = (hash(seedBase + i * 3.7) - 0.5) * len * 0.36;
    pts.push([(p[0] + q[0]) / 2 + (-ez / len) * j, (p[1] + q[1]) / 2 + (ex / len) * j]);
  });
  const s = new THREE.Shape();
  pts.forEach(([x, z], i) => {
    const px = cx + (x - cx) * scale;
    const py = -(cz + (z - cz) * scale); // shape-space y is world -z
    if (i === 0) s.moveTo(px, py);
    else s.lineTo(px, py);
  });
  return s;
}

function buildLandmass(shape: RegionShape, scale = 1): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shapeFrom(shape, scale), { depth: DEPTH, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2); // extrusion becomes +y, shape plane lies on the sea
  const seed = hash(shape.id.length * 17.3 + shape.centroid[0] * 91.7) * 100;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < DEPTH * 0.5) continue; // walls and underside stay flat
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.min(1, Math.hypot(x - shape.centroid[0], z - shape.centroid[1]) / shape.radius);
    const relief =
      noise2(x * 16 + seed, z * 16 + seed) * 0.7 + noise2(x * 36 + seed * 2, z * 36 + seed * 2) * 0.3;
    pos.setY(i, DEPTH + shape.height * 0.1 * (0.25 + relief * shape.relief) * Math.max(0, 1 - d * d));
  }
  geo.computeVertexNormals();
  return geo;
}

function RegionLandmass({
  shape,
  onFocus,
}: {
  shape: RegionShape;
  onFocus: (shape: RegionShape) => void;
}) {
  const { build, toggleRegion } = useBuild();
  const [hovered, setHovered] = useState(false);

  const unlocked = isRegionUnlocked(build, shape.id);
  const elective = (ELECTIVE_REGIONS as readonly RegionId[]).includes(shape.id);
  const selectable = elective && canSelectElective(build, shape.id);

  const { land, shoal, border } = useMemo(() => {
    const knit = ISLANDS.has(shape.id) ? 1 : MAINLAND_KNIT;
    const land = buildLandmass(shape, knit);
    const shoal = new THREE.ShapeGeometry(shapeFrom(shape, 1.07 * knit));
    shoal.rotateX(-Math.PI / 2);
    // WebGPURenderer has no LineLoop — close the ring by repeating the first point.
    const ring = [...shape.polygon, shape.polygon[0]].map(
      ([x, z]) => new THREE.Vector3(x, DEPTH + 0.002, z),
    );
    const border = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ring),
      new THREE.LineBasicMaterial({ color: BORDER_COLOR }),
    );
    return { land, shoal, border };
  }, [shape]);

  const landColor = useMemo(() => {
    const base = new THREE.Color(BIOME_COLORS[shape.biome]);
    if (unlocked) return base;
    return base.lerp(LOCKED_TINT, 0.38);
  }, [shape.biome, unlocked]);

  const materials = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: landColor, flatShading: true, roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: WALL_COLOR, flatShading: true, roughness: 1 }),
    ],
    [landColor],
  );

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onFocus(shape);
    if (elective) toggleRegion(shape.id);
  };

  return (
    <group>
      <mesh geometry={shoal} position={[0, 0.0015, 0]}>
        <meshBasicMaterial color={SHOAL_COLOR} />
      </mesh>
      <mesh
        geometry={land}
        material={materials}
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = selectable || !elective ? "pointer" : "not-allowed";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      />
      <primitive object={border} />
      {/* Gem marker at the visual centre: the emerald emissive feeds the bloom pass. */}
      <mesh position={[shape.centroid[0], DEPTH + 0.03, shape.centroid[1]]} onClick={click}>
        <cylinderGeometry args={[shape.radius * 0.16, shape.radius * 0.16, 0.02, 6]} />
        <meshStandardMaterial
          color={unlocked ? GEM_LIT : GEM_DIM}
          emissive={unlocked ? GEM_LIT : GEM_DIM}
          emissiveIntensity={unlocked ? (hovered ? 3.2 : 2.2) : 0.15}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

export function Terrain({ onFocus }: { onFocus: (shape: RegionShape) => void }) {
  return (
    <group>
      {REGION_SHAPES.map((shape) => (
        <RegionLandmass key={shape.id} shape={shape} onFocus={onFocus} />
      ))}
    </group>
  );
}
