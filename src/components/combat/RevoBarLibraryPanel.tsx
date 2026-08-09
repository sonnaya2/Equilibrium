"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { engineSpecs as ENGINE_SPECS } from "@/combat/abilities/registry";
import { abilityIconPath } from "@/lib/gameArt";
import { GameIcon } from "../GameIcon";
import { CombatFrame } from "./CombatFrame";
import { formatNumber } from "./revoPanelFormat";
import type { RevoBarEntry, RevoBarLibrary } from "./revoBarLibrary";
import { isScoreVerifiedForContext, libraryForStyle } from "./revoBarLibrary";
import "./revo-solver.css";

/** Visible bar rows on the left rail (including placeholders). */
export const VISIBLE_LIBRARY_SLOTS = 8;

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

function BarIcons({ bar, limit }: { bar: readonly string[]; limit: number }) {
  return (
    <span className="revo-bar-library__icons" aria-hidden>
      {bar.slice(0, limit).map((id, i) => {
        const spec = ENGINE_SPECS.get(id);
        return spec ? (
          <GameIcon
            key={`${id}-${i}`}
            src={abilityIconPath(spec.id, spec.style)}
            size={32}
            className="revo-bar-library__icon"
          />
        ) : (
          <span key={`${id}-${i}`} className="revo-bar-library__icon-empty" />
        );
      })}
    </span>
  );
}

function LibraryBarRow({
  entry,
  liveScoreContext,
  onLoad,
  onDrop,
  dropLabel,
}: {
  entry: RevoBarEntry;
  liveScoreContext: string | null | undefined;
  onLoad: (entry: RevoBarEntry) => void;
  onDrop: (id: string) => void;
  dropLabel: string;
}) {
  const label = entry.name ?? `${entry.bar.length}-slot`;
  return (
    <li className="revo-bar-library__item">
      <button
        type="button"
        className="revo-bar-library__apply"
        onClick={() => onLoad(entry)}
        title={`Use bar · ${label}`}
        aria-label={`Use bar ${label}`}
      >
        <BarIcons bar={entry.bar} limit={entry.bar.length} />
        {entry.score != null ? (
          <ScoreLabel entry={entry} liveScoreContext={liveScoreContext} />
        ) : null}
      </button>
      <button
        type="button"
        className="revo-bar-library__drop"
        onClick={() => onDrop(entry.id)}
        aria-label={dropLabel}
        title={dropLabel}
      >
        ×
      </button>
    </li>
  );
}

function PlaceholderRow({ index }: { index: number }) {
  return (
    <li className="revo-bar-library__item revo-bar-library__item--placeholder" aria-hidden>
      <div className="revo-bar-library__apply revo-bar-library__apply--placeholder">
        <span className="revo-bar-library__icons">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="revo-bar-library__icon-empty" />
          ))}
        </span>
      </div>
      <span className="revo-bar-library__drop revo-bar-library__drop--ghost" />
    </li>
  );
}

type ListedBar = {
  entry: RevoBarEntry;
  kind: "recent" | "saved";
};

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
  const [moreOpen, setMoreOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const listed = useMemo((): ListedBar[] => {
    const rows: ListedBar[] = [];
    for (const entry of styleLibrary.recents) rows.push({ entry, kind: "recent" });
    for (const entry of styleLibrary.saved) rows.push({ entry, kind: "saved" });
    return rows;
  }, [styleLibrary.recents, styleLibrary.saved]);

  const total = listed.length;
  const overflow = total > VISIBLE_LIBRARY_SLOTS;
  const visibleCap = overflow ? VISIBLE_LIBRARY_SLOTS - 1 : VISIBLE_LIBRARY_SLOTS;
  const visible = listed.slice(0, visibleCap);
  const placeholderCount = Math.max(0, visibleCap - visible.length);
  const hiddenCount = overflow ? total - visibleCap : 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (moreOpen && !dialog.open) dialog.showModal();
    if (!moreOpen && dialog.open) dialog.close();
  }, [moreOpen]);

  const dropFor = (kind: "recent" | "saved") =>
    kind === "recent" ? onDropRecent : onDropSaved;
  const dropLabelFor = (kind: "recent" | "saved") =>
    kind === "recent" ? "Remove autosave" : "Delete saved bar";

  return (
    <section className="revo-bar-library" data-testid="revo-bar-library" aria-label="Bar list">
      <div className="revo-bar-library__head">
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
                  size={32}
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

      <ul className="revo-bar-library__list revo-bar-library__list--rail" data-testid="revo-bar-slots">
        {visible.map(({ entry, kind }) => (
          <LibraryBarRow
            key={entry.id}
            entry={entry}
            liveScoreContext={liveScoreContext}
            onLoad={onLoad}
            onDrop={dropFor(kind)}
            dropLabel={dropLabelFor(kind)}
          />
        ))}
        {Array.from({ length: placeholderCount }, (_, i) => (
          <PlaceholderRow key={`ph-${i}`} index={i} />
        ))}
        {overflow ? (
          <li className="revo-bar-library__item revo-bar-library__item--more">
            <button
              type="button"
              className="revo-bar-library__more"
              onClick={() => setMoreOpen(true)}
              data-testid="revo-bar-show-more"
            >
              Show more · {hiddenCount} more bar{hiddenCount === 1 ? "" : "s"}
            </button>
          </li>
        ) : null}
      </ul>

      <CombatFrame
        as="dialog"
        frameRef={dialogRef}
        className="revo-bar-library-dialog"
        aria-labelledby={titleId}
        onClose={() => setMoreOpen(false)}
        data-testid="revo-bar-more-dialog"
      >
        <header className="revo-bar-library-dialog__header">
          <h2 id={titleId}>All bars · {style}</h2>
          <button
            type="button"
            aria-label="Close bar list"
            onClick={() => setMoreOpen(false)}
          >
            ×
          </button>
        </header>
        <div className="revo-bar-library-dialog__body">
          {styleLibrary.recents.length > 0 ? (
            <div className="revo-bar-library__group">
              <h3 className="revo-bar-library__group-label">Autosaves</h3>
              <ul className="revo-bar-library__list">
                {styleLibrary.recents.map((entry) => (
                  <LibraryBarRow
                    key={entry.id}
                    entry={entry}
                    liveScoreContext={liveScoreContext}
                    onLoad={(e) => {
                      onLoad(e);
                      setMoreOpen(false);
                    }}
                    onDrop={onDropRecent}
                    dropLabel="Remove autosave"
                  />
                ))}
              </ul>
            </div>
          ) : null}
          {styleLibrary.saved.length > 0 ? (
            <div className="revo-bar-library__group">
              <h3 className="revo-bar-library__group-label">Saved</h3>
              <ul className="revo-bar-library__list">
                {styleLibrary.saved.map((entry) => (
                  <LibraryBarRow
                    key={entry.id}
                    entry={entry}
                    liveScoreContext={liveScoreContext}
                    onLoad={(e) => {
                      onLoad(e);
                      setMoreOpen(false);
                    }}
                    onDrop={onDropSaved}
                    dropLabel="Delete saved bar"
                  />
                ))}
              </ul>
            </div>
          ) : null}
          {total === 0 ? (
            <p className="revo-bar-library__empty">No saved bars yet.</p>
          ) : null}
        </div>
      </CombatFrame>
    </section>
  );
}
