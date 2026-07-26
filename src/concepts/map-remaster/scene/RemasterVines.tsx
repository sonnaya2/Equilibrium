"use client";

/**
 * Seam vines for remaster boards.
 * Daylit: dual tubes + dense leaves, path growth (not scale.y), wind flutter.
 * Other skins: simpler tube + leaf cards.
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { useFrame, useThree } from "@react-three/fiber";
import type { RegionId } from "@/league";
import { MAP_WORLD } from "@/map/data/regionAnchors";
import { SEAMS } from "@/map/data/seams";
import { SHAPE_BY_ID } from "@/map/data/regionShapes";
import { BEVEL } from "@/map/slabHeight";
import {
  createDaylitVineMaterials,
  type DaylitVineMaterials,
} from "./materials/daylitVine";
import { createRemasterVineMaterials } from "./materials/remasterVine";
import { useRemaster } from "./remasterState";

const GROWTH_SPEED = 1.55;

function seamY(unlocked: ReadonlySet<RegionId>, a: RegionId, b: RegionId): number {
  const da = SHAPE_BY_ID.get(a)?.depth ?? 0.07;
  const db = SHAPE_BY_ID.get(b)?.depth ?? 0.07;
  const ya = (unlocked.has(a) ? 0.02 : -0.02) + da + BEVEL;
  const yb = (unlocked.has(b) ? 0.02 : -0.02) + db + BEVEL;
  return (ya + yb) * 0.5 + 0.004;
}

type LeafRest = {
  x: number;
  y: number;
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
  mats: DaylitVineMaterials;
  between: readonly [RegionId, RegionId];
};

function buildDaylit() {
  const seams: DaylitSeam[] = [];
  const leafRests: LeafRest[] = [];
  // Shared leaf material + clock (one dispose)
  const shared = createDaylitVineMaterials();

  SEAMS.forEach((seam, seamIndex) => {
    const pts = seam.points.map(
      ([u, v]) =>
        new THREE.Vector3((u - 0.5) * MAP_WORLD.width, 0, (v - 0.5) * MAP_WORLD.height),
    );
    if (pts.length < 2) return;

    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.4);
    const tubular = Math.max(16, pts.length * 5);
    const stemGeo = new THREE.TubeGeometry(curve, tubular, 0.0075, 9, false);

    const tPts = pts.map((p, i) => {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
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

    // Per-seam growth uniform (stem + tendril share this mat set)
    const mats = createDaylitVineMaterials();
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
        y: 0.004,
        z: p.z + side.z,
        yaw: Math.atan2(tan.x, tan.z) + (i % 2 === 0 ? 0.55 : -0.55),
        pitch: -Math.PI / 2.35,
        roll: (i % 3) * 0.15 - 0.15,
        scale: 0.85 + (i % 4) * 0.1,
        phase: i * 0.73 + seamIndex * 1.7,
        along,
        seamIndex: seams.length - 1,
      });
    }
  });

  const leafGeo = new THREE.PlaneGeometry(0.02, 0.032);
  const leafMesh = new THREE.InstancedMesh(
    leafGeo,
    shared.leaf,
    Math.max(1, leafRests.length),
  );
  leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leafMesh.raycast = () => null;

  return {
    kind: "daylit" as const,
    seams,
    leafMesh,
    leafGeo,
    leafRests,
    shared,
    dispose() {
      for (const s of seams) {
        s.stemGeo.dispose();
        s.tendGeo.dispose();
        s.mats.dispose();
      }
      leafGeo.dispose();
      shared.dispose();
    },
  };
}

function buildSimple(skin: ReturnType<typeof useRemaster>["skin"]) {
  const mats = createRemasterVineMaterials(skin);
  const tubes: { geometry: THREE.TubeGeometry; between: readonly [RegionId, RegionId] }[] = [];
  const leafPositions: number[] = [];
  const leafRot: number[] = [];

  for (const seam of SEAMS) {
    const pts = seam.points.map(
      ([u, v]) =>
        new THREE.Vector3((u - 0.5) * MAP_WORLD.width, 0, (v - 0.5) * MAP_WORLD.height),
    );
    if (pts.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.35);
    tubes.push({
      geometry: new THREE.TubeGeometry(
        curve,
        Math.max(12, pts.length * 4),
        skin.vine.tubeRadius,
        6,
        false,
      ),
      between: seam.between,
    });
    const nLeaves = Math.min(18, Math.max(4, Math.floor(pts.length * 1.2)));
    for (let i = 0; i < nLeaves; i++) {
      const t = (i + 0.5) / nLeaves;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const side = new THREE.Vector3(-tan.z, 0, tan.x).multiplyScalar(
        (i % 2 === 0 ? 1 : -1) * skin.vine.halfWidth * 0.85,
      );
      leafPositions.push(p.x + side.x, p.y, p.z + side.z);
      leafRot.push(Math.atan2(tan.x, tan.z) + (i % 2 === 0 ? 0.6 : -0.6));
    }
  }

  const leafW = skin.id === "raised" ? 0.026 : skin.id === "crystal" ? 0.014 : 0.018;
  const leafH = skin.id === "raised" ? 0.034 : skin.id === "crystal" ? 0.036 : 0.028;
  const leafGeo = new THREE.PlaneGeometry(leafW, leafH);
  const leafMesh = new THREE.InstancedMesh(
    leafGeo,
    mats.leaf,
    Math.max(1, leafPositions.length / 3),
  );
  leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < leafPositions.length / 3; i++) {
    dummy.position.set(leafPositions[i * 3], leafPositions[i * 3 + 1], leafPositions[i * 3 + 2]);
    dummy.rotation.set(-Math.PI / 2.4, leafRot[i], 0.2);
    dummy.scale.setScalar(0.9 + (i % 3) * 0.12);
    dummy.updateMatrix();
    leafMesh.setMatrixAt(i, dummy.matrix);
  }
  leafMesh.instanceMatrix.needsUpdate = true;
  leafMesh.raycast = () => null;

  return {
    kind: "simple" as const,
    tubes,
    leafMesh,
    leafGeo,
    stemMat: mats.stem,
    growthU: mats.growth,
    dispose() {
      tubes.forEach((t) => t.geometry.dispose());
      leafGeo.dispose();
      mats.dispose();
    },
  };
}

export function RemasterVines({ reducedMotion }: { reducedMotion: boolean }) {
  const { skin, unlocked, focus } = useRemaster();
  const invalidate = useThree((s) => s.invalidate);
  const groupRef = useRef<THREE.Group>(null);
  const growth = useRef<number[]>(SEAMS.map(() => 1));
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const built = useMemo(
    () => (skin.id === "daylit" ? buildDaylit() : buildSimple(skin)),
    [skin],
  );

  useEffect(() => () => built.dispose(), [built]);

  useFrame((_, delta) => {
    let busy = false;
    const g = groupRef.current;
    if (!g) return;
    const t = performance.now() * 0.001;

    if (built.kind === "daylit") {
      built.shared.clock.value = (built.shared.clock.value as number) + delta;

      built.seams.forEach((seam, i) => {
        const [a, b] = seam.between;
        const want = unlocked.has(a) && unlocked.has(b) ? 0.06 : 1;
        const cur = growth.current[i] ?? 1;
        const next = reducedMotion
          ? want
          : cur + (want - cur) * (1 - Math.exp(-delta * GROWTH_SPEED));
        if (Math.abs(next - cur) > 0.0008) {
          growth.current[i] = next;
          busy = true;
        }
        const gAmt = growth.current[i] ?? 1;
        seam.mats.growth.value = gAmt;
        const y = seamY(unlocked, a, b);
        const focusBoost =
          focus.region && (focus.region === a || focus.region === b) ? skin.focusLift * 0.4 : 0;
        const sway = reducedMotion ? 0 : Math.sin(t * 1.1 + i * 0.4) * 0.0012;
        // Children: [seamGroup0, seamGroup1, …, leafMesh]
        const seamGroup = g.children[i] as THREE.Group | undefined;
        if (seamGroup) {
          const stemMesh = seamGroup.children[0] as THREE.Mesh | undefined;
          const tendMesh = seamGroup.children[1] as THREE.Mesh | undefined;
          if (stemMesh) stemMesh.position.set(sway, y + focusBoost, 0);
          if (tendMesh) {
            const ts = reducedMotion ? 0 : Math.sin(t * 1.4 + i * 0.55) * 0.0018;
            tendMesh.position.set(ts, y + focusBoost + 0.002, 0);
          }
        }
      });

      for (let i = 0; i < built.leafRests.length; i++) {
        const L = built.leafRests[i];
        const gAmt = growth.current[L.seamIndex] ?? 1;
        const fromEnd = Math.min(L.along, 1 - L.along) * 2;
        const visible = Math.max(0, Math.min(1, (gAmt * 1.18 - fromEnd) / 0.14));
        if (visible < 0.04) {
          dummy.scale.setScalar(0.001);
        } else {
          const wind = reducedMotion ? 0 : Math.sin(t * (1.6 + (L.phase % 1)) + L.phase) * 0.18;
          const flutter = reducedMotion ? 0 : Math.sin(t * 2.8 + L.phase * 1.3) * 0.08;
          dummy.position.set(
            L.x + (reducedMotion ? 0 : Math.sin(t * 1.2 + L.phase) * 0.0015),
            L.y + (reducedMotion ? 0 : Math.sin(t * 1.7 + L.phase) * 0.0012),
            L.z,
          );
          dummy.rotation.set(L.pitch + flutter, L.yaw + wind, L.roll + wind * 0.4);
          dummy.scale.setScalar(L.scale * (0.55 + visible * 0.55));
        }
        dummy.updateMatrix();
        built.leafMesh.setMatrixAt(i, dummy.matrix);
      }
      built.leafMesh.instanceMatrix.needsUpdate = true;
      if (!reducedMotion) busy = true;
    } else {
      let growthSum = 0;
      built.tubes.forEach((tube, i) => {
        const [a, b] = tube.between;
        const want = unlocked.has(a) && unlocked.has(b) ? 0.08 : 1;
        const cur = growth.current[i] ?? 1;
        const next = reducedMotion
          ? want
          : cur + (want - cur) * (1 - Math.exp(-delta * 1.4));
        if (Math.abs(next - cur) > 0.001) {
          growth.current[i] = next;
          busy = true;
        }
        growthSum += growth.current[i] ?? 1;
        const child = g.children[i] as THREE.Mesh | undefined;
        if (child) {
          const y = seamY(unlocked, a, b);
          const focusBoost =
            focus.region && (focus.region === a || focus.region === b) ? skin.focusLift * 0.35 : 0;
          child.position.y = y + focusBoost;
          child.scale.set(1, Math.max(0.05, growth.current[i] ?? 1), 1);
          child.visible = (growth.current[i] ?? 1) > 0.04;
        }
      });
      built.growthU.value = growthSum / (built.tubes.length || 1);
      if (built.leafMesh) {
        built.leafMesh.position.y = 0.002 + Math.sin(t) * (reducedMotion ? 0 : 0.0015);
      }
    }

    if (busy) invalidate();
  });

  useEffect(() => {
    invalidate();
  }, [focus, unlocked, invalidate]);

  if (built.kind === "daylit") {
    return (
      <group ref={groupRef}>
        {built.seams.map((s, i) => (
          <group key={i}>
            <mesh geometry={s.stemGeo} material={s.mats.stem} raycast={() => null} />
            <mesh geometry={s.tendGeo} material={s.mats.tendril} raycast={() => null} />
          </group>
        ))}
        <primitive object={built.leafMesh} />
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      {built.tubes.map((tube, i) => (
        <mesh
          key={i}
          geometry={tube.geometry}
          material={built.stemMat}
          raycast={() => null}
        />
      ))}
      <primitive object={built.leafMesh} />
    </group>
  );
}
