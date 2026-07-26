/**
 * Daylit Reliquary sea — noon-readable multi-swell water with fresnel-ish graze.
 * Cheap ALU only (no fractal). Horizon falloff into void.
 */

import * as THREE from "three/webgpu";
import {
  float,
  mix,
  normalView,
  positionViewDirection,
  positionWorld,
  smoothstep,
  uniform,
} from "three/tsl";
import { linear } from "./linear";

const DEEP = 0x0a242c;
const SHALLOW = 0x1a5a52;
const FOAM = 0x6ab8a0;
const VOID = 0x12100c;

export type DaylitOceanMaterial = {
  m: THREE.MeshStandardNodeMaterial;
  clock: ReturnType<typeof uniform>;
  dispose(): void;
};

export function createDaylitOceanMaterial(): DaylitOceanMaterial {
  const m = new THREE.MeshStandardNodeMaterial({
    roughness: 0.14,
    metalness: 0.06,
  });
  const clock = uniform(0);
  const p = positionWorld.xz;
  const t = clock;

  const a = p.x.mul(15).add(p.y.mul(6.5)).add(t.mul(0.9)).sin();
  const b = p.y.mul(19).sub(p.x.mul(7.5)).sub(t.mul(0.58)).sin();
  const c = p.x.mul(10).add(p.y.mul(12)).add(t.mul(0.32)).sin();
  const swell = a.mul(0.44).add(b.mul(0.36)).add(c.mul(0.2));

  const deep = linear(DEEP);
  const shallow = linear(SHALLOW);
  const foam = linear(FOAM);

  // Slightly wider shallow band under noon so coasts separate from land.
  const base = mix(deep, shallow, swell.mul(0.26).add(0.38));
  const ridge = smoothstep(float(0.78), float(0.97), swell.abs());
  let water = mix(base, foam, ridge.mul(0.32));

  // Fresnel-ish graze: plane normal is +Y → normalView.y high when facing camera.
  // Grazing shots have lower N·V → brighten toward foam.
  const ndv = normalView.dot(positionViewDirection).clamp(0, 1);
  const fresnel = float(1).sub(ndv).pow(2.4);
  water = mix(water, foam.mul(0.85).add(shallow.mul(0.15)), fresnel.mul(0.28));

  const horizon = smoothstep(float(1.08), float(2.5), p.length());
  m.colorNode = mix(water, linear(VOID), horizon);
  m.emissiveNode = shallow.mul(ridge.mul(0.07)).add(foam.mul(fresnel.mul(0.04)));
  m.roughnessNode = float(0.12).add(ridge.mul(0.18)).add(fresnel.mul(0.08));

  return {
    m,
    clock,
    dispose() {
      m.dispose();
    },
  };
}
