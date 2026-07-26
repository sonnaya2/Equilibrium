"use client";

import { Html } from "@react-three/drei";
import { PLACES_BY_REGION, rasterPlaceUv } from "./data/placeAnchors";
import { MAP_WORLD } from "./data/regionAnchors";
import { useMapFocus } from "./useMapFocus";

/**
 * Screen-sized POIs stay readable at every camera distance. Their positions are
 * map coordinates; the HTML only supplies a crisp hit target and label.
 */
export function PlaceMarkers() {
  const { focus, selectPlace, hoverPlace } = useMapFocus();
  const places = PLACES_BY_REGION.get(focus.region) ?? [];

  if (!focus.framed || places.length === 0) return null;

  return (
    <group>
      {places.map((place) => {
        const uv = rasterPlaceUv(place);
        const x = (uv[0] - 0.5) * MAP_WORLD.width;
        const z = (uv[1] - 0.5) * MAP_WORLD.height;
        const selected = focus.place === place.area;
        const lit = selected || focus.hover === place.area;

        return (
          <Html
            key={`${place.region}:${place.area}`}
            position={[x, 0.04, z]}
            center
            zIndexRange={[15, 0]}
            style={{ pointerEvents: "auto" }}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className={`map-poi-marker${place.site ? " is-site" : ""}${selected ? " is-selected" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                selectPlace(selected ? null : place.area);
              }}
              onPointerEnter={() => hoverPlace(place.area)}
              onPointerLeave={() => hoverPlace(null)}
            >
              <span className="map-poi-marker__dot" />
              {lit ? <span className="map-poi-marker__label">{place.area}</span> : null}
            </button>
          </Html>
        );
      })}
    </group>
  );
}
