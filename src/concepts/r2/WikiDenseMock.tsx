"use client";

import { useMemo, useState } from "react";
import {
  ConceptFrame,
  FIXTURE_ROWS,
  MockNav,
} from "@/concepts/ConceptFrame";

/**
 * Round 2 · Agent F · Wiki Dense
 * RuneScape Wiki dark-mode lesson: brighter body ink, real zebra, 15px data,
 * 12px labels that still pass contrast, gem only on the active control.
 * Warm umber ground only — no slate cyber.
 */

const TABS = ["Browse", "Progression", "Unlocks", "Systems"] as const;

const EXTENDED = [
  ...FIXTURE_ROWS,
  { name: "Sample unlock I", region: "Kandarin", note: "Fixture row" },
  { name: "Sample unlock J", region: "Menaphos", note: "Fixture row" },
  { name: "Sample unlock K", region: "Anachronia", note: "Fixture row" },
  { name: "Sample unlock L", region: "Misthalin", note: "Fixture row" },
] as const;

/** Type-scale chips — call out the contract on the mock itself. */
function ScaleChip({ label, size }: { label: string; size: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-stone-750 bg-stone-900 px-1.5 py-0.5 font-mono text-[10px] leading-none text-parch-300">
      <span className="text-parch-100">{size}</span>
      <span className="text-parch-400">{label}</span>
    </span>
  );
}

export function WikiDenseMock() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Browse");
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

  return (
    <ConceptFrame
      title="F · Wiki Dense — brighter ink · zebra · sticky head"
      heightClass="h-[min(780px,78vh)]"
    >
      <div className="flex h-full flex-col bg-stone-950">
        <MockNav active="Data" />

        {/* Type-scale legend — product would never ship this strip; lab only */}
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-750 bg-stone-900 px-3 py-1.5">
          <span className="text-[11px] uppercase tracking-[0.08em] text-parch-300">
            Type scale
          </span>
          <ScaleChip size="15px" label="data" />
          <ScaleChip size="12px" label="labels" />
          <ScaleChip size="11px" label="meta · floor" />
          <ScaleChip size="20px+" label="key figure" />
          <span className="ml-auto font-mono text-[10px] text-parch-300">
            body ink → parch-50 · zebra → stone-900/950 · active → gem-300
          </span>
        </div>

        {/* Tabs: stronger gem only on selected — not gold, not path-blue */}
        <div
          role="tablist"
          aria-label="Data categories"
          className="flex flex-wrap gap-1 border-b border-stone-750 px-2 pt-2"
        >
          {TABS.map((t) => {
            const selected = t === tab;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setTab(t);
                  setRow(0);
                }}
                className={`border px-2.5 py-1 text-[12px] ${
                  selected
                    ? "border-gem-500 bg-stone-850 font-medium text-gem-300"
                    : "border-transparent text-parch-100 hover:text-parch-50"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)_280px]">
          {/* Tree rail — denser labels still ≥12px for primary leaves */}
          <nav
            aria-label="Category tree"
            className="overflow-y-auto border-r border-stone-750 bg-stone-900"
          >
            <p className="border-b border-stone-750 px-2.5 py-1.5 text-[12px] font-medium text-parch-100">
              {tab} · tree
            </p>
            <ul className="py-1">
              {["Regions", "Skills", "Tracks", "Sources"].map((item, i) => (
                <li key={item}>
                  <button
                    type="button"
                    className={`w-full px-2.5 py-1.5 text-left text-[13px] ${
                      i === 0
                        ? "bg-stone-850 text-gem-300"
                        : "text-parch-100 hover:bg-stone-850 hover:text-parch-50"
                    }`}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-stone-750 px-2.5 py-2 text-[11px] leading-4 text-parch-300">
              Inactive leaves stay unmounted. 12px rail labels beat 11px murk.
            </p>
          </nav>

          {/* Table stage — sticky head, zebra, 15px data, hairline edges */}
          <section className="flex min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-750 px-3 py-2">
              <h2 className="text-[15px] font-medium text-parch-50">
                {tab} · Regions
              </h2>
              <span className="font-mono text-[11px] text-parch-300">
                {filtered.length} rows
              </span>
              <label className="ml-auto flex items-center gap-2 text-[12px] text-parch-100">
                Filter
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setRow(0);
                  }}
                  className="w-44 border border-stone-750 bg-stone-900 px-2 py-1 text-[15px] text-parch-50 placeholder:text-parch-300"
                  placeholder="name or region"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-[1]">
                  <tr className="border-b border-stone-750 bg-stone-950">
                    <th className="px-3 py-2 text-[12px] font-medium tracking-[0.04em] text-parch-100">
                      Name
                    </th>
                    <th className="px-3 py-2 text-[12px] font-medium tracking-[0.04em] text-parch-100">
                      Region
                    </th>
                    <th className="px-3 py-2 text-[12px] font-medium tracking-[0.04em] text-parch-100">
                      Note
                    </th>
                    <th className="px-3 py-2 text-right text-[12px] font-medium tracking-[0.04em] text-parch-100">
                      Qty
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const selected = row === i;
                    const zebra = i % 2 === 1;
                    return (
                      <tr
                        key={`${r.name}-${r.region}`}
                        onClick={() => setRow(i)}
                        className={`cursor-pointer border-b border-stone-750 ${
                          selected
                            ? "bg-stone-850 outline outline-1 -outline-offset-1 outline-gem-500"
                            : zebra
                              ? "bg-stone-900"
                              : "bg-stone-950"
                        }`}
                      >
                        <td className="px-3 py-1.5 text-[15px] leading-snug text-parch-50">
                          {r.name}
                        </td>
                        <td className="px-3 py-1.5 text-[15px] leading-snug text-parch-50">
                          {r.region}
                        </td>
                        <td className="px-3 py-1.5 text-[15px] leading-snug text-parch-100">
                          {r.note}
                        </td>
                        <td className="num px-3 py-1.5 text-right text-[15px] text-parch-50">
                          {(i + 1) * 3}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Inspector — key figure ≥20px gem; labels 12px bright enough */}
          <aside className="overflow-y-auto border-l border-stone-750 bg-stone-900 p-3">
            <p className="font-display text-[12px] uppercase tracking-[0.14em] text-gold-400">
              Record
            </p>
            <p className="mt-2 text-[15px] font-medium text-parch-50">
              {filtered[row]?.name ?? "—"}
            </p>
            <p className="mt-0.5 text-[12px] text-parch-100">
              {filtered[row]?.region ?? "—"}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-stone-750 pt-3">
              <div className="panel p-2">
                <p className="text-[12px] text-parch-100">Key figure</p>
                <p className="font-mono text-[22px] leading-none text-gem-400">
                  20
                </p>
              </div>
              <div className="panel p-2">
                <p className="text-[12px] text-parch-100">Sources</p>
                <p className="font-mono text-[22px] leading-none text-parch-50">
                  1
                </p>
              </div>
            </div>

            <dl className="mt-3 space-y-1.5 border-t border-stone-750 pt-3">
              <div className="flex justify-between gap-2 text-[12px]">
                <dt className="text-parch-100">Status</dt>
                <dd className="text-parch-50">Fixture only</dd>
              </div>
              <div className="flex justify-between gap-2 text-[12px]">
                <dt className="text-parch-100">Provenance</dt>
                <dd className="text-parch-50">Lab mock</dd>
              </div>
              <div className="flex justify-between gap-2 text-[12px]">
                <dt className="text-parch-100">Verified</dt>
                <dd className="font-mono text-parch-50">—</dd>
              </div>
            </dl>

            <p className="mt-4 text-[12px] leading-5 text-parch-100">
              Wiki lesson: raise body luminance first, then separate rows. Gem
              marks the active tab/row only — gold stays engraved titles.
            </p>
          </aside>
        </div>
      </div>
    </ConceptFrame>
  );
}
