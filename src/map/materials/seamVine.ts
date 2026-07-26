/**
 * Vines along the borders between land masses — Daylit plant palette.
 *
 * Olive / moss plants on a merged ribbon, not gem wire. Two strands meander
 * down a narrow ribbon laid on the seam, with leaf buds where a strand crosses
 * centre and a bright growth tip. The ribbon runs the whole border, so growth
 * reads as one plant creeping the length of a frontier.
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

/** Olive / moss plant palette — not casino mint. */
const BARK = 0x2a2218;
const STEM = 0x3d4a28;
const MOSS = 0x4a6a38;
const LEAF_A = 0x3a5c30;
const LEAF_B = 0x6a8a48;
const TIP = 0xc8e090;

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

  // Plant meander on fractal noise — never counter-phased sines (DNA helix).
  const meander = mx_fractal_noise_float(vec3(along.mul(5.5), clock.mul(0.05), 0), 2).mul(0.42);
  // 1 - smoothstep, never smoothstep(high, low, x): reversed edges are
  // undefined behaviour in WGSL, not a documented inversion.
  const stem = smoothstep(float(0), float(0.3), side.sub(meander).abs()).oneMinus();

  // One thin tendril that drifts across the stem every so often.
  const swing = mx_fractal_noise_float(vec3(along.mul(9), clock.mul(0.12), 1.7), 2).mul(0.55);
  const tendril = smoothstep(float(0), float(0.14), side.sub(swing.add(meander.mul(0.35))).abs()).oneMinus();

  // Leaves bud off the stem at intervals, alternating sides.
  const leafPhase = along.mul(36);
  const bud = leafPhase.fract().sub(0.5).abs();
  const alternate = leafPhase.floor().mul(0.5).fract().sub(0.25).sign();
  const leafD = side.sub(meander.add(alternate.mul(0.52))).abs();
  const leaves = smoothstep(float(0), float(0.12), bud)
    .oneMinus()
    .mul(smoothstep(float(0), float(0.28), leafD).oneMinus());

  const body = stem.max(tendril.mul(0.85)).max(leaves);

  // Growth creeps in from both ends of the border toward its middle. 1.18 so a
  // full growth of 1 closes the centre rather than stopping just short.
  const fromEnd = along.min(along.oneMinus()).mul(2);
  const alive = smoothstep(float(0), float(0.12), growth.mul(1.18).sub(fromEnd));
  /** Peaks mid-transition, gone once settled — the creeping tip. */
  const tip = alive.mul(alive.oneMinus()).mul(4).clamp(0, 1);

  // Bark core -> moss stem -> leaf green; tip is pale lime while expanding.
  const bark = mix(linear(BARK), linear(STEM), stem.oneMinus().mul(0.55).add(0.35));
  const mossy = mix(bark, linear(MOSS), stem.mul(0.35).add(tendril.mul(0.25)));
  const leafy = mix(mossy, mix(linear(LEAF_A), linear(LEAF_B), leaves), leaves.mul(0.85));
  // Roundness: darker core, brighter leaf/edge.
  const round = stem.oneMinus().mul(0.55).add(leaves.mul(0.45));
  material.colorNode = mix(
    mix(leafy.mul(0.78), leafy.mul(1.12), round),
    linear(TIP),
    tip.mul(0.9),
  );
  material.opacityNode = body.mul(alive).mul(float(0.9).add(tip.mul(0.1)));

  return {
    material,
    clock,
    dispose() {
      material.dispose();
    },
  };
}
