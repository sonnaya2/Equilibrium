/**
 * Where the named places actually are.
 *
 * The region ledger answers "which shape is this". This answers "where is the
 * thing", which is the only question that makes the board a map rather than a
 * diagram with eleven labels.
 *
 * Every `area` string here must match one already in that region's catalog
 * areas list — these are positions for facts we hold, never new facts. Areas
 * that are not places (Anachronia's "dinosaurs", "hunting", "farming") get no
 * anchor, and that is the correct outcome, not a gap to fill.
 *
 * Coordinates are map-uv, hand-authored against the region rings in the same
 * frame as BORDER_NODES, following real Gielinor layout. placeAnchors.test.ts
 * holds both invariants: the area resolves, and the point lands inside its ring.
 */

import type { RegionId } from "@/league";

export interface PlaceAnchor {
  region: RegionId;
  /** Must equal a catalog area name for that region, exactly. */
  area: string;
  uv: readonly [number, number];
}

export const PLACE_ANCHORS: readonly PlaceAnchor[] = [
  // Misthalin — the Lumbridge/Varrock/Draynor triangle, north to south.
  { region: "misthalin", area: "Varrock", uv: [0.532, 0.42] },
  { region: "misthalin", area: "Lumbridge", uv: [0.527, 0.592] },
  { region: "misthalin", area: "Draynor Village", uv: [0.491, 0.588] },

  // Asgarnia — Falador central, the troll country stacked in the north-west.
  { region: "asgarnia", area: "Falador", uv: [0.412, 0.472] },
  { region: "asgarnia", area: "Taverley", uv: [0.375, 0.452] },
  { region: "asgarnia", area: "Dwarven Mine", uv: [0.437, 0.44] },
  { region: "asgarnia", area: "Port Sarim", uv: [0.425, 0.6] },
  { region: "asgarnia", area: "Burthorpe", uv: [0.368, 0.386] },
  { region: "asgarnia", area: "Death Plateau", uv: [0.352, 0.352] },
  { region: "asgarnia", area: "Troll Stronghold", uv: [0.377, 0.336] },
  { region: "asgarnia", area: "Trollheim", uv: [0.398, 0.352] },
  { region: "asgarnia", area: "God Wars Dungeon", uv: [0.42, 0.33] },

  // Kandarin.
  { region: "kandarin", area: "Hall of Memories", uv: [0.238, 0.432] },
  { region: "kandarin", area: "Player-Owned Farm", uv: [0.268, 0.6] },
  { region: "kandarin", area: "Deep Sea Fishing Hub", uv: [0.258, 0.7] },

  // Karamja — Musa Point north, Brimhaven west, Shilo south, TzHaar inland.
  { region: "karamja", area: "Karamja", uv: [0.3, 0.758] },
  { region: "karamja", area: "Brimhaven", uv: [0.264, 0.775] },
  { region: "karamja", area: "TzHaar area", uv: [0.338, 0.812] },
  { region: "karamja", area: "Shilo Village", uv: [0.305, 0.882] },

  // Fremennik — the mainland coast plus the northern isles.
  { region: "fremennik", area: "Lunar Isle", uv: [0.213, 0.118] },
  { region: "fremennik", area: "Neitiznot", uv: [0.245, 0.1] },
  { region: "fremennik", area: "Jatizso", uv: [0.273, 0.092] },

  // Forinthry — Daemonheim on the south-east coast, the slayer ground inland.
  { region: "forinthry", area: "Wilderness Slayer", uv: [0.502, 0.172] },
  { region: "forinthry", area: "Daemonheim", uv: [0.624, 0.292] },

  // Kharidian Desert — the oasis north of the Menaphite south.
  { region: "desert", area: "Het's Oasis", uv: [0.545, 0.845] },
  { region: "desert", area: "Menaphos", uv: [0.56, 0.928] },

  // Morytania — both in the south-east, the dig site further out to sea.
  { region: "morytania", area: "Araxxor", uv: [0.658, 0.558] },
  { region: "morytania", area: "Everlight Dig Site", uv: [0.7, 0.5] },

  // Tirannwn — Prifddinas central, the Lost Grove off the south.
  { region: "tirannwn", area: "Prifddinas", uv: [0.155, 0.52] },
  { region: "tirannwn", area: "Lost Grove", uv: [0.137, 0.7] },

  // Havenhythe — the new island, laid out as its own settlement map.
  { region: "havenhythe", area: "Moonrise Dig Site", uv: [0.866, 0.442] },
  { region: "havenhythe", area: "Wendlewick", uv: [0.845, 0.47] },
  { region: "havenhythe", area: "Blighted Cave", uv: [0.87, 0.522] },
  { region: "havenhythe", area: "Hollow Hill", uv: [0.815, 0.545] },
  { region: "havenhythe", area: "Shrine of Inanna", uv: [0.803, 0.592] },
  { region: "havenhythe", area: "Eastfold Farm", uv: [0.876, 0.59] },
  { region: "havenhythe", area: "Highweald Forest", uv: [0.842, 0.622] },
  { region: "havenhythe", area: "Amberfell", uv: [0.826, 0.68] },
];

export const PLACES_BY_REGION: ReadonlyMap<RegionId, readonly PlaceAnchor[]> = (() => {
  const grouped = new Map<RegionId, PlaceAnchor[]>();
  for (const anchor of PLACE_ANCHORS) {
    grouped.set(anchor.region, [...(grouped.get(anchor.region) ?? []), anchor]);
  }
  return grouped;
})();
