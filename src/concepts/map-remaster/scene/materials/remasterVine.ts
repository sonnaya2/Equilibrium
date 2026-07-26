/**
 * Richer vine materials for remaster seam plants.
 * Stem: organic color + roughness variation via mx_noise.
 * Leaf: tip emissive only, gated by growth uniform (no rest glow).
 * Skin colors: crystal shard, carto rope/olive, raised dark hedge.
 */

import * as THREE from "three/webgpu";
import { float, mix, mx_noise_float, positionWorld, smoothstep, uniform, uv } from "three/tsl";
import type { RemasterSkin } from "../skins";
import { linear } from "./linear";

export type RemasterVineMaterials = {
  stem: THREE.MeshStandardNodeMaterial;
  leaf: THREE.MeshStandardNodeMaterial;
  /** 0..1 average frontier growth — drives tip emissive only when growing */
  growth: ReturnType<typeof uniform>;
  dispose(): void;
};

export function createRemasterVineMaterials(skin: RemasterSkin): RemasterVineMaterials {
  const sh = skin.shade;
  const growth = uniform(1);

  // ---- stem ---------------------------------------------------------------
  const stem = new THREE.MeshStandardNodeMaterial({
    roughness: sh.vineRoughness,
    metalness: sh.vineStemMetal,
  });
  const nStem = mx_noise_float(positionWorld.mul(36));
  const stemDark = linear(skin.vine.stem);
  // Crystal: brighter stem lift toward leaf shard; carto/raised: subtler rope/hedge variance.
  const liftAmt = skin.id === "crystal" ? 0.32 : skin.id === "raised" ? 0.12 : 0.18;
  const stemLift = mix(stemDark, linear(skin.vine.leaf), float(liftAmt));
  stem.colorNode = mix(stemDark, stemLift, nStem.mul(0.35).add(0.5));
  stem.roughnessNode = float(sh.vineRoughness).add(nStem.mul(0.18));

  // ---- leaf ---------------------------------------------------------------
  const leaf = new THREE.MeshStandardNodeMaterial({
    roughness: Math.min(0.9, sh.vineRoughness + 0.06),
    metalness: sh.vineLeafMetal,
    side: THREE.DoubleSide,
  });
  const nLeaf = mx_noise_float(positionWorld.mul(52));
  const leafBase = linear(skin.vine.leaf);
  // Crystal: higher contrast shard facets; raised: flatter dark mass; carto: olive mottling.
  const shadeLo = skin.id === "crystal" ? 0.62 : skin.id === "raised" ? 0.78 : 0.72;
  const shadeHi = skin.id === "crystal" ? 1.14 : skin.id === "raised" ? 1.02 : 1.06;
  const leafShade = mix(leafBase.mul(shadeLo), leafBase.mul(shadeHi), nLeaf.mul(0.5).add(0.5));
  leaf.colorNode = leafShade;

  // Tip of the leaf card (high UV.y) only; strength scales with growth.
  const tipMask = smoothstep(float(0.52), float(0.96), uv().y);
  const tipLive = growth.mul(growth.oneMinus().mul(2.2).add(0.35)).clamp(0, 1);
  leaf.emissiveNode = linear(skin.vine.tip).mul(
    tipMask.mul(tipLive).mul(float(sh.vineTipEmissive)),
  );
  leaf.roughnessNode = float(sh.vineRoughness + 0.05).add(nLeaf.mul(0.12));

  return {
    stem,
    leaf,
    growth,
    dispose() {
      stem.dispose();
      leaf.dispose();
    },
  };
}
