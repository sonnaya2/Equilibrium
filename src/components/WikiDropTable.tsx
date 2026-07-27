import { GameIcon } from "@/components/GameIcon";

export type WikiDropTableRow = {
  item: string;
  quantity: string;
  rarity: string;
  /** Live wiki CDN icon when present (https://runescape.wiki/…). */
  iconUrl?: string | null;
};

export type WikiDropTableProps = {
  rows: WikiDropTableRow[];
  /** Optional local /game overrides keyed by item label. */
  iconByItem?: Record<string, string>;
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

/**
 * Dense editorial drop table for the /data wiki article wrapper.
 * Prefer local /game art when mapped; else live wiki inventory icons from the row.
 */
export function WikiDropTable({ rows, iconByItem }: WikiDropTableProps) {
  if (!rows.length) return null;

  return (
    <table className="data-wiki-article__drop-table">
      <caption className="data-wiki-article__drop-table-caption">Drops</caption>
      <thead>
        <tr>
          <th scope="col" className="data-wiki-article__drop-table-th">
            Item
          </th>
          <th scope="col" className="data-wiki-article__drop-table-th">
            Qty
          </th>
          <th scope="col" className="data-wiki-article__drop-table-th">
            Rarity
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const local = iconByItem?.[row.item];
          const wiki = row.iconUrl && isWikiIconUrl(row.iconUrl) ? row.iconUrl : null;
          const iconSrc =
            local && isLocalGamePath(local) ? local : wiki ?? (local ?? null);
          return (
            <tr
              key={`${row.item}\0${row.quantity}\0${row.rarity}\0${index}`}
              className="data-wiki-article__drop-table-row"
            >
              <td className="data-wiki-article__drop-table-item">
                {iconSrc ? (
                  <span className="data-wiki-article__drop-table-icon" aria-hidden>
                    {isLocalGamePath(iconSrc) ? (
                      <GameIcon src={iconSrc} size={28} />
                    ) : (
                      // Live wiki inventory glyph — not proxied; hotlinked from RS wiki CDN.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={iconSrc}
                        alt=""
                        width={28}
                        height={28}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </span>
                ) : null}
                <span className="data-wiki-article__drop-table-name">{row.item}</span>
              </td>
              <td className="data-wiki-article__drop-table-qty font-mono tabular-nums">
                {row.quantity}
              </td>
              <td className="data-wiki-article__drop-table-rarity">{row.rarity}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
