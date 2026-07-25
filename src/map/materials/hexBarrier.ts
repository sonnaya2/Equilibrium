/**
 * The green hex barrier that caps a locked region, matching the lattice the
 * game itself draws over locked League content.
 *
 * Read from world XZ rather than per-slab UV, which is the whole point: the grid
 * is continuous across the board, so two locked neighbours share one lattice
 * instead of each wearing its own. That is what sells it as a barrier laid over
 * the map rather than a texture printed on a slab.
 */
import * as THREE from "three/webgpu";
import { float, positionWorld, smoothstep, uniform, vec2, vec3 } from "three/tsl";
import { GEM_400 } from "../palette";

/** Cells across the 2-unit board. Coarse enough that a line survives at the
 *  table framing — at 24 the strokes fell under a pixel and averaged away. */
const CELLS = 13;

export interface BarrierMaterial {
  material: THREE.MeshBasicNodeMaterial;
  /** 0 = open, 1 = fully barred. The unlock transition rides this one number. */
  lock: ReturnType<typeof uniform>;
  dispose(): void;
}

function linear(hex: number) {
  const ch = (shift: number) => Math.pow(((hex >> shift) & 255) / 255, 2.2);
  return vec3(ch(16), ch(8), ch(0));
}

export function createBarrierMaterial(): BarrierMaterial {
  const lock = uniform(1);
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const p = positionWorld.xz.mul(CELLS);
  const span = vec2(1, 1.7320508);
  const half = vec2(0.5, 0.8660254);
  const shifted = p.sub(half);
  // Positive modulo, written out rather than `.mod()`: WGSL's % keeps the
  // dividend's sign, which tears the lattice across x=0 and z=0 — the board's
  // own centre, and the most visible place it could possibly break.
  const a = p.sub(span.mul(p.div(span).floor())).sub(half);
  const b = shifted.sub(span.mul(shifted.div(span).floor())).sub(half);
  // Distance to the cell edge, 0.5 at a centre. Two offset lattices interlock
  // into the hex grid; the nearer edge of either is the boundary we draw.
  const axis = vec2(0.5, 0.8660254);
  // max, not min: the point sits inside exactly one of the two lattices, and
  // only that one yields a non-negative edge distance. Taking the min picks the
  // cell the point is outside of, which floods every fragment and paints the
  // slab a solid sheet instead of drawing a grid.
  const da = float(0.5).sub(a.abs().dot(axis).max(a.abs().x));
  const db = float(0.5).sub(b.abs().dot(axis).max(b.abs().x));
  const line = float(1).sub(smoothstep(float(0.008), float(0.035), da.max(db)));

  material.colorNode = linear(GEM_400);
  // Deliberately faint. A locked region is the state you are looking past, so
  // the barrier has to read without becoming the brightest thing on the board —
  // at full strength the eight locked slabs outshone the three open ones.
  material.opacityNode = line.mul(0.26).mul(lock);

  return {
    material,
    lock,
    dispose() {
      material.dispose();
    },
  };
}
