"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ConceptFrame, FIXTURE_ROWS } from "../ConceptFrame";

/**
 * Round 2 · Agent E — Raised Bench (color / readability).
 * Surfaces are deliberately warmer mid-stone so existing parch ink clears
 * contrast without lightening text into chalk or darkening void into black glass.
 * Inline styles only — does not touch production globals.css.
 */

const RB = {
  void: "#0d0a07",
  shell: "#16120c",
  rail: "#2a2218",
  stage: "#32291e",
  raised: "#3a3024",
  inset: "#241c14",
  border: "#5a4a36",
  borderHi: "#6b5840",
  carve: "#7a684c",
  parch50: "#efe7d5",
  parch100: "#d3c8b0",
  parch300: "#a99f88",
  parch400: "#948a73",
  gold400: "#e0b264",
  gem300: "#57e0ae",
  gem400: "#2ecb8f",
  gem500: "#1fa372",
  gem600: "#157a55",
} as const;

const TOP = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"] as const;

const TREE: Record<string, string[]> = {
  Data: [
    "Browse / Regions",
    "Browse / Skills",
    "Progression",
    "Unlocks",
    "Consumables",
    "Systems",
    "Crafting / Arch",
    "Crafting / Masterwork",
    "Boundaries",
  ],
  Tasks: ["Easy", "Medium", "Hard", "Elite", "Master", "Search"],
  Build: ["Regions", "Relics", "Blessings", "Share"],
  Combat: ["Quick", "Build", "Rotation", "Analysis", "Reference"],
  Map: ["Picks", "Filters", "Board"],
  Overview: ["Status", "Planner links", "Systems table"],
};

function raisedPanel(extra?: CSSProperties): CSSProperties {
  return {
    background: RB.raised,
    border: `1px solid ${RB.border}`,
    borderRadius: 2,
    boxShadow: `inset 0 1px 0 ${RB.carve}`,
    ...extra,
  };
}

function MockNavRaised({ active }: { active: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        borderBottom: `1px solid ${RB.border}`,
        background: RB.shell,
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          letterSpacing: "0.16em",
          color: RB.gold400,
        }}
      >
        EQUILIBRIUM
      </span>
      <ul style={{ display: "flex", flexWrap: "wrap", gap: 12, listStyle: "none", margin: 0, padding: 0 }}>
        {TOP.map((label) => (
          <li
            key={label}
            style={{
              fontWeight: label === active ? 600 : 400,
              color: label === active ? RB.gem400 : RB.parch100,
            }}
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MockTabsRaised({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        borderBottom: `1px solid ${RB.border}`,
        background: RB.shell,
        padding: "8px 8px 0",
      }}
    >
      {tabs.map((tab) => {
        const selected = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab)}
            style={{
              border: selected ? `1px solid ${RB.gem500}` : "1px solid transparent",
              background: selected ? RB.rail : "transparent",
              color: selected ? RB.gem300 : RB.parch100,
              padding: "6px 10px",
              fontSize: 12,
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

function KeyFigure({ label, value, gem }: { label: string; value: string; gem?: boolean }) {
  return (
    <div style={raisedPanel({ padding: 8 })}>
      <p style={{ margin: 0, fontSize: 11, color: RB.parch300 }}>{label}</p>
      <p
        style={{
          margin: "4px 0 0",
          fontFamily: "var(--font-mono), monospace",
          fontSize: 22,
          lineHeight: 1.1,
          color: gem ? RB.gem400 : RB.parch50,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function SwatchRow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        borderTop: `1px solid ${RB.border}`,
        marginTop: 12,
        paddingTop: 10,
      }}
    >
      {children}
    </div>
  );
}

function Swatch({ hex, name }: { hex: string; name: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 108 }}>
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          background: hex,
          border: `1px solid ${RB.borderHi}`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, color: RB.parch300 }}>
        {name}
        <span style={{ color: RB.parch400, fontFamily: "var(--font-mono), monospace" }}> {hex}</span>
      </span>
    </div>
  );
}

export function RaisedBenchMock() {
  const [top, setTop] = useState<string>("Data");
  const branches = TREE[top] ?? TREE.Data;
  const [leaf, setLeaf] = useState(branches[0]);
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FIXTURE_ROWS;
    return FIXTURE_ROWS.filter(
      (r) => r.name.toLowerCase().includes(q) || r.region.toLowerCase().includes(q),
    );
  }, [query]);

  const active = filtered[row] ?? filtered[0];

  return (
    <ConceptFrame title="E · Raised Bench — mid-stone lift · readable parch" heightClass="h-[min(780px,78vh)]">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          background: RB.void,
          color: RB.parch50,
        }}
      >
        <MockNavRaised active={top === "Overview" ? "Overview" : top} />
        <MockTabsRaised
          tabs={[...TOP]}
          active={top}
          onChange={(t) => {
            setTop(t);
            setLeaf((TREE[t] ?? TREE.Data)[0]);
            setRow(0);
          }}
        />

        {/* Thesis strip — lab only */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "baseline",
            borderBottom: `1px solid ${RB.border}`,
            background: RB.shell,
            padding: "6px 12px",
            fontSize: 11,
            color: RB.parch300,
          }}
        >
          <span style={{ color: RB.parch100 }}>Raised Bench</span>
          <span>void stays dark · panels lift to mid-stone · borders +1 step · gem chrome · gold titles only</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono), monospace", color: RB.parch400 }}>
            data ≥14px · key ≥20px
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "220px minmax(0,1fr) 300px",
            minHeight: 0,
            flex: 1,
          }}
        >
          {/* Tree rail — raised over void */}
          <nav
            aria-label="System tree"
            style={{
              overflowY: "auto",
              borderRight: `1px solid ${RB.border}`,
              background: RB.rail,
            }}
          >
            <p
              style={{
                borderBottom: `1px solid ${RB.border}`,
                padding: "6px 8px",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: RB.parch300,
                margin: 0,
              }}
            >
              {top} tree
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: "4px 0" }}>
              {(TREE[top] ?? TREE.Data).map((item) => {
                const on = item === leaf;
                return (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() => setLeaf(item)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        borderLeft: on ? `2px solid ${RB.gem400}` : "2px solid transparent",
                        background: on ? RB.stage : "transparent",
                        color: on ? RB.gem300 : RB.parch100,
                        padding: "8px 10px",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {item}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Stage — table on raised surface */}
          <section style={{ display: "flex", flexDirection: "column", minHeight: 0, background: RB.stage }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
                borderBottom: `1px solid ${RB.border}`,
                padding: "8px 12px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: RB.parch50 }}>{leaf}</h2>
              <label
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: RB.parch300,
                }}
              >
                Filter
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="name or region"
                  style={{
                    width: 160,
                    border: `1px solid ${RB.borderHi}`,
                    background: RB.inset,
                    color: RB.parch50,
                    padding: "5px 8px",
                    fontSize: 14,
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
                  fontSize: 14,
                }}
              >
                <thead style={{ position: "sticky", top: 0, background: RB.stage, zIndex: 1 }}>
                  <tr style={{ borderBottom: `1px solid ${RB.border}` }}>
                    {["Name", "Region", "Note"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          color: RB.parch300,
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
                    return (
                      <tr
                        key={r.name}
                        onClick={() => setRow(i)}
                        style={{
                          cursor: "pointer",
                          borderBottom: `1px solid ${RB.border}`,
                          background: sel ? RB.raised : "transparent",
                          outline: sel ? `1px solid ${RB.gem600}` : "none",
                          outlineOffset: -1,
                        }}
                      >
                        <td style={{ padding: "9px 12px", fontSize: 14, color: RB.parch50 }}>{r.name}</td>
                        <td style={{ padding: "9px 12px", fontSize: 14, color: RB.parch100 }}>{r.region}</td>
                        <td style={{ padding: "9px 12px", fontSize: 14, color: RB.parch300 }}>{r.note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Inspector — same rail height as tree */}
          <aside
            style={{
              overflowY: "auto",
              borderLeft: `1px solid ${RB.border}`,
              background: RB.rail,
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
                color: RB.gold400,
              }}
            >
              Record
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 16, color: RB.parch50 }}>{active?.name ?? "—"}</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: RB.parch100 }}>{active?.region}</p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 16,
                borderTop: `1px solid ${RB.border}`,
                paddingTop: 12,
              }}
            >
              <KeyFigure label="Key figure" value="20" gem />
              <KeyFigure label="Sources" value="1" />
            </div>

            <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5, color: RB.parch100 }}>
              Table sits on stage stone, not void. Body ink is parch-50/100; meta uses parch-300 on
              raised mid-tone so brown-on-brown mud clears without chalking text or lifting the page
              ground.
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.45, color: RB.parch300 }}>
              Fixture rows only — not published league numbers. Gem marks active chrome and key
              figure; gold stays engraved title ink.
            </p>

            <SwatchRow>
              <Swatch hex={RB.void} name="void" />
              <Swatch hex={RB.rail} name="rail" />
              <Swatch hex={RB.stage} name="stage" />
              <Swatch hex={RB.raised} name="raised" />
              <Swatch hex={RB.border} name="border" />
              <Swatch hex={RB.gem400} name="gem" />
            </SwatchRow>
          </aside>
        </div>
      </div>
    </ConceptFrame>
  );
}
