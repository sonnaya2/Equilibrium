import { NextResponse } from "next/server";
import {
  finalizeArticleHtml,
  mergeExpandedDrops,
  pickLootExpandTitles,
  processWikiHtml,
  safeWikiPage,
  wikiParseApiUrl,
  WIKI_USER_AGENT,
  type WikiArticleView,
  type WikiDropRow,
} from "@/lib/wikiArticle";
import { decodeHtmlEntities } from "@/lib/htmlEntities";

export const runtime = "nodejs";

/**
 * On-demand after icon click only.
 * Client hits this after an icon click on /data — never RSC, Browse, hover, or prefetch.
 */

type ParsePayload = {
  parse?: {
    title?: string;
    displaytitle?: string;
    text?: string;
  };
  error?: { code?: string; info?: string };
};

function displayTitle(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  // Wiki often emits First Necromancer&#039;s equipment in displaytitle.
  return (
    decodeHtmlEntities(raw.replace(/<[^>]+>/g, "")).trim() || fallback
  );
}

async function fetchWikiParse(
  pageTitle: string,
  signal: AbortSignal,
): Promise<ParsePayload | null> {
  const response = await fetch(wikiParseApiUrl(pageTitle), {
    headers: { "User-Agent": WIKI_USER_AGENT, Accept: "application/json" },
    signal,
    next: { revalidate: 3600 },
  });
  if (!response.ok) return null;
  return (await response.json()) as ParsePayload;
}

/**
 * Vorkath-style pages only list uniques + a "loot (normal)" shell row.
 * Follow the preferred loot subpage and merge its real drop table.
 */
async function expandLootContainers(
  view: WikiArticleView,
  signal: AbortSignal,
): Promise<WikiArticleView> {
  // Prefer normal-mode loot subpage; one hop is enough for Vorkath-style shells.
  const titles = pickLootExpandTitles(view.drops, 1);
  if (!titles.length) return view;

  const expanded: WikiDropRow[] = [];
  for (const title of titles) {
    // Encode path so `&` in titles (Zemouregal & Vorkath…) is not a query sep.
    const path = title
      .replace(/ /g, "_")
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    const safe = safeWikiPage(`https://runescape.wiki/w/${path}`);
    if (!safe) continue;
    const payload = await fetchWikiParse(safe.pageTitle, signal);
    const html = payload?.parse?.text;
    if (!html || typeof html !== "string") continue;
    const sub = processWikiHtml(html, {
      title: safe.pageTitle,
      pageUrl: safe.pageUrl,
    });
    const modeLabel = /\(([^)]+)\)\s*$/.exec(title)?.[1]?.trim();
    for (const row of sub.drops) {
      expanded.push({
        ...row,
        group:
          row.group && modeLabel && !new RegExp(modeLabel, "i").test(row.group)
            ? `${row.group} (${modeLabel})`
            : row.group ?? (modeLabel ? `Loot (${modeLabel})` : null),
      });
    }
  }

  if (!expanded.length) return view;

  const drops = mergeExpandedDrops(view.drops, expanded);
  return finalizeArticleHtml({
    ...view,
    drops,
    hasDrops: drops.length > 0 || Boolean(view.dropsHtml.trim()),
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get("url");
  const pageParam = searchParams.get("page");

  let pageTitle: string;
  let pageUrl: string;

  if (urlParam) {
    const safe = safeWikiPage(urlParam);
    if (!safe) {
      return NextResponse.json({ error: "Invalid wiki URL" }, { status: 400 });
    }
    pageTitle = safe.pageTitle;
    pageUrl = safe.pageUrl;
  } else if (pageParam?.trim()) {
    const title = pageParam.trim();
    const safe = safeWikiPage(
      `https://runescape.wiki/w/${encodeURIComponent(title.replace(/ /g, "_"))}`,
    );
    if (!safe) {
      return NextResponse.json({ error: "Invalid wiki page" }, { status: 400 });
    }
    pageTitle = safe.pageTitle;
    pageUrl = safe.pageUrl;
  } else {
    return NextResponse.json({ error: "Missing url or page" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18_000);

    try {
      const payload = await fetchWikiParse(pageTitle, controller.signal);
      if (!payload) {
        return NextResponse.json(
          { error: "RuneScape Wiki request failed" },
          { status: 502 },
        );
      }
      if (payload.error?.info) {
        return NextResponse.json(
          { error: payload.error.info },
          { status: 404 },
        );
      }

      const text = payload.parse?.text;
      if (typeof text !== "string" || !text.trim()) {
        return NextResponse.json(
          { error: "Wiki response did not include article HTML" },
          { status: 502 },
        );
      }

      const title = displayTitle(
        payload.parse?.displaytitle ?? payload.parse?.title,
        pageTitle,
      );

      let view: WikiArticleView = finalizeArticleHtml(
        processWikiHtml(text, { title, pageUrl }),
      );
      view = await expandLootContainers(view, controller.signal);

      return NextResponse.json(view, {
        headers: {
          "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load wiki article";
    return NextResponse.json({ error: message }, { status: 504 });
  }
}
