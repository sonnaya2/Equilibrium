/**
 * Cap + wall MeshStandardNodeMaterial factory for remaster skins.
 * TSL only — no GLSL ShaderMaterial. Focus glow is rim-weighted (never mint-wash).
 * Skin branches via RemasterShade (crystal warm/cool, carto ink coast, raised stage).
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
  EMBER_400,
  GEM_400,
  TERRAIN_WALL_DEEP,
  TERRAIN_WALL_ROCK,
  TERRAIN_WALL_SUBSOIL,
  TERRAIN_WALL_TOPSOIL,
} from "@/map/palette";
import type { RemasterSkin } from "../skins";
import { linear } from "./linear";

/** Production albedo gain so lit PBR returns roughly the authored tile value. */
const ALBEDO_GAIN = 1.95;

export type RemasterCapMaterials = {
  cap: THREE.MeshStandardNodeMaterial;
  wall: THREE.MeshStandardNodeMaterial;
  lock: ReturnType<typeof uniform>;
  dim: ReturnType<typeof uniform>;
  focusU: ReturnType<typeof uniform>;
  dispose(): void;
};

/**
 * Build cap + wall materials for one slab under the active remaster skin.
 * `isUnlocked` seeds the lock uniform; callers update lock/dim/focusU each focus change.
 */
export function createRemasterCapMaterial(
  terrain: THREE.Texture,
  skin: RemasterSkin,
  depth: number,
  isUnlocked: boolean,
): RemasterCapMaterials {
  const sh = skin.shade;
  const lock = uniform(isUnlocked ? 0 : 1);
  const dim = uniform(0);
  const focusU = uniform(0);
  const exposure = uniform(skin.exposure);
  const drainAmt = uniform(skin.lockDrain);
  const dimAmt = uniform(skin.dimAmount);
  const focusEm = uniform(skin.focusEmissive);

  const drain = lock.mul(drainAmt).add(dim.mul(dimAmt.mul(0.85))).min(float(0.88));
  const shade = float(1).sub(dim.mul(dimAmt));

  // Thin gem scatter at rim only when focused — high focusRimPow = thinner edge.
  const gem = linear(GEM_400);
  const rim = normalView
    .dot(positionViewDirection)
    .clamp(0, 1)
    .oneMinus()
    .pow(sh.focusRimPow);
  const glow = gem.mul(rim.mul(focusU).mul(focusEm));

  // ---- cap ----------------------------------------------------------------
  const cap = new THREE.MeshStandardNodeMaterial({ roughness: sh.capRoughness });
  const tile = texture(terrain).rgb.mul(float(ALBEDO_GAIN)).mul(exposure).mul(float(sh.albedoBoost));
  const tileLum = tile.x.mul(0.2126).add(tile.y.mul(0.7152)).add(tile.z.mul(0.0722));

  // Soft value contrast (boardsky grade) without re-baking BOARD_MEAN twice.
  const graded = mix(
    tile,
    tile
      .sub(vec3(tileLum, tileLum, tileLum))
      .mul(float(1).add(float(sh.gradeMix).mul(0.28)))
      .add(vec3(tileLum, tileLum, tileLum)),
    float(sh.gradeMix > 0 ? 1 : 0),
  );

  // Parchment luminance pull (cartographer ~12–22%).
  const parchment = mix(
    graded,
    vec3(tileLum.mul(1.1), tileLum.mul(1.02), tileLum.mul(0.9)),
    float(sh.parchmentMix),
  );

  // Dual-tone lattice (boardsky): cheap crossed noise, not fractal.
  const latA = mx_noise_float(positionWorld.mul(22));
  const latB = mx_noise_float(positionWorld.mul(vec3(0, 1, 0)).add(positionWorld.zxy.mul(17)));
  const lattice = latA.mul(0.55).add(latB.mul(0.45));
  const dual = mix(parchment, parchment.mul(vec3(1.05, 1.0, 0.94)), lattice.mul(float(sh.dualTone)));

  // Micro grain on caps — soft film grain, not rock noise.
  const grain = mx_noise_float(positionWorld.mul(48)).mul(float(sh.microDetail));
  let base = dual.mul(float(1).add(grain));

  // Crystal: unlocked sun-warmed stone; locked cooler dusk desat.
  if (sh.warmUnlocked > 0.001) {
    const warm = vec3(base.x.mul(1.08), base.y.mul(1.02), base.z.mul(0.9));
    base = mix(base, warm, float(sh.warmUnlocked).mul(float(1).sub(lock)));
  }
  if (sh.coolLock > 0.001) {
    const cool = vec3(tileLum.mul(0.86), tileLum.mul(0.92), tileLum.mul(1.08));
    base = mix(base, cool, lock.mul(float(sh.coolLock)));
  }

  // Raised stage: subject exposure pop under low ambient fill.
  if (sh.subjectBoost > 0.001) {
    base = base.mul(float(1).add(focusU.mul(float(sh.subjectBoost))));
  }

  // Fake top-light: local up + slight +x key (noon from upper-left).
  if (sh.topLight > 0.001) {
    const nl = normalLocal.y
      .mul(0.7)
      .add(normalLocal.x.mul(0.22))
      .add(float(0.18))
      .clamp(0, 1);
    const warm = vec3(1.0, 0.92, 0.78);
    const cool = vec3(1.0, 1.0, 1.0);
    const lightTint = mix(cool, warm, float(sh.topLightWarm));
    base = base.mul(float(1).add(nl.mul(float(sh.topLight)).mul(lightTint.x))).add(
      lightTint.mul(nl.mul(float(sh.topLight)).mul(0.04)),
    );
  }

  const baseLum = base.x.mul(0.2126).add(base.y.mul(0.7152)).add(base.z.mul(0.0722));
  cap.colorNode = mix(base, vec3(baseLum, baseLum, baseLum), drain).mul(shade);
  cap.emissiveNode = glow;
  // Cartographer paper: slightly lower roughness so ambient fill reads (ink coast lives on walls).
  if (sh.parchmentMix > 0.05) {
    cap.roughnessNode = float(sh.capRoughness).sub(rim.mul(0.1));
  }

  // ---- wall ---------------------------------------------------------------
  const wall = new THREE.MeshStandardNodeMaterial({ roughness: sh.wallRoughness });
  const jitter = mx_noise_float(positionWorld.mul(14)).mul(float(sh.strataJitter));
  const band = positionLocal.y.div(float(depth)).add(jitter);

  // Contrast: darken deep, lift topsoil so cut earth reads on tall plinths (raised).
  const c = float(sh.strataContrast);
  const deep = linear(TERRAIN_WALL_DEEP).mul(float(1).sub(c.mul(0.22)));
  const rockCol = linear(TERRAIN_WALL_ROCK);
  const subCol = linear(TERRAIN_WALL_SUBSOIL);
  const warmTop = mix(linear(TERRAIN_WALL_TOPSOIL), linear(0xa8885a), float(sh.wallWarmth));
  const topCol = warmTop.mul(float(1).add(c.mul(0.18)));

  const rock = mix(deep, rockCol, step(float(0.24), band));
  const subsoil = mix(rock, subCol, step(float(0.55), band));
  const strata = mix(subsoil, topCol, step(float(0.8), band));

  // Ink coast: darken wall faces at grazing angles (cartographer chart outline).
  const ink = float(1).sub(rim.mul(float(sh.coastDarken)));
  const wallCol = strata.mul(ink);
  const strataLum = wallCol.x.mul(0.2126).add(wallCol.y.mul(0.7152)).add(wallCol.z.mul(0.0722));
  wall.colorNode = mix(wallCol, vec3(strataLum, strataLum, strataLum), drain)
    .mul(shade)
    .mul(exposure);
  wall.emissiveNode = linear(EMBER_400).mul(focusU.mul(0.08));

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

/** Alias for call sites that prefer "slab materials" naming. */
export const createRemasterSlabMaterials = createRemasterCapMaterial;
