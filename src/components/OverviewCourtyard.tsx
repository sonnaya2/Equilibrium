"use client";

/**
 * Daylight courtyard gate — Composite Overview DNA (Nova).
 * Live picks + relic from useBuild; task progress from localStorage.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import regionsData from "#data/league/regions.json";
import { ELECTIVE_CAP } from "@/league";
import { EMPTY_PROGRESS, loadProgress, type TaskProgress } from "@/tasks/progress";
import { useBuild } from "@/league/useBuild";
import { GameIcon } from "@/components/GameIcon";
import { regionCrestPath } from "@/lib/gameArt";

const RELIC_MONO: Record<string, string> = {
  Survivalist: "SV",
  "Endless Harvest": "EH",
  "Golden Touch": "GT",
};

const REGION_NAME = new Map(
  (regionsData.records as { id: string; name: string }[]).map((r) => [r.id, r.name]),
);

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
  const t1Relic = loaded ? build.relics["1"] ?? null : null;
  const relicMono = t1Relic ? RELIC_MONO[t1Relic] ?? null : null;
  const taskDone = progress.completed.length;
  const pickNames = slots
    .filter((id): id is string => Boolean(id))
    .map((id) => REGION_NAME.get(id) ?? id);

  return (
    <div className="comp-courtyard">
      <header className="comp-lintel">
        <h2 className="comp-lintel__title">Courtyard plan</h2>
        <p className="comp-lintel__meta">Leagues II · Equilibrium</p>
      </header>

      <div className="comp-gate">
        <aside className="comp-jamb comp-jamb--west" aria-label="Region picks">
          <p className="comp-jamb__label">Standing picks</p>
          {slots.map((id, i) =>
            id ? (
              <div key={id} className="comp-standing">
                <GameIcon src={regionCrestPath(id)} size={26} className="shrink-0" />
                <p className="comp-standing__name">{REGION_NAME.get(id) ?? id}</p>
              </div>
            ) : (
              <div key={`empty-${i}`} className="comp-standing is-empty">
                Slot {i + 1}
              </div>
            ),
          )}
        </aside>

        <div className="comp-aperture">
          {/* Plain img: next/image fill collapsed the gate height in production shell. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/keyart-2026.jpg" alt="" />
          <p className="comp-aperture__caption">Fort gate · living world</p>
        </div>

        <aside className="comp-jamb comp-jamb--east" aria-label="Plan milestones">
          <p className="comp-jamb__label">Milestones</p>
          <div className="comp-milestone">
            <p className="comp-milestone__k">Picks</p>
            <p className="comp-milestone__v">
              {loaded ? `${picks.length}/${ELECTIVE_CAP}` : `…/${ELECTIVE_CAP}`}
            </p>
          </div>
          <div className="comp-milestone">
            <p className="comp-milestone__k">Tasks</p>
            <p className="comp-milestone__v">
              {taskDone}
              {taskTotal > 0 ? `/${taskTotal}` : ""}
            </p>
          </div>
          <div className="comp-milestone">
            <p className="comp-milestone__k">Catalog</p>
            <p className="comp-milestone__v">{catalogCount > 0 ? catalogCount : "—"}</p>
          </div>
          <div className="comp-milestone">
            <p className="comp-milestone__k">T1 Relic</p>
            <p className={`comp-milestone__v${relicMono ? "" : " is-quiet"}`}>
              {relicMono ?? "Open"}
            </p>
          </div>
          <div className="comp-milestone">
            <p className="comp-milestone__k">Blessings</p>
            <p className="comp-milestone__v is-quiet">Unrevealed</p>
          </div>
        </aside>
      </div>

      <div className="comp-desk">
        <div className="comp-desk__grid">
          <div className="comp-panel comp-panel--slate">
            <div className="comp-panel__head">Plan ledger</div>
            <div className="comp-panel__body">
              <dl className="comp-ledger">
                <dt>Region picks</dt>
                <dd>
                  <span className="mono" style={{ color: "var(--echo-gem, var(--color-gem-400))" }}>
                    {loaded ? `${picks.length}/${ELECTIVE_CAP}` : `…/${ELECTIVE_CAP}`}
                  </span>
                  {pickNames.length > 0 ? (
                    <span style={{ color: "var(--echo-parch-100, var(--color-parch-100))" }}>
                      {" "}
                      · {pickNames.join(" · ")}
                    </span>
                  ) : (
                    <span style={{ color: "var(--echo-parch-300, var(--color-parch-300))" }}>
                      {" "}
                      · none chosen — open Map or Build
                    </span>
                  )}
                </dd>
                <dt>Tasks</dt>
                <dd>
                  <span className="mono">
                    {taskDone}
                    {taskTotal > 0 ? `/${taskTotal}` : ""}
                  </span>
                  {taskTotal > 0 ? " marked done" : " · open Tasks"}
                </dd>
                <dt>Relic T1</dt>
                <dd>
                  {t1Relic
                    ? `${t1Relic}${relicMono ? ` (${relicMono})` : ""}`
                    : "Court open — seat on Build → Relics"}
                </dd>
                <dt>Blessings</dt>
                <dd>Empty until official reveal</dd>
                <dt>Launch</dt>
                <dd>10 Aug 2026 · dedicated League worlds</dd>
              </dl>
              <p className="comp-note">Blank means unrevealed. No invented league numbers.</p>
            </div>
          </div>

          <div className="comp-panel comp-panel--carved">
            <div className="comp-panel__head">Next on the board</div>
            <div className="comp-panel__body space-y-2 text-[13px]">
              <p className="m-0" style={{ color: "var(--echo-parch-50, var(--color-parch-50))" }}>
                {picks.length < ELECTIVE_CAP
                  ? "Finish three region picks on Map or Build."
                  : "Region cap filled. Seat a T1 relic or open Combat."}
              </p>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {(
                  [
                    [
                      picks.length >= ELECTIVE_CAP,
                      `Regions ${loaded ? picks.length : "…"}/${ELECTIVE_CAP}`,
                    ],
                    [Boolean(relicMono), `T1 relic ${t1Relic ? "seated" : "open"}`],
                    [false, "Blessings locked empty"],
                    [false, "Combat DPL unbound until setup"],
                  ] as const
                ).map(([ok, label]) => (
                  <li key={label} className="flex items-center gap-2">
                    <span
                      className="font-mono text-[11px]"
                      style={{
                        color: ok
                          ? "var(--echo-gem, var(--color-gem-400))"
                          : "var(--echo-parch-400, var(--color-parch-400))",
                      }}
                    >
                      {ok ? "ok" : "··"}
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
              <p className="comp-note pt-1">
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

          <div className="comp-panel">
            <div className="comp-panel__head">League structure</div>
            <div className="comp-panel__body">
              <dl className="comp-ledger">
                <dt>Regions</dt>
                <dd>2 start + Karamja + 3 electives</dd>
                <dt>Relics</dt>
                <dd>7 tiers · one pick when revealed</dd>
                <dt>Blessings</dt>
                <dd>8 tiers · Order / Chaos / Balance · God Tier 4 &amp; 8</dd>
                <dt>Trading</dt>
                <dd>Off · ironman / self-sufficient</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
