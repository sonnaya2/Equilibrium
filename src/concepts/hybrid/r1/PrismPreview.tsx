"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { gameIconPath, regionCrestPath, styleIconPath } from "@/lib/gameArt";

/**
 * Team Prism · FACET DESK — Hybrid composition R1 → R2 polish
 * Editorial colors · Daylight overview · Map tall board no-inspector ·
 * Build T1 monogram court · Data+Tasks twin desks (full sources).
 * Tokens on parent .hybrid-skin--prism (prism.css). Fixture data only.
 */

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;
type NavId = (typeof NAV)[number];

const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems", "Sources"] as const;
const BUILD_SEGS = ["Regions", "Relics", "Blessings"] as const;
const COMBAT_SEGS = ["Quick", "Setup", "Analysis", "Rotation"] as const;
const TASK_TABS = ["All tiers", "Open board", "Done", "Locked"] as const;
const TASK_FACETS = ["All", "Open", "Done", "Locked"] as const;
const DATA_FACETS = ["All kinds", "Skilling", "Combat", "Travel", "Unlock"] as const;

const REGIONS = [
  { id: "misthalin", name: "Misthalin" },
  { id: "asgarnia", name: "Asgarnia" },
  { id: "karamja", name: "Karamja" },
  { id: "desert", name: "Desert" },
  { id: "fremennik", name: "Fremennik" },
  { id: "morytania", name: "Morytania" },
  { id: "tirannwn", name: "Tirannwn" },
  { id: "kandarin", name: "Kandarin" },
  { id: "anachronia", name: "Anachronia" },
  { id: "forinthry", name: "Forinthry" },
  { id: "havenhythe", name: "Havenhythe" },
] as const;

type RegionId = (typeof REGIONS)[number]["id"];

type SourceType = "wiki" | "official" | "community" | "fixture";

type SourceRef = {
  title: string;
  url: string;
  verifiedAt: string;
  sourceType: SourceType;
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
        title: "Crystal hatchet (icon source)",
        url: "https://runescape.wiki/w/Crystal_hatchet",
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
];

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
    blurb: "Goldenhawk Boots path: Agility and Thieving success, note, and coin multipliers.",
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
  "Jagex · Countdown to LEAGUES II: EQUILIBRIUM · verified 2026-07-25 · data/league/relics.json";

const INITIAL_PICKS: RegionId[] = ["misthalin", "asgarnia", "fremennik"];

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <GameIcon src={regionCrestPath(id)} size={size} className="shrink-0" alt="" />
  );
}

function SkillIcon({ id, size = 14 }: { id: string; size?: number }) {
  return (
    <GameIcon src={gameIconPath("skills", id)} size={size} className="shrink-0" alt="" />
  );
}

function RelicMono({ mono, size = "md" }: { mono: string; size?: "sm" | "md" }) {
  return (
    <div className={`prism-relic-frame${size === "sm" ? " prism-relic-frame--sm" : ""}`} aria-hidden>
      <span className="prism-relic-frame__mono">{mono}</span>
    </div>
  );
}

function FacetChips({
  options,
  active,
  onChange,
  ariaLabel,
}: {
  options: readonly string[];
  active: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="prism-facets" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const on = opt === active;
        return (
          <button
            key={opt}
            type="button"
            className={`prism-facet${on ? " is-on" : ""}`}
            onClick={() => onChange(opt)}
            aria-pressed={on}
          >
            {opt}
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
    <div className="prism-lattice" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const on = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab)}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

function SourceList({ sources }: { sources: readonly SourceRef[] }) {
  return (
    <div className="prism-sources">
      <p className="prism-sources-label">
        Sources · {sources.length} {sources.length === 1 ? "entry" : "entries"}
      </p>
      {sources.length === 0 ? (
        <p className="prism-note" style={{ margin: 0 }}>
          No sources attached — honest empty.
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`} className="prism-source-card">
              <p className="prism-source-title">{s.title}</p>
              <a
                className="prism-source-url"
                href={s.url}
                target="_blank"
                rel="noreferrer"
              >
                {s.url}
              </a>
              <p className="prism-source-meta">
                <span className="prism-source-type">{s.sourceType}</span>
                <span>verified {s.verifiedAt}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PrismNav({
  active,
  onChange,
  picks,
}: {
  active: NavId;
  onChange: (id: NavId) => void;
  picks: number;
}) {
  return (
    <header className="prism-mast">
      <p className="prism-brand">EQUILIBRIUM</p>
      <nav className="prism-nav" aria-label="Primary">
        <ul>
          {NAV.map((label) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => onChange(label)}
                aria-current={label === active ? "page" : undefined}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <span className="prism-mast-meta" aria-live="polite">
        Facet Desk · {picks}/3 · fixture lab
      </span>
    </header>
  );
}

function CrestRail({
  regionFilter,
  onChange,
  counts,
}: {
  regionFilter: string;
  onChange: (id: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <nav className="prism-rail" aria-label="Region browse rail">
      <p className="prism-rail-label">Daylight crest rail</p>
      <ul className="m-0 list-none p-0 py-1">
        <li>
          <button
            type="button"
            className={`prism-rail-leaf${regionFilter === "all" ? " is-on" : ""}`}
            onClick={() => onChange("all")}
          >
            <span
              className="inline-block h-3 w-3 shrink-0 rotate-45 border"
              style={{
                borderColor: "var(--color-gem-500)",
                background: "var(--color-stone-800)",
              }}
              aria-hidden
            />
            All regions
          </button>
        </li>
        {REGIONS.map((r) => {
          const on = regionFilter === r.id;
          const n = counts[r.id] ?? 0;
          return (
            <li key={r.id}>
              <button
                type="button"
                className={`prism-rail-leaf${on ? " is-on" : ""}`}
                onClick={() => onChange(r.id)}
              >
                <Crest id={r.id} size={16} />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span
                  className="font-mono text-[10px]"
                  style={{ color: "var(--color-parch-400)" }}
                >
                  {n}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function OverviewPane({
  picks,
  taskDone,
  taskTotal,
}: {
  picks: readonly RegionId[];
  taskDone: number;
  taskTotal: number;
}) {
  const picked = REGIONS.filter((r) => picks.includes(r.id));
  const slots: (typeof REGIONS[number] | null)[] = [0, 1, 2].map(
    (i) => picked[i] ?? null,
  );

  return (
    <div className="prism-courtyard">
      <header className="prism-lintel">
        <h2 className="prism-lintel-title">Facet courtyard</h2>
        <p className="prism-lintel-meta">Daylight gate · Editorial room</p>
      </header>

      <div className="prism-gate">
        <aside className="prism-jamb prism-jamb--west" aria-label="Region picks">
          <p className="prism-jamb-label">Standing picks</p>
          {slots.map((r, i) =>
            r ? (
              <div key={r.id} className="prism-standing">
                <Crest id={r.id} size={26} />
                <p className="prism-standing-name">{r.name}</p>
              </div>
            ) : (
              <div key={`empty-${i}`} className="prism-standing is-empty">
                Slot {i + 1}
              </div>
            ),
          )}
        </aside>

        <div className="prism-aperture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/keyart-2026.jpg" alt="" />
          <p className="prism-aperture-caption">Keyart aperture · living world</p>
        </div>

        <aside className="prism-jamb prism-jamb--east" aria-label="Plan milestones">
          <p className="prism-jamb-label">Milestones</p>
          <div className="prism-milestone">
            <p className="prism-milestone-k">Picks</p>
            <p className="prism-milestone-v">{picks.length}/3</p>
          </div>
          <div className="prism-milestone">
            <p className="prism-milestone-k">Tasks</p>
            <p className="prism-milestone-v">
              {taskDone}/{taskTotal}
            </p>
          </div>
          <div className="prism-milestone">
            <p className="prism-milestone-k">Catalog</p>
            <p className="prism-milestone-v">{FIXTURE.length}</p>
          </div>
          <div className="prism-milestone">
            <p className="prism-milestone-k">Blessings</p>
            <p className="prism-milestone-v is-quiet">Unrevealed</p>
          </div>
        </aside>
      </div>

      <div className="prism-desk-grid">
        <div className="panel panel--carved">
          <div className="panel-head">Plan ledger</div>
          <div className="panel-body">
            <dl className="prism-ledger">
              <dt>Region picks</dt>
              <dd className="font-mono">
                {picks.length}/3
                {picked.length > 0 ? (
                  <span className="ml-2 font-sans" style={{ color: "var(--color-parch-100)" }}>
                    · {picked.map((r) => r.name).join(" · ")}
                  </span>
                ) : (
                  <span className="ml-2 font-sans" style={{ color: "var(--color-parch-300)" }}>
                    · none — open Build or Map
                  </span>
                )}
              </dd>
              <dt>Tasks</dt>
              <dd className="font-mono">
                {taskDone}/{taskTotal} done · Catalyst stand-ins
              </dd>
              <dt>T1 relic</dt>
              <dd>Survivalist · Endless Harvest · Golden Touch</dd>
              <dt>Blessings</dt>
              <dd>Empty until official reveal</dd>
              <dt>Mode</dt>
              <dd>Ironman · self-sufficient</dd>
            </dl>
            <p className="prism-note">sources? · verified fixture only · demo catalog</p>
          </div>
        </div>

        <div className="panel panel--facet">
          <div className="panel-head">Next on the board</div>
          <div className="panel-body space-y-2 text-[13px]">
            <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
              {picks.length < 3
                ? "Finish three region picks on Build or Map."
                : "Region cap filled. Seat a T1 relic on Build, or work the task board."}
            </p>
            <ul className="m-0 list-none space-y-1.5 p-0" style={{ color: "var(--color-parch-100)" }}>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px]" style={{ color: "var(--color-gem-400)" }}>
                  {picks.length >= 3 ? "ok" : "··"}
                </span>
                Regions {picks.length}/3
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px]" style={{ color: "var(--color-parch-400)" }}>
                  ··
                </span>
                Blessings locked empty
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px]" style={{ color: "var(--color-parch-400)" }}>
                  ··
                </span>
                Combat calc unbound
              </li>
            </ul>
            <p className="prism-note">No invented league numbers. Empty means empty.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const fixtureCount = FIXTURE.filter((f) => f.regionId === active.id).length;

  return (
    <div className="prism-map">
      <div className="prism-stage-bar">
        <h2 className="prism-stage-title">Region wartable</h2>
        <span
          className="font-mono text-[13px]"
          style={{ color: "var(--color-gem-400)" }}
          aria-live="polite"
        >
          {picks.length}/3
        </span>
        <span className="text-[12px]" style={{ color: "var(--color-parch-300)" }}>
          Tall board · ledger under · no inspector
        </span>
        <button
          type="button"
          className="ml-auto px-2.5 py-1 text-[12px]"
          style={{
            border: "1px solid var(--color-stone-750)",
            background: "var(--color-stone-850)",
            color: picks.length === 0 ? "var(--color-parch-400)" : "var(--color-parch-100)",
            cursor: picks.length === 0 ? "not-allowed" : "pointer",
            opacity: picks.length === 0 ? 0.6 : 1,
            boxShadow: "inset 0 1px 0 var(--color-stone-carve)",
          }}
          disabled={picks.length === 0}
          onClick={onClear}
        >
          Clear picks
        </button>
        <button
          type="button"
          className="px-2.5 py-1 text-[12px]"
          style={{
            border: "1px solid var(--color-gem-500)",
            background: "var(--color-stone-850)",
            color:
              !isPicked && atCap ? "var(--color-parch-400)" : "var(--color-gem-300)",
            cursor: !isPicked && atCap ? "not-allowed" : "pointer",
            opacity: !isPicked && atCap ? 0.55 : 1,
            boxShadow: "inset 0 1px 0 var(--color-stone-carve)",
          }}
          aria-disabled={!isPicked && atCap ? true : undefined}
          onClick={() => {
            if (!isPicked && atCap) return;
            onToggle(active.id);
          }}
        >
          {isPicked ? "Remove pick" : atCap ? "Pick cap reached" : "Add focus to plan"}
        </button>
      </div>

      {/* Tall Editorial 3D-top board — majority height, markers focus ledger */}
      <div className="prism-board" role="region" aria-label="3D board">
        <p className="prism-board__label">3D board</p>
        <div className="prism-board__sky" aria-hidden="true" />
        <div className="prism-board__table">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="prism-board__terrain"
            src={terrainSrc}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
            }}
          />
          <div className="prism-board__veil" aria-hidden="true" />
          <ul className="prism-board__markers">
            {REGIONS.map((r) => {
              const picked = picks.includes(r.id);
              const on = r.id === focus;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`prism-board__marker${on ? " is-focus" : ""}${picked ? " is-picked" : ""}`}
                    onClick={() => setFocus(r.id)}
                    aria-label={`${r.name}${picked ? ", picked" : ""}`}
                    aria-pressed={on}
                  >
                    <Crest id={r.id} size={22} />
                    <span>{r.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Bottom ledger only — recipe: no right inspector on Map */}
      <div className="prism-map-ledger" aria-live="polite">
        <span className="inline-flex items-center gap-2">
          <Crest id={active.id} size={22} />
          <strong style={{ color: "var(--color-parch-50)" }}>{active.name}</strong>
        </span>
        <span className="font-mono" style={{ color: "var(--color-gem-400)" }}>
          {isPicked ? "in plan" : atCap ? "cap reached" : "available"}
        </span>
        <span style={{ color: "var(--color-parch-300)" }}>
          {fixtureCount} fixture rows · sources on Data desk
        </span>
        <span className="prism-note" style={{ margin: 0 }}>
          Markers focus ledger · full wartable on production Map
        </span>
      </div>
    </div>
  );
}

/** Twin desk: Tasks uses the same lattice · rail · facets · full source inspector as Data. */
function TasksPane() {
  const [tab, setTab] = useState<string>(TASK_TABS[0]);
  const [regionFilter, setRegionFilter] = useState("all");
  const [facet, setFacet] = useState<string>(TASK_FACETS[0]);
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");

  const regionCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of TASKS) m[t.regionId] = (m[t.regionId] ?? 0) + 1;
    return m;
  }, []);

  const filtered = useMemo(() => {
    let list = TASKS.slice();
    if (tab === "Open board") list = list.filter((t) => t.status === "Open");
    if (tab === "Done") list = list.filter((t) => t.status === "Done");
    if (tab === "Locked") list = list.filter((t) => t.status === "Locked");
    if (regionFilter !== "all") list = list.filter((t) => t.regionId === regionFilter);
    if (facet !== "All") list = list.filter((t) => t.status === facet);
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
  const pointsOpen = TASKS.filter((t) => t.status === "Open").reduce((s, t) => s + t.points, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LatticeTabs
        tabs={TASK_TABS}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setRow(0);
        }}
        ariaLabel="Task board categories"
      />

      <div className="prism-desk">
        <CrestRail
          regionFilter={regionFilter}
          onChange={(id) => {
            setRegionFilter(id);
            setRow(0);
          }}
          counts={regionCounts}
        />

        <section className="prism-stage">
          <div className="prism-stage-bar">
            <h2 className="prism-stage-title">Task tracker</h2>
            <span className="font-mono text-[12px]" style={{ color: "var(--color-gem-400)" }}>
              {pointsOpen} pts open
            </span>
            <span className="tag tag--provisional" title="Catalyst stand-in">
              Provisional
            </span>
            <span className="prism-stage-count">{filtered.length} rows</span>
            <FacetChips
              options={TASK_FACETS}
              active={facet}
              onChange={(v) => {
                setFacet(v);
                setRow(0);
              }}
              ariaLabel="Task status facets"
            />
            <label
              className="ml-auto flex items-center gap-2 text-[12px]"
              style={{ color: "var(--color-parch-100)" }}
            >
              Filter
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setRow(0);
                }}
                className="field-inset w-36 px-2 py-1 text-[15px]"
                placeholder="Title or region"
                aria-label="Filter tasks"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="data-table">
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
                {filtered.map((t, i) => {
                  const on = i === row;
                  return (
                    <tr
                      key={t.id}
                      className={on ? "is-selected" : undefined}
                      onClick={() => setRow(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setRow(i);
                        }
                      }}
                      tabIndex={0}
                      style={{ cursor: "pointer" }}
                      aria-selected={on}
                    >
                      <td className="font-medium">{t.title}</td>
                      <td className="secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <Crest id={t.regionId} size={14} />
                          {t.region}
                        </span>
                      </td>
                      <td className="secondary">{t.tier}</td>
                      <td className="font-mono">{t.points}</td>
                      <td>
                        <span className="tag">{t.status}</span>
                      </td>
                      <td className="font-mono secondary">{t.sources.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 ? (
              <p className="p-3 text-[13px]" style={{ color: "var(--color-parch-300)" }}>
                No tasks in this facet cut
              </p>
            ) : null}
          </div>
        </section>

        <aside className="prism-inspector" aria-label="Task full record">
          {selected ? (
            <>
              <div className="prism-inspector-head">
                <Crest id={selected.regionId} size={28} />
                <div>
                  <h3 className="prism-inspector-title">{selected.title}</h3>
                  {selected.provisional ? (
                    <span className="tag tag--provisional mt-1">Provisional fixture</span>
                  ) : null}
                </div>
              </div>
              <div className="px-3 pb-2">
                <p className="stat-key m-0">{selected.points}</p>
                <p className="m-0 text-[12px]" style={{ color: "var(--color-parch-300)" }}>
                  points (demo)
                </p>
              </div>
              <dl className="prism-field-grid">
                <dt>id</dt>
                <dd className="font-mono">{selected.id}</dd>
                <dt>title</dt>
                <dd>{selected.title}</dd>
                <dt>region</dt>
                <dd>{selected.region}</dd>
                <dt>regionId</dt>
                <dd className="font-mono">{selected.regionId}</dd>
                <dt>tier</dt>
                <dd>{selected.tier}</dd>
                <dt>points</dt>
                <dd className="font-mono">{selected.points}</dd>
                <dt>status</dt>
                <dd>
                  <span className="tag">{selected.status}</span>
                </dd>
                <dt>provisional</dt>
                <dd className="font-mono">{String(selected.provisional)}</dd>
                <dt>note</dt>
                <dd style={{ color: "var(--color-parch-100)" }}>{selected.note}</dd>
                <dt>sourceCount</dt>
                <dd className="font-mono">{selected.sources.length}</dd>
              </dl>
              <SourceList sources={selected.sources} />
              <p className="prism-note px-3 pb-3">
                Catalyst stand-in · not Equilibrium published list · sources? · verified{" "}
                {selected.sources[0]?.verifiedAt ?? "—"}
              </p>
            </>
          ) : (
            <p className="p-3 text-[13px]" style={{ color: "var(--color-parch-300)" }}>
              No task selected
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function DataPane() {
  const [tab, setTab] = useState<string>(DATA_TABS[0]);
  const [regionFilter, setRegionFilter] = useState("all");
  const [facet, setFacet] = useState<string>(DATA_FACETS[0]);
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");

  const regionCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of FIXTURE) m[r.regionId] = (m[r.regionId] ?? 0) + 1;
    return m;
  }, []);

  const filtered = useMemo(() => {
    let list = FIXTURE.slice();
    if (regionFilter !== "all") list = list.filter((r) => r.regionId === regionFilter);
    if (facet !== "All kinds") {
      const kind = facet as CatalogRow["kind"];
      list = list.filter((r) => r.kind === kind);
    }
    if (tab === "Progression") list = list.filter((r) => r.kind === "Unlock" || r.kind === "Skilling");
    if (tab === "Unlocks") list = list.filter((r) => r.kind === "Unlock");
    if (tab === "Systems") list = list.filter((r) => r.kind === "Travel" || r.kind === "Combat");
    if (tab === "Sources") list = list.filter((r) => r.sources.length >= 2);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q) ||
          r.kind.toLowerCase().includes(q) ||
          r.tags.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tab, regionFilter, facet, query]);

  const selected = filtered[row] ?? filtered[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LatticeTabs
        tabs={DATA_TABS}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setRow(0);
        }}
        ariaLabel="Data categories"
      />

      <div className="prism-desk">
        <CrestRail
          regionFilter={regionFilter}
          onChange={(id) => {
            setRegionFilter(id);
            setRow(0);
          }}
          counts={regionCounts}
        />

        <section className="prism-stage">
          <div className="prism-stage-bar">
            <h2 className="prism-stage-title">
              {tab} · catalog
            </h2>
            <span className="tag">Fixture</span>
            <span className="prism-stage-count">{filtered.length} rows</span>
            <FacetChips
              options={DATA_FACETS}
              active={facet}
              onChange={(v) => {
                setFacet(v);
                setRow(0);
              }}
              ariaLabel="Catalog kind facets"
            />
            <label
              className="ml-auto flex items-center gap-2 text-[12px]"
              style={{ color: "var(--color-parch-100)" }}
            >
              Filter
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setRow(0);
                }}
                className="field-inset w-40 px-2 py-1 text-[15px]"
                placeholder="Name, region, tags"
                aria-label="Filter catalog"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Region</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Status</th>
                  <th scope="col">Src</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const on = i === row;
                  return (
                    <tr
                      key={r.id}
                      className={on ? "is-selected" : undefined}
                      onClick={() => setRow(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setRow(i);
                        }
                      }}
                      tabIndex={0}
                      style={{ cursor: "pointer" }}
                      aria-selected={on}
                    >
                      <td className="font-medium">{r.name}</td>
                      <td className="secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <Crest id={r.regionId} size={14} />
                          {r.region}
                        </span>
                      </td>
                      <td className="secondary">{r.kind}</td>
                      <td className="font-mono">{r.qty}</td>
                      <td>
                        <span className="tag">{r.status}</span>
                      </td>
                      <td className="font-mono secondary">{r.sources.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 ? (
              <p className="p-3 text-[13px]" style={{ color: "var(--color-parch-300)" }}>
                No catalog rows in this cut
              </p>
            ) : null}
          </div>
        </section>

        <aside className="prism-inspector" aria-label="Catalog full record">
          {selected ? (
            <>
              <div className="prism-inspector-head">
                <Crest id={selected.regionId} size={28} />
                <div>
                  <h3 className="prism-inspector-title">{selected.name}</h3>
                  <span className="tag mt-1">Fixture</span>
                </div>
              </div>
              <div className="px-3 pb-2">
                <p className="stat-key m-0">{selected.qty}</p>
                <p className="m-0 text-[12px]" style={{ color: "var(--color-parch-300)" }}>
                  quantity (demo)
                </p>
              </div>
              <dl className="prism-field-grid">
                <dt>id</dt>
                <dd className="font-mono">{selected.id}</dd>
                <dt>name</dt>
                <dd>{selected.name}</dd>
                <dt>region</dt>
                <dd>{selected.region}</dd>
                <dt>regionId</dt>
                <dd className="font-mono">{selected.regionId}</dd>
                <dt>kind</dt>
                <dd>{selected.kind}</dd>
                <dt>status</dt>
                <dd>
                  <span className="tag">{selected.status}</span>
                </dd>
                <dt>qty</dt>
                <dd className="font-mono">{selected.qty}</dd>
                <dt>tags</dt>
                <dd style={{ color: "var(--color-parch-100)" }}>{selected.tags}</dd>
                <dt>provisional</dt>
                <dd className="font-mono">{String(selected.provisional)}</dd>
                <dt>note</dt>
                <dd style={{ color: "var(--color-parch-100)" }}>{selected.note}</dd>
                <dt>sourceCount</dt>
                <dd className="font-mono">{selected.sources.length}</dd>
              </dl>
              <SourceList sources={selected.sources} />
              <p className="prism-note px-3 pb-3">
                Full field dump · all sources listed · sources? · verified{" "}
                {selected.sources[0]?.verifiedAt ?? "fixture only"}
              </p>
            </>
          ) : (
            <p className="p-3 text-[13px]" style={{ color: "var(--color-parch-300)" }}>
              No row selected
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function BuildPane({
  picks,
  onToggle,
  onClear,
}: {
  picks: readonly RegionId[];
  onToggle: (id: RegionId) => void;
  onClear: () => void;
}) {
  const [seg, setSeg] = useState<string>(BUILD_SEGS[0]);
  const [selectedRelic, setSelectedRelic] = useState<RelicId | null>("survivalist");
  const [focusTier, setFocusTier] = useState(1);
  const picked = picks.length;
  const atCap = picked >= 3;
  const active =
    T1_RELICS.find((r) => r.id === selectedRelic) ?? T1_RELICS[0];
  const showCourt = focusTier === 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LatticeTabs
        tabs={BUILD_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Build sections"
      />

      <div className="prism-stage-bar">
        <h2 className="prism-stage-title">{seg}</h2>
        {seg === "Regions" ? (
          <span
            className="font-mono text-[13px]"
            style={{ color: "var(--color-gem-400)" }}
            aria-live="polite"
          >
            {picked}/3
          </span>
        ) : null}
        {seg === "Relics" ? (
          <span className="text-[12px]" style={{ color: "var(--color-parch-300)" }}>
            T1 revealed · monogram frames · T2–T7 sealed
          </span>
        ) : (
          <span className="text-[12px]" style={{ color: "var(--color-parch-300)" }}>
            Editorial build · ironman self-sufficient
          </span>
        )}
        <button
          type="button"
          className="ml-auto px-2.5 py-1 text-[12px]"
          style={{
            border: "1px solid var(--color-stone-750)",
            background: "var(--color-stone-850)",
            color: picked === 0 ? "var(--color-parch-400)" : "var(--color-parch-100)",
            cursor: picked === 0 ? "not-allowed" : "pointer",
            opacity: picked === 0 ? 0.6 : 1,
            boxShadow: "inset 0 1px 0 var(--color-stone-carve)",
          }}
          disabled={picked === 0}
          onClick={onClear}
        >
          Clear picks
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {seg === "Regions" ? (
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {REGIONS.map((r) => {
              const isOn = picks.includes(r.id);
              const disabled = !isOn && atCap;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (disabled) return;
                      onToggle(r.id);
                    }}
                    className="panel panel--carved flex w-full items-center gap-2 px-2.5 py-2 text-left text-[13px]"
                    style={{
                      color: isOn ? "var(--color-gem-300)" : "var(--color-parch-100)",
                      boxShadow: isOn
                        ? "inset 0 0 0 1px var(--color-gem-500), inset 0 1px 0 var(--color-stone-carve)"
                        : undefined,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.55 : 1,
                    }}
                    aria-disabled={disabled || undefined}
                    aria-pressed={isOn}
                  >
                    <Crest id={r.id} size={20} />
                    <span className="font-medium" style={{ color: "inherit" }}>
                      {r.name}
                    </span>
                    {isOn ? (
                      <span
                        className="ml-auto font-mono text-[11px]"
                        style={{ color: "var(--color-gem-400)" }}
                      >
                        pick
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {seg === "Relics" ? (
          <div className="prism-court">
            <div className="prism-tier-rail" role="tablist" aria-label="Relic tiers">
              <span className="prism-tier-rail__label">Tiers</span>
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
                    className={`prism-tier-chip${open ? " is-open" : " is-sealed"}${
                      on && open ? " is-on" : ""
                    }`}
                    onClick={() => {
                      if (open) setFocusTier(t.tier);
                    }}
                    title={open ? `Tier ${t.tier} open` : `Tier ${t.tier} sealed`}
                  >
                    <span className="prism-tier-chip__n">T{t.tier}</span>
                    <span className="prism-tier-chip__sub">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {showCourt ? (
              <>
                <div className="prism-court-grid">
                  {T1_RELICS.map((relic) => {
                    const isSel = selectedRelic === relic.id;
                    return (
                      <button
                        key={relic.id}
                        type="button"
                        className={`panel panel--carved prism-relic-card${isSel ? " is-selected" : ""}`}
                        onClick={() => setSelectedRelic(relic.id)}
                        aria-pressed={isSel}
                      >
                        <div className="prism-relic-card__top">
                          <RelicMono mono={relic.mono} />
                          <div className="prism-relic-card__meta">
                            <p className="prism-relic-card__name">{relic.name}</p>
                            <p className="prism-relic-card__tier">Tier 1 · revealed</p>
                            {isSel ? (
                              <p className="prism-relic-card__pick">seated</p>
                            ) : null}
                          </div>
                        </div>
                        <p className="prism-relic-card__blurb">{relic.blurb}</p>
                        <div className="prism-skill-chips">
                          {relic.skills.map((sk) => (
                            <span key={sk} className="prism-skill-chip">
                              <SkillIcon id={sk} size={12} />
                              {sk}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="prism-folio">
                  <div className="panel panel--facet">
                    <div className="panel-head">{active.name} · full effects</div>
                    <div className="panel-body">
                      <div className="mb-3 flex items-center gap-3">
                        <RelicMono mono={active.mono} />
                        <div>
                          <p
                            className="m-0 text-[14px] font-medium tracking-[0.08em] uppercase"
                            style={{ color: "var(--color-gold-400)" }}
                          >
                            {active.name}
                          </p>
                          <p
                            className="m-0 mt-1 text-[12px]"
                            style={{ color: "var(--color-parch-300)" }}
                          >
                            Monogram frame · no Equilibrium relic icon in public/game
                          </p>
                        </div>
                      </div>
                      <ul className="prism-effects">
                        {active.effects.map((fx) => (
                          <li key={fx}>{fx}</li>
                        ))}
                      </ul>
                      <p className="prism-note" style={{ marginTop: "0.75rem" }}>
                        {RELIC_SOURCE}
                      </p>
                    </div>
                  </div>

                  <div className="panel panel--carved">
                    <div className="panel-head">Court provenance</div>
                    <div className="panel-body text-[13px]">
                      <dl className="prism-ledger">
                        <dt>Envelope</dt>
                        <dd>data/league/relics.json</dd>
                        <dt>Published</dt>
                        <dd className="font-mono">2026-07-23</dd>
                        <dt>Verified</dt>
                        <dd className="font-mono">2026-07-25</dd>
                        <dt>Choices</dt>
                        <dd className="font-mono">3 / tier</dd>
                        <dt>Art</dt>
                        <dd>CSS monogram only</dd>
                        <dt>Seated</dt>
                        <dd className="font-mono">
                          {selectedRelic ? active.mono : "—"}
                        </dd>
                      </dl>
                      <p className="prism-note">
                        Upgrade gear icons never stand in for relics · Catalyst PNGs unwired
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="panel panel--carved">
                <div className="panel-head">Tier {focusTier}</div>
                <div className="panel-body text-[15px]">
                  <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
                    Sealed. Empty records until an official source exists.
                  </p>
                  <p className="prism-note">T1 is the only revealed tier · no invented effects</p>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {seg === "Blessings" ? (
          <div className="panel panel--carved">
            <div className="panel-head">Blessings</div>
            <div className="panel-body text-[15px]">
              <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
                Empty until official reveal. God Tier derivation stays unbound.
              </p>
              <p className="prism-note">records: [] · honest empty · no invented blessings</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CombatPane() {
  const [seg, setSeg] = useState<string>(COMBAT_SEGS[0]);
  const [style, setStyle] = useState<"melee" | "ranged" | "magic" | "necromancy">("melee");
  const styles = [
    { id: "melee" as const, label: "Melee" },
    { id: "ranged" as const, label: "Ranged" },
    { id: "magic" as const, label: "Magic" },
    { id: "necromancy" as const, label: "Necromancy" },
  ];
  const styleLabel = styles.find((s) => s.id === style)?.label ?? style;

  const emptyCopy =
    seg === "Rotation"
      ? "Rotation bay holds ability order and adrenaline gates. Nothing lands until the combat core binds. League relics enter through the ruleset boundary only."
      : seg === "Analysis"
        ? "Analysis waits on a live Damage Potential pass. Target fields are generic structure only; no output figures are invented."
        : seg === "Setup"
          ? "Setup holds style and generic target inputs. Hit cap and DPL stay vacant until the calculator is bound — empty slots mean unbound, not zero."
          : "Quick view shows the style you picked and the empty crystal result bay. Damage Potential and hit cap appear when the combat core connects. No fake numbers.";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <LatticeTabs
        tabs={COMBAT_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Combat sections"
      />

      <div className="prism-stage-bar">
        <h2 className="prism-stage-title">{seg}</h2>
        <span className="text-[12px]" style={{ color: "var(--color-parch-300)" }}>
          Crystal main · Editorial frames · generic target
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[1fr_240px]">
        <div className="space-y-3">
          <div className="panel panel--facet">
            <div className="panel-head">Style · crystal facets</div>
            <div className="panel-body">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Combat style">
                {styles.map((s) => {
                  const on = s.id === style;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      className={`prism-facet flex items-center gap-2 px-2.5 py-1.5 text-[13px]${on ? " is-on" : ""}`}
                      style={{ fontSize: "0.8125rem" }}
                      aria-pressed={on}
                    >
                      <GameIcon
                        src={styleIconPath(s.id)}
                        size={18}
                        className="shrink-0"
                        alt=""
                      />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="panel panel--carved">
            <div className="panel-head">Target (generic)</div>
            <div className="panel-body">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["Defence level", "90"],
                  ["Affinity", "55"],
                  ["Size", "1×1"],
                  ["HP %", "100"],
                ].map(([label, val]) => (
                  <label
                    key={label}
                    className="flex flex-col gap-1 text-[12px]"
                    style={{ color: "var(--color-parch-300)" }}
                  >
                    {label}
                    <input
                      className="field-inset px-2 py-1.5 text-[15px]"
                      defaultValue={val}
                      readOnly
                      aria-label={label}
                    />
                  </label>
                ))}
              </div>
              <p className="mt-2 mb-0 text-[11px]" style={{ color: "var(--color-parch-400)" }}>
                No boss phases · no enrage · no kill-time sim
              </p>
            </div>
          </div>

          {seg === "Rotation" ? (
            <div className="panel panel--carved">
              <div className="panel-head">Rotation bay</div>
              <div className="panel-body">
                <div
                  className="mb-2 grid gap-1.5"
                  style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
                  aria-hidden="true"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div
                      key={n}
                      className="flex h-9 items-center justify-center text-[11px]"
                      style={{
                        border: "1px dashed var(--color-stone-750)",
                        background: "var(--color-stone-inset)",
                        color: "var(--color-parch-400)",
                      }}
                    >
                      {n}
                    </div>
                  ))}
                </div>
                <p className="m-0 text-[13px]" style={{ color: "var(--color-parch-100)" }}>
                  Ability slots reserved. Order and adrenaline gates bind with the combat core.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["assault", "greater-flurry", "berserk", "meteor-strike"].map((ab) => (
                    <span
                      key={ab}
                      className="inline-flex items-center gap-1.5 text-[11px]"
                      style={{ color: "var(--color-parch-300)" }}
                    >
                      <GameIcon
                        src={gameIconPath("combat/abilities/melee", ab)}
                        size={16}
                        alt=""
                      />
                      {ab}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {seg === "Analysis" ? (
            <div className="panel panel--carved">
              <div className="panel-head">Output structure</div>
              <div className="panel-body">
                <dl className="prism-ledger">
                  <dt>Damage Potential</dt>
                  <dd style={{ color: "var(--color-parch-400)" }}>Unbound</dd>
                  <dt>Hit distribution</dt>
                  <dd style={{ color: "var(--color-parch-400)" }}>Unbound</dd>
                  <dt>Accuracy pass</dt>
                  <dd style={{ color: "var(--color-parch-400)" }}>Unbound</dd>
                  <dt>League modifiers</dt>
                  <dd style={{ color: "var(--color-parch-400)" }}>Ruleset off until bind</dd>
                </dl>
              </div>
            </div>
          ) : null}

          {seg === "Setup" ? (
            <div className="panel panel--carved">
              <div className="panel-head">Setup notes</div>
              <div className="panel-body text-[13px]" style={{ color: "var(--color-parch-100)" }}>
                <p className="m-0">
                  Creature flags, vulnerability, poisonable, and Slayer category bind with the
                  calculator. This shell only proves chrome density and honest vacancy.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="prism-empty-bay" aria-label="Combat results">
          <div className="prism-empty-slot">
            <p className="prism-empty-label">Damage Potential</p>
            <p className="prism-empty-value">Awaiting calc bind</p>
          </div>
          <div className="prism-empty-slot">
            <p className="prism-empty-label">Hit cap</p>
            <p className="prism-empty-value">Awaiting calc bind</p>
          </div>
          <div className="prism-empty-slot">
            <p className="prism-empty-label">Style</p>
            <p className="prism-empty-value is-bound">
              {styleLabel.slice(0, 3).toUpperCase()}
            </p>
          </div>
          <p className="m-0 text-[12px]" style={{ color: "var(--color-parch-100)" }}>
            {emptyCopy}
          </p>
          <p className="prism-note">Fixture shell · no invented DPL</p>
        </aside>
      </div>
    </div>
  );
}

export function PrismPreview() {
  const [nav, setNav] = useState<NavId>("Data");
  const [picks, setPicks] = useState<RegionId[]>(() => [...INITIAL_PICKS]);

  const taskDone = TASKS.filter((t) => t.status === "Done").length;
  const taskTotal = TASKS.length;

  const togglePick = (id: RegionId) => {
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const clearPicks = () => setPicks([]);

  return (
    <div className="hybrid-skin--prism prism-shell">
      <PrismNav active={nav} onChange={setNav} picks={picks.length} />

      {nav === "Overview" ? (
        <OverviewPane picks={picks} taskDone={taskDone} taskTotal={taskTotal} />
      ) : null}
      {nav === "Map" ? (
        <MapPane picks={picks} onToggle={togglePick} onClear={clearPicks} />
      ) : null}
      {nav === "Tasks" ? <TasksPane /> : null}
      {nav === "Build" ? (
        <BuildPane picks={picks} onToggle={togglePick} onClear={clearPicks} />
      ) : null}
      {nav === "Combat" ? <CombatPane /> : null}
      {nav === "Data" ? <DataPane /> : null}
    </div>
  );
}
