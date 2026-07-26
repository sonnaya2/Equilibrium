"use client";

import type { ReactNode } from "react";

/** Shared gem-active tab chrome for Control Surface production shell. */
export function WorkbenchTabs<T extends string>({
  tabs,
  active,
  onChange,
  "aria-label": ariaLabel,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  "aria-label": string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 border-b border-stone-750"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`border-b-2 px-3 py-2 text-sm transition-colors duration-150 ${
              selected
                ? "border-gem-400 font-medium text-gem-300"
                : "border-transparent text-parch-300 hover:text-parch-50"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function WorkbenchPanel({
  id,
  active,
  children,
}: {
  id: string;
  active: string;
  children: ReactNode;
}) {
  if (id !== active) return null;
  return (
    <div role="tabpanel" aria-labelledby={`tab-${id}`} className="min-h-0 flex-1 pt-4">
      {children}
    </div>
  );
}
