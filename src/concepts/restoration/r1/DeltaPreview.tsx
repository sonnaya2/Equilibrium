"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath } from "@/lib/gameArt";

/**
 * Team Delta · CRYSTAL — Round 3 interactive preview
 * Emerald crystal mountain + gem chrome. Signature: cut-gem facet desk.
 * Tokens on parent .restoration-skin--delta (delta.css). Fixture data only.
 * Opens on Data. No manifesto, no self-score, no gen-AI art.
 */

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;
type NavId = (typeof NAV)[number];

const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems"] as const;
const BUILD_SEGS = ["Regions", "Relics", "Blessings"] as const;
const COMBAT_SEGS = ["Quick", "Setup", "Analysis", "Rotation"] as const;
const TASK_FILTERS = ["All", "Easy", "Medium", "Hard", "Elite"] as const;
const TASK_TIERS = ["Easy", "Medium", "Hard", "Elite"] as const;
const STYLE_CHIPS = ["All", "Melee", "Ranged", "Magic"] as const;

/** Credible fixture catalog — labeled demo, never published league facts. */
const FIXTURE = [
  {
    name: "Lumbridge teleports (demo)",
    region: "Misthalin",
    regionId: "misthalin",
    kind: "Utility",
    track: "General",
    status: "Fixture",
    qty: 1,
  },
  {
    name: "TzHaar fight caves access (demo)",
    region: "Karamja",
    regionId: "karamja",
    kind: "Combat hub",
    track: "Combat",
    status: "Fixture",
    qty: 1,
  },
  {
    name: "Warriors' Guild entry (demo)",
    region: "Asgarnia",
    regionId: "asgarnia",
    kind: "Guild",
    track: "Combat",
    status: "Fixture",
    qty: 1,
  },
  {
    name: "Menaphos gates (demo)",
    region: "Desert",
    regionId: "desert",
    kind: "City access",
    track: "Skilling",
    status: "Fixture",
    qty: 1,
  },
  {
    name: "Fremennik sagas board (demo)",
    region: "Fremennik",
    regionId: "fremennik",
    kind: "Quest line",
    track: "Progression",
    status: "Fixture",
    qty: 4,
  },
  {
    name: "Morytania legs route (demo)",
    region: "Morytania",
    regionId: "morytania",
    kind: "Diary path",
    track: "Skilling",
    status: "Fixture",
    qty: 1,
  },
  {
    name: "Prifddinas crystal seed (demo)",
    region: "Tirannwn",
    regionId: "tirannwn",
    kind: "City access",
    track: "Progression",
    status: "Fixture",
    qty: 1,
  },
  {
    name: "Seers' Village bank loop (demo)",
    region: "Kandarin",
    regionId: "kandarin",
    kind: "Utility",
    track: "General",
    status: "Fixture",
    qty: 1,
  },
  {
    name: "Anachronia base camp (demo)",
    region: "Anachronia",
    regionId: "anachronia",
    kind: "Hub",
    track: "Skilling",
    status: "Fixture",
    qty: 1,
  },
  {
    name: "Fort Forinthry yard (demo)",
    region: "Forinthry",
    regionId: "forinthry",
    kind: "Construction",
    track: "Progression",
    status: "Fixture",
    qty: 1,
  },
  {
    name: "Havenhythe dock (demo)",
    region: "Havenhythe",
    regionId: "havenhythe",
    kind: "Hub",
    track: "General",
    status: "Fixture",
    qty: 1,
  },
  {
    name: "Archaeology guild desk (demo)",
    region: "Misthalin",
    regionId: "misthalin",
    kind: "Guild",
    track: "Skilling",
    status: "Fixture",
    qty: 1,
  },
] as const;

const TRACKS = ["All", "General", "Combat", "Skilling", "Progression"] as const;

const ALL_REGION_IDS = [
  "misthalin",
  "asgarnia",
  "karamja",
  "desert",
  "fremennik",
  "morytania",
  "tirannwn",
  "kandarin",
  "anachronia",
  "forinthry",
  "havenhythe",
] as const;

const REGION_NAMES: Record<(typeof ALL_REGION_IDS)[number], string> = {
  misthalin: "Misthalin",
  asgarnia: "Asgarnia",
  karamja: "Karamja",
  desert: "Desert",
  fremennik: "Fremennik",
  morytania: "Morytania",
  tirannwn: "Tirannwn",
  kandarin: "Kandarin",
  anachronia: "Anachronia",
  forinthry: "Forinthry",
  havenhythe: "Havenhythe",
};

const TASK_FIXTURE = [
  {
    id: "t1",
    name: "Cut oak logs near Draynor (demo)",
    tier: "Easy",
    region: "Misthalin",
    regionId: "misthalin",
    pts: 10,
  },
  {
    id: "t2",
    name: "Bank at Lumbridge castle (demo)",
    tier: "Easy",
    region: "Misthalin",
    regionId: "misthalin",
    pts: 10,
  },
  {
    id: "t3",
    name: "Complete a TzHaar fight (demo)",
    tier: "Medium",
    region: "Karamja",
    regionId: "karamja",
    pts: 30,
  },
  {
    id: "t4",
    name: "Catch a shark on the docks (demo)",
    tier: "Medium",
    region: "Kandarin",
    regionId: "kandarin",
    pts: 30,
  },
  {
    id: "t5",
    name: "Smith a rune item at the anvil (demo)",
    tier: "Hard",
    region: "Asgarnia",
    regionId: "asgarnia",
    pts: 50,
  },
  {
    id: "t6",
    name: "Visit Prifddinas crystal tower (demo)",
    tier: "Hard",
    region: "Tirannwn",
    regionId: "tirannwn",
    pts: 50,
  },
  {
    id: "t7",
    name: "Clear a Sophanem dungeon wing (demo)",
    tier: "Elite",
    region: "Desert",
    regionId: "desert",
    pts: 80,
  },
  {
    id: "t8",
    name: "Finish a Fort Forinthry contract (demo)",
    tier: "Elite",
    region: "Forinthry",
    regionId: "forinthry",
    pts: 80,
  },
] as const;

const MAP_SLABS = [
  { id: "misthalin", note: "Starter lowlands" },
  { id: "asgarnia", note: "White Knight stretch" },
  { id: "karamja", note: "Volcanic island" },
  { id: "desert", note: "Menaphos / Sophanem" },
  { id: "fremennik", note: "North coast" },
  { id: "morytania", note: "Swamp border" },
  { id: "tirannwn", note: "Elven crystal" },
  { id: "kandarin", note: "Western kingdoms" },
  { id: "anachronia", note: "Dinosaur isle" },
  { id: "forinthry", note: "Fort rebuild" },
  { id: "havenhythe", note: "League dock" },
] as const;

const COMBAT_ROWS = [
  {
    ability: "Greater Barge (demo)",
    style: "Melee",
    kind: "Basic",
    ad: "—",
    dmg: "—",
    note: "Bar slot · math empty until core bind",
  },
  {
    ability: "Assault (demo)",
    style: "Melee",
    kind: "Threshold",
    ad: "—",
    dmg: "—",
    note: "Channel placeholder",
  },
  {
    ability: "Destroy (demo)",
    style: "Melee",
    kind: "Threshold",
    ad: "—",
    dmg: "—",
    note: "Channel placeholder",
  },
  {
    ability: "Berserk (demo)",
    style: "Melee",
    kind: "Ultimate",
    ad: "—",
    dmg: "—",
    note: "Ultimate placeholder",
  },
  {
    ability: "Meteor Strike (demo)",
    style: "Melee",
    kind: "Threshold",
    ad: "—",
    dmg: "—",
    note: "Threshold placeholder",
  },
  {
    ability: "Snap Shot (demo)",
    style: "Ranged",
    kind: "Basic",
    ad: "—",
    dmg: "—",
    note: "Style catalog only",
  },
  {
    ability: "Asphyxiate (demo)",
    style: "Magic",
    kind: "Threshold",
    ad: "—",
    dmg: "—",
    note: "Style catalog only",
  },
] as const;

const TARGET_FIELDS = [
  { label: "Defence", value: "—" },
  { label: "Affinity", value: "—" },
  { label: "Size", value: "1×1" },
  { label: "HP %", value: "100" },
  { label: "Vulnerability", value: "Off" },
  { label: "Poisonable", value: "Yes" },
] as const;

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <GameIcon src={regionCrestPath(id)} size={size} className="shrink-0" alt="" />
  );
}

function CrystalNav({
  active,
  onChange,
}: {
  active: NavId;
  onChange: (id: NavId) => void;
}) {
  return (
    <header
      className="flex flex-wrap items-center gap-3 border-b border-stone-750 px-3 py-2"
      style={{ background: "var(--color-stone-900)" }}
    >
      <span className="inline-flex items-center gap-2">
        <span className="crystal-gem-mark" aria-hidden="true" />
        <span
          className="font-display text-[13px] tracking-[0.18em]"
          style={{ color: "var(--color-gold-400)" }}
        >
          EQUILIBRIUM
        </span>
      </span>
      <nav aria-label="Primary">
        <ul className="m-0 flex list-none flex-wrap gap-1 p-0 text-[13px]">
          {NAV.map((label) => {
            const on = label === active;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => onChange(label)}
                  className="crystal-nav-btn bg-transparent px-2 py-1"
                  style={{
                    fontWeight: on ? 600 : 400,
                    color: on ? "var(--color-gem-400)" : "var(--color-parch-100)",
                    border: "none",
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
        className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em]"
        style={{ color: "var(--color-parch-400)" }}
      >
        Fixture · not live data
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
      style={{ background: "var(--color-stone-900)" }}
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

function KeyFigure({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="panel--facet">
      <div
        className="panel-body"
        style={{ padding: compact ? "0.5rem 0.65rem" : "0.625rem 0.75rem" }}
      >
        <p className="m-0 text-[12px]" style={{ color: "var(--color-parch-300)" }}>
          {label}
        </p>
        <p className={`stat-key mt-1 mb-0 ${compact ? "stat-key--sm" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function KeyartBand({ caption }: { caption: string }) {
  return (
    <div className="crystal-keyart">
      {/* Official 2026 keyart — crystal mountain crop, not a CTA funnel */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/keyart-2026.jpg" alt="" />
      <span className="crystal-keyart-caption">{caption}</span>
    </div>
  );
}

function OverviewPane({
  pickedIds,
}: {
  pickedIds: Set<string>;
}) {
  const slots = ALL_REGION_IDS.filter((id) => pickedIds.has(id));
  const empties = Math.max(0, 3 - slots.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <KeyartBand caption="2026 keyart · crystal peak crop" />

      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="space-y-3">
          <div className="panel--facet">
            <div className="panel-head">Region loadout</div>
            <div className="panel-body">
              <div className="crystal-loadout" aria-label="Picked regions">
                {slots.map((id) => (
                  <div key={id} className="crystal-loadout-cell">
                    <Crest id={id} size={18} />
                    <span className="font-medium">{REGION_NAMES[id]}</span>
                  </div>
                ))}
                {Array.from({ length: empties }, (_, i) => (
                  <div key={`empty-${i}`} className="crystal-loadout-cell is-empty">
                    Open slot
                  </div>
                ))}
              </div>
              <p
                className="mt-2 mb-0 font-mono text-[12px]"
                style={{ color: "var(--color-gem-400)" }}
                aria-live="polite"
              >
                {pickedIds.size}/3
              </p>
            </div>
          </div>

          <div className="panel--facet">
            <div className="panel-head">Companion snapshot</div>
            <div className="panel-body">
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--color-parch-300)" }}>Catalog</dt>
                <dd className="m-0" style={{ color: "var(--color-parch-50)" }}>
                  {FIXTURE.length} fixture rows · labeled demo
                </dd>
                <dt style={{ color: "var(--color-parch-300)" }}>Blessings</dt>
                <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                  Unrevealed · empty until official
                </dd>
                <dt style={{ color: "var(--color-parch-300)" }}>Planning</dt>
                <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                  Ironman / self-sufficient
                </dd>
                <dt style={{ color: "var(--color-parch-300)" }}>Tasks</dt>
                <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                  Catalyst stand-in · provisional
                </dd>
              </dl>
              <p
                className="mt-3 mb-0 text-[11px]"
                style={{ color: "var(--color-parch-400)" }}
              >
                sources? · verified fixture only
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <KeyFigure label="Fixture rows" value={String(FIXTURE.length)} compact />
          <KeyFigure label="Picks used" value={`${pickedIds.size}/3`} compact />
          <KeyFigure label="Regions" value="11" compact />
          <KeyFigure label="Task bands" value="4" compact />
        </div>
      </div>
    </div>
  );
}

/** Signature route: facet track index + dense catalog + cut inspector. */
function DataPane() {
  const [tab, setTab] = useState<string>(DATA_TABS[0]);
  const [track, setTrack] = useState<string>("All");
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");

  const trackCounts = useMemo(() => {
    const counts: Record<string, number> = { All: FIXTURE.length };
    for (const t of TRACKS) {
      if (t === "All") continue;
      counts[t] = FIXTURE.filter((r) => r.track === t).length;
    }
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FIXTURE.filter((r) => {
      if (track !== "All" && r.track !== track) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q) ||
        r.track.toLowerCase().includes(q)
      );
    });
  }, [query, track]);

  const selected = filtered[row] ?? filtered[0];

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

      {/* Signature facet index — track chips, not folder tree */}
      <div
        className="flex flex-wrap items-center gap-1.5 border-b border-stone-750 px-3 py-2"
        style={{ background: "var(--color-stone-900)" }}
        role="tablist"
        aria-label="Track facets"
      >
        <span
          className="mr-1 text-[11px] uppercase tracking-[0.08em]"
          style={{ color: "var(--color-parch-400)" }}
        >
          Facets
        </span>
        {TRACKS.map((t) => {
          const on = t === track;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              className={`crystal-facet-chip ${on ? "is-on" : ""}`}
              onClick={() => {
                setTrack(t);
                setRow(0);
              }}
            >
              <span>{t}</span>
              <span className="pip">{trackCounts[t] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px]">
        <section
          className="flex min-h-0 flex-col"
          style={{ background: "var(--color-stone-800)" }}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-stone-750 px-3 py-2">
            <h2
              className="m-0 text-[15px] font-medium"
              style={{ color: "var(--color-parch-50)" }}
            >
              {tab} · {track === "All" ? "Full catalog" : track}
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
                className="field-inset w-44 px-2 py-1 text-[15px]"
                placeholder="Name, region, kind"
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
                  <th scope="col">Track</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="secondary">
                      No rows match facet / filter
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
                          <span className="tag tag-fixture">{r.status}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside
          className="flex min-h-0 flex-col overflow-y-auto border-l border-stone-750"
          style={{ background: "var(--color-stone-850)" }}
          aria-label="Inspector"
        >
          {selected ? (
            <>
              <div className="crystal-cut-head">
                <Crest id={selected.regionId} size={28} />
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
                    {selected.track} · {selected.kind}
                  </p>
                </div>
              </div>
              <div className="space-y-2 p-3">
                <KeyFigure
                  label="Fixture quantity"
                  value={String(selected.qty)}
                  compact
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
                    <span className="tag tag-fixture">{selected.status}</span>
                  </dd>
                </dl>
                <p
                  className="mb-0 text-[11px] leading-4"
                  style={{ color: "var(--color-parch-300)" }}
                >
                  sources? · verified fixture only — not live league data
                </p>
              </div>
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
  pickedIds,
  onToggle,
  onClear,
}: {
  pickedIds: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [seg, setSeg] = useState<string>(BUILD_SEGS[0]);
  const picked = pickedIds.size;
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
            {ALL_REGION_IDS.map((id) => {
              const isPicked = pickedIds.has(id);
              const disabled = !isPicked && atCap;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`crystal-pick panel--facet flex w-full items-center gap-2 px-2.5 py-2 text-left text-[13px] ${
                      isPicked ? "is-picked" : ""
                    }`}
                    style={{
                      color: isPicked
                        ? "var(--color-gem-300)"
                        : "var(--color-parch-100)",
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.55 : 1,
                    }}
                    aria-disabled={disabled || undefined}
                    aria-pressed={isPicked}
                    onClick={() => {
                      if (disabled) return;
                      onToggle(id);
                    }}
                  >
                    <Crest id={id} size={18} />
                    <span className="font-medium" style={{ color: "inherit" }}>
                      {REGION_NAMES[id]}
                    </span>
                    {isPicked ? (
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
          <div className="panel--facet">
            <div className="panel-head">{seg}</div>
            <div className="panel-body text-[15px]">
              <p className="m-0" style={{ color: "var(--color-parch-50)" }}>
                Unrevealed. Empty records until an official source exists —
                never invent tier numbers to fill a stub.
              </p>
              <p
                className="mt-2 mb-0 text-[12px]"
                style={{ color: "var(--color-parch-300)" }}
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

/** Map owns pick toggle with 4th aria-disabled — planning board, not mood-only. */
function MapPane({
  pickedIds,
  focusId,
  onFocus,
  onToggle,
}: {
  pickedIds: Set<string>;
  focusId: string | null;
  onFocus: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const focus = focusId ?? ALL_REGION_IDS[0];
  const meta = MAP_SLABS.find((s) => s.id === focus)!;
  const atCap = pickedIds.size >= 3;
  const focusPicked = pickedIds.has(focus);
  const focusDisabled = !focusPicked && atCap;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <KeyartBand caption="Wartable mood · crystal horizon" />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[minmax(0,1fr)_280px]">
        <section className="p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2
              className="m-0 font-display text-[15px] tracking-[0.08em]"
              style={{ color: "var(--color-gold-400)" }}
            >
              Region slabs
            </h2>
            <span
              className="font-mono text-[12px]"
              style={{ color: "var(--color-gem-400)" }}
              aria-live="polite"
            >
              {pickedIds.size}/3
            </span>
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-4">
            {MAP_SLABS.map((slab) => {
              const on = slab.id === focus;
              const picked = pickedIds.has(slab.id);
              const disabled = !picked && atCap;
              return (
                <li key={slab.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onFocus(slab.id);
                      if (disabled && !picked) return;
                      onToggle(slab.id);
                    }}
                    className={`crystal-pick panel--facet flex w-full flex-col items-start gap-1.5 px-2.5 py-2 text-left ${
                      picked ? "is-picked" : ""
                    }`}
                    style={{
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.55 : 1,
                      boxShadow: on
                        ? "inset 0 0 0 1px var(--color-gem-500), inset 0 1px 0 var(--color-stone-carve)"
                        : undefined,
                    }}
                    aria-pressed={picked}
                    aria-disabled={disabled || undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Crest id={slab.id} size={20} />
                      <span
                        className="text-[13px] font-medium"
                        style={{
                          color: on || picked
                            ? "var(--color-gem-300)"
                            : "var(--color-parch-50)",
                        }}
                      >
                        {REGION_NAMES[slab.id]}
                      </span>
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--color-parch-300)" }}
                    >
                      {slab.note}
                      {picked ? " · pick" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p
            className="mt-3 mb-0 text-[11px]"
            style={{ color: "var(--color-parch-400)" }}
          >
            Click toggles pick (cap 3). 3D map stays fenced in production app/map.
          </p>
        </section>
        <aside
          className="border-t border-stone-750 md:border-t-0 md:border-l"
          style={{ background: "var(--color-stone-850)" }}
          aria-live="polite"
        >
          <div className="crystal-cut-head">
            <Crest id={focus} size={28} />
            <div>
              <h3
                className="m-0 font-display text-[14px] tracking-[0.06em]"
                style={{ color: "var(--color-gold-400)" }}
              >
                {REGION_NAMES[focus as (typeof ALL_REGION_IDS)[number]]}
              </h3>
              <p
                className="mt-1 mb-0 text-[12px]"
                style={{ color: "var(--color-parch-300)" }}
              >
                {meta.note}
              </p>
            </div>
          </div>
          <div className="p-3">
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              <dt style={{ color: "var(--color-parch-300)" }}>Pick state</dt>
              <dd className="m-0" style={{ color: "var(--color-parch-50)" }}>
                {focusPicked ? "In loadout" : "Not picked"}
              </dd>
              <dt style={{ color: "var(--color-parch-300)" }}>Sources</dt>
              <dd className="m-0" style={{ color: "var(--color-parch-100)" }}>
                sources? · verified fixture only
              </dd>
            </dl>
            <button
              type="button"
              className="mt-3 w-full px-2.5 py-1.5 text-[12px]"
              style={{
                border: "1px solid var(--color-gem-600)",
                background: "var(--color-stone-800)",
                color: focusDisabled
                  ? "var(--color-parch-400)"
                  : "var(--color-gem-300)",
                cursor: focusDisabled ? "not-allowed" : "pointer",
                opacity: focusDisabled ? 0.55 : 1,
              }}
              aria-disabled={focusDisabled || undefined}
              disabled={focusDisabled}
              onClick={() => {
                if (focusDisabled) return;
                onToggle(focus);
              }}
            >
              {focusPicked ? "Remove pick" : "Add pick"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function TasksPane() {
  const [tier, setTier] = useState<string>("All");
  const [done, setDone] = useState<Set<string>>(() => new Set(["t1"]));
  const [selId, setSelId] = useState("t1");

  const selected =
    TASK_FIXTURE.find((t) => t.id === selId) ?? TASK_FIXTURE[0];
  const doneCount = TASK_FIXTURE.filter((t) => done.has(t.id)).length;
  const ptsDone = TASK_FIXTURE.filter((t) => done.has(t.id)).reduce(
    (s, t) => s + t.pts,
    0,
  );
  const ptsTotal = TASK_FIXTURE.reduce((s, t) => s + t.pts, 0);

  const bands = useMemo(() => {
    const source = tier === "All" ? TASK_TIERS : ([tier] as readonly string[]);
    return source.map((t) => ({
      tier: t,
      items: TASK_FIXTURE.filter((r) => r.tier === t),
    }));
  }, [tier]);

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
      <div
        className="flex flex-wrap items-center gap-2 border-b border-stone-750 px-3 py-2"
        style={{ background: "var(--color-stone-900)" }}
      >
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--color-parch-50)" }}
        >
          Tasks
        </h2>
        <span
          className="font-mono text-[12px]"
          style={{ color: "var(--color-gem-400)" }}
          aria-live="polite"
        >
          {doneCount}/{TASK_FIXTURE.length} · {ptsDone}/{ptsTotal} pts
        </span>
        <div
          role="tablist"
          aria-label="Task tier"
          className="ml-auto flex flex-wrap gap-1"
        >
          {TASK_FILTERS.map((f) => {
            const on = f === tier;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTier(f)}
                className="px-2 py-1 text-[12px]"
                style={{
                  border: on
                    ? "1px solid var(--color-gem-500)"
                    : "1px solid var(--color-stone-750)",
                  background: on ? "var(--color-stone-850)" : "transparent",
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

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px]">
        <div
          className="min-h-0 overflow-auto"
          style={{ background: "var(--color-stone-800)" }}
        >
          {bands.map((band) => {
            if (band.items.length === 0) return null;
            const bandDone = band.items.filter((t) => done.has(t.id)).length;
            return (
              <div key={band.tier}>
                <div className="crystal-tier-band">
                  <span>{band.tier}</span>
                  <span className="pip">
                    {bandDone}/{band.items.length}
                  </span>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Done</th>
                      <th scope="col">Task</th>
                      <th scope="col">Region</th>
                      <th scope="col">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {band.items.map((t) => {
                      const on = t.id === selId;
                      const isDone = done.has(t.id);
                      return (
                        <tr
                          key={t.id}
                          className={`${on ? "is-selected" : ""} ${isDone ? "is-done" : ""}`}
                          onClick={() => setSelId(t.id)}
                          tabIndex={0}
                          style={{ cursor: "pointer" }}
                          aria-selected={on}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelId(t.id);
                            }
                          }}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={isDone}
                              aria-label={`Mark ${t.name} done`}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleDone(t.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="font-medium">{t.name}</td>
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
            );
          })}
        </div>
        <aside
          className="border-t border-stone-750 md:border-t-0 md:border-l"
          style={{ background: "var(--color-stone-850)" }}
          aria-label="Task detail"
        >
          {selected ? (
            <>
              <div className="crystal-cut-head">
                <Crest id={selected.regionId} size={24} />
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
                    {selected.tier} band
                  </p>
                </div>
              </div>
              <div className="p-3">
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <KeyFigure
                    label="Points"
                    value={String(selected.pts)}
                    compact
                  />
                  <KeyFigure
                    label="Done"
                    value={done.has(selected.id) ? "Yes" : "No"}
                    compact
                  />
                </div>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                  <dt style={{ color: "var(--color-parch-300)" }}>Region</dt>
                  <dd className="m-0" style={{ color: "var(--color-parch-50)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      <Crest id={selected.regionId} size={14} />
                      {selected.region}
                    </span>
                  </dd>
                  <dt style={{ color: "var(--color-parch-300)" }}>Status</dt>
                  <dd className="m-0">
                    <span className="tag tag-fixture">Fixture</span>
                  </dd>
                </dl>
                <p
                  className="mt-3 mb-0 text-[11px]"
                  style={{ color: "var(--color-parch-300)" }}
                >
                  Equilibrium task list unrevealed — Catalyst stand-in, marked
                  provisional.
                </p>
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function CombatPane() {
  const [seg, setSeg] = useState<string>(COMBAT_SEGS[0]);
  const [style, setStyle] = useState<string>("All");
  const [row, setRow] = useState(0);

  const rows = useMemo(() => {
    if (style === "All") return [...COMBAT_ROWS];
    return COMBAT_ROWS.filter((r) => r.style === style);
  }, [style]);

  const selected = rows[row] ?? rows[0];
  const barSlots = rows.slice(0, 5);

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
        style={{ background: "var(--color-stone-900)" }}
      >
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--color-parch-50)" }}
        >
          {seg} · ability surface
        </h2>
        <span
          className="font-mono text-[11px]"
          style={{ color: "var(--color-parch-300)" }}
        >
          Fixture · generic target · no DPL
        </span>
        <div
          role="tablist"
          aria-label="Combat style"
          className="ml-auto flex flex-wrap gap-1"
        >
          {STYLE_CHIPS.map((s) => {
            const on = s === style;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setStyle(s);
                  setRow(0);
                }}
                className="px-2 py-1 text-[12px]"
                style={{
                  border: on
                    ? "1px solid var(--color-gem-500)"
                    : "1px solid var(--color-stone-750)",
                  background: on ? "var(--color-stone-850)" : "transparent",
                  color: on ? "var(--color-gem-300)" : "var(--color-parch-100)",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px]">
        <section className="flex min-h-0 flex-col">
          {/* Facet ability bar — structure without fake math */}
          <div
            className="grid grid-cols-2 gap-1.5 border-b border-stone-750 p-2 sm:grid-cols-5"
            style={{ background: "var(--color-stone-900)" }}
            aria-label="Ability bar facets"
          >
            {barSlots.map((r, i) => {
              const idx = rows.findIndex((x) => x.ability === r.ability);
              const on = idx === row;
              return (
                <button
                  key={r.ability}
                  type="button"
                  className={`crystal-bar-slot ${on ? "is-on" : ""}`}
                  onClick={() => setRow(idx < 0 ? 0 : idx)}
                  aria-pressed={on}
                >
                  <span className="slot-idx">Slot {i + 1}</span>
                  <span className="text-[12px] font-medium leading-tight">
                    {r.ability.replace(" (demo)", "")}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{
                      color: on
                        ? "var(--color-gem-400)"
                        : "var(--color-parch-400)",
                    }}
                  >
                    {r.kind} · {r.style}
                  </span>
                </button>
              );
            })}
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
                  <th scope="col">Adren</th>
                  <th scope="col">Dmg</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const on = i === row;
                  return (
                    <tr
                      key={r.ability}
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
                      <td className="font-medium">{r.ability}</td>
                      <td className="secondary">{r.style}</td>
                      <td className="secondary">{r.kind}</td>
                      <td className="font-mono">{r.ad}</td>
                      <td className="font-mono">{r.dmg}</td>
                      <td className="secondary">{r.note}</td>
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
              <div className="crystal-cut-head">
                <span className="crystal-gem-mark mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <h3
                    className="m-0 font-display text-[14px] tracking-[0.06em]"
                    style={{ color: "var(--color-gold-400)" }}
                  >
                    {selected.ability}
                  </h3>
                  <p
                    className="mt-1 mb-0 text-[12px]"
                    style={{ color: "var(--color-parch-300)" }}
                  >
                    {selected.style} · {selected.kind}
                  </p>
                </div>
              </div>
              <div className="space-y-2 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <KeyFigure label="Adren" value={selected.ad} compact />
                  <KeyFigure label="Dmg" value={selected.dmg} compact />
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
                            style={{ color: "var(--color-parch-50)" }}
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
                  {selected.note}. Layout density only — no invented DPL.
                </p>
                <p
                  className="mb-0 text-[11px]"
                  style={{ color: "var(--color-parch-300)" }}
                >
                  No boss phases · no kill-time · generic target law
                </p>
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export function DeltaPreview() {
  const [nav, setNav] = useState<NavId>("Data");
  const [pickedIds, setPickedIds] = useState<Set<string>>(
    () => new Set(["misthalin", "asgarnia", "fremennik"]),
  );
  const [mapFocus, setMapFocus] = useState<string | null>("misthalin");

  const togglePick = (id: string) => {
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
    <div
      className="flex h-full min-h-[70vh] flex-col"
      style={{
        background: "var(--color-stone-950)",
        color: "var(--color-parch-50)",
      }}
    >
      <CrystalNav active={nav} onChange={setNav} />
      <div className="crystal-facet-line" aria-hidden="true" />

      {nav === "Overview" ? <OverviewPane pickedIds={pickedIds} /> : null}
      {nav === "Data" ? <DataPane /> : null}
      {nav === "Build" ? (
        <BuildPane
          pickedIds={pickedIds}
          onToggle={togglePick}
          onClear={clearPicks}
        />
      ) : null}
      {nav === "Map" ? (
        <MapPane
          pickedIds={pickedIds}
          focusId={mapFocus}
          onFocus={setMapFocus}
          onToggle={togglePick}
        />
      ) : null}
      {nav === "Tasks" ? <TasksPane /> : null}
      {nav === "Combat" ? <CombatPane /> : null}
    </div>
  );
}
