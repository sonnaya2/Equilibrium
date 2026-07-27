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
 * `rasterPlaceUv` resolves every entry through its Wiki surface coordinate.
 */

import type { RegionId } from "@/league";
import { placeMapCoord } from "./gameCoords";
import { mapToUv } from "./regionAnchors";

export interface PlaceAnchor {
  region: RegionId;
  /** A catalog area name (exactly), or — when `site` — a place named by that
   *  region's content/upgrade rows. */
  area: string;
  /** Set on anchors that are not catalog areas: named sites the highlight rows
   *  refer to (bosses, dungeons, guilds). Held to the same two invariants. */
  site?: true;
}

/**
 * Catalog areas that deliberately get no board pin (base-camp structure,
 * underground-only, etc.). Still valid league areas — just not on the 3D map.
 */
export const MAP_OMITTED_AREAS: ReadonlySet<string> = new Set([
  "Slayer Lodge",
  // Underground under Memorial to Guthix — same surface mouth, no second pin.
  "Hall of Memories",
]);

export const PLACE_ANCHORS: readonly PlaceAnchor[] = [
  // Misthalin — cities on the south half, fort and dig site north of Varrock,
  // Underworld/City of Um and the Tower sitting with the south bank.
  { region: "misthalin", area: "Varrock" },
  { region: "misthalin", area: "Lumbridge" },
  { region: "misthalin", area: "Draynor Village" },
  { region: "misthalin", area: "Fort Forinthry" },
  { region: "misthalin", area: "Varrock Dig Site" },
  { region: "misthalin", area: "City of Um" },
  { region: "misthalin", area: "Wizards' Tower" },
  { region: "misthalin", area: "Edgeville" },
  { region: "misthalin", area: "Zanaris" },

  // Asgarnia — Falador central, the asgarnia stacked in the north-west.
  { region: "asgarnia", area: "Falador" },
  { region: "asgarnia", area: "Taverley" },
  { region: "asgarnia", area: "Dwarven Mine" },
  { region: "asgarnia", area: "Port Sarim" },
  { region: "asgarnia", area: "Burthorpe" },
  { region: "asgarnia", area: "Death Plateau" },
  { region: "asgarnia", area: "Troll Stronghold" },
  { region: "asgarnia", area: "Trollheim" },
  { region: "asgarnia", area: "God Wars Dungeon" },
  { region: "asgarnia", area: "Rimmington" },
  { region: "asgarnia", area: "Entrana" },
  { region: "asgarnia", area: "Ice Mountain" },
  { region: "asgarnia", area: "Armadyl's Tower" },
  // Invention Guild is the site pin below (do not duplicate area name).

  // Kandarin — Piscatoris/Hall north-west, Seers–Catherby band, Ardougne/POF
  // south, Feldip Warforge on the south coast, DSF off the southern pier.
  { region: "kandarin", area: "Piscatoris Fishing Colony" },
  // Surface shrine (Piscatoris hunter area). Hall of Memories is underground
  // under the pool — site pin, not a second overworld area.
  { region: "kandarin", area: "Memorial to Guthix" },
  { region: "kandarin", area: "Seers' Village" },
  { region: "kandarin", area: "Barbarian Outpost" },
  { region: "kandarin", area: "Catherby" },
  { region: "kandarin", area: "Tree Gnome Stronghold" },
  { region: "kandarin", area: "Fishing Guild" },
  { region: "kandarin", area: "Ourania Runecrafting Altar" },
  { region: "kandarin", area: "Ardougne" },
  { region: "kandarin", area: "Player-Owned Farm" },
  { region: "kandarin", area: "Warforge Dig Site" },
  { region: "kandarin", area: "Deep Sea Fishing Hub" },
  { region: "kandarin", area: "Stormguard Citadel Dig Site" },
  { region: "kandarin", area: "Temple of Ikov" },
  { region: "kandarin", area: "Howl's Floating Workshop" },
  { region: "kandarin", area: "Underground Pass" },

  // Karamja — Musa Point north, Brimhaven west, Shilo south, TzHaar inland,
  // Habitat/grove/Tai Bwo Wannai on the south-west half.
  { region: "karamja", area: "Musa Point" },
  { region: "karamja", area: "Brimhaven" },
  { region: "karamja", area: "Hardwood Grove" },
  { region: "karamja", area: "TzHaar City" },
  // Catalog region-level labels (board centre / volcano shoulder).
  { region: "karamja", area: "Karamja" },
  { region: "karamja", area: "TzHaar area" },
  { region: "karamja", area: "Tai Bwo Wannai" },
  { region: "karamja", area: "Herblore Habitat" },
  { region: "karamja", area: "Shilo Village" },

  // Fremennik — northern isles first, then Rellekka and the mainland spine
  // (Waterbirth off the west coast, Miscellania east of Rellekka, Keldagrim
  // and the Lava Flow Mine on the south-east shoulder).
  { region: "fremennik", area: "Lunar Isle" },
  { region: "fremennik", area: "Livid Farm" },
  { region: "fremennik", area: "Neitiznot" },
  { region: "fremennik", area: "Jatizso" },
  { region: "fremennik", area: "Waterbirth Island" },
  { region: "fremennik", area: "Rellekka" },
  { region: "fremennik", area: "Miscellania" },
  { region: "fremennik", area: "Keldagrim" },
  { region: "fremennik", area: "Lava Flow Mine" },

  // Forinthry — Daemonheim SE coast; crater / Mage Arena / Agility north-central;
  // Mage of Zamorak (Abyss) west of centre; Forinthry Dungeon mid-east.
  { region: "forinthry", area: "Wilderness Agility Course" },
  { region: "forinthry", area: "Mage Arena" },
  { region: "forinthry", area: "Wilderness Crater" },
  { region: "forinthry", area: "Mage of Zamorak" },
  { region: "forinthry", area: "Forinthry Dungeon" },
  { region: "forinthry", area: "Daemonheim" },
  { region: "forinthry", area: "Lava Maze" },
  { region: "forinthry", area: "Chaos Temple (Wilderness)" },
  { region: "forinthry", area: "Bandit Camp" },
  { region: "forinthry", area: "Rogues' Castle" },
  { region: "forinthry", area: "Demonic Ruins" },
  { region: "forinthry", area: "Frozen Waste Plateau" },
  { region: "forinthry", area: "Pirates' Hideout" },
  // Catalog label for wilderness slayer masters / task hubs.
  { region: "forinthry", area: "Wilderness Slayer" },

  // Kharidian Desert — Al Kharid / dig / oasis on the north band, Menaphite south.
  { region: "desert", area: "Al Kharid" },
  { region: "desert", area: "Garden of Kharid" },
  { region: "desert", area: "Kharid-et Dig Site" },
  { region: "desert", area: "Het's Oasis" },
  { region: "desert", area: "Sophanem" },
  { region: "desert", area: "Menaphos" },

  // Morytania — Canifis/Slayer Tower west-central, Everlight off the east
  // coast, Phasmatys and Darkmeyer further south-east, Barrows south.
  { region: "morytania", area: "Slayer Tower" },
  { region: "morytania", area: "Canifis" },
  { region: "morytania", area: "Everlight Dig Site" },
  { region: "morytania", area: "Port Phasmatys" },
  { region: "morytania", area: "Araxyte Hive" },
  { region: "morytania", area: "Araxxor" },
  { region: "morytania", area: "Darkmeyer" },
  { region: "morytania", area: "Barrows" },

  // Tirannwn — Prifddinas central, Lost Grove south, Isafdar/Lletya/Port Tyras.
  { region: "tirannwn", area: "Prifddinas" },
  { region: "tirannwn", area: "Lost Grove" },
  { region: "tirannwn", area: "Lletya" },
  { region: "tirannwn", area: "Isafdar" },
  { region: "tirannwn", area: "Port Tyras" },

  // Anachronia — packed RuneScape Surface coordinates.
  { region: "anachronia", area: "Anachronia base camp" },
  { region: "anachronia", area: "Orthen Dig Site" },
  { region: "anachronia", area: "Time altar" },
  { region: "anachronia", area: "Anachronia Agility Course" },
  { region: "anachronia", area: "Dream of Iaia" },
  { region: "anachronia", area: "Ranch Out of Time" },

  // Havenhythe — Map ID 28 packed coordinates.
  { region: "havenhythe", area: "Moonrise Dig Site" },
  { region: "havenhythe", area: "Wendlewick" },
  { region: "havenhythe", area: "Blighted Cave" },
  { region: "havenhythe", area: "Hollow Hill" },
  { region: "havenhythe", area: "Shrine of Inanna" },
  { region: "havenhythe", area: "Eastfold Farm" },
  { region: "havenhythe", area: "Marigold Farm" },
  { region: "havenhythe", area: "Highweald Forest" },
  { region: "havenhythe", area: "Amberfell" },
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
 *
 * Site pins near a parent area inherit that area's georef delta so GWD generals
 * stay clustered on God Wars Dungeon, TzHaar arenas on the city, etc.
 */
export const SITE_ANCHORS: readonly PlaceAnchor[] = [
  // Misthalin — the Necromancy sites hang off the City of Um.
  { region: "misthalin", area: "Sanctum of Rebirth", site: true },
  { region: "misthalin", area: "Rasial", site: true },

  // Asgarnia — the five God Wars generals sit in the GWD, the rest ring Falador.
  { region: "asgarnia", area: "General Graardor", site: true },
  { region: "asgarnia", area: "Kree'arra", site: true },
  { region: "asgarnia", area: "Commander Zilyana", site: true },
  { region: "asgarnia", area: "K'ril Tsutsaroth", site: true },
  { region: "asgarnia", area: "Nex", site: true },
  { region: "asgarnia", area: "Giant Mole", site: true },
  { region: "asgarnia", area: "Vorago", site: true },
  { region: "asgarnia", area: "Queen Black Dragon", site: true },
  { region: "asgarnia", area: "Mining Guild", site: true },
  { region: "asgarnia", area: "Living Rock Caverns", site: true },
  { region: "asgarnia", area: "Crafting Guild", site: true },
  { region: "asgarnia", area: "Rogues' Den", site: true },
  { region: "asgarnia", area: "Artisans' Workshop", site: true },
  { region: "asgarnia", area: "Invention Guild", site: true },
  { region: "asgarnia", area: "Warriors' Guild", site: true },

  // Kandarin.
  { region: "kandarin", area: "Legiones", site: true },
  { region: "kandarin", area: "Elemental Workshop", site: true },
  { region: "kandarin", area: "Fishing Trawler", site: true },
  { region: "kandarin", area: "Gnome Restaurant", site: true },
  { region: "kandarin", area: "Ranging Guild", site: true },
  { region: "kandarin", area: "Manor Farm", site: true },

  // Karamja — the TzHaar arenas share the volcano.
  { region: "karamja", area: "Duradel", site: true },
  { region: "karamja", area: "TzHaar Fight Cave", site: true },
  { region: "karamja", area: "Fight Kiln", site: true },
  { region: "karamja", area: "Fight Cauldron", site: true },
  { region: "karamja", area: "Brimhaven Agility Arena", site: true },
  { region: "karamja", area: "Nature altar", site: true },
  { region: "karamja", area: "Jadinko Lair", site: true },

  // Fremennik.
  { region: "fremennik", area: "Dagannoth Kings", site: true },

  // Forinthry — the Wilderness bosses, plus the Daemonheim dungeoneering fronts.
  { region: "forinthry", area: "Corporeal Beast", site: true },
  { region: "forinthry", area: "Chaos Elemental", site: true },
  { region: "forinthry", area: "Dragonkin Laboratory", site: true },
  { region: "forinthry", area: "The Shadow Reef", site: true },

  // Kharidian Desert — Kalphite lair north, Heart of Gielinor mid, Menaphos south.
  { region: "desert", area: "Kalphite Queen", site: true },
  { region: "desert", area: "Kalphite King", site: true },
  { region: "desert", area: "Telos", site: true },
  { region: "desert", area: "Heart of Gielinor", site: true },
  { region: "desert", area: "Amascut", site: true },
  { region: "desert", area: "Pyramid Plunder", site: true },
  { region: "desert", area: "Shifting Tombs", site: true },
  { region: "desert", area: "Soul altar", site: true },

  // Morytania.
  { region: "morytania", area: "Rise of the Six", site: true },
  { region: "morytania", area: "Ectofuntus", site: true },
  { region: "morytania", area: "Blood altar", site: true },
  { region: "morytania", area: "Shades of Mort'ton", site: true },
  { region: "morytania", area: "Abandoned Mine", site: true },
  { region: "morytania", area: "Temple Trekking", site: true },

  // Tirannwn — everything but Solak is inside the Prifddinas walls.
  { region: "tirannwn", area: "Solak", site: true },
  { region: "tirannwn", area: "Max Guild", site: true },
  { region: "tirannwn", area: "Hefin Agility Course", site: true },


  // Anachronia.
  { region: "anachronia", area: "Raksha", site: true },
  { region: "anachronia", area: "Rex Matriarchs", site: true },

  // Havenhythe.
  { region: "havenhythe", area: "Ivar, King of Bones", site: true },
  { region: "havenhythe", area: "Silverquill", site: true },
  { region: "havenhythe", area: "Sanguine Crawler", site: true },
];

export const PLACES_BY_REGION: ReadonlyMap<RegionId, readonly PlaceAnchor[]> = (() => {
  const grouped = new Map<RegionId, PlaceAnchor[]>();
  for (const anchor of [...PLACE_ANCHORS, ...SITE_ANCHORS]) {
    grouped.set(anchor.region, [...(grouped.get(anchor.region) ?? []), anchor]);
  }
  return grouped;
})();

export function rasterPlaceUv(place: PlaceAnchor): readonly [number, number] {
  const coordinate = placeMapCoord(place.region, place.area);
  if (!coordinate) throw new Error(`Missing map coordinate: ${place.region}/${place.area}`);
  return mapToUv(coordinate);
}

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
