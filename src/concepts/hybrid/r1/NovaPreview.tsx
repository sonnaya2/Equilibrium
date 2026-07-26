"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath, styleIconPath } from "@/lib/gameArt";
import "./nova.css";

/**
 * Team Nova · COURTYARD FIRST — Hybrid Composition R1
 * Editorial color spine + Daylight courtyard Overview gate.
 * Recipe: Overview Daylight · Map Editorial 3D-top (no inspector) ·
 * Tasks Crystal×Data · Build Editorial+relic · Combat Crystal ·
 * Data Lattice + Daylight browse + RIGHT full source inspector.
 * Tokens: .hybrid-skin--nova (nova.css). Fixture data only. No gen-AI.
 */

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;
type NavId = (typeof NAV)[number];

const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems"] as const;
const BUILD_SEGS = ["Regions", "Relics", "Blessings"] as const;
const COMBAT_SEGS = ["Quick", "Setup", "Analysis", "Rotation"] as const;
const TASK_BANDS = ["All", "Easy", "Medium", "Hard", "Elite"] as const;
const COMBAT_STYLES = ["All", "Melee", "Ranged", "Magic", "Necromancy"] as const;

const REGIONS = [
  { id: "misthalin", name: "Misthalin", note: "Starter plain · Varrock ledger", plate: "Starter" },
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

/** RS-shaped fixture catalog — demo rows, not published league facts. */
const FIXTURE = [
  {
    name: "Varrock Museum kudos path",
    region: "Misthalin",
    regionId: "misthalin" as RegionId,
    kind: "Skilling unlock",
    track: "Support",
    status: "Fixture",
    qty: 3,
    source: {
      label: "RS Wiki · Varrock Museum",
      path: "wiki/Varrock_Museum",
      verified: "2026-03-12",
      note: "Fixture stand-in — not Equilibrium published unlock.",
    },
  },
  {
    name: "TzHaar Fight Cave access",
    region: "Karamja",
    regionId: "karamja" as RegionId,
    kind: "Combat gate",
    track: "Combat",
    status: "Fixture",
    qty: 1,
    source: {
      label: "RS Wiki · TzHaar Fight Cave",
      path: "wiki/TzHaar_Fight_Cave",
      verified: "2026-02-28",
      note: "Structure sample for combat gate rows.",
    },
  },
  {
    name: "Warriors' Guild tokens",
    region: "Asgarnia",
    regionId: "asgarnia" as RegionId,
    kind: "Minigame",
    track: "Combat",
    status: "Fixture",
    qty: 6,
    source: {
      label: "RS Wiki · Warriors' Guild",
      path: "wiki/Warriors%27_Guild",
      verified: "2026-04-01",
      note: "Token counts are fixture quantities only.",
    },
  },
  {
    name: "Menaphos reputation track",
    region: "Desert",
    regionId: "desert" as RegionId,
    kind: "Progression",
    track: "Artisan",
    status: "Fixture",
    qty: 4,
    source: {
      label: "RS Wiki · Menaphos reputation",
      path: "wiki/Menaphos",
      verified: "2026-01-20",
      note: "Progression envelope sample.",
    },
  },
  {
    name: "Fremennik sagas re-clear",
    region: "Fremennik",
    regionId: "fremennik" as RegionId,
    kind: "Quest chain",
    track: "Support",
    status: "Fixture",
    qty: 2,
    source: {
      label: "RS Wiki · Fremennik Sagas",
      path: "wiki/Fremennik_Sagas",
      verified: "2026-03-05",
      note: "Quest chain fixture — league points unrevealed.",
    },
  },
  {
    name: "Canifis slayer tower route",
    region: "Morytania",
    regionId: "morytania" as RegionId,
    kind: "Slayer",
    track: "Combat",
    status: "Fixture",
    qty: 8,
    source: {
      label: "RS Wiki · Slayer Tower",
      path: "wiki/Slayer_Tower",
      verified: "2026-02-14",
      note: "Route notes only; no invented task points.",
    },
  },
  {
    name: "Prifddinas crystal seed loop",
    region: "Tirannwn",
    regionId: "tirannwn" as RegionId,
    kind: "Skilling unlock",
    track: "Artisan",
    status: "Fixture",
    qty: 5,
    source: {
      label: "RS Wiki · Crystal seed",
      path: "wiki/Crystal_seed",
      verified: "2026-04-10",
      note: "Artisan track sample under Tirannwn plate.",
    },
  },
  {
    name: "Seers' Village diary set",
    region: "Kandarin",
    regionId: "kandarin" as RegionId,
    kind: "Diary",
    track: "Support",
    status: "Fixture",
    qty: 4,
    source: {
      label: "RS Wiki · Seers' Village achievements",
      path: "wiki/Seers%27_Village_achievements",
      verified: "2026-03-22",
      note: "Diary structure fixture.",
    },
  },
  {
    name: "Anachronia totem sites",
    region: "Anachronia",
    regionId: "anachronia" as RegionId,
    kind: "Skilling unlock",
    track: "Gather",
    status: "Fixture",
    qty: 7,
    source: {
      label: "RS Wiki · Anachronia totems",
      path: "wiki/Anachronia",
      verified: "2026-01-30",
      note: "Gather track sample.",
    },
  },
  {
    name: "Fort Forinthry workshop",
    region: "Forinthry",
    regionId: "forinthry" as RegionId,
    kind: "Construction",
    track: "Artisan",
    status: "Fixture",
    qty: 3,
    source: {
      label: "RS Wiki · Fort Forinthry",
      path: "wiki/Fort_Forinthry",
      verified: "2026-04-18",
      note: "Workshop construction fixture.",
    },
  },
  {
    name: "Havenhythe shore net",
    region: "Havenhythe",
    regionId: "havenhythe" as RegionId,
    kind: "Skilling note",
    track: "Gather",
    status: "Fixture",
    qty: 3,
    source: {
      label: "Fixture ledger · shore plate",
      path: "fixture/havenhythe-shore",
      verified: "2026-05-01",
      note: "Starter sister plate — no official league source yet.",
    },
  },
] as const;

type FixtureRow = (typeof FIXTURE)[number];

/** Catalyst stand-in tasks — provisional until Equilibrium list publishes. */
const TASKS = [
  {
    id: "t1",
    title: "Clear the eastern fence",
    region: "Misthalin",
    regionId: "misthalin" as RegionId,
    pts: 10,
    band: "Easy",
  },
  {
    id: "t2",
    title: "Smoke a fruit batch",
    region: "Karamja",
    regionId: "karamja" as RegionId,
    pts: 25,
    band: "Easy",
  },
  {
    id: "t3",
    title: "Read the fort slate",
    region: "Forinthry",
    regionId: "forinthry" as RegionId,
    pts: 40,
    band: "Medium",
  },
  {
    id: "t4",
    title: "Walk the crystal dust",
    region: "Tirannwn",
    regionId: "tirannwn" as RegionId,
    pts: 60,
    band: "Medium",
  },
  {
    id: "t5",
    title: "Kill a God Wars general",
    region: "Asgarnia",
    regionId: "asgarnia" as RegionId,
    pts: 80,
    band: "Hard",
  },
  {
    id: "t6",
    title: "Finish a master quest",
    region: "Desert",
    regionId: "desert" as RegionId,
    pts: 90,
    band: "Hard",
  },
  {
    id: "t7",
    title: "Clear a raid wing once",
    region: "Kandarin",
    regionId: "kandarin" as RegionId,
    pts: 120,
    band: "Elite",
  },
  {
    id: "t8",
    title: "Train Slayer to 70",
    region: "Morytania",
    regionId: "morytania" as RegionId,
    pts: 55,
    band: "Medium",
  },
  {
    id: "t9",
    title: "Unlock lodestone network hop",
    region: "Fremennik",
    regionId: "fremennik" as RegionId,
    pts: 20,
    band: "Easy",
  },
  {
    id: "t10",
    title: "Gather 1,000 harmonic dust",
    region: "Tirannwn",
    regionId: "tirannwn" as RegionId,
    pts: 70,
    band: "Hard",
  },
] as const;

const RELIC_TIERS = [
  { tier: 1, name: "Tier I · unrevealed", revealed: false },
  { tier: 2, name: "Tier II · unrevealed", revealed: false },
  { tier: 3, name: "Tier III · unrevealed", revealed: false },
  { tier: 4, name: "Tier IV · unrevealed", revealed: false },
  { tier: 5, name: "Tier V · unrevealed", revealed: false },
  { tier: 6, name: "Tier VI · unrevealed", revealed: false },
  { tier: 7, name: "Tier VII · unrevealed", revealed: false },
] as const;

const COMBAT_ROWS = [
  {
    ability: "Greater Barge",
    style: "Melee",
    band: "Threshold",
    role: "Opener",
    cd: "20.4s",
    icon: "greater-barge",
  },
  {
    ability: "Assault",
    style: "Melee",
    band: "Threshold",
    role: "Channel",
    cd: "30.0s",
    icon: "assault",
  },
  {
    ability: "Hurricane",
    style: "Melee",
    band: "Basic",
    role: "AoE",
    cd: "20.4s",
    icon: "greater-flurry",
  },
  {
    ability: "Death's Swiftness",
    style: "Ranged",
    band: "Ultimate",
    role: "Window",
    cd: "60.0s",
    icon: "deaths-swiftness",
  },
  {
    ability: "Greater Ricochet",
    style: "Ranged",
    band: "Basic",
    role: "Cleaves",
    cd: "10.2s",
    icon: "greater-ricochet",
  },
  {
    ability: "Sunshine",
    style: "Magic",
    band: "Ultimate",
    role: "Window",
    cd: "60.0s",
    icon: "sunshine",
  },
  {
    ability: "Greater Concentrated Blast",
    style: "Magic",
    band: "Basic",
    role: "Core",
    cd: "5.4s",
    icon: "greater-concentrated-blast",
  },
  {
    ability: "Living Death",
    style: "Necromancy",
    band: "Ultimate",
    role: "Window",
    cd: "90.0s",
    icon: "living-death",
  },
  {
    ability: "Split Soul",
    style: "Necromancy",
    band: "Threshold",
    role: "Amp",
    cd: "60.0s",
    icon: "split-soul",
  },
] as const;

const INITIAL_PICKS: RegionId[] = ["misthalin", "asgarnia", "fremennik"];

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <GameIcon src={regionCrestPath(id)} size={size} className="shrink-0" alt="" />
  );
}

function NovaNav({
  active,
  onChange,
  picks,
}: {
  active: NavId;
  onChange: (id: NavId) => void;
  picks: number;
}) {
  return (
    <header className="nova-mast">
      <p className="nova-brand">EQUILIBRIUM</p>
      <nav aria-label="Primary">
        <ul>
          {NAV.map((label) => {
            const on = label === active;
            return (
              <li key={label}>
                <button
                  type="button"
                  className={`nova-nav-link${on ? " is-active" : ""}`}
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
      <span className="nova-mast__meta" aria-live="polite">
        Courtyard · {picks}/3 · fixture lab
      </span>
    </header>
  );
}

function KeyFigure({
  label,
  value,
  empty,
}: {
  label: string;
  value: string;
  empty?: boolean;
}) {
  return (
    <div className="nova-panel nova-panel--facet">
      <div className="nova-panel__body" style={{ padding: "0.55rem 0.7rem" }}>
        <p
          className="m-0 text-[11px] uppercase tracking-[0.08em]"
          style={{ color: "var(--color-parch-300)" }}
        >
          {label}
        </p>
        <p
          className={`mt-1 mb-0 ${empty ? "nova-stat-key--empty" : "nova-stat-key nova-stat-key--sm"}`}
        >
          {value}
        </p>
      </div>
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
    <div className="nova-seg" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const on = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={on}
            className={`nova-seg__btn${on ? " is-active" : ""}`}
            onClick={() => onChange(tab)}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

/** Signature: Daylight courtyard gate under Editorial tokens. */
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
  const slots: ((typeof REGIONS)[number] | null)[] = [0, 1, 2].map(
    (i) => picked[i] ?? null,
  );

  return (
    <div className="nova-courtyard">
      <header className="nova-lintel">
        <h2 className="nova-lintel__title">Courtyard plan</h2>
        <p className="nova-lintel__meta">Leagues II · Equilibrium · fixture</p>
      </header>

      <div className="nova-gate">
        <aside className="nova-jamb nova-jamb--west" aria-label="Region picks">
          <p className="nova-jamb__label">Standing picks</p>
          {slots.map((r, i) =>
            r ? (
              <div key={r.id} className="nova-standing">
                <Crest id={r.id} size={26} />
                <p className="nova-standing__name">{r.name}</p>
              </div>
            ) : (
              <div key={`empty-${i}`} className="nova-standing is-empty">
                Slot {i + 1}
              </div>
            ),
          )}
        </aside>

        <div className="nova-aperture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/keyart-2026.jpg" alt="" />
          <p className="nova-aperture__caption">Fort gate · living world</p>
        </div>

        <aside className="nova-jamb nova-jamb--east" aria-label="Plan milestones">
          <p className="nova-jamb__label">Milestones</p>
          <div className="nova-milestone">
            <p className="nova-milestone__k">Picks</p>
            <p className="nova-milestone__v">{picks.length}/3</p>
          </div>
          <div className="nova-milestone">
            <p className="nova-milestone__k">Tasks</p>
            <p className="nova-milestone__v">
              {taskDone}/{taskTotal}
            </p>
          </div>
          <div className="nova-milestone">
            <p className="nova-milestone__k">Catalog</p>
            <p className="nova-milestone__v">{FIXTURE.length}</p>
          </div>
          <div className="nova-milestone">
            <p className="nova-milestone__k">Blessings</p>
            <p className="nova-milestone__v is-quiet">Unrevealed</p>
          </div>
        </aside>
      </div>

      <div className="nova-desk">
        <div className="nova-desk__grid">
          <div className="nova-panel nova-panel--slate">
            <div className="nova-panel__head">Plan ledger</div>
            <div className="nova-panel__body">
              <dl className="nova-ledger">
                <dt>Region picks</dt>
                <dd>
                  <span className="font-mono" style={{ color: "var(--color-gem-400)" }}>
                    {picks.length}/3
                  </span>
                  {picked.length > 0 ? (
                    <span className="ml-2" style={{ color: "var(--color-parch-100)" }}>
                      · {picked.map((r) => r.name).join(" · ")}
                    </span>
                  ) : (
                    <span className="ml-2" style={{ color: "var(--color-parch-300)" }}>
                      · none chosen — open Build or Map
                    </span>
                  )}
                </dd>
                <dt>Tasks</dt>
                <dd>
                  <span className="font-mono">
                    {taskDone}/{taskTotal}
                  </span>{" "}
                  done · Catalyst stand-ins
                </dd>
                <dt>Blessings</dt>
                <dd>Empty until official reveal</dd>
                <dt>Relics</dt>
                <dd>Seven tiers · pending reveal</dd>
                <dt>Mode</dt>
                <dd>Ironman · self-sufficient</dd>
              </dl>
              <p className="nova-note mt-3">
                sources? · verified fixture only · demo catalog
              </p>
            </div>
          </div>

          <div className="nova-panel nova-panel--carved">
            <div className="nova-panel__head">Next on the board</div>
            <div className="nova-panel__body space-y-2 text-[13px]">
              <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
                {picks.length < 3
                  ? "Finish three region picks on Build or Map."
                  : "Region cap filled. Tasks and combat bind when you open those routes."}
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
                        picks.length >= 3
                          ? "var(--color-gem-400)"
                          : "var(--color-parch-400)",
                    }}
                  >
                    {picks.length >= 3 ? "ok" : "··"}
                  </span>
                  Regions {picks.length}/3
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
                    style={{ color: "var(--color-parch-400)" }}
                  >
                    ··
                  </span>
                  Combat calc unbound
                </li>
              </ul>
              <p className="nova-note pt-1">
                No invented league numbers. Empty means empty.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Editorial 3D-top gazetteer — NO side inspector (recipe). */
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

  return (
    <div className="nova-map">
      <div className="nova-toolbar">
        <h2
          className="m-0 font-display text-[13px] uppercase tracking-[0.12em]"
          style={{ color: "var(--color-gold-400)" }}
        >
          Region gazetteer
        </h2>
        <span
          className="font-mono text-[13px]"
          style={{ color: "var(--color-gem-400)" }}
          aria-live="polite"
        >
          {picks.length}/3
        </span>
        <span className="text-[12px]" style={{ color: "var(--color-parch-300)" }}>
          Editorial board · 3D-top mock · no inspector
        </span>
        <button
          type="button"
          className="nova-region-card ml-auto"
          style={{ width: "auto", padding: "0.35rem 0.65rem" }}
          onClick={onClear}
          disabled={picks.length === 0}
          aria-disabled={picks.length === 0}
        >
          Clear picks
        </button>
      </div>

      <div className="nova-board" aria-label="Wartable mock board">
        <div className="nova-board__sky" aria-hidden />
        <div className="nova-board__horizon" aria-hidden />
        <div className="nova-board__slab">
          <ul className="nova-board__grid m-0 list-none p-0">
            {REGIONS.map((r) => {
              const picked = picks.includes(r.id);
              const on = r.id === focus;
              const blocked = !picked && atCap;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`nova-crest-tile${on ? " is-focus" : ""}${
                      picked ? " is-picked" : ""
                    }${blocked && !on ? " is-dim" : ""}${
                      blocked && !picked ? " is-disabled" : ""
                    }`}
                    onClick={() => setFocus(r.id)}
                    onDoubleClick={() => {
                      if (blocked && !picked) return;
                      onToggle(r.id);
                    }}
                    aria-pressed={picked}
                    aria-current={on ? "true" : undefined}
                    aria-disabled={blocked && !picked ? true : undefined}
                  >
                    <span className="nova-crest-tile__badge" aria-hidden>
                      <Crest id={r.id} size={32} />
                    </span>
                    <span className="nova-crest-tile__name">{r.name}</span>
                    <span className="nova-crest-tile__meta">
                      {picked ? "pick" : r.plate}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Folio under board — not a right-rail inspector */}
      <div className="nova-folio">
        <div className="nova-folio__mark">
          <Crest id={active.id} size={44} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="nova-folio__kicker m-0">{active.plate} plate</p>
          <h3 className="nova-folio__title m-0">{active.name}</h3>
          <p className="nova-folio__lede m-0">{active.note}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`nova-region-card${isPicked ? " is-picked" : ""}${
                !isPicked && atCap ? " is-disabled" : ""
              }`}
              style={{ width: "auto", maxWidth: "16rem" }}
              onClick={() => {
                if (!isPicked && atCap) return;
                onToggle(active.id);
              }}
              aria-disabled={!isPicked && atCap ? true : undefined}
              aria-pressed={isPicked}
            >
              <Crest id={active.id} size={16} />
              <span className="font-medium">
                {isPicked
                  ? "Remove pick"
                  : atCap
                    ? "Cap full (3/3)"
                    : "Add pick"}
              </span>
              <span
                className="ml-auto font-mono text-[11px]"
                style={{ color: "var(--color-gem-400)" }}
              >
                {picks.length}/3
              </span>
            </button>
            <span className="text-[11px]" style={{ color: "var(--color-parch-400)" }}>
              Double-click a crest to toggle pick · production Map loads fenced 3D
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Crystal facets denser like Data — sticky table + facet chips. */
function TasksPane() {
  const [band, setBand] = useState<string>("All");
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");
  const [done, setDone] = useState<Set<string>>(
    () => new Set(["t1", "t9"]),
  );

  const bandCounts = useMemo(() => {
    const counts: Record<string, number> = { All: TASKS.length };
    for (const b of TASK_BANDS) {
      if (b === "All") continue;
      counts[b] = TASKS.filter((t) => t.band === b).length;
    }
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TASKS.filter((t) => {
      if (band !== "All" && t.band !== band) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.region.toLowerCase().includes(q) ||
        t.band.toLowerCase().includes(q)
      );
    });
  }, [band, query]);

  const selected = filtered[row] ?? filtered[0];
  const doneCount = TASKS.filter((t) => done.has(t.id)).length;
  const ptsDone = TASKS.filter((t) => done.has(t.id)).reduce(
    (s, t) => s + t.pts,
    0,
  );
  const ptsTotal = TASKS.reduce((s, t) => s + t.pts, 0);

  const toggleDone = (id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="nova-facet-bar" role="tablist" aria-label="Task bands">
        <span
          className="mr-1 text-[11px] uppercase tracking-[0.08em]"
          style={{ color: "var(--color-parch-400)" }}
        >
          Facets
        </span>
        {TASK_BANDS.map((b) => {
          const on = b === band;
          return (
            <button
              key={b}
              type="button"
              role="tab"
              aria-selected={on}
              className={`nova-facet-chip${on ? " is-active" : ""}`}
              onClick={() => {
                setBand(b);
                setRow(0);
              }}
            >
              <span>{b}</span>
              <span className="pip">{bandCounts[b] ?? 0}</span>
            </button>
          );
        })}
        <span
          className="ml-auto font-mono text-[12px]"
          style={{ color: "var(--color-gem-400)" }}
          aria-live="polite"
        >
          {doneCount}/{TASKS.length} · {ptsDone}/{ptsTotal} pts
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px]">
        <section
          className="flex min-h-0 flex-col"
          style={{ background: "var(--color-stone-800)" }}
        >
          <div className="nova-toolbar">
            <h2
              className="m-0 text-[15px] font-medium"
              style={{ color: "var(--color-parch-50)" }}
            >
              Task ledger
            </h2>
            <span
              className="text-[12px]"
              style={{ color: "var(--color-parch-300)" }}
            >
              Catalyst stand-in · provisional
            </span>
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
                className="nova-field w-40 px-2 py-1 text-[15px]"
                placeholder="Title or region"
                aria-label="Filter tasks"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="nova-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "2.5rem" }}>
                    Done
                  </th>
                  <th scope="col">Task</th>
                  <th scope="col">Region</th>
                  <th scope="col">Band</th>
                  <th scope="col">Pts</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="secondary" style={{ padding: "1rem" }}>
                      No fixture tasks match this facet or filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t, i) => {
                    const on = i === row;
                    const isDone = done.has(t.id);
                    return (
                      <tr
                        key={t.id}
                        className={`${on ? "is-selected" : ""}${
                          isDone ? " is-done" : ""
                        }`}
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
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="nova-check"
                            checked={isDone}
                            onChange={() => toggleDone(t.id)}
                            aria-label={`Mark ${t.title} done`}
                          />
                        </td>
                        <td className="font-medium">{t.title}</td>
                        <td className="secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <Crest id={t.regionId} size={14} />
                            {t.region}
                          </span>
                        </td>
                        <td className="secondary">
                          <span className="nova-tag">{t.band}</span>
                        </td>
                        <td className="font-mono">{t.pts}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="nova-inspector p-3" aria-label="Task detail">
          {selected ? (
            <div className="nova-panel nova-panel--facet">
              <div className="nova-panel__head">Facet detail</div>
              <div className="nova-panel__body">
                <div className="mb-2 flex items-center gap-2">
                  <Crest id={selected.regionId} size={24} />
                  <h3
                    className="m-0 font-display text-[13px] tracking-[0.08em] uppercase"
                    style={{ color: "var(--color-gold-400)" }}
                  >
                    {selected.title}
                  </h3>
                </div>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <KeyFigure label="Points" value={String(selected.pts)} />
                  <KeyFigure
                    label="Done"
                    value={done.has(selected.id) ? "Yes" : "No"}
                  />
                </div>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                  <dt style={{ color: "var(--color-parch-300)" }}>Region</dt>
                  <dd className="m-0" style={{ color: "var(--color-parch-50)" }}>
                    {selected.region}
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>Band</dt>
                  <dd className="m-0">
                    <span className="nova-tag">{selected.band}</span>
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>Status</dt>
                  <dd
                    className="m-0 font-mono"
                    style={{
                      color: done.has(selected.id)
                        ? "var(--color-gem-400)"
                        : "var(--color-parch-100)",
                    }}
                  >
                    {done.has(selected.id) ? "done" : "open"}
                  </dd>
                </dl>
                <button
                  type="button"
                  className="nova-region-card mt-3"
                  onClick={() => toggleDone(selected.id)}
                  aria-pressed={done.has(selected.id)}
                >
                  <span className="font-medium">
                    {done.has(selected.id) ? "Mark open" : "Mark done"}
                  </span>
                </button>
                <p className="nova-sources">
                  sources? · provisional fixture — Equilibrium list unrevealed
                </p>
              </div>
            </div>
          ) : (
            <p className="m-0 text-[13px]" style={{ color: "var(--color-parch-300)" }}>
              No task selected
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Editorial Build + relic presentation cards. */
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
  const [relicFocus, setRelicFocus] = useState(0);
  const atCap = picks.length >= 3;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={BUILD_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Build sections"
      />

      {seg === "Regions" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="nova-toolbar">
            <h2
              className="m-0 text-[15px] font-medium"
              style={{ color: "var(--color-parch-50)" }}
            >
              Region loadout
            </h2>
            <span
              className="font-mono text-[13px]"
              style={{ color: "var(--color-gem-400)" }}
              aria-live="polite"
            >
              {picks.length}/3
            </span>
            <span className="text-[12px]" style={{ color: "var(--color-parch-300)" }}>
              Ironman · self-sufficient
            </span>
            <button
              type="button"
              className="nova-region-card ml-auto"
              style={{ width: "auto", padding: "0.35rem 0.65rem" }}
              onClick={onClear}
              disabled={picks.length === 0}
            >
              Clear picks
            </button>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {REGIONS.map((r) => {
              const picked = picks.includes(r.id);
              const blocked = !picked && atCap;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`nova-region-card${picked ? " is-picked" : ""}${
                    blocked ? " is-disabled" : ""
                  }`}
                  onClick={() => {
                    if (blocked) return;
                    onToggle(r.id);
                  }}
                  aria-pressed={picked}
                  aria-disabled={blocked || undefined}
                >
                  <Crest id={r.id} size={22} />
                  <span className="min-w-0">
                    <span className="block font-medium" style={{ color: "inherit" }}>
                      {r.name}
                    </span>
                    <span
                      className="block text-[11px]"
                      style={{ color: "var(--color-parch-400)" }}
                    >
                      {r.plate}
                    </span>
                  </span>
                  <span
                    className="ml-auto font-mono text-[11px]"
                    style={{
                      color: picked
                        ? "var(--color-gem-400)"
                        : "var(--color-parch-400)",
                    }}
                  >
                    {picked ? "pick" : blocked ? "cap" : "open"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="nova-note px-3 pb-3">
            sources? · all 11 crests from public/game/regions · fixture notes only
          </p>
        </div>
      ) : null}

      {seg === "Relics" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
          <div className="mb-3 flex flex-wrap items-baseline gap-3">
            <h2
              className="m-0 font-display text-[13px] uppercase tracking-[0.12em]"
              style={{ color: "var(--color-gold-400)" }}
            >
              Relic court
            </h2>
            <span className="text-[12px]" style={{ color: "var(--color-parch-300)" }}>
              Seven tiers · editorial presentation · empty until reveal
            </span>
          </div>
          <div className="nova-relic-grid">
            {RELIC_TIERS.map((r, i) => {
              const on = i === relicFocus;
              return (
                <button
                  key={r.tier}
                  type="button"
                  className={`nova-relic-card is-empty${on ? " is-focus" : ""}`}
                  onClick={() => setRelicFocus(i)}
                  aria-pressed={on}
                >
                  <span className="nova-relic-card__tier">Tier {r.tier}</span>
                  <span className="nova-relic-card__name">Unrevealed</span>
                  <span
                    className="text-[12px] leading-snug"
                    style={{ color: "var(--color-parch-400)" }}
                  >
                    Slot reserved. No fixture icon until official art lands.
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 nova-panel nova-panel--carved">
            <div className="nova-panel__head">
              Tier {RELIC_TIERS[relicFocus]?.tier ?? 1} · folio
            </div>
            <div className="nova-panel__body text-[15px]">
              <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
                Equilibrium relic list is unrevealed. Empty cards are correct —
                never invent a name or modifier to fill the court.
              </p>
              <p className="nova-sources">
                sources? · empty envelope · verified empty — not live league data
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {seg === "Blessings" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
          <div className="nova-panel nova-panel--carved max-w-xl">
            <div className="nova-panel__head">Blessings · empty envelope</div>
            <div className="nova-panel__body text-[15px]">
              <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
                Unrevealed. Empty records until an official source exists. God
                Tier derivation stays offline until the eight blessing tiers
                publish.
              </p>
              <p
                className="mt-2 mb-0 text-[12px]"
                style={{ color: "var(--color-parch-300)" }}
              >
                Fixture stance · ironman / self-sufficient planning only
              </p>
              <p className="nova-sources">
                sources? · verified empty envelope — not live league data
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Crystal-main combat — facet panels, honest empty math. */
function CombatPane() {
  const [seg, setSeg] = useState<string>(COMBAT_SEGS[0]);
  const [style, setStyle] = useState<string>("All");
  const [row, setRow] = useState(0);
  const [combatStyle, setCombatStyle] = useState<
    "melee" | "ranged" | "magic" | "necromancy"
  >("melee");

  const filtered = useMemo(() => {
    if (style === "All") return [...COMBAT_ROWS];
    return COMBAT_ROWS.filter((r) => r.style === style);
  }, [style]);

  const selected = filtered[row] ?? filtered[0];
  const styleLabel =
    combatStyle === "melee"
      ? "Melee"
      : combatStyle === "ranged"
        ? "Ranged"
        : combatStyle === "magic"
          ? "Magic"
          : "Necromancy";

  const emptyCopy =
    seg === "Rotation"
      ? "Rotation bay is wired for ability order and adrenaline gates. Nothing lands until the combat core binds. League relics enter through the ruleset boundary only."
      : seg === "Analysis"
        ? "Analysis waits on a live Damage Potential pass. No output figures are invented here."
        : seg === "Setup"
          ? "Setup holds style and generic target inputs. Hit cap and DPL stay vacant until the calculator is bound."
          : "Quick view shows style and the empty result bay. Damage Potential and hit cap appear when the combat core connects.";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={COMBAT_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Combat sections"
      />

      <div className="nova-facet-bar" role="toolbar" aria-label="Style filter">
        {COMBAT_STYLES.map((s) => {
          const on = s === style;
          return (
            <button
              key={s}
              type="button"
              className={`nova-facet-chip${on ? " is-active" : ""}`}
              aria-pressed={on}
              onClick={() => {
                setStyle(s);
                setRow(0);
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_240px]">
        <section
          className="flex min-h-0 flex-col overflow-y-auto"
          style={{ background: "var(--color-stone-800)" }}
        >
          <div className="nova-toolbar">
            <h2
              className="m-0 text-[15px] font-medium"
              style={{ color: "var(--color-parch-50)" }}
            >
              {seg} · ability sample
            </h2>
            <span
              className="font-mono text-[11px]"
              style={{ color: "var(--color-parch-300)" }}
            >
              {filtered.length} · generic target only
            </span>
          </div>

          <div className="space-y-3 p-3">
            <div className="nova-panel nova-panel--facet">
              <div className="nova-panel__head">Style bind</div>
              <div className="nova-panel__body">
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Combat style"
                >
                  {(
                    [
                      ["melee", "Melee"],
                      ["ranged", "Ranged"],
                      ["magic", "Magic"],
                      ["necromancy", "Necromancy"],
                    ] as const
                  ).map(([id, label]) => {
                    const on = combatStyle === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setCombatStyle(id)}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 text-[13px]"
                        style={{
                          border: on
                            ? "1px solid var(--color-gem-500)"
                            : "1px solid var(--color-stone-750)",
                          background: on
                            ? "var(--color-stone-800)"
                            : "var(--color-stone-900)",
                          color: on
                            ? "var(--color-gem-300)"
                            : "var(--color-parch-100)",
                          boxShadow: on
                            ? "inset 0 0 0 1px var(--color-gem-600), inset 0 1px 0 var(--color-stone-carve)"
                            : "inset 0 1px 0 var(--color-stone-carve)",
                          cursor: "pointer",
                          borderRadius: 2,
                        }}
                        aria-pressed={on}
                      >
                        <GameIcon
                          src={styleIconPath(id)}
                          size={18}
                          className="shrink-0"
                          alt=""
                        />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {(seg === "Quick" || seg === "Setup") && (
              <div className="nova-panel nova-panel--facet">
                <div className="nova-panel__head">Target (generic)</div>
                <div className="nova-panel__body">
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
                          className="nova-field px-2 py-1.5 text-[15px]"
                          defaultValue={val}
                          readOnly
                          aria-label={label}
                        />
                      </label>
                    ))}
                  </div>
                  <p
                    className="mt-2 mb-0 text-[11px]"
                    style={{ color: "var(--color-parch-400)" }}
                  >
                    No boss phases · no enrage · no kill-time sim
                  </p>
                </div>
              </div>
            )}

            {seg === "Rotation" ? (
              <div className="nova-panel nova-panel--facet">
                <div className="nova-panel__head">Rotation bay</div>
                <div className="nova-panel__body">
                  <div
                    className="mb-2 grid gap-1.5"
                    style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
                    aria-hidden
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
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
                  <p
                    className="m-0 text-[13px]"
                    style={{ color: "var(--color-parch-100)" }}
                  >
                    Ability slots reserved. Order and adrenaline gates bind with
                    the combat core.
                  </p>
                </div>
              </div>
            ) : null}

            {seg === "Analysis" ? (
              <div className="nova-panel nova-panel--slate">
                <div className="nova-panel__head">Output structure</div>
                <div className="nova-panel__body">
                  <dl className="nova-ledger">
                    <dt>Damage Potential</dt>
                    <dd style={{ color: "var(--color-parch-400)" }}>Unbound</dd>
                    <dt>Hit distribution</dt>
                    <dd style={{ color: "var(--color-parch-400)" }}>Unbound</dd>
                    <dt>Accuracy pass</dt>
                    <dd style={{ color: "var(--color-parch-400)" }}>Unbound</dd>
                    <dt>League modifiers</dt>
                    <dd style={{ color: "var(--color-parch-400)" }}>
                      Ruleset off until bind
                    </dd>
                  </dl>
                </div>
              </div>
            ) : null}

            <div className="min-h-0 overflow-auto">
              <table className="nova-table">
                <thead>
                  <tr>
                    <th scope="col">Ability</th>
                    <th scope="col">Style</th>
                    <th scope="col">Band</th>
                    <th scope="col">Role</th>
                    <th scope="col">Cd</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const on = i === row;
                    return (
                      <tr
                        key={r.ability}
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
                        <td className="font-medium">{r.ability}</td>
                        <td className="secondary">{r.style}</td>
                        <td className="secondary">{r.band}</td>
                        <td className="secondary">{r.role}</td>
                        <td className="font-mono">{r.cd}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside
          className="nova-empty-bay border-t border-stone-750 p-3 lg:border-t-0 lg:border-l"
          style={{
            background: "var(--color-stone-850)",
            borderColor: "var(--color-stone-750)",
          }}
          aria-label="Combat results"
        >
          <div className="nova-empty-slot">
            <p className="nova-empty-label">Damage Potential</p>
            <p className="nova-empty-value">Awaiting calc bind</p>
          </div>
          <div className="nova-empty-slot">
            <p className="nova-empty-label">Hit cap</p>
            <p className="nova-empty-value">Awaiting calc bind</p>
          </div>
          <div className="nova-empty-slot is-live">
            <p className="nova-empty-label">Style</p>
            <p className="nova-empty-value is-bound">
              {styleLabel.slice(0, 3).toUpperCase()}
            </p>
          </div>
          {selected ? (
            <div className="nova-panel nova-panel--facet">
              <div className="nova-panel__body" style={{ padding: "0.65rem" }}>
                <p
                  className="m-0 font-display text-[12px] uppercase tracking-[0.1em]"
                  style={{ color: "var(--color-gold-400)" }}
                >
                  {selected.ability}
                </p>
                <dl className="mt-2 m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[12px]">
                  <dt style={{ color: "var(--color-parch-300)" }}>Role</dt>
                  <dd className="m-0" style={{ color: "var(--color-parch-50)" }}>
                    {selected.role}
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>Cd</dt>
                  <dd
                    className="m-0 font-mono"
                    style={{ color: "var(--color-parch-50)" }}
                  >
                    {selected.cd}
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>DPL</dt>
                  <dd
                    className="m-0 font-mono"
                    style={{ color: "var(--color-parch-400)" }}
                  >
                    —
                  </dd>
                </dl>
              </div>
            </div>
          ) : null}
          <p className="nova-empty-copy">{emptyCopy}</p>
          <p className="nova-note">Fixture shell · no invented DPL</p>
        </aside>
      </div>
    </div>
  );
}

/** Lattice tabs + Daylight browse + RIGHT full source inspector. */
function DataPane() {
  const [tab, setTab] = useState<string>(DATA_TABS[0]);
  const [leaf, setLeaf] = useState<string>("all");
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");

  const leafCounts = useMemo(() => {
    const counts: Record<string, number> = { all: FIXTURE.length };
    for (const r of REGIONS) {
      counts[r.id] = FIXTURE.filter((f) => f.regionId === r.id).length;
    }
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FIXTURE.filter((r) => {
      if (leaf !== "all" && r.regionId !== leaf) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q) ||
        r.track.toLowerCase().includes(q)
      );
    });
  }, [leaf, query]);

  const selected: FixtureRow | undefined = filtered[row] ?? filtered[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={DATA_TABS}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setRow(0);
        }}
        ariaLabel="Data categories"
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[168px_minmax(0,1fr)_300px]">
        {/* Daylight browse sidebar */}
        <nav className="nova-browse" aria-label="Browse regions">
          <p className="nova-browse__head">
            {tab} · daylight rail
          </p>
          {BROWSE_LEAVES.map((l) => {
            const on = l.id === leaf;
            return (
              <button
                key={l.id}
                type="button"
                className={`nova-tree-btn${on ? " is-active" : ""}`}
                onClick={() => {
                  setLeaf(l.id);
                  setRow(0);
                }}
                aria-current={on ? "true" : undefined}
              >
                <Crest id={l.crest} size={14} />
                <span className="truncate">{l.label}</span>
                <span className="count">{leafCounts[l.id] ?? 0}</span>
              </button>
            );
          })}
        </nav>

        {/* Lattice center table */}
        <section
          className="flex min-h-0 flex-col"
          style={{ background: "var(--color-stone-800)" }}
        >
          <div className="nova-toolbar">
            <h2
              className="m-0 text-[15px] font-medium"
              style={{ color: "var(--color-parch-50)" }}
            >
              {tab} · lattice
            </h2>
            <span
              className="font-mono text-[11px]"
              style={{ color: "var(--color-gem-400)" }}
            >
              {filtered.length} rows
            </span>
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
                className="nova-field w-44 px-2 py-1 text-[15px]"
                placeholder="Name, region, kind"
                aria-label="Filter rows"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="nova-table">
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
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="secondary">
                      No rows match browse leaf / filter
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, i) => {
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
                        <td className="secondary">{r.track}</td>
                        <td className="font-mono">{r.qty}</td>
                        <td>
                          <span className="nova-tag nova-tag--fixture">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* RIGHT full source inspector */}
        <aside className="nova-inspector" aria-label="Source inspector">
          {selected ? (
            <>
              <div className="nova-inspector__cut">
                <Crest id={selected.regionId} size={28} />
                <div className="min-w-0">
                  <h3
                    className="m-0 font-display text-[14px] tracking-[0.08em] uppercase"
                    style={{ color: "var(--color-gold-400)" }}
                  >
                    {selected.name}
                  </h3>
                  <p
                    className="mt-1 mb-0 text-[12px]"
                    style={{ color: "var(--color-parch-300)" }}
                  >
                    {selected.track} · {selected.kind}
                  </p>
                </div>
              </div>
              <div className="space-y-2 p-3">
                <KeyFigure
                  label="Fixture quantity"
                  value={String(selected.qty)}
                />
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                  <dt style={{ color: "var(--color-parch-300)" }}>Region</dt>
                  <dd className="m-0" style={{ color: "var(--color-parch-50)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      <Crest id={selected.regionId} size={14} />
                      {selected.region}
                    </span>
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>Kind</dt>
                  <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                    {selected.kind}
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>Track</dt>
                  <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                    {selected.track}
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>Status</dt>
                  <dd className="m-0">
                    <span className="nova-tag nova-tag--fixture">
                      {selected.status}
                    </span>
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>Category</dt>
                  <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                    {tab}
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>Crest path</dt>
                  <dd
                    className="m-0 font-mono text-[11px]"
                    style={{ color: "var(--color-parch-100)" }}
                  >
                    /game/regions/{selected.regionId}.png
                  </dd>
                </dl>

                <div className="nova-source-block">
                  <p className="nova-source-block__title">sources?</p>
                  <dl>
                    <dt>Label</dt>
                    <dd>{selected.source.label}</dd>
                    <dt>Path</dt>
                    <dd className="font-mono text-[11px]">
                      {selected.source.path}
                    </dd>
                    <dt>Verified</dt>
                    <dd className="font-mono">{selected.source.verified}</dd>
                    <dt>Note</dt>
                    <dd>{selected.source.note}</dd>
                    <dt>Provenance</dt>
                    <dd>SourceReference · fixture envelope</dd>
                    <dt>Confidence</dt>
                    <dd>Demo only — not production catalog</dd>
                  </dl>
                </div>

                <p className="nova-sources">
                  Full inspector: name · crest · kind · track · qty · fixture tag
                  · complete source block. Never invent league points here.
                </p>
              </div>
            </>
          ) : (
            <p
              className="p-3 text-[13px]"
              style={{ color: "var(--color-parch-300)" }}
            >
              Select a fixture row to inspect sources.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

export function NovaPreview() {
  const [nav, setNav] = useState<NavId>("Overview");
  const [picks, setPicks] = useState<RegionId[]>(() => [...INITIAL_PICKS]);
  const [taskDone] = useState(2);

  const togglePick = (id: RegionId) => {
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const clearPicks = () => setPicks([]);

  return (
    <div
      className="hybrid-skin--nova flex h-full min-h-[70vh] flex-col"
      style={{
        background: "var(--color-stone-950)",
        color: "var(--color-parch-50)",
      }}
    >
      <NovaNav active={nav} onChange={setNav} picks={picks.length} />

      {nav === "Overview" ? (
        <OverviewPane
          picks={picks}
          taskDone={taskDone}
          taskTotal={TASKS.length}
        />
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

      {/* Quiet footer — trademark for public-site craft; concept lab only */}
      <footer
        className="border-t px-3 py-1.5 text-[10px]"
        style={{
          borderColor: "var(--color-stone-750)",
          color: "var(--color-parch-400)",
          background: "var(--color-stone-900)",
        }}
      >
        Team Nova · Courtyard First · fixture lab · RuneScape is a trademark of
        Jagex Ltd. · not affiliated
      </footer>
    </div>
  );
}
