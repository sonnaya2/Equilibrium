/**
 * Cap and wall materials for a region slab.
 *
 * The cap samples that region's terrain tile. The tiles are generated from one
 * shared graph with per-region parameters and already carry the identical 14%
 * grade toward BOARD_MEAN — that shared grade is what makes eleven surfaces read
 * as one carved board rather than eleven stickers, and it is baked in at
 * generation time, so this shader must not apply it twice.
 *
 * The wall bands local height into strata, which is the entire payoff for
 * extruding: a raised slab shows its cut earth, a sunken one shows only rock.
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
  positionLocal,
  positionWorld,
  step,
  texture,
  uniform,
  vec3,
} from "three/tsl";
import {
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

/** Albedo gain so a lit surface returns roughly the tile's authored value. */
const ALBEDO_GAIN = 1.95;

export interface SlabMaterials {
  cap: THREE.MeshStandardNodeMaterial;
  wall: THREE.MeshStandardNodeMaterial;
  /** 0 = open, 1 = locked. Drives desaturation on both surfaces. */
  lock: ReturnType<typeof uniform>;
  dispose(): void;
}

export function createSlabMaterials(terrain: THREE.Texture, depth: number): SlabMaterials {
  const lock = uniform(0);
  // Locked ground drains of colour toward its own luminance without going black.
  const drain = lock.mul(0.72);

  // ---- cap ----------------------------------------------------------------
  const cap = new THREE.MeshStandardNodeMaterial({ roughness: 0.92 });
  const tile = texture(terrain).rgb.mul(ALBEDO_GAIN);
  const tileLum = tile.x.mul(0.2126).add(tile.y.mul(0.7152)).add(tile.z.mul(0.0722));
  cap.colorNode = mix(tile, vec3(tileLum, tileLum, tileLum), drain);

  // ---- wall ---------------------------------------------------------------
  // Local y runs 0..depth: ExtrudeGeometry extrudes along +z and the geometry is
  // rotated -90deg about x, which maps +z to +y. Boundaries are noise-perturbed
  // so the bands read as earth rather than as printed stripes.
  const wall = new THREE.MeshStandardNodeMaterial({ roughness: 0.95 });
  const jitter = mx_noise_float(positionWorld.mul(14)).mul(0.045);
  const band = positionLocal.y.div(float(depth)).add(jitter);

  const rock = mix(linear(TERRAIN_WALL_DEEP), linear(TERRAIN_WALL_ROCK), step(float(0.24), band));
  const subsoil = mix(rock, linear(TERRAIN_WALL_SUBSOIL), step(float(0.55), band));
  const strata = mix(subsoil, linear(TERRAIN_WALL_TOPSOIL), step(float(0.8), band));
  const strataLum = strata.x.mul(0.2126).add(strata.y.mul(0.7152)).add(strata.z.mul(0.0722));
  wall.colorNode = mix(strata, vec3(strataLum, strataLum, strataLum), drain);

  return {
    cap,
    wall,
    lock,
    dispose() {
      cap.dispose();
      wall.dispose();
    },
  };
}
