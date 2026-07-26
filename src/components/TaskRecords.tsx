"use client";

import { useMemo, useState } from "react";
import {
  asTaskRecords,
  filterTasks,
  isTaskTier,
  TASK_ORDER,
  taskPoints,
  type TaskTier,
} from "@/tasks";

function formatCompletionRate(rate: number, qualifier?: "<"): string {
  const value = Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1);
  return `${qualifier ?? ""}${value}%`;
}

export function TaskRecords({
  records: raw,
  tiers,
  tierConfidence,
}: {
  records: unknown[];
  tiers: Record<string, number>;
  tierConfidence: Record<string, string>;
}) {
  const records = useMemo(() => asTaskRecords(raw), [raw]);
  const [tier, setTier] = useState<TaskTier | "all">("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => filterTasks(records, tier, query), [records, tier, query]);
  const tiersInUse = TASK_ORDER.filter((t) => records.some((r) => r.tier === t));
  const showComp = records.some((r) => typeof r.catalystCompletionRate === "number");

  if (records.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-750 pb-3">
        <div role="group" aria-label="Filter by tier" className="flex gap-1">
          {(["all", ...tiersInUse] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTier(option)}
              aria-pressed={tier === option}
              className={`rounded-sm border px-2.5 py-1 text-xs capitalize transition-colors duration-150 ${
                tier === option
                  ? "border-gem-500 bg-stone-800 text-gem-300"
                  : "border-stone-750 text-parch-300 hover:text-parch-50"
              }`}
            >
              {option === "all" ? "All" : option}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter tasks"
          aria-label="Filter tasks"
          className="min-w-40 flex-1 border border-stone-750 bg-transparent px-2 py-1 text-xs text-parch-50 placeholder:text-parch-400"
        />
        <span className="text-xs text-parch-300">
          {visible.length} of {records.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="border-b border-stone-750/70 py-3 text-sm text-parch-300">No tasks match.</p>
      ) : (
        <>
          {showComp ? (
            <div
              className="hidden gap-2 border-b border-stone-750/70 py-2 text-[10px] uppercase tracking-wide text-parch-400 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6"
              aria-hidden
            >
              <div>Task</div>
              <div className="flex gap-5 sm:justify-end">
                <div className="min-w-14 text-right">Comp%</div>
                <div className="min-w-14 text-right">Pts</div>
              </div>
            </div>
          ) : null}
          {visible.map((record, index) => {
            const points = taskPoints(record, tiers);
            const provisional = tierConfidence[record.tier]?.startsWith("provisional");
            const rate =
              typeof record.catalystCompletionRate === "number"
                ? record.catalystCompletionRate
                : null;

            return (
              <div
                key={`${record.name}-${index}`}
                className="grid gap-2 border-b border-stone-750/70 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6"
              >
                <div>
                  <div className="text-sm text-parch-50">
                    {record.name}
                    {isTaskTier(record.tier) ? (
                      <span className="ml-2 text-xs capitalize text-parch-300">{record.tier}</span>
                    ) : null}
                  </div>
                  {record.description ? (
                    <p className="mt-1 text-xs leading-5 text-parch-300">{record.description}</p>
                  ) : null}
                  {record.requirements ? (
                    <p className="mt-1 text-[11px] leading-5 text-parch-400">Requires: {record.requirements}</p>
                  ) : null}
                  {record.region || record.skills?.length || record.areas?.length ? (
                    <div className="mt-1 text-[11px] text-parch-400">
                      {[record.region, ...(record.skills ?? []), ...(record.areas ?? [])]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-start gap-5 sm:justify-end">
                  {showComp ? (
                    <div className="min-w-14 sm:text-right">
                      {rate !== null ? (
                        <div className="font-mono text-sm text-parch-50">
                          {formatCompletionRate(rate, record.catalystCompletionRateQualifier)}
                        </div>
                      ) : (
                        <div className="font-mono text-sm text-parch-400">—</div>
                      )}
                      <div className="mt-0.5 text-[10px] leading-4 text-parch-400 sm:hidden">Comp%</div>
                    </div>
                  ) : null}
                  {points !== null ? (
                    <div className="min-w-14 sm:text-right">
                      <span className="font-mono text-sm text-parch-50">{points}</span>
                      <span className="ml-1 text-xs text-parch-300">pts{provisional ? "*" : ""}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
