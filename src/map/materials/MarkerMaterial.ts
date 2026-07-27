/**
 * POI crest stakes: planted on the plate, not HUD medallions.
 *
 * Three opaque pieces share one atlas cell for the flag face. Soft transparent
 * discs, contact shadows and full-face emissive were the flicker source — this
 * path writes depth, uses binary alpha cuts, and only puts gem energy in
 * emissive when a pin is lit so bloom stays quiet at rest.
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

/** Radii in face local space (−1..1 after the ×2). */
const R_ICON = 0.58;
const R_RIM_IN = 0.78;
const R_RIM_OUT = 0.9;
const R_EDGE = 0.94;

export interface MarkerMaterial {
  material: THREE.NodeMaterial;
  dispose(): void;
}

/** Flag face: atlas icon in a hard stone disc with a thin brass rim. */
export function createMarkerMaterial(atlas: THREE.Texture): MarkerMaterial {
  const material = new THREE.MeshStandardNodeMaterial({
    transparent: true,
    depthWrite: true,
    alphaTest: 0.4,
    side: THREE.FrontSide,
    toneMapped: false,
    roughness: 0.78,
    metalness: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const state = attribute("aState", "vec3") as unknown as Node<"vec3">;
  const local = vec2(positionLocal.x, positionLocal.y).mul(2);
  const r = local.length();

  // Binary disc — soft edges under demand frames crawl against the plate.
  const disc = step(r, float(R_EDGE));
  const inIcon = step(r, float(R_ICON));
  const inRim = step(float(R_RIM_IN), r).mul(step(r, float(R_RIM_OUT)));
  const groove = step(float(0.7), r).mul(step(r, float(R_RIM_IN)));

  const lift = local.y.mul(0.5).add(0.5);
  let colour = mix(linear(STONE_DARK), linear(STONE), lift.mul(0.7).add(0.2));

  const icon = texture(atlas, uv());
  // Struck into the face, not a glowing sticker.
  colour = mix(colour, icon.rgb.mul(0.96), icon.a.mul(inIcon));

  const facing = local.normalize().dot(vec2(-0.62, 0.78).normalize()).mul(0.5).add(0.5);
  const brass = mix(linear(BRASS_DEEP), linear(BRASS), facing.pow(1.3));
  colour = mix(colour, brass, inRim);
  colour = mix(colour, linear(STONE_DARK).mul(0.75), groove.mul(0.55));
  // Site bead in albedo at rest; gem push when lit is emissive-only.
  colour = mix(colour, linear(GEM).mul(0.4), groove.mul(state.x).mul(float(1).sub(state.y)));
  colour = colour.mul(float(1).add(state.y.mul(0.16)));

  material.colorNode = colour;
  material.metalnessNode = inRim.mul(0.7).add(0.06);
  material.roughnessNode = float(0.88).sub(inRim.mul(0.4));

  // Bloom only for lit gem energy — idle stakes write black emissive.
  material.emissiveNode = linear(GEM)
    .mul(inRim.mul(0.25).add(groove.mul(state.x)))
    .mul(state.y.mul(1.4));

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

/**
 * Hard plinth under the stake. Opaque CircleGeometry + polygonOffset, never a
 * soft contact blob (those z-fought the plate every water tick).
 */
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
