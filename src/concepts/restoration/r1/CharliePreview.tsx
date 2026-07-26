"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath, styleIconPath } from "@/lib/gameArt";

/**
 * Team Charlie · CINEMATIC — Round 2 interactive preview
 * Cool-warm chamber Control Surface: tree · table · inspector.
 * Tokens on parent .restoration-skin--charlie (charlie.css). Fixture data only.
 */

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;
type NavId = (typeof NAV)[number];

const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems"] as const;
const BUILD_SEGS = ["Regions", "Relics", "Blessings"] as const;
const TASK_FILTERS = ["All", "Combat", "Skilling", "Quest"] as const;
const COMBAT_STYLES = ["Melee", "Ranged", "Magic", "Necromancy"] as const;

const TREE = [
  { id: "regions", label: "Regions", crest: "misthalin" as string | null },
  { id: "skills", label: "Skills", crest: null },
  { id: "tracks", label: "Tracks", crest: null },
  { id: "sources", label: "Sources", crest: null },
  { id: "bosses", label: "Bosses", crest: "morytania" as string | null },
  { id: "hubs", label: "Hubs", crest: "asgarnia" as string | null },
] as const;

/** Fixture rows — denser RS-credible demo labels, not published league facts. */
const FIXTURE = [
  {
    name: "Varrock Museum kudos track",
    region: "Misthalin",
    regionId: "misthalin",
    kind: "Skilling hub",
    status: "Fixture",
    qty: 14,
    note: "Kudos gates and free teleports — demo ladder only.",
  },
  {
    name: "Karamja gloves ladder",
    region: "Karamja",
    regionId: "karamja",
    kind: "Diary gear",
    status: "Fixture",
    qty: 4,
    note: "Diary tier gloves — not Equilibrium unlock numbers.",
  },
  {
    name: "God Wars dungeon access",
    region: "Asgarnia",
    regionId: "asgarnia",
    kind: "Combat zone",
    status: "Fixture",
    qty: 6,
    note: "Killcount / instance notes as catalog shape demo.",
  },
  {
    name: "Menaphos faction ranks",
    region: "Desert",
    regionId: "desert",
    kind: "City unlock",
    status: "Fixture",
    qty: 10,
    note: "Faction reputation tiers — structure only.",
  },
  {
    name: "Fremennik saga routes",
    region: "Fremennik",
    regionId: "fremennik",
    kind: "Quest path",
    status: "Fixture",
    qty: 8,
    note: "Saga order demo; not Catalyst task IDs.",
  },
  {
    name: "Morytania legs & prayers",
    region: "Morytania",
    regionId: "morytania",
    kind: "Diary gear",
    status: "Fixture",
    qty: 5,
    note: "Hard diary rewards catalog shape.",
  },
  {
    name: "Prifddinas clan districts",
    region: "Tirannwn",
    regionId: "tirannwn",
    kind: "City unlock",
    status: "Fixture",
    qty: 8,
    note: "Eight clan districts as row density test.",
  },
  {
    name: "Seers' Village diary",
    region: "Kandarin",
    regionId: "kandarin",
    kind: "Diary gear",
    status: "Fixture",
    qty: 4,
    note: "Medium/hard diary demo rows.",
  },
  {
    name: "Anachronia agility course",
    region: "Anachronia",
    regionId: "anachronia",
    kind: "Skilling hub",
    status: "Fixture",
    qty: 12,
    note: "Canopy course + base camp unlock shape.",
  },
  {
    name: "Fort Forinthry workshops",
    region: "Forinthry",
    regionId: "forinthry",
    kind: "Construction",
    status: "Fixture",
    qty: 7,
    note: "Workshop tiers as construction fixture.",
  },
  {
    name: "Havenhythe landing berths",
    region: "Havenhythe",
    regionId: "havenhythe",
    kind: "Region hub",
    status: "Fixture",
    qty: 3,
    note: "Landing progression demo — empty blessings stay empty.",
  },
  {
    name: "Wars' Retreat bank chest",
    region: "Misthalin",
    regionId: "misthalin",
    kind: "Combat utility",
    status: "Fixture",
    qty: 1,
    note: "Boss hub utility row for density.",
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

const TASK_FIXTURE = [
  {
    id: "t1",
    title: "Clear the goblin house cache",
    kind: "Combat" as const,
    region: "Misthalin",
    regionId: "misthalin",
    pts: 10,
  },
  {
    id: "t2",
    title: "Fish until the net snags thrice",
    kind: "Skilling" as const,
    region: "Karamja",
    regionId: "karamja",
    pts: 25,
  },
  {
    id: "t3",
    title: "Speak with the desert seer",
    kind: "Quest" as const,
    region: "Desert",
    regionId: "desert",
    pts: 40,
  },
  {
    id: "t4",
    title: "Survive one full BGH wave",
    kind: "Combat" as const,
    region: "Anachronia",
    regionId: "anachronia",
    pts: 50,
  },
  {
    id: "t5",
    title: "Mill 200 flax at Seers'",
    kind: "Skilling" as const,
    region: "Kandarin",
    regionId: "kandarin",
    pts: 15,
  },
  {
    id: "t6",
    title: "Complete a Temple Trek",
    kind: "Quest" as const,
    region: "Morytania",
    regionId: "morytania",
    pts: 30,
  },
] as const;

const COMBAT_FIXTURE = [
  { name: "Assault", style: "Melee", ad: 50, dmg: "High", note: "Channeled multi-hit" },
  { name: "Greater Barge", style: "Melee", ad: 50, dmg: "Gap", note: "Opener fixture" },
  { name: "Death's Swiftness", style: "Ranged", ad: 100, dmg: "Ult", note: "Field ult demo" },
  { name: "Greater Ricochet", style: "Ranged", ad: 50, dmg: "AoE", note: "Bounce chain" },
  { name: "Sunshine", style: "Magic", ad: 100, dmg: "Ult", note: "Field ult demo" },
  { name: "Greater Chain", style: "Magic", ad: 50, dmg: "AoE", note: "Spread demo" },
  { name: "Living Death", style: "Necromancy", ad: 100, dmg: "Ult", note: "Mode switch" },
  { name: "Split Soul", style: "Necromancy", ad: 100, dmg: "Buff", note: "Conduit fixture" },
] as const;

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <GameIcon src={regionCrestPath(id)} size={size} className="shrink-0" alt="" />
  );
}

function StyleIcon({
  style,
  size = 16,
}: {
  style: "melee" | "ranged" | "magic" | "necromancy";
  size?: number;
}) {
  return (
    <GameIcon src={styleIconPath(style)} size={size} className="shrink-0" alt="" />
  );
}

function KeyFigure({
  label,
  value,
  large,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div className="panel panel--raised">
      <div className="panel-body" style={{ padding: "0.625rem 0.75rem" }}>
        <p className="m-0 text-[12px]" style={{ color: "var(--rc-parch-300)" }}>
          {label}
        </p>
        <p className={`stat-key mt-1 mb-0 ${large ? "stat-key--lg" : ""}`}>{value}</p>
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
    <div className="seg-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={tab === active}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function CharlieNav({
  active,
  onChange,
}: {
  active: NavId;
  onChange: (id: NavId) => void;
}) {
  return (
    <header className="charlie-header">
      <span className="charlie-brand">EQUILIBRIUM</span>
      <nav className="charlie-nav" aria-label="Primary">
        <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
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
      <span
        className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em]"
        style={{ color: "var(--rc-parch-400)" }}
      >
        Chamber fixture
      </span>
    </header>
  );
}

function OverviewPane({
  pickCount,
  onGoData,
  onGoBuild,
}: {
  pickCount: number;
  onGoData: () => void;
  onGoBuild: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="chamber-keyart">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/keyart-2026.jpg" alt="" />
        <span className="chamber-keyart-caption">2026 keyart · chamber mood</span>
      </div>
      <div className="chamber-haze" aria-hidden />

      <div className="grid gap-3 p-3 sm:grid-cols-[1fr_auto]">
        <div className="panel">
          <div className="panel-head panel-head--gold">League companion</div>
          <div className="panel-body space-y-3 text-[15px]">
            <p className="m-0" style={{ color: "var(--rc-parch-50)" }}>
              Plan region picks, track unlocks, and run combat math under Equilibrium
              modifiers. Ironman sourcing assumed throughout.
            </p>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              <dt style={{ color: "var(--rc-parch-300)" }}>Region picks</dt>
              <dd
                className="m-0 font-mono"
                style={{ color: "var(--rc-gem)" }}
                aria-live="polite"
              >
                {pickCount}/3
              </dd>
              <dt style={{ color: "var(--rc-parch-300)" }}>Blessings</dt>
              <dd className="m-0" style={{ color: "var(--rc-parch-100)" }}>
                Unrevealed · empty until official
              </dd>
              <dt style={{ color: "var(--rc-parch-300)" }}>Catalog</dt>
              <dd className="m-0" style={{ color: "var(--rc-parch-100)" }}>
                {FIXTURE.length} fixture rows · labeled demo
              </dd>
              <dt style={{ color: "var(--rc-parch-300)" }}>Sources</dt>
              <dd className="m-0" style={{ color: "var(--rc-parch-100)" }}>
                sources? · verified fixture pattern
              </dd>
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="btn-ghost" onClick={onGoBuild}>
                Open Build
              </button>
              <button type="button" className="btn-ghost" onClick={onGoData}>
                Open Data
              </button>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-44">
          <KeyFigure label="Fixture rows" value={String(FIXTURE.length)} large />
          <KeyFigure label="Picks used" value={`${pickCount}/3`} />
          <KeyFigure label="Task demos" value={String(TASK_FIXTURE.length)} />
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
  const [regionFilter, setRegionFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FIXTURE.filter((r) => {
      if (regionFilter !== "all" && r.regionId !== regionFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q)
      );
    });
  }, [query, regionFilter]);

  const selected = filtered[row] ?? filtered[0];
  const leafLabel = TREE.find((t) => t.id === leaf)?.label ?? leaf;

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
          className="rail overflow-y-auto border-r"
          style={{ borderColor: "var(--rc-border)" }}
        >
          <p
            className="border-b px-2.5 py-1.5 text-[12px] font-medium"
            style={{
              borderColor: "var(--rc-border)",
              color: "var(--rc-parch-100)",
            }}
          >
            {tab} · tree
          </p>
          <ul className="m-0 list-none p-0 py-1">
            {TREE.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`tree-leaf ${item.id === leaf ? "is-active" : ""}`}
                  onClick={() => setLeaf(item.id)}
                >
                  {item.crest ? <Crest id={item.crest} size={14} /> : null}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Stage table */}
        <section className="stage flex min-h-0 flex-col">
          <div
            className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
            style={{ borderColor: "var(--rc-border)" }}
          >
            <h2
              className="m-0 text-[15px] font-medium"
              style={{ color: "var(--rc-parch-50)" }}
            >
              {tab} · {leafLabel}
            </h2>
            <span
              className="font-mono text-[11px]"
              style={{ color: "var(--rc-parch-300)" }}
            >
              {filtered.length} rows
            </span>
            <label
              className="flex items-center gap-1.5 text-[12px]"
              style={{ color: "var(--rc-parch-100)" }}
            >
              Region
              <select
                className="field-inset px-1.5 py-1 text-[13px]"
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setRow(0);
                }}
                aria-label="Filter by region"
              >
                <option value="all">All</option>
                {ALL_REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="ml-auto flex items-center gap-2 text-[12px]"
              style={{ color: "var(--rc-parch-100)" }}
            >
              Filter
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setRow(0);
                }}
                className="field-inset w-40 px-2 py-1 text-[15px]"
                placeholder="Name or kind"
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
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ color: "var(--rc-parch-300)" }}>
                      No fixture rows match this filter.
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
                        <td className="font-mono">{r.qty}</td>
                        <td>
                          <span className="tag tag--fixture">{r.status}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Inspector rail */}
        <aside
          className="rail overflow-y-auto border-l"
          style={{ borderColor: "var(--rc-border)" }}
          aria-label="Inspector"
        >
          {selected ? (
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <Crest id={selected.regionId} size={22} />
                <h3
                  className="m-0 font-display text-[14px] tracking-[0.06em]"
                  style={{ color: "var(--rc-gold)" }}
                >
                  {selected.name}
                </h3>
              </div>
              <KeyFigure label="Fixture quantity" value={String(selected.qty)} large />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--rc-parch-300)" }}>Region</dt>
                <dd className="m-0" style={{ color: "var(--rc-parch-50)" }}>
                  {selected.region}
                </dd>
                <dt style={{ color: "var(--rc-parch-300)" }}>Kind</dt>
                <dd className="m-0" style={{ color: "var(--rc-parch-100)" }}>
                  {selected.kind}
                </dd>
                <dt style={{ color: "var(--rc-parch-300)" }}>Tree leaf</dt>
                <dd className="m-0" style={{ color: "var(--rc-parch-100)" }}>
                  {leafLabel}
                </dd>
                <dt style={{ color: "var(--rc-parch-300)" }}>Status</dt>
                <dd className="m-0">
                  <span className="tag tag--fixture">{selected.status}</span>
                </dd>
              </dl>
              <p
                className="mt-3 mb-0 text-[12px] leading-4"
                style={{ color: "var(--rc-parch-300)" }}
              >
                {selected.note}
              </p>
              <p
                className="mt-2 mb-0 text-[11px] leading-4"
                style={{ color: "var(--rc-parch-400)" }}
              >
                sources? · verified fixture only — not live league data
              </p>
            </div>
          ) : (
            <p className="p-3 text-[13px]" style={{ color: "var(--rc-parch-300)" }}>
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
  picks: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [seg, setSeg] = useState<string>(BUILD_SEGS[0]);
  const count = picks.size;
  const atCap = count >= 3;

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
        style={{ borderColor: "var(--rc-border)" }}
      >
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--rc-parch-50)" }}
        >
          {seg}
        </h2>
        {seg === "Regions" ? (
          <span
            className="font-mono text-[13px]"
            style={{ color: "var(--rc-gem)" }}
            aria-live="polite"
          >
            {count}/3
          </span>
        ) : null}
        <button
          type="button"
          className="btn-ghost ml-auto"
          disabled={count === 0}
          onClick={onClear}
        >
          Clear picks
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {seg === "Regions" ? (
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_REGIONS.map((r) => {
              const picked = picks.has(r.id);
              const disabled = !picked && atCap;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className="pick-card"
                    onClick={() => {
                      if (!disabled) onToggle(r.id);
                    }}
                    aria-disabled={disabled || undefined}
                    aria-pressed={picked}
                  >
                    <Crest id={r.id} size={18} />
                    <span className="font-medium" style={{ color: "inherit" }}>
                      {r.name}
                    </span>
                    {picked ? (
                      <span
                        className="ml-auto font-mono text-[11px]"
                        style={{ color: "var(--rc-gem)" }}
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
          <div className="panel">
            <div className="panel-head panel-head--gold">{seg}</div>
            <div className="panel-body text-[15px]">
              <p className="m-0" style={{ color: "var(--rc-parch-50)" }}>
                Unrevealed. Empty records until an official source exists — never
                invent tier numbers to fill a stub.
              </p>
              <p
                className="mt-2 mb-0 text-[12px]"
                style={{ color: "var(--rc-parch-300)" }}
              >
                Fixture stance · ironman / self-sufficient planning only
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MapPane({
  picks,
  onToggle,
  onClear,
}: {
  picks: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const count = picks.size;
  const atCap = count >= 3;
  const selectedIds = ALL_REGIONS.filter((r) => picks.has(r.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2
          className="m-0 font-display text-[14px] tracking-[0.08em]"
          style={{ color: "var(--rc-gold)" }}
        >
          REGION LEDGER
        </h2>
        <span
          className="font-mono text-[13px]"
          style={{ color: "var(--rc-gem)" }}
          aria-live="polite"
        >
          {count}/3
        </span>
        <button
          type="button"
          className="btn-ghost ml-auto"
          disabled={count === 0}
          onClick={onClear}
        >
          Clear picks
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <div className="map-ledger p-3">
          <p
            className="m-0 mb-2 text-[12px]"
            style={{ color: "var(--rc-parch-300)" }}
          >
            Wartable geometry lives on the Map route — this chamber ledger owns
            picks without covering the board.
          </p>
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
            {ALL_REGIONS.map((r) => {
              const picked = picks.has(r.id);
              const disabled = !picked && atCap;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className="pick-card"
                    onClick={() => {
                      if (!disabled) onToggle(r.id);
                    }}
                    aria-disabled={disabled || undefined}
                    aria-pressed={picked}
                  >
                    <Crest id={r.id} size={18} />
                    <span className="font-medium">{r.name}</span>
                    {picked ? (
                      <span
                        className="ml-auto font-mono text-[11px]"
                        style={{ color: "var(--rc-gem)" }}
                      >
                        pick
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="panel panel--raised" aria-live="polite">
          <div className="panel-head panel-head--gold">Selection</div>
          <div className="panel-body">
            {selectedIds.length === 0 ? (
              <p className="m-0 text-[13px]" style={{ color: "var(--rc-parch-300)" }}>
                No regions picked. Cap is 3.
              </p>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {selectedIds.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 text-[13px]"
                    style={{ color: "var(--rc-parch-50)" }}
                  >
                    <Crest id={r.id} size={16} />
                    {r.name}
                  </li>
                ))}
              </ul>
            )}
            <p
              className="mt-3 mb-0 text-[11px]"
              style={{ color: "var(--rc-parch-400)" }}
            >
              sources? · verified fixture pattern
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TasksPane() {
  const [filter, setFilter] = useState<string>("All");
  const [row, setRow] = useState(0);
  const [done, setDone] = useState<Set<string>>(() => new Set());

  const filtered = useMemo(() => {
    if (filter === "All") return TASK_FIXTURE;
    return TASK_FIXTURE.filter((t) => t.kind === filter);
  }, [filter]);

  const selected = filtered[row] ?? filtered[0];
  const pts = TASK_FIXTURE.reduce(
    (sum, t) => sum + (done.has(t.id) ? t.pts : 0),
    0,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--rc-border)", background: "var(--rc-shell)" }}
      >
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--rc-parch-50)" }}
        >
          Tasks
        </h2>
        <span className="tag tag--fixture">Provisional fixture</span>
        <span
          className="font-mono text-[12px]"
          style={{ color: "var(--rc-gem)" }}
          aria-live="polite"
        >
          {done.size}/{TASK_FIXTURE.length} · {pts} pts
        </span>
        <div
          className="ml-auto flex flex-wrap gap-1"
          role="tablist"
          aria-label="Task kind"
        >
          {TASK_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className="btn-ghost"
              style={
                filter === f
                  ? {
                      borderColor: "var(--rc-gem-deep)",
                      color: "var(--rc-gem-bright)",
                    }
                  : undefined
              }
              onClick={() => {
                setFilter(f);
                setRow(0);
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="stage min-h-0 overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Done</th>
                <th scope="col">Task</th>
                <th scope="col">Kind</th>
                <th scope="col">Region</th>
                <th scope="col">Pts</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => {
                const on = i === row;
                const isDone = done.has(t.id);
                return (
                  <tr
                    key={t.id}
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
                    <td>
                      <input
                        type="checkbox"
                        checked={isDone}
                        aria-label={`Mark ${t.title} done`}
                        onChange={(e) => {
                          e.stopPropagation();
                          setDone((prev) => {
                            const next = new Set(prev);
                            if (next.has(t.id)) next.delete(t.id);
                            else next.add(t.id);
                            return next;
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="font-medium">{t.title}</td>
                    <td className="secondary">{t.kind}</td>
                    <td className="secondary">
                      <span className="inline-flex items-center gap-1.5">
                        <Crest id={t.regionId} size={14} />
                        {t.region}
                      </span>
                    </td>
                    <td className="font-mono">{t.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside
          className="rail overflow-y-auto border-l p-3"
          style={{ borderColor: "var(--rc-border)" }}
          aria-label="Task inspector"
        >
          {selected ? (
            <>
              <h3
                className="m-0 font-display text-[13px] tracking-[0.06em]"
                style={{ color: "var(--rc-gold)" }}
              >
                {selected.title}
              </h3>
              <KeyFigure label="Points" value={String(selected.pts)} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--rc-parch-300)" }}>Kind</dt>
                <dd className="m-0" style={{ color: "var(--rc-parch-100)" }}>
                  {selected.kind}
                </dd>
                <dt style={{ color: "var(--rc-parch-300)" }}>Region</dt>
                <dd className="m-0" style={{ color: "var(--rc-parch-50)" }}>
                  {selected.region}
                </dd>
                <dt style={{ color: "var(--rc-parch-300)" }}>Done</dt>
                <dd className="m-0">
                  <span
                    className={
                      done.has(selected.id) ? "tag tag--gem" : "tag tag--fixture"
                    }
                  >
                    {done.has(selected.id) ? "Complete" : "Open"}
                  </span>
                </dd>
              </dl>
              <p
                className="mt-3 mb-0 text-[11px]"
                style={{ color: "var(--rc-parch-400)" }}
              >
                Catalyst stand-in · provisional until Equilibrium list ships
              </p>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function CombatPane() {
  const [style, setStyle] = useState<string>("Melee");
  const [row, setRow] = useState(0);

  const styleKey = style.toLowerCase() as
    | "melee"
    | "ranged"
    | "magic"
    | "necromancy";

  const filtered = useMemo(
    () => COMBAT_FIXTURE.filter((a) => a.style === style),
    [style],
  );
  const selected = filtered[row] ?? filtered[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex flex-wrap items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--rc-border)", background: "var(--rc-shell)" }}
      >
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--rc-parch-50)" }}
        >
          Combat
        </h2>
        <span className="tag tag--fixture">Ability catalog fixture</span>
        <div className="ml-auto flex flex-wrap gap-1" role="group" aria-label="Style">
          {COMBAT_STYLES.map((s) => {
            const sk = s.toLowerCase() as
              | "melee"
              | "ranged"
              | "magic"
              | "necromancy";
            return (
              <button
                key={s}
                type="button"
                className="style-chip"
                aria-pressed={style === s}
                onClick={() => {
                  setStyle(s);
                  setRow(0);
                }}
              >
                <StyleIcon style={sk} size={14} />
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="stage min-h-0 overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Ability</th>
                <th scope="col">Style</th>
                <th scope="col">Adren</th>
                <th scope="col">Role</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const on = i === row;
                return (
                  <tr
                    key={a.name}
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
                      <span className="inline-flex items-center gap-1.5">
                        <StyleIcon style={styleKey} size={14} />
                        {a.name}
                      </span>
                    </td>
                    <td className="secondary">{a.style}</td>
                    <td className="font-mono">{a.ad}</td>
                    <td className="secondary">{a.dmg}</td>
                    <td className="secondary">{a.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside
          className="rail overflow-y-auto border-l p-3"
          style={{ borderColor: "var(--rc-border)" }}
          aria-label="Ability inspector"
        >
          {selected ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                <StyleIcon style={styleKey} size={20} />
                <h3
                  className="m-0 font-display text-[13px] tracking-[0.06em]"
                  style={{ color: "var(--rc-gold)" }}
                >
                  {selected.name}
                </h3>
              </div>
              <KeyFigure label="Adrenaline" value={String(selected.ad)} large />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--rc-parch-300)" }}>Style</dt>
                <dd className="m-0" style={{ color: "var(--rc-parch-50)" }}>
                  {selected.style}
                </dd>
                <dt style={{ color: "var(--rc-parch-300)" }}>Role</dt>
                <dd className="m-0" style={{ color: "var(--rc-parch-100)" }}>
                  {selected.dmg}
                </dd>
                <dt style={{ color: "var(--rc-parch-300)" }}>Note</dt>
                <dd className="m-0" style={{ color: "var(--rc-parch-100)" }}>
                  {selected.note}
                </dd>
              </dl>
              <p
                className="mt-3 mb-0 text-[11px]"
                style={{ color: "var(--rc-parch-400)" }}
              >
                Fixture abilities · DPL math lives in combat core, not this skin
              </p>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export function CharliePreview() {
  const [nav, setNav] = useState<NavId>("Data");
  const [picks, setPicks] = useState<Set<string>>(
    () => new Set(["misthalin", "asgarnia", "fremennik"]),
  );

  const togglePick = (id: string) => {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  };

  const clearPicks = () => setPicks(new Set());

  return (
    <div className="charlie-shell">
      <CharlieNav active={nav} onChange={setNav} />
      <div className="chamber-haze" aria-hidden />

      {nav === "Overview" ? (
        <OverviewPane
          pickCount={picks.size}
          onGoData={() => setNav("Data")}
          onGoBuild={() => setNav("Build")}
        />
      ) : null}
      {nav === "Data" ? <DataPane /> : null}
      {nav === "Build" ? (
        <BuildPane picks={picks} onToggle={togglePick} onClear={clearPicks} />
      ) : null}
      {nav === "Map" ? (
        <MapPane picks={picks} onToggle={togglePick} onClear={clearPicks} />
      ) : null}
      {nav === "Tasks" ? <TasksPane /> : null}
      {nav === "Combat" ? <CombatPane /> : null}
    </div>
  );
}
