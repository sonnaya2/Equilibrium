"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { gameIconPath, regionCrestPath, styleIconPath } from "@/lib/gameArt";
import "./orbit.css";

/**
 * Team Orbit · Board Sky — Hybrid Composition R2
 * FIXED recipe: Editorial colors · Daylight overview · Map Editorial 3D-top NO inspector ·
 * Tasks Crystal×Data · Build Editorial + T1 relic court · Combat Crystal+Editorial ·
 * Data Lattice+Editorial+Daylight browse + FULL sources (title · url · verifiedAt · sourceType).
 * Signature: tall 3D board zone + ledger a11y; no RegionInspector.
 * Fixture data only. No production globals. No gen-AI.
 */

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;
type NavId = (typeof NAV)[number];

const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems"] as const;
const BUILD_SEGS = ["Regions", "Relics", "Blessings"] as const;
const COMBAT_SEGS = ["Quick", "Setup", "Analysis", "Rotation"] as const;
const TASK_TIERS = ["All", "Easy", "Medium", "Hard", "Elite"] as const;

const REGIONS = [
  { id: "misthalin", name: "Misthalin", plate: "Starter", note: "Varrock / Lumbridge ledger" },
  { id: "havenhythe", name: "Havenhythe", plate: "Starter", note: "Shore net · sister start" },
  { id: "asgarnia", name: "Asgarnia", plate: "Unlock", note: "Falador fort · white knight slate" },
  { id: "karamja", name: "Karamja", plate: "Early", note: "Island heat · TzHaar access" },
  { id: "desert", name: "Desert", plate: "Unlock", note: "Menaphos plate · heat stage" },
  { id: "fremennik", name: "Fremennik", plate: "Unlock", note: "Rellekka pier · northern haul" },
  { id: "morytania", name: "Morytania", plate: "Unlock", note: "Canifis crypt · swamp edge" },
  { id: "tirannwn", name: "Tirannwn", plate: "Unlock", note: "Crystal canopy · dust chain" },
  { id: "kandarin", name: "Kandarin", plate: "Unlock", note: "Ardougne market · seers plate" },
  { id: "anachronia", name: "Anachronia", plate: "Late", note: "Dig site · totem ledger" },
  { id: "forinthry", name: "Forinthry", plate: "Unlock", note: "Fort courtyard · workshop" },
] as const;

type RegionId = (typeof REGIONS)[number]["id"];

const TREE = [
  { id: "regions", label: "Regions", crest: "misthalin", kind: "crest" as const },
  { id: "skills", label: "Skills", crest: "slayer", kind: "skill" as const },
  { id: "tracks", label: "Tracks", crest: "archaeology", kind: "skill" as const },
  { id: "combat", label: "Combat", crest: "melee", kind: "style" as const },
  { id: "sources", label: "Sources", crest: "divination", kind: "skill" as const },
] as const;

/** Full SourceReference shape — title · url/path · verifiedAt · sourceType · optional note. */
type SourceType = "wiki" | "official" | "community" | "fixture" | "capture" | "sync";
type SourceRef = {
  title: string;
  url: string;
  verifiedAt: string;
  sourceType: SourceType;
  note?: string;
};

/** Fixture catalog — demo rows only, never published league facts. */
const FIXTURE = [
  {
    name: "Varrock Museum Kudos path",
    region: "Misthalin",
    regionId: "misthalin" as RegionId,
    kind: "Skilling unlock",
    track: "Support",
    status: "Fixture",
    qty: 3,
    sources: [
      {
        title: "Varrock Museum (wiki)",
        url: "https://runescape.wiki/w/Varrock_Museum",
        verifiedAt: "2026-03-12",
        sourceType: "wiki" as const,
        note: "Kudos thresholds and exhibit list — structure only, fixture demo.",
      },
      {
        title: "In-game UI capture",
        url: "fixture://capture/varrock-museum-panel",
        verifiedAt: "2026-03-14",
        sourceType: "capture" as const,
        note: "Panel layout reference for unlock presentation.",
      },
    ],
  },
  {
    name: "TzHaar Fight Cave access",
    region: "Karamja",
    regionId: "karamja" as RegionId,
    kind: "Combat gate",
    track: "Combat",
    status: "Fixture",
    qty: 1,
    sources: [
      {
        title: "TzHaar Fight Cave",
        url: "https://runescape.wiki/w/TzHaar_Fight_Cave",
        verifiedAt: "2026-02-28",
        sourceType: "wiki" as const,
        note: "Entry requirements shape only — not a league task claim.",
      },
      {
        title: "TzHaar City (context)",
        url: "https://runescape.wiki/w/TzHaar_City",
        verifiedAt: "2026-04-02",
        sourceType: "community" as const,
        note: "City approach notes for gate presentation.",
      },
    ],
  },
  {
    name: "Warriors' Guild tokens",
    region: "Asgarnia",
    regionId: "asgarnia" as RegionId,
    kind: "Minigame",
    track: "Combat",
    status: "Fixture",
    qty: 6,
    sources: [
      {
        title: "Warriors' Guild (wiki)",
        url: "https://runescape.wiki/w/Warriors%27_Guild",
        verifiedAt: "2026-03-01",
        sourceType: "wiki" as const,
        note: "Token sinks and defender path — fixture scaffolding.",
      },
      {
        title: "Patch notes archive",
        url: "fixture://notes/warriors-guild-tokens",
        verifiedAt: "2025-11-18",
        sourceType: "fixture" as const,
        note: "Historical token economy changes for cross-check.",
      },
    ],
  },
  {
    name: "Menaphos reputation track",
    region: "Desert",
    regionId: "desert" as RegionId,
    kind: "Progression",
    track: "Support",
    status: "Fixture",
    qty: 4,
    sources: [
      {
        title: "Menaphos reputation",
        url: "https://runescape.wiki/w/Menaphos/Reputation",
        verifiedAt: "2026-01-22",
        sourceType: "wiki" as const,
        note: "Faction ladder labels only — no invented league points.",
      },
    ],
  },
  {
    name: "Fremennik sagas re-clear",
    region: "Fremennik",
    regionId: "fremennik" as RegionId,
    kind: "Quest chain",
    track: "Progression",
    status: "Fixture",
    qty: 2,
    sources: [
      {
        title: "Fremennik Sagas",
        url: "https://runescape.wiki/w/Fremennik_Sagas",
        verifiedAt: "2026-02-04",
        sourceType: "wiki" as const,
        note: "Saga list for browse density demo.",
      },
    ],
  },
  {
    name: "Canifis slayer tower route",
    region: "Morytania",
    regionId: "morytania" as RegionId,
    kind: "Slayer",
    track: "Combat",
    status: "Fixture",
    qty: 8,
    sources: [
      {
        title: "Slayer Tower",
        url: "https://runescape.wiki/w/Slayer_Tower",
        verifiedAt: "2026-03-08",
        sourceType: "wiki" as const,
        note: "Floor layout and task categories — structure fixture.",
      },
      {
        title: "Sync report · slayer",
        url: "data/research/planner-expansions-slayer.json",
        verifiedAt: "2026-03-10",
        sourceType: "sync" as const,
        note: "Provenance envelope shape for SourceReference UI.",
      },
    ],
  },
  {
    name: "Prifddinas crystal seed loop",
    region: "Tirannwn",
    regionId: "tirannwn" as RegionId,
    kind: "Skilling unlock",
    track: "Artisan",
    status: "Fixture",
    qty: 5,
    sources: [
      {
        title: "Crystal seeds",
        url: "https://runescape.wiki/w/Crystal_seed",
        verifiedAt: "2026-02-16",
        sourceType: "wiki" as const,
        note: "Seed → tool chain for artisan track demo.",
      },
    ],
  },
  {
    name: "Seers' Village diary set",
    region: "Kandarin",
    regionId: "kandarin" as RegionId,
    kind: "Diary",
    track: "Support",
    status: "Fixture",
    qty: 4,
    sources: [
      {
        title: "Seers' Village Diary",
        url: "https://runescape.wiki/w/Seers%27_Village_achievements",
        verifiedAt: "2026-01-30",
        sourceType: "wiki" as const,
        note: "Diary tier labels — not Equilibrium tasks.",
      },
    ],
  },
  {
    name: "Anachronia totem sites",
    region: "Anachronia",
    regionId: "anachronia" as RegionId,
    kind: "Skilling unlock",
    track: "Gather",
    status: "Fixture",
    qty: 7,
    sources: [
      {
        title: "Anachronia totems",
        url: "https://runescape.wiki/w/Anachronia#Totems",
        verifiedAt: "2026-03-05",
        sourceType: "wiki" as const,
        note: "Site count and set bonuses as browse fixture.",
      },
      {
        title: "In-game map pin survey",
        url: "fixture://capture/anachronia-totem-pins",
        verifiedAt: "2026-03-06",
        sourceType: "capture" as const,
        note: "Pin density reference for board markers.",
      },
    ],
  },
  {
    name: "Fort Forinthry workshop",
    region: "Forinthry",
    regionId: "forinthry" as RegionId,
    kind: "Construction",
    track: "Artisan",
    status: "Fixture",
    qty: 3,
    sources: [
      {
        title: "Fort Forinthry",
        url: "https://runescape.wiki/w/Fort_Forinthry",
        verifiedAt: "2026-02-20",
        sourceType: "wiki" as const,
        note: "Workshop unlock ladder — fixture only.",
      },
    ],
  },
  {
    name: "Havenhythe shore net",
    region: "Havenhythe",
    regionId: "havenhythe" as RegionId,
    kind: "Skilling note",
    track: "Gather",
    status: "Fixture",
    qty: 2,
    sources: [
      {
        title: "League briefing (provisional)",
        url: "fixture://league/havenhythe-shore-net",
        verifiedAt: "2026-07-01",
        sourceType: "fixture" as const,
        note: "Starter plate placeholder until official region brief expands.",
      },
    ],
  },
] as const;

type FixtureRow = (typeof FIXTURE)[number];

/** Equilibrium T1 — names + effects from data/league/relics.json (Jagex countdown). Monogram only. */
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

const RELIC_SOURCE_URL =
  "https://secure.runescape.com/m=news/countdown-to-leagues-ii-equilibrium";

/** Catalyst stand-in tasks — provisional until Equilibrium publishes. */
const TASKS = [
  {
    id: "t1",
    title: "Reach total level 500",
    region: "Misthalin",
    regionId: "misthalin" as RegionId,
    points: 30,
    tier: "Easy" as const,
    status: "Open" as const,
  },
  {
    id: "t2",
    title: "Complete a hard diary",
    region: "Asgarnia",
    regionId: "asgarnia" as RegionId,
    points: 40,
    tier: "Medium" as const,
    status: "Open" as const,
  },
  {
    id: "t3",
    title: "Kill a God Wars general",
    region: "Asgarnia",
    regionId: "asgarnia" as RegionId,
    points: 50,
    tier: "Hard" as const,
    status: "Locked" as const,
  },
  {
    id: "t4",
    title: "Train Slayer to 70",
    region: "Morytania",
    regionId: "morytania" as RegionId,
    points: 35,
    tier: "Medium" as const,
    status: "Done" as const,
  },
  {
    id: "t5",
    title: "Unlock a lodestone network",
    region: "Karamja",
    regionId: "karamja" as RegionId,
    points: 20,
    tier: "Easy" as const,
    status: "Done" as const,
  },
  {
    id: "t6",
    title: "Finish a master quest",
    region: "Tirannwn",
    regionId: "tirannwn" as RegionId,
    points: 60,
    tier: "Elite" as const,
    status: "Locked" as const,
  },
  {
    id: "t7",
    title: "Gather 1,000 harmonic dust",
    region: "Tirannwn",
    regionId: "tirannwn" as RegionId,
    points: 25,
    tier: "Medium" as const,
    status: "Open" as const,
  },
  {
    id: "t8",
    title: "Clear a raid wing once",
    region: "Kandarin",
    regionId: "kandarin" as RegionId,
    points: 80,
    tier: "Elite" as const,
    status: "Locked" as const,
  },
  {
    id: "t9",
    title: "Catch a sailfish on the shore",
    region: "Havenhythe",
    regionId: "havenhythe" as RegionId,
    points: 15,
    tier: "Easy" as const,
    status: "Open" as const,
  },
  {
    id: "t10",
    title: "Repair the fort workshop once",
    region: "Forinthry",
    regionId: "forinthry" as RegionId,
    points: 45,
    tier: "Hard" as const,
    status: "Open" as const,
  },
] as const;

const INITIAL_PICKS: RegionId[] = ["misthalin", "asgarnia"];

const STYLE_OPTIONS = [
  { id: "melee" as const, label: "Melee" },
  { id: "ranged" as const, label: "Ranged" },
  { id: "magic" as const, label: "Magic" },
  { id: "necromancy" as const, label: "Necromancy" },
];

/* ── Atoms ─────────────────────────────────────────────────────────── */

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <GameIcon src={regionCrestPath(id)} size={size} className="shrink-0" alt="" />
  );
}

function SkillIcon({ id, size = 12 }: { id: string; size?: number }) {
  return (
    <GameIcon src={gameIconPath("skills", id)} size={size} className="shrink-0" alt="" />
  );
}

function LeafIcon({
  kind,
  id,
  size = 14,
}: {
  kind: "crest" | "skill" | "style";
  id: string;
  size?: number;
}) {
  const src =
    kind === "crest"
      ? regionCrestPath(id)
      : kind === "skill"
        ? gameIconPath("skills", id)
        : styleIconPath(id as "melee" | "ranged" | "magic" | "necromancy");
  return <GameIcon src={src} size={size} className="shrink-0" alt="" />;
}

function KeyFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="orbit-panel orbit-panel--carved" style={{ marginTop: "0.5rem" }}>
      <div className="orbit-panel__body" style={{ padding: "0.55rem 0.65rem" }}>
        <p className="m-0 text-[12px]" style={{ color: "var(--orbit-parch-300)" }}>
          {label}
        </p>
        <p className="orbit-stat-key mt-1 mb-0">{value}</p>
      </div>
    </div>
  );
}

function SegmentBar({
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
    <div className="orbit-seg-bar" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const on = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={on}
            className={`orbit-seg${on ? " is-active" : ""}`}
            onClick={() => onChange(tab)}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

function Mast({ active, onChange }: { active: NavId; onChange: (id: NavId) => void }) {
  return (
    <header className="orbit-mast">
      <p className="orbit-brand">EQUILIBRIUM</p>
      <nav aria-label="Primary">
        <ul>
          {NAV.map((label) => {
            const on = label === active;
            return (
              <li key={label}>
                <button
                  type="button"
                  className={`orbit-nav-link${on ? " is-active" : ""}`}
                  onClick={() => onChange(label)}
                  aria-current={on ? "page" : undefined}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <span className="orbit-mast__meta" aria-live="polite">
        Board Sky · R2
      </span>
    </header>
  );
}

function isHttpUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

function SourcesBlock({
  sources,
  verifiedLine,
}: {
  sources: readonly SourceRef[];
  verifiedLine: string;
}) {
  return (
    <div className="orbit-live-sources">
      <p
        className="m-0 font-display text-[12px] tracking-[0.1em] uppercase"
        style={{ color: "var(--orbit-gold)" }}
      >
        Sources · {sources.length} {sources.length === 1 ? "entry" : "entries"}
      </p>
      {sources.length === 0 ? (
        <p className="orbit-note" style={{ margin: "0.45rem 0 0" }}>
          No sources attached — honest empty.
        </p>
      ) : (
        <ul className="orbit-source-list">
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`} className="orbit-source-card">
              <p className="orbit-source-card__title">{s.title}</p>
              {isHttpUrl(s.url) ? (
                <a
                  className="orbit-source-card__url"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.url}
                </a>
              ) : (
                <p className="orbit-source-card__path font-mono">{s.url}</p>
              )}
              <p className="orbit-source-card__meta">
                <span className="orbit-source-card__type">{s.sourceType}</span>
                <span>verified {s.verifiedAt}</span>
              </p>
              {s.note ? <p className="orbit-source-card__note">{s.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <section className="orbit-live-sources" aria-live="polite">
        <p className="orbit-note">{verifiedLine}</p>
      </section>
    </div>
  );
}

/* ── Overview · Daylight ───────────────────────────────────────────── */

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
  const slots: ((typeof REGIONS)[number] | null)[] = [0, 1, 2].map((i) => picked[i] ?? null);

  return (
    <div className="orbit-daylight orbit-route">
      <header className="orbit-lintel">
        <h2 className="orbit-lintel-title">Courtyard plan</h2>
        <p className="orbit-lintel-meta">Leagues II · Equilibrium · Daylight gate</p>
      </header>

      <div className="orbit-gate">
        <aside className="orbit-jamb" aria-label="Region picks">
          <p className="orbit-jamb-label">Standing picks</p>
          {slots.map((r, i) =>
            r ? (
              <div key={r.id} className="orbit-standing">
                <Crest id={r.id} size={26} />
                <p className="orbit-standing-name">{r.name}</p>
              </div>
            ) : (
              <div key={`empty-${i}`} className="orbit-standing is-empty">
                Slot {i + 1}
              </div>
            ),
          )}
        </aside>

        <div className="orbit-aperture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/keyart-2026.jpg" alt="" />
          <p className="orbit-aperture-caption">Fort gate · living world</p>
        </div>

        <aside className="orbit-jamb" aria-label="Plan milestones">
          <p className="orbit-jamb-label">Milestones</p>
          <div className="orbit-milestone">
            <p className="orbit-milestone-k">Picks</p>
            <p className="orbit-milestone-v">
              {picks.length}/3
            </p>
          </div>
          <div className="orbit-milestone">
            <p className="orbit-milestone-k">Tasks</p>
            <p className="orbit-milestone-v">
              {taskDone}/{taskTotal}
            </p>
          </div>
          <div className="orbit-milestone">
            <p className="orbit-milestone-k">Catalog</p>
            <p className="orbit-milestone-v">{FIXTURE.length}</p>
          </div>
          <div className="orbit-milestone">
            <p className="orbit-milestone-k">Blessings</p>
            <p className="orbit-milestone-v is-quiet">Unrevealed</p>
          </div>
        </aside>
      </div>

      <div className="orbit-desk">
        <div className="orbit-panel orbit-panel--slate">
          <div className="orbit-panel__head">Plan ledger</div>
          <div className="orbit-panel__body">
            <dl className="orbit-ledger">
              <dt>Region picks</dt>
              <dd className="mono">
                {picks.length}/3
                {picked.length > 0 ? (
                  <span
                    className="ml-2 font-sans"
                    style={{ color: "var(--orbit-parch-100)", fontFamily: "inherit" }}
                  >
                    · {picked.map((r) => r.name).join(" · ")}
                  </span>
                ) : (
                  <span
                    className="ml-2 font-sans"
                    style={{ color: "var(--orbit-parch-300)", fontFamily: "inherit" }}
                  >
                    · none chosen — open Map or Build
                  </span>
                )}
              </dd>
              <dt>Tasks</dt>
              <dd className="mono">
                {taskDone}/{taskTotal} done · Catalyst stand-ins
              </dd>
              <dt>Blessings</dt>
              <dd>Empty until official reveal</dd>
              <dt>Relics</dt>
              <dd>Seven tiers · pending reveal</dd>
              <dt>Mode</dt>
              <dd>Ironman · self-sufficient</dd>
            </dl>
            <p className="orbit-note mt-3">
              sources? · verified fixture only · demo catalog
            </p>
          </div>
        </div>

        <div className="orbit-panel orbit-panel--carved">
          <div className="orbit-panel__head">Next on the board</div>
          <div className="orbit-panel__body space-y-2 text-[13px]">
            <p className="m-0" style={{ color: "var(--orbit-parch-50)" }}>
              {picks.length < 3
                ? "Finish three region picks on Map (Board Sky) or Build."
                : "Region cap filled. Tasks and combat bind when you open those routes."}
            </p>
            <ul
              className="m-0 list-none space-y-1.5 p-0"
              style={{ color: "var(--orbit-parch-100)" }}
            >
              <li className="flex items-center gap-2">
                <span
                  className="font-mono text-[11px]"
                  style={{ color: picks.length >= 3 ? "var(--orbit-gem)" : "var(--orbit-parch-400)" }}
                >
                  {picks.length >= 3 ? "ok" : "··"}
                </span>
                Regions {picks.length}/3
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px]" style={{ color: "var(--orbit-parch-400)" }}>
                  ··
                </span>
                Blessings locked empty
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px]" style={{ color: "var(--orbit-parch-400)" }}>
                  ··
                </span>
                Combat calc unbound
              </li>
              <li className="flex items-center gap-2">
                <span className="font-mono text-[11px]" style={{ color: "var(--orbit-gem)" }}>
                  sky
                </span>
                Map is the masterpiece — tall board, ledger a11y
              </li>
            </ul>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="orbit-chip">
                Picks <span className="orbit-chip__val">{picks.length}/3</span>
              </span>
              <span className="orbit-chip">
                Tasks{" "}
                <span className="orbit-chip__val">
                  {taskDone}/{taskTotal}
                </span>
              </span>
              <span className="orbit-chip orbit-chip--quiet">
                Blessings <span className="orbit-chip__val">—</span>
              </span>
              <span className="orbit-chip">
                Mode <span className="orbit-chip__val">Iron</span>
              </span>
            </div>
            <p className="orbit-note pt-1">No invented league numbers. Empty means empty.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Map · Board Sky (NO RegionInspector) ──────────────────────────── */

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
    <div className="orbit-map" data-signature="board-sky">
      {/* Ledger owns all pick a11y — no third-column inspector */}
      <aside className="orbit-ledger-col" aria-label="Region ledger">
        <div className="orbit-ledger-head">
          <h2 className="orbit-ledger-title">Region ledger</h2>
          <span className="orbit-pick-count" aria-live="polite">
            {pickLabel}
          </span>
          <button
            type="button"
            className="orbit-btn ml-auto"
            disabled={picks.length === 0}
            onClick={onClear}
          >
            Clear picks
          </button>
        </div>

        <p className="orbit-note px-3 pt-2">
          Board Sky · focus lives in the ledger · no RegionInspector
        </p>

        <ul className="orbit-region-list">
          {REGIONS.map((r) => {
            const picked = picks.includes(r.id);
            const focused = r.id === focus;
            const disabled = !picked && atCap;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`orbit-region-btn${picked ? " is-picked" : ""}${focused ? " is-focus" : ""}`}
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
                      style={{ color: "var(--orbit-gem)" }}
                    >
                      pick
                    </span>
                  ) : (
                    <span
                      className="ml-auto text-[10px]"
                      style={{ color: "var(--orbit-parch-400)" }}
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
        <div className="orbit-focus-card" aria-live="polite">
          <div className="mb-2 flex items-center gap-2">
            <Crest id={active.id} size={28} />
            <h3>{active.name}</h3>
          </div>
          <p className="m-0 text-[13px]" style={{ color: "var(--orbit-parch-50)" }}>
            {active.note}
          </p>
          <dl
            className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]"
            style={{ margin: "0.5rem 0 0" }}
          >
            <dt style={{ color: "var(--orbit-parch-300)" }}>Plate</dt>
            <dd className="m-0" style={{ color: "var(--orbit-parch-100)" }}>
              {active.plate}
            </dd>
            <dt style={{ color: "var(--orbit-parch-300)" }}>Status</dt>
            <dd className="m-0" style={{ color: "var(--orbit-parch-50)" }}>
              {isPicked ? "In plan" : atCap ? "Cap reached" : "Available"}
            </dd>
            <dt style={{ color: "var(--orbit-parch-300)" }}>Fixture rows</dt>
            <dd className="m-0 font-mono" style={{ color: "var(--orbit-gem)" }}>
              {FIXTURE.filter((f) => f.regionId === active.id).length}
            </dd>
          </dl>
          <button
            type="button"
            className="orbit-btn orbit-btn--gem mt-3 w-full"
            style={{ width: "100%" }}
            aria-disabled={!isPicked && atCap ? true : undefined}
            onClick={() => {
              if (!isPicked && atCap) return;
              onToggle(active.id);
            }}
          >
            {isPicked ? "Remove pick" : atCap ? "Pick cap reached" : "Add to plan"}
          </button>
          <p className="orbit-note mt-2">
            Ledger buttons toggle picks · board markers focus the ledger card
          </p>
        </div>
      </aside>

      {/* Tall 3D board zone — MapLoader-shaped mock */}
      <div className="orbit-board" role="region" aria-label="3D board">
        <p className="orbit-board__label">3D board</p>
        <div className="orbit-board__sky" aria-hidden="true" />
        <div className="orbit-board__table">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="orbit-board__terrain"
            src={terrainSrc}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
            }}
          />
          <div className="orbit-board__veil" aria-hidden="true" />
          <ul className="orbit-board__markers">
            {REGIONS.map((r) => {
              const picked = picks.includes(r.id);
              const focused = r.id === focus;
              return (
                <li key={r.id} style={{ listStyle: "none" }}>
                  <button
                    type="button"
                    className={`orbit-board__marker${picked ? " is-picked" : ""}${focused ? " is-focus" : ""}`}
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
        </div>
      </div>
    </div>
  );
}

/* ── Tasks · Crystal × Data ────────────────────────────────────────── */

function TasksPane() {
  const [tier, setTier] = useState<string>(TASK_TIERS[0]);
  const [row, setRow] = useState(0);

  const filtered = useMemo(() => {
    if (tier === "All") return TASKS;
    return TASKS.filter((t) => t.tier === tier);
  }, [tier]);

  const selected = filtered[row] ?? filtered[0];
  const pointsOpen = TASKS.filter((t) => t.status === "Open").reduce((s, t) => s + t.points, 0);
  const pointsDone = TASKS.filter((t) => t.status === "Done").reduce((s, t) => s + t.points, 0);

  return (
    <div className="orbit-tasks orbit-route">
      <div className="orbit-route-head">
        <h2>Task tracker</h2>
        <span className="orbit-pick-count">{pointsOpen} pts open</span>
        <span className="orbit-tag" title="Catalyst stand-in until Equilibrium publishes">
          Provisional
        </span>
        <span className="orbit-chip orbit-chip--quiet ml-auto">
          Crystal × Data
        </span>
      </div>

      <div className="orbit-tasks-grid">
        <nav className="orbit-crystal-rail" aria-label="Task tiers">
          <p className="orbit-crystal-rail__label">Tiers</p>
          {TASK_TIERS.map((t) => {
            const on = t === tier;
            const count =
              t === "All" ? TASKS.length : TASKS.filter((x) => x.tier === t).length;
            return (
              <button
                key={t}
                type="button"
                className={`orbit-tree-btn${on ? " is-active" : ""}`}
                onClick={() => {
                  setTier(t);
                  setRow(0);
                }}
              >
                {t}
                <span
                  className="ml-auto font-mono text-[11px]"
                  style={{ color: on ? "var(--orbit-gem)" : "var(--orbit-parch-400)" }}
                >
                  {count}
                </span>
              </button>
            );
          })}
          <div style={{ padding: "0.65rem" }}>
            <div className="orbit-panel orbit-panel--facet">
              <div className="orbit-panel__head">Points</div>
              <div className="orbit-panel__body">
                <p className="orbit-stat-key">{pointsOpen}</p>
                <p className="orbit-note mt-1">open · {pointsDone} done (fixture)</p>
              </div>
            </div>
          </div>
        </nav>

        <section className="orbit-data-stage" style={{ minHeight: 0, overflow: "auto" }}>
          <table className="orbit-table">
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Region</th>
                <th scope="col">Tier</th>
                <th scope="col">Pts</th>
                <th scope="col">Status</th>
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
                      <span className="orbit-tag">{t.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <aside className="orbit-inspector" aria-label="Task detail">
          {selected ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                <Crest id={selected.regionId} size={22} />
                <h3
                  className="m-0 font-display text-[13px] tracking-[0.08em] uppercase"
                  style={{ color: "var(--orbit-gold)" }}
                >
                  Task detail
                </h3>
              </div>
              <p className="m-0 text-[15px]" style={{ color: "var(--orbit-parch-50)" }}>
                {selected.title}
              </p>
              <KeyFigure label="Points" value={String(selected.points)} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--orbit-parch-300)" }}>Region</dt>
                <dd className="m-0" style={{ color: "var(--orbit-parch-50)" }}>
                  {selected.region}
                </dd>
                <dt style={{ color: "var(--orbit-parch-300)" }}>Tier</dt>
                <dd className="m-0" style={{ color: "var(--orbit-parch-100)" }}>
                  {selected.tier}
                </dd>
                <dt style={{ color: "var(--orbit-parch-300)" }}>Status</dt>
                <dd className="m-0">
                  <span className="orbit-tag">{selected.status}</span>
                </dd>
              </dl>
              <div className="orbit-panel orbit-panel--facet mt-3">
                <div className="orbit-panel__body" style={{ padding: "0.55rem" }}>
                  <p className="m-0 text-[12px]" style={{ color: "var(--orbit-parch-100)" }}>
                    Crystal facet note · Data density in the stage table · provisional Catalyst
                    stand-in until Equilibrium publishes its list.
                  </p>
                </div>
              </div>
              <p className="orbit-note mt-3">
                Catalyst stand-in · not Equilibrium published list
              </p>
            </>
          ) : (
            <p className="m-0 text-[13px]" style={{ color: "var(--orbit-parch-300)" }}>
              No tasks in this tier
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── Build · Editorial + T1 relic court ────────────────────────────── */

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
    <div className="orbit-route">
      <SegmentBar
        tabs={BUILD_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Build sections"
      />

      <div className="orbit-route-head">
        <h2>{seg}</h2>
        {seg === "Regions" ? (
          <span className="orbit-pick-count" aria-live="polite">
            {picked}/3
          </span>
        ) : null}
        {seg === "Relics" && selectedRelic ? (
          <span className="orbit-chip">
            T1 <span className="orbit-chip__val">{active.name}</span>
          </span>
        ) : null}
        <span className="orbit-chip orbit-chip--quiet">
          {seg === "Relics" ? "Editorial · monogram frames" : "Editorial lattice"}
        </span>
        {seg === "Regions" ? (
          <button
            type="button"
            className="orbit-btn ml-auto"
            disabled={picked === 0}
            onClick={onClear}
          >
            Clear picks
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {seg === "Regions" ? (
          <ul className="orbit-build-grid">
            {REGIONS.map((r) => {
              const isOn = picks.includes(r.id);
              const disabled = !isOn && atCap;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`orbit-panel orbit-panel--carved orbit-build-card${isOn ? " is-picked" : ""}`}
                    style={{
                      color: isOn ? "var(--orbit-gem-bright)" : "var(--orbit-parch-100)",
                      boxShadow: isOn
                        ? "inset 0 0 0 1px var(--orbit-gem-deep), inset 0 1px 0 var(--orbit-carve)"
                        : undefined,
                      opacity: disabled ? 0.55 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                    aria-disabled={disabled || undefined}
                    aria-pressed={isOn}
                    onClick={() => {
                      if (disabled) return;
                      onToggle(r.id);
                    }}
                  >
                    <Crest id={r.id} size={22} />
                    <span className="font-medium text-[13px]" style={{ color: "inherit" }}>
                      {r.name}
                    </span>
                    {isOn ? (
                      <span
                        className="ml-auto font-mono text-[11px]"
                        style={{ color: "var(--orbit-gem)" }}
                      >
                        pick
                      </span>
                    ) : (
                      <span
                        className="ml-auto text-[11px]"
                        style={{ color: "var(--orbit-parch-400)" }}
                      >
                        {r.plate}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {seg === "Relics" ? (
          <div className="orbit-relic-court">
            <div className="orbit-relic-banner">
              <p
                className="m-0 font-display text-[12px] tracking-[0.1em] uppercase"
                style={{ color: "var(--orbit-gold)" }}
              >
                Published T1 court
              </p>
              <p className="orbit-note m-0">
                Survivalist · Endless Harvest · Golden Touch from data/league/relics.json · monogram
                placeholders until Jagex art lands under public/game · never Catalyst icons
              </p>
            </div>

            <div className="orbit-tier-rail" role="tablist" aria-label="Relic tiers">
              <span className="orbit-tier-rail__label">Tiers</span>
              {RELIC_TIERS.map((t) => {
                const on = focusTier === t.tier;
                const open = t.revealed;
                return (
                  <button
                    key={t.tier}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    className={`orbit-tier-chip${open ? " is-open" : " is-sealed"}${
                      on ? " is-selected" : ""
                    }`}
                    onClick={() => setFocusTier(t.tier)}
                    title={open ? `Tier ${t.tier} open` : `Tier ${t.tier} sealed — empty until reveal`}
                  >
                    <span className="orbit-tier-chip__n">T{t.tier}</span>
                    <span className="orbit-tier-chip__sub">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {showCourt ? (
              <>
                <div className="orbit-relic-grid">
                  {T1_RELICS.map((relic) => {
                    const isSel = selectedRelic === relic.id;
                    return (
                      <button
                        key={relic.id}
                        type="button"
                        className={`orbit-panel orbit-panel--carved orbit-relic-card${
                          isSel ? " is-selected" : ""
                        }`}
                        onClick={() => setSelectedRelic(relic.id)}
                        aria-pressed={isSel}
                      >
                        <div className="orbit-relic-card__top">
                          <div className="orbit-relic-mono" aria-hidden>
                            <span className="orbit-relic-mono__glyph">{relic.mono}</span>
                          </div>
                          <div className="orbit-relic-card__meta">
                            <p className="orbit-relic-card__name">{relic.name}</p>
                            <p className="orbit-relic-card__tier">Tier 1 · revealed</p>
                            {isSel ? (
                              <p className="orbit-relic-card__pick">seated</p>
                            ) : null}
                          </div>
                        </div>
                        <p className="orbit-relic-card__blurb">{relic.blurb}</p>
                        <div className="orbit-skill-chips">
                          {relic.skills.map((sk) => (
                            <span key={sk} className="orbit-skill-chip">
                              <SkillIcon id={sk} size={12} />
                              {sk}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="orbit-relic-folio">
                  <div className="orbit-panel orbit-panel--carved">
                    <div className="orbit-panel__head">{active.name} · full effects</div>
                    <div className="orbit-panel__body">
                      <div className="mb-3 flex items-center gap-3">
                        <div className="orbit-relic-mono" aria-hidden>
                          <span className="orbit-relic-mono__glyph">{active.mono}</span>
                        </div>
                        <div>
                          <p
                            className="m-0 font-display text-[14px] tracking-[0.1em] uppercase"
                            style={{ color: "var(--orbit-gold)" }}
                          >
                            {active.name}
                          </p>
                          <p
                            className="m-0 mt-1 text-[12px]"
                            style={{ color: "var(--orbit-parch-300)" }}
                          >
                            CSS monogram only · no official Equilibrium relic icon in public/game
                          </p>
                        </div>
                      </div>
                      <ul className="orbit-effects">
                        {active.effects.map((fx) => (
                          <li key={fx}>{fx}</li>
                        ))}
                      </ul>
                      <SourcesBlock
                        sources={[
                          {
                            title: "Countdown to LEAGUES II: EQUILIBRIUM!",
                            url: RELIC_SOURCE_URL,
                            verifiedAt: "2026-07-25",
                            sourceType: "official",
                            note: "Jagex countdown · T1 choices published · envelope verified false until full audit.",
                          },
                          {
                            title: "data/league/relics.json",
                            url: "data/league/relics.json",
                            verifiedAt: "2026-07-25",
                            sourceType: "sync",
                            note: "Canonical planner envelope · tier 1 revealed · tiers 2–7 empty choices.",
                          },
                        ]}
                        verifiedLine="sources? · verified 2026-07-25 · official countdown + data envelope"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-3">
                <div className="orbit-panel orbit-panel--carved">
                  <div className="orbit-panel__head">Tier {focusTier}</div>
                  <div className="orbit-panel__body text-[15px]">
                    <p className="m-0" style={{ color: "var(--orbit-parch-50)" }}>
                      Sealed. Empty records until an official source exists — never invent tier
                      effects to fill a stub.
                    </p>
                    <p className="orbit-note mt-2">
                      T1 is published · T2–T7 stay sealed · blessings stay empty
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {seg === "Blessings" ? (
          <div className="p-3">
            <div className="orbit-panel orbit-panel--carved">
              <div className="orbit-panel__head">Blessings</div>
              <div className="orbit-panel__body text-[15px]">
                <p className="m-0" style={{ color: "var(--orbit-parch-50)" }}>
                  Unrevealed. Empty records until an official source exists.
                </p>
                <p className="orbit-note mt-2">
                  Eight blessing tiers + God Tier derivation stay empty · Order / Chaos / Balance
                  are data labels only, never chrome · ironman / self-sufficient planning only
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {["Order", "Balance", "Chaos"].map((path) => (
                    <div
                      key={path}
                      className="flex h-20 flex-col items-center justify-center gap-1 text-[12px]"
                      style={{
                        border: "1px dashed var(--orbit-border)",
                        background: "var(--orbit-inset)",
                        color: "var(--orbit-parch-400)",
                      }}
                    >
                      <span style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {path}
                      </span>
                      <span>empty path</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Combat · Crystal + Editorial ──────────────────────────────────── */

function CombatPane() {
  const [seg, setSeg] = useState<string>(COMBAT_SEGS[0]);
  const [style, setStyle] = useState<"melee" | "ranged" | "magic" | "necromancy">("melee");
  const styleLabel = STYLE_OPTIONS.find((s) => s.id === style)?.label ?? style;

  const emptyCopy =
    seg === "Rotation"
      ? "Rotation bay is wired for ability order and adrenaline gates. Nothing lands until the combat core binds to this shell. League relics enter through the ruleset boundary only — not baked into base formulas."
      : seg === "Analysis"
        ? "Analysis waits on a live Damage Potential pass. Target fields on the left are generic defaults for structure only; no output figures are invented here."
        : seg === "Setup"
          ? "Setup holds style and generic target inputs. Hit cap and DPL stay vacant until the calculator is bound — empty slots mean unbound, not zero."
          : "Quick view shows the style you picked and the empty result bay. Damage Potential and hit cap will appear here when the combat core is connected. No fake numbers.";

  const abilityIcons =
    style === "melee"
      ? ["assault", "berserk", "overpower", "greater-barge"]
      : style === "ranged"
        ? ["bombardment", "deaths-swiftness", "greater-ricochet", "shadow-tendrils"]
        : style === "magic"
          ? ["sunshine", "greater-chain", "magma-tempest", "greater-concentrated-blast"]
          : ["living-death", "split-soul", "invoke-lord-of-bones", "living-death"];

  return (
    <div className="orbit-route">
      <SegmentBar
        tabs={COMBAT_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Combat sections"
      />

      <div className="orbit-route-head">
        <h2>{seg}</h2>
        <span className="text-[12px]" style={{ color: "var(--orbit-parch-300)" }}>
          Generic target · current RS3 math + league modifiers
        </span>
        <span className="orbit-chip ml-auto">
          Crystal + Editorial
        </span>
      </div>

      <div className="orbit-combat-grid">
        <div className="space-y-3">
          <div className="orbit-panel orbit-panel--facet">
            <div className="orbit-panel__head">Style</div>
            <div className="orbit-panel__body">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Combat style">
                {STYLE_OPTIONS.map((s) => {
                  const on = s.id === style;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      className="orbit-btn flex items-center gap-2"
                      style={{
                        borderColor: on ? "var(--orbit-gem-deep)" : undefined,
                        color: on ? "var(--orbit-gem-bright)" : undefined,
                        background: on ? "var(--orbit-raised)" : undefined,
                      }}
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

          <div className="orbit-panel orbit-panel--carved">
            <div className="orbit-panel__head">Target (generic)</div>
            <div className="orbit-panel__body">
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
                    style={{ color: "var(--orbit-parch-300)" }}
                  >
                    {label}
                    <input
                      className="orbit-field"
                      defaultValue={val}
                      readOnly
                      aria-label={label}
                    />
                  </label>
                ))}
              </div>
              <p className="orbit-note mt-2">No boss phases · no enrage · no kill-time sim</p>
            </div>
          </div>

          {seg === "Rotation" ? (
            <div className="orbit-panel orbit-panel--facet">
              <div className="orbit-panel__head">Rotation bay</div>
              <div className="orbit-panel__body">
                <div
                  className="mb-2 grid gap-1.5"
                  style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
                >
                  {abilityIcons.map((name, n) => (
                    <div
                      key={`${name}-${n}`}
                      className="flex h-12 flex-col items-center justify-center gap-0.5"
                      style={{
                        border: "1px dashed var(--orbit-crystal-moss)",
                        background: "var(--orbit-inset)",
                        color: "var(--orbit-parch-400)",
                      }}
                    >
                      <GameIcon
                        src={gameIconPath(
                          `combat/abilities/${style === "necromancy" ? "necromancy" : style}`,
                          name,
                        )}
                        size={20}
                        alt=""
                      />
                      <span className="text-[9px]">{n + 1}</span>
                    </div>
                  ))}
                </div>
                <p className="m-0 text-[13px]" style={{ color: "var(--orbit-parch-100)" }}>
                  Ability slots reserved. Order and adrenaline gates bind with the combat core.
                </p>
              </div>
            </div>
          ) : null}

          {seg === "Analysis" ? (
            <div className="orbit-panel orbit-panel--slate">
              <div className="orbit-panel__head">Output structure</div>
              <div className="orbit-panel__body">
                <dl className="orbit-ledger">
                  <dt>Damage Potential</dt>
                  <dd style={{ color: "var(--orbit-parch-400)" }}>Unbound</dd>
                  <dt>Hit distribution</dt>
                  <dd style={{ color: "var(--orbit-parch-400)" }}>Unbound</dd>
                  <dt>Accuracy pass</dt>
                  <dd style={{ color: "var(--orbit-parch-400)" }}>Unbound</dd>
                  <dt>League modifiers</dt>
                  <dd style={{ color: "var(--orbit-parch-400)" }}>Ruleset off until bind</dd>
                </dl>
              </div>
            </div>
          ) : null}

          {seg === "Setup" ? (
            <div className="orbit-panel orbit-panel--carved">
              <div className="orbit-panel__head">Equipment notes</div>
              <div className="orbit-panel__body text-[13px]" style={{ color: "var(--orbit-parch-100)" }}>
                <p className="m-0">
                  Gear is out of Build (no Gear tab). Combat setup is style + generic target only.
                  Crests and ability icons prove RS art fidelity without inventing DPS.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="orbit-empty-bay" aria-label="Combat results">
          <div className="orbit-empty-slot">
            <p className="orbit-empty-label">Damage Potential</p>
            <p className="orbit-empty-value">Awaiting calc bind</p>
          </div>
          <div className="orbit-empty-slot">
            <p className="orbit-empty-label">Hit cap</p>
            <p className="orbit-empty-value">Awaiting calc bind</p>
          </div>
          <div className="orbit-empty-slot">
            <p className="orbit-empty-label">Style</p>
            <p className="orbit-empty-value is-bound">
              {styleLabel.slice(0, 3).toUpperCase()}
            </p>
          </div>
          <p className="m-0 text-[12px] leading-5" style={{ color: "var(--orbit-parch-100)" }}>
            {emptyCopy}
          </p>
          <p className="orbit-note">Fixture shell · no invented DPL</p>
        </aside>
      </div>
    </div>
  );
}

/* ── Data · Lattice + Daylight browse + full sources inspector ─────── */

function DataPane() {
  const [tab, setTab] = useState<string>(DATA_TABS[0]);
  const [leaf, setLeaf] = useState<string>("regions");
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows: readonly FixtureRow[] = FIXTURE;
    if (leaf === "combat") {
      rows = FIXTURE.filter((r) => r.track === "Combat");
    } else if (leaf === "skills") {
      rows = FIXTURE.filter((r) =>
        ["Skilling unlock", "Skilling note", "Diary", "Construction"].includes(r.kind),
      );
    } else if (leaf === "tracks") {
      rows = FIXTURE.filter((r) => r.track === "Gather" || r.track === "Artisan");
    } else if (leaf === "sources") {
      rows = FIXTURE.filter((r) => r.sources.length >= 2);
    }
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q) ||
        r.track.toLowerCase().includes(q),
    );
  }, [query, leaf]);

  const selected = filtered[row] ?? filtered[0];
  const leafMeta = TREE.find((t) => t.id === leaf) ?? TREE[0];
  const primarySource = selected?.sources[0];
  const verifiedLine = primarySource
    ? `sources? · verified ${primarySource.verifiedAt}`
    : "sources? · verified fixture only";

  return (
    <div className="orbit-data orbit-route">
      <SegmentBar
        tabs={DATA_TABS}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setRow(0);
        }}
        ariaLabel="Data categories"
      />

      <div className="orbit-data-grid">
        <nav className="orbit-data-rail" aria-label="Category tree">
          <p
            className="border-b px-2.5 py-1.5 text-[12px] font-medium"
            style={{
              borderColor: "var(--orbit-border)",
              color: "var(--orbit-parch-100)",
            }}
          >
            {tab} · lattice
          </p>
          <ul className="m-0 list-none p-0 py-1">
            {TREE.map((item) => {
              const on = item.id === leaf;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`orbit-tree-btn${on ? " is-active" : ""}`}
                    onClick={() => {
                      setLeaf(item.id);
                      setRow(0);
                    }}
                  >
                    <LeafIcon kind={item.kind} id={item.crest} size={14} />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <div style={{ padding: "0.5rem 0.65rem" }}>
            <p className="orbit-note">
              Lattice rail · only the active leaf filters the stage. Crests stay in tree + rows +
              inspector.
            </p>
          </div>
        </nav>

        <section className="orbit-data-stage">
          {tab === "Browse" ? (
            <div className="orbit-daylight-band">
              <span
                className="font-display text-[12px] tracking-[0.12em] uppercase"
                style={{ color: "var(--orbit-gold)" }}
              >
                Daylight browse
              </span>
              <span className="orbit-chip">
                Leaf <span className="orbit-chip__val">{leafMeta.label}</span>
              </span>
              <span className="orbit-chip orbit-chip--quiet">
                Rows <span className="orbit-chip__val">{filtered.length}</span>
              </span>
              <span className="orbit-note" style={{ marginLeft: "auto" }}>
                Editorial stage under Daylight lintel band
              </span>
            </div>
          ) : (
            <div className="orbit-route-head" style={{ borderBottom: "1px solid var(--orbit-border)" }}>
              <h2 className="flex items-center gap-2 text-[15px]">
                <LeafIcon kind={leafMeta.kind} id={leafMeta.crest} size={16} />
                {tab} · {leafMeta.label}
              </h2>
              <span className="font-mono text-[11px]" style={{ color: "var(--orbit-parch-300)" }}>
                {filtered.length} rows
              </span>
            </div>
          )}

          <div
            className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
            style={{ borderColor: "var(--orbit-border)" }}
          >
            <label
              className="flex items-center gap-2 text-[12px]"
              style={{ color: "var(--orbit-parch-100)" }}
            >
              Filter
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setRow(0);
                }}
                className="orbit-field w-44"
                placeholder="Name, region, kind"
                aria-label="Filter rows"
              />
            </label>
            <span className="orbit-tag">Fixture catalog</span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="orbit-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Region</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Track</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Src</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const on = i === row;
                  return (
                    <tr
                      key={r.name}
                      className={on ? "is-selected" : undefined}
                      onClick={() => setRow(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setRow(i);
                        }
                      }}
                      tabIndex={0}
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
                      <td className="secondary">{r.track}</td>
                      <td className="font-mono">{r.qty}</td>
                      <td className="font-mono">{r.sources.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="orbit-inspector" aria-label="Inspector">
          {selected ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                <Crest id={selected.regionId} size={24} />
                <h3
                  className="m-0 font-display text-[14px] tracking-[0.06em]"
                  style={{ color: "var(--orbit-gold)" }}
                >
                  {selected.name}
                </h3>
              </div>
              <KeyFigure label="Quantity" value={String(selected.qty)} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--orbit-parch-300)" }}>Region</dt>
                <dd className="m-0" style={{ color: "var(--orbit-parch-50)" }}>
                  {selected.region}
                </dd>
                <dt style={{ color: "var(--orbit-parch-300)" }}>Kind</dt>
                <dd className="m-0" style={{ color: "var(--orbit-parch-100)" }}>
                  {selected.kind}
                </dd>
                <dt style={{ color: "var(--orbit-parch-300)" }}>Track</dt>
                <dd className="m-0" style={{ color: "var(--orbit-parch-100)" }}>
                  {selected.track}
                </dd>
                <dt style={{ color: "var(--orbit-parch-300)" }}>Status</dt>
                <dd className="m-0">
                  <span className="orbit-tag">{selected.status}</span>
                </dd>
                <dt style={{ color: "var(--orbit-parch-300)" }}>Category</dt>
                <dd className="m-0" style={{ color: "var(--orbit-parch-100)" }}>
                  {tab} · {leafMeta.label}
                </dd>
              </dl>

              {/* Full SourceReference inspector — recipe hard requirement */}
              <SourcesBlock sources={selected.sources} verifiedLine={verifiedLine} />

              <p className="orbit-note mt-3">
                Full sources inspector · title · url/path · verifiedAt · sourceType · optional note ·
                multi when multi · never invent league numbers to fill a stub
              </p>
            </>
          ) : (
            <p className="m-0 text-[13px]" style={{ color: "var(--orbit-parch-300)" }}>
              No row selected
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── Root ──────────────────────────────────────────────────────────── */

export function OrbitPreview() {
  const [nav, setNav] = useState<NavId>("Map");
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
    <div className="hybrid-skin--orbit flex h-full min-h-[70vh] flex-col">
      <Mast active={nav} onChange={setNav} />

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

      <footer
        className="mt-auto border-t px-3 py-2 text-[11px]"
        style={{
          borderColor: "var(--orbit-border)",
          color: "var(--orbit-parch-400)",
          background: "var(--orbit-shell)",
        }}
      >
        Team Orbit · Board Sky · hybrid R2 · fixture demo · RuneScape is a trademark of Jagex Ltd.
      </footer>
    </div>
  );
}

export default OrbitPreview;
