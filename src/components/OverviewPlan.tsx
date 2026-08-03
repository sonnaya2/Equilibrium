"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import relicsData from "#shard/league/relics.json";
import {
  ELECTIVE_CAP,
  MILESTONE_REGION,
  STARTING_REGIONS,
  UNLOCK_CAP,
  type RegionId,
} from "@/league";
import { BLESSING_PATHS, PATH_TIERS } from "@/league/blessings";
import { EMPTY_PROGRESS, loadProgress, type TaskProgress } from "@/tasks/progress";
import { useBuild } from "@/league/useBuild";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath } from "@/lib/gameArt";
import { REGION_ANCHOR_BY_ID } from "@/map/data/regionAnchors";
import "./overview.css";

const RELIC_TIER_COUNT = relicsData.records.length;
const PATH_PICK_COUNT = PATH_TIERS.length;
const PATH_LABEL = BLESSING_PATHS.join(", ");
const LAUNCH_LABEL = "Launches 10 August 2026";

function regionLabel(id: string): string {
  return REGION_ANCHOR_BY_ID.get(id as RegionId)?.name ?? id;
}

function formatCount(n: number): string {
  return n.toLocaleString("en-GB");
}

function startingRegionNames(): string {
  const names = STARTING_REGIONS.map((id) => regionLabel(id));
  if (names.length <= 1) return names[0] ?? "Starting regions";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

type NextAction = {
  lead: string;
  href: string;
  cta: string;
};

function deriveNext(
  loaded: boolean,
  pickCount: number,
  hasTier1Relic: boolean,
  taskDone: number,
): NextAction | null {
  if (!loaded) return null;
  if (pickCount < ELECTIVE_CAP) {
    const remaining = ELECTIVE_CAP - pickCount;
    return {
      lead:
        remaining === ELECTIVE_CAP
          ? `Choose ${ELECTIVE_CAP} elective regions.`
          : `Choose ${remaining} more elective region${remaining === 1 ? "" : "s"}.`,
      href: "/build",
      cta: "Open build",
    };
  }
  if (!hasTier1Relic) {
    return {
      lead: "Choose a tier 1 relic.",
      href: "/build",
      cta: "Open build",
    };
  }
  if (taskDone === 0) {
    return {
      lead: "Start tracking league tasks.",
      href: "/tasks",
      cta: "Browse tasks",
    };
  }
  return {
    lead: "Keep tracking tasks.",
    href: "/tasks",
    cta: "Browse tasks",
  };
}

export function OverviewPlan({ taskTotal }: { taskTotal: number }) {
  const { build, loaded } = useBuild();
  const [progress, setProgress] = useState<TaskProgress>(EMPTY_PROGRESS);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const picks = loaded ? build.elective : [];
  const slots: (string | null)[] = Array.from({ length: ELECTIVE_CAP }, (_, i) => picks[i] ?? null);
  const tier1Relic = loaded ? (build.relics["1"] ?? null) : null;
  const blessingCount = loaded ? build.blessingPicks.length : 0;
  const taskDone = progress.completed.length;
  const next = deriveNext(loaded, picks.length, Boolean(tier1Relic), taskDone);
  const taskPct = taskTotal > 0 ? Math.min(100, Math.round((taskDone / taskTotal) * 100)) : 0;
  const milestoneName = regionLabel(MILESTONE_REGION);
  const regionNote = `${startingRegionNames()} start unlocked. ${milestoneName} unlocks at the first task milestone. Choose ${ELECTIVE_CAP} electives (${UNLOCK_CAP} regions total).`;

  const chosenRelics = loaded
    ? Object.entries(build.relics)
        .filter(([, name]) => Boolean(name))
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([tier, name]) => ({ tier: Number(tier), name: name as string }))
    : [];

  return (
    <div className="overview" aria-busy={loaded ? undefined : true}>
      <header className="overview-header">
        <h1 className="overview-header__title">League overview</h1>
        <p className="overview-header__meta">{LAUNCH_LABEL}</p>
      </header>

      <section className="overview-next" aria-labelledby="overview-next-heading">
        <h2 id="overview-next-heading" className="overview-section__title">
          Up next
        </h2>
        {!loaded || !next ? (
          <p className="overview-next__lead">Loading your plan…</p>
        ) : (
          <>
            <p className="overview-next__lead">{next.lead}</p>
            <Link href={next.href} className="overview-next__cta">
              {next.cta}
            </Link>
          </>
        )}
      </section>

      <div className="overview-body">
        <section className="overview-block" aria-labelledby="overview-regions-heading">
          <h2 id="overview-regions-heading" className="overview-section__title">
            Regions
          </h2>
          {!loaded ? (
            <p className="overview-block__value">Loading region picks…</p>
          ) : (
            <ul className="overview-slots">
              {slots.map((id, i) =>
                id ? (
                  <li key={id} className="overview-slot is-filled">
                    <GameIcon src={regionCrestPath(id)} size={28} className="shrink-0" />
                    <div className="overview-slot__body">
                      <p className="overview-slot__name">{regionLabel(id)}</p>
                    </div>
                    <Link href="/build" className="overview-slot__action">
                      Change
                    </Link>
                  </li>
                ) : (
                  <li key={`empty-${i}`} className="overview-slot is-empty">
                    <div className="overview-slot__body">
                      <p className="overview-slot__name">No region selected</p>
                    </div>
                    <Link href="/build" className="overview-slot__action">
                      Choose region
                    </Link>
                  </li>
                ),
              )}
            </ul>
          )}
          <p className="overview-block__note">{regionNote}</p>
        </section>

        <section className="overview-block" aria-labelledby="overview-tasks-heading">
          <div className="overview-block__head">
            <h2 id="overview-tasks-heading" className="overview-section__title">
              Tasks
            </h2>
            <Link href="/tasks" className="overview-block__link">
              View tasks
            </Link>
          </div>
          <p className="overview-progress__value">
            {taskTotal > 0
              ? `${formatCount(taskDone)} of ${formatCount(taskTotal)} tasks completed`
              : taskDone > 0
                ? `${formatCount(taskDone)} tasks completed`
                : "No task list loaded yet"}
          </p>
          {taskTotal > 0 ? (
            <div
              className="overview-progress__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={taskTotal}
              aria-valuenow={taskDone}
              aria-label="Tasks completed"
            >
              <span className="overview-progress__fill" style={{ width: `${taskPct}%` }} />
            </div>
          ) : null}
        </section>

        <section className="overview-block" aria-labelledby="overview-relics-heading">
          <div className="overview-block__head">
            <h2 id="overview-relics-heading" className="overview-section__title">
              Relics
            </h2>
            <Link href="/build" className="overview-block__link">
              View relics
            </Link>
          </div>
          {!loaded ? (
            <p className="overview-block__value">Loading…</p>
          ) : chosenRelics.length === 0 ? (
            <p className="overview-block__value">No relics chosen</p>
          ) : (
            <ul className="overview-status-list">
              {chosenRelics.map((row) => (
                <li key={row.tier}>
                  <span className="overview-status-list__label">Tier {row.tier}</span>
                  <span className="overview-status-list__value">{row.name}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="overview-block__note">{RELIC_TIER_COUNT} tiers in the league.</p>
        </section>

        <section className="overview-block" aria-labelledby="overview-blessings-heading">
          <div className="overview-block__head">
            <h2 id="overview-blessings-heading" className="overview-section__title">
              Blessings
            </h2>
            <Link href="/build" className="overview-block__link">
              View blessings
            </Link>
          </div>
          {!loaded ? (
            <p className="overview-block__value">Loading…</p>
          ) : blessingCount === 0 ? (
            <p className="overview-block__value">No blessings chosen</p>
          ) : (
            <p className="overview-block__value">
              {blessingCount} of {PATH_PICK_COUNT} path picks
            </p>
          )}
          <p className="overview-block__note">
            {blessingCount === 0 && loaded
              ? `Choose ${PATH_LABEL} blessings on Build.`
              : `${PATH_LABEL} · ${PATH_PICK_COUNT} path picks before god grants.`}
          </p>
        </section>
      </div>

      <figure className="overview-hero">
        <img
          src="/brand/keyart-2026.webp"
          alt="RuneScape 2026 key art"
          width={1600}
          height={900}
          decoding="async"
          fetchPriority="high"
        />
      </figure>
    </div>
  );
}
