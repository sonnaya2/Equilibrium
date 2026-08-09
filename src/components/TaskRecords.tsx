"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import { RegionCrestPreload } from "@/components/RegionCrest";
import { gameIconPath } from "@/lib/gameArt";
import { TASK_PAGE_SIZE, useTasksDesk, type TaskPageStats } from "@/tasks/useTasksDesk";
import type { TaskRecord, TaskRegionId, TaskTier } from "@/tasks";
import { TaskCard, taskCardDomId } from "@/components/tasks/TaskCard";
import { TaskSidebar } from "@/components/tasks/TaskSidebar";
import { TaskWikiImportDialog } from "@/components/tasks/TaskWikiImportDialog";
import "@/components/tasks/tasks.css";

const TIER_LABEL: Record<TaskTier, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  elite: "Elite",
  master: "Master",
};

type DatasetMeta = {
  label: string;
  testingOnly: boolean;
  provisional: boolean;
  sourceUrl: string;
  wikiSyncSupported?: boolean;
  verifiedAt?: string;
  note?: string;
};

export function TaskRecords({
  records: raw,
  tiers,
  tierConfidence,
  tasksWikiUrl,
  completionLive = false,
  dataset,
  emptyMessage = "No tasks loaded.",
}: {
  records: unknown[];
  tiers: Record<string, number>;
  tierConfidence: Record<string, string>;
  tasksWikiUrl: string;
  completionLive?: boolean;
  dataset: DatasetMeta;
  emptyMessage?: string;
}) {
  const desk = useTasksDesk(raw, tiers);
  const {
    records,
    build,
    buildOnly,
    setBuildOnly,
    tier,
    setTier,
    region,
    setRegion,
    category,
    setCategory,
    skill,
    setSkill,
    status,
    setStatus,
    sort,
    setSort,
    query,
    setQuery,
    tiersInUse,
    regionRail,
    crestRegionIds,
    availableCategories,
    availableSkills,
    quickSkills,
    skillCounts,
    visible,
    pagedRecords,
    page,
    setPage,
    pageCount,
    completed,
    pinned,
    stats,
    difficultyBreakdown,
    recommendations,
    selectedId,
    setSelectedId,
    listRef,
    onToggle,
    onImportWikiTasks,
    onPin,
    taskId,
    taskPoints,
    isLeagueRegionId,
    regionDisplayName,
  } = desk;

  const selected = selectedId
    ? (visible.find((record) => taskId(record) === selectedId) ?? null)
    : null;
  const showComp = records.some((record) => typeof record.catalystCompletionRate === "number");
  const rangeStart = visible.length === 0 ? 0 : (page - 1) * TASK_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * TASK_PAGE_SIZE, visible.length);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [wikiSyncNotice, setWikiSyncNotice] = useState("");
  const wikiImportDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 700px)").matches) setFiltersOpen(false);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const handle = window.requestAnimationFrame(() => {
      document.getElementById(taskCardDomId(selectedId))?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(handle);
  }, [selectedId, page]);

  const selectTask = (record: TaskRecord) => {
    const id = taskId(record);
    const index = visible.findIndex((candidate) => taskId(candidate) === id);
    if (index >= 0) setPage(Math.floor(index / TASK_PAGE_SIZE) + 1);
    setSelectedId((current) => (current === id ? null : id));
  };

  const clearFilters = () => {
    setQuery("");
    setTier("all");
    setRegion("all");
    setCategory("all");
    setSkill("all");
    setStatus("all");
    setBuildOnly(false);
  };

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(next, 1), pageCount));
    window.requestAnimationFrame(() =>
      listRef.current?.scrollIntoView({ block: "start", behavior: "auto" }),
    );
  };

  return (
    <div className="tasks-gallery tasks-page">
      {crestRegionIds.length > 0 ? <RegionCrestPreload regionIds={crestRegionIds} /> : null}

      <header className="tasks-page__header">
        <div className="tasks-page__heading">
          <div>
            <h1>Tasks</h1>
          </div>
          <div className="tasks-page__source">
            <strong className="tasks-page__dataset">
              {dataset.provisional ? `${dataset.label} reference` : dataset.label}
            </strong>
            <span>
              {records.length.toLocaleString("en-US")} tasks
              {showComp ? ` · completion ${completionLive ? "live" : "snapshot"}` : ""}
            </span>
            <a href={dataset.sourceUrl} target="_blank" rel="noreferrer">
              Source
            </a>
          </div>
        </div>
      </header>

      <TaskStatsStrip stats={stats} />

      {records.length === 0 ? (
        <p className="tasks-page__empty">{emptyMessage}</p>
      ) : (
        <div className="tasks-workspace">
          <section className="tasks-workspace__main" aria-label="Task browser">
            <details
              className="tasks-toolbar"
              open={filtersOpen}
              onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
            >
              <summary>
                Filters
                {stats.activeFilterCount > 0 ? ` · ${stats.activeFilterCount} active` : ""}
              </summary>
              <div className="tasks-toolbar__panel">
                <div className="tasks-toolbar__primary">
                  <label className="tasks-field tasks-field--search">
                    <span>Search</span>
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search tasks"
                    />
                  </label>

                  <label className="tasks-field tasks-field--region">
                    <span>Region</span>
                    <select
                      value={region}
                      onChange={(event) => setRegion(event.target.value as TaskRegionId | "all")}
                    >
                      <option value="all">All regions</option>
                      {regionRail.map((id) => (
                        <option key={id} value={id}>
                          {regionDisplayName(id)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    className="tasks-toggle"
                    aria-pressed={buildOnly}
                    onClick={() => setBuildOnly((value) => !value)}
                  >
                    <span aria-hidden className="tasks-toggle__pip" />
                    My build only
                  </button>

                  {dataset.wikiSyncSupported ? (
                    <button
                      type="button"
                      className="tasks-import__open"
                      onClick={() => {
                        setWikiSyncNotice("");
                        wikiImportDialog.current?.showModal();
                      }}
                    >
                      Import Wiki progress
                    </button>
                  ) : null}

                  {buildOnly && build.elective.length === 0 ? (
                    <span className="tasks-toolbar__build-note">
                      Starting regions · <Link href="/build">Edit build</Link>
                    </span>
                  ) : null}
                </div>
                {dataset.wikiSyncSupported ? (
                  <p className="tasks-toolbar__wikisync-note">
                    Import uses a saved Wiki task page after{" "}
                    <a
                      href="https://runescape.wiki/w/RuneScape:WikiSync"
                      target="_blank"
                      rel="noreferrer"
                    >
                      RuneScape Wiki: “publicly available to anyone”
                    </a>
                    .
                  </p>
                ) : null}

                <div className="tasks-toolbar__secondary">
                  <fieldset className="tasks-difficulty">
                    <legend>Difficulty</legend>
                    <div>
                      {(["all", ...tiersInUse] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className="facet-chip"
                          aria-pressed={tier === option}
                          onClick={() => setTier(option)}
                        >
                          {option === "all" ? "All" : TIER_LABEL[option]}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {availableCategories.length > 0 ? (
                    <label className="tasks-field">
                      <span>Category</span>
                      <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                      >
                        <option value="all">All categories</option>
                        {availableCategories.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {availableSkills.length > 0 ? (
                    <div className="tasks-skill-filter">
                      <label className="tasks-field">
                        <span>Skill</span>
                        <select
                          aria-label="Skill filter"
                          value={skill}
                          onChange={(event) => setSkill(event.target.value)}
                        >
                          <option value="all">All skills</option>
                          {availableSkills.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                      <div className="tasks-skill-filter__quick" aria-label="Common skills">
                        {quickSkills.map((name) => (
                          <button
                            key={name}
                            type="button"
                            aria-label={`${name}, ${skillCounts.get(name) ?? 0} tasks`}
                            aria-pressed={skill === name}
                            title={name}
                            onClick={() => setSkill(skill === name ? "all" : name)}
                          >
                            <GameIcon src={gameIconPath("skills", name.toLowerCase())} size={22} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <label className="tasks-field">
                    <span>Status</span>
                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as "all" | "completed" | "unfinished")
                      }
                    >
                      <option value="all">All tasks</option>
                      <option value="unfinished">Unfinished</option>
                      <option value="completed">Completed</option>
                    </select>
                  </label>

                  {stats.activeFilterCount > 0 ? (
                    <button type="button" className="tasks-toolbar__clear" onClick={clearFilters}>
                      Clear filters
                    </button>
                  ) : null}
                </div>
              </div>
            </details>

            <div className="tasks-results" aria-live="polite">
              <div className="tasks-results__counts">
                <strong>{visible.length.toLocaleString("en-US")} results</strong>
                <span>{records.length.toLocaleString("en-US")} total</span>
                {difficultyBreakdown.map((entry) => (
                  <span key={entry.tier} className={`tasks-tier tasks-tier--${entry.tier}`}>
                    {TIER_LABEL[entry.tier]} {entry.count.toLocaleString("en-US")} (
                    {formatPercent(entry.percentage)})
                  </span>
                ))}
              </div>
              <label className="tasks-results__sort">
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as "points" | "completion" | "rarest" | "name")
                  }
                >
                  <option value="points">Best points</option>
                  {showComp ? <option value="completion">Most completed</option> : null}
                  {showComp ? <option value="rarest">Rarest</option> : null}
                  <option value="name">Task name</option>
                </select>
              </label>
            </div>

            <div ref={listRef} className="tasks-grid-wrap">
              {pagedRecords.length === 0 ? (
                <p className="tasks-page__empty">No tasks match these filters.</p>
              ) : (
                <div className="tasks-grid" aria-label="Tasks">
                  {pagedRecords.map((record) => {
                    const id = taskId(record);
                    return (
                      <TaskCard
                        key={id}
                        id={id}
                        record={record}
                        points={taskPoints(record)}
                        provisional={
                          tierConfidence[record.tier]?.startsWith("provisional") ?? false
                        }
                        done={completed.has(id)}
                        pinned={pinned.has(id)}
                        selected={selectedId === id}
                        showComp={showComp}
                        tasksWikiUrl={tasksWikiUrl}
                        isLeagueRegionId={isLeagueRegionId}
                        regionLabel={regionDisplayName(record.regionId ?? "global")}
                        onToggle={() => onToggle(id)}
                        onPin={() => onPin(id)}
                        onSelect={() => selectTask(record)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <nav className="tasks-pagination" aria-label="Task pages">
              <span>
                {rangeStart.toLocaleString("en-US")}–{rangeEnd.toLocaleString("en-US")} of{" "}
                {visible.length.toLocaleString("en-US")}
              </span>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  Previous
                </button>
                <strong>
                  Page {page} of {pageCount}
                </strong>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => goToPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </nav>
          </section>

          <TaskSidebar
            difficulty={difficultyBreakdown}
            recommendations={recommendations}
            selected={selected}
            tasksWikiUrl={tasksWikiUrl}
            taskId={taskId}
            taskPoints={taskPoints}
            regionDisplayName={regionDisplayName}
            onSelect={selectTask}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}

      {dataset.wikiSyncSupported ? (
        <TaskWikiImportDialog
          dialogRef={wikiImportDialog}
          tasksWikiUrl={tasksWikiUrl}
          records={records}
          onImportWikiTasks={onImportWikiTasks}
          notice={wikiSyncNotice}
          setNotice={setWikiSyncNotice}
        />
      ) : null}
    </div>
  );
}

function TaskStatsStrip({ stats }: { stats: TaskPageStats }) {
  const cells = [
    {
      label: "Tasks completed",
      value: `${stats.completedTasks.toLocaleString("en-US")} / ${stats.totalTasks.toLocaleString("en-US")}`,
      hint: formatPercent(stats.completionRate),
    },
    {
      label: "Total points",
      value: `${stats.completedPoints.toLocaleString("en-US")} / ${stats.totalPoints.toLocaleString("en-US")}`,
      hint: formatPercent(stats.pointCompletionRate),
    },
    {
      label: "In my build",
      value: `${stats.completedBuildTaskCount.toLocaleString("en-US")} / ${stats.buildTaskCount.toLocaleString("en-US")}`,
      hint: "Completed / available",
    },
  ];

  return (
    <dl className="tasks-stats">
      {cells.map((cell) => (
        <div key={cell.label} className="tasks-stat">
          <dt>{cell.label}</dt>
          <dd>{cell.value}</dd>
          <dd>{cell.hint}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
