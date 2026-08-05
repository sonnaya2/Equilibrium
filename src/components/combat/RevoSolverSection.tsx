"use client";

import { engineSpecs as ENGINE_SPECS } from "@/combat/abilities/registry";
import {
  preferredAgentCount,
  TIER_BUDGETS,
  type ObjectiveProfileId,
  type SolverAgentRecipe,
  type SolverProgress,
  type SolverResultDTO,
  type SolverSearchTier,
} from "@/combat/solver";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { RegionCrest } from "../RegionCrest";
import {
  BAR_SIZE_PRESETS,
  formatNumber,
  formatSolverUpgradeChrome,
  mayApplySolverResultBar,
  previewCategory,
  progressFillFromState,
  solverPhaseLabel,
  trackLiveClassName,
  workerPhaseLabel,
  workerRecipeGroupLabel,
  workerRecipeLabel,
  type BarSizePresetId,
  type SolverStoppedPreview,
} from "./revoPanelFormat";
import { formatProofChrome, residualNote } from "./revoStochasticLabels";
import "./revo-solver.css";

export type RevoSolverSectionProps = {
  regions: readonly string[];
  solving: boolean;
  stopping: boolean;
  solverProgress: SolverProgress | null;
  solverResult: SolverResultDTO | null;
  stoppedPreview: SolverStoppedPreview | null;
  solverError: string | null;
  bestPulse: boolean;
  solverAgents: number;
  solverTier: SolverSearchTier;
  setSolverTier: (t: SolverSearchTier) => void;
  setSolverAgents: (n: number) => void;
  solverProfile: ObjectiveProfileId;
  setSolverProfile: (p: ObjectiveProfileId) => void;
  barSizePreset: BarSizePresetId;
  setBarSizePreset: (p: BarSizePresetId) => void;
  limitToRegions: boolean;
  setLimitToRegions: (v: boolean) => void;
  onOptimize: () => void;
  onCancel: () => void;
  onApplyBar: (ids: readonly string[]) => void;
};

export function RevoSolverSection({
  regions,
  solving,
  stopping,
  solverProgress,
  solverResult,
  stoppedPreview,
  solverError,
  bestPulse,
  solverAgents,
  solverTier,
  setSolverTier,
  setSolverAgents,
  solverProfile,
  setSolverProfile,
  barSizePreset,
  setBarSizePreset,
  limitToRegions,
  setLimitToRegions,
  onOptimize,
  onCancel,
  onApplyBar,
}: RevoSolverSectionProps) {
  const progressFill = progressFillFromState(solving, solverProgress, TIER_BUDGETS[solverTier]);
  const trackLiveClass = trackLiveClassName(solving, stopping, solverProgress);
  const optimize = () => onOptimize();
  const cancelSolve = () => onCancel();
  const applySolverBar = (ids: readonly string[]) => onApplyBar(ids);
  // Phase 4/5: gate Apply for non-cacheable proofs and remains-best outcomes.
  const canApplyResult = mayApplySolverResultBar(solverResult);
  const upgradeChrome = solverResult ? formatSolverUpgradeChrome(solverResult) : null;

  return (
    <section className="revo-solver-controls">
      <div className="revo-solver-controls__row">
        <button
          type="button"
          onClick={() => void optimize()}
          disabled={solving}
          className="combat-button revo-run-button revo-solver-controls__run"
          data-testid="revo-optimize"
        >
          {solving ? "Optimizing…" : "Optimize bar"}
        </button>
        {solving ? (
          <button
            type="button"
            onClick={cancelSolve}
            className="combat-button revo-solver-controls__cancel"
            data-testid="revo-solver-cancel"
          >
            Cancel
          </button>
        ) : null}
        <select
          value={solverTier}
          onChange={(e) => {
            const next = e.target.value as SolverSearchTier;
            setSolverTier(next);
            setSolverAgents(preferredAgentCount(next));
          }}
          className="revo-solver-select"
          disabled={solving}
          aria-label="Search depth"
          data-testid="revo-solver-tier"
        >
          <option value="thorough">Thorough</option>
          <option value="extreme">Extreme</option>
          <option value="unhinged">Unhinged</option>
        </select>
        <select
          value={solverProfile}
          onChange={(e) => setSolverProfile(e.target.value as ObjectiveProfileId)}
          className="revo-solver-select"
          disabled={solving}
          aria-label="Objective"
          data-testid="revo-solver-profile"
        >
          <option value="balanced">Balanced</option>
          <option value="burst">Burst</option>
          <option value="sustained">Sustained</option>
        </select>
        <select
          value={barSizePreset}
          onChange={(e) => setBarSizePreset(e.target.value as BarSizePresetId)}
          className="revo-solver-select"
          disabled={solving}
          aria-label="Bar size"
          data-testid="revo-bar-size"
          title="Fixed bar length or a min-max search window"
        >
          <optgroup label="Fixed length">
            {(
              [
                "fixed4",
                "fixed5",
                "fixed6",
                "fixed7",
                "fixed8",
                "fixed9",
                "fixed10",
                "fixed11",
              ] as const
            ).map((id) => (
              <option key={id} value={id}>
                {BAR_SIZE_PRESETS[id].label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Range">
            {(
              ["range4_6", "range4_10", "range4_11", "range5_8", "range8_11"] as const
            ).map((id) => (
              <option key={id} value={id}>
                {BAR_SIZE_PRESETS[id].label}
              </option>
            ))}
          </optgroup>
        </select>
        <label
          className={`revo-solver-controls__regions${limitToRegions ? " is-on" : ""}`}
          title={
            limitToRegions
              ? "Only abilities from your Build region picks"
              : "Abilities from every region (ignores Build picks)"
          }
          data-testid="revo-region-crests"
        >
          <span className="revo-solver-controls__crests" aria-hidden>
            {regions.length > 0 ? (
              regions.map((id) => <RegionCrest key={id} regionId={id} size={18} />)
            ) : (
              <span className="revo-solver-controls__regions-empty">No picks</span>
            )}
          </span>
          <span className="revo-solver-controls__regions-divider" aria-hidden />
          <input
            type="checkbox"
            checked={limitToRegions}
            onChange={(e) => setLimitToRegions(e.target.checked)}
            disabled={solving}
            data-testid="revo-limit-regions"
          />
          Limit to regions
        </label>
      </div>
      {(solving || solverProgress) && (
        <div
          className={`revo-solver-status${stopping ? " is-stopping" : ""}${
            solverProgress?.phase === "finalize" && solving ? " is-scoring" : ""
          }`}
          data-testid="revo-solver-progress"
          data-evals={solverProgress?.evaluations ?? 0}
          data-phase={
            stopping ? "stopping" : (solverProgress?.phase ?? (solving ? "seed" : "idle"))
          }
          data-finalize-step={solverProgress?.finalizeStep ?? ""}
          data-finalize-total={solverProgress?.finalizeTotal ?? ""}
          role="status"
          aria-live="polite"
          aria-busy={solving}
        >
          <div className="revo-solver-status__head">
            <span className="revo-solver-status__phase">
              {solving
                ? solverPhaseLabel(solverProgress?.phase, { stopping })
                : solverError
                  ? "Failed"
                  : "Done"}
            </span>
            <span className="revo-solver-status__meta font-mono">
              {solverProgress ? (
                <>
                  {solverProgress.phase === "finalize" &&
                  solverProgress.finalizeTotal != null &&
                  solverProgress.finalizeTotal > 0 ? (
                    <>
                      bar{" "}
                      {formatNumber(
                        Math.min(
                          (solverProgress.finalizeStep ?? 0) +
                            (solverProgress.finalizeStep != null &&
                            solverProgress.finalizeStep < solverProgress.finalizeTotal
                              ? 1
                              : 0),
                          solverProgress.finalizeTotal,
                        ),
                      )}
                      /{formatNumber(solverProgress.finalizeTotal)} full
                      <span className="revo-solver-status__dot" aria-hidden>
                        ·
                      </span>
                      {formatNumber(solverProgress.fullEvaluations ?? solverProgress.evaluations)}{" "}
                      full evals
                    </>
                  ) : (
                    <>
                      {formatNumber(solverProgress.evaluations)}
                      {solverProgress.evaluationBudget
                        ? ` / ${formatNumber(solverProgress.evaluationBudget)}`
                        : ""}{" "}
                      evals
                      {(solverProgress.agentCount ?? solverAgents) > 1 ? (
                        <>
                          <span className="revo-solver-status__dot" aria-hidden>
                            ·
                          </span>
                          {solverProgress.agentCount ?? solverAgents} agents
                        </>
                      ) : null}
                    </>
                  )}
                  <span className="revo-solver-status__dot" aria-hidden>
                    ·
                  </span>
                  <span
                    className={
                      bestPulse ? "revo-solver-status__best is-pulse" : "revo-solver-status__best"
                    }
                  >
                    {Number.isFinite(solverProgress.bestFullScore) ? (
                      <>
                        search{" "}
                        {formatNumber(
                          solverProgress.bestExploratoryScore ?? solverProgress.bestScore,
                        )}{" "}
                        · full {formatNumber(solverProgress.bestFullScore!)}
                      </>
                    ) : (
                      <>
                        best{" "}
                        {formatNumber(
                          solverProgress.bestExploratoryScore ?? solverProgress.bestScore,
                        )}
                      </>
                    )}
                  </span>
                  {solverProgress.uniqueCandidates > 0 ? (
                    <>
                      <span className="revo-solver-status__dot" aria-hidden>
                        ·
                      </span>
                      {formatNumber(solverProgress.uniqueCandidates)} unique
                    </>
                  ) : null}
                </>
              ) : (
                <span>…</span>
              )}
            </span>
          </div>
          {(() => {
            const snaps = solverProgress?.agents;
            // Launched agents only (progress strip or plan size), not tier ceilings.
            let count = 0;
            if (snaps?.length) {
              count = snaps.length;
            } else if (solverProgress?.agentCount != null && solverProgress.agentCount > 0) {
              count = solverProgress.agentCount;
            } else if (solving && solverAgents > 0) {
              count = solverAgents;
            }
            if (count < 1) return null;

            const recipeOf = (i: number): SolverAgentRecipe | undefined => snaps?.[i]?.recipe;
            const lengthOf = (i: number): number | undefined => snaps?.[i]?.barLength;

            const showLegend = solverTier === "extreme" || solverTier === "unhinged";
            const legendRecipes: SolverAgentRecipe[] =
              solverTier === "unhinged"
                ? ["default", "evolutionary", "anneal_local"]
                : ["default", "evolutionary"];

            return (
              <div
                className={`revo-solver-workers${stopping ? " is-stopping" : ""}`}
                role="list"
                aria-label="Solver workers"
                data-testid="revo-solver-workers"
                data-agent-count={count}
              >
                {showLegend ? (
                  <div className="revo-solver-worker-legend" aria-hidden>
                    {legendRecipes.map((recipe) => (
                      <span
                        key={recipe}
                        className={`revo-solver-worker-legend__item is-recipe-${recipe}`}
                      >
                        {workerRecipeGroupLabel(recipe)}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="revo-solver-workers__row">
                  {Array.from({ length: count }, (_, i) => {
                    const snap = snaps?.[i];
                    const recipe = recipeOf(i);
                    const barLen = lengthOf(i);
                    const finished =
                      snap?.finished === true ||
                      snap?.phase === "idle" ||
                      (snap?.progressRatio ?? 0) >= 1 ||
                      (!solving && !!snap);
                    const phase = finished ? "idle" : (snap?.phase ?? (solving ? "seed" : "idle"));
                    let mood = "idle";
                    if (finished) mood = "done";
                    else if (stopping) mood = "stopping";
                    else if (
                      phase === "explore" ||
                      phase === "exploit" ||
                      phase === "finalize" ||
                      phase === "seed"
                    ) {
                      mood = phase;
                    }
                    const label = workerPhaseLabel(snap?.phase, finished);
                    const algo = recipe ? workerRecipeLabel(recipe) : "?";
                    const lenLabel = barLen != null ? String(barLen) : "?";
                    const title = `${lenLabel} · ${algo}${finished ? " · done" : ` · ${label}`}`;
                    const recipeClass = recipe ? `is-recipe-${recipe}` : "is-recipe-unknown";
                    return (
                      <span
                        key={i}
                        role="listitem"
                        className={`revo-solver-worker is-${mood} ${recipeClass}`}
                        style={{ ["--i" as string]: String(i) }}
                        title={title}
                        aria-label={title}
                        data-phase={phase}
                        data-recipe={recipe ?? ""}
                        data-bar-length={barLen ?? ""}
                        data-finished={finished ? "1" : "0"}
                      >
                        <span className="revo-solver-worker__stone" aria-hidden>
                          <span className="revo-solver-worker__gem">
                            <span className="revo-solver-worker__spark" />
                            <span className="revo-solver-worker__eye revo-solver-worker__eye--l" />
                            <span className="revo-solver-worker__eye revo-solver-worker__eye--r" />
                          </span>
                        </span>
                        <span className="revo-solver-worker__tag" aria-hidden>
                          {lenLabel}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          <div
            className={trackLiveClass}
            style={{ ["--fill" as string]: String(progressFill) }}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressFill * 100)}
          >
            <div className="revo-solver-track__rail" aria-hidden />
            <div className="revo-solver-track__fill">
              <span className="revo-solver-track__sheen" aria-hidden />
              <span className="revo-solver-track__tip" aria-hidden />
            </div>
          </div>
          {solverProgress?.phase === "finalize" &&
          solverProgress.finalizeTotal != null &&
          solverProgress.finalizeTotal > 0 ? (
            <div className="revo-solver-score-steps" role="list" aria-label="Scoring">
              {Array.from({ length: solverProgress.finalizeTotal }, (_, i) => {
                const done = solverProgress.finalizeStep ?? 0;
                const active =
                  solving && !stopping && i === done && done < solverProgress.finalizeTotal!;
                const complete = i < done;
                return (
                  <span
                    key={i}
                    role="listitem"
                    className={`revo-solver-score-step${complete ? " is-done" : ""}${
                      active ? " is-active" : ""
                    }`}
                    title={complete ? `Done` : active ? `Scoring` : `Wait`}
                  >
                    {i + 1}
                  </span>
                );
              })}
            </div>
          ) : null}
          {(() => {
            if (!solverProgress) return null;
            const scoring =
              solverProgress.phase === "finalize" &&
              !!solverProgress.scoringBarPreview?.length &&
              solving;
            const trying =
              !scoring &&
              solving &&
              !!solverProgress.activeBarPreview?.length &&
              solverProgress.phase !== "finalize";

            let ids = solverProgress.topBarPreview;
            let label = "Best bar so far";
            let mode: "scoring" | "trying" | "best" = "best";
            if (scoring) {
              ids = solverProgress.scoringBarPreview!;
              label = "Bar being full-scored now";
              mode = "scoring";
            } else if (trying) {
              ids = solverProgress.activeBarPreview!;
              label = "Bar under evaluation";
              mode = "trying";
            }
            if (!ids?.length) return null;

            const cycleKey = `${solverProgress.evaluations}-${ids.join("|")}`;
            return (
              <div
                key={cycleKey}
                className={`revo-solver-preview revo-solver-preview--${mode}`}
                role="list"
                aria-label={label}
                data-preview-mode={mode}
              >
                {ids.map((id, index) => {
                  const spec = ENGINE_SPECS.get(id);
                  return (
                    <div
                      key={`${id}-${index}`}
                      role="listitem"
                      title={spec?.name ?? id}
                      data-category={previewCategory(spec?.category)}
                      className="revo-solver-preview__slot"
                    >
                      {spec ? (
                        <GameIcon
                          src={abilityIconPath(spec.id, spec.style)}
                          size={22}
                          className="revo-solver-preview__icon"
                        />
                      ) : (
                        <span className="revo-solver-preview__empty" aria-hidden />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
      {solverError ? <p className="mt-2 text-xs text-chaos-300">{solverError}</p> : null}
      {solverResult ? (
        <div className="mt-3 border-t border-stone-750 pt-2" data-testid="revo-solver-results">
          <p className="text-xs text-parch-300">
            Score {formatNumber(solverResult.score)}
            {upgradeChrome ? ` · ${upgradeChrome}` : ""} ·{" "}
            {formatProofChrome(solverResult.proofLabel, {
              rng: solverResult.rng ?? solverResult.summary?.rng,
              failure: solverResult.summary?.failure,
            })}{" "}
            · {solverResult.evaluations} evals
            {solverResult.openingDpm != null
              ? ` · open ${formatNumber(solverResult.openingDpm)} / mid ${formatNumber(solverResult.developedDpm ?? 0)} / steady ${formatNumber(solverResult.steadyDpm ?? 0)}`
              : ""}
            {solverResult.honesty
              ? ` · ${solverResult.honesty.fullyValidated ? "validated" : "unvalidated"}${
                  solverResult.honesty.applyAllowed ? "" : " · apply off"
                }`
              : ""}
          </p>
          {(() => {
            const residualSource = {
              rng: {
                residualWeight:
                  solverResult.honesty?.residualMass ??
                  solverResult.rng?.residualWeight ??
                  solverResult.summary?.rng?.residualWeight,
                exactness:
                  solverResult.honesty?.branchExactness ??
                  solverResult.rng?.exactness ??
                  solverResult.summary?.rng?.exactness,
                probabilityMass: solverResult.summary?.rng?.probabilityMass,
                totalsBasis: solverResult.summary?.rng
                  ? (solverResult.summary.rng as { totalsBasis?: string }).totalsBasis
                  : undefined,
              },
            };
            const note = residualNote(residualSource);
            return note ? (
              <p className="mt-1 text-[11px] text-amber-200/90" data-testid="revo-solver-residual-note">
                {note}
              </p>
            ) : null;
          })()}
          <ul className="mt-2 space-y-1">
            {(solverResult.top ?? [{ bar: solverResult.bar, score: solverResult.score }]).map(
              (row, i) => (
                <li
                  key={`${row.fingerprint ?? i}-${row.score}`}
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  <span className="font-mono text-parch-50">
                    #{i + 1} {formatNumber(row.score)}
                  </span>
                  <span className="truncate text-parch-300">
                    {row.bar.map((id) => ENGINE_SPECS.get(id)?.name ?? id).join(" → ")}
                  </span>
                  <button
                    type="button"
                    className="border border-stone-750 px-2 py-0.5 text-parch-50 hover:bg-stone-800 disabled:opacity-40 disabled:pointer-events-none"
                    disabled={!canApplyResult}
                    onClick={() => applySolverBar(row.bar)}
                  >
                    Apply
                  </button>
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
      {!solverResult && stoppedPreview ? (
        <div
          className="mt-3 border-t border-stone-750 pt-2"
          data-testid="revo-solver-stopped-preview"
        >
          <p className="text-xs text-parch-300">
            Stopped · estimate
            {Number.isFinite(stoppedPreview.bestFullScore)
              ? ` full ~${formatNumber(stoppedPreview.bestFullScore!)}`
              : Number.isFinite(stoppedPreview.bestExploratoryScore)
                ? ` search ~${formatNumber(stoppedPreview.bestExploratoryScore!)}`
                : ""}
            {" · "}
            {stoppedPreview.evaluations} evals · unverified
          </p>
          <ul className="mt-2 space-y-1">
            <li className="flex flex-wrap items-center gap-2 text-xs">
              <span className="truncate text-parch-300">
                {stoppedPreview.bar.map((id) => ENGINE_SPECS.get(id)?.name ?? id).join(" → ")}
              </span>
              <button
                type="button"
                className="border border-stone-750 px-2 py-0.5 text-parch-50 hover:bg-stone-800"
                onClick={() => applySolverBar(stoppedPreview.bar)}
              >
                Apply
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </section>
  );
}
