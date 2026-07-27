/**
 * The land: a cap carrying the HD Wiki raster, and a wall of cut earth under it.
 *
 * The raster is the artwork and everything here defers to it. The cap samples it
 * at map uv derived from world position — never from per-plate geometry uv —
 * which is what keeps Varrock on the same pixel whether its plate is resting,
 * raised or framed, and what makes eleven plates read as one printed sheet
 * rather than eleven decals.
 *
 * What the shader adds on top is deliberately small: an emboss driven by the
 * raster's own luminance so large flats stop being perfectly flat, a shore
 * darkening keyed to real coast distance, and movement on the water the
 * coastline encloses. Region atmospheres (desert heat, Prif blue, Mory green)
 * and tight lava discs are soft UV overlays — never full-plate washes.
 */

import * as THREE from "three/webgpu";
import {
  float,
  mix,
  mx_noise_float,
  positionLocal,
  positionWorld,
  smoothstep,
  step,
  texture,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { TERRAIN_WALL_DEEP, TERRAIN_WALL_ROCK, TERRAIN_WALL_SUBSOIL, TERRAIN_WALL_TOPSOIL } from "../palette";
import { FIELD_TEXEL, linear, mapClock, mapUvFrom } from "./shared";

const ALBEDO_GAIN = 2.05;
const PRINT_CONTRAST = 1.2;
const PRINT_SAT = 1.14;
const PRINT_LIFT = 0.008;

/** Soft heat disc — desert anchor UV, wide enough for atmosphere. */
const DESERT_U = 0.491;
const DESERT_V = 0.844;
const DESERT_R = 0.19;
/**
 * Hard wet kill (ellipse). Soft DESERT_R falloff still leaves Elid at ~85% shimmer;
 * a circular hard r cannot separate Elid (d≤0.124) from Karamja wet (d≥0.127).
 * Ellipse covers Elid + Menaphite sand basins; Lum / Kara / Mory stay open.
 */
const DESERT_WET_U = 0.5;
const DESERT_WET_V = 0.83;
const DESERT_WET_RX = 0.075;
const DESERT_WET_RY = 0.15;

type MapUv = ReturnType<typeof mapUvFrom>;
type FieldSample = ReturnType<typeof texture>;

function softDisc(mapUv: MapUv, cx: number, cy: number, r: number) {
  // float() on every scalar — bare vec2(cx, cy) can emit abstract floats in WGSL.
  const d = mapUv.sub(vec2(float(cx), float(cy))).length().div(float(r));
  return float(1).sub(d).max(float(0)).pow(float(1.8));
}

/**
 * Tight lava basins only (TzHaar, Lava Maze, Wilderness Crater).
 * Chroma + land + dry gates stop heat painting open ocean under plate rims
 * (clipboard god-rays) and non-red land inside the discs.
 */
function softLava(mapUv: MapUv, F: FieldSample, albedoRgb: Node<"vec3">) {
  // Inland + solid land only — plate-rim ocean stays cold.
  const land = smoothstep(float(0.53), float(0.6), F.g).mul(smoothstep(float(0.55), float(0.85), F.r));
  const dry = float(1).sub(smoothstep(float(0.1), float(0.28), F.b));
  const r = albedoRgb.x;
  const g = albedoRgb.y;
  const b = albedoRgb.z;
  // No chroma floor: real lava is red-dominant on the HD raster; a floor was
  // washing green/grey land inside the discs.
  const hotChroma = r
    .sub(g.max(b))
    .mul(float(2.5))
    .clamp(float(0), float(1))
    .mul(smoothstep(float(0.22), float(0.5), r));
  // Discs retargeted onto hot-pixel centroids; radii ~ tile-scale basins only.
  const heat = softDisc(mapUv, 0.342, 0.6995, 0.011)
    .add(softDisc(mapUv, 0.4176, 0.3691, 0.012))
    .add(softDisc(mapUv, 0.445, 0.3306, 0.011))
    .clamp(float(0), float(1));
  return heat.mul(land).mul(dry).mul(hotChroma);
}

function regionMasks(mapUv: MapUv, F: FieldSample) {
  const land = smoothstep(float(0.5), float(0.56), F.g).mul(smoothstep(float(0.4), float(0.65), F.r));
  // Soft atmosphere disc (heat haze). Wet kill is a separate hard ellipse below.
  const desert = softDisc(mapUv, DESERT_U, DESERT_V, DESERT_R).mul(land);
  const prif = softDisc(mapUv, 0.126, 0.648, 0.055)
    .add(softDisc(mapUv, 0.149, 0.663, 0.07))
    .clamp(float(0), float(1))
    .mul(land);
  const mory = softDisc(mapUv, 0.589, 0.58, 0.1).mul(land);
  return { desert, prif, mory };
}

export interface TerrainMaterials {
  cap: THREE.MeshStandardNodeMaterial;
  wall: THREE.MeshStandardNodeMaterial;
  lock: ReturnType<typeof uniform>;
  dim: ReturnType<typeof uniform>;
  focus: ReturnType<typeof uniform>;
  sweep: ReturnType<typeof uniform>;
  dispose(): void;
}

export function createTerrainMaterials(
  albedo: THREE.Texture,
  field: THREE.Texture,
  depth: number,
  options: { relief: boolean; water: boolean; wireframe: boolean },
): TerrainMaterials {
  const lock = uniform(0);
  const dim = uniform(0);
  const focus = uniform(0);
  const sweep = uniform(0);

  const drain = lock.mul(float(0.22)).add(dim.mul(float(0.1))).min(float(0.32));
  const shade = float(1).sub(dim.mul(float(0.1))).sub(lock.mul(float(0.05)));

  const mapUv = mapUvFrom(positionWorld);
  const F = texture(field, mapUv);

  const cap = new THREE.MeshStandardNodeMaterial({
    roughness: 0.82,
    metalness: 0,
    wireframe: options.wireframe,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });

  const albedoSample = texture(albedo, mapUv);
  let base = albedoSample.rgb;

  const pivot = float(0.4);
  base = pivot.add(base.sub(pivot).mul(float(PRINT_CONTRAST))).max(float(0));
  const preLum = base.x
    .mul(float(0.2126))
    .add(base.y.mul(float(0.7152)))
    .add(base.z.mul(float(0.0722)));
  base = mix(vec3(preLum, preLum, preLum), base, float(PRINT_SAT));
  base = base.mul(float(ALBEDO_GAIN)).add(float(PRINT_LIFT));

  if (options.relief) {
    const t = float(FIELD_TEXEL * 2);
    const hL = texture(field, mapUv.add(vec2(t.negate(), float(0)))).a;
    const hR = texture(field, mapUv.add(vec2(t, float(0)))).a;
    const hD = texture(field, mapUv.add(vec2(float(0), t.negate()))).a;
    const hU = texture(field, mapUv.add(vec2(float(0), t))).a;
    const emboss = hL.sub(hR).mul(float(0.72)).add(hU.sub(hD).mul(float(0.5)));
    // clamp bounds as float() — bare negatives are abstract and fail naga validation.
    base = base.mul(float(1).add(emboss.mul(float(0.55)).clamp(float(-0.12), float(0.18))));
  }

  const inlandDepth = smoothstep(float(0.5), float(0.53), F.g);
  base = mix(base.mul(float(0.9)).mul(vec3(float(0.95), float(0.98), float(1.03))), base, inlandDepth);

  const atmospheres = regionMasks(mapUv, F);

  if (options.water) {
    // No river FX on the Kharidian Desert — hard ellipse, not soft disc weight.
    const dwx = mapUv.x.sub(float(DESERT_WET_U)).div(float(DESERT_WET_RX));
    const dwy = mapUv.y.sub(float(DESERT_WET_V)).div(float(DESERT_WET_RY));
    const desertGate = smoothstep(float(0.9), float(1.1), dwx.mul(dwx).add(dwy.mul(dwy)));
    const t = float(FIELD_TEXEL);
    const gx = texture(field, mapUv.add(vec2(t, float(0)))).g.sub(
      texture(field, mapUv.add(vec2(t.negate(), float(0)))).g,
    );
    const gy = texture(field, mapUv.add(vec2(float(0), t))).g.sub(
      texture(field, mapUv.add(vec2(float(0), t.negate()))).g,
    );
    const bx = texture(field, mapUv.add(vec2(t, float(0)))).b.sub(
      texture(field, mapUv.add(vec2(t.negate(), float(0)))).b,
    );
    const by = texture(field, mapUv.add(vec2(float(0), t))).b.sub(
      texture(field, mapUv.add(vec2(float(0), t.negate()))).b,
    );
    const gSlope = gx.mul(gx).add(gy.mul(gy)).sqrt();
    const bSlope = bx.mul(bx).add(by.mul(by)).sqrt();
    const useB = smoothstep(float(0.001), float(0.006), bSlope.sub(gSlope));
    const fx = mix(gy.negate(), by.negate(), useB);
    const fy = mix(gx, bx, useB);
    const slope = mix(gSlope, bSlope, useB);
    const flow = vec2(fx, fy).div(slope.add(float(0.0004)));

    const along = mapUv.x.mul(flow.x).add(mapUv.y.mul(flow.y));
    const drift = along.mul(float(200)).sub(mapClock.mul(float(0.85)));
    const ripple = drift
      .sin()
      .mul(float(0.6))
      .add(drift.mul(float(1.7)).add(float(1.7)).sin().mul(float(0.4)));
    const shimmer = mx_noise_float(
      vec3(mapUv.x.mul(float(140)), mapUv.y.mul(float(140)), mapClock.mul(float(0.1))),
    );
    const directional = smoothstep(float(0.0006), float(0.004), slope);
    const surface = mix(shimmer, ripple, directional);

    const wet = F.b.mul(smoothstep(float(0.16), float(0.52), F.b)).mul(desertGate);
    const bank = wet.mul(float(1).sub(wet)).mul(float(4)).clamp(float(0), float(1));
    const glint = smoothstep(float(0.45), float(0.9), surface).mul(wet);
    // River shimmer restored — prior pass left wet dark without enough glint.
    base = base
      .mul(float(1).sub(wet.mul(float(0.14))))
      .add(linear(0xbfe4e2).mul(glint.mul(float(0.22))))
      .add(
        linear(0x1d3f4e).mul(
          wet.mul(surface.mul(float(0.4)).add(float(0.6))).mul(float(0.08)),
        ),
      )
      .add(linear(0xd0e4ea).mul(bank.mul(float(0.1))));
  }

  // Desert heat, Prif blue, Mory green — soft atmospheres (not paint washes).
  // Mix muls stay well under 0.5 so the HD raster still owns the plate.
  const heatWave = mx_noise_float(
    vec3(mapUv.x.mul(float(18)), mapUv.y.mul(float(18)), mapClock.mul(float(0.12))),
  )
    .mul(float(0.5))
    .add(float(0.5));
  base = mix(
    base,
    base.mul(vec3(float(1.06), float(0.985), float(0.9))).add(linear(0xc4782a).mul(float(0.028))),
    atmospheres.desert.mul(float(0.38)),
  );
  base = mix(
    base,
    base
      .mul(vec3(float(1.03), float(0.99), float(0.94)))
      .add(linear(0xe8a050).mul(heatWave.mul(float(0.028)))),
    atmospheres.desert.mul(float(0.32)),
  );
  base = mix(
    base,
    base.mul(vec3(float(0.94), float(0.98), float(1.06))).add(linear(0x3a8fbf).mul(float(0.028))),
    atmospheres.prif.mul(float(0.4)),
  );
  base = mix(
    base,
    base.mul(vec3(float(0.95), float(1.03), float(0.96))).add(linear(0x3d6b45).mul(float(0.025))),
    atmospheres.mory.mul(float(0.36)),
  );

  const lavaHeat = softLava(mapUv, F, albedoSample.rgb);
  const ember = linear(0xff6a2a);
  const coal = linear(0x4a1810);
  const lavaPulse = mx_noise_float(
    vec3(mapUv.x.mul(float(40)), mapUv.y.mul(float(40)), mapClock.mul(float(0.2))),
  )
    .mul(float(0.5))
    .add(float(0.5));
  base = mix(
    base,
    mix(coal, ember, lavaPulse.mul(float(0.55)).add(float(0.35))),
    lavaHeat.mul(float(0.5)),
  );

  const rimWarm = linear(0xf2dcac);
  const rimGem = linear(0x57e0ae);
  const capRim = smoothstep(float(0.5), float(0.505), F.g).oneMinus();
  const capGlow = rimWarm
    .mul(capRim.mul(focus).mul(float(0.5)))
    .add(rimGem.mul(capRim.mul(sweep).mul(float(0.85))));
  // Emissive enough to hit selective bloom without washing the raster.
  const lavaGlow = ember.mul(lavaHeat.mul(lavaPulse.mul(float(0.035)).add(float(0.022))));
  const prifGlow = linear(0x4ec4e8).mul(atmospheres.prif.mul(float(0.022)));

  base = base.mul(float(1).add(focus.mul(float(0.07))));
  const lum = base.x
    .mul(float(0.2126))
    .add(base.y.mul(float(0.7152)))
    .add(base.z.mul(float(0.0722)));
  cap.colorNode = mix(base, vec3(lum, lum, lum), drain).mul(shade);
  cap.emissiveNode = capGlow.add(lavaGlow).add(prifGlow);
  cap.roughnessNode = float(0.86)
    .sub(F.b.mul(float(0.5)).mul(float(1).sub(atmospheres.desert)))
    .sub(lavaHeat.mul(float(0.2)));

  const wall = new THREE.MeshStandardNodeMaterial({
    roughness: 0.95,
    metalness: 0,
    wireframe: options.wireframe,
  });
  // Bare positionWorld.mul(N) can emit abstract scale in WGSL — wrap scale.
  const jitter = mx_noise_float(positionWorld.mul(float(190))).mul(float(0.06));
  const band = positionLocal.y.div(float(depth)).add(jitter).clamp(float(0), float(1));
  const deep = linear(TERRAIN_WALL_DEEP).mul(float(0.8));
  const rock = mix(deep, linear(TERRAIN_WALL_ROCK), step(float(0.3), band));
  const sub = mix(rock, linear(TERRAIN_WALL_SUBSOIL), step(float(0.62), band));
  const soil = mix(sub, linear(TERRAIN_WALL_TOPSOIL), step(float(0.86), band));
  const strata = mix(
    soil,
    soil.mul(float(0.55)).add(texture(albedo, mapUv).rgb.mul(float(0.9))),
    step(float(0.94), band),
  );
  const strataLum = strata.x
    .mul(float(0.2126))
    .add(strata.y.mul(float(0.7152)))
    .add(strata.z.mul(float(0.0722)));
  wall.colorNode = mix(strata, vec3(strataLum, strataLum, strataLum), drain)
    .mul(shade)
    .mul(float(1.12));
  wall.emissiveNode = rimWarm.mul(focus.mul(float(0.05))).add(rimGem.mul(sweep.mul(float(0.2))));
  wall.roughnessNode = float(0.93).add(jitter.mul(float(1.5)));

  return {
    cap,
    wall,
    lock,
    dim,
    focus,
    sweep,
    dispose() {
      cap.dispose();
      wall.dispose();
    },
  };
}
