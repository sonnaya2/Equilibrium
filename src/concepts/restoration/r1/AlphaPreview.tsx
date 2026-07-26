"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { gameIconPath, regionCrestPath, styleIconPath } from "@/lib/gameArt";

/**
 * Team Alpha · DAYLIGHT — Round 3 interactive preview
 * Tokens on parent .restoration-skin--alpha (alpha.css). Fixture data only.
 * Signature: fort courtyard gate (Overview) — keyart as architecture.
 */

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;
type NavId = (typeof NAV)[number];

const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems"] as const;
const BUILD_SEGS = ["Regions", "Relics", "Blessings"] as const;
const COMBAT_SEGS = ["Quick", "Setup", "Analysis", "Rotation"] as const;
const TASK_FILTERS = ["All", "Open", "Done", "Locked"] as const;

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

const TREE = [
  { id: "regions", label: "Regions", crest: "misthalin", kind: "crest" as const },
  { id: "skills", label: "Skills", crest: "slayer", kind: "skill" as const },
  { id: "tracks", label: "Tracks", crest: "archaeology", kind: "skill" as const },
  { id: "combat", label: "Combat", crest: "melee", kind: "style" as const },
  { id: "sources", label: "Sources", crest: "divination", kind: "skill" as const },
] as const;

/** RS-shaped fixture catalog — demo rows, not published league facts. */
const FIXTURE = [
  {
    name: "Varrock Museum Kudos path",
    region: "Misthalin",
    regionId: "misthalin",
    kind: "Skilling unlock",
    status: "Open",
    qty: 3,
  },
  {
    name: "TzHaar Fight Cave access",
    region: "Karamja",
    regionId: "karamja",
    kind: "Combat gate",
    status: "Open",
    qty: 1,
  },
  {
    name: "Warriors' Guild tokens",
    region: "Asgarnia",
    regionId: "asgarnia",
    kind: "Minigame",
    status: "Open",
    qty: 6,
  },
  {
    name: "Menaphos reputation track",
    region: "Desert",
    regionId: "desert",
    kind: "Progression",
    status: "Locked",
    qty: 4,
  },
  {
    name: "Fremennik sagas re-clear",
    region: "Fremennik",
    regionId: "fremennik",
    kind: "Quest chain",
    status: "Done",
    qty: 2,
  },
  {
    name: "Canifis slayer tower route",
    region: "Morytania",
    regionId: "morytania",
    kind: "Slayer",
    status: "Open",
    qty: 8,
  },
  {
    name: "Prifddinas crystal seed loop",
    region: "Tirannwn",
    regionId: "tirannwn",
    kind: "Skilling unlock",
    status: "Locked",
    qty: 5,
  },
  {
    name: "Seers' Village diary set",
    region: "Kandarin",
    regionId: "kandarin",
    kind: "Diary",
    status: "Open",
    qty: 4,
  },
  {
    name: "Anachronia totem sites",
    region: "Anachronia",
    regionId: "anachronia",
    kind: "Skilling unlock",
    status: "Locked",
    qty: 7,
  },
  {
    name: "Fort Forinthry workshop",
    region: "Forinthry",
    regionId: "forinthry",
    kind: "Construction",
    status: "Open",
    qty: 3,
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
    status: "Open" as const,
  },
  {
    id: "t2",
    title: "Complete a hard diary",
    region: "Asgarnia",
    regionId: "asgarnia",
    points: 40,
    status: "Open" as const,
  },
  {
    id: "t3",
    title: "Kill a God Wars general",
    region: "Asgarnia",
    regionId: "asgarnia",
    points: 50,
    status: "Locked" as const,
  },
  {
    id: "t4",
    title: "Train Slayer to 70",
    region: "Morytania",
    regionId: "morytania",
    points: 35,
    status: "Done" as const,
  },
  {
    id: "t5",
    title: "Unlock a lodestone network",
    region: "Karamja",
    regionId: "karamja",
    points: 20,
    status: "Done" as const,
  },
  {
    id: "t6",
    title: "Finish a master quest",
    region: "Tirannwn",
    regionId: "tirannwn",
    points: 60,
    status: "Locked" as const,
  },
  {
    id: "t7",
    title: "Gather 1,000 harmonic dust",
    region: "Tirannwn",
    regionId: "tirannwn",
    points: 25,
    status: "Open" as const,
  },
  {
    id: "t8",
    title: "Clear a raid wing once",
    region: "Kandarin",
    regionId: "kandarin",
    points: 80,
    status: "Locked" as const,
  },
] as const;

const INITIAL_PICKS: RegionId[] = ["misthalin", "asgarnia", "fremennik"];

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <GameIcon src={regionCrestPath(id)} size={size} className="shrink-0" alt="" />
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

function DaylightNav({
  active,
  onChange,
}: {
  active: NavId;
  onChange: (id: NavId) => void;
}) {
  return (
    <header
      className="flex flex-wrap items-center gap-4 border-b border-stone-750 px-3 py-2.5"
      style={{
        background: "var(--color-stone-900)",
        boxShadow: "inset 0 -1px 0 var(--color-stone-750), inset 0 1px 0 var(--color-stone-carve)",
      }}
    >
      <span
        className="font-display text-[13px] tracking-[0.18em]"
        style={{ color: "var(--color-gold-400)" }}
      >
        EQUILIBRIUM
      </span>
      <nav aria-label="Primary">
        <ul className="flex flex-wrap gap-3 text-[13px]">
          {NAV.map((label) => {
            const on = label === active;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => onChange(label)}
                  className="bg-transparent px-0.5 py-0.5"
                  style={{
                    fontWeight: on ? 600 : 400,
                    color: on ? "var(--color-gem-400)" : "var(--color-parch-100)",
                    border: "none",
                    borderBottom: on
                      ? "2px solid var(--color-gem-500)"
                      : "2px solid transparent",
                    cursor: "pointer",
                  }}
                  aria-current={on ? "page" : undefined}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <span
        className="ml-auto font-mono text-[11px]"
        style={{ color: "var(--color-parch-300)" }}
        aria-live="polite"
      >
        Leagues II
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
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 border-b border-stone-750 px-2 pt-2"
      style={{
        background: "var(--color-stone-900)",
        boxShadow: "inset 0 1px 0 var(--color-stone-carve)",
      }}
    >
      {tabs.map((tab) => {
        const on = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab)}
            className="px-2.5 py-1 text-[12px]"
            style={{
              border: on
                ? "1px solid var(--color-gem-500)"
                : "1px solid transparent",
              background: on ? "var(--color-stone-850)" : "transparent",
              color: on ? "var(--color-gem-300)" : "var(--color-parch-100)",
              fontWeight: on ? 600 : 400,
              boxShadow: on ? "inset 0 1px 0 var(--color-stone-carve)" : undefined,
              cursor: "pointer",
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

function KeyFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel panel--carved">
      <div className="panel-body" style={{ padding: "0.625rem 0.75rem" }}>
        <p
          className="m-0 text-[12px]"
          style={{ color: "var(--color-parch-300)" }}
        >
          {label}
        </p>
        <p className="stat-key mt-1 mb-0">{value}</p>
      </div>
    </div>
  );
}

/** Fort courtyard — signature surface. Keyart is the gate aperture, not a strip. */
function OverviewPane({
  picks,
  taskDone,
  taskTotal,
}: {
  picks: readonly string[];
  taskDone: number;
  taskTotal: number;
}) {
  const picked = REGIONS.filter((r) => picks.includes(r.id));
  const slots: (typeof REGIONS[number] | null)[] = [0, 1, 2].map(
    (i) => picked[i] ?? null,
  );

  return (
    <div className="daylight-courtyard">
      <header className="daylight-lintel">
        <h2 className="daylight-lintel-title">Courtyard plan</h2>
        <p className="daylight-lintel-meta">Leagues II · Equilibrium</p>
      </header>

      <div className="daylight-gate">
        {/* West jamb — standing-stone region posts */}
        <aside className="daylight-jamb daylight-jamb--west" aria-label="Region picks">
          <p className="daylight-jamb-label">Standing picks</p>
          {slots.map((r, i) =>
            r ? (
              <div key={r.id} className="daylight-standing">
                <Crest id={r.id} size={26} />
                <p className="daylight-standing-name">{r.name}</p>
              </div>
            ) : (
              <div key={`empty-${i}`} className="daylight-standing is-empty">
                Slot {i + 1}
              </div>
            ),
          )}
        </aside>

        {/* Aperture — living world through the fort gate */}
        <div className="daylight-aperture">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/keyart-2026.jpg" alt="" />
          <p className="daylight-aperture-caption">Fort gate · living world</p>
        </div>

        {/* East jamb — engraved milestones */}
        <aside className="daylight-jamb daylight-jamb--east" aria-label="Plan milestones">
          <p className="daylight-jamb-label">Milestones</p>
          <div className="daylight-milestone">
            <p className="daylight-milestone-k">Picks</p>
            <p className="daylight-milestone-v">{picks.length}/3</p>
          </div>
          <div className="daylight-milestone">
            <p className="daylight-milestone-k">Tasks</p>
            <p className="daylight-milestone-v">
              {taskDone}/{taskTotal}
            </p>
          </div>
          <div className="daylight-milestone">
            <p className="daylight-milestone-k">Catalog</p>
            <p className="daylight-milestone-v">{FIXTURE.length}</p>
          </div>
          <div className="daylight-milestone">
            <p className="daylight-milestone-k">Blessings</p>
            <p className="daylight-milestone-v is-quiet">Unrevealed</p>
          </div>
        </aside>
      </div>

      {/* Courtyard desk — slate ledger, not tree·table·inspector */}
      <div className="daylight-desk">
        <div className="daylight-desk-grid">
          <div className="panel panel--slate">
            <div className="panel-head">Plan ledger</div>
            <div className="panel-body">
              <dl className="daylight-ledger">
                <dt>Region picks</dt>
                <dd className="mono">
                  {picks.length}/3
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
                      · none chosen — open Build
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
              <p className="daylight-note mt-3">
                sources? · verified fixture only · demo catalog
              </p>
            </div>
          </div>

          <div className="panel panel--carved">
            <div className="panel-head">Next on the board</div>
            <div className="panel-body space-y-2 text-[13px]">
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
                    style={{ color: "var(--color-gem-400)" }}
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
              <p className="daylight-note pt-1">
                No invented league numbers. Empty means empty.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-750 px-3 py-2">
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--color-parch-50)" }}
        >
          Region board
        </h2>
        <span
          className="font-mono text-[13px]"
          style={{ color: "var(--color-gem-400)" }}
          aria-live="polite"
        >
          {picks.length}/3
        </span>
        <span className="text-[12px]" style={{ color: "var(--color-parch-300)" }}>
          Crest board · 3D wartable loads on production Map
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-h-0 overflow-y-auto p-3">
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-4">
            {REGIONS.map((r) => {
              const picked = picks.includes(r.id);
              const on = r.id === focus;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setFocus(r.id)}
                    className="panel panel--carved flex w-full flex-col items-center gap-1.5 px-2 py-3 text-center"
                    style={{
                      color: on || picked ? "var(--color-gem-300)" : "var(--color-parch-100)",
                      boxShadow: on
                        ? "inset 0 0 0 1px var(--color-gem-500), inset 0 1px 0 var(--color-stone-carve)"
                        : picked
                          ? "inset 0 0 0 1px var(--color-gem-600), inset 0 1px 0 var(--color-stone-carve)"
                          : undefined,
                      cursor: "pointer",
                    }}
                    aria-pressed={on}
                  >
                    <Crest id={r.id} size={28} />
                    <span className="text-[12px] font-medium" style={{ color: "inherit" }}>
                      {r.name}
                    </span>
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
        </div>

        <aside
          className="overflow-y-auto border-l border-stone-750"
          style={{
            background: "var(--color-stone-850)",
            boxShadow: "inset 1px 0 0 var(--color-stone-750), inset 0 1px 0 var(--color-stone-carve)",
          }}
          aria-label="Region detail"
          aria-live="polite"
        >
          <div className="p-3">
            <div className="mb-2 flex items-center gap-2">
              <Crest id={active.id} size={28} />
              <h3
                className="m-0 font-display text-[14px] tracking-[0.06em]"
                style={{ color: "var(--color-gold-400)" }}
              >
                {active.name}
              </h3>
            </div>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              <dt style={{ color: "var(--color-parch-300)" }}>Status</dt>
              <dd className="m-0" style={{ color: "var(--color-parch-50)" }}>
                {isPicked ? "In plan" : "Available"}
              </dd>
              <dt style={{ color: "var(--color-parch-300)" }}>Unlocks</dt>
              <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                {FIXTURE.filter((f) => f.regionId === active.id).length} fixture rows
              </dd>
            </dl>
            <button
              type="button"
              className="mt-3 w-full px-2.5 py-1.5 text-[12px]"
              style={{
                border: "1px solid var(--color-gem-500)",
                background: isPicked ? "var(--color-stone-800)" : "var(--color-stone-raised)",
                color:
                  !isPicked && atCap
                    ? "var(--color-parch-400)"
                    : "var(--color-gem-300)",
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
              {isPicked ? "Remove pick" : atCap ? "Pick cap reached" : "Add to plan"}
            </button>
            <p
              className="mt-3 mb-0 text-[11px] leading-4"
              style={{ color: "var(--color-parch-300)" }}
            >
              sources? · verified fixture only
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TasksPane() {
  const [filter, setFilter] = useState<string>(TASK_FILTERS[0]);
  const [row, setRow] = useState(0);

  const filtered = useMemo(() => {
    if (filter === "All") return TASKS;
    return TASKS.filter((t) => t.status === filter);
  }, [filter]);

  const selected = filtered[row] ?? filtered[0];
  const pointsOpen = TASKS.filter((t) => t.status === "Open").reduce((s, t) => s + t.points, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-750 px-3 py-2">
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--color-parch-50)" }}
        >
          Task tracker
        </h2>
        <span className="font-mono text-[12px]" style={{ color: "var(--color-gem-400)" }}>
          {pointsOpen} pts open
        </span>
        <span
          className="tag"
          title="Catalyst stand-in until Equilibrium publishes"
        >
          Provisional
        </span>
        <div className="ml-auto flex flex-wrap gap-1" role="group" aria-label="Task filter">
          {TASK_FILTERS.map((f) => {
            const on = f === filter;
            return (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  setRow(0);
                }}
                className="px-2 py-0.5 text-[11px]"
                style={{
                  border: on
                    ? "1px solid var(--color-gem-500)"
                    : "1px solid var(--color-stone-750)",
                  background: on ? "var(--color-stone-850)" : "var(--color-stone-900)",
                  color: on ? "var(--color-gem-300)" : "var(--color-parch-100)",
                  cursor: "pointer",
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-h-0 overflow-auto" style={{ background: "var(--color-stone-800)" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Task</th>
                <th scope="col">Region</th>
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
                    <td className="font-mono">{t.points}</td>
                    <td>
                      <span className="tag">{t.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside
          className="overflow-y-auto border-l border-stone-750"
          style={{ background: "var(--color-stone-850)" }}
          aria-label="Task detail"
        >
          {selected ? (
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <Crest id={selected.regionId} size={22} />
                <h3
                  className="m-0 font-display text-[13px] tracking-[0.05em]"
                  style={{ color: "var(--color-gold-400)" }}
                >
                  Task detail
                </h3>
              </div>
              <p className="m-0 text-[15px]" style={{ color: "var(--color-parch-50)" }}>
                {selected.title}
              </p>
              <KeyFigure label="Points" value={String(selected.points)} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--color-parch-300)" }}>Region</dt>
                <dd className="m-0" style={{ color: "var(--color-parch-50)" }}>
                  {selected.region}
                </dd>
                <dt style={{ color: "var(--color-parch-300)" }}>Status</dt>
                <dd className="m-0">
                  <span className="tag">{selected.status}</span>
                </dd>
              </dl>
              <p
                className="mt-3 mb-0 text-[11px] leading-4"
                style={{ color: "var(--color-parch-300)" }}
              >
                Catalyst stand-in · not Equilibrium published list
              </p>
            </div>
          ) : (
            <p className="p-3 text-[13px]" style={{ color: "var(--color-parch-300)" }}>
              No tasks in this filter
            </p>
          )}
        </aside>
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
      ? "Rotation bay is wired for ability order and adrenaline gates. Nothing lands until the combat core binds to this shell. League relics enter through the ruleset boundary only — not baked into base formulas."
      : seg === "Analysis"
        ? "Analysis waits on a live Damage Potential pass. Target fields on the left are generic defaults for structure only; no output figures are invented here."
        : seg === "Setup"
          ? "Setup holds style and generic target inputs. Hit cap and DPL stay vacant until the calculator is bound — empty slots mean unbound, not zero."
          : "Quick view shows the style you picked and the empty result bay. Damage Potential and hit cap will appear here when the combat core is connected. No fake numbers.";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={COMBAT_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Combat sections"
      />

      <div className="flex flex-wrap items-center gap-3 border-b border-stone-750 px-3 py-2">
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--color-parch-50)" }}
        >
          {seg}
        </h2>
        <span className="text-[12px]" style={{ color: "var(--color-parch-300)" }}>
          Generic target · current RS3 math + league modifiers
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[1fr_240px]">
        <div className="space-y-3">
          <div className="panel panel--carved">
            <div className="panel-head">Style</div>
            <div className="panel-body">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Combat style">
                {styles.map((s) => {
                  const on = s.id === style;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyle(s.id)}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-[13px]"
                      style={{
                        border: on
                          ? "1px solid var(--color-gem-500)"
                          : "1px solid var(--color-stone-750)",
                        background: on ? "var(--color-stone-800)" : "var(--color-stone-900)",
                        color: on ? "var(--color-gem-300)" : "var(--color-parch-100)",
                        boxShadow: on
                          ? "inset 0 0 0 1px var(--color-gem-600), inset 0 1px 0 var(--color-stone-carve)"
                          : "inset 0 1px 0 var(--color-stone-carve)",
                        cursor: "pointer",
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
              <p
                className="mt-2 mb-0 text-[11px]"
                style={{ color: "var(--color-parch-400)" }}
              >
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
                  style={{
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  }}
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
                        boxShadow:
                          "inset 0 1px 2px color-mix(in srgb, var(--color-stone-950) 50%, transparent)",
                      }}
                    >
                      {n}
                    </div>
                  ))}
                </div>
                <p className="m-0 text-[13px]" style={{ color: "var(--color-parch-100)" }}>
                  Ability slots reserved. Order and adrenaline gates bind with the combat core.
                </p>
              </div>
            </div>
          ) : null}

          {seg === "Analysis" ? (
            <div className="panel panel--slate">
              <div className="panel-head">Output structure</div>
              <div className="panel-body">
                <dl className="daylight-ledger">
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
        </div>

        {/* Result bay — structured empty, never em-dash / fake DPL */}
        <aside className="daylight-empty-bay" aria-label="Combat results">
          <div className="daylight-empty-slot">
            <p className="daylight-empty-label">Damage Potential</p>
            <p className="daylight-empty-value">Awaiting calc bind</p>
          </div>
          <div className="daylight-empty-slot">
            <p className="daylight-empty-label">Hit cap</p>
            <p className="daylight-empty-value">Awaiting calc bind</p>
          </div>
          <div className="daylight-empty-slot is-live">
            <p className="daylight-empty-label">Style</p>
            <p className="daylight-empty-value is-bound">
              {styleLabel.slice(0, 3).toUpperCase()}
            </p>
          </div>
          <p className="daylight-empty-copy">{emptyCopy}</p>
          <p className="daylight-note">Fixture shell · no invented DPL</p>
        </aside>
      </div>
    </div>
  );
}

function DataPane() {
  const [tab, setTab] = useState<string>(DATA_TABS[0]);
  const [leaf, setLeaf] = useState<string>("regions");
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FIXTURE;
    return FIXTURE.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q),
    );
  }, [query]);

  const selected = filtered[row] ?? filtered[0];
  const leafMeta = TREE.find((t) => t.id === leaf) ?? TREE[0];

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

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[168px_minmax(0,1fr)_240px]">
        <nav
          aria-label="Category tree"
          className="overflow-y-auto border-r border-stone-750"
          style={{
            background: "var(--color-stone-850)",
            boxShadow: "inset -1px 0 0 var(--color-stone-750), inset 0 1px 0 var(--color-stone-carve)",
          }}
        >
          <p
            className="border-b border-stone-750 px-2.5 py-1.5 text-[12px] font-medium"
            style={{ color: "var(--color-parch-100)" }}
          >
            {tab}
          </p>
          <ul className="m-0 list-none p-0 py-1">
            {TREE.map((item) => {
              const on = item.id === leaf;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setLeaf(item.id)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px]"
                    style={{
                      background: on ? "var(--color-stone-800)" : "transparent",
                      color: on ? "var(--color-gem-300)" : "var(--color-parch-100)",
                      border: "none",
                      borderLeft: on
                        ? "2px solid var(--color-gem-400)"
                        : "2px solid transparent",
                      boxShadow: on
                        ? "inset 0 1px 0 var(--color-stone-carve)"
                        : undefined,
                      cursor: "pointer",
                    }}
                  >
                    <LeafIcon kind={item.kind} id={item.crest} size={14} />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section
          className="flex min-h-0 flex-col"
          style={{ background: "var(--color-stone-800)" }}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-stone-750 px-3 py-2">
            <h2
              className="m-0 flex items-center gap-2 text-[15px] font-medium"
              style={{ color: "var(--color-parch-50)" }}
            >
              <LeafIcon kind={leafMeta.kind} id={leafMeta.crest} size={16} />
              {tab} · {leafMeta.label}
            </h2>
            <span
              className="font-mono text-[11px]"
              style={{ color: "var(--color-parch-300)" }}
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
                className="field-inset w-40 px-2 py-1 text-[15px]"
                placeholder="Name or region"
                aria-label="Filter rows"
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside
          className="overflow-y-auto border-l border-stone-750"
          style={{
            background: "var(--color-stone-850)",
            boxShadow: "inset 1px 0 0 var(--color-stone-750), inset 0 1px 0 var(--color-stone-carve)",
          }}
          aria-label="Inspector"
        >
          {selected ? (
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <Crest id={selected.regionId} size={22} />
                <h3
                  className="m-0 font-display text-[14px] tracking-[0.06em]"
                  style={{ color: "var(--color-gold-400)" }}
                >
                  {selected.name}
                </h3>
              </div>
              <KeyFigure label="Quantity" value={String(selected.qty)} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--color-parch-300)" }}>Region</dt>
                <dd className="m-0" style={{ color: "var(--color-parch-50)" }}>
                  {selected.region}
                </dd>
                <dt style={{ color: "var(--color-parch-300)" }}>Kind</dt>
                <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                  {selected.kind}
                </dd>
                <dt style={{ color: "var(--color-parch-300)" }}>Status</dt>
                <dd className="m-0">
                  <span className="tag">{selected.status}</span>
                </dd>
              </dl>
              <p
                className="mt-3 mb-0 text-[11px] leading-4"
                style={{ color: "var(--color-parch-300)" }}
              >
                sources? · verified fixture only
              </p>
            </div>
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
  picks: readonly string[];
  onToggle: (id: RegionId) => void;
  onClear: () => void;
}) {
  const [seg, setSeg] = useState<string>(BUILD_SEGS[0]);
  const picked = picks.length;
  const atCap = picked >= 3;

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
          <span
            className="font-mono text-[13px]"
            style={{ color: "var(--color-gem-400)" }}
            aria-live="polite"
          >
            {picked}/3
          </span>
        ) : null}
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
                    <Crest id={r.id} size={18} />
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
        ) : (
          <div className="panel panel--carved">
            <div className="panel-head">{seg}</div>
            <div className="panel-body text-[15px]">
              <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
                Unrevealed. Empty records until an official source exists.
              </p>
              <p
                className="mt-2 mb-0 text-[12px]"
                style={{ color: "var(--color-parch-300)" }}
              >
                Ironman / self-sufficient planning only
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AlphaPreview() {
  const [nav, setNav] = useState<NavId>("Overview");
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
    <div
      className="flex h-full min-h-[70vh] flex-col"
      style={{
        background: "var(--color-stone-950)",
        color: "var(--color-parch-50)",
      }}
    >
      <DaylightNav active={nav} onChange={setNav} />
      {/* Blue horizon hairline removed R3 — atmosphere lives in keyart aperture + stone carve only */}

      {nav === "Overview" ? (
        <OverviewPane picks={picks} taskDone={taskDone} taskTotal={taskTotal} />
      ) : null}
      {nav === "Map" ? <MapPane picks={picks} onToggle={togglePick} /> : null}
      {nav === "Tasks" ? <TasksPane /> : null}
      {nav === "Build" ? (
        <BuildPane picks={picks} onToggle={togglePick} onClear={clearPicks} />
      ) : null}
      {nav === "Combat" ? <CombatPane /> : null}
      {nav === "Data" ? <DataPane /> : null}
    </div>
  );
}
