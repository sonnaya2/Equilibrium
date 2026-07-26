/**
 * Daylit Reliquary slab materials — noon-readable terrain, warm rim focus, carved walls.
 * Height-derived normal from terrain luminance so furrows catch the key light.
 */

import * as THREE from "three/webgpu";
import {
  float,
  mix,
  mx_noise_float,
  normalLocal,
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
  TERRAIN_WALL_DEEP,
  TERRAIN_WALL_ROCK,
  TERRAIN_WALL_SUBSOIL,
  TERRAIN_WALL_TOPSOIL,
} from "@/map/palette";
import { linear } from "./linear";

const ALBEDO_GAIN = 2.05;

export type DaylitCapMaterials = {
  cap: THREE.MeshStandardNodeMaterial;
  wall: THREE.MeshStandardNodeMaterial;
  lock: ReturnType<typeof uniform>;
  dim: ReturnType<typeof uniform>;
  focusU: ReturnType<typeof uniform>;
  dispose(): void;
};

export function createDaylitCapMaterial(
  terrain: THREE.Texture,
  depth: number,
  isUnlocked: boolean,
): DaylitCapMaterials {
  const lock = uniform(isUnlocked ? 0 : 1);
  const dim = uniform(0);
  const focusU = uniform(0);

  const drain = lock.mul(0.48).add(dim.mul(0.32)).min(float(0.78));
  const shade = float(1).sub(dim.mul(0.36));

  // Warm cream rim (not mint wash). Thin edge only.
  const warmRim = linear(0xf0d8a0);
  const gemEdge = linear(0x57e0ae);
  const rim = normalView.dot(positionViewDirection).clamp(0, 1).oneMinus().pow(2.8);
  const glow = warmRim
    .mul(rim.mul(focusU).mul(1.35))
    .add(gemEdge.mul(rim.mul(focusU).mul(0.55)));

  // ---- cap ----------------------------------------------------------------
  const cap = new THREE.MeshStandardNodeMaterial({ roughness: 0.86 });
  const tex = texture(terrain);
  const tile = tex.rgb.mul(float(ALBEDO_GAIN));
  const lum = tile.x.mul(0.2126).add(tile.y.mul(0.7152)).add(tile.z.mul(0.0722));

  // Midtone lift so noon key doesn't crush 512px tiles into mud.
  const lifted = tile.mul(1.06).add(vec3(0.02, 0.018, 0.012));

  // Micro grain + slight value separation.
  const grain = mx_noise_float(positionWorld.mul(42)).mul(0.028);
  let base = lifted.mul(float(1).add(grain));

  // Fake height normal: push lighting with luminance as relief.
  // normalLocal.y is already mostly up on the cap; blend in a soft "bump" via color only
  // (true normal map would need dFdx — not available cleanly on all WebGPU paths).
  const relief = lum.sub(0.42).mul(0.22);
  base = base.mul(float(1).add(relief));

  // Noon top-light: local up + slight key from +x.
  const nl = normalLocal.y.mul(0.72).add(normalLocal.x.mul(0.18)).add(float(0.14)).clamp(0, 1);
  base = base.mul(float(1).add(nl.mul(0.14))).add(linear(0xffe8c4).mul(nl.mul(0.035)));

  // Focus subject: subtle warm pop, not full wash.
  base = base.mul(float(1).add(focusU.mul(0.08)));

  const baseLum = base.x.mul(0.2126).add(base.y.mul(0.7152)).add(base.z.mul(0.0722));
  cap.colorNode = mix(base, vec3(baseLum, baseLum, baseLum), drain).mul(shade);
  cap.emissiveNode = glow;
  cap.roughnessNode = float(0.84).sub(lum.mul(0.08)).add(grain.mul(0.1));

  // ---- wall ---------------------------------------------------------------
  const wall = new THREE.MeshStandardNodeMaterial({ roughness: 0.93 });
  const jitter = mx_noise_float(positionWorld.mul(16)).mul(0.05);
  const band = positionLocal.y.div(float(depth)).add(jitter);
  const deep = linear(TERRAIN_WALL_DEEP).mul(0.92);
  const rock = mix(deep, linear(TERRAIN_WALL_ROCK), step(float(0.22), band));
  const sub = mix(rock, linear(TERRAIN_WALL_SUBSOIL), step(float(0.52), band));
  const top = mix(sub, linear(0x9a7a4a), step(float(0.78), band));
  // Warm the topsoil band under noon.
  const strata = mix(top, linear(TERRAIN_WALL_TOPSOIL), step(float(0.88), band));
  const strataLum = strata.x.mul(0.2126).add(strata.y.mul(0.7152)).add(strata.z.mul(0.0722));
  wall.colorNode = mix(strata, vec3(strataLum, strataLum, strataLum), drain)
    .mul(shade)
    .mul(float(1.08));
  wall.emissiveNode = warmRim.mul(focusU.mul(rim.mul(0.12)));
  wall.roughnessNode = float(0.9).add(jitter.mul(2));

  return {
    cap,
    wall,
    lock,
    dim,
    focusU,
    dispose() {
      cap.dispose();
      wall.dispose();
    },
  };
}
