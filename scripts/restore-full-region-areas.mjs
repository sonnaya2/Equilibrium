/**
 * Restore full place-first areas after normalize/league thin-set regression.
 * Catalog is source of truth; league.records[].areas mirrors catalog.
 */
import fs from "node:fs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const league = JSON.parse(fs.readFileSync("data/league/regions.json", "utf8"));

const AREAS = {
  misthalin: [
    "Lumbridge",
    "Varrock",
    "Draynor Village",
    "Fort Forinthry",
    "Varrock Dig Site",
    "City of Um",
    "Wizards' Tower",
    "Edgeville",
    "Zanaris",
  ],
  havenhythe: [
    "Wendlewick",
    "Hollow Hill",
    "Blighted Cave",
    "Eastfold Farm",
    "Highweald Forest",
    "Shrine of Inanna",
    "Amberfell",
    "Moonrise Dig Site",
    "Marigold Farm",
  ],
  karamja: [
    "Musa Point",
    "Brimhaven",
    "TzHaar City",
    "Tai Bwo Wannai",
    "Hardwood Grove",
    "Shilo Village",
    "Herblore Habitat",
  ],
  asgarnia: [
    "Falador",
    "Taverley",
    "Burthorpe",
    "Port Sarim",
    "Dwarven Mine",
    "Death Plateau",
    "Trollheim",
    "Troll Stronghold",
    "God Wars Dungeon",
    "Rimmington",
    "Entrana",
    "Ice Mountain",
    "Armadyl's Tower",
    "Invention Guild",
  ],
  kandarin: [
    "Player-Owned Farm",
    "Hall of Memories",
    "Deep Sea Fishing Hub",
    "Seers' Village",
    "Catherby",
    "Fishing Guild",
    "Ardougne",
    "Piscatoris Fishing Colony",
    "Ourania Runecrafting Altar",
    "Tree Gnome Stronghold",
    "Warforge Dig Site",
    "Memorial to Guthix",
    "Barbarian Outpost",
    "Stormguard Citadel Dig Site",
    "Temple of Ikov",
    "Howl's Floating Workshop",
    "Underground Pass",
  ],
  fremennik: [
    "Neitiznot",
    "Lunar Isle",
    "Jatizso",
    "Rellekka",
    "Waterbirth Island",
    "Miscellania",
    "Keldagrim",
    "Livid Farm",
    "Lava Flow Mine",
  ],
  forinthry: [
    "Daemonheim",
    "Wilderness Agility Course",
    "Mage of Zamorak",
    "Wilderness Crater",
    "Forinthry Dungeon",
    "Mage Arena",
    "Lava Maze",
    "Chaos Temple (Wilderness)",
    "Bandit Camp",
    "Rogues' Castle",
    "Demonic Ruins",
    "Frozen Waste Plateau",
    "Pirates' Hideout",
  ],
  desert: [
    "Menaphos",
    "Het's Oasis",
    "Kharid-et Dig Site",
    "Sophanem",
    "Garden of Kharid",
    "Al Kharid",
  ],
  morytania: [
    "Canifis",
    "Slayer Tower",
    "Port Phasmatys",
    "Araxyte Hive",
    "Darkmeyer",
    "Barrows",
    "Everlight Dig Site",
  ],
  tirannwn: ["Prifddinas", "Lost Grove", "Lletya", "Isafdar", "Port Tyras"],
  anachronia: [
    "Orthen Dig Site",
    "Anachronia base camp",
    "Ranch Out of Time",
    "Dream of Iaia",
    "Time altar",
    "Anachronia Agility Course",
    "Slayer Lodge",
  ],
};

for (const [id, list] of Object.entries(AREAS)) {
  const r = cat.regions.find((x) => x.id === id);
  if (!r) continue;
  r.areas = [...list];
  console.log(id, list.length);
}

for (const rec of league.records) {
  const c = cat.regions.find((x) => x.id === rec.id);
  if (c) rec.areas = [...c.areas];
}

fs.writeFileSync("data/research/catalog.json", JSON.stringify(cat, null, 2) + "\n");
fs.writeFileSync("data/league/regions.json", JSON.stringify(league, null, 2) + "\n");
console.log("restored");
