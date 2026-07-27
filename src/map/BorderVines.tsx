"use client";

/**
 * Ancient growth along the borders you have not opened.
 *
 * The path is the seam itself — the same polyline both neighbouring plates were
 * cut along. We keep that polyline faithful (no Catmull-Rom rounding off the
 * lattice edge) so vines hug true region borders. Leaves carry the hedge mass;
 * the stem is thin structure under them.
 *
 * A border is overgrown while either side is still locked and withdraws as both
 * open. Wind rides frames the board is already drawing — never its own heartbeat.
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

const GROWTH_SPEED = 1.5;
const Y_SPEED = 6.5;
const CLEARANCE = 0.0022;

// Thin structure under the leaf mass — fat tubes read as rubber cable.
const STEM_RADIUS = 0.0008;
const TENDRIL_RADIUS = 0.00035;
const TENDRIL_WIGGLE = 0.0018;
/** Prefer full seam fidelity; only stride when denser than this. */
const MAX_NODES = 160;
const LEAF_SPACING = 0.005;
const MAX_LEAVES_PER_SEAM = 160;
const LEAF_SIDE = 0.008;
const LEAF_W = 0.014;
const LEAF_H = 0.022;
const CORNER_GAIN = 1.5;

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
  y: number;
  yaw: number;
  tilt: number;
  roll: number;
  ax: number;
  az: number;
  scale: number;
  phase: number;
  along: number;
  seam: number;
}

/** Piecewise-linear path through seam nodes — no Catmull bulges off the plate edge. */
class PolylineCurve extends THREE.Curve<THREE.Vector3> {
  private readonly pts: THREE.Vector3[];
  private readonly cum: number[];
  private readonly total: number;

  constructor(pts: THREE.Vector3[]) {
    super();
    this.pts = pts;
    this.cum = [0];
    let sum = 0;
    for (let i = 1; i < pts.length; i++) {
      sum += pts[i].distanceTo(pts[i - 1]);
      this.cum.push(sum);
    }
    this.total = sum || 1;
  }

  override getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const d = Math.min(1, Math.max(0, t)) * this.total;
    let i = 1;
    while (i < this.cum.length && this.cum[i] < d) i++;
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(this.pts.length - 1, i);
    const seg = this.cum[i1] - this.cum[i0] || 1;
    const u = (d - this.cum[i0]) / seg;
    return optionalTarget.copy(this.pts[i0]).lerp(this.pts[i1], u);
  }

  override getLength(): number {
    return this.total;
  }
}

function buildNodes(points: [number, number][]): THREE.Vector3[] {
  if (points.length < 2) return [];
  // Prefer full fidelity; only stride when denser than MAX_NODES.
  const stride = points.length <= MAX_NODES ? 1 : Math.ceil(points.length / MAX_NODES);
  const nodes: THREE.Vector3[] = [];
  for (let i = 0; i < points.length; i += stride) {
    const p = points[i];
    const v = new THREE.Vector3(p[0], 0, p[1]);
    if (nodes.length === 0 || nodes[nodes.length - 1].distanceToSquared(v) > 1e-12) {
      nodes.push(v);
    }
  }
  const last = points[points.length - 1];
  const end = new THREE.Vector3(last[0], 0, last[1]);
  if (nodes.length === 0 || nodes[nodes.length - 1].distanceToSquared(end) > 1e-12) {
    nodes.push(end);
  }
  return nodes;
}

function build(seams: SeamPath[]) {
  const built: BuiltSeam[] = [];
  const leaves: LeafRest[] = [];
  const leafMaterial = createLeafMaterial();

  for (const seam of seams) {
    const nodes = buildNodes(seam.points);
    if (nodes.length < 2) continue;

    const curve = new PolylineCurve(nodes);
    const length = curve.getLength();
    const segments = Math.min(280, Math.max(24, Math.round(length / 0.004)));
    const stem = new THREE.TubeGeometry(curve, segments, STEM_RADIUS, 4, false);

    // Thin second strand — small wiggle so it stays on the frontier band.
    const woven = nodes.map((p, i) => {
      const prev = nodes[Math.max(0, i - 1)];
      const next = nodes[Math.min(nodes.length - 1, i + 1)];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      const wiggle = Math.sin(i * 0.85) * TENDRIL_WIGGLE + Math.sin(i * 2.3) * (TENDRIL_WIGGLE * 0.5);
      return new THREE.Vector3(p.x + (-dz / len) * wiggle, 0.0012, p.z + (dx / len) * wiggle);
    });
    const tendril = new THREE.TubeGeometry(
      new PolylineCurve(woven),
      segments,
      TENDRIL_RADIUS,
      4,
      false,
    );

    const index = built.length;
    built.push({ stem, tendril, mats: createVineMaterials(), between: seam.between });

    // Sample path for density weights (clump + corner boost).
    const S = Math.max(16, Math.min(120, segments));
    const samples: { s: number; along: number; weight: number; t: THREE.Vector3 }[] = [];
    let prevT: THREE.Vector3 | null = null;
    for (let i = 0; i <= S; i++) {
      const along = i / S;
      const t = curve.getTangent(along).normalize();
      let corner = 0;
      if (prevT) {
        const d = Math.min(1, Math.max(-1, prevT.dot(t)));
        const kappa = Math.acos(d);
        corner = THREE.MathUtils.smoothstep(kappa, 0.12, 0.55);
      }
      prevT = t.clone();
      const clump =
        0.25 +
        0.55 * Math.abs(Math.sin(along * 9.3 + index * 2.1)) +
        0.2 * Math.abs(Math.sin(along * 25 + index));
      const weight = clump * (1 + CORNER_GAIN * corner);
      samples.push({ s: along * length, along, weight, t });
    }
    // CDF
    const cum: number[] = [0];
    for (let i = 1; i < samples.length; i++) {
      const ds = samples[i].s - samples[i - 1].s;
      const w = 0.5 * (samples[i].weight + samples[i - 1].weight);
      cum.push(cum[i - 1] + ds * w);
    }
    const totalW = cum[cum.length - 1] || 1;
    const budget = Math.min(
      MAX_LEAVES_PER_SEAM,
      Math.max(16, Math.round(length / LEAF_SPACING)),
    );

    const invCdf = (u: number) => {
      const target = u * totalW;
      let lo = 0;
      let hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      const i1 = Math.max(1, lo);
      const i0 = i1 - 1;
      const span = cum[i1] - cum[i0] || 1;
      const f = (target - cum[i0]) / span;
      return samples[i0].along + (samples[i1].along - samples[i0].along) * f;
    };

    for (let i = 0; i < budget; i++) {
      const r1 = hash(index * 7919 + i * 31);
      const r2 = hash(index * 104729 + i * 17);
      const r3 = hash(index * 15485863 + i * 7);
      const r4 = hash(index * 2246822519 + i * 13);
      // Sparse gaps: skip ~12% of slots on thin stretches.
      if (r4 < 0.12 && r1 < 0.55) continue;

      const along = Math.min(0.999, Math.max(0.001, invCdf((i + r1) / budget)));
      const point = curve.getPoint(along);
      const tangent = curve.getTangent(along).normalize();

      // Multi-rank lateral: core / mid / fringe.
      const rank = r2;
      let side = 0;
      let rankScale = 1;
      if (rank < 0.45) {
        side = (r3 - 0.5) * 0.004;
        rankScale = 0.95 + r1 * 0.3;
      } else if (rank < 0.8) {
        side = (r2 > 0.5 ? 1 : -1) * (0.005 + r3 * LEAF_SIDE);
        rankScale = 0.7 + r1 * 0.35;
      } else {
        side = (r2 > 0.5 ? 1 : -1) * (0.01 + r3 * 0.01);
        rankScale = 0.45 + r1 * 0.3;
      }

      const localWeight =
        0.4 + 0.6 * Math.abs(Math.sin(along * 9.3 + index * 2.1));
      leaves.push({
        x: point.x - tangent.z * side,
        z: point.z + tangent.x * side,
        y: r3 * 0.0032,
        yaw: Math.atan2(tangent.x, tangent.z) + (r2 - 0.5) * 2.2,
        tilt: (r3 - 0.5) * 0.45,
        roll: (r4 - 0.5) * 0.5,
        ax: 0.75 + r1 * 0.4,
        az: 0.9 + r2 * 0.4,
        scale: (0.55 + r1 * 0.7) * rankScale * (0.75 + 0.4 * localWeight),
        phase: i * 0.73 + index * 1.7,
        along,
        seam: index,
      });
    }
  }

  const leafGeometry = new THREE.PlaneGeometry(LEAF_W, LEAF_H);
  const seeds = new Float32Array(Math.max(1, leaves.length) * 3);
  leaves.forEach((leaf, i) => {
    seeds[i * 3] = hash(i * 2654435761);
    seeds[i * 3 + 1] = hash(i * 40503 + 11);
    seeds[i * 3 + 2] = hash(i * 97 + leaf.seam * 13);
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
  const forcePose = useRef(true);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  if (growth.current.length !== vines.built.length) {
    growth.current = vines.built.map(() => 1);
    heights.current = vines.built.map(() => 0);
    forcePose.current = true;
  }

  const targets = useMemo(
    () =>
      vines.built.map((seam) => {
        const [a, b] = seam.between;
        const sealed = !isRegionUnlocked(buildState, a) || !isRegionUnlocked(buildState, b);
        return {
          growth: sealed ? 1 : 0,
          y:
            Math.max(plateTopY(buildState, focus, a), plateTopY(buildState, focus, b)) + CLEARANCE,
        };
      }),
    [vines.built, buildState, focus],
  );

  useEffect(() => {
    forcePose.current = true;
    invalidate();
  }, [targets, invalidate]);

  useFrame((_, delta) => {
    const group = root.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);
    const t = reducedMotion ? 0 : performance.now() * 0.001;
    let busy = false;
    let wroteLeaves = false;

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
        // Height only — no X sway (that read as a rubber rope).
        child.position.set(0, y1, 0);
        child.visible = growth.current[i] > 0.01;
      }
    }

    const rewriteLeaves = forcePose.current || busy || !seeded.current;
    if (rewriteLeaves || !reducedMotion) {
      // Wind only when motion is allowed; still rewrite matrices for wind while
      // MotionDriver is already ticking. Growth/height settle freezes when reduced.
      const doWind = !reducedMotion;
      if (rewriteLeaves || doWind) {
        for (let i = 0; i < vines.leaves.length; i++) {
          const leaf = vines.leaves[i];
          const grown = growth.current[leaf.seam] ?? 1;
          const fromEnd = Math.min(leaf.along, 1 - leaf.along) * 2;
          const shown = Math.max(0, Math.min(1, (grown * 1.1 - fromEnd) / 0.2));
          if (shown < 0.02) {
            dummy.scale.setScalar(0.0001);
          } else {
            const wind = doWind ? Math.sin(t * (1.5 + (leaf.phase % 1)) + leaf.phase) * 0.12 : 0;
            const y = heights.current[leaf.seam] ?? targets[leaf.seam]?.y ?? 0;
            dummy.position.set(leaf.x, y + leaf.y, leaf.z);
            dummy.rotation.set(
              -Math.PI / 2 + leaf.tilt + wind * 0.25,
              leaf.yaw + wind * 0.45,
              leaf.roll,
            );
            const s = leaf.scale * (0.4 + shown * 0.6);
            dummy.scale.set(s * leaf.ax, s * leaf.az, 1);
          }
          dummy.updateMatrix();
          vines.leafMesh.setMatrixAt(i, dummy.matrix);
        }
        wroteLeaves = vines.leaves.length > 0;
      }
    }

    if (wroteLeaves) vines.leafMesh.instanceMatrix.needsUpdate = true;
    if (!busy) forcePose.current = false;
    seeded.current = true;
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
