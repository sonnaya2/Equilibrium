"use client";

import type { ReactNode } from "react";

/** Isolated full-bleed mock frame — owns every pixel inside (no product nav). */
export function ConceptFrame({
  title,
  children,
  heightClass = "h-[min(720px,70vh)]",
}: {
  title: string;
  children: ReactNode;
  heightClass?: string;
}) {
  return (
    <figure className="border border-stone-750 bg-stone-950">
      <figcaption className="flex items-center justify-between border-b border-stone-750 px-3 py-1.5 text-xs text-parch-400">
        <span className="font-medium text-parch-100">{title}</span>
        <span className="text-parch-500">fixture mock · not live data</span>
      </figcaption>
      <div className={`${heightClass} overflow-hidden text-parch-50`}>{children}</div>
    </figure>
  );
}

export function MockNav({ active }: { active: string }) {
  const links = ["Overview", "Map", "Tasks", "Build", "Combat", "Data"];
  return (
    <div className="flex items-center gap-4 border-b border-stone-750 px-3 py-2 text-xs">
      <span className="font-display tracking-[0.16em] text-gold-400">EQUILIBRIUM</span>
      <ul className="flex flex-wrap gap-3">
        {links.map((label) => (
          <li
            key={label}
            className={label === active ? "font-medium text-gem-400" : "text-parch-300"}
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MockTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-stone-750 px-2 pt-2">
      {tabs.map((tab) => {
        const selected = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab)}
            className={`border px-2.5 py-1 text-xs ${
              selected
                ? "border-gem-500 bg-stone-850 text-gem-300"
                : "border-transparent text-parch-300 hover:text-parch-50"
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

/** Fixture rows only — labeled as demo, not published league facts. */
export const FIXTURE_ROWS = [
  { name: "Sample unlock A", region: "Misthalin", note: "Fixture row" },
  { name: "Sample unlock B", region: "Karamja", note: "Fixture row" },
  { name: "Sample unlock C", region: "Asgarnia", note: "Fixture row" },
  { name: "Sample unlock D", region: "Desert", note: "Fixture row" },
  { name: "Sample unlock E", region: "Fremennik", note: "Fixture row" },
  { name: "Sample unlock F", region: "Morytania", note: "Fixture row" },
  { name: "Sample unlock G", region: "Tirannwn", note: "Fixture row" },
  { name: "Sample unlock H", region: "Wilderness", note: "Fixture row" },
] as const;
