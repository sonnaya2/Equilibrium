/** Module-level clock keeps every material in phase; MotionDriver is its sole writer. */

import * as THREE from "three/webgpu";
import { float, uniform, vec2, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { MAP_WORLD } from "../data/regionAnchors";

/** Seconds of allowed motion since mount. Frozen under reduced motion. */
export const mapClock = uniform(0);

/**
 * Hex -> linear vec3 by hand (TSL `color()` has a distinct type that won't mix
 * with plain vec3 under r185). Gamma 2.2 matches what `color()` would apply.
 */
export function linear(hex: number) {
  // float() each channel - bare JS numbers into vec3 can emit abstract floats
  // when naga types a JoinNode path; concrete f32 nodes stay valid in mix().
  const ch = (shift: number) => Math.pow(((hex >> shift) & 255) / 255, 2.2);
  return vec3(float(ch(16)), float(ch(8)), float(ch(0)));
}

/**
 * World XZ -> map uv (shared by every map shader). `v` is oneMinus'd so south
 * increases with v while flipY textures sample bottom-up; apply here once.
 */
export function mapUvFrom(position: Node<"vec3">) {
  return vec2(
    position.x.div(float(MAP_WORLD.width)).add(float(0.5)),
    position.z.div(float(MAP_WORLD.height)).add(float(0.5)).oneMinus(),
  );
}

/**
 * One field-texel in uv. Channels: R land, G signed coast (0.5 = waterline),
 * B inland water, A low-passed relief. Sampled at map uv.
 */
export const FIELD_TEXEL = 1 / 1536;

/**
 * Data texture: NoColorSpace, clamp wrap, no mips. Field packs linear coast/
 * water; trilinear mips blur the waterline into shimmering LOD bands.
 */
export function asDataTexture(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 1;
  // Loader cache can leave a mip chain from an earlier configure; clear it so
  // the GPU re-uploads only the base level (HMR / remount otherwise keeps the
  // shimmering waterline).
  tex.mipmaps = [];
  tex.needsUpdate = true;
  return tex;
}

/** Prepare the HD surface raster - this one is artwork, so it is sRGB. */
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
