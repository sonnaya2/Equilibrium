"use client";

import { useState } from "react";
import { ConceptFrame } from "../ConceptFrame";

/**
 * Round-2 concept — "Parchment Lift".
 * Production Tailwind tokens stay as-is. Proposed ink hexes appear only as
 * inline styles, labeled proposal, never as new @theme entries.
 */

const BEFORE = {
  parch50: "#efe7d5",
  parch100: "#d3c8b0",
  parch300: "#a99f88",
  parch400: "#948a73",
  parch500: "#8b7f68",
} as const;

/** Proposal only — not production tokens. */
const AFTER = {
  parch50: "#f2ead8",
  parch100: "#e4d8be",
  parch300: "#cdbda3",
  parch400: "#bcae93",
  parch500: "#aa9a7e",
} as const;

const STONE = {
  750: "#332a1e",
  800: "#231d15",
  850: "#1b1610",
  900: "#14100b",
  950: "#0d0a07",
  carve: "#463a29",
} as const;

const GEM = { 300: "#57e0ae", 400: "#2ecb8f", 500: "#1fa372" } as const;
const GOLD = { 400: "#e0b264" } as const;

const TABS = [
  "Browse",
  "Progression",
  "Unlocks",
  "Consumables",
  "Systems",
  "Crafting",
  "Boundaries",
] as const;

const FIXTURE = [
  { name: "Fixture ability α", region: "Misthalin", tier: "I", cost: 12 },
  { name: "Fixture ability β", region: "Karamja", tier: "II", cost: 24 },
  { name: "Fixture ability γ", region: "Asgarnia", tier: "I", cost: 18 },
  { name: "Fixture ability δ", region: "Desert", tier: "III", cost: 36 },
  { name: "Fixture ability ε", region: "Fremennik", tier: "II", cost: 28 },
  { name: "Fixture ability ζ", region: "Morytania", tier: "I", cost: 14 },
] as const;

export function ParchmentLiftMock() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Browse");
  const [selected, setSelected] = useState(0);
  const row = FIXTURE[selected] ?? FIXTURE[0];

  return (
    <ConceptFrame title="D · Parchment Lift — brighten ink, keep stone" heightClass="h-[min(820px,78vh)]">
      <div className="flex h-full flex-col" style={{ background: STONE[950], color: AFTER.parch50 }}>
        {/* Mini nav — proposal ink */}
        <div
          className="flex items-center gap-4 px-3 py-2 text-xs"
          style={{ borderBottom: `1px solid ${STONE[750]}` }}
        >
          <span
            className="font-display tracking-[0.16em]"
            style={{ color: GOLD[400] }}
          >
            EQUILIBRIUM
          </span>
          <ul className="flex flex-wrap gap-3">
            {["Overview", "Map", "Tasks", "Build", "Combat", "Data"].map((label) => (
              <li
                key={label}
                style={{
                  color: label === "Data" ? GEM[400] : AFTER.parch300,
                  fontWeight: label === "Data" ? 600 : 400,
                }}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Thesis strip */}
        <p
          className="px-3 py-1.5 text-[11px] leading-4"
          style={{
            borderBottom: `1px solid ${STONE[750]}`,
            color: AFTER.parch400,
            background: STONE[900],
          }}
        >
          Proposal ink only (inline) · stone / gem / gold unchanged · no blue chrome · body 14px ·
          labels 11px · key ≥20px
        </p>

        {/* Workbench tabs */}
        <div
          role="tablist"
          className="flex flex-wrap gap-1 px-2 pt-2"
          style={{ borderBottom: `1px solid ${STONE[750]}` }}
        >
          {TABS.map((t) => {
            const on = t === tab;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t)}
                className="border px-2.5 py-1 text-xs"
                style={
                  on
                    ? {
                        borderColor: GEM[500],
                        background: STONE[850],
                        color: GEM[300],
                      }
                    : {
                        borderColor: "transparent",
                        color: AFTER.parch300,
                      }
                }
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* Stage: table + inspector */}
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_220px]">
          <section className="flex min-h-0 flex-col overflow-hidden">
            <header
              className="flex items-center justify-between px-3 py-2"
              style={{ borderBottom: `1px solid ${STONE[750]}` }}
            >
              <h2 className="text-sm font-medium" style={{ color: AFTER.parch50 }}>
                {tab} · fixture catalog
              </h2>
              <span className="font-mono text-xs" style={{ color: AFTER.parch400 }}>
                {FIXTURE.length} rows
              </span>
            </header>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-left" style={{ fontSize: 14 }}>
                <thead style={{ position: "sticky", top: 0, background: STONE[950] }}>
                  <tr style={{ borderBottom: `1px solid ${STONE[750]}` }}>
                    {["Name", "Region", "Tier", "Cost"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 font-medium"
                        style={{
                          fontSize: 12,
                          color: AFTER.parch100,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FIXTURE.map((r, i) => {
                    const on = selected === i;
                    return (
                      <tr
                        key={r.name}
                        onClick={() => setSelected(i)}
                        className="cursor-pointer"
                        style={{
                          borderBottom: `1px solid ${STONE[800]}`,
                          background: on ? STONE[850] : "transparent",
                        }}
                      >
                        <td className="px-3 py-2" style={{ color: AFTER.parch50 }}>
                          {r.name}
                        </td>
                        <td className="px-3 py-2" style={{ color: AFTER.parch300 }}>
                          {r.region}
                        </td>
                        <td
                          className="px-3 py-2 font-mono"
                          style={{ color: AFTER.parch400 }}
                        >
                          {r.tier}
                        </td>
                        <td
                          className="px-3 py-2 font-mono tabular-nums"
                          style={{ color: AFTER.parch100 }}
                        >
                          {r.cost}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <aside
            className="overflow-y-auto p-3 text-sm"
            style={{
              borderLeft: `1px solid ${STONE[750]}`,
              background: STONE[900],
            }}
          >
            <p
              className="font-display text-xs uppercase tracking-[0.14em]"
              style={{ color: GOLD[400] }}
            >
              Inspector
            </p>
            <p className="mt-2 font-medium" style={{ color: AFTER.parch50 }}>
              {row.name}
            </p>
            <p className="mt-1 text-xs" style={{ color: AFTER.parch400 }}>
              {row.region} · fixture only
            </p>

            <div
              className="mt-4 pt-3"
              style={{ borderTop: `1px solid ${STONE[750]}` }}
            >
              <p
                className="text-[11px] uppercase tracking-[0.08em]"
                style={{ color: AFTER.parch500 }}
              >
                Cost (fixture)
              </p>
              <p
                className="font-mono tabular-nums leading-none"
                style={{
                  marginTop: 6,
                  fontSize: 28,
                  color: GEM[400],
                  fontWeight: 600,
                }}
              >
                {row.cost}
              </p>
            </div>

            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt style={{ color: AFTER.parch400 }}>Tier</dt>
                <dd className="font-mono" style={{ color: AFTER.parch100 }}>
                  {row.tier}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt style={{ color: AFTER.parch400 }}>Status</dt>
                <dd style={{ color: AFTER.parch100 }}>fixture</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt style={{ color: AFTER.parch400 }}>Sources</dt>
                <dd style={{ color: GEM[400] }}>1</dd>
              </div>
            </dl>
          </aside>
        </div>

        {/* Before / after ink swatches — sole purpose of this strip */}
        <div
          className="grid grid-cols-2 gap-0 text-[11px]"
          style={{ borderTop: `1px solid ${STONE[750]}` }}
        >
          <InkSample
            label="Before ink (production @theme)"
            ink={BEFORE}
            panel={STONE[850]}
            voidBg={STONE[950]}
          />
          <InkSample
            label="After ink (proposal · not @theme)"
            ink={AFTER}
            panel={STONE[850]}
            voidBg={STONE[950]}
            proposal
          />
        </div>
      </div>
    </ConceptFrame>
  );
}

function InkSample({
  label,
  ink,
  panel,
  voidBg,
  proposal = false,
}: {
  label: string;
  ink: typeof BEFORE | typeof AFTER;
  panel: string;
  voidBg: string;
  proposal?: boolean;
}) {
  const steps: { key: keyof typeof BEFORE; role: string }[] = [
    { key: "parch50", role: "body / primary" },
    { key: "parch100", role: "secondary" },
    { key: "parch300", role: "muted row" },
    { key: "parch400", role: "label" },
    { key: "parch500", role: "quiet label" },
  ];

  return (
    <div
      className="p-2"
      style={{
        background: voidBg,
        borderLeft: proposal ? `1px solid ${STONE[750]}` : undefined,
      }}
    >
      <p
        className="mb-1.5 font-medium"
        style={{ color: proposal ? GEM[300] : ink.parch400 }}
      >
        {label}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {(["stone-850", "stone-950"] as const).map((surf) => {
          const bg = surf === "stone-850" ? panel : voidBg;
          return (
            <div
              key={surf}
              className="p-1.5"
              style={{
                background: bg,
                border: `1px solid ${STONE[750]}`,
              }}
            >
              <p className="mb-1 font-mono" style={{ color: ink.parch500, fontSize: 10 }}>
                on {surf}
              </p>
              {steps.map(({ key, role }) => (
                <p
                  key={key}
                  style={{
                    color: ink[key],
                    fontSize: key === "parch50" || key === "parch100" ? 14 : 11,
                    lineHeight: 1.35,
                  }}
                >
                  <span className="font-mono">{ink[key]}</span>
                  <span style={{ opacity: 0.85 }}> · {role}</span>
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
