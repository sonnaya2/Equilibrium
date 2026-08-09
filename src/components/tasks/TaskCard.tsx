"use client";

import { GameIcon } from "@/components/GameIcon";
import { RegionCrest } from "@/components/RegionCrest";
import { formatCompRate, taskSkillNames, wikiTaskUrl } from "@/tasks/useTasksDesk";
import { gameIconPath, worldMapIconPath } from "@/lib/gameArt";
import type { TaskRecord } from "@/tasks";

export function taskCardDomId(id: string): string {
  return `task-card-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function TaskCard({
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
    typeof record.wikiTaskId === "number" ? wikiTaskUrl(tasksWikiUrl, record.wikiTaskId) : null;
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
          {points?.toLocaleString("en-US") ?? "—"}
          {provisional ? (
            <>
              <span aria-hidden>*</span>
              <span className="sr-only"> provisional</span>
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
          <span
            className="task-card__region"
            aria-label={`Region: ${regionLabel}`}
            title={regionLabel}
          >
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
