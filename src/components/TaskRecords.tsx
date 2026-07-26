"use client";

import { useEffect, useMemo, useState } from "react";
import {
  asTaskRecords,
  filterTasks,
  isTaskTier,
  TASK_ORDER,
  taskPoints,
  type TaskTier,
} from "@/tasks";
import {
  completedCount,
  EMPTY_PROGRESS,
  isComplete,
  loadProgress,
  pointsEarned,
  pointsTotal,
  saveProgress,
  taskId,
  toggleComplete,
  type TaskProgress,
} from "@/tasks/progress";

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
  const [progress, setProgress] = useState<TaskProgress>(EMPTY_PROGRESS);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const visible = useMemo(() => filterTasks(records, tier, query), [records, tier, query]);
  const tiersInUse = TASK_ORDER.filter((t) => records.some((r) => r.tier === t));
  const showComp = records.some((r) => typeof r.catalystCompletionRate === "number");

  const doneVisible = completedCount(progress, visible);
  const earnedVisible = pointsEarned(progress, visible, tiers);
  const totalVisible = pointsTotal(visible, tiers);

  const onToggle = (id: string) => {
    setProgress((prev) => {
      const next = toggleComplete(prev, id);
      saveProgress(next);
      return next;
    });
  };

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
                  : "border-stone-750 text-parch-100 hover:text-parch-50"
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
          className="field-inset min-w-40 flex-1 px-2 py-1.5 text-sm text-parch-50 placeholder:text-parch-400"
        />
        <span className="text-sm text-parch-100">
          {visible.length} of {records.length}
          {totalVisible > 0 ? (
            <>
              {" · "}
              <span className="text-gem-300">
                {earnedVisible}/{totalVisible} pts
              </span>
              {doneVisible > 0 ? (
                <span className="text-parch-300">
                  {" "}
                  ({doneVisible} done)
                </span>
              ) : null}
            </>
          ) : null}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="border-b border-stone-750/70 py-3 text-sm text-parch-100">No tasks match.</p>
      ) : (
        <>
          {showComp ? (
            <div
              className="hidden gap-2 border-b border-stone-750/70 py-2 text-xs uppercase tracking-wide text-parch-100 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-6"
              aria-hidden
            >
              <div className="w-5" />
              <div>Task</div>
              <div className="flex gap-5 sm:justify-end">
                <div className="min-w-14 text-right">Comp%</div>
                <div className="min-w-14 text-right">Pts</div>
              </div>
            </div>
          ) : null}
          {visible.map((record, index) => {
            const id = taskId(record);
            const domId = `task-${index}-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
            const done = isComplete(progress, id);
            const points = taskPoints(record, tiers);
            const provisional = tierConfidence[record.tier]?.startsWith("provisional");
            const rate =
              typeof record.catalystCompletionRate === "number"
                ? record.catalystCompletionRate
                : null;

            return (
              <div
                key={`${id}-${index}`}
                className={`grid gap-2 border-b border-stone-750/70 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-6 ${
                  done ? "opacity-90" : ""
                }`}
              >
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    id={domId}
                    checked={done}
                    onChange={() => onToggle(id)}
                    className="h-3.5 w-3.5 accent-[var(--color-gem-500)]"
                    aria-label={done ? `Mark incomplete: ${record.name}` : `Mark complete: ${record.name}`}
                  />
                </div>
                <div>
                  <label htmlFor={domId} className="cursor-pointer">
                    <div className={`text-sm ${done ? "text-gem-300" : "text-parch-50"}`}>
                      {record.name}
                      {isTaskTier(record.tier) ? (
                        <span className="ml-2 text-xs capitalize text-parch-100">{record.tier}</span>
                      ) : null}
                    </div>
                  </label>
                  {record.description ? (
                    <p className="mt-1 text-sm leading-5 text-parch-100">{record.description}</p>
                  ) : null}
                  {record.requirements ? (
                    <p className="mt-1 text-xs leading-5 text-parch-100">Requires: {record.requirements}</p>
                  ) : null}
                  {record.region || record.skills?.length || record.areas?.length ? (
                    <div className="mt-1 text-xs text-parch-100">
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
                        <div className="font-mono text-sm text-parch-300">—</div>
                      )}
                      <div className="mt-0.5 text-[11px] leading-4 text-parch-100 sm:hidden">Comp%</div>
                    </div>
                  ) : null}
                  {points !== null ? (
                    <div className="min-w-14 sm:text-right">
                      <span className={`font-mono text-sm ${done ? "text-gem-300" : "text-parch-50"}`}>
                        {points}
                      </span>
                      <span className="ml-1 text-xs text-parch-100">pts{provisional ? "*" : ""}</span>
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
