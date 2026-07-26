"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath } from "@/lib/gameArt";

/**
 * Team Bravo · STONE UI — Round 2 interactive preview
 * Carved limestone workbench: heritage double-frame, gem active, gold titles.
 * Tokens on parent .restoration-skin--bravo (bravo.css). Fixture data only.
 */

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;
type NavId = (typeof NAV)[number];

const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems"] as const;
const BUILD_SEGS = ["Regions", "Relics", "Blessings"] as const;
const MAP_MODES = ["Wartable", "Regions", "Legend"] as const;
const TASK_FILTERS = ["All", "Easy", "Medium", "Hard", "Elite"] as const;
const COMBAT_PANELS = ["Quick", "Setup", "Analysis", "Rotation"] as const;

const TREE = [
  { id: "regions", label: "Regions", crest: "misthalin" as string | null },
  { id: "skills", label: "Skills", crest: null },
  { id: "tracks", label: "Tracks", crest: null },
  { id: "sources", label: "Sources", crest: null },
  { id: "fixtures", label: "Fixtures", crest: "kandarin" as string | null },
] as const;

type PathKind = "order" | "chaos" | "balance";

/** Fixture catalog — labeled demo, not published league facts. */
const FIXTURE = [
  {
    id: "fx-varrock-bank",
    name: "Varrock bank route",
    region: "Misthalin",
    regionId: "misthalin",
    kind: "Travel note",
    status: "Fixture",
    path: "order" as PathKind,
    qty: 4,
    note: "Starter corridor scaffold — not a live task count.",
  },
  {
    id: "fx-karamja-dock",
    name: "Musa Point dock watch",
    region: "Karamja",
    regionId: "karamja",
    kind: "Region note",
    status: "Fixture",
    path: "balance" as PathKind,
    qty: 7,
    note: "Coastal unlock placeholder for filter/select demos.",
  },
  {
    id: "fx-falador-wall",
    name: "Falador wall patrol",
    region: "Asgarnia",
    regionId: "asgarnia",
    kind: "Combat note",
    status: "Fixture",
    path: "order" as PathKind,
    qty: 11,
    note: "White Knight themed sample — numbers are demo only.",
  },
  {
    id: "fx-al-kharid",
    name: "Al Kharid gate toll",
    region: "Desert",
    regionId: "desert",
    kind: "Travel note",
    status: "Fixture",
    path: "chaos" as PathKind,
    qty: 5,
    note: "Desert corridor fixture for crest + path chips.",
  },
  {
    id: "fx-rellekka",
    name: "Rellekka longhall",
    region: "Fremennik",
    regionId: "fremennik",
    kind: "Region note",
    status: "Fixture",
    path: "balance" as PathKind,
    qty: 14,
    note: "Northern sample row — sticky thead stress test.",
  },
  {
    id: "fx-canifis",
    name: "Canifis moonlit square",
    region: "Morytania",
    regionId: "morytania",
    kind: "Combat note",
    status: "Fixture",
    path: "chaos" as PathKind,
    qty: 9,
    note: "Morytania sample — path triad is data semantics only.",
  },
  {
    id: "fx-lletya",
    name: "Lletya crystal path",
    region: "Tirannwn",
    regionId: "tirannwn",
    kind: "Travel note",
    status: "Fixture",
    path: "order" as PathKind,
    qty: 16,
    note: "Elven sample — inspector shows crest + key figure.",
  },
  {
    id: "fx-ardougne",
    name: "Ardougne market clock",
    region: "Kandarin",
    regionId: "kandarin",
    kind: "Region note",
    status: "Fixture",
    path: "balance" as PathKind,
    qty: 8,
    note: "Central Kandarin fixture for zebra scan checks.",
  },
  {
    id: "fx-anachronia",
    name: "Orthen dig site ledger",
    region: "Anachronia",
    regionId: "anachronia",
    kind: "Systems note",
    status: "Fixture",
    path: "chaos" as PathKind,
    qty: 22,
    note: "Island sample — larger qty exercises mono tabular.",
  },
  {
    id: "fx-forinthry",
    name: "Forinthry scar ridge",
    region: "Forinthry",
    regionId: "forinthry",
    kind: "Combat note",
    status: "Fixture",
    path: "chaos" as PathKind,
    qty: 13,
    note: "Wilderness-adjacent sample — not a published unlock.",
  },
  {
    id: "fx-haven",
    name: "Havenhythe harbour light",
    region: "Havenhythe",
    regionId: "havenhythe",
    kind: "Travel note",
    status: "Fixture",
    path: "order" as PathKind,
    qty: 6,
    note: "Coastal haven fixture for full 11-region crest pass.",
  },
] as const;

const ALL_REGIONS = [
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

const TASK_FIXTURES = [
  { id: "t1", title: "Bank a full load at a starter hub", band: "Easy", regionId: "misthalin", region: "Misthalin" },
  { id: "t2", title: "Clear a low-risk combat loop", band: "Easy", regionId: "asgarnia", region: "Asgarnia" },
  { id: "t3", title: "Chart a coastal travel note", band: "Medium", regionId: "karamja", region: "Karamja" },
  { id: "t4", title: "Survive a desert heat sample", band: "Medium", regionId: "desert", region: "Desert" },
  { id: "t5", title: "Complete a northern hall visit", band: "Hard", regionId: "fremennik", region: "Fremennik" },
  { id: "t6", title: "Cross a mire border sample", band: "Hard", regionId: "morytania", region: "Morytania" },
  { id: "t7", title: "Trace a crystal path sample", band: "Elite", regionId: "tirannwn", region: "Tirannwn" },
  { id: "t8", title: "Time a market clock circuit", band: "Medium", regionId: "kandarin", region: "Kandarin" },
] as const;

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <GameIcon src={regionCrestPath(id)} size={size} className="shrink-0" alt="" />
  );
}

function PathChip({ path }: { path: PathKind }) {
  const label = path === "order" ? "Order" : path === "chaos" ? "Chaos" : "Balance";
  return <span className={`path-chip path-chip--${path}`}>{label}</span>;
}

function StoneNav({
  active,
  onChange,
}: {
  active: NavId;
  onChange: (id: NavId) => void;
}) {
  return (
    <header className="bravo-shell flex flex-wrap items-center gap-4 px-3 py-2.5">
      <span className="bravo-title font-display text-[13px] tracking-[0.16em]">
        EQUILIBRIUM
      </span>
      <nav aria-label="Primary">
        <ul className="m-0 flex list-none flex-wrap gap-3 p-0 text-[13px]">
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
                    color: on ? "var(--color-gem-300)" : "var(--color-parch-100)",
                    border: "none",
                    borderBottom: on
                      ? "2px solid var(--color-gem-400)"
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
      <span className="bravo-caption ml-auto font-mono uppercase tracking-[0.08em]">
        fixture · 11 crests
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
      className="flex flex-wrap gap-1 border-b px-2 pt-2 bravo-mortar-seam"
      style={{
        background: "var(--color-stone-900)",
        borderColor: "var(--color-stone-750)",
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
            className={`bravo-seg px-2.5 py-1 text-[12px]${on ? " is-active" : ""}`}
            style={{ cursor: "pointer" }}
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
    <div className="bravo-carved">
      <div className="panel-body" style={{ padding: "0.625rem 0.75rem" }}>
        <p className="m-0 text-[12px]" style={{ color: "var(--color-parch-300)" }}>
          {label}
        </p>
        <p className="stat-key mt-1 mb-0">{value}</p>
      </div>
    </div>
  );
}

function OverviewPane() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="bravo-carved">
          <div className="panel-head">Companion status</div>
          <div className="panel-body space-y-3 text-[15px]">
            <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
              Workbench opens on Data. Carved stone panels hold the control surface —
              tree, table, and inspector under one mortar frame.
            </p>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              <dt style={{ color: "var(--color-parch-300)" }}>Region picks</dt>
              <dd className="m-0 font-mono" style={{ color: "var(--color-parch-50)" }}>
                cap 3
              </dd>
              <dt style={{ color: "var(--color-parch-300)" }}>Blessings</dt>
              <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                Unrevealed · empty until official
              </dd>
              <dt style={{ color: "var(--color-parch-300)" }}>Catalog</dt>
              <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                {FIXTURE.length} fixture rows · labeled demo
              </dd>
              <dt style={{ color: "var(--color-parch-300)" }}>Material</dt>
              <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                Carve + mortar · gem active · gold titles
              </dd>
            </dl>
            <p className="bravo-caption m-0">
              sources? · verified fixture only — not live league data
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <KeyFigure label="Fixture rows" value={String(FIXTURE.length)} />
          <KeyFigure label="Regions" value="11" />
          <KeyFigure label="Pick cap" value="3" />
        </div>
      </div>

      <div className="mt-3 bravo-carved">
        <div className="panel-head">Region crests · full set</div>
        <div className="panel-body">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {ALL_REGIONS.map((r) => (
              <li
                key={r.id}
                className="bravo-carved--inset flex items-center gap-1.5 px-2 py-1 text-[12px]"
                style={{ color: "var(--color-parch-100)" }}
              >
                <Crest id={r.id} size={16} />
                {r.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function DataPane() {
  const [tab, setTab] = useState<string>(DATA_TABS[0]);
  const [leaf, setLeaf] = useState<string>("regions");
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");
  const [pathFilter, setPathFilter] = useState<"all" | PathKind>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FIXTURE.filter((r) => {
      if (pathFilter !== "all" && r.path !== pathFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });
  }, [query, pathFilter]);

  const selected = filtered[row] ?? filtered[0] ?? null;

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

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[176px_minmax(0,1fr)_248px]">
        {/* Tree rail */}
        <nav
          aria-label="Category tree"
          className="overflow-y-auto border-r"
          style={{
            background: "var(--color-stone-850)",
            borderColor: "var(--color-stone-750)",
          }}
        >
          <p
            className="border-b px-2.5 py-1.5 text-[12px] font-medium"
            style={{
              color: "var(--color-parch-100)",
              borderColor: "var(--bravo-mortar)",
            }}
          >
            {tab} · tree
          </p>
          <ul className="m-0 list-none p-0 py-1">
            {TREE.map((item) => {
              const on = item.id === leaf;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setLeaf(item.id)}
                    className={`bravo-tree-leaf flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px]${on ? " is-active" : ""}`}
                    style={{ borderTop: "none", borderRight: "none", borderBottom: "none", cursor: "pointer" }}
                  >
                    {item.crest ? <Crest id={item.crest} size={14} /> : null}
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <div
            className="mx-2 mt-2 bravo-carved--inset p-2"
            style={{ fontSize: "11px", color: "var(--color-parch-400)" }}
          >
            Leaf: <span style={{ color: "var(--color-parch-100)" }}>{leaf}</span>
            <br />
            Stage digs to stone-800; face stays 850.
          </div>
        </nav>

        {/* Table stage */}
        <section
          className="flex min-h-0 flex-col"
          style={{ background: "var(--color-stone-800)" }}
          aria-label="Data table"
        >
          <div
            className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
            style={{ borderColor: "var(--color-stone-750)" }}
          >
            <h2
              className="m-0 text-[15px] font-medium"
              style={{ color: "var(--color-parch-50)" }}
            >
              {tab} · {leaf}
            </h2>
            <span className="font-mono text-[11px]" style={{ color: "var(--color-parch-300)" }}>
              {filtered.length} rows
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label
                className="flex items-center gap-1.5 text-[12px]"
                style={{ color: "var(--color-parch-100)" }}
              >
                Path
                <select
                  value={pathFilter}
                  onChange={(e) => {
                    setPathFilter(e.target.value as "all" | PathKind);
                    setRow(0);
                  }}
                  className="field-inset px-1.5 py-1 text-[12px]"
                  aria-label="Filter by path"
                >
                  <option value="all">All</option>
                  <option value="order">Order</option>
                  <option value="chaos">Chaos</option>
                  <option value="balance">Balance</option>
                </select>
              </label>
              <label
                className="flex items-center gap-1.5 text-[12px]"
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
                  placeholder="Name or region"
                  aria-label="Filter rows"
                />
              </label>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Region</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Path</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="secondary" style={{ textAlign: "center" }}>
                      No rows match this filter
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, i) => {
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
                        <td>
                          <PathChip path={r.path} />
                        </td>
                        <td className="font-mono">{r.qty}</td>
                        <td>
                          <span className="tag">{r.status}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Inspector */}
        <aside
          className="overflow-y-auto border-l"
          style={{
            background: "var(--color-stone-850)",
            borderColor: "var(--color-stone-750)",
          }}
          aria-label="Inspector"
        >
          {selected ? (
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <Crest id={selected.regionId} size={22} />
                <h3 className="bravo-title m-0 text-[14px] tracking-[0.12em]">
                  {selected.name}
                </h3>
              </div>
              <KeyFigure label="Fixture quantity" value={String(selected.qty)} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--color-parch-300)" }}>Region</dt>
                <dd className="m-0" style={{ color: "var(--color-parch-50)" }}>
                  {selected.region}
                </dd>
                <dt style={{ color: "var(--color-parch-300)" }}>Kind</dt>
                <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                  {selected.kind}
                </dd>
                <dt style={{ color: "var(--color-parch-300)" }}>Path</dt>
                <dd className="m-0">
                  <PathChip path={selected.path} />
                </dd>
                <dt style={{ color: "var(--color-parch-300)" }}>Status</dt>
                <dd className="m-0">
                  <span className="tag tag--gem">{selected.status}</span>
                </dd>
              </dl>
              <p
                className="mt-3 mb-0 text-[13px] leading-5"
                style={{ color: "var(--color-parch-100)" }}
              >
                {selected.note}
              </p>
              <p className="bravo-caption mt-3 mb-0">
                sources? · verified fixture only — not live league data
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

function BuildPane() {
  const [seg, setSeg] = useState<string>(BUILD_SEGS[0]);
  const [picks, setPicks] = useState<string[]>(["misthalin", "fremennik", "asgarnia"]);

  const atCap = picks.length >= 3;

  function toggle(id: string) {
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={BUILD_SEGS}
        active={seg}
        onChange={setSeg}
        ariaLabel="Build sections"
      />

      <div
        className="flex flex-wrap items-center gap-3 border-b px-3 py-2"
        style={{ borderColor: "var(--color-stone-750)" }}
      >
        <h2
          className="bravo-title m-0 text-[14px] tracking-[0.12em]"
        >
          {seg}
        </h2>
        {seg === "Regions" ? (
          <span
            className="font-mono text-[13px]"
            style={{ color: "var(--color-gem-400)" }}
            aria-live="polite"
          >
            {picks.length}/3
          </span>
        ) : null}
        <button
          type="button"
          className="ml-auto px-2.5 py-1 text-[12px]"
          style={{
            border: "1px solid var(--color-stone-750)",
            background: "var(--color-stone-850)",
            color: picks.length === 0 ? "var(--color-parch-500)" : "var(--color-parch-100)",
            cursor: picks.length === 0 ? "not-allowed" : "pointer",
            opacity: picks.length === 0 ? 0.55 : 1,
            borderRadius: 2,
            boxShadow:
              picks.length === 0
                ? undefined
                : "0 0 0 1px var(--bravo-edge-dark), inset 0 1px 0 var(--color-stone-carve)",
          }}
          disabled={picks.length === 0}
          onClick={() => setPicks([])}
        >
          Clear picks
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {seg === "Regions" ? (
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_REGIONS.map((r) => {
              const picked = picks.includes(r.id);
              const disabled = !picked && atCap;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`bravo-pick flex w-full items-center gap-2 px-2.5 py-2 text-left text-[13px]${picked ? " is-picked" : ""}`}
                    style={{
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.55 : 1,
                    }}
                    aria-disabled={disabled || undefined}
                    aria-pressed={picked}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      toggle(r.id);
                    }}
                  >
                    <Crest id={r.id} size={18} />
                    <span className="font-medium" style={{ color: "inherit" }}>
                      {r.name}
                    </span>
                    {picked ? (
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
          <div className="bravo-carved max-w-xl">
            <div className="panel-head">{seg}</div>
            <div className="panel-body text-[15px]">
              <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
                Unrevealed. Empty records until an official source exists —
                never invent tier numbers to fill a stub.
              </p>
              <p className="mt-2 mb-0 text-[12px]" style={{ color: "var(--color-parch-300)" }}>
                Fixture stance · ironman / self-sufficient planning only
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MapPane() {
  const [mode, setMode] = useState<string>(MAP_MODES[0]);
  const [focus, setFocus] = useState("misthalin");
  const region = ALL_REGIONS.find((r) => r.id === focus) ?? ALL_REGIONS[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={MAP_MODES}
        active={mode}
        onChange={setMode}
        ariaLabel="Map modes"
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav
          aria-label="Map regions"
          className="overflow-y-auto border-r p-2"
          style={{
            background: "var(--color-stone-850)",
            borderColor: "var(--color-stone-750)",
          }}
        >
          <p
            className="mb-2 px-1 text-[12px] font-medium"
            style={{ color: "var(--color-parch-100)" }}
          >
            {mode} · regions
          </p>
          <ul className="m-0 list-none space-y-0.5 p-0">
            {ALL_REGIONS.map((r) => {
              const on = r.id === focus;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setFocus(r.id)}
                    className={`bravo-tree-leaf flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px]${on ? " is-active" : ""}`}
                    style={{
                      borderTop: "none",
                      borderRight: "none",
                      borderBottom: "none",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    <Crest id={r.id} size={14} />
                    {r.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <section className="flex min-h-0 flex-col overflow-y-auto p-3" aria-live="polite">
          <div className="bravo-carved">
            <div className="panel-head">Wartable focus</div>
            <div className="panel-body flex flex-wrap items-start gap-4">
              <Crest id={region.id} size={48} />
              <div className="min-w-0 flex-1">
                <h2 className="bravo-title m-0 text-[15px] tracking-[0.12em]">
                  {region.name}
                </h2>
                <p className="mt-2 mb-0 text-[15px]" style={{ color: "var(--color-parch-50)" }}>
                  Stone wartable shell — original geometry board lives under Map in
                  production. This preview proves crest selection and carved inspector
                  chrome without loading WebGPU.
                </p>
                <p className="bravo-caption mt-2 mb-0">
                  sources? · verified fixture · mode {mode}
                </p>
              </div>
              <KeyFigure label="Focus" value={String(ALL_REGIONS.findIndex((r) => r.id === region.id) + 1)} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function TasksPane() {
  const [band, setBand] = useState<string>(TASK_FILTERS[0]);
  const [sel, setSel] = useState(0);

  const rows = useMemo(() => {
    if (band === "All") return TASK_FIXTURES;
    return TASK_FIXTURES.filter((t) => t.band === band);
  }, [band]);

  const selected = rows[sel] ?? rows[0] ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={TASK_FILTERS}
        active={band}
        onChange={(t) => {
          setBand(t);
          setSel(0);
        }}
        ariaLabel="Task difficulty"
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px]">
        <section
          className="min-h-0 overflow-auto"
          style={{ background: "var(--color-stone-800)" }}
        >
          <div
            className="flex items-center gap-2 border-b px-3 py-2"
            style={{ borderColor: "var(--color-stone-750)" }}
          >
            <h2 className="m-0 text-[15px] font-medium" style={{ color: "var(--color-parch-50)" }}>
              Task ledger
            </h2>
            <span className="font-mono text-[11px]" style={{ color: "var(--color-parch-300)" }}>
              {rows.length} fixture
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Band</th>
                <th scope="col">Region</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => {
                const on = i === sel;
                return (
                  <tr
                    key={t.id}
                    className={on ? "is-selected" : undefined}
                    onClick={() => setSel(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSel(i);
                      }
                    }}
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                    aria-selected={on}
                  >
                    <td className="font-medium">{t.title}</td>
                    <td className="secondary">{t.band}</td>
                    <td className="secondary">
                      <span className="inline-flex items-center gap-1.5">
                        <Crest id={t.regionId} size={14} />
                        {t.region}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <aside
          className="overflow-y-auto border-l p-3"
          style={{
            background: "var(--color-stone-850)",
            borderColor: "var(--color-stone-750)",
          }}
          aria-label="Task inspector"
        >
          {selected ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                <Crest id={selected.regionId} size={22} />
                <h3 className="bravo-title m-0 text-[14px] tracking-[0.12em]">
                  {selected.region}
                </h3>
              </div>
              <p className="m-0 text-[15px]" style={{ color: "var(--color-parch-50)" }}>
                {selected.title}
              </p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--color-parch-300)" }}>Band</dt>
                <dd className="m-0">
                  <span className="tag">{selected.band}</span>
                </dd>
                <dt style={{ color: "var(--color-parch-300)" }}>Status</dt>
                <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                  Fixture · provisional Catalyst-style stand-in
                </dd>
              </dl>
              <p className="bravo-caption mt-3 mb-0">
                sources? · verified fixture only — not a published Equilibrium list
              </p>
            </>
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

function CombatPane() {
  const [panel, setPanel] = useState<string>(COMBAT_PANELS[0]);
  const figures = [
    { label: "Damage Potential", value: "—", hint: "Fixture empty until ruleset binds" },
    { label: "Hit cap sample", value: "12k", hint: "Demo figure · not a live calc" },
    { label: "Accuracy stage", value: "mid", hint: "Generic target only" },
  ] as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SegmentTabs
        tabs={COMBAT_PANELS}
        active={panel}
        onChange={setPanel}
        ariaLabel="Combat panels"
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <h2 className="bravo-title mb-3 mt-0 text-[14px] tracking-[0.12em]">
          {panel}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {figures.map((f) => (
            <div key={f.label} className="bravo-carved">
              <div className="panel-body">
                <p className="m-0 text-[12px]" style={{ color: "var(--color-parch-300)" }}>
                  {f.label}
                </p>
                <p className="stat-key stat-key--sm mt-1 mb-1">{f.value}</p>
                <p className="bravo-caption m-0">{f.hint}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 bravo-carved">
          <div className="panel-head">Generic target · fixture shell</div>
          <div className="panel-body text-[15px]">
            <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
              Combat core stays zero-React in production. This shell shows carved
              key figures and gem chrome for the {panel} surface without inventing
              boss phases or kill-time math.
            </p>
            <dl className="mt-3 mb-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
              <dt style={{ color: "var(--color-parch-300)" }}>Defence</dt>
              <dd className="m-0 font-mono" style={{ color: "var(--color-parch-50)" }}>
                fixture
              </dd>
              <dt style={{ color: "var(--color-parch-300)" }}>Affinity</dt>
              <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                not bound
              </dd>
              <dt style={{ color: "var(--color-parch-300)" }}>League modifiers</dt>
              <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                ruleset boundary · off until toggled
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BravoPreview() {
  const [nav, setNav] = useState<NavId>("Data");

  return (
    <div
      className="flex h-full min-h-[70vh] flex-col"
      style={{
        background: "var(--color-stone-950)",
        color: "var(--color-parch-50)",
      }}
    >
      <StoneNav active={nav} onChange={setNav} />
      {/* Mortar hairline under shell — heritage seam, not a brand gradient */}
      <div
        aria-hidden="true"
        style={{
          height: 1,
          background:
            "linear-gradient(90deg, transparent, var(--color-stone-carve) 20%, var(--color-stone-750) 50%, var(--color-stone-carve) 80%, transparent)",
          opacity: 0.55,
        }}
      />

      {nav === "Overview" ? <OverviewPane /> : null}
      {nav === "Data" ? <DataPane /> : null}
      {nav === "Build" ? <BuildPane /> : null}
      {nav === "Map" ? <MapPane /> : null}
      {nav === "Tasks" ? <TasksPane /> : null}
      {nav === "Combat" ? <CombatPane /> : null}
    </div>
  );
}
