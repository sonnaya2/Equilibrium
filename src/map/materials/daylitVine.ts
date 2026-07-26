/**
 * Daylit Reliquary vines — plant materials, not gem wire.
 * Growth clips along path via uv.x (TubeGeometry along-U) + growth uniform.
 * Clock drives subtle wind noise on stems; leaf cards animate via instance matrices.
 */

import * as THREE from "three/webgpu";
import {
  float,
  mix,
  mx_noise_float,
  positionLocal,
  positionWorld,
  smoothstep,
  uniform,
  uv,
  vec3,
} from "three/tsl";

/** Olive / moss plant palette — not casino mint. */
const BARK = 0x2a2218;
const STEM = 0x3d4a28;
const MOSS = 0x4a6a38;
const LEAF_A = 0x3a5c30;
const LEAF_B = 0x6a8a48;
const TIP = 0xc8e090;

function linear(hex: number) {
  const ch = (shift: number) => Math.pow(((hex >> shift) & 255) / 255, 2.2);
  return vec3(ch(16), ch(8), ch(0));
}

export type DaylitSeamMaterials = {
  stem: THREE.MeshStandardNodeMaterial;
  tendril: THREE.MeshStandardNodeMaterial;
  growth: ReturnType<typeof uniform>;
  clock: ReturnType<typeof uniform>;
  dispose(): void;
};

export type DaylitLeafMaterial = {
  leaf: THREE.MeshStandardNodeMaterial;
  /** Shared leaf-card growth gate (instance scale does per-leaf reveal). */
  growth: ReturnType<typeof uniform>;
  clock: ReturnType<typeof uniform>;
  dispose(): void;
};

/** Full pack kept for callers that want stem+tendril+leaf from one factory. */
export type DaylitVineMaterials = DaylitSeamMaterials & {
  leaf: THREE.MeshStandardNodeMaterial;
};

/** Per-seam stem + tendril (each seam owns growth). */
export function createDaylitSeamMaterials(): DaylitSeamMaterials {
  const growth = uniform(1);
  const clock = uniform(0);

  const stem = new THREE.MeshStandardNodeMaterial({
    roughness: 0.82,
    metalness: 0.02,
    transparent: true,
    depthWrite: true,
  });
  const along = uv().x;
  const fromEnd = along.min(along.oneMinus()).mul(2);
  const alive = smoothstep(float(0), float(0.12), growth.mul(1.18).sub(fromEnd));
  const n = mx_noise_float(positionWorld.mul(28).add(vec3(0, clock.mul(0.15), 0)));
  const bark = mix(linear(BARK), linear(STEM), n.mul(0.5).add(0.45));
  const mossy = mix(bark, linear(MOSS), n.mul(0.35).add(0.2));
  const round = uv().y.sub(0.5).abs().mul(2);
  stem.colorNode = mix(mossy.mul(0.72), mossy.mul(1.08), round);
  stem.roughnessNode = float(0.78).add(n.mul(0.16));
  const tip = alive.mul(alive.oneMinus()).mul(4).clamp(0, 1);
  stem.emissiveNode = linear(TIP).mul(tip.mul(0.22));
  stem.opacityNode = alive.mul(0.96);

  const tendril = new THREE.MeshStandardNodeMaterial({
    roughness: 0.75,
    metalness: 0.02,
    transparent: true,
    depthWrite: false,
  });
  const tAlong = uv().x;
  const tFromEnd = tAlong.min(tAlong.oneMinus()).mul(2);
  const tAlive = smoothstep(float(0), float(0.12), growth.mul(1.18).sub(tFromEnd));
  const tn = mx_noise_float(positionWorld.mul(40));
  tendril.colorNode = mix(linear(STEM), linear(MOSS), tn.mul(0.5).add(0.4));
  tendril.opacityNode = tAlive.mul(0.88);
  tendril.emissiveNode = linear(TIP).mul(
    tAlive.mul(tAlive.oneMinus()).mul(3).clamp(0, 1).mul(0.15),
  );

  return {
    stem,
    tendril,
    growth,
    clock,
    dispose() {
      stem.dispose();
      tendril.dispose();
    },
  };
}

/** One shared leaf material for the instanced leaf mesh. */
export function createDaylitLeafMaterial(): DaylitLeafMaterial {
  const growth = uniform(1);
  const clock = uniform(0);

  const leaf = new THREE.MeshStandardNodeMaterial({
    roughness: 0.72,
    metalness: 0.01,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const u = uv();
  const vein = u.x.sub(0.5).abs().mul(2);
  const leafBody = mix(linear(LEAF_B), linear(LEAF_A), vein.mul(0.65).add(u.y.mul(0.35)));
  const fleck = mx_noise_float(positionLocal.mul(18));
  leaf.colorNode = leafBody.mul(fleck.mul(0.12).add(0.94));
  const leafTip = smoothstep(float(0.55), float(0.98), u.y);
  const growPulse = growth.mul(growth.oneMinus().mul(2).add(0.25)).clamp(0, 1);
  leaf.emissiveNode = linear(TIP).mul(leafTip.mul(growPulse).mul(0.18));
  const edge = smoothstep(float(0.02), float(0.2), float(1).sub(vein.mul(0.55).add(u.y.mul(0.2))));
  leaf.opacityNode = edge.mul(growth.mul(0.55).add(0.45)).mul(0.95);
  leaf.roughnessNode = float(0.68).add(fleck.mul(0.14));

  return {
    leaf,
    growth,
    clock,
    dispose() {
      leaf.dispose();
    },
  };
}

/** Convenience: seam pack + leaf (not used by production SeamVines). */
export function createDaylitVineMaterials(): DaylitVineMaterials {
  const seam = createDaylitSeamMaterials();
  const leafPack = createDaylitLeafMaterial();
  return {
    stem: seam.stem,
    tendril: seam.tendril,
    leaf: leafPack.leaf,
    growth: seam.growth,
    clock: seam.clock,
    dispose() {
      seam.dispose();
      leafPack.dispose();
    },
  };
}
