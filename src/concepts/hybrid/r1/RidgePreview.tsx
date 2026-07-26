"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { gameIconPath, regionCrestPath, styleIconPath } from "@/lib/gameArt";

/**
 * Team Ridge · RELIC COURT — Hybrid composition R1
 * Recipe: Editorial colors · Daylight Overview · Editorial Map (no inspector) ·
 * Crystal×Data Tasks · Editorial Build (masterpiece) · Crystal Combat ·
 * Lattice+Editorial+Daylight Data with full source inspector.
 * Relic icons: NONE in public/game for Equilibrium T1 — placeholder frames only.
 * Never use assets/leagues/catalyst/relics as Equilibrium art.
 * Tokens: parent .hybrid-skin--ridge (ridge.css).
 */

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;
type NavId = (typeof NAV)[number];

const BUILD_SEGS = ["Regions", "Relics", "Blessings"] as const;
const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems"] as const;
const COMBAT_SEGS = ["Quick", "Setup", "Analysis", "Rotation"] as const;
const TASK_FILTERS = ["All", "Open", "Done", "Locked"] as const;
const TASK_BANDS = ["All", "Easy", "Medium", "Hard", "Elite"] as const;

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

const BLESSING_PATHS = ["Order", "Balance", "Chaos"] as const;
const BLESSING_TIERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const LATTICE_TREE = [
  { id: "regions", label: "Regions", crest: "misthalin", kind: "crest" as const },
  { id: "skills", label: "Skills", crest: "slayer", kind: "skill" as const },
  { id: "tracks", label: "Tracks", crest: "archaeology", kind: "skill" as const },
  { id: "combat", label: "Combat", crest: "melee", kind: "style" as const },
  { id: "sources", label: "Sources", crest: "divination", kind: "skill" as const },
] as const;

const FIXTURE = [
  {
    name: "Varrock Museum kudos path",
    region: "Misthalin",
    regionId: "misthalin",
    kind: "Skilling unlock",
    status: "Open",
    qty: 3,
    source: "wiki",
    verifiedAt: "2026-07-20",
  },
  {
    name: "TzHaar Fight Cave access",
    region: "Karamja",
    regionId: "karamja",
    kind: "Combat gate",
    status: "Open",
    qty: 1,
    source: "wiki",
    verifiedAt: "2026-07-18",
  },
  {
    name: "Warriors' Guild tokens",
    region: "Asgarnia",
    regionId: "asgarnia",
    kind: "Minigame",
    status: "Open",
    qty: 6,
    source: "wiki",
    verifiedAt: "2026-07-19",
  },
  {
    name: "Menaphos reputation track",
    region: "Desert",
    regionId: "desert",
    kind: "Progression",
    status: "Locked",
    qty: 4,
    source: "wiki",
    verifiedAt: "2026-07-12",
  },
  {
    name: "Fremennik sagas re-clear",
    region: "Fremennik",
    regionId: "fremennik",
    kind: "Quest chain",
    status: "Done",
    qty: 2,
    source: "wiki",
    verifiedAt: "2026-07-15",
  },
  {
    name: "Canifis slayer tower route",
    region: "Morytania",
    regionId: "morytania",
    kind: "Slayer",
    status: "Open",
    qty: 8,
    source: "wiki",
    verifiedAt: "2026-07-21",
  },
  {
    name: "Prifddinas crystal seed loop",
    region: "Tirannwn",
    regionId: "tirannwn",
    kind: "Skilling unlock",
    status: "Locked",
    qty: 5,
    source: "wiki",
    verifiedAt: "2026-07-14",
  },
  {
    name: "Seers' Village diary set",
    region: "Kandarin",
    regionId: "kandarin",
    kind: "Diary",
    status: "Open",
    qty: 4,
    source: "wiki",
    verifiedAt: "2026-07-17",
  },
  {
    name: "Anachronia totem sites",
    region: "Anachronia",
    regionId: "anachronia",
    kind: "Skilling unlock",
    status: "Locked",
    qty: 7,
    source: "wiki",
    verifiedAt: "2026-07-11",
  },
  {
    name: "Fort Forinthry workshop",
    region: "Forinthry",
    regionId: "forinthry",
    kind: "Construction",
    status: "Open",
    qty: 3,
    source: "wiki",
    verifiedAt: "2026-07-22",
  },
] as const;

/** Catalyst stand-in tasks — provisional until Equilibrium list publishes. */
const TASKS = [
  {
    id: "t1",
    title: "Reach total level 500",
    region: "Misthalin",
    regionId: "misthalin",
    points: 30,
    band: "Easy",
    status: "Open" as const,
  },
  {
    id: "t2",
    title: "Complete a hard diary",
    region: "Asgarnia",
    regionId: "asgarnia",
    points: 40,
    band: "Medium",
    status: "Open" as const,
  },
  {
    id: "t3",
    title: "Kill a God Wars general",
    region: "Asgarnia",
    regionId: "asgarnia",
    points: 50,
    band: "Hard",
    status: "Locked" as const,
  },
  {
    id: "t4",
    title: "Train Slayer to 70",
    region: "Morytania",
    regionId: "morytania",
    points: 35,
    band: "Medium",
    status: "Done" as const,
  },
  {
    id: "t5",
    title: "Unlock a lodestone network",
    region: "Karamja",
    regionId: "karamja",
    points: 20,
    band: "Easy",
    status: "Done" as const,
  },
  {
    id: "t6",
    title: "Finish a master quest",
    region: "Tirannwn",
    regionId: "tirannwn",
    points: 60,
    band: "Elite",
    status: "Locked" as const,
  },
  {
    id: "t7",
    title: "Gather 1,000 harmonic dust",
    region: "Tirannwn",
    regionId: "tirannwn",
    points: 25,
    band: "Medium",
    status: "Open" as const,
  },
  {
    id: "t8",
    title: "Clear a raid wing once",
    region: "Kandarin",
    regionId: "kandarin",
    points: 80,
    band: "Elite",
    status: "Locked" as const,
  },
  {
    id: "t9",
    title: "Smith a full rune set",
    region: "Asgarnia",
    regionId: "asgarnia",
    points: 35,
    band: "Medium",
    status: "Open" as const,
  },
  {
    id: "t10",
    title: "Catch a sailfish",
    region: "Fremennik",
    regionId: "fremennik",
    points: 15,
    band: "Easy",
    status: "Open" as const,
  },
] as const;

const COMBAT_ROWS = [
  { name: "Greater Barge", kind: "Threshold", adrenaline: 50, style: "melee" as const },
  { name: "Assault", kind: "Threshold", adrenaline: 50, style: "melee" as const },
  { name: "Berserk", kind: "Ultimate", adrenaline: 100, style: "melee" as const },
  { name: "Greater Ricochet", kind: "Basic", adrenaline: 0, style: "ranged" as const },
  { name: "Death's Swiftness", kind: "Ultimate", adrenaline: 100, style: "ranged" as const },
  { name: "Sunshine", kind: "Ultimate", adrenaline: 100, style: "magic" as const },
  { name: "Greater Chain", kind: "Basic", adrenaline: 0, style: "magic" as const },
  { name: "Living Death", kind: "Ultimate", adrenaline: 100, style: "necromancy" as const },
  { name: "Split Soul", kind: "Threshold", adrenaline: 60, style: "necromancy" as const },
] as const;

const RELIC_SOURCE =
  "sources? · jagex · Countdown to LEAGUES II: EQUILIBRIUM! · verified 2026-07-25";

/* ── Primitives ─────────────────────────────────────────────────── */

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return <GameIcon src={regionCrestPath(id)} size={size} className="shrink-0" alt="" />;
}

function SkillIcon({ id, size = 14 }: { id: string; size?: number }) {
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
    <div className="ridge-panel ridge-panel--carved" style={{ marginTop: "0.65rem" }}>
      <div className="ridge-panel__body" style={{ padding: "0.55rem 0.7rem" }}>
        <p className="m-0 text-[12px]" style={{ color: "var(--ridge-parch-300)" }}>
          {label}
        </p>
        <p className="ridge-stat-key">{value}</p>
      </div>
    </div>
  );
}

function ArtStage({
  picks,
  relicName,
}: {
  picks: number;
  relicName: string | null;
}) {
  return (
    <div className="ridge-art-stage">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="ridge-art-stage__img"
        src="/brand/keyart-2026.jpg"
        alt=""
      />
      <div className="ridge-art-stage__chrome">
        <p className="ridge-brand">EQUILIBRIUM</p>
        <p className="ridge-kicker">Leagues II · Relic Court · ironman planning</p>
        <div className="ridge-status-row">
          <span className="ridge-chip">
            picks <strong>{picks}/3</strong>
          </span>
          <span className="ridge-chip">
            T1{" "}
            <strong>{relicName ?? "unpicked"}</strong>
          </span>
          <span className="ridge-chip">
            blessings <strong>empty</strong>
          </span>
          <span className="ridge-chip">
            mode <strong>ironman</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

function RidgeNav({
  active,
  onChange,
}: {
  active: NavId;
  onChange: (id: NavId) => void;
}) {
  return (
    <header className="ridge-nav">
      <span className="ridge-nav__brand">EQUILIBRIUM</span>
      <nav aria-label="Primary">
        <ul className="ridge-nav__list">
          {NAV.map((label) => {
            const on = label === active;
            return (
              <li key={label}>
                <button
                  type="button"
                  className={`ridge-nav__btn${on ? " is-active" : ""}`}
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
      <span className="ridge-nav__meta" aria-live="polite">
        Hybrid R1 · Ridge
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
    <div className="ridge-seg" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const on = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={on}
            className={`ridge-seg__btn${on ? " is-active" : ""}`}
            onClick={() => onChange(tab)}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

/* ── Overview · Daylight courtyard ──────────────────────────────── */

function OverviewPane({
  picks,
  pickIds,
  relicName,
  taskDone,
  taskTotal,
}: {
  picks: number;
  pickIds: readonly string[];
  relicName: string | null;
  taskDone: number;
  taskTotal: number;
}) {
  const picked = REGIONS.filter((r) => pickIds.includes(r.id));
  const slots: ((typeof REGIONS)[number] | null)[] = [0, 1, 2].map(
    (i) => picked[i] ?? null,
  );

  return (
    <div className="ridge-courtyard">
      <header className="ridge-lintel">
        <h2 className="ridge-lintel-title">Courtyard plan</h2>
        <p className="ridge-lintel-meta">Daylight gate · plan ledger · not a workbench dump</p>
      </header>

      <div className="ridge-gate">
        <aside className="ridge-jamb ridge-jamb--west" aria-label="Region picks">
          <p className="ridge-jamb-label">Standing picks</p>
          {slots.map((r, i) =>
            r ? (
              <div key={r.id} className="ridge-standing">
                <Crest id={r.id} size={24} />
                <p className="ridge-standing-name">{r.name}</p>
              </div>
            ) : (
              <div key={`empty-${i}`} className="ridge-standing is-empty">
                Slot {i + 1}
              </div>
            ),
          )}
        </aside>

        <div className="ridge-aperture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/keyart-2026.jpg" alt="" />
          <p className="ridge-aperture-caption">Fort gate · living world</p>
        </div>

        <aside className="ridge-jamb ridge-jamb--east" aria-label="Plan milestones">
          <p className="ridge-jamb-label">Milestones</p>
          <div className="ridge-milestone">
            <p className="ridge-milestone-k">Picks</p>
            <p className="ridge-milestone-v">{picks}/3</p>
          </div>
          <div className="ridge-milestone">
            <p className="ridge-milestone-k">T1 Relic</p>
            <p className={`ridge-milestone-v${relicName ? "" : " is-quiet"}`}>
              {relicName ?? "Unpicked"}
            </p>
          </div>
          <div className="ridge-milestone">
            <p className="ridge-milestone-k">Tasks</p>
            <p className="ridge-milestone-v">
              {taskDone}/{taskTotal}
            </p>
          </div>
          <div className="ridge-milestone">
            <p className="ridge-milestone-k">Blessings</p>
            <p className="ridge-milestone-v is-quiet">Unrevealed</p>
          </div>
        </aside>
      </div>

      <div className="ridge-desk">
        <div className="ridge-desk-grid">
          <div className="ridge-panel ridge-panel--slate">
            <div className="ridge-panel__head">Plan ledger</div>
            <div className="ridge-panel__body">
              <dl className="ridge-ledger">
                <dt>Region picks</dt>
                <dd className="mono">
                  {picks}/3
                  {picked.length > 0 ? (
                    <span
                      className="ml-2 font-sans"
                      style={{ color: "var(--ridge-parch-100)" }}
                    >
                      · {picked.map((r) => r.name).join(" · ")}
                    </span>
                  ) : (
                    <span
                      className="ml-2 font-sans"
                      style={{ color: "var(--ridge-parch-300)" }}
                    >
                      · none chosen — open Build
                    </span>
                  )}
                </dd>
                <dt>Relic T1</dt>
                <dd>{relicName ?? "Court open — pick on Build → Relics"}</dd>
                <dt>Tasks</dt>
                <dd className="mono">
                  {taskDone}/{taskTotal} done · Catalyst stand-ins
                </dd>
                <dt>Blessings</dt>
                <dd>Empty until official reveal</dd>
                <dt>Mode</dt>
                <dd>Ironman · self-sufficient</dd>
              </dl>
              <p className="ridge-note mt-3">
                sources? · verified fixture only · demo catalog
              </p>
            </div>
          </div>

          <div className="ridge-panel ridge-panel--carved">
            <div className="ridge-panel__head">Next on the board</div>
            <div className="ridge-panel__body space-y-2 text-[13px]">
              <p className="m-0" style={{ color: "var(--ridge-parch-50)" }}>
                {picks < 3
                  ? "Finish three region picks on Build or Map."
                  : relicName
                    ? "Court seated. Tasks and combat bind when you open those routes."
                    : "Region cap filled. Seat a T1 relic in the Relic Court."}
              </p>
              <ul
                className="m-0 list-none space-y-1.5 p-0"
                style={{ color: "var(--ridge-parch-100)" }}
              >
                <li className="flex items-center gap-2">
                  <span
                    className="font-mono text-[11px]"
                    style={{
                      color: picks >= 3 ? "var(--ridge-gem)" : "var(--ridge-parch-400)",
                    }}
                  >
                    {picks >= 3 ? "ok" : "··"}
                  </span>
                  Regions {picks}/3
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="font-mono text-[11px]"
                    style={{
                      color: relicName ? "var(--ridge-gem)" : "var(--ridge-parch-400)",
                    }}
                  >
                    {relicName ? "ok" : "··"}
                  </span>
                  T1 relic {relicName ? "seated" : "open"}
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: "var(--ridge-parch-400)" }}
                  >
                    ··
                  </span>
                  Blessings locked empty
                </li>
              </ul>
              <p className="ridge-note pt-1">
                No invented league numbers. Empty means empty.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Map · Editorial 3D-top, no inspector ────────────────────────── */

function MapPane({
  picks,
  onToggle,
}: {
  picks: readonly string[];
  onToggle: (id: RegionId) => void;
}) {
  const [focus, setFocus] = useState<RegionId>("misthalin");
  const active = REGIONS.find((r) => r.id === focus) ?? REGIONS[0];
  const isPicked = picks.includes(active.id);
  const atCap = picks.length >= 3;
  const canToggle = isPicked || !atCap;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="ridge-map-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/keyart-2026.jpg" alt="" />
        <p className="ridge-map-cue">
          3D wartable plate · gazetteer below · no inspector column
          {" · "}
          <span style={{ color: "var(--ridge-parch-300)" }}>
            headless fallback: no WebGPU
          </span>
        </p>
      </div>

      <div className="ridge-toolbar">
        <h2>Region gazetteer</h2>
        <span className="ridge-counter" aria-live="polite">
          {picks.length}/3
        </span>
        <span className="text-[12px]" style={{ color: "var(--ridge-parch-300)" }}>
          Editorial board · full 11 crests · pick on tile
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <ul className="ridge-gaz-grid">
          {REGIONS.map((r) => {
            const picked = picks.includes(r.id);
            const on = r.id === focus;
            const disabled = !picked && atCap;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`ridge-panel ridge-panel--carved ridge-gaz-tile${
                    on ? " is-focus" : ""
                  }${picked ? " is-picked" : ""}${disabled ? " is-disabled" : ""}`}
                  onClick={() => {
                    setFocus(r.id);
                    if (!disabled || picked) onToggle(r.id);
                  }}
                  aria-pressed={picked}
                  aria-disabled={disabled || undefined}
                >
                  <Crest id={r.id} size={28} />
                  <span className="text-[12px] font-medium" style={{ color: "inherit" }}>
                    {r.name}
                  </span>
                  {picked ? (
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.08em]"
                      style={{ color: "var(--ridge-gem)" }}
                    >
                      pick
                    </span>
                  ) : (
                    <span className="text-[10px]" style={{ color: "var(--ridge-parch-400)" }}>
                      open
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <section
          className="ridge-panel ridge-panel--slate mt-3"
          aria-live="polite"
          aria-label="Region detail"
        >
          <div className="ridge-panel__body flex flex-wrap items-start gap-3">
            <Crest id={active.id} size={36} />
            <div className="min-w-0 flex-1">
              <h3
                className="m-0 font-display text-[13px] tracking-[0.1em] uppercase"
                style={{ color: "var(--ridge-gold)" }}
              >
                {active.name}
              </h3>
              <p className="m-0 mt-1 text-[13px]" style={{ color: "var(--ridge-parch-100)" }}>
                {isPicked
                  ? "Standing pick · ironman self-source assumed"
                  : canToggle
                    ? "Open elective · click tile to seat or unseat"
                    : "Cap reached · unseat another pick first"}
              </p>
              <p className="ridge-sources">
                sources? · verified fixture · region board demo
              </p>
            </div>
            <button
              type="button"
              className="ridge-btn ridge-btn--gem"
              disabled={!canToggle && !isPicked}
              aria-disabled={!canToggle && !isPicked ? true : undefined}
              onClick={() => {
                if (canToggle || isPicked) onToggle(active.id);
              }}
            >
              {isPicked ? "Unseat" : "Seat pick"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Tasks · Crystal facets × Data table ────────────────────────── */

function TasksPane() {
  const [filter, setFilter] = useState<string>("All");
  const [band, setBand] = useState<string>("All");
  const [row, setRow] = useState(0);

  const filtered = useMemo(() => {
    return TASKS.filter((t) => {
      if (filter !== "All" && t.status !== filter) return false;
      if (band !== "All" && t.band !== band) return false;
      return true;
    });
  }, [filter, band]);

  const selected = filtered[Math.min(row, Math.max(0, filtered.length - 1))] ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="ridge-toolbar">
        <h2>Task ledger</h2>
        <span className="text-[12px]" style={{ color: "var(--ridge-parch-300)" }}>
          Crystal facets · wiki-dense rows · Catalyst stand-ins (provisional)
        </span>
      </div>

      <div
        className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--ridge-border)" }}
      >
        <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--ridge-parch-300)" }}>
          Status
        </span>
        {TASK_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`ridge-facet${filter === f ? " is-active" : ""}`}
            onClick={() => {
              setFilter(f);
              setRow(0);
            }}
            aria-pressed={filter === f}
          >
            {f}
          </button>
        ))}
        <span
          className="ml-2 text-[11px] uppercase tracking-[0.06em]"
          style={{ color: "var(--ridge-parch-300)" }}
        >
          Band
        </span>
        {TASK_BANDS.map((b) => (
          <button
            key={b}
            type="button"
            className={`ridge-facet${band === b ? " is-active" : ""}`}
            onClick={() => {
              setBand(b);
              setRow(0);
            }}
            aria-pressed={band === b}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-h-0 overflow-auto" style={{ background: "var(--ridge-stage)" }}>
          <table className="ridge-table">
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
              {filtered.map((t, i) => {
                const on = selected?.id === t.id;
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
                    <td className="secondary">{t.band}</td>
                    <td className="mono">{t.points}</td>
                    <td>
                      <span className="ridge-tag">{t.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside
          className="overflow-y-auto border-l"
          style={{
            borderColor: "var(--ridge-border)",
            background: "var(--ridge-rail)",
          }}
          aria-label="Task detail"
        >
          {selected ? (
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <Crest id={selected.regionId} size={22} />
                <h3
                  className="m-0 font-display text-[13px] tracking-[0.08em] uppercase"
                  style={{ color: "var(--ridge-gold)" }}
                >
                  Task detail
                </h3>
              </div>
              <p className="m-0 text-[15px]" style={{ color: "var(--ridge-parch-50)" }}>
                {selected.title}
              </p>
              <KeyFigure label="Points" value={String(selected.points)} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--ridge-parch-300)" }}>Region</dt>
                <dd className="m-0" style={{ color: "var(--ridge-parch-50)" }}>
                  {selected.region}
                </dd>
                <dt style={{ color: "var(--ridge-parch-300)" }}>Band</dt>
                <dd className="m-0" style={{ color: "var(--ridge-parch-50)" }}>
                  {selected.band}
                </dd>
                <dt style={{ color: "var(--ridge-parch-300)" }}>Status</dt>
                <dd className="m-0">
                  <span className="ridge-tag">{selected.status}</span>
                </dd>
              </dl>
              <p className="ridge-sources">
                sources? · Catalyst stand-in · not Equilibrium published list · provisional
              </p>
            </div>
          ) : (
            <p className="p-3 text-[13px]" style={{ color: "var(--ridge-parch-300)" }}>
              No tasks in this filter
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── Build · RELIC COURT masterpiece ────────────────────────────── */

function BuildRegions({
  picks,
  onToggle,
  onClear,
}: {
  picks: readonly string[];
  onToggle: (id: RegionId) => void;
  onClear: () => void;
}) {
  const count = picks.length;
  const atCap = count >= 3;

  return (
    <div className="ridge-court">
      <div className="ridge-court-banner">
        <h3>Region court</h3>
        <p>Three elective seats · crests from public/game · ironman self-source</p>
        <span className="ridge-counter ml-auto" aria-live="polite">
          {count}/3
        </span>
        <button
          type="button"
          className="ridge-btn"
          disabled={count === 0}
          onClick={onClear}
        >
          Clear picks
        </button>
      </div>

      <ul className="ridge-region-grid">
        {REGIONS.map((r, index) => {
          const isPicked = picks.includes(r.id);
          const disabled = !isPicked && atCap;
          /* 4th+ attempted pick: aria-disabled when at cap (e2e contract) */
          const isFourthBlocked = disabled && index >= 0;
          return (
            <li key={r.id}>
              <button
                type="button"
                className={`ridge-panel ridge-panel--carved ridge-region-card${
                  isPicked ? " is-picked" : ""
                }${disabled ? " is-disabled" : ""}`}
                onClick={() => {
                  if (disabled) return;
                  onToggle(r.id);
                }}
                aria-pressed={isPicked}
                aria-disabled={isFourthBlocked || undefined}
              >
                <Crest id={r.id} size={22} />
                <span className="font-medium" style={{ color: "inherit" }}>
                  {r.name}
                </span>
                {isPicked ? (
                  <span
                    className="ml-auto font-mono text-[11px]"
                    style={{ color: "var(--ridge-gem)" }}
                  >
                    pick
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="ridge-note">
        {count === 0
          ? "0/3 seated — open seats remain"
          : count >= 3
            ? "3/3 seated — further picks aria-disabled until unseat"
            : `${count}/3 seated`}
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
    <div className="ridge-court">
      <div className="ridge-court-banner">
        <h3>Relic Court</h3>
        <p>
          Editorial presentation of revealed T1 · placeholder frames until Jagex art lands under
          public/game · never Catalyst icons
        </p>
      </div>

      {/* Tier hex rail */}
      <div className="ridge-tier-rail" role="tablist" aria-label="Relic tiers">
        <span className="ridge-tier-rail__label">Tiers</span>
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
              className={`ridge-hex${open ? " is-open" : " is-unrevealed"}${
                on && open ? " is-selected" : ""
              }`}
              onClick={() => {
                if (open) onFocusTier(t.tier);
              }}
              title={open ? `Tier ${t.tier} open` : `Tier ${t.tier} unrevealed`}
            >
              <span className="ridge-hex__tier">T{t.tier}</span>
              <span className="ridge-hex__sub">{t.label}</span>
            </button>
          );
        })}
      </div>

      {showCourt ? (
        <>
          <div className="ridge-court-grid">
            {T1_RELICS.map((relic) => {
              const isSel = selectedRelic === relic.id;
              const isPicked = selectedRelic === relic.id;
              return (
                <button
                  key={relic.id}
                  type="button"
                  className={`ridge-panel ridge-panel--carved ridge-relic-card${
                    isSel ? " is-selected" : ""
                  }${isPicked ? " is-picked" : ""}`}
                  onClick={() => onSelectRelic(relic.id)}
                  aria-pressed={isSel}
                >
                  <div className="ridge-relic-card__top">
                    <div className="ridge-relic-frame" aria-hidden>
                      <span className="ridge-relic-frame__mono">{relic.mono}</span>
                    </div>
                    <div className="ridge-relic-card__meta">
                      <p className="ridge-relic-card__name">{relic.name}</p>
                      <p className="ridge-relic-card__tier">Tier 1 · revealed</p>
                      {isPicked ? (
                        <p className="ridge-relic-card__pick">seated</p>
                      ) : null}
                    </div>
                  </div>
                  <p className="ridge-relic-card__blurb">{relic.blurb}</p>
                  <div className="ridge-skill-chips">
                    {relic.skills.map((sk) => (
                      <span key={sk} className="ridge-skill-chip">
                        <SkillIcon id={sk} size={12} />
                        {sk}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail folio */}
          <div className="ridge-folio">
            <div className="ridge-panel ridge-panel--slate">
              <div className="ridge-panel__head">
                {active.name} · full effects
              </div>
              <div className="ridge-panel__body">
                <div className="mb-3 flex items-center gap-3">
                  <div className="ridge-relic-frame" aria-hidden>
                    <span className="ridge-relic-frame__mono">{active.mono}</span>
                  </div>
                  <div>
                    <p
                      className="m-0 font-display text-[14px] tracking-[0.1em] uppercase"
                      style={{ color: "var(--ridge-gold)" }}
                    >
                      {active.name}
                    </p>
                    <p
                      className="m-0 mt-1 text-[12px]"
                      style={{ color: "var(--ridge-parch-300)" }}
                    >
                      Placeholder frame · no official Equilibrium relic icon in public/game
                    </p>
                  </div>
                </div>
                <ul className="ridge-effects">
                  {active.effects.map((fx) => (
                    <li key={fx}>{fx}</li>
                  ))}
                </ul>
                <p className="ridge-sources">{RELIC_SOURCE}</p>
              </div>
            </div>

            <div className="ridge-panel ridge-panel--carved">
              <div className="ridge-panel__head">Court provenance</div>
              <div className="ridge-panel__body text-[13px]">
                <dl className="ridge-ledger">
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
                <KeyFigure
                  label="Seated T1"
                  value={selectedRelic ? active.mono : "—"}
                />
                <p className="ridge-sources">
                  Catalyst relic PNGs intentionally unwired · mislabel ban holds
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="ridge-panel ridge-panel--carved">
          <div className="ridge-panel__head">Tier {focusTier}</div>
          <div className="ridge-panel__body text-[15px]">
            <p className="m-0" style={{ color: "var(--ridge-parch-50)" }}>
              Unrevealed. Empty records until an official source exists — never invent tier
              numbers or effects to fill a stub.
            </p>
            <p className="mt-2 mb-0 text-[12px]" style={{ color: "var(--ridge-parch-300)" }}>
              Fixture stance · ironman / self-sufficient planning only
            </p>
            <p className="ridge-sources">
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
    <div className="ridge-court">
      <div className="ridge-court-banner">
        <h3>Blessing lattice</h3>
        <p>
          Path colors are data labels only — never nav chrome · lattice empty until reveal
        </p>
      </div>

      <div className="ridge-panel ridge-panel--slate">
        <div className="ridge-panel__head">Paths · Order · Balance · Chaos · God Tier</div>
        <div className="ridge-bless-lattice">
          {BLESSING_PATHS.map((path) => (
            <div key={path} className="ridge-bless-row">
              <span
                className={`ridge-path-label ridge-path-label--${path.toLowerCase()}`}
              >
                {path}
              </span>
              {BLESSING_TIERS.filter((t) => t <= 7).map((t) => (
                <div
                  key={`${path}-${t}`}
                  className="ridge-hex is-unrevealed"
                  style={{ width: 44, height: 50, cursor: "default" }}
                  title={`${path} tier ${t} unrevealed`}
                  aria-hidden
                >
                  <span className="ridge-hex__tier" style={{ fontSize: "0.625rem" }}>
                    {t}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div className="ridge-bless-row">
            <span className="ridge-path-label ridge-path-label--god">God</span>
            <div
              className="ridge-hex is-unrevealed ridge-hex--md"
              style={{ cursor: "default" }}
              title="God Tier unrevealed"
              aria-hidden
            >
              <span className="ridge-hex__tier">GT</span>
              <span className="ridge-hex__sub">sealed</span>
            </div>
            <p className="m-0 text-[12px]" style={{ color: "var(--ridge-parch-300)" }}>
              Alignment derives from path picks · no choices published
            </p>
          </div>
        </div>
        <div className="ridge-panel__body pt-0">
          <p className="m-0 text-[15px]" style={{ color: "var(--ridge-parch-50)" }}>
            Empty envelope is correct. Order / Balance / Chaos ink marks path identity in the
            lattice — never used as interactive chrome on nav or tabs.
          </p>
          <p className="ridge-sources">
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
  picks: readonly string[];
  onToggle: (id: RegionId) => void;
  onClear: () => void;
  selectedRelic: RelicId | null;
  onSelectRelic: (id: RelicId) => void;
}) {
  const [seg, setSeg] = useState<string>("Relics");
  const [focusTier, setFocusTier] = useState(1);
  const count = picks.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={BUILD_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Build sections"
      />

      <div className="ridge-toolbar">
        <h2>{seg}</h2>
        {seg === "Regions" ? (
          <span className="ridge-counter" aria-live="polite">
            {count}/3
          </span>
        ) : null}
        {seg === "Relics" ? (
          <span className="text-[12px]" style={{ color: "var(--ridge-parch-300)" }}>
            Court stage · T1 revealed · monogram frames
          </span>
        ) : null}
        {seg === "Blessings" ? (
          <span className="text-[12px]" style={{ color: "var(--ridge-parch-300)" }}>
            Lattice empty · path ink = data
          </span>
        ) : null}
        {seg === "Regions" ? (
          <button
            type="button"
            className="ridge-btn ml-auto"
            disabled={count === 0}
            onClick={onClear}
          >
            Clear picks
          </button>
        ) : (
          <span className="ml-auto" />
        )}
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

/* ── Combat · Crystal main, Editorial accents ───────────────────── */

function CombatPane() {
  const [seg, setSeg] = useState<string>("Quick");
  const [style, setStyle] = useState<"melee" | "ranged" | "magic" | "necromancy">("melee");

  const styles = [
    { id: "melee" as const, label: "Melee" },
    { id: "ranged" as const, label: "Ranged" },
    { id: "magic" as const, label: "Magic" },
    { id: "necromancy" as const, label: "Necromancy" },
  ];

  const rows = COMBAT_ROWS.filter((r) => r.style === style);

  const emptyCopy =
    seg === "Rotation"
      ? "Rotation bay is wired for ability order and adrenaline gates. Nothing lands until the combat core binds to this shell. League relics enter through the ruleset boundary only."
      : seg === "Analysis"
        ? "Analysis waits on a live Damage Potential pass. Target fields are generic defaults for structure only; no output figures are invented here."
        : seg === "Setup"
          ? "Setup holds style and generic target inputs. Hit cap and DPL stay vacant until the calculator is bound — empty slots mean unbound, not zero."
          : "Quick view shows the style you picked and the empty result bay. Damage Potential and hit cap appear when the combat core connects. No fake numbers.";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={COMBAT_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Combat sections"
      />

      <div className="ridge-toolbar">
        <h2
          className="font-display tracking-[0.08em] uppercase"
          style={{ color: "var(--ridge-gold)", fontSize: "0.8125rem" }}
        >
          {seg}
        </h2>
        <span className="text-[12px]" style={{ color: "var(--ridge-parch-300)" }}>
          Crystal facets · Editorial titles · generic target only
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[1fr_240px]">
        <div className="space-y-3">
          <div className="ridge-panel ridge-panel--carved">
            <div className="ridge-panel__head">Style</div>
            <div className="ridge-panel__body">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Combat style">
                {styles.map((s) => {
                  const on = s.id === style;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`ridge-facet${on ? " is-active" : ""}`}
                      onClick={() => setStyle(s.id)}
                      aria-pressed={on}
                    >
                      <GameIcon
                        src={styleIconPath(s.id)}
                        size={16}
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

          <div className="ridge-panel ridge-panel--carved">
            <div className="ridge-panel__head">Target (generic)</div>
            <div className="ridge-panel__body">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["Defence level", "90"],
                  ["Affinity", "55"],
                  ["Size", "1×1"],
                  ["HP %", "100"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-2 border px-2 py-1.5 text-[13px]"
                    style={{
                      borderColor: "var(--ridge-border)",
                      background: "var(--ridge-inset)",
                    }}
                  >
                    <span style={{ color: "var(--ridge-parch-300)" }}>{k}</span>
                    <span
                      className="font-mono"
                      style={{ color: "var(--ridge-parch-50)" }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
              <p className="ridge-sources">
                Generic target only · no boss phase / enrage / kill-time math
              </p>
            </div>
          </div>

          <div className="ridge-panel ridge-panel--slate">
            <div className="ridge-panel__head">Ability sample · {styles.find((s) => s.id === style)?.label}</div>
            <div className="overflow-x-auto">
              <table className="ridge-table">
                <thead>
                  <tr>
                    <th scope="col">Ability</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Adr</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name}>
                      <td className="font-medium">{r.name}</td>
                      <td className="secondary">{r.kind}</td>
                      <td className="mono">{r.adrenaline}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="ridge-panel ridge-panel--carved">
            <div className="ridge-panel__head">Result bay</div>
            <div className="ridge-panel__body">
              <p className="m-0 text-[13px]" style={{ color: "var(--ridge-parch-100)" }}>
                {emptyCopy}
              </p>
              <div className="mt-3 grid gap-2">
                <div>
                  <p className="m-0 text-[11px]" style={{ color: "var(--ridge-parch-300)" }}>
                    Damage Potential
                  </p>
                  <p className="ridge-stat-key" style={{ color: "var(--ridge-parch-400)" }}>
                    —
                  </p>
                </div>
                <div>
                  <p className="m-0 text-[11px]" style={{ color: "var(--ridge-parch-300)" }}>
                    Hit cap
                  </p>
                  <p className="ridge-stat-key" style={{ color: "var(--ridge-parch-400)" }}>
                    —
                  </p>
                </div>
              </div>
              <p className="ridge-sources">
                sources? · combat core unbound · no invented DP
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Data · Lattice rail + Editorial table + full sources ───────── */

function DataPane() {
  const [tab, setTab] = useState<string>("Browse");
  const [leaf, setLeaf] = useState<string>("regions");
  const [row, setRow] = useState(0);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return FIXTURE.filter((f) => {
      if (!needle) return true;
      return (
        f.name.toLowerCase().includes(needle) ||
        f.region.toLowerCase().includes(needle) ||
        f.kind.toLowerCase().includes(needle)
      );
    });
  }, [q]);

  const selected = filtered[Math.min(row, Math.max(0, filtered.length - 1))] ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={DATA_TABS}
        active={tab}
        onChange={setTab}
        ariaLabel="Data sections"
      />

      <div className="ridge-toolbar">
        <h2>{tab}</h2>
        <span className="text-[12px]" style={{ color: "var(--ridge-parch-300)" }}>
          Lattice rail · Daylight stage · Editorial inspector
        </span>
        {tab === "Browse" ? (
          <label className="ml-auto flex items-center gap-2 text-[12px]">
            <span style={{ color: "var(--ridge-parch-300)" }}>Filter</span>
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setRow(0);
              }}
              placeholder="Name, region, kind…"
              className="rounded-sm border px-2 py-1 text-[13px]"
              style={{
                borderColor: "var(--ridge-border)",
                background: "var(--ridge-inset)",
                color: "var(--ridge-parch-50)",
                minWidth: "12rem",
              }}
            />
          </label>
        ) : null}
      </div>

      {tab !== "Browse" ? (
        <div className="p-3">
          <div className="ridge-panel ridge-panel--carved">
            <div className="ridge-panel__head">{tab}</div>
            <div className="ridge-panel__body text-[15px]">
              <p className="m-0" style={{ color: "var(--ridge-parch-50)" }}>
                {tab} shelf is a Daylight browse shell. Catalog rows live under Browse until
                progression and unlocks publish structured league tracks.
              </p>
              <p className="ridge-sources">
                sources? · fixture catalog only · no invented progression ladders
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)_280px]">
          <div className="ridge-lattice-rail" role="tablist" aria-label="Catalog lattice">
            {LATTICE_TREE.map((node) => {
              const on = leaf === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`ridge-lattice-rail__btn${on ? " is-active" : ""}`}
                  onClick={() => setLeaf(node.id)}
                >
                  <LeafIcon kind={node.kind} id={node.crest} size={18} />
                  {node.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 overflow-auto" style={{ background: "var(--ridge-stage)" }}>
            <table className="ridge-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Region</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => {
                  const on = selected?.name === f.name;
                  return (
                    <tr
                      key={f.name}
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
                      <td className="font-medium">{f.name}</td>
                      <td className="secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <Crest id={f.regionId} size={14} />
                          {f.region}
                        </span>
                      </td>
                      <td className="secondary">{f.kind}</td>
                      <td className="mono">{f.qty}</td>
                      <td>
                        <span className="ridge-tag">{f.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <aside
            className="overflow-y-auto border-l"
            style={{
              borderColor: "var(--ridge-border)",
              background: "var(--ridge-rail)",
            }}
            aria-label="Source inspector"
          >
            {selected ? (
              <div className="p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Crest id={selected.regionId} size={24} />
                  <h3
                    className="m-0 font-display text-[13px] tracking-[0.1em] uppercase"
                    style={{ color: "var(--ridge-gold)" }}
                  >
                    Inspector
                  </h3>
                </div>
                <p className="m-0 text-[15px] font-medium" style={{ color: "var(--ridge-parch-50)" }}>
                  {selected.name}
                </p>
                <KeyFigure label="Qty" value={String(selected.qty)} />
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                  <dt style={{ color: "var(--ridge-parch-300)" }}>Region</dt>
                  <dd className="m-0" style={{ color: "var(--ridge-parch-50)" }}>
                    {selected.region}
                  </dd>
                  <dt style={{ color: "var(--ridge-parch-300)" }}>Kind</dt>
                  <dd className="m-0" style={{ color: "var(--ridge-parch-50)" }}>
                    {selected.kind}
                  </dd>
                  <dt style={{ color: "var(--ridge-parch-300)" }}>Status</dt>
                  <dd className="m-0">
                    <span className="ridge-tag">{selected.status}</span>
                  </dd>
                  <dt style={{ color: "var(--ridge-parch-300)" }}>Leaf</dt>
                  <dd className="m-0" style={{ color: "var(--ridge-parch-50)" }}>
                    {leaf}
                  </dd>
                </dl>

                <div
                  className="ridge-panel ridge-panel--slate mt-3"
                  style={{ marginTop: "0.75rem" }}
                >
                  <div className="ridge-panel__head">Source reference</div>
                  <div className="ridge-panel__body text-[13px]">
                    <dl className="ridge-ledger">
                      <dt>Source</dt>
                      <dd>{selected.source}</dd>
                      <dt>Title</dt>
                      <dd>Fixture catalog row</dd>
                      <dt>Published</dt>
                      <dd className="mono">—</dd>
                      <dt>Verified</dt>
                      <dd className="mono">{selected.verifiedAt}</dd>
                      <dt>URL</dt>
                      <dd className="break-all" style={{ color: "var(--ridge-parch-100)" }}>
                        lab://fixture/{selected.regionId}
                      </dd>
                      <dt>Confidence</dt>
                      <dd>demo · not league-published</dd>
                    </dl>
                    <p className="ridge-sources">
                      sources? · verified {selected.verifiedAt} · fixture envelope
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="p-3 text-[13px]" style={{ color: "var(--ridge-parch-300)" }}>
                Select a row for the full source inspector
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

/* ── Shell ──────────────────────────────────────────────────────── */

export function RidgePreview() {
  const [nav, setNav] = useState<NavId>("Build");
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(["misthalin", "asgarnia", "fremennik"]),
  );
  const [selectedRelic, setSelectedRelic] = useState<RelicId | null>("survivalist");

  const togglePick = (id: RegionId) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= 3) return prev;
      next.add(id);
      return next;
    });
  };

  const clearPicks = () => setPicked(new Set());

  const pickIds = [...picked] as RegionId[];
  const taskDone = TASKS.filter((t) => t.status === "Done").length;
  const relicName =
    T1_RELICS.find((r) => r.id === selectedRelic)?.name ?? null;

  return (
    <div
      className="flex h-full min-h-[70vh] flex-col"
      style={{
        background: "var(--ridge-void)",
        color: "var(--ridge-parch-50)",
      }}
    >
      <ArtStage picks={picked.size} relicName={relicName} />
      <RidgeNav active={nav} onChange={setNav} />

      {nav === "Overview" ? (
        <OverviewPane
          picks={picked.size}
          pickIds={pickIds}
          relicName={relicName}
          taskDone={taskDone}
          taskTotal={TASKS.length}
        />
      ) : null}
      {nav === "Map" ? <MapPane picks={pickIds} onToggle={togglePick} /> : null}
      {nav === "Tasks" ? <TasksPane /> : null}
      {nav === "Build" ? (
        <BuildPane
          picks={pickIds}
          onToggle={togglePick}
          onClear={clearPicks}
          selectedRelic={selectedRelic}
          onSelectRelic={setSelectedRelic}
        />
      ) : null}
      {nav === "Combat" ? <CombatPane /> : null}
      {nav === "Data" ? <DataPane /> : null}

      <footer className="ridge-footer">
        RuneScape is a trademark of Jagex Ltd. · Not affiliated with or endorsed by Jagex ·
        Team Ridge · Relic Court hybrid R1
      </footer>
    </div>
  );
}

export default RidgePreview;
