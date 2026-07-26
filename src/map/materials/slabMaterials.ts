/**
 * Cap and wall materials for a region slab — Daylit Reliquary class.
 *
 * The cap samples that region's terrain tile. The tiles are generated from one
 * shared graph with per-region parameters and already carry the identical 14%
 * grade toward BOARD_MEAN — that shared grade is what makes eleven surfaces read
 * as one carved board rather than eleven stickers, and it is baked in at
 * generation time, so this shader must not apply it twice.
 *
 * Daylit quality: albedo gain ~2.05, warm cream rim (thin gem edge, not mint
 * wash), luminance relief so furrows catch the key light, clearer wall strata.
 * Lock / dim / focus / unlock-ember sweep uniforms stay production behaviour.
 *
 * Albedo is brightened before lighting. A lit PBR surface returns roughly
 * albedo x irradiance, so feeding it the value you want back gets you something
 * far darker — the mistake that made the whole board render near-black when it
 * was handed SURFACE_* chrome tokens. See the note in palette.ts.
 */
import * as THREE from "three/webgpu";
import {
  float,
  mix,
  mx_noise_float,
  normalLocal,
  normalView,
  positionLocal,
  positionViewDirection,
  positionWorld,
  step,
  texture,
  uniform,
  vec3,
} from "three/tsl";
import {
  EMBER_400,
  GEM_300,
  TERRAIN_WALL_DEEP,
  TERRAIN_WALL_ROCK,
  TERRAIN_WALL_SUBSOIL,
  TERRAIN_WALL_TOPSOIL,
} from "../palette";

/**
 * Hex token -> linear-space vec3. Built by hand rather than with TSL's `color()`
 * because `color()` carries its own node type that will not mix with vec3 under
 * the r185 type definitions; the 2.2 gamma is the sRGB decode `color()` does.
 */
function linear(hex: number) {
  const ch = (shift: number) => Math.pow(((hex >> shift) & 255) / 255, 2.2);
  return vec3(ch(16), ch(8), ch(0));
}

/** Albedo gain so a lit surface returns roughly the tile's authored value at noon. */
const ALBEDO_GAIN = 2.05;

export interface SlabMaterials {
  cap: THREE.MeshStandardNodeMaterial;
  wall: THREE.MeshStandardNodeMaterial;
  /** 0 = open, 1 = locked. Drives desaturation on both surfaces. */
  lock: ReturnType<typeof uniform>;
  /** 0 = this slab is the subject, 1 = something else is. Drops it back. */
  dim: ReturnType<typeof uniform>;
  /** 0..1 focus rim. The sanctioned selection glow; 0 on every other slab. */
  focus: ReturnType<typeof uniform>;
  /** 1 -> 0 over ~600ms on unlock: ember resolving to gem. Never rests non-zero. */
  sweep: ReturnType<typeof uniform>;
  dispose(): void;
}

export function createSlabMaterials(terrain: THREE.Texture, depth: number): SlabMaterials {
  const lock = uniform(0);
  const dim = uniform(0);
  const focus = uniform(0);
  const sweep = uniform(0);
  // Daylit drain: locked ground desats without going black; unfocused still drops back.
  const drain = lock.mul(0.48).add(dim.mul(0.32)).min(float(0.78));
  const shade = float(1).sub(dim.mul(0.36));

  // Nothing is emissive at rest: both terms are driven by uniforms that sit at 0
  // until a selection or an unlock, which is what keeps bloom off the terrain.
  //
  // Warm cream rim (not mint wash). Thin edge only; thin gem edge as accent.
  // Both vectors must be in the same space. normalWorld against a view-space
  // view direction dots to noise, which came back as rim=1 everywhere.
  const warmRim = linear(0xf0d8a0);
  const gemEdge = linear(GEM_300);
  const rim = normalView.dot(positionViewDirection).clamp(0, 1).oneMinus().pow(2.8);
  const glow = warmRim
    .mul(rim.mul(focus).mul(1.35))
    .add(gemEdge.mul(rim.mul(focus).mul(0.55)))
    // Ember is transition-only by ruling — it resolves into gem and leaves.
    .add(mix(gemEdge, linear(EMBER_400), sweep).mul(sweep.mul(0.45)));

  // ---- cap ----------------------------------------------------------------
  const cap = new THREE.MeshStandardNodeMaterial({ roughness: 0.86 });
  const tex = texture(terrain);
  const tile = tex.rgb.mul(float(ALBEDO_GAIN));
  const lum = tile.x.mul(0.2126).add(tile.y.mul(0.7152)).add(tile.z.mul(0.0722));

  // Midtone lift so noon key doesn't crush 512px tiles into mud.
  const lifted = tile.mul(1.06).add(vec3(0.02, 0.018, 0.012));

  // Micro grain + slight value separation.
  const grain = mx_noise_float(positionWorld.mul(42)).mul(0.028);
  let base = lifted.mul(float(1).add(grain));

  // Fake height normal: push lighting with luminance as relief.
  const relief = lum.sub(0.42).mul(0.22);
  base = base.mul(float(1).add(relief));

  // Noon top-light: local up + slight key from +x.
  const nl = normalLocal.y.mul(0.72).add(normalLocal.x.mul(0.18)).add(float(0.14)).clamp(0, 1);
  base = base.mul(float(1).add(nl.mul(0.14))).add(linear(0xffe8c4).mul(nl.mul(0.035)));

  // Focus subject: subtle warm pop, not full wash.
  base = base.mul(float(1).add(focus.mul(0.08)));

  const baseLum = base.x.mul(0.2126).add(base.y.mul(0.7152)).add(base.z.mul(0.0722));
  cap.colorNode = mix(base, vec3(baseLum, baseLum, baseLum), drain).mul(shade);
  cap.emissiveNode = glow;
  cap.roughnessNode = float(0.84).sub(lum.mul(0.08)).add(grain.mul(0.1));

  // ---- wall ---------------------------------------------------------------
  // Local y runs 0..depth: ExtrudeGeometry extrudes along +z and the geometry is
  // rotated -90deg about x, which maps +z to +y. Boundaries are noise-perturbed
  // so the bands read as earth rather than as printed stripes.
  const wall = new THREE.MeshStandardNodeMaterial({ roughness: 0.93 });
  const jitter = mx_noise_float(positionWorld.mul(16)).mul(0.05);
  const band = positionLocal.y.div(float(depth)).add(jitter);
  const deep = linear(TERRAIN_WALL_DEEP).mul(0.92);
  const rock = mix(deep, linear(TERRAIN_WALL_ROCK), step(float(0.22), band));
  const sub = mix(rock, linear(TERRAIN_WALL_SUBSOIL), step(float(0.52), band));
  const top = mix(sub, linear(0x9a7a4a), step(float(0.78), band));
  // Warm the topsoil band under noon.
  const strata = mix(top, linear(TERRAIN_WALL_TOPSOIL), step(float(0.88), band));
  const strataLum = strata.x.mul(0.2126).add(strata.y.mul(0.7152)).add(strata.z.mul(0.0722));
  wall.colorNode = mix(strata, vec3(strataLum, strataLum, strataLum), drain)
    .mul(shade)
    .mul(float(1.08));
  wall.emissiveNode = warmRim.mul(focus.mul(rim.mul(0.12)));
  wall.roughnessNode = float(0.9).add(jitter.mul(2));

  return {
    cap,
    wall,
    lock,
    dim,
    focus,
    sweep,
    dispose() {
      cap.dispose();
      wall.dispose();
    },
  };
}
