"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GameIcon } from "@/components/GameIcon";
import { RegionCrest, RegionCrestPreload } from "@/components/RegionCrest";
import {
  formatCompRate,
  TASK_PAGE_SIZE,
  taskSkillNames,
  useTasksDesk,
  wikiTaskUrl,
  type DifficultyAggregate,
  type TaskPageStats,
} from "@/tasks/useTasksDesk";
import { gameIconPath, worldMapIconPath } from "@/lib/gameArt";
import { loadState, saveState } from "@/lib/storage";
import { parseWikiTaskPage } from "@/tasks/progress";
import type { TaskRecord, TaskRegionId, TaskTier } from "@/tasks";

const RSN_STORAGE_KEY = "eq:tasks:rsn:v1";
const MAX_WIKI_HTML_BYTES = 25 * 1024 * 1024;

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
    ? visible.find((record) => taskId(record) === selectedId) ?? null
    : null;
  const showComp = records.some(
    (record) => typeof record.catalystCompletionRate === "number",
  );
  const rangeStart = visible.length === 0 ? 0 : (page - 1) * TASK_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * TASK_PAGE_SIZE, visible.length);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [rsn, setRsn] = useState("");
  const [wikiSyncNotice, setWikiSyncNotice] = useState("");
  const wikiHtmlInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 700px)").matches) setFiltersOpen(false);
    setRsn(loadState(RSN_STORAGE_KEY, "", (raw) =>
      typeof raw === "string" ? raw.slice(0, 12) : "",
    ));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const handle = window.requestAnimationFrame(() => {
      document.getElementById(taskCardDomId(selectedId))?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
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

  const openWikiSync = () => {
    const playerName = rsn.trim().replace(/\s+/g, " ");
    if (!playerName) {
      setWikiSyncNotice("Enter your RuneScape name first.");
      return;
    }
    setRsn(playerName);
    saveState(RSN_STORAGE_KEY, playerName);
    window.open(tasksWikiUrl, "_blank", "noopener,noreferrer");
    setWikiSyncNotice("WikiSync opened. Paste your name, look it up, then save the page.");
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(playerName).then(
        () => setWikiSyncNotice("Name copied. Paste it into WikiSync, look it up, then save the page."),
        () => undefined,
      );
    }
  };

  const importWikiHtml = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_WIKI_HTML_BYTES) {
      setWikiSyncNotice("That HTML file is too large.");
      return;
    }

    try {
      const parsed = parseWikiTaskPage(await file.text());
      if (parsed.taskRows === 0) {
        setWikiSyncNotice("That file is not a saved Wiki task page.");
        return;
      }
      if (parsed.completedTaskIds.length === 0) {
        setWikiSyncNotice("No WikiSync completions found. Run the lookup before saving.");
        return;
      }

      const knownWikiIds = new Set(
        records.flatMap((record) =>
          typeof record.wikiTaskId === "number" ? [record.wikiTaskId] : [],
        ),
      );
      const matched = parsed.completedTaskIds.filter((id) => knownWikiIds.has(id)).length;
      if (matched === 0) {
        setWikiSyncNotice("No tasks in that file match this task list.");
        return;
      }
      if (
        !window.confirm(
          `Mark ${matched.toLocaleString()} Wiki ${matched === 1 ? "task" : "tasks"} complete?`,
        )
      ) return;

      const imported = onImportWikiTasks(parsed.completedTaskIds);
      setWikiSyncNotice(
        imported.added > 0
          ? `${imported.added.toLocaleString()} ${imported.added === 1 ? "task" : "tasks"} imported · ${imported.matched.toLocaleString()} matched.`
          : `All ${imported.matched.toLocaleString()} matched tasks were already complete.`,
      );
    } catch {
      setWikiSyncNotice("Could not read that HTML file.");
    }
  };

  return (
    <div className="tasks-gallery tasks-page">
      {crestRegionIds.length > 0 ? (
        <RegionCrestPreload regionIds={crestRegionIds} />
      ) : null}

      <header className="tasks-page__header">
        <div className="tasks-page__heading">
          <div>
            <h1>Tasks</h1>
          </div>
          <div className="tasks-page__source">
            <strong className="tasks-page__dataset">
              {dataset.provisional ? `${dataset.label} baseline` : dataset.label}
            </strong>
            <span>
              {records.length.toLocaleString()} tasks
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

                  {dataset.wikiSyncSupported ? (
                    <div className="tasks-wikisync">
                      <label className="tasks-field tasks-field--rsn">
                        <span>RuneScape name</span>
                        <input
                          type="text"
                          value={rsn}
                          maxLength={12}
                          spellCheck={false}
                          onChange={(event) => {
                            setRsn(event.target.value);
                            setWikiSyncNotice("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") openWikiSync();
                          }}
                          placeholder="Display name"
                        />
                      </label>
                      <button
                        type="button"
                        className="tasks-wikisync__open"
                        title="Copy your name and open the official Wiki task list"
                        onClick={openWikiSync}
                      >
                        Open WikiSync
                      </button>
                      <button
                        type="button"
                        className="tasks-wikisync__import"
                        title="Import completed tasks from a saved Wiki task page"
                        onClick={() => wikiHtmlInput.current?.click()}
                      >
                        Import saved page
                      </button>
                      <input
                        ref={wikiHtmlInput}
                        hidden
                        type="file"
                        accept=".html,.htm,text/html"
                        aria-label="Import saved Wiki page"
                        onChange={(event) => {
                          const input = event.currentTarget;
                          void importWikiHtml(input.files?.[0]).finally(() => {
                            input.value = "";
                          });
                        }}
                      />
                      <details className="tasks-wikisync__guide">
                        <summary>How to import</summary>
                        <ol>
                          <li>Enter your name, then choose Open WikiSync.</li>
                          <li>
                            Paste it into Display name and choose Look up. Wait for completed rows to
                            turn green.
                          </li>
                          <li>Press Ctrl+S (⌘S on Mac) and save the page as an .html file.</li>
                          <li>Come back here, choose Import saved page, and select the file.</li>
                        </ol>
                      </details>
                      {wikiSyncNotice ? (
                        <span className="tasks-wikisync__notice" role="status">
                          {wikiSyncNotice}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <label className="tasks-field">
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

                  {buildOnly && build.elective.length === 0 ? (
                    <span className="tasks-toolbar__build-note">
                      Starting regions · <Link href="/build">Edit build</Link>
                    </span>
                  ) : null}
                </div>

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
                      <select value={category} onChange={(event) => setCategory(event.target.value)}>
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
                <strong>{visible.length.toLocaleString()} results</strong>
                <span>{records.length.toLocaleString()} total</span>
                {difficultyBreakdown.map((entry) => (
                  <span key={entry.tier} className={`tasks-tier tasks-tier--${entry.tier}`}>
                    {TIER_LABEL[entry.tier]} {entry.count.toLocaleString()} ({formatPercent(entry.percentage)})
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
                        provisional={tierConfidence[record.tier]?.startsWith("provisional") ?? false}
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
                {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {visible.length.toLocaleString()}
              </span>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  Previous
                </button>
                <strong>Page {page} of {pageCount}</strong>
                <button type="button" disabled={page >= pageCount} onClick={() => goToPage(page + 1)}>
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
    </div>
  );
}

function TaskStatsStrip({ stats }: { stats: TaskPageStats }) {
  const cells = [
    {
      kind: "tasks",
      label: "Tasks completed",
      value: `${stats.completedTasks.toLocaleString()} / ${stats.totalTasks.toLocaleString()}`,
      hint: formatPercent(stats.completionRate),
    },
    {
      kind: "points",
      label: "Total points",
      value: `${stats.completedPoints.toLocaleString()} / ${stats.totalPoints.toLocaleString()}`,
      hint: formatPercent(stats.pointCompletionRate),
    },
    { kind: "completion", label: "Completion", value: formatPercent(stats.completionRate), hint: "All tasks" },
    { kind: "filters", label: "Active filters", value: stats.activeFilterCount.toLocaleString(), hint: "Current view" },
    {
      kind: "build",
      label: "In my build",
      value: `${stats.completedBuildTaskCount.toLocaleString()} / ${stats.buildTaskCount.toLocaleString()}`,
      hint: "Completed / available",
    },
  ];

  return (
    <dl className="tasks-stats">
      {cells.map((cell) => (
        <div key={cell.label} className={`tasks-stat tasks-stat--${cell.kind}`}>
          <TaskStatGlyph kind={cell.kind} progress={stats.completionRate} />
          <div>
            <dt>{cell.label}</dt>
            <dd>{cell.value}</dd>
            <dd>{cell.hint}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function TaskStatGlyph({
  kind,
  progress,
}: {
  kind: string;
  progress: number;
}) {
  const mark = { tasks: "✓", points: "◆", filters: "⌁", build: "⬡" }[kind];
  if (kind === "completion") {
    return (
      <span
        className="tasks-stat__ring"
        style={{ "--task-progress": `${Math.min(100, progress) * 3.6}deg` } as CSSProperties}
        aria-hidden
      />
    );
  }
  return <span className="tasks-stat__glyph" aria-hidden>{mark}</span>;
}

function TaskCard({
  id,
  record,
  points,
  provisional,
  done,
  pinned,
  selected,
  showComp,
  tasksWikiUrl,
  isLeagueRegionId,
  regionLabel,
  onToggle,
  onPin,
  onSelect,
}: {
  id: string;
  record: TaskRecord;
  points: number | null;
  provisional: boolean;
  done: boolean;
  pinned: boolean;
  selected: boolean;
  showComp: boolean;
  tasksWikiUrl: string;
  isLeagueRegionId: (id: string) => boolean;
  regionLabel: string;
  onToggle: () => void;
  onPin: () => void;
  onSelect: () => void;
}) {
  const firstSkill = taskSkillNames(record)[0];
  const wikiHref =
    typeof record.wikiTaskId === "number"
      ? wikiTaskUrl(tasksWikiUrl, record.wikiTaskId)
      : null;
  const rate = record.catalystCompletionRate;

  return (
    <article
      id={taskCardDomId(id)}
      data-task-id={id}
      className={`task-card${done ? " is-complete" : ""}${pinned ? " is-pinned" : ""}${selected ? " is-selected" : ""}`}
    >
      <div className="task-card__top">
        <span className="task-card__icon" aria-hidden>
          {firstSkill ? (
            <GameIcon src={gameIconPath("skills", firstSkill.toLowerCase())} size={34} />
          ) : record.regionId && isLeagueRegionId(record.regionId) ? (
            <RegionCrest regionId={record.regionId} size={36} />
          ) : (
            <GameIcon src={worldMapIconPath()} size={34} />
          )}
        </span>
        <button
          type="button"
          className="task-card__title"
          title={record.name}
          aria-expanded={selected}
          aria-controls={selected ? "tasks-selected-detail" : undefined}
          onClick={onSelect}
        >
          {record.name}
        </button>
        <strong className="task-card__points">
          {points?.toLocaleString() ?? "—"}
          {provisional ? (
            <>
              <span aria-hidden>*</span><span className="sr-only"> provisional</span>
            </>
          ) : null}
          <small>pts</small>
        </strong>
      </div>

      <div className="task-card__meta">
        {showComp ? (
          <span>
            {typeof rate === "number" ? (
              wikiHref ? (
                <a href={wikiHref} target="_blank" rel="noreferrer">
                  {formatCompRate(rate, record.catalystCompletionRateQualifier)} of players
                </a>
              ) : (
                `${formatCompRate(rate, record.catalystCompletionRateQualifier)} of players`
              )
            ) : (
              "Comp% unavailable"
            )}
          </span>
        ) : null}
      </div>

      <div className="task-card__status-row">
        <span className="task-card__tier-region">
          <span className="task-card__region" aria-label={`Region: ${regionLabel}`} title={regionLabel}>
            {record.regionId && isLeagueRegionId(record.regionId) ? (
              <RegionCrest regionId={record.regionId} size={17} />
            ) : (
              <GameIcon src={worldMapIconPath()} size={15} />
            )}
          </span>
          <span className={`tasks-tier tasks-tier--${record.tier}`}>{record.tier}</span>
        </span>
        <span className="task-card__footer-actions">
          <button
            type="button"
            className="task-card__status"
            aria-pressed={done}
            aria-label={done ? `Mark incomplete: ${record.name}` : `Mark complete: ${record.name}`}
            onClick={onToggle}
          >
            {done ? "Completed" : "Not started"}
          </button>
          <button
            type="button"
            className="task-card__pin"
            aria-pressed={pinned}
            aria-label={pinned ? `Unpin ${record.name}` : `Pin ${record.name}`}
            title={pinned ? "Unpin task" : "Pin task"}
            onClick={onPin}
          >
            <svg viewBox="0 0 16 16" aria-hidden>
              <path d="M5.4 1.5h5.2l-.7 3.1L12 6.7v1H8.7V14L8 15l-.7-1V7.7H4v-1l2.1-2.1-.7-3.1Zm1.5 1 .5 2.5-1.2 1.2h3.6L8.6 5l.5-2.5H6.9Z" />
            </svg>
          </button>
        </span>
      </div>
    </article>
  );
}

function TaskSidebar({
  difficulty,
  recommendations,
  selected,
  tasksWikiUrl,
  taskId,
  taskPoints,
  regionDisplayName,
  onSelect,
  onClose,
}: {
  difficulty: DifficultyAggregate[];
  recommendations: TaskRecord[];
  selected: TaskRecord | null;
  tasksWikiUrl: string;
  taskId: (record: TaskRecord) => string;
  taskPoints: (record: TaskRecord) => number | null;
  regionDisplayName: (id: TaskRegionId) => string;
  onSelect: (record: TaskRecord) => void;
  onClose: () => void;
}) {
  return (
    <aside className="tasks-sidebar" aria-label="Task guidance">
      {selected ? (
        <section id="tasks-selected-detail" className="tasks-sidebar__section tasks-sidebar__detail">
          <div className="tasks-sidebar__head">
            <h2>Task detail</h2>
            <button type="button" onClick={onClose}>Close</button>
          </div>
          <h3>{selected.name}</h3>
          <p className="tasks-sidebar__meta">
            {selected.regionId ? regionDisplayName(selected.regionId) : "Unknown region"} · {selected.tier} · {taskPoints(selected) ?? "—"} pts
          </p>
          {selected.description ? <p>{selected.description}</p> : null}
          {selected.requirements ? <p><strong>Requires:</strong> {selected.requirements}</p> : null}
          {typeof selected.wikiTaskId === "number" ? (
            <a href={wikiTaskUrl(tasksWikiUrl, selected.wikiTaskId)} target="_blank" rel="noreferrer">
              Open source task
            </a>
          ) : null}
        </section>
      ) : null}

      <section className="tasks-sidebar__section">
        <h2>Recommended next</h2>
        {recommendations.length > 0 ? (
          <ol className="tasks-recommendations">
            {recommendations.map((record) => (
              <li key={taskId(record)}>
                <button type="button" onClick={() => onSelect(record)}>
                  <span className="tasks-recommendations__icon" aria-hidden>
                    <GameIcon
                      src={taskRecordIconPath(record)}
                      size={28}
                    />
                  </span>
                  <span>{record.name}</span>
                  <strong>{taskPoints(record) ?? "—"} pts</strong>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p>No unfinished tasks match this view.</p>
        )}
      </section>

      <section className="tasks-sidebar__section">
        <h2>Difficulty breakdown</h2>
        <div className="tasks-difficulty-track" aria-hidden>
          {difficulty.map((entry) => (
            <span
              key={entry.tier}
              className={`tasks-tier-fill--${entry.tier}`}
              style={{ width: `${entry.percentage}%` }}
            />
          ))}
        </div>
        <dl className="tasks-difficulty-list">
          {difficulty.map((entry) => (
            <div key={entry.tier}>
              <dt className={`tasks-tier tasks-tier--${entry.tier}`}>{TIER_LABEL[entry.tier]}</dt>
              <dd className="tasks-difficulty__tasks">
                {entry.count.toLocaleString()} <small>tasks</small>
              </dd>
              <dd className="tasks-difficulty__points">
                {entry.pointsPerTask.toLocaleString()} <small>pts</small>
              </dd>
              <dd className="tasks-difficulty__percent">{formatPercent(entry.percentage)}</dd>
              <dd className="tasks-difficulty-meter" aria-hidden>
                <span
                  className={`tasks-tier-fill--${entry.tier}`}
                  style={{ width: `${entry.percentage}%` }}
                />
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function taskRecordIconPath(record: TaskRecord): string {
  const skill = taskSkillNames(record)[0];
  return skill ? gameIconPath("skills", skill.toLowerCase()) : worldMapIconPath();
}

function taskCardDomId(id: string): string {
  return `task-card-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
