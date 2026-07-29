/**
 * Unlit POI faces preserve atlas chroma. Binary alpha and depthWrite prevent
 * demand-loop flicker; gem emissive activates only for lit markers.
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
import { linear, mapClock } from "./shared";

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
    // Low — atlas cells are flattened opaque; high alphaTest was eating icons.
    alphaTest: 0.08,
    side: THREE.FrontSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const state = attribute("aState", "vec3") as unknown as Node<"vec3">;
  const local = vec2(positionLocal.x, positionLocal.y).mul(float(2));
  const r = local.length();

  const disc = step(r, float(R_EDGE));
  const inIcon = step(r, float(R_ICON));
  const inRim = step(float(R_RIM_IN), r).mul(step(r, float(R_RIM_OUT)));
  const underRim = step(float(R_ICON), r).mul(step(r, float(R_RIM_IN)));

  const lift = local.y.mul(float(0.5)).add(float(0.5));
  let colour = mix(linear(STONE_DARK), linear(STONE), lift.mul(float(0.55)).add(float(0.25)));

  const icon = texture(atlas, uv());
  // Always paint atlas RGB inside the icon disc (alpha no longer gates visibility).
  colour = mix(colour, icon.rgb, inIcon);
  colour = mix(colour, linear(STONE_DARK).mul(float(0.85)), underRim);

  const facing = local
    .normalize()
    .dot(vec2(float(-0.62), float(0.78)).normalize())
    .mul(float(0.5))
    .add(float(0.5));
  const brass = mix(linear(BRASS_DEEP), linear(BRASS), facing.pow(float(1.3)));
  colour = mix(colour, brass, inRim);
  // Site pip on the rim only when unlit; lit gem goes through emissive… but
  // Basic has no emissive, so brighten the rim with gem when lit.
  colour = mix(colour, linear(GEM), inRim.mul(state.y.mul(float(1)).add(state.x.mul(float(0.3)))));
  // Lit faces punch harder so small pins still read as selected.
  colour = colour.mul(float(1).add(state.y.mul(float(0.22))));

  material.colorNode = colour;
  material.opacityNode = disc;

  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}

/**
 * Soft light pillar from plate to disc. Additive colour only — no emissive —
 * so bloom stays off the wiki raster. Pulse rides mapClock (no extra invalidate).
 *
 * Instance attribute `aLit` (float): 0 rest brass, 1 gem when hovered/selected.
 */
export function createMarkerBeamMaterial(): MarkerMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const lit = attribute("aLit", "float") as unknown as Node<"float">;
  // Unit cylinder: y −0.5..0.5, radius ~1 at base of our open frustum.
  const y = positionLocal.y.add(float(0.5)); // 0 base → 1 top
  const radial = vec2(positionLocal.x, positionLocal.z).length();
  const core = float(1).sub(smoothstep(float(0.12), float(0.92), radial));
  const vertical = smoothstep(float(0), float(0.1), y).mul(
    float(1).sub(smoothstep(float(0.7), float(1), y)),
  );
  // Stronger pulse so small stakes still read as living glow, not static sticks.
  const pulse = mapClock.mul(float(1.9)).sin().mul(float(0.18)).add(float(0.82));
  const brass = mix(linear(BRASS_DEEP), linear(BRASS), y.mul(float(0.6)).add(float(0.2)));
  const gem = mix(linear(0x1a6b52), linear(GEM), y.mul(float(0.5)).add(float(0.35)));
  material.colorNode = mix(brass, gem, lit).mul(core.mul(pulse));
  // Avoid mix(a, b, lit): when lit folds to a literal, naga emits abstract
  // floats inside a runtime expression and the WebGPU pipeline fails validation.
  // Opacity lifted so glow survives the smaller face/beam scale.
  const opacity = float(0.2).add(lit.mul(float(0.18)));
  material.opacityNode = core.mul(vertical).mul(opacity).mul(pulse);

  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}

/** Soft contact disc under the beam. */
export function createMarkerFootMaterial(): MarkerMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const r = vec2(positionLocal.x, positionLocal.y).mul(float(2)).length();
  const fall = float(1).sub(smoothstep(float(0.12), float(1), r));
  material.colorNode = mix(linear(BRASS_DEEP), linear(BRASS), fall.mul(float(0.55)));
  material.opacityNode = fall.mul(float(0.2));
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
  material.colorNode = vec3(float(0), float(0), float(0));
  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}
