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
  // float() on every scalar so WGSL never sees abstract floats in the swell graph.
  const a = x.mul(float(5.1)).add(z.mul(float(2.6))).add(mapClock.mul(float(0.88))).sin();
  const b = z.mul(float(6.4)).sub(x.mul(float(3.1))).sub(mapClock.mul(float(0.64))).sin();
  const c = x.mul(float(3.2)).add(z.mul(float(4.1))).add(mapClock.mul(float(0.46))).sin();
  return a.mul(float(0.48)).add(b.mul(float(0.34))).add(c.mul(float(0.18)));
}

/** Long swell plus short waves that only show up in the normal. */
function surfaceHeight(x: FloatNode, z: FloatNode): FloatNode {
  return longSwell(x, z)
    .mul(float(0.62))
    .add(
      x
        .mul(float(23))
        .add(z.mul(float(17)))
        .add(mapClock.mul(float(1.55)))
        .sin()
        .mul(float(0.24)),
    )
    .add(
      z
        .mul(float(31))
        .sub(x.mul(float(12)))
        .sub(mapClock.mul(float(1.08)))
        .sin()
        .mul(float(0.14)),
    );
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
  // Soft far falloff only — squared nearSea killed all glint/sheen on the board
  // when agents tried to erase island god-rays. Keep life under the plates;
  // gate specular with offshore so land UVs never pick it up.
  const far = smoothstep(float(1.35), float(2.45), vec2(px, pz).length());
  const nearSea = float(1).sub(far);

  const vx = positionLocal.x;
  const vz = positionLocal.y.negate();
  const swellAmp = float(SWELL).mul(nearSea.mul(float(0.55)).add(float(0.45)));
  material.positionNode = positionLocal.add(
    vec3(float(0), float(0), longSwell(vx, vz).mul(swellAmp)),
  );

  const warp = mx_noise_float(
    vec3(px.mul(float(7.5)), pz.mul(float(7.5)), mapClock.mul(float(0.09))),
  )
    .mul(float(0.06))
    .mul(nearSea.mul(float(0.5)).add(float(0.5)));
  const wx = px.add(warp);
  const wz = pz.sub(warp.mul(float(0.8)));

  const height = surfaceHeight(wx, wz);
  const e = float(0.004);
  const slopeX = surfaceHeight(wx.add(e), wz)
    .sub(surfaceHeight(wx.sub(e), wz))
    .div(e.mul(float(2)));
  const slopeZ = surfaceHeight(wx, wz.add(e))
    .sub(surfaceHeight(wx, wz.sub(e)))
    .div(e.mul(float(2)));
  // Full NORMAL_RELIEF on-board; only ease far sea so the horizon stays calm.
  const normalRelief = float(NORMAL_RELIEF).mul(nearSea.mul(float(0.35)).add(float(0.65)));
  const normal = vec3(
    slopeX.mul(normalRelief).negate(),
    float(1),
    slopeZ.mul(normalRelief).negate(),
  ).normalize();

  const view = cameraPosition.sub(positionWorld).normalize();
  const fresnel = normal.dot(view).clamp(float(0), float(1)).oneMinus().pow(float(4.2));

  const F = texture(field, mapUvFrom(positionWorld));
  // Open water only — cuts plate-bottom / island-underside specular shafts.
  const offshore = smoothstep(float(0.5), float(0.455), F.g);

  let water = mix(
    linear(SHALLOW),
    linear(DEEP),
    offshore.mul(float(0.85)).add(height.mul(float(0.1))),
  );
  water = water.mul(mix(float(0.78), float(1), offshore));
  // Sky rim restored (was crushed to 0.055×nearSea² — read as dead pond).
  water = mix(water, linear(SKY), fresnel.mul(float(0.12)).mul(nearSea.mul(float(0.4)).add(float(0.6))));

  const reflected = normal.mul(normal.dot(key).mul(float(2))).sub(key);
  const toward = reflected.dot(view).clamp(float(0), float(1));
  // Cartographic sparkle: near fd79a83 weights, fresnel-led, offshore-gated.
  // Keep a small nadir floor so troughs still catch sun without vertical shafts.
  const glint = toward
    .pow(float(72))
    .mul(fresnel.mul(float(0.62)).add(float(0.07)))
    .mul(float(0.28))
    .mul(nearSea.mul(float(0.35)).add(float(0.65)))
    .mul(offshore);
  const sheen = toward
    .pow(float(15))
    .mul(float(0.014))
    .mul(nearSea.mul(float(0.4)).add(float(0.6)))
    .mul(offshore);

  const crest = smoothstep(float(0.78), float(0.96), height.abs())
    .mul(float(0.14))
    .mul(nearSea.mul(float(0.5)).add(float(0.5)))
    .mul(offshore);
  const surf = smoothstep(float(0.5), float(0.487), F.g)
    .mul(smoothstep(float(0.45), float(0.5), F.g))
    .mul(height.mul(float(0.35)).add(float(0.65)))
    .mul(float(0.28));
  // clamp edges as float() — bare 0 / 0.45 are abstract and fail WebGPU validation.
  water = mix(water, linear(FOAM), crest.add(surf).clamp(float(0), float(0.45)));

  // Horizon further out so the board sits in living sea, not a grey puddle.
  const horizon = smoothstep(float(1.55), float(2.65), vec2(px, pz).length());
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
