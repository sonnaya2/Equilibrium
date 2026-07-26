/** Shared fixture data for map-remaster mocks — not live catalog claims. */

export type FixtureRegion = {
  id: string;
  name: string;
  /** CSS layout: left/top/width/height as % of board */
  box: { l: number; t: number; w: number; h: number };
  tone: string;
  unlocked: boolean;
};

export type FixturePlace = {
  id: string;
  regionId: string;
  name: string;
  /** % of board */
  x: number;
  y: number;
  content: { name: string; kind: string }[];
  drops: { name: string; note: string }[];
};

export const FIXTURE_REGIONS: FixtureRegion[] = [
  { id: "misthalin", name: "Misthalin", box: { l: 48, t: 38, w: 18, h: 28 }, tone: "#6b5a3e", unlocked: true },
  { id: "asgarnia", name: "Asgarnia", box: { l: 34, t: 36, w: 14, h: 26 }, tone: "#5a6a4a", unlocked: true },
  { id: "kandarin", name: "Kandarin", box: { l: 18, t: 34, w: 16, h: 32 }, tone: "#4a6348", unlocked: false },
  { id: "desert", name: "Desert", box: { l: 44, t: 64, w: 20, h: 18 }, tone: "#8a7348", unlocked: false },
  { id: "morytania", name: "Morytania", box: { l: 64, t: 40, w: 16, h: 24 }, tone: "#4a3a48", unlocked: false },
  { id: "fremennik", name: "Fremennik", box: { l: 36, t: 14, w: 22, h: 16 }, tone: "#4a5868", unlocked: false },
  { id: "tirannwn", name: "Tirannwn", box: { l: 10, t: 48, w: 12, h: 22 }, tone: "#3a5240", unlocked: false },
  { id: "karamja", name: "Karamja", box: { l: 30, t: 68, w: 14, h: 16 }, tone: "#3d5a38", unlocked: false },
  { id: "wilderness", name: "Wilderness", box: { l: 46, t: 8, w: 24, h: 12 }, tone: "#4a4038", unlocked: false },
  { id: "anachronia", name: "Anachronia", box: { l: 72, t: 18, w: 14, h: 14 }, tone: "#4a6840", unlocked: false },
  { id: "menaphos", name: "Menaphos", box: { l: 58, t: 70, w: 12, h: 12 }, tone: "#9a7a42", unlocked: false },
];

export const FIXTURE_PLACES: FixturePlace[] = [
  {
    id: "varrock",
    regionId: "misthalin",
    name: "Varrock",
    x: 56,
    y: 48,
    content: [
      { name: "Varrock Museum", kind: "skilling hub" },
      { name: "Champions' Guild", kind: "combat access" },
    ],
    drops: [{ name: "Champion's scroll (fixture)", note: "illustrative only" }],
  },
  {
    id: "lumbridge",
    regionId: "misthalin",
    name: "Lumbridge",
    x: 54,
    y: 58,
    content: [
      { name: "Lumbridge Catacombs", kind: "dungeon" },
      { name: "War's Retreat access", kind: "hub" },
    ],
    drops: [],
  },
  {
    id: "falador",
    regionId: "asgarnia",
    name: "Falador",
    x: 40,
    y: 50,
    content: [
      { name: "White Knights' Castle", kind: "quest hub" },
      { name: "Mining Guild", kind: "skilling" },
    ],
    drops: [{ name: "Clue scroll (fixture)", note: "illustrative only" }],
  },
  {
    id: "gwd",
    regionId: "asgarnia",
    name: "God Wars Dungeon",
    x: 42,
    y: 40,
    content: [{ name: "God Wars Dungeon", kind: "boss dungeon" }],
    drops: [
      { name: "Godsword shard (fixture)", note: "illustrative only" },
      { name: "Armadyl component (fixture)", note: "illustrative only" },
    ],
  },
];

export const FIXTURE_PICKS = "1/3";
