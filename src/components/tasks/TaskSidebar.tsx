"use client";

import { GameIcon } from "@/components/GameIcon";
import { taskSkillNames, wikiTaskUrl, type DifficultyAggregate } from "@/tasks/useTasksDesk";
import { gameIconPath, worldMapIconPath } from "@/lib/gameArt";
import type { TaskRecord, TaskRegionId, TaskTier } from "@/tasks";

const TIER_LABEL: Record<TaskTier, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  elite: "Elite",
  master: "Master",
};

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function taskRecordIconPath(record: TaskRecord): string {
  const skill = taskSkillNames(record)[0];
  return skill ? gameIconPath("skills", skill.toLowerCase()) : worldMapIconPath();
}

export function TaskSidebar({
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
        <section
          id="tasks-selected-detail"
          className="tasks-sidebar__section tasks-sidebar__detail"
        >
          <div className="tasks-sidebar__head">
            <h2>Task detail</h2>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
          <h3>{selected.name}</h3>
          <p className="tasks-sidebar__meta">
            {selected.regionId ? regionDisplayName(selected.regionId) : "Unknown region"} ·{" "}
            {selected.tier} · {taskPoints(selected) ?? "—"} pts
          </p>
          {selected.description ? <p>{selected.description}</p> : null}
          {selected.requirements ? (
            <p>
              <strong>Requires:</strong> {selected.requirements}
            </p>
          ) : null}
          {typeof selected.wikiTaskId === "number" ? (
            <a
              href={wikiTaskUrl(tasksWikiUrl, selected.wikiTaskId)}
              target="_blank"
              rel="noreferrer"
            >
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
                    <GameIcon src={taskRecordIconPath(record)} size={28} />
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
                {entry.count.toLocaleString("en-US")} <small>tasks</small>
              </dd>
              <dd className="tasks-difficulty__points">
                {entry.pointsPerTask.toLocaleString("en-US")} <small>pts</small>
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
