"use client";

import { useState } from "react";
import { ConceptFrame, FIXTURE_ROWS, MockNav, MockTabs } from "./ConceptFrame";

const DATA_TABS = [
  "Browse",
  "Progression",
  "Unlocks",
  "Consumables",
  "Systems",
  "Crafting",
  "Boundaries",
] as const;

const BUILD_SEGS = ["Regions", "Relics", "Blessings", "Share"] as const;

export function LatticeBenchMock() {
  const [dataTab, setDataTab] = useState<string>("Browse");
  const [buildSeg, setBuildSeg] = useState<string>("Regions");
  const [route, setRoute] = useState<"Data" | "Build" | "Map">("Data");

  return (
    <ConceptFrame title="A · Lattice Bench — Data / Build / Map skins">
      <div className="flex h-full flex-col bg-stone-950">
        <MockNav active={route} />
        <div className="flex gap-1 border-b border-stone-750 px-2 py-1 text-[11px] text-parch-400">
          {(["Data", "Build", "Map"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoute(r)}
              className={`px-2 py-0.5 ${r === route ? "text-gem-300" : "hover:text-parch-100"}`}
            >
              preview: {r}
            </button>
          ))}
        </div>

        {route === "Data" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <MockTabs tabs={[...DATA_TABS]} active={dataTab} onChange={setDataTab} />
            <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)]">
              <aside className="overflow-y-auto border-r border-stone-750 bg-stone-900 p-2">
                <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-parch-400">
                  {dataTab} · hex rail
                </p>
                <ul className="space-y-1">
                  {FIXTURE_ROWS.slice(0, 6).map((row) => (
                    <li key={row.name}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 border border-stone-750 bg-stone-850 px-2 py-1.5 text-left text-[13px] text-parch-100 hover:border-gem-600"
                      >
                        <span
                          className="inline-block h-3 w-3 shrink-0 rotate-45 border border-gem-500 bg-stone-800"
                          aria-hidden
                        />
                        {row.region}
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
              <main className="min-h-0 overflow-auto p-3">
                <header className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-sm uppercase tracking-[0.14em] text-gold-400">
                    {dataTab}
                  </h2>
                  <span className="text-xs text-parch-400">only this panel mounted</span>
                </header>
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-750 text-xs text-parch-400">
                      <th className="py-1.5 pr-3 font-medium">Name</th>
                      <th className="py-1.5 pr-3 font-medium">Region</th>
                      <th className="py-1.5 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIXTURE_ROWS.map((row) => (
                      <tr key={row.name} className="border-b border-stone-800">
                        <td className="py-1.5 pr-3 text-parch-50">{row.name}</td>
                        <td className="py-1.5 pr-3 text-parch-300">{row.region}</td>
                        <td className="py-1.5 text-parch-400">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </main>
            </div>
          </div>
        ) : null}

        {route === "Build" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <MockTabs tabs={[...BUILD_SEGS]} active={buildSeg} onChange={setBuildSeg} />
            <div className="grid min-h-0 flex-1 place-content-start gap-2 p-3 sm:grid-cols-3">
              {Array.from({ length: 9 }, (_, i) => (
                <div
                  key={i}
                  className="panel flex aspect-[4/3] flex-col items-center justify-center gap-1 p-2 text-center"
                >
                  <span className="text-[11px] text-parch-400">
                    {buildSeg} cell {i + 1}
                  </span>
                  <span className="text-sm text-parch-100">fixture</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {route === "Map" ? (
          <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)_220px]">
            <aside className="overflow-y-auto border-r border-stone-750 p-2 text-xs">
              <p className="mb-1 text-parch-400">Picks 0/3</p>
              <button type="button" className="mb-2 text-parch-300" disabled>
                Clear picks
              </button>
              <ul className="space-y-1 text-parch-100">
                {FIXTURE_ROWS.slice(0, 5).map((r) => (
                  <li key={r.region} className="border border-stone-750 px-2 py-1">
                    {r.region}
                  </li>
                ))}
              </ul>
            </aside>
            <div className="relative bg-stone-900">
              <div className="absolute inset-3 border border-dashed border-stone-750 bg-stone-850">
                <p className="p-3 text-sm text-parch-300">Board fills remaining height</p>
              </div>
            </div>
            <aside className="overflow-y-auto border-l border-stone-750 p-2 text-xs">
              <p className="font-display tracking-[0.12em] text-gold-400">Inspector</p>
              <p className="mt-2 text-parch-300">Region detail · sources · verified fixture</p>
              <dl className="mt-3 space-y-2">
                <div>
                  <dt className="text-parch-400">Training</dt>
                  <dd className="font-mono text-base text-gem-400">12</dd>
                </div>
                <div>
                  <dt className="text-parch-400">Upgrades</dt>
                  <dd className="font-mono text-base text-gem-400">8</dd>
                </div>
              </dl>
            </aside>
          </div>
        ) : null}
      </div>
    </ConceptFrame>
  );
}
