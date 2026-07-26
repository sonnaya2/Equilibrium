import fs from "node:fs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const league = JSON.parse(fs.readFileSync("data/league/regions.json", "utf8"));

const areas = {
  karamja: [
    "Musa Point",
    "Brimhaven",
    "TzHaar City",
    "Tai Bwo Wannai",
    "Hardwood Grove",
    "Shilo Village",
    "Herblore Habitat",
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
};

for (const [id, list] of Object.entries(areas)) {
  const r = cat.regions.find((x) => x.id === id);
  if (r) {
    r.areas = [...list];
    console.log(id, r.areas.length);
  }
}
for (const rec of league.records) {
  const c = cat.regions.find((x) => x.id === rec.id);
  if (c) rec.areas = [...c.areas];
}

fs.writeFileSync("data/research/catalog.json", JSON.stringify(cat, null, 2) + "\n");
fs.writeFileSync("data/league/regions.json", JSON.stringify(league, null, 2) + "\n");

let anchors = fs.readFileSync("src/map/data/placeAnchors.ts", "utf8");
// Fix wrong area names on anchors
anchors = anchors.replace(
  /\{ region: "karamja", area: "Karamja", uv: \[[^\]]+\] \},?\n?/g,
  "",
);
anchors = anchors.replace(/area: "TzHaar area"/g, 'area: "TzHaar City"');
anchors = anchors.replace(/area: "Araxxor"/g, 'area: "Araxyte Hive"');
fs.writeFileSync("src/map/data/placeAnchors.ts", anchors);
console.log("areas+anchors fixed");
