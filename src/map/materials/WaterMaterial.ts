/**
 * Unlit cartographic water: long waves displace geometry; short waves normals-only (DPR cost).
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
/** River water - greener and darker than the sea it runs into. */
const RIVER_DEEP = 0x2c4a4a;
const RIVER_LIT = 0x4d7a72;
const FOAM = 0xb8ccd8;
/** Outer void; slightly darker than shallow for continuous board framing. */
export const OCEAN_HORIZON = 0x1e354c;

/** Peak crest in world units; must stay under REST_CLEARANCE - LOCKED_DROP (~0.0075). */
export const SWELL = 0.0032;
/** Extra normal relief breaks up broad highlights without changing wave height. */
const NORMAL_RELIEF = 0.008;

type FloatNode = Node<"float">;

/** Long waves that displace the mesh. */
function longSwell(x: FloatNode, z: FloatNode): FloatNode {
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

/** Long swell + short waves (normals only via slope). */
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
  // Unlit, toneMapped false: authored colour outside land filmic tone mapping.
  const material = new THREE.MeshBasicNodeMaterial({ toneMapped: false });
  // keyDirection retained for call-site API; specular path currently disabled.
  void keyDirection;

  // Plane flat, rotated -90 about x: world (x,y,z) = local (x,-z,y).
  // Swell displaces local z; vertex-time world XZ is local x / -local y (not positionWorld).
  const px = positionWorld.x;
  const pz = positionWorld.z;
  // Fade toward outer ocean; retain swell under plates.
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
  // Ease normal relief at rim so grazing shots cannot fan long specular shafts.
  const normalRelief = float(NORMAL_RELIEF).mul(nearSea2.mul(float(0.55)).add(float(0.45)));
  const normal = vec3(
    slopeX.mul(normalRelief).negate(),
    float(1),
    slopeZ.mul(normalRelief).negate(),
  ).normalize();

  const view = cameraPosition.sub(positionWorld).normalize();
  const fresnel = normal.dot(view).clamp(float(0), float(1)).oneMinus().pow(float(4.2));
  // mapUv hoisted: river gradient samples it four more times.
  const mapUv = mapUvFrom(positionWorld);
  const F = texture(field, mapUv);
  // Open water only; wider than waterline so plate rims never pick specular.
  const offshore = smoothstep(float(0.5), float(0.44), F.g);

  /**
   * Rivers (field.b): narrow inland water (Lum/Salve/Elid). Cut from plates with
   * ocean so this plane shows through. Flow dir = coast-distance gradient perpendicular.
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
  // Zero ocean swell/crests/glint on rivers (distinct from offshore plate-rim gate).
  const notRiver = isRiver.oneMinus();

  let water = mix(
    linear(SHALLOW),
    linear(DEEP),
    offshore.mul(float(0.85)).add(height.mul(float(0.09)).mul(nearSea)),
  );
  water = water.mul(mix(float(0.78), float(1), offshore));
  // Soft sky rim; do not square fresnel or the board pond goes dead.
  water = mix(
    water,
    linear(SKY),
    fresnel.mul(float(0.11)).mul(nearSea.mul(float(0.55)).add(float(0.45))),
  );

  // Specular/sheen off: crest shafts read as glitched green lines off desert (Bug.png).
  const glint = float(0);
  const sheen = float(0);

  // Shore foam only (waterline band); no open-sea crest foam.
  const surf = smoothstep(float(0.5), float(0.487), F.g)
    .mul(smoothstep(float(0.45), float(0.5), F.g))
    .mul(height.mul(float(0.2)).add(float(0.55)))
    .mul(float(0.14));
  // clamp edges as float() - bare 0 / 0.45 are abstract and fail WebGPU validation.
  water = mix(water, linear(FOAM), surf.clamp(float(0), float(0.22)).mul(notRiver));

  const riverBed = mix(
    linear(RIVER_DEEP),
    linear(RIVER_LIT),
    current.mul(float(0.5)).add(float(0.5)),
  );
  water = mix(water, riverBed, isRiver.mul(float(0.82)));

  // Horizon earlier so southern ocean does not stay blown out.
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
