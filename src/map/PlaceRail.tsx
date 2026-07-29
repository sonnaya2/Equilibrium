"use client";

import { useEffect } from "react";
import { PLACES_BY_REGION } from "./data/placeAnchors";
import { useMapFocus } from "./useMapFocus";

export function PlaceRail() {
  const { focus, selectPlace, hoverPlace } = useMapFocus();
  const places = PLACES_BY_REGION.get(focus.region) ?? [];
  const visible = places.length > 0;

  useEffect(() => {
    if (!visible) hoverPlace(null);
  }, [visible, hoverPlace]);

  if (!visible) return null;

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
