/**
 * Presentational chrome for the wiki article dialog — fact strip + notable helpers.
 * Large primary art stays in WikiArticleDialog. BEM under `data-wiki-article__*`.
 */
import { GameIcon } from "@/components/GameIcon";

export type WikiFactChip = {
  label: string;
  value: string;
  /** Optional local icon when the parent can resolve one. */
  iconSrc?: string | null;
};

export type WikiRailAsset = {
  src: string;
  label: string;
};

const ASSET_DISPLAY_CAP = 16;

/** Compact horizontal stat strip (hero) — labels uppercase gold, values parchment. */
export function WikiFactStrip({ facts }: { facts: WikiFactChip[] }) {
  if (!facts.length) return null;

  return (
    <dl className="data-wiki-article__facts data-wiki-article__facts--strip">
      {facts.map((fact) => (
        <div key={`${fact.label}:${fact.value}`} className="data-wiki-article__fact">
          {fact.iconSrc ? (
            <span className="data-wiki-article__fact-icon" aria-hidden>
              <GameIcon src={fact.iconSrc} size={14} />
            </span>
          ) : null}
          <dt className="data-wiki-article__fact-label">{fact.label}</dt>
          <dd className="data-wiki-article__fact-value">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Horizontal / wrap strip of related local assets (drops, gear).
 * Cap 16. Primary art is separate (`primary` only labels the rail).
 */
export function WikiAssetRail({
  assets,
  primary,
}: {
  assets: WikiRailAsset[];
  primary?: { src: string | null; label: string };
}) {
  if (!assets.length) return null;

  const shown = assets.slice(0, ASSET_DISPLAY_CAP);
  const railLabel = primary?.label
    ? `Related assets for ${primary.label}`
    : "Related assets";

  return (
    <ul className="data-wiki-article__asset-rail" aria-label={railLabel}>
      {shown.map((asset) => (
        <li key={`${asset.src}:${asset.label}`} className="data-wiki-article__asset-item">
          <span
            className="data-wiki-article__asset data-icon-well"
            title={asset.label}
            role="img"
            aria-label={asset.label}
          >
            <GameIcon src={asset.src} size={28} />
          </span>
        </li>
      ))}
    </ul>
  );
}
