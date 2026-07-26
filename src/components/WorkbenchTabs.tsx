"use client";

import type { ReactNode } from "react";

/** Gem-active tab strip. */
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
    <div role="tablist" aria-label={ariaLabel} className="comp-seg">
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
            className={`comp-seg__btn${selected ? " is-active" : ""}`}
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
    <div
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      className="flex min-h-0 h-full flex-1 flex-col overflow-auto pt-1"
    >
      {children}
    </div>
  );
}
