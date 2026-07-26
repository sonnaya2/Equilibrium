"use client";

import { useMemo, useState } from "react";
import { ConceptFrame, FIXTURE_ROWS } from "../ConceptFrame";

/**
 * Round 3 · Agent H · Hybrid B: Ink First + Control Surface
 *
 * Layout DNA: full Control Surface (tree · table · inspector).
 * Surfaces: production-dark stone only (void 950 / rail 900 / panel 850).
 * Ink: proposed parch ramp (inline only — not production @theme).
 * Type: Wiki Dense (15px data, 12px labels, zebra, sticky opaque head).
 * Identity: region crests via /game/regions/*.png in tree + table rows.
 */

/** Proposal only — not production tokens. See hybrid-ink.md. */
const INK = {
  parch50: "#f3ebd9",
  parch100: "#e8dcc2",
  parch300: "#d0c0a6",
  parch400: "#beaf94",
  parch500: "#ad9c7f",
} as const;

/** Production stone — minimal surface lift (identity floor). */
const STONE = {
  750: "#332a1e",
  800: "#231d15",
  850: "#1b1610",
  900: "#14100b",
  950: "#0d0a07",
  carve: "#463a29",
} as const;

const GEM = { 300: "#57e0ae", 400: "#2ecb8f", 500: "#1fa372", 600: "#157a55" } as const;
const GOLD = { 400: "#e0b264" } as const;

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

/** All 11 league region crests under public/game/regions/. */
const REGIONS = [
  { name: "Misthalin", slug: "misthalin" },
  { name: "Karamja", slug: "karamja" },
  { name: "Asgarnia", slug: "asgarnia" },
  { name: "Desert", slug: "desert" },
  { name: "Fremennik", slug: "fremennik" },
  { name: "Morytania", slug: "morytania" },
  { name: "Tirannwn", slug: "tirannwn" },
  { name: "Kandarin", slug: "kandarin" },
  { name: "Anachronia", slug: "anachronia" },
  { name: "Forinthry", slug: "forinthry" },
  { name: "Havenhythe", slug: "havenhythe" },
] as const;

const REGION_SLUG: Record<string, string> = {
  Misthalin: "misthalin",
  Karamja: "karamja",
  Asgarnia: "asgarnia",
  Desert: "desert",
  Fremennik: "fremennik",
  Morytania: "morytania",
  Tirannwn: "tirannwn",
  Kandarin: "kandarin",
  Anachronia: "anachronia",
  Wilderness: "forinthry",
  Forinthry: "forinthry",
  Havenhythe: "havenhythe",
  Menaphos: "desert",
};

const EXTENDED = [
  ...FIXTURE_ROWS,
  { name: "Sample unlock I", region: "Kandarin", note: "Fixture row" },
  { name: "Sample unlock J", region: "Anachronia", note: "Fixture row" },
  { name: "Sample unlock K", region: "Havenhythe", note: "Fixture row" },
  { name: "Sample unlock L", region: "Forinthry", note: "Fixture row" },
] as const;

function crestSrc(region: string): string | null {
  const slug = REGION_SLUG[region];
  return slug ? `/game/regions/${slug}.png` : null;
}

function Crest({
  region,
  size = 16,
}: {
  region: string;
  size?: number;
}) {
  const src = crestSrc(region);
  if (!src) return null;
  return (
    // Decorative beside labelled text — empty alt so a11y name stays the region/label.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

export function HybridInkMock() {
  const [top, setTop] = useState<string>("Data");
  const branches = TREE[top] ?? TREE.Data;
  const [leaf, setLeaf] = useState(branches[0]);
  const [row, setRow] = useState(0);
  const [query, setQuery] = useState("");
  const [regionPick, setRegionPick] = useState<string>(REGIONS[0].name);

  const showRegionTree =
    (top === "Data" && leaf === "Browse / Regions") ||
    (top === "Build" && leaf === "Regions") ||
    (top === "Map" && leaf === "Picks");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows: readonly { name: string; region: string; note: string }[] = EXTENDED;
    if (showRegionTree) {
      // Forinthry crest covers fixture "Wilderness" rows
      rows =
        regionPick === "Forinthry"
          ? EXTENDED.filter(
              (r) => r.region === "Forinthry" || r.region === "Wilderness",
            )
          : EXTENDED.filter((r) => r.region === regionPick);
    }
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.region.toLowerCase().includes(q),
    );
  }, [query, showRegionTree, regionPick]);

  const selected = filtered[row] ?? filtered[0];

  return (
    <ConceptFrame
      title="H · Hybrid B — Ink First + Control Surface"
      heightClass="h-[min(820px,80vh)]"
    >
      <div
        className="flex h-full flex-col"
        style={{ background: STONE[950], color: INK.parch50 }}
      >
        {/* Top nav — gold brand only; gem active route */}
        <div
          className="flex items-center gap-4 px-3 py-2"
          style={{
            borderBottom: `1px solid ${STONE[750]}`,
            fontSize: 12,
            background: STONE[950],
          }}
        >
          <span
            className="font-display tracking-[0.16em]"
            style={{ color: GOLD[400] }}
          >
            EQUILIBRIUM
          </span>
          <ul className="flex flex-wrap gap-3">
            {TOP.map((label) => (
              <li
                key={label}
                style={{
                  color: label === top ? GEM[400] : INK.parch300,
                  fontWeight: label === top ? 600 : 400,
                }}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Thin thesis — lab only; does not steal stage height */}
        <p
          className="px-3 py-1 text-[11px] leading-4"
          style={{
            borderBottom: `1px solid ${STONE[750]}`,
            color: INK.parch400,
            background: STONE[900],
          }}
        >
          Proposal ink only · production stone · Wiki Dense type · full 3-col ·
          crests in tree + rows · fixtures labeled
        </p>

        {/* Route tabs */}
        <div
          role="tablist"
          aria-label="Primary routes"
          className="flex flex-wrap gap-1 px-2 pt-2"
          style={{ borderBottom: `1px solid ${STONE[750]}` }}
        >
          {TOP.map((t) => {
            const on = t === top;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setTop(t);
                  const next = (TREE[t] ?? TREE.Data)[0];
                  setLeaf(next);
                  setRow(0);
                  setQuery("");
                }}
                className="border px-2.5 py-1"
                style={{
                  fontSize: 12,
                  borderColor: on ? GEM[500] : "transparent",
                  background: on ? STONE[850] : "transparent",
                  color: on ? GEM[300] : INK.parch300,
                  fontWeight: on ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* SHELL: tree 220 · table flex · inspector 300 */}
        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_300px]">
          {/* Tree rail */}
          <nav
            aria-label="System tree"
            className="overflow-y-auto"
            style={{
              borderRight: `1px solid ${STONE[750]}`,
              background: STONE[900],
            }}
          >
            <p
              className="border-b px-2.5 py-1.5 font-medium"
              style={{
                borderColor: STONE[750],
                fontSize: 12,
                color: INK.parch100,
              }}
            >
              {top} tree
            </p>
            <ul className="py-1">
              {(TREE[top] ?? TREE.Data).map((item) => {
                const on = item === leaf;
                return (
                  <li key={item}>
                    <button
                      type="button"
                      onClick={() => {
                        setLeaf(item);
                        setRow(0);
                      }}
                      className="w-full px-2.5 py-1.5 text-left"
                      style={{
                        fontSize: 13,
                        background: on ? STONE[850] : "transparent",
                        color: on ? GEM[300] : INK.parch100,
                        cursor: "pointer",
                        border: "none",
                      }}
                    >
                      {item}
                    </button>
                  </li>
                );
              })}
            </ul>

            {showRegionTree ? (
              <>
                <p
                  className="border-t px-2.5 py-1.5 font-medium"
                  style={{
                    borderColor: STONE[750],
                    fontSize: 12,
                    color: INK.parch100,
                  }}
                >
                  Regions
                </p>
                <ul className="pb-2">
                  {REGIONS.map((r) => {
                    const on = r.name === regionPick;
                    return (
                      <li key={r.slug}>
                        <button
                          type="button"
                          onClick={() => {
                            setRegionPick(r.name);
                            setRow(0);
                          }}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
                          style={{
                            fontSize: 13,
                            background: on ? STONE[850] : "transparent",
                            color: on ? GEM[300] : INK.parch100,
                            cursor: "pointer",
                            border: "none",
                          }}
                        >
                          <Crest region={r.name} size={18} />
                          <span>{r.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </nav>

          {/* Table stage */}
          <section className="flex min-h-0 flex-col" style={{ background: STONE[950] }}>
            <div
              className="flex flex-wrap items-center gap-2 px-3 py-2"
              style={{ borderBottom: `1px solid ${STONE[750]}` }}
            >
              <h2 className="font-medium" style={{ fontSize: 15, color: INK.parch50 }}>
                {leaf}
                {showRegionTree ? ` · ${regionPick}` : ""}
              </h2>
              <span className="font-mono" style={{ fontSize: 11, color: INK.parch400 }}>
                {filtered.length} rows
              </span>
              <label
                className="ml-auto flex items-center gap-2"
                style={{ fontSize: 12, color: INK.parch100 }}
              >
                Filter
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setRow(0);
                  }}
                  placeholder="name or region"
                  className="w-44 border px-2 py-1"
                  style={{
                    borderColor: STONE[750],
                    background: STONE[900],
                    color: INK.parch50,
                    fontSize: 15,
                  }}
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr
                    style={{
                      borderBottom: `1px solid ${STONE[750]}`,
                      background: STONE[950],
                    }}
                  >
                    {["Name", "Region", "Note", "Qty"].map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-2 font-medium ${h === "Qty" ? "text-right" : ""}`}
                        style={{
                          fontSize: 12,
                          color: INK.parch100,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-4"
                        style={{ fontSize: 15, color: INK.parch400 }}
                      >
                        No fixture rows for this filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, i) => {
                      const on = row === i;
                      const zebra = i % 2 === 1;
                      return (
                        <tr
                          key={`${r.name}-${r.region}-${i}`}
                          onClick={() => setRow(i)}
                          className="cursor-pointer"
                          style={{
                            borderBottom: `1px solid ${STONE[750]}`,
                            background: on
                              ? STONE[850]
                              : zebra
                                ? STONE[900]
                                : STONE[950],
                            outline: on
                              ? `1px solid ${GEM[500]}`
                              : undefined,
                            outlineOffset: on ? -1 : undefined,
                          }}
                        >
                          <td
                            className="px-3 py-1.5 leading-snug"
                            style={{ fontSize: 15, color: INK.parch50 }}
                          >
                            {r.name}
                          </td>
                          <td className="px-3 py-1.5">
                            <span
                              className="inline-flex items-center gap-2 leading-snug"
                              style={{ fontSize: 15, color: INK.parch100 }}
                            >
                              <Crest region={r.region} size={16} />
                              {r.region}
                            </span>
                          </td>
                          <td
                            className="px-3 py-1.5 leading-snug"
                            style={{ fontSize: 15, color: INK.parch100 }}
                          >
                            {r.note}
                          </td>
                          <td
                            className="num px-3 py-1.5 text-right font-mono tabular-nums"
                            style={{ fontSize: 15, color: INK.parch50 }}
                          >
                            {(i + 1) * 3}
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
            className="overflow-y-auto p-3"
            style={{
              borderLeft: `1px solid ${STONE[750]}`,
              background: STONE[900],
            }}
          >
            <p
              className="font-display uppercase tracking-[0.14em]"
              style={{ fontSize: 12, color: GOLD[400] }}
            >
              Record
            </p>
            <p className="mt-2 font-medium" style={{ fontSize: 15, color: INK.parch50 }}>
              {selected?.name ?? "—"}
            </p>
            <p
              className="mt-1 inline-flex items-center gap-2"
              style={{ fontSize: 12, color: INK.parch100 }}
            >
              {selected ? <Crest region={selected.region} size={16} /> : null}
              {selected?.region ?? "—"}
            </p>

            <div
              className="mt-4 grid grid-cols-2 gap-2 pt-3"
              style={{ borderTop: `1px solid ${STONE[750]}` }}
            >
              <div
                className="p-2"
                style={{
                  background: STONE[850],
                  border: `1px solid ${STONE[750]}`,
                  boxShadow: `inset 0 1px 0 ${STONE.carve}`,
                  borderRadius: 2,
                }}
              >
                <p style={{ fontSize: 12, color: INK.parch100 }}>Key figure</p>
                <p
                  className="font-mono tabular-nums leading-none"
                  style={{ marginTop: 4, fontSize: 22, color: GEM[400] }}
                >
                  20
                </p>
              </div>
              <div
                className="p-2"
                style={{
                  background: STONE[850],
                  border: `1px solid ${STONE[750]}`,
                  boxShadow: `inset 0 1px 0 ${STONE.carve}`,
                  borderRadius: 2,
                }}
              >
                <p style={{ fontSize: 12, color: INK.parch100 }}>Sources</p>
                <p
                  className="font-mono tabular-nums leading-none"
                  style={{ marginTop: 4, fontSize: 22, color: INK.parch50 }}
                >
                  1
                </p>
              </div>
            </div>

            <dl className="mt-3 space-y-1.5 pt-3" style={{ borderTop: `1px solid ${STONE[750]}` }}>
              {[
                ["Status", "Fixture only"],
                ["Leaf", leaf],
                ["Provenance", "Lab mock"],
              ].map(([dt, dd]) => (
                <div key={dt} className="flex justify-between gap-2" style={{ fontSize: 12 }}>
                  <dt style={{ color: INK.parch400 }}>{dt}</dt>
                  <dd style={{ color: INK.parch50 }}>{dd}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 leading-5" style={{ fontSize: 12, color: INK.parch100 }}>
              Ink-first: lift parch on production stone. No mid-brown stage. Gem
              marks active only; gold stays engraved titles.
            </p>

            {/* Compact proposal ramp — evidence strip, not a second stage */}
            <div
              className="mt-3 space-y-1 pt-3 font-mono"
              style={{ borderTop: `1px solid ${STONE[750]}`, fontSize: 10 }}
            >
              <p style={{ color: GEM[300], fontSize: 11 }}>@theme parch proposal</p>
              {(
                [
                  ["50", INK.parch50],
                  ["100", INK.parch100],
                  ["300", INK.parch300],
                  ["400", INK.parch400],
                  ["500", INK.parch500],
                ] as const
              ).map(([step, hex]) => (
                <p key={step} style={{ color: hex }}>
                  parch-{step} {hex}
                </p>
              ))}
              <p style={{ color: INK.parch500 }}>on stone-850 {STONE[850]} · void kept</p>
            </div>
          </aside>
        </div>
      </div>
    </ConceptFrame>
  );
}
