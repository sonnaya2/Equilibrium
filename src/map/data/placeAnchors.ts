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
  /** A catalog area name (exactly), or — when `site` — a place named by that
   *  region's content/upgrade rows. */
  area: string;
  uv: readonly [number, number];
  /** Set on anchors that are not catalog areas: named sites the highlight rows
   *  refer to (bosses, dungeons, guilds). Held to the same two invariants. */
  site?: true;
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
  { region: "misthalin", area: "Edgeville", uv: [0.505, 0.4] },
  { region: "misthalin", area: "Zanaris", uv: [0.515, 0.61] },

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
  { region: "asgarnia", area: "Rimmington", uv: [0.4, 0.58] },
  { region: "asgarnia", area: "Entrana", uv: [0.385, 0.55] },
  { region: "asgarnia", area: "Ice Mountain", uv: [0.445, 0.4] },
  { region: "asgarnia", area: "Armadyl's Tower", uv: [0.42, 0.5] },
  // Invention Guild is the site pin below (do not duplicate area name).

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
  { region: "kandarin", area: "Stormguard Citadel Dig Site", uv: [0.28, 0.48] },
  { region: "kandarin", area: "Temple of Ikov", uv: [0.29, 0.5] },
  { region: "kandarin", area: "Howl's Floating Workshop", uv: [0.275, 0.49] },
  { region: "kandarin", area: "Underground Pass", uv: [0.228, 0.53] },

  // Karamja — Musa Point north, Brimhaven west, Shilo south, TzHaar inland,
  // Habitat/grove/Tai Bwo Wannai on the south-west half.

  { region: "karamja", area: "Musa Point", uv: [0.33, 0.74] },
  { region: "karamja", area: "Brimhaven", uv: [0.264, 0.775] },
  { region: "karamja", area: "Hardwood Grove", uv: [0.275, 0.8] },
  { region: "karamja", area: "TzHaar City", uv: [0.338, 0.812] },
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

  // Forinthry — Daemonheim SE coast; crater / Mage Arena / Agility north-central;
  // Mage of Zamorak (Abyss) west of centre; Forinthry Dungeon mid-east.
  { region: "forinthry", area: "Wilderness Agility Course", uv: [0.48, 0.12] },
  { region: "forinthry", area: "Mage Arena", uv: [0.49, 0.15] },
  { region: "forinthry", area: "Wilderness Crater", uv: [0.502, 0.172] },
  { region: "forinthry", area: "Mage of Zamorak", uv: [0.45, 0.2] },
  { region: "forinthry", area: "Forinthry Dungeon", uv: [0.53, 0.2] },
  { region: "forinthry", area: "Daemonheim", uv: [0.624, 0.292] },
  { region: "forinthry", area: "Lava Maze", uv: [0.48, 0.168] },
  { region: "forinthry", area: "Chaos Temple (Wilderness)", uv: [0.525, 0.235] },
  { region: "forinthry", area: "Bandit Camp", uv: [0.458, 0.188] },
  { region: "forinthry", area: "Rogues' Castle", uv: [0.528, 0.108] },
  { region: "forinthry", area: "Demonic Ruins", uv: [0.568, 0.132] },
  { region: "forinthry", area: "Frozen Waste Plateau", uv: [0.448, 0.098] },
  { region: "forinthry", area: "Pirates' Hideout", uv: [0.462, 0.105] },

  // Kharidian Desert — Al Kharid / dig / oasis on the north band, Menaphite south.
  { region: "desert", area: "Al Kharid", uv: [0.492, 0.7] },
  { region: "desert", area: "Garden of Kharid", uv: [0.5, 0.72] },
  { region: "desert", area: "Kharid-et Dig Site", uv: [0.52, 0.75] },
  { region: "desert", area: "Het's Oasis", uv: [0.53, 0.73] },
  { region: "desert", area: "Sophanem", uv: [0.58, 0.9] },
  { region: "desert", area: "Menaphos", uv: [0.56, 0.928] },

  // Morytania — Canifis/Slayer Tower west-central, Everlight off the east
  // coast, Phasmatys and Darkmeyer further south-east, Barrows south.
  { region: "morytania", area: "Slayer Tower", uv: [0.65, 0.42] },
  { region: "morytania", area: "Canifis", uv: [0.64, 0.48] },
  { region: "morytania", area: "Everlight Dig Site", uv: [0.7, 0.5] },
  { region: "morytania", area: "Port Phasmatys", uv: [0.72, 0.52] },
  { region: "morytania", area: "Araxyte Hive", uv: [0.658, 0.558] },
  { region: "morytania", area: "Darkmeyer", uv: [0.69, 0.55] },
  { region: "morytania", area: "Barrows", uv: [0.68, 0.58] },

  // Tirannwn — Prifddinas central, Lost Grove south, Isafdar/Lletya/Port Tyras.
  { region: "tirannwn", area: "Prifddinas", uv: [0.155, 0.52] },
  { region: "tirannwn", area: "Lost Grove", uv: [0.137, 0.7] },
  { region: "tirannwn", area: "Lletya", uv: [0.175, 0.58] },
  { region: "tirannwn", area: "Isafdar", uv: [0.15, 0.62] },
  { region: "tirannwn", area: "Port Tyras", uv: [0.125, 0.68] },

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
  { region: "havenhythe", area: "Marigold Farm", uv: [0.86, 0.575] },
  { region: "havenhythe", area: "Highweald Forest", uv: [0.842, 0.622] },
  { region: "havenhythe", area: "Amberfell", uv: [0.826, 0.68] },
];

/**
 * Places named by content and upgrade rows rather than by the catalog's `areas`
 * list — the bosses, dungeons and guilds a region's highlights actually happen
 * at. Same two invariants as above, held by the same test.
 *
 * Deliberately partial. Most of the 680 content+upgrade rows are items, perks,
 * outfits, scrolls and spells, which have no position on Gielinor and get no
 * marker; the rest are pinned only where the location is known. The alternative
 * the brief floated — falling back to the region centroid — would stack
 * hundreds of pins on one point and pass off a guess as a coordinate, which is
 * the one thing this repo does not ship. Unpinned rows are counted, not hidden:
 * the inspector says "N of M pinned" out loud.
 */
export const SITE_ANCHORS: readonly PlaceAnchor[] = [
  // Misthalin — the Necromancy sites hang off the City of Um.
  { region: "misthalin", area: "Sanctum of Rebirth", uv: [0.508, 0.626], site: true },
  { region: "misthalin", area: "Rasial", uv: [0.514, 0.616], site: true },

  // Asgarnia — the five God Wars generals sit in the GWD, the rest ring Falador.
  { region: "asgarnia", area: "General Graardor", uv: [0.412, 0.325], site: true },
  { region: "asgarnia", area: "Kree'arra", uv: [0.428, 0.322], site: true },
  { region: "asgarnia", area: "Commander Zilyana", uv: [0.414, 0.338], site: true },
  { region: "asgarnia", area: "K'ril Tsutsaroth", uv: [0.43, 0.338], site: true },
  { region: "asgarnia", area: "Nex", uv: [0.421, 0.316], site: true },
  { region: "asgarnia", area: "Giant Mole", uv: [0.404, 0.462], site: true },
  { region: "asgarnia", area: "Vorago", uv: [0.43, 0.455], site: true },
  { region: "asgarnia", area: "Queen Black Dragon", uv: [0.42, 0.512], site: true },
  { region: "asgarnia", area: "Mining Guild", uv: [0.418, 0.481], site: true },
  { region: "asgarnia", area: "Living Rock Caverns", uv: [0.443, 0.432], site: true },
  { region: "asgarnia", area: "Crafting Guild", uv: [0.397, 0.5], site: true },
  { region: "asgarnia", area: "Rogues' Den", uv: [0.372, 0.392], site: true },
  { region: "asgarnia", area: "Artisans' Workshop", uv: [0.421, 0.49], site: true },
  { region: "asgarnia", area: "Invention Guild", uv: [0.407, 0.483], site: true },

  // Kandarin.
  { region: "kandarin", area: "Legiones", uv: [0.292, 0.614], site: true },
  { region: "kandarin", area: "Elemental Workshop", uv: [0.263, 0.374], site: true },
  { region: "kandarin", area: "Fishing Trawler", uv: [0.302, 0.594], site: true },
  { region: "kandarin", area: "Gnome Restaurant", uv: [0.224, 0.454], site: true },

  // Karamja — the TzHaar arenas share the volcano.
  { region: "karamja", area: "Duradel", uv: [0.308, 0.876], site: true },
  { region: "karamja", area: "TzHaar Fight Cave", uv: [0.342, 0.818], site: true },
  { region: "karamja", area: "Fight Kiln", uv: [0.345, 0.822], site: true },
  { region: "karamja", area: "Fight Cauldron", uv: [0.339, 0.825], site: true },
  { region: "karamja", area: "Brimhaven Agility Arena", uv: [0.262, 0.782], site: true },
  { region: "karamja", area: "Nature altar", uv: [0.296, 0.848], site: true },
  { region: "karamja", area: "Jadinko Lair", uv: [0.323, 0.864], site: true },

  // Fremennik.
  { region: "fremennik", area: "Dagannoth Kings", uv: [0.242, 0.153], site: true },

  // Forinthry — the Wilderness bosses, plus the Daemonheim dungeoneering fronts.
  { region: "forinthry", area: "Corporeal Beast", uv: [0.47, 0.176], site: true },
  { region: "forinthry", area: "Chaos Elemental", uv: [0.508, 0.132], site: true },
  { region: "forinthry", area: "Dragonkin Laboratory", uv: [0.528, 0.162], site: true },
  { region: "forinthry", area: "The Shadow Reef", uv: [0.617, 0.288], site: true },

  // Kharidian Desert — Kalphite lair north, Heart of Gielinor mid, Menaphos south.
  { region: "desert", area: "Kalphite Queen", uv: [0.512, 0.77], site: true },
  { region: "desert", area: "Kalphite King", uv: [0.518, 0.776], site: true },
  { region: "desert", area: "Telos", uv: [0.535, 0.8], site: true },
  { region: "desert", area: "Heart of Gielinor", uv: [0.532, 0.807], site: true },
  { region: "desert", area: "Amascut", uv: [0.575, 0.911], site: true },
  { region: "desert", area: "Pyramid Plunder", uv: [0.582, 0.893], site: true },
  { region: "desert", area: "Shifting Tombs", uv: [0.565, 0.921], site: true },
  { region: "desert", area: "Soul altar", uv: [0.554, 0.931], site: true },

  // Morytania.
  { region: "morytania", area: "Rise of the Six", uv: [0.684, 0.585], site: true },
  { region: "morytania", area: "Ectofuntus", uv: [0.716, 0.514], site: true },
  { region: "morytania", area: "Blood altar", uv: [0.694, 0.545], site: true },
  { region: "morytania", area: "Shades of Mort'ton", uv: [0.664, 0.568], site: true },
  { region: "morytania", area: "Abandoned Mine", uv: [0.652, 0.53], site: true },
  { region: "morytania", area: "Temple Trekking", uv: [0.67, 0.598], site: true },

  // Tirannwn — everything but Solak is inside the Prifddinas walls.
  { region: "tirannwn", area: "Solak", uv: [0.14, 0.695], site: true },
  { region: "tirannwn", area: "Max Guild", uv: [0.158, 0.514], site: true },
  { region: "tirannwn", area: "Hefin Agility Course", uv: [0.151, 0.526], site: true },
  { region: "tirannwn", area: "Motherlode Maw", uv: [0.16, 0.512], site: true },

  // Anachronia.
  { region: "anachronia", area: "Raksha", uv: [0.783, 0.146], site: true },
  { region: "anachronia", area: "Rex Matriarchs", uv: [0.774, 0.254], site: true },

  // Havenhythe.
  { region: "havenhythe", area: "Ivar, King of Bones", uv: [0.818, 0.55], site: true },
  { region: "havenhythe", area: "Silverquill", uv: [0.844, 0.618], site: true },
  { region: "havenhythe", area: "Sanguine Crawler", uv: [0.868, 0.526], site: true },
];

export const PLACES_BY_REGION: ReadonlyMap<RegionId, readonly PlaceAnchor[]> = (() => {
  const grouped = new Map<RegionId, PlaceAnchor[]>();
  for (const anchor of [...PLACE_ANCHORS, ...SITE_ANCHORS]) {
    grouped.set(anchor.region, [...(grouped.get(anchor.region) ?? []), anchor]);
  }
  return grouped;
})();

/**
 * Which pin a highlight row belongs to, or null when we do not know where it
 * happens. Substring rather than equality because the rows are prose — "Canifis
 * farming and Slayer Tower hub" is a Slayer Tower row. Longest match wins so a
 * row naming two places lands on the more specific one.
 */
export function pinForHighlight(region: RegionId, rowName: string): PlaceAnchor | null {
  const hay = rowName.toLowerCase();
  let best: PlaceAnchor | null = null;
  for (const anchor of PLACES_BY_REGION.get(region) ?? []) {
    if (!hay.includes(anchor.area.toLowerCase())) continue;
    if (!best || anchor.area.length > best.area.length) best = anchor;
  }
  return best;
}
