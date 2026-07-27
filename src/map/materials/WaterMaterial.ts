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
  vec2,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { FIELD_TEXEL, linear, mapClock, mapUvFrom } from "./shared";

const DEEP = 0x24506e;
const SHALLOW = 0x4a7fa0;
const SKY = 0x7ea8c6;
/** River water — greener and darker than the sea it runs into. */
const RIVER_DEEP = 0x2c4a4a;
const RIVER_LIT = 0x4d7a72;
const FOAM = 0xb8ccd8;
/** Outer void — a touch darker than shallow so the board sits in a continuous
 *  field without turning the whole viewport into a black pit. */
export const OCEAN_HORIZON = 0x1e354c;

/**
 * World units of swell — a couple of game tiles, and deliberately less than
 * plateHeight's REST_CLEARANCE so a crest never washes over a coastline.
 */
/** Peak crest; must stay under REST_CLEARANCE − LOCKED_DROP (~0.0075). */
export const SWELL = 0.0032;
/**
 * The shading normal is steeper than the mesh. A surface displaced by two tiles
 * over a two-unit board is flat to within a degree, and a flat mirror turns the
 * sun into one enormous soft blob across half the sea instead of a scatter of
 * points. Shading it as if the ripples were deeper is what breaks that blob up.
 * Keep modest — high relief turns the key into island god-ray shafts (clipboard).
 */
const NORMAL_RELIEF = 0.008;

type FloatNode = Node<"float">;

/** The long waves the mesh actually follows. */
function longSwell(x: FloatNode, z: FloatNode): FloatNode {
  // Slightly quicker than a still pond — cartographic life, not storm sea.
  // float() on every scalar so WGSL never sees abstract floats in the swell graph.
  const a = x
    .mul(float(5.1))
    .add(z.mul(float(2.6)))
    .add(mapClock.mul(float(0.88)))
    .sin();
  const b = z
    .mul(float(6.4))
    .sub(x.mul(float(3.1)))
    .sub(mapClock.mul(float(0.64)))
    .sin();
  const c = x
    .mul(float(3.2))
    .add(z.mul(float(4.1)))
    .add(mapClock.mul(float(0.46)))
    .sin();
  return a
    .mul(float(0.48))
    .add(b.mul(float(0.34)))
    .add(c.mul(float(0.18)));
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
  // keyDirection retained for call-site API; specular path currently disabled.
  void keyDirection;

  // The plane is authored flat and rotated -90 about x, so world (x, y, z) is
  // local (x, -z, y): the swell displaces local z, and world XZ at vertex time
  // has to be read off local x / -local y rather than from positionWorld, which
  // is the very thing being computed here.
  const px = positionWorld.x;
  const pz = positionWorld.z;
  // Distance from board centre. Swell/sky keep a soft nearSea so the sea under
  // the plates still lives; specular alone uses nearSea² so far/southern ocean
  // does not stretch the sun into white island god-rays (clipboard).
  const far = smoothstep(float(1.05), float(2.35), vec2(px, pz).length());
  const nearSea = float(1).sub(far);
  const nearSea2 = nearSea.mul(nearSea);

  const vx = positionLocal.x;
  const vz = positionLocal.y.negate();
  const swellAmp = float(SWELL).mul(nearSea.mul(float(0.7)).add(float(0.3)));
  material.positionNode = positionLocal.add(
    vec3(float(0), float(0), longSwell(vx, vz).mul(swellAmp)),
  );

  const warp = mx_noise_float(
    vec3(px.mul(float(7.5)), pz.mul(float(7.5)), mapClock.mul(float(0.09))),
  )
    .mul(float(0.06))
    .mul(nearSea.mul(float(0.65)).add(float(0.35)));
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
  // Ease normal relief at the rim so grazing shots cannot fan long specular shafts.
  const normalRelief = float(NORMAL_RELIEF).mul(nearSea2.mul(float(0.55)).add(float(0.45)));
  const normal = vec3(
    slopeX.mul(normalRelief).negate(),
    float(1),
    slopeZ.mul(normalRelief).negate(),
  ).normalize();

  const view = cameraPosition.sub(positionWorld).normalize();
  const fresnel = normal.dot(view).clamp(float(0), float(1)).oneMinus().pow(float(4.2));
  // Looking across the water (low view.y) stretches the key into god-rays under
  // islands. Overview looks down; desert/south focus is the failure case.
  // mapUv is hoisted because the river gradient below samples it four more times.
  const mapUv = mapUvFrom(positionWorld);
  const F = texture(field, mapUv);
  // Open water only — wider than the waterline so plate rims never pick specular.
  const offshore = smoothstep(float(0.5), float(0.44), F.g);

  /**
   * Rivers.
   *
   * B marks water that is narrow and a long way from open sea — the Lum, the
   * Salve, the Elid. The Wiki paints them in the open-sea colour, so they are
   * cut out of the plates along with the ocean, which means *this* plane is what
   * shows through a river. Ocean swell is the wrong motion for one.
   *
   * Direction comes from the coast-distance field: the gradient points across
   * the channel, so its perpendicular runs along it. Every river gets its own
   * heading out of that, rather than the whole map scrolling one way.
   */
  const texel = float(FIELD_TEXEL);
  const gx = texture(field, mapUv.add(vec2(texel, float(0)))).g.sub(
    texture(field, mapUv.add(vec2(texel.negate(), float(0)))).g,
  );
  const gy = texture(field, mapUv.add(vec2(float(0), texel))).g.sub(
    texture(field, mapUv.add(vec2(float(0), texel.negate()))).g,
  );
  const slope = gx.mul(gx).add(gy.mul(gy)).sqrt();
  const flowDir = vec2(gy.negate(), gx).div(slope.add(float(0.0004)));
  const along = mapUv.x.mul(flowDir.x).add(mapUv.y.mul(flowDir.y));
  const drift = along.mul(float(430)).sub(mapClock.mul(float(0.85)));
  const current = drift
    .sin()
    .mul(float(0.6))
    .add(drift.mul(float(2.1)).add(float(1.7)).sin().mul(float(0.4)));
  const isRiver = smoothstep(float(0.16), float(0.5), F.b);
  // Swell, crests and sun glint are all ocean behaviour; a river gets none.
  // Named apart from `openWater` above, which gates specular against the plate
  // rims and means something different.
  const notRiver = isRiver.oneMinus();

  let water = mix(
    linear(SHALLOW),
    linear(DEEP),
    offshore.mul(float(0.85)).add(height.mul(float(0.09)).mul(nearSea)),
  );
  water = water.mul(mix(float(0.78), float(1), offshore));
  // Soft sky rim — not squared, or the board pond goes dead.
  water = mix(
    water,
    linear(SKY),
    fresnel.mul(float(0.11)).mul(nearSea.mul(float(0.55)).add(float(0.45))),
  );

  // No open-ocean specular / sheen — soft shafts along wave crests read as
  // glitched green lines off the desert (Bug.png). Sparkle is gone entirely.
  const glint = float(0);
  const sheen = float(0);

  // Shore foam only — a tight band on the waterline. Crest foam across the
  // whole swell made parallel streaks out into open sea; remove that entirely.
  const surf = smoothstep(float(0.5), float(0.487), F.g)
    .mul(smoothstep(float(0.45), float(0.5), F.g))
    .mul(height.mul(float(0.2)).add(float(0.55)))
    .mul(float(0.14));
  // clamp edges as float() — bare 0 / 0.45 are abstract and fail WebGPU validation.
  water = mix(water, linear(FOAM), surf.clamp(float(0), float(0.22)).mul(notRiver));

  // River water: darker and greener than the sea it joins, with the current
  // reading as movement along the channel rather than swell across it.
  const riverBed = mix(
    linear(RIVER_DEEP),
    linear(RIVER_LIT),
    current.mul(float(0.5)).add(float(0.5)),
  );
  water = mix(water, riverBed, isRiver.mul(float(0.82)));

  // Horizon starts a touch earlier so southern ocean does not stay blown out.
  const horizon = smoothstep(float(1.35), float(2.4), vec2(px, pz).length());
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
