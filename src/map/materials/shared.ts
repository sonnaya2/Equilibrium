/**
 * One clock, one colour helper, one field sampler — shared by every material on
 * the board.
 *
 * The clock is module-level on purpose. Water, rivers, vines and marker gems all
 * move against the same second, and a per-material clock advanced from a
 * per-material `useFrame` is how two layers end up visibly out of phase after a
 * tab has been backgrounded. `MotionDriver` owns the only writer.
 */

import * as THREE from "three/webgpu";
import { float, uniform, vec2, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { MAP_WORLD } from "../data/regionAnchors";

/** Seconds of allowed motion since mount. Frozen under reduced motion. */
export const mapClock = uniform(0);

/**
 * Hex token -> linear vec3, by hand rather than through TSL's `color()`: that
 * node carries its own type, which will not mix with a plain vec3 under the
 * r185 typings. 2.2 is the sRGB decode `color()` would have applied.
 */
export function linear(hex: number) {
  const ch = (shift: number) => Math.pow(((hex >> shift) & 255) / 255, 2.2);
  return vec3(ch(16), ch(8), ch(0));
}

/**
 * World XZ -> map uv, the single geographic transform every shader uses.
 *
 * `v` is flipped because our map-uv runs south as v increases while a
 * `flipY: true` texture samples from the bottom up. Doing it here once is what
 * stops half the layers from sampling the world upside down.
 */
export function mapUvFrom(position: Node<"vec3">) {
  return vec2(
    position.x.div(float(MAP_WORLD.width)).add(0.5),
    position.z.div(float(MAP_WORLD.height)).add(0.5).oneMinus(),
  );
}

/**
 * One texel of the generated field texture, in uv. The field carries R land
 * coverage, G signed coast distance (0.5 is the waterline), B inland water and
 * A a low-passed relief, and is always sampled at map uv.
 */
export const FIELD_TEXEL = 1 / 1536;

/**
 * Prepare a texture for data use — no colour transform, no wrap bleed.
 *
 * No mipmaps: the field packs signed coast distance and inland water in linear
 * channels. Trilinear mips blur the waterline, and as the camera moves the LOD
 * switch crawls as shimmering bands along every coast and river.
 */
export function asDataTexture(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 1;
  tex.needsUpdate = true;
  return tex;
}

/** Prepare the HD surface raster — this one is artwork, so it is sRGB. */
export function asAlbedoTexture(tex: THREE.Texture, anisotropy = 16): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
