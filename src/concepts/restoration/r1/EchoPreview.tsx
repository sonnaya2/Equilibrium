"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath } from "@/lib/gameArt";

/**
 * Team Echo · EDITORIAL — Round 3 interactive preview
 * Art-stage keyart plate + magazine masthead + wiki-dense workbench.
 * Signature: full 11-crest gazetteer Map (not sample pack / not Alpha pick grid).
 * Tokens: parent .restoration-skin--echo (echo.css). Fixture data only.
 */

const NAV = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;
type NavId = (typeof NAV)[number];

const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems"] as const;
const BUILD_SEGS = ["Regions", "Relics", "Blessings"] as const;

const TREE = [
  { id: "regions", label: "Regions", crest: "misthalin" as string | null },
  { id: "skills", label: "Skills", crest: null },
  { id: "tracks", label: "Tracks", crest: null },
  { id: "sources", label: "Sources", crest: null },
] as const;

/** Fixture catalog — labeled demo rows, not published league facts. */
const FIXTURE = [
  {
    name: "Varrock plate trail",
    region: "Misthalin",
    regionId: "misthalin",
    kind: "Region unlock",
    track: "Combat",
    status: "Fixture",
    qty: 4,
  },
  {
    name: "Karamja fruit press",
    region: "Karamja",
    regionId: "karamja",
    kind: "Skilling note",
    track: "Gather",
    status: "Fixture",
    qty: 7,
  },
  {
    name: "Falador fort ledger",
    region: "Asgarnia",
    regionId: "asgarnia",
    kind: "Region unlock",
    track: "Support",
    status: "Fixture",
    qty: 11,
  },
  {
    name: "Menaphos dust chain",
    region: "Desert",
    regionId: "desert",
    kind: "Skilling note",
    track: "Artisan",
    status: "Fixture",
    qty: 9,
  },
  {
    name: "Rellekka pier haul",
    region: "Fremennik",
    regionId: "fremennik",
    kind: "Region unlock",
    track: "Gather",
    status: "Fixture",
    qty: 14,
  },
  {
    name: "Canifis crypt list",
    region: "Morytania",
    regionId: "morytania",
    kind: "Combat note",
    track: "Combat",
    status: "Fixture",
    qty: 6,
  },
  {
    name: "Prif crystal dust",
    region: "Tirannwn",
    regionId: "tirannwn",
    kind: "Skilling note",
    track: "Artisan",
    status: "Fixture",
    qty: 18,
  },
  {
    name: "Ardougne market run",
    region: "Kandarin",
    regionId: "kandarin",
    kind: "Region unlock",
    track: "Support",
    status: "Fixture",
    qty: 12,
  },
  {
    name: "Anachronia dig cache",
    region: "Anachronia",
    regionId: "anachronia",
    kind: "Archaeology",
    track: "Gather",
    status: "Fixture",
    qty: 5,
  },
  {
    name: "Fort courtyard slate",
    region: "Forinthry",
    regionId: "forinthry",
    kind: "Region unlock",
    track: "Support",
    status: "Fixture",
    qty: 8,
  },
  {
    name: "Havenhythe shore net",
    region: "Havenhythe",
    regionId: "havenhythe",
    kind: "Skilling note",
    track: "Gather",
    status: "Fixture",
    qty: 3,
  },
] as const;

type FixtureRow = (typeof FIXTURE)[number];

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

/** Full region gazetteer — all 11 crests. Fixture notes only. */
const MAP_REGIONS = [
  {
    id: "misthalin",
    name: "Misthalin",
    note: "Starter plain · Varrock / Lumbridge ledger",
    plate: "Starter",
  },
  {
    id: "havenhythe",
    name: "Havenhythe",
    note: "Shore net · sister starting plate",
    plate: "Starter",
  },
  {
    id: "asgarnia",
    name: "Asgarnia",
    note: "Falador fort · white knight slate",
    plate: "Unlock",
  },
  {
    id: "karamja",
    name: "Karamja",
    note: "Island heat · fruit / TzHaar ledger",
    plate: "Early",
  },
  {
    id: "desert",
    name: "Desert",
    note: "Menaphos plate · heat stage",
    plate: "Unlock",
  },
  {
    id: "fremennik",
    name: "Fremennik",
    note: "Rellekka pier · northern haul",
    plate: "Unlock",
  },
  {
    id: "morytania",
    name: "Morytania",
    note: "Canifis crypt · swamp edge",
    plate: "Unlock",
  },
  {
    id: "tirannwn",
    name: "Tirannwn",
    note: "Crystal canopy · dust chain",
    plate: "Unlock",
  },
  {
    id: "kandarin",
    name: "Kandarin",
    note: "Ardougne market · seers plate",
    plate: "Unlock",
  },
  {
    id: "anachronia",
    name: "Anachronia",
    note: "Dig isle · archaeology cache",
    plate: "Unlock",
  },
  {
    id: "forinthry",
    name: "Forinthry",
    note: "Fort courtyard · wartable slab",
    plate: "Unlock",
  },
] as const;

const TASK_BANDS = ["All", "Easy", "Medium", "Hard", "Elite"] as const;

const TASK_FIXTURES = [
  {
    id: "t1",
    title: "Clear the eastern fence",
    region: "Misthalin",
    regionId: "misthalin",
    pts: 10,
    band: "Easy",
  },
  {
    id: "t2",
    title: "Smoke a fruit batch",
    region: "Karamja",
    regionId: "karamja",
    pts: 25,
    band: "Easy",
  },
  {
    id: "t3",
    title: "Read the fort slate",
    region: "Forinthry",
    regionId: "forinthry",
    pts: 40,
    band: "Medium",
  },
  {
    id: "t4",
    title: "Walk the crystal dust",
    region: "Tirannwn",
    regionId: "tirannwn",
    pts: 60,
    band: "Medium",
  },
  {
    id: "t5",
    title: "Haul the pier nets",
    region: "Fremennik",
    regionId: "fremennik",
    pts: 80,
    band: "Hard",
  },
  {
    id: "t6",
    title: "Seal the crypt list",
    region: "Morytania",
    regionId: "morytania",
    pts: 100,
    band: "Hard",
  },
  {
    id: "t7",
    title: "Plate the Menaphos dust",
    region: "Desert",
    regionId: "desert",
    pts: 150,
    band: "Elite",
  },
  {
    id: "t8",
    title: "Log the dig cache",
    region: "Anachronia",
    regionId: "anachronia",
    pts: 200,
    band: "Elite",
  },
] as const;

const COMBAT_STYLES = [
  "All",
  "Melee",
  "Magic",
  "Ranged",
  "Necromancy",
  "Defence",
] as const;

const COMBAT_SEGS = ["Quick", "Setup", "Analysis", "Rotation"] as const;

const COMBAT_ROWS = [
  {
    ability: "Greater Barge",
    style: "Melee",
    band: "Threshold",
    cd: "20.4s",
    role: "Gap close",
  },
  {
    ability: "Assault",
    style: "Melee",
    band: "Threshold",
    cd: "30.0s",
    role: "Channel",
  },
  {
    ability: "Sunshine",
    style: "Magic",
    band: "Ultimate",
    cd: "60.0s",
    role: "DPS window",
  },
  {
    ability: "Tsunami",
    style: "Magic",
    band: "Threshold",
    cd: "30.0s",
    role: "AoE hit",
  },
  {
    ability: "Death's Swiftness",
    style: "Ranged",
    band: "Ultimate",
    cd: "60.0s",
    role: "DPS window",
  },
  {
    ability: "Snap Shot",
    style: "Ranged",
    band: "Threshold",
    cd: "20.4s",
    role: "Burst",
  },
  {
    ability: "Living Death",
    style: "Necromancy",
    band: "Ultimate",
    cd: "90.0s",
    role: "DPS window",
  },
  {
    ability: "Volley of Souls",
    style: "Necromancy",
    band: "Threshold",
    cd: "15.0s",
    role: "Spend",
  },
  {
    ability: "Resonance",
    style: "Defence",
    band: "Basic",
    cd: "24.0s",
    role: "Heal",
  },
  {
    ability: "Reflect",
    style: "Defence",
    band: "Threshold",
    cd: "30.0s",
    role: "Mitigate",
  },
] as const;

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <GameIcon src={regionCrestPath(id)} size={size} className="shrink-0" alt="" />
  );
}

function StatusChips({
  picks,
  rows,
}: {
  picks: number;
  rows: number;
}) {
  return (
    <div className="echo-status-row" aria-label="Status">
      <span className="echo-chip">
        Picks <span className="echo-chip__val">{picks}/3</span>
      </span>
      <span className="echo-chip">
        Catalog <span className="echo-chip__val">{rows}</span>
      </span>
      <span className="echo-chip echo-chip--quiet">
        Blessings <span className="echo-chip__val">empty</span>
      </span>
      <span className="echo-chip echo-chip--quiet">
        Mode <span className="echo-chip__val">ironman</span>
      </span>
    </div>
  );
}

function ArtStage({ picks }: { picks: number }) {
  return (
    <div className="echo-art-stage">
      {/* Official 2026 keyart — atmosphere plate, not a CTA funnel */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="echo-art-stage__img"
        src="/brand/keyart-2026.jpg"
        alt=""
      />
      <div className="echo-art-stage__chrome">
        <p className="echo-brand">EQUILIBRIUM</p>
        <p className="echo-kicker">Leagues II · companion workbench</p>
        <StatusChips picks={picks} rows={FIXTURE.length} />
      </div>
    </div>
  );
}

function EchoNav({
  active,
  onChange,
}: {
  active: NavId;
  onChange: (id: NavId) => void;
}) {
  return (
    <header className="echo-mast">
      <nav aria-label="Primary">
        <ul>
          {NAV.map((label) => {
            const on = label === active;
            return (
              <li key={label}>
                <button
                  type="button"
                  className={`echo-nav-link${on ? " is-active" : ""}`}
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
      <span className="echo-mast__meta">sources · fixture catalog</span>
    </header>
  );
}

function KeyFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="echo-panel echo-panel--carved">
      <div className="echo-panel__body" style={{ padding: "0.55rem 0.7rem" }}>
        <p
          className="m-0 text-[12px]"
          style={{ color: "var(--echo-parch-300)" }}
        >
          {label}
        </p>
        <p className="echo-stat-key mt-1 mb-0">{value}</p>
      </div>
    </div>
  );
}

function OverviewPane({
  picks,
  pickIds,
}: {
  picks: number;
  pickIds: readonly string[];
}) {
  const pickNames = ALL_REGIONS.filter((r) => pickIds.includes(r.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_11rem]">
        <div className="echo-panel echo-panel--carved">
          <div className="echo-panel__head">Companion ledger</div>
          <div className="echo-panel__body space-y-2 text-[15px]">
            <p className="m-0" style={{ color: "var(--echo-parch-50)" }}>
              Region picks, fixture catalog, and empty blessings until official
              reveal. Work starts on Map, Data, and Build under the plate.
            </p>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              <dt style={{ color: "var(--echo-parch-300)" }}>Region picks</dt>
              <dd
                className="m-0 font-mono"
                style={{ color: "var(--echo-parch-50)" }}
              >
                {picks}/3
              </dd>
              <dt style={{ color: "var(--echo-parch-300)" }}>Blessings</dt>
              <dd className="m-0" style={{ color: "var(--echo-parch-100)" }}>
                Unrevealed · empty records
              </dd>
              <dt style={{ color: "var(--echo-parch-300)" }}>Catalog</dt>
              <dd className="m-0" style={{ color: "var(--echo-parch-100)" }}>
                {FIXTURE.length} fixture rows · labeled demo
              </dd>
              <dt style={{ color: "var(--echo-parch-300)" }}>Planning</dt>
              <dd className="m-0" style={{ color: "var(--echo-parch-100)" }}>
                Ironman / self-sufficient
              </dd>
            </dl>
            <p className="echo-sources">
              sources? · verified fixture only — not live league data
            </p>
          </div>
        </div>

        <div className="echo-panel echo-panel--carved">
          <div className="echo-panel__head">Loadout · picks</div>
          <div className="echo-panel__body">
            {pickNames.length === 0 ? (
              <p
                className="m-0 text-[15px]"
                style={{ color: "var(--echo-parch-300)" }}
              >
                No regions picked. Open Build or Map to fill the three slots.
              </p>
            ) : (
              <ul className="echo-loadout m-0 list-none p-0">
                {pickNames.map((r) => (
                  <li key={r.id} className="echo-loadout__row">
                    <Crest id={r.id} size={20} />
                    <span className="font-medium">{r.name}</span>
                    <span className="echo-tag">pick</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="echo-sources">
              sources? · shared plan state · cap 3
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2">
          <KeyFigure label="Fixture rows" value={String(FIXTURE.length)} />
          <KeyFigure label="Picks used" value={`${picks}/3`} />
          <KeyFigure label="Map crests" value={String(MAP_REGIONS.length)} />
          <KeyFigure label="Blessings" value="0" />
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...FIXTURE];
    return FIXTURE.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.kind.toLowerCase().includes(q) ||
        r.track.toLowerCase().includes(q),
    );
  }, [query]);

  const selected: FixtureRow | undefined = filtered[row] ?? filtered[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="echo-seg" role="tablist" aria-label="Data categories">
        {DATA_TABS.map((t) => {
          const on = t === tab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              className={`echo-seg__btn${on ? " is-active" : ""}`}
              onClick={() => {
                setTab(t);
                setRow(0);
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[168px_minmax(0,1fr)_248px]">
        <nav
          aria-label="Category tree"
          className="overflow-y-auto border-r"
          style={{
            background: "var(--echo-rail)",
            borderColor: "var(--echo-border)",
          }}
        >
          <p
            className="border-b px-2.5 py-1.5 text-[12px] font-medium"
            style={{
              borderColor: "var(--echo-border)",
              color: "var(--echo-parch-100)",
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
                    className={`echo-tree-btn${on ? " is-active" : ""}`}
                    onClick={() => setLeaf(item.id)}
                  >
                    {item.crest ? <Crest id={item.crest} size={14} /> : null}
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section
          className="flex min-h-0 flex-col"
          style={{ background: "var(--echo-stage)" }}
        >
          <div className="echo-toolbar">
            <h2
              className="m-0 text-[15px] font-medium"
              style={{ color: "var(--echo-parch-50)" }}
            >
              {tab} · {TREE.find((t) => t.id === leaf)?.label ?? "Catalog"}
            </h2>
            <span
              className="font-mono text-[11px]"
              style={{ color: "var(--echo-parch-300)" }}
            >
              {filtered.length} rows
            </span>
            <label
              className="ml-auto flex items-center gap-2 text-[12px]"
              style={{ color: "var(--echo-parch-100)" }}
            >
              Filter
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setRow(0);
                }}
                className="echo-field w-44 px-2 py-1 text-[15px]"
                placeholder="Name, region, track"
                aria-label="Filter rows"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="echo-table">
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
                    <td
                      colSpan={6}
                      className="secondary"
                      style={{ padding: "1rem" }}
                    >
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
                        <td className="secondary">{r.track}</td>
                        <td className="font-mono">{r.qty}</td>
                        <td>
                          <span className="echo-tag">{r.status}</span>
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
          className="overflow-y-auto border-l"
          style={{
            background: "var(--echo-rail)",
            borderColor: "var(--echo-border)",
          }}
          aria-label="Inspector"
        >
          {selected ? (
            <div className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <Crest id={selected.regionId} size={22} />
                <h3
                  className="m-0 font-display text-[14px] tracking-[0.12em] uppercase"
                  style={{ color: "var(--echo-gold)" }}
                >
                  {selected.name}
                </h3>
              </div>
              <KeyFigure label="Fixture quantity" value={String(selected.qty)} />
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                <dt style={{ color: "var(--echo-parch-300)" }}>Region</dt>
                <dd className="m-0" style={{ color: "var(--echo-parch-50)" }}>
                  {selected.region}
                </dd>
                <dt style={{ color: "var(--echo-parch-300)" }}>Kind</dt>
                <dd className="m-0" style={{ color: "var(--echo-parch-100)" }}>
                  {selected.kind}
                </dd>
                <dt style={{ color: "var(--echo-parch-300)" }}>Track</dt>
                <dd className="m-0" style={{ color: "var(--echo-parch-100)" }}>
                  {selected.track}
                </dd>
                <dt style={{ color: "var(--echo-parch-300)" }}>Status</dt>
                <dd className="m-0">
                  <span className="echo-tag">{selected.status}</span>
                </dd>
              </dl>
              <p className="echo-sources">
                sources? · verified fixture only — not live league data
              </p>
            </div>
          ) : (
            <p
              className="p-3 text-[13px]"
              style={{ color: "var(--echo-parch-300)" }}
            >
              No row selected
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function BuildPane({
  picked,
  onToggle,
  onClear,
}: {
  picked: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [seg, setSeg] = useState<string>(BUILD_SEGS[0]);
  const count = picked.size;
  const atCap = count >= 3;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="echo-seg" role="tablist" aria-label="Build sections">
        {BUILD_SEGS.map((s) => {
          const on = s === seg;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={on}
              className={`echo-seg__btn${on ? " is-active" : ""}`}
              onClick={() => setSeg(s)}
            >
              {s}
            </button>
          );
        })}
      </div>

      <div className="echo-toolbar">
        <h2
          className="m-0 text-[15px] font-medium"
          style={{ color: "var(--echo-parch-50)" }}
        >
          {seg}
        </h2>
        {seg === "Regions" ? (
          <span
            className="font-mono text-[13px]"
            style={{ color: "var(--echo-gem)" }}
            aria-live="polite"
          >
            {count}/3
          </span>
        ) : null}
        <button
          type="button"
          className="ml-auto px-2.5 py-1 text-[12px]"
          style={{
            border: "1px solid var(--echo-border)",
            background: "var(--echo-rail)",
            color:
              count === 0 ? "var(--echo-parch-400)" : "var(--echo-parch-100)",
            cursor: count === 0 ? "not-allowed" : "pointer",
            opacity: count === 0 ? 0.6 : 1,
            boxShadow: "inset 0 1px 0 var(--echo-carve)",
          }}
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
              const isPicked = picked.has(r.id);
              const disabled = !isPicked && atCap;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`echo-region-card${isPicked ? " is-picked" : ""}${
                      disabled ? " is-disabled" : ""
                    }`}
                    onClick={() => {
                      if (disabled) return;
                      onToggle(r.id);
                    }}
                    aria-disabled={disabled || undefined}
                    aria-pressed={isPicked}
                  >
                    <Crest id={r.id} size={18} />
                    <span className="font-medium" style={{ color: "inherit" }}>
                      {r.name}
                    </span>
                    {isPicked ? (
                      <span
                        className="ml-auto font-mono text-[11px]"
                        style={{ color: "var(--echo-gem)" }}
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
          <div className="echo-panel echo-panel--carved">
            <div className="echo-panel__head">{seg}</div>
            <div className="echo-panel__body text-[15px]">
              <p className="m-0" style={{ color: "var(--echo-parch-50)" }}>
                Unrevealed. Empty records until an official source exists —
                never invent tier numbers to fill a stub.
              </p>
              <p
                className="mt-2 mb-0 text-[12px]"
                style={{ color: "var(--echo-parch-300)" }}
              >
                Fixture stance · ironman / self-sufficient planning only
              </p>
              <p className="echo-sources">
                sources? · verified empty envelope — not live league data
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MapPane({
  picked,
  onToggle,
}: {
  picked: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [focus, setFocus] = useState<string>(MAP_REGIONS[0].id);
  const active =
    MAP_REGIONS.find((r) => r.id === focus) ?? MAP_REGIONS[0];
  const isPicked = picked.has(active.id);
  const atCap = picked.size >= 3;
  const disabled = !isPicked && atCap;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px]">
      {/* Signature surface: magazine crest gazetteer — not tree·table, not pick-grid clone */}
      <section
        className="flex min-h-0 flex-col overflow-y-auto"
        style={{ background: "var(--echo-stage)" }}
        aria-label="Region gazetteer"
      >
        <div className="echo-toolbar">
          <h2
            className="m-0 font-display text-[13px] tracking-[0.12em] uppercase"
            style={{ color: "var(--echo-gold)" }}
          >
            Region gazetteer
          </h2>
          <span
            className="font-mono text-[12px]"
            style={{ color: "var(--echo-gem)" }}
            aria-live="polite"
          >
            {MAP_REGIONS.length} crests · {picked.size}/3 picks
          </span>
          <span
            className="ml-auto text-[11px]"
            style={{ color: "var(--echo-parch-300)" }}
          >
            Select to inspect · double-duty pick on card
          </span>
        </div>

        <div className="echo-gazetteer p-3">
          <ul className="echo-gazetteer__grid m-0 list-none p-0">
            {MAP_REGIONS.map((r) => {
              const on = r.id === focus;
              const inLoadout = picked.has(r.id);
              const tileDisabled = !inLoadout && atCap;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`echo-crest-tile${on ? " is-focus" : ""}${
                      inLoadout ? " is-picked" : ""
                    }${tileDisabled && !on ? " is-dim" : ""}`}
                    onClick={() => setFocus(r.id)}
                    onDoubleClick={() => {
                      if (tileDisabled && !inLoadout) return;
                      onToggle(r.id);
                    }}
                    aria-pressed={inLoadout}
                    aria-current={on ? "true" : undefined}
                  >
                    <span className="echo-crest-tile__badge" aria-hidden>
                      <Crest id={r.id} size={36} />
                    </span>
                    <span className="echo-crest-tile__name">{r.name}</span>
                    <span className="echo-crest-tile__meta">
                      {inLoadout ? "pick" : r.plate}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="echo-folio mx-3 mb-3">
          <div className="echo-folio__mark">
            <Crest id={active.id} size={48} />
          </div>
          <div className="echo-folio__copy">
            <p className="echo-folio__kicker m-0">{active.plate} plate</p>
            <h3 className="echo-folio__title m-0">{active.name}</h3>
            <p className="echo-folio__lede m-0">{active.note}</p>
          </div>
        </div>
      </section>

      <aside
        className="overflow-y-auto border-l p-3"
        style={{
          background: "var(--echo-rail)",
          borderColor: "var(--echo-border)",
        }}
        aria-label="Map inspector"
      >
        <div className="echo-panel echo-panel--carved">
          <div className="echo-panel__head">Folio · inspector</div>
          <div className="echo-panel__body">
            <div className="mb-2 flex items-center gap-2">
              <Crest id={active.id} size={28} />
              <h3
                className="m-0 font-display text-[14px] tracking-[0.12em] uppercase"
                style={{ color: "var(--echo-gold)" }}
              >
                {active.name}
              </h3>
            </div>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              <dt style={{ color: "var(--echo-parch-300)" }}>Crest</dt>
              <dd className="m-0" style={{ color: "var(--echo-parch-100)" }}>
                /game/regions/{active.id}.png
              </dd>
              <dt style={{ color: "var(--echo-parch-300)" }}>Plate</dt>
              <dd className="m-0" style={{ color: "var(--echo-parch-50)" }}>
                {active.plate}
              </dd>
              <dt style={{ color: "var(--echo-parch-300)" }}>Loadout</dt>
              <dd
                className="m-0 font-mono"
                style={{
                  color: isPicked
                    ? "var(--echo-gem)"
                    : "var(--echo-parch-100)",
                }}
              >
                {isPicked ? "in pick set" : "not picked"}
              </dd>
              <dt style={{ color: "var(--echo-parch-300)" }}>Canvas</dt>
              <dd className="m-0" style={{ color: "var(--echo-parch-100)" }}>
                Fenced · production Map only
              </dd>
            </dl>
            <p
              className="mt-2 mb-0 text-[15px]"
              style={{ color: "var(--echo-parch-50)" }}
            >
              {active.note}
            </p>
            <button
              type="button"
              className={`echo-region-card mt-3${isPicked ? " is-picked" : ""}${
                disabled ? " is-disabled" : ""
              }`}
              onClick={() => {
                if (disabled) return;
                onToggle(active.id);
              }}
              aria-disabled={disabled || undefined}
              aria-pressed={isPicked}
            >
              <Crest id={active.id} size={16} />
              <span className="font-medium">
                {isPicked ? "Remove pick" : disabled ? "Cap full" : "Add pick"}
              </span>
              <span
                className="ml-auto font-mono text-[11px]"
                style={{ color: "var(--echo-gem)" }}
              >
                {picked.size}/3
              </span>
            </button>
            <p className="echo-sources">
              sources? · all 11 crests from public/game · fixture notes only
            </p>
          </div>
        </div>
        <div className="mt-2">
          <KeyFigure
            label="Gazetteer crests"
            value={String(MAP_REGIONS.length)}
          />
        </div>
      </aside>
    </div>
  );
}

function TasksPane() {
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");
  const [band, setBand] = useState<string>("All");
  const [done, setDone] = useState<Set<string>>(() => new Set(["t1"]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TASK_FIXTURES.filter((t) => {
      if (band !== "All" && t.band !== band) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.region.toLowerCase().includes(q) ||
        t.band.toLowerCase().includes(q)
      );
    });
  }, [query, band]);

  const selected = filtered[row] ?? filtered[0];
  const doneCount = TASK_FIXTURES.filter((t) => done.has(t.id)).length;

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
      <div className="echo-seg" role="tablist" aria-label="Task bands">
        {TASK_BANDS.map((b) => {
          const on = b === band;
          return (
            <button
              key={b}
              type="button"
              role="tab"
              aria-selected={on}
              className={`echo-seg__btn${on ? " is-active" : ""}`}
              onClick={() => {
                setBand(b);
                setRow(0);
              }}
            >
              {b}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_248px]">
        <section
          className="flex min-h-0 flex-col"
          style={{ background: "var(--echo-stage)" }}
        >
          <div className="echo-toolbar">
            <h2
              className="m-0 text-[15px] font-medium"
              style={{ color: "var(--echo-parch-50)" }}
            >
              Task ledger
            </h2>
            <span
              className="font-mono text-[11px]"
              style={{ color: "var(--echo-gem)" }}
            >
              {doneCount}/{TASK_FIXTURES.length} done
            </span>
            <span
              className="font-mono text-[11px]"
              style={{ color: "var(--echo-parch-300)" }}
            >
              {filtered.length} shown
            </span>
            <label
              className="ml-auto flex items-center gap-2 text-[12px]"
              style={{ color: "var(--echo-parch-100)" }}
            >
              Filter
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setRow(0);
                }}
                className="echo-field w-40 px-2 py-1 text-[15px]"
                placeholder="Title or region"
                aria-label="Filter tasks"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="echo-table">
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
                    <td
                      colSpan={5}
                      className="secondary"
                      style={{ padding: "1rem" }}
                    >
                      No fixture tasks match this band or filter.
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
                            className="echo-check"
                            checked={isDone}
                            onChange={() => toggleDone(t.id)}
                            aria-label={`Mark ${t.title} done`}
                          />
                        </td>
                        <td
                          className="font-medium"
                          style={
                            isDone
                              ? { color: "var(--echo-parch-300)" }
                              : undefined
                          }
                        >
                          {t.title}
                        </td>
                        <td className="secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <Crest id={t.regionId} size={14} />
                            {t.region}
                          </span>
                        </td>
                        <td>
                          <span className="echo-tag">{t.band}</span>
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
        <aside
          className="overflow-y-auto border-l p-3"
          style={{
            background: "var(--echo-rail)",
            borderColor: "var(--echo-border)",
          }}
          aria-label="Task inspector"
        >
          {selected ? (
            <div className="echo-panel echo-panel--carved">
              <div className="echo-panel__head">Task folio</div>
              <div className="echo-panel__body">
                <div className="mb-2 flex items-center gap-2">
                  <Crest id={selected.regionId} size={22} />
                  <h3
                    className="m-0 font-display text-[14px] tracking-[0.12em] uppercase"
                    style={{ color: "var(--echo-gold)" }}
                  >
                    {selected.title}
                  </h3>
                </div>
                <KeyFigure
                  label="Fixture points"
                  value={String(selected.pts)}
                />
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                  <dt style={{ color: "var(--echo-parch-300)" }}>Region</dt>
                  <dd className="m-0" style={{ color: "var(--echo-parch-50)" }}>
                    {selected.region}
                  </dd>
                  <dt style={{ color: "var(--echo-parch-300)" }}>Band</dt>
                  <dd className="m-0">
                    <span className="echo-tag">{selected.band}</span>
                  </dd>
                  <dt style={{ color: "var(--echo-parch-300)" }}>Status</dt>
                  <dd
                    className="m-0 font-mono"
                    style={{
                      color: done.has(selected.id)
                        ? "var(--echo-gem)"
                        : "var(--echo-parch-100)",
                    }}
                  >
                    {done.has(selected.id) ? "done" : "open"}
                  </dd>
                </dl>
                <button
                  type="button"
                  className="echo-region-card mt-3"
                  onClick={() => toggleDone(selected.id)}
                  aria-pressed={done.has(selected.id)}
                >
                  <span className="font-medium">
                    {done.has(selected.id) ? "Mark open" : "Mark done"}
                  </span>
                </button>
                <p className="echo-sources">
                  sources? · provisional fixture — Equilibrium list unrevealed
                </p>
              </div>
            </div>
          ) : (
            <p
              className="m-0 text-[13px]"
              style={{ color: "var(--echo-parch-300)" }}
            >
              No task selected
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function CombatPane() {
  const [seg, setSeg] = useState<string>(COMBAT_SEGS[0]);
  const [style, setStyle] = useState<string>("All");
  const [row, setRow] = useState(0);

  const filtered = useMemo(() => {
    if (style === "All") return [...COMBAT_ROWS];
    return COMBAT_ROWS.filter((r) => r.style === style);
  }, [style]);

  const selected = filtered[row] ?? filtered[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="echo-seg" role="tablist" aria-label="Combat sections">
        {COMBAT_SEGS.map((s) => {
          const on = s === seg;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={on}
              className={`echo-seg__btn${on ? " is-active" : ""}`}
              onClick={() => setSeg(s)}
            >
              {s}
            </button>
          );
        })}
      </div>

      <div className="echo-style-bar" role="toolbar" aria-label="Style filter">
        {COMBAT_STYLES.map((s) => {
          const on = s === style;
          return (
            <button
              key={s}
              type="button"
              className={`echo-style-chip${on ? " is-active" : ""}`}
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

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_248px]">
        <section
          className="flex min-h-0 flex-col"
          style={{ background: "var(--echo-stage)" }}
        >
          <div className="echo-toolbar">
            <h2
              className="m-0 text-[15px] font-medium"
              style={{ color: "var(--echo-parch-50)" }}
            >
              {seg} · ability sample
            </h2>
            <span
              className="font-mono text-[11px]"
              style={{ color: "var(--echo-parch-300)" }}
            >
              {filtered.length} · generic target only
            </span>
          </div>

          {seg === "Quick" || seg === "Setup" ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="echo-table">
                <thead>
                  <tr>
                    <th scope="col">Ability</th>
                    <th scope="col">Style</th>
                    <th scope="col">Band</th>
                    <th scope="col">Role</th>
                    <th scope="col">Cooldown</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="secondary"
                        style={{ padding: "1rem" }}
                      >
                        No abilities in this style filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, i) => {
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
                          <td>
                            <span className="echo-style-pill">{r.style}</span>
                          </td>
                          <td className="secondary">{r.band}</td>
                          <td className="secondary">{r.role}</td>
                          <td className="font-mono">{r.cd}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
              <div className="echo-panel echo-panel--carved">
                <div className="echo-panel__head">{seg} · structure</div>
                <div className="echo-panel__body text-[15px]">
                  <p className="m-0" style={{ color: "var(--echo-parch-50)" }}>
                    {seg === "Analysis"
                      ? "Damage Potential and DPL stay empty here — formulas live in the combat core, not invented fixture numbers."
                      : "Rotation bars are structural only. Cooldown labels below are fixture samples from the public RS3 ability set."}
                  </p>
                  <div className="echo-combat-figures mt-3">
                    <KeyFigure label="Adren" value="—" />
                    <KeyFigure label="Dmg" value="—" />
                    <KeyFigure
                      label="Abilities"
                      value={String(filtered.length)}
                    />
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="echo-table">
                  <thead>
                    <tr>
                      <th scope="col">Ability</th>
                      <th scope="col">Style</th>
                      <th scope="col">Band</th>
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
                          tabIndex={0}
                          style={{ cursor: "pointer" }}
                          aria-selected={on}
                        >
                          <td className="font-medium">{r.ability}</td>
                          <td className="secondary">{r.style}</td>
                          <td className="secondary">{r.band}</td>
                          <td className="font-mono">{r.cd}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <aside
          className="overflow-y-auto border-l p-3"
          style={{
            background: "var(--echo-rail)",
            borderColor: "var(--echo-border)",
          }}
          aria-label="Combat inspector"
        >
          {selected ? (
            <div className="echo-panel echo-panel--carved">
              <div className="echo-panel__head">Ability folio</div>
              <div className="echo-panel__body">
                <h3
                  className="m-0 font-display text-[14px] tracking-[0.12em] uppercase"
                  style={{ color: "var(--echo-gold)" }}
                >
                  {selected.ability}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="echo-style-pill is-active">
                    {selected.style}
                  </span>
                  <span className="echo-tag">{selected.band}</span>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                  <dt style={{ color: "var(--echo-parch-300)" }}>Role</dt>
                  <dd className="m-0" style={{ color: "var(--echo-parch-50)" }}>
                    {selected.role}
                  </dd>
                  <dt style={{ color: "var(--echo-parch-300)" }}>Cooldown</dt>
                  <dd
                    className="m-0 font-mono"
                    style={{ color: "var(--echo-parch-50)" }}
                  >
                    {selected.cd}
                  </dd>
                  <dt style={{ color: "var(--echo-parch-300)" }}>Section</dt>
                  <dd className="m-0" style={{ color: "var(--echo-parch-100)" }}>
                    {seg}
                  </dd>
                  <dt style={{ color: "var(--echo-parch-300)" }}>DPL</dt>
                  <dd
                    className="m-0 font-mono"
                    style={{ color: "var(--echo-parch-300)" }}
                  >
                    —
                  </dd>
                </dl>
                <KeyFigure
                  label="Sample rows"
                  value={String(COMBAT_ROWS.length)}
                />
                <p className="echo-sources">
                  sources? · public RS3 ability names · fixture cooldown labels ·
                  no invented DPL
                </p>
              </div>
            </div>
          ) : (
            <p
              className="m-0 text-[13px]"
              style={{ color: "var(--echo-parch-300)" }}
            >
              No ability selected
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

export function EchoPreview() {
  const [nav, setNav] = useState<NavId>("Data");
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(["misthalin", "asgarnia", "fremennik"]),
  );

  const togglePick = (id: string) => {
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

  return (
    <div
      className="flex h-full min-h-[70vh] flex-col"
      style={{
        background: "var(--echo-void)",
        color: "var(--echo-parch-50)",
      }}
    >
      <ArtStage picks={picked.size} />
      <EchoNav active={nav} onChange={setNav} />

      {nav === "Overview" ? (
        <OverviewPane picks={picked.size} pickIds={[...picked]} />
      ) : null}
      {nav === "Data" ? <DataPane /> : null}
      {nav === "Build" ? (
        <BuildPane
          picked={picked}
          onToggle={togglePick}
          onClear={clearPicks}
        />
      ) : null}
      {nav === "Map" ? (
        <MapPane picked={picked} onToggle={togglePick} />
      ) : null}
      {nav === "Tasks" ? <TasksPane /> : null}
      {nav === "Combat" ? <CombatPane /> : null}
    </div>
  );
}
