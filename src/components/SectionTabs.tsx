"use client";

import type { ReactNode } from "react";

/** Gem-active tab strip. */
export function SectionTabs<T extends string>({
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
    <div role="tablist" aria-label={ariaLabel} className="ui-seg shrink-0 overflow-x-auto">
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
            className={`ui-seg__btn whitespace-nowrap${selected ? " is-active" : ""}`}
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
  clip = false,
}: {
  id: string;
  active: string;
  children: ReactNode;
  /** Browse desk owns scroll; other tabs use panel overflow-auto. */
  clip?: boolean;
}) {
  if (id !== active) return null;
  return (
    <div
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      className={
        clip
          ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden pt-1"
          : "flex h-full min-h-0 flex-1 flex-col overflow-auto overscroll-contain pt-1"
      }
    >
      {children}
    </div>
  );
}
