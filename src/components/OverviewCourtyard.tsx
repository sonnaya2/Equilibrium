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

export function OverviewCourtyard({
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
      <header className="overview__lintel">
        <h2 className="overview__lintel-title">Plan</h2>
        <p className="overview__lintel-meta">
          T1 {t1Fig}
          {" · "}
          tasks {taskFig}
        </p>
      </header>

      <div className="overview__gate">
        <aside className="overview__jamb overview__jamb--west" aria-label="Region picks">
          <p className="overview__jamb-label">Picks</p>
          {slots.map((id, i) =>
            id ? (
              <div key={id} className="overview__standing">
                <GameIcon src={regionCrestPath(id)} size={22} className="shrink-0" />
                <p className="overview__standing-name">{regionLabel(id)}</p>
              </div>
            ) : (
              <div key={`empty-${i}`} className="overview__standing is-empty">
                Slot {i + 1}
              </div>
            ),
          )}
        </aside>

        <div className="overview__aperture">
          {/* Keyart fills the aperture; cover + object-position crop for faces. */}
          <img
            src="/brand/keyart-2026.jpg"
            alt="RuneScape 2026 key art"
            width={1600}
            height={900}
            decoding="async"
            fetchPriority="high"
          />
        </div>

        <aside className="overview__jamb overview__jamb--east" aria-label="Plan milestones">
          <div className="overview__milestone">
            <p className="overview__milestone-k">Tasks</p>
            <p className="overview__milestone-v">
              {taskDone}
              {taskTotal > 0 ? `/${taskTotal}` : ""}
            </p>
          </div>
          <div className="overview__milestone">
            <p className="overview__milestone-k">Catalog</p>
            <p className="overview__milestone-v">{catalogCount > 0 ? catalogCount : "—"}</p>
          </div>
          <div className="overview__milestone">
            <p className="overview__milestone-k">T1</p>
            <p className={`overview__milestone-v${relicMono ? "" : " is-quiet"}`}>{t1Fig}</p>
          </div>
          <div className="overview__milestone">
            <p className="overview__milestone-k">Blessings</p>
            <p className="overview__milestone-v is-quiet">—</p>
          </div>
        </aside>
      </div>

      <div className="overview__desk">
        <div className="overview__desk-grid">
          <div className="slab slab--slate">
            <div className="slab__head">Ledger</div>
            <div className="slab__body">
              <dl className="overview__ledger">
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

          <div className="slab slab--carved">
            <div className="slab__head">Next</div>
            <div className="slab__body text-[13px]">
              <ul className="overview__checks m-0 list-none p-0">
                {(
                  [
                    [regionsFull, `Regions ${loaded ? picks.length : "…"}/${ELECTIVE_CAP}`],
                    [Boolean(t1Relic), t1Relic ? `T1 ${t1Relic}` : "T1"],
                  ] as const
                ).map(([ok, label]) => (
                  <li key={label} className="overview__check">
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
              <p className="overview__note">
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

          <div className="slab">
            <div className="slab__head">Structure</div>
            <div className="slab__body">
              <dl className="overview__ledger">
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
