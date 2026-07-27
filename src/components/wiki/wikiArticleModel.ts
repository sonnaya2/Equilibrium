/**
 * Wiki article dialog types + pure response validation (no React).
 */

import type { WikiArticleView } from "@/lib/wikiArticle";
import { safeWikiPage } from "@/lib/wikiArticle";
import type { WikiDropTableRow } from "@/components/WikiDropTable";

export type WikiArticleTarget = {
  /** Local public/game art — never a wiki image URL. */
  localArtSrc: string | null;
  name: string;
  /** Existing catalog source URL; wrapper opens only when this is a wiki page. */
  wikiUrl?: string | null;
  /** Extra local asset labels (reward names, etc.) already in memory — not wiki-fetched. */
  relatedLabels?: string[];
  /** Pre-resolved local icons from catalog rewards — used for drop table rows. */
  relatedIcons?: { label: string; src: string }[];
};

export type WikiDropRow = WikiDropTableRow;

/** Client view: base contract + optional structured drops from future API. */
export type WikiArticleClientView = WikiArticleView & {
  drops?: WikiDropRow[];
};

export type WikiLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; view: WikiArticleClientView }
  | { status: "error"; message: string; pageUrl: string | null };

export function isWikiView(data: unknown): data is WikiArticleClientView {
  if (!data || typeof data !== "object") return false;
  const v = data as Record<string, unknown>;
  if (
    typeof v.title !== "string" ||
    typeof v.pageUrl !== "string" ||
    typeof v.leadHtml !== "string" ||
    typeof v.dropsHtml !== "string" ||
    typeof v.bodyHtml !== "string" ||
    typeof v.hasDrops !== "boolean" ||
    !Array.isArray(v.facts)
  ) {
    return false;
  }
  // Reject non-wiki / non-https pageUrl (defense-in-depth vs API drift).
  if (!safeWikiPage(v.pageUrl)) return false;
  // Optional structured drops — tolerate missing; reject wrong shape.
  if (v.drops != null && !Array.isArray(v.drops)) return false;
  return true;
}

export function applyPixelScale(
  img: HTMLImageElement,
  setPixelated: (v: boolean) => void,
  maxCanvas: number,
) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const maxEdge = Math.max(nw, nh);
  const isGlyph = maxEdge > 0 && maxEdge <= 96;
  setPixelated(isGlyph);
  if (isGlyph) {
    const scale = Math.min(
      maxCanvas >= 400 ? 8 : 6,
      Math.max(maxCanvas >= 400 ? 4 : 3, Math.floor(maxCanvas / maxEdge)),
    );
    img.style.width = `${nw * scale}px`;
    img.style.height = `${nh * scale}px`;
  } else {
    img.style.width = "";
    img.style.height = "";
  }
}
