"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { gameIconPath, regionCrestPath, styleIconPath } from "@/lib/gameArt";
import "./composite.css";

/**
 * Team Composite · R2 CHAMPION — Steal Matrix
 * Overview: Nova courtyard · Map: Orbit Board Sky · Tasks/Data: Prism twin desk
 * Build: Ridge Relic Court · Combat: Forge Calc Crystal · Colors: Editorial
 * Skin: .hybrid-skin--composite (composite.css). Fixture data only. No gen-AI.
 * No production globals. Orchestrator ships later.
 */

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;
type NavId = (typeof NAV)[number];

const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems", "Sources"] as const;
const BUILD_SEGS = ["Regions", "Relics", "Blessings"] as const;
const COMBAT_SEGS = ["Quick", "Setup", "Analysis", "Rotation"] as const;
const TASK_TABS = ["All tiers", "Open board", "Done", "Locked"] as const;
const TASK_FACETS = ["All", "Open", "Done", "Locked"] as const;
const DATA_FACETS = ["All kinds", "Skilling", "Combat", "Travel", "Unlock"] as const;
const STYLE_FILTERS = ["All", "Melee", "Magic", "Ranged", "Necromancy", "Defence"] as const;

const REGIONS = [
  { id: "misthalin", name: "Misthalin", note: "Varrock / Lumbridge ledger", plate: "Starter" },
  { id: "havenhythe", name: "Havenhythe", note: "Shore sister · net plate", plate: "Starter" },
  { id: "asgarnia", name: "Asgarnia", note: "Falador fort · white knight slate", plate: "Unlock" },
  { id: "karamja", name: "Karamja", note: "Island heat · TzHaar ledger", plate: "Early" },
  { id: "desert", name: "Desert", note: "Menaphos plate · heat stage", plate: "Unlock" },
  { id: "fremennik", name: "Fremennik", note: "Rellekka pier · northern haul", plate: "Unlock" },
  { id: "morytania", name: "Morytania", note: "Canifis crypt · swamp edge", plate: "Unlock" },
  { id: "tirannwn", name: "Tirannwn", note: "Crystal canopy · dust chain", plate: "Unlock" },
  { id: "kandarin", name: "Kandarin", note: "Ardougne market · seers plate", plate: "Unlock" },
  { id: "anachronia", name: "Anachronia", note: "Dig isle · archaeology cache", plate: "Unlock" },
  { id: "forinthry", name: "Forinthry", note: "Fort courtyard · wartable slab", plate: "Unlock" },
] as const;

type RegionId = (typeof REGIONS)[number]["id"];

type SourceType = "wiki" | "official" | "community" | "fixture";

type SourceRef = {
  title: string;
  url: string;
  verifiedAt: string;
  sourceType: SourceType;
  note?: string;
};

type CatalogRow = {
  id: string;
  name: string;
  region: string;
  regionId: RegionId;
  kind: "Skilling" | "Combat" | "Travel" | "Unlock";
  status: "Open" | "Locked" | "Done" | "Fixture";
  qty: number;
  note: string;
  tags: string;
  provisional: boolean;
  sources: SourceRef[];
};

type TaskRow = {
  id: string;
  title: string;
  region: string;
  regionId: RegionId;
  points: number;
  status: "Open" | "Done" | "Locked";
  tier: string;
  note: string;
  provisional: boolean;
  sources: SourceRef[];
};

type StyleId = "Melee" | "Magic" | "Ranged" | "Necromancy" | "Defence";

type AbilityRow = {
  id: string;
  name: string;
  style: StyleId;
  kind: "Basic" | "Threshold" | "Ultimate" | "Defence";
  icon: string | null;
  role: string;
  note: string;
};

/** Equilibrium T1 — names + effects from data/league/relics.json (Jagex countdown). */
const T1_RELICS = [
  {
    id: "survivalist",
    name: "Survivalist",
    mono: "SV",
    skills: ["mining", "fishing", "woodcutting", "archaeology"] as const,
    effects: [
      "Doubles resources from Mining, Fishing, Woodcutting, and Archaeology excavation hotspots.",
      "Provides powerful gathering tools for Mining, Woodcutting, and Fishing.",
      "Provides Survivalist's Bag storing up to 150 of three different log, ore, or fish types.",
    ],
    blurb:
      "Double gather yields plus Survivalist's Bag and powerful tools for Mining, Woodcutting, and Fishing.",
  },
  {
    id: "endless-harvest",
    name: "Endless Harvest",
    mono: "EH",
    skills: ["farming", "fishing", "mining", "woodcutting", "archaeology"] as const,
    effects: [
      "Archaeology, Farming, Fishing, Mining, and Woodcutting resources can be sent directly to bank or metal bank.",
      "Fishing, Mining, and Woodcutting have a 10% chance to upgrade gathered resources to the next tier.",
      "Trees are rarely felled and gathering automatically resumes when they regrow.",
      "Fishing spots can be followed automatically when they move.",
      "Mining stamina remains full.",
      "Archaeology behaves as if a Time Sprite is always active.",
    ],
    blurb:
      "Auto-bank gather, rare tree felling, full mining stamina, and always-on Time Sprite behaviour.",
  },
  {
    id: "golden-touch",
    name: "Golden Touch",
    mono: "GT",
    skills: ["agility", "thieving"] as const,
    effects: [
      "Provides Goldenhawk Boots, tier-60 hybrid boots that periodically award Agility XP while moving, skilling, or using ultimate abilities.",
      "Agility and Thieving can award Goldenhawk Feathers convertible to Prayer XP or coins.",
      "Doubles Agility course XP and prevents course or shortcut failures.",
      "Awards coins per completed Agility lap based on Agility level.",
      "Thieving checks always succeed, loot is tripled and automatically noted.",
      "Stalls never deplete, safes have no cooldown, and repeat Thieving actions continue automatically.",
      "Coins from Thieving are multiplied by 100.",
      "Chests and safes can additionally award herbs and potion ingredients sent to bank.",
    ],
    blurb:
      "Goldenhawk Boots path: Agility and Thieving success, note, and coin multipliers.",
  },
] as const;

type RelicId = (typeof T1_RELICS)[number]["id"];

const RELIC_TIERS = [
  { tier: 1, revealed: true, label: "Open" },
  { tier: 2, revealed: false, label: "Sealed" },
  { tier: 3, revealed: false, label: "Sealed" },
  { tier: 4, revealed: false, label: "Sealed" },
  { tier: 5, revealed: false, label: "Sealed" },
  { tier: 6, revealed: false, label: "Sealed" },
  { tier: 7, revealed: false, label: "Sealed" },
] as const;

const RELIC_SOURCE =
  "sources? · Jagex countdown envelope · verified 2026-07-25 · data/league/relics.json";

const BLESSING_PATHS = ["Order", "Balance", "Chaos"] as const;
const BLESSING_TIERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const BROWSE_LEAVES = [
  { id: "all", label: "All regions", crest: "misthalin" as const },
  { id: "misthalin", label: "Misthalin", crest: "misthalin" as const },
  { id: "asgarnia", label: "Asgarnia", crest: "asgarnia" as const },
  { id: "karamja", label: "Karamja", crest: "karamja" as const },
  { id: "desert", label: "Desert", crest: "desert" as const },
  { id: "fremennik", label: "Fremennik", crest: "fremennik" as const },
  { id: "morytania", label: "Morytania", crest: "morytania" as const },
  { id: "tirannwn", label: "Tirannwn", crest: "tirannwn" as const },
  { id: "kandarin", label: "Kandarin", crest: "kandarin" as const },
  { id: "anachronia", label: "Anachronia", crest: "anachronia" as const },
  { id: "forinthry", label: "Forinthry", crest: "forinthry" as const },
  { id: "havenhythe", label: "Havenhythe", crest: "havenhythe" as const },
] as const;

/* ── Fixture catalog — multi-source SourceReference (Prism DNA) ── */

const FIXTURE: CatalogRow[] = [
  {
    id: "fx-varrock-kudos",
    name: "Varrock Museum kudos path",
    region: "Misthalin",
    regionId: "misthalin",
    kind: "Skilling",
    status: "Open",
    qty: 3,
    note: "Starter corridor scaffold — demo catalog only.",
    tags: "museum · kudos · archaeology",
    provisional: true,
    sources: [
      {
        title: "Varrock Museum (wiki)",
        url: "https://runescape.wiki/w/Varrock_Museum",
        verifiedAt: "2026-03-12",
        sourceType: "wiki",
      },
      {
        title: "Fixture catalog note",
        url: "https://equilibrium-ruddy.vercel.app",
        verifiedAt: "2026-07-01",
        sourceType: "fixture",
        note: "Demo envelope — not Equilibrium published unlock.",
      },
    ],
  },
  {
    id: "fx-tzhaar-gate",
    name: "TzHaar Fight Cave access",
    region: "Karamja",
    regionId: "karamja",
    kind: "Combat",
    status: "Open",
    qty: 1,
    note: "Combat gate placeholder for crest + filter demos.",
    tags: "tzhaar · cave · combat",
    provisional: true,
    sources: [
      {
        title: "TzHaar Fight Cave",
        url: "https://runescape.wiki/w/TzHaar_Fight_Cave",
        verifiedAt: "2026-02-28",
        sourceType: "wiki",
      },
      {
        title: "Community route sketch",
        url: "https://runescape.wiki/w/TzHaar_City",
        verifiedAt: "2026-04-02",
        sourceType: "community",
      },
    ],
  },
  {
    id: "fx-warriors-guild",
    name: "Warriors' Guild tokens",
    region: "Asgarnia",
    regionId: "asgarnia",
    kind: "Combat",
    status: "Open",
    qty: 6,
    note: "Minigame sample — numbers are demo only.",
    tags: "guild · tokens · melee",
    provisional: true,
    sources: [
      {
        title: "Warriors' Guild",
        url: "https://runescape.wiki/w/Warriors%27_Guild",
        verifiedAt: "2026-01-18",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "fx-menaphos-rep",
    name: "Menaphos reputation track",
    region: "Desert",
    regionId: "desert",
    kind: "Unlock",
    status: "Locked",
    qty: 4,
    note: "Progression fixture — not a live reputation total.",
    tags: "menaphos · reputation",
    provisional: true,
    sources: [
      {
        title: "Menaphos reputation",
        url: "https://runescape.wiki/w/Menaphos_reputation",
        verifiedAt: "2026-05-09",
        sourceType: "wiki",
      },
      {
        title: "Desert region overview",
        url: "https://runescape.wiki/w/Kharidian_Desert",
        verifiedAt: "2026-05-09",
        sourceType: "wiki",
      },
      {
        title: "Fixture envelope",
        url: "https://github.com/sonnaya2/Equilibrium",
        verifiedAt: "2026-07-10",
        sourceType: "fixture",
      },
    ],
  },
  {
    id: "fx-frem-sagas",
    name: "Fremennik sagas re-clear",
    region: "Fremennik",
    regionId: "fremennik",
    kind: "Travel",
    status: "Done",
    qty: 2,
    note: "Northern sample for sticky thead stress.",
    tags: "sagas · fremennik",
    provisional: true,
    sources: [
      {
        title: "Fremennik Sagas",
        url: "https://runescape.wiki/w/Fremennik_Sagas",
        verifiedAt: "2026-03-01",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "fx-canifis-tower",
    name: "Canifis slayer tower route",
    region: "Morytania",
    regionId: "morytania",
    kind: "Combat",
    status: "Open",
    qty: 8,
    note: "Slayer corridor fixture — path triad not used as chrome.",
    tags: "slayer · tower · morytania",
    provisional: true,
    sources: [
      {
        title: "Slayer Tower",
        url: "https://runescape.wiki/w/Slayer_Tower",
        verifiedAt: "2026-04-20",
        sourceType: "wiki",
      },
      {
        title: "Canifis",
        url: "https://runescape.wiki/w/Canifis",
        verifiedAt: "2026-04-20",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "fx-prif-seed",
    name: "Prifddinas crystal seed loop",
    region: "Tirannwn",
    regionId: "tirannwn",
    kind: "Skilling",
    status: "Locked",
    qty: 5,
    note: "Crystal economy demo row — not league math.",
    tags: "prif · crystal · seed",
    provisional: true,
    sources: [
      {
        title: "Crystal seed",
        url: "https://runescape.wiki/w/Crystal_seed",
        verifiedAt: "2026-06-11",
        sourceType: "wiki",
      },
      {
        title: "Prifddinas",
        url: "https://runescape.wiki/w/Prifddinas",
        verifiedAt: "2026-06-11",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "fx-seers-diary",
    name: "Seers' Village diary set",
    region: "Kandarin",
    regionId: "kandarin",
    kind: "Unlock",
    status: "Open",
    qty: 4,
    note: "Diary set scaffold for unlock facet.",
    tags: "diary · seers",
    provisional: true,
    sources: [
      {
        title: "Seers' Village achievements",
        url: "https://runescape.wiki/w/Seers%27_Village_achievements",
        verifiedAt: "2026-02-14",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "fx-ana-totem",
    name: "Anachronia totem sites",
    region: "Anachronia",
    regionId: "anachronia",
    kind: "Skilling",
    status: "Locked",
    qty: 7,
    note: "Island unlock placeholder.",
    tags: "totem · anachronia",
    provisional: true,
    sources: [
      {
        title: "Anachronia",
        url: "https://runescape.wiki/w/Anachronia",
        verifiedAt: "2026-05-30",
        sourceType: "wiki",
      },
      {
        title: "Fixture catalog",
        url: "https://equilibrium-ruddy.vercel.app",
        verifiedAt: "2026-07-01",
        sourceType: "fixture",
      },
    ],
  },
  {
    id: "fx-fort-shop",
    name: "Fort Forinthry workshop",
    region: "Forinthry",
    regionId: "forinthry",
    kind: "Travel",
    status: "Open",
    qty: 3,
    note: "Construction workshop sample.",
    tags: "fort · workshop",
    provisional: true,
    sources: [
      {
        title: "Fort Forinthry",
        url: "https://runescape.wiki/w/Fort_Forinthry",
        verifiedAt: "2026-06-02",
        sourceType: "wiki",
      },
      {
        title: "Official news archive (pattern)",
        url: "https://www.runescape.com/news",
        verifiedAt: "2026-06-02",
        sourceType: "official",
      },
    ],
  },
  {
    id: "fx-haven-landing",
    name: "Havenhythe landing notes",
    region: "Havenhythe",
    regionId: "havenhythe",
    kind: "Travel",
    status: "Fixture",
    qty: 2,
    note: "Newest region fixture — thin corpus intentional.",
    tags: "havenhythe · landing",
    provisional: true,
    sources: [
      {
        title: "Fixture only — no secondary scrape",
        url: "https://github.com/sonnaya2/Equilibrium",
        verifiedAt: "2026-07-15",
        sourceType: "fixture",
      },
    ],
  },
  {
    id: "fx-lumbridge-church",
    name: "Lumbridge church prayer route",
    region: "Misthalin",
    regionId: "misthalin",
    kind: "Skilling",
    status: "Done",
    qty: 1,
    note: "Starter prayer fixture for Done-state filter.",
    tags: "prayer · lumbridge",
    provisional: true,
    sources: [
      {
        title: "Lumbridge",
        url: "https://runescape.wiki/w/Lumbridge",
        verifiedAt: "2026-01-10",
        sourceType: "wiki",
      },
      {
        title: "Prayer skill",
        url: "https://runescape.wiki/w/Prayer",
        verifiedAt: "2026-01-10",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "fx-edgeville-dung",
    name: "Edgeville dungeon sweep",
    region: "Misthalin",
    regionId: "misthalin",
    kind: "Combat",
    status: "Open",
    qty: 5,
    note: "Low-tier combat corridor sample.",
    tags: "edgeville · dungeon",
    provisional: true,
    sources: [
      {
        title: "Edgeville Dungeon",
        url: "https://runescape.wiki/w/Edgeville_Dungeon",
        verifiedAt: "2026-03-18",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "fx-port-sarim",
    name: "Port Sarim charter board",
    region: "Asgarnia",
    regionId: "asgarnia",
    kind: "Travel",
    status: "Open",
    qty: 2,
    note: "Travel node scaffold.",
    tags: "port · charter",
    provisional: true,
    sources: [
      {
        title: "Port Sarim",
        url: "https://runescape.wiki/w/Port_Sarim",
        verifiedAt: "2026-02-22",
        sourceType: "wiki",
      },
      {
        title: "Charter ships",
        url: "https://runescape.wiki/w/Charter_ships",
        verifiedAt: "2026-02-22",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "fx-brimhaven",
    name: "Brimhaven agility arena",
    region: "Karamja",
    regionId: "karamja",
    kind: "Skilling",
    status: "Locked",
    qty: 3,
    note: "Agility minigame stand-in.",
    tags: "agility · brimhaven",
    provisional: true,
    sources: [
      {
        title: "Brimhaven Agility Arena",
        url: "https://runescape.wiki/w/Brimhaven_Agility_Arena",
        verifiedAt: "2026-04-05",
        sourceType: "wiki",
      },
      {
        title: "Community ticket notes",
        url: "https://runescape.wiki/w/Brimhaven",
        verifiedAt: "2026-04-12",
        sourceType: "community",
      },
    ],
  },
];

const TASKS: TaskRow[] = [
  {
    id: "t1",
    title: "Reach total level 500",
    region: "Misthalin",
    regionId: "misthalin",
    points: 30,
    status: "Open",
    tier: "Easy",
    note: "Catalyst stand-in until Equilibrium list publishes.",
    provisional: true,
    sources: [
      {
        title: "Catalyst snapshot (provisional)",
        url: "https://runescape.wiki/w/Leagues",
        verifiedAt: "2026-07-01",
        sourceType: "fixture",
      },
      {
        title: "Leagues overview",
        url: "https://runescape.wiki/w/Leagues",
        verifiedAt: "2026-06-20",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "t2",
    title: "Complete a hard diary",
    region: "Asgarnia",
    regionId: "asgarnia",
    points: 40,
    status: "Open",
    tier: "Medium",
    note: "Diary scaffold — points demo only.",
    provisional: true,
    sources: [
      {
        title: "Achievement diaries",
        url: "https://runescape.wiki/w/Achievements",
        verifiedAt: "2026-05-15",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "t3",
    title: "Kill a God Wars general",
    region: "Asgarnia",
    regionId: "asgarnia",
    points: 50,
    status: "Locked",
    tier: "Hard",
    note: "Combat task stand-in; no kill-time sim.",
    provisional: true,
    sources: [
      {
        title: "God Wars Dungeon",
        url: "https://runescape.wiki/w/God_Wars_Dungeon",
        verifiedAt: "2026-04-08",
        sourceType: "wiki",
      },
      {
        title: "Fixture task envelope",
        url: "https://equilibrium-ruddy.vercel.app",
        verifiedAt: "2026-07-10",
        sourceType: "fixture",
      },
    ],
  },
  {
    id: "t4",
    title: "Train Slayer to 70",
    region: "Morytania",
    regionId: "morytania",
    points: 35,
    status: "Done",
    tier: "Medium",
    note: "Done-state row for facet filter proof.",
    provisional: true,
    sources: [
      {
        title: "Slayer",
        url: "https://runescape.wiki/w/Slayer",
        verifiedAt: "2026-03-22",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "t5",
    title: "Unlock a lodestone network",
    region: "Karamja",
    regionId: "karamja",
    points: 20,
    status: "Done",
    tier: "Easy",
    note: "Travel unlock stand-in.",
    provisional: true,
    sources: [
      {
        title: "Lodestone Network",
        url: "https://runescape.wiki/w/Lodestone_Network",
        verifiedAt: "2026-02-01",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "t6",
    title: "Finish a master quest",
    region: "Tirannwn",
    regionId: "tirannwn",
    points: 60,
    status: "Locked",
    tier: "Elite",
    note: "Quest gate placeholder.",
    provisional: true,
    sources: [
      {
        title: "Quests",
        url: "https://runescape.wiki/w/Quests",
        verifiedAt: "2026-06-18",
        sourceType: "wiki",
      },
      {
        title: "Tirannwn",
        url: "https://runescape.wiki/w/Tirannwn",
        verifiedAt: "2026-06-18",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "t7",
    title: "Gather 1,000 harmonic dust",
    region: "Tirannwn",
    regionId: "tirannwn",
    points: 25,
    status: "Open",
    tier: "Medium",
    note: "Skilling volume sample — not published Equilibrium points.",
    provisional: true,
    sources: [
      {
        title: "Harmonic dust",
        url: "https://runescape.wiki/w/Harmonic_dust",
        verifiedAt: "2026-05-01",
        sourceType: "wiki",
      },
      {
        title: "Crystal economy notes",
        url: "https://runescape.wiki/w/Crystal_seed",
        verifiedAt: "2026-05-01",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "t8",
    title: "Clear a raid wing once",
    region: "Kandarin",
    regionId: "kandarin",
    points: 80,
    status: "Locked",
    tier: "Elite",
    note: "Raid stand-in; no phase sim.",
    provisional: true,
    sources: [
      {
        title: "Raids",
        url: "https://runescape.wiki/w/Raids",
        verifiedAt: "2026-04-30",
        sourceType: "wiki",
      },
      {
        title: "Community clear notes",
        url: "https://runescape.wiki/w/Raids",
        verifiedAt: "2026-05-12",
        sourceType: "community",
      },
      {
        title: "Fixture provisional row",
        url: "https://github.com/sonnaya2/Equilibrium",
        verifiedAt: "2026-07-12",
        sourceType: "fixture",
      },
    ],
  },
  {
    id: "t9",
    title: "Visit every region crest board",
    region: "Misthalin",
    regionId: "misthalin",
    points: 15,
    status: "Open",
    tier: "Easy",
    note: "Meta board task for twin-desk density demos.",
    provisional: true,
    sources: [
      {
        title: "Fixture meta task",
        url: "https://equilibrium-ruddy.vercel.app",
        verifiedAt: "2026-07-20",
        sourceType: "fixture",
      },
    ],
  },
  {
    id: "t10",
    title: "Bind combat style once",
    region: "Asgarnia",
    regionId: "asgarnia",
    points: 10,
    status: "Open",
    tier: "Easy",
    note: "Links Tasks desk to Combat empty bay narrative.",
    provisional: true,
    sources: [
      {
        title: "Combat styles",
        url: "https://runescape.wiki/w/Combat",
        verifiedAt: "2026-03-05",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "t11",
    title: "Haul Rellekka pier nets",
    region: "Fremennik",
    regionId: "fremennik",
    points: 25,
    status: "Done",
    tier: "Easy",
    note: "Fishing volume stand-in.",
    provisional: true,
    sources: [
      {
        title: "Rellekka",
        url: "https://runescape.wiki/w/Rellekka",
        verifiedAt: "2026-03-08",
        sourceType: "wiki",
      },
      {
        title: "Fishing",
        url: "https://runescape.wiki/w/Fishing",
        verifiedAt: "2026-03-08",
        sourceType: "wiki",
      },
    ],
  },
  {
    id: "t12",
    title: "Excavate an Anachronia hotspot",
    region: "Anachronia",
    regionId: "anachronia",
    points: 45,
    status: "Open",
    tier: "Hard",
    note: "Archaeology task stand-in.",
    provisional: true,
    sources: [
      {
        title: "Archaeology",
        url: "https://runescape.wiki/w/Archaeology",
        verifiedAt: "2026-05-28",
        sourceType: "wiki",
      },
      {
        title: "Anachronia dig sites",
        url: "https://runescape.wiki/w/Anachronia",
        verifiedAt: "2026-05-28",
        sourceType: "wiki",
      },
    ],
  },
];

/**
 * Ability catalog — real names + real icons when present.
 * Math fields intentionally vacant (Forge vacancy law).
 */
const ABILITIES: AbilityRow[] = [
  {
    id: "greater-barge",
    name: "Greater Barge",
    style: "Melee",
    kind: "Threshold",
    icon: "/game/combat/abilities/melee/greater-barge.png",
    role: "Gap close",
    note: "Bar slot · math empty until core bind",
  },
  {
    id: "assault",
    name: "Assault",
    style: "Melee",
    kind: "Threshold",
    icon: "/game/combat/abilities/melee/assault.png",
    role: "Channel",
    note: "Channel placeholder · no hit sim",
  },
  {
    id: "berserk",
    name: "Berserk",
    style: "Melee",
    kind: "Ultimate",
    icon: "/game/combat/abilities/melee/berserk.png",
    role: "DPS window",
    note: "Ultimate window · DPL unbound",
  },
  {
    id: "meteor-strike",
    name: "Meteor Strike",
    style: "Melee",
    kind: "Threshold",
    icon: "/game/combat/abilities/melee/meteor-strike.png",
    role: "Finisher",
    note: "Threshold · adren vacancy",
  },
  {
    id: "overpower",
    name: "Overpower",
    style: "Melee",
    kind: "Ultimate",
    icon: "/game/combat/abilities/melee/overpower.png",
    role: "Burst",
    note: "Ultimate burst · unbound",
  },
  {
    id: "greater-flurry",
    name: "Greater Flurry",
    style: "Melee",
    kind: "Threshold",
    icon: "/game/combat/abilities/melee/greater-flurry.png",
    role: "Channel",
    note: "Style catalog density",
  },
  {
    id: "slaughter",
    name: "Slaughter",
    style: "Melee",
    kind: "Threshold",
    icon: "/game/combat/abilities/melee/slaughter.png",
    role: "Bleed",
    note: "Bleed tag only · no DoT math",
  },
  {
    id: "chaos-roar",
    name: "Chaos Roar",
    style: "Melee",
    kind: "Threshold",
    icon: "/game/combat/abilities/melee/chaos-roar.png",
    role: "Buff",
    note: "Buff-only · Quick excludes in product",
  },
  {
    id: "sunshine",
    name: "Sunshine",
    style: "Magic",
    kind: "Ultimate",
    icon: "/game/combat/abilities/magic/sunshine.png",
    role: "DPS window",
    note: "Magic ultimate · DPL vacancy",
  },
  {
    id: "greater-concentrated-blast",
    name: "Greater Concentrated Blast",
    style: "Magic",
    kind: "Basic",
    icon: "/game/combat/abilities/magic/greater-concentrated-blast.png",
    role: "Core basic",
    note: "Basic chain · cost unbound",
  },
  {
    id: "greater-chain",
    name: "Greater Chain",
    style: "Magic",
    kind: "Basic",
    icon: "/game/combat/abilities/magic/greater-chain.png",
    role: "AoE tag",
    note: "AoE structure · no multi-hit invent",
  },
  {
    id: "magma-tempest",
    name: "Magma Tempest",
    style: "Magic",
    kind: "Threshold",
    icon: "/game/combat/abilities/magic/magma-tempest.png",
    role: "Ground",
    note: "Threshold · empty adren well",
  },
  {
    id: "wild-magic",
    name: "Wild Magic",
    style: "Magic",
    kind: "Threshold",
    icon: "/game/combat/abilities/magic/wild-magic.png",
    role: "Burst",
    note: "Catalog density · unbound",
  },
  {
    id: "deaths-swiftness",
    name: "Death's Swiftness",
    style: "Ranged",
    kind: "Ultimate",
    icon: "/game/combat/abilities/ranged/deaths-swiftness.png",
    role: "DPS window",
    note: "Ranged ultimate · unbound",
  },
  {
    id: "greater-ricochet",
    name: "Greater Ricochet",
    style: "Ranged",
    kind: "Basic",
    icon: "/game/combat/abilities/ranged/greater-ricochet.png",
    role: "Core basic",
    note: "Basic · style filter density",
  },
  {
    id: "bombardment",
    name: "Bombardment",
    style: "Ranged",
    kind: "Threshold",
    icon: "/game/combat/abilities/ranged/bombardment.png",
    role: "AoE",
    note: "Threshold · no invent DPL",
  },
  {
    id: "shadow-tendrils",
    name: "Shadow Tendrils",
    style: "Ranged",
    kind: "Threshold",
    icon: "/game/combat/abilities/ranged/shadow-tendrils.png",
    role: "Burst",
    note: "Catalog only",
  },
  {
    id: "rapid-fire",
    name: "Rapid Fire",
    style: "Ranged",
    kind: "Threshold",
    icon: "/game/combat/abilities/ranged/rapid-fire.png",
    role: "Channel",
    note: "Channel · adren vacancy",
  },
  {
    id: "living-death",
    name: "Living Death",
    style: "Necromancy",
    kind: "Ultimate",
    icon: "/game/combat/abilities/necromancy/living-death.png",
    role: "DPS window",
    note: "Necro ultimate · vacancy",
  },
  {
    id: "split-soul",
    name: "Split Soul",
    style: "Necromancy",
    kind: "Threshold",
    icon: "/game/combat/abilities/necromancy/split-soul.png",
    role: "Conduit",
    note: "Threshold · adren empty",
  },
  {
    id: "invoke-lord-of-bones",
    name: "Invoke Lord of Bones",
    style: "Necromancy",
    kind: "Threshold",
    icon: "/game/combat/abilities/necromancy/invoke-lord-of-bones.png",
    role: "Conjure",
    note: "Conjure structure · no sim",
  },
  {
    id: "finger-of-death",
    name: "Finger of Death",
    style: "Necromancy",
    kind: "Threshold",
    icon: "/game/combat/abilities/necromancy/finger-of-death.png",
    role: "Execute",
    note: "Execute tag · no HP% invent",
  },
  {
    id: "resonance",
    name: "Resonance",
    style: "Defence",
    kind: "Defence",
    icon: "/game/combat/abilities/defence/resonance.png",
    role: "Heal",
    note: "Defence · not a DPL source",
  },
  {
    id: "devotion",
    name: "Devotion",
    style: "Defence",
    kind: "Defence",
    icon: "/game/combat/abilities/defence/devotion.png",
    role: "Mitigate",
    note: "Mitigation · math empty",
  },
  {
    id: "debilitate",
    name: "Debilitate",
    style: "Defence",
    kind: "Defence",
    icon: "/game/combat/abilities/defence/debilitate.png",
    role: "Reflect",
    note: "Defence catalog",
  },
  {
    id: "freedom",
    name: "Freedom",
    style: "Defence",
    kind: "Defence",
    icon: "/game/combat/abilities/defence/freedom.png",
    role: "Cleanse",
    note: "Utility · no damage math",
  },
  {
    id: "barricade",
    name: "Barricade",
    style: "Defence",
    kind: "Defence",
    icon: "/game/combat/abilities/defence/barricade.png",
    role: "Immunity",
    note: "Ultimate-class defence · vacant",
  },
];

const TARGET_FIELDS = [
  { label: "Defence", value: "—" },
  { label: "Affinity", value: "—" },
  { label: "Size", value: "1×1" },
  { label: "HP %", value: "100" },
  { label: "Vulnerability", value: "Off" },
  { label: "Poisonable", value: "Yes" },
  { label: "Slayer category", value: "—" },
  { label: "Creature type", value: "Generic" },
] as const;

const INITIAL_PICKS: RegionId[] = ["misthalin", "asgarnia"];

/* ── Atoms ─────────────────────────────────────────────────── */

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <GameIcon src={regionCrestPath(id)} size={size} className="shrink-0" alt="" />
  );
}

function SkillIcon({ id, size = 14 }: { id: string; size?: number }) {
  return (
    <GameIcon
      src={gameIconPath("skills", id)}
      size={size}
      className="shrink-0"
      alt=""
    />
  );
}

function StyleIcon({
  style,
  size = 16,
}: {
  style: StyleId | "All";
  size?: number;
}) {
  if (style === "All" || style === "Defence") {
    return (
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          display: "inline-block",
          borderRadius: 2,
          background: "var(--echo-raised)",
          border: "1px solid var(--echo-border)",
        }}
      />
    );
  }
  const key = style.toLowerCase() as "melee" | "ranged" | "magic" | "necromancy";
  return <GameIcon src={styleIconPath(key)} size={size} className="shrink-0" alt="" />;
}

function AbilityIcon({ row, size = 20 }: { row: AbilityRow; size?: number }) {
  if (row.icon) {
    return <GameIcon src={row.icon} size={size} className="shrink-0" alt="" />;
  }
  return <StyleIcon style={row.style} size={size} />;
}

function VacancyWell({ label, caption }: { label: string; caption: string }) {
  return (
    <div className="comp-vacancy" role="status">
      <span className="comp-vacancy__k">{label}</span>
      <span className="comp-vacancy__v" aria-hidden="true">
        —
      </span>
      <span className="comp-vacancy__cap">{caption}</span>
    </div>
  );
}

function KeyFigure({
  label,
  value,
  vacant = false,
}: {
  label: string;
  value: string;
  vacant?: boolean;
}) {
  return (
    <div className="comp-key-figure">
      <p className="comp-key-figure__k">{label}</p>
      <p className={`comp-key-figure__v${vacant ? " is-vacant" : ""}`}>{value}</p>
    </div>
  );
}

function SourceList({ sources }: { sources: readonly SourceRef[] }) {
  return (
    <div className="comp-sources">
      <p className="comp-sources-label">
        Sources · {sources.length} {sources.length === 1 ? "entry" : "entries"}
      </p>
      {sources.length === 0 ? (
        <p className="comp-note" style={{ margin: 0 }}>
          No sources attached — honest empty.
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`} className="comp-source-card">
              <p className="comp-source-title">{s.title}</p>
              <a
                className="comp-source-url"
                href={s.url}
                target="_blank"
                rel="noreferrer"
              >
                {s.url}
              </a>
              <p className="comp-source-meta">
                <span className="comp-source-type">{s.sourceType}</span>
                <span>verified {s.verifiedAt}</span>
                {s.note ? <span>{s.note}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SegmentTabs({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: readonly string[];
  active: string;
  onChange: (t: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="comp-seg" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={t === active}
          className={`comp-seg__btn${t === active ? " is-active" : ""}`}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function FacetChips({
  options,
  active,
  onChange,
  ariaLabel,
  counts,
}: {
  options: readonly string[];
  active: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  counts?: Record<string, number>;
}) {
  return (
    <div className="comp-facets" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = o === active;
        return (
          <button
            key={o}
            type="button"
            className={`comp-facet${on ? " is-on" : ""}`}
            aria-pressed={on}
            onClick={() => onChange(o)}
          >
            {o}
            {counts ? (
              <span
                className="font-mono text-[10px]"
                style={{ color: on ? "var(--echo-gem)" : "var(--echo-parch-400)" }}
              >
                {counts[o] ?? 0}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function LatticeTabs({
  tabs,
  active,
  onChange,
  ariaLabel,
}: {
  tabs: readonly string[];
  active: string;
  onChange: (t: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="comp-lattice" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={t === active}
          className={`comp-lattice__btn${t === active ? " is-on" : ""}`}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function CrestRail({
  active,
  onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <aside className="comp-crest-rail" aria-label="Region browse rail">
      {BROWSE_LEAVES.map((leaf) => {
        const on = leaf.id === active;
        return (
          <button
            key={leaf.id}
            type="button"
            className={`comp-crest-leaf${on ? " is-on" : ""}`}
            aria-pressed={on}
            onClick={() => onChange(leaf.id)}
          >
            <Crest id={leaf.crest} size={16} />
            <span>{leaf.label}</span>
          </button>
        );
      })}
    </aside>
  );
}

function CompNav({
  active,
  onChange,
  picks,
  relicMono,
}: {
  active: NavId;
  onChange: (id: NavId) => void;
  picks: number;
  relicMono: string | null;
}) {
  return (
    <header className="comp-mast">
      <p className="comp-brand">EQUILIBRIUM</p>
      <nav aria-label="Primary">
        <ul className="comp-nav">
          {NAV.map((label) => {
            const on = label === active;
            return (
              <li key={label}>
                <button
                  type="button"
                  className={`comp-nav__btn${on ? " is-active" : ""}`}
                  aria-current={on ? "page" : undefined}
                  onClick={() => onChange(label)}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="comp-nav__meta">
        picks <strong>{picks}/3</strong>
        {relicMono ? (
          <>
            {" "}
            · T1 <strong>{relicMono}</strong>
          </>
        ) : null}
        {" · "}
        composite R2
      </p>
    </header>
  );
}

/* ── Overview · Nova courtyard gate ────────────────────────── */

function OverviewPane({
  picks,
  taskDone,
  taskTotal,
  relicName,
  relicMono,
}: {
  picks: readonly RegionId[];
  taskDone: number;
  taskTotal: number;
  relicName: string | null;
  relicMono: string | null;
}) {
  const picked = REGIONS.filter((r) => picks.includes(r.id));
  const slots: ((typeof REGIONS)[number] | null)[] = [0, 1, 2].map(
    (i) => picked[i] ?? null,
  );

  return (
    <div className="comp-courtyard">
      <header className="comp-lintel">
        <h2 className="comp-lintel__title">Courtyard plan</h2>
        <p className="comp-lintel__meta">Leagues II · Equilibrium · fixture</p>
      </header>

      <div className="comp-gate">
        <aside className="comp-jamb comp-jamb--west" aria-label="Region picks">
          <p className="comp-jamb__label">Standing picks</p>
          {slots.map((r, i) =>
            r ? (
              <div key={r.id} className="comp-standing">
                <Crest id={r.id} size={26} />
                <p className="comp-standing__name">{r.name}</p>
              </div>
            ) : (
              <div key={`empty-${i}`} className="comp-standing is-empty">
                Slot {i + 1}
              </div>
            ),
          )}
        </aside>

        <div className="comp-aperture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/keyart-2026.jpg" alt="" />
          <p className="comp-aperture__caption">Fort gate · living world</p>
        </div>

        <aside className="comp-jamb comp-jamb--east" aria-label="Plan milestones">
          <p className="comp-jamb__label">Milestones</p>
          <div className="comp-milestone">
            <p className="comp-milestone__k">Picks</p>
            <p className="comp-milestone__v">{picks.length}/3</p>
          </div>
          <div className="comp-milestone">
            <p className="comp-milestone__k">Tasks</p>
            <p className="comp-milestone__v">
              {taskDone}/{taskTotal}
            </p>
          </div>
          <div className="comp-milestone">
            <p className="comp-milestone__k">Catalog</p>
            <p className="comp-milestone__v">{FIXTURE.length}</p>
          </div>
          <div className="comp-milestone">
            <p className="comp-milestone__k">T1 Relic</p>
            <p className={`comp-milestone__v${relicMono ? "" : " is-quiet"}`}>
              {relicMono ?? "Open"}
            </p>
          </div>
          <div className="comp-milestone">
            <p className="comp-milestone__k">Blessings</p>
            <p className="comp-milestone__v is-quiet">Unrevealed</p>
          </div>
        </aside>
      </div>

      <div className="comp-desk">
        <div className="comp-desk__grid">
          <div className="comp-panel comp-panel--slate">
            <div className="comp-panel__head">Plan ledger</div>
            <div className="comp-panel__body">
              <dl className="comp-ledger">
                <dt>Region picks</dt>
                <dd>
                  <span className="mono" style={{ color: "var(--echo-gem)" }}>
                    {picks.length}/3
                  </span>
                  {picked.length > 0 ? (
                    <span style={{ color: "var(--echo-parch-100)" }}>
                      {" "}
                      · {picked.map((r) => r.name).join(" · ")}
                    </span>
                  ) : (
                    <span style={{ color: "var(--echo-parch-300)" }}>
                      {" "}
                      · none chosen — open Build or Map
                    </span>
                  )}
                </dd>
                <dt>Tasks</dt>
                <dd>
                  <span className="mono">
                    {taskDone}/{taskTotal}
                  </span>{" "}
                  done · Catalyst stand-ins
                </dd>
                <dt>Relic T1</dt>
                <dd>
                  {relicName
                    ? `${relicName} (${relicMono})`
                    : "Court open — seat on Build → Relics"}
                </dd>
                <dt>Blessings</dt>
                <dd>Empty until official reveal</dd>
                <dt>Mode</dt>
                <dd>Ironman · self-sufficient</dd>
              </dl>
              <p className="comp-note">
                sources? · verified fixture only · demo catalog
              </p>
            </div>
          </div>

          <div className="comp-panel comp-panel--carved">
            <div className="comp-panel__head">Next on the board</div>
            <div className="comp-panel__body space-y-2 text-[13px]">
              <p className="m-0" style={{ color: "var(--echo-parch-50)" }}>
                {picks.length < 3
                  ? "Finish three region picks on Map (Board Sky) or Build."
                  : "Region cap filled. Seat a T1 relic or open Combat vacancy desk."}
              </p>
              <ul
                className="m-0 list-none space-y-1.5 p-0"
                style={{ color: "var(--echo-parch-100)" }}
              >
                <li className="flex items-center gap-2">
                  <span
                    className="font-mono text-[11px]"
                    style={{
                      color:
                        picks.length >= 3
                          ? "var(--echo-gem)"
                          : "var(--echo-parch-400)",
                    }}
                  >
                    {picks.length >= 3 ? "ok" : "··"}
                  </span>
                  Regions {picks.length}/3
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="font-mono text-[11px]"
                    style={{
                      color: relicMono ? "var(--echo-gem)" : "var(--echo-parch-400)",
                    }}
                  >
                    {relicMono ? "ok" : "··"}
                  </span>
                  T1 relic {relicName ? "seated" : "open"}
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: "var(--echo-parch-400)" }}
                  >
                    ··
                  </span>
                  Blessings locked empty
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: "var(--echo-parch-400)" }}
                  >
                    ··
                  </span>
                  Combat DPL unbound
                </li>
              </ul>
              <p className="comp-note pt-1">
                No invented league numbers. Empty means empty.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Map · Orbit Board Sky (NO RegionInspector) ────────────── */

function MapPane({
  picks,
  onToggle,
  onClear,
}: {
  picks: readonly RegionId[];
  onToggle: (id: RegionId) => void;
  onClear: () => void;
}) {
  const [focus, setFocus] = useState<RegionId>("misthalin");
  const active = REGIONS.find((r) => r.id === focus) ?? REGIONS[0];
  const isPicked = picks.includes(active.id);
  const atCap = picks.length >= 3;
  const terrainSrc = `/game/terrain/${active.id}.png`;
  const pickLabel = `${picks.length}/3`;

  return (
    <div className="comp-map" data-signature="board-sky">
      <aside className="comp-ledger-col" aria-label="Region ledger">
        <div className="comp-ledger-head">
          <h2 className="comp-ledger-title">Region ledger</h2>
          <span className="comp-pick-count" aria-live="polite">
            {pickLabel}
          </span>
          <button
            type="button"
            className="comp-btn ml-auto"
            disabled={picks.length === 0}
            onClick={onClear}
          >
            Clear picks
          </button>
        </div>

        <p className="comp-note px-3 pt-2">
          Board Sky · focus lives in the ledger · no RegionInspector
        </p>

        <ul className="comp-region-list">
          {REGIONS.map((r) => {
            const picked = picks.includes(r.id);
            const focused = r.id === focus;
            const disabled = !picked && atCap;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`comp-region-btn${picked ? " is-picked" : ""}${focused ? " is-focus" : ""}`}
                  aria-pressed={picked}
                  aria-disabled={disabled || undefined}
                  onClick={() => {
                    setFocus(r.id);
                    if (disabled) return;
                    onToggle(r.id);
                  }}
                >
                  <Crest id={r.id} size={18} />
                  <span className="font-medium" style={{ color: "inherit" }}>
                    {r.name}
                  </span>
                  {picked ? (
                    <span
                      className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em]"
                      style={{ color: "var(--echo-gem)" }}
                    >
                      pick
                    </span>
                  ) : (
                    <span
                      className="ml-auto text-[10px]"
                      style={{ color: "var(--echo-parch-400)" }}
                    >
                      {r.plate}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Focus card — ledger-local detail, NOT an inspector column */}
        <section className="comp-focus-card" aria-live="polite">
          <div className="mb-2 flex items-center gap-2">
            <Crest id={active.id} size={28} />
            <h3>{active.name}</h3>
          </div>
          <p className="m-0 text-[13px]" style={{ color: "var(--echo-parch-50)" }}>
            {active.note}
          </p>
          <dl
            className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]"
            style={{ margin: "0.5rem 0 0" }}
          >
            <dt style={{ color: "var(--echo-parch-300)" }}>Plate</dt>
            <dd className="m-0" style={{ color: "var(--echo-parch-100)" }}>
              {active.plate}
            </dd>
            <dt style={{ color: "var(--echo-parch-300)" }}>Status</dt>
            <dd className="m-0" style={{ color: "var(--echo-parch-50)" }}>
              {isPicked ? "In plan" : atCap ? "Cap reached" : "Available"}
            </dd>
            <dt style={{ color: "var(--echo-parch-300)" }}>Fixture rows</dt>
            <dd className="m-0 font-mono" style={{ color: "var(--echo-gem)" }}>
              {FIXTURE.filter((f) => f.regionId === active.id).length}
            </dd>
            <dt style={{ color: "var(--echo-parch-300)" }}>sources?</dt>
            <dd className="m-0 text-[11px]" style={{ color: "var(--echo-parch-300)" }}>
              verified fixture · Data desk holds full refs
            </dd>
          </dl>
          <button
            type="button"
            className="comp-btn comp-btn--gem mt-3 w-full"
            style={{ width: "100%" }}
            aria-disabled={!isPicked && atCap ? true : undefined}
            onClick={() => {
              if (!isPicked && atCap) return;
              onToggle(active.id);
            }}
          >
            {isPicked ? "Remove pick" : atCap ? "Pick cap reached" : "Add to plan"}
          </button>
          <p className="comp-note mt-2">
            Ledger buttons toggle picks · board markers focus the ledger card
          </p>
        </section>
      </aside>

      {/* Tall 3D board zone — MapLoader-shaped mock · NO third column */}
      <div className="comp-board" role="region" aria-label="3D board">
        <p className="comp-board__label">3D board</p>
        <div className="comp-board__sky" aria-hidden="true" />
        <div className="comp-board__table">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="comp-board__terrain"
            src={terrainSrc}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
            }}
          />
          <div className="comp-board__veil" aria-hidden="true" />
          <ul className="comp-board__markers">
            {REGIONS.map((r) => {
              const picked = picks.includes(r.id);
              const focused = r.id === focus;
              return (
                <li key={r.id} style={{ listStyle: "none" }}>
                  <button
                    type="button"
                    className={`comp-board__marker${picked ? " is-picked" : ""}${focused ? " is-focus" : ""}`}
                    onClick={() => setFocus(r.id)}
                    aria-label={`${r.name}${picked ? ", picked" : ""}`}
                  >
                    <Crest id={r.id} size={22} />
                    <span>{r.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="comp-board__fallback">no WebGPU · board mock only</p>
        </div>
      </div>
    </div>
  );
}

/* ── Tasks · Prism twin desk ───────────────────────────────── */

function TasksPane() {
  const [tab, setTab] = useState<string>(TASK_TABS[0]);
  const [regionFilter, setRegionFilter] = useState("all");
  const [facet, setFacet] = useState<string>(TASK_FACETS[0]);
  const [query, setQuery] = useState("");
  const [row, setRow] = useState(0);

  const filtered = useMemo(() => {
    let list = [...TASKS];
    if (tab === "Open board") list = list.filter((t) => t.status === "Open");
    if (tab === "Done") list = list.filter((t) => t.status === "Done");
    if (tab === "Locked") list = list.filter((t) => t.status === "Locked");
    if (regionFilter !== "all") {
      list = list.filter((t) => t.regionId === regionFilter);
    }
    if (facet !== "All") {
      list = list.filter((t) => t.status === facet);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.region.toLowerCase().includes(q) ||
          t.tier.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tab, regionFilter, facet, query]);

  const selected = filtered[row] ?? filtered[0];
  const facetCounts = useMemo(() => {
    const m: Record<string, number> = { All: TASKS.length };
    for (const f of TASK_FACETS) {
      if (f === "All") continue;
      m[f] = TASKS.filter((t) => t.status === f).length;
    }
    return m;
  }, []);

  const pointsOpen = TASKS.filter((t) => t.status === "Open").reduce(
    (s, t) => s + t.points,
    0,
  );

  return (
    <div className="comp-desk-route">
      <LatticeTabs
        tabs={TASK_TABS}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setRow(0);
        }}
        ariaLabel="Task board segments"
      />
      <div className="comp-desk-grid">
        <CrestRail
          active={regionFilter}
          onChange={(id) => {
            setRegionFilter(id);
            setRow(0);
          }}
        />
        <div className="comp-stage-col">
          <div className="comp-stage-bar">
            <h2 className="comp-stage-title">Task board</h2>
            <span className="comp-stage-count">
              {filtered.length} shown · {pointsOpen} open pts · fixture
            </span>
            <FacetChips
              options={TASK_FACETS}
              active={facet}
              onChange={(v) => {
                setFacet(v);
                setRow(0);
              }}
              ariaLabel="Task status facets"
              counts={facetCounts}
            />
            <input
              className="comp-search ml-auto"
              type="search"
              placeholder="Filter tasks…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setRow(0);
              }}
              aria-label="Filter tasks"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="comp-table">
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Region</th>
                  <th scope="col">Tier</th>
                  <th scope="col">Pts</th>
                  <th scope="col">Status</th>
                  <th scope="col">Src</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="secondary">
                      No tasks in this facet cut
                    </td>
                  </tr>
                ) : (
                  filtered.map((t, i) => {
                    const on = i === row;
                    return (
                      <tr
                        key={t.id}
                        className={on ? "is-selected" : undefined}
                        aria-selected={on}
                        onClick={() => setRow(i)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setRow(i);
                          }
                        }}
                      >
                        <td className="font-medium">
                          {t.title}
                          {t.provisional ? (
                            <span className="comp-tag comp-tag--provisional ml-2">
                              provisional
                            </span>
                          ) : null}
                        </td>
                        <td className="secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <Crest id={t.regionId} size={14} />
                            {t.region}
                          </span>
                        </td>
                        <td className="secondary">{t.tier}</td>
                        <td className="mono">{t.points}</td>
                        <td className="secondary">{t.status}</td>
                        <td className="mono secondary">{t.sources.length}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="comp-inspector" aria-label="Task full record">
          {selected ? (
            <>
              <div className="comp-inspector-head">
                <Crest id={selected.regionId} size={28} />
                <div>
                  <h3 className="comp-inspector-title">{selected.title}</h3>
                  <p className="comp-note m-0 mt-1">
                    {selected.region} · {selected.tier} · {selected.status}
                  </p>
                </div>
              </div>
              <dl className="comp-field-grid">
                <dt>id</dt>
                <dd className="font-mono">{selected.id}</dd>
                <dt>region</dt>
                <dd>{selected.region}</dd>
                <dt>regionId</dt>
                <dd className="font-mono">{selected.regionId}</dd>
                <dt>points</dt>
                <dd className="font-mono">{selected.points}</dd>
                <dt>tier</dt>
                <dd>{selected.tier}</dd>
                <dt>status</dt>
                <dd>{selected.status}</dd>
                <dt>provisional</dt>
                <dd>{selected.provisional ? "true" : "false"}</dd>
                <dt>note</dt>
                <dd>{selected.note}</dd>
                <dt>sources</dt>
                <dd className="font-mono">{selected.sources.length}</dd>
              </dl>
              <SourceList sources={selected.sources} />
              <p className="comp-note px-3 pb-3">
                Catalyst stand-in · not Equilibrium published list · sources? · verified{" "}
                {selected.sources[0]?.verifiedAt ?? "—"}
              </p>
            </>
          ) : (
            <p className="comp-note p-3">No task selected.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── Data · Prism Facet Desk FULL sources ──────────────────── */

function DataPane() {
  const [tab, setTab] = useState<string>(DATA_TABS[0]);
  const [regionFilter, setRegionFilter] = useState("all");
  const [facet, setFacet] = useState<string>(DATA_FACETS[0]);
  const [query, setQuery] = useState("");
  const [row, setRow] = useState(0);

  const filtered = useMemo(() => {
    let list = [...FIXTURE];
    if (tab === "Progression") {
      list = list.filter((r) => r.kind === "Unlock" || r.kind === "Skilling");
    }
    if (tab === "Unlocks") list = list.filter((r) => r.kind === "Unlock");
    if (tab === "Systems") {
      list = list.filter((r) => r.kind === "Travel" || r.kind === "Combat");
    }
    if (tab === "Sources") list = list.filter((r) => r.sources.length >= 2);
    if (regionFilter !== "all") {
      list = list.filter((r) => r.regionId === regionFilter);
    }
    if (facet !== "All kinds") {
      const kind = facet as CatalogRow["kind"];
      list = list.filter((r) => r.kind === kind);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q) ||
          r.tags.toLowerCase().includes(q) ||
          r.kind.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tab, regionFilter, facet, query]);

  const selected = filtered[row] ?? filtered[0];
  const facetCounts = useMemo(() => {
    const m: Record<string, number> = { "All kinds": FIXTURE.length };
    for (const f of DATA_FACETS) {
      if (f === "All kinds") continue;
      m[f] = FIXTURE.filter((r) => r.kind === f).length;
    }
    return m;
  }, []);

  return (
    <div className="comp-desk-route">
      <LatticeTabs
        tabs={DATA_TABS}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setRow(0);
        }}
        ariaLabel="Catalog lattice"
      />
      <div className="comp-desk-grid">
        <CrestRail
          active={regionFilter}
          onChange={(id) => {
            setRegionFilter(id);
            setRow(0);
          }}
        />
        <div className="comp-stage-col">
          <div className="comp-stage-bar">
            <h2 className="comp-stage-title">
              {tab === "Browse" ? "Daylight browse" : tab}
            </h2>
            <span className="comp-stage-count">
              {filtered.length} rows · fixture · multi-source
            </span>
            <FacetChips
              options={DATA_FACETS}
              active={facet}
              onChange={(v) => {
                setFacet(v);
                setRow(0);
              }}
              ariaLabel="Catalog kind facets"
              counts={facetCounts}
            />
            <input
              className="comp-search ml-auto"
              type="search"
              placeholder="Filter catalog…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setRow(0);
              }}
              aria-label="Filter catalog"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="comp-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Region</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Status</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Src</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="secondary">
                      No catalog rows in this cut
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, i) => {
                    const on = i === row;
                    return (
                      <tr
                        key={r.id}
                        className={on ? "is-selected" : undefined}
                        aria-selected={on}
                        onClick={() => setRow(i)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setRow(i);
                          }
                        }}
                      >
                        <td className="font-medium">
                          {r.name}
                          {r.provisional ? (
                            <span className="comp-tag comp-tag--provisional ml-2">
                              fixture
                            </span>
                          ) : null}
                        </td>
                        <td className="secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <Crest id={r.regionId} size={14} />
                            {r.region}
                          </span>
                        </td>
                        <td className="secondary">{r.kind}</td>
                        <td className="secondary">{r.status}</td>
                        <td className="mono">{r.qty}</td>
                        <td className="mono secondary">{r.sources.length}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="comp-inspector" aria-label="Catalog full record">
          {selected ? (
            <>
              <div className="comp-inspector-head">
                <Crest id={selected.regionId} size={28} />
                <div>
                  <h3 className="comp-inspector-title">{selected.name}</h3>
                  <p className="comp-note m-0 mt-1">
                    {selected.region} · {selected.kind} · {selected.status}
                  </p>
                </div>
              </div>
              <dl className="comp-field-grid">
                <dt>id</dt>
                <dd className="font-mono">{selected.id}</dd>
                <dt>region</dt>
                <dd>{selected.region}</dd>
                <dt>regionId</dt>
                <dd className="font-mono">{selected.regionId}</dd>
                <dt>kind</dt>
                <dd>{selected.kind}</dd>
                <dt>status</dt>
                <dd>{selected.status}</dd>
                <dt>qty</dt>
                <dd className="font-mono">{selected.qty}</dd>
                <dt>tags</dt>
                <dd>{selected.tags}</dd>
                <dt>provisional</dt>
                <dd>{selected.provisional ? "true" : "false"}</dd>
                <dt>note</dt>
                <dd>{selected.note}</dd>
                <dt>sources</dt>
                <dd className="font-mono">{selected.sources.length}</dd>
              </dl>
              <SourceList sources={selected.sources} />
              <p className="comp-note px-3 pb-3">
                Full field dump · all sources listed · sources? · verified{" "}
                {selected.sources[0]?.verifiedAt ?? "fixture only"}
              </p>
            </>
          ) : (
            <p className="comp-note p-3">No catalog row selected.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── Build · Ridge Relic Court ─────────────────────────────── */

function BuildRegions({
  picks,
  onToggle,
  onClear,
}: {
  picks: readonly RegionId[];
  onToggle: (id: RegionId) => void;
  onClear: () => void;
}) {
  const atCap = picks.length >= 3;
  return (
    <div className="comp-court">
      <div className="comp-court-banner">
        <h3>Region lattice</h3>
        <p>Live picks shared with Map · ironman self-sufficient</p>
        <span className="comp-pick-count" aria-live="polite">
          {picks.length}/3
        </span>
        <button
          type="button"
          className="comp-btn ml-auto"
          disabled={picks.length === 0}
          onClick={onClear}
        >
          Clear picks
        </button>
      </div>
      <div className="comp-region-grid">
        {REGIONS.map((r) => {
          const isOn = picks.includes(r.id);
          const disabled = !isOn && atCap;
          return (
            <button
              key={r.id}
              type="button"
              className={`comp-region-tile${isOn ? " is-picked" : ""}`}
              aria-pressed={isOn}
              aria-disabled={disabled || undefined}
              onClick={() => {
                if (disabled) return;
                onToggle(r.id);
              }}
            >
              <Crest id={r.id} size={28} />
              <span className="font-medium">{r.name}</span>
              <span
                className="text-[10px]"
                style={{
                  color: isOn ? "var(--echo-gem)" : "var(--echo-parch-400)",
                }}
              >
                {isOn ? "picked" : r.plate}
              </span>
            </button>
          );
        })}
      </div>
      <p className="comp-note">
        Cap 3 · 4th pick aria-disabled · crest alt empty · name-first accessible labels
      </p>
    </div>
  );
}

function BuildRelics({
  selectedRelic,
  onSelectRelic,
  focusTier,
  onFocusTier,
}: {
  selectedRelic: RelicId | null;
  onSelectRelic: (id: RelicId) => void;
  focusTier: number;
  onFocusTier: (t: number) => void;
}) {
  const active =
    T1_RELICS.find((r) => r.id === selectedRelic) ?? T1_RELICS[0];
  const showCourt = focusTier === 1;

  return (
    <div className="comp-court">
      <div className="comp-court-banner">
        <h3>Relic Court</h3>
        <p>
          Editorial T1 · monogram frames until Jagex art lands under public/game · never
          Catalyst icons
        </p>
      </div>

      <div className="comp-tier-rail" role="tablist" aria-label="Relic tiers">
        <span className="comp-tier-rail__label">Tiers</span>
        {RELIC_TIERS.map((t) => {
          const on = focusTier === t.tier;
          const open = t.revealed;
          return (
            <button
              key={t.tier}
              type="button"
              role="tab"
              aria-selected={on}
              aria-disabled={!open || undefined}
              className={`comp-hex${open ? " is-open" : " is-unrevealed"}${
                on && open ? " is-selected" : ""
              }`}
              onClick={() => {
                if (open) onFocusTier(t.tier);
              }}
              title={open ? `Tier ${t.tier} open` : `Tier ${t.tier} unrevealed`}
            >
              <span className="comp-hex__tier">T{t.tier}</span>
              <span className="comp-hex__sub">{t.label}</span>
            </button>
          );
        })}
      </div>

      {showCourt ? (
        <>
          <div className="comp-court-grid">
            {T1_RELICS.map((relic) => {
              const isSel = selectedRelic === relic.id;
              return (
                <button
                  key={relic.id}
                  type="button"
                  className={`comp-panel comp-panel--carved comp-relic-card${
                    isSel ? " is-selected" : ""
                  }`}
                  onClick={() => onSelectRelic(relic.id)}
                  aria-pressed={isSel}
                >
                  <div className="comp-relic-card__top">
                    <div className="comp-relic-frame" aria-hidden>
                      <span className="comp-relic-frame__mono">{relic.mono}</span>
                    </div>
                    <div>
                      <p className="comp-relic-card__name">{relic.name}</p>
                      <p className="comp-relic-card__tier">Tier 1 · revealed</p>
                      {isSel ? (
                        <p className="comp-relic-card__pick">seated</p>
                      ) : null}
                    </div>
                  </div>
                  <p className="comp-relic-card__blurb">{relic.blurb}</p>
                  <div className="comp-skill-chips">
                    {relic.skills.map((sk) => (
                      <span key={sk} className="comp-skill-chip">
                        <SkillIcon id={sk} size={12} />
                        {sk}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="comp-folio">
            <div className="comp-panel comp-panel--slate">
              <div className="comp-panel__head">
                {active.name} · full effects
              </div>
              <div className="comp-panel__body">
                <div className="mb-3 flex items-center gap-3">
                  <div className="comp-relic-frame" aria-hidden>
                    <span className="comp-relic-frame__mono">{active.mono}</span>
                  </div>
                  <div>
                    <p
                      className="m-0 font-display text-[14px] tracking-[0.1em] uppercase"
                      style={{ color: "var(--echo-gold)" }}
                    >
                      {active.name}
                    </p>
                    <p
                      className="m-0 mt-1 text-[12px]"
                      style={{ color: "var(--echo-parch-300)" }}
                    >
                      Placeholder frame · no official Equilibrium relic icon in public/game
                    </p>
                  </div>
                </div>
                <ul className="comp-effects">
                  {active.effects.map((fx) => (
                    <li key={fx}>{fx}</li>
                  ))}
                </ul>
                <p className="comp-note">{RELIC_SOURCE}</p>
              </div>
            </div>

            <div className="comp-panel comp-panel--carved">
              <div className="comp-panel__head">Court provenance</div>
              <div className="comp-panel__body text-[13px]">
                <dl className="comp-ledger">
                  <dt>Envelope</dt>
                  <dd>data/league/relics.json</dd>
                  <dt>Published</dt>
                  <dd className="mono">2026-07-23</dd>
                  <dt>Verified</dt>
                  <dd className="mono">2026-07-25</dd>
                  <dt>Choices</dt>
                  <dd className="mono">3 / tier</dd>
                  <dt>Art status</dt>
                  <dd>CSS monogram only</dd>
                </dl>
                <div className="mt-3">
                  <KeyFigure
                    label="Seated T1"
                    value={selectedRelic ? active.mono : "—"}
                    vacant={!selectedRelic}
                  />
                </div>
                <p className="comp-note">
                  Catalyst relic PNGs intentionally unwired · mislabel ban holds · no
                  weapon cosplay
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="comp-panel comp-panel--carved">
          <div className="comp-panel__head">Tier {focusTier}</div>
          <div className="comp-panel__body text-[15px]">
            <p className="m-0" style={{ color: "var(--echo-parch-50)" }}>
              Unrevealed. Empty records until an official source exists — never invent tier
              numbers or effects to fill a stub.
            </p>
            <p className="mt-2 mb-0 text-[12px]" style={{ color: "var(--echo-parch-300)" }}>
              Fixture stance · ironman / self-sufficient planning only
            </p>
            <p className="comp-note">
              sources? · verified empty envelope — not live league data
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function BuildBlessings() {
  return (
    <div className="comp-court">
      <div className="comp-court-banner">
        <h3>Blessing lattice</h3>
        <p>
          Path colors are data labels only — never nav chrome · lattice empty until reveal
        </p>
      </div>

      <div className="comp-panel comp-panel--slate">
        <div className="comp-panel__head">
          Paths · Order · Balance · Chaos · God Tier
        </div>
        <div className="comp-bless-lattice">
          {BLESSING_PATHS.map((path) => (
            <div key={path} className="comp-bless-row">
              <span
                className={`comp-path-label comp-path-label--${path.toLowerCase()}`}
              >
                {path}
              </span>
              {BLESSING_TIERS.filter((t) => t <= 7).map((t) => (
                <div
                  key={`${path}-${t}`}
                  className="comp-hex is-unrevealed"
                  style={{ width: 44, height: 50, cursor: "default" }}
                  title={`${path} tier ${t} unrevealed`}
                  aria-hidden
                >
                  <span className="comp-hex__tier" style={{ fontSize: "0.625rem" }}>
                    {t}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div className="comp-bless-row">
            <span className="comp-path-label comp-path-label--god">God</span>
            <div
              className="comp-hex is-unrevealed"
              style={{ width: 72, height: 82, cursor: "default" }}
              title="God Tier unrevealed"
              aria-hidden
            >
              <span className="comp-hex__tier">GT</span>
              <span className="comp-hex__sub">sealed</span>
            </div>
            <p className="m-0 text-[12px]" style={{ color: "var(--echo-parch-300)" }}>
              Alignment derives from path picks · no choices published
            </p>
          </div>
        </div>
        <div className="comp-panel__body pt-0">
          <p className="m-0 text-[15px]" style={{ color: "var(--echo-parch-50)" }}>
            Empty envelope is correct. Order / Balance / Chaos ink marks path identity in
            the lattice — never used as interactive chrome on nav or tabs.
          </p>
          <p className="comp-note">
            sources? · verified empty blessings.json · resets unrevealed
          </p>
        </div>
      </div>
    </div>
  );
}

function BuildPane({
  picks,
  onToggle,
  onClear,
  selectedRelic,
  onSelectRelic,
}: {
  picks: readonly RegionId[];
  onToggle: (id: RegionId) => void;
  onClear: () => void;
  selectedRelic: RelicId | null;
  onSelectRelic: (id: RelicId) => void;
}) {
  const [seg, setSeg] = useState<string>("Relics");
  const [focusTier, setFocusTier] = useState(1);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={BUILD_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Build segments"
      />
      <div
        className="flex flex-wrap items-center gap-2 border-b border-stone-750 px-3 py-1.5"
        style={{ background: "var(--echo-shell)" }}
      >
        <span className="text-[12px]" style={{ color: "var(--echo-parch-300)" }}>
          {seg === "Relics"
            ? "Court stage · T1 revealed · monogram frames"
            : seg === "Regions"
              ? "Crest lattice · live picks · cap 3"
              : "Blessing lattice · empty until reveal"}
        </span>
        <span className="comp-pick-count ml-auto" aria-live="polite">
          {picks.length}/3
        </span>
      </div>
      {seg === "Regions" ? (
        <BuildRegions picks={picks} onToggle={onToggle} onClear={onClear} />
      ) : null}
      {seg === "Relics" ? (
        <BuildRelics
          selectedRelic={selectedRelic}
          onSelectRelic={onSelectRelic}
          focusTier={focusTier}
          onFocusTier={setFocusTier}
        />
      ) : null}
      {seg === "Blessings" ? <BuildBlessings /> : null}
    </div>
  );
}

/* ── Combat · Forge Calc Crystal ───────────────────────────── */

function CombatPane() {
  const [seg, setSeg] = useState<string>(COMBAT_SEGS[0]);
  const [style, setStyle] = useState<(typeof STYLE_FILTERS)[number]>("All");
  const [row, setRow] = useState(0);

  const rows = useMemo(() => {
    if (style === "All") return ABILITIES;
    return ABILITIES.filter((a) => a.style === style);
  }, [style]);

  const selected = rows[row] ?? rows[0];
  const barSlots = rows.slice(0, 5);

  const styleCounts = useMemo(() => {
    const m: Record<string, number> = { All: ABILITIES.length };
    for (const s of STYLE_FILTERS) {
      if (s === "All") continue;
      m[s] = ABILITIES.filter((a) => a.style === s).length;
    }
    return m;
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={COMBAT_SEGS}
        active={seg}
        onChange={(t) => {
          setSeg(t);
          setRow(0);
        }}
        ariaLabel="Combat sections"
      />

      <div
        className="flex flex-wrap items-center gap-2 border-b border-stone-750 px-3 py-2"
        style={{ background: "var(--echo-shell)" }}
      >
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--echo-parch-50)" }}
        >
          {seg} · facet desk
        </h2>
        <span
          className="font-mono text-[11px]"
          style={{ color: "var(--echo-parch-300)" }}
        >
          Generic target · DPL / adren vacant by design
        </span>
        <div
          role="tablist"
          aria-label="Combat style"
          className="ml-auto flex flex-wrap gap-1"
        >
          {STYLE_FILTERS.map((s) => {
            const on = s === style;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={on}
                className={`comp-style-chip${on ? " is-on" : ""}`}
                onClick={() => {
                  setStyle(s);
                  setRow(0);
                }}
              >
                <StyleIcon style={s === "All" ? "All" : (s as StyleId)} size={14} />
                {s}
                <span
                  className="font-mono text-[10px]"
                  style={{
                    color: on ? "var(--echo-gem)" : "var(--echo-parch-400)",
                  }}
                >
                  {styleCounts[s] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {seg === "Quick" || seg === "Rotation" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px]">
          <section className="flex min-h-0 flex-col">
            <div
              className="grid grid-cols-2 gap-1.5 border-b border-stone-750 p-2 sm:grid-cols-5"
              style={{ background: "var(--echo-shell)" }}
              aria-label="Ability bar facets"
            >
              {barSlots.length === 0 ? (
                <p
                  className="col-span-full m-0 px-1 py-3 text-[12px]"
                  style={{ color: "var(--echo-parch-400)" }}
                >
                  No abilities in this style filter.
                </p>
              ) : (
                barSlots.map((a, i) => {
                  const idx = rows.findIndex((x) => x.id === a.id);
                  const on = idx === row;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={`comp-bar-slot${on ? " is-on" : ""}`}
                      onClick={() => setRow(idx < 0 ? 0 : idx)}
                      aria-pressed={on}
                    >
                      <span className="comp-bar-slot__idx">Slot {i + 1}</span>
                      <span className="flex items-center gap-1.5">
                        <AbilityIcon row={a} size={22} />
                        <span className="text-[12px] font-medium leading-tight">
                          {a.name}
                        </span>
                      </span>
                      <span
                        className="text-[10px]"
                        style={{
                          color: on ? "var(--echo-gem)" : "var(--echo-parch-400)",
                        }}
                      >
                        {a.kind} · {a.style}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div
              className="min-h-0 flex-1 overflow-auto"
              style={{ background: "var(--echo-stage)" }}
            >
              <table className="comp-table">
                <thead>
                  <tr>
                    <th scope="col">Ability</th>
                    <th scope="col">Style</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Role</th>
                    <th scope="col">Adren</th>
                    <th scope="col">DPL</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a, i) => {
                    const on = i === row;
                    return (
                      <tr
                        key={a.id}
                        className={on ? "is-selected" : undefined}
                        onClick={() => setRow(i)}
                        tabIndex={0}
                        style={{ cursor: "pointer" }}
                        aria-selected={on}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setRow(i);
                          }
                        }}
                      >
                        <td className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            <AbilityIcon row={a} size={18} />
                            {a.name}
                          </span>
                        </td>
                        <td className="secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <StyleIcon style={a.style} size={14} />
                            {a.style}
                          </span>
                        </td>
                        <td className="secondary">{a.kind}</td>
                        <td className="secondary">{a.role}</td>
                        <td
                          className="mono"
                          style={{ color: "var(--echo-parch-400)" }}
                          title="Adrenaline unbound — structured vacancy"
                        >
                          —
                        </td>
                        <td
                          className="mono"
                          style={{ color: "var(--echo-parch-400)" }}
                          title="Damage Potential unbound — structured vacancy"
                        >
                          —
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <aside
            className="border-t border-stone-750 md:border-t-0 md:border-l"
            style={{ background: "var(--echo-rail)" }}
          >
            {selected ? (
              <>
                <div className="comp-cut-head">
                  <AbilityIcon row={selected} size={28} />
                  <div className="min-w-0">
                    <h3
                      className="m-0 font-display text-[14px] tracking-[0.06em]"
                      style={{ color: "var(--echo-gold)" }}
                    >
                      {selected.name}
                    </h3>
                    <p
                      className="mt-1 mb-0 flex items-center gap-1.5 text-[12px]"
                      style={{ color: "var(--echo-parch-300)" }}
                    >
                      <StyleIcon style={selected.style} size={12} />
                      {selected.style} · {selected.kind} · {selected.role}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <VacancyWell
                      label="Adrenaline"
                      caption="Unbound · cost/gain empty until ability core binds"
                    />
                    <VacancyWell
                      label="Damage Potential"
                      caption="Unbound · no target math · no demo %"
                    />
                  </div>

                  <div className="comp-panel comp-panel--facet">
                    <div className="comp-panel__head">Generic target</div>
                    <div className="comp-panel__body">
                      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                        {TARGET_FIELDS.map((f) => (
                          <div key={f.label} className="contents">
                            <dt style={{ color: "var(--echo-parch-300)" }}>
                              {f.label}
                            </dt>
                            <dd
                              className="m-0 font-mono"
                              style={{
                                color:
                                  f.value === "—"
                                    ? "var(--echo-parch-400)"
                                    : "var(--echo-parch-50)",
                              }}
                            >
                              {f.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>

                  <p
                    className="mb-0 text-[12px]"
                    style={{ color: "var(--echo-parch-100)" }}
                  >
                    {selected.note}. Layout density only — structured vacancy, not invented
                    numbers.
                  </p>
                  <p
                    className="mb-0 text-[11px]"
                    style={{ color: "var(--echo-parch-400)" }}
                  >
                    No boss phases · no kill-time · no enrage · generic target law
                  </p>
                  {seg === "Rotation" ? (
                    <div className="comp-panel comp-panel--facet mt-1">
                      <div className="comp-panel__head">Rotation summary</div>
                      <div className="comp-panel__body">
                        <div className="grid grid-cols-2 gap-2">
                          <VacancyWell
                            label="Expected hit"
                            caption="Sim empty until rotation binds"
                          />
                          <VacancyWell
                            label="Adren end"
                            caption="No fabricated end-bar"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </aside>
        </div>
      ) : null}

      {seg === "Setup" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="comp-panel comp-panel--facet">
              <div className="comp-panel__head">Style & weapons</div>
              <div className="comp-panel__body space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(["Melee", "Magic", "Ranged", "Necromancy"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`comp-style-chip${style === s ? " is-on" : ""}`}
                      aria-selected={style === s}
                      onClick={() => setStyle(s)}
                    >
                      <StyleIcon style={s} size={14} />
                      {s}
                    </button>
                  ))}
                </div>
                <VacancyWell
                  label="Main-hand"
                  caption="Item bonuses empty until sourced · weapon tier still editable in product"
                />
                <VacancyWell
                  label="Off-hand / 2H"
                  caption="Unsourced · no invented stats"
                />
              </div>
            </div>
            <div className="comp-panel comp-panel--carved">
              <div className="comp-panel__head">Shared loadout notes</div>
              <div className="comp-panel__body space-y-2 text-[13px]">
                <p className="m-0" style={{ color: "var(--echo-parch-50)" }}>
                  Setup is shared with Rotation and Analysis. Fixture preview shows
                  structure only — combat core stays unbound here.
                </p>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px]">
                  <dt style={{ color: "var(--echo-parch-300)" }}>Prayer</dt>
                  <dd className="m-0" style={{ color: "var(--echo-parch-400)" }}>
                    —
                  </dd>
                  <dt style={{ color: "var(--echo-parch-300)" }}>Aura</dt>
                  <dd className="m-0" style={{ color: "var(--echo-parch-400)" }}>
                    —
                  </dd>
                  <dt style={{ color: "var(--echo-parch-300)" }}>Familiar</dt>
                  <dd className="m-0" style={{ color: "var(--echo-parch-400)" }}>
                    —
                  </dd>
                  <dt style={{ color: "var(--echo-parch-300)" }}>League mult</dt>
                  <dd className="m-0" style={{ color: "var(--echo-parch-400)" }}>
                    Unrevealed blessings
                  </dd>
                </dl>
                <p className="comp-note">
                  Vacancy law sacred · never demo DPL to look complete
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {seg === "Analysis" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="comp-panel">
              <div className="comp-panel__head">A / B comparison</div>
              <div className="comp-panel__body overflow-auto">
                <table className="comp-table">
                  <thead>
                    <tr>
                      <th scope="col">Metric</th>
                      <th scope="col">Setup A</th>
                      <th scope="col">Setup B</th>
                      <th scope="col">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Damage Potential", "—", "—", "Vacant"],
                        ["Hit chance", "—", "—", "Vacant"],
                        ["Expected hit", "—", "—", "Vacant"],
                        ["Adren delta", "—", "—", "Vacant"],
                        ["Style", style === "All" ? "—" : style, "—", "Catalog"],
                      ] as const
                    ).map(([m, a, b, n]) => (
                      <tr key={m}>
                        <td className="font-medium">{m}</td>
                        <td className="mono" style={{ color: "var(--echo-parch-400)" }}>
                          {a}
                        </td>
                        <td className="mono" style={{ color: "var(--echo-parch-400)" }}>
                          {b}
                        </td>
                        <td className="secondary">{n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-2">
              <KeyFigure label="DPL A" value="—" vacant />
              <KeyFigure label="DPL B" value="—" vacant />
              <div className="comp-panel comp-panel--facet">
                <div className="comp-panel__head">Analysis stance</div>
                <div className="comp-panel__body text-[12px]">
                  <p className="m-0" style={{ color: "var(--echo-parch-100)" }}>
                    Analysis compares two bound setups in product. This fixture keeps both
                    columns vacant — structured honesty, not a hollow demo.
                  </p>
                  <p className="comp-note">
                    No kill-time · no enrage · no boss phase math
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Root ──────────────────────────────────────────────────── */

export function CompositePreview() {
  const [nav, setNav] = useState<NavId>("Overview");
  const [picks, setPicks] = useState<RegionId[]>([...INITIAL_PICKS]);
  const [selectedRelic, setSelectedRelic] = useState<RelicId | null>("survivalist");

  const taskDone = TASKS.filter((t) => t.status === "Done").length;
  const taskTotal = TASKS.length;
  const relicName =
    T1_RELICS.find((r) => r.id === selectedRelic)?.name ?? null;
  const relicMono =
    T1_RELICS.find((r) => r.id === selectedRelic)?.mono ?? null;

  const onToggle = (id: RegionId) => {
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const onClear = () => setPicks([]);

  return (
    <div className="comp-shell hybrid-skin--composite">
      <CompNav
        active={nav}
        onChange={setNav}
        picks={picks.length}
        relicMono={relicMono}
      />
      <div className="comp-stage">
        {nav === "Overview" ? (
          <OverviewPane
            picks={picks}
            taskDone={taskDone}
            taskTotal={taskTotal}
            relicName={relicName}
            relicMono={relicMono}
          />
        ) : null}
        {nav === "Map" ? (
          <MapPane picks={picks} onToggle={onToggle} onClear={onClear} />
        ) : null}
        {nav === "Tasks" ? <TasksPane /> : null}
        {nav === "Build" ? (
          <BuildPane
            picks={picks}
            onToggle={onToggle}
            onClear={onClear}
            selectedRelic={selectedRelic}
            onSelectRelic={setSelectedRelic}
          />
        ) : null}
        {nav === "Combat" ? <CombatPane /> : null}
        {nav === "Data" ? <DataPane /> : null}
      </div>
      <footer className="comp-foot">
        Team Composite · Steal Matrix hybrid R2 · fixture labeled · RuneScape is a
        trademark of Jagex Ltd.
      </footer>
    </div>
  );
}
