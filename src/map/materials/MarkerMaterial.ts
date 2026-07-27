/**
 * POI crest stakes: planted on the plate, not HUD medallions.
 *
 * Face is unlit MeshBasic so atlas icons keep full chroma (Standard ÷π muddied
 * them). Icon-first disc with a thin brass rim; binary alpha + depthWrite so
 * they do not flicker under the demand loop. Gem emissive only when lit.
 *
 * `aState` on the face geometry:
 *   x  1 when this is a site rather than a named area
 *   y  0..1 lit — hovered or selected
 */

import * as THREE from "three/webgpu";
import {
  attribute,
  float,
  mix,
  positionLocal,
  smoothstep,
  step,
  texture,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { linear } from "./shared";

const STONE_DARK = 0x14120e;
const STONE = 0x2b251b;
const BRASS = 0xc7a163;
const BRASS_DEEP = 0x7d5f2c;
const GEM = 0x57e0ae;

/** Icon-first radii in face local space (−1..1 after ×2). */
const R_ICON = 0.86;
const R_RIM_IN = 0.88;
const R_RIM_OUT = 0.95;
const R_EDGE = 0.98;

export interface MarkerMaterial {
  material: THREE.NodeMaterial;
  dispose(): void;
}

/** Flag face: atlas icon owns the disc; thin brass rim only. */
export function createMarkerMaterial(atlas: THREE.Texture): MarkerMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: true,
    alphaTest: 0.45,
    side: THREE.FrontSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const state = attribute("aState", "vec3") as unknown as Node<"vec3">;
  const local = vec2(positionLocal.x, positionLocal.y).mul(2);
  const r = local.length();

  const disc = step(r, float(R_EDGE));
  const inIcon = step(r, float(R_ICON));
  const inRim = step(float(R_RIM_IN), r).mul(step(r, float(R_RIM_OUT)));
  const underRim = step(float(R_ICON), r).mul(step(r, float(R_RIM_IN)));

  const lift = local.y.mul(0.5).add(0.5);
  let colour = mix(linear(STONE_DARK), linear(STONE), lift.mul(0.55).add(0.25));

  const icon = texture(atlas, uv());
  // Full chroma — no 0.96 crush, no Standard lighting wash.
  colour = mix(colour, icon.rgb, icon.a.mul(inIcon));
  colour = mix(colour, linear(STONE_DARK).mul(0.85), underRim);

  const facing = local.normalize().dot(vec2(-0.62, 0.78).normalize()).mul(0.5).add(0.5);
  const brass = mix(linear(BRASS_DEEP), linear(BRASS), facing.pow(1.3));
  colour = mix(colour, brass, inRim);
  // Site pip on the rim only when unlit; lit gem goes through emissive… but
  // Basic has no emissive, so brighten the rim with gem when lit.
  colour = mix(colour, linear(GEM), inRim.mul(state.y.mul(0.85).add(state.x.mul(0.25))));
  colour = colour.mul(float(1).add(state.y.mul(0.12)));

  material.colorNode = colour;
  material.opacityNode = disc;

  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}

/** Short brass/stone shaft — fully opaque. */
export function createMarkerStemMaterial(): MarkerMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: false,
    depthWrite: true,
    toneMapped: false,
  });
  material.colorNode = mix(
    linear(BRASS_DEEP),
    linear(STONE_DARK),
    positionLocal.y.mul(0.5).add(0.5),
  );
  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}

/** Hard plinth under the stake. */
export function createMarkerFootMaterial(): MarkerMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: false,
    depthWrite: true,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const r = vec2(positionLocal.x, positionLocal.y).mul(2).length();
  const rim = smoothstep(float(0.72), float(0.88), r).mul(smoothstep(float(1.02), float(0.9), r));
  material.colorNode = mix(linear(STONE_DARK), linear(BRASS_DEEP), rim.mul(0.65));
  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}

/** Invisible hit proxy — wider than the painted face, never drawn. */
export function createMarkerHitMaterial(): MarkerMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  material.colorNode = vec3(0, 0, 0);
  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}
