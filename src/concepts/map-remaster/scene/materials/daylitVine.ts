/**
 * Daylit Reliquary vines — plant materials, not gem wire.
 * Growth clips along path via uv.x (TubeGeometry along-U) + growth uniform.
 * Clock drives subtle wind on leaf cards (instance matrices) and stem roughness pulse.
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
import { linear } from "./linear";

/** Olive / moss plant palette — not casino mint. */
const BARK = 0x2a2218;
const STEM = 0x3d4a28;
const MOSS = 0x4a6a38;
const LEAF_A = 0x3a5c30;
const LEAF_B = 0x6a8a48;
const TIP = 0xc8e090;

export type DaylitVineMaterials = {
  stem: THREE.MeshStandardNodeMaterial;
  tendril: THREE.MeshStandardNodeMaterial;
  leaf: THREE.MeshStandardNodeMaterial;
  /** 0..1 path growth for this seam mesh */
  growth: ReturnType<typeof uniform>;
  /** Seconds — wind phase */
  clock: ReturnType<typeof uniform>;
  dispose(): void;
};

export function createDaylitVineMaterials(): DaylitVineMaterials {
  const growth = uniform(1);
  const clock = uniform(0);

  // ---- stem (primary) -----------------------------------------------------
  const stem = new THREE.MeshStandardNodeMaterial({
    roughness: 0.82,
    metalness: 0.02,
    transparent: true,
    depthWrite: true,
  });
  // TubeGeometry uv.x runs 0..1 along the path. Growth creeps ends → middle.
  const along = uv().x;
  const fromEnd = along.min(along.oneMinus()).mul(2);
  const alive = smoothstep(float(0), float(0.12), growth.mul(1.18).sub(fromEnd));
  const n = mx_noise_float(positionWorld.mul(28).add(vec3(0, clock.mul(0.15), 0)));
  const bark = mix(linear(BARK), linear(STEM), n.mul(0.5).add(0.45));
  const mossy = mix(bark, linear(MOSS), n.mul(0.35).add(0.2));
  // Roundness: darker core (uv.y near 0.5), lighter edges.
  const round = uv().y.sub(0.5).abs().mul(2);
  stem.colorNode = mix(mossy.mul(0.72), mossy.mul(1.08), round);
  stem.roughnessNode = float(0.78).add(n.mul(0.16));
  // Tip glow only while expanding through this segment.
  const tip = alive.mul(alive.oneMinus()).mul(4).clamp(0, 1);
  stem.emissiveNode = linear(TIP).mul(tip.mul(0.22));
  stem.opacityNode = alive.mul(0.96);

  // ---- tendril (thinner secondary) ----------------------------------------
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

  // ---- leaf ---------------------------------------------------------------
  const leaf = new THREE.MeshStandardNodeMaterial({
    roughness: 0.72,
    metalness: 0.01,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  // Leaf card UV: center vein dark, tip lighter. Growth gates whole card.
  const u = uv();
  const vein = u.x.sub(0.5).abs().mul(2);
  const leafBody = mix(linear(LEAF_B), linear(LEAF_A), vein.mul(0.65).add(u.y.mul(0.35)));
  const fleck = mx_noise_float(positionLocal.mul(18));
  leaf.colorNode = leafBody.mul(fleck.mul(0.12).add(0.94));
  // Tip highlight at high V while growing.
  const leafTip = smoothstep(float(0.55), float(0.98), u.y);
  const growPulse = growth.mul(growth.oneMinus().mul(2).add(0.25)).clamp(0, 1);
  leaf.emissiveNode = linear(TIP).mul(leafTip.mul(growPulse).mul(0.18));
  // Soft leaf edge alpha (ellipse-ish via radial from center-bottom).
  const edge = smoothstep(float(0.02), float(0.2), float(1).sub(vein.mul(0.55).add(u.y.mul(0.2))));
  leaf.opacityNode = edge.mul(growth.mul(0.55).add(0.45)).mul(0.95);
  leaf.roughnessNode = float(0.68).add(fleck.mul(0.14));

  return {
    stem,
    tendril,
    leaf,
    growth,
    clock,
    dispose() {
      stem.dispose();
      tendril.dispose();
      leaf.dispose();
    },
  };
}
