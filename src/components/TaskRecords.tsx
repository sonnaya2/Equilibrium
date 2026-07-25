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

  if (records.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-750 pb-3">
        <div className="flex gap-1">
          {(["all", ...tiersInUse] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTier(option)}
              className={`border px-2.5 py-1 text-xs capitalize ${
                tier === option
                  ? "border-stone-700 bg-stone-850 text-parch-50"
                  : "border-stone-750 text-parch-300 hover:bg-white/[0.02] hover:text-parch-50"
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
          className="min-w-40 flex-1 border border-stone-750 bg-transparent px-2 py-1 text-xs text-parch-50 placeholder:text-parch-400"
        />
        <span className="text-xs text-parch-300">
          {visible.length} of {records.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="border-b border-stone-750/70 py-3 text-sm text-parch-300">No tasks match.</p>
      ) : (
        visible.map((record, index) => {
          const points = taskPoints(record, tiers);
          const provisional = tierConfidence[record.tier]?.startsWith("provisional");
          const hasCatalystCompletionRate = typeof record.catalystCompletionRate === "number";

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
                {hasCatalystCompletionRate ? (
                  <div className="min-w-28 sm:text-right">
                    <div className="font-mono text-sm text-parch-50">
                      {formatCompletionRate(record.catalystCompletionRate!, record.catalystCompletionRateQualifier)}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-4 text-parch-400">Catalyst completion rate</div>
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
        })
      )}
    </div>
  );
}
