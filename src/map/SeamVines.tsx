"use client";

/**
 * Vines growing along every border between two land masses.
 *
 * One merged ribbon for all seams: one geometry, one material, one draw call,
 * however many borders the board has. Per-seam state travels in vertex
 * attributes rather than uniforms, which is what lets a single mesh carry
 * eighteen independently growing borders.
 *
 * The vines are not decoration — their extent is the shape of what you have not
 * opened. A border grows over when either side of it is locked and recedes as
 * you unlock, so the board's overgrown frontier shrinks across a run.
 *
 * Height tracks the two slabs it straddles (see slabHeight.ts), so the ribbon
 * rides the raise/sink/focus springs instead of floating over a sunken region.
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { useFrame, useThree } from "@react-three/fiber";
import { isRegionUnlocked, type RegionId } from "@/league";
import { useBuild } from "@/league/useBuild";
import { MAP_WORLD } from "./data/regionAnchors";
import { SHAPE_BY_ID } from "./data/regionShapes";
import { SEAMS } from "./data/seams";
import { createSeamVineMaterial } from "./materials/seamVine";
import { slabBaseY, BEVEL } from "./slabHeight";
import { useMapFocus } from "./useMapFocus";

/** Half-width of the ribbon, in world units. The vines live inside this. */
const HALF_WIDTH = 0.026;
/** Clear of the cap so the ribbon never z-fights the terrain it lies on. */
const LIFT = 0.0035;
/** Seconds for a border to grow over, or clear. */
const GROWTH_SECONDS = 1.3;

export function SeamVines() {
  const { build } = useBuild();
  const { focus } = useMapFocus();
  const invalidate = useThree((s) => s.invalidate);
  const vine = useMemo(() => createSeamVineMaterial(), []);
  useEffect(() => () => vine.dispose(), [vine]);

  /**
   * Two vertices per sample, one ribbon per seam, all merged. Built once: only
   * y and aGrowth ever change, and both are written in place.
   */
  const built = useMemo(() => {
    const position: number[] = [];
    const along: number[] = [];
    const sideAttr: number[] = [];
    const growthAttr: number[] = [];
    const index: number[] = [];
    /** Per seam: where its vertices start, how many, and which regions it joins. */
    const spans: { start: number; count: number; between: readonly [RegionId, RegionId] }[] = [];

    for (const seam of SEAMS) {
      const pts = seam.points.map(
        ([u, v]) => [(u - 0.5) * MAP_WORLD.width, (v - 0.5) * MAP_WORLD.height] as const,
      );
      const start = position.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(pts.length - 1, i + 1)];
        // Perpendicular in the board plane, so the ribbon lies flat on the cap.
        const dx = next[0] - prev[0];
        const dz = next[1] - prev[1];
        const len = Math.hypot(dx, dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;
        const t = i / (pts.length - 1);
        for (const s of [-1, 1]) {
          position.push(pts[i][0] + nx * HALF_WIDTH * s, 0, pts[i][1] + nz * HALF_WIDTH * s);
          along.push(t);
          sideAttr.push(s);
          growthAttr.push(0);
        }
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = start + i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      spans.push({ start, count: pts.length * 2, between: seam.between });
    }

    const geometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.Float32BufferAttribute(new Float32Array(position), 3);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    const growth = new THREE.Float32BufferAttribute(new Float32Array(growthAttr), 1);
    growth.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position", positionAttr);
    geometry.setAttribute("aAlong", new THREE.Float32BufferAttribute(new Float32Array(along), 1));
    geometry.setAttribute("aSide", new THREE.Float32BufferAttribute(new Float32Array(sideAttr), 1));
    geometry.setAttribute("aGrowth", growth);
    geometry.setIndex(index);
    // The ribbon is flat and board-sized; a computed sphere would be fine, but
    // this skips the pass and can never cull a seam at the board's edge.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 3);

    return { geometry, positionAttr, growth, spans };
  }, []);

  useEffect(() => () => built.geometry.dispose(), [built]);

  /** Current animated growth per seam, and current y per seam. */
  const state = useRef(built.spans.map(() => ({ growth: 0, y: 0 })));
  const clock = useRef(0);
  const seeded = useRef(false);

  // Target growth and height for each seam, from the two regions it joins.
  const targets = useMemo(
    () =>
      built.spans.map((span) => {
        const [a, b] = span.between;
        const overgrown = !isRegionUnlocked(build, a) || !isRegionUnlocked(build, b);
        const topOf = (id: RegionId) => {
          const depth = SHAPE_BY_ID.get(id)?.depth ?? 0;
          const subject = focus.framed && focus.region === id;
          const sidelined = focus.framed && focus.region !== id;
          return slabBaseY(isRegionUnlocked(build, id), subject, sidelined) + depth + BEVEL;
        };
        // The higher of the two: a vine bridging a raised and a sunken slab has
        // to sit on the raised one or it disappears inside it.
        return { growth: overgrown ? 1 : 0, y: Math.max(topOf(a), topOf(b)) + LIFT };
      }),
    [built.spans, build, focus.framed, focus.region],
  );

  useEffect(() => invalidate(), [targets, invalidate]);

  useFrame((_, delta) => {
    // Rides frames that already exist and never asks for one, so an always-on
    // shader cannot pin frameloop="demand" awake.
    clock.current += delta;
    vine.clock.value = clock.current;

    let busy = false;
    const positions = built.positionAttr.array as Float32Array;
    const growths = built.growth.array as Float32Array;
    let movedY = false;
    let movedGrowth = false;

    for (let s = 0; s < built.spans.length; s++) {
      const span = built.spans[s];
      const cur = state.current[s];
      const want = targets[s];

      // First frame lands at rest: the board must not sprout on every load.
      const snap = !seeded.current;
      const step = delta / GROWTH_SECONDS;
      if (cur.growth !== want.growth) {
        cur.growth = snap
          ? want.growth
          : want.growth > cur.growth
            ? Math.min(want.growth, cur.growth + step)
            : Math.max(want.growth, cur.growth - step);
        for (let i = 0; i < span.count; i++) growths[span.start + i] = cur.growth;
        movedGrowth = true;
        busy = true;
      }
      if (cur.y !== want.y) {
        const next = snap ? want.y : cur.y + (want.y - cur.y) * (1 - Math.exp(-delta * 6.5));
        cur.y = Math.abs(next - want.y) < 0.0002 ? want.y : next;
        for (let i = 0; i < span.count; i++) positions[(span.start + i) * 3 + 1] = cur.y;
        movedY = true;
        busy = true;
      }
    }

    seeded.current = true;
    if (movedY) built.positionAttr.needsUpdate = true;
    if (movedGrowth) built.growth.needsUpdate = true;
    if (busy) invalidate();
  });

  return <mesh geometry={built.geometry} material={vine.material} raycast={() => null} />;
}
