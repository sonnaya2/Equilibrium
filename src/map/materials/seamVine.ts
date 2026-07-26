/**
 * Vines along the borders between land masses.
 *
 * Two strands braided down a narrow ribbon laid on the seam, with leaf nodes
 * where a strand crosses centre and a bright tip at the growth front. The
 * ribbon runs the whole border, so growth reads as one plant creeping the
 * length of a frontier rather than eleven separate decals.
 *
 * Everything varies off two per-vertex attributes rather than world position:
 * `aAlong` (0..1 down the border) and `aSide` (-1..1 across the ribbon). That is
 * what makes the strands follow the border's curve instead of being a noise
 * field the ribbon happens to sample — and it keeps the look identical on a
 * short seam and a long one.
 *
 * TSL, not GLSL: this pipeline compiles node graphs. Note `mx_fractal_noise_float`
 * takes a **vec3** — handing it a vec2 emits a call matching no overload and the
 * material silently draws nothing.
 */
import * as THREE from "three/webgpu";
import { attribute, float, mix, mx_fractal_noise_float, smoothstep, uniform, vec3 } from "three/tsl";
import { GEM_200, GEM_300, GEM_600 } from "../palette";

export interface SeamVineMaterial {
  material: THREE.MeshBasicNodeMaterial;
  /** Advanced by the scene's existing frame loop. Never invalidates alone. */
  clock: ReturnType<typeof uniform>;
  dispose(): void;
}

function linear(hex: number) {
  const ch = (shift: number) => Math.pow(((hex >> shift) & 255) / 255, 2.2);
  return vec3(ch(16), ch(8), ch(0));
}

export function createSeamVineMaterial(): SeamVineMaterial {
  const clock = uniform(0);
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Explicit type argument: `attribute<TNodeType>(name, nodeType?: TNodeType)`
  // infers TNodeType from the *value*, so a bare "float" widens to `string` and
  // the returned node carries none of the arithmetic methods.
  const along = attribute<"float">("aAlong", "float");
  const side = attribute<"float">("aSide", "float");
  // Per-vertex rather than a uniform: all seams are one merged geometry and one
  // draw call, so growth has to travel in the vertex buffer.
  const growth = attribute<"float">("aGrowth", "float");

  // The stem meanders on noise, not a sine. Two counter-phased sines was the
  // first attempt and it read as a DNA helix — regular period, regular
  // crossings, nothing alive about it. A plant wanders.
  const meander = mx_fractal_noise_float(vec3(along.mul(5.5), clock.mul(0.05), 0), 2).mul(0.4);
  // 1 - smoothstep, never smoothstep(high, low, x): reversed edges are
  // undefined behaviour in WGSL, not a documented inversion.
  const stem = smoothstep(float(0), float(0.32), side.sub(meander).abs()).oneMinus();

  // One thin tendril that drifts across the stem every so often.
  const swing = along.mul(9).add(clock.mul(0.3)).sin().mul(0.6).add(meander.mul(0.4));
  const tendril = smoothstep(float(0), float(0.15), side.sub(swing).abs()).oneMinus();

  // Leaves bud off the stem at intervals, alternating sides.
  const leafPhase = along.mul(38);
  const bud = leafPhase.fract().sub(0.5).abs();
  const alternate = leafPhase.floor().mul(0.5).fract().sub(0.25).sign();
  const leafD = side.sub(meander.add(alternate.mul(0.52))).abs();
  const leaves = smoothstep(float(0), float(0.13), bud)
    .oneMinus()
    .mul(smoothstep(float(0), float(0.3), leafD).oneMinus());

  const body = stem.max(tendril.mul(0.85)).max(leaves);

  // Growth creeps in from both ends of the border toward its middle. 1.15 so a
  // full growth of 1 closes the centre rather than stopping just short.
  const fromEnd = along.min(along.oneMinus()).mul(2);
  const alive = smoothstep(float(0), float(0.14), growth.mul(1.15).sub(fromEnd));
  /** Peaks mid-transition, gone once settled — the creeping tip. */
  const tip = alive.mul(alive.oneMinus()).mul(4).clamp(0, 1);

  // Dark at the stem's core, brighter at its edges and on the leaves, so the
  // vine has some roundness instead of reading as a flat glowing wire.
  material.colorNode = mix(
    mix(linear(GEM_600), linear(GEM_300), stem.oneMinus().mul(0.7).add(leaves.mul(0.5))),
    linear(GEM_200),
    tip.mul(0.95),
  );
  material.opacityNode = body.mul(alive).mul(float(0.88).add(tip.mul(0.12)));

  return {
    material,
    clock,
    dispose() {
      material.dispose();
    },
  };
}
