"use client";

import { useState } from "react";
import { ConceptFrame, FIXTURE_ROWS, MockNav } from "./ConceptFrame";

const DATA_RAIL = [
  "Browse",
  "Progression",
  "Unlocks",
  "Consumables",
  "Systems",
  "Archaeology",
  "Masterwork",
  "Boundaries",
] as const;

const TASK_RAIL = ["Easy", "Medium", "Hard", "Elite", "Master"] as const;
const BUILD_RAIL = ["Regions", "Relics", "Blessings", "Share"] as const;

export function WarTableMock() {
  const [preview, setPreview] = useState<"Data" | "Tasks" | "Build">("Data");
  const [dataRail, setDataRail] = useState<string>("Browse");
  const [taskRail, setTaskRail] = useState<string>("Easy");
  const [buildRail, setBuildRail] = useState<string>("Regions");
  const [selected, setSelected] = useState(0);

  const railItems =
    preview === "Data" ? DATA_RAIL : preview === "Tasks" ? TASK_RAIL : BUILD_RAIL;
  const activeRail =
    preview === "Data" ? dataRail : preview === "Tasks" ? taskRail : buildRail;
  const setRail =
    preview === "Data" ? setDataRail : preview === "Tasks" ? setTaskRail : setBuildRail;

  return (
    <ConceptFrame title="B · War Table — rail + stage + inspector">
      <div className="flex h-full flex-col bg-stone-950">
        <MockNav active={preview === "Data" ? "Data" : preview} />
        <div className="flex gap-1 border-b border-stone-750 px-2 py-1 text-[11px] text-parch-400">
          {(["Data", "Tasks", "Build"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setPreview(r)}
              className={`px-2 py-0.5 ${r === preview ? "text-gem-300" : "hover:text-parch-100"}`}
            >
              preview: {r}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[200px_minmax(0,1fr)_240px]">
          <nav
            aria-label="Category rail"
            className="overflow-y-auto border-r border-stone-750 bg-stone-900"
          >
            <p className="border-b border-stone-750 px-2 py-1.5 text-[11px] uppercase tracking-[0.08em] text-parch-400">
              {preview === "Data" ? "Research" : preview === "Tasks" ? "Tiers" : "Plan"}
            </p>
            <ul>
              {railItems.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => setRail(item)}
                    className={`w-full border-l-2 px-2.5 py-2 text-left text-[13px] ${
                      item === activeRail
                        ? "border-gem-400 bg-stone-850 text-parch-50"
                        : "border-transparent text-parch-300 hover:bg-stone-850 hover:text-parch-50"
                    }`}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section className="flex min-h-0 flex-col overflow-hidden">
            <header className="flex items-center justify-between border-b border-stone-750 px-3 py-2">
              <h2 className="text-sm font-medium text-parch-50">
                {preview === "Data"
                  ? activeRail
                  : preview === "Tasks"
                    ? `${activeRail} tasks`
                    : `${activeRail} plan`}
              </h2>
              <span className="font-mono text-xs text-parch-400">
                {FIXTURE_ROWS.length} rows · stage fill
              </span>
            </header>
            {preview === "Build" && activeRail === "Share" ? (
              <div className="p-3 text-sm text-parch-300">Share link strip · fixture URL only</div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-stone-950">
                    <tr className="border-b border-stone-750 text-xs text-parch-400">
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Region</th>
                      <th className="px-3 py-2 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIXTURE_ROWS.map((row, i) => (
                      <tr
                        key={row.name}
                        onClick={() => setSelected(i)}
                        className={`cursor-pointer border-b border-stone-800 ${
                          selected === i ? "bg-stone-850" : "hover:bg-stone-900"
                        }`}
                      >
                        <td className="px-3 py-2 text-parch-50">{row.name}</td>
                        <td className="px-3 py-2 text-parch-300">{row.region}</td>
                        <td className="px-3 py-2 text-parch-400">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="overflow-y-auto border-l border-stone-750 bg-stone-900 p-3 text-sm">
            <p className="font-display text-xs uppercase tracking-[0.14em] text-gold-400">
              Inspector
            </p>
            <p className="mt-2 text-parch-50">{FIXTURE_ROWS[selected]?.name}</p>
            <p className="mt-1 text-xs text-parch-400">{FIXTURE_ROWS[selected]?.region}</p>
            <dl className="mt-4 space-y-2 border-t border-stone-750 pt-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-parch-400">Status</dt>
                <dd className="text-parch-100">fixture</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-parch-400">Sources</dt>
                <dd className="text-gem-400">1</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-parch-400">
              Head-still: pick on the left, scan the stage, read detail without scrolling the whole
              page.
            </p>
          </aside>
        </div>
      </div>
    </ConceptFrame>
  );
}
