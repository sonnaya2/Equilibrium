"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import {
  regionCrestPath,
  styleIconPath,
  gameIconPath,
  STYLE_ICON,
} from "@/lib/gameArt";

/**
 * Team Forge · CALC CRYSTAL — Hybrid composition R1
 * Signature: Combat crystal facet ability desk + honest DPL/adren vacancy.
 * Recipe: Editorial colors · Daylight Overview · Map no inspector ·
 * Tasks Crystal×Data · Build Editorial · Combat Crystal · Data 3-col.
 * Tokens: parent .hybrid-skin--forge (forge.css). Fixture only — no invented math.
 */

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;
type NavId = (typeof NAV)[number];

const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems"] as const;
const BUILD_SEGS = ["Regions", "Relics", "Blessings"] as const;
const COMBAT_SEGS = ["Quick", "Setup", "Analysis", "Rotation"] as const;
const TASK_BANDS = ["All", "Easy", "Medium", "Hard", "Elite"] as const;
const STYLE_FILTERS = [
  "All",
  "Melee",
  "Magic",
  "Ranged",
  "Necromancy",
  "Defence",
] as const;

type StyleId = Exclude<(typeof STYLE_FILTERS)[number], "All">;

const REGIONS = [
  { id: "misthalin", name: "Misthalin", note: "Starter plain · Lumbridge / Varrock" },
  { id: "havenhythe", name: "Havenhythe", note: "Sister start · shore dock" },
  { id: "asgarnia", name: "Asgarnia", note: "Falador fort · white knight slate" },
  { id: "karamja", name: "Karamja", note: "Volcanic island · TzHaar heat" },
  { id: "desert", name: "Desert", note: "Menaphos plate · Sophanem" },
  { id: "fremennik", name: "Fremennik", note: "North coast · Rellekka pier" },
  { id: "morytania", name: "Morytania", note: "Swamp border · Canifis crypt" },
  { id: "tirannwn", name: "Tirannwn", note: "Crystal canopy · Prif dust" },
  { id: "kandarin", name: "Kandarin", note: "Western kingdoms · Seers plate" },
  { id: "anachronia", name: "Anachronia", note: "Dig isle · base camp" },
  { id: "forinthry", name: "Forinthry", note: "Fort rebuild · courtyard" },
] as const;

type RegionId = (typeof REGIONS)[number]["id"];

/** Catalog fixtures — labeled demo, never published league facts. */
const FIXTURE = [
  {
    name: "Varrock Museum kudos path",
    region: "Misthalin",
    regionId: "misthalin" as RegionId,
    kind: "Skilling unlock",
    track: "General",
    status: "Fixture",
    qty: 3,
    source: "wiki-demo",
    verified: "2026-03-12",
  },
  {
    name: "TzHaar Fight Cave access",
    region: "Karamja",
    regionId: "karamja" as RegionId,
    kind: "Combat gate",
    track: "Combat",
    status: "Fixture",
    qty: 1,
    source: "wiki-demo",
    verified: "2026-03-12",
  },
  {
    name: "Warriors' Guild token desk",
    region: "Asgarnia",
    regionId: "asgarnia" as RegionId,
    kind: "Minigame",
    track: "Combat",
    status: "Fixture",
    qty: 6,
    source: "wiki-demo",
    verified: "2026-02-28",
  },
  {
    name: "Menaphos reputation track",
    region: "Desert",
    regionId: "desert" as RegionId,
    kind: "Progression",
    track: "Progression",
    status: "Fixture",
    qty: 4,
    source: "wiki-demo",
    verified: "2026-01-20",
  },
  {
    name: "Fremennik sagas re-clear",
    region: "Fremennik",
    regionId: "fremennik" as RegionId,
    kind: "Quest chain",
    track: "Progression",
    status: "Fixture",
    qty: 2,
    source: "wiki-demo",
    verified: "2026-02-01",
  },
  {
    name: "Canifis slayer tower route",
    region: "Morytania",
    regionId: "morytania" as RegionId,
    kind: "Slayer",
    track: "Combat",
    status: "Fixture",
    qty: 8,
    source: "wiki-demo",
    verified: "2026-03-01",
  },
  {
    name: "Prifddinas crystal seed loop",
    region: "Tirannwn",
    regionId: "tirannwn" as RegionId,
    kind: "Skilling unlock",
    track: "Skilling",
    status: "Fixture",
    qty: 5,
    source: "wiki-demo",
    verified: "2026-03-08",
  },
  {
    name: "Seers' Village diary set",
    region: "Kandarin",
    regionId: "kandarin" as RegionId,
    kind: "Diary",
    track: "General",
    status: "Fixture",
    qty: 4,
    source: "wiki-demo",
    verified: "2026-02-14",
  },
  {
    name: "Anachronia totem sites",
    region: "Anachronia",
    regionId: "anachronia" as RegionId,
    kind: "Skilling unlock",
    track: "Skilling",
    status: "Fixture",
    qty: 7,
    source: "wiki-demo",
    verified: "2026-03-05",
  },
  {
    name: "Fort Forinthry workshop",
    region: "Forinthry",
    regionId: "forinthry" as RegionId,
    kind: "Construction",
    track: "Progression",
    status: "Fixture",
    qty: 3,
    source: "wiki-demo",
    verified: "2026-03-10",
  },
  {
    name: "Havenhythe shore net",
    region: "Havenhythe",
    regionId: "havenhythe" as RegionId,
    kind: "Hub",
    track: "General",
    status: "Fixture",
    qty: 2,
    source: "wiki-demo",
    verified: "2026-03-11",
  },
  {
    name: "Archaeology guild desk",
    region: "Misthalin",
    regionId: "misthalin" as RegionId,
    kind: "Guild",
    track: "Skilling",
    status: "Fixture",
    qty: 1,
    source: "wiki-demo",
    verified: "2026-02-22",
  },
] as const;

type FixtureRow = (typeof FIXTURE)[number];

const TREE = [
  { id: "regions", label: "Regions", crest: "misthalin", kind: "crest" as const },
  { id: "skills", label: "Skills", crest: "slayer", kind: "skill" as const },
  { id: "tracks", label: "Tracks", crest: "archaeology", kind: "skill" as const },
  { id: "combat", label: "Combat", crest: "melee", kind: "style" as const },
  { id: "sources", label: "Sources", crest: "divination", kind: "skill" as const },
] as const;

/** Catalyst stand-ins — provisional until Equilibrium list publishes. */
const TASKS = [
  {
    id: "t1",
    title: "Cut oak logs near Draynor",
    region: "Misthalin",
    regionId: "misthalin" as RegionId,
    pts: 10,
    band: "Easy",
    status: "Open" as const,
  },
  {
    id: "t2",
    title: "Bank at Lumbridge castle",
    region: "Misthalin",
    regionId: "misthalin" as RegionId,
    pts: 10,
    band: "Easy",
    status: "Done" as const,
  },
  {
    id: "t3",
    title: "Complete a TzHaar fight",
    region: "Karamja",
    regionId: "karamja" as RegionId,
    pts: 30,
    band: "Medium",
    status: "Open" as const,
  },
  {
    id: "t4",
    title: "Catch a shark on the docks",
    region: "Kandarin",
    regionId: "kandarin" as RegionId,
    pts: 30,
    band: "Medium",
    status: "Open" as const,
  },
  {
    id: "t5",
    title: "Smith a rune item at the anvil",
    region: "Asgarnia",
    regionId: "asgarnia" as RegionId,
    pts: 50,
    band: "Hard",
    status: "Open" as const,
  },
  {
    id: "t6",
    title: "Visit Prifddinas crystal tower",
    region: "Tirannwn",
    regionId: "tirannwn" as RegionId,
    pts: 50,
    band: "Hard",
    status: "Locked" as const,
  },
  {
    id: "t7",
    title: "Clear a Sophanem dungeon wing",
    region: "Desert",
    regionId: "desert" as RegionId,
    pts: 80,
    band: "Elite",
    status: "Locked" as const,
  },
  {
    id: "t8",
    title: "Finish a Fort Forinthry contract",
    region: "Forinthry",
    regionId: "forinthry" as RegionId,
    pts: 80,
    band: "Elite",
    status: "Open" as const,
  },
  {
    id: "t9",
    title: "Walk the Anachronia totem ring",
    region: "Anachronia",
    regionId: "anachronia" as RegionId,
    pts: 40,
    band: "Medium",
    status: "Open" as const,
  },
  {
    id: "t10",
    title: "Haul Rellekka pier nets",
    region: "Fremennik",
    regionId: "fremennik" as RegionId,
    pts: 25,
    band: "Easy",
    status: "Done" as const,
  },
] as const;

/**
 * Ability catalog — real names + real icons when present.
 * Math fields intentionally vacant (honest structured empty).
 */
type AbilityRow = {
  id: string;
  name: string;
  style: StyleId;
  kind: "Basic" | "Threshold" | "Ultimate" | "Defence";
  /** Icon path under /game/combat/abilities/… when art ships; null = style icon only */
  icon: string | null;
  role: string;
  note: string;
};

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

const STYLE_ICON_KEY: Record<StyleId, keyof typeof STYLE_ICON | null> = {
  Melee: "melee",
  Magic: "magic",
  Ranged: "ranged",
  Necromancy: "necromancy",
  Defence: null,
};

/* ── Atoms ─────────────────────────────────────────────────── */

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <GameIcon src={regionCrestPath(id)} size={size} className="shrink-0" alt="" />
  );
}

function StyleIcon({ style, size = 16 }: { style: StyleId | "All"; size?: number }) {
  if (style === "All") {
    return (
      <GameIcon
        src={gameIconPath("combat", "critical-strike")}
        size={size}
        className="shrink-0"
        alt=""
      />
    );
  }
  if (style === "Defence") {
    return (
      <GameIcon
        src={gameIconPath("combat", "defence-abilities")}
        size={size}
        className="shrink-0"
        alt=""
      />
    );
  }
  const key = STYLE_ICON_KEY[style];
  if (!key) return null;
  return (
    <GameIcon src={styleIconPath(key)} size={size} className="shrink-0" alt="" />
  );
}

function AbilityIcon({
  row,
  size = 20,
}: {
  row: AbilityRow;
  size?: number;
}) {
  if (row.icon) {
    return <GameIcon src={row.icon} size={size} className="shrink-0" alt="" />;
  }
  return <StyleIcon style={row.style} size={size} />;
}

function VacancyWell({
  label,
  caption,
}: {
  label: string;
  caption: string;
}) {
  return (
    <div className="vacancy-well" role="status">
      <span className="vacancy-k">{label}</span>
      <span className="vacancy-v" aria-hidden="true">
        —
      </span>
      <span className="vacancy-cap">{caption}</span>
    </div>
  );
}

function BoundWell({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bound-well">
      <span className="bound-k">{label}</span>
      <span
        className={mono ? "stat-key stat-key--sm" : undefined}
        style={
          mono
            ? undefined
            : { color: "var(--color-parch-50)", fontSize: "0.875rem", fontWeight: 500 }
        }
      >
        {value}
      </span>
    </div>
  );
}

function KeyFigure({
  label,
  value,
  vacant = false,
  compact = false,
}: {
  label: string;
  value: string;
  vacant?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className="panel"
      style={{ padding: compact ? "0.5rem 0.65rem" : "0.65rem 0.75rem" }}
    >
      <p
        className="m-0 text-[10px] uppercase tracking-[0.08em]"
        style={{ color: "var(--color-parch-300)" }}
      >
        {label}
      </p>
      <p
        className={`stat-key m-0 mt-1 ${compact ? "stat-key--sm" : ""} ${vacant ? "stat-key--vacant" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function ForgeNav({
  active,
  onChange,
  picks,
}: {
  active: NavId;
  onChange: (id: NavId) => void;
  picks: number;
}) {
  return (
    <header className="forge-nav">
      <span className="forge-brand">EQUILIBRIUM</span>
      <nav aria-label="Primary" className="flex flex-wrap items-center gap-0.5">
        {NAV.map((id) => (
          <button
            key={id}
            type="button"
            className="forge-nav-link"
            aria-current={active === id ? "page" : undefined}
            onClick={() => onChange(id)}
          >
            {id}
          </button>
        ))}
      </nav>
      <span
        className="ml-auto font-mono text-[12px]"
        style={{ color: "var(--color-gem-400)" }}
        aria-live="polite"
      >
        {picks}/3
      </span>
      <span
        className="hidden text-[11px] sm:inline"
        style={{ color: "var(--color-parch-400)" }}
      >
        Forge · Calc Crystal
      </span>
    </header>
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
    <div role="tablist" aria-label={ariaLabel} className="forge-seg">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={t === active}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ── Overview · Daylight ───────────────────────────────────── */

function OverviewPane({ pickedIds }: { pickedIds: Set<string> }) {
  const picked = REGIONS.filter((r) => pickedIds.has(r.id));
  const taskDone = TASKS.filter((t) => t.status === "Done").length;
  const empties = Math.max(0, 3 - picked.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="forge-keyart">
        {/* Official 2026 keyart — fort / sky crop, not a CTA funnel */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/keyart-2026.jpg" alt="" />
        <span className="forge-keyart-caption">
          2026 keyart · daylight courtyard · not a funnel
        </span>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="space-y-3">
          <div className="panel panel--daylight">
            <div className="panel-head">Region loadout</div>
            <div className="panel-body">
              <div
                className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                aria-label="Picked regions"
              >
                {picked.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-[2px] border px-2 py-2"
                    style={{
                      borderColor: "var(--color-gem-600)",
                      background: "var(--color-stone-800)",
                    }}
                  >
                    <Crest id={r.id} size={20} />
                    <span className="text-[13px] font-medium">{r.name}</span>
                  </div>
                ))}
                {Array.from({ length: empties }, (_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center justify-center rounded-[2px] border border-dashed px-2 py-2 text-[12px]"
                    style={{
                      borderColor: "var(--color-stone-750)",
                      color: "var(--color-parch-400)",
                    }}
                  >
                    Open slot
                  </div>
                ))}
              </div>
              <p
                className="mt-2 mb-0 font-mono text-[13px]"
                style={{ color: "var(--color-gem-400)" }}
                aria-live="polite"
              >
                {pickedIds.size}/3
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="panel panel--carved">
              <div className="panel-head">Plan ledger</div>
              <div className="panel-body">
                <dl className="daylight-ledger">
                  <dt>Region picks</dt>
                  <dd className="font-mono">
                    {pickedIds.size}/3
                    {picked.length > 0 ? (
                      <span
                        className="ml-2 font-sans"
                        style={{ color: "var(--color-parch-100)" }}
                      >
                        · {picked.map((r) => r.name).join(" · ")}
                      </span>
                    ) : (
                      <span
                        className="ml-2 font-sans"
                        style={{ color: "var(--color-parch-300)" }}
                      >
                        · none — open Build
                      </span>
                    )}
                  </dd>
                  <dt>Tasks</dt>
                  <dd className="font-mono">
                    {taskDone}/{TASKS.length} done · Catalyst stand-ins
                  </dd>
                  <dt>Blessings</dt>
                  <dd>Empty until official reveal</dd>
                  <dt>Relics</dt>
                  <dd>Seven tiers · pending reveal</dd>
                  <dt>Combat calc</dt>
                  <dd style={{ color: "var(--color-parch-100)" }}>
                    Desk ready · DPL unbound until setup
                  </dd>
                  <dt>Mode</dt>
                  <dd>Ironman · self-sufficient</dd>
                </dl>
                <p
                  className="mt-3 mb-0 text-[11px]"
                  style={{ color: "var(--color-parch-400)" }}
                >
                  sources? · verified fixture only · demo catalog
                </p>
              </div>
            </div>

            <div className="panel panel--daylight">
              <div className="panel-head">Next on the board</div>
              <div className="panel-body space-y-2 text-[13px]">
                <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
                  {pickedIds.size < 3
                    ? "Finish three region picks on Build or Map."
                    : "Region cap filled. Combat desk holds vacancy math until live core binds."}
                </p>
                <ul
                  className="m-0 list-none space-y-1.5 p-0"
                  style={{ color: "var(--color-parch-100)" }}
                >
                  <li className="flex items-center gap-2">
                    <span
                      className="font-mono text-[11px]"
                      style={{
                        color:
                          pickedIds.size >= 3
                            ? "var(--color-gem-400)"
                            : "var(--color-parch-400)",
                      }}
                    >
                      {pickedIds.size >= 3 ? "ok" : "··"}
                    </span>
                    Regions {pickedIds.size}/3
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: "var(--color-parch-400)" }}
                    >
                      ··
                    </span>
                    Blessings locked empty
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: "var(--color-gem-400)" }}
                    >
                      ◆
                    </span>
                    Combat facet desk — open Combat
                  </li>
                </ul>
                <p
                  className="mb-0 pt-1 text-[11px]"
                  style={{ color: "var(--color-parch-400)" }}
                >
                  No invented league numbers. Empty means empty.
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-2">
          <div className="daylight-milestone">
            <p className="daylight-milestone-k">Picks</p>
            <p className="daylight-milestone-v">{pickedIds.size}/3</p>
          </div>
          <div className="daylight-milestone">
            <p className="daylight-milestone-k">Tasks</p>
            <p className="daylight-milestone-v">
              {taskDone}/{TASKS.length}
            </p>
          </div>
          <div className="daylight-milestone">
            <p className="daylight-milestone-k">Catalog</p>
            <p className="daylight-milestone-v">{FIXTURE.length}</p>
          </div>
          <div className="daylight-milestone">
            <p className="daylight-milestone-k">DPL</p>
            <p className="daylight-milestone-v is-quiet">Unbound</p>
          </div>
          <div className="daylight-milestone">
            <p className="daylight-milestone-k">Blessings</p>
            <p className="daylight-milestone-v is-quiet">Unrevealed</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Map · Editorial + 3D top · NO inspector ────────────────── */

function MapPane({
  pickedIds,
  onToggle,
}: {
  pickedIds: Set<string>;
  onToggle: (id: RegionId) => void;
}) {
  const [focus, setFocus] = useState<RegionId>("misthalin");
  const active = REGIONS.find((r) => r.id === focus) ?? REGIONS[0];
  const isPicked = pickedIds.has(active.id);
  const atCap = pickedIds.size >= 3;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="forge-map-slab">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/keyart-2026.jpg" alt="" />
        <span className="forge-map-slab-label">
          Editorial board · 3D wartable loads on production Map · no inspector
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-stone-750 px-3 py-2">
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--color-parch-50)" }}
        >
          Region gazetteer
        </h2>
        <span
          className="font-mono text-[13px]"
          style={{ color: "var(--color-gem-400)" }}
          aria-live="polite"
        >
          {pickedIds.size}/3
        </span>
        <span className="text-[12px]" style={{ color: "var(--color-parch-300)" }}>
          All 11 crests · focus caption under board
        </span>
        <button
          type="button"
          className="ml-auto px-2 py-1 text-[12px]"
          style={{
            border: "1px solid var(--color-stone-750)",
            background: "var(--color-stone-850)",
            color: isPicked || !atCap ? "var(--color-parch-100)" : "var(--color-parch-400)",
            cursor: isPicked || !atCap ? "pointer" : "not-allowed",
          }}
          aria-disabled={!isPicked && atCap}
          disabled={!isPicked && atCap}
          onClick={() => onToggle(active.id)}
        >
          {isPicked ? "Remove pick" : atCap ? "Cap full" : "Add pick"}
        </button>
      </div>

      <div className="p-3">
        <ul className="forge-map-board m-0 list-none p-0">
          {REGIONS.map((r) => {
            const picked = pickedIds.has(r.id);
            const on = r.id === focus;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`forge-map-cell ${on ? "is-focus" : ""} ${picked ? "is-picked" : ""}`}
                  onClick={() => setFocus(r.id)}
                  aria-pressed={on}
                >
                  <Crest id={r.id} size={28} />
                  <span className="text-[12px] font-medium">{r.name}</span>
                  {picked ? (
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.08em]"
                      style={{ color: "var(--color-gem-400)" }}
                    >
                      pick
                    </span>
                  ) : (
                    <span className="text-[10px]" style={{ color: "var(--color-parch-400)" }}>
                      open
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Inline focus caption — NOT a third inspector column */}
        <section
          className="panel panel--carved mt-3"
          aria-live="polite"
          aria-label="Region focus"
        >
          <div className="panel-head flex items-center gap-2">
            <Crest id={active.id} size={18} />
            <span
              className="font-display text-[13px] tracking-[0.06em]"
              style={{ color: "var(--color-gold-400)" }}
            >
              {active.name}
            </span>
            {isPicked ? (
              <span className="tag tag-fixture ml-auto">Pick</span>
            ) : (
              <span className="tag ml-auto">Open</span>
            )}
          </div>
          <div className="panel-body">
            <p className="m-0 text-[13px]" style={{ color: "var(--color-parch-50)" }}>
              {active.note}
            </p>
            <p
              className="mt-2 mb-0 text-[11px]"
              style={{ color: "var(--color-parch-400)" }}
            >
              sources? · verified fixture only · no side inspector on Map
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Tasks · Crystal × Data ────────────────────────────────── */

function TasksPane() {
  const [band, setBand] = useState<string>("All");
  const [row, setRow] = useState(0);
  const [status, setStatus] = useState<"All" | "Open" | "Done" | "Locked">("All");

  const rows = useMemo(() => {
    return TASKS.filter((t) => {
      if (band !== "All" && t.band !== band) return false;
      if (status !== "All" && t.status !== status) return false;
      return true;
    });
  }, [band, status]);

  const selected = rows[row] ?? rows[0];
  const bandCounts = useMemo(() => {
    const m: Record<string, number> = { All: TASKS.length };
    for (const b of TASK_BANDS) {
      if (b === "All") continue;
      m[b] = TASKS.filter((t) => t.band === b).length;
    }
    return m;
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex flex-wrap items-center gap-2 border-b border-stone-750 px-3 py-2"
        style={{ background: "var(--color-stone-900)" }}
      >
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--color-parch-50)" }}
        >
          Task ledger
        </h2>
        <span className="tag tag-provisional">Provisional · Catalyst stand-in</span>
        <span
          className="font-mono text-[11px]"
          style={{ color: "var(--color-parch-300)" }}
        >
          {rows.length} shown
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-stone-750 px-3 py-2">
        {TASK_BANDS.map((b) => (
          <button
            key={b}
            type="button"
            className={`forge-facet-chip ${band === b ? "is-on" : ""}`}
            onClick={() => {
              setBand(b);
              setRow(0);
            }}
          >
            {b}
            <span className="pip">{bandCounts[b] ?? 0}</span>
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-1">
          {(["All", "Open", "Done", "Locked"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className="forge-style-chip"
              aria-selected={status === s}
              onClick={() => {
                setStatus(s);
                setRow(0);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px]">
        <div
          className="min-h-0 flex-1 overflow-auto"
          style={{ background: "var(--color-stone-800)" }}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Region</th>
                <th scope="col">Band</th>
                <th scope="col">Pts</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => {
                const on = i === row;
                return (
                  <tr
                    key={t.id}
                    className={`${on ? "is-selected" : ""} ${t.status === "Done" ? "is-done" : ""}`}
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
                    <td className="font-medium">{t.title}</td>
                    <td className="secondary">
                      <span className="inline-flex items-center gap-1.5">
                        <Crest id={t.regionId} size={14} />
                        {t.region}
                      </span>
                    </td>
                    <td className="secondary">{t.band}</td>
                    <td className="font-mono">{t.pts}</td>
                    <td className="secondary">{t.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <aside
          className="border-t border-stone-750 md:border-t-0 md:border-l"
          style={{ background: "var(--color-stone-850)" }}
        >
          {selected ? (
            <>
              <div className="forge-cut-head">
                <span className="forge-gem-mark mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <h3
                    className="m-0 font-display text-[14px] tracking-[0.06em]"
                    style={{ color: "var(--color-gold-400)" }}
                  >
                    {selected.title}
                  </h3>
                  <p
                    className="mt-1 mb-0 text-[12px]"
                    style={{ color: "var(--color-parch-300)" }}
                  >
                    {selected.band} · {selected.status}
                  </p>
                </div>
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <Crest id={selected.regionId} size={22} />
                  <span className="text-[13px]">{selected.region}</span>
                </div>
                <BoundWell label="Points" value={String(selected.pts)} />
                <p
                  className="mb-0 text-[12px]"
                  style={{ color: "var(--color-parch-100)" }}
                >
                  Catalyst stand-in until Equilibrium publishes its own list.
                  Marked provisional — not official league points.
                </p>
                <p
                  className="mb-0 text-[11px]"
                  style={{ color: "var(--color-parch-400)" }}
                >
                  sources? · verified fixture only
                </p>
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/* ── Build · Editorial + crests ────────────────────────────── */

function BuildPane({
  pickedIds,
  onToggle,
  onClear,
}: {
  pickedIds: Set<string>;
  onToggle: (id: RegionId) => void;
  onClear: () => void;
}) {
  const [seg, setSeg] = useState<string>(BUILD_SEGS[0]);
  const atCap = pickedIds.size >= 3;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={BUILD_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Build sections"
      />

      <div className="flex flex-wrap items-center gap-3 border-b border-stone-750 px-3 py-2">
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--color-parch-50)" }}
        >
          {seg}
        </h2>
        {seg === "Regions" ? (
          <>
            <span
              className="font-mono text-[13px]"
              style={{ color: "var(--color-gem-400)" }}
              aria-live="polite"
            >
              {pickedIds.size}/3
            </span>
            <span className="text-[12px]" style={{ color: "var(--color-parch-300)" }}>
              Elective — pick 3 of 11
            </span>
            <button
              type="button"
              className="ml-auto px-2 py-1 text-[12px]"
              style={{
                border: "1px solid var(--color-stone-750)",
                background: "var(--color-stone-850)",
                color:
                  pickedIds.size === 0
                    ? "var(--color-parch-400)"
                    : "var(--color-parch-100)",
                cursor: pickedIds.size === 0 ? "not-allowed" : "pointer",
              }}
              disabled={pickedIds.size === 0}
              onClick={onClear}
            >
              Clear picks
            </button>
          </>
        ) : (
          <span className="tag tag-provisional">Unrevealed</span>
        )}
      </div>

      {seg === "Regions" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-4">
            {REGIONS.map((r) => {
              const picked = pickedIds.has(r.id);
              const blocked = !picked && atCap;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`forge-pick w-full ${picked ? "is-picked" : ""} ${blocked ? "is-disabled" : ""}`}
                    onClick={() => {
                      if (blocked) return;
                      onToggle(r.id);
                    }}
                    aria-pressed={picked}
                    aria-disabled={blocked}
                    disabled={blocked}
                  >
                    <Crest id={r.id} size={32} />
                    <span className="text-[12px] font-medium">{r.name}</span>
                    <span
                      className="text-[10px]"
                      style={{
                        color: picked
                          ? "var(--color-gem-400)"
                          : "var(--color-parch-400)",
                      }}
                    >
                      {picked ? "picked" : blocked ? "cap" : "open"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {seg === "Relics" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="panel panel--carved max-w-xl">
            <div className="panel-head">Relic tiers</div>
            <div className="panel-body space-y-3">
              <p className="m-0 text-[13px]" style={{ color: "var(--color-parch-50)" }}>
                Seven relic tiers. Records stay empty until official reveal —
                Jagex icons wire when art lands under <span className="font-mono text-[12px]">/game/</span>.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 7 }, (_, i) => (
                  <div
                    key={i}
                    className="vacancy-well"
                    style={{ minHeight: "3rem" }}
                  >
                    <span className="vacancy-k">Tier {i + 1}</span>
                    <span className="vacancy-v">—</span>
                    <span className="vacancy-cap">Unrevealed</span>
                  </div>
                ))}
              </div>
              <p
                className="mb-0 text-[11px]"
                style={{ color: "var(--color-parch-400)" }}
              >
                sources? · verified empty · no invented relic effects
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {seg === "Blessings" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="panel panel--carved max-w-xl">
            <div className="panel-head">Blessings</div>
            <div className="panel-body space-y-3">
              <VacancyWell
                label="Blessing tiers"
                caption="Empty until official reveal · Order / Chaos / Balance paths reserved as data semantics only"
              />
              <p className="m-0 text-[13px]" style={{ color: "var(--color-parch-100)" }}>
                God Tier derivation stays off until sources exist. An empty{" "}
                <span className="font-mono text-[12px]">records: []</span> is correct.
              </p>
              <p
                className="mb-0 text-[11px]"
                style={{ color: "var(--color-parch-400)" }}
              >
                sources? · verified empty
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Combat · MASTERPIECE crystal facet desk ───────────────── */

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

      {/* Style filter strip — real combat icons */}
      <div
        className="flex flex-wrap items-center gap-2 border-b border-stone-750 px-3 py-2"
        style={{ background: "var(--color-stone-900)" }}
      >
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--color-parch-50)" }}
        >
          {seg} · facet desk
        </h2>
        <span
          className="font-mono text-[11px]"
          style={{ color: "var(--color-parch-300)" }}
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
                className="forge-style-chip"
                onClick={() => {
                  setStyle(s);
                  setRow(0);
                }}
              >
                <StyleIcon style={s} size={14} />
                {s}
                <span
                  className="font-mono text-[10px]"
                  style={{
                    color: on ? "var(--color-gem-400)" : "var(--color-parch-400)",
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
            {/* Facet ability bar — crystal slots with real icons */}
            <div
              className="grid grid-cols-2 gap-1.5 border-b border-stone-750 p-2 sm:grid-cols-5"
              style={{ background: "var(--color-stone-900)" }}
              aria-label="Ability bar facets"
            >
              {barSlots.length === 0 ? (
                <p
                  className="col-span-full m-0 px-1 py-3 text-[12px]"
                  style={{ color: "var(--color-parch-400)" }}
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
                      className={`forge-bar-slot ${on ? "is-on" : ""}`}
                      onClick={() => setRow(idx < 0 ? 0 : idx)}
                      aria-pressed={on}
                    >
                      <span className="slot-idx">Slot {i + 1}</span>
                      <span className="flex items-center gap-1.5">
                        <AbilityIcon row={a} size={22} />
                        <span className="text-[12px] font-medium leading-tight">
                          {a.name}
                        </span>
                      </span>
                      <span
                        className="text-[10px]"
                        style={{
                          color: on
                            ? "var(--color-gem-400)"
                            : "var(--color-parch-400)",
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
              style={{ background: "var(--color-stone-800)" }}
            >
              <table className="data-table">
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
                          className="font-mono"
                          style={{ color: "var(--color-parch-400)" }}
                          title="Adrenaline unbound — structured vacancy"
                        >
                          —
                        </td>
                        <td
                          className="font-mono"
                          style={{ color: "var(--color-parch-400)" }}
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
            style={{ background: "var(--color-stone-850)" }}
          >
            {selected ? (
              <>
                <div className="forge-cut-head">
                  <AbilityIcon row={selected} size={28} />
                  <div className="min-w-0">
                    <h3
                      className="m-0 font-display text-[14px] tracking-[0.06em]"
                      style={{ color: "var(--color-gold-400)" }}
                    >
                      {selected.name}
                    </h3>
                    <p
                      className="mt-1 mb-0 flex items-center gap-1.5 text-[12px]"
                      style={{ color: "var(--color-parch-300)" }}
                    >
                      <StyleIcon style={selected.style} size={12} />
                      {selected.style} · {selected.kind} · {selected.role}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  {/* Honest vacancy — never invent DPL / adren */}
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

                  <div className="panel--facet">
                    <div className="panel-head">Generic target</div>
                    <div className="panel-body">
                      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                        {TARGET_FIELDS.map((f) => (
                          <div key={f.label} className="contents">
                            <dt style={{ color: "var(--color-parch-300)" }}>
                              {f.label}
                            </dt>
                            <dd
                              className="m-0 font-mono"
                              style={{
                                color:
                                  f.value === "—"
                                    ? "var(--color-parch-400)"
                                    : "var(--color-parch-50)",
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
                    style={{ color: "var(--color-parch-100)" }}
                  >
                    {selected.note}. Layout density only — structured vacancy, not
                    invented numbers.
                  </p>
                  <p
                    className="mb-0 text-[11px]"
                    style={{ color: "var(--color-parch-400)" }}
                  >
                    No boss phases · no kill-time · no enrage · generic target law
                  </p>
                  {seg === "Rotation" ? (
                    <div className="panel--facet mt-1">
                      <div className="panel-head">Rotation summary</div>
                      <div className="panel-body">
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
            <div className="panel--facet">
              <div className="panel-head">Style & weapons</div>
              <div className="panel-body space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(["Melee", "Magic", "Ranged", "Necromancy"] as const).map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        className="forge-style-chip"
                        aria-selected={style === s}
                        onClick={() => setStyle(s)}
                      >
                        <StyleIcon style={s} size={14} />
                        {s}
                      </button>
                    ),
                  )}
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
            <div className="panel panel--carved">
              <div className="panel-head">Shared loadout notes</div>
              <div className="panel-body space-y-2 text-[13px]">
                <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
                  Setup is shared with Rotation and Analysis. Fixture preview shows
                  structure only — combat core stays unbound here.
                </p>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px]">
                  <dt style={{ color: "var(--color-parch-300)" }}>Prayer</dt>
                  <dd className="m-0" style={{ color: "var(--color-parch-400)" }}>
                    —
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>Aura</dt>
                  <dd className="m-0" style={{ color: "var(--color-parch-400)" }}>
                    —
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>Familiar</dt>
                  <dd className="m-0" style={{ color: "var(--color-parch-400)" }}>
                    —
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>League mult</dt>
                  <dd className="m-0" style={{ color: "var(--color-parch-400)" }}>
                    Off · empty blessings
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {seg === "Analysis" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div
              className="overflow-auto"
              style={{ background: "var(--color-stone-800)" }}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Stat</th>
                    <th scope="col">A</th>
                    <th scope="col">B</th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Damage Potential", "—", "—", "Unbound both arms"],
                    ["Hit chance", "—", "—", "Needs target + accuracy"],
                    ["Ability damage", "—", "—", "No demo hits"],
                    ["Adren delta", "—", "—", "Vacant"],
                    ["Crit layers", "—", "—", "Core-only when bound"],
                  ].map(([stat, a, b, note]) => (
                    <tr key={stat}>
                      <td className="font-medium">{stat}</td>
                      <td
                        className="font-mono"
                        style={{ color: "var(--color-parch-400)" }}
                      >
                        {a}
                      </td>
                      <td
                        className="font-mono"
                        style={{ color: "var(--color-parch-400)" }}
                      >
                        {b}
                      </td>
                      <td className="secondary">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2">
              <KeyFigure label="DPL A" value="—" vacant compact />
              <KeyFigure label="DPL B" value="—" vacant compact />
              <div className="panel--facet">
                <div className="panel-head">A/B law</div>
                <div className="panel-body text-[12px]" style={{ color: "var(--color-parch-100)" }}>
                  Analysis compares two bound setups in product. This fixture keeps
                  both arms vacant so CEO cannot score invented percentages as craft.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Data · Lattice + Editorial + Daylight browse + sources ── */

function DataPane() {
  const [tab, setTab] = useState<string>(DATA_TABS[0]);
  const [tree, setTree] = useState<string>("regions");
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("All");

  const tracks = ["All", "General", "Combat", "Skilling", "Progression"] as const;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FIXTURE.filter((f) => {
      if (track !== "All" && f.track !== track) return false;
      if (tree === "combat" && f.track !== "Combat") return false;
      if (tree === "skills" && f.track !== "Skilling") return false;
      if (tree === "tracks" && f.track === "General") return false;
      if (tree === "sources") return true;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.region.toLowerCase().includes(q) ||
        f.kind.toLowerCase().includes(q)
      );
    });
  }, [query, track, tree]);

  const selected: FixtureRow | undefined = filtered[row] ?? filtered[0];

  const treeIcon = (node: (typeof TREE)[number]) => {
    if (node.kind === "crest") return <Crest id={node.crest} size={14} />;
    if (node.kind === "style") {
      return (
        <GameIcon
          src={styleIconPath("melee")}
          size={14}
          className="shrink-0"
          alt=""
        />
      );
    }
    return (
      <GameIcon
        src={gameIconPath("skills", node.crest)}
        size={14}
        className="shrink-0"
        alt=""
      />
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={DATA_TABS}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setRow(0);
        }}
        ariaLabel="Data sections"
      />

      {tab === "Browse" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)_280px]">
          {/* Lattice tree rail */}
          <aside
            className="border-b border-stone-750 md:border-b-0 md:border-r"
            style={{ background: "var(--color-stone-850)" }}
            aria-label="Catalog tree"
          >
            <div className="panel-head">Lattice</div>
            <div className="flex flex-col py-1">
              {TREE.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`forge-tree-btn ${tree === n.id ? "is-on" : ""}`}
                  onClick={() => {
                    setTree(n.id);
                    setRow(0);
                  }}
                >
                  {treeIcon(n)}
                  {n.label}
                </button>
              ))}
            </div>
            <div className="border-t border-stone-750 p-2">
              <p
                className="m-0 text-[10px] uppercase tracking-[0.08em]"
                style={{ color: "var(--color-parch-400)" }}
              >
                Track filter
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {tracks.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`forge-facet-chip ${track === t ? "is-on" : ""}`}
                    style={{ padding: "0.2rem 0.45rem", fontSize: "0.75rem" }}
                    onClick={() => {
                      setTrack(t);
                      setRow(0);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Daylight-readable stage table */}
          <section className="flex min-h-0 flex-col">
            <div
              className="flex flex-wrap items-center gap-2 border-b border-stone-750 px-3 py-2"
              style={{ background: "var(--color-stone-900)" }}
            >
              <h2
                className="m-0 text-[15px] font-medium"
                style={{ color: "var(--color-parch-50)" }}
              >
                Browse
              </h2>
              <input
                type="search"
                className="field-inset min-w-[10rem] flex-1"
                placeholder="Filter catalog…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setRow(0);
                }}
                aria-label="Filter catalog"
              />
              <span
                className="font-mono text-[11px]"
                style={{ color: "var(--color-parch-300)" }}
              >
                {filtered.length}/{FIXTURE.length}
              </span>
            </div>
            <div
              className="min-h-0 flex-1 overflow-auto"
              style={{ background: "var(--color-stone-800)" }}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Region</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Track</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f, i) => {
                    const on = selected?.name === f.name && i === row;
                    return (
                      <tr
                        key={`${f.name}-${f.regionId}`}
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
                        <td className="font-medium">{f.name}</td>
                        <td className="secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <Crest id={f.regionId} size={14} />
                            {f.region}
                          </span>
                        </td>
                        <td className="secondary">{f.kind}</td>
                        <td className="secondary">{f.track}</td>
                        <td className="font-mono">{f.qty}</td>
                        <td>
                          <span className="tag tag-fixture">{f.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Full source inspector */}
          <aside
            className="border-t border-stone-750 md:border-t-0 md:border-l"
            style={{ background: "var(--color-stone-850)" }}
            aria-label="Record inspector"
          >
            {selected ? (
              <>
                <div className="forge-cut-head">
                  <Crest id={selected.regionId} size={22} />
                  <div className="min-w-0">
                    <h3
                      className="m-0 font-display text-[14px] tracking-[0.06em]"
                      style={{ color: "var(--color-gold-400)" }}
                    >
                      {selected.name}
                    </h3>
                    <p
                      className="mt-1 mb-0 text-[12px]"
                      style={{ color: "var(--color-parch-300)" }}
                    >
                      {selected.kind} · {selected.track}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  <BoundWell label="Quantity" value={String(selected.qty)} />
                  <div className="panel--facet">
                    <div className="panel-head">Provenance</div>
                    <div className="panel-body space-y-1.5 text-[12px]">
                      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <dt style={{ color: "var(--color-parch-300)" }}>Source</dt>
                        <dd
                          className="m-0 font-mono"
                          style={{ color: "var(--color-parch-50)" }}
                        >
                          {selected.source}
                        </dd>
                        <dt style={{ color: "var(--color-parch-300)" }}>Verified</dt>
                        <dd
                          className="m-0 font-mono"
                          style={{ color: "var(--color-parch-50)" }}
                        >
                          {selected.verified}
                        </dd>
                        <dt style={{ color: "var(--color-parch-300)" }}>Region</dt>
                        <dd className="m-0" style={{ color: "var(--color-parch-50)" }}>
                          {selected.region}
                        </dd>
                        <dt style={{ color: "var(--color-parch-300)" }}>Status</dt>
                        <dd className="m-0">
                          <span className="tag tag-fixture">{selected.status}</span>
                        </dd>
                      </dl>
                      <p
                        className="mb-0 mt-2 text-[11px]"
                        style={{ color: "var(--color-parch-400)" }}
                      >
                        sources? · verified {selected.verified}
                      </p>
                    </div>
                  </div>
                  <p
                    className="mb-0 text-[11px]"
                    style={{ color: "var(--color-parch-400)" }}
                  >
                    Fixture row · not a published league unlock claim
                  </p>
                </div>
              </>
            ) : (
              <div className="p-3">
                <VacancyWell
                  label="Selection"
                  caption="No row matches filter · catalog empty for this slice"
                />
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {tab !== "Browse" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="panel panel--carved max-w-lg">
            <div className="panel-head">{tab}</div>
            <div className="panel-body space-y-2">
              <VacancyWell
                label={`${tab} records`}
                caption={
                  tab === "Systems"
                    ? "Systems notes empty in fixture · production binds combat / league rulesets"
                    : "No published rows for this tab in fixture — empty is correct"
                }
              />
              <p
                className="mb-0 text-[12px]"
                style={{ color: "var(--color-parch-100)" }}
              >
                Daylight browse lives on Browse. Other tabs stay honest empties until
                sync scripts write canonical JSON.
              </p>
              <p
                className="mb-0 text-[11px]"
                style={{ color: "var(--color-parch-400)" }}
              >
                sources? · verified empty
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Shell ─────────────────────────────────────────────────── */

export function ForgePreview() {
  const [nav, setNav] = useState<NavId>("Combat");
  const [pickedIds, setPickedIds] = useState<Set<string>>(
    () => new Set(["misthalin", "asgarnia", "tirannwn"]),
  );

  const togglePick = (id: RegionId) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  };

  const clearPicks = () => setPickedIds(new Set());

  return (
    <div className="forge-shell hybrid-skin--forge">
      <ForgeNav active={nav} onChange={setNav} picks={pickedIds.size} />
      <div className="forge-facet-line" aria-hidden="true" />

      {nav === "Overview" ? <OverviewPane pickedIds={pickedIds} /> : null}
      {nav === "Map" ? (
        <MapPane pickedIds={pickedIds} onToggle={togglePick} />
      ) : null}
      {nav === "Tasks" ? <TasksPane /> : null}
      {nav === "Build" ? (
        <BuildPane
          pickedIds={pickedIds}
          onToggle={togglePick}
          onClear={clearPicks}
        />
      ) : null}
      {nav === "Combat" ? <CombatPane /> : null}
      {nav === "Data" ? <DataPane /> : null}

      <footer
        className="mt-auto border-t border-stone-750 px-3 py-2 text-[11px]"
        style={{
          color: "var(--color-parch-400)",
          background: "var(--color-stone-900)",
        }}
      >
        RuneScape is a trademark of Jagex Ltd. · Forge fixture · not affiliated
      </footer>
    </div>
  );
}
