"use client";

/**
 * Place chips for the framed region — under-board Board Sky rail.
 *
 * Canvas markers stay visual (and aria-hidden); this is the keyboard-friendly
 * place list. Same gate as PlaceMarkers: framed region with anchors only.
 */

import { useEffect } from "react";
import { PLACES_BY_REGION } from "./data/placeAnchors";
import { useMapFocus } from "./useMapFocus";

export function PlaceRail() {
  const { focus, selectPlace, hoverPlace } = useMapFocus();
  const places = PLACES_BY_REGION.get(focus.region) ?? [];
  const active = focus.framed && places.length > 0;

  // Rail stays mounted under the board; drop transient hover when it hides.
  useEffect(() => {
    if (!active) hoverPlace(null);
  }, [active, hoverPlace]);

  if (!active) return null;

  return (
    <div className="board-sky__places" role="group" aria-label="Places">
      <h2 className="board-sky__rail-label">
        Places <span className="num">({places.length})</span>
      </h2>
      <div className="board-sky__place-chips">
        {places.map((p) => {
          const on = focus.place === p.area;
          const lit = focus.hover === p.area;
          return (
            <button
              key={p.area}
              type="button"
              aria-pressed={on}
              className={`board-sky__place-chip${on ? " is-on" : ""}${lit ? " is-lit" : ""}`}
              onClick={() => selectPlace(on ? null : p.area)}
              onPointerEnter={() => hoverPlace(p.area)}
              onPointerLeave={() => hoverPlace(null)}
              onFocus={() => hoverPlace(p.area)}
              onBlur={() => hoverPlace(null)}
            >
              {p.area}
            </button>
          );
        })}
      </div>
    </div>
  );
}
