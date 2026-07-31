"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ELECTIVE_CAP, type RegionId } from "@/league";
import { EMPTY_PROGRESS, loadProgress, type TaskProgress } from "@/tasks/progress";
import { useBuild } from "@/league/useBuild";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath } from "@/lib/gameArt";
import { REGION_ANCHOR_BY_ID } from "@/map/data/regionAnchors";
import "./overview.css";

const RELIC_MONO: Record<string, string> = {
  Survivalist: "SV",
  "Endless Harvest": "EH",
  "Golden Touch": "GT",
};

function regionLabel(id: string): string {
  return REGION_ANCHOR_BY_ID.get(id as RegionId)?.name ?? id;
}

export function OverviewPlan({
  taskTotal,
  catalogCount,
}: {
  taskTotal: number;
  catalogCount: number;
}) {
  const { build, loaded } = useBuild();
  const [progress, setProgress] = useState<TaskProgress>(EMPTY_PROGRESS);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const picks = loaded ? build.elective : [];
  const slots: (string | null)[] = Array.from({ length: ELECTIVE_CAP }, (_, i) => picks[i] ?? null);
  const t1Relic = loaded ? (build.relics["1"] ?? null) : null;
  const relicMono = t1Relic ? (RELIC_MONO[t1Relic] ?? t1Relic.slice(0, 2).toUpperCase()) : null;
  const taskDone = progress.completed.length;
  const pickNames = slots.filter((id): id is string => Boolean(id)).map((id) => regionLabel(id));
  const regionsFull = picks.length >= ELECTIVE_CAP;
  const taskFig =
    taskTotal > 0 ? `${taskDone}/${taskTotal}` : taskDone > 0 ? String(taskDone) : "—";
  const t1Fig = relicMono ?? "—";

  return (
    <div className="overview">
      <header className="overview-header">
        <h2 className="overview-header__title">Plan</h2>
        <p className="overview-header__meta">
          T1 {t1Fig}
          {" · "}
          tasks {taskFig}
        </p>
      </header>

      <div className="overview-summary">
        <aside className="overview-side overview-side--regions" aria-label="Region picks">
          <p className="overview-side__label">Picks</p>
          {slots.map((id, i) =>
            id ? (
              <div key={id} className="region-slot">
                <GameIcon src={regionCrestPath(id)} size={22} className="shrink-0" />
                <p className="region-slot__name">{regionLabel(id)}</p>
              </div>
            ) : (
              <div key={`empty-${i}`} className="region-slot is-empty">
                Slot {i + 1}
              </div>
            ),
          )}
        </aside>

        <div className="overview-art">
          {/* Keyart fills the aperture; cover + object-position crop for faces. */}
          <img
            src="/brand/keyart-2026.webp"
            alt="RuneScape 2026 key art"
            width={1600}
            height={900}
            decoding="async"
            fetchPriority="high"
          />
        </div>

        <aside className="overview-side overview-side--stats" aria-label="Plan milestones">
          <div className="overview-stat">
            <p className="overview-stat__label">Tasks</p>
            <p className="overview-stat__value">
              {taskDone}
              {taskTotal > 0 ? `/${taskTotal}` : ""}
            </p>
          </div>
          <div className="overview-stat">
            <p className="overview-stat__label">Catalog</p>
            <p className="overview-stat__value">{catalogCount > 0 ? catalogCount : "—"}</p>
          </div>
          <div className="overview-stat">
            <p className="overview-stat__label">T1</p>
            <p className={`overview-stat__value${relicMono ? "" : " is-quiet"}`}>{t1Fig}</p>
          </div>
          <div className="overview-stat">
            <p className="overview-stat__label">Blessings</p>
            <p className="overview-stat__value is-quiet">—</p>
          </div>
        </aside>
      </div>

      <div className="overview-details">
        <div className="overview-details__grid">
          <div className="surface-panel surface-panel--muted">
            <div className="surface-panel__header">Ledger</div>
            <div className="surface-panel__body">
              <dl className="overview-facts">
                <dt>Regions</dt>
                <dd>
                  {pickNames.length > 0 ? (
                    <span style={{ color: "var(--color-parch-100)" }}>{pickNames.join(" · ")}</span>
                  ) : (
                    <span style={{ color: "var(--color-parch-300)" }}>—</span>
                  )}
                </dd>
                <dt>Tasks</dt>
                <dd>
                  <span className="mono">
                    {taskDone}
                    {taskTotal > 0 ? `/${taskTotal}` : ""}
                  </span>
                </dd>
                <dt>Relic T1</dt>
                <dd>{t1Relic ?? "—"}</dd>
                <dt>Launch</dt>
                <dd>10 Aug 2026</dd>
              </dl>
            </div>
          </div>

          <div className="surface-panel surface-panel--emphasized">
            <div className="surface-panel__header">Next</div>
            <div className="surface-panel__body text-[13px]">
              <ul className="overview-details__checks m-0 list-none p-0">
                {(
                  [
                    [regionsFull, `Regions ${loaded ? picks.length : "…"}/${ELECTIVE_CAP}`],
                    [Boolean(t1Relic), t1Relic ? `T1 ${t1Relic}` : "T1"],
                  ] as const
                ).map(([ok, label]) => (
                  <li key={label} className="overview-details__check">
                    <span
                      className="font-mono text-[11px]"
                      style={{
                        color: ok ? "var(--color-gem-400)" : "var(--color-parch-400)",
                      }}
                    >
                      {ok ? "ok" : "··"}
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
              <p className="overview-links">
                <Link href="/map" className="text-gem-300 hover:underline">
                  Map
                </Link>
                {" · "}
                <Link href="/build" className="text-gem-300 hover:underline">
                  Build
                </Link>
                {" · "}
                <Link href="/tasks" className="text-gem-300 hover:underline">
                  Tasks
                </Link>
                {" · "}
                <Link href="/combat" className="text-gem-300 hover:underline">
                  Combat
                </Link>
              </p>
            </div>
          </div>

          <div className="surface-panel">
            <div className="surface-panel__header">Structure</div>
            <div className="surface-panel__body">
              <dl className="overview-facts">
                <dt>Regions</dt>
                <dd>2 start + Karamja + 3 electives</dd>
                <dt>Relics</dt>
                <dd>7 tiers</dd>
                <dt>Blessings</dt>
                <dd>8 tiers · Order / Chaos / Balance</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
