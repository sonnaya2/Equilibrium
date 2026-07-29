"use client";

import { useMemo, useState } from "react";
import { GameIcon } from "@/components/GameIcon";
import type { WikiDropRow } from "@/lib/wikiArticle";
import {
  DROP_GROUP_PREVIEW_LIMIT,
  groupDropsForPresentation,
  NOTED_BADGE_ICON_URL,
  type DropRarityTier,
  type PresentedDrop,
  type PresentedDropGroup,
} from "@/lib/wikiDropPresentation";

export type WikiDropTableRow = WikiDropRow;

export type WikiDropTableProps = {
  rows: WikiDropTableRow[];
  /** Optional local /game overrides keyed by item label. */
  iconByItem?: Record<string, string>;
  /**
   * summary — unique + short secondary only, open full table in a popup.
   * full — every group expanded for the dedicated drops window.
   */
  variant?: "summary" | "full";
  onOpenFull?: () => void;
};

function isLocalGamePath(src: string): boolean {
  return src.startsWith("/game/");
}

function isWikiIconUrl(src: string): boolean {
  try {
    const u = new URL(src);
    return (
      u.protocol === "https:" &&
      (u.hostname === "runescape.wiki" ||
        u.hostname === "www.runescape.wiki" ||
        u.hostname.endsWith(".runescape.wiki"))
    );
  } catch {
    return false;
  }
}

function resolveIcon(
  row: PresentedDrop,
  iconByItem?: Record<string, string>,
): { primary: string | null; fallback: string | null } {
  // Live wiki glyph wins; local /game path is fallback (presentDrop + catalog map).
  const wiki = row.iconUrl && isWikiIconUrl(row.iconUrl) ? row.iconUrl : null;
  const localFromRow = row.iconUrl && isLocalGamePath(row.iconUrl) ? row.iconUrl : null;
  const localMapped = iconByItem?.[row.item];
  const local = localFromRow ?? (localMapped && isLocalGamePath(localMapped) ? localMapped : null);
  if (wiki) return { primary: wiki, fallback: local };
  if (local) return { primary: local, fallback: null };
  return { primary: null, fallback: null };
}

function RarityDot({ tier }: { tier: DropRarityTier }) {
  if (tier === "unknown") return null;
  return (
    <span
      className={`data-wiki-article__rarity-dot data-wiki-article__rarity-dot--${tier}`}
      aria-hidden
    />
  );
}

function DropIcon({
  src,
  fallbackSrc,
}: {
  src: string;
  /** Local /game path when the live wiki glyph 404s. */
  fallbackSrc?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const showPrimary = !failed;
  const showFallback = failed && fallbackSrc && isLocalGamePath(fallbackSrc) && !fallbackFailed;

  if (!showPrimary && !showFallback) {
    return <span className="data-wiki-article__drop-table-icon is-empty" aria-hidden />;
  }

  return (
    <span className="data-wiki-article__drop-table-icon" aria-hidden>
      {showPrimary && isLocalGamePath(src) ? (
        <GameIcon src={src} size={28} onLoadFailed={() => setFailed(true)} />
      ) : null}
      {showPrimary && !isLocalGamePath(src) ? (
        // Live wiki inventory glyph (runescape.wiki CDN only).
        <img
          src={src}
          alt=""
          width={28}
          height={28}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : null}
      {showFallback ? (
        <GameIcon src={fallbackSrc!} size={28} onLoadFailed={() => setFallbackFailed(true)} />
      ) : null}
    </span>
  );
}

function NotedBadge() {
  return (
    <span className="data-wiki-article__noted-badge" title="Noted" aria-label="Noted">
      <img
        src={NOTED_BADGE_ICON_URL}
        alt=""
        width={14}
        height={14}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    </span>
  );
}

function DropGroupTable({
  group,
  iconByItem,
  forceOpen,
}: {
  group: PresentedDropGroup;
  iconByItem?: Record<string, string>;
  /** Full popup: never collapse groups. */
  forceOpen?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(forceOpen ? false : group.collapsedByDefault);
  const [showAll, setShowAll] = useState(Boolean(forceOpen));

  const count = group.rows.length;
  const limit = forceOpen ? 0 : group.previewLimit || 0;
  const needsPreview = !collapsed && limit > 0 && count > limit && !showAll;
  const visible = needsPreview ? group.rows.slice(0, limit) : group.rows;
  const hidden = needsPreview ? count - limit : 0;

  return (
    <div className="data-wiki-article__drop-group">
      <div className="data-wiki-article__drop-group-head">
        <h3 className="data-wiki-article__drop-group-title">{group.label}</h3>
        {!forceOpen && group.collapsedByDefault ? (
          <button
            type="button"
            className="data-wiki-article__drop-toggle"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
          >
            {collapsed ? `Show ${count}` : "Hide"}
          </button>
        ) : (
          <span className="data-wiki-article__drop-group-count">{count}</span>
        )}
      </div>
      {!collapsed ? (
        <>
          <table className="data-wiki-article__drop-table">
            <thead>
              <tr>
                <th scope="col" className="data-wiki-article__drop-table-th">
                  Item
                </th>
                <th scope="col" className="data-wiki-article__drop-table-th">
                  Qty
                </th>
                <th scope="col" className="data-wiki-article__drop-table-th">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => {
                const icon = resolveIcon(row, iconByItem);
                return (
                  <tr
                    key={`${group.id}\0${row.item}\0${row.quantity}\0${row.rate}\0${index}`}
                    className="data-wiki-article__drop-table-row"
                  >
                    <td className="data-wiki-article__drop-table-item">
                      {icon.primary ? (
                        <DropIcon src={icon.primary} fallbackSrc={icon.fallback} />
                      ) : (
                        <span className="data-wiki-article__drop-table-icon is-empty" aria-hidden />
                      )}
                      <span className="data-wiki-article__drop-table-name">{row.item}</span>
                      {row.noted ? <NotedBadge /> : null}
                    </td>
                    <td className="data-wiki-article__drop-table-qty font-mono tabular-nums">
                      {row.quantity}
                    </td>
                    <td className="data-wiki-article__drop-table-rarity">
                      <span className="data-wiki-article__drop-rate">
                        <RarityDot tier={row.rarityTier} />
                        <span className="font-mono tabular-nums">{row.rate}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hidden > 0 ? (
            <button
              type="button"
              className="data-wiki-article__drop-more"
              onClick={() => setShowAll(true)}
            >
              Show {hidden} more
            </button>
          ) : null}
          {showAll && !forceOpen && limit > 0 && count > limit ? (
            <button
              type="button"
              className="data-wiki-article__drop-more"
              onClick={() => setShowAll(false)}
            >
              Show fewer
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Multi-column dense drop groups for the /data wiki article wrapper.
 */
export function WikiDropTable({
  rows,
  iconByItem,
  variant = "summary",
  onOpenFull,
}: WikiDropTableProps) {
  const allGroups = useMemo(() => groupDropsForPresentation(rows), [rows]);
  const total = allGroups.reduce((n, g) => n + g.rows.length, 0);
  const isFull = variant === "full";

  // Summary: unique + compact secondary only. Main/common lives in the full popup.
  const groups = useMemo(() => {
    if (isFull) return allGroups;
    return allGroups.filter((g) => g.id === "unique" || g.id === "valuable");
  }, [allGroups, isFull]);

  const hiddenCount = isFull
    ? 0
    : allGroups.filter((g) => g.id === "common").reduce((n, g) => n + g.rows.length, 0);

  if (!rows.length || !allGroups.length) return null;

  // Summary uses a single stack so a 4-row unique table doesn't leave a half-empty
  // second column beside a 1-row charms group (Gate of Elidinis screenshot).
  const cols = isFull ? Math.min(3, groups.length) : 1;

  return (
    <div
      className={
        isFull
          ? "data-wiki-article__drop-board data-wiki-article__drop-board--full"
          : "data-wiki-article__drop-board data-wiki-article__drop-board--summary"
      }
    >
      <div className="data-wiki-article__drop-board-head">
        <h3 className="data-wiki-article__drop-board-title">{isFull ? "All drops" : "Drops"}</h3>
        <div className="data-wiki-article__drop-board-actions">
          <span className="data-wiki-article__drop-board-meta">
            {total} item{total === 1 ? "" : "s"}
            {!isFull && hiddenCount > 0 ? ` · ${hiddenCount} more` : null}
          </span>
          {!isFull && onOpenFull && total > 0 ? (
            <button
              type="button"
              className="data-wiki-article__drop-open-full"
              onClick={onOpenFull}
            >
              {hiddenCount > 0 || total > DROP_GROUP_PREVIEW_LIMIT ? `Full table` : `Open table`}
            </button>
          ) : null}
        </div>
      </div>

      {groups.length > 0 ? (
        <div className="data-wiki-article__drop-columns" data-cols={cols}>
          {groups.map((group) => (
            <DropGroupTable
              key={group.id}
              group={group}
              iconByItem={iconByItem}
              forceOpen={isFull}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Compact notable chase-item strip for the hero modules. */
export function WikiNotableDrops({
  rows,
  iconByItem,
}: {
  rows: PresentedDrop[];
  iconByItem?: Record<string, string>;
}) {
  if (!rows.length) return null;

  return (
    <ul className="data-wiki-article__notable" aria-label="Notable drops">
      {rows.map((row) => {
        const icon = resolveIcon(row, iconByItem);
        const tip = [row.item, row.noted ? "noted" : null, row.quantity, row.rate]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={row.item} className="data-wiki-article__notable-item" title={tip}>
            {icon.primary ? (
              <DropIcon src={icon.primary} fallbackSrc={icon.fallback} />
            ) : (
              <span className="data-wiki-article__drop-table-icon is-empty" aria-hidden />
            )}
            <span className="data-wiki-article__notable-name">{row.item}</span>
            {row.noted ? <NotedBadge /> : null}
          </li>
        );
      })}
    </ul>
  );
}
