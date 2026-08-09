"use client";

import { engineSpecs as ENGINE_SPECS } from "@/combat/abilities/registry";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { formatNumber } from "./revoPanelFormat";
import type { RevoBarEntry, RevoBarLibrary } from "./revoBarLibrary";
import { isScoreVerifiedForContext, libraryForStyle } from "./revoBarLibrary";
import "./revo-solver.css";

function ScoreLabel({
  entry,
  liveScoreContext,
}: {
  entry: RevoBarEntry;
  liveScoreContext: string | null | undefined;
}) {
  const verified = isScoreVerifiedForContext(entry, liveScoreContext);
  const score = entry.score!;
  return (
    <span
      className="revo-bar-library__score font-mono"
      data-verified={verified ? "1" : "0"}
      title={verified ? "Verified" : "Estimate"}
    >
      {verified ? formatNumber(score) : `~${formatNumber(score)}`}
    </span>
  );
}

export function RevoBarLibraryPanel({
  style,
  barLibrary,
  currentSaveBar,
  currentSaveScore: _currentSaveScore,
  alreadySaved,
  solving,
  liveScoreContext = null,
  onSave,
  onLoad,
  onDropRecent,
  onDropSaved,
}: {
  style: string;
  barLibrary: RevoBarLibrary;
  currentSaveBar: string[] | null;
  currentSaveScore: number | null;
  alreadySaved: boolean;
  solving: boolean;
  /** Live simulation identity; verified scores show only when entry.scoreContext matches. */
  liveScoreContext?: string | null;
  onSave: () => void;
  onLoad: (entry: RevoBarEntry) => void;
  onDropRecent: (id: string) => void;
  onDropSaved: (id: string) => void;
}) {
  const styleLibrary = libraryForStyle(barLibrary, style);

  return (
    <section className="revo-bar-library" data-testid="revo-bar-library" aria-label="Bar list">
      <div className="revo-bar-library__head">
        <span className="revo-bar-library__title">Bar library</span>
        <button
          type="button"
          className="combat-button revo-bar-library__save"
          onClick={onSave}
          disabled={!currentSaveBar?.length || solving || alreadySaved}
          data-testid="revo-save-bar"
          title={
            alreadySaved
              ? "Already saved"
              : currentSaveBar?.length
                ? "Save this bar"
                : "Need a bar first"
          }
        >
          {alreadySaved ? "Saved" : "Save"}
        </button>
      </div>
      {currentSaveBar?.length ? (
        <div className="revo-bar-library__active" data-testid="revo-active-bar">
          <span className="revo-bar-library__active-label">Active Revo++</span>
          <span className="revo-bar-library__icons" aria-hidden>
            {currentSaveBar.slice(0, 14).map((id, index) => {
              const spec = ENGINE_SPECS.get(id);
              return spec ? (
                <GameIcon
                  key={`${id}-${index}`}
                  src={abilityIconPath(spec.id, spec.style)}
                  size={20}
                  className="revo-bar-library__icon"
                />
              ) : (
                <span key={`${id}-${index}`} className="revo-bar-library__icon-empty" />
              );
            })}
          </span>
          <span className="revo-bar-library__active-count">{currentSaveBar.length} abilities</span>
        </div>
      ) : null}
      {styleLibrary.recents.length === 0 && styleLibrary.saved.length === 0 ? (
        <p className="revo-bar-library__empty">No saved bars yet.</p>
      ) : (
        <div className="revo-bar-library__groups">
          {styleLibrary.recents.length > 0 ? (
            <div className="revo-bar-library__group">
              <h3 className="revo-bar-library__group-label">Autosaves</h3>
              <ul className="revo-bar-library__list">
                {styleLibrary.recents.map((entry) => (
                  <li key={entry.id} className="revo-bar-library__item">
                    <button
                      type="button"
                      className="revo-bar-library__apply"
                      onClick={() => onLoad(entry)}
                      title="Use bar"
                    >
                      <span className="revo-bar-library__icons" aria-hidden>
                        {entry.bar.slice(0, 10).map((id, i) => {
                          const spec = ENGINE_SPECS.get(id);
                          return spec ? (
                            <GameIcon
                              key={`${entry.id}-${id}-${i}`}
                              src={abilityIconPath(spec.id, spec.style)}
                              size={18}
                              className="revo-bar-library__icon"
                            />
                          ) : (
                            <span
                              key={`${entry.id}-${id}-${i}`}
                              className="revo-bar-library__icon-empty"
                            />
                          );
                        })}
                      </span>
                      <span className="revo-bar-library__meta">
                        <span className="revo-bar-library__name">
                          {entry.name ?? `${entry.bar.length}-slot`}
                        </span>
                        {entry.score != null ? (
                          <ScoreLabel entry={entry} liveScoreContext={liveScoreContext} />
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="revo-bar-library__drop"
                      onClick={() => onDropRecent(entry.id)}
                      aria-label="Remove autosave"
                      title="Remove"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {styleLibrary.saved.length > 0 ? (
            <div className="revo-bar-library__group">
              <h3 className="revo-bar-library__group-label">Saved</h3>
              <ul className="revo-bar-library__list">
                {styleLibrary.saved.map((entry) => (
                  <li key={entry.id} className="revo-bar-library__item">
                    <button
                      type="button"
                      className="revo-bar-library__apply"
                      onClick={() => onLoad(entry)}
                      title="Use bar"
                    >
                      <span className="revo-bar-library__icons" aria-hidden>
                        {entry.bar.slice(0, 10).map((id, i) => {
                          const spec = ENGINE_SPECS.get(id);
                          return spec ? (
                            <GameIcon
                              key={`${entry.id}-${id}-${i}`}
                              src={abilityIconPath(spec.id, spec.style)}
                              size={18}
                              className="revo-bar-library__icon"
                            />
                          ) : (
                            <span
                              key={`${entry.id}-${id}-${i}`}
                              className="revo-bar-library__icon-empty"
                            />
                          );
                        })}
                      </span>
                      <span className="revo-bar-library__meta">
                        <span className="revo-bar-library__name">
                          {entry.name ?? `${entry.bar.length}-slot`}
                        </span>
                        {entry.score != null ? (
                          <ScoreLabel entry={entry} liveScoreContext={liveScoreContext} />
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="revo-bar-library__drop"
                      onClick={() => onDropSaved(entry.id)}
                      aria-label="Delete saved bar"
                      title="Delete"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
