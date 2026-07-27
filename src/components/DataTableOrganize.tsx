"use client";

/**
 * Shared A–Z / Z–A sort + multi type toggles for Data workbench tables.
 */

import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export function compareLocale(a: string, b: string, dir: SortDir = "asc"): number {
  const c = a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
  return dir === "asc" ? c : -c;
}

export function sortByLabel<T>(rows: readonly T[], label: (row: T) => string, dir: SortDir): T[] {
  return [...rows].sort((a, b) => compareLocale(label(a), label(b), dir));
}

/** null activeTypes = no type filter (show all). Empty set = show nothing. */
export function filterByType<T>(
  rows: readonly T[],
  typeOf: (row: T) => string,
  activeTypes: ReadonlySet<string> | null,
): T[] {
  if (!activeTypes) return [...rows];
  if (activeTypes.size === 0) return [];
  return rows.filter((row) => activeTypes.has(typeOf(row) || "—"));
}

export function uniqueTypes<T>(rows: readonly T[], typeOf: (row: T) => string): string[] {
  const set = new Set<string>();
  for (const row of rows) set.add(typeOf(row) || "—");
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function useDataTableOrganize<T>({
  rows,
  labelOf,
  typeOf,
  defaultDir = "asc",
}: {
  rows: readonly T[];
  labelOf: (row: T) => string;
  typeOf?: (row: T) => string;
  defaultDir?: SortDir;
}) {
  const [dir, setDir] = useState<SortDir>(defaultDir);
  /** null = all types */
  const [activeTypes, setActiveTypes] = useState<Set<string> | null>(null);

  const typeOptions = useMemo(() => (typeOf ? uniqueTypes(rows, typeOf) : []), [rows, typeOf]);

  const organized = useMemo(() => {
    const typed = typeOf ? filterByType(rows, typeOf, activeTypes) : [...rows];
    return sortByLabel(typed, labelOf, dir);
  }, [rows, labelOf, typeOf, activeTypes, dir]);

  const toggleDir = () => setDir((d) => (d === "asc" ? "desc" : "asc"));

  const toggleType = (type: string) => {
    setActiveTypes((prev) => {
      // First click leaves "all" mode into a single-type filter.
      if (prev === null) return new Set([type]);
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      // All selected again → treat as all.
      if (typeOptions.length > 0 && typeOptions.every((t) => next.has(t))) return null;
      return next;
    });
  };

  const clearTypes = () => setActiveTypes(null);

  return {
    dir,
    setDir,
    toggleDir,
    typeOptions,
    activeTypes,
    toggleType,
    clearTypes,
    organized,
  };
}

export function DataTableOrganizeBar({
  dir,
  onToggleDir,
  typeOptions,
  activeTypes,
  onToggleType,
  onClearTypes,
  typeLabel = "Type",
}: {
  dir: SortDir;
  onToggleDir: () => void;
  typeOptions?: string[];
  activeTypes?: ReadonlySet<string> | null;
  onToggleType?: (type: string) => void;
  onClearTypes?: () => void;
  typeLabel?: string;
}) {
  const hasTypes = Boolean(typeOptions && typeOptions.length > 1 && onToggleType);
  const allOn = activeTypes == null;

  return (
    <div className="data-organize" role="group" aria-label="Sort and filter">
      <button
        type="button"
        className="data-organize__sort"
        onClick={onToggleDir}
        aria-label={
          dir === "asc" ? "Sort A to Z. Activate for Z to A." : "Sort Z to A. Activate for A to Z."
        }
        title={dir === "asc" ? "A–Z · click for Z–A" : "Z–A · click for A–Z"}
      >
        <span className="data-organize__sort-label">{dir === "asc" ? "A–Z" : "Z–A"}</span>
        <span className="data-organize__arrow" aria-hidden>
          {dir === "asc" ? "↓" : "↑"}
        </span>
      </button>

      {hasTypes ? (
        <div className="data-organize__types" role="group" aria-label={typeLabel}>
          <button
            type="button"
            className={`data-organize__type${allOn ? " is-on" : ""}`}
            aria-pressed={allOn}
            onClick={onClearTypes}
          >
            All
          </button>
          {typeOptions!.map((type) => {
            const on = !allOn && Boolean(activeTypes?.has(type));
            return (
              <button
                key={type}
                type="button"
                className={`data-organize__type${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => onToggleType!(type)}
              >
                {type}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
