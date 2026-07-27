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
  positionWorld,
  smoothstep,
  step,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { linear } from "./shared";

/** Unlit leaf gain — Basic has no π-divide, keep near 1 so sage stays map-like. */
const FOLIAGE_GAIN = 1.12;
const STEM_GAIN = 1.08;
const TENDRIL_GAIN = 1.0;

const BARK_DARK = 0x16120e;
const BARK = 0x2a2218;
const BARK_MOSS = 0x2e3622;

// Slightly lifted sage so the hedge separates from the wiki print under unlit Basic.
const LEAF_DEEP = 0x354a28;
const LEAF_MID = 0x4e6334;
const LEAF_PALE = 0x6e7444;
const LEAF_DRY = 0x746034;
const LEAF_BURN = 0x5a4426;

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
    const fromEnd = along.min(along.oneMinus()).mul(float(2));
    return smoothstep(float(0), float(0.2), growth.mul(float(1.1)).sub(fromEnd));
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
  const grain = mx_noise_float(positionWorld.mul(vec3(float(180), float(40), float(180))));
  // Long bark striations — not a bright circumferential cable highlight.
  const stria = mx_noise_float(along.mul(float(140)).add(around.mul(float(3))));
  let bark = mix(
    linear(BARK_DARK),
    linear(BARK),
    stria.mul(float(0.55)).add(float(0.35)),
  );
  bark = mix(bark, linear(BARK_MOSS), grain.mul(float(0.18)).add(float(0.08)));
  const limb = around.sub(float(0.5)).abs().mul(float(2));
  bark = mix(bark.mul(float(0.92)), bark.mul(float(0.78)), limb.pow(float(1.2)));
  stem.colorNode = bark.mul(float(STEM_GAIN));
  stem.roughnessNode = float(0.96).add(stria.mul(float(0.03)));
  stem.opacityNode = alive();

  const tendril = new THREE.MeshStandardNodeMaterial({
    roughness: 0.97,
    metalness: 0,
    transparent: true,
    depthWrite: false,
  });
  // Bare positionWorld.mul(N) → abstract scale in some naga builds; wrap.
  const fine = mx_noise_float(positionWorld.mul(float(280)));
  tendril.colorNode = mix(
    linear(BARK_DARK),
    linear(BARK),
    fine.mul(float(0.4)).add(float(0.4)),
  ).mul(float(TENDRIL_GAIN));
  tendril.opacityNode = alive().mul(float(0.72));
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
  material: THREE.MeshBasicNodeMaterial;
  dispose(): void;
}

/**
 * Shared leaf card material.
 *
 * aLeaf.x colour/dryness, aLeaf.y morph, aLeaf.z value class — all sampled so a
 * clump is a mix of sage and straw rather than one stamp.
 */
export function createLeafMaterial(): LeafMaterial {
  // Unlit Basic — Standard on flat cards under the desk lamp went near-black and
  // read as "no vines". Authored sage/ochre must stay at map chroma.
  // depthTest false temporarily avoided: cards must still occlude correctly under
  // camera pitch; polygonOffset + clearance keep them above the plate instead.
  const material = new THREE.MeshBasicNodeMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    alphaTest: 0.35,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  // aLeaf must exist on the InstancedMesh geometry before first compile (see
  // BorderVines bind) — missing attrs fold to abstract 0 and kill the pipeline.
  const a = attribute("aLeaf", "vec3") as unknown as Node<"vec3">;
  const seed = a.x;
  const morph = a.y;
  const grade = a.z;
  const u = uv();
  const x = u.x.sub(float(0.5)).mul(float(2));
  const y = u.y;

  // Asymmetric lean + tip skew from morph seed.
  const lean = morph.sub(float(0.5)).mul(float(0.22));
  const tipSkew = morph.sub(float(0.5)).mul(float(0.35));
  const xx = x.sub(lean.mul(y)).sub(tipSkew.mul(y.mul(y)));

  // Leaf silhouette: width envelope only (no mx_noise) — noise paths have been
  // a naga rejection source; variation comes from aLeaf + morph lean.
  const taper = float(1).sub(smoothstep(float(0.55), float(1.02), y).pow(float(1.35)));
  const width = float(0.22)
    .add(smoothstep(float(0), float(0.32), y).mul(float(0.78)))
    .mul(taper)
    .mul(float(1).add(morph.sub(float(0.5)).mul(float(0.18))));

  const inside = width.sub(xx.abs());
  material.opacityNode = step(float(0.02), inside);

  // All smoothstep edges must be float() nodes — bare JS numbers become abstract
  // floats in WGSL and naga rejects them when the third arg is a varying.
  const young = mix(linear(LEAF_MID), linear(LEAF_PALE), smoothstep(float(0.4), float(1), seed));
  const body = mix(linear(LEAF_DEEP), young, smoothstep(float(0), float(0.5), seed));
  const dryAmt = smoothstep(float(0.72), float(1), seed)
    .mul(float(0.55))
    .add(grade.mul(float(0.45)));
  let col = mix(body, linear(LEAF_DRY), dryAmt.mul(float(0.85)));
  col = mix(
    col,
    linear(LEAF_BURN),
    smoothstep(float(0.92), float(1), seed).mul(grade).mul(float(0.55)),
  );

  const rib = smoothstep(float(0.08), float(0), xx.abs());
  col = mix(col, col.mul(float(0.72)), rib.mul(float(0.4)));
  const tipDry = smoothstep(float(0.55), float(1), y).mul(dryAmt);
  col = mix(col, linear(LEAF_DRY).mul(float(1.06)), tipDry.mul(float(0.3)));
  col = col.mul(mix(float(0.9), float(1.14), grade));

  material.colorNode = col.mul(float(FOLIAGE_GAIN));

  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}
