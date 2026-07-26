"use client";

/**
 * Vines along every border between two land masses — Daylit dual tubes + leaves.
 *
 * Growth encodes the frontier: a border is overgrown while either side is locked
 * and recedes as both unlock. Path growth is UV.x ends→middle (not scale.y).
 * Rides existing demand frames; never invalidates at rest for wind alone (Ocean
 * owns the idle 30Hz loop). Reduced motion snaps growth and freezes wind.
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { useFrame, useThree } from "@react-three/fiber";
import { isRegionUnlocked, type BuildState, type RegionId } from "@/league";
import { useBuild } from "@/league/useBuild";
import { MAP_WORLD } from "./data/regionAnchors";
import { SHAPE_BY_ID } from "./data/regionShapes";
import { SEAMS } from "./data/seams";
import {
  createDaylitLeafMaterial,
  createDaylitSeamMaterials,
  type DaylitLeafMaterial,
  type DaylitSeamMaterials,
} from "./materials/daylitVine";
import { slabTopY } from "./slabHeight";
import { useMapFocus, type MapFocus } from "./useMapFocus";
import { useReducedMotion } from "./useReducedMotion";

const GROWTH_SPEED = 1.55;
/** Match RegionSlab raise/sink spring so vines stay on the cap during focus/unlock. */
const Y_SPEED = 6.5;
const SEAM_CLEARANCE = 0.0035;
const LEAF_LIFT = 0.004;

type LeafRest = {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  scale: number;
  phase: number;
  along: number;
  seamIndex: number;
};

type DaylitSeam = {
  stemGeo: THREE.TubeGeometry;
  tendGeo: THREE.TubeGeometry;
  mats: DaylitSeamMaterials;
  between: readonly [RegionId, RegionId];
};

type BuiltVines = {
  seams: DaylitSeam[];
  leafMesh: THREE.InstancedMesh;
  leafGeo: THREE.PlaneGeometry;
  leafRests: LeafRest[];
  leaf: DaylitLeafMaterial;
  dispose(): void;
};

function buildDaylit(): BuiltVines {
  const seams: DaylitSeam[] = [];
  const leafRests: LeafRest[] = [];
  const leaf = createDaylitLeafMaterial();

  for (let seamIndex = 0; seamIndex < SEAMS.length; seamIndex++) {
    const seam = SEAMS[seamIndex];
    const pts = seam.points.map(
      ([u, v]) =>
        new THREE.Vector3((u - 0.5) * MAP_WORLD.width, 0, (v - 0.5) * MAP_WORLD.height),
    );
    if (pts.length < 2) continue;

    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
    const tubular = Math.max(16, pts.length * 5);
    const stemGeo = new THREE.TubeGeometry(curve, tubular, 0.0075, 9, false);

    const tPts = pts.map((p, i) => {
      const prev = pts[Math.max(0, i - 1)]!;
      const next = pts[Math.min(pts.length - 1, i + 1)]!;
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const wiggle = Math.sin(i * 0.9) * 0.012 + Math.sin(i * 2.1) * 0.006;
      return new THREE.Vector3(p.x + nx * wiggle, 0.002, p.z + nz * wiggle);
    });
    const tCurve = new THREE.CatmullRomCurve3(tPts, false, "catmullrom", 0.45);
    const tendGeo = new THREE.TubeGeometry(tCurve, tubular, 0.0032, 6, false);

    const mats = createDaylitSeamMaterials();
    const builtIndex = seams.length;
    seams.push({ stemGeo, tendGeo, mats, between: seam.between });

    const nLeaves = Math.min(28, Math.max(8, Math.floor(pts.length * 2.2)));
    for (let i = 0; i < nLeaves; i++) {
      const along = (i + 0.35) / nLeaves;
      const p = curve.getPointAt(along);
      const tan = curve.getTangentAt(along).normalize();
      const side = new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(
        (i % 2 === 0 ? 1 : -1) * (0.014 + (i % 5) * 0.002),
      );
      leafRests.push({
        x: p.x + side.x,
        z: p.z + side.z,
        yaw: Math.atan2(tan.x, tan.z) + (i % 2 === 0 ? 0.55 : -0.55),
        pitch: -Math.PI / 2.35,
        roll: (i % 3) * 0.15 - 0.15,
        scale: 0.85 + (i % 4) * 0.1,
        phase: i * 0.73 + seamIndex * 1.7,
        along,
        seamIndex: builtIndex,
      });
    }
  }

  const leafGeo = new THREE.PlaneGeometry(0.02, 0.032);
  const count = Math.max(1, leafRests.length);
  const leafMesh = new THREE.InstancedMesh(leafGeo, leaf.leaf, count);
  leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leafMesh.count = leafRests.length;
  leafMesh.frustumCulled = false;
  leafMesh.raycast = () => null;

  return {
    seams,
    leafMesh,
    leafGeo,
    leafRests,
    leaf,
    dispose() {
      for (const s of seams) {
        s.stemGeo.dispose();
        s.tendGeo.dispose();
        s.mats.dispose();
      }
      leafGeo.dispose();
      leafMesh.dispose();
      leaf.dispose();
    },
  };
}

/** Cap surface of the higher neighbour + a hair so vines sit on top, not in the bevel. */
function seamTopY(
  build: BuildState,
  focus: Pick<MapFocus, "region" | "framed">,
  a: RegionId,
  b: RegionId,
): number {
  const topOf = (id: RegionId) => {
    const depth = SHAPE_BY_ID.get(id)?.depth ?? 0;
    return slabTopY(build, focus, id, depth);
  };
  return Math.max(topOf(a), topOf(b)) + SEAM_CLEARANCE;
}

type SeamTarget = { growth: number; y: number };

export function SeamVines() {
  const { build } = useBuild();
  const { focus } = useMapFocus();
  const reducedMotion = useReducedMotion();
  const invalidate = useThree((s) => s.invalidate);
  const groupRef = useRef<THREE.Group>(null);
  const growth = useRef<number[]>([]);
  const seamY = useRef<number[]>([]);
  const seeded = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const built = useMemo(() => buildDaylit(), []);
  useEffect(() => () => built.dispose(), [built]);

  // Size motion buffers to built seams (skipped degenerate SEAMS shrink the list).
  if (growth.current.length !== built.seams.length) {
    growth.current = built.seams.map(() => 1);
    seamY.current = built.seams.map(() => 0);
  }

  const targets = useMemo((): SeamTarget[] => {
    return built.seams.map((seam) => {
      const [a, b] = seam.between;
      // Either side locked → overgrown frontier.
      const overgrown = !isRegionUnlocked(build, a) || !isRegionUnlocked(build, b);
      return {
        growth: overgrown ? 1 : 0.06,
        y: seamTopY(build, focus, a, b),
      };
    });
  }, [built.seams, build, focus.framed, focus.region]);

  useEffect(() => {
    invalidate();
  }, [targets, invalidate]);

  useFrame((_, delta) => {
    const root = groupRef.current;
    if (!root) return;
    const t = performance.now() * 0.001;
    let busy = false;
    const dt = Math.min(delta, 0.05);

    // Clock only advances when motion is allowed; frozen under reduced motion.
    if (!reducedMotion) {
      const clock = (built.leaf.clock.value as number) + dt;
      built.leaf.clock.value = clock;
    }

    for (let i = 0; i < built.seams.length; i++) {
      const seam = built.seams[i]!;
      const want = targets[i];
      if (!want) continue;

      const curG = growth.current[i] ?? 1;
      const nextG =
        !seeded.current || reducedMotion
          ? want.growth
          : curG + (want.growth - curG) * (1 - Math.exp(-dt * GROWTH_SPEED));
      if (Math.abs(nextG - curG) > 0.0008) busy = true;
      growth.current[i] = nextG;

      const gAmt = growth.current[i]!;
      seam.mats.growth.value = gAmt;
      seam.mats.clock.value = built.leaf.clock.value;

      // Lerp toward slabTopY so vines ride the same spring as RegionSlab.
      const curY = seamY.current[i] ?? want.y;
      let nextY =
        !seeded.current || reducedMotion
          ? want.y
          : curY + (want.y - curY) * (1 - Math.exp(-dt * Y_SPEED));
      if (Math.abs(nextY - want.y) < 0.0005) nextY = want.y;
      else busy = true;
      seamY.current[i] = nextY;

      const seamGroup = root.children[i];
      if (seamGroup) {
        seamGroup.position.y = nextY;
        const stemMesh = seamGroup.children[0];
        const tendMesh = seamGroup.children[1];
        const sway = reducedMotion ? 0 : Math.sin(t * 1.1 + i * 0.4) * 0.0012;
        if (stemMesh) stemMesh.position.set(sway, 0, 0);
        if (tendMesh) {
          const ts = reducedMotion ? 0 : Math.sin(t * 1.4 + i * 0.55) * 0.0018;
          tendMesh.position.set(ts, 0.002, 0);
        }
      }
    }

    for (let i = 0; i < built.leafRests.length; i++) {
      const L = built.leafRests[i]!;
      const gAmt = growth.current[L.seamIndex] ?? 1;
      const fromEnd = Math.min(L.along, 1 - L.along) * 2;
      const visible = Math.max(0, Math.min(1, (gAmt * 1.18 - fromEnd) / 0.14));
      // Same live seam y as the tubes — not a rest-pose constant.
      const yBase = seamY.current[L.seamIndex] ?? targets[L.seamIndex]?.y ?? 0;

      if (visible < 0.04) {
        dummy.scale.setScalar(0.001);
      } else {
        const wind = reducedMotion ? 0 : Math.sin(t * (1.6 + (L.phase % 1)) + L.phase) * 0.18;
        const flutter = reducedMotion ? 0 : Math.sin(t * 2.8 + L.phase * 1.3) * 0.08;
        dummy.position.set(
          L.x + (reducedMotion ? 0 : Math.sin(t * 1.2 + L.phase) * 0.0015),
          yBase + LEAF_LIFT + (reducedMotion ? 0 : Math.sin(t * 1.7 + L.phase) * 0.0012),
          L.z,
        );
        dummy.rotation.set(L.pitch + flutter, L.yaw + wind, L.roll + wind * 0.4);
        dummy.scale.setScalar(L.scale * (0.55 + visible * 0.55));
      }
      dummy.updateMatrix();
      built.leafMesh.setMatrixAt(i, dummy.matrix);
    }
    if (built.leafRests.length > 0) {
      built.leafMesh.instanceMatrix.needsUpdate = true;
    }

    seeded.current = true;
    // Growth / y settle asks for frames; wind rides Ocean's idle loop only.
    if (busy) invalidate();
  });

  return (
    <group ref={groupRef}>
      {built.seams.map((seam, i) => (
        <group key={i}>
          <mesh
            geometry={seam.stemGeo}
            material={seam.mats.stem}
            raycast={() => null}
          />
          <mesh
            geometry={seam.tendGeo}
            material={seam.mats.tendril}
            raycast={() => null}
          />
        </group>
      ))}
      <primitive object={built.leafMesh} />
    </group>
  );
}
