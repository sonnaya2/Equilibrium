/**
 * The sea the board floats on.
 *
 * Stylised and cartographic, not an engine demo: the swell is a few tiles high,
 * the palette stays in the Wiki map's own blue-grey, and almost all of the life
 * comes from light moving across the surface rather than from geometry. If the
 * water ever competes with the map for attention it is wrong.
 *
 * Unlit on purpose. Swell, normal, fresnel, sky term, glint and shore all come
 * out of the same handful of waves, so the result is exactly as stylised as
 * intended and there is no lighting model to argue with. The key direction is
 * passed in so the water still agrees with the rest of the scene.
 *
 * Three crossed waves, not fractal noise: this plane covers most of the viewport
 * once the camera descends, so its fragment cost is paid on nearly every pixel
 * at whatever dpr the display has. Only the long pair displace the mesh; the
 * short detail lives in the normal, which is what keeps the plane at a hundred
 * segments instead of a thousand.
 */

import * as THREE from "three/webgpu";
import {
  cameraPosition,
  float,
  mix,
  mx_noise_float,
  positionLocal,
  positionWorld,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { linear, mapClock, mapUvFrom } from "./shared";

const DEEP = 0x24506e;
const SHALLOW = 0x4a7fa0;
const SKY = 0x7ea8c6;
const FOAM = 0xb8ccd8;
/** Outer void — a touch darker than shallow so the board sits in a continuous
 *  field without turning the whole viewport into a black pit. */
export const OCEAN_HORIZON = 0x1e354c;

/**
 * World units of swell — a couple of game tiles, and deliberately less than
 * plateHeight's REST_CLEARANCE so a crest never washes over a coastline.
 */
/** Peak crest; must stay under REST_CLEARANCE − LOCKED_DROP (~0.0075). */
export const SWELL = 0.004;
/**
 * The shading normal is steeper than the mesh. A surface displaced by two tiles
 * over a two-unit board is flat to within a degree, and a flat mirror turns the
 * sun into one enormous soft blob across half the sea instead of a scatter of
 * points. Shading it as if the ripples were deeper is what breaks that blob up.
 */
const NORMAL_RELIEF = 0.026;

type FloatNode = Node<"float">;

/** The long waves the mesh actually follows. */
function longSwell(x: FloatNode, z: FloatNode): FloatNode {
  // Slightly quicker than a still pond — cartographic life, not storm sea.
  const a = x.mul(5.1).add(z.mul(2.6)).add(mapClock.mul(0.88)).sin();
  const b = z.mul(6.4).sub(x.mul(3.1)).sub(mapClock.mul(0.64)).sin();
  const c = x.mul(3.2).add(z.mul(4.1)).add(mapClock.mul(0.46)).sin();
  return a.mul(0.48).add(b.mul(0.34)).add(c.mul(0.18));
}

/** Long swell plus short waves that only show up in the normal. */
function surfaceHeight(x: FloatNode, z: FloatNode): FloatNode {
  return longSwell(x, z)
    .mul(0.62)
    .add(x.mul(23).add(z.mul(17)).add(mapClock.mul(1.55)).sin().mul(0.24))
    .add(z.mul(31).sub(x.mul(12)).sub(mapClock.mul(1.08)).sin().mul(0.14));
}

export interface WaterMaterial {
  material: THREE.MeshBasicNodeMaterial;
  dispose(): void;
}

export function createWaterMaterial(
  field: THREE.Texture,
  keyDirection: THREE.Vector3,
): WaterMaterial {
  // Unlit + toneMapped false: the sea is authored colour, not a lit surface,
  // and must not pick up any future filmic curve the land opts into.
  const material = new THREE.MeshBasicNodeMaterial({ toneMapped: false });
  const key = uniform(keyDirection.clone().normalize());

  // The plane is authored flat and rotated -90 about x, so world (x, y, z) is
  // local (x, -z, y): the swell displaces local z, and world XZ at vertex time
  // has to be read off local x / -local y rather than from positionWorld, which
  // is the very thing being computed here.
  const px = positionWorld.x;
  const pz = positionWorld.z;
  // Distance from board centre — far sea calms so the bottom of the frame
  // does not show stretched swell / specular god-rays under islands.
  const far = smoothstep(float(0.9), float(2.2), vec2(px, pz).length());
  const nearSea = float(1).sub(far);
  // Squared falloff kills far stretch + plate-bottom specular shafts (clipboard).
  const nearSea2 = nearSea.mul(nearSea);

  const vx = positionLocal.x;
  const vz = positionLocal.y.negate();
  const swellAmp = float(SWELL).mul(nearSea.mul(0.85).add(0.15));
  material.positionNode = positionLocal.add(vec3(float(0), float(0), longSwell(vx, vz).mul(swellAmp)));

  const warp = mx_noise_float(vec3(px.mul(7.5), pz.mul(7.5), mapClock.mul(0.09))).mul(0.06).mul(nearSea2);
  const wx = px.add(warp);
  const wz = pz.sub(warp.mul(0.8));

  const height = surfaceHeight(wx, wz);
  const e = float(0.004);
  const slopeX = surfaceHeight(wx.add(e), wz).sub(surfaceHeight(wx.sub(e), wz)).div(e.mul(2));
  const slopeZ = surfaceHeight(wx, wz.add(e)).sub(surfaceHeight(wx, wz.sub(e))).div(e.mul(2));
  const normalRelief = float(NORMAL_RELIEF).mul(nearSea2.mul(0.7).add(0.3));
  const normal = vec3(
    slopeX.mul(normalRelief).negate(),
    float(1),
    slopeZ.mul(normalRelief).negate(),
  ).normalize();

  const view = cameraPosition.sub(positionWorld).normalize();
  const fresnel = normal.dot(view).clamp(float(0), float(1)).oneMinus().pow(float(4.2));

  const F = texture(field, mapUvFrom(positionWorld));
  const offshore = smoothstep(float(0.5), float(0.455), F.g);

  // Height tint keeps troughs readable without relying on specular wash.
  let water = mix(linear(SHALLOW), linear(DEEP), offshore.mul(0.85).add(height.mul(0.1).mul(nearSea)));
  water = water.mul(mix(float(0.78), float(1), offshore));
  // Quiet sky rim — grazing fresnel under plate rims was reading as soft white shafts.
  water = mix(water, linear(SKY), fresnel.mul(0.055).mul(nearSea2));

  const reflected = normal.mul(normal.dot(key).mul(2)).sub(key);
  const toward = reflected.dot(view).clamp(float(0), float(1));
  // nearSea² × offshore gates far stretch + under-land UV. Residual coastal shafts
  // were the remaining path: high scale + non-zero nadir floor on glint. Tighter
  // lobe, lower weight, fresnel-led (tiny floor) keeps cartographic sparkle without
  // vertical white beams at island edges.
  const glint = toward.pow(float(96)).mul(fresnel.mul(0.82).add(0.015)).mul(0.11).mul(nearSea2).mul(offshore);
  const sheen = toward.pow(float(22)).mul(0.004).mul(nearSea2).mul(offshore);

  const crest = smoothstep(float(0.78), float(0.96), height.abs()).mul(0.1).mul(nearSea2).mul(offshore);
  const surf = smoothstep(float(0.5), float(0.487), F.g)
    .mul(smoothstep(float(0.45), float(0.5), F.g))
    .mul(height.mul(0.35).add(0.65))
    .mul(0.25);
  // clamp edges as float() — bare 0 / 0.4 are abstract and fail WebGPU validation.
  water = mix(water, linear(FOAM), crest.add(surf).clamp(float(0), float(0.4)));

  const horizon = smoothstep(float(1.15), float(2.15), vec2(px, pz).length());
  material.colorNode = mix(
    water.add(linear(0xfff0d2).mul(glint.add(sheen))),
    linear(OCEAN_HORIZON),
    horizon,
  );

  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}
