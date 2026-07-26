/**
 * Where the named places actually are.
 *
 * The region ledger answers "which shape is this". This answers "where is the
 * thing", which is the only question that makes the board a map rather than a
 * diagram with eleven labels.
 *
 * Every `area` string here must match one already in that region's catalog
 * areas list — these are positions for facts we hold, never new facts.
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
  // Misthalin — cities on the south half, fort and dig site north of Varrock,
  // Underworld/City of Um and the Tower sitting with the south bank.
  { region: "misthalin", area: "Varrock", uv: [0.532, 0.42] },
  { region: "misthalin", area: "Lumbridge", uv: [0.527, 0.592] },
  { region: "misthalin", area: "Draynor Village", uv: [0.491, 0.588] },
  { region: "misthalin", area: "Fort Forinthry", uv: [0.548, 0.368] },
  { region: "misthalin", area: "Varrock Dig Site", uv: [0.558, 0.4] },
  { region: "misthalin", area: "City of Um", uv: [0.51, 0.62] },
  { region: "misthalin", area: "Wizards' Tower", uv: [0.5, 0.63] },

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

  // Kandarin — Piscatoris/Hall north-west, Seers–Catherby band, Ardougne/POF
  // south, Feldip Warforge on the south coast, DSF off the southern pier.
  { region: "kandarin", area: "Piscatoris Fishing Colony", uv: [0.25, 0.33] },
  { region: "kandarin", area: "Memorial to Guthix", uv: [0.245, 0.4] },
  { region: "kandarin", area: "Hall of Memories", uv: [0.238, 0.432] },
  { region: "kandarin", area: "Seers' Village", uv: [0.26, 0.38] },
  { region: "kandarin", area: "Barbarian Outpost", uv: [0.27, 0.34] },
  { region: "kandarin", area: "Catherby", uv: [0.3, 0.42] },
  { region: "kandarin", area: "Tree Gnome Stronghold", uv: [0.22, 0.45] },
  { region: "kandarin", area: "Fishing Guild", uv: [0.29, 0.52] },
  { region: "kandarin", area: "Ourania Runecrafting Altar", uv: [0.255, 0.55] },
  { region: "kandarin", area: "Ardougne", uv: [0.3, 0.58] },
  { region: "kandarin", area: "Player-Owned Farm", uv: [0.268, 0.6] },
  { region: "kandarin", area: "Warforge Dig Site", uv: [0.3, 0.66] },
  { region: "kandarin", area: "Deep Sea Fishing Hub", uv: [0.258, 0.7] },

  // Karamja — Musa Point north, Brimhaven west, Shilo south, TzHaar inland,
  // Habitat/grove/Tai Bwo Wannai on the south-west half.
  { region: "karamja", area: "Karamja", uv: [0.3, 0.758] },
  { region: "karamja", area: "Musa Point", uv: [0.33, 0.74] },
  { region: "karamja", area: "Brimhaven", uv: [0.264, 0.775] },
  { region: "karamja", area: "Hardwood Grove", uv: [0.275, 0.8] },
  { region: "karamja", area: "TzHaar area", uv: [0.338, 0.812] },
  { region: "karamja", area: "Tai Bwo Wannai", uv: [0.29, 0.84] },
  { region: "karamja", area: "Herblore Habitat", uv: [0.32, 0.86] },
  { region: "karamja", area: "Shilo Village", uv: [0.305, 0.882] },

  // Fremennik — northern isles first, then Rellekka and the mainland spine
  // (Waterbirth off the west coast, Miscellania east of Rellekka, Keldagrim
  // and the Lava Flow Mine on the south-east shoulder).
  { region: "fremennik", area: "Lunar Isle", uv: [0.213, 0.118] },
  { region: "fremennik", area: "Livid Farm", uv: [0.22, 0.14] },
  { region: "fremennik", area: "Neitiznot", uv: [0.245, 0.1] },
  { region: "fremennik", area: "Jatizso", uv: [0.273, 0.092] },
  { region: "fremennik", area: "Waterbirth Island", uv: [0.24, 0.15] },
  { region: "fremennik", area: "Rellekka", uv: [0.3, 0.18] },
  { region: "fremennik", area: "Miscellania", uv: [0.32, 0.16] },
  { region: "fremennik", area: "Keldagrim", uv: [0.33, 0.22] },
  { region: "fremennik", area: "Lava Flow Mine", uv: [0.31, 0.25] },

  // Forinthry — Daemonheim on the south-east coast, slayer ground central,
  // Agility course north, Abyss entrance west of centre.
  { region: "forinthry", area: "Wilderness Agility Course", uv: [0.48, 0.12] },
  { region: "forinthry", area: "Wilderness Slayer", uv: [0.502, 0.172] },
  { region: "forinthry", area: "Abyss entrance", uv: [0.45, 0.2] },
  { region: "forinthry", area: "Daemonheim", uv: [0.624, 0.292] },

  // Kharidian Desert — dig site north, oasis mid-south, Menaphite south,
  // Garden of Kharid on the north-west shoulder toward Al Kharid.
  { region: "desert", area: "Garden of Kharid", uv: [0.5, 0.72] },
  { region: "desert", area: "Kharid-et Dig Site", uv: [0.52, 0.75] },
  { region: "desert", area: "Het's Oasis", uv: [0.545, 0.845] },
  { region: "desert", area: "Sophanem", uv: [0.58, 0.9] },
  { region: "desert", area: "Menaphos", uv: [0.56, 0.928] },

  // Morytania — Canifis/Slayer Tower west-central, Everlight off the east
  // coast, Phasmatys and Darkmeyer further south-east, Barrows south.
  { region: "morytania", area: "Slayer Tower", uv: [0.65, 0.42] },
  { region: "morytania", area: "Canifis", uv: [0.64, 0.48] },
  { region: "morytania", area: "Everlight Dig Site", uv: [0.7, 0.5] },
  { region: "morytania", area: "Port Phasmatys", uv: [0.72, 0.52] },
  { region: "morytania", area: "Araxxor", uv: [0.658, 0.558] },
  { region: "morytania", area: "Darkmeyer", uv: [0.69, 0.55] },
  { region: "morytania", area: "Barrows", uv: [0.68, 0.58] },

  // Tirannwn — Prifddinas central, the Lost Grove off the south.
  { region: "tirannwn", area: "Prifddinas", uv: [0.155, 0.52] },
  { region: "tirannwn", area: "Lost Grove", uv: [0.137, 0.7] },

  // Anachronia — base camp west, Orthen / Time altar more central-north,
  // Agility and Slayer Lodge inland, Ranch south, Dream of Iaia east.
  { region: "anachronia", area: "Anachronia base camp", uv: [0.72, 0.2] },
  { region: "anachronia", area: "Orthen Dig Site", uv: [0.78, 0.14] },
  { region: "anachronia", area: "Time altar", uv: [0.8, 0.12] },
  { region: "anachronia", area: "Anachronia Agility Course", uv: [0.76, 0.18] },
  { region: "anachronia", area: "Slayer Lodge", uv: [0.82, 0.2] },
  { region: "anachronia", area: "Dream of Iaia", uv: [0.85, 0.16] },
  { region: "anachronia", area: "Ranch Out of Time", uv: [0.76, 0.28] },

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
