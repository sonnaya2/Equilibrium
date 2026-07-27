/**
 * POI medallions: a stone disc, a brass edge, and a real game icon struck into
 * it. Atlas markers off a printed map, not chips off a dashboard.
 *
 * The whole medallion is drawn in the fragment from the quad's own local
 * position, so every marker on the board shares one material and one shader —
 * the only thing that differs per marker is the atlas cell baked into its uv and
 * a small state attribute. That is what keeps a framed region's forty pins at
 * forty tiny draw calls with no per-marker material to dispose.
 *
 * `aState` carries what would otherwise need a material each:
 *   x  1 when this is a site rather than a named area (gem inlay in the bezel)
 *   y  0..1 lit — hovered or selected
 */

import * as THREE from "three/webgpu";
import { attribute, float, mix, positionLocal, smoothstep, texture, uv, vec2, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { linear } from "./shared";

const STONE_DARK = 0x14120e;
const STONE = 0x2b251b;
const BRASS = 0xc7a163;
const BRASS_DEEP = 0x7d5f2c;
const GEM = 0x57e0ae;

/** Radii in quad space, where 1.0 is the inscribed circle of the plane. */
const R_ICON = 0.6;
const R_BEZEL = 0.78;
const R_RIM_IN = 0.79;
const R_RIM_OUT = 0.9;
const R_EDGE = 0.93;

export interface MarkerMaterial {
  material: THREE.NodeMaterial;
  dispose(): void;
}

export function createMarkerMaterial(atlas: THREE.Texture): MarkerMaterial {
  // Standard rather than Basic, with a black albedo: everything visible is in
  // emissiveNode, so the medallion is effectively unlit *and* lands in the
  // emissive MRT target, which is the only way the gem on a selected pin can
  // reach the bloom pass. Basic has no emissive channel at all.
  const material = new THREE.MeshStandardNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  material.colorNode = vec3(0, 0, 0);

  const state = attribute("aState", "vec3") as unknown as Node<"vec3">;
  const local = vec2(positionLocal.x, positionLocal.y).mul(2);
  const r = local.length();
  // A soft constant edge: markers hold a fixed screen size, so a fixed falloff
  // is the right amount of antialiasing at every camera distance.
  const soft = 0.035;

  // Body: a dark stone disc, a touch lighter toward the top so it reads as a
  // struck medal under the same upper-left key as the rest of the board.
  const lift = local.y.mul(0.5).add(0.5);
  let colour = mix(linear(STONE_DARK), linear(STONE), lift.mul(0.85).add(0.15));

  // Icon, over the stone. Real game art, alpha-composited so the disc shows
  // through the cut-outs instead of every pin becoming a white square.
  const icon = texture(atlas, uv());
  const inIcon = smoothstep(R_ICON, R_ICON - 0.08, r);
  colour = mix(colour, icon.rgb.mul(1.05), icon.a.mul(inIcon));

  // Brass edge, brighter toward the key.
  const facing = local.normalize().dot(vec2(-0.62, 0.78).normalize()).mul(0.5).add(0.5);
  const brass = mix(linear(BRASS_DEEP), linear(BRASS), facing.pow(1.4));
  const inRim = smoothstep(R_RIM_IN - 0.03, R_RIM_IN + 0.02, r).mul(
    smoothstep(R_RIM_OUT + 0.02, R_RIM_OUT - 0.03, r),
  );
  colour = mix(colour, brass, inRim);

  // Bezel groove between the icon field and the rim, plus the site inlay.
  const groove = smoothstep(R_BEZEL - 0.06, R_BEZEL, r).mul(smoothstep(R_RIM_IN + 0.01, R_BEZEL, r));
  colour = mix(colour, linear(STONE_DARK).mul(0.7), groove.mul(0.7));
  colour = mix(colour, linear(GEM), groove.mul(state.x).mul(0.55));

  // Lit: warm the whole medallion, and let the gem inlay carry the one
  // highlight bright enough to clear the bloom threshold.
  colour = colour
    .mul(float(1).add(state.y.mul(0.24)))
    .add(linear(GEM).mul(inRim.add(groove.mul(state.x))).mul(state.y.mul(1.5)));
  material.emissiveNode = colour;
  // Outside the disc the quad still exists — it is the click target — but it
  // must not paint.
  material.opacityNode = smoothstep(R_EDGE + soft, R_EDGE - soft, r);

  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}

/** The soft contact patch a medallion casts on the ground it stands on. */
export function createMarkerShadowMaterial(): MarkerMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const r = vec2(positionLocal.x, positionLocal.y).mul(2).length();
  material.colorNode = vec3(0.02, 0.018, 0.014);
  material.opacityNode = smoothstep(float(1), float(0), r).pow(1.6).mul(0.42);
  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}

/** The little post that ties a medallion to its exact point on the map. */
export function createMarkerStemMaterial(): MarkerMaterial {
  const material = new THREE.MeshBasicNodeMaterial({ transparent: true, toneMapped: false });
  material.colorNode = mix(linear(BRASS_DEEP), linear(STONE_DARK), positionLocal.y.mul(0.5).add(0.5));
  material.opacityNode = float(0.9);
  return {
    material,
    dispose() {
      material.dispose();
    },
  };
}
