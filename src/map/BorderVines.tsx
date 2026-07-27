"use client";

/**
 * Ancient growth along the borders you have not opened.
 *
 * The path is the seam itself — the same polyline both neighbouring plates were
 * cut along — so a vine sits exactly on the line it is sealing rather than near
 * it, and it follows every kink the real border has. A region is never scribbled
 * over; only its frontier is.
 *
 * A border is overgrown while either side is still locked and withdraws as both
 * open, in about a second. Because that is a clip along the path rather than a
 * mount, the whole state is one animating number per seam.
 *
 * Wind rides frames the board is already drawing. This never asks for a frame of
 * its own — MotionDriver owns the only heartbeat, and when the sea freezes so
 * does the foliage.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { isRegionUnlocked, type RegionId } from "@/league";
import { useBuild } from "@/league/useBuild";
import type { SeamPath } from "./data/plates";
import { createLeafMaterial, createVineMaterials } from "./materials/VineMaterial";
import { plateTopY } from "./plateHeight";
import { useMapFocus } from "./useMapFocus";

/** Seconds-ish rate of the growth clip. */
const GROWTH_SPEED = 1.5;
/** Match RegionPlate's raise spring so vines stay on the cap while it moves. */
const Y_SPEED = 6.5;
const CLEARANCE = 0.0022;

// Thin on purpose. The stem is structure; the leaves are the thing you see.
const STEM_RADIUS = 0.0013;
const TENDRIL_RADIUS = 0.0006;
/** Control points per seam. More than this and the curve is finer than the eye. */
const MAX_NODES = 90;
/** One leaf per this much border, so a long frontier is no sparser than a short one. */
const LEAF_SPACING = 0.0075;
const MAX_LEAVES_PER_SEAM = 110;

/** Deterministic 0..1 from an integer — same hedge every reload, and diffable. */
function hash(n: number): number {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

interface BuiltSeam {
  stem: THREE.TubeGeometry;
  tendril: THREE.TubeGeometry;
  mats: ReturnType<typeof createVineMaterials>;
  between: readonly [RegionId, RegionId];
}

interface LeafRest {
  x: number;
  z: number;
  /** Small vertical stagger so a clump layers instead of z-fighting flat. */
  y: number;
  yaw: number;
  tilt: number;
  scale: number;
  phase: number;
  along: number;
  seam: number;
}

function build(seams: SeamPath[]) {
  const built: BuiltSeam[] = [];
  const leaves: LeafRest[] = [];
  const leafMaterial = createLeafMaterial();

  for (const seam of seams) {
    const stride = Math.max(1, Math.ceil(seam.points.length / MAX_NODES));
    const nodes: THREE.Vector3[] = [];
    for (let i = 0; i < seam.points.length; i += stride) {
      nodes.push(new THREE.Vector3(seam.points[i][0], 0, seam.points[i][1]));
    }
    const last = seam.points[seam.points.length - 1];
    nodes.push(new THREE.Vector3(last[0], 0, last[1]));
    if (nodes.length < 3) continue;

    const curve = new THREE.CatmullRomCurve3(nodes, false, "catmullrom", 0.35);
    const segments = Math.min(320, Math.max(32, nodes.length * 4));
    const stem = new THREE.TubeGeometry(curve, segments, STEM_RADIUS, 6, false);

    // A second, thinner strand woven off to the side — one tube reads as a
    // cable, two reads as something that grew there.
    const woven = nodes.map((p, i) => {
      const prev = nodes[Math.max(0, i - 1)];
      const next = nodes[Math.min(nodes.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      const wiggle = Math.sin(i * 0.85) * 0.0042 + Math.sin(i * 2.3) * 0.0021;
      return new THREE.Vector3(p.x + (-dz / len) * wiggle, 0.0015, p.z + (dx / len) * wiggle);
    });
    const tendril = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(woven, false, "catmullrom", 0.4),
      segments,
      TENDRIL_RADIUS,
      5,
      false,
    );

    const index = built.length;
    built.push({ stem, tendril, mats: createVineMaterials(), between: seam.between });

    // Density follows the border's own length, and clumps: an even sprinkle
    // reads as a dotted line, which is the drawn-on look this is escaping.
    const count = Math.min(
      MAX_LEAVES_PER_SEAM,
      Math.max(12, Math.round(curve.getLength() / LEAF_SPACING)),
    );
    for (let i = 0; i < count; i++) {
      const r1 = hash(index * 7919 + i * 31);
      const r2 = hash(index * 104729 + i * 17);
      const r3 = hash(index * 15485863 + i * 7);
      const along = Math.min(0.999, Math.max(0.001, (i + 0.5) / count + (r1 - 0.5) / count));
      const point = curve.getPointAt(along);
      const tangent = curve.getTangentAt(along).normalize();
      // Off to either side of the stem, and further out for the outer leaves, so
      // the mass has a soft edge instead of a hard ribbon boundary.
      const side = (r2 - 0.5) * 0.019;
      // Clumping: a slow wave along the path thins some stretches to almost
      // nothing and doubles others, the way real overgrowth takes a fence.
      const clump = 0.45 + 0.55 * Math.abs(Math.sin(along * 9.3 + index * 2.1));
      leaves.push({
        x: point.x - tangent.z * side,
        z: point.z + tangent.x * side,
        y: r3 * 0.0026,
        yaw: Math.atan2(tangent.x, tangent.z) + (r2 - 0.5) * 2.6,
        // Nearly flat: the board is read from above, and a leaf on edge is a
        // sliver of nothing.
        tilt: (r3 - 0.5) * 0.5,
        scale: (0.55 + r1 * 0.75) * clump,
        phase: i * 0.73 + index * 1.7,
        along,
        seam: index,
      });
    }
  }

  const leafGeometry = new THREE.PlaneGeometry(0.0125, 0.019);
  // Per-instance seed: the leaf shader hangs colour, value and dryness off it,
  // so a clump is a mix rather than one stamp repeated.
  const seeds = new Float32Array(Math.max(1, leaves.length) * 3);
  leaves.forEach((leaf, i) => {
    seeds[i * 3] = hash(i * 2654435761);
    seeds[i * 3 + 1] = hash(i * 40503 + 11);
  });
  leafGeometry.setAttribute("aLeaf", new THREE.InstancedBufferAttribute(seeds, 3));
  const leafMesh = new THREE.InstancedMesh(
    leafGeometry,
    leafMaterial.material,
    Math.max(1, leaves.length),
  );
  leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leafMesh.count = leaves.length;
  leafMesh.frustumCulled = false;
  leafMesh.raycast = () => null;

  return {
    built,
    leaves,
    leafMesh,
    dispose() {
      for (const seam of built) {
        seam.stem.dispose();
        seam.tendril.dispose();
        seam.mats.dispose();
      }
      leafGeometry.dispose();
      leafMesh.dispose();
      leafMaterial.dispose();
    },
  };
}

export function BorderVines({
  seams,
  reducedMotion,
}: {
  seams: SeamPath[];
  reducedMotion: boolean;
}) {
  const { build: buildState } = useBuild();
  const { focus } = useMapFocus();
  const invalidate = useThree((s) => s.invalidate);
  const root = useRef<THREE.Group>(null);
  const vines = useMemo(() => build(seams), [seams]);
  useEffect(() => () => vines.dispose(), [vines]);

  const growth = useRef<number[]>([]);
  const heights = useRef<number[]>([]);
  const seeded = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  if (growth.current.length !== vines.built.length) {
    growth.current = vines.built.map(() => 1);
    heights.current = vines.built.map(() => 0);
  }

  const targets = useMemo(
    () =>
      vines.built.map((seam) => {
        const [a, b] = seam.between;
        const sealed = !isRegionUnlocked(buildState, a) || !isRegionUnlocked(buildState, b);
        return {
          growth: sealed ? 1 : 0,
          // Ride whichever neighbour is higher, or a raised plate would shear
          // its own border vine in half.
          y:
            Math.max(plateTopY(buildState, focus, a), plateTopY(buildState, focus, b)) + CLEARANCE,
        };
      }),
    [vines.built, buildState, focus],
  );

  useEffect(() => {
    invalidate();
  }, [targets, invalidate]);

  useFrame((_, delta) => {
    const group = root.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);
    const t = reducedMotion ? 0 : performance.now() * 0.001;
    let busy = false;

    for (let i = 0; i < vines.built.length; i++) {
      const want = targets[i];
      if (!want) continue;
      const snap = !seeded.current || reducedMotion;

      const g0 = growth.current[i] ?? 1;
      const g1 = snap ? want.growth : g0 + (want.growth - g0) * (1 - Math.exp(-dt * GROWTH_SPEED));
      if (Math.abs(g1 - want.growth) > 0.0008) busy = true;
      growth.current[i] = Math.abs(g1 - want.growth) < 0.0008 ? want.growth : g1;
      vines.built[i].mats.growth.value = growth.current[i];

      const y0 = heights.current[i] ?? want.y;
      let y1 = snap ? want.y : y0 + (want.y - y0) * (1 - Math.exp(-dt * Y_SPEED));
      if (Math.abs(y1 - want.y) < 0.0004) y1 = want.y;
      else busy = true;
      heights.current[i] = y1;

      const child = group.children[i];
      if (child) {
        child.position.set(reducedMotion ? 0 : Math.sin(t * 1.1 + i * 0.4) * 0.0009, y1, 0);
        // A vine with nothing left of it should not still be drawn.
        child.visible = growth.current[i] > 0.01;
      }
    }

    for (let i = 0; i < vines.leaves.length; i++) {
      const leaf = vines.leaves[i];
      const grown = growth.current[leaf.seam] ?? 1;
      const fromEnd = Math.min(leaf.along, 1 - leaf.along) * 2;
      const shown = Math.max(0, Math.min(1, (grown * 1.16 - fromEnd) / 0.14));
      if (shown < 0.04) {
        dummy.scale.setScalar(0.0001);
      } else {
        const wind = reducedMotion ? 0 : Math.sin(t * (1.5 + (leaf.phase % 1)) + leaf.phase) * 0.16;
        const y = heights.current[leaf.seam] ?? targets[leaf.seam]?.y ?? 0;
        dummy.position.set(leaf.x, y + leaf.y, leaf.z);
        dummy.rotation.set(-Math.PI / 2 + leaf.tilt + wind * 0.3, leaf.yaw + wind * 0.6, 0);
        dummy.scale.setScalar(leaf.scale * (0.5 + shown * 0.5));
      }
      dummy.updateMatrix();
      vines.leafMesh.setMatrixAt(i, dummy.matrix);
    }
    if (vines.leaves.length > 0) vines.leafMesh.instanceMatrix.needsUpdate = true;

    seeded.current = true;
    // Growth and height settle ask for frames. Wind never does — it rides the
    // sea's heartbeat, and stops when the sea stops.
    if (busy) invalidate();
  });

  return (
    <group>
      <group ref={root}>
        {vines.built.map((seam, i) => (
          <group key={i}>
            <mesh geometry={seam.stem} material={seam.mats.stem} raycast={() => null} />
            <mesh geometry={seam.tendril} material={seam.mats.tendril} raycast={() => null} />
          </group>
        ))}
      </group>
      <primitive object={vines.leafMesh} />
    </group>
  );
}
