/**
 * The overgrowth that seals a border you have not opened yet.
 *
 * The Wiki raster is a painted top-down map: fine, matte, olive-and-ochre, with
 * no hard outlines and no gloss anywhere. So this has to be foliage, not a
 * drawn line — an earlier pass rendered a fat even tube along each seam and it
 * read as rubber cable laid over Gielinor, which is exactly the thing the map
 * does not contain.
 *
 * What does the work is leaves. The stem is deliberately thin and dark, closer
 * to dead wood than to anything green; the mass and the colour come from a few
 * hundred instanced leaf cards clumped along the border, in the same sages and
 * dry ochres the map already uses. Seen from above that reads as a hedge grown
 * across a frontier.
 *
 * Growth is a clip along the path, from both ends toward the middle, driven by
 * `uv.x` (TubeGeometry runs u along its curve). Unlocking withdraws it in about
 * a second instead of unmounting a mesh, which is what lets the whole state be
 * one animating number.
 */

import * as THREE from "three/webgpu";
import {
  attribute,
  float,
  mix,
  mx_noise_float,
  positionLocal,
  positionWorld,
  smoothstep,
  step,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { linear } from "./shared";

/**
 * Foliage is lit by the same rig as everything else, and a lit surface returns
 * roughly albedo x irradiance — so authored leaf greens come back as near-black
 * smudges unless they are brightened before lighting, exactly as the terrain is.
 */
const FOLIAGE_GAIN = 2.2;

/** Dead wood, not stem green — the stem should disappear under the leaves. */
const BARK_DARK = 0x241c13;
const BARK = 0x3a2f1f;
const BARK_MOSS = 0x3f4a2c;

/** Sages and dry ochres, sampled to sit inside the map's own palette. */
const LEAF_DEEP = 0x2f4526;
const LEAF_MID = 0x4f6636;
const LEAF_PALE = 0x76854a;
const LEAF_DRY = 0x7a6a38;

export interface VineMaterials {
  stem: THREE.MeshStandardNodeMaterial;
  tendril: THREE.MeshStandardNodeMaterial;
  /** 1 fully overgrown, 0 withdrawn. */
  growth: ReturnType<typeof uniform>;
  dispose(): void;
}

export function createVineMaterials(): VineMaterials {
  const growth = uniform(1);
  /** Reveal from both ends inward, with a living tip at the growing edge. */
  const alive = () => {
    const along = uv().x;
    const fromEnd = along.min(along.oneMinus()).mul(2);
    return smoothstep(float(0), float(0.13), growth.mul(1.16).sub(fromEnd));
  };

  // depthWrite false while growing: a semi-transparent tip that still wrote
  // depth punched holes through leaves and plates behind the frontier.
  const stem = new THREE.MeshStandardNodeMaterial({
    roughness: 0.94,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  const grain = mx_noise_float(positionWorld.mul(220));
  const bark = mix(linear(BARK_DARK), linear(BARK), grain.mul(0.5).add(0.5));
  const mossy = mix(bark, linear(BARK_MOSS), grain.mul(0.3).add(0.24));
  // Round the tube: the far side of a stem should not be as lit as the near side.
  const round = uv().y.sub(0.5).abs().mul(2);
  stem.colorNode = mix(mossy.mul(0.7), mossy.mul(1.06), round).mul(FOLIAGE_GAIN);
  stem.roughnessNode = float(0.9).add(grain.mul(0.08));
  stem.opacityNode = alive();

  const tendril = new THREE.MeshStandardNodeMaterial({
    roughness: 0.88,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  const fine = mx_noise_float(positionWorld.mul(360));
  tendril.colorNode = mix(linear(BARK), linear(BARK_MOSS), fine.mul(0.5).add(0.5)).mul(FOLIAGE_GAIN);
  tendril.opacityNode = alive().mul(0.85);
  tendril.roughnessNode = float(0.88).add(fine.mul(0.1));

  return {
    stem,
    tendril,
    growth,
    dispose() {
      stem.dispose();
      tendril.dispose();
    },
  };
}

export interface LeafMaterial {
  material: THREE.MeshStandardNodeMaterial;
  dispose(): void;
}

/**
 * One shared material for every leaf card on the board.
 *
 * `aLeaf.x` is a per-instance 0..1 seed. Colour, value and dryness all hang off
 * it, so a clump is a mix of sage, deep green and a few dead ones rather than
 * three hundred identical stamps — which is the difference between a hedge and
 * a texture.
 */
export function createLeafMaterial(): LeafMaterial {
  // Binary alpha cut + depth write: soft opacity under alphaTest crawled under
  // sub-pixel wind and camera motion; transparent cards without depth also
  // reordered every frame as a hedge twinkle.
  const material = new THREE.MeshStandardNodeMaterial({
    roughness: 0.88,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    alphaTest: 0.35,
  });

  const seed = (attribute("aLeaf", "vec3") as unknown as Node<"vec3">).x;
  const u = uv();
  const vein = u.x.sub(0.5).abs().mul(2);

  // Three-way blend across the seed, then a little dry ochre on the oldest.
  const young = mix(linear(LEAF_MID), linear(LEAF_PALE), smoothstep(0.45, 1, seed));
  const body = mix(linear(LEAF_DEEP), young, smoothstep(0, 0.55, seed));
  const dried = mix(body, linear(LEAF_DRY), smoothstep(0.86, 1, seed).mul(0.8));
  // Darker along the spine, paler at the edge — how a leaf reads from above.
  const shaded = mix(dried.mul(0.72), dried.mul(1.12), vein.pow(0.7));
  const fleck = mx_noise_float(positionLocal.mul(90));
  material.colorNode = shaded.mul(fleck.mul(0.09).add(0.955)).mul(FOLIAGE_GAIN);

  // Cut the quad into a leaf: pointed tip, rounded base, no card corners.
  // Hard step keeps the alpha-test edge stable under wind.
  const shape = float(1)
    .sub(vein.pow(1.5))
    .sub(smoothstep(float(0.55), float(1), u.y).mul(0.62))
    .sub(smoothstep(float(0.35), float(0), u.y).mul(0.5));
  material.opacityNode = step(float(0.02), shape);
  material.roughnessNode = float(0.86).add(fleck.mul(0.1));

  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}
