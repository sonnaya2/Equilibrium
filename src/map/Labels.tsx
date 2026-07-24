"use client";

import { Html } from "@react-three/drei";
import { REGION_SHAPES } from "./data/regionShapes";

/** Region names as DOM overlays — renderer-agnostic, styled with our tokens. */
export function Labels() {
  return (
    <>
      {REGION_SHAPES.map((s) => (
        <Html
          key={s.id}
          position={[s.centroid[0], 0.075, s.centroid[1] - 0.045]}
          center
          distanceFactor={1.5}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <span className="map-label">{s.name}</span>
        </Html>
      ))}
    </>
  );
}
