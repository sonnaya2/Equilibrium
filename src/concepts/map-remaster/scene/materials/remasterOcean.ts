/**
 * Skin-aware lit ocean for remaster boards.
 * Multi-band directional swell + foam ridges + crystal caustics / carto hatch / raised mirror.
 * No fractal noise (viewport-sized plane cost). Crystal caustic = 2 sin masks max.
 */

import * as THREE from "three/webgpu";
import { float, mix, positionWorld, smoothstep, uniform } from "three/tsl";
import type { RemasterSkin } from "../skins";
import { linear } from "./linear";

export type RemasterOceanMaterial = {
  m: THREE.MeshStandardNodeMaterial;
  clock: ReturnType<typeof uniform>;
  dispose(): void;
};

export function createRemasterOceanMaterial(skin: RemasterSkin): RemasterOceanMaterial {
  const sh = skin.shade;
  const m = new THREE.MeshStandardNodeMaterial({
    roughness: sh.oceanRough,
    metalness: sh.oceanMetal,
  });
  const clock = uniform(0);
  const p = positionWorld.xz;
  const t = clock;

  // Three cheap directional swells — not fractal.
  const a = p.x.mul(14).add(p.y.mul(6)).add(t.mul(0.85)).sin();
  const b = p.y.mul(18).sub(p.x.mul(7)).sub(t.mul(0.55)).sin();
  const c = p.x.mul(9).add(p.y.mul(11)).add(t.mul(0.35)).sin();
  const swell = a.mul(0.45).add(b.mul(0.35)).add(c.mul(0.2));
  const amp = float(skin.ocean.swell);

  const deep = linear(skin.ocean.deep);
  const shallow = linear(skin.ocean.shallow);
  const foam = linear(skin.ocean.foam);

  // Base band between deep and shallow.
  const baseWater = mix(deep, shallow, swell.mul(amp).add(0.35));

  // Crystal: dark abyss + slow bright caustic streaks (exactly two sin masks).
  // Product peaks where both crests agree → thin bright lines, not soft blobs.
  // When caustic is 0, sin product still runs (cheap) but weight is zeroed.
  const c1 = p.x.mul(22).add(p.y.mul(9)).add(t.mul(0.38)).sin();
  const c2 = p.y.mul(19).sub(p.x.mul(11)).add(t.mul(0.26)).sin();
  const caust = smoothstep(float(0.4), float(0.9), c1.mul(c2)).mul(float(sh.caustic));
  const withCaust = mix(baseWater, foam.mul(1.35), caust);

  // Foam ridges — skin-tuned edge sharpness.
  const ridge = smoothstep(float(sh.foamEdge0), float(sh.foamEdge1), swell.abs());

  // Cartographer: foam as hatched light bands (sin lattice), not soft glow.
  const h1 = p.x.mul(48).add(p.y.mul(12)).sin().abs();
  const h2 = p.x.mul(14).sub(p.y.mul(42)).sin().abs();
  const hatch = h1.mul(h2);
  const hatchW = float(sh.foamHatch);
  const foamMask = ridge
    .mul(float(sh.foamAmount))
    .mul(hatch.mul(hatchW).add(float(1).sub(hatchW)));
  const water = mix(withCaust, foam, foamMask);

  // Horizon dissolve into void so the plane edge never reads as a black bar.
  const horizon = smoothstep(float(1.05), float(2.45), p.length());
  m.colorNode = mix(water, linear(skin.voidColor), horizon);
  m.emissiveNode = shallow
    .mul(ridge.mul(float(sh.ridgeEmit)))
    .add(foam.mul(caust.mul(0.2)));
  // Raised mirror: keep troughs glassy; cartographer stays chalkier via higher oceanRough.
  m.roughnessNode = float(sh.oceanRough).add(
    ridge.mul(sh.oceanRough < 0.12 ? 0.08 : 0.16),
  );

  return {
    m,
    clock,
    dispose() {
      m.dispose();
    },
  };
}
