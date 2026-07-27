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
 * coastline encloses. No procedural mud, no invented mountains, nothing that
 * competes with the map for attention.
 *
 * Albedo is brightened before lighting, not after: a lit surface returns roughly
 * albedo x irradiance, so feeding it the value you want back gives you something
 * much darker.
 */

import * as THREE from "three/webgpu";
import { float, mix, mx_noise_float, positionLocal, positionWorld, smoothstep, step, texture, uniform, vec2, vec3 } from "three/tsl";
import { TERRAIN_WALL_DEEP, TERRAIN_WALL_ROCK, TERRAIN_WALL_SUBSOIL, TERRAIN_WALL_TOPSOIL } from "../palette";
import { FIELD_TEXEL, linear, mapClock, mapUvFrom } from "./shared";

/**
 * Pre-light boost so the wiki raster survives MeshStandard Lambert (÷π).
 * Paired with a key-heavy desk lamp (strong sun, weak fill) — gain alone
 * without a hard key just chalks the sheet.
 */
const ALBEDO_GAIN = 2.05;
/** Contrast around a mid pivot — restores wiki punch after lighting. */
const PRINT_CONTRAST = 1.2;
/** Saturation lift; 1 = unchanged, >1 pulls chroma back toward the webp. */
const PRINT_SAT = 1.14;
/** Soft floor — keep tiny so ink blacks stay black under flat tonemap. */
const PRINT_LIFT = 0.008;

/**
 * Soft lava discs in map UV (wiki paint has no field channel for heat).
 * Centres: TzHaar crater, Lava Maze, Wilderness Crater.
 */
function softLava(mapUv: ReturnType<typeof mapUvFrom>, F: ReturnType<typeof texture>) {
  const disc = (cx: number, cy: number, r: number) => {
    const d = mapUv.sub(vec2(cx, cy)).length().div(float(r));
    return float(1).sub(d).max(float(0)).pow(1.6);
  };
  // Land only — F.r is land coverage (unused elsewhere; safe gate).
  const land = smoothstep(float(0.35), float(0.65), F.r);
  const dry = float(1).sub(smoothstep(float(0.15), float(0.45), F.b));
  const heat = disc(0.3444, 0.7046, 0.042)
    .add(disc(0.416, 0.37, 0.028))
    .add(disc(0.437, 0.385, 0.032))
    .clamp(0, 1);
  return heat.mul(land).mul(dry);
}

export interface TerrainMaterials {
  cap: THREE.MeshStandardNodeMaterial;
  wall: THREE.MeshStandardNodeMaterial;
  /** 0 open, 1 sealed. Drains colour without crushing the map to black. */
  lock: ReturnType<typeof uniform>;
  /** 1 while some other plate is the subject. */
  dim: ReturnType<typeof uniform>;
  /** 0..1 focus rim. The one sanctioned selection glow. */
  focus: ReturnType<typeof uniform>;
  /** 1 -> 0 over the unlock sweep. Never rests non-zero, so bloom rests too. */
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

  // Restrained on purpose. A sealed region should read as sealed and a
  // sidelined one as sidelined, but the HD map has to stay the HD map — the
  // board is not allowed to grey out ten elevenths of Gielinor to say so.
  const drain = lock.mul(0.22).add(dim.mul(0.1)).min(float(0.32));
  const shade = float(1).sub(dim.mul(0.1)).sub(lock.mul(0.05));

  const mapUv = mapUvFrom(positionWorld);
  const F = texture(field, mapUv);

  // ---- cap ------------------------------------------------------------------
  // polygonOffset: neighbouring plates share byte-identical seam edges at the
  // same rest height, so without a bias the caps z-fight and shimmer under
  // any camera motion.
  // Slightly lower roughness so the warm key can sparkle on wet / desert paint
  // without going plastic.
  const cap = new THREE.MeshStandardNodeMaterial({
    roughness: 0.82,
    metalness: 0,
    wireframe: options.wireframe,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });

  // Sample → print grade → light prep. Order matters: grade the wiki sheet
  // first so lighting doesn't flatten chroma we already lost.
  let base = texture(albedo, mapUv).rgb;

  // Mild contrast + sat: restores "wiki screenshot" punch under flat tonemap.
  const pivot = float(0.4);
  base = pivot.add(base.sub(pivot).mul(float(PRINT_CONTRAST))).max(float(0));
  const preLum = base.x.mul(0.2126).add(base.y.mul(0.7152)).add(base.z.mul(0.0722));
  base = mix(vec3(preLum, preLum, preLum), base, float(PRINT_SAT));
  base = base.mul(float(ALBEDO_GAIN)).add(float(PRINT_LIFT));

  if (options.relief) {
    // Emboss, not terrain. The A channel is a low-passed luminance of the map
    // itself, so its slope follows the drawn shapes; lighting it from the same
    // upper-left key as the scene makes a printed sheet look pressed rather than
    // making Varrock's rooftops into cliffs.
    const t = float(FIELD_TEXEL * 2);
    const hL = texture(field, mapUv.add(vec2(t.negate(), float(0)))).a;
    const hR = texture(field, mapUv.add(vec2(t, float(0)))).a;
    const hD = texture(field, mapUv.add(vec2(float(0), t.negate()))).a;
    const hU = texture(field, mapUv.add(vec2(float(0), t))).a;
    const emboss = hL.sub(hR).mul(0.72).add(hU.sub(hD).mul(0.5));
    base = base.mul(float(1).add(emboss.mul(0.55).clamp(-0.12, 0.18)));
  }

  // The waterline, from the real signed distance. Land within a few tiles of the
  // sea cools and darkens — contact without crushing the whole coast.
  const inlandDepth = smoothstep(float(0.5), float(0.53), F.g);
  base = mix(base.mul(0.9).mul(vec3(0.95, 0.98, 1.03)), base, inlandDepth);

  if (options.water) {
    // Rivers and lakes. Flow runs along the channel, which is perpendicular to
    // the gradient of the coast-distance field — so the Salve and the Elid move
    // in their own directions instead of every water pixel scrolling the same
    // way. Where that gradient goes slack (the middle of a lake) the directional
    // term fades out and only the shimmer is left.
    const t = float(FIELD_TEXEL);
    const gx = texture(field, mapUv.add(vec2(t, float(0)))).g.sub(
      texture(field, mapUv.add(vec2(t.negate(), float(0)))).g,
    );
    const gy = texture(field, mapUv.add(vec2(float(0), t))).g.sub(
      texture(field, mapUv.add(vec2(float(0), t.negate()))).g,
    );
    // Also sample B gradient so mid-map rivers (flat coast SDF) still flow.
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
    const flow = vec2(fx, fy).div(slope.add(0.0004));

    const along = mapUv.x.mul(flow.x).add(mapUv.y.mul(flow.y));
    // Modest temporal speed — high spatial freq under 30Hz demand = strobe.
    const drift = along.mul(200).sub(mapClock.mul(0.85));
    const ripple = drift.sin().mul(0.6).add(drift.mul(1.7).add(1.7).sin().mul(0.4));
    const shimmer = mx_noise_float(
      vec3(mapUv.x.mul(140), mapUv.y.mul(140), mapClock.mul(0.1)),
    );
    const directional = smoothstep(float(0.0006), float(0.004), slope);
    const surface = mix(shimmer, ripple, directional);

    const wet = F.b.mul(smoothstep(float(0.16), float(0.52), F.b));
    // Soft bank foam at the wet edge (coverage band, not hard step).
    const bank = wet.mul(float(1).sub(wet)).mul(4).clamp(0, 1);
    const glint = smoothstep(float(0.5), float(0.92), surface).mul(wet);
    base = base
      .mul(float(1).sub(wet.mul(0.16)))
      .add(linear(0xbfe4e2).mul(glint.mul(0.14)))
      .add(linear(0x1d3f4e).mul(wet.mul(surface.mul(0.4).add(0.6)).mul(0.09)))
      .add(linear(0xd0e4ea).mul(bank.mul(0.08)));
  }

  // Lava / volcano heat: soft discs at known map UV centres (no field channel).
  // TzHaar crater, Wilderness Lava Maze, Wilderness Crater — paint-only heat
  // on the wiki raster, gated so deserts don't false-positive.
  const lavaHeat = softLava(mapUv, F);
  const ember = linear(0xff6a2a);
  const coal = linear(0x4a1810);
  const lavaPulse = mx_noise_float(vec3(mapUv.x.mul(40), mapUv.y.mul(40), mapClock.mul(0.2)))
    .mul(0.5)
    .add(0.5);
  base = mix(base, mix(coal, ember, lavaPulse.mul(0.55).add(0.35)), lavaHeat.mul(0.72));

  // Focus/unlock emissive only at rest — no full-sheet rest floor (washes blacks).
  const rimWarm = linear(0xf2dcac);
  const rimGem = linear(0x57e0ae);
  const capRim = smoothstep(float(0.5), float(0.505), F.g).oneMinus();
  const capGlow = rimWarm
    .mul(capRim.mul(focus).mul(0.5))
    .add(rimGem.mul(capRim.mul(sweep).mul(0.85)));
  // Sub-threshold lava warmth (bloom high-pass is ~0.96).
  const lavaGlow = ember.mul(lavaHeat.mul(lavaPulse.mul(0.025).add(0.02)));

  base = base.mul(float(1).add(focus.mul(0.07)));
  const lum = base.x.mul(0.2126).add(base.y.mul(0.7152)).add(base.z.mul(0.0722));
  cap.colorNode = mix(base, vec3(lum, lum, lum), drain).mul(shade);
  cap.emissiveNode = capGlow.add(lavaGlow);
  cap.roughnessNode = float(0.86).sub(F.b.mul(0.5)).sub(lavaHeat.mul(0.25));

  // ---- wall -----------------------------------------------------------------
  // Local y runs 0..depth: the shape is extruded along +z and rotated -90 about
  // x, which puts the extrusion axis on world up. Band edges are noise-warped so
  // the strata read as cut earth instead of printed stripes.
  const wall = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0, wireframe: options.wireframe });
  const jitter = mx_noise_float(positionWorld.mul(190)).mul(0.06);
  const band = positionLocal.y.div(float(depth)).add(jitter).clamp(0, 1);
  const deep = linear(TERRAIN_WALL_DEEP).mul(0.8);
  const rock = mix(deep, linear(TERRAIN_WALL_ROCK), step(float(0.3), band));
  const sub = mix(rock, linear(TERRAIN_WALL_SUBSOIL), step(float(0.62), band));
  const soil = mix(sub, linear(TERRAIN_WALL_TOPSOIL), step(float(0.86), band));
  // Right under the cap, tint the topsoil toward whatever the map draws there,
  // so a desert plate does not end in the same brown crust as a snowfield.
  const strata = mix(soil, soil.mul(0.55).add(texture(albedo, mapUv).rgb.mul(0.9)), step(float(0.94), band));
  const strataLum = strata.x.mul(0.2126).add(strata.y.mul(0.7152)).add(strata.z.mul(0.0722));
  wall.colorNode = mix(strata, vec3(strataLum, strataLum, strataLum), drain).mul(shade).mul(1.12);
  wall.emissiveNode = rimWarm.mul(focus.mul(0.05)).add(rimGem.mul(sweep.mul(0.2)));
  wall.roughnessNode = float(0.93).add(jitter.mul(1.5));

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
