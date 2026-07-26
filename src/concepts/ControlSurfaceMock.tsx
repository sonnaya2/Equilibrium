"use client";

import { useMemo, useState } from "react";
import { ConceptFrame, FIXTURE_ROWS, MockNav, MockTabs } from "./ConceptFrame";

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

export function ControlSurfaceMock() {
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

  return (
    <ConceptFrame title="C · Control Surface — tree · table · inspector" heightClass="h-[min(760px,75vh)]">
      <div className="flex h-full flex-col bg-stone-950">
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

        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_300px]">
          <nav aria-label="System tree" className="overflow-y-auto border-r border-stone-750 bg-stone-900">
            <p className="border-b border-stone-750 px-2 py-1.5 text-[11px] uppercase tracking-[0.08em] text-parch-400">
              {top} tree
            </p>
            <ul className="py-1">
              {(TREE[top] ?? TREE.Data).map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => setLeaf(item)}
                    className={`w-full px-2.5 py-1.5 text-left text-[13px] ${
                      item === leaf
                        ? "bg-stone-850 text-gem-300"
                        : "text-parch-300 hover:bg-stone-850 hover:text-parch-50"
                    }`}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <section className="flex min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-750 px-3 py-2">
              <h2 className="text-sm font-medium text-parch-50">{leaf}</h2>
              <label className="ml-auto flex items-center gap-2 text-xs text-parch-400">
                Filter
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-40 border border-stone-750 bg-stone-900 px-2 py-1 text-sm text-parch-50"
                  placeholder="name or region"
                />
              </label>
            </div>
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
                  {filtered.map((r, i) => (
                    <tr
                      key={r.name}
                      onClick={() => setRow(i)}
                      className={`cursor-pointer border-b border-stone-800 ${
                        row === i ? "bg-stone-850 outline outline-1 -outline-offset-1 outline-gem-600" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-[14px] text-parch-50">{r.name}</td>
                      <td className="px-3 py-2 text-[14px] text-parch-300">{r.region}</td>
                      <td className="px-3 py-2 text-[13px] text-parch-400">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="overflow-y-auto border-l border-stone-750 p-3">
            <p className="font-display text-xs uppercase tracking-[0.14em] text-gold-400">
              Record
            </p>
            <p className="mt-2 text-base text-parch-50">{filtered[row]?.name ?? "—"}</p>
            <p className="mt-1 text-sm text-parch-300">{filtered[row]?.region}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-stone-750 pt-3">
              <div className="panel p-2">
                <p className="text-[11px] text-parch-400">Key figure</p>
                <p className="font-mono text-xl text-gem-400">20</p>
              </div>
              <div className="panel p-2">
                <p className="text-[11px] text-parch-400">Sources</p>
                <p className="font-mono text-xl text-parch-100">1</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-parch-400">
              Three columns stay on screen. Tree changes category without loading every research
              block. Table never shrinks below 14px data.
            </p>
          </aside>
        </div>
      </div>
    </ConceptFrame>
  );
}
