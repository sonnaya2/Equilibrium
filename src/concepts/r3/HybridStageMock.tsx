"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ConceptFrame, FIXTURE_ROWS } from "../ConceptFrame";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath } from "@/lib/gameArt";

/**
 * Round 3 · Agent G — Hybrid A: Raised Stage + Wiki Table
 *
 * Shell DNA: Raised Bench (Control Surface tree · table · inspector).
 * Table law: Wiki Dense (15px parch-50 body, 12px bright headers, zebra,
 * sticky opaque thead, gem selection only).
 *
 * Slant: surface lift on STAGE only — rail stays darker (league void-adjacent).
 * Stage is one modest step above production panels, not R2 mid-brown desk.
 * Crests pay open R1/R2 game-art debt. Inline HS = proposed tokens only.
 */

/** Proposed hybrid surface ladder (dialed vs R2 Raised Bench). */
const HS = {
  void: "#0d0a07", // stone-950 — UNCHANGED
  shell: "#14100b", // stone-900 — nav / thesis strip
  rail: "#14100b", // stone-900 — tree + inspector; darker than stage
  stage: "#201a12", // NEW stage — modest lift under table only
  zebra: "#16120c", // stage-zebra odd — darker band on stage
  raised: "#2a231a", // selected row / key wells — still below R2 #3a3024
  inset: "#100c08", // fields dig below stage
  border: "#3a3024", // hairline — slight lift from prod #332a1e on stage
  borderHi: "#4a3c2c", // field edge
  carve: "#5a4a36", // inset top edge on raised wells
  // parch proposal (body kept near prod; quiet end lifts for meta)
  parch50: "#f0e9d7", // body — micro lift from #efe7d5
  parch100: "#d9cfb8", // secondary body / bright labels
  parch300: "#b5a990", // meta — lifted quiet ramp
  parch400: "#a3967e", // captions only
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

/** Fixture region → crest id. Unknown → no crest. */
const REGION_CREST: Record<string, string> = {
  Misthalin: "misthalin",
  Karamja: "karamja",
  Asgarnia: "asgarnia",
  Desert: "desert",
  Fremennik: "fremennik",
  Morytania: "morytania",
  Tirannwn: "tirannwn",
  Wilderness: "forinthry",
  Kandarin: "kandarin",
  Anachronia: "anachronia",
  Menaphos: "desert",
};

const EXTENDED = [
  ...FIXTURE_ROWS,
  { name: "Sample unlock I", region: "Kandarin", note: "Fixture row" },
  { name: "Sample unlock J", region: "Anachronia", note: "Fixture row" },
  { name: "Sample unlock K", region: "Misthalin", note: "Fixture row" },
  { name: "Sample unlock L", region: "Asgarnia", note: "Fixture row" },
] as const;

/** Tree leaves that show a crest (pays art debt; decorative ids only). */
const TREE_CRESTS: Record<string, string> = {
  "Browse / Regions": "misthalin",
  Regions: "asgarnia",
};

function panelRaised(extra?: CSSProperties): CSSProperties {
  return {
    background: HS.raised,
    border: `1px solid ${HS.border}`,
    borderRadius: 2,
    boxShadow: `inset 0 1px 0 ${HS.carve}`,
    ...extra,
  };
}

function MockNav({ active }: { active: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        borderBottom: `1px solid ${HS.border}`,
        background: HS.shell,
        padding: "8px 12px",
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          letterSpacing: "0.16em",
          color: HS.gold400,
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
              color: label === active ? HS.gem400 : HS.parch100,
            }}
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MockTabs({
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
        borderBottom: `1px solid ${HS.border}`,
        background: HS.shell,
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
              border: selected
                ? `1px solid ${HS.gem500}`
                : "1px solid transparent",
              background: selected ? HS.rail : "transparent",
              color: selected ? HS.gem300 : HS.parch100,
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

function Swatch({ hex, name }: { hex: string; name: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 100 }}>
      <span
        aria-hidden
        style={{
          width: 12,
          height: 12,
          background: hex,
          border: `1px solid ${HS.borderHi}`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, color: HS.parch300 }}>
        {name}
        <span
          style={{
            color: HS.parch400,
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {" "}
          {hex}
        </span>
      </span>
    </div>
  );
}

export function HybridStageMock() {
  const [top, setTop] = useState<string>("Data");
  const [leaf, setLeaf] = useState(TREE.Data[0]);
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EXTENDED;
    return EXTENDED.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.region.toLowerCase().includes(q),
    );
  }, [query]);

  const active = filtered[row] ?? filtered[0];
  const activeCrest = active ? REGION_CREST[active.region] : undefined;

  return (
    <ConceptFrame
      title="G · Hybrid A — raised stage · wiki table · crests"
      heightClass="h-[min(800px,80vh)]"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          background: HS.void,
          color: HS.parch50,
        }}
      >
        <MockNav active={top === "Overview" ? "Overview" : top} />
        <MockTabs
          tabs={[...TOP]}
          active={top}
          onChange={(t) => {
            setTop(t);
            setLeaf((TREE[t] ?? TREE.Data)[0]);
            setRow(0);
          }}
        />

        {/* Lab thesis strip — product would omit */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "baseline",
            borderBottom: `1px solid ${HS.border}`,
            background: HS.shell,
            padding: "5px 12px",
            fontSize: 11,
            color: HS.parch300,
          }}
        >
          <span style={{ color: HS.parch100 }}>Hybrid Stage</span>
          <span>
            void #0d0a07 · stage lift only · rail darker · 15px body · zebra · sticky
            opaque · 12px headers · crests
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono), monospace",
              color: HS.parch400,
            }}
          >
            data 15 · label 12 · key 22
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
          {/* Tree rail — darker than stage */}
          <nav
            aria-label="System tree"
            style={{
              overflowY: "auto",
              borderRight: `1px solid ${HS.border}`,
              background: HS.rail,
            }}
          >
            <p
              style={{
                borderBottom: `1px solid ${HS.border}`,
                padding: "6px 8px",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: HS.parch300,
                margin: 0,
              }}
            >
              {top} tree
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: "4px 0" }}>
              {(TREE[top] ?? TREE.Data).map((item) => {
                const on = item === leaf;
                const crestId = TREE_CRESTS[item];
                return (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() => setLeaf(item)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        borderLeft: on
                          ? `2px solid ${HS.gem400}`
                          : "2px solid transparent",
                        background: on ? HS.stage : "transparent",
                        color: on ? HS.gem300 : HS.parch100,
                        padding: "7px 10px",
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {crestId ? <Crest id={crestId} size={14} /> : null}
                      <span>{item}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p
              style={{
                borderTop: `1px solid ${HS.border}`,
                margin: 0,
                padding: "8px 10px",
                fontSize: 11,
                lineHeight: 1.4,
                color: HS.parch300,
              }}
            >
              Rail stays stone-900. Active leaf takes stage fill + gem rail — not gold.
            </p>
          </nav>

          {/* Stage — modest lift; owns the table */}
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              background: HS.stage,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
                borderBottom: `1px solid ${HS.border}`,
                padding: "8px 12px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: HS.parch50,
                }}
              >
                {leaf}
              </h2>
              <span
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 11,
                  color: HS.parch300,
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
                  color: HS.parch100,
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
                    width: 160,
                    border: `1px solid ${HS.borderHi}`,
                    background: HS.inset,
                    color: HS.parch50,
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
                }}
              >
                {/* Sticky opaque header — stage fill, not transparent */}
                <thead
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    background: HS.stage,
                  }}
                >
                  <tr style={{ borderBottom: `1px solid ${HS.border}` }}>
                    {["Name", "Region", "Note", "Qty"].map((h, hi) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          letterSpacing: "0.04em",
                          color: HS.parch100,
                          textAlign: hi === 3 ? "right" : "left",
                          background: HS.stage,
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
                    const crestId = REGION_CREST[r.region];
                    return (
                      <tr
                        key={`${r.name}-${r.region}-${i}`}
                        onClick={() => setRow(i)}
                        style={{
                          cursor: "pointer",
                          borderBottom: `1px solid ${HS.border}`,
                          background: sel
                            ? HS.raised
                            : zebra
                              ? HS.zebra
                              : HS.stage,
                          outline: sel
                            ? `1px solid ${HS.gem600}`
                            : "none",
                          outlineOffset: -1,
                        }}
                      >
                        <td
                          style={{
                            padding: "6px 12px",
                            fontSize: 15,
                            lineHeight: 1.35,
                            color: HS.parch50,
                          }}
                        >
                          {r.name}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            fontSize: 15,
                            lineHeight: 1.35,
                            color: HS.parch50,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {crestId ? <Crest id={crestId} size={16} /> : null}
                            {r.region}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            fontSize: 15,
                            lineHeight: 1.35,
                            color: HS.parch100,
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
                            color: HS.parch50,
                          }}
                        >
                          {(i + 1) * 3}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Inspector — same rail as tree */}
          <aside
            style={{
              overflowY: "auto",
              borderLeft: `1px solid ${HS.border}`,
              background: HS.rail,
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
                color: HS.gold400,
              }}
            >
              Record
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 8,
              }}
            >
              {activeCrest ? <Crest id={activeCrest} size={28} /> : null}
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 600,
                    color: HS.parch50,
                  }}
                >
                  {active?.name ?? "—"}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 12,
                    color: HS.parch100,
                  }}
                >
                  {active?.region ?? "—"}
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginTop: 16,
                borderTop: `1px solid ${HS.border}`,
                paddingTop: 12,
              }}
            >
              <div style={panelRaised({ padding: 8 })}>
                <p style={{ margin: 0, fontSize: 12, color: HS.parch100 }}>
                  Key figure
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 22,
                    lineHeight: 1.1,
                    color: HS.gem400,
                  }}
                >
                  20
                </p>
              </div>
              <div style={panelRaised({ padding: 8 })}>
                <p style={{ margin: 0, fontSize: 12, color: HS.parch100 }}>
                  Sources
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: 22,
                    lineHeight: 1.1,
                    color: HS.parch50,
                  }}
                >
                  1
                </p>
              </div>
            </div>

            <dl
              style={{
                margin: "12px 0 0",
                paddingTop: 12,
                borderTop: `1px solid ${HS.border}`,
              }}
            >
              {[
                ["Status", "Fixture only"],
                ["Provenance", "Lab mock"],
                ["Verified", "—"],
              ].map(([dt, dd]) => (
                <div
                  key={dt}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  <dt style={{ color: HS.parch100, margin: 0 }}>{dt}</dt>
                  <dd style={{ color: HS.parch50, margin: 0 }}>{dd}</dd>
                </div>
              ))}
            </dl>

            <p
              style={{
                margin: "12px 0 0",
                fontSize: 12,
                lineHeight: 1.5,
                color: HS.parch100,
              }}
            >
              Stage lifts under the table only. Rail stays void-adjacent so the
              room reads league-dark. Wiki law: 15px parch body, zebra bands,
              sticky opaque head, 12px bright headers. Gem = active; gold =
              Record title.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                borderTop: `1px solid ${HS.border}`,
                marginTop: 12,
                paddingTop: 10,
              }}
            >
              <Swatch hex={HS.void} name="void" />
              <Swatch hex={HS.rail} name="rail" />
              <Swatch hex={HS.stage} name="stage" />
              <Swatch hex={HS.zebra} name="zebra" />
              <Swatch hex={HS.raised} name="raised" />
              <Swatch hex={HS.gem400} name="gem" />
            </div>
          </aside>
        </div>
      </div>
    </ConceptFrame>
  );
}
