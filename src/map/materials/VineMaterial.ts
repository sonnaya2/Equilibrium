/**
 * The overgrowth that seals a border you have not opened yet.
 *
 * Leaves do the visual work: dry RS-map sage and ochre, irregular silhouette,
 * mottling. The stem is thin dead wood under the hedge — never a rubber cable.
 *
 * Growth is a clip along the path from both ends, driven by uv.x. Leaves use
 * binary alpha + depthWrite so the hedge does not twinkle under the demand loop.
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
  vec2,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { linear } from "./shared";

/** Leaf gain under the key-heavy desk lamp. Stem stays darker under the mass. */
const FOLIAGE_GAIN = 2.0;
const STEM_GAIN = 1.35;
const TENDRIL_GAIN = 1.2;

const BARK_DARK = 0x1c1610;
const BARK = 0x32281c;
const BARK_MOSS = 0x3a4228;

const LEAF_DEEP = 0x354628;
const LEAF_MID = 0x5a6b3a;
const LEAF_PALE = 0x8a8f52;
const LEAF_DRY = 0x8a6e34;
const LEAF_BURN = 0x6a4e2a;

export interface VineMaterials {
  stem: THREE.MeshStandardNodeMaterial;
  tendril: THREE.MeshStandardNodeMaterial;
  /** 1 fully overgrown, 0 withdrawn. */
  growth: ReturnType<typeof uniform>;
  dispose(): void;
}

export function createVineMaterials(): VineMaterials {
  const growth = uniform(1);
  const alive = () => {
    const along = uv().x;
    const fromEnd = along.min(along.oneMinus()).mul(2);
    return smoothstep(float(0), float(0.2), growth.mul(1.1).sub(fromEnd));
  };

  // Soft tip while growing must not write depth (punches holes in leaves).
  const stem = new THREE.MeshStandardNodeMaterial({
    roughness: 0.98,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  const along = uv().x;
  const around = uv().y;
  const grain = mx_noise_float(positionWorld.mul(vec3(180, 40, 180)));
  // Long bark striations — not a bright circumferential cable highlight.
  const stria = mx_noise_float(along.mul(140).add(around.mul(3)));
  let bark = mix(linear(BARK_DARK), linear(BARK), stria.mul(0.55).add(0.35));
  bark = mix(bark, linear(BARK_MOSS), grain.mul(0.18).add(0.08));
  const limb = around.sub(0.5).abs().mul(2);
  bark = mix(bark.mul(0.92), bark.mul(0.78), limb.pow(1.2));
  stem.colorNode = bark.mul(STEM_GAIN);
  stem.roughnessNode = float(0.96).add(stria.mul(0.03));
  stem.opacityNode = alive();

  const tendril = new THREE.MeshStandardNodeMaterial({
    roughness: 0.97,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  const fine = mx_noise_float(positionWorld.mul(280));
  tendril.colorNode = mix(linear(BARK_DARK), linear(BARK), fine.mul(0.4).add(0.4)).mul(TENDRIL_GAIN);
  tendril.opacityNode = alive().mul(0.72);
  tendril.roughnessNode = float(0.97);

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
 * Shared leaf card material.
 *
 * aLeaf.x colour/dryness, aLeaf.y morph, aLeaf.z value class — all sampled so a
 * clump is a mix of sage and straw rather than one stamp.
 */
export function createLeafMaterial(): LeafMaterial {
  const material = new THREE.MeshStandardNodeMaterial({
    roughness: 0.96,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    alphaTest: 0.4,
  });

  const a = attribute("aLeaf", "vec3") as unknown as Node<"vec3">;
  const seed = a.x;
  const morph = a.y;
  const grade = a.z;
  const u = uv();
  const x = u.x.sub(0.5).mul(2);
  const y = u.y;

  // Asymmetric lean + tip skew from morph seed.
  const lean = morph.sub(0.5).mul(0.22);
  const tipSkew = morph.sub(0.5).mul(0.35);
  const xx = x.sub(lean.mul(y)).sub(tipSkew.mul(y.mul(y)));

  const serr = mx_noise_float(vec2(y.mul(18), morph.mul(7)).add(seed.mul(3)))
    .mul(0.06)
    .add(mx_noise_float(y.mul(42).add(morph.mul(11))).mul(0.03));

  const width = float(0.18)
    .add(smoothstep(float(0), float(0.35), y).mul(0.82))
    .mul(float(1).sub(smoothstep(float(0.55), float(1.02), y).pow(1.35)))
    .add(serr);

  const inside = width.sub(xx.abs());
  material.opacityNode = step(float(0.02), inside);

  const young = mix(linear(LEAF_MID), linear(LEAF_PALE), smoothstep(0.4, 1, seed));
  const body = mix(linear(LEAF_DEEP), young, smoothstep(0, 0.5, seed));
  const dryAmt = smoothstep(0.72, 1, seed).mul(0.55).add(grade.mul(0.45));
  let col = mix(body, linear(LEAF_DRY), dryAmt.mul(0.85));
  col = mix(col, linear(LEAF_BURN), smoothstep(0.92, 1, seed).mul(grade).mul(0.55));

  const rib = smoothstep(float(0.06), float(0), xx.abs());
  col = mix(col, col.mul(0.62), rib.mul(0.55));

  const blotch = mx_noise_float(positionLocal.mul(28).add(seed.mul(9)));
  const grit = mx_noise_float(positionLocal.mul(110).add(morph.mul(13)));
  col = col.mul(blotch.mul(0.16).add(0.92)).mul(grit.mul(0.07).add(0.965));

  const tipDry = smoothstep(float(0.55), float(1), y).mul(dryAmt);
  col = mix(col, linear(LEAF_DRY).mul(1.05), tipDry.mul(0.35));
  col = col.mul(mix(float(0.82), float(1.08), grade));

  material.colorNode = col.mul(FOLIAGE_GAIN);
  material.roughnessNode = float(0.94).add(grit.mul(0.04)).sub(rib.mul(0.06)).add(dryAmt.mul(0.04));

  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}
