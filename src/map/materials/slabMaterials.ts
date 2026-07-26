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
  GEM_400,
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
  // Locked ground drains of colour toward its own luminance without going black;
  // an unfocused slab drains a little too, so the subject separates from the board.
  const drain = lock.mul(0.72).add(dim.mul(0.3)).min(float(0.85));
  const shade = float(1).sub(dim.mul(0.3));

  // Nothing is emissive at rest: both terms are driven by uniforms that sit at 0
  // until a selection or an unlock, which is what keeps bloom off the terrain.
  //
  // The focus term is a *rim*, weighted by facing ratio. Applied flat it washed
  // the whole cap mint green, which read as a broken material rather than a
  // selection: a cap faces the camera and would take the glow at full strength,
  // while the extruded wall — the edge you actually want lit — took the same.
  const gem = linear(GEM_400);
  // Both vectors must be in the same space. normalWorld against a view-space
  // view direction dots to noise, which came back as rim=1 everywhere and
  // painted the focused cap flat mint.
  const rim = normalView.dot(positionViewDirection).clamp(0, 1).oneMinus().pow(2.5);
  const glow = gem
    .mul(rim.mul(focus).mul(1.9))
    // Ember is transition-only by ruling — it resolves into gem and leaves.
    .add(mix(gem, linear(EMBER_400), sweep).mul(sweep.mul(0.45)));

  // ---- cap ----------------------------------------------------------------
  const cap = new THREE.MeshStandardNodeMaterial({ roughness: 0.92 });
  const tile = texture(terrain).rgb.mul(ALBEDO_GAIN);
  const tileLum = tile.x.mul(0.2126).add(tile.y.mul(0.7152)).add(tile.z.mul(0.0722));
  cap.colorNode = mix(tile, vec3(tileLum, tileLum, tileLum), drain).mul(shade);
  cap.emissiveNode = glow;

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
  wall.colorNode = mix(strata, vec3(strataLum, strataLum, strataLum), drain).mul(shade);

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
