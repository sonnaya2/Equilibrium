"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ConceptFrame } from "@/concepts/ConceptFrame";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath } from "@/lib/gameArt";

/**
 * Round 3 · Agent I — Hybrid C: Full Readable System
 *
 * Combines R2 winners into one ship-shaped shell:
 * - Control Surface DNA (tree · table · inspector)
 * - Raised Bench *slight* panel lift (dialed back — still league-dark)
 * - Parchment Lift quiet-parch bump (body scan ink only)
 * - Wiki Dense table law (15px body, 12px heads, zebra, sticky, gem select)
 * - Game crests in tree + rows (open R1 debt)
 * - Interactive Data vs Build preview (Build = segment strip stage)
 *
 * Proposal palette is inline only — no production globals edit.
 */

/** Hybrid token proposal — slight lift, not SaaS mid-brown desk. */
const H = {
  void: "#0d0a07",
  shell: "#12100c",
  rail: "#1c1711",
  stage: "#231c14",
  raised: "#2c241a",
  inset: "#18140f",
  zebra: "#1a1510",
  border: "#463a29",
  borderHi: "#5a4a36",
  carve: "#6b5840",
  // Parch lift (Parchment Lift proposal)
  parch50: "#f2ead8",
  parch100: "#e4d8be",
  parch300: "#cdbda3",
  parch400: "#bcae93",
  parch500: "#aa9a7e",
  gold400: "#e0b264",
  gem300: "#57e0ae",
  gem400: "#2ecb8f",
  gem500: "#1fa372",
  gem600: "#157a55",
} as const;

const TOP = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;

type Preview = "Data" | "Build";

const DATA_TABS = ["Browse", "Progression", "Unlocks", "Systems", "Crafting", "Boundaries"] as const;

const DATA_TREE = [
  { id: "browse-regions", label: "Browse / Regions", group: "Browse", crest: "misthalin" },
  { id: "browse-skills", label: "Browse / Skills", group: "Browse", crest: null },
  { id: "progression", label: "Progression", group: "Progression", crest: null },
  { id: "unlocks", label: "Unlocks", group: "Unlocks", crest: null },
  { id: "consumables", label: "Consumables", group: "Systems", crest: null },
  { id: "systems", label: "Systems", group: "Systems", crest: null },
  { id: "craft-arch", label: "Crafting / Arch", group: "Crafting", crest: null },
  { id: "craft-mw", label: "Crafting / Masterwork", group: "Crafting", crest: null },
  { id: "boundaries", label: "Boundaries", group: "Boundaries", crest: null },
] as const;

const BUILD_SEGS = ["Regions", "Relics", "Blessings", "Share"] as const;

/** Fixture catalog — labeled demo, not published league facts. */
const FIXTURE = [
  { name: "Sample unlock A", region: "Misthalin", regionId: "misthalin", note: "Fixture row", qty: 3 },
  { name: "Sample unlock B", region: "Karamja", regionId: "karamja", note: "Fixture row", qty: 6 },
  { name: "Sample unlock C", region: "Asgarnia", regionId: "asgarnia", note: "Fixture row", qty: 9 },
  { name: "Sample unlock D", region: "Desert", regionId: "desert", note: "Fixture row", qty: 12 },
  { name: "Sample unlock E", region: "Fremennik", regionId: "fremennik", note: "Fixture row", qty: 15 },
  { name: "Sample unlock F", region: "Morytania", regionId: "morytania", note: "Fixture row", qty: 18 },
  { name: "Sample unlock G", region: "Tirannwn", regionId: "tirannwn", note: "Fixture row", qty: 21 },
  { name: "Sample unlock H", region: "Forinthry", regionId: "forinthry", note: "Fixture row", qty: 24 },
  { name: "Sample unlock I", region: "Kandarin", regionId: "kandarin", note: "Fixture row", qty: 27 },
  { name: "Sample unlock J", region: "Anachronia", regionId: "anachronia", note: "Fixture row", qty: 30 },
  { name: "Sample unlock K", region: "Havenhythe", regionId: "havenhythe", note: "Fixture row", qty: 33 },
  { name: "Sample unlock L", region: "Misthalin", regionId: "misthalin", note: "Fixture row", qty: 36 },
] as const;

const BUILD_REGIONS = [
  { id: "misthalin", name: "Misthalin", picks: 1 },
  { id: "asgarnia", name: "Asgarnia", picks: 1 },
  { id: "karamja", name: "Karamja", picks: 0 },
  { id: "desert", name: "Desert", picks: 0 },
  { id: "fremennik", name: "Fremennik", picks: 1 },
  { id: "morytania", name: "Morytania", picks: 0 },
  { id: "tirannwn", name: "Tirannwn", picks: 0 },
  { id: "kandarin", name: "Kandarin", picks: 0 },
  { id: "anachronia", name: "Anachronia", picks: 0 },
  { id: "forinthry", name: "Forinthry", picks: 0 },
  { id: "havenhythe", name: "Havenhythe", picks: 0 },
] as const;

function panelStyle(extra?: CSSProperties): CSSProperties {
  return {
    background: H.raised,
    border: `1px solid ${H.border}`,
    borderRadius: 2,
    boxShadow: `inset 0 1px 0 ${H.carve}`,
    ...extra,
  };
}

function Crest({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <GameIcon
      src={regionCrestPath(id)}
      size={size}
      className="shrink-0"
      alt=""
    />
  );
}

function KeyFigure({
  label,
  value,
  gem,
}: {
  label: string;
  value: string;
  gem?: boolean;
}) {
  return (
    <div style={panelStyle({ padding: 8 })}>
      <p style={{ margin: 0, fontSize: 12, color: H.parch300 }}>{label}</p>
      <p
        style={{
          margin: "4px 0 0",
          fontFamily: "var(--font-mono), monospace",
          fontSize: 22,
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
          color: gem ? H.gem400 : H.parch50,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function NavBar({ active }: { active: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        borderBottom: `1px solid ${H.border}`,
        background: H.shell,
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          letterSpacing: "0.16em",
          color: H.gold400,
        }}
      >
        EQUILIBRIUM
      </span>
      <ul
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {TOP.map((label) => (
          <li
            key={label}
            style={{
              fontWeight: label === active ? 600 : 400,
              color: label === active ? H.gem400 : H.parch100,
            }}
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SegmentStrip({
  segments,
  active,
  onChange,
  ariaLabel,
}: {
  segments: readonly string[];
  active: string;
  onChange: (s: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        borderBottom: `1px solid ${H.border}`,
        background: H.shell,
        padding: "8px 8px 0",
      }}
    >
      {segments.map((seg) => {
        const on = seg === active;
        return (
          <button
            key={seg}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(seg)}
            style={{
              border: on ? `1px solid ${H.gem500}` : "1px solid transparent",
              background: on ? H.rail : "transparent",
              color: on ? H.gem300 : H.parch100,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: on ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {seg}
          </button>
        );
      })}
    </div>
  );
}

function PreviewToggle({
  mode,
  onChange,
}: {
  mode: Preview;
  onChange: (m: Preview) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        borderBottom: `1px solid ${H.border}`,
        background: H.shell,
        padding: "6px 12px",
        fontSize: 11,
        color: H.parch400,
      }}
    >
      <span style={{ color: H.parch100, fontWeight: 600 }}>Hybrid C</span>
      <span>slight lift · brighter parch · wiki table · crests · gem chrome</span>
      <div
        role="group"
        aria-label="Route preview"
        style={{ marginLeft: "auto", display: "flex", gap: 4 }}
      >
        {(["Data", "Build"] as const).map((m) => {
          const on = mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(m)}
              style={{
                border: on ? `1px solid ${H.gem500}` : `1px solid ${H.border}`,
                background: on ? H.raised : H.inset,
                color: on ? H.gem300 : H.parch100,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: on ? 600 : 400,
                cursor: "pointer",
              }}
            >
              {m} preview
            </button>
          );
        })}
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono), monospace",
          color: H.parch400,
          fontSize: 10,
        }}
      >
        15px data · 12px heads · key 22px
      </span>
    </div>
  );
}

function TreeLeaf({
  label,
  crest,
  selected,
  onClick,
}: {
  label: string;
  crest: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        textAlign: "left",
        border: "none",
        borderLeft: selected ? `2px solid ${H.gem400}` : "2px solid transparent",
        background: selected ? H.stage : "transparent",
        color: selected ? H.gem300 : H.parch100,
        padding: "7px 10px",
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {crest ? <Crest id={crest} size={14} /> : (
        <span
          aria-hidden
          style={{
            width: 14,
            height: 14,
            flexShrink: 0,
            border: `1px solid ${H.border}`,
            background: H.inset,
          }}
        />
      )}
      {label}
    </button>
  );
}

function DataWorkbench() {
  const [tab, setTab] = useState<(typeof DATA_TABS)[number]>("Browse");
  const [leaf, setLeaf] = useState<(typeof DATA_TREE)[number]["id"]>("browse-regions");
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");

  const treeLeaves = useMemo(
    () => DATA_TREE.filter((t) => t.group === tab),
    [tab],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FIXTURE;
    return FIXTURE.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.region.toLowerCase().includes(q),
    );
  }, [query]);

  const active = filtered[row] ?? filtered[0];
  const leafMeta = DATA_TREE.find((t) => t.id === leaf) ?? DATA_TREE[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <SegmentStrip
        segments={DATA_TABS}
        active={tab}
        onChange={(s) => {
          const next = s as (typeof DATA_TABS)[number];
          setTab(next);
          const first = DATA_TREE.find((t) => t.group === next);
          if (first) setLeaf(first.id);
          setRow(0);
        }}
        ariaLabel="Data primary categories"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px minmax(0,1fr) 300px",
          minHeight: 0,
          flex: 1,
        }}
      >
      {/* Category tree — leaves for active primary tab only */}
      <nav
        aria-label="Data category tree"
        style={{
          overflowY: "auto",
          borderRight: `1px solid ${H.border}`,
          background: H.rail,
        }}
      >
        <p
          style={{
            margin: 0,
            borderBottom: `1px solid ${H.border}`,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 600,
            color: H.parch100,
          }}
        >
          {tab} · tree
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: "4px 0" }}>
          {treeLeaves.map((item) => (
            <li key={item.id}>
              <TreeLeaf
                label={item.label}
                crest={item.crest}
                selected={item.id === leaf}
                onClick={() => {
                  setLeaf(item.id);
                  setRow(0);
                }}
              />
            </li>
          ))}
        </ul>
        <p
          style={{
            margin: 0,
            borderTop: `1px solid ${H.border}`,
            padding: "8px 10px",
            fontSize: 11,
            lineHeight: 1.4,
            color: H.parch400,
          }}
        >
          Mount-active leaf only. Inactive research never loads.
        </p>
      </nav>

      {/* Table stage — wiki dense */}
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: H.stage,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            borderBottom: `1px solid ${H.border}`,
            padding: "8px 12px",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: H.parch50 }}>
            {leafMeta.label}
          </h2>
          <span
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              color: H.parch300,
            }}
          >
            {filtered.length} rows · fixture
          </span>
          <label
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: H.parch100,
            }}
          >
            Filter
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setRow(0);
              }}
              placeholder="name or region"
              style={{
                width: 168,
                border: `1px solid ${H.borderHi}`,
                background: H.inset,
                color: H.parch50,
                padding: "5px 8px",
                fontSize: 15,
              }}
            />
          </label>
        </div>

        <div style={{ minHeight: 0, flex: 1, overflow: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: H.stage,
              }}
            >
              <tr style={{ borderBottom: `1px solid ${H.border}` }}>
                {["Name", "Region", "Note", "Qty"].map((h, hi) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      color: H.parch100,
                      textAlign: hi === 3 ? "right" : "left",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const sel = row === i;
                const zebra = i % 2 === 1;
                return (
                  <tr
                    key={`${r.name}-${r.regionId}`}
                    onClick={() => setRow(i)}
                    style={{
                      cursor: "pointer",
                      borderBottom: `1px solid ${H.border}`,
                      background: sel
                        ? H.raised
                        : zebra
                          ? H.zebra
                          : H.stage,
                      outline: sel ? `1px solid ${H.gem500}` : "none",
                      outlineOffset: -1,
                    }}
                  >
                    <td
                      style={{
                        padding: "6px 12px",
                        fontSize: 15,
                        lineHeight: 1.35,
                        color: H.parch50,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Crest id={r.regionId} size={16} />
                        {r.name}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "6px 12px",
                        fontSize: 15,
                        lineHeight: 1.35,
                        color: H.parch100,
                      }}
                    >
                      {r.region}
                    </td>
                    <td
                      style={{
                        padding: "6px 12px",
                        fontSize: 15,
                        lineHeight: 1.35,
                        color: H.parch100,
                      }}
                    >
                      {r.note}
                    </td>
                    <td
                      style={{
                        padding: "6px 12px",
                        fontSize: 15,
                        textAlign: "right",
                        fontFamily: "var(--font-mono), monospace",
                        fontVariantNumeric: "tabular-nums",
                        color: H.parch50,
                      }}
                    >
                      {r.qty}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Inspector */}
      <aside
        style={{
          overflowY: "auto",
          borderLeft: `1px solid ${H.border}`,
          background: H.rail,
          padding: 12,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: H.gold400,
          }}
        >
          Record
        </p>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {active ? <Crest id={active.regionId} size={28} /> : null}
          <div>
            <p style={{ margin: 0, fontSize: 16, color: H.parch50 }}>
              {active?.name ?? "—"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 14, color: H.parch100 }}>
              {active?.region ?? ""}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            marginTop: 16,
            borderTop: `1px solid ${H.border}`,
            paddingTop: 12,
          }}
        >
          <KeyFigure label="Key figure" value={String(active?.qty ?? 0)} gem />
          <KeyFigure label="Sources" value="1" />
        </div>

        <dl style={{ margin: "14px 0 0", fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
            <dt style={{ color: H.parch300 }}>Leaf</dt>
            <dd style={{ margin: 0, color: H.parch100 }}>{leafMeta.label}</dd>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
            <dt style={{ color: H.parch300 }}>Note</dt>
            <dd style={{ margin: 0, color: H.parch100 }}>{active?.note ?? "—"}</dd>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <dt style={{ color: H.parch300 }}>Status</dt>
            <dd style={{ margin: 0, color: H.parch100 }}>Fixture only</dd>
          </div>
        </dl>

        <p
          style={{
            margin: "14px 0 0",
            fontSize: 12,
            lineHeight: 1.5,
            color: H.parch300,
          }}
        >
          Body ink on slight stage lift. Headers 12px bright. Zebra + hairline.
          Key mono ≥20px. Crests pay the identity debt.
        </p>
      </aside>
      </div>
    </div>
  );
}

function BuildWorkbench() {
  const [seg, setSeg] = useState<(typeof BUILD_SEGS)[number]>("Regions");
  const [picked, setPicked] = useState(0);
  const region = BUILD_REGIONS[picked] ?? BUILD_REGIONS[0];
  const pickCount = BUILD_REGIONS.reduce((n, r) => n + r.picks, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <SegmentStrip
        segments={BUILD_SEGS}
        active={seg}
        onChange={(s) => setSeg(s as (typeof BUILD_SEGS)[number])}
        ariaLabel="Build segments"
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px minmax(0,1fr) 300px",
          minHeight: 0,
          flex: 1,
        }}
      >
        {/* Segment list / tree mirror */}
        <nav
          aria-label="Build segment detail"
          style={{
            overflowY: "auto",
            borderRight: `1px solid ${H.border}`,
            background: H.rail,
          }}
        >
          <p
            style={{
              margin: 0,
              borderBottom: `1px solid ${H.border}`,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 600,
              color: H.parch100,
            }}
          >
            Build · {seg}
          </p>
          {seg === "Regions" ? (
            <ul style={{ listStyle: "none", margin: 0, padding: "4px 0" }}>
              {BUILD_REGIONS.map((r, i) => (
                <li key={r.id}>
                  <TreeLeaf
                    label={`${r.name}${r.picks ? " · pick" : ""}`}
                    crest={r.id}
                    selected={i === picked}
                    onClick={() => setPicked(i)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p
              style={{
                margin: 0,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.45,
                color: H.parch100,
              }}
            >
              {seg} stage mounts here. Fixture demo — segment strip swaps stage
              content; inactive segments stay unmounted.
            </p>
          )}
        </nav>

        {/* Stage grid */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            background: H.stage,
            padding: 12,
            overflow: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: H.parch50 }}>
              {seg} · fixture lattice
            </h2>
            <span
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 12,
                color: H.parch100,
              }}
            >
              {pickCount}/3 picks
            </span>
          </div>

          {seg === "Regions" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))",
                gap: 8,
              }}
            >
              {BUILD_REGIONS.map((r, i) => {
                const on = i === picked;
                const locked = !r.picks && pickCount >= 3;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPicked(i)}
                    aria-pressed={on}
                    style={{
                      ...panelStyle({
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: 10,
                        cursor: "pointer",
                        textAlign: "left",
                        outline: on ? `1px solid ${H.gem500}` : "none",
                        outlineOffset: -1,
                        opacity: locked && !on ? 0.72 : 1,
                      }),
                    }}
                  >
                    <Crest id={r.id} size={28} />
                    <span style={{ fontSize: 13, color: H.parch50, fontWeight: 600 }}>
                      {r.name}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: 11,
                        color: r.picks ? H.gem300 : H.parch400,
                      }}
                    >
                      {r.picks ? "picked" : "open"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={panelStyle({ padding: 16, maxWidth: 480 })}>
              <p style={{ margin: 0, fontSize: 15, color: H.parch50 }}>
                {seg} content (fixture)
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: H.parch100,
                }}
              >
                Segment strip is the Build IA: one active segment fills the stage.
                Relics / Blessings / Share use the same three-column shell when they
                need a list + inspector.
              </p>
            </div>
          )}
        </section>

        {/* Inspector */}
        <aside
          style={{
            overflowY: "auto",
            borderLeft: `1px solid ${H.border}`,
            background: H.rail,
            padding: 12,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-display), Georgia, serif",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: H.gold400,
            }}
          >
            Selection
          </p>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Crest id={region.id} size={32} />
            <div>
              <p style={{ margin: 0, fontSize: 16, color: H.parch50 }}>{region.name}</p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: H.parch100 }}>
                {seg} · fixture
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 16,
              borderTop: `1px solid ${H.border}`,
              paddingTop: 12,
            }}
          >
            <KeyFigure label="Picks" value={`${pickCount}/3`} gem />
            <KeyFigure label="This region" value={String(region.picks)} />
          </div>

          <p
            style={{
              margin: "14px 0 0",
              fontSize: 12,
              lineHeight: 1.5,
              color: H.parch300,
            }}
          >
            Build keeps head-still columns. Segment strip is gem-active only — gold
            stays engraved. Crests on every region cell.
          </p>
        </aside>
      </div>
    </div>
  );
}

export function HybridFullMock() {
  const [mode, setMode] = useState<Preview>("Data");

  return (
    <ConceptFrame
      title="I · Hybrid C — Full Readable System (Data ⇄ Build)"
      heightClass="h-[min(840px,82vh)]"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          background: H.void,
          color: H.parch50,
        }}
      >
        <NavBar active={mode} />
        <PreviewToggle mode={mode} onChange={setMode} />
        {mode === "Data" ? <DataWorkbench /> : <BuildWorkbench />}
      </div>
    </ConceptFrame>
  );
}
